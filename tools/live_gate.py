"""Collect or verify the optional public HTTPS deployment rehearsal. Never deploys a build."""
import argparse
from datetime import datetime, timezone
import hashlib
import http.client
import importlib.util
import ipaddress
import json
from pathlib import Path
import re
import socket
import ssl
import sys
import tempfile
import time
from urllib.parse import urlsplit
from uuid import uuid4
from zipfile import ZipFile

import qa_core

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tests/v162'))
from prior_161 import INVENTORY_SHA, OLD_RELEASE, file_hash, old_distribution, require
from update_161 import assess

PROOF = Path('evidence/v162/deployment/live.json')
PHASES = ('baseline', 'candidate', 'rollback', 'restore')
MIMALLOWED = {'.js': ('application/javascript', 'text/javascript', 'application/ecmascript'),
              '.mjs': ('application/javascript', 'text/javascript', 'application/ecmascript'),
              '.html': ('text/html',), '.woff': ('font/woff', 'application/font-woff'),
              '.json': ('application/json',), '.css': ('text/css',), '.svg': ('image/svg+xml',),
              '.webmanifest': ('application/manifest+json', 'application/json')}


def stamp():
    return datetime.now(timezone.utc).isoformat()


def valid_url(url):
    u = urlsplit(url)
    require(u.scheme == 'https' and u.hostname and u.hostname == u.hostname.encode('idna').decode()
            and not (u.username or u.password or u.query or u.fragment) and u.path.endswith('/')
            and re.fullmatch(r'/([A-Za-z0-9._~-]+/)*', u.path) and not {'.', '..'} & set(u.path.split('/')),
            'Supply the public HTTPS root/subdirectory with a trailing slash, without credentials, query or fragment.')
    try:
        ip = ipaddress.ip_address(u.hostname)
    except ValueError:
        require('.' in u.hostname and not u.hostname.endswith(('.test', '.invalid', '.localhost', '.local', '.internal', '.example')),
                'Expected a public host')
    else:
        require(ip.is_global, 'Public HTTPS host required')
    return u


