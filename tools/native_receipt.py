"""Verify an extracted sealed checkout and retain native build evidence outside it."""
import ast
import json
import os
import re
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import qa_core

ROOT = Path(__file__).resolve().parents[1]
STEPS = [
    'tests/v160/path_order.py',
    'tools/project.py verify',
    'tools/project.py build',
    'tools/project.py verify',
]


def run(out):
    out = out.resolve()
    if out.is_relative_to(ROOT):
        raise ValueError("Write native evidence outside the sealed checkout, then import it for assessment.")
    out.mkdir(exist_ok=True, parents=True)
    before = qa_core.identity(ROOT)
    logs = []
    for number, step in enumerate(STEPS):
        proc = subprocess.run([sys.executable, *step.split()], cwd=ROOT, capture_output=True)
        log = out / f'{number}.log'
        log.write_bytes(proc.stdout + proc.stderr)
        logs.append({'step': step, 'exit': proc.returncode, 'sha256': qa_core.sha256_file(log)})
        if proc.returncode:
            break
    record = {
        'os': platform.system(), 'platform': platform.platform(), 'runtime': qa_core.runtime(),
        'sys_platform': sys.platform, 'os_name': os.name, 'git_bash_environment': os.environ.get('MSYSTEM'),
        'finished_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'checkout_has_space': ' ' in str(ROOT), 'build': before, 'after': qa_core.identity(ROOT),
        'logs': logs,
    }
    (out / 'native.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
    return 0 if verified(out, before, record['os']) == 'PASS' else 1


def log_matches(text, index, system, build):
    lines = text.splitlines()
    if index == 0:
        pin_prefix = 'PASS original immutable bank and factory pin '
        pins = [ast.literal_eval(line[len(pin_prefix):]) for line in lines if line.startswith(pin_prefix)]
        required = {'PASS component ordering PureWindowsPath', 'PASS component ordering PurePosixPath'}
        return (required.issubset(lines) and pins == [json.loads((ROOT / 'factory/bank-lock.json').read_bytes())]
                and any(re.fullmatch(r'PASS native fixture ' + system + r' [0-9a-f]{64}', line) for line in lines))
    if index == 2:
        return any(re.fullmatch(r'dist ' + build['dist_tree_sha256'] + r' [1-9][0-9]* files', line) for line in lines)
    verified_message = 'Verified inventory, distribution, bank sources, release evidence and QA binding'
    summary = r'Verified [1-9][0-9]* checksums / source ' + build['source_tree_sha256'] + ' / dist ' + build['dist_tree_sha256']
    return verified_message in lines and any(re.fullmatch(summary, line) for line in lines)


def verified(out, build, system='Windows'):
    path = out / 'native.json'
    if not path.is_file():
        return 'BLOCKED'
    try:
        record = json.loads(path.read_bytes())
        runtime = record['runtime']
        timestamp = datetime.fromisoformat(record['finished_utc'])
        hosts = {'Windows': ('win32', 'nt'), 'Linux': ('linux', 'posix')}
        valid = (
            system in hosts and (record['sys_platform'], record['os_name']) == hosts[system]
            and record['platform'] == runtime['os'] and record['platform'].startswith(system + '-')
            and (system != 'Windows' or record['git_bash_environment'] in ('MINGW64', 'MINGW32', 'UCRT64', 'MSYS', 'CLANG64', 'CLANGARM64'))
            and record['os'] == system and record['build'] == record['after'] == build
            and timestamp.utcoffset() is not None
            and re.fullmatch(r'3\.[0-9]+\.[0-9]+', runtime['python'])
            and re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', runtime['node'])
            and (system != 'Windows' or record['checkout_has_space'] is True)
            and [row['step'] for row in record['logs']] == STEPS
        )
        for number, row in enumerate(record['logs']):
            log = out / f'{number}.log'
            valid = valid and type(row['exit']) is int and row['exit'] == 0 and log.stat().st_size > 0
            valid = valid and qa_core.sha256_file(log) == row['sha256']
            valid = valid and log_matches(log.read_text(encoding='utf-8'), number, system, build)
        return 'PASS' if valid else 'FAIL'
    except (AttributeError, KeyError, SyntaxError, TypeError, ValueError, OSError):
        return 'FAIL'


if __name__ == '__main__':
    raise SystemExit(run(Path(sys.argv[1])))
