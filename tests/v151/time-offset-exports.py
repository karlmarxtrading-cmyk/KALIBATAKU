"""Verify counts, mission totals, independent timestamps and order in actual files."""
import csv
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile
from zoneinfo import ZoneInfo

import fitz
from openpyxl import load_workbook

root = Path(__file__).resolve().parents[2]
out = root / 'evidence/v151/time'
seed = json.loads((root / 'tests/journey/fixtures/report-audit-04-v14.json').read_bytes())
def instant(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone(timezone.utc)
def as_utc(d):
    return d.isoformat(timespec='milliseconds').replace('+00:00', 'Z')
expected_sessions = [(r['attempt']['attempt_id'], instant(r['attempt']['started_at'])+timedelta(hours=12))
                     for r in reversed(seed['bundles'])]
evidence = []

for name, zone in [('z','UTC'), ('plus07','Asia/Jakarta'), ('plus08','Asia/Makassar'),
                   ('minus05','Asia/Jayapura'), ('mixed','UTC')]:
    case = out / name
    start = datetime(2026,11,28, tzinfo=ZoneInfo(zone)).astimezone(timezone.utc)
    notes = [('B',start),('A',start+timedelta(hours=1)),('Z',start+timedelta(hours=1)),('LAST',start+timedelta(days=1,milliseconds=-1))]
    for ext in ['json','csv','xlsx','docx','pdf']:
        path = case / ('report.'+ext)
        if ext=='json':
            data=json.loads(path.read_bytes())
            assert (data['completed'],data['core']['assigned_count'],data['core']['correct_count'],data['journey']['missions'])==(4,32,32,3)
            assert [(s['id'],instant(s['started'])) for s in data['sessions']]==expected_sessions
            assert [(n['id'],instant(n['at'])) for n in data['notes']]==notes
            assert instant(data['core']['period_start_utc'])==start
            assert instant(data['core']['period_end_exclusive_utc'])==start+timedelta(days=1)
        elif ext in ('xlsx','csv'):
            if ext=='xlsx':
                wb=load_workbook(path,read_only=True,data_only=True)
                sheets={s:list(wb[s].values) for s in ('Summary','Sessions','Journey','Notes')}
                wb.close()
            else:
                sheets=defaultdict(list)
                with path.open(encoding='utf-8-sig',newline='') as f:
                    for tab,*row in csv.reader(f):
                        sheets[tab].append(row)
            rows=sheets['Sessions'][1:]; assert len(rows)==4
            assert [(r[0],r[1]) for r in rows]==[(a,as_utc(t)) for a,t in expected_sessions]
            assert all(r[4]=='Selesai' for r in rows)
            assert [int(v) for v in sheets['Summary'][1][2:4]]==[32,32]
            assert len(sheets['Journey'])==2 and int(sheets['Journey'][1][4])==3
            assert [(r[4],r[1]) for r in sheets['Notes'][1:]]==[(nid,as_utc(t)) for nid,t in notes]
        else:
            if ext=='docx':
                with ZipFile(path) as z:
                    doc=ET.fromstring(z.read('word/document.xml'))
                xml={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                text=' '.join(''.join(p.itertext()) for p in doc.findall('.//w:p',xml))
            else:
                with fitz.open(path) as pdf:
                    text=' '.join(p.get_text() for p in pdf)
            text=' '.join(text.split())
            assert re.search(r'Sesi selesai dalam periode ini:\s*4\s*·\s*Berjalan:\s*0',text)
            assert re.search(r'Misi dalam periode\s+3\b',text)
            assert re.search(r'32\s+dari\s+32 soal',text)
            assert not re.search(r'Catatan (?:EARLY|OUT)\b',text) and zone in text
            notes_seen = re.findall(r'QA\s*·\s*28 Nov 2026,\s*([\d.]+)\s*·\s*r1\s*—\s*Catatan\s+(B|A|Z|LAST)\b',text)
            assert notes_seen==[(t.astimezone(ZoneInfo(zone)).strftime('%H.%M'),n) for n,t in notes],(name,ext,notes_seen)
            history=text.split('Riwayat sesi')[-1].split('Rincian laporan')[0]
            session_times = re.findall(r'28 Nov 2026,\s*(\d\d\.\d\d)',history)
            assert session_times==[t.astimezone(ZoneInfo(zone)).strftime('%H.%M') for _,t in expected_sessions],(name,ext,session_times)
        evidence.append({'file':str(path.relative_to(out)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                         'zone':zone,'completed':4,'assigned':32,'correct':32,'missions':3,'ordered_sessions':4,'ordered_notes':4})
release=json.loads((root/'dist/offline-assets.json').read_bytes())['release']
assert release==json.loads((out/'engine.json').read_bytes())['release']
(out/'formats.json').write_text(json.dumps({'status':'PASS','release':release,'artifacts':evidence,
    'method':'Independent JSON, CSV, XML, openpyxl and PyMuPDF reading with Python zoneinfo/calendar and immutable fixture as oracle.'},indent=2)+'\n')
print('PASS AUD15-03 time-offset-exports',len(evidence),'decoded artifacts in 5 representation groups')
