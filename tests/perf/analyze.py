"""Reconcile served browser resources with gzip-6 budgets and repeated workload traces."""
import argparse
import csv
import gzip
import hashlib
import json
import re
import statistics
from pathlib import Path
from urllib.parse import unquote
ROOT=Path(__file__).resolve().parents[2]
DIST=ROOT/'dist'
import os
OUT=Path(os.environ.get('KALIBATAKU_PERF_OUT',ROOT/'evidence/ux/performance'))
def write(path,obj):
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def stats(values):
    data=[x for x in values if isinstance(x,(int,float))]
    return {'n':len(data),'min':min(data),'median':statistics.median(data),'max':max(data)} if data else {'n':0}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--receipt',type=Path,default=ROOT/'evidence/ux/acceptance/browser-perf-ux.json')
    args=ap.parse_args()
    r=json.loads(args.receipt.read_bytes())
    manifest=json.loads((DIST/'offline-assets.json').read_bytes())
    if manifest['release']!=r['release']:print('NOTICE: receipt is from an earlier build; compare served checksums before release.')
    OUT.mkdir(parents=True,exist_ok=True)
    assets={}
    graph={}
    dist_hash=hashlib.sha256()
    for p in sorted(DIST.rglob('*')):
        if not p.is_file():continue
        rel=str(p.relative_to(DIST))
        body=p.read_bytes();dist_hash.update((hashlib.sha256(body).hexdigest()+'  '+rel+'\n').encode());assets[rel]=len(body),len(gzip.compress(body,compresslevel=6,mtime=0))
        if rel.startswith('bank/') or p.suffix not in ('.js','.mjs'):continue
        # Static and literal dynamic imports are recorded separately, with concrete paths.
        txt=body.decode()
        edges={}
        for name,pattern in [('static',r'(?:\bfrom\s*|\bimport\s*)[\'"]([^\'"]+)[\'"]'),
                             ('lazy',r'\bimport\(\s*[\'"]([^\'"]+)[\'"]'),('worker_or_asset',r'\bnew URL\(\s*[\'"]([^\'"]+)[\'"]\s*,\s*import.meta.url')]:
            paths=[]
            for route in re.findall(pattern,txt):
                if not route.startswith('.'):continue
                target=(p.parent/route).resolve()
                if target.is_file() and target.is_relative_to(DIST):paths.append(str(target.relative_to(DIST)))
            edges[name]=sorted(set(paths))
        graph[rel]=edges
    with (OUT/'bundle-gzip.csv').open('w',newline='') as fs:
        csvout=csv.writer(fs);csvout.writerow(['path','decoded_bytes','gzip_6_bytes']);csvout.writerows((k,*v) for k,v in assets.items())
    write(OUT/'module-graph.json',graph)
    def closure(paths):
        out=set();pending=list(paths)
        while pending:
            p=pending.pop()
            if p in out:continue
            assert p in assets,p;out.add(p);pending.extend(graph.get(p,{}).get('static',[]))
        return out
    def sizes(paths):
        return sum(assets[k][1] for k in set(paths))
    def fields(rows):
        out=set()
        for e in rows:
            if '/school/math/' not in e['path']:continue
            n=unquote(e['path']).split('/school/math/',1)[1]
            if n in assets:out.add(n)
        return out
    budgets=[]
    def add_budget(label,kib,paths,method='sum',exclude=(),required=True):
        paths=sorted(set(paths)-set(exclude))
        value=max((assets[n][1] for n in paths),default=0) if method=='maximum per file' else sizes(paths)
        budgets.append(dict(group=label,limit_kib=kib,method=method,count=len(paths),gzip_bytes=value,
                            status='PASS' if (paths or not required) and value<=kib*1024 else 'FAIL'))
    fonts=('.ttf','.woff','.woff2','.otf')
    for i,run in enumerate(r['runs'],1):
        initial=fields(run['home'])
        for k,ext,limit in [('js',('.js','.mjs'),150),('css',('.css',),35),('font',fonts,100)]:
            add_budget('initial '+k+' run '+str(i),limit,[p for p in initial if p.endswith(ext)],required=k!='font')
    add_budget('locale',25,[p for p in assets if p.startswith('locales/')],'maximum per file')
    add_budget('bank index',20,['bank/index.json'])
    add_budget('bank shard',50,[p for p in assets if p.startswith('bank/') and p.endswith('.json') and p!='bank/index.json'],'maximum per file')
    add_budget('bank package',60,[p for p in assets if p.startswith('bank/') and p.endswith('.mjs')],'maximum per file')
    homes=set.union(*(fields(run['home']) for run in r['runs'])) if r['runs'] else set()
    player=[p for p in assets if p.startswith(('player/','learning/')) and p.endswith(('.css','.mjs','.js'))]
    add_budget('additional student player + shared static dependencies',90,closure(player),exclude=homes)
    # Every renderer file the browser actually requested after the player opened counts,
    # including lazily imported modules and their static imports (TECH-03 / AC-068).
    render_files={n for run in r['runs'] for n in fields(run['post_player']) if n.startswith(('vendor/','math/'))}
    complete_player=closure(player)|closure(sorted(render_files))
    add_budget('student player including observed renderer, AC-068',90,complete_player,exclude=homes)
    regular=[p for p in assets if p.startswith('teacher/') and p.endswith(('.css','.js')) and not p.startswith(('teacher/export/','teacher/font/'))]
    for route in ['teacher','admin']:
        add_budget('additional '+route+' workspace (conservative full workspace)',150,closure(regular),exclude=homes)
    exports={}
    for fmt,modules in [('pdf',['pdf']),('docx',['docx']),('xlsx',['xlsx']),('json',[]),('csv',['csv']),('zip',['pdf','zip'])]:
        paths=closure(['teacher/export/work.js']+['teacher/export/'+x+'.js' for x in modules])
        if 'pdf' in modules:paths|={'teacher/font/DejaVuSans.ttf','teacher/font/metrics.json'}
        exports[fmt]={'all_paths':sorted(paths),'gzip_bytes':sizes(paths),'additional_after_home':sizes(paths-homes)}
    write(OUT/'export-format-costs.json',exports)
    shape=r.get('scale',{});measurements=shape.get('runs',[]);nav=r['runs']
    actions=['catalog','launch','submit','next','preview']
    result={'release':r['release'],'analyzed_dist_release':manifest['release'],'ua':r['navigator'],'profile':r['network'],'cpu':r['cpu'],
            'dist_tree_sha256':dist_hash.hexdigest(),'release_after':r.get('release_after'),'build_bootstrap':r['bootstrap'],'run_errors':r['errors'],'volumes':shape.get('dataset'),
            'bank_package_count':sum(n.startswith('bank/') and n.endswith('.mjs') for n in assets),
            'nav_runs':len(nav),'scale_runs':len(measurements),'budgets':budgets,'home_lcp_ms':stats([x['home_lcp_ms'] for x in nav]),'home_cls':stats([x['cls'] for x in nav]),
            'warm_lcp_ms':stats([x.get('warm_home',{}).get('lcp_ms') for x in nav]),'warm_cls':stats([x.get('warm_home',{}).get('cls') for x in nav]),
            'paint_opportunity_ms':{a:stats([x[a].get('paint_opportunity_ms') for x in nav]) for a in actions},
            'visual_feedback_dom_ms':{a:stats([x[a]['local_dom_feedback_ms'] for x in nav]) for a in actions},
            'complete_ms':{a:stats([x[a]['ready_ms'] for x in nav]) for a in actions},
            'large_history':{key:stats([m[key] for m in measurements]) for key in ('page_ms','filtered_ms','history_dom','history_articles','filtered_next_ms','preview_worker_ms','progress_worker_ms','heap_after')},
            'worker_batch':{key:stats([m['batch'][key] for m in measurements]) for key in ('zip_bytes','elapsed_ms','longest_tick_gap_ms','emitted','ticks')},
            'synthetic_input_during_batch_ms':stats([sample for m in measurements for sample in m['batch']['input_ms']]),
            'cancel_after_three':[m['cancel']['canceled'] for m in measurements],
            'scale_long_tasks_ms':stats([x['duration'] for x in shape.get('long_tasks',[])]),
            'home_retrieved_locked_data':[n for n in homes if n.startswith(('teacher/','player/')) or (n.startswith('bank/') and n.endswith('.mjs'))],
            'field_p75':{'status':'NOT_RUN','reason':'No production RUM cohort or field deployment.'},
            'heap_note':'performance.memory values, if available, describe browser-exposed JS heap. They do not cover all worker or IndexedDB memory. No forced GC or memory ceiling measured.'}
    lcp=result['home_lcp_ms'];cls=result['home_cls']
    pass_feedback=len(nav)==5 and all(v['n']==5 and v['max']<=100 for v in result['visual_feedback_dom_ms'].values())
    result['checks']={
      'AC-068':'PASS' if len(nav)==5 and all(b['status']=='PASS' for b in budgets) and not result['home_retrieved_locked_data'] else 'FAIL',
      'AC-069':'PASS' if pass_feedback and lcp['n']==5 and lcp['median']<=2500 and cls['n']==5 and cls['max']<=0.1 else 'FAIL',
      'AC-070':'NOT_RUN',
      'AC-071':'PASS' if len(measurements)==5 and all(m['history_articles']==10 and m['batch']['emitted']==100 and m['cancel']['canceled'] for m in measurements) else 'FAIL'
    }
    if r['errors'] or manifest['release']!=r['release'] or r.get('release_after')!=r['release']:
        for gate in ('AC-068','AC-069','AC-071'): result['checks'][gate]='RETEST_REQUIRED'
    write(OUT/'performance-summary.json',result)
    rows=[{'id':b['group'],'status':b['status'],'expected':f"≤ {b['limit_kib']} KiB gzip ({b['method']})",'actual':{'gzip_bytes':b['gzip_bytes'],'files':b['count']}} for b in budgets]
    rows+=[{'id':k,'status':'PASS' if v=='PASS' else 'FAIL','expected':'performance gate','actual':v} for k,v in result['checks'].items() if k!='AC-070']
    rows.append({'id':'renderer-observed','status':'PASS' if render_files else 'FAIL','expected':'renderer requests observed after the player opened','actual':sorted(render_files)})
    rec={'schema':'kalibataku-qa-receipt/1','suite':'performance-budgets','build':{'offline_release':manifest['release']},'assertions':len(rows),
         'status':'FAIL' if any(x['status']!='PASS' for x in rows) else 'PASS','errors':list(r['errors']),'checks':rows,'field_p75':result['field_p75'],
         'profile':{'network':r['network'],'cpu':r['cpu'],'ua':r['navigator']}}
    dest=Path(os.environ.get('KALIBATAKU_RECEIPTS',ROOT/'evidence/v13/receipts'));dest.mkdir(parents=True,exist_ok=True)
    (dest/'performance-budgets.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n')
    raise SystemExit(0 if rec['status']=='PASS' else 1)
    print(json.dumps({k:v for k,v in result.items() if k not in ('budgets','large_history','complete_ms','worker_batch','cpu','profile','ua','heap_note')},ensure_ascii=False))
if __name__=='__main__':main()
