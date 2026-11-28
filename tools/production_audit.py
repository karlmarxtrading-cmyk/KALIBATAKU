"""Map redesign requirements and the 1.6.0 auditor's findings to current evidence."""
import csv
from pathlib import Path

from adventure_register import combine
from external_cases import GATES
from native_receipt import verified as native_status

ROOT = Path(__file__).resolve().parents[1]
BASE = Path('evidence/v161')
VIEW = tuple(f'next-viewport-{engine}' for engine in ('chromium', 'firefox', 'webkit'))
EXTERNAL = tuple(gate for gate in GATES if gate != 'PERF-03')
# IDs are scoped to their original register. A relation describes overlap in
# subject or proof. It never grants PASS to the criterion on either side.
OVERLAP = {
    'NAV-01': 'UX-02 UX-03 PILOT-01', 'NAV-02': 'UX-01 DATA-01 OFF-03',
    'NAV-03': 'UX-02 PROG-05', 'NAV-04': 'BANK-03 PROG-01', 'NAV-05': 'PROG-01 PROG-05',
    'NAV-06': 'BANK-02 OFF-04', 'NAV-07': 'UX-13', 'NAV-08': 'PROG-10 PROG-11',
    'UI-01': 'UX-01 UX-03 A11Y-02', 'UI-02': 'UX-03 UX-04 A11Y-02',
    'UI-03': 'UX-09 DEVICE-02 DEVICE-03', 'UI-04': 'UX-08 DATA-03', 'UI-05': 'A11Y-01 A11Y-02 A11Y-03',
    'UI-06': 'A11Y-04', 'UI-07': 'A11Y-05', 'UI-08': 'UX-11 DATA-01',
    'PED-01': 'PROG-09', 'PED-02': 'PROG-09', 'PED-03': 'PROG-08 TEACH-01',
    'PED-04': 'PROG-04 PROG-06 DATA-06', 'PED-05': 'BANK-05 BANK-07 PROG-02', 'PED-06': 'PROG-05 PROG-06 PILOT-03',
    'PED-07': 'BANK-07 PROG-12', 'PED-08': 'UX-06', 'DATA-01': 'BANK-01',
    'DATA-02': 'BANK-02 BANK-04', 'DATA-03': 'PROG-11 DATA-01 OFF-03',
    'DATA-04': 'DATA-01 DATA-02 DATA-05 DATA-07 DATA-08 DATA-09 DATA-10',
    'DATA-05': 'PROG-09 TEACH-01 TEACH-02 TEACH-04', 'OFF-01': 'OFF-01 OFF-02',
    'OFF-02': 'OFF-01 OFF-03 OFF-04', 'REL-01': 'REL-01', 'REL-02': 'REL-01 REL-05',
    'REL-03': 'BANK-07', 'REL-04': 'TEACH-02 TEACH-03', 'REL-05': 'PILOT-01 PILOT-02 PILOT-03',
    'REL-06': 'REL-02 REL-03 OFF-03', 'REL-07': 'ALL_WAJIB', 'POST-01': 'PERF-03',
    'E01': 'UX-04 UX-08 DATA-03', 'E02': 'UX-03 UX-08 A11Y-03', 'E03': 'UX-08',
    'E04': 'UX-08 DATA-03', 'E05': 'DATA-04 UX-08', 'E06': 'UX-07 UX-09',
    'E07': 'DATA-04 DATA-01', 'E08': 'A11Y-03', 'E09': 'UX-05 DATA-03 PROG-05',
    'E10': 'UX-08 UX-09 DEVICE-02 DEVICE-03', 'J01': 'UX-01 UX-02 PROG-05',
    'J02': 'PROG-05 PROG-06 UX-06', 'J03': 'PROG-02 PROG-07 PROG-12 TEACH-01',
    'F01': 'BANK-01 DATA-02 OFF-03', 'R01': 'OFF-01 DATA-07 TEACH-02', 'R02': 'REL-01 REL-04 REL-05',
}

AUDIT_LINKS = {
    'AUD160-01': ('UX-03 UX-08 UX-09 A11Y-02 A11Y-03 DEVICE-01 DEVICE-02 DEVICE-03', 'UI-02 UI-03 E02 E10'),
    'AUD160-02': ('REL-04 REL-05', 'REL-07 R02'),
    'OBS160-01': ('UX-08 A11Y-03', 'E01 E03 E08'),
    'OBS160-02': ('UX-02 UX-03 A11Y-02', 'NAV-01 UI-01 UI-02'),
    'DOC160-01': ('PROG-02 PROG-03 PROG-11 PROG-12', 'PED-05 PED-06 J03'),
    'EXT160-01': (' '.join(EXTERNAL), 'UI-03 UI-06 REL-03 REL-04 REL-05 REL-06 REL-07'),
    'EXT160-02': ('REL-01 REL-05', 'REL-01 R02'),
    'OBS160-03': ('OFF-01 OFF-03', 'OFF-01 OFF-02 R01'),
}


def read(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))


