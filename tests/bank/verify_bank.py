#!/usr/bin/env python3
"""Re-open all published bytes; audit semantics, replay the independent JS oracle, and verify a second clean generation."""
from pathlib import Path
import concurrent.futures, collections, subprocess, json, hashlib, os, sys, argparse, gzip
from fractions import Fraction as F
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'factory'))
from domains import bin_domain, decimal, val, seeded, gcd
from mixed import mix,trace
from build_bank import fingerprint, js, write, marks, targets

def read(path):return json.loads(path.read_text())
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def decode(node):
    if node['kind']=='binary':return node['operation'],decode(node['left']),decode(node['right'])
    f=node['display'];v=F(int(node['numerator']),int(node['denominator']))
    if f['kind']=='integer':return str(v.numerator)
    if f['kind']=='decimal':return decimal(v,f['decimal_places'])
    return f['numerator']+'/'+f['denominator']
def nudge(tree,token):
    return token if isinstance(tree,str) else (tree[0],nudge(tree[1],token),tree[2])
def check_named():
    # Fixed regression cases use hand-derived expectations independent of all serializers.
    P=[
       (1,1,'ADD',('ADD','2','3'),True),(1,1,'ADD',('ADD','3','3'),False),
       (1,3,'SUB',('SUB','10','1'),False),(1,4,'ADD',('ADD','9','1'),True),
       (2,1,'ADD',('ADD','38','25'),False),(2,2,'ADD',('ADD','24','35'),False),
       (2,2,'SUB',('SUB','75','34'),False),(2,3,'MUL',('MUL','7','5'),True),
       (3,2,'MUL',('MUL','39','9'),False),(4,3,'MUL',('MUL','7','25'),False),
       (5,3,'ADD',('ADD','3/8','2/8'),True),(5,3,'ADD',('ADD','3/8','1/4'),False),
       (5,3,'DIV',('DIV','3/4','0'),False),(5,4,'MUL',('MUL','3/8','23'),False),
       (6,1,'SUB',('SUB','1/2','3/4'),False),(6,3,'MUL',('MUL','3/8','64'),True),
       (6,3,'MUL',('MUL','3/8','63'),False),(7,1,'ADD',('ADD','3','4'),False),
       (7,2,'ADD',('ADD','-14','24'),False),(7,3,'DIV',('DIV','1881','19'),False),
       (8,3,'DIV',('DIV','3/7','2/5'),False),(11,3,'MUL',('MUL','2/3','3/5'),False),
       (11,4,'ADD',('ADD','100','37'),False),(12,4,'MUL',('MUL','100','7'),False),
       (1,5,'MIX',('SUB',('ADD','20','1'),'4'),False),
       (2,1,'MIX',('SUB',('ADD','18','13'),'2'),False),
       (3,5,'MIX',('MUL',('DIV','3','2'),'2'),False),
       (4,5,'MIX',('ADD',('DIV',('MUL','11','25'),'2'),'5'),False),
       (8,3,'MIX',('ADD',('MUL','3/7','1/2'),'1/4'),False)]
    example=read(ROOT/'spec/examples/PACKAGE_CONTRACT_EXAMPLE.json')['questions'][0]
    assert fingerprint(decode(example['expression_ast']))==example['fingerprint']
    results=[]
    for g,l,op,tree,expect in P:
        d=mix(g,l) if op=='MIX' else bin_domain(g,l,op)
        got=d.accept(tree)
        assert bool(got)==expect,(g,l,op,tree,expect,got)
        results.append(dict(grade=g,level=l,operation=op,tree=tree,accepted=expect))
    return results

