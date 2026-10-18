import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from .model import normalize, now, present

class Store:
    def __init__(self,path):
        self.path=Path(path); self.path.parent.mkdir(parents=True,exist_ok=True)
        with self.connect() as db:
            db.executescript('''PRAGMA journal_mode=WAL;
              CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,visibility TEXT NOT NULL,source_id TEXT NOT NULL,payload TEXT NOT NULL,updated_at TEXT NOT NULL);
              CREATE INDEX IF NOT EXISTS source_idx ON projects(source_id,visibility);
              CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY,project_id TEXT,payload TEXT,changed_at TEXT);
              CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY,payload TEXT);
              CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,payload TEXT);''')
    @contextmanager
    def connect(self):
        db=sqlite3.connect(self.path,timeout=30); db.row_factory=sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()
    def upsert(self,records,visibility=None):
        normalized=[normalize(p,visibility) for p in records]
        created=updated=unchanged=0
        with self.connect() as db:
            for p in normalized:
                old=db.execute('SELECT payload FROM projects WHERE id=?',(p['id'],)).fetchone()
                payload=json.dumps(p,ensure_ascii=False,sort_keys=True)
                if old and old['payload']==payload:
                    unchanged+=1; continue
                if old:
                    db.execute('INSERT INTO history(project_id,payload,changed_at) VALUES(?,?,?)',(p['id'],old['payload'],now())); updated+=1
                else:
                    created+=1
                db.execute('INSERT INTO projects VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET visibility=excluded.visibility,source_id=excluded.source_id,payload=excluded.payload,updated_at=excluded.updated_at',
                    (p['id'],p['visibility'],p['source_id'],payload,now()))
        return {'created':created,'updated':updated,'unchanged':unchanged,'total':len(normalized)}
    def records(self,include_private=False):
        with self.connect() as db:
            rows=db.execute('SELECT payload FROM projects'+('' if include_private else " WHERE visibility='public'")).fetchall()
        return [json.loads(r['payload']) for r in rows]
    def get(self,id,include_private=False):
        with self.connect() as db:
            r=db.execute('SELECT payload,visibility FROM projects WHERE id=?',(id,)).fetchone()
        return json.loads(r['payload']) if r and (include_private or r['visibility']=='public') else None
    def set_value(self,table,key,value):
        assert table in ('state','jobs')
        column='key' if table=='state' else 'id'
        with self.connect() as db:
            db.execute(f'INSERT INTO {table} VALUES(?,?) ON CONFLICT({column}) DO UPDATE SET payload=excluded.payload',(key,json.dumps(value,ensure_ascii=False)))
    def value(self,table,key,default=None):
        assert table in ('state','jobs')
        column='key' if table=='state' else 'id'
        with self.connect() as db:
            r=db.execute(f'SELECT payload FROM {table} WHERE {column}=?',(key,)).fetchone()
        return json.loads(r['payload']) if r else default
    def jobs(self):
        with self.connect() as db:
            return [json.loads(r[0]) for r in db.execute('SELECT payload FROM jobs ORDER BY rowid DESC LIMIT 30')]
    def stats(self,include_private=False):
        records=self.records(include_private); sources={}
        for p in records:
            sources[p['source_id']]=sources.get(p['source_id'],0)+1
        return {'total':len(records),'public':sum(p['visibility']=='public' for p in records),
                'private':sum(p['visibility']=='private' for p in records),
                'sources':sources,'open':sum(present(p)['effective_status']=='open' for p in records),
                'reviewed':sum(p['reviewed'] for p in records)}
