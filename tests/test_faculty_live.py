import json
import httpx
import pytest
from fastapi.testclient import TestClient
from server.app import create_app
from research.fuzzy import fuzzy_score

A = {'X-ResearchSpace-User': 'faculty-test', 'X-ResearchSpace-Token': 'a' * 64}
B = {'X-ResearchSpace-User': 'other-test', 'X-ResearchSpace-Token': 'b' * 64}

@pytest.fixture
def live(tmp_path):
    calls = []
    def upstream(req):
        calls.append(req)
        if req.url.path == '/authors':
            return httpx.Response(200, json={'meta': {'count': 1}, 'results': [{'id': 'https://openalex.org/A123', 'display_name': 'Test Researcher', 'last_known_institutions': [{'display_name': 'Test University'}]}]})
        works = [{'id': f'https://openalex.org/W{i}', 'title': f'Machine learning {i}', 'publication_year': 2025,
                  'doi': f'https://doi.org/10.1234/test.{i}', 'primary_topic': {'display_name': 'Machine Learning'},
                  'authorships': [{'author_position': 'last', 'is_corresponding': True, 'author': {'id': 'https://openalex.org/A123', 'display_name': 'Test Researcher'}, 'institutions': [{'display_name': 'Test University'}]}]} for i in (1, 2)]
        return httpx.Response(200, json={'meta': {'count': 2}, 'results': works})
    app = create_app(tmp_path, httpx.MockTransport(upstream), srt_seed=None)
    with TestClient(app) as c:
        yield c, calls, app

def configure(c):
    r = c.put('/api/settings/search/openalex', headers=A, json={'api_key': 'synthetic-openalex', 'make_active': False})
    assert r.status_code == 200 and 'synthetic-openalex' not in r.text

def test_database_is_real_paginated_and_source_attributed(live):
    c, calls, app = live
    assert c.get('/api/faculty').status_code == 401
    data = c.get('/api/faculty', headers=A).json()
    assert data['total'] == 4026 and len(data['items']) == 12
    ids = {e['faculty']['id'] for e in data['items']}
    second = c.get('/api/faculty?page=2', headers=A).json()
    assert ids.isdisjoint({e['faculty']['id'] for e in second['items']})
    for e in app.state.faculty.entries:
        f = e['faculty']
        assert not f['isDemo'] and f['sources'][0]['type'] == 'official'
        assert f['recruitmentStatus'] == 'unknown' and f['officialPage'].startswith(('https://', 'http://'))
        if f['id'] in ids:
            assert f['id'] == c.get('/api/faculty/' + f['id'], headers=A).json()['faculty']['id']
    assert calls == []

def test_aliases_typos_filters_and_exact_mode(live):
    c, _, _ = live
    exact = c.get('/api/faculty', params={'q': '机器学习', 'page_size': 100}, headers=A).json()
    typo = c.get('/api/faculty', params={'q': 'machine learnng', 'page_size': 100}, headers=A).json()
    assert exact['total'] > 0 and typo['total'] > 0
    assert {e['faculty']['id'] for e in exact['items']} & {e['faculty']['id'] for e in typo['items']}
    assert c.get('/api/faculty?q=machine%20learnng&fuzzy=false', headers=A).json()['total'] == 0
    assert c.get('/api/faculty?status=confirmed_open', headers=A).json()['total'] == 0
    assert c.get('/api/faculty?page=0', headers=A).status_code == 422
    assert not fuzzy_score('王明 物理', '王鸣')
    assert fuzzy_score('机器人学 electrical engineering', 'robotcs 电气')
    assert not fuzzy_score('机器人', 'robotics protein')
    assert not fuzzy_score('机器学习', '机器人')

def test_openalex_config_routing_attribution_and_account_cache(live):
    c, calls, _ = live
    assert c.get('/api/faculty?source=openalex&q=robotics', headers=A).status_code == 400
    assert calls == []
    configure(c)
    data = c.get('/api/faculty?source=openalex&q=机器学习', headers=A).json()
    assert data['total_kind'] == 'works' and data['total'] == 2
    assert len(data['items']) == 1
    f = data['items'][0]['faculty']
    assert len(f['selectedWorks']) == 2 and f['recruitmentStatus'] == 'unknown'
    assert all(s['type'] == 'academic' for s in f['sources'])
    assert 'officialPage' not in f and 'publiclyListedContactEmail' not in f
    assert calls[-1].url.params['api_key'] == 'synthetic-openalex'
    assert calls[-1].url.params['search'] == 'machine learning'
    assert 'synthetic-openalex' not in json.dumps(data)
    assert c.get('/api/settings', headers=A).json()['active']['search'] == 'tavily'
    assert c.get('/api/faculty/openalex:A123', headers=B).status_code == 404
    c.delete('/api/settings/search/openalex/key', headers=A)
    assert c.get('/api/faculty/openalex:A123', headers=A).status_code == 200
    saved = c.get('/api/faculty?ids=openalex:A123', headers=A).json()
    assert saved['total'] == 1
    assert c.get('/api/faculty?ids=openalex:A123', headers=B).json()['total'] == 0

def test_openalex_name_and_opportunity_search(live):
    c, calls, _ = live
    configure(c)
    r = c.get('/api/faculty?source=openalex&search_mode=name&q=Researcher', headers=A)
    assert r.status_code == 200 and r.json()['total_kind'] == 'authors'
    assert calls[-1].url.path == '/authors'
    result = c.post('/api/search', headers=A, json={'query': 'robotics', 'provider': 'openalex'}).json()
    assert len(result['results']) == 2 and '非招募公告' in result['results'][0]['snippet']
    assert c.post('/api/settings/search/openalex/test', headers=A).status_code == 200

def test_real_import_fuzzy_search_and_no_prebundled_srt_links(live):
    c, _, app = live
    entry = app.state.faculty.entries[0]
    assert not entry['metadata']['srtProjectIds']
    row = {'source_id': 'thu_srt_private', 'source_record_id': 'EXAMPLE-SRT-LOCAL', 'title': 'Robotics control research', 'institution': '清华大学',
           'description': '机器人控制', 'source_url': 'https://www.tsinghua.edu.cn/', 'mentors': ['Example Mentor']}
    assert c.post('/api/import', headers=A, json={'projects': [row]}).status_code == 200
    result = c.get('/api/projects?q=robotcs', headers=A).json()
    assert any(p['title'] == row['title'] for p in result['items'])
    linked = c.get('/api/faculty/' + entry['faculty']['id'] + '/projects', headers=A).json()
    # The API survives, but private SRT linking records are intentionally absent.
    assert linked['total'] == 0 and linked['linked_ids'] == []
    assert c.get('/api/faculty/' + entry['faculty']['id'] + '/projects', headers=B).json()['total'] == 0
    assert all(p['title'] != row['title'] for p in c.get('/api/export', headers=A).json()['projects'])

def test_openalex_errors_do_not_leak_key(tmp_path):
    transport = httpx.MockTransport(lambda _: httpx.Response(429, json={'error': 'secret synthetic-openalex'}))
    with TestClient(create_app(tmp_path, transport, srt_seed=None)) as c:
        configure(c)
        r = c.get('/api/faculty?source=openalex&q=test', headers=A)
        assert r.status_code == 502 and '429' in r.text and 'synthetic-openalex' not in r.text
