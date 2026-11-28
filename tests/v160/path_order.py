from pathlib import Path,PureWindowsPath,PurePosixPath
import hashlib,sys,tempfile,platform
root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'tools'))
import project,qa_core
names=['alpha one/x','Alpha/école','ALPHA test/Q','Alpha-1/q','Murid/漢字','Murid/Ö','Murid/z']
for impl in (PurePosixPath,PureWindowsPath):
    parts=[p.parts for p in sorted(map(impl,names),key=lambda p:p.parts)]
    assert parts==sorted(tuple(s.split('/')) for s in names)
    print('PASS component ordering',impl.__name__)
with tempfile.TemporaryDirectory(prefix='Data uji é ') as tmp:
    base=Path(tmp)
    for n in names:
        p=base/n;p.parent.mkdir(exist_ok=True);p.write_bytes(n.encode('utf-8'))
    # Windows aliases directory names by case. Use non-colliding paths for the physical tree.
    actual=[p.relative_to(base).as_posix() for p in base.rglob('*') if p.is_file()]
    ordered=sorted(actual,key=lambda s:tuple(s.split('/')))
    expected=hashlib.sha256(''.join(hashlib.sha256((base/n).read_bytes()).hexdigest()+'  '+n+'\n' for n in ordered).encode('utf-8')).hexdigest()
    assert project.tree_hash(base)==qa_core.tree_hash(base)==expected
    print('PASS native fixture',platform.system(),expected)
project.check_pin()
print('PASS original immutable bank and factory pin',project.bank_pin())

# Reject relabelled native receipts and unrelated logs even when their digests agree.
import json
from native_receipt import STEPS, verified
with tempfile.TemporaryDirectory(prefix='native-receipt-control-') as folder:
    case = Path(folder)
    build = {'source_tree_sha256': '1'*64, 'dist_tree_sha256': '2'*64}
    logs = []
    for index, step in enumerate(STEPS):
        log = case / f'{index}.log'
        log.write_text('unrelated command output\n')
        logs.append({'step': step, 'exit': 0, 'sha256': qa_core.sha256_file(log)})
    receipt = {'os': 'Windows', 'platform': 'Linux-test', 'sys_platform': 'linux', 'os_name': 'posix',
               'runtime': {'python': '3.12.0', 'node': 'v24.0.0', 'os':'Linux-test'},
               'git_bash_environment': 'MINGW64', 'finished_utc': '2026-01-01T00:00:00+00:00',
               'checkout_has_space': True, 'build': build, 'after': build, 'logs': logs}
    path = case / 'native.json'
    path.write_text(json.dumps(receipt))
    assert verified(case, build) == 'FAIL'
    print('PASS relabelled Linux native receipt rejected')
    receipt.update(platform='Windows-test', sys_platform='win32', os_name='nt')
    receipt['runtime']['os'] = 'Windows-test'
    path.write_text(json.dumps(receipt))
    assert verified(case, build) == 'FAIL'
    print('PASS unrelated native command output rejected')
