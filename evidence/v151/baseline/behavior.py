"""Independent assertions on sparse historical records, civil boundaries, and cache faults."""
import argparse
from collections import Counter
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile
from zoneinfo import ZoneInfo

from release_artifacts import check, disk_rows, file_hash, source_rows, tree, write

parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--audit',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args()
entry=Path(__file__).with_name('behavior.mjs')
source=args.source.resolve()
dist=source/'dist'

with zipfile.ZipFile(args.audit) as z:
    def read_unique(suffix):
        names=[n for n in z.namelist() if n.endswith('/'+suffix)]
        check(len(names)==1,'Audit fixture must be unambiguous')
        data=z.read(names[0])
        return json.loads(data),hashlib.sha256(data).hexdigest()
    sparse,sparse_sha=read_unique('09_BUKTI/progresi/sparse_completion_attempts.json')
    backed,backed_sha=read_unique('09_BUKTI/data/reports/timezone-offset-valid-backup.json')

def utc(instant):
    return instant.astimezone(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')

input_cases=[]
expected=[]
offsets=[timezone.utc,timezone(timedelta(hours=7)),timezone(timedelta(hours=8)),timezone(timedelta(hours=-5))]
for zone in ['UTC','Asia/Jakarta','Asia/Makassar','Asia/Jayapura']:
    for day in ['1980-01-01','2000-02-29','2026-11-28','2038-01-19']:
        low=datetime.fromisoformat(day).replace(tzinfo=ZoneInfo(zone))
        high=low+timedelta(days=1)
        timestamps=[(f'b{n}',(low if n<3 else high)+timedelta(milliseconds=(n%3)-1)) for n in range(6)]
        if day=='2026-11-28':
            for a in backed['records']['attempts']:
                s=a['data']; timestamps.append((s['attempt_id'],datetime.fromisoformat(s['started_at'])))
        rows=[]
        selected=[]
        for identity,stamp in timestamps:
            for index,offset in enumerate(offsets):
                label=identity+'-'+str(index)
                rows.append({'attempt_id':label,'started_at':stamp.astimezone(offset).isoformat(timespec='milliseconds').replace('+00:00','Z')})
                if low<=stamp<high: selected.append((stamp.timestamp(),label))
        rows.reverse()
        input_cases.append({'zone':zone,'day':day,'records':rows})
        expected.append({'zone':zone,'day':day,'bounds':[utc(low),utc(high)],'selected':[i for t,i in sorted(selected,key=lambda pair:(-pair[0],pair[1]))]})

run=subprocess.run(['node',str(entry),str(dist)],input=json.dumps({'sparse':sparse,'civil':input_cases}),
                   stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,check=True)
observed=json.loads(run.stdout)
check(observed['civil']==expected,'UTC/IANA boundaries, equivalent representations, membership or stable ordering differ from Python')
seen=Counter(); observations=[]
for n,attempt in enumerate(sparse):
    node=attempt['target_competency_id']
    relevant=[i for i in attempt['items'] if i['question']['competency_id']==node]
    for item in relevant:
        if item['seen'] and item['final_status']!='unseen':
            seen[item['question']['fingerprint'][:16]]+=1
    current=observed['sparse'][n]
    check(list(sorted(seen))==current['map'] and dict(current['selector'])==dict(seen) and current['report']==len(seen),'Committed unique count or selector frequency differs from viewed items')
    check(not current['ready'] and current['next']==node,'Sparse history unlocked or recommended another node')
    observations.append({'sessions':n+1,'items_in_session':len(relevant),'actually_observed_unique':len(seen),'selector_frequency_sum':sum(seen.values()),'next_node':current['next'],'ready':current['ready']})
states={'intact':'ready','absent':'absent','prior-release':'update','repaired':'ready'}
for case in observed['offline']:
    check(case['state']==states.get(case['case'],'repair'),'Unexpected offline label '+case['case'])
dist_tree=tree(disk_rows(dist))
report={'status':'PASS','tested_utc':datetime.now(timezone.utc).isoformat(),'offline_release':json.loads((dist/'offline-assets.json').read_bytes())['release'],'dist_tree_sha256':dist_tree,'source_tree_sha256':tree(source_rows(source)),
        'scope':'Product ES modules imported from dist, immutable source audit fixtures, Python zoneinfo and set/count oracles. CacheStorage is a test double backed by real packaged bytes. Browser and physical acceptance are tracked separately.',
        'script_sha256':{entry.name:file_hash(entry),Path(__file__).name:file_hash(Path(__file__))},'audit_sha256':file_hash(args.audit),
        'fixtures':{'sparse_sha256':sparse_sha,'offset_backup_sha256':backed_sha,'completed_backup_sessions':len(backed['records']['attempts'])},
        'sparse':observations,'calendar':{'cases':len(expected),'input_timestamp_rows':sum(len(r['records']) for r in input_cases),'expectation':'Python zoneinfo calendar midnight inclusive to next midnight exclusive; descending epoch then ascending stable ID','results':observed['civil']},
        'offline':observed['offline']}
write(args.out,report)
print(json.dumps({'status':report['status'],'release':report['offline_release'],'tree':dist_tree,'observed_unique':[o['actually_observed_unique'] for o in observations],'calendar_cases':len(expected),'timestamp_rows':report['calendar']['input_timestamp_rows'],'offline':len(report['offline'])}))
