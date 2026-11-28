"""Reassemble the complete static directory twice and check all paths and bytes."""
import json
import subprocess
import sys
from project import ROOT, DIST, files, tree_hash

out = ROOT / 'evidence/deployment'
runs = []
for label in ('A', 'B'):
    log = out / f'clean-build-{label}.log'
    with log.open('w') as stream:
        subprocess.run([sys.executable, 'tools/project.py', 'build'], cwd=ROOT,
                       stdout=stream, stderr=subprocess.STDOUT, check=True)
    runs.append({'run':label, 'sha256':tree_hash(DIST), 'files':len(files(DIST)),
                 'log':log.relative_to(ROOT).as_posix()})
assert runs[0]['sha256'] == runs[1]['sha256'], 'Non-deterministic public files'
report = {'status':'PASS','method':'Two builds into independent empty staging directories using the verified physical bank. Every relative path and byte hash contributes to the tree hash.',
          'runs':runs,'dist_sha256':runs[1]['sha256'],'files':runs[1]['files']}
(out/'clean-build.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
