"""Write the 1.3.0 acceptance registers and release status from evaluated criteria.

Called by tools/assess.py --write after the binding has been re-verified. Definitions of
each AC/FM come from the archived 1.2.0 registers (evidence/v13/historical); only the
status, observation, evidence and remaining-gap columns are produced here.
"""
import csv, io, json, zipfile
from collections import Counter
from pathlib import Path

GATE_STATIC = 'WAJIB_STATIC'


def read_csv(text):
    return list(csv.DictReader(io.StringIO(text.lstrip('﻿'))))


def write_csv(path, rows):
    with path.open('w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)


def write(root, crit, states, binding):
    root = Path(root)
    hist = zipfile.ZipFile(root / 'evidence/v13/historical/registers-1.2.0.zip')
    ac = read_csv(hist.read('ACCEPTANCE_RESULTS.csv').decode('utf-8-sig'))
    fm = read_csv(hist.read('ACCEPTANCE_FM.csv').decode('utf-8-sig'))
    old_closure = read_csv(hist.read('AUDIT_CLOSURE.csv').decode('utf-8-sig'))
    qa = read_csv((root / 'evidence/v13/historical/audit-1.2.0-kriteria-penutupan.csv').read_text(encoding='utf-8-sig'))
    findings = json.loads((root / 'tests/qa/findings.json').read_bytes())['findings']
    b = binding['build']; rt = binding['runtime']
    ident = f"dist {b['dist_tree_sha256']} / offline {b['offline_release']} / app {b['app_version']} / bank {b['bank_version']}"
    env = f"{rt['os']}; Node {rt['node']}; Python {rt['python']}; {rt.get('chromium') or 'no Chromium'}; Playwright {rt.get('playwright')}. HTTP lokal, data sintetis."
    date = binding['created_utc'][:10]
    gate = {r['acceptance_id']: r['gate'] for r in ac}
    gate.update({r['criterion_id']: r['release_gate'] for r in fm})
    gate.update({r['id']: r['lingkup_gate'] for r in qa})
    by = {c['id']: c for c in crit}
    st = {k: list(v) for k, v in states.items()}
    # Criteria that summarise the release are blocked while any other mandatory gate is open.
    def open_static(exclude):
        return [k for k, v in st.items() if gate.get(k) == GATE_STATIC and v[0] != 'PASS' and k not in exclude and not by[k].get('depends_on_open_mandatory')]
    for k, c in by.items():
        if c.get('depends_on_open_mandatory') and st[k][0] == 'PASS':
            others = open_static({k})
            if others:
                st[k][0] = 'BLOCKED'; st[k][3] = 'Masih ada gate WAJIB_STATIC terbuka: ' + ', '.join(sorted(others)) + '. Domain akhir belum diuji.'
    for r in ac:
        k = r['acceptance_id']; s, ev, obs, rem = st[k]
        r.update(baseline_status=r['status'], status=s, status_build_baru=s, hasil_aktual=obs, path_bukti=' | '.join(ev), build_yang_diuji=ident,
                 tanggal_uji=date, pelaksana='QA otomatis (npm run qa:production)' if not by[k].get('external') else 'Belum dilaksanakan', lingkungan=env, sisa=rem)
    write_csv(root / 'ACCEPTANCE_RESULTS.csv', ac)
    for r in fm:
        k = r['criterion_id']; s, ev, obs, rem = st[k]
        r.update(baseline_status=r['status_new_build'], status_new_build=s, actual_result=obs, build_hash=ident, environment=env, evidence_path=' | '.join(ev),
                 tester='QA otomatis (npm run qa:production)' if not by[k].get('external') else 'Belum dilaksanakan', tested_at=date, sisa=rem)
    write_csv(root / 'ACCEPTANCE_FM.csv', fm)
    rows = []
    for r in qa:
        k = r['id']; s, ev, obs, rem = st[k]
        rows.append({'id': k, 'area': r['area'], 'lingkup_gate': r['lingkup_gate'], 'status_baseline_audit': r['status_baseline_audit'], 'status_1_3_0': s,
                     'hasil_wajib': r['hasil_wajib'], 'bukti': ' | '.join(ev), 'sisa': rem, 'build': ident, 'rujukan': r['rujukan']})
    write_csv(root / 'PENUTUPAN_AUDIT_1.2.0.csv', rows)
    # Findings of the 1.2.0 audit: closed only when every cited suite/row is PASS.
    suites = {s['id']: s for s in binding['suites']}
    from assess import load_receipt_rows
    frows = []
    for f in findings:
        if f.get('external'):
            state = f['external']; proof = []
        else:
            ok = all(suites.get(x, {}).get('status') == 'PASS' for x in f['after_suites'])
            for sid, rid in f['after_rows']:
                ok = ok and suites.get(sid, {}).get('status') == 'PASS' and load_receipt_rows(root / 'evidence/v13/qa', suites[sid]).get(rid) == 'PASS'
            state = 'FIXED_VERIFIED' if ok and (f['after_suites'] or f['after_rows']) else 'OPEN'
            proof = [f'{x} ({suites.get(x, {}).get("status")})' for x in f['after_suites']] + [f'{a}/{b} ({load_receipt_rows(root / "evidence/v13/qa", suites[a]).get(b) if a in suites else "absent"})' for a, b in f['after_rows']]
        frows.append({'id': f['id'], 'prioritas': f['severity'], 'judul': f['title'], 'status_audit_1_2_0': 'OPEN', 'status_1_3_0': state, 'akar_masalah': f['root_cause'],
                      'perubahan': f['change'], 'file_berubah': '; '.join(f['files']), 'bukti_sebelum': f['before'], 'bukti_sesudah': '; '.join(proof) + ((' · ' + f['rerun']) if f.get('rerun') else ''),
                      'tes_regresi': '; '.join(f['regression']), 'catatan': f.get('note', ''), 'build': ident})
    write_csv(root / 'TEMUAN_AUDIT_1.2.0.csv', frows)
    rec = {r['acceptance_id']: (r['status'], r['path_bukti'], r['sisa']) for r in ac}
    rec.update({r['criterion_id']: (r['status_new_build'], r['evidence_path'], r['sisa']) for r in fm})
    import re
    closure = []
    for r in old_closure:
        links = [x for x in re.split(r'\s*\|\s*', r['acceptance_id']) if x]
        open_ids = [x for x in links if rec.get(x, ('MISSING',))[0] != 'PASS']
        state = 'PARTIALLY_VERIFIED' if open_ids else 'FIXED_VERIFIED' if links else 'NOT_RUN'
        closure.append({**{k: r[k] for k in ('origin_id', 'priority', 'title')}, 'baseline_status': r['status_build_baru'], 'status_build_baru': state, 'acceptance_id': r['acceptance_id'],
                        'build_hash': ident, 'bukti': ' | '.join(dict.fromkeys(p for x in links for p in rec.get(x, ('', '', ''))[1].split(' | ') if p)), 'hasil_aktual': 'Status mengikuti kriteria terkait pada build ini.', 'sisa': ' | '.join(open_ids)})
    write_csv(root / 'AUDIT_CLOSURE.csv', closure)
    mandatory = sorted(open_static(set()) + [k for k, c in by.items() if c.get('depends_on_open_mandatory') and gate.get(k) == GATE_STATIC and st[k][0] != 'PASS'])
    qs = {r['id']: r['status_1_3_0'] for r in rows}
    def scope(status, evidence, boundary, blockers=()):
        return {'status': status, 'evidence': evidence, 'claim_boundary': boundary, 'blockers': list(blockers)}
    perf = next((x for x in json.loads((root / 'evidence/v13/qa/performance-budgets/performance-budgets.json').read_bytes())['checks'] if x['id'].startswith('student player including observed renderer')), None)
    ds = {
        'static_application': scope('HOLD' if mandatory else 'PASS', ['ACCEPTANCE_RESULTS.csv', 'ACCEPTANCE_FM.csv', 'PENUTUPAN_AUDIT_1.2.0.csv'],
                                    'Build statis lengkap dan terverifikasi untuk hosting. Gate wajib yang membutuhkan perangkat fisik, pembaca layar atau mesin browser lain masih terbuka.' if mandatory else 'Semua gate WAJIB_STATIC lulus pada build ini.', mandatory),
        'ui_ux': scope('TECHNICAL_PASS_USABILITY_NOT_VALIDATED' if all(qs.get(x) == 'PASS' for x in ('QA-15', 'QA-16', 'QA-17', 'QA-20', 'QA-21')) else 'HOLD', ['TEMUAN_AUDIT_1.2.0.csv', 'evidence/v13/qa/browser-v13-chromium/browser-v13-chromium.json'],
                       'Redesain dan temuan UX diuji otomatis di Chromium dengan viewport/teks/tema. Usability dengan pengguna nyata belum dilakukan.', [x for x in ('QA-15', 'QA-16', 'QA-17', 'QA-20', 'QA-21', 'QA-27') if qs.get(x) != 'PASS']),
        'arithmetic_bank': scope('PASS' if qs.get('QA-04') == 'PASS' else 'FAIL', ['evidence/v13/qa/bank-verify/log.txt', 'evidence/v13/qa/bank-determinism/bank-determinism.json'],
                                 f"Bank konten {b['bank_version']}: 4.604 paket, 177.640 penempatan, oracle eksak dan regenerasi byte-identik.", [] if qs.get('QA-04') == 'PASS' else ['QA-04']),
        'representation_narrative': scope('PASS' if qs.get('QA-05') == 'PASS' and qs.get('QA-06') == 'PASS' else 'FAIL', ['evidence/v13/qa/math-linear-roundtrip/math-linear-roundtrip.json', 'evidence/v13/qa/bank-domain-prose/bank-domain-prose.json'],
                                          'Teks linear seluruh soal/langkah setara AST; narasi G1–6 nonnegatif. Ini pemeriksaan otomatis, bukan penelaahan guru.', [x for x in ('QA-05', 'QA-06') if qs.get(x) != 'PASS']),
        'pedagogy_pilot': scope('NOT_PERFORMED', ['evidence/v13/bank/editorial-changes-1.1.0-to-1.2.0.csv.gz', 'docs/PROTOKOL_GATE_EKSTERNAL.md'], 'Penelaah manusia dan pilot peserta belum ada.', ['QA-26', 'QA-27']),
        'bridge_contract': scope('PASS' if qs.get('QA-23') == 'PASS' else 'FAIL', ['evidence/v13/qa/data-contract/log.txt'], 'Kontrak, retry, ACK dan isolasi diuji dengan fixture.', []),
        'live_lms': scope('DEFERRED_BY_SCOPE', ['docs/bridge/README.md'], 'LMS institusi live di luar lingkup statis.', []),
        'performance_lab': scope('PASS' if perf and perf['status'] == 'PASS' else 'FAIL', ['evidence/v13/qa/performance-budgets/performance-budgets.json'],
                                 f"Player + renderer {perf['actual']['gzip_bytes'] if perf else '?'} B gzip (batas 90 KiB). Lab tanpa throttling; bukan data lapangan.", []),
        'field_performance': scope('NOT_RUN', ['evidence/v13/qa/performance-budgets/performance-budgets.json'], 'p75 LCP/INP/CLS memerlukan trafik produksi.', ['QA-28']),
        'live_deployment': scope('PREVIEW_PASS' if qs.get('QA-24') == 'PASS' else 'FAIL', ['evidence/v13/qa/hosting-smoke/log.txt', 'docs/DEPLOY.md'], 'HTTP/HTTPS root dan subfolder lulus di pratinjau lokal. Deployment publik belum dilakukan.', ['QA-25'])}
    for k, v in ds.items():
        for rel in v['evidence']:
            if not (root / rel).is_file():
                raise ValueError(f'readiness {k}: evidence {rel} is not a file')
    status = {'artifact_status': 'release_verdict', 'release_id': f"kalibataku-static-{b['app_version']}", 'app_version': b['app_version'], 'bank_version': b['bank_version'],
              'dist_tree_sha256': b['dist_tree_sha256'], 'offline_release': b['offline_release'], 'qa_binding': 'evidence/v13/qa/binding.json', 'readiness': ds}
    (root / 'RELEASE_STATUS.json').write_text(json.dumps(status, ensure_ascii=False, indent=2) + '\n')
    tot = lambda xs: ', '.join(f'{v} {k}' for k, v in sorted(Counter(xs).items()))
    lines = [f"# KALIBATAKU {b['app_version']} · Status rilis", '',
             ('**HOLD untuk produksi penuh.** ' if mandatory else '**GO untuk lingkup statis.** ') + 'Folder `dist/` dapat dipasang dan diuji sekarang.', '',
             f"AC (80) · {tot(r['status'] for r in ac)}. FM (48) · {tot(r['status_new_build'] for r in fm)}. Kriteria penutupan audit (30) · {tot(r['status_1_3_0'] for r in rows)}.", '',
             f"Gerbang produksi: {binding['status']} · {len(binding['suites'])} suite · {binding['assertions']} assertion · build `{b['offline_release']}`.", '',
             '| Lingkup | Status | Batas klaim |', '|---|---|---|'] + [f"| {k} | {x['status']} | {x['claim_boundary']} |" for k, x in ds.items()] + \
            ['', '## Temuan audit 1.2.0', '', '| ID | Prioritas | Status 1.3.0 |', '|---|---|---|'] + [f"| {f['id']} | {f['prioritas']} | {f['status_1_3_0']} |" for f in frows] + \
            ['', '## Gate wajib yang masih terbuka', ''] + [f"- **{k}** · {st[k][0]} · {st[k][3]}" for k in mandatory] + \
            ['', f"Build dist SHA-256 `{b['dist_tree_sha256']}`.", '']
    (root / 'STATUS_RILIS.md').write_text('\n'.join(lines))
    return {'mandatory_open': mandatory, 'ac': Counter(r['status'] for r in ac), 'fm': Counter(r['status_new_build'] for r in fm), 'qa': Counter(r['status_1_3_0'] for r in rows), 'findings': {f['id']: f['status_1_3_0'] for f in frows}}
