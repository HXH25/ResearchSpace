"""HTTPS-only allowlisted fetching; pinned public DNS, bounded reads and redirects."""
import http.client
import ipaddress
import json
import os
import base64
import urllib.request
import urllib.error
import socket
import ssl
import threading
import time
from urllib.parse import urlsplit,urljoin
from urllib.robotparser import RobotFileParser

class FetchError(Exception): pass

class Fetcher:
    def __init__(self,hosts,delay=1.1,timeout=12,max_bytes=8_000_000):
        self.hosts=set(hosts); self.delay=max(1.1,delay); self.timeout=timeout; self.max_bytes=max_bytes
        self.last={}; self.robots={}; self.lock=threading.Lock()
        self.proxy=os.environ.get('RESEARCHSPACE_HTTPS_PROXY') or os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
        if self.proxy and urlsplit(self.proxy).scheme not in ('http','https'):
            raise FetchError('Proxy must use http or https')
    def validate(self,url):
        p=urlsplit(url)
        if p.scheme!='https' or p.username or p.password or p.port not in (None,443) or p.hostname not in self.hosts:
            raise FetchError('URL must use HTTPS on an explicitly configured host')
        if self.proxy:
            # DNS is resolved by the administrator-configured trusted proxy.
            # Public host allowlist still applies; no user-supplied URL is accepted.
            try:
                if not ipaddress.ip_address(p.hostname).is_global: raise FetchError('Non-public address blocked')
            except ValueError: pass
            return p,None
        answers=socket.getaddrinfo(p.hostname,443,type=socket.SOCK_STREAM)
        addresses=list(dict.fromkeys(a[4][0] for a in answers))
        if not addresses or any(not ipaddress.ip_address(x).is_global for x in addresses):
            raise FetchError('Non-public IP address blocked')
        return p,addresses[0]
    def request(self,url,body=None,redirects=0):
        if redirects>3: raise FetchError('Too many redirects')
        p,address=self.validate(url)
        with self.lock:
            wait=self.delay-(time.monotonic()-self.last.get(p.hostname,0))
            if wait>0: time.sleep(wait)
            self.last[p.hostname]=time.monotonic()
        if self.proxy:
            return self.proxy_request(url,body,redirects)
        context=ssl.create_default_context()
        conn=http.client.HTTPSConnection(p.hostname,timeout=self.timeout,context=context)
        # Connect only to the address already checked, while verifying the original hostname.
        conn.sock=context.wrap_socket(socket.create_connection((address,443),timeout=self.timeout),server_hostname=p.hostname)
        headers={'User-Agent':'ResearchSpace/1.0 (public research metadata; no authentication)', 'Accept':'application/json,text/html,application/xml;q=0.8', 'Accept-Encoding':'identity'}
        payload=None
        if body is not None:
            payload=json.dumps(body).encode(); headers['Content-Type']='application/json'
        try:
            conn.request('POST' if body is not None else 'GET',p.path+('?' + p.query if p.query else ''),body=payload,headers=headers)
            r=conn.getresponse()
            if r.status in (301,302,303,307,308):
                target=urljoin(url,r.getheader('Location',''))
                conn.close()
                if body is not None: raise FetchError('API redirect rejected; update configured endpoint')
                return self.request(target,redirects=redirects+1)
            raw=r.read(self.max_bytes+1)
            if len(raw)>self.max_bytes: raise FetchError('Response exceeds byte limit')
            if r.status>=400: raise FetchError('HTTP '+str(r.status))
            content_type=r.getheader('Content-Type','')
            import re
            match=re.search(r'charset=([\w-]+)',content_type)
            encoding=match.group(1) if match else 'utf-8'
            try: return raw.decode(encoding,errors='replace')
            except LookupError: return raw.decode('utf-8',errors='replace')
        finally:
            conn.close()
    def proxy_request(self,url,body,redirects):
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self,*args): return None
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({'https':self.proxy}),NoRedirect())
        headers={'User-Agent':'ResearchSpace/1.0 (public research metadata)', 'Accept-Encoding':'identity'}
        raw_body=None
        if body is not None:
            headers['Content-Type']='application/json'; raw_body=json.dumps(body).encode()
        request=urllib.request.Request(url,data=raw_body,headers=headers)
        try:
            response=opener.open(request,timeout=self.timeout)
        except urllib.error.HTTPError as e:
            if e.code in (301,302,303,307,308):
                if body is not None: raise FetchError('API redirect rejected') from e
                target=urljoin(url,e.headers.get('Location','')); e.close()
                return self.request(target,redirects=redirects+1)
            code=e.code; e.close(); raise FetchError('HTTP '+str(code)) from e
        except urllib.error.URLError as e:
            raise OSError('Configured proxy request failed') from e
        with response:
            raw=response.read(self.max_bytes+1)
            if len(raw)>self.max_bytes: raise FetchError('Response exceeds byte limit')
            encoding=response.headers.get_content_charset() or 'utf-8'
            try: return raw.decode(encoding,errors='replace')
            except LookupError: return raw.decode('utf-8',errors='replace')
    def fetch(self,url,body=None):
        for attempt in range(3):
            try: return self.request(url,body)
            except (OSError, http.client.HTTPException,FetchError) as e:
                retry=isinstance(e,(OSError,http.client.HTTPException)) or str(e).startswith(('HTTP 429','HTTP 50'))
                if attempt==2 or not retry: raise FetchError(str(e)) from e
                time.sleep(2**attempt)
    def json(self,url,body=None):
        try: return json.loads(self.fetch(url,body))
        except json.JSONDecodeError as e: raise FetchError('Source returned invalid JSON') from e
    def page(self,url):
        p=urlsplit(url); root=p.scheme+'://'+p.netloc
        if root not in self.robots:
            parser=RobotFileParser()
            try: content=self.fetch(root+'/robots.txt')
            except FetchError as e:
                if str(e)=='HTTP 404': content='User-agent: *\nAllow: /'
                else: raise FetchError('robots.txt unavailable; collection paused: '+str(e)) from e
            parser.parse(content.splitlines()); self.robots[root]=parser
        parser=self.robots[root]
        if not parser.can_fetch('ResearchSpace',url): raise FetchError('robots.txt disallows this page')
        crawl_delay=parser.crawl_delay('ResearchSpace') or parser.crawl_delay('*') or 0
        if crawl_delay>60: raise FetchError('Crawl-delay exceeds run budget')
        self.delay=max(self.delay,crawl_delay)
        return self.fetch(url)
