"""Exercise the catalogue context and failed/delayed next-mission creation in Chromium."""
from pathlib import Path
import os,sys
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'tests/journey'))
from offline_origin import TestOrigin
mode=sys.argv[1]
origin=TestOrigin(root/'dist')
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'))
    cm=browser.new_context(viewport={'width':390,'height':844},has_touch=True)
    p=cm.new_page();p.set_default_timeout(10000)
    if mode=='catalog':
        for w,h in [(390,844),(844,390),(768,1024),(1280,800)]:
            p.set_viewport_size({'width':w,'height':h})
            p.goto(origin.url+'#/packs?grade=1&level=1&op=ADD')
            el=p.locator('.pack-filters')
            el.locator('summary').wait_for()
            assert el.evaluate('e=>e.open')==(w>640)
            nav=p.locator('.nav-more a[href="#/curriculum"]')
            expect(nav).to_have_attribute('aria-current','page')
            assert p.locator('#student-nav a[href="#/"][aria-current]').count()==0
            if w<641:el.locator('summary').click()
            expect(el.locator('[name=pack-search]')).to_be_visible()
            assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
            print('PASS catalogue',w,h)
    else:
        p.goto(origin.url);p.locator('[data-cta=adventure]').click()
        a=p.locator('#kp-answer');feedback=p.locator('[data-answer-feedback]')
        expect(a).to_be_focused()
        for i in range(6):
            a.fill('0');p.keyboard.press('Enter');expect(feedback).to_be_focused();p.keyboard.press('Enter')
            if i<5:expect(a).to_be_focused()
        b=p.locator('[data-part=next-mission]');b.wait_for()
        p.evaluate("""()=>{const put=IDBObjectStore.prototype.put;window.btn=document.querySelector('[data-part=next-mission]');
          let fails=true;
          IDBObjectStore.prototype.put=function(row,...args){
            if(this.name==='attempts'&&row.data?.status==='ongoing'&&!row.data?.ready){
              if(fails){fails=false;throw new DOMException('QA','QuotaExceededError');}
              if(!window.testDelay){window.testDelay=true;document.body.dataset.pendingLaunch='1';const end=performance.now()+650;
                const store=this;function hold(){if(performance.now()<end){const r=store.get('__qa__');r.onsuccess=hold;}}hold();}
            }return put.call(this,row,...args);
          };}""")
        p.keyboard.down('Enter');p.evaluate('window.btn.click()');p.keyboard.down('Enter');p.keyboard.up('Enter')
        p.locator('[data-error-code]').wait_for()
        def counts():
            return p.evaluate("""async()=>{const s=await import('./data/store.js');const a=await s.listAttempts(s.activeScope());return [a.length,a.filter(x=>x.status==='completed').length,a.filter(x=>x.status==='ongoing').flatMap(x=>x.items).flatMap(i=>i.history).length]}""")
        assert counts()==[1,1,0]
        print('PASS E09 failed launch and combined activation create no ghost attempt')
        p.get_by_role('button',name='Coba lagi').click()
        p.locator('body[data-pending-launch]').wait_for()
        tab=cm.new_page();tab.goto('about:blank');tab.bring_to_front();p.bring_to_front()
        p.keyboard.press('Enter');expect(a).to_be_focused();assert counts()==[2,1,0]
        assert a.input_value()=='' and p.locator('[data-answer-feedback]').count()==0
        print('PASS E05 E09 slow retry, tab switch and Enter while pending create one blank attempt')
        menu=p.locator('.nav-more summary')
        menu.focus();p.keyboard.press('Enter');assert p.locator('.nav-more').evaluate('e=>e.open')
        p.keyboard.press('Escape');assert counts()==[2,1,0]
        hint=p.locator('[data-part=hint]');hint.focus();p.keyboard.press('Enter')
        p.locator('[data-hint]').wait_for();assert counts()==[2,1,0]
        pause=p.locator('[data-part=pause]');pause.focus();p.keyboard.press('Enter')
        expect(p.locator('[data-state-heading]')).to_be_focused();p.keyboard.press('Enter');assert counts()==[2,1,0]
        p.locator('[data-part=resume]').focus();p.keyboard.press('Enter');expect(a).to_be_focused()
        a.fill('123')
        check=p.locator('[data-submit]');rect=check.bounding_box()
        check.tap();p.touchscreen.tap(rect['x']+rect['width']/2,rect['y']+rect['height']/2)
        expect(feedback).to_be_visible()
        assert counts()==[2,1,1]
        p.locator('[data-part=next]').tap();expect(a).to_be_focused()
        assert counts()==[2,1,1]
        print('PASS E04 E08 E10 emulated touch, repeated tap, keyboard menu and hint, one response')
    browser.close()
origin.close()
