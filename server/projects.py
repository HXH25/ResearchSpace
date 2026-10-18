"""Bridge the shipped search/recommendation engine to the frozen host contract."""
import json
import hashlib
from pathlib import Path
from research.store import Store
from research.server import App as ResearchApp
from research.model import effective_status, present, validate_profile
from research.matching import contains
from research.importers import srt_records
from research.model import normalize

ROOT = Path(__file__).resolve().parent.parent
SRT_SEED = ROOT / 'data/thu_srt/project_details.json'
TAXONOMY = {'ai-computing': '计算机 人工智能', 'math-physics': '数学 物理', 'bio-medicine': '生物医学', 'electronics-engineering': '电子 工程', 'social-sciences': '人文 社会', 'economics-management': '经济 管理', 'design-interdisciplinary': '设计'}
SKILLS = {'programming': 'programming', 'math': 'math', 'experiment': 'experiment', 'data-analysis': 'data analysis', 'literature-reading': 'literature', 'design-research': 'design', 'writing': 'writing'}
GOALS = {'explore_research': 'research', 'join_lab': 'research', 'srt': 'SRT', 'summer_research': '暑研', 'overseas_research': '海外科研', 'postgraduate_preparation': 'research'}


def host_profile(value):
    if not isinstance(value, dict):
        raise ValueError('画像必须是对象')
    if 'schemaVersion' not in value:
        return validate_profile(value)
    # Keep personal names and detailed evidence out of the matching transport.
    return validate_profile({
        'institution': value.get('institution', ''), 'degree': 'bachelor',
        'year': {'year1': 1, 'year2': 2, 'year3': 3, 'year4': 4, 'year5': 5}.get(value.get('undergraduateYear')),
        'interests': value.get('interestKeywords', []) + [word for x in value.get('researchAreas', []) for word in TAXONOMY.get(x, x).split()],
        'skills': [SKILLS.get(x, x) for x in value.get('skills', [])],
        'work_types': value.get('workPreferences', []),
        'goals': [GOALS.get(x, x) for x in value.get('goals', [])],
        'languages': value.get('preferredLanguages', []), 'hours_per_week': value.get('weeklyHours'),
    })


def iso_date(value):
    if not value:
        return None
    return value + 'T00:00:00Z' if len(value) == 10 else value


def contract(p, faculty=None):
    state = effective_status(p)
    source = {'id': 'source:' + p['id'], 'title': p['title'], 'url': p['source_url'], 'type': 'official' if p['source_id'] not in ('web_search', 'openalex') else 'academic', 'accessedAt': iso_date(p['collected_at']), 'note': '原始来源；开放状态与资格需分别核实。'}
    eligibility = 'tsinghua_only' if p.get('required_institution') in ('清华大学', 'Tsinghua University') else 'home_institution_only' if p.get('required_institution') else 'unknown'
    text = ' '.join([p['title'], p.get('description', ''), ' '.join(p.get('tags', []))])
    areas = [key for key, terms in TAXONOMY.items() if any(contains(text, term) for term in terms.split())]
    return {k: v for k, v in {
        'id': p['id'], 'title': p['title'], 'institution': p['institution'] or '待核实', 'countryOrRegion': p['region'] or '待核实',
        'department': p.get('department') or None, 'type': 'srt' if p['source_id'] == 'thu_srt_private' else 'summer_research' if 'summer' in p['source_id'] or 'ssrf' in p['source_id'] else 'other',
        'linkedFacultyIds': faculty.project_links.get(str(p['source_record_id']), []) if faculty and p['source_id'] == 'thu_srt_private' else [],
        'researchAreas': areas, 'summary': p['description'], 'requirements': p.get('eligibility_text', ''), 'expectedWork': p['description'],
        'duration': p.get('period_text', ''), 'weeklyHours': p.get('min_hours'),
        'eligibility': eligibility, 'eligibilityDetails': p.get('eligibility_text', ''),
        'status': {'open': 'open_confirmed', 'upcoming': 'upcoming', 'closed': 'closed'}.get(state, 'unknown'),
        'statusVerifiedAt': iso_date(p.get('status_verified_at')),
        # Date-only deadlines do not imply a timezone; keep the raw deadline in project details.
        'applicationUrl': p.get('application_url') or None,
        'lastCheckedAt': iso_date(p['collected_at']), 'sources': [source], 'isDemo': False,
    }.items() if v is not None}


