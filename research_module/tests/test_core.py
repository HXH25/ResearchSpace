import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch
from research.model import normalize, effective_status, validate_profile, safe_url
from research.matching import assess, query_match
from research.store import Store
from research.collectors import collect, nih_record, nsf_record, hkust_record
from research.network import Fetcher,FetchError
from research.importers import srt_records
from research.server import App

def record(**changes):
    p={'title':'Robotics and machine learning','source_id':'test','source_record_id':'1','source_url':'https://example.edu/p/1',
       'kind':'project','description':'Python for robot control','skills':['Python'],'tags':['机器人'],'mentors':['PI'],
       'period_text':'two months','team':'Lab A','application_method':'Use official form','eligibility_text':'Undergraduate students',
       'status':'open','status_verified_at':'2026-10-10','status_evidence':'Current call','reviewed':True,'collected_at':'2026-10-10'}
    p.update(changes);return normalize(p)

class ModelTests(unittest.TestCase):
    def test_status_expiration(self):
        self.assertEqual(effective_status(record(),date(2026,10,18)),'open')
        self.assertEqual(effective_status(record(),date(2026,12,1)),'unknown')
        self.assertEqual(effective_status(record(),date(2026,10,1)),'unknown')
    def test_deadline_closed(self):
        self.assertEqual(effective_status(record(deadline='2026-10-17'),date(2026,10,18)),'closed')
    def test_award_never_recruitment(self):
        self.assertEqual(effective_status(record(kind='funded_research'),date(2026,10,18)),'unknown')
    def test_unreviewed_never_open(self):
        self.assertEqual(effective_status(record(reviewed=False),date(2026,10,18)),'unknown')
    def test_profiles_invalid(self):
        for raw in [{'year':-1},{'hours_per_week':200},{'interests':'robot'},{'start_date':'bad'},{'end_date':'2025-01-01','start_date':'2026-01-01'}]:
            with self.assertRaises(ValueError):validate_profile(raw)
    def test_source_url_safety(self):
        self.assertFalse(safe_url('javascript:alert(1)'))
        self.assertFalse(safe_url('https://user:password@example.edu'))
        with self.assertRaises(ValueError):record(source_url='invalid')
    def test_bilingual(self):
        self.assertTrue(query_match(record(),'机器学习'))
        self.assertTrue(query_match(record(),'机器人'))
        self.assertFalse(query_match(record(),'化学'))
    def test_short_alias_no_substring(self):
        from research.matching import contains
        self.assertFalse(contains('chair and said','AI'))
        self.assertTrue(contains('AI systems','人工智能'))
    def test_eligibility_independent(self):
        p=record(required_institution='香港科技大学')
        result=assess(p,validate_profile({'institution':'清华','interests':['机器学习'],'skills':['Python']}))
        self.assertGreater(result['match']['score'],70)
        self.assertEqual(result['match']['eligibility'],'conflict')
        self.assertTrue(result['match']['conflicts'])
    def test_unknown_not_eligible(self):
        self.assertEqual(assess(record(),validate_profile({}))['match']['eligibility'],'needs_check')
    def test_alias_institution(self):
        r=assess(record(required_institution='香港科技大学'),validate_profile({'institution':'HKUST'}))
        self.assertFalse(r['match']['conflicts'])
    def test_time_degree_language(self):
        p=record(allowed_degrees=['bachelor'],required_start='2026-07-01',required_language='英语',min_hours=20)
        p=assess(p,validate_profile({'degree':'phd','start_date':'2026-07-15','languages':['中文'],'hours_per_week':4}))
        self.assertEqual(len(p['match']['conflicts']),4)
    def test_missing_does_not_create_claims(self):
        p=record(mentors=[],team='',application_method='')
        r=assess(p,validate_profile({}))
        self.assertIn('导师尚未明确',r['match']['unknowns'])
        self.assertEqual(r['mentors'],[])

