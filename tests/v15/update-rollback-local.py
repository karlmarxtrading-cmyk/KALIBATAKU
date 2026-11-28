"""Run two real builds at one loopback origin, retaining browser storage throughout."""
import argparse
from datetime import datetime, timezone
import hashlib
from functools import partial
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
import platform
import sys
from threading import Thread
import time
import traceback

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from preview import make_handler
from qa_core import tree_hash


class ReleaseServer(ThreadingHTTPServer):
    def __init__(self, directory):
        super().__init__(('127.0.0.1', 0), make_handler(directory, '/app/'))
        self.deploy(directory)
        self.unavailable = False
        self.base = f'http://127.0.0.1:{self.server_port}/app/'
        self.thread = Thread(target=self.serve_forever, daemon=True)
        self.thread.start()

    def deploy(self, directory):
        handler = make_handler(directory, '/app/')
        handler.func.log_message = lambda *unused: None
        # Immutable release roots may share second-resolution mtimes. Supply a
        # content-based validators for release metadata, so 304s track its bytes.
        static = handler.func
        validators={ '/app/'+name: '"'+hashlib.sha256((directory/name).read_bytes()).hexdigest()+'"'
                     for name in ('sw.js','offline-assets.json','build-info.json','index.html','cache-policy.js')}
        class ReleaseFiles(static):
            def send_head(self):
                validator=validators.get(self.path)
                if validator:
                    if self.headers.get('If-None-Match') == validator:
                        self.send_response(304)
                        self.end_headers()
                        return None
                    if 'If-Modified-Since' in self.headers:
                        del self.headers['If-Modified-Since']
                return super().send_head()

            def end_headers(self):
                if self.path in validators:
                    self.send_header('ETag', validators[self.path])
                super().end_headers()
        self.RequestHandlerClass = partial(ReleaseFiles, **handler.keywords)

    def verify_request(self, request, address):
        return not self.unavailable

    def close(self):
        self.shutdown()
        self.server_close()
        self.thread.join()


def wait_for(observe, condition, timeout=18):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        value = observe()
        if condition(value):
            return value
        time.sleep(.12)
    raise AssertionError(f'Condition timed out, last value {value!r}')


def artifact(directory):
    manifest = (directory / 'offline-assets.json').read_bytes()
    info = json.loads((directory / 'build-info.json').read_bytes())
    return {'release': json.loads(manifest)['release'], 'app': info['app_version'], 'dist_tree_sha256':tree_hash(directory),
            'manifest_sha256': hashlib.sha256(manifest).hexdigest(),
            'worker_sha256': hashlib.sha256((directory / 'sw.js').read_bytes()).hexdigest(),
            'app_module_sha256': hashlib.sha256((directory / 'app.mjs').read_bytes()).hexdigest()}


def worker_release(page):
    return page.evaluate("""async()=>{
        const worker=navigator.serviceWorker.controller;if(!worker)return null;
        return new Promise(resolve=>{const ch=new MessageChannel(),t=setTimeout(()=>resolve(null),2000);
          ch.port1.onmessage=e=>{clearTimeout(t);resolve(e.data.release)};
          worker.postMessage({type:'kalibataku-gc'},[ch.port2]);});}""")


def snapshot(page, attempt):
    return page.evaluate("""async id=>{const store=await import('./data/store.js');
      const s=await store.getAttempt(id,store.activeScope());const e=await store.listEvents(id,store.activeScope());
      return {frozen:[s.attempt_id,s.profile_id,s.package_id,s.order_seed,s.journey,s.items.map(i=>[i.question_instance_id,i.occurrence_ref,i.question])],
        events:e.map(x=>[x.event_id,x.event_type,x.payload_hash]),responses:s.items.map(i=>i.history),draft:s.items[s.index].draft,
        index:s.index,status:s.status};}""", attempt)


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def certify_cache(page, release, pack):
    result = page.evaluate("""async({release,pack})=>{
      const ns='kalibataku:'+new URL('./',location.href).pathname+':', names=await caches.keys();
      const records=await (await import('./data/offline.js')).inspectInstalled();
      const target=records.find(r=>r.id===pack&&r.shellCache===ns+'shell:'+release);
      if(!target)throw Error('Missing install for '+pack+' at '+release);
      const shell=await caches.open(target.shellCache),cache=await caches.open(target.packCache);
      const marker=await (await shell.match(new URL('offline-assets.json',location.href))).json();
      async function hash(response){const body=await response.arrayBuffer(),sha=await crypto.subtle.digest('SHA-256',body);
        return {bytes:body.byteLength,sha256:Array.from(new Uint8Array(sha),x=>x.toString(16).padStart(2,'0')).join('')};}
      if(marker.release!==release)throw Error('Wrong shell marker');
      let checked=0;
      for(const asset of marker.assets){const actual=await hash(await shell.match(new URL(asset.path,location.href)));
        if(actual.sha256!==asset.sha256||actual.bytes!==asset.bytes)throw Error(asset.path);checked++;}
      const digest=await hash(await cache.match(target.url));
      const packMarker=await (await cache.match(new URL('__pack_ready__',location.href))).text();
      if(digest.sha256!==target.sha256||packMarker!==release)throw Error('Package digest/marker mismatch');
      return {shell_assets_verified:checked,pack_sha256:digest.sha256,package:pack,release:marker.release,
        installed_release:packMarker,shell_caches:names.filter(n=>n.startsWith(ns+'shell:')).length};
      }""", {'release': release, 'pack': pack})
    assert result['shell_assets_verified'] > 40 and len(result['pack_sha256']) == 64
    return result


