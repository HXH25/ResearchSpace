import io
import json
import zipfile
import httpx
import pytest
from fastapi.testclient import TestClient
from server.app import create_app
from server.settings import SettingsStore, account_scope
from server.presets import AI, SEARCH

ALICE = {'X-ResearchSpace-User': 'alice', 'X-ResearchSpace-Token': 'a' * 64}
BOB = {'X-ResearchSpace-User': 'bob', 'X-ResearchSpace-Token': 'b' * 64}
REQUEST = {'task': 'outreach_email', 'input': 'Return JSON with drafts.', 'responseFormat': 'json', 'containsPersonalData': True, 'personalDataConsent': True}


@pytest.fixture
def api(tmp_path):
    calls = []
    def upstream(request):
        calls.append(request)
        if request.url.path.endswith('/messages'):
            return httpx.Response(200, json={'content': [{'type': 'text', 'text': '{"drafts":[]}'}], 'stop_reason': 'end_turn'})
        if request.url.path.endswith('/chat/completions'):
            return httpx.Response(200, json={'choices': [{'message': {'content': '{"drafts":[]}'}, 'finish_reason': 'stop'}]})
        if request.url.host == 'api.openalex.org':
            return httpx.Response(200, json={'meta': {'count': 1}, 'results': [{'id': 'https://openalex.org/W123', 'title': 'Research lab', 'doi': 'https://example.edu/lab', 'publication_year': 2025, 'authorships': []}]})
        rows = [{'title': 'Research lab', 'url': 'https://example.edu/lab', 'link': 'https://example.edu/lab', 'snippet': 'A public research lead', 'content': 'Public research', 'text': 'Research text', 'description': 'Brave result'}, {'title': 'unsafe', 'url': 'javascript:alert(1)', 'link': 'javascript:alert(1)'}]
        return httpx.Response(200, json={'results': rows, 'web': {'results': rows}, 'organic': rows, 'organic_results': rows})
    app = create_app(tmp_path, httpx.MockTransport(upstream), srt_seed=None)
    with TestClient(app) as client:
        yield client, calls, app


def save(client, kind, provider, headers=ALICE, **options):
    body = {'api_key': 'synthetic-' + provider, 'make_active': True, **options}
    response = client.put(f'/api/settings/{kind}/{provider}', headers=headers, json=body)
    assert response.status_code == 200, response.text
    assert 'synthetic-' not in response.text
    return response.json()


def test_settings_are_isolated_and_save_does_not_contact_upstream(api):
    c, calls, _ = api
    assert c.get('/api/settings').status_code == 401
    save(c, 'ai', 'openai')
    save(c, 'ai', 'deepseek', model='deepseek-flash')
    a = c.get('/api/settings', headers=ALICE).json()
    b = c.get('/api/settings', headers=BOB).json()
    assert a['ai']['openai']['has_key'] and a['ai']['deepseek']['has_key']
    assert a['active']['ai'] == 'deepseek'
    assert not b['ai']['openai']['has_key'] and b['active']['ai'] == 'openai'
    assert calls == []
    # Reusing a known UUID with a different capability does not grant access.
    impostor = dict(ALICE, **{'X-ResearchSpace-Token': 'c' * 64})
    assert not c.get('/api/settings', headers=impostor).json()['ai']['openai']['has_key']


def test_key_lifecycle_and_endpoint_change_requires_reentry(api, tmp_path):
    c, _, app = api
    save(c, 'ai', 'openai', persist_key=True)
    scope = account_scope('alice', 'a' * 64)
    content = (tmp_path / 'accounts' / scope / 'settings.json').read_text()
    assert 'synthetic-openai' not in content and 'encrypted_key' in content
    restarted = SettingsStore(tmp_path)
    assert restarted.get_config(scope, 'ai')[2] == 'synthetic-openai'
    assert c.put('/api/settings/ai/openai', headers=ALICE, json={'base_url': 'https://other.example/v1'}).status_code == 400
    assert c.delete('/api/settings/ai/openai/key', headers=ALICE).json()['ai']['openai']['has_key'] is False
    assert SettingsStore(tmp_path).get_config(scope, 'ai')[2] == ''
    save(c, 'ai', 'deepseek', persist_key=False)
    assert app.state.settings.get_config(scope, 'ai')[2] == 'synthetic-deepseek'
    assert SettingsStore(tmp_path).get_config(scope, 'ai')[2] == ''


@pytest.mark.parametrize('provider', [p['id'] for p in AI])
def test_ai_default_routing_and_provider_protocol(api, provider):
    c, calls, _ = api
    opts = {'model': 'test-model'}
    if provider == 'custom':
        opts['base_url'] = 'https://custom.example/v1'
    save(c, 'ai', provider, **opts)
    r = c.post('/api/ai/generate', headers=ALICE, json=REQUEST)
    assert r.status_code == 200, r.text
    assert r.json()['provider'] == provider and r.json()['mode'] == 'live'
    request = calls[-1]
    payload = json.loads(request.content)
    assert payload['model'] == 'test-model'
    if provider == 'anthropic':
        assert request.headers['x-api-key'] == 'synthetic-anthropic'
        assert request.headers['anthropic-version'] == '2023-06-01'
        assert 'system' in payload and request.url.path.endswith('/messages')
    else:
        assert request.headers['authorization'] == 'Bearer synthetic-' + provider
        assert payload['response_format']['type'] == 'json_object'
        assert request.url.path.endswith('/chat/completions')