class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.store=Store(Path(self.tmp.name)/'test.db')
    def tearDown(self):self.tmp.cleanup()
    def test_upsert_idempotent_and_history(self):
        self.assertEqual(self.store.upsert([record()])['created'],1)
        self.assertEqual(self.store.upsert([record()])['unchanged'],1)
        self.assertEqual(self.store.upsert([record(title='New title')])['updated'],1)
        with self.store.connect() as d:self.assertEqual(d.execute('SELECT COUNT(*) FROM history').fetchone()[0],1)
    def test_atomic_validation(self):
        with self.assertRaises(ValueError):self.store.upsert([record(),{'title':'invalid'}])
        self.assertEqual(self.store.records(),[])
    def test_private_not_public(self):
        self.store.upsert([record()],'private')
        self.assertEqual(len(self.store.records()),0)
        self.assertEqual(len(self.store.records(True)),1)
        self.assertIsNone(self.store.get(record()['id']))
    def test_filter_before_pagination(self):
        self.store.upsert([record(source_record_id=str(i),required_institution='A' if i<8 else '') for i in range(10)])
        app=App(self.store,[],'token')
        r=app.search({'page_size':1},validate_profile({'institution':'B'}))
        self.assertEqual(r['total'],2);self.assertEqual(len(r['items']),1)
    def test_search_and_public_export(self):
        self.store.upsert([record(),record(source_record_id='2',visibility='private')])
        app=App(self.store,[],'token')
        self.assertEqual(app.search({'q':'机器学习'})['total'],1)
    def test_resume_after_failure(self):
        class Fake:
            def __init__(self):self.calls=[];self.fail=True
            def json(s,url,body):
                s.calls.append(body['offset'])
                if body['offset']==100 and s.fail:raise FetchError('HTTP 503')
                if body['offset']==0:return {'meta':{'total':101},'results':[{'appl_id':i,'project_title':str(i)} for i in range(100)]}
                return {'meta':{'total':101},'results':[{'appl_id':100,'project_title':'final'}]}
        f=Fake();s={'id':'nih','type':'nih','endpoint':'https://example.edu','allowed_hosts':['example.edu']}
        first=collect(self.store,s,max_pages=2,fetcher=f)
        self.assertEqual(first['status'],'failed');self.assertEqual(len(self.store.records()),100)
        f.fail=False;second=collect(self.store,s,max_pages=1,fetcher=f)
        self.assertEqual(f.calls,[0,100,100]);self.assertTrue(second['exhausted']);self.assertEqual(len(self.store.records()),101)
    def test_failed_schema_keeps_cursor(self):
        class Fake:
            def json(s,*args):return {'unexpected':[]}
        s={'id':'nih','type':'nih','endpoint':'https://example.edu','allowed_hosts':['example.edu']}
        r=collect(self.store,s,fetcher=Fake())
        self.assertEqual(r['status'],'failed');self.assertEqual(len(self.store.records()),0)
    def test_html_crawl(self):
        class Fake:
            def page(s,url):
                if url.endswith('/projects'):return '<a href="/projects/a">A</a><a href="https://evil.example/p">bad</a>'
                return '<title>Example | UROP</title><h2>Project Description</h2><p>Study robots</p><h2>Supervisor</h2><p>Alice</p><h2>Quota</h2><p>2</p>'
        s={'id':'hk','type':'hkust','urls':['https://example.edu/projects'],'allowed_hosts':['example.edu'],'follow_prefixes':['/projects']}
        r=collect(self.store,s,max_pages=2,fetcher=Fake())
        self.assertTrue(r['exhausted']);self.assertEqual(len(self.store.records()),1)
        self.assertEqual(self.store.records()[0]['mentors'],['Alice'])
    def test_source_mappers(self):
        p=nsf_record({'id':'1','title':'test','startDate':'09/01/2026','piFullName':'Bob'},{'id':'nsf'})
        self.assertEqual(p['start_date'],'2026-09-01');self.assertEqual(p['kind'],'funded_research')
        p=nih_record({'appl_id':1,'project_title':'Title','organization':{'org_name':'Lab'},'principal_investigators':[{'full_name':'Alice'}]},{'id':'nih'})
        self.assertEqual(p['mentors'],['Alice']);self.assertNotIn('application_method',p)
    def test_private_srt_mentor_not_student(self):
        path=Path(self.tmp.name)/'srt.json';path.write_text(json.dumps([{'project_id':'S1','title':'Test','applicant':'Student','mentor':'','mentor_team':'Raw team','start_month':'202609','end_month':'202708'}]))
        p=srt_records(path)[0]
        self.assertEqual(p['mentors'],[]);self.assertEqual(p['visibility'],'private');self.assertNotIn('applicant',p)

class NetworkTests(unittest.TestCase):
    def test_ssrf(self):
        f=Fetcher(['example.edu']); f.proxy=None
        for u in ['http://example.edu/','https://localhost/','https://example.edu:1234/','https://x:pw@example.edu/']:
            with self.assertRaises(FetchError):f.validate(u)
        with patch('socket.getaddrinfo',return_value=[(2,1,6,'',('127.0.0.1',443))]):
            with self.assertRaises(FetchError):f.validate('https://example.edu/')
        with patch('socket.getaddrinfo',return_value=[(2,1,6,'',('169.254.169.254',443))]):
            with self.assertRaises(FetchError):f.validate('https://example.edu/')
    def test_robots_block(self):
        f=Fetcher(['example.edu'])
        with patch.object(f,'fetch',return_value='User-agent: *\nDisallow: /'):
            with self.assertRaises(FetchError):f.page('https://example.edu/p')

if __name__=='__main__': unittest.main()
