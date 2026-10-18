"""Verify private SRT support without shipping any authentic SRT project data."""
import io
import json
import sqlite3
import zipfile
from pathlib import Path
from fastapi.testclient import TestClient
from server.app import create_app
from server.projects import SRT_SEED
from research.importers import srt_records
from research.model import normalize

A = {'X-ResearchSpace-User': 'synthetic-a', 'X-ResearchSpace-Token': 'a' * 64}
B = {'X-ResearchSpace-User': 'synthetic-b', 'X-ResearchSpace-Token': 'b' * 64}


def fake_srt(project_id='EXAMPLE-SRT-001', kind='student'):
    """Artificial records for testing the import contract; not data from the school."""
    return {
        'project_id': project_id,
        'title': 'Synthetic research project',
        'initiation_type': kind,
        'applicant': 'Example Applicant',
        'mentor': 'Example Mentor',
        'department': 'Example Department',
        'description': 'Artificial research content, only for automated tests.',
        'start_month': '202610', 'end_month': '202703',
        'collected_at': '2026-01-01T00:00:00Z',
    }


def test_public_distribution_has_no_bundled_srt_or_mappings(tmp_path):
    assert not SRT_SEED.exists()
    with sqlite3.connect(Path(__file__).resolve().parents[1] / 'data/thu_faculty/faculty.sqlite') as db:
        assert db.execute('SELECT COUNT(*) FROM srt_project_links').fetchone()[0] == 0
        assert db.execute('SELECT COUNT(*) FROM srt_mentor_matches').fetchone()[0] == 0
        assert db.execute('SELECT COUNT(*) FROM departments WHERE srt_priority IS NOT NULL').fetchone()[0] == 0
        assert db.execute("SELECT COUNT(*) FROM faculty_profiles WHERE profile_json LIKE '%srt_project_ids%'").fetchone()[0] == 0
    with TestClient(create_app(tmp_path)) as c:
        counts = c.get('/api/sources', headers=A).json()['database']
        assert counts['srt_records'] == counts['srt_teacher'] == counts['srt_student'] == 0
        assert counts['project_records'] == 7  # separately licensed public seed
        assert c.get('/api/projects?source_id=thu_srt_private', headers=A).json()['total'] == 0
        assert c.get('/api/projects?initiation_type=teacher', headers=A).json()['total'] == 0
        assert c.get('/api/projects?initiation_type=student', headers=A).json()['total'] == 0
        assert c.get('/api/faculty', headers=A).json()['total'] == 4026


def test_manual_srt_json_import_keeps_details_private_and_filterable(tmp_path):
    fake_rows = [fake_srt(), fake_srt('EXAMPLE-SRT-002', 'teacher')]
    path = tmp_path / 'synthetic_details.json'
    path.write_text(json.dumps(fake_rows), 'utf-8')
    mapped = [normalize(r) for r in srt_records(path)]
    assert len(mapped) == 2 and all(p['visibility'] == 'private' for p in mapped)
    with TestClient(create_app(tmp_path)) as c:
        assert c.get('/api/projects', headers=A).status_code == 200
        r = c.post('/api/import/srt', headers={**A, 'X-Filename': 'synthetic.json'}, content=path.read_bytes())
        assert r.status_code == 200, r.text
        assert r.json()['total'] == 2
        assert c.get('/api/projects?source_id=thu_srt_private', headers=A).json()['total'] == 2
        for kind in ('teacher', 'student'):
            filtered = c.get('/api/projects', headers=A, params={'initiation_type': kind}).json()
            assert filtered['total'] == 1
            assert filtered['items'][0]['srt']['initiation_type'] == kind
            assert filtered['items'][0]['contract']['type'] == 'srt'
        p = c.get('/api/projects?q=EXAMPLE-SRT-001', headers=A).json()['items'][0]
        assert p['srt']['applicant'] == 'Example Applicant'
        assert c.get('/api/projects/' + p['id'], headers=A).status_code == 200
        assert c.get('/api/projects/' + p['id'], headers=B).status_code == 404
        assert c.get('/api/projects?source_id=thu_srt_private', headers=B).json()['total'] == 0
        assert all(x['source_id'] != 'thu_srt_private' for x in c.get('/api/export', headers=A).json()['projects'])
        assert c.get('/api/sources', headers=A).json()['database']['srt_records'] == 2


def test_srt_zip_import_reimport_persistence_and_account_isolation(tmp_path):
    row = fake_srt('EXAMPLE-SRT-ZIP', 'teacher')
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as z:
        z.writestr('sample/project_details.json', json.dumps([row]))
    with TestClient(create_app(tmp_path)) as c:
        r = c.post('/api/import/srt', headers={**A, 'X-Filename': 'srt.zip'}, content=data.getvalue())
        assert r.status_code == 200 and r.json()['total'] == 1
        assert c.get('/api/projects?initiation_type=teacher', headers=A).json()['total'] == 1
        assert c.get('/api/projects?initiation_type=teacher', headers=B).json()['total'] == 0
        row['description'] = 'Changed synthetic description'
        r = c.post('/api/import/srt', headers={**A, 'X-Filename': 'srt.json'}, content=json.dumps([row]).encode())
        assert r.status_code == 200 and r.json()['updated'] == 1 and r.json()['created'] == 0
    with TestClient(create_app(tmp_path)) as c:
        fetched = c.get('/api/projects?q=EXAMPLE-SRT-ZIP', headers=A).json()
        assert fetched['total'] == 1
        assert fetched['items'][0]['description'] == 'Changed synthetic description'
        assert c.get('/api/projects?initiation_type=teacher', headers=B).json()['total'] == 0


def test_srt_bad_input_and_filters_remain_guarded(tmp_path):
    with TestClient(create_app(tmp_path)) as c:
        assert c.get('/api/projects?initiation_type=invalid', headers=A).status_code == 400
        assert c.post('/api/import/srt', headers={**A, 'X-Filename': 'bad.json'}, content=b'{}').status_code == 400
