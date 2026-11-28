"""Check acceptance policy against the original audit requirements."""
import csv
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
spec = json.loads((root / 'tests/qa/criteria-1.5.1.json').read_bytes())['criteria']
registry = {s['id'] for s in json.loads((root / 'tests/qa/suites.json').read_bytes())['suites']}
with (root / 'evidence/v15/audit-source/03_REVIEW_71_KRITERIA.csv').open(encoding='utf-8-sig') as f:
    original = list(csv.DictReader(f))
assert len(original) == len(spec) == 71
assert {r['id'] for r in original} == set(spec)
assert [r['id'] for r in original if r['fase'] != 'WAJIB'] == ['PERF-03']
assert spec['UX-09']['external']['state'] == 'BLOCKED'
assert 'ponsel fisik' in next(r['cara_uji'] for r in original if r['id']=='UX-09').lower() or 'fisik' in next(r['bukti_lulus']+' '+r['cara_uji'] for r in original if r['id']=='UX-09').lower()
assert not spec['UX-09'].get('evidence')
for criterion, rule in spec.items():
    if 'external' in rule:
        assert rule['external']['state'] in {'BLOCKED','NOT_RUN'} and rule['external']['reason']
    elif not rule.get('derived'):
        assert rule['evidence'] and all(e['suite'] in registry for e in rule['evidence'])
assert set(rule['suite'] for rule in spec['PROG-06']['evidence']) >= {'viewed-coverage', 'viewed-browser', 'viewed-exports'}
assert set(rule['suite'] for rule in spec['TEACH-02']['evidence']) >= {'time-offset-engine', 'time-offset-exports'}
assert 'external-receipts' in registry
print('PASS AC: 71 original criteria, scope, phases, evidence mapping and physical keyboard requirement')
