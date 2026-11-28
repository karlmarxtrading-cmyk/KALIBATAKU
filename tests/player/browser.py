"""Student workflow using the release under a nested static path, actual ESM bank and IndexedDB.
Run from the release root: python3 tests/player/browser.py
Set CHROMIUM_PATH to a local Chromium executable, or use Playwright's bundled Chromium.
"""
import json
import os
import shutil
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests'/'integration'))
from fixture_server import fixture_server

def main():
    with fixture_server() as origin, sync_playwright() as pw:
        executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
        browser=pw.chromium.launch(executable_path=executable)
        context=browser.new_context(viewport={'width':390,'height':844},locale='id-ID')
        page=context.new_page()
        page.set_default_timeout(6000)
        base=origin+'/school/math/'
        cases=[]
        def add(tc,observed): cases.append({'test_id':tc,'status':'PASS','observed':observed})
        def route(path):
            page.goto(base+'#/'+path)
        def btn(label):
            return page.get_by_role('button',name=label,exact=True)
        def start(mode):
            route('session/new?grade=1&level=1&op=ADD&mode='+mode)
            page.locator('form.setup button[type=submit]').click()
            page.locator('#kp-answer').wait_for()
        def current():
            return page.evaluate("""async()=>{const s=await import('./data/store.js');return s.getAttempt(location.hash.split('/').pop(),s.activeScope());}""")
        def finish(label):
            btn(label).click()
            btn('Kirim hasil akhir').click()
            page.wait_for_url('**/#/results/*')
            page.get_by_role('heading',name='Hasil sesi').wait_for()
        start('assessment')
        initial=current()
        assert initial['duration_seconds']==0 and initial['deadline'] is None
        fp=initial['items'][0]['question']['fingerprint']
        inp=page.get_by_label('Jawabanmu')
        inp.fill('1,')
        page.get_by_role('button',name='Switch to English').click()
        inp=page.get_by_label('Your answer')
        expect(inp).to_have_value('1,')
        expect(page.locator('[data-separator]')).to_have_text(',')
        inp.fill('1,25')
        expect(inp).to_have_value('1.25')
        btn('Save & continue').click()
        btn('Previous question').click()
        page.get_by_role('button',name='Ganti ke Bahasa Indonesia').click()
        inp=page.get_by_label('Jawabanmu')
        expect(inp).to_have_value('1,25')
        inp.fill('-')
        page.wait_for_function("""async()=>{const s=await import('./data/store.js');const a=await s.getAttempt(location.hash.split('/').pop());return a.items[0].draft==='-';}""")
        page.reload()
        expect(page.locator('#kp-answer')).to_have_value('-')
        assert current()['items'][0]['question']['fingerprint']==fp
        add('TC-121','Locale changed while draft was incomplete; comma keypad and original locale retained. Completed draft then switched exactly to 1.25. The invalid revised draft survived browser reload.')
        btn('Tinjau & kirim').click()
        btn('Kirim hasil akhir').click()
        expect(page.get_by_text('Perbaiki jawaban ini',exact=False)).to_be_visible()
        btn('Tandai kosong').click()
        finish('Tinjau & kirim')
        final=current()
        assert final['metrics']['B']==2 and final['metrics']['U']==8 and final['metrics']['W']==0
        assert final['items'][0]['history'][0]['raw_answer']=='1.25'
        add('TC-125','Assessment A uses no default timer. Clearing invalid latest draft after reload finalizes two blanks, eight unseen and zero incorrect responses; first valid response is preserved in history.')
        start('assessment')
        other=current()
        assert other['form_id']!=initial['form_id'] and other['form_family_id']==initial['form_family_id']
        assert other['assessment_cycle_id']==initial['assessment_cycle_id']
        finish('Tinjau & kirim')
        start('practice')
        inp=page.get_by_label('Jawabanmu')
        inp.fill('999')
        btn('Periksa · Enter').click()
        expect(page.locator('[data-answer-feedback]')).to_contain_text('Belum tepat')
        finish('Selesaikan sesi')
        route('progress?grade=1&level=1')
        page.get_by_text('Detail untuk orang tua dan guru',exact=True).click()
        page.get_by_text('Aturan evaluasi lokal',exact=True).click()
        page.locator('#kp-spacing').fill('0')
        btn('Simpan kebijakan').click()
        expect(page.get_by_text('Berlaku mulai siklus baru.',exact=True)).to_be_visible()
        btn('Mulai siklus evaluasi ulang').first.click()
        page.locator('form.setup button[type=submit]').click()
        page.locator('#kp-answer').wait_for()
        retest=current()
        assert retest['assessment_cycle_id']!=initial['assessment_cycle_id'] and retest['spacing_hours_policy']==0
        assert retest['reinforcement_attempt_id'] and retest['cycle_trigger']=='retest'
        records=page.evaluate("""async()=>{const s=await import('./data/store.js');return(await s.listAttempts()).map(x=>[x.attempt_id,x.status,x.assessment_cycle_id]);}""")
        assert len(records)==4 and sum(x[1]=='completed' for x in records)==3
        add('TC-148','Second generic assessment selected form B in the same cycle. After actual targeted practice, the explicit retest action opened a fresh pinned cycle with an adjustable spacing rule and retained all three earlier attempts.')
        route('session/new?grade=1&level=1&op=ADD&mode=recovery')
        page.locator('form.setup button[type=submit]').click()
        page.locator('#kp-answer').wait_for()
        recovery=current()
        first,variant=recovery['items']
        assert first['source_instance_id']==variant['source_instance_id'] and first['source_attempt_id']==variant['source_attempt_id']
        assert first['question']['template_id']==variant['question']['template_id'] and first['question']['fingerprint']!=variant['question']['fingerprint']
        btn('Lanjut').click()
        page.locator('#kp-answer').fill(variant['question']['answer']['numerator'])
        btn('Periksa · Enter').click()
        expect(page.locator('[data-answer-feedback]')).to_contain_text('Benar')
        finish('Selesaikan sesi')
        route('session/new?grade=1&level=1&op=ADD&mode=recovery')
        expect(page.get_by_role('alert')).to_contain_text('Belum ada')
        add('TC-127','Real same-template equivalent recovery item and origin instance were linked; a correct variation resolved the queue while retaining history. Reopening recovery displayed the empty state.')
        evidence={'browser':'Chromium '+browser.version,'context':'Playwright headless, fresh profile, 390×844, nested static path /school/math/, real IndexedDB, no real user data','cases':cases}
        (ROOT/'evidence'/'player'/'browser.json').write_text(json.dumps(evidence,indent=2,ensure_ascii=False)+'\n')
        browser.close()
        print(json.dumps(evidence,indent=2,ensure_ascii=False))
if __name__=='__main__': main()
