"""RETIRED in 1.3.0. dist-review.py checked the MathJax vendor files, which 1.3.0 no longer ships. The native renderer is checked by tools/build-glyphs.py --check and the QA gate."""
import sys
print('dist-review.py checked the MathJax vendor files, which 1.3.0 no longer ships. The native renderer is checked by tools/build-glyphs.py --check and the QA gate.', file=sys.stderr)
sys.exit(2)

# ---- original 1.2.0 source (inert) ----
# """Distribution, dependency and local-reference review for the release."""
# import json
# import re
# from pathlib import Path
# from project import ROOT, DIST, files, digest
# 
# def main():
#     paths=files(DIST)
#     errors=[]
#     upstream=json.loads((ROOT/'tools/mathjax-files.json').read_text())
#     vendor=DIST/'vendor/mathjax-4.1.3'
#     for name,sha in upstream.items():
#         if not (vendor/name).is_file() or digest(vendor/name)!=sha:errors.append([name,'vendor digest'])
#     reviewed=[]
#     local_imports=[]
#     source_files=[p for p in paths if p.suffix in ('.js','.mjs','.html','.css') and 'bank' not in p.relative_to(DIST).parts]
#     for p in source_files:
#         text=p.read_text()
#         pinned=p.is_relative_to(vendor) and upstream.get(p.relative_to(vendor).as_posix())==digest(p)
#         for rx,label in [(r'(?<![\w.])eval\s*\(', 'dynamic evaluation'),(r'new\s+Function\s*\(', 'Function constructor'),
#                          (r'-----BEGIN [A-Z ]*PRIVATE KEY-----','private key'),(r'(?:gh[pousr]_[A-Za-z0-9]{28,}|AKIA[A-Z0-9]{16})','credential pattern')]:
#             probe=text
#             if pinned and label=='Function constructor':
#                 fallback='if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}'
#                 if fallback in probe:
#                     probe=probe.replace(fallback,'');reviewed.append([p.relative_to(DIST).as_posix(),'Global-object fallback skipped when globalThis exists. CSP remains enforced.'])
#             if re.search(rx,probe):errors.append([str(p.relative_to(DIST)),label])
#         if p.suffix not in ('.js','.mjs'):continue
#         urls=re.findall(r"""(?:from\s*|import\s*(?:\(\s*)?|new URL\(\s*)['"](\.[^'"]+)['"]""",text)
#         for ref in urls:
#             ref=ref.split('?',1)[0].split('#',1)[0]
#             if not ref or ref.endswith('/'):continue
#             if pinned and p.name=='speech-worker.js' and ref in ('./require.mjs','./sre-lab.js'):
#                 reviewed.append([p.relative_to(DIST).as_posix(),ref,'Optional Node or laboratory speech configuration, disabled in this arithmetic UI.']);continue
#             q=(p.parent/ref).resolve()
#             if not q.is_relative_to(DIST) or not q.exists():errors.append([p.relative_to(DIST).as_posix(),ref])
#             local_imports.append([p.relative_to(DIST).as_posix(),ref])
#     largest=max(paths,key=lambda p:p.stat().st_size)
#     if len(paths)>20000 or largest.stat().st_size>25*1024**2:errors.append(['cloudflare','asset limit'])
#     size=sum(p.stat().st_size for p in paths)
#     result={'status':'FAIL' if errors else 'PASS','dist_files':len(paths),'uncompressed_bytes':size,'largest_file':largest.relative_to(DIST).as_posix(),
#             'largest_bytes':largest.stat().st_size,'local_static_reference_count':len(local_imports),
#             'files_scanned_for_static_source_patterns':len(source_files),'package_lock_external_dependencies':len(json.loads((ROOT/'package-lock.json').read_text())['packages'])-1,
#             'scope':'Literal import and local URL target resolution, limited source pattern scan, Pages per-file/asset-count bounds; not a penetration test.',
#             'verified_upstream_files':len(upstream),'upstream_review':reviewed,'errors':errors}
#     (ROOT/'evidence/deployment/asset-review.json').write_text(json.dumps(result,indent=2)+'\n')
#     print(json.dumps(result))
#     if errors:raise SystemExit(1)
# if __name__=='__main__':main()
