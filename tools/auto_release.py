"""Evaluate the authorized static release from current evidence, then render its registers."""
import argparse
import csv
import io
import json
import sys
from pathlib import Path

import jsonschema
import qa_core as qa

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = Path('docs/contracts/static-auto-v1')
HISTORY = Path('evidence/v162/history-1.6.1')
QA = Path('evidence/v162/qa')
REGISTRY = Path('tests/qa/suites.json')
ZIP_PROOF = Path('evidence/v162/release/zip-roundtrip.json')
LIVE_PROOF = Path('evidence/v162/deployment/live.json')
NATIVE = Path('evidence/v162/native-windows')
PIN = {
    'profile.json': 'eeb88b43e3018fce41b045ee05dc1fbb417c7f5aa8d242b910c9edbbabb8571b',
    'historical-mapping.json': '39a01b931507e42ef482b9f543392f782427ac32878e73e48c2cbb19bd92fecd',
    'history-sha256.json': '65365105d49e49afca44e39a4f367a5585fd83731f2a611ff5c589b0fdf3b32f',
}
PACKAGE_IDS = [f'AUTO-{i:02d}' for i in range(1, 24)]


def read(path):
    return qa._read_json(path.read_bytes())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def csv_rows(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))


def validate_mapping(mapping, historical, gates):
    original = {}
    for row in csv_rows(historical / 'REGISTER_AC_FINAL.csv'):
        if row['status_audit_1_6_0'] != 'PASS':
            original[row['namespace_id']] = row['status_audit_1_6_0']
    for row in csv_rows(historical / 'REGISTER_PENERIMAAN.csv'):
        if row['status'] != 'PASS':
            original['REDESIGN:' + row['id']] = row['status']
    mapped = {r['id']: r['historical_evidence_status'] for r in mapping['rows']}
    require(len(mapping['rows']) == len(mapped) == 27 and original == mapped,
            '27 overlapping historical records must preserve every observed status')
    for r in mapping['rows']:
        require(r['applicability'] in {'REPLACED_BY_AUTO_SCOPE', 'POST_RELEASE',
                                      'OPTIONAL_COMPATIBILITY', 'DEPLOYMENT_ONLY'},
                f"historical applicability missing or invalid: {r['id']}")
        targets = r['replacement_gates']
        require(targets and set(targets) <= gates, f"missing or unknown replacement gate: {r['id']}")


def validate_registry(profile, registry, historical_registry):
    specs = registry['suites']
    index = {s['id']: s for s in specs}
    require(len(index) == len(specs), 'duplicate suite IDs in current registry')
    require(all(s.get('required', True) is True for s in specs), 'all registered suites must run')
    for prior in historical_registry['suites']:
        # The commands, receipts, assertion thresholds and error rules remain at least
        # as strict as the shipped 1.6.1 suite contract.
        current = index.get(prior['id'])
        require(current is not None, 'missing regression suite ' + prior['id'])
        for key in ('command', 'receipts', 'count_pattern', 'fail_pattern', 'sample_key',
                    'requires_build', 'allow_blocked', 'status_required'):
            require(current.get(key) == prior.get(key), f"original suite contract changed: {prior['id']} {key}")
        require(current.get('min_assertions', 1) >= prior.get('min_assertions', 1),
                'original assertion threshold lowered: ' + prior['id'])
    for g in profile['gates']:
        if g['id'] in PACKAGE_IDS:
            require(g['suites'] and set(g['suites']) <= index.keys(),
                    f"required suites absent: {g['id']} {sorted(set(g['suites']) - index.keys())}")