class CombinedStore:
    def __init__(self, public, private):
        self.public = public
        self.private = private

    def records(self, include_private=False):
        result = {p['id']: p for p in self.public.records(False)}
        result.update({p['id']: p for p in self.private.records(include_private)})
        return list(result.values())

    def get(self, id, include_private=False):
        return self.private.get(id, include_private) or self.public.get(id, False)

    def __getattr__(self, name):
        return getattr(self.private, name)


class Projects:
    def __init__(self, root, settings, faculty=None, srt_seed=SRT_SEED):
        self.settings = settings
        self.faculty = faculty
        self.srt_seed = Path(srt_seed) if srt_seed is not None else None
        self.seed_records = None
        self.seed_version = None
        self.public = Store(Path(root) / 'public.sqlite')
        if not self.public.records(False):
            self.public.upsert(json.loads((ROOT / 'research_module/data/public_seed.json').read_text('utf-8')), 'public')
        self.sources = json.loads((ROOT / 'research_module/config/sources.json').read_text('utf-8'))
        self.apps = {}

    def seed_srt(self, store):
        # The public distribution ships no private SRT dataset. Keep this
        # optional hook for owners who explicitly supply their own seed file.
        if self.srt_seed is None or not self.srt_seed.is_file():
            return
        if self.seed_records is None:
            self.seed_version = 'srt-v1:' + hashlib.sha256(self.srt_seed.read_bytes()).hexdigest()
            self.seed_records = [normalize(r, 'private') for r in srt_records(self.srt_seed)]
        if store.value('state', 'bundled-srt') == self.seed_version:
            return
        existing = {p['id']: p for p in store.records(True)}
        additions = []
        for row in self.seed_records:
            old = existing.get(row['id'])
            if old is None:
                additions.append(row)
            elif 'srt' not in old:
                # Enrich older imports without overwriting account-specific edits.
                additions.append(dict(old, srt=row['srt']))
        store.upsert(additions, 'private')
        store.set_value('state', 'bundled-srt', self.seed_version)

    def app(self, scope):
        with self.settings.lock:
            if scope not in self.apps:
                private = Store(self.settings.directory(scope) / 'projects.sqlite')
                self.seed_srt(private)
                combined = CombinedStore(self.public, private)
                self.apps[scope] = ResearchApp(combined, self.sources, '', private=True)
            return self.apps[scope]

    def search(self, scope, filters, profile=None):
        # The imported module accepts arbitrary filters; reject incorrect shapes here.
        if not isinstance(filters, dict):
            raise ValueError('filters 必须是对象')
        if any(not isinstance(filters.get(k, ''), str) for k in ('q', 'region', 'kind', 'source_id', 'institution', 'status')):
            raise ValueError('筛选条件必须是字符串')
        if any(not isinstance(filters.get(k, ''), str) for k in ('areas', 'type', 'initiation_type')):
            raise ValueError('领域与项目类型必须是字符串')
        initiation = filters.get('initiation_type', '')
        if initiation not in ('', 'teacher', 'student'):
            raise ValueError('立项类型必须是 teacher 或 student')
        wanted_areas = set(filters.get('areas', '').split(',')) - {''}
        def matches(p):
            if initiation and (p.get('srt') or {}).get('initiation_type') != initiation:
                return False
            if not wanted_areas and not filters.get('type'):
                return True
            record = contract(p, self.faculty)
            return (not wanted_areas or bool(wanted_areas & set(record['researchAreas']))) and (not filters.get('type') or filters['type'] == record['type'])
        result = self.app(scope).search(filters, host_profile(profile) if profile is not None else None, predicate=matches if wanted_areas or filters.get('type') or initiation else None)
        result['items'] = [dict(p, contract=contract(p, self.faculty)) for p in result['items']]
        return result
