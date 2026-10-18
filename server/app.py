import asyncio
import json
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit
import httpx
from fastapi import FastAPI, Request, Depends, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, ConfigDict, Field
from .presets import AI, SEARCH
from .settings import SettingsStore, account_scope
from .providers import generate, search, ProviderError, now
from .projects import Projects, contract, SRT_SEED
from .faculty import FacultyCatalog
from .openalex import faculty_search
from research.importers import srt_records
from research.model import present
from research.network import Fetcher, FetchError
from research.htmlparse import Document

ROOT = Path(__file__).resolve().parent.parent


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class AiRequest(StrictModel):
    task: str
    input: str = Field(min_length=1, max_length=100000)
    responseFormat: str = 'text'
    containsPersonalData: bool = True
    personalDataConsent: bool = False
    sources: list[dict] | None = None


class SearchRequest(StrictModel):
    query: str = Field(min_length=1, max_length=500)
    limit: int | None = Field(default=None, ge=1, le=20)
    provider: str | None = None


def create_app(runtime=None, transport=None, srt_seed=SRT_SEED):
    runtime = Path(runtime or os.environ.get('RESEARCHSPACE_DATA_DIR') or ROOT / '.runtime')
    settings = SettingsStore(runtime)
    faculty = FacultyCatalog()
    projects = Projects(runtime, settings, faculty, srt_seed)

    @asynccontextmanager
    async def lifespan(app):
        # No redirect forwarding of credentials; no implicit application access logs.
        async with httpx.AsyncClient(timeout=httpx.Timeout(75, connect=12), follow_redirects=False, transport=transport) as client:
            app.state.client = client
            yield

    app = FastAPI(title='ResearchSpace Local API', version='0.3.1', lifespan=lifespan)
    app.state.settings = settings
    app.state.projects = projects
    app.state.faculty = faculty
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', '[::1]', 'testserver'])

    @app.middleware('http')
    async def local_boundary(request, call_next):
        if request.url.path.startswith('/api/'):
            origin = request.headers.get('origin')
            if origin and urlsplit(origin).netloc != request.headers.get('host'):
                return JSONResponse({'detail': '跨站请求被拒绝 / Cross-site request blocked'}, status_code=403)
            try:
                size = int(request.headers.get('content-length', '0'))
            except ValueError:
                return JSONResponse({'detail': 'Invalid body size'}, status_code=400)
            if size > 20_000_000:
                return JSONResponse({'detail': '请求体超过20MB / Body exceeds 20MB'}, status_code=413)
            if request.method in ('POST', 'PUT'):
                # Enforce the same limit for clients using chunked transfer.
                chunks = bytearray()
                async for block in request.stream():
                    chunks.extend(block)
                    if len(chunks) > 20_000_000:
                        return JSONResponse({'detail': 'Body exceeds 20MB'}, status_code=413)
                request._body = bytes(chunks)
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        if request.url.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.exception_handler(RequestValidationError)
    async def invalid_payload(request, exc):
        # Pydantic normally includes submitted input in errors; never echo keys.
        return JSONResponse({'detail': '请求字段无效 / Invalid request fields', 'fields': ['.'.join(map(str, e['loc'])) for e in exc.errors()]}, status_code=422)

    @app.exception_handler(ValueError)
    async def bad_value(request, exc):
        return JSONResponse({'detail': str(exc)}, status_code=400)

    @app.exception_handler(ProviderError)
    async def provider_error(request, exc):
        return JSONResponse({'detail': str(exc)}, status_code=exc.status)

    def scope(request: Request):
        try:
            return account_scope(request.headers.get('x-researchspace-user'), request.headers.get('x-researchspace-token'))
        except ValueError:
            raise HTTPException(401, '请选择本地账户 / Select a local account') from None

    @app.get('/api/health')
    def health():
        return {'ok': True, 'version': '0.3.1', 'local_only': True}

    @app.get('/api/presets')
    def presets():
        return {'ai': AI, 'search': SEARCH, 'sources': projects.sources}

    @app.get('/api/settings')
    def read_settings(owner=Depends(scope)):
        return settings.public(owner)

    @app.put('/api/settings/{kind}/{provider}')
    def save_settings(kind: str, provider: str, payload: dict, owner=Depends(scope)):
        return settings.save(owner, kind, provider, payload)

    @app.delete('/api/settings/{kind}/{provider}/key')
    def clear_key(kind: str, provider: str, owner=Depends(scope)):
        return settings.clear_key(owner, kind, provider)

    @app.post('/api/settings/{kind}/{provider}/test')
    async def test_connection(kind: str, provider: str, owner=Depends(scope)):
        if kind not in ('ai', 'search'):
            raise HTTPException(400, 'Unknown provider type')
        provider, config, key = settings.get_config(owner, kind, provider)
        if kind == 'ai':
            # A real tiny generation checks both credentials and the chosen model.
            config = dict(config, max_tokens=min(config['max_tokens'], 128))
            await generate(app.state.client, provider, config, key, {'input': 'Reply with the word OK.', 'responseFormat': 'text', 'containsPersonalData': False})
        else:
            await search(app.state.client, provider, config, key, 'undergraduate research', 1)
        return {'ok': True, 'provider': provider, 'tested_at': now()}

    @app.delete('/api/account')
    def delete_local_service_data(owner=Depends(scope)):
        research_app = projects.apps.get(owner)
        if research_app and research_app.collection_lock.locked():
            raise HTTPException(409, '采集任务仍在运行，请完成后再删除账户。')
        projects.apps.pop(owner, None)
        settings.delete(owner)
        return {'ok': True}

    @app.post('/api/ai/generate')
    async def ai(payload: AiRequest, owner=Depends(scope)):
        if payload.task not in ('faculty_brief', 'faculty_fit_explanation', 'opportunity_explanation', 'outreach_email') or payload.responseFormat not in ('json', 'text'):
            raise HTTPException(400, 'Unknown task / format')
        provider, config, key = settings.get_config(owner, 'ai')
        return await generate(app.state.client, provider, config, key, payload.model_dump())

    @app.post('/api/search')
    async def web_search(payload: SearchRequest, owner=Depends(scope)):
        provider, config, key = settings.get_config(owner, 'search', payload.provider)
        return await search(app.state.client, provider, config, key, payload.query, payload.limit)

    @app.get('/api/faculty')
    async def list_faculty(q: str = Query('', max_length=500), source: str = 'local', search_mode: str = 'research',
                           institution: str = '', department: str = '', area: str = '', status: str = '', fuzzy: bool = True,
                           sort: str = 'relevance',
                           page: int = Query(1, ge=1, le=1000), page_size: int = Query(12, ge=1, le=100),
                           ids: str | None = Query(None, max_length=20000), owner=Depends(scope)):
        if source == 'local':
            wanted = set(ids.split(',')) if ids is not None else None
            extra = faculty.saved(settings.directory(owner), wanted) if wanted else []
            return await asyncio.to_thread(faculty.search, q, institution, department, area, status, fuzzy, page, page_size,
                                           wanted, extra, sort)
        if source != 'openalex' or search_mode not in ('name', 'research'):
            raise HTTPException(400, '未知导师数据来源或搜索方式')
        _, config, key = settings.get_config(owner, 'search', 'openalex')
        result = await faculty_search(app.state.client, config, key, q, search_mode, page, min(page_size, config['max_results']))
        faculty.remember(settings.directory(owner), result['items'])
        return result

    @app.get('/api/faculty/{faculty_id}')
    def get_faculty(faculty_id: str, owner=Depends(scope)):
        entry = faculty.by_id.get(faculty_id) or faculty.cached(settings.directory(owner), faculty_id)
        if not entry:
            raise HTTPException(404, '未找到导师资料，请先搜索该研究者。')
        return entry

    @app.get('/api/faculty/{faculty_id}/projects')
    def faculty_projects(faculty_id: str, owner=Depends(scope)):
        entry = faculty.by_id.get(faculty_id)
        ids = set(entry['metadata']['srtProjectIds']) if entry else set()
        rows = [p for p in projects.app(owner).store.records(True) if p['source_id'] == 'thu_srt_private' and p['source_record_id'] in ids]
        return {'items': [dict(present(p), contract=dict(contract(p), linkedFacultyIds=[faculty_id])) for p in rows], 'total': len(rows), 'page': 1, 'page_size': max(1, len(rows)), 'linked_ids': sorted(ids)}

    @app.post('/api/research')
    async def research(payload: dict, owner=Depends(scope)):
        if payload.get('operation') == 'search':
            value = SearchRequest(query=payload.get('query'), limit=payload.get('limit', 8))
            return await web_search(value, owner)
        if payload.get('operation') != 'fetch':
            raise HTTPException(400, 'Unknown operation')
        url = payload.get('url', '')
        if not isinstance(url, str) or len(url) > 2000:
            raise HTTPException(400, 'Invalid URL')
        host = urlsplit(url).hostname
        def fetch_page():
            fetcher = Fetcher([host], timeout=8, max_bytes=1_000_000)
            # This endpoint accepts URLs from search results. Pin public DNS and
            # do not delegate their address validation to an environment proxy.
            fetcher.proxy = None
            document = Document(fetcher.page(url))
            return {'url': url, 'title': document.title[:500], 'text': document.text[:40000], 'accessedAt': now()}
        try:
            return await asyncio.wait_for(asyncio.to_thread(fetch_page), timeout=35)
        except (FetchError, OSError, asyncio.TimeoutError):
            raise HTTPException(502, '页面暂时无法读取，请打开原链接核对 / Cannot read this page; open the source link') from None

    @app.get('/api/projects')
    def list_projects(request: Request, owner=Depends(scope)):
        return projects.search(owner, dict(request.query_params))

    @app.post('/api/recommend')
    def recommend(payload: dict, owner=Depends(scope)):
        return projects.search(owner, payload.get('filters', {}), payload.get('profile', {}))

    @app.get('/api/projects/{project_id}')
    def project(project_id: str, owner=Depends(scope)):
        p = projects.app(owner).store.get(project_id, True)
        if not p:
            raise HTTPException(404, '未找到项目 / Project not found')
        return dict(present(p), contract=contract(p, faculty))

    @app.get('/api/sources')
    def sources(owner=Depends(scope)):
        rows = projects.app(owner).store.records(True)
        srt = [p for p in rows if p['source_id'] == 'thu_srt_private']
        return {'items': projects.sources, 'database': {'faculty_records': len(faculty.entries), 'project_records': len(rows), 'srt_records': len(srt), 'srt_teacher': sum((p.get('srt') or {}).get('initiation_type') == 'teacher' for p in srt), 'srt_student': sum((p.get('srt') or {}).get('initiation_type') == 'student' for p in srt)}, 'github_srt': {'configured': False, 'format': 'JSON projects array', 'note': '公开 GitHub SRT 数据可下载后导入；校内授权数据仅在当前本地账户使用。'}}

    @app.get('/api/jobs')
    def jobs(owner=Depends(scope)):
        return {'items': projects.app(owner).store.jobs()}

    @app.post('/api/collect', status_code=202)
    def collect(payload: dict, owner=Depends(scope)):
        return projects.app(owner).launch(payload)

    @app.post('/api/import')
    def import_projects(payload: dict, owner=Depends(scope)):
        records = payload.get('projects')
        if not isinstance(records, list) or len(records) > 20000:
            raise HTTPException(400, 'projects 必须是不超过20000条的数组')
        return projects.app(owner).store.upsert(records, 'private')

    @app.post('/api/import/srt')
    async def import_srt(request: Request, owner=Depends(scope)):
        name = request.headers.get('x-filename', '')
        suffix = '.zip' if name.lower().endswith('.zip') else '.json'
        raw = await request.body()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / ('input' + suffix)
            path.write_bytes(raw)
            try:
                records = await asyncio.to_thread(srt_records, path)
                if len(records) > 20000:
                    raise ValueError('导入条数超过限制')
                return projects.app(owner).store.upsert(records, 'private')
            except (ValueError, KeyError, TypeError, OSError, __import__('zipfile').BadZipFile):
                raise HTTPException(400, 'SRT 文件格式无效；请使用含 project_details.json 的 ZIP 或原始 JSON。') from None

    @app.get('/api/export')
    def export_public(owner=Depends(scope)):
        return {'schema_version': '1.0', 'projects': projects.app(owner).store.records(False)}

    @app.get('/{path:path}')
    def frontend(path: str):
        if path.startswith('api/'):
            raise HTTPException(404, 'API not found')
        dist = (ROOT / 'dist').resolve()
        target = (dist / path).resolve()
        if not target.is_relative_to(dist):
            raise HTTPException(404)
        if target.is_file():
            return FileResponse(target)
        if path.startswith('assets/') or '.' in path.rsplit('/', 1)[-1]:
            raise HTTPException(404)
        index = dist / 'index.html'
        if not index.exists():
            raise HTTPException(503, '未找到 dist，请运行 npm ci && npm run build 或使用完整发行包。')
        return FileResponse(index, headers={'Cache-Control': 'no-cache'})

    return app


app = create_app()
