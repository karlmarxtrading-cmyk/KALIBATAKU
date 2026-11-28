"""KALIBATAKU 1.3 browser regressions for the audit findings, on the built dist/.

Native Chromium, Firefox or WebKit, local HTTP, synthetic profiles, real controls.
Writes evidence/v13/receipts/browser-v13-<engine>.json (kalibataku-qa-receipt/1) and
exits nonzero on any failed assertion or unexpected page error.
"""
import argparse, io, json, os, platform, re, sys, tempfile, time, zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests/integration'))
from fixture_server import fixture_server
ap = argparse.ArgumentParser(); ap.add_argument('engine', nargs='?', default='chromium', choices=['chromium', 'firefox', 'webkit']); args = ap.parse_args()
pkg = json.loads((ROOT / 'package.json').read_bytes()); bank = json.loads((ROOT / 'dist/bank/index.json').read_bytes())
manifest = json.loads((ROOT / 'dist/offline-assets.json').read_bytes())
rows, problems = [], []
injected = {x for x in os.getenv('KALIBATAKU_QA_INJECT_FAIL', '').split(',') if x}


def run(key, expected, task):
    t = time.time()
    try:
        value = task()
        if key in injected: raise AssertionError('Injected failure for QA gate negative test')
        rows.append({'id': key, 'status': 'PASS', 'expected': expected, 'actual': value, 'seconds': round(time.time() - t, 1)})
    except Exception as e:
        rows.append({'id': key, 'status': 'FAIL', 'expected': expected, 'actual': str(e)[:1500], 'seconds': round(time.time() - t, 1)})
    print(key, rows[-1]['status'], str(rows[-1]['actual'])[:160], flush=True)


