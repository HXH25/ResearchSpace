import hmac
import json
import mimetypes
import os
import secrets
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit,parse_qs,unquote
from .collectors import collect
from .matching import query_match, assess
from .model import validate_profile,present,now

ROOT=Path(__file__).resolve().parent.parent

class App:
    def __init__(self,store,sources,token,private=False):
        self.store=store; self.sources={s['id']:s for s in sources}; self.token=token; self.private=private
        self.collection_lock=threading.Lock(); self.limits={}; self.limits_lock=threading.Lock()
        # Persistent jobs may be interrupted by a process restart; don't leave them running forever.
        for job in self.store.jobs():
            if job.get('status') in ('queued','running'):
                job.update(status='interrupted',finished_at=now())
                self.store.set_value('jobs',job['id'],job)
    def rate_ok(self,address):
        with self.limits_lock:
            t=time.monotonic()
            self.limits={k:v for k,v in self.limits.items() if v[0]>t-60}
            start,count=self.limits.get(address,(t,0))
            self.limits[address]=(start,count+1)
            return count<120
    def search(self,params,profile=None,predicate=None):
        q=str(params.get('q',''))[:500]
        try:
            page=max(1,min(int(params.get('page',1)),100000)); size=max(1,min(int(params.get('page_size',12)),100))
        except (TypeError,ValueError): raise ValueError('分页参数无效')
        rows=[]
        for p in self.store.records(self.private):
            if predicate is not None and not predicate(p): continue
            if q and not query_match(p,q): continue
            if any(params.get(k) and p.get(k)!=params[k] for k in ('region','kind','source_id','institution')): continue
            item=assess(p,profile) if profile is not None else present(p)
            if params.get('status') and item['effective_status']!=params['status']: continue
            if profile is not None and params.get('hide_conflicts',True) is not False and item['match']['conflicts']: continue
            rows.append(item)
        if profile is not None: rows.sort(key=lambda x:(-x['match']['score'],x['title']))
        else: rows.sort(key=lambda x:x['collected_at'],reverse=True)
        return {'items':rows[(page-1)*size:page*size],'total':len(rows),'page':page,'page_size':size,
                'scope':'public+local_private' if self.private else 'public','global_coverage_complete':False}
    def launch(self,payload):
        id=payload.get('source_id'); source=self.sources.get(id)
        if not source: raise ValueError('未知 source_id')
        query=payload.get('query','')
        if not isinstance(query,str) or len(query)>500: raise ValueError('query 无效')
        pages=payload.get('max_pages',2)
        if type(pages) is not int or not 1<=pages<=50: raise ValueError('max_pages 必须为1到50')
        if not self.collection_lock.acquire(blocking=False): raise ValueError('已有采集任务执行中，请稍后重试')
        job={'id':uuid.uuid4().hex,'source_id':id,'status':'queued','created_at':now()}
        self.store.set_value('jobs',job['id'],job)
        def run():
            try:
                job['status']='running'; self.store.set_value('jobs',job['id'],job)
                def progress(report):
                    job['progress']={k:v for k,v in report.items() if k!='cursor'}
                    self.store.set_value('jobs',job['id'],job)
                result=collect(self.store,source,query,pages,payload.get('reset') is True,progress=progress)
                job.update(status=result['status'],report=result,finished_at=now())
            except Exception as e:
                job.update(status='failed',error=type(e).__name__,finished_at=now())
            finally:
                self.store.set_value('jobs',job['id'],job); self.collection_lock.release()
        threading.Thread(target=run,daemon=True).start()
        return dict(job)