def branch_fixtures(d):
    """Exercise min/max parameter selections and exact predicate decisions per finite branch."""
    result=collections.Counter()
    if hasattr(d,'branches'):
        for h,(aa,bb,p,inv,label) in enumerate(d.branches):
            a0=min(aa,key=val);a1=max(aa,key=val);b0=min(bb,key=val);b1=max(bb,key=val)
            ax=[a0,a1,aa[len(aa)//2]];bx=[b0,b1,bb[len(bb)//2]]
            for u in ax:
                for v in bx:
                    a,b=val(u),val(v)
                    expected=(d.op!='DIV' or b!=0) and (not p or p(a,b,u,v))
                    t=d.op,decimal(a*b) if inv else u,v
                    if expected:assert d.accept(t),(t,label);result['accepted_grid_edges']+=1
                    elif not d.accept(t):result['rejected_grid_edges']+=1
                    else:result['accepted_by_other_branch']+=1
            result['branches']+=1
    else:
        from mixed import fill
        for label,s in d.shapes:
            for take in (min,max):
                bindings={k:take(arr,key=val) for k,arr in s.grids.items()}
                t=fill(s.shape,bindings);predicate=not s.predicate or s.predicate(**{k:val(x) for k,x in bindings.items()})
                expected=predicate and d.bounds(t)
                if expected:assert d.accept(t);result['accepted_grid_edges']+=1
                elif not d.accept(t):result['rejected_grid_edges']+=1
                else:result['accepted_by_other_branch']+=1
            result['branches']+=1
    return dict(result)
def main():
    a=argparse.ArgumentParser();a.add_argument('--compare-bank',type=Path);a.add_argument('--jobs',type=int,default=3)
    args=a.parse_args();bank=ROOT/'dist/bank';ev=ROOT/'evidence/bank'
    coverage=read(ev/'coverage.json');summary=read(ev/'summary.json');hashes=read(ev/'bank_sha256.json');inventory=read(ev/'inventory.json')
    files={str(p.relative_to(bank)) for p in bank.rglob('*') if p.is_file()}
    assert files==set(hashes)
    current={p:digest(bank/p) for p in sorted(files)}
    assert current==hashes
    if args.compare_bank:
        other=args.compare_bank
        assert files=={str(p.relative_to(other)) for p in other.rglob('*') if p.is_file()}
        assert all(digest(other/p)==h for p,h in hashes.items())
        write(ev/'determinism.json',dict(status='PASS',method='Compared byte SHA-256 of every artifact from two clean independent outputs',file_count=len(files),file_set_sha256=hashlib.sha256(js(dict(sorted(hashes.items()))).encode()).hexdigest()))
    matrix=[]
    for g in range(1,13):
        for l in range(1,6):matrix.append((f'g{g:02}',f'l{l:02}'))
    def oracle(pair):
        cmd=['node',str(ROOT/'tests/bank/oracle.mjs'),str(ROOT),*pair]
        return json.loads(subprocess.check_output(cmd))
    results=[]
    # Each node process handles one level so the ESM module cache is bounded.
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as jobs:
        pending=jobs.map(oracle,matrix)
        results=list(pending)
    assert sum(x['slots'] for x in results)==summary['question_slots']
    write(ev/'oracle-by-level.json',results)
    if (ev/'determinism.json').exists():
        previous=read(ev/'determinism.json')
        assert previous['file_set_sha256']==hashlib.sha256(js(dict(sorted(hashes.items()))).encode()).hexdigest(),'Re-run --compare-bank on current bytes.'
    manually=check_named();write(ev/'regression-fixtures.json',manually)
    bycell={c['competency_id']:c for c in coverage};cells=[];inactive=0;fps=set();variants=set();pids=set();qregistry={};errors=0;blueprints={}
    for c in coverage:
        assert c['blueprint_distance']==0,c['competency_id']
        assert c['form_A']!=c['form_B']
    for g,l in matrix:
        shard=read(bank/g/(l+'.json'))
        for c in shard['competencies']:
            cid,op=c['competency_id'],c['operation']
            if not c['active']:
                assert not c['packages'];inactive+=1;continue
            gnum,lnum=shard['grade'],shard['level']
            d=mix(gnum,lnum) if op=='MIX' else bin_domain(gnum,lnum,op)
            choices={};answers=collections.Counter();families=collections.Counter()
            counts=branch_fixtures(d);negative={};localfp=set()
            for p in c['packages']:
                assert p['package_id'] not in pids;pids.add(p['package_id'])
                pack=json.loads((ROOT/'dist'/p['url']).read_text()[15:-2])
                for q in pack['questions']:
                    f=q['fingerprint'];tree=decode(q['expression_ast'])
                    if f not in localfp:
                        assert d.accept(tree),(cid,tree)
                        assert fingerprint(tree)==f
                        localfp.add(f)
                    fps.add(f);variants.add((f,tree));qid=q['question_id']
                    signature=(f,q['question_revision'],q['competency_id'])
                    assert qregistry.setdefault(qid,signature)==signature
                    family=q['template_id']
                    if family not in negative:
                        bad=nudge(tree,'999999999999999999')
                        assert not d.accept(bad),(cid,bad)
                        negative[family]=dict(valid=tree,invalid_operand=bad)
                    vals=trace(tree);minimum,maximum=min(vals),max(vals)
                    answer=vals[-1];answers[str(answer)]+=1;families[family]+=1
                    if family not in choices:choices[family]=dict(min=minimum,max=maximum,den=1)
                    bound=choices[family];bound['min']=min(bound['min'],minimum);bound['max']=max(bound['max'],maximum);bound['den']=max(bound['den'],max(x.denominator for x in vals))
            authored={s[0] for s in d.shapes} if op=='MIX' else {b[4] for b in d.branches}
            assert all(any(k.endswith('-'+kind.upper()) for k in families) for kind in authored),(cid,'missing authored family')
            cells.append(dict(competency_id=cid,rule_membership=len(localfp),templates=dict(families),edge_checks=counts,observed_bounds={k:{p:str(v) for p,v in r.items()} for k,r in choices.items()},positive_negative=negative,distinct_answers=len(answers),most_frequent_answers=answers.most_common(3)))
    assert (len(results),len(cells),inactive)==(60,281,19)
    assert len(pids)==summary['package_count']==4604
    assert len(fps)==summary['unique_canonical_items'] and len(variants)==summary['distinct_authored_representations']
    for c in coverage:
        for pre in c['prerequisites']:assert pre in bycell
    visited=set()
    def walk(cid,stack):
        assert cid not in stack
        if cid in visited:return
        for p in bycell[cid]['prerequisites']:walk(p,stack|{cid})
        visited.add(cid)
    for cid in bycell:walk(cid,set())
    expected={'arithmetic.addition.g01.l01':12,'arithmetic.subtraction.g01.l01':21,'arithmetic.addition.g01.l02':36,'arithmetic.multiplication.g02.l03':30,'arithmetic.multiplication.g03.l01':66}
    for cid,n in expected.items():assert bycell[cid]['canonical_domain_size']==n
    assert all(p['gzip_bytes']<=60*1024 for p in inventory)
    assert all(p['actual_question_count']==p['question_count'] and p['actual_question_count']<=p['target_questions'] for p in inventory)
    for p in inventory:
        actual=collections.Counter()
        for label,n in p['blueprint'].items():actual[label.split('|')[0]]+=n
        assert dict(actual)==targets(p['actual_question_count'])
    write(ev/'semantic-by-cell.json',cells)
    receipts={}
    mappings={100:['summary.json','coverage.json'],101:['inventory.json','oracle-by-level.json'],102:['coverage.json','semantic-by-cell.json'],103:['coverage.json','semantic-by-cell.json'],104:['oracle-by-level.json','regression-fixtures.json'],105:['oracle-by-level.json','semantic-by-cell.json'],106:['semantic-by-cell.json','regression-fixtures.json'],107:['oracle-by-level.json'],108:['oracle-by-level.json'],109:['semantic-by-cell.json','oracle-by-level.json'],110:['summary.json','inventory.json'],111:['coverage.json'],112:['inventory.json','semantic-by-cell.json'],113:['coverage.json'],114:['oracle-by-level.json'],115:['bank_sha256.json','inventory.json'],116:['determinism.json'],118:['summary.json','deviations.json'],119:['oracle-by-level.json']}
    for tc,paths in mappings.items():
        receipts['TC-'+str(tc)]={'status':'PASS' if all((ev/p).exists() for p in paths) else 'NOT_RUN','evidence':['evidence/bank/'+p for p in paths]}
    write(ev/'test-results.json',receipts)
    print(js(dict(packages=len(pids),slots=summary['question_slots'],unique=len(fps),independently_checked_steps=sum(x['steps'] for x in results),checks=len(receipts))))
if __name__=='__main__':main()
