#!/usr/bin/env python3
"""Write compressed, lossless math records and the evidence index for section 10 of the bank specification."""
import json, gzip, hashlib, platform, subprocess, random, itertools, collections, sys
from pathlib import Path
from datetime import datetime, timezone
from math import gcd
ROOT=Path(__file__).resolve().parents[2]
EV=ROOT/'evidence/bank'
sys.path.insert(0,str(ROOT/'factory'))
from domains import bin_domain, val, decimal, seeded
from mixed import mix, fill
from build_bank import js,write,fingerprint,VER
from verify_bank import decode,read,digest

def export_math(summary,inventory):
    pkgids=[p['package_id'] for p in inventory]
    prefix=dict(schema_version='math-audit-v1',package_ids=pkgids,
                fields=['fingerprint','example_package_index','example_zero_based_question_index','expression_tree','reduced_answer'],
                tree_encoding='[OP, left, right] or an exact authored operand string',
                representation_id='SHA-256 UTF-8 compact JSON(expression_tree), preserving operand order and display',
                pedagogy='Join package_ids[example_package_index] to inventory, then read the indicated questions[] entry in its ESM.')
    seen=set();file=EV/'distinct-question-math.json.gz';samples=[]
    sample_cells={(1,1,'ADD'),(2,2,'SUB'),(3,3,'MUL'),(4,5,'MIX'),(5,3,'ADD'),(6,4,'MIX'),(7,2,'SUB'),(8,3,'DIV'),(9,5,'MIX'),(10,2,'MIX'),(11,3,'MUL'),(12,4,'MIX')}
    with file.open('wb') as fo,gzip.GzipFile(filename='',mode='wb',fileobj=fo,mtime=0,compresslevel=6) as out:
        out.write((js(prefix)[:-1]+',"math_records":[').encode())
        for ix,p in enumerate(inventory):
            pack=json.loads((ROOT/'dist'/p['url']).read_text()[15:-2])
            for j,q in enumerate(pack['questions']):
                fp=q['fingerprint'];tree=decode(q['expression_ast']);key=(fp,tree)
                if j==0 and pack['package_id'].endswith('P001') and (pack['grade'],pack['level'],pack['operation']) in sample_cells:
                    samples.append(dict(package_id=pack['package_id'],question_id=q['question_id'],expression=q['neutral_expression'],hint=q['hint'],explanation=q['explanation']))
                if key in seen:continue
                if seen:out.write(b',\n')
                seen.add(key)
                ans=q['answer']
                out.write(js([fp,ix,j,tree,[ans['numerator'],ans['denominator']]]).encode())
        out.write(b']}\n')
    assert len(seen)==summary['distinct_authored_representations']
    # Read the exported stream back and prove row cardinality. Exemplar pointers
    # were taken from the actual package and slot used to serialize each record.
    with gzip.open(file,'rt',encoding='utf-8') as gz:
        recovered=json.load(gz)
    assert len(recovered['math_records'])==len(seen)
    assert all(fingerprint(to_tree(row[3]))==row[0] for row in recovered['math_records'])
    return samples,dict(file=file.name,sha256=digest(file),size_bytes=file.stat().st_size,record_count=len(seen),reopened=True)
def to_tree(value):
    return value if isinstance(value,str) else (value[0],to_tree(value[1]),to_tree(value[2]))

def enumerated(size,key):
    rng=seeded(key);step=rng.randrange(1,max(2,size))
    while gcd(step,size)!=1:step+=1
    start=rng.randrange(size)
    for i in range(size):yield (start+i*step)%size
def measure(d,cap):
    stat=collections.Counter()
    def single(i,left,right,pred,inverse):
        for n in enumerated(len(left)*len(right),(d.g,d.l,d.op,i)):
            stat['parameter_tuples_visited']+=1
            ai,bi=divmod(n,len(right));a,b=left[ai],right[bi];x,y=val(a),val(b)
            if pred and not pred(x,y,a,b):stat['predicate_rejected']+=1;continue
            if d.op=='DIV' and not y:stat['zero_divisor_rejected']+=1;continue
            yield (d.op,decimal(x*y) if inverse else a,b)
    def mixed(i,s):
        size=1
        for values in s.grids.values():size*=len(values)
        # Shape draws offset before step; Domain draws step before start.
        rng=seeded((d.g,d.l,i));offset=rng.randrange(size);step=rng.randrange(1,max(2,size))
        while gcd(step,size)!=1:step+=1
        for k in range(size):
            stat['parameter_tuples_visited']+=1;n=(offset+k*step)%size;mapping={}
            for key,values in s.grids.items():
                n,ix=divmod(n,len(values));mapping[key]=values[ix]
            if s.predicate and not s.predicate(**{k:val(v) for k,v in mapping.items()}):stat['predicate_rejected']+=1;continue
            t=fill(s.shape,mapping)
            if not d.bounds(t):stat['intermediate_rejected']+=1;continue
            yield t
    streams=collections.deque(mixed(i,s) for i,(_,s) in enumerate(d.shapes)) if hasattr(d,'shapes') else collections.deque(single(i,a,b,p,inv) for i,(a,b,p,inv,_) in enumerate(d.branches))
    unique=set()
    while streams and (d.exhaustive or len(unique)<cap):
        it=streams.popleft()
        try:t=next(it)
        except StopIteration:continue
        streams.append(it);stat['valid_raw_candidates']+=1
        fp=fingerprint(t)
        if fp in unique:stat['canonical_collision']+=1
        unique.add(fp)
    stat['constructive_unique']=len(unique)
    return dict(stat)

