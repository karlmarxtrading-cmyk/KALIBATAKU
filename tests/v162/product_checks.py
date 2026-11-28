"""Observed local hosting, data-display boundaries, and operator documentation."""
import argparse
import hashlib
import json
import os
import re
import sys
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'dist'
sys.path.insert(0, str(ROOT / 'tools'))
from preview import make_handler


def stamp():
    return datetime.now(timezone.utc).isoformat()


def read_json(path):
    return json.loads(path.read_bytes())


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


class Results:
    def __init__(self):
        self.rows = []

    def observe(self, name, passed, expected, actual):
        self.rows.append(dict(id=name, status='PASS' if passed else 'FAIL', expected=expected, actual=actual))


@contextmanager
def serve(prefix):
    handler = make_handler(DIST, prefix)
    handler.func.log_message = lambda *args: None
    with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}{prefix}'
        finally:
            server.shutdown()
            thread.join()


def open_chromium(pw):
    return pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None)


def hosting(result):
    # Include the HTTP and locally trusted TLS observations from a fresh run.
    import importlib.util
    path = ROOT / 'tools/hosting-smoke.py'
    spec = importlib.util.spec_from_file_location('hosting_smoke', path)
    smoke = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(smoke)
    smoke.main()
    observed = read_json(ROOT / 'evidence/deployment/static-http-https.json')
    build = read_json(DIST / 'build-info.json')
    for case in observed['cases']:
        prefix = case['prefix']
        label = case['protocol'] + ('-subpath' if prefix != '/' else '-root')
        status = [r for r in case['responses'] if r['status'] == 404]
        result.observe(label, len(status) == 6 and case['verified_offline_assets'] > 0,
                       'Pages headers, MIME types and asset digests; branded GET / empty HEAD 404.', case)
    with sync_playwright() as pw:
        browser = open_chromium(pw)
        for name, prefix in [('root','/'), ('subpath','/sekolah/matematika/')]:
            with serve(prefix) as address:
                context = browser.new_context()
                page = context.new_page()
                page.goto(address)
                expect(page.locator('[data-cta=adventure]')).to_be_visible()
                worker = page.evaluate("""async () => {
                  const {registerOffline}=await import('./data/offline.js');
                  await registerOffline();
                  const reg=await navigator.serviceWorker.ready;
                  return {scope: reg.scope, script:reg.active.scriptURL, secure:window.isSecureContext};
                }""")
                result.observe(name+'-worker',worker['scope']==address and worker['script']==address+'sw.js' and worker['secure'],
                               'Browser registers a worker scoped to this served mount.',worker)
                response = page.request.get(address+'build-info.json')
                actual = response.json()
                result.observe(name+'-version',response.ok and actual==build and
                               response.headers.get('x-content-type-options')=='nosniff',
                               'The version served at the mount equals the local build manifest.',actual)
                context.close()
        browser.close()


def public_members():
    sources = ROOT / 'src'
    expected = {p.relative_to(sources) for p in sources.rglob('*') if p.is_file()}
    expected.update(Path(name) for name in ('offline-assets.json','build-info.json'))
    # Add only the authenticated bank paths, using the pre-existing 1.6.1 inventory.
    inventory = read_json(ROOT / 'evidence/v161/baseline-1.6.0/registers/FILE_INVENTORY.json')
    bank = {Path(item['path']).relative_to('dist') for item in inventory['files'] if item['path'].startswith('dist/bank/')}
    assert len(bank)==4677
    return expected | bank


def restricted(rel):
    banned = {'.git','.env','tests','evidence','release-authorization','VALIDASI_EKSTERNAL','node_modules','factory','spec'}
    return (bool(banned.intersection(rel.parts)) or rel.suffix.lower() in {'.pem','.key','.docx','.zip','.pdf','.csv'}
            or any(part.startswith('.env.') for part in rel.parts))


