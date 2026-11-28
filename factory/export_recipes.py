#!/usr/bin/env python3
"""Export the executable factory's finite grids and their provenance for independent inspection."""
from pathlib import Path
from fractions import Fraction as F
import gzip,json,hashlib
from domains import bin_domain,val
from mixed import mix
from build_bank import js,write
ROOT=Path(__file__).resolve().parent.parent
def main():
    reg=json.loads(next((ROOT/'spec/curriculum').glob('*REGISTRY*DRAFT2.json')).read_text())
    coverage={r['competency_id']:r for r in json.loads((ROOT/'evidence/bank/coverage.json').read_text())}
    grids={};rows=[]
    def grid(values):
        key=hashlib.sha256(js(values).encode()).hexdigest()
        if key not in grids:
            vs=list(map(val,values))
            grids[key]=dict(size=len(values),min=str(min(vs)),max=str(max(vs)),display_kinds=sorted({'fraction' if '/' in t else 'decimal' if '.' in t else 'integer' for t in values}),values=values)
        return key
    for level in reg['levels']:
        g,l=level['grade'],level['level']
        for c in level['competencies']:
            if not c['active']:continue
            cid=c['competency_id'];op=c['operation'];branches=[]
            d=mix(g,l) if op=='MIX' else bin_domain(g,l,op)
            if op=='MIX':
                for name,s in d.shapes:
                    branches.append(dict(family=name,shape=s.shape,slot_grids={k:grid(v) for k,v in s.grids.items()},predicate=bool(s.predicate),max_abs_value=d.limit,max_denominator=d.den,max_decimal_places=d.dp))
            else:
                for a,b,p,inv,name in d.branches:
                    branches.append(dict(family=name,shape=[op,'left','right'],left_grid_role='quotient' if inv else 'left_operand',left_grid=grid(a),right_grid=grid(b),predicate=bool(p),derive_left='quotient * right' if inv else None))
            entry=coverage[cid]
            rows.append(dict(competency_id=cid,version='1.0.0',authority=c['rule_spec'],grade=g,level=l,operation=op,branches=branches,validator=entry['recipe'],prerequisites=entry['prerequisites'],embedded_skills=entry['embedded_skills'],source_strategy_candidates=level['strategy_candidates'],generation='finite-affine-permutation-v1',fingerprint_policy='canonical-ast-v1',limit_kind=entry['bound'],pool_size=entry['pool_size']))
    ev=ROOT/'evidence/bank'
    write(ev/'recipes.json',rows)
    with (ev/'operand-grids.json.gz').open('wb') as fo:
        with gzip.GzipFile(filename='',mode='wb',fileobj=fo,mtime=0) as gz:
            gz.write(js(grids).encode())
    print(len(rows),'recipes;',len(grids),'reusable grids')
if __name__=='__main__':main()