def contract(root):
    directory, historical = root / CONTRACT, root / HISTORY
    for name, digest in PIN.items():
        require(qa.sha256_file(directory / name) == digest, 'unauthorized contract change: ' + name)
    profile, mapping, history = (read(directory / name) for name in PIN)
    for schema, document in [('profile', profile), ('historical-mapping', mapping)]:
        jsonschema.Draft202012Validator(read(directory / (schema + '.schema.json'))).validate(document)
    require(mapping['profile_id'] == profile['profile_id'] == 'KALIBATAKU_STATIC_AUTO_V1', 'unknown profile')
    require([g['id'] for g in profile['gates']] == PACKAGE_IDS + ['AUTO-24', 'AUTO-25', 'AUTO-26'], 'missing or duplicate release gate')
    require(all(g['phase'] == 'PACKAGE' and g['applicability'] == 'REQUIRED' for g in profile['gates'][:23]),
            'required package gates cannot be waived')
    for name, digest in history['files'].items():
        require(qa.sha256_file(historical / name) == digest, 'immutable history changed: ' + name)
        if name.startswith('REGISTER_'):
            require(qa.sha256_file(root / name) == digest, 'historical register changed: ' + name)
    validate_mapping(mapping, historical, {g['id'] for g in profile['gates']})
    registry = read(root / REGISTRY)
    validate_registry(profile, registry, read(historical / 'suites.json'))
    return profile, mapping, registry


def open_findings(root):
    ledger = read(root / CONTRACT / 'findings.json')
    require(ledger['schema'] == 'kalibataku-technical-findings/1' and isinstance(ledger['findings'], list),
            'technical findings ledger is invalid')
    blockers, seen = [], set()
    for f in ledger['findings']:
        require(isinstance(f, dict) and qa.nonempty(f.get('id')) and f['id'] not in seen
                and f.get('severity') in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
                and f.get('status') in ('OPEN', 'CLOSED') and qa.nonempty(f.get('evidence')),
                'technical finding is missing a unique identity, severity, status or evidence')
        seen.add(f['id'])
        require((root / f['evidence']).is_file() and (root / f['evidence']).resolve().is_relative_to(root.resolve()),
                'technical finding evidence missing')
        if f['severity'] in ('CRITICAL', 'HIGH') and f['status'] != 'CLOSED':
            blockers.append(f"{f['severity']} {f['id']}: {f['evidence']}")
    return blockers


def package_ready(rows, issues):
    required = [r for r in rows if r['phase'] == 'PACKAGE']
    return (not issues and [r['id'] for r in required] == PACKAGE_IDS
            and all(r['applicability'] == 'REQUIRED' and r['status'] == 'PASS' for r in required))


def suite_gate(ids, outcomes, binding_errors):
    if binding_errors:
        return 'FAIL', 'Verifikasi binding gagal. Lihat issues dan binding.json.'
    missing = [sid for sid in ids if sid not in outcomes]
    if missing:
        return 'NOT_RUN', 'Bukti belum tersedia untuk ' + ', '.join(missing)
    bad = [(s, outcomes[s].get('status')) for s in ids if outcomes[s].get('status') != 'PASS']
    if bad:
        status = 'BLOCKED' if all(v == 'BLOCKED_ENV' for _, v in bad) else 'FAIL'
        return status, ', '.join(f'{s}={v}' for s, v in bad)
    return 'PASS', ', '.join(f"{s}={outcomes[s]['assertions']}" for s in ids)


def hosting_states(rows, ready, provider_origin=None):
    by_id = {r['id']:r['status'] for r in rows}
    live = by_id['AUTO-24']
    deployment = ('LIVE_PRODUCTION_VERIFIED' if live == 'PASS' and ready else
                  'NOT_DEPLOYED' if live == 'NOT_RUN' else 'PENDING_ACCESS')
    provider = 'NOT_DEPLOYED' if live == 'NOT_RUN' else 'PENDING_ACCESS'
    if deployment == 'LIVE_PRODUCTION_VERIFIED' and isinstance(provider_origin, str):
        # Only the actual verified origin may qualify for a Cloudflare Pages
        # preview. A production custom domain gives no evidence for a preview.
        from urllib.parse import urlsplit
        url = urlsplit(provider_origin)
        if url.scheme == 'https' and (url.hostname or '').endswith('.pages.dev'):
            provider = 'PASS'
    return {'local_hosting': by_id['AUTO-19'], 'provider_preview': provider, 'deployment_status': deployment}