with fixture_server() as origin, sync_playwright() as pw:
    opts = {}
    if args.engine == 'chromium' and os.getenv('CHROMIUM_PATH'): opts['executable_path'] = os.environ['CHROMIUM_PATH']
    try:
        b = getattr(pw, args.engine).launch(**opts)
    except Exception as e:
        rows.append({'id': 'ENGINE', 'status': 'BLOCKED_ENV', 'expected': f'{args.engine} available', 'actual': str(e).splitlines()[0][:300]})
        b = None
    base = origin + '/school/math/'

    def context(**kw):
        ctx = b.new_context(viewport={'width': 1100, 'height': 860}, locale='id-ID', accept_downloads=True, **kw)
        ctx.on('weberror', lambda e: problems.append(str(e.error)[:300]))
        return ctx

    def until(page, expression, timeout=15000):
        # Evaluate the fixed predicate directly via the protocol. Playwright's
        # string wait_for_function uses eval, which the production CSP forbids.
        deadline = time.monotonic() + timeout / 1000
        while time.monotonic() < deadline:
            if page.evaluate(expression):
                return
            page.wait_for_timeout(100)
        raise AssertionError('Timed out waiting for ' + expression)

    def start(page, grade, level, op, n=1, mode='practice', count=2, ready=8000, site=None):
        slug = f'MM-G{grade:02}-L{level:02}-{op}-P{n:03}'
        page.goto((site or base) + f'#/session/new?grade={grade}&level={level}&op={op}&pack={slug}&count={count}&mode={mode}')
        btn = page.locator('form.setup button[type=submit]'); expect(btn).to_be_enabled(); btn.click()
        expect(page.locator('.kp-answer')).to_be_editable(timeout=ready)

    def answer(page, value):
        a = page.locator('.kp-answer'); a.fill(value); a.press('Enter')
        card = page.locator('[data-answer-feedback]'); card.wait_for(); return card

    if b:
        def versions():
            ctx = context(); page = ctx.new_page()
            # Shut down a real HTTP origin, including transport for the worker.
            # WebKit's protocol-wide offline flag can reject even cache-served navigations.
            with fixture_server() as isolated:
                page.goto(isolated + '/school/math/#/settings')
                app = page.locator('[data-version=app]'); expect(app).to_have_text(pkg['version'])
                expect(page.locator('[data-version=bank]')).to_have_text(bank['version'])
                expect(page.locator('[data-version=release]')).to_have_text(manifest['release'])
                # Offline: install one pack through the app API, then reload with the network off.
                page.evaluate("""async()=>{const o=await import('./data/offline.js');const reg=await o.registerOffline();
                  await new Promise(r=>{const w=reg.installing||reg.waiting||reg.active;if(w.state==='activated')r();else w.addEventListener('statechange',()=>{if(w.state==='activated')r();});});}""")
                page.reload(); until(page, "navigator.serviceWorker.controller!==null", timeout=15000)
                info = page.evaluate("""async()=>{const i=await (await fetch('bank/index.json')).json();const g=await (await fetch(i.grades[0].url)).json();const l=await (await fetch(g.levels[0].url)).json();
                  const c=l.competencies.find(x=>x.active),e=c.packages[0],o=await import('./data/offline.js');
                  await o.installPackage({id:e.package_id,version:e.content_version,url:e.url,sha256:e.sha256,dependencies:['bank/index.json',i.grades[0].url,g.levels[0].url]});
                  return (await o.listInstalled()).map(x=>x.id);}""")
            if args.engine != 'webkit':
                ctx.set_offline(True)
            page.reload()
            expect(page.locator('[data-version=app]')).to_have_text(pkg['version'], timeout=15000)
            off = page.locator('[data-version=app]').inner_text()
            ctx.set_offline(False); ctx.close()
            return {'app': pkg['version'], 'bank': bank['version'], 'release': manifest['release'], 'offline_reload': off, 'installed': info, 'offline_transport':'closed HTTP listener'}
        run('UX-001-VERSION', 'Settings shows app version from build metadata, distinct bank version and build ID, also after an offline reload', versions)

        def timer():
            ctx = context(); page = ctx.new_page()
            start(page, 3, 5, 'DIV', mode='speed', count=3)
            t = page.locator('[role=timer]'); expect(t).to_have_attribute('aria-live', 'off')
            page.evaluate("""()=>{window.__said=[];const n=document.querySelector('[data-time-announcer]');new MutationObserver(()=>{if(n.textContent)window.__said.push([Date.now(),n.textContent]);}).observe(n,{childList:true,characterData:true,subtree:true});}""")
            page.locator('[data-part=time]').click()
            until(page, "window.__said.length>=1"); first = page.evaluate("window.__said.at(-1)[1]")
            assert re.match(r'Sisa waktu (\d+ menit ?)?(\d+ detik)?\.', first), first
            page.locator('.kp-answer').focus(); page.keyboard.press('Alt+T'); until(page, "window.__said.length>=2")
            # Over 6 seconds without asking, the live region stays quiet (no per-second speech).
            n = page.evaluate("window.__said.length"); page.wait_for_timeout(6000); quiet = page.evaluate("window.__said.length") - n
            assert quiet == 0, quiet
            ctx.close()
            # Hidden timer keeps the deadline and the spoken time.
            ctx = context(); page = ctx.new_page()
            page.add_init_script("localStorage.setItem('kalibataku.preferences.v1',JSON.stringify({showTimer:false}))")
            start(page, 3, 5, 'DIV', mode='speed', count=3)
            expect(page.locator('[role=timer]')).to_have_count(0); expect(page.locator('.kp-timer.muted')).to_be_visible()
            page.locator('[data-part=time]').click(); expect(page.locator('[data-time-announcer]')).to_contain_text('Sisa waktu')
            dl = page.evaluate("""async()=>{const s=await import('./data/store.js');const a=await s.getAttempt(location.hash.split('/').at(-1).split('?')[0],s.activeScope());return a.deadline;}""")
            assert dl and dl > time.time() * 1000, dl
            ctx.close()
            return {'on_request': first, 'silent_6s': True, 'hidden_timer_deadline_running': True}
        run('UX-002-TIMER', 'Remaining time is spoken on request (button and Alt+T), not every second; hiding the timer keeps the deadline', timer)

        def threshold():
            ctx = context(); page = ctx.new_page()
            page.goto(base + '#/session/new?grade=3&level=5&op=DIV&pack=MM-G03-L05-DIV-P001&count=3&mode=speed&seconds=30')
            page.locator('select[name=duration]').select_option('30')
            page.locator('form.setup button[type=submit]').click(); expect(page.locator('.kp-answer')).to_be_editable()
            page.evaluate("""()=>{window.__said=[];const n=document.querySelector('[data-time-announcer]');new MutationObserver(()=>{if(n.textContent)window.__said.push(n.textContent);}).observe(n,{childList:true,characterData:true,subtree:true});}""")
            until(page, "window.__said.some(t=>/10 detik|9 detik/.test(t))", timeout=26000)
            said = page.evaluate("window.__said"); ctx.close()
            assert 1 <= len(said) <= 2, said
            return said
        run('UX-002-THRESHOLD', 'A 30 s challenge announces the 10-second threshold once; nothing else is spoken', threshold)

        def audio():
            out = {}
            for case, script in [('native', ''), ('prefixed', "window.webkitAudioContext=window.AudioContext;delete window.AudioContext;"),
                                 ('none', "delete window.AudioContext;delete window.webkitAudioContext;")]:
                ctx = context(); page = ctx.new_page()
                page.add_init_script(script + "window.__audio=0;const K=window.AudioContext||window.webkitAudioContext;if(K){const W=class extends K{constructor(...a){super(...a);window.__audio++;}};if(window.AudioContext)window.AudioContext=W;else window.webkitAudioContext=W;}localStorage.setItem('kalibataku.preferences.v1',JSON.stringify({sound:true}))")
                page.goto(base + '#/settings'); page.locator('.settings').wait_for()
                has = page.locator('input[name=sound]').count() == 1
                start(page, 1, 1, 'ADD'); answer(page, '5'); page.wait_for_timeout(300)
                made = page.evaluate('window.__audio'); out[case] = {'option': has, 'contexts': made}; ctx.close()
            assert out['native'] == {'option': True, 'contexts': 1} and out['prefixed'] == {'option': True, 'contexts': 1} and out['none'] == {'option': False, 'contexts': 0}, out
            return out
        run('UX-003-AUDIO', 'Sound option and player use one resolver: native, prefixed-only and unavailable', audio)

        def setup():
            ctx = context(); page = ctx.new_page()
            page.goto(base + '#/session/new?grade=3&level=1&op=ADD&pack=MM-G03-L01-ADD-P001&count=12&mode=practice')
            page.locator('form.setup details', has=page.locator('select[name=planning_pace]')).locator('summary').first.click()
            page.locator('select[name=planning_pace]').select_option('90')
            page.locator('form.setup details', has_text='Ubah materi').locator('summary').click()
            page.locator('select[name=operation]').select_option('SUB'); page.wait_for_url(re.compile('op=SUB'))
            expect(page.locator('select[name=planning_pace]')).to_have_value('90')
            count = page.locator('input[name=question_count]').input_value()
            page.locator('select[name=grade]').select_option('1'); page.wait_for_url(re.compile('grade=1'))
            expect(page.locator('select[name=planning_pace]')).to_have_value('90')
            maxn = page.evaluate("""async()=>{const g=await (await fetch('bank/g01/l01.json')).json();return g.competencies.find(c=>c.active).packages[0].question_count;}""")
            clamped = int(page.locator('input[name=question_count]').input_value()); ctx.close()
            assert clamped <= maxn, (clamped, maxn)
            return {'pace_after_switch': '90', 'count_after_op_switch': count, 'count_after_grade_switch': clamped, 'pack_max': maxn}
        run('UX-004-SETUP', 'Pace and options survive a material change; question count is re-validated for the new pack', setup)

        def feedback():
            ctx = context(); page = ctx.new_page(); out = {}
            start(page, 5, 3, 'ADD', count=2)
            c = answer(page, '21/12'); expect(c).to_have_attribute('data-state', 'equivalent')
            assert c.locator('.verdict-tile dd [data-linear]').evaluate_all('es=>es.map(e=>e.dataset.linear)') == ['21/12', '7/4']
            idea = c.locator('.verdict-idea p').inner_text(); out['idea'] = idea
            c.locator('summary').click(); steps = c.locator('.step-list li').count(); out['steps'] = steps
            assert steps >= 2 and c.locator('.step-list .kp-step-expression [data-math=svg]').count() == steps
            page.locator('[data-part=revise]').click(); c = answer(page, '999'); expect(c).to_have_attribute('data-state', 'incorrect')
            expect(c.locator('.verdict-note')).to_contain_text('Revisi setelah melihat kunci')
            hist = page.evaluate("""async()=>{const s=await import('./data/store.js');const a=await s.getAttempt(location.hash.split('/').at(-1).split('?')[0],s.activeScope());const i=a.items[0];return {first:i.first_correct,final:i.final_correct,h:i.history.map(x=>[x.raw_answer,x.key_seen_before])};}""")
            assert hist['first'] is True and hist['final'] is False and hist['h'] == [['21/12', False], ['999', True]], hist
            out['ledger'] = hist
            for width in (320, 390):
                page.set_viewport_size({'width': width, 'height': 800})
                w = page.evaluate("document.documentElement.scrollWidth"); assert w <= width + 1, (width, w)
            page.evaluate("document.documentElement.dataset.theme='dark'"); page.screenshot(path=str(OUT / 'feedback-dark-390.png'), full_page=True)
            ctx.close(); return out
        OUT = Path(os.environ.get('KALIBATAKU_V13_SHOTS', tempfile.mkdtemp(prefix='kalibataku-v13-shots-')))
        OUT.mkdir(parents=True, exist_ok=True)
        run('UX-006-FEEDBACK', 'Equivalent, incorrect and assisted-revision states; idea and steps separated; ledger intact; no overflow at 320/390', feedback)

        def linear_fallback():
            out = {}
            for case in ('blocked', 'timeout'):
                ctx = context(service_workers='block'); page = ctx.new_page()
                pattern = re.compile(r'.*/math/typeset\.mjs.*')
                if case == 'blocked': ctx.route(pattern, lambda r: r.abort())
                if case == 'timeout': ctx.route(pattern, lambda r: (time.sleep(7.5), r.continue_()))
                start(page, 5, 4, 'DIV', count=2, ready=20000)
                eq = page.locator('#kp-expression')
                expect(eq).to_have_attribute('data-math', 'fallback', timeout=20000)
                text = eq.locator('.math-surface').inner_text(); label = eq.get_attribute('aria-label')
                assert text == '21 ÷ (3/11)' and 'buka kurung 3 per 11' in label, (text, label)
                page.locator('.kp-answer').fill('77'); ctx.unroute(pattern)
                page.get_by_role('button', name='Coba tampilkan rumus').first.click()
                expect(eq).to_have_attribute('data-math', 'svg', timeout=15000); expect(page.locator('.kp-answer')).to_have_value('77')
                out[case] = {'fallback_text': text, 'spoken': label, 'recovered': 'svg'}; ctx.close()
            # Offline after installing the pack: the renderer is part of the offline shell.
            with fixture_server() as isolated:
                site = isolated + '/school/math/'
                ctx = context(); page = ctx.new_page(); page.goto(site + '#/offline')
                page.evaluate("""async()=>{const o=await import('./data/offline.js'),reg=await o.registerOffline();
                  await new Promise(r=>{const w=reg.installing||reg.waiting||reg.active;if(w.state==='activated')r();else w.addEventListener('statechange',()=>{if(w.state==='activated')r();});});
                  const g=await (await fetch('bank/g05.json')).json(),l=await (await fetch('bank/g05/l04.json')).json(),e=l.competencies.flatMap(c=>c.packages).find(p=>p.package_id==='MM-G05-L04-DIV-P001');
                  await o.installPackage({id:e.package_id,version:e.content_version,url:e.url,sha256:e.sha256,dependencies:['bank/index.json','bank/g05.json','bank/g05/l04.json']});}""")
                page.reload(); until(page, "navigator.serviceWorker.controller!==null", timeout=15000)
            if args.engine != 'webkit':
                ctx.set_offline(True)
            start(page, 5, 4, 'DIV', count=2, ready=20000, site=site)
            eq = page.locator('#kp-expression'); expect(eq).to_have_attribute('data-math', 'svg', timeout=15000)
            out['offline_installed'] = {'state': 'svg', 'linear': eq.get_attribute('data-linear'), 'offline_transport':'closed HTTP listener'}
            assert out['offline_installed']['linear'] == '21 ÷ (3/11)'
            ctx.set_offline(False); ctx.close()
            return out
        run('MATH-001-FALLBACK', 'Blocked and slow (timeout) renderer show 21 ÷ (3/11) with grouping and grouped speech; retry restores SVG with the draft kept; offline after install renders SVG', linear_fallback)

        def backup_ui():
            ctx = context(); page = ctx.new_page(); page.goto(base + '#/profiles')
            pid = page.evaluate("""async()=>{const s=await import('./data/store.js'),e=await import('./player/engine.mjs');const p=await s.createProfile('Backup UI');const scope=s.scopeForLocal(p.id);
              const sh=await (await fetch('bank/g12/l05.json')).json(),info=sh.competencies.flatMap(c=>c.packages).find(x=>x.package_id==='MM-G12-L05-MIX-P001');const pk=(await import('./'+info.url)).default;
              for(let n=0;n<40;n++){const a=e.createAttempt(pk,scope,{mode:'practice',lang:n%2?'en':'id'});await s.saveAttempt(a,e.begin(a),scope);const cmds=[];for(let i=0;i<a.items.length;i++){e.visit(a,i);const k=a.items[i].question.answer;e.editDraft(a,i,k.denominator==='1'?k.numerator:k.numerator+'/'+k.denominator,a.locale);cmds.push(e.submit(a,i));}await s.saveAttempt(a,cmds,scope);await s.saveAttempt(a,e.finish(a),scope);}
              await s.selectLocalProfile(p.id);return p.id;}""")
            page.reload(); page.get_by_role('button', name='Unduh cadangan profil').wait_for()
            with page.expect_download(timeout=60000) as d: page.get_by_role('button', name='Unduh cadangan profil').click()
            name = d.value.suggested_filename; path = str(Path(tempfile.mkdtemp(prefix='kalibataku-dl-')) / name); d.value.save_as(path); data = Path(path).read_bytes()
            z = zipfile.ZipFile(io.BytesIO(data)); m = json.loads(z.read('manifest.json'))
            assert name.endswith('.zip') and m['format'] == 'kalibataku-profile-archive' and m['totals']['attempts'] == 40, (name, m['totals'])
            expect(page.locator('main')).to_contain_text('Cadangan siap diunduh')
            ctx.close()
            ctx = context(); page = ctx.new_page(); page.goto(base + '#/profiles'); page.locator('input[type=file]').wait_for()
            # Quota failure during restore: nothing is written, and success is not shown.
            page.evaluate("""()=>{const old=IDBObjectStore.prototype.put;window.__failed=0;IDBObjectStore.prototype.put=function(r,...x){if(this.name==='events'&&window.__failQuota){window.__failed++;throw new DOMException('fixture','QuotaExceededError');}return old.call(this,r,...x);};window.__failQuota=true;}""")
            page.locator('input[type=file]').set_input_files(path)
            restore = page.get_by_role('button', name=re.compile('^Pulihkan ke profil')); restore.wait_for(timeout=60000)
            expect(page.locator('main')).to_contain_text('40 sesi')
            restore.click(); expect(page.locator('[role=alert]')).to_contain_text('penuh', timeout=60000)
            count = page.evaluate(f"""async()=>{{const s=await import('./data/store.js');return (await s.listAttempts(s.scopeForLocal('{pid}'))).length;}}""")
            assert count == 0 and page.locator('text=Pemulihan selesai').count() == 0, count
            page.evaluate("window.__failQuota=false"); restore.click()
            expect(page.locator('main')).to_contain_text('Pemulihan selesai', timeout=60000)
            after = page.evaluate(f"""async()=>{{const s=await import('./data/store.js'),sc=s.scopeForLocal('{pid}');return [(await s.listAttempts(sc)).length,(await s.listEvents(null,sc)).length];}}""")
            ctx.close()
            assert after[0] == 40 and after[1] == 40 * 52, after
            return {'file': name, 'bytes': len(data), 'parts': len(m['parts']), 'quota_failure_rows': count, 'restored': after}
        run('TECH-01-BACKUP-UI', 'ZIP backup downloaded from the profile page restores into empty storage; a quota failure writes nothing and shows no success', backup_ui)

        def cache_gc():
            ctx = context(); page = ctx.new_page(); page.goto(base + '#/offline')
            res = page.evaluate("""async()=>{const o=await import('./data/offline.js'),reg=await o.registerOffline();
              await new Promise(r=>{const w=reg.installing||reg.waiting||reg.active;if(w.state==='activated')r();else w.addEventListener('statechange',()=>{if(w.state==='activated')r();});});
              const i=await (await fetch('bank/index.json')).json(),g=await (await fetch(i.grades[0].url)).json(),l=await (await fetch(g.levels[0].url)).json(),e=l.competencies.find(x=>x.active).packages[0];
              const meta=await o.installPackage({id:e.package_id,version:e.content_version,url:e.url,sha256:e.sha256,dependencies:['bank/index.json',i.grades[0].url,g.levels[0].url]});
              const P='kalibataku:'+new URL('./',location.href).pathname+':';
              const mk=async(n,marker)=>{const c=await caches.open(n);await c.put(new URL('app.mjs',location.href),new Response('x'));if(marker)await c.put(new URL(marker,location.href),new Response('ok'));};
              await mk(P+'shell:aaaaaaaaaaaaaaaa','offline-assets.json');await mk(P+'shell:bbbbbbbbbbbbbbbb','offline-assets.json');await mk(P+'shell:cccccccccccccccc',null);
              await mk(P+'ready-pack:'+meta.shellCache.split(':').pop()+':ORPHAN@1:x','__pack_ready__');
              const db=await import('./data/db.js');const before=await db.transaction(['installs','profiles'],false,async tx=>[(await tx.all('installs')).length,(await tx.all('profiles')).length]);
              const held=await navigator.locks.request('kalibataku-offline-install:'+new URL('./',location.href).pathname,async()=>o.pruneOfflineCaches());
              const r=await o.pruneOfflineCaches();const names=await caches.keys();
              const after=await db.transaction(['installs','profiles'],false,async tx=>[(await tx.all('installs')).length,(await tx.all('profiles')).length]);
              return {held:held.skipped,removed:r.remove,names:names.filter(n=>n.startsWith(P)).map(n=>n.slice(P.length)),before,after,ready:(await o.listInstalled()).map(x=>x.id),shell:meta.shellCache.slice(P.length)};}""")
            ctx.close()
            assert res['held'] == 'install-in-progress', res
            assert 'shell:aaaaaaaaaaaaaaaa' not in res['names'] and 'shell:cccccccccccccccc' not in res['names'], res
            assert 'shell:bbbbbbbbbbbbbbbb' in res['names'] and res['shell'] in res['names'] and not any('ORPHAN' in n for n in res['names']), res
            assert res['before'] == res['after'] and res['ready'], res
            return res
        run('TECH-04-CACHE', 'Real Cache Storage: older and partial shells and orphan packs removed; active, installed and one rollback kept; lock skips; IndexedDB unchanged', cache_gc)

        def reset_prefs():
            ctx = context(); page = ctx.new_page()
            page.add_init_script("if(!sessionStorage.getItem('once')){sessionStorage.setItem('once','1');localStorage.setItem('kalibataku.preferences.v1',JSON.stringify({lang:'en',theme:'dark',textSize:'xlarge',sound:true,reduceMotion:true,keypad:false,showTimer:false}))}")
            page.goto(base + '#/profiles'); pid = page.evaluate("""async()=>{const s=await import('./data/store.js');const p=await s.createProfile('Prefs');await s.selectLocalProfile(p.id);return p.id;}""")
            page.goto(base + '#/settings'); page.locator('[data-action=reset-preferences]').click(); page.locator('[data-action=confirm-reset]').click()
            expect(page.locator('html')).to_have_attribute('lang', 'id')
            prefs = page.evaluate("JSON.parse(localStorage.getItem('kalibataku.preferences.v1'))")
            still = page.evaluate(f"""async()=>{{const s=await import('./data/store.js');return (await s.listProfiles()).some(p=>p.id==='{pid}');}}"""); ctx.close()
            assert prefs == {'lang': 'id', 'theme': 'system', 'textSize': 'regular', 'sound': False, 'reduceMotion': False, 'keypad': True, 'showTimer': True}, prefs
            assert still
            return prefs
        run('PREFS-RESET', 'Restoring defaults resets exactly the seven browser preferences and keeps profiles', reset_prefs)

        def reflow():
            setup_route='session/new?grade=5&level=3&op=ADD&pack=MM-G05-L03-ADD-P001&count=2'
            # Capture the actual first paint without a machine-speed-dependent
            # sleep. Blocking only app.mjs keeps the production HTML, CSS,
            # early preference bootstrap, font files and skeleton intact.
            loading=context()
            try:
                p=loading.new_page()
                p.set_viewport_size({'width':320,'height':900})
                p.add_init_script("localStorage.setItem('kalibataku.preferences.v1', JSON.stringify({textSize:'xlarge'}))")
                p.route('**/app.mjs',lambda route:route.abort())
                p.goto(base+'#/'+setup_route)
                expect(p.locator('.opening-page .sheet')).to_be_visible()
                expect(p.locator('html')).to_have_attribute('data-text','xlarge')
                p.evaluate("async()=>{await document.fonts.ready}")
                opening=p.evaluate("""()=>({width:document.documentElement.scrollWidth,
                   placeholder_right:document.querySelector('.opening-page .head-bone').getBoundingClientRect().right})""")
                assert opening['width']<=321 and opening['placeholder_right']<=321,opening
            finally:
                loading.close()
            ctx = context(); page = ctx.new_page(); out = []; page.goto(base)
            for route in ['', 'settings', 'profiles', setup_route]:
                for width in (320, 360, 390, 768, 1024, 1440):
                    for size in ('regular', 'xlarge'):
                        page.set_viewport_size({'width': width, 'height': 900})
                        page.evaluate(f"localStorage.setItem('kalibataku.preferences.v1',JSON.stringify({{textSize:'{size}'}}))")
                        page.goto(base + '#/' + route); page.reload()
                        view=route.split('?')[0] or 'home'
                        page.locator(f'.app-view[data-route="{view}"]:not([aria-busy])').wait_for()
                        if route==setup_route:
                            expect(page.locator('form.setup button[type=submit]')).to_be_enabled()
                        page.evaluate("async()=>{await document.fonts.ready}")
                        sw = page.evaluate('document.documentElement.scrollWidth'); out.append([route or 'home', width, size, sw])
                        assert sw <= width + 1, (route, width, size, sw)
            ctx.close(); return {'samples': len(out), 'max_overflow_px': max(r[3] - r[1] for r in out),'setup_opening_320_xlarge':opening}
        run('REFLOW-1.3', 'No horizontal overflow on home, settings, profiles and setup at 320–1440 px with standard and 138% text', reflow)
        b.close()