def install(page, record):
    # Use the ordinary installer on the package of this frozen mission in both builds.
    page.evaluate("""async({pack,node})=>{
      const o=await import('./data/offline.js'), j=await import('./journey/journey.mjs');
      const route=await j.loadRoute(), n=route.nodes.find(n=>n.competency_id===node);
      const index=await (await fetch('bank/index.json')).json(), g=index.grades.find(g=>g.grade===n.grade);
      const grade=await (await fetch(g.url)).json(),l=grade.levels.find(l=>l.level===n.level);
      const level=await (await fetch(l.url)).json(),p=level.competencies.flatMap(c=>c.packages).find(p=>p.package_id===pack);
      await o.installPackage({id:p.package_id,version:p.content_version,url:p.url,sha256:p.sha256,bytes:p.bytes,
        dependencies:['bank/index.json',g.url,l.url,{url:n.occ.url,sha256:n.occ.sha256,bytes:n.occ.bytes}]});}""", record)


def pending_update(page):
    page.evaluate("""async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();}""")
    wait_for(lambda: page.evaluate("async()=> (await navigator.serviceWorker.getRegistration()).waiting?.state||null"), lambda state: state == 'installed')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('previous_dist', type=Path)
    ap.add_argument('--candidate', type=Path, default=ROOT / 'dist')
    ap.add_argument('--out', type=Path, default=ROOT / 'evidence/v15/update-local')
    args = ap.parse_args()
    old, new = args.previous_dist.resolve(), args.candidate.resolve()
    exercise(old, new, args.out)


