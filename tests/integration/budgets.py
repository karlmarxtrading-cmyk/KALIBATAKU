"""Measure release bytes with gzip -6 equivalent and reconcile actual browser request paths."""
import argparse
import gzip
import json
import re
from pathlib import Path
from urllib.parse import unquote
from fixture_server import ROOT, DIST

EVIDENCE = ROOT / 'evidence' / 'acceptance'
def measure(p):
    raw = p.read_bytes()
    return dict(path=p.relative_to(DIST).as_posix(),bytes=len(raw),gzip=len(gzip.compress(raw,compresslevel=6,mtime=0)))

def excerpt(rows):
    return {'files':len(rows),'total_gzip_bytes':sum(r['gzip'] for r in rows),'max':max(rows,key=lambda r:r['gzip'],default=None)}

def run():
    groups = {'package':[], 'shard':[], 'root':[], 'locale':[], 'player':[], 'teacher':[], 'font':[], 'export':[], 'mathjax_local':[], 'math_model_view':[]}
    shell = []
    for p in DIST.rglob('*'):
        if not p.is_file():continue
        path=p.relative_to(DIST).as_posix()
        if path.startswith('bank/'):
            group = 'root' if path=='bank/index.json' else 'package' if path.endswith('.mjs') else 'shard' if path.endswith('.json') else ''
            if group:groups[group].append(measure(p))
        else:
            metric=measure(p)
            shell.append(metric)
            if path.startswith('vendor/mathjax-'):groups['mathjax_local'].append(metric)
            if path.startswith('math/'):groups['math_model_view'].append(metric)
            if path.startswith('locales/'):groups['locale'].append(metric)
            if path.startswith('player/'):groups['player'].append(metric)
            if path.startswith('teacher/') and '/font/' not in path and '/export/' not in path:groups['teacher'].append(metric)
            if '/export/' in path:groups['export'].append(metric)
            if p.suffix in ('.woff','.woff2','.ttf'):groups['font'].append(metric)
    report={'method':'gzip level 6, mtime 0. Network resource bytes and local gzip bytes are distinct.','groups':{k:excerpt(v) for k,v in groups.items()},'assets':shell,'checks':[]}
    caps={'root':20,'package':60,'shard':50,'locale':25}
    for k,limit in caps.items():
        over=[v for v in groups[k] if v['gzip']>limit*1024]
        report['checks'].append({'name':k,'limit_kib':limit,'measured_files':len(groups[k]),'violations':over,'status':'FAIL' if over or not groups[k] else 'PASS'})
    for k,limit in [('player',90),('teacher',150)]:
        count=sum(v['gzip'] for v in groups[k])
        report['checks'].append({'name':k,'limit_kib':limit,'bound':'sum of all applicable modules','bytes':count,'status':'PASS' if count>0 and count<=limit*1024 else 'FAIL'})
    perf=EVIDENCE/'browser-performance.json'
    if perf.exists():
        browser=json.loads(perf.read_text())
        for run_index,run in enumerate(browser.get('runs',[])):
            files=set()
            for rec in run['resources']:
                path=unquote(rec['path'])
                if '/school/math/' not in path:continue
                relative=path.split('/school/math/',1)[1]
                p=(DIST/relative).resolve()
                if p.is_relative_to(DIST) and p.is_file():files.add(p)
            for name,suffixes,limit in [('initial-js',{'.mjs','.js'},150),('initial-css',{'.css'},35),('initial-font',{'.woff','.woff2','.ttf'},100)]:
                rows=[measure(p) for p in sorted(files) if p.suffix in suffixes]
                used=sum(x['gzip'] for x in rows)
                report['checks'].append({'name':name,'run':run_index+1,'limit_kib':limit,'gzip_bytes':used,'paths':[x['path'] for x in rows],'status':'PASS' if used<=limit*1024 and (rows or name=='initial-font') else 'FAIL'})
    out=EVIDENCE/'bundle-budgets.json'
    out.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'groups':report['groups'],'checks':[x['name']+':'+x['status'] for x in report['checks']]},indent=2))
    return 1 if any(x['status']!='PASS' for x in report['checks']) else 0
if __name__=='__main__':raise SystemExit(run())
