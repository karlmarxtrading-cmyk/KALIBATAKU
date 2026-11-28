"""RETIRED in 1.3.0. compare-bank.py asserted that the bank equals 1.1.0. Bank content 1.2.0 deliberately changes wording (MATH-002); lineage is checked by tests/bank/domain_prose.py.

The original 1.2.0 source is kept below for reference and is never executed."""
import sys
print('compare-bank.py asserted that the bank equals 1.1.0. Bank content 1.2.0 deliberately changes wording (MATH-002); lineage is checked by tests/bank/domain_prose.py.', file=sys.stderr)
sys.exit(2)

# ---- original 1.2.0 source (inert) ----
# """Compare every bank file to the original 1.1.0 distribution, without extracting it."""
# import hashlib,json,sys,zipfile
# from datetime import datetime,timezone
# from pathlib import Path
# root=Path(__file__).resolve().parents[2]
# source=Path(sys.argv[1]);sha=hashlib.sha256(source.read_bytes()).hexdigest()
# assert sha=='23e5d826e00bf34c9f8b31e0acf938a133711c1d243623f2fc38274cef21841f'
# with zipfile.ZipFile(source) as z:
#     before={n for n in z.namelist() if n.startswith('dist/bank/') and not n.endswith('/')}
#     after={str(p.relative_to(root)) for p in (root/'dist/bank').rglob('*') if p.is_file()}
#     assert before==after
#     tree=hashlib.sha256()
#     for n in sorted(before,key=Path):
#         content=z.read(n);assert content==(root/n).read_bytes(),n
#         tree.update((hashlib.sha256(content).hexdigest()+'  '+n.removeprefix('dist/bank/')+'\n').encode())
# res={'status':'PASS','utc':datetime.now(timezone.utc).isoformat(),'baseline_file':source.name,'baseline_sha256':sha,'public_bank_files_identical':len(before),'public_bank_tree_sha256':tree.hexdigest(),'added':0,'removed':0,'modified':0}
# (root/'evidence/v12/original-bank.json').write_text(json.dumps(res,indent=2));print(res)
