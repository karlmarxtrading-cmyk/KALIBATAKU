"""Trusted keyboard cycles across real IndexedDB commits, focus changes and routes."""
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests/journey'))
from offline_origin import TestOrigin


def run(engine):
    server = TestOrigin(ROOT / 'dist')
    with sync_playwright() as pw:
        browser = getattr(pw, engine).launch(executable_path=os.getenv('CHROMIUM_PATH') if engine == 'chromium' else None)
        ctx = browser.new_context(viewport={'width':390, 'height':844}, reduced_motion='reduce', bypass_csp=True)
        page = ctx.new_page()
        page.set_default_timeout(10000)
        page.goto(server.url)
        home = page.locator('[data-cta=adventure]')
        home.wait_for()
        start = home.get_attribute('href')
        assert page.locator('.nearby-stops [aria-current=step]').count() == 1
        page.goto(server.url+'#/map')
        node = page.locator('.map-node[aria-current=step] a')
        expect(node).to_have_attribute('href', start)
        rect = node.bounding_box()
        assert 0 <= rect['y'] and rect['y']+rect['height']<=844,rect
        assert page.locator('.map-node.is-inactive').count()==0
        page.goto(server.url)
        home.click()
        answer=page.locator('#kp-answer')
        feedback=page.locator('[data-answer-feedback]')
        expect(answer).to_be_focused()
        def ledger(id=None):
            return page.evaluate("""async provided=>{
              const id=provided||decodeURIComponent(location.hash.split('/')[2]);
              const s=await import('./data/store.js'),scope=s.activeScope(),a=await s.getAttempt(id,scope);
              const events=await s.listEvents(id,scope);
              return {id,idx:a.index,items:a.items.map(i=>({h:i.history,key:i.question.answer,fp:i.question.fingerprint})),
                submitted:events.filter(e=>e.event_type==='answer.submitted').length,completed:events.filter(e=>e.event_type==='attempt.completed').length};
            }""",id)
        def key(i,multiple=1):
            q=initial['items'][i]['key']
            n=int(q['numerator'])*multiple; d=int(q['denominator'])*multiple
            return str(n) if d==1 else f'{n}/{d}'
        def check_index(i,count):
            st=ledger()
            assert st['idx']==i and st['submitted']==count,(st['idx'],st['submitted'],count)
        def press(): page.keyboard.press('Enter')
        initial=ledger()
        print('PASS J01 J02 fresh home and optional map recommend same actual mission',flush=True)
        press()
        expect(answer).to_have_attribute('aria-invalid','true')
        check_index(0,0)
        answer.fill(key(0));answer.dispatch_event('compositionstart');press();answer.dispatch_event('compositionend')
        check_index(0,0)
        print('PASS E06 empty and composing input',flush=True)
        # Keep a real grading transaction alive. A keypress made while it is
        # pending must not become an instruction applied after its commit.
        page.evaluate("""()=>{const put=IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put=function(...args){
            if(this.name==='events'&&args[0]?.data?.event_type==='answer.submitted'){
              if(window.abortGrade){window.abortGrade=false;this.transaction.abort();return put.apply(this,args);}
              if(window.delayGrade){const until=performance.now()+650,store=this;document.body.dataset.slowWrite='1';
                function hold(){if(performance.now()<until){const request=store.get('__qa__');request.onsuccess=hold;}}
                hold();window.delayGrade=false;}
            }return put.apply(this,args);
          }; window.delayGrade=true;}""")
        page.keyboard.down('Enter')
        page.locator('body[data-slow-write]').wait_for()
        page.keyboard.up('Enter');press()
        expect(feedback).to_be_focused()
        expect(feedback).to_have_attribute('data-state','correct')
        check_index(0,1)
        page.wait_for_timeout(250)
        check_index(0,1)
        print('PASS E01 E05 pending up-before-commit and no queued action',flush=True)
        page.keyboard.down('Enter')
        expect(answer).to_be_focused()
        page.keyboard.down('Enter');page.keyboard.up('Enter');check_index(1,1)
        answer.fill('-999');page.keyboard.down('Enter');expect(feedback).to_be_focused()
        page.keyboard.down('Enter');check_index(1,2);page.keyboard.up('Enter')
        expect(feedback).to_have_attribute('data-state','incorrect')
        # Native secondary controls must retain their keyboard semantics.
        steps=page.locator('.verdict-steps summary');steps.focus();press()
        expect(page.locator('.verdict-steps')).to_have_attribute('open','')
        check_index(1,2)
        page.locator('[data-part=revise]').focus();press();expect(answer).to_be_focused()
        answer.fill(key(1));press();expect(feedback).to_be_focused()
        assert ledger()['items'][1]['h'][1]['key_seen_before']
        page.reload();expect(feedback).to_be_focused()
        press();expect(answer).to_be_focused();check_index(2,3)
        print('PASS E02 E03 E08 held key, wrong answer, secondary detail, assisted revision, saved feedback reload',flush=True)
        answer.fill(key(2,2));page.locator('[data-submit]').click();expect(feedback).to_be_focused()
        expect(feedback).to_have_attribute('data-state','equivalent')
        page.set_viewport_size({'width':320,'height':568})
        primary=page.locator('[data-part=next]')
        primary.scroll_into_view_if_needed()
        box=primary.bounding_box();assert box['width']>=44 and box['height']>=44
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        press();expect(answer).to_be_focused();check_index(3,4)
        answer.fill(key(3));page.evaluate("""()=>{const put=IDBObjectStore.prototype.put;let failed=false;
           IDBObjectStore.prototype.put=function(row,...args){if(!failed&&this.name==='events'&&row.data?.event_type==='answer.submitted'){
             failed=true;throw new DOMException('QA storage full','QuotaExceededError');}return put.call(this,row,...args);};}""");press()
        expect(page.locator('[data-save-issue]')).to_be_visible()
        check_index(3,4);press();check_index(3,4)
        page.get_by_role('button',name='Coba simpan lagi').click();expect(feedback).to_be_focused()
        check_index(3,5);primary.click();expect(answer).to_be_focused()
        print('PASS E07 E10-desktop aborted write, retry, click check and click next parity, narrow reflow',flush=True)
        for i in range(4,len(initial['items'])):
            answer.fill(key(i));press();expect(feedback).to_be_focused()
            if i!=len(initial['items'])-1: press();expect(answer).to_be_focused()
        original_id=initial['id']
        assert ledger()['completed']==0
        page.keyboard.down('Enter');heading=page.locator('main h1');expect(page.locator('.mission-result')).to_be_visible()
        expect(heading).to_be_focused();page.keyboard.down('Enter')
        expect(page.locator('.mission-result')).to_be_visible()
        assert ledger(original_id)['completed']==1
        page.keyboard.up('Enter');page.keyboard.down('Enter');expect(answer).to_be_focused()
        page.keyboard.down('Enter');page.keyboard.up('Enter')
        st=ledger();assert st['id']!=original_id and st['idx']==0 and st['submitted']==0
        count=page.evaluate("async()=>{const s=await import('./data/store.js');return (await s.listAttempts(s.activeScope())).length}")
        assert count==2,count
        print('PASS E04 E09 one completion, distinct follow-on press, one new attempt, no unintended answer',flush=True)
        print('Engine',engine,browser.version,'old ledger',ledger(original_id)['submitted'],'new ledger',st['submitted'])
        browser.close()
    server.close()

if __name__=='__main__':run(sys.argv[1])
