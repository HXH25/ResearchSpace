"""Optional query helper for a user-supplied, locally held SRT SQLite database.

This repository intentionally contains no SRT records or SQLite dataset.
"""
import argparse
import json
import pathlib
import sqlite3

p = argparse.ArgumentParser(description='Query an authorized local SRT database')
p.add_argument('--db', type=pathlib.Path, required=True, help='Path to your own SRT SQLite file')
p.add_argument('--id')
p.add_argument('--keyword')
p.add_argument('--department')
p.add_argument('--type', choices=['teacher', 'student'])
p.add_argument('--applicant')
p.add_argument('--limit', type=int, default=20)
a = p.parse_args()
if not a.db.is_file():
    p.error('SRT database not found; this public package contains no bundled SRT dataset')

where, params = [], []
if a.id:
    where.append('p.project_id = ?'); params.append(a.id)
if a.department:
    where.append('p.department = ?'); params.append(a.department)
if a.type:
    where.append('p.initiation_type = ?'); params.append(a.type)
if a.applicant:
    where.append('p.applicant = ?'); params.append(a.applicant)
if a.keyword:
    where.append("(instr(p.title, ?) > 0 OR instr(coalesce(d.description, ''), ?) > 0)")
    params.extend([a.keyword, a.keyword])
sql = 'SELECT p.*, d.description, d.eligibility, d.capacity, d.credits, d.schedule FROM projects p LEFT JOIN project_details d USING(project_id)'
if where:
    sql += ' WHERE ' + ' AND '.join(where)
sql += ' ORDER BY p.project_id LIMIT ?'
params.append(max(1, min(a.limit, 20000)))
with sqlite3.connect(a.db.resolve().as_uri() + '?mode=ro', uri=True) as db:
    db.row_factory = sqlite3.Row
    print(json.dumps([dict(row) for row in db.execute(sql, params)], ensure_ascii=False, indent=2))
