"""AUD160-02 regression. Adversarial inputs are inert JSON validator unit fixtures.

Each case uses a new subprocess output, the ordinary gate, binding writer, and
independent verifier. The positive control runs the actual cache-policy producer.
Only this script's observed test outcomes count towards the outer release gate.
"""
import copy
import json
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import qa_core as qa


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding='utf-8')


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    with tempfile.TemporaryDirectory(prefix='kalibataku-receipt-shape-') as tmp:
        work = Path(tmp)
        (work / 'dist').mkdir()
        for name in ('offline-assets.json', 'build-info.json'):
            shutil.copyfile(ROOT / 'dist' / name, work / 'dist' / name)
        ident = qa.identity(work)
        runtime = {'python': sys.version.split()[0]}
        release = ident['offline_release']
        row = {'id': 'case-1', 'status': 'PASS'}
        base = {'schema': qa.SCHEMA, 'suite': 'shape-fixture', 'build': {'offline_release': release},
                'assertions': 1, 'status': 'PASS', 'checks': [row]}
        source = 'evidence/v13/receipts/shape.json'
        script = work / 'write-fixture.py'
        script.write_text(
            "import json, sys\nfrom pathlib import Path\n"
            "payload = json.loads(Path('test-input.json').read_text())\n"
            "out = Path('evidence/v13/receipts/shape.json')\n"
            "out.parent.mkdir(parents=True, exist_ok=True)\n"
            "out.write_text(json.dumps(payload))\nsys.exit(int(sys.argv[1]))\n")
        spec = {'id': 'shape-fixture', 'command': ['{python}', script.name, '0'],
                'receipts': [source], 'min_assertions': 1}
        out = work / 'qa'
        registry = work / 'suites.json'

        def execute(candidate, body=None):
            if body is not None:
                dump(work / 'test-input.json', body)
            reg = {'suites': [candidate]}
            dump(registry, reg)
            result = qa.run_suite(candidate, work, out, ident)
            binding = qa.write_binding(out, reg, [result], ident, runtime, qa.sha256_file(registry))
            return result, binding

        def check(name, patch, expected='FAIL', count=None, candidate=spec):
            body = {**copy.deepcopy(base), **patch}
            raw, n, errors = qa.validate_receipt(body, candidate, ident, source=source)
            result, binding = execute(candidate, body)
            verified = qa.verify_binding(work, out, registry, rt=runtime)
            require(raw == expected and result['status'] == expected and binding['status'] == expected,
                    (name, raw, result, binding['status'], errors))
            require(bool(verified) == (expected == 'FAIL'), (name, verified))
            if count is not None:
                require(n == count and result['assertions'] == count, (name, n, result))
            print(f'PASS {name} · validator/runner/binding={expected} · evaluated={n}')

        check('audit-original', {'checks': ['not an assertion', None], 'assertions': 2}, count=0)
        for name, invalid in [('null-row', None), ('string-row', 'ok'), ('number-row', 7),
                              ('nested-array', [row]), ('missing-fields', {}), ('empty-id', {'id':'  ', 'status':'PASS'}),
                              ('wrong-id-type', {'id': 7, 'status':'PASS'}), ('missing-status', {'id':'ok'}),
                              ('unknown-status', {'id':'ok', 'status':'NOT_RUN'})]:
            check(name, {'checks': [invalid]}, count=0)
        check('duplicate-id', {'checks': [row, {**row, 'id': ' case-1 '}], 'assertions': 2}, count=1)
        check('empty-array', {'checks': [], 'assertions': 0}, count=0)
        check('wrong-container', {'checks': {'case-1': 'PASS'}}, count=0)
        check('count-mismatch', {'assertions': 7}, count=1)
        check('boolean-count', {'assertions': True}, count=1)
        check('aggregate-conflict', {'checks': [{**row, 'status': 'FAIL'}]}, count=1)
        check('blocked-as-pass', {'checks': [{**row, 'status':'BLOCKED_ENV'}]}, count=1)
        check('declared-blocked-rows-pass', {'status':'BLOCKED_ENV'}, count=1)
        check('unknown-schema', {'schema':'legacy', 'status':'BLOCKED_ENV'})
        check('wrong-build', {'build': {'offline_release':'wrong'}})
        check('conflicting-build', {'runtime':{'offline_release':'wrong'}})
        check('wrong-producer', {'suite': 'another-real-suite'})
        check('missing-producer', {'suite': None})
        check('recorded-error', {'errors':['test fixture error']})
        blocked = {'checks': [{**row, 'status':'BLOCKED_ENV'}], 'status':'BLOCKED_ENV'}
        check('blocked-forbidden', blocked)
        allowed = {**spec, 'allow_blocked':True, 'command':['{python}', script.name, '3']}
        check('blocked-permitted', blocked, 'BLOCKED_ENV', 1, allowed)
        legacy = {**spec, 'id':'e2e-browser', 'allow_blocked':True}
        legacy_body = {'suite':'shape', 'results':[row], 'offline_release':release}
        for label, patch, expected in [
                ('legacy-valid', {}, 'PASS'),
                ('legacy-duplicate', {'checks':[row]}, 'FAIL'),
                ('legacy-blocked-conflict', {'status':'BLOCKED_ENV'}, 'FAIL'),
                ('legacy-explicit-block', {'results':[{**row, 'status':'BLOCKED_ENV'}]}, 'BLOCKED_ENV')]:
            result, binding = execute(legacy, {**legacy_body, **patch})
            require(result['status'] == binding['status'] == expected, (label, result))
            require(bool(qa.verify_binding(work, out, registry, rt=runtime)) == (expected == 'FAIL'), label)
            print(f'PASS {label} · legacy runner/binding={expected}')
        measured = {**spec, 'id':'viewed-coverage', 'sample_key':'cases'}
        sample = {'name':'observed state', 'expected':True, 'actual':True}
        for label, cases, expected in [('measurement-control', [sample], 'PASS'),
                                      ('measurement-invalid', [None], 'FAIL'),
                                      ('measurement-mismatch', [{**sample, 'actual':1}], 'FAIL')]:
            result, binding = execute(measured, {'cases':cases, 'release':release, 'status':'PASS'})
            require(result['status'] == binding['status'] == expected, (label, result))
            require(bool(qa.verify_binding(work, out, registry, rt=runtime)) == (expected == 'FAIL'), label)
            print(f'PASS {label} · measured observation runner/binding={expected}')
        # A blocking process exit without a supporting row must also fail at aggregation.
        result, binding = execute(allowed, base)
        require(result['status'] == binding['status'] == 'FAIL', result)
        require(qa.verify_binding(work, out, registry, rt=runtime), 'unsupported blocked exit')
        print('PASS blocked-exit-without-block · runner/binding rejected')

        # Use a small real registered producer as a fully fresh positive control.
        production = json.loads((ROOT / 'tests/qa/suites.json').read_bytes())['suites']
        real = next(s for s in production if s['id'] == 'data-cache-policy')
        for name in ('tests/data/cache-policy.mjs', 'tests/qa/receipt.mjs', 'src/cache-policy.js'):
            (work / name).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, work / name)
        result, binding = execute(real)
        require(result['status'] == binding['status'] == 'PASS' and result['assertions'] >= real['min_assertions'], result)
        require(not qa.verify_binding(work, out, registry, rt=runtime), 'genuine producer did not reverify')
        print(f"PASS positive-real-receipt · cache policy producer · {result['assertions']} assertions")
        for name, apply in [
            ('wrong-hash', lambda record: record['receipts'][0].update(sha256='0'*64)),
            ('recorded-status', lambda record: record.update(status='BLOCKED_ENV')),
            ('wrong-archive-path', lambda record: record['receipts'][0].update(file='other.json')),
            ('malformed-binding-row', lambda record: record.update(receipts=[None])),
        ]:
            altered = copy.deepcopy(result)
            apply(altered)
            original = {**binding, 'suites':[altered]}
            dump(out / 'binding.json', original)
            require(qa.verify_binding(work, out, registry, rt=runtime), name)
            rebuilt = qa.write_binding(out, {'suites':[real]}, [altered], ident, runtime, qa.sha256_file(registry))
            require(rebuilt['status'] == 'FAIL', name)
            print(f'PASS {name} · binding writer and independent verifier rejected')


if __name__ == '__main__':
    main()