external = []
status = {'schema': 'kalibataku-qa-receipt/1', 'suite': 'browser-v13-' + args.engine, 'build': {'offline_release': manifest['release'], 'app_version': pkg['version']},
          'runtime': {'engine': args.engine, 'version': b.version if b else None, 'os': platform.platform()}, 'assertions': len(rows),
          'status': 'FAIL' if any(r['status'] == 'FAIL' for r in rows) or problems or not rows else ('BLOCKED_ENV' if any(r['status'] == 'BLOCKED_ENV' for r in rows) else 'PASS'),
          'errors': [], 'page_errors': problems, 'checks': rows,
          'method': 'Native engine, local HTTP, synthetic profiles, real controls. Viewport widths are emulated; no physical device or screen-reader listener.'}
out = Path(os.environ.get('KALIBATAKU_RECEIPTS', ROOT / 'evidence/v13/receipts')) / f'browser-v13-{args.engine}.json'
out.parent.mkdir(parents=True, exist_ok=True); out.write_text(json.dumps(status, indent=2, ensure_ascii=False) + '\n')
failed = [r['id'] for r in rows if r['status'] == 'FAIL']
print('browser-v13', args.engine, status['status'], len(rows), 'assertions', failed, 'page_errors', len(problems))
sys.exit(0 if status['status'] == 'PASS' else 3 if status['status'] == 'BLOCKED_ENV' else 1)