def expected(root, old):
    historical = root / 'evidence/v162/history-1.6.1/FILE_INVENTORY.json'
    require(file_hash(historical) == INVENTORY_SHA, 'Historical inventory changed')
    prior = {row['path'][5:]: row for row in json.loads(historical.read_bytes())['files'] if row['path'].startswith('dist/')}
    if old:
        with ZipFile(root / 'tests/v162/fixtures/prior-1.6.1-assets.zip') as z:
            manifest_bytes = z.read('dist/offline-assets.json')
        require(hashlib.sha256(manifest_bytes).hexdigest() == prior['offline-assets.json']['sha256'], 'Invalid old manifest')
    else:
        manifest_bytes = (root / 'dist/offline-assets.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    pack = min(n for n in prior if n.startswith('bank/v1.2/') and n.endswith('.mjs'))
    paths = {a['path'] for a in manifest['assets']} | {'offline-assets.json', 'sw.js', pack, '404.html'}
    files = {}
    for name in paths:
        if old:
            files[name] = (prior[name]['sha256'], prior[name]['bytes'])
        else:
            p = root / 'dist' / name
            files[name] = (file_hash(p), p.stat().st_size)
    headers = (root / 'dist/_headers').read_text(encoding='utf8')
    require(hashlib.sha256(headers.encode()).hexdigest() == prior['_headers']['sha256'] or not old, 'Older headers fixture required')
    csp = next(v.strip().split(': ', 1)[1] for v in headers.splitlines() if v.strip().startswith('Content-Security-Policy: '))
    return manifest['release'], files, csp, pack


def get(url, relative, limit):
    u = valid_url(url)
    context = ssl.create_default_context()
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    with_connection = http.client.HTTPSConnection(u.hostname, u.port or 443, timeout=20, context=context)
    try:
        with_connection.connect()
        peer = with_connection.sock.getpeername()[0]
        require(ipaddress.ip_address(peer).is_global, 'TLS peer must have a public IP address')
        tls = {'peer': peer, 'version': with_connection.sock.version(),
               'certificate_sha256': hashlib.sha256(with_connection.sock.getpeercert(binary_form=True)).hexdigest()}
        path = u.path + relative
        with_connection.request('GET', path, headers={'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache'})
        response = with_connection.getresponse()
        if relative == 'index.html' and response.status in (301, 302, 307, 308):
            require(response.getheader('Location') in (url, u.path, './'), 'Unexpected index redirect')
            return get(url, '', limit)
        raw = response.read(limit + 1)
        require(len(raw) <= limit, f'Oversized response for {relative}')
        return {'path': relative, 'status': response.status, 'sha256': hashlib.sha256(raw).hexdigest(),
                'bytes': len(raw), 'mime': (response.getheader('Content-Type') or '').split(';')[0].strip().lower(),
                'csp': response.getheader('Content-Security-Policy'),
                'cache': response.getheader('Cache-Control'), 'nosniff': response.getheader('X-Content-Type-Options'), 'tls': tls}
    finally:
        with_connection.close()


def valid_sha(value):
    return isinstance(value, str) and re.fullmatch('[a-f0-9]{64}', value) is not None


def validate_stage(stage, want, url, phase):
    release, files, csp, pack = want
    require(stage['phase'] == phase and stage['url'] == url and stage['release'] == release, 'Release/phase mismatch')
    require(re.fullmatch(r'__kalibataku_missing_[a-f0-9]{32}', stage['absent']), 'Invalid 404 probe')
    records = stage['responses']
    wanted = set(files) - {'404.html'} | {stage['absent']}
    require(len(records) == len(wanted) and {item['requested'] for item in records} == wanted, 'Incomplete/duplicate HTTP responses')
    for item in records:
        name = item['requested']
        absent = name == stage['absent']
        canonical = '404.html' if absent else name
        require(item['path'] in ([name, ''] if name == 'index.html' else [name]), 'Unexpected redirected path')
        require(item['status'] == (404 if absent else 200) and (item['sha256'], item['bytes']) == files[canonical], f'Wrong response: {phase}/{name}')
        require(item['mime'] in MIMALLOWED[Path(canonical).suffix] and item['nosniff'].lower() == 'nosniff', f'Wrong MIME/nosniff: {name}')
        require(item['csp'] == csp, f'Wrong Content-Security-Policy: {name}')
        if name in (pack, 'sw.js', 'build-info.json', 'offline-assets.json'):
            tokens = {v.strip().lower() for v in str(item['cache']).split(',')}
            require(({'public','immutable','max-age=31536000'} if name == pack else {'public','max-age=0','must-revalidate'}) <= tokens,
                    f'Wrong release/immutable cache policy: {name}')
        tls = item['tls']
        require(ipaddress.ip_address(tls['peer']).is_global and tls['version'] in ('TLSv1.2','TLSv1.3') and valid_sha(tls['certificate_sha256']), 'Missing valid public TLS observation')


class PublicRollout:
    restore_candidate = True

    def __init__(self, url, timeout, stages, witnesses):
        self.base = url
        self.timeout = timeout
        self.stages = stages
        self.witnesses = witnesses
        self.unavailable = False

    def deploy(self, directory):
        phase = PHASES[len(self.stages)]
        old = phase in ('baseline','rollback')
        want = expected(ROOT, old)
        release, assets, _, _ = want
        require(file_hash(directory / 'sw.js') == assets['sw.js'][0], 'Unexpected requested release')
        print(f'{phase}: Serve {release} at {self.base} now. Waiting for its worker...', flush=True)
        deadline = time.monotonic() + self.timeout
        while True:
            try:
                current = get(self.base, 'sw.js', max(1_000_000, assets['sw.js'][1]))
                if current['status'] == 200 and current['sha256'] == assets['sw.js'][0]:
                    break
                last = f"HTTP {current['status']} SHA-256 {current['sha256']}"
            except (OSError, ValueError, http.client.HTTPException) as exc:
                last = str(exc)
            require(time.monotonic() < deadline, f'Timed out during {phase}: {last}')
            time.sleep(3)
        absent = '__kalibataku_missing_' + uuid4().hex
        stage = {'phase':phase, 'url':self.base, 'release':release, 'started':stamp(), 'absent':absent, 'responses':[]}
        for name in sorted(set(assets) - {'404.html'} | {absent}):
            effective = '404.html' if name == absent else name
            observed = get(self.base, name, assets[effective][1])
            stage['responses'].append({'requested':name, **observed})
        stage['finished'] = stamp()
        validate_stage(stage, want, self.base, phase)
        self.stages.append(stage)

    def offline_witness(self, ctx, page):
        worker = next(w for w in ctx.service_workers if w.url == self.base + 'sw.js')
        path = '__kalibataku_offline_' + uuid4().hex
        # A network fetch initiated inside a service worker bypasses its own fetch handler and cache routing.
        observation = worker.evaluate('''async url=>{try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(5000)});return {reachable:true,status:r.status}}catch(e){return {reachable:false,error:e.name}}}''', self.base + path)
        require(observation == {'reachable':False, 'error':'TypeError'}, 'Chromium worker retained network access or timed out in offline mode')
        self.witnesses.append({'phase':self.stages[-1]['phase'], 'url':self.base+path, 'worker':worker.url, **observation})

    def close(self):
        pass


def date(value):
    parsed = datetime.fromisoformat(value)
    require(parsed.tzinfo is not None, 'Missing time zone')
    return parsed


def validate(root, build, receipt):
    require(receipt['schema'] == 'kalibataku-public-rollout/1' and receipt['build'] == build and receipt['status'] == 'PASS', 'Invalid receipt, status or build')
    url = receipt['target_url']
    valid_url(url)
    stages = receipt['stages']
    require(len(stages) == 4 and date(receipt['started']) <= date(receipt['finished']) <= datetime.now(timezone.utc), 'Incomplete/future rollout')
    previous = date(receipt['started'])
    expected_old, expected_new = expected(root, True), expected(root, False)
    for phase, stage in zip(PHASES, stages, strict=True):
        validate_stage(stage, expected_old if phase in ('baseline','rollback') else expected_new, url, phase)
        require(previous <= date(stage['started']) <= date(stage['finished']) <= date(receipt['finished']), 'Stages out of order')
        previous = date(stage['finished'])
    witnesses = receipt['offline_witnesses']
    require([r['phase'] for r in witnesses] == ['candidate','rollback'] and len({r['url'] for r in witnesses}) == 2, 'Missing offline network probes')
    for row in witnesses:
        require(row['worker'] == url+'sw.js' and row['url'].startswith(url) and re.fullmatch(r'__kalibataku_offline_[a-f0-9]{32}', row['url'][len(url):]) and row['reachable'] is False and row['error']=='TypeError', 'Invalid offline network probe')
    browser = receipt['browser']
    require(browser['suite'] == 'public-update-rollback-restore' and browser['status'] == 'PASS' and browser['url'] == url
            and re.fullmatch(r'Chromium [\d.]+', browser['engine']) and browser['page_errors'] == [], 'Missing genuine browser rollout observations')
    require(date(stages[0]['finished']) <= date(browser['started']) <= date(stages[1]['started'])
            and date(stages[-1]['finished']) <= date(browser['completed']) <= date(receipt['finished']), 'Browser/stage times do not overlap')
    for key, want in [('baseline', expected_old), ('candidate', expected_new)]:
        artifact = browser[key]
        release, assets, _, _ = want
        require(artifact['release'] == release and all(artifact[name] == assets[path][0] for name,path in
                [('worker_sha256','sw.js'),('manifest_sha256','offline-assets.json'),('app_module_sha256','app.mjs')]), 'Browser/HTTP build hashes differ')
    failed = []
    assess(browser, build, lambda key, expected, observed, passed: failed.append(key) if not passed else None, root, live=True)
    require(not failed, f'Browser rollback observations failed: {failed}')
    baseline = browser['observations'][0]
    require(all(valid_sha(value) for value in baseline['snapshot'].values()), 'Missing frozen/question/event/response commitments')
    restore = browser['observations'][-1]
    cache = restore['cache']
    require(restore['release'] == build['offline_release'] and restore['two_clients'] == [OLD_RELEASE, OLD_RELEASE]
            and restore['completion_events'] == 1 and valid_sha(restore['before']) and restore['before'] == restore['after'], 'Restored build or completed data differ')
    require(cache['release'] == cache['installed_release'] == build['offline_release'] and cache['pack_sha256'] == baseline['cache']['pack_sha256']
            and cache['package'] == baseline['cache']['package'] and cache['shell_assets_verified'] == len(json.loads((root/'dist/offline-assets.json').read_bytes())['assets']), 'Incomplete restored offline cache')
    for r in browser['observations']:
        if 'cache' in r:
            package = r['cache']['package']
            paths = [p for p in (root/'dist/bank').rglob('*.mjs') if p.stem == package]
            require(len(paths)==1 and file_hash(paths[0]) == r['cache']['pack_sha256'], 'Browser loaded an unexpected package')


def verify_live(root, build):
    try:
        root = Path(root)
        validate(root, build, json.loads((root / PROOF).read_bytes()))
        return []
    except (ValueError, KeyError, IndexError, TypeError, AttributeError, OSError, RuntimeError) as exc:
        return [f'Invalid live evidence: {exc}']


def collect(url, wait_seconds):
    u = valid_url(url)
    # Revalidate the actual connected public peer before sending each independent GET.
    addresses = socket.getaddrinfo(u.hostname, u.port or 443, type=socket.SOCK_STREAM)
    require(addresses and all(ipaddress.ip_address(a[4][0]).is_global for a in addresses), 'Public DNS addresses required')
    require(wait_seconds > 0, 'Timeout must be positive')
    spec = importlib.util.spec_from_file_location('kalibataku_rollout', ROOT/'tests/v15/update-rollback-local.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    build = qa_core.identity(ROOT)
    receipt = {'schema':'kalibataku-public-rollout/1', 'target_url':url, 'build':build, 'started':stamp(),
               'stages':[], 'offline_witnesses':[], 'status':'FAIL'}
    server = PublicRollout(url, wait_seconds, receipt['stages'], receipt['offline_witnesses'])
    path = ROOT / PROOF
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with old_distribution() as (old, _), tempfile.TemporaryDirectory() as out:
            server.deploy(old)
            receipt['browser'] = module.exercise(old, ROOT/'dist', Path(out), server)
        receipt.update(status='PASS', finished=stamp())
        validate(ROOT, build, receipt)
    except BaseException as exc:
        receipt.update(status='FAIL', finished=stamp(), error=f'{type(exc).__name__}: {exc}')
        raise
    finally:
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False, mode='w', encoding='utf-8', newline='\n') as tmp:
            json.dump(receipt, tmp, indent=2, ensure_ascii=False)
            tmp.write('\n')
        Path(tmp.name).replace(path)
    print(f'Public rollout verified. Receipt: {path}')


if __name__ == '__main__':
    if not __debug__:
        raise SystemExit('Assertions must be enabled; clear PYTHONOPTIMIZE.')
    parser = argparse.ArgumentParser(description=__doc__)
    cmd = parser.add_subparsers(dest='action', required=True)
    probe = cmd.add_parser('collect', help='Observe operator-managed baseline, update, rollback and restoration at one actual public HTTPS URL')
    probe.add_argument('--url', required=True)
    probe.add_argument('--wait-seconds', type=int, default=1200, help='Wait for each operator-managed rollout, default 1200 seconds per phase')
    cmd.add_parser('verify', help='Check the saved live receipt against this package, offline')
    args = parser.parse_args()
    if args.action == 'collect':
        collect(args.url, args.wait_seconds)
    else:
        problems = verify_live(ROOT, qa_core.identity(ROOT))
        print('\n'.join(problems) if problems else 'PASS: public rollout evidence matches build')
        raise SystemExit(bool(problems))
