"""TECH-02 permanent negative tests for the production QA gate and assessor.

Runs the real gate primitives (tools/qa_core.py) and assessor (tools/assess.py) against
an isolated sandbox. Each fault must be rejected; the all-pass path with fresh receipts
must be accepted. With --browser the original reproduction is repeated on the real
browser runner: one injected wrong assertion in tests/v12/browser.py must make the
process exit nonzero (in 1.2.0 it exited 0).
Writes a kalibataku-qa-receipt/1 to evidence/v13/receipts/qa-fault-injection.json.
"""
import argparse, json, os, shutil, subprocess, sys, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import qa_core, assess

checks = []


def check(cid, expected, fn):
    try:
        actual = fn()
        checks.append({'id': cid, 'status': 'PASS', 'expected': expected, 'actual': actual})
    except Exception as e:
        checks.append({'id': cid, 'status': 'FAIL', 'expected': expected, 'actual': repr(e)[:1500]})
    print(cid, checks[-1]['status'], flush=True)


SUITE_SRC = r'''
import json, os, sys
mode = sys.argv[1]
rel = json.load(open("dist/offline-assets.json"))["release"]
rows = [{"id": "A1", "status": "PASS"}, {"id": "OKE-REVISE", "status": "PASS"}]
code = 0
if mode == "fail-row": rows[1]["status"] = "FAIL"
if mode == "empty": rows = []
if mode == "stale": rel = "0000000000000000"
if mode == "exit1": code = 1
if mode == "blocked": rows[0]["status"] = "BLOCKED_ENV"
if mode == "error": pass
out = os.path.join(os.environ["KALIBATAKU_RECEIPTS"], mode + ".json")
os.makedirs(os.path.dirname(out), exist_ok=True)
body = {"schema": "kalibataku-qa-receipt/1", "suite": mode, "build": {"offline_release": rel}, "assertions": len(rows),
        "status": "FAIL" if any(r["status"] == "FAIL" for r in rows) or not rows else "PASS", "errors": [], "checks": rows}
if mode == "error": body["errors"] = ["unexpected exception"]; body["status"] = "FAIL"
if mode == "blocked": body["status"] = "BLOCKED_ENV"; code = 3
if mode == "lie": rows[1]["status"] = "FAIL"; body["status"] = "PASS"; body["assertions"] = 2
if mode != "missing": open(out, "w").write(json.dumps(body))
print("TC-1 PASS" if mode != "nolines" else "nothing")
sys.exit(code)
'''


def sandbox():
    d = Path(tempfile.mkdtemp(prefix='kalibataku-qa-fault-'))
    (d / 'dist').mkdir()
    (d / 'dist/offline-assets.json').write_text(json.dumps({'release': 'abcdefabcdef0123', 'assets': []}))
    (d / 'dist/build-info.json').write_text(json.dumps({'app_version': '9.9.9', 'bank_version': '9.9.9'}))
    (d / 'dist/index.html').write_text('<!doctype html>')
    (d / 'suite.py').write_text(SUITE_SRC)
    return d


def spec(mode, **kw):
    return {'id': mode, 'command': ['{python}', 'suite.py', mode], 'receipts': [f'evidence/v13/receipts/{mode}.json'], 'min_assertions': 2, **kw}


def run(modes, **kw):
    d = sandbox()
    reg = {'suites': [spec(m, **kw.get(m, {})) for m in modes]}
    regp = d / 'suites.json'; regp.write_text(json.dumps(reg))
    out = d / 'qa'
    ident = qa_core.identity(d); rt = qa_core.runtime()
    results = [qa_core.run_suite(s, d, out, ident) for s in reg['suites']]
    binding = qa_core.write_binding(out, reg, results, ident, rt, qa_core.sha256_file(regp))
    return d, regp, out, binding, results