def test_ai_consent_and_unconfigured_fail_without_network(api):
    c, calls, _ = api
    r = c.post('/api/ai/generate', headers=ALICE, json=REQUEST)
    assert r.status_code == 400 and calls == []
    save(c, 'ai', 'openai')
    r = c.post('/api/ai/generate', headers=ALICE, json=dict(REQUEST, personalDataConsent=False))
    assert r.status_code == 403 and calls == []
    r = c.post('/api/ai/generate', headers=BOB, json=REQUEST)
    assert r.status_code == 400 and calls == []


@pytest.mark.parametrize('provider', [p['id'] for p in SEARCH])
def test_search_provider_auth_and_normalization(api, provider):
    c, calls, _ = api
    opts = {'base_url': 'https://search.example/search'} if provider == 'custom' else {}
    save(c, 'search', provider, **opts)
    r = c.post('/api/search', headers=ALICE, json={'query': 'robotics', 'limit': 4})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data['provider'] == provider and len(data['results']) == 1
    assert data['results'][0]['url'] == 'https://example.edu/lab'
    req = calls[-1]
    if provider == 'brave':
        assert req.headers['x-subscription-token'] == 'synthetic-brave' and req.url.params['q'] == 'robotics'
    elif provider in ('serper', 'exa'):
        assert req.headers['x-api-key'] == 'synthetic-' + provider
    elif provider in ('serpapi', 'openalex'):
        assert req.url.params['api_key'] == 'synthetic-' + provider
    else:
        assert req.headers['authorization'] == 'Bearer synthetic-' + provider


def test_connection_test_uses_saved_selection_not_default(api):
    c, calls, _ = api
    save(c, 'ai', 'deepseek')
    save(c, 'ai', 'openai', make_active=False)
    assert c.post('/api/settings/ai/openai/test', headers=ALICE).json()['ok']
    assert calls[-1].url.host == 'api.openai.com'
    assert c.get('/api/settings', headers=ALICE).json()['active']['ai'] == 'deepseek'


def test_upstream_error_and_validation_never_echo_keys(tmp_path):
    def error(request):
        return httpx.Response(401, json={'error': 'synthetic-openai exposed upstream'})
    with TestClient(create_app(tmp_path, httpx.MockTransport(error))) as c:
        save(c, 'ai', 'openai')
        r = c.post('/api/ai/generate', headers=ALICE, json=REQUEST)
        assert r.status_code == 502 and 'synthetic' not in r.text and '401' in r.text
        r = c.post('/api/search', headers=ALICE, json={'query': 'test', 'api_key': 'do-not-echo'})
        assert r.status_code == 422 and 'do-not-echo' not in r.text


def test_recommendation_handoff_and_private_srt_isolation(api):
    c, _, _ = api
    rows = [{'project_id': 'srt-test-001', 'title': '机器人研究', 'mentor': 'Example mentor', 'description': 'Robot learning', 'start_month': '202610', 'end_month': '202704'}]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as z:
        z.writestr('SRT/project_details.json', json.dumps(rows))
    r = c.post('/api/import/srt', headers=dict(ALICE, **{'X-Filename': 'srt.zip'}), content=buffer.getvalue())
    assert r.status_code == 200 and r.json()['total'] == 1
    profile = {'schemaVersion': 1, 'institution': 'Tsinghua University', 'undergraduateYear': 'year2', 'interestKeywords': ['机器人'], 'researchAreas': ['ai-computing'], 'skills': ['programming'], 'workPreferences': ['coding'], 'goals': ['srt'], 'preferredLanguages': ['zh']}
    r = c.post('/api/recommend', headers=ALICE, json={'profile': profile, 'filters': {'q': '机器人'}})
    assert r.status_code == 200, r.text
    p = r.json()['items'][0]
    assert p['mentors'] == ['Example mentor'] and p['visibility'] == 'private'
    assert p['contract']['type'] == 'srt' and p['contract']['eligibility'] == 'tsinghua_only'
    assert p['contract']['status'] == 'unknown' and not p['contract']['isDemo']
    assert c.get('/api/projects/' + p['id'], headers=ALICE).status_code == 200
    assert c.get('/api/projects/' + p['id'], headers=BOB).status_code == 404
    assert c.get('/api/projects?q=机器人', headers=BOB).json()['total'] == 0
    assert p['id'] not in c.get('/api/export', headers=ALICE).text


def test_local_boundary_and_account_removal(api):
    c, _, _ = api
    assert c.get('/api/settings', headers={**ALICE, 'Origin': 'https://evil.example'}).status_code == 403
    assert c.get('/api/health', headers={'Host': 'evil.example'}).status_code == 400
    save(c, 'ai', 'openai', persist_key=True)
    assert c.delete('/api/account', headers=ALICE).status_code == 200
    assert not c.get('/api/settings', headers=ALICE).json()['ai']['openai']['has_key']


def test_preset_validation_and_bad_imports(api):
    c, calls, _ = api
    for body in [{'max_tokens': -1}, {'api_key': 'bad\nkey'}, {'base_url': 'javascript:bad'}, {'base_url': 'https://user:password@example.com/v1'}, {'persist_key': 'false'}]:
        assert c.put('/api/settings/ai/openai', headers=ALICE, json=body).status_code == 400
    assert c.post('/api/import/srt', headers=dict(ALICE, **{'X-Filename': 'bad.zip'}), content=b'badzip').status_code == 400
    assert c.post('/api/import', headers=ALICE, json={'projects': [{'title': 'missing source'}]}).status_code == 400
    assert not calls
