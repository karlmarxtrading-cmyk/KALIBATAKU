"""Python twin of tests/qa/receipt.mjs (schema kalibataku-qa-receipt/1)."""
import json, os, platform, sys, time, traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def build_identity():
    try:
        rel = json.loads((ROOT / 'dist/offline-assets.json').read_bytes())['release']
    except Exception:
        rel = None
    try:
        info = json.loads((ROOT / 'dist/build-info.json').read_bytes())
    except Exception:
        info = {}
    return {'offline_release': rel, 'app_version': info.get('app_version'), 'bank_version': info.get('bank_version')}


class Suite:
    def __init__(self, sid, scope=''):
        self.id, self.scope, self.checks, self.errors = sid, scope, [], []
        self.started = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    def check(self, cid, expected, fn):
        try:
            actual = fn()
            self.checks.append({'id': cid, 'status': 'PASS', 'expected': expected, 'actual': actual})
        except Exception as e:
            self.checks.append({'id': cid, 'status': 'FAIL', 'expected': expected, 'actual': (repr(e) + '\n' + traceback.format_exc(limit=3))[:2000]})
        print(cid, self.checks[-1]['status'], flush=True)

    def blocked(self, cid, expected, reason):
        self.checks.append({'id': cid, 'status': 'BLOCKED_ENV', 'expected': expected, 'actual': reason})
        print(cid, 'BLOCKED_ENV', flush=True)

    @property
    def status(self):
        if self.errors or not self.checks or any(c['status'] == 'FAIL' for c in self.checks):
            return 'FAIL'
        return 'BLOCKED_ENV' if any(c['status'] == 'BLOCKED_ENV' for c in self.checks) else 'PASS'

    def finish(self, name, **extra):
        body = {'schema': 'kalibataku-qa-receipt/1', 'suite': self.id, 'scope': self.scope, 'build': build_identity(),
                'runtime': {'python': platform.python_version(), 'platform': platform.platform()}, 'started': self.started,
                'finished': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'assertions': len(self.checks), 'status': self.status,
                'errors': self.errors, 'checks': self.checks, **extra}
        out = Path(os.environ.get('KALIBATAKU_RECEIPTS', ROOT / 'evidence/v13/receipts')) / name
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(body, indent=2, ensure_ascii=False, default=str) + '\n')
        failed = [c['id'] for c in self.checks if c['status'] == 'FAIL']
        print(f"{self.id}: {body['status']} · {len(self.checks)} assertions · {len(failed)} failed {failed[:8]}", flush=True)
        sys.exit(0 if body['status'] == 'PASS' else 3 if body['status'] == 'BLOCKED_ENV' else 1)
