"""RETIRED in 1.3.0. bind-evidence.py (1.2.0) is superseded by tools/qa_gate.py, which binds receipts from a fresh run and re-verifies them (audit TECH-02).

The original 1.2.0 source is kept below for reference and is never executed."""
import sys
print('bind-evidence.py (1.2.0) is superseded by tools/qa_gate.py, which binds receipts from a fresh run and re-verifies them (audit TECH-02).', file=sys.stderr)
sys.exit(2)

# ---- original 1.2.0 source (inert) ----
# """Bind final HTTP and browser receipts to the delivered runtime, with scope and actual failures."""
# import json
# from project import ROOT,DIST,digest,tree_hash
# def main():
#     stamp=json.loads((DIST/'offline-assets.json').read_bytes())['release'];tree=tree_hash(DIST)
#     ev=ROOT/'evidence';sources=list((ev/'acceptance').glob('browser-*.json'))+list((ev/'ux/acceptance').glob('browser-*.json'))+list((ev/'v12').glob('browser-*.json'))+list((ev/'v12/cross').rglob('browser-*.json'))
#     seen={}
#     for path in sorted(sources):
#         d=json.loads(path.read_bytes());data=d.get('runtime') or {}
#         ref=d.get('build') or data.get('offline_release') or data.get('release') or d.get('release')
#         assert ref==stamp,(path,ref,stamp)
#         if 'runtime_after' in d:assert data==d['runtime_after'],path
#         if 'release_after' in d:assert d['release_after']==stamp,path
#         rows=d.get('checks',[])+d.get('results',[])
#         failures=[r.get('id',r.get('name')) for r in rows if r['status']!='PASS']
#         assert not d.get('errors') and not failures,(path,failures,d.get('errors'))
#         seen[str(path.relative_to(ROOT))]={'sha256':digest(path),'checks':len(rows),'failures':failures,'build':ref}
#     for filename in ['evidence/v12/roles-reflow.json','evidence/v12/print-contrast.json']:
#         d=json.loads((ROOT/filename).read_bytes())
#         assert d['build']==stamp and d['status']=='PASS',filename
#     assert json.loads((ROOT/'evidence/ux/acceptance/keyboard.json').read_bytes())['offline_release']==stamp
#     assert len(seen)>=24
#     summary={'status':'PASS','offline_release':stamp,'dist_tree_sha256':tree,'observed_assertions':sum(x['checks'] for x in seen.values()),'receipts':seen}
#     (ev/'acceptance/final-build-binding.json').write_text(json.dumps(summary,indent=2))
#     print(stamp,len(seen),summary['observed_assertions'])
# if __name__=='__main__':main()