def crosswalk(acceptance, states, identity):
    previous = {r['id']: r for r in read(ROOT / BASE / 'baseline-1.6.0/registers/REGISTER_PENERIMAAN.csv')}
    if set(previous) != set(OVERLAP) or {r['id'] for r in acceptance} != set(OVERLAP):
        raise ValueError('Original redesign IDs and crosswalk must agree')
    result = []
    for row in acceptance:
        code = row['id']
        original = previous[code]
        if (row['kriteria'], row['metode']) != (original['kriteria'], original['metode']):
            raise ValueError('Redesign definition differs from archived original: ' + code)
        ids = OVERLAP[code].split()
        if ids == ['ALL_WAJIB']:
            ids = [i for i in states if i != 'PERF-03']
        result.append({
            'redesign_id': 'REDESIGN:' + code, 'kriteria': row['kriteria'],
            'fase': 'SETELAH_PILOT' if code == 'POST-01' else 'WAJIB',
            'baseline_id_terkait': ' | '.join('AC:' + k for k in ids),
            'hasil_baseline_terkait': ' | '.join('AC:' + k + '=' + states[k] for k in ids),
            'audit_160_terkait': ' | '.join(a for a, (_, design) in AUDIT_LINKS.items() if code in design.split()),
            'redesign_1_6_0': original['status'], 'redesign_build_ini': row['status'],
            'dist_tree_sha256': identity['dist_tree_sha256'],
        })
    return result


def audit_rows(root, identity, binding, suites, verified, states):
    """Compute local and complete closure separately. External validation is build-bound."""
    originals = read(root / BASE / 'audit-input/03_TEMUAN_DAN_PENUTUPAN.csv')
    if {r['id'] for r in originals} != set(AUDIT_LINKS) or len(originals) != len(AUDIT_LINKS):
        raise ValueError('Audit register differs from 1.6.0 findings')
    browser_suites = VIEW
    local_suites = {
        'AUD160-01': browser_suites, 'AUD160-02': ('qa-receipt-shape', 'qa-fault-injection'),
        'OBS160-01': (*browser_suites, 'compose-commit'), 'OBS160-02': browser_suites,
        'DOC160-01': ('learning-policy-160', 'journey-model', 'semantic-restore'),
        'EXT160-01': (), 'EXT160-02': ('portable-path-order',),
        'OBS160-03': ('offline-legacy-repeat-firefox', 'offline-capability-firefox', 'compose-commit'),
    }
    rows = []
    for original in originals:
        key = original['id']
        checks = {}
        refs = []
        for suite_id in local_suites[key]:
            suite = suites.get(suite_id, {})
            checks[suite_id] = suite.get('status', 'NOT_RUN') if verified else 'FAIL'
            for rel in [suite.get('log'), *(rc['file'] for rc in suite.get('receipts', []))]:
                if rel:
                    refs.append((BASE / 'qa' / rel).as_posix())
        if key == 'DOC160-01':
            path = 'docs/contracts/JOURNEY_1.6.md'
            checks[path] = 'PASS' if verified and (root / path).is_file() else 'FAIL'
            refs.append(path)
        if key == 'EXT160-02':
            for os_name in ('Linux', 'Windows'):
                folder = BASE / ('native-' + os_name.lower())
                status = native_status(root / folder, identity, os_name)
                if os_name == 'Linux':
                    checks['native-linux'] = status
                if (root / folder / 'native.json').is_file():
                    refs.append((folder / 'native.json').as_posix())
        local = combine(checks.values()) if checks else 'NON_APPLICABLE'
        external = {}
        if key == 'AUD160-01':
            external = {gate: states[gate] for gate in ('UX-09', 'DEVICE-02', 'DEVICE-03')}
        elif key == 'EXT160-01':
            external = {gate: states[gate] for gate in EXTERNAL}
        elif key == 'EXT160-02':
            external['native-windows'] = status
        if external:
            refs.append('VALIDASI_EKSTERNAL/07_WINDOWS_NATIVE.md' if key == 'EXT160-02' else 'REGISTER_AC_FINAL.csv')
        merged = {**checks, **external}
        overall = combine(merged.values()) if verified else 'FAIL'
        status_note = ('DITUTUP' if overall == 'PASS' else
                       'TEKNIS_LOKAL_LULUS_VALIDASI_EKSTERNAL_TERBUKA' if local == 'PASS' and external else
                       'TERBUKA')
        base_ids, redesign_ids = AUDIT_LINKS[key]
        rows.append({
            'id': key, 'prioritas': original['prioritas'], 'temuan': original['judul'],
            'status_1_6_0': original['status'], 'bukti_1_6_0_dalam_zip_audit': original['bukti'],
            'kriteria_penerimaan': original['penerimaan'], 'metode_dan_hasil':
                ' | '.join(k + '=' + v for k, v in merged.items()),
            'hasil_teknis_lokal': local, 'status': overall, 'penutupan': status_note,
            'baseline_terkait': ' | '.join('AC:' + k for k in base_ids.split()),
            'redesign_terkait': ' | '.join('REDESIGN:' + k for k in redesign_ids.split()),
            'bukti': ' | '.join(refs),
            'lingkungan_qa': binding['runtime'].get('os', 'unknown'),
            'waktu_binding_utc': binding['created_utc'], 'source_tree_sha256': identity['source_tree_sha256'],
            'dist_tree_sha256': identity['dist_tree_sha256'],
        })
    return rows