def boundaries(result):
    files={p.relative_to(DIST) for p in DIST.rglob('*') if p.is_file()}
    expected=public_members()
    diff=sorted(p.as_posix() for p in expected.symmetric_difference(files))
    result.observe('public-allowlist',not diff,'Only shipped source assets, build metadata and the pinned public bank are present.',
                   {'files':len(files),'differences':diff})
    bad=[p.as_posix() for p in sorted(files) if restricted(p)]
    result.observe('publication-excludes-private-input',not bad,'No fixture, backup, key or private evidence paths in deployment.',bad)
    controls=['.env.staging','backups/demo.zip','evidence/results.json','server.key','release-authorization/foo.json']
    result.observe('publication-boundary-controls', all(restricted(Path(p)) for p in controls),
                   'Reject each inert private filename fixture.', controls)
    # Do not store matched credential text anywhere.
    private_mark = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{32,}')
    suspected=[p.as_posix() for p in sorted(files) if private_mark.search((DIST/p).read_bytes())]
    result.observe('public-secret-patterns',not suspected,'No matches for supported secret signatures in public files.',suspected)
    marker='<em data-synthetic-label>Simulasi 27</em>'
    with sync_playwright() as pw:
        browser=open_chromium(pw)
        with serve('/') as address:
            page=browser.new_page()
            page.goto(address+'#/profiles')
            expect(page.locator('.app-view:not([aria-busy]) select')).to_be_visible()
            checks=page.evaluate("""async marker => {
              const store=await import('./data/store.js');
              const row=await store.createProfile(marker);
              const rejects=[];
              for (const s of [' '.repeat(5),'x'.repeat(81)]) {
                try {await store.createProfile(s);rejects.push(false)} catch(e) {rejects.push(true)}
              }
              return {id:row.id, rejects}
            }""", marker)
            page.reload()
            option=page.locator('option').filter(has_text='Simulasi 27')
            expect(option).to_have_text(marker)
            result.observe('profile-displays-literal',option.get_attribute('value')==checks['id'] and
                           page.locator('[data-synthetic-label]').count()==0,'The saved label is presented as literal text.',
                           {'text':option.inner_text(),'elements_created_from_label':page.locator('[data-synthetic-label]').count()})
            result.observe('profile-length-boundaries',all(checks['rejects']),'Empty and oversized names are rejected.',checks['rejects'])
        browser.close()


def package_docs(result):
    guides={'start':'00_MULAI_DI_SINI.txt','student':'docs/PANDUAN_SISWA.md','teacher':'docs/PANDUAN_GURU.md',
            'deploy':'docs/DEPLOY.md','recovery':'docs/PANDUAN_CADANGAN_OFFLINE.md','support':'KNOWN_LIMITATIONS.md',
            'changelog':'CHANGELOG_1.6.2.md'}
    requirements={
        'start':('1.6.2','dist','python','ARTIFACT_READY'),'student':('enter','misi','jawaban'),
        'teacher':('profil','laporan','pdf'),'deploy':('github','cloudflare','dist','git bash','rollback'),
        'recovery':('backup','restore','profil','offline'),'support':('webkit','word','windows','android','ios'),
        'changelog':('1.6.2','ARTIFACT_READY')}
    for key, name in guides.items():
        path=ROOT/name
        body=path.read_text(encoding='utf-8')
        missing=[s for s in requirements[key] if s.casefold() not in body.casefold()]
        links=re.findall(r'\]\(([^)\s]+)\)',body)
        broken=[url for url in links if not urlparse(url).scheme and not url.startswith('#')
                and not (path.parent/unquote(url.split('#')[0])).exists()]
        result.observe('guide-'+key,not missing and not broken,'Operator material includes required topics and local links resolve.',
                       {'path':name,'sha256':sha(path),'missing_topics':missing,'missing_links':broken})


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    functions={'hosting-static':hosting,'static-data-boundaries':boundaries,'package-docs':package_docs}
    parser.add_argument('suite',choices=functions)
    parser.add_argument('out',type=Path)
    args=parser.parse_args()
    result=Results()
    start=stamp()
    try:
        functions[args.suite](result)
    except Exception:
        import traceback
        result.observe('execution',False,'Complete all observations.',traceback.format_exc())
    build=read_json(DIST/'build-info.json')
    build['offline_release']=read_json(DIST/'offline-assets.json')['release']
    passed=bool(result.rows) and all(r['status']=='PASS' for r in result.rows)
    data=dict(schema='kalibataku-qa-receipt/1',suite=args.suite,build=build,
              started=start,finished=stamp(),checks=result.rows,assertions=len(result.rows),
              status='PASS' if passed else 'FAIL',scope='Local deterministic package and browser checks; synthetic profiles.')
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(data['status'],args.suite,len(result.rows),[row['id'] for row in result.rows if row['status']!='PASS'])
    sys.exit(0 if passed else 1)
