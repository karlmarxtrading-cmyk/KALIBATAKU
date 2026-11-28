"""Derive acceptance registers for KALIBATAKU from a verified QA binding (TECH-02).

Nothing is PASS because a file exists. A criterion is PASS only when:
- the binding in evidence/v14/qa re-verifies (hashes, registry, build, runtime), and
- every suite it cites has status PASS, and
- every assertion row it cites exists in those receipts with status PASS.
Criteria that need people, physical devices, assistive-technology listeners, field
traffic or a public host carry a fixed non-PASS state with the reason (`external`).
"""
import argparse, csv, io, json, sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import qa_core

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / 'evidence/v14/qa'
REGISTRY = ROOT / 'tests/qa/suites.json'
CRITERIA = ROOT / 'tests/qa/criteria.json'


def load_receipt_rows(out, suite):
    rows = {}
    for rc in suite.get('receipts', []):
        data = json.loads((Path(out) / rc['file']).read_bytes())
        for r in qa_core.rows_of(data):
            key = str(r.get('id', r.get('name')))
            # Several receipts may hold the same id; any FAIL wins.
            if rows.get(key) != 'FAIL':
                rows[key] = r.get('status')
    return rows


def evaluate(criteria, binding, out):
    """Return {criterion_id: (state, evidence, observation, remaining)}."""
    suites = {s['id']: s for s in binding['suites']}
    cache = {}
    result = {}
    for c in criteria:
        cid = c['id']
        if c.get('external'):
            result[cid] = (c['external']['state'], [], c.get('observation', ''), c['external']['reason'])
            continue
        if not c.get('evidence'):
            result[cid] = ('NOT_RUN', [], 'No automated evidence is mapped to this criterion.', 'Evidence mapping missing.')
            continue
        states, refs, notes = [], [], []
        for ev in c['evidence']:
            s = suites.get(ev['suite'])
            if not s:
                states.append('FAIL'); notes.append(f"suite {ev['suite']} absent from binding"); continue
            refs += [x['file'] for x in s.get('receipts', [])] + [s['log']]
            # A suite blocked by its environment still proves the rows it did run; a criterion
            # citing specific rows is judged on those rows, otherwise the block applies.
            if s['status'] == 'FAIL' or (s['status'] == 'BLOCKED_ENV' and not ev.get('rows')) or s['status'] not in ('PASS', 'BLOCKED_ENV'):
                states.append('BLOCKED' if s['status'] == 'BLOCKED_ENV' else 'FAIL')
                notes.append(f"{ev['suite']}: {s['status']}"); continue
            if ev.get('rows'):
                rows = cache.setdefault(ev['suite'], load_receipt_rows(out, s))
                for rid in ev['rows']:
                    st = rows.get(rid)
                    if st != 'PASS':
                        states.append('BLOCKED' if st == 'BLOCKED_ENV' else 'FAIL')
                        notes.append(f"{ev['suite']}/{rid}: {st or 'missing'}")
            states.append('PASS')
        state = 'FAIL' if 'FAIL' in states else 'BLOCKED' if 'BLOCKED' in states else 'PASS'
        remaining = '; '.join(notes) if state != 'PASS' else c.get('remaining', '')
        if state == 'PASS' and c.get('partial'):
            state, remaining = c['partial']['state'], c['partial']['reason']
        result[cid] = (state, list(dict.fromkeys(refs)), c.get('observation', ''), remaining)
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--qa', type=Path, default=QA)
    ap.add_argument('--write', action='store_true', help='write registers and release status')
    ap.add_argument('--no-runtime-check', action='store_true', help='skip comparing the binding runtime with this machine')
    a = ap.parse_args()
    problems = qa_core.verify_binding(ROOT, a.qa, REGISTRY, check_runtime=not a.no_runtime_check)
    if problems:
        print('BINDING REJECTED', *problems[:40], sep='\n  ', file=sys.stderr)
        return 1
    binding = json.loads((a.qa / 'binding.json').read_bytes())
    crit = json.loads(CRITERIA.read_bytes())
    states = evaluate(crit['criteria'], binding, a.qa)
    print(json.dumps(Counter(s for s, *_ in states.values()), sort_keys=True))
    if a.write:
        import release_registers
        summary = release_registers.write(ROOT, crit['criteria'], states, binding)
        print(json.dumps(summary, default=dict, ensure_ascii=False, indent=1))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