def handler_for(app):
    class Handler(BaseHTTPRequestHandler):
        server_version='ResearchSpace/1.0'
        def setup(self):
            super().setup(); self.connection.settimeout(20)
        def log_message(self,*args): pass  # Profiles and request bodies never enter access logs.
        def headers_common(self):
            self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('Referrer-Policy','no-referrer')
            self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'")
        def respond(self,data,code=200):
            raw=json.dumps(data,ensure_ascii=False).encode()
            self.send_response(code); self.headers_common(); self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
        def check_host(self):
            host=self.headers.get('Host','')
            # Prevent browser DNS rebinding against a local deployment.
            return not app.private and self.server.server_address[0] not in ('127.0.0.1','::1') or host.split(':')[0] in ('localhost','127.0.0.1')
        def authorized(self):
            return hmac.compare_digest(self.headers.get('Authorization',''), 'Bearer '+app.token)
        def do_GET(self):
            if not self.check_host(): return self.respond({'error':'Host not allowed'},403)
            if not app.rate_ok(self.client_address[0]): return self.respond({'error':'请求过于频繁'},429)
            parsed=urlsplit(self.path); path=parsed.path
            args={k:v[0] for k,v in parse_qs(parsed.query).items()}
            try:
                if path=='/api/health': return self.respond({'ok':True,'private_mode':app.private,'version':'1.0.0'})
                if path=='/api/projects': return self.respond(app.search(args))
                if path.startswith('/api/projects/'):
                    p=app.store.get(path.rsplit('/',1)[1],app.private)
                    return self.respond(present(p)) if p else self.respond({'error':'未找到项目'},404)
                if path=='/api/stats': return self.respond(app.store.stats(app.private))
                if path=='/api/sources':
                    stats=app.store.stats(app.private)
                    return self.respond({'items':[dict(s,count=stats['sources'].get(s['id'],0)) for s in app.sources.values()],
                        'scope_note':'仅覆盖已配置来源与已执行查询；不代表全球完整覆盖。'})
                if path=='/api/jobs':
                    if not self.authorized(): return self.respond({'error':'需要管理员令牌'},401)
                    return self.respond({'items':app.store.jobs()})
                if path=='/api/export':
                    # Exports always public; private records never leave through this endpoint.
                    return self.respond({'schema_version':'1.0','projects':app.store.records(False)})
                if path.startswith('/api/'): return self.respond({'error':'接口不存在'},404)
                relative=unquote(path).lstrip('/') or 'index.html'
                target=(ROOT/'web'/relative).resolve(); root=(ROOT/'web').resolve()
                if not target.is_relative_to(root) or not target.is_file(): return self.respond({'error':'文件不存在'},404)
                raw=target.read_bytes(); self.send_response(200); self.headers_common()
                self.send_header('Content-Type',(mimetypes.guess_type(target)[0] or 'application/octet-stream')+'; charset=utf-8')
                self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
            except (ValueError,TypeError) as e: self.respond({'error':str(e)},400)
        def do_POST(self):
            if not self.check_host(): return self.respond({'error':'Host not allowed'},403)
            origin=self.headers.get('Origin')
            if origin and urlsplit(origin).netloc!=self.headers.get('Host'): return self.respond({'error':'跨站请求被拒绝'},403)
            if not app.rate_ok(self.client_address[0]): return self.respond({'error':'请求过于频繁'},429)
            path=urlsplit(self.path).path
            if path not in ('/api/recommend','/api/collect','/api/import'): return self.respond({'error':'接口不存在'},404)
            if path!='/api/recommend' and not self.authorized(): return self.respond({'error':'需要管理员令牌'},401)
            try:
                size=int(self.headers.get('Content-Length','0'))
                if size<=0 or size>20_000_000: return self.respond({'error':'请求体必须为1字节到20MB'},413)
                payload=json.loads(self.rfile.read(size))
                if not isinstance(payload,dict): raise ValueError('请求体必须是 JSON 对象')
                if path=='/api/recommend':
                    profile=validate_profile(payload.get('profile',{})); filters=payload.get('filters',{})
                    if not isinstance(filters,dict): raise ValueError('filters 必须是对象')
                    return self.respond(app.search(filters,profile))
                if path=='/api/collect': return self.respond(app.launch(payload),202)
                records=payload.get('projects'); scope=payload.get('visibility','private')
                if not isinstance(records,list) or len(records)>20000: raise ValueError('projects 必须为不超过20000条的数组')
                if scope=='public' and payload.get('confirm_public') is not True: raise ValueError('公开导入需 confirm_public=true')
                if scope=='public' and any(r.get('visibility')=='private' or r.get('source_id')=='thu_srt_private' for r in records if isinstance(r,dict)):
                    raise ValueError('校内/私有记录不能通过公开导入发布')
                return self.respond(app.store.upsert(records,scope))
            except (ValueError,TypeError,KeyError) as e: self.respond({'error':str(e)},400)
    return Handler

def serve(store,sources,host='127.0.0.1',port=8000,private=False):
    if private and host!='127.0.0.1': raise ValueError('含校内私有数据的模式仅允许绑定127.0.0.1')
    token=os.environ.get('RESEARCHSPACE_ADMIN_TOKEN','')
    if host!='127.0.0.1' and len(token)<24: raise ValueError('对外服务必须设置至少24位 RESEARCHSPACE_ADMIN_TOKEN')
    token=token or secrets.token_urlsafe(32)
    app=App(store,sources,token,private)
    httpd=ThreadingHTTPServer((host,port),handler_for(app))
    print(f'ResearchSpace: http://{host}:{port}\n管理员令牌（仅用于本次服务的采集/导入）：{token}',flush=True)
    try: httpd.serve_forever()
    except KeyboardInterrupt: pass
    finally: httpd.server_close()