def expect_reject(problems, needle):
    assert problems, 'binding accepted although it should be rejected'
    assert any(needle in p for p in problems), problems
    return problems[:3]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--browser', action='store_true'); a = ap.parse_args()
    started = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    def all_pass():
        d, regp, out, b, r = run(['ok'])
        assert b['status'] == 'PASS' and r[0]['assertions'] == 2, (b['status'], r)
        probs = qa_core.verify_binding(d, out, regp)
        assert probs == [], probs
        return {'status': b['status'], 'assertions': b['assertions']}
    check('ALL-PASS-ACCEPTED', 'Fresh receipts with only PASS rows are accepted and re-verify', all_pass)

    def single(mode, needle, **kw):
        def go():
            d, regp, out, b, r = run([mode], **({mode: kw} if kw else {}))
            assert r[0]['status'] == 'FAIL' and b['status'] == 'FAIL', r[0]
            assert any(needle in p for p in r[0]['problems']), r[0]['problems']
            probs = qa_core.verify_binding(d, out, regp)
            assert probs, 'verify accepted a failed binding'
            return {'suite_status': r[0]['status'], 'problems': r[0]['problems'][:3]}
        return go
    check('FAILED-ASSERTION', 'A receipt with one FAIL row fails the suite even when the process exits 0', single('fail-row', 'failed assertions'))
    check('EMPTY-RECEIPT', 'A receipt with zero assertions fails', single('empty', 'empty receipt'))
    check('MISSING-RECEIPT', 'A declared receipt that was never written fails', single('missing', 'missing receipt'))
    check('NONZERO-EXIT', 'Exit code 1 fails although rows say PASS', single('exit1', 'exit code 1'))
    check('STALE-RECEIPT-BUILD', 'A receipt for another build fails', single('stale', 'not the certified build'))
    check('RECORDED-ERROR', 'Unexpected errors in a receipt fail it', single('error', 'errors'))
    check('SELF-DECLARED-PASS', 'A receipt that claims PASS over a FAIL row is rejected', single('lie', 'failed assertions'))
    check('BLOCKED-NOT-ALLOWED', 'BLOCKED_ENV in a suite that may not be blocked is FAIL', single('blocked', 'not permitted'))
    check('BLOCKED-EXIT-NOT-ALLOWED', 'Exit code 3 is a failure for a suite that may not be blocked', single('blocked', 'exit code 3'))

    def blocked_allowed():
        d, regp, out, b, r = run(['blocked'], blocked={'allow_blocked': True})
        assert r[0]['status'] == 'BLOCKED_ENV' and b['status'] == 'BLOCKED_ENV', (r[0], b['status'])
        assert qa_core.verify_binding(d, out, regp) == []
        return {'suite_status': r[0]['status'], 'overall': b['status']}
    check('BLOCKED-IS-NOT-PASS', 'Allowed environment block stays BLOCKED_ENV and never becomes PASS', blocked_allowed)

    def no_lines():
        d = sandbox(); reg = {'suites': [{'id': 'legacy', 'command': ['{python}', 'suite.py', 'nolines'], 'count_pattern': r'^TC-\d+ PASS', 'min_assertions': 1}]}
        (d / 'suites.json').write_text(json.dumps(reg))
        r = qa_core.run_suite(reg['suites'][0], d, d / 'qa', qa_core.identity(d))
        assert r['status'] == 'FAIL' and any('no assertion lines' in p for p in r['problems']), r
        return r['problems']
    check('LEGACY-ZERO-LINES', 'A legacy suite whose output has no assertion lines fails', no_lines)

    def modified_receipt():
        d, regp, out, b, r = run(['ok'])
        f = out / r[0]['receipts'][0]['file']
        data = json.loads(f.read_text()); data['checks'][1]['status'] = 'FAIL'; f.write_text(json.dumps(data))
        return expect_reject(qa_core.verify_binding(d, out, regp), 'missing or modified')
    check('MODIFIED-RECEIPT', 'Editing a bound receipt (OKE-REVISE → FAIL) rejects the binding', modified_receipt)

    def rehashed_fail():
        # The 1.2.0 assessor assigned FM-001 PASS from a FAIL receipt. Even when an attacker
        # re-hashes the edited receipt into the binding, re-validation still rejects it.
        d, regp, out, b, r = run(['ok'])
        f = out / r[0]['receipts'][0]['file']
        data = json.loads(f.read_text()); data['checks'][1]['status'] = 'FAIL'; f.write_text(json.dumps(data))
        bp = out / 'binding.json'; bj = json.loads(bp.read_text()); bj['suites'][0]['receipts'][0]['sha256'] = qa_core.sha256_file(f); bp.write_text(json.dumps(bj))
        probs = qa_core.verify_binding(d, out, regp)
        expect_reject(probs, 'failed assertions')
        crit = [{'id': 'FM-001', 'evidence': [{'suite': 'ok', 'rows': ['OKE-REVISE']}]}]
        state = assess.evaluate(crit, bj, out)['FM-001'][0]
        assert state != 'PASS', state
        return {'verify': probs[:2], 'FM-001': state}
    check('ASSESSOR-FM001-FROM-FAIL', 'Assessor cannot give FM-001 PASS from an OKE-REVISE FAIL receipt', rehashed_fail)

    def stale_dist():
        d, regp, out, b, r = run(['ok'])
        (d / 'dist/index.html').write_text('<!doctype html><p>changed')
        return expect_reject(qa_core.verify_binding(d, out, regp), 'stale binding')
    check('STALE-BINDING-DIST', 'A binding for an older distribution is rejected', stale_dist)

    def other_runtime():
        d, regp, out, b, r = run(['ok'])
        rt = {**qa_core.runtime(), 'node': 'v0.0.1'}
        return expect_reject(qa_core.verify_binding(d, out, regp, rt=rt), 'runtime differs')
    check('DIFFERENT-RUNTIME', 'A binding from a different Node runtime is rejected', other_runtime)

    def registry_changed():
        d, regp, out, b, r = run(['ok'])
        reg = json.loads(regp.read_text()); reg['suites'][0]['min_assertions'] = 0; regp.write_text(json.dumps(reg))
        return expect_reject(qa_core.verify_binding(d, out, regp), 'different suite registry')
    check('REGISTRY-CHANGED', 'Lowering thresholds after the run invalidates the binding', registry_changed)

    def skipped_suite():
        d, regp, out, b, r = run(['ok'])
        reg = json.loads(regp.read_text()); reg['suites'].append(spec('extra')); regp.write_text(json.dumps(reg))
        bp = out / 'binding.json'; bj = json.loads(bp.read_text()); bj['registry_sha256'] = qa_core.sha256_file(regp); bp.write_text(json.dumps(bj))
        return expect_reject(qa_core.verify_binding(d, out, regp), 'required suites missing')
    check('SKIPPED-SUITE', 'A required suite that never ran rejects the binding', skipped_suite)

    def external_never_pass():
        crit = [{'id': 'AC-058', 'external': {'state': 'BLOCKED', 'reason': 'listener'}, 'evidence': [{'suite': 'ok'}]}]
        st = assess.evaluate(crit, {'suites': [{'id': 'ok', 'status': 'PASS', 'receipts': [], 'log': 'x'}]}, Path('.'))['AC-058'][0]
        assert st == 'BLOCKED', st
        return st
    check('EXTERNAL-GATE-NOT-AUTOPASS', 'Criteria needing people or devices are never PASS from automation', external_never_pass)

    if a.browser:
        def browser_negative():
            env = {**os.environ, 'KALIBATAKU_QA_INJECT_FAIL': 'SPEED', 'KALIBATAKU_V12_OUT': tempfile.mkdtemp(prefix='kalibataku-v12-neg-')}
            p = subprocess.run([sys.executable, 'tests/v12/browser.py', 'chromium'], cwd=ROOT, env=env, capture_output=True, text=True, timeout=900)
            assert p.returncode != 0, 'v12 browser runner exited 0 with an injected failed assertion'
            data = json.loads((Path(env['KALIBATAKU_V12_OUT']) / 'browser-chromium.json').read_text())
            failed = [r['id'] for r in data['checks'] if r['status'] != 'PASS']
            assert failed == ['SPEED'], failed
            return {'exit_code': p.returncode, 'failed': failed}
        check('V12-RUNNER-EXIT', 'tests/v12/browser.py exits nonzero when one assertion fails (TECH-02 reproduction)', browser_negative)

    rel = json.loads((ROOT / 'dist/offline-assets.json').read_bytes())['release']
    failed = [c['id'] for c in checks if c['status'] != 'PASS']
    body = {'schema': 'kalibataku-qa-receipt/1', 'suite': 'TECH-02-fault-injection', 'build': {'offline_release': rel},
            'runtime': {'python': sys.version.split()[0]}, 'started': started, 'finished': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'assertions': len(checks), 'status': 'FAIL' if failed or not checks else 'PASS', 'errors': [], 'checks': checks}
    out = Path(os.environ.get('KALIBATAKU_RECEIPTS', ROOT / 'evidence/v13/receipts')) / 'qa-fault-injection.json'
    out.parent.mkdir(parents=True, exist_ok=True); out.write_text(json.dumps(body, indent=2, ensure_ascii=False) + '\n')
    print('TECH-02 fault injection:', body['status'], len(checks), 'assertions', failed)
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
