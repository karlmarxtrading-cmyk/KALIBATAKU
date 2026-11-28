#!/usr/bin/env python3
"""Build all published ESM packages deterministically from the effective registry and plan."""
import argparse, collections, gzip, hashlib, json, os, sys, tempfile, shutil, subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from functools import lru_cache
from domains import bin_domain, seeded, val
from mixed import mix
BASE=Path(__file__).resolve().parent.parent
VER='1.2.0'
SCHEMA_VERSION='1.0.0'
PREFIX='export default '
PURPOSE={'introduce':('Pengenalan','Introduction'),'consolidate':('Penguatan','Consolidation'),'transfer':('Penerapan','Transfer'),'review':('Tinjauan','Review'),'assessment':('Evaluasi','Assessment')}
def js(x):
    return json.dumps(x,ensure_ascii=False,separators=(',',':'),allow_nan=False)
def sha(b):return hashlib.sha256(b).hexdigest()
def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    b=(data if isinstance(data,str) else js(data)+'\n').encode('utf-8')
    path.write_bytes(b)
    return sha(b),len(b)
@lru_cache(maxsize=12000)
def canonical(t):
    if isinstance(t,str):
        x=val(t)
        return f'R:{x.numerator}/{x.denominator}'
    op,a,b=t;u,v=canonical(a),canonical(b)
    if op in ('ADD','MUL') and u>v:u,v=v,u
    return f'{op}({u},{v})'
def fingerprint(t):
    return sha(canonical(t).encode('ascii'))
def leaves(t):
    if isinstance(t,str):return [t]
    return leaves(t[1])+leaves(t[2])
def marks(t):
    if isinstance(t,str):return 'f' if '/' in t else 'd' if '.' in t else 'i'
    return t[0]+'('+marks(t[1])+','+marks(t[2])+')'
def pool_for(domain,tgt):
    active=collections.deque(enumerate(iter(s) for s in domain.candidates()))
    unique={}; seen=0; variation=collections.Counter();families=collections.Counter()
    while active and (domain.exhaustive or len(unique)<tgt):
        k,s=active.popleft()
        try:tree,label=next(s)
        except StopIteration:continue
        active.append((k,s));seen+=1
        f=fingerprint(tree)
        if f in unique:
            variation[label]+=1;continue
        assert domain.accept(tree),(tree,label)
        unique[f]=(tree,label);families[label]+=1
    assert unique
    return unique,not active,seen,dict(families)
def prerequisites(c,level):
    if not c['active']:return []
    out=list(c.get('prerequisite_candidates',[]))
    other={'SUB':['ADD'],'MUL':['ADD'],'DIV':['MUL','SUB'],'MIX':['ADD','SUB','MUL','DIV']}.get(c['operation'],[])
    for t in level['competencies']:
        if t['active'] and t['operation'] in other:out.append(t['competency_id'])
    if level['grade']==6 and level['level']==4 and c['operation']=='MIX':
        out.extend(['arithmetic.multiplication.g03.l01','arithmetic.division.g03.l01'])
    return list(dict.fromkeys(out))
