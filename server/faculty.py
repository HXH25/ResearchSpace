"""Read the supplied official faculty SQLite database, never the demo fixture."""
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from research.fuzzy import fuzzy_score, expanded

DATA = Path(__file__).resolve().parent.parent / 'data' / 'thu_faculty'
AREA_TERMS = {
    'ai-computing': ['人工智能', '计算机', '机器学习', '软件', '数据科学'],
    'math-physics': ['数学', '物理', '量子'], 'bio-medicine': ['生物', '医学', '蛋白质', '生命'],
    'electronics-engineering': ['电子', '电气', '机械', '工程', '自动化', '机器人'],
    'social-sciences': ['社会', '历史', '哲学', '人文', '语言', '政治'],
    'economics-management': ['经济', '管理', '金融'], 'design-interdisciplinary': ['设计', '建筑', '艺术'],
}

def categories(text):
    text = expanded(text)
    return [key for key, terms in AREA_TERMS.items() if any(term in text for term in terms)]

def map_profile(p):
    sid = 'source:' + p['profile_id']
    topics = p.get('research_topics', [])
    unit = p.get('primary_unit') or '单位归属待核实'
    summary = '；'.join(topics) or '本次采集未提取到研究方向，请查阅官网原文。'
    note = '官网资料采集时间，不代表页面更新时间或当前任职、招生核验。'
    if p.get('affiliation_basis') != 'official_site_or_subsite':
        note += '目录关联不等于正式任职单位。'
    f = {'id': p['profile_id'], 'name': p['name'], 'institution': '清华大学', 'department': unit,
         'officialPage': p['source_url'], 'researchAreas': categories(' '.join(topics) + ' ' + unit),
         'researchSummary': summary, 'recruitmentStatus': 'unknown', 'lastCheckedAt': p['fetched_at'],
         'sources': [{'id': sid, 'title': p.get('page_title') or p['name'] + '官网资料', 'url': p['source_url'],
                      'type': 'official', 'accessedAt': p['fetched_at'], 'note': note}], 'isDemo': False}
    return {'faculty': f, 'keywords': topics + p.get('listed_by_units', []) + p.get('position_titles', []),
            'factSourceIds': {'background': [sid]}, 'media': [],
            'metadata': {'origin': 'thu', 'topics': topics, 'listedBy': p.get('listed_by_units', []),
                         'positions': p.get('position_titles', []), 'appointmentFlags': p.get('appointment_context_flags', []),
                         'srtProjectIds': p.get('srt_project_ids', []), 'retrievalMethod': p.get('retrieval_method', ''),
                         'evidence': p.get('research_evidence_excerpt') or '', 'note': note}}

class FacultyCatalog:
    def __init__(self, path=DATA / 'faculty.sqlite'):
        # Read-only SQLite: source files and historical IDs remain intact.
        from contextlib import closing
        with closing(sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)) as c:
            self.entries = [map_profile(json.loads(row[0])) for row in c.execute('SELECT profile_json FROM faculty_profiles ORDER BY name,profile_id')]
        self.by_id = {x['faculty']['id']: x for x in self.entries}
        self.project_links = {}
        for e in self.entries:
            for project_id in e['metadata']['srtProjectIds']:
                self.project_links.setdefault(str(project_id), []).append(e['faculty']['id'])
        self.texts = {x['faculty']['id']: ' '.join([x['faculty']['name'], x['faculty']['institution'], x['faculty']['department'], x['faculty']['researchSummary'], *x['keywords']]) for x in self.entries}
        self.departments = sorted({e['faculty']['department'] for e in self.entries})

    def search(self, q='', institution='', department='', area='', status='', fuzzy=True, page=1, page_size=12, ids=None, extra=(), sort='relevance'):
        rows = []
        for entry in [*self.entries, *extra]:
            f = entry['faculty']
            if ids is not None and f['id'] not in ids: continue
            if institution and not fuzzy_score(f['institution'], institution): continue
            if department and f['department'] != department: continue
            if area and area not in f['researchAreas']: continue
            if status and f['recruitmentStatus'] != status: continue
            score = fuzzy_score(self.texts.get(f['id'], f['name'] + ' ' + f['institution'] + ' ' + f['researchSummary']), q, fuzzy)
            if score:
                # Exact names first; retain source-specific records, don't merge homonyms.
                rows.append((score + (2 if q.strip() == f['name'] else 0), entry))
        rows.sort(key=lambda x: -x[0])
        if sort == 'name': rows.sort(key=lambda x: x[1]['faculty']['name'])
        if sort == 'updated': rows.sort(key=lambda x: x[1]['faculty']['lastCheckedAt'], reverse=True)
        return {'items': [x[1] for x in rows[(page-1)*page_size:page*page_size]], 'total': len(rows),
                'page': page, 'page_size': page_size, 'source': 'thu', 'catalog_total': len(self.entries),
                'departments': self.departments, 'institutions': ['清华大学']}

    def cached(self, directory, id):
        with self.cache(directory) as c:
            row = c.execute('SELECT entry FROM faculty WHERE id=?', (id,)).fetchone()
        return json.loads(row[0]) if row else None

    @contextmanager
    def cache(self, directory):
        c = sqlite3.connect(Path(directory) / 'faculty_cache.sqlite')
        try:
            c.execute('CREATE TABLE IF NOT EXISTS faculty(id TEXT PRIMARY KEY,entry TEXT NOT NULL)')
            with c:
                yield c
        finally:
            c.close()

    def saved(self, directory, ids):
        with self.cache(directory) as c:
            return [json.loads(entry) for id, entry in c.execute('SELECT id,entry FROM faculty') if id in ids]

    def remember(self, directory, entries):
        with self.cache(directory) as c:
            c.executemany('INSERT OR REPLACE INTO faculty VALUES (?,?)', [(e['faculty']['id'], json.dumps(e, ensure_ascii=False)) for e in entries])
