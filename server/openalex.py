"""OpenAlex authors and works. Publications are leads, never open positions."""
import re
from .providers import request_json, require_config, safe_url, now, ProviderError
from .faculty import categories
from research.fuzzy import academic_query

def identifier(value, kind):
    short = str(value or '').rsplit('/', 1)[-1]
    return short if re.fullmatch(kind + r'\d+', short) else None

async def query(client, config, key, text, entity='works', page=1, limit=12):
    require_config('search', 'openalex', config, key)
    if not text.strip():
        raise ProviderError('请输入 OpenAlex 检索关键词', 400)
    translated = academic_query(text) if entity == 'works' else text
    fields = 'id,display_name,last_known_institutions' if entity == 'authors' else 'id,title,publication_year,doi,authorships,primary_topic'
    data = await request_json(client, 'GET', config['base_url'].rstrip('/') + '/' + entity,
                              params={'search': translated, 'page': page, 'per_page': limit, 'select': fields, 'api_key': key})
    if not isinstance(data.get('results'), list):
        raise ProviderError('OpenAlex 返回格式无效')
    return data, translated

def work_url(work):
    return safe_url(work.get('doi')) or ('https://openalex.org/' + identifier(work.get('id'), 'W') if identifier(work.get('id'), 'W') else '')

def author_entry(author, institutions=None):
    aid = identifier(author.get('id'), 'A')
    if not aid or not author.get('display_name'):
        return None
    timestamp = now()
    url = 'https://openalex.org/' + aid
    source_id = 'openalex:' + aid
    return {'faculty': {'id': source_id, 'name': author['display_name'],
            'institution': ' / '.join(i['display_name'] for i in (institutions or author.get('last_known_institutions') or []) if isinstance(i, dict) and i.get('display_name')) or '机构待核实',
            'researchAreas': [], 'researchSummary': 'OpenAlex 作者记录；机构信息来自学术记录，当前任职与导师身份需另行核实。',
            'selectedWorks': [], 'recruitmentStatus': 'unknown', 'lastCheckedAt': timestamp, 'isDemo': False,
            'sources': [{'id': source_id, 'title': author['display_name'] + ' · OpenAlex', 'url': url, 'type': 'academic', 'accessedAt': timestamp}]},
            'keywords': [], 'factSourceIds': {'background': [source_id], 'works': []}, 'media': [],
            'metadata': {'origin': 'openalex', 'topics': [], 'listedBy': [], 'positions': [], 'appointmentFlags': [], 'srtProjectIds': [], 'retrievalMethod': 'openalex_api', 'evidence': '', 'note': '学术作者不等于在职导师，论文署名不代表指导关系或招募名额。'}}

async def faculty_search(client, config, key, text, mode='research', page=1, limit=12):
    entity = 'authors' if mode == 'name' else 'works'
    data, translated = await query(client, config, key, text, entity, page, limit)
    entries = {}
    for row in data['results']:
        if not isinstance(row, dict): continue
        if entity == 'authors':
            entry = author_entry(row)
            if entry: entries[entry['faculty']['id']] = entry
            continue
        wid = identifier(row.get('id'), 'W')
        if not wid or not row.get('title'): continue
        authorships = row.get('authorships') or []
        # Surface first/last/corresponding authors; do not infer supervisory roles.
        selected = [a for a in authorships if a.get('is_corresponding') or a.get('author_position') in ('first', 'last')][:4] or authorships[:2]
        for a in selected:
            candidate = author_entry(a.get('author') or {}, a.get('institutions'))
            if not candidate: continue
            entry = entries.setdefault(candidate['faculty']['id'], candidate)
            f = entry['faculty']
            if any(w.get('url') == work_url(row) for w in f['selectedWorks']): continue
            work = {'title': row['title'], 'url': work_url(row)}
            if isinstance(row.get('publication_year'), int): work['year'] = row['publication_year']
            if row.get('doi'): work['doi'] = str(row['doi'])
            f['selectedWorks'].append(work)
            sid = 'openalex:' + wid
            f['sources'].append({'id': sid, 'title': row['title'], 'url': work_url(row), 'type': 'academic', 'accessedAt': f['lastCheckedAt']})
            entry['factSourceIds']['works'].append(sid)
            topic = (row.get('primary_topic') or {}).get('display_name')
            if topic and topic not in entry['keywords']: entry['keywords'].append(topic)
            entry['metadata']['topics'] = entry['keywords']
            f['researchAreas'] = categories(' '.join(entry['keywords']) + ' ' + row['title'])
            f['researchSummary'] = '检索命中论文：' + '；'.join(w['title'] for w in f['selectedWorks'])
    total = int((data.get('meta') or {}).get('count') or 0)
    return {'items': list(entries.values()), 'total': total, 'page': page, 'page_size': limit,
            'source': 'openalex', 'query_used': translated, 'total_kind': 'authors' if entity == 'authors' else 'works',
            'departments': [], 'institutions': []}

async def search_works(client, config, key, text, limit):
    data, translated = await query(client, config, key, text, limit=limit)
    results = []
    for w in data['results']:
        if not isinstance(w, dict) or not work_url(w): continue
        names = [a.get('author', {}).get('display_name', '') for a in (w.get('authorships') or [])[:6]]
        results.append({'title': str(w.get('title') or 'Untitled'), 'url': work_url(w),
                        'snippet': f"{w.get('publication_year') or '年份未知'} · {'、'.join(names)}。学术论文线索，非招募公告。"})
    return {'results': results, 'provider': 'openalex', 'query': text, 'query_used': translated, 'searched_at': now()}