def targets(n):
    weights=[('foundation',3),('target',5),('variation',2)]
    counts={name:n*w//10 for name,w in weights}
    for name,w in sorted(weights,key=lambda p:-(n*p[1]%10))[:n-sum(counts.values())]:counts[name]+=1
    return counts
def difficulty(tree):
    vs=[val(x) for x in leaves(tree)]
    return (len(vs),sum(v<0 for v in vs),sum(v.denominator>1 for v in vs),
            sum(len(str(abs(v.numerator)))+len(str(v.denominator)) for v in vs),
            max(abs(v) for v in vs))
def allocate(pool,plans,seed):
    # The percentile bands are a reproducible pedagogical blueprint.
    # They are deliberately not labelled as empirically calibrated difficulty.
    rng=seeded(seed);byrank=sorted(pool,key=lambda f:(difficulty(pool[f][0]),f))
    groups=collections.defaultdict(list);start=0
    for tier,count in targets(len(pool)).items():
        for fp in byrank[start:start+count]:
            tree,label=pool[fp];groups[(tier,label,marks(tree))].append(fp)
        start+=count
    for arr in groups.values():rng.shuffle(arr)
    keys=sorted(groups);used=collections.Counter();packets={};strat={};assess={}
    for n,p in enumerate(sorted(plans,key=lambda p:(p['purpose']!='assessment',p['package_id']))):
        arr=[];hist=collections.Counter()
        for tier,size in targets(min(len(pool),p['target_questions'])).items():
            allowed=[k for k in keys if k[0]==tier]
            if not size:continue
            assert sum(len(groups[k]) for k in allowed)>=size
            counts=collections.Counter()
            if p['form_variant']=='B':
                counts.update(assess[tier])
            else:
                offset=0 if p['form_variant']=='A' else n%len(allowed)
                ordered=allowed[offset:]+allowed[:offset]
                if p['form_variant']=='A':
                    # Reserve enough candidates in each stratum for the other form.
                    cap={k:len(groups[k])//2 for k in ordered}
                    for avoid_overlap in (True,False):
                        while sum(counts.values())<size:
                            gain=0
                            for k in ordered:
                                if sum(counts.values())==size:break
                                if counts[k]<(cap[k] if avoid_overlap else len(groups[k])):
                                    counts[k]+=1;gain+=1
                            if not gain:break
                    assess[tier]=counts.copy()
                else:
                    # Lowest previously used count across strata; stable tiebreaker
                    # preserves breadth. No fingerprint appears twice in one package.
                    exposure={k:sorted(used[f] for f in groups[k]) for k in ordered}
                    for _ in range(size):
                        available=[k for k in ordered if counts[k]<len(exposure[k])]
                        k=min(available,key=lambda v:(exposure[v][counts[v]],counts[v]))
                        counts[k]+=1
            assert sum(counts.values())==size
            for k,count in counts.items():
                if not count:continue
                ordered=sorted(groups[k],key=used.__getitem__)
                take=ordered[:count]
                arr+=take
                for fp in take:used[fp]+=1
                hist['|'.join(k)]+=count
                groups[k]=ordered[count:]+take
        rng.shuffle(arr);packets[p['package_id']]=arr;strat[p['package_id']]=dict(hist)
    return packets,strat,used
def instructions(grade, questions):
    if grade <= 4:
        return {'id':'Hitung dalam hati. Tulis jawabanmu.', 'en':'Work it out in your head. Enter your answer.'}
    expressions = [q['neutral_expression'] for q in questions]
    if any('⁄' in text for text in expressions):
        return {'id':'Hitung dalam hati. Kamu boleh menulis pecahan seperti 1/2.',
                'en':'Work it out in your head. You can enter a fraction such as 1/2.'}
    if any('.' in text for text in expressions):
        return {'id':'Hitung dalam hati. Gunakan koma untuk desimal, misalnya 0,5.',
                'en':'Work it out in your head. Use a point for a decimal, for example 0.5.'}
    return {'id':'Hitung dalam hati. Tulis jawabanmu.', 'en':'Work it out in your head. Enter your answer.'}


def generate(args):
    bank=args.output;evidence=args.evidence
    levels=json.loads(next((args.spec/'curriculum').glob('*REGISTRY*DRAFT2.json')).read_text())['levels']
    plans=json.loads((args.spec/'planning/package_plan.json').read_text())['packages']
    bycell=collections.defaultdict(list)
    for p in plans:bycell[p['competency_id']].append(p)
    if not args.pool_only:from pedagogy import teach
    inventory=[];coverage=[];deviations=[];global_fps=set();representations=set()
    total=0;grades=[];digests={};maxgzip=0
    for level in levels:
        g,l=level['grade'],level['level']
        if args.grades and g not in [int(v) for v in args.grades.split(',')]:continue
        if l==1:
            grade={'grade':g,'levels':[]}
            grades.append({'grade':g,'url':f'bank/g{g:02}.json'})
        url=f'bank/g{g:02}/l{l:02}.json'
        grade['levels'].append({'level':l,'focus':level['focus'],'url':url})
        shard={'grade':g,'level':l,'focus':level['focus'],'competencies':[]}
        for c in level['competencies']:
            op,cid=c['operation'],c['competency_id']
            meta={k:c[k] for k in ['competency_id','operation','active','title']}
            meta.update(prerequisites=prerequisites(c,level),pool_size=0,packages=[])
            shard['competencies'].append(meta)
            if not c['active']:continue
            rows=bycell[cid]
            domain=mix(g,l) if op=='MIX' else bin_domain(g,l,op)
            nslots=sum(p['target_questions'] for p in rows)
            pool,exact,enumerated,families=pool_for(domain,nslots+max(10,rows[0]['target_questions']))
            count=len(pool);meta['pool_size']=count
            if args.pool_only:
                print(g,l,op,count,exact,flush=True);continue
            packets,profiles,used=allocate(pool,rows,cid)
            cache={};seen_in_cell=set()
            template_prefix=f'MM-TPL-G{g:02}-L{l:02}-{op}-'
            stats={'bound':'finite_recipe_exhausted' if exact else 'constructive_lower_bound','pool_size':count,'canonical_domain_size':count if exact and domain.exhaustive else None}
            meta['pool_bound']=stats['bound']
            for row in rows:
                pid=row['package_id'];arr=packets[pid]
                questions=[]
                for fp in arr:
                    tree,label=pool[fp];global_fps.add(fp);representations.add((fp,sha(js(tree).encode())))
                    if fp not in cache:
                        cache[fp]=dict(question_id=f'{cid}.{fp}',question_revision=VER,competency_id=cid,template_id=template_prefix+label.upper(),template_version=VER,fingerprint=fp,fingerprint_policy='canonical-ast-v1',question_type='numeric_essay',answer_policy='exact_rational',**teach(tree,g,l,op))
                    questions.append(cache[fp])
                form=row['form_variant'];part=row['purpose'];pnum=pid[-3:]
                title={'id':f'{PURPOSE[part][0]} {form or pnum} · {c["title"]["id"]}','en':f'{PURPOSE[part][1]} {form or pnum} · {c["title"]["en"]}'}
                package=dict(schema_version=SCHEMA_VERSION,artifact_status='validated_content',module_id='mental-math',curriculum_id='kalibataku',curriculum_version='1.0.0-draft.2',package_id=pid,content_version=VER,grade=g,level=l,operation=op,target_competency_id=cid,purpose=part,title=title,instructions=instructions(g, questions),question_count=len(arr),form_family_id=f'{cid}.AB' if form else None,form_id=f'{pid}.{form}' if form else None,questions=questions)
                rel=f'v{VER.rsplit(".",1)[0]}/g{g:02}/l{l:02}/{pid}.mjs';body=PREFIX+js(package)+';\n'
                digest,size=write(bank/rel,body);digests[rel]=digest
                zipped=len(gzip.compress(body.encode(),compresslevel=6,mtime=0));maxgzip=max(maxgzip,zipped)
                entry={k:package[k] for k in ('package_id','question_count','purpose','form_id','form_family_id','title','content_version')}
                entry.update(url='bank/'+rel,sha256=digest,bytes=size)
                meta['packages'].append(entry)
                inventory.append(dict(**entry,competency_id=cid,target_questions=row['target_questions'],actual_question_count=len(arr),gzip_bytes=zipped,uncompressed_bytes=size,planned_reuses_in_release_order=sum(fp in seen_in_cell for fp in arr),blueprint=profiles[pid],template_ids=sorted({q['template_id'] for q in questions})))
                seen_in_cell.update(arr);total+=len(arr)
                if len(arr)<row['target_questions']:
                    assert exact and domain.exhaustive, (pid,'uncertified shortage')
                    deviations.append({'deviation_id':'LIMIT-'+pid,'package_id':pid,'target':row['target_questions'],'actual':len(arr),'reason':'Exact finite canonical domain exhausted; no within-package repeats.'})
            fa,fb=[p['package_id'] for p in rows if p['purpose']=='assessment']
            sa,sb=set(packets[fa]),set(packets[fb])
            strat_a,strat_b=profiles[fa],profiles[fb]
            coverage.append(dict(grade=g,level=l,operation=op,competency_id=cid,rule_spec=c['rule_spec'],prerequisites=meta['prerequisites'],diagnostic_targets=meta['prerequisites'],embedded_skills=[v for v in meta['prerequisites'] if '.mixed.' not in v] if op=='MIX' else [],recipe='factory/'+('mixed.py:mix' if op=='MIX' else 'domains.py:'+('addition' if op in ('ADD','SUB') else 'multiplication')),**stats,candidates_visited=enumerated,unique_in_packages=len(seen_in_cell),question_slots=sum(len(packets[p['package_id']]) for p in rows),family_inventory=families,form_A=fa,form_B=fb,assessment_overlap=len(sa&sb),assessment_overlap_rate=len(sa&sb)/len(sa),assessment_structure_A=strat_a,assessment_structure_B=strat_b,blueprint_distance=sum(abs(strat_a.get(k,0)-strat_b.get(k,0)) for k in set(strat_a)|set(strat_b))//2,answer_range=[str(min(val(q['answer']['numerator'])/val(q['answer']['denominator']) for q in cache.values())),str(max(val(q['answer']['numerator'])/val(q['answer']['denominator']) for q in cache.values()))]))
        if args.pool_only:continue
        digests[url[5:]]=write(bank/url[5:],shard)[0]
        if l==5:
            rel=f'g{g:02}.json';digests[rel]=write(bank/rel,grade)[0]
            print('Grade',g, 'packages',len(inventory),'slots',total,flush=True)
    if args.pool_only:return
    summary=dict(version=VER,grades=grades,package_count=len(inventory),question_slots=total,unique_canonical_items=len(global_fps),representation_variants=len(representations)-len(global_fps),distinct_authored_representations=len(representations),intentional_repeated_slots=total-len(global_fps),active_competencies=len(coverage),max_package_gzip_bytes=maxgzip)
    digests['index.json']=write(bank/'index.json',summary)[0]
    write(evidence/'summary.json',summary);write(evidence/'inventory.json',inventory);write(evidence/'coverage.json',coverage);write(evidence/'deviations.json',deviations)
    write(evidence/'bank_sha256.json',dict(sorted(digests.items())))
    print(js(summary),flush=True)
def prepare_release(args):
    target=args.output.resolve(); receipts=args.evidence.resolve()
    if args.grades:
        raise ValueError('--grades is an inspection filter for --pool-only. A published bank contains all 12 grades.')
    if target.exists() and not target.is_dir():raise ValueError('Output is not a directory.')
    if target.exists() and any(target.iterdir()) and not (target/'index.json').exists():
        raise ValueError('Destination contains unrelated files.')
    target.parent.mkdir(parents=True,exist_ok=True)
    receipts.mkdir(parents=True,exist_ok=True)
    stage_parent=target.parent.parent if target.parent.name=='dist' else target.parent
    stage=Path(tempfile.mkdtemp(prefix='.kalibataku-build-',dir=stage_parent))
    data=stage/'dist/bank';result=stage/'evidence';previous=stage/'previous-bank';oldnotes=stage/'previous-evidence'
    install_started=False;committed_notes=[]
    try:
        generate(argparse.Namespace(**{**vars(args),'output':data,'evidence':result}))
        def verify(pair):
            grade,level=pair
            return json.loads(subprocess.check_output(['node',str(BASE/'tests/bank/oracle.mjs'),str(stage),f'g{grade:02}',f'l{level:02}']))
        with ThreadPoolExecutor(max_workers=3) as jobs:
            checks=list(jobs.map(verify,((g,l) for g in range(1,13) for l in range(1,6))))
        summary=json.loads((result/'summary.json').read_text())
        assert sum(row['slots'] for row in checks)==summary['question_slots']
        assert sum(row['packages'] for row in checks)==summary['package_count']
        write(result/'oracle-by-level.json',checks)
        # Stage the complete distributable outside its final path. On errors leave
        # the previously installed bank and evidence available to the publisher.
        oldnotes.mkdir()
        if target.exists():os.replace(target,previous)
        install_started=True
        os.replace(data,target)
        for note in result.iterdir():
            destination=receipts/note.name
            if destination.exists():shutil.copy2(destination,oldnotes/note.name)
            with tempfile.NamedTemporaryFile(dir=receipts,delete=False) as f:
                with note.open('rb') as src:shutil.copyfileobj(src,f)
                temp=Path(f.name)
            os.replace(temp,destination);committed_notes.append(note.name)
    except BaseException as exc:
        if install_started:
            if target.exists():os.replace(target,stage/'quarantined-bank')
            if previous.exists():os.replace(previous,target)
            for name in committed_notes:
                if (oldnotes/name).exists():shutil.copy2(oldnotes/name,receipts/name)
                else:(receipts/name).unlink(missing_ok=True)
        quarantine=Path(tempfile.gettempdir())/'kalibataku-factory-quarantine'
        quarantine.mkdir(exist_ok=True)
        reason={'status':'QUARANTINED','error_type':type(exc).__name__,'error':str(exc)}
        write(stage/'failure.json',reason)
        saved=Path(shutil.move(str(stage),str(quarantine/stage.name)))
        print(js({**reason,'evidence':str(saved)}),file=sys.stderr)
        raise
    else:
        shutil.rmtree(stage)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--spec',type=Path,default=BASE/'spec')
    parser.add_argument('--output',type=Path,default=BASE/'dist/bank')
    parser.add_argument('--evidence',type=Path,default=BASE/'evidence/bank')
    parser.add_argument('--pool-only',action='store_true')
    parser.add_argument('--grades',type=str,default='')
    args=parser.parse_args()
    if args.pool_only:generate(args)
    else:prepare_release(args)
if __name__=='__main__':main()