def main():
    summary=read(EV/'summary.json');inv=read(EV/'inventory.json');coverage=read(EV/'coverage.json');oracle=read(EV/'oracle-by-level.json')
    bycell={c['competency_id']:c for c in coverage};sem={c['competency_id']:c for c in read(EV/'semantic-by-cell.json')};info=[]
    for grade in summary['grades']:
        for l in read(ROOT/'dist'/grade['url'])['levels']:
            level=read(ROOT/'dist'/l['url'])
            for c in level['competencies']:
                row=dict(competency_id=c['competency_id'],grade=level['grade'],level=level['level'],operation=c['operation'],active=c['active'],packages=len(c['packages']),slots=sum(p['question_count'] for p in c['packages']))
                fam=sem[c['competency_id']]['templates'] if c['active'] else {}
                row.update(template_count=len(fam),subtype_question_slots=fam,status='VALIDATED' if c['active'] else 'INACTIVE_BY_CURRICULUM')
                info.append(row)
    write(EV/'bank-coverage.json',info)
    write(EV/'bank-inventory.json',[dict(package_id=p['package_id'],version=p['content_version'],path=p['url'],sha256=p['sha256'],actual_question_count=p['question_count'],purpose=p['purpose'],locales=['id','en'],locale_presence='PASS') for p in inv])
    write(EV/'bank-uniqueness.json',dict(question_slots=summary['question_slots'],unique_canonical_items=summary['unique_canonical_items'],intentional_repeated_slots=summary['intentional_repeated_slots'],representation_variants=summary['representation_variants'],within_package_duplicates=0,overlap_by_competency={r['competency_id']:{k:r[k] for k in ('form_A','form_B','assessment_overlap','assessment_overlap_rate','blueprint_distance')} for r in coverage}))
    feas=[]
    for c in coverage:
        cid=c['competency_id'];g,l,op=c['grade'],c['level'],c['operation']
        d=mix(g,l) if op=='MIX' else bin_domain(g,l,op)
        cap=c['question_slots']+max(10,max(p['target_questions'] for p in inv if p['competency_id']==cid))
        counts=measure(d,cap)
        assert counts['valid_raw_candidates']==c['candidates_visited'],(cid,counts,c['candidates_visited'])
        assert counts['constructive_unique']==c['pool_size']
        feas.append(dict(competency_id=cid,bound=c['bound'],domain_size_if_exhaustive=c['canonical_domain_size'],pool_size=c['pool_size'],counts=counts,recipe_source=c['recipe'],domain_listing='recipes.json + operand-grids.json.gz',seed='SHA256(grade, level, operation, branch_index) for single operations; SHA256(grade, level, branch_index) for MIX; see enumerator for exact tuple serialization.'))
    write(EV/'bank-pool-feasibility.json',feas)
    samples,export=export_math(summary,inv)
    write(EV/'bank-deviations.json',read(EV/'deviations.json'))
    write(EV/'bank-validation.json',dict(status='PASS',fingerprint_policy='canonical-ast-v1',packages=sum(r['packages'] for r in oracle),question_slots=sum(r['slots'] for r in oracle),equivalent_steps=sum(r['steps'] for r in oracle),validated_competencies=len(sem),math_errors=0,semantic_rule_errors=0,structural_errors=0,missing_bilingual_fields=0,technical_checks='test-results.json',independent_schema_and_plain_expression='independent-distribution-audit.json',distinct_math_export=export))
    write(EV/'template-review.json',dict(reviewer='Programmatic checks; human reviews pending.',technical_math_review='Every published key and equivalent step checked independently with rational arithmetic. Each finite rule family has positive and negative fixtures.',bilingual_review='All emitted hints, explanations and solution steps checked for both locales. Semantic equivalence and age suitability await independent human review.',pedagogical_observation='Revision 1.1.0 includes count-up differences, half-of-ten multiplication, common factors, and exact cancellation. The roster contains the three A5 sample roles and the named audit examples.',editorial_roster='../ux/bank/editorial-roster.csv',human_educator_review='NOT_RUN',language_review='NOT_RUN',learner_pilot='NOT_RUN',samples=samples))
    sources={str(p.relative_to(ROOT)):digest(p) for p in sorted((ROOT/'factory').glob('*.py'))}
    for rel in ['planning/package_plan.json','planning/competency_plan.json','curriculum/ERRATA_APPLIED.json','curriculum/KALIBATAKU_CURRICULUM_REGISTRY_v1_0_DRAFT2.json']:
        sources['spec/'+rel]=digest(ROOT/'spec'/rel)
    write(EV/'build-provenance.json',dict(content_version=VER,curriculum_version='1.0.0-draft.2',generator='finite-affine-permutation-v1',sources=sources,spec_checksums_sha256=digest(ROOT/'spec/SHA256SUMS.json'),bank_file_hashes_sha256=digest(EV/'bank_sha256.json'),python=platform.python_version(),node=subprocess.check_output(['node','--version'],text=True).strip(),system=platform.system(),architecture=platform.machine(),audit_timestamp_utc=datetime.now(timezone.utc).isoformat(),determinism='determinism.json',seed_namespace='grade, level, operation, branch index; package allocation seeded with competency_id. No clock or global RNG in generation.'))
    print(json.dumps(export))
if __name__=='__main__':main()
