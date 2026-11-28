"""Regenerate the whole bank from factory/ into an empty directory and require byte
identity with dist/bank (QA-01, QA-04). The factory's own oracle runs during the build."""
import json, subprocess, sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools')); sys.path.insert(0, str(ROOT / 'tests/qa'))
from project import tree_hash, files
from receipt import Suite
s = Suite('bank-determinism', 'Second clean bank generation equals the published bank byte for byte')
with tempfile.TemporaryDirectory(prefix='kalibataku-bank-') as tmp:
    out = Path(tmp)
    p = subprocess.run([sys.executable, str(ROOT / 'factory/build_bank.py'), '--output', str(out / 'bank'), '--evidence', str(out / 'evidence')], capture_output=True, text=True)
    s.check('factory-build', 'Factory generation and its BigInt oracle succeed', lambda: (_ for _ in ()).throw(AssertionError(p.stderr[-1500:])) if p.returncode else p.stdout.strip().splitlines()[-1][:300])
    def same():
        live, fresh = ROOT / 'dist/bank', out / 'bank'
        a = {x.relative_to(live).as_posix() for x in files(live)}; b = {x.relative_to(fresh).as_posix() for x in files(fresh)}
        assert a == b, sorted(a ^ b)[:5]
        diff = [r for r in sorted(a) if (live / r).read_bytes() != (fresh / r).read_bytes()]
        # index.json records the largest package gzip size, which depends on the zlib build.
        assert diff in ([], ['index.json']), diff[:5]
        if diff:
            x, y = json.loads((live / 'index.json').read_bytes()), json.loads((fresh / 'index.json').read_bytes())
            x.pop('max_package_gzip_bytes'); y.pop('max_package_gzip_bytes'); assert x == y
        return {'files': len(a), 'tree_sha256': tree_hash(live), 'byte_identical_except': diff}
    s.check('byte-identity', 'Every published bank file is reproduced byte for byte', same)
s.finish('bank-determinism.json')
