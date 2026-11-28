"""Strict QA gate primitives for KALIBATAKU (TECH-02).

Principles
- A suite passes only when its process exits 0 AND every receipt it declares exists, was
  produced during this run, holds at least the declared number of evaluated assertions,
  has no FAIL row and no recorded error, and names the build that is being certified.
- Legacy suites without receipts are counted from their actual output lines; zero
  matches is a failure, never a default PASS.
- BLOCKED_ENV is a separate outcome. It is accepted only for suites that declare that an
  environment can block them, and it never turns the overall gate into PASS.
- The binding stores SHA-256 of every receipt and log. `verify_binding` re-reads all of
  them, re-validates every receipt against the committed registry, recomputes the
  distribution hash and compares the runtime. Any difference rejects the binding.
"""
import hashlib, json, os, platform, re, shutil, subprocess, sys, time
from pathlib import Path

SCHEMA = 'kalibataku-qa-receipt/1'
BINDING_SCHEMA = 'kalibataku-qa-binding/1'
ROW_STATES = {'PASS', 'FAIL', 'BLOCKED_ENV'}


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def sha256_file(p):
    with open(p, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def tree_hash(folder):
    h = hashlib.sha256()
    for p in sorted((x for x in Path(folder).rglob('*') if x.is_file() and '__pycache__' not in x.parts and x.suffix != '.pyc'), key=lambda p:p.relative_to(folder).parts):
        h.update(f"{sha256_file(p)}  {p.relative_to(folder).as_posix()}\n".encode())
    return h.hexdigest()


def _version(cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=30).stdout.strip().splitlines()[0]
    except Exception:
        return None


def runtime():
    chrome = os.environ.get('CHROMIUM_PATH')
    try:
        import importlib.metadata as md
        pw = md.version('playwright')
    except Exception:
        pw = None
    return {'node': _version(['node', '--version']), 'python': platform.python_version(),
            'os': platform.platform(), 'chromium': _version([chrome, '--version']) if chrome else None, 'playwright': pw}


def policy_identity(root):
    directory = Path(root) / 'docs/contracts/static-auto-v1'
    names = {'profile_sha256': 'profile.json', 'mapping_sha256': 'historical-mapping.json',
             'history_index_sha256': 'history-sha256.json', 'findings_sha256': 'findings.json'}
    return {'profile_id': 'KALIBATAKU_STATIC_AUTO_V1',
            **{key: sha256_file(directory / name) for key, name in names.items()}}


def identity(root):
    dist = Path(root) / 'dist'
    manifest = json.loads((dist / 'offline-assets.json').read_bytes())
    info = json.loads((dist / 'build-info.json').read_bytes()) if (dist / 'build-info.json').is_file() else {}
    identity = {'dist_tree_sha256': tree_hash(dist), 'offline_release': manifest['release'],
                'app_version': info.get('app_version'), 'bank_version': info.get('bank_version')}
    if (Path(root) / 'package.json').is_file():
        from project import release_sources, tree_hash as source_hash
        identity['source_tree_sha256'] = source_hash(Path(root), release_sources(Path(root)))
    return identity


# Version-one legacy adapters are selected by the committed suite registry. Legacy
# measurements have no assertion IDs; their explicit observation formats are separate
# from the versioned assertion-row contract.
LEGACY_ROW_SUITES = {'e2e-browser', 'ux-extended-browser', 'v12-browser-chromium'}
SAMPLE_KEYS = {
    'v12-bank-model': 'fixtures', 'v12-keyboard': 'events',
    'v12-print-contrast': 'contrast', 'v12-roles-reflow': 'samples',
    'clean-build-twice': 'runs', 'viewed-coverage': 'cases',
}


def rows_of(data):
    """Access assertion objects for reports. Acceptance always uses validate_receipt."""
    if not isinstance(data, dict):
        return []
    return [row for key in ('checks', 'results') if isinstance(data.get(key), list)
            for row in data[key] if isinstance(row, dict)]


def receipt_build(data):
    rt = data.get('runtime') if isinstance(data.get('runtime'), dict) else {}
    b = data.get('build')
    if isinstance(b, dict):
        return b.get('offline_release')
    return b or rt.get('offline_release') or rt.get('release') or data.get('release') or data.get('offline_release')


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def _fields(data, names):
    return isinstance(data, dict) and all(nonempty(data.get(k)) for k in names)


def _positive(value):
    return type(value) is int and value > 0


def _observation(key, row, receipt, ident):
    """Return (valid, stable observation key). Repeated keyboard events are expected."""
    if not isinstance(row, dict):
        return False, None
    if 'status' in row and row['status'] != 'PASS':
        return False, None
    if key == 'fixtures':
        labels = all(_fields(row.get(lang), ('text', 'speech', 'mathml')) for lang in ('id', 'en'))
        valid = labels and _fields(row.get('exact'), ('numerator', 'denominator'))
        return valid, row['id']['text'] if valid else None
    if key == 'events':
        valid = nonempty(row.get('target')) and (row.get('type') == 'focus' or
                (row.get('type') == 'keydown' and nonempty(row.get('key')) and row.get('trusted') is True
                 and type(row.get('shift')) is bool and isinstance(row.get('before'), dict)))
        return valid, None
    if key == 'contrast':
        samples = row.get('samples')
        valid = row.get('theme') in ('light', 'dark') and isinstance(samples, list) and bool(samples)
        valid = valid and all(_fields(s, ('selector', 'fg', 'bg')) and type(s.get('ratio')) in (int, float)
                              and s['ratio'] >= (3 if s['selector'] == 'keyboard focus' else 4.5) for s in samples)
        return valid, row.get('theme') if valid else None
    if key == 'samples':
        dims = ('width', 'text_percent', 'scroll', 'viewport', 'innerWidth')
        valid = (_fields(row, ('page', 'lang', 'theme', 'method')) and all(_positive(row.get(k)) for k in dims)
                 and isinstance(row.get('overflow'), list) and row['scroll'] <= row['viewport'] + 2
                 and row['innerWidth'] == row['width'])
        return valid, tuple(row[k] for k in ('page', 'lang', 'theme', 'width', 'text_percent')) if valid else None
    if key == 'runs':
        digest = row.get('sha256')
        valid = (_fields(row, ('run', 'sha256', 'log')) and re.fullmatch('[0-9a-f]{64}', digest) is not None
                 and digest == receipt.get('dist_sha256') == ident.get('dist_tree_sha256')
                 and _positive(row.get('files')) and row['files'] == receipt.get('files'))
        return valid, row.get('run') if valid else None
    if key == 'cases':
        valid = nonempty(row.get('name')) and 'actual' in row and 'expected' in row
        valid = valid and json.dumps(row['expected'], sort_keys=True) == json.dumps(row['actual'], sort_keys=True)
        return valid, row.get('name') if valid else None
    return False, None


def state_of(states):
    if not states or any(state not in ('PASS', 'BLOCKED_ENV') for state in states):
        return 'FAIL'
    return 'BLOCKED_ENV' if 'BLOCKED_ENV' in states else 'PASS'


PRODUCER_ALIASES = {
    'bank-domain-prose': 'MATH-002-domain-prose',
    'math-linear-roundtrip': 'MATH-001-linear-roundtrip', 'math-exports': 'MATH-001-exports',
    'data-large-backup': 'TECH-01-large-backup', 'data-cache-policy': 'TECH-04-cache-policy',
    'upgrade-bank-1.2': 'UPGRADE-app1.2.0-bank1.1.0', 'qa-fault-injection': 'TECH-02-fault-injection',
    'map-native-zoom': 'firefox-map-native-zoom',
}


def _check_producer(data, suite, source, canonical):
    if canonical:
        if not nonempty(suite):
            return ['suite registry identity missing']
        expected = PRODUCER_ALIASES.get(suite, suite)
        if suite.startswith('journey-browser-'):
            expected = 'journey-browser'
            rt = data.get('runtime')
            if not isinstance(rt, dict) or rt.get('browser') != suite.removeprefix('journey-browser-'):
                return ['receipt browser differs from registered suite']
        if data.get('suite') != expected:
            return ['receipt producer differs from registered suite']
        if 'results' in data:
            return ['canonical assertion rows belong in checks']
    elif suite in ('e2e-browser', 'ux-extended-browser'):
        if source is None or data.get('suite') != Path(source).stem.removeprefix('browser-'):
            return ['legacy receipt producer differs from registered file']
    elif suite == 'v12-browser-chromium' and data.get('engine') != 'chromium':
        return ['legacy receipt browser differs from registered suite']
    return []


def validate_receipt(data, spec, ident, produced_after=None, mtime=None, source=None):
    """Count only typed, uniquely identified assertions or registered observations."""
    if not isinstance(data, dict):
        return 'FAIL', 0, ['receipt is not a JSON object']
    problems, states, seen = [], [], set()
    canonical = data.get('schema') == SCHEMA
    suite = spec.get('id')
    sample_key = spec.get('sample_key')
    if source is None and len(spec.get('receipts', [])) == 1:
        source = spec['receipts'][0]
    problems.extend(_check_producer(data, suite, source, canonical))
    if produced_after is not None and (mtime is None or mtime < produced_after - 1):
        problems.append('receipt was not produced by this run')
    legacy = 'schema' not in data and (suite in LEGACY_ROW_SUITES or suite in SAMPLE_KEYS)
    if not canonical and not legacy:
        problems.append('unsupported or missing receipt schema')
    if spec.get('assertion_field'):
        problems.append('counter-only receipts do not establish evaluated assertions')
    if sample_key:
        if not legacy or SAMPLE_KEYS.get(suite) != sample_key or 'checks' in data or 'results' in data:
            problems.append('unregistered or conflicting legacy sample format')
        samples = data.get(sample_key)
        if not isinstance(samples, list):
            problems.append('legacy observations must be an array')
        else:
            for i, sample in enumerate(samples):
                valid, key = _observation(sample_key, sample, data, ident)
                if not valid or (key is not None and key in seen):
                    problems.append(f'{sample_key}[{i}]: malformed or duplicate observation')
                    continue
                seen.add(key)
                states.append('PASS')
            if sample_key == 'events':
                keys = sum(1 for row in samples if isinstance(row, dict) and row.get('type') == 'keydown'
                           and row.get('trusted') is True)
                if not _same_count(data.get('trustedKeystrokes'), keys) or keys < 8:
                    problems.append('trusted keyboard count does not match the measured sequence')
    else:
        if canonical and not isinstance(data.get('checks'), list):
            problems.append('checks must be an array')
        for field in ('checks', 'results'):
            if field not in data:
                continue
            if not isinstance(data[field], list):
                problems.append(f'{field} must be an array')
                continue
            for i, row in enumerate(data[field]):
                if not isinstance(row, dict) or not nonempty(row.get('id')):
                    problems.append(f'{field}[{i}]: assertion must be an object with a nonempty string id')
                    continue
                key = row['id'].strip()
                if key in seen:
                    problems.append(f'{field}[{i}]: duplicate assertion id {key!r}')
                    continue
                seen.add(key)
                state = row.get('status')
                if not isinstance(state, str) or state not in ROW_STATES:
                    problems.append(f'{field}[{i}]: unknown or missing assertion status')
                    continue
                states.append(state)
                if state == 'FAIL':
                    problems.append(f'failed assertions: {key}')
                if state == 'PASS' and (row.get('error') or row.get('errors')):
                    problems.append(f'{field}[{i}]: PASS assertion contains errors')
    n = len(states)
    if n == 0:
        problems.append('empty receipt: no evaluated assertions')
    if n < spec.get('min_assertions', 1):
        problems.append(f"only {n} assertions, registry requires {spec.get('min_assertions', 1)}")
    for key in ('errors', 'page_errors', 'run_errors'):
        if key in data and (not isinstance(data[key], list) or data[key]):
            problems.append(f'{key}: expected an empty array')
    if data.get('error'):
        problems.append('receipt contains an error')
    derived = state_of(states)
    status_required = canonical or (sample_key and spec.get('status_required', True))
    if (status_required or 'status' in data) and data.get('status') != derived:
        problems.append(f"declared status {data.get('status')} differs from rows ({derived})")
    if canonical or 'assertions' in data:
        if type(data.get('assertions')) is not int or data['assertions'] != n:
            problems.append('assertion count does not match evaluated rows')
    b = receipt_build(data)
    if (spec.get('requires_build', True) or b is not None) and b != ident.get('offline_release'):
        problems.append(f"receipt build {b} is not the certified build {ident.get('offline_release')}")
    if ('runtime' in data and not isinstance(data['runtime'], dict)
            and not (legacy and suite == 'viewed-coverage' and nonempty(data['runtime']))):
        problems.append('runtime metadata must be an object')
    runtime_fields = data['runtime'] if isinstance(data.get('runtime'), dict) else {}
    for location in (data, runtime_fields):
        for k in ('release', 'offline_release'):
            if k in location and location[k] != ident.get('offline_release'):
                problems.append(f'conflicting receipt build identity: {k}')
    if isinstance(data.get('build'), dict):
        for k in ('app_version', 'bank_version', 'dist_tree_sha256', 'source_tree_sha256'):
            if k in data['build'] and data['build'][k] != ident.get(k):
                problems.append(f'receipt build identity differs: {k}')
    if derived == 'BLOCKED_ENV' and not spec.get('allow_blocked'):
        problems.append('BLOCKED_ENV not permitted for this suite')
    if problems:
        return 'FAIL', n, problems
    if derived == 'BLOCKED_ENV':
        return derived, n, ['environment-blocked rows']
    return derived, n, []


def _read_json(raw):
    def unique_fields(pairs):
        obj = {}
        for key, value in pairs:
            if key in obj:
                raise ValueError(f'duplicate JSON field {key}')
            obj[key] = value
        return obj

    def invalid_number(value):
        raise ValueError(f'invalid JSON number {value}')

    return json.loads(raw, object_pairs_hook=unique_fields, parse_constant=invalid_number)


def count_output(text, spec):
    pattern = spec.get('count_pattern')
    n = len(re.findall(pattern, text, flags=re.M)) if pattern else 0
    problems = []
    if spec.get('fail_pattern') and re.search(spec['fail_pattern'], text, flags=re.M):
        problems.append('failure marker present in output')
    if n == 0:
        problems.append('no assertion lines matched; an empty suite cannot pass')
    if n < spec.get('min_assertions', 1):
        problems.append(f"only {n} assertion lines, registry requires {spec.get('min_assertions', 1)}")
    return n, problems


def run_suite(spec, work, out, ident, env=None, timeout=1800):
    """Run one registered suite in the sandbox `work` and copy its outputs to `out/<id>/`."""
    target = Path(out) / spec['id']
    shutil.rmtree(target, ignore_errors=True)
    target.mkdir(parents=True)
    env = {**os.environ, **(env or {}), 'KALIBATAKU_RECEIPTS': str(Path(work) / 'evidence/v13/receipts')}
    cmd = [sys.executable if a == '{python}' else a for a in spec['command']]
    for rel in spec.get('receipts', []):
        (Path(work) / rel).unlink(missing_ok=True)
    started = time.time()
    try:
        proc = subprocess.run(cmd, cwd=work, env=env, capture_output=True, text=True, timeout=spec.get('timeout', timeout))
        code, text = proc.returncode, proc.stdout + ('\n[stderr]\n' + proc.stderr if proc.stderr else '')
    except subprocess.TimeoutExpired as e:
        code, text = 124, f'TIMEOUT after {e.timeout}s\n' + (e.stdout or '' if isinstance(e.stdout, str) else '')
    elapsed = round(time.time() - started, 2)
    (target / 'log.txt').write_text(text,encoding='utf-8',newline='\n')
    result = {'id': spec['id'], 'command': cmd[:1] and spec['command'], 'exit_code': code, 'seconds': elapsed,
              'log': f"{spec['id']}/log.txt", 'log_sha256': sha256_file(target / 'log.txt'), 'receipts': [], 'problems': []}
    result['started_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(started))
    result['finished_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    states, total = [], 0
    if spec.get('count_pattern'):
        n, probs = count_output(text, spec)
        total += n
        result['problems'] += probs
        states.append('FAIL' if probs else 'PASS')
    for rel in spec.get('receipts', []):
        src = Path(work) / rel
        if not src.is_file():
            result['problems'].append(f'missing receipt {rel}')
            states.append('FAIL')
            continue
        raw = src.read_bytes()
        dest = target / Path(rel).name
        dest.write_bytes(raw)
        try:
            data = _read_json(raw)
        except Exception:
            data = None
        state, n, probs = validate_receipt(data, spec, ident, produced_after=started, mtime=src.stat().st_mtime, source=rel)
        total += n
        states.append(state)
        result['problems'] += [f'{rel}: {p}' for p in probs]
        result['receipts'].append({'source': rel, 'file': f"{spec['id']}/{dest.name}", 'sha256': sha256_bytes(raw), 'state': state, 'assertions': n})
    if not states:
        result['problems'].append('suite declares neither receipts nor an assertion pattern')
        states.append('FAIL')
    result['assertions'] = total
    result['status'] = _suite_state(spec, states, code, result['problems'])
    if result['status'] == 'BLOCKED_ENV':
        result['problems'] = [p for p in result['problems'] if 'environment-blocked' in p] or result['problems']
    return result


def _suite_state(spec, states, code, problems):
    state = state_of(states)
    if type(code) is not int or (code != 0 and not (code == 3 and spec.get('allow_blocked') and state == 'BLOCKED_ENV')):
        problems.append(f'exit code {code} incompatible with evidence ({state})')
        return 'FAIL'
    return state


def overall(results):
    return state_of([r.get('status') if isinstance(r, dict) else None for r in results])


def _same_count(declared, measured):
    return type(declared) is int and declared == measured


def _check_suite(out, spec, result, ident):
    """Read the registered files independently of the claimed status and count."""
    sid = spec['id']
    problems, states = [], []
    count = 0
    if result.get('command') != spec['command']:
        problems.append('command differs from registry')
    log_rel = f'{sid}/log.txt'
    log = out / log_rel
    if result.get('log') != log_rel or not log.is_file() or sha256_file(log) != result.get('log_sha256'):
        problems.append('log missing or modified')
    elif spec.get('count_pattern'):
        n, errors = count_output(log.read_text(encoding='utf-8'), spec)
        count += n
        states.append('FAIL' if errors else 'PASS')
        problems.extend(errors)
    records = result.get('receipts')
    if not isinstance(records, list) or not all(isinstance(r, dict) for r in records):
        problems.append('receipt records must be an array of objects')
        records = []
    sources = spec.get('receipts', [])
    if [r.get('source') for r in records] != sources:
        problems.append('receipt list differs from registry')
    for rel, record in zip(sources, records):
        archive_rel = f'{sid}/{Path(rel).name}'
        path = out / archive_rel
        if record.get('file') != archive_rel or not path.is_file() or sha256_file(path) != record.get('sha256'):
            problems.append(f'receipt {archive_rel} missing or modified')
            states.append('FAIL')
            continue
        try:
            data = _read_json(path.read_bytes())
        except (ValueError, UnicodeError):
            data = None
        state, n, errors = validate_receipt(data, spec, ident, source=rel)
        count += n
        states.append(state)
        if not _same_count(record.get('assertions'), n) or state != record.get('state'):
            problems.append('recorded receipt count or state differs from file')
        if state == 'FAIL':
            problems.extend(errors)
    if not _same_count(result.get('assertions'), count):
        problems.append('assertion count differs from log and receipts')
    state = _suite_state(spec, states, result.get('exit_code'), problems)
    if result.get('status') != state:
        problems.append(f"recorded status {result.get('status')} differs from evidence ({state})")
    if state == 'FAIL':
        problems.append('suite status FAIL not accepted')
    return ('FAIL' if problems else state), count, problems


def _check_results(out, registry, results, ident, diagnostic=False):
    items = registry['suites']
    if not isinstance(items, list) or not all(isinstance(s, dict) and nonempty(s.get('id')) for s in items):
        return 'FAIL', 0, ['invalid suite registry identities']
    specs = {s['id']: s for s in items}
    if len(specs) != len(items):
        return 'FAIL', 0, ['duplicate suite in registry']
    seen, states, problems = set(), [], []
    total = 0
    if not isinstance(results, list):
        return 'FAIL', 0, ['binding suites must be an array']
    for result in results:
        sid = result.get('id') if isinstance(result, dict) else None
        if not nonempty(sid) or sid not in specs:
            problems.append(f'suite {sid} is not in the registry')
            continue
        if sid in seen:
            problems.append(f'{sid}: duplicate suite result')
            continue
        seen.add(sid)
        state, count, errors = _check_suite(out, specs[sid], result, ident)
        states.append(state)
        total += count
        problems.extend(f'{sid}: {error}' for error in errors)
    missing = [sid for sid, spec in specs.items() if spec.get('required', True) and sid not in seen]
    if missing and not diagnostic:
        problems.append(f'required suites missing from binding: {missing}')
    if not states:
        problems.append('binding contains no evaluated suites')
    return ('FAIL' if problems else state_of(states)), total, problems


def write_binding(out, registry, results, ident, rt, registry_sha, diagnostic=False, policy=None):
    out = Path(out)
    state, count, errors = _check_results(out, registry, results, ident, diagnostic)
    binding = {'schema': BINDING_SCHEMA, 'created_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
               'status': state, 'build': ident, 'runtime': rt, 'registry_sha256': registry_sha,
               'suites': results, 'assertions': count}
    if policy is not None:
        binding['release_policy'] = policy
    if errors:
        binding['problems'] = errors
    if diagnostic:
        binding['diagnostic'] = True
    (out / 'binding.json').write_text(json.dumps(binding, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    return binding


def verify_binding(root, out, registry_path, rt=None, check_runtime=True):
    """Re-validate the release binding from its registry, payload and evidence files."""
    out = Path(out)
    problems = []
    try:
        binding = _read_json((out / 'binding.json').read_bytes())
        reg_bytes = Path(registry_path).read_bytes()
        registry = _read_json(reg_bytes)
        ident = identity(Path(root))
    except (OSError, ValueError, KeyError, TypeError) as error:
        return [f'binding or certification inputs unreadable: {error}']
    if not isinstance(binding, dict) or binding.get('schema') != BINDING_SCHEMA:
        return ['binding schema']
    if binding.get('diagnostic'):
        problems.append('diagnostic binding cannot certify a release')
    if binding.get('registry_sha256') != sha256_bytes(reg_bytes):
        problems.append('binding was produced with a different suite registry')
    if ident.get('app_version') == '1.6.2' and (Path(root) / 'package.json').is_file():
        try:
            if binding.get('release_policy') != policy_identity(root):
                problems.append('binding release profile, history, mapping or findings identity differs')
        except OSError:
            problems.append('missing release policy inputs')
        if not isinstance(binding.get('runtime'), dict) or not all(nonempty(binding['runtime'].get(k)) for k in ('node', 'os', 'python')):
            problems.append('software runtime information is incomplete')
        timestamp = r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z'
        if not re.fullmatch(timestamp, str(binding.get('created_utc'))):
            problems.append('missing run timestamp')
        for result in binding.get('suites', []) if isinstance(binding.get('suites'), list) else []:
            if not isinstance(result, dict):
                continue
            start, end = result.get('started_utc'), result.get('finished_utc')
            if (not all(isinstance(t, str) and re.fullmatch(timestamp, t) for t in (start, end))
                    or start > end or end > str(binding.get('created_utc'))):
                problems.append(f"invalid run period: {result.get('id')}")
            if result.get('status') == 'PASS' and result.get('problems') != []:
                problems.append(f"PASS result contains errors: {result.get('id')}")
        if binding.get('status') == 'PASS' and binding.get('problems'):
            problems.append('PASS binding contains unresolved problems')
    if binding.get('build') != ident:
        problems.append('stale binding: recorded build identity differs from current payload')
    recorded_runtime = binding.get('runtime')
    if not isinstance(recorded_runtime, dict):
        problems.append('runtime missing')
    elif check_runtime:
        rt = runtime() if rt is None else rt
        for k in rt:
            if k not in recorded_runtime or recorded_runtime[k] != rt[k]:
                problems.append(f'runtime differs: {k}')
    try:
        state, count, errors = _check_results(out, registry, binding.get('suites'), ident)
    except (OSError, UnicodeError, ValueError, KeyError, TypeError) as error:
        return problems + [f'unreadable certification evidence: {error}']
    problems.extend(errors)
    if not _same_count(binding.get('assertions'), count):
        problems.append('binding assertion total differs from measured suites')
    if binding.get('status') != state:
        problems.append(f'binding overall status differs from its suites ({state})')
    return problems
