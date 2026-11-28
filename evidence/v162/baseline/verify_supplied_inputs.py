"""Verify both commissioning archives and run the original release check on a fresh extraction."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZipFile

CANDIDATE = '37169d1c06edd8216acd3a263282004d893494c74d3dabc6dcb9376e9d7bf198'
AUDIT = 'e054160c6b7f4d38a25cdfba75a373626611601d04fa2cad02c1a88283daa12c'
AUDIT_ROOT = 'AUDIT_KALIBATAKU_161/'


def need(condition, description):
    if not condition:
        raise ValueError(description)


def file_hash(path):
    with path.open('rb') as file:
        return hashlib.file_digest(file, 'sha256').hexdigest()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def audit_contents(archive):
    names = archive.namelist()
    need(len(names) == len(set(names)) and all(n.startswith(AUDIT_ROOT) for n in names), 'Unexpected audit names')
    manifest = archive.read(AUDIT_ROOT + 'SHA256SUMS_AUDIT.txt').decode('utf-8-sig').splitlines()
    checked = set()
    for line in manifest:
        expected, name = line.split('  ', 1)
        path = AUDIT_ROOT + name
        need(path not in checked and sha(archive.read(path)) == expected, f'Audit member mismatch: {name}')
        checked.add(path)
    need(checked == set(names) - {AUDIT_ROOT + 'SHA256SUMS_AUDIT.txt'}, 'Incomplete audit member set')
    need(archive.testzip() is None, 'Bad audit CRC')
    return len(names), len(checked)


def confirm_inventory(archive, audit):
    csv_data = audit.read(AUDIT_ROOT + '12_INVENTARIS_SELURUH_7418_FILE.csv').decode('utf-8-sig')
    checked = set()
    for row in csv.DictReader(io.StringIO(csv_data)):
        name = row['path']
        raw = archive.read(name)
        need(name not in checked and len(raw) == int(row['size_bytes']) and sha(raw) == row['sha256'], name)
        checked.add(name)
    need(len(checked) == len(archive.namelist()) == 7418 and checked == set(archive.namelist()), 'Input file set mismatch')
    return len(checked)


def verify(candidate, audit_path, out):
    need(file_hash(candidate) == CANDIDATE and file_hash(audit_path) == AUDIT, 'Archive SHA-256 mismatch')
    out.mkdir(parents=True, exist_ok=True)
    with ZipFile(audit_path) as audit, ZipFile(candidate) as original:
        audit_files, audit_rows = audit_contents(audit)
        program_rows = confirm_inventory(original, audit)
        with tempfile.TemporaryDirectory(prefix='kalibataku input 1.6.1 ') as stage:
            original.extractall(stage)
            npm = shutil.which('npm')
            need(npm, 'npm is required on PATH')
            result = subprocess.run([npm, 'run', 'release:verify'], cwd=stage,
                                    env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}, capture_output=True)
        log = result.stdout + result.stderr
        (out / 'npm-release-verify-1.6.1.log').write_bytes(log)
        need(result.returncode == 0, 'Original npm run release:verify failed; see the output log')
        binding_bytes = original.read('evidence/v161/qa/binding.json')
        binding = json.loads(binding_bytes)
        verdict = json.loads(original.read('RELEASE_STATUS.json'))
        data = {
            'schema': 'kalibataku-input-provenance/1', 'checked_utc': datetime.now(timezone.utc).isoformat(),
            'source_archive_name': candidate.name, 'source_sha256': CANDIDATE,
            'audit_archive_name': audit_path.name, 'audit_archive_sha256': AUDIT,
            'audit_files': audit_files, 'audit_manifests_checked': audit_rows,
            'inventory_auditor_rows_matched': program_rows, 'input_build': binding['build'],
            'input_binding_sha256': sha(binding_bytes), 'input_status': verdict['release_label'],
            'input_suites': len(binding['suites']), 'input_assertions': binding['assertions'],
            'baseline_dist_files': sum(n.startswith('dist/') for n in original.namelist()),
            'release_verify': {'command': ['npm','run','release:verify'], 'exit_code': result.returncode,
                               'clean_extraction': True, 'log': 'npm-release-verify-1.6.1.log', 'log_sha256': sha(log)},
            'scope': 'Checks the original archives against the supplied audit inventory and verifies 1.6.1 on a clean extraction. Historical suite counts come from the hash-bound 1.6.1 binding.',
        }
    (out / 'input-1.6.1.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    print(f'Input 1.6.1 verified: {program_rows} candidate members, {audit_rows} audit checksums, release:verify exit 0.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate', type=Path)
    parser.add_argument('audit', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    verify(args.candidate, args.audit, args.out)
