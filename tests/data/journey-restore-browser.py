"""Exercise the restore form, module worker, IndexedDB, and cache source comparison on a served candidate."""
import argparse
from base64 import b64decode
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests/integration'))
import fixture_server as server


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dist', type=Path, default=ROOT / 'dist')
    ap.add_argument('--engine', choices=('chromium','firefox','webkit'), default='chromium')
    ap.add_argument('--executable')
    args = ap.parse_args()
    server.DIST = args.dist.resolve()
    results = []
    with server.fixture_server() as origin, sync_playwright() as runtime, TemporaryDirectory(prefix='restore-browser-') as user_data:
        executable = args.executable or (os.environ.get('CHROMIUM_PATH') if args.engine == 'chromium' else None)
        context = getattr(runtime, args.engine).launch_persistent_context(user_data, executable_path=executable, headless=True, locale='id-ID')
        browser = context.browser
        page = context.new_page()
        workers = []
        page.on('worker', lambda worker: workers.append(worker.url.rsplit('/',1)[-1]))
        page.goto(origin + '/school/math/#/profiles')
        page.locator('input[type=file]').wait_for()
        fixture = page.evaluate("""async () => {
          const s=await import('./data/store.js'), {transaction,row}=await import('./data/db.js');
          const {chooseStart,createMission}=await import('./journey/journey.mjs');
          const b=await import('./data/backup.js');
          const person=await s.createProfile('Restore Browser QA');await s.selectLocalProfile(person.id);
          const scope=s.scopeForLocal(person.id), ns=s.scopeKey(scope);
          await chooseStart(scope,'S-G03-L01','learner_choice');
          const nodeId='arithmetic.addition.g03.l01';
          const id=await createMission({scope,lang:'id'},{nodeId,kind:'regular'});
          const [a]=await s.listAttempts(scope);
          const asText=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
          const envelope=async()=>({json:await asText(new Blob([JSON.stringify(await b.exportBackup(scope))])),zip:await asText(await b.exportArchive(scope))});
          const valid=await envelope(), invalid=structuredClone(a);invalid.journey.selected_occurrence_refs=[];
          await transaction(['attempts'],true,tx=>tx.put('attempts',row(ns,id,invalid)));
          const rejected=await envelope();
          // Real CacheStorage with the exact bank/occurrence/curriculum bytes, selected by URL.
          const level='bank/g03/l01.json', catalogue=await (await fetch(level)).json();
          const pkg=catalogue.competencies.flatMap(n=>n.packages).find(p=>p.package_id===a.package_id);
          const cache=await caches.open('qa-restore-' + person.id);
          await cache.addAll([level,pkg.url,'journey/v1/occ/'+nodeId+'.json']);
          await s.selectLocalProfile('local-default');await s.deleteProfile(person.id);
          return {valid,rejected,profile:person.id,original:a};
        }""")
        page.reload()
        file = page.locator('input[type=file]')
        file.wait_for()
        for fmt in ('json','zip'):
            def choose(kind):
                file.set_input_files({'name':'fixture.' + fmt, 'mimeType':'application/' + fmt,
                                      'buffer':b64decode(fixture[kind][fmt])})
            choose('rejected')
            page.get_by_text('Data misi tidak cocok', exact=False).wait_for()
            assert not page.get_by_role('button', name='Pulihkan ke profil Restore Browser QA').count()
            exists = page.evaluate("async id=>(await (await import('./data/store.js')).listProfiles()).some(p=>p.id===id)",fixture['profile'])
            assert not exists
            choose('valid')
            try:
                page.get_by_text('Misi yang dicocokkan dengan soal bank lokal: 1.', exact=False).wait_for(timeout=12_000)
            except Exception as error:
                observed = page.evaluate('''async()=>{const b=await import('./data/backup.js');const f=document.querySelector('input[type=file]').files[0];const x=await b.readAny(f);return {cacheNames:await caches.keys(),directChecks:b.journeyCheckSummary(x)};}''')
                raise AssertionError({'page':page.locator('main').inner_text(), 'cacheCheck':observed}) from error
            page.get_by_role('button', name='Pulihkan ke profil Restore Browser QA',exact=True).click()
            page.get_by_text('Pemulihan selesai untuk Restore Browser QA.',exact=False).wait_for()
            restored = page.evaluate("""async id=>{const s=await import('./data/store.js');return (await s.listAttempts(s.scopeForLocal(id)))[0];}""",fixture['profile'])
            assert restored == fixture['original']
            assert page.evaluate("async()=>(await import('./data/store.js')).activeScope().profileId") == 'local-default'
            results.append({'format':fmt,'invalidPreview':'localized error, no commit button, zero target profiles',
                            'validPreview':'bank_matched=1','commit':'ongoing attempt, refs, start intent and timestamps identical; active profile isolated'})
            page.evaluate("async id=>(await import('./data/store.js')).deleteProfile(id)",fixture['profile'])
        assert workers.count('backup-reader.worker.js') >= 6
        report={'command':f'python tests/data/journey-restore-browser.py --engine {args.engine}',
                'at':datetime.now(timezone.utc).isoformat(),'engine':args.engine,'version':browser.version,
                'offline_release':json.loads((server.DIST/'offline-assets.json').read_bytes())['release'],
                'workerCount':workers.count('backup-reader.worker.js'),'cases':results,'status':'PASS'}
        browser.close()
    out=ROOT / f'evidence/v15/restore/browser-{args.engine}.json'
    out.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))

if __name__=='__main__':
    main()