def evaluate(root):
    profile, mapping, registry = contract(root)
    policy, build = qa.policy_identity(root), qa.identity(root)
    require(build['app_version'] == profile['app_version'], 'profile version does not match build')
    binding_path = root / QA / 'binding.json'
    binding, binding_sha, errors = {}, None, []
    if binding_path.is_file():
        binding_sha = qa.sha256_file(binding_path)
        # A prebuilt package can be verified on a host different from the QA host.
        # The runner itself checks its actual runtime before it records the final binding.
        errors = qa.verify_binding(root, root / QA, root / REGISTRY, check_runtime=False)
        if not errors:
            binding = read(binding_path)
    issues = open_findings(root) + errors
    outcomes = {s['id']: s for s in binding.get('suites', [])}
    if set(outcomes) != {s['id'] for s in registry['suites']} or binding.get('status') != 'PASS':
        issues.append('Belum tersedia binding PASS yang mencakup semua suite wajib.')
    rows = []
    verified_origin = None
    for gate in profile['gates']:
        gid, suites = gate['id'], gate['suites']
        evidence = []
        if gate['phase'] == 'PACKAGE':
            status, observed = suite_gate(suites, outcomes, errors)
            for sid in suites:
                if sid in outcomes:
                    suite = outcomes[sid]
                    evidence.append((QA / suite['log']).as_posix())
                    evidence.extend((QA / receipt['file']).as_posix() for receipt in suite['receipts'])
            if gid == 'AUTO-22' and status == 'PASS':
                if (root / ZIP_PROOF).is_file():
                    from pack_gate import verify_roundtrip
                    problems = verify_roundtrip(root, build, binding_sha)
                    evidence.append(ZIP_PROOF.as_posix())
                    status = 'FAIL' if problems else 'PASS'
                    observed = ' | '.join(problems) if problems else observed + ', putaran ZIP verify/build/verify lulus.'
                else:
                    status, observed = 'NOT_RUN', 'Menunggu bukti putaran ZIP yang terkait dengan build dan binding ini.'
        elif gid == 'AUTO-24':
            if (root / LIVE_PROOF).is_file():
                from live_gate import verify_live
                problems = verify_live(root, build)
                status, observed = ('FAIL', ' | '.join(problems)) if problems else ('PASS', 'Bukti domain aktual dan siklus data terverifikasi.')
                if not problems:
                    verified_origin = read(root / LIVE_PROOF).get('target_url')
                evidence.append(LIVE_PROOF.as_posix())
            else:
                status, observed = 'NOT_RUN', 'URL tujuan dan bukti deployment aktual belum tersedia.'
        elif gid == 'AUTO-25':
            if (root / NATIVE / 'native.json').is_file():
                from native_receipt import verified
                passed = verified(root / NATIVE, build, 'Windows') == 'PASS'
                status, observed = ('PASS', 'Build Windows native dan Git Bash lulus.') if passed else ('FAIL', 'Bukti Windows native tidak valid.')
                evidence.append((NATIVE / 'native.json').as_posix())
            else:
                status, observed = 'NOT_RUN', 'Tidak ada hasil build Windows native untuk versi ini.'
        else:
            status, observed = 'NOT_RUN', 'INSUFFICIENT_DATA. Belum ada pengukuran lapangan p75.'
        rows.append({k:gate[k] for k in ('id', 'name', 'phase', 'applicability', 'expected', 'suites')} |
                    {'status':status, 'observed':observed, 'evidence':evidence})
    ready = package_ready(rows, issues)
    decision = {
        'schema': 'kalibataku-automatic-decision/1', **build, 'profile': profile['profile_id'],
        'profile_version': profile['version'], **{k:v for k,v in policy.items() if k.endswith('_sha256')},
        'registry_sha256': qa.sha256_file(root / REGISTRY), 'binding_sha256': binding_sha,
        'runtime': binding.get('runtime', {}), 'tested_utc': binding.get('created_utc'),
        'suite_count': len(outcomes), 'assertions': binding.get('assertions', 0),
        'artifact_status': 'ARTIFACT_READY' if ready else 'HOLD',
        **hosting_states(rows, ready, verified_origin),
        'gates': rows, 'issues': issues,
    }
    jsonschema.Draft202012Validator(read(root / CONTRACT / 'decision.schema.json')).validate(decision)
    return decision, mapping, errors


