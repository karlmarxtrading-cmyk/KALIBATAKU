"""RETIRED in 1.3.0. vendor-mathjax.py restored MathJax 4.1.3 for 1.2.0. Release 1.3.0 uses the native renderer (src/math/typeset.mjs); MathJax is not shipped."""
import sys
print('vendor-mathjax.py restored MathJax 4.1.3 for 1.2.0. Release 1.3.0 uses the native renderer (src/math/typeset.mjs); MathJax is not shipped.', file=sys.stderr)
sys.exit(2)

# ---- original 1.2.0 source (inert) ----
# """Restore the pinned MathJax runtime from official npm tarballs with SHA-512 verification."""
# import hashlib, json, sys, tarfile
# from pathlib import Path
# ROOT=Path(__file__).resolve().parents[1]
# vendor=ROOT/'src/vendor/mathjax-4.1.3'
# for line in (ROOT/'evidence/v12/vendor-packages.txt').read_text().splitlines():
#     filename,expected=line.split(' sha512:')
#     archive=Path(sys.argv[1])/filename
#     assert hashlib.file_digest(archive.open('rb'),'sha512').hexdigest()==expected
#     with tarfile.open(archive) as bundle:
#         if filename=='mathjax-4.1.3.tgz':
#             include=['mml-svg.js','LICENSE','package.json','sre/speech-worker.js',*[f'sre/mathmaps/{lang}.json' for lang in ('base','en','nemeth')]]
#         else:
#             include=['package.json']
#         for path in include:
#             target=vendor/(('newcm/' if filename.startswith('mathjax-mathjax') else '')+('package-info.json' if path=='package.json' else path))
#             target.parent.mkdir(parents=True,exist_ok=True)
#             target.write_bytes(bundle.extractfile('package/'+path).read())
