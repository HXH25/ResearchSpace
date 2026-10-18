import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
from research.server import App,handler_for
from research.store import Store
from research_module.tests.test_core import record

class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();cls.store=Store(Path(cls.tmp.name)/'http.db')
        cls.store.upsert([record(),record(source_record_id='private',visibility='private')])
        cls.app=App(cls.store,[],'test-token');cls.server=ThreadingHTTPServer(('127.0.0.1',0),handler_for(cls.app))
        cls.url='http://127.0.0.1:'+str(cls.server.server_port)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.tmp.cleanup()
    def request(self,path,body=None,headers=None):
        req=Request(self.url+path,data=None if body is None else json.dumps(body).encode(),headers=headers or {})
        try:
            with urlopen(req) as response:return response.status,json.loads(response.read())
        except HTTPError as e:return e.code,json.loads(e.read())
    def test_public_scope(self):
        code,data=self.request('/api/projects');self.assertEqual(code,200);self.assertEqual(data['total'],1)
        code,data=self.request('/api/projects/'+record(source_record_id='private')['id']);self.assertEqual(code,404)
    def test_export_private_never_included(self):
        code,data=self.request('/api/export');self.assertEqual(len(data['projects']),1)
    def test_unauthorized_mutation(self):
        self.assertEqual(self.request('/api/import',{'projects':[]})[0],401)
        self.assertEqual(self.request('/api/jobs')[0],401)
    def test_invalid_profile(self):
        self.assertEqual(self.request('/api/recommend',{'profile':{'interests':'invalid'}})[0],400)
    def test_csrf(self):
        self.assertEqual(self.request('/api/recommend',{},headers={'Origin':'https://evil.example'})[0],403)
    def test_host_check(self):
        self.assertEqual(self.request('/api/health',headers={'Host':'evil.example'})[0],403)
    def test_private_promotion_block(self):
        code,_=self.request('/api/import',{'projects':[record(visibility='private')],'visibility':'public','confirm_public':True},headers={'Authorization':'Bearer test-token'})
        self.assertEqual(code,400)
    def test_recommend(self):
        code,data=self.request('/api/recommend',{'profile':{'interests':['机器人']},'filters':{}})
        self.assertEqual(code,200);self.assertEqual(data['total'],1);self.assertGreater(data['items'][0]['match']['score'],0)
    def test_traversal(self):
        self.assertEqual(self.request('/%2e%2e/manage.py')[0],404)

if __name__=='__main__':unittest.main()