def exercise(old, new, out, server=None):
    if not __debug__:
        raise RuntimeError("Assertions must be enabled for the rollout test")
    one, two = artifact(old), artifact(new)
    if one['release'] == two['release']:
        raise SystemExit('Two distinct release builds are required')
    out.mkdir(parents=True, exist_ok=True)
    notes = []
    errors = []
    receipt = {'suite': 'local-update-rollback', 'baseline': one, 'candidate': two, 'observations': notes,
               'method': 'Local HTTP subpath; actual distributions and workers; one Chromium context, two controlled tabs, IndexedDB and Cache Storage. No domain deployment.',
               'started': datetime.now(timezone.utc).isoformat(), 'python': platform.python_version()}
    if server is None:
        server = ReleaseServer(old)
    else:
        receipt.update(suite="public-update-rollback-restore", method="Public HTTPS, original workers, one browser context and two controlled tabs", url=server.base)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'), **getattr(server, 'browser_options', {}))
            receipt['engine'] = 'Chromium '+browser.version
            ctx = browser.new_context()
            ctx.on('weberror', lambda e: errors.append(str(e.error)))
            driver = ctx.new_page()
            driver.goto(server.base)
            driver.locator('[data-cta=adventure]').click()
            field = driver.locator('.kp-answer')
            expect(field).to_be_editable()
            attempt = driver.url.split('#/session/')[1].split('?')[0]
            session_url = driver.url
            value = snapshot(driver, attempt)
            first = value['frozen'][-1][0][2]['answer']
            first_text = first['numerator'] if first['denominator'] == '1' else first['numerator']+'/'+first['denominator']
            field.fill(first_text)
            field.press('Enter')
            driver.locator('[data-answer-feedback]').wait_for()
            driver.locator('[data-part=next]').click()
            expect(field).to_be_editable()
            field.fill('37/9')
            saved = wait_for(lambda: snapshot(driver, attempt), lambda r: r['draft'] == '37/9')
            reference = {k: digest(saved[k]) for k in ('frozen','events','responses')}
            package = {'pack': saved['frozen'][2], 'node': saved['frozen'][4]['node_id']}
            assert saved['index'] == 1 and len(saved['responses'][0]) == 1 and saved['status'] == 'ongoing'
            install(driver, package)
            wait_for(lambda: worker_release(driver), lambda r: r == one['release'])
            notes.append({'phase': 'baseline','snapshot': reference,'draft': saved['draft'],
                          'cache': certify_cache(driver, one['release'], package['pack'])})

            def verify_snapshot(page, phase, draft):
                row = snapshot(page, attempt)
                assert row['index'] == 1 and row['draft'] == draft and row['status'] == 'ongoing', (phase,row['index'],row['draft'])
                observed = {k:digest(row[k]) for k in reference}
                assert observed == reference, (phase, observed)
                notes.append({'phase':phase,'draft':row['draft'],'immutable_fields':observed})

            def switch(current, old_id, new_id, directory, phase):
                observer = ctx.new_page()
                observer.goto(server.base+'#/settings')
                wait_for(lambda: worker_release(observer), lambda r:r == old_id)
                server.deploy(directory)
                pending_update(observer)
                before = [worker_release(p) for p in [current, observer]]
                assert before == [old_id, old_id]
                verify_snapshot(observer, phase+' waiting in two tabs', '37/9')
                notes.append({'phase':phase+' workers','two_clients':before,'next_worker':'installed/waiting'})
                current.goto(server.base+'#/history')
                current.locator('main h1').wait_for()
                current.close()
                assert worker_release(observer) == old_id
                observer.close()
                # An outside-scope page keeps the context alive while all controlled clients close.
                time.sleep(.4)
                page = ctx.new_page()
                page.goto(session_url)
                wait_for(lambda: worker_release(page), lambda r:r == new_id)
                expect(page.locator('.kp-answer')).to_have_value('37/9', timeout=18000)
                verify_snapshot(page, phase+' resumed', '37/9')
                return page

            ctx.new_page()  # Keep the origin-agnostic tab alive between controlled clients.
            driver = switch(driver,one['release'],two['release'],new,'update')
            install(driver, package)
            notes.append({'phase':'candidate cache','cache':certify_cache(driver,two['release'],package['pack'])})
            server.unavailable = True
            ctx.set_offline(True)
            if hasattr(server, 'offline_witness'):
                server.offline_witness(ctx, driver)
            driver.reload()
            expect(driver.locator('.kp-answer')).to_have_value('37/9')
            verify_snapshot(driver, 'offline candidate reload','37/9')
            ctx.set_offline(False)
            server.unavailable = False
            driver = switch(driver,two['release'],one['release'],old,'rollback')
            install(driver, package)
            notes.append({'phase':'rollback cache','cache':certify_cache(driver,one['release'],package['pack'])})
            server.unavailable = True
            ctx.set_offline(True)
            if hasattr(server, 'offline_witness'):
                server.offline_witness(ctx, driver)
            driver.reload()
            expect(driver.locator('.kp-answer')).to_have_value('37/9')
            verify_snapshot(driver, 'offline rollback reload','37/9')
            row=snapshot(driver,attempt)
            for i in range(row['index'], len(row['responses'])):
                key=row['frozen'][-1][i][2]['answer']
                raw=key['numerator'] if key['denominator']=='1' else key['numerator']+'/'+key['denominator']
                field=driver.locator('.kp-answer')
                expect(field).to_be_editable()
                field.fill(raw)
                field.press('Enter')
                driver.locator('[data-answer-feedback]').wait_for()
                driver.locator('[data-part=next]').click()
            driver.wait_for_url('**/#/results/**')
            result = snapshot(driver,attempt)
            assert result['status']=='completed' and sum(e[1]=='attempt.completed' for e in result['events'])==1
            assert digest(result['frozen'])==reference['frozen'] and result['responses'][0]==saved['responses'][0]
            notes.append({'phase':'completed after rollback offline','items':len(result['responses']),
                          'completion_events':1,'preserved_first_response':True})
            if getattr(server, 'restore_candidate', False):
                ctx.set_offline(False)
                server.unavailable = False
                observer = ctx.new_page()
                observer.goto(server.base + '#/settings')
                wait_for(lambda: worker_release(observer), lambda r: r == one['release'])
                server.deploy(new)
                pending_update(observer)
                before = [worker_release(p) for p in (driver, observer)]
                assert before == [one['release'], one['release']]
                driver.close()
                observer.close()
                restored = ctx.new_page()
                restored.goto(session_url.split('#')[0] + '#/results/' + attempt)
                wait_for(lambda: worker_release(restored), lambda r: r == two['release'])
                observed = snapshot(restored, attempt)
                assert digest(result) == digest(observed)
                assert sum(e[1] == 'attempt.completed' for e in observed['events']) == 1
                install(restored, package)
                notes.append({'phase': 'restored candidate', 'release': worker_release(restored),
                              'two_clients': before, 'before': digest(result), 'after': digest(observed),
                              'completion_events': 1, 'cache': certify_cache(restored, two['release'], package['pack'])})
            assert not errors, errors
            receipt['status']='PASS'
            ctx.close()
            browser.close()
    except Exception:
        receipt['status']='FAIL'
        receipt['failure']=traceback.format_exc()
        raise
    finally:
        server.close()
        receipt.update(completed=datetime.now(timezone.utc).isoformat(), page_errors=errors)
        (out/'update-rollback.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print('PASS update and rollback,',len(notes),'observations',one['release'],two['release'])
    return receipt


if __name__=='__main__':
    main()