def csv_text(fields, rows):
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fields, lineterminator='\n')
    writer.writeheader()
    for row in rows:
        writer.writerow({k: ' | '.join(v) if isinstance(v, list) else v for k,v in row.items()})
    return stream.getvalue()


def render(decision, mapping):
    rows = decision['gates']
    gates = {r['id']:r['status'] for r in rows}
    fields = ['id','phase','applicability','name','status','expected','observed','suites','evidence']
    identity = {k:decision[k] for k in ('profile','app_version','offline_release','source_tree_sha256','dist_tree_sha256','profile_sha256','mapping_sha256','registry_sha256','binding_sha256','tested_utc')}
    historical = []
    for r in mapping['rows']:
        targets = r['replacement_gates']
        historical.append({**r, 'replacement_results':[f'{gid}={gates[gid]}' for gid in targets]})
    package = [r for r in rows if r['phase'] == 'PACKAGE']
    md = [
        '# Status rilis KALIBATAKU ' + decision['app_version'], '',
        '**Paket** ' + decision['artifact_status'], '',
        '**Deployment** ' + decision['deployment_status'], '',
        '**Hosting lokal** ' + decision['local_hosting'] + ' · **Preview provider** ' + decision['provider_preview'], '',
        f"Profil {decision['profile']}, versi {decision['profile_version']}. "
        f"{sum(r['status']=='PASS' for r in package)} dari {len(package)} gerbang paket lulus. "
        f"Binding mencatat {decision['suite_count']} suite dan {decision['assertions']} pemeriksaan.", '',
        '| Gerbang | Lingkup | Hasil |', '| --- | --- | --- |',
        *[f"| {r['id']} · {r['name']} | {r['phase']} | {r['status']} |" for r in rows], '',
        'REGISTER_OTOMATIS.csv memuat jalur log dan bukti. Identitas build, hash pengujian, '
        'waktu dan lingkungan tersedia dalam RELEASE_STATUS.json dan evidence/v162/qa/binding.json.', '',
        'REGISTER_PEMETAAN_HISTORIS.csv menghubungkan 27 baris yang saling beririsan dengan '
        'hasil gerbang pengganti. Snapshot kandidat 1.6.1 tersimpan di evidence/v162/history-1.6.1/.', '',
        *['- ' + msg for msg in decision['issues']],
    ]
    return {'RELEASE_STATUS.json': json.dumps(decision, indent=2, ensure_ascii=False)+'\n',
            'STATUS_RILIS.md': '\n'.join(md).rstrip()+'\n',
            'REGISTER_OTOMATIS.csv': csv_text(fields + list(identity), [{**r,**identity} for r in rows]),
            'REGISTER_PEMETAAN_HISTORIS.csv': csv_text(list(historical[0]), historical)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--verify', action='store_true')
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args()
    root = args.root.resolve()
    try:
        decision, mapping, errors = evaluate(root)
        for filename, content in render(decision, mapping).items():
            path = root / filename
            if args.write:
                path.write_bytes(content.encode('utf-8'))
            else:
                require(path.read_bytes() == content.encode('utf-8'), 'stale decision or register: ' + filename)
        print(f"{decision['profile']} {decision['artifact_status']} / {decision['deployment_status']}")
        if errors:
            print('\n'.join(errors), file=sys.stderr)
            return 1
        return 0
    except (OSError, ValueError, TypeError, ImportError, KeyError, jsonschema.ValidationError) as exc:
        print('Release evidence rejected:', exc, file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
