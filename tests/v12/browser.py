"""Run final app workflows in a real browser. Set CHROMIUM_PATH for a system installation."""
import uuid, re, argparse, hashlib, json, os, platform, sys, time
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests/integration'))
from fixture_server import fixture_server
INP=ROOT/'evidence/v12'
OUT=Path(os.getenv('KALIBATAKU_V12_OUT',str(INP)));OUT.mkdir(parents=True,exist_ok=True)
ap=argparse.ArgumentParser();ap.add_argument('engine',choices=['chromium','firefox','webkit']);args=ap.parse_args()
samples=json.loads((INP/'input/math_typography_fixtures.json').read_bytes())['fixtures']
manifest=json.loads((ROOT/'dist/offline-assets.json').read_bytes())
def iso():return datetime.now(timezone.utc).isoformat()
with fixture_server() as origin,sync_playwright() as pw:
    name=args.engine; opts={}
    if name=='chromium' and os.getenv('CHROMIUM_PATH'):opts['executable_path']=os.environ['CHROMIUM_PATH']
    b=getattr(pw,name).launch(**opts);context=b.new_context(viewport={'width':1050,'height':820},locale='id-ID',accept_downloads=True)
    page=context.new_page();page.set_default_timeout(10000);base=origin+'/school/math/'
    rows=[];problems=[];requests=[];raw_requests=[]
    page.on('pageerror',lambda e:problems.append(str(e)))
    context.on('request',lambda r:requests.append(r.url))
    # KALIBATAKU_QA_INJECT_FAIL=ID[,ID] makes the named assertion fail on purpose. The QA
    # gate's negative test uses it to prove that a failed browser assertion stops the run.
    injected={x for x in os.getenv('KALIBATAKU_QA_INJECT_FAIL','').split(',') if x}
    def run(key,task,expected):
        try:
            value=task()
            if key in injected:raise AssertionError('Injected failure for QA gate negative test')
            rows.append(dict(id=key,status='PASS',expected=expected,actual=value))
        except Exception as e:
            rows.append(dict(id=key,status='FAIL',expected=expected,actual=str(e)[:1200],visible=page.locator('main').inner_text()[:550] if page.locator('main').count() else ''))
        print(key,rows[-1]['status'],str(rows[-1]['actual'])[:120],flush=True)
    def start(grade=1,level=1,op='ADD',count=2,mode='practice'):
        slug=f'MM-G{grade:02}-L{level:02}-{op}-P001'
        page.goto(base+f'#/session/new?grade={grade}&level={level}&op={op}&pack={slug}&count={count}&mode={mode}')
        btn=page.locator('form.setup button[type=submit]');expect(btn).to_be_enabled()
        btn.click();answer=page.locator('.kp-answer');expect(answer).to_be_editable();page.locator(".app-view:not([inert]):not([aria-busy]) #kp-expression[data-math=svg]").wait_for();return answer
    def check(value):
        a=page.locator('.kp-answer');a.fill(value);a.press('Enter');card=page.locator('[data-answer-feedback]');card.wait_for();expect(card.locator('[data-math=pending]')).to_have_count(0);return card
    def finish():
        page.locator('[data-part=review]').click();page.locator('[data-part=finish]').click();page.locator('.kp-lead').wait_for()
    def snapshot():
        return page.evaluate("""async()=>{const s=await import('./data/store.js'),scope=s.activeScope(),id=location.hash.split('/').at(-1).split('?')[0];const a=await s.getAttempt(id,scope);return {id,index:a.index,policy:a.feedback_policy_version,deadline:a.deadline,items:a.items.map(i=>({feedback:i.feedback,key:i.key_revealed_at,first:i.first_correct,final:i.final_correct,history:i.history.map(h=>[h.raw_answer,h.is_correct,h.key_seen_before,h.hint_before,h.event_id])})),events:(await s.listEvents(id,scope)).map(e=>e.event_type)};}""".replace("s.listEvents(id,scope)","s.getEvents(id,scope)"))
    def receipt():
        return page.evaluate("""async()=>{const s=await import('./data/store.js'),scope=s.activeScope(),id=location.hash.split('/').at(-1).split('?')[0];const a=await s.getAttempt(id,scope);return {id,index:a.index,policy:a.feedback_policy_version,deadline:a.deadline,items:a.items.map(i=>({key:i.key_revealed_at,first:i.first_correct,final:i.final_correct,history:i.history.map(h=>[h.raw_answer,h.is_correct,h.key_seen_before,h.hint_before,h.event_id])})),sequence:a._seq};}""")
    def student():
        start()
        if name=='chromium':page.screenshot(path=OUT/'sebelum-oke.png')
        for v in ['', '-', '1/', '1/0','<b>']:
            field=page.locator('.kp-answer');field.fill(v);page.locator('[data-submit]').click()
            expect(field).to_have_attribute('aria-invalid','true');assert not page.locator('[data-answer-feedback]').count()
        assert receipt()['items'][0]['history']==[]
        c=check('999');expect(c).to_contain_text('Belum tepat');expect(c).to_contain_text('Kunci jawaban');expect(c).to_contain_text('Salah satu cara')
        assert c.locator('dd [data-linear]').evaluate_all('(es)=>es.map(e=>e.dataset.linear)')==['999','5']
        assert receipt()['index']==0  # Checking displays feedback and does not advance.
        page.locator('[data-part=revise]').click();c=check('5');expect(c).to_contain_text('Revisi setelah');first=receipt()['items'][0]
        assert first['first'] is False and first['final'] is True and [h[:3] for h in first['history']]==[['999',False,False],['5',True,True]]
        if name=='chromium':page.screenshot(path=OUT/'feedback-revisi.png')
        page.locator('[data-part=next]').click();a=page.locator('.kp-answer');a.fill('4');finish();expect(page.locator('.kp-lead')).to_contain_text('2 dari 2')
        expect(page.locator('main')).to_contain_text('1 / 2')
        return {'first_item':first,'score':page.locator('.kp-lead').inner_text(),'ledger':receipt()['sequence']}
    run('OKE-REVISE',student,'Invalid input writes zero grades. 999→5 retains a wrong first response and assisted correct revision. Final draft yields 2/2.')
    def quota():
        start();a=page.locator('.kp-answer');a.fill('999')
        page.evaluate("""()=>{let old=IDBObjectStore.prototype.put;window.failedEvent=null;IDBObjectStore.prototype.put=function(row,...args){if(this.name==='events'&&row.data?.event_type==='answer.submitted'&&!window.failedEvent){window.failedEvent=row.data.event_id;throw new DOMException('test fixture','QuotaExceededError');}return old.call(this,row,...args);}}""")
        page.locator('[data-submit]').click();page.locator('[data-save-issue]').wait_for()
        expect(page.locator('[data-answer-feedback]')).to_contain_text('Belum tepat')
        assert receipt()['items'][0]['history']==[]
        ev=page.evaluate('window.failedEvent');assert ev
        page.get_by_role('button',name='Coba simpan lagi').click()
        expect(page.locator('[data-save-issue]')).to_have_count(0)
        history=receipt()['items'][0]['history'];assert len(history)==1 and history[0][-1]==ev,history
        return {'failed_event':ev,'committed_event':history[0][-1],'submissions':len(history),'raw':history[0][0]}
    run('GRADE-RETRY',quota,'A quota failure on the answer event retains the verdict. Retry writes the original event ID exactly once.')
    def fraction():
        start(5,3,count=2);eq=page.locator('#kp-expression');assert eq.get_attribute('data-linear')=='11/12 + 10/12'
        c=check('21/12');expect(c).to_contain_text('Nilainya sama');assert c.locator('dd [data-linear]').evaluate_all('(es)=>es.map(e=>e.dataset.linear)')==['21/12','7/4']
        c.locator('summary').click();assert c.locator('svg').count()>1
        if name=='chromium':page.screenshot(path=OUT/'pecahan-oke.png')
        return {'question':eq.get_attribute('data-linear'),'raw':receipt()['items'][0]['history'][0][0],'key':'7/4','status':'equivalent'}
    run('FRACTION',fraction,'11/12 + 10/12, input 21/12 and key 7/4 appear as stacked fractions.')
    def decimal():
        f=samples[2];g,l,op=f['source_package'].split('-')[1:4];start(int(g[1:]),int(l[1:]),op);check('55,3');old=receipt()
        assert page.locator('#kp-expression').get_attribute('data-linear')=='20,0 + 35,3'
        assert '50 + 5,3' in page.locator('[data-answer-feedback] [data-linear]').evaluate_all('(es)=>es.map(e=>e.dataset.linear)')
        page.locator('[data-action=language]').click();expect(page.locator('html')).to_have_attribute('lang','en')
        assert page.locator('#kp-expression').get_attribute('data-linear')=='20.0 + 35.3';assert receipt()['items'][0]['history']==old['items'][0]['history']
        page.locator('[data-action=language]').click()
        return {'id':'20,0 + 35,3 → 50 + 5,3','en':'20.0 + 35.3','raw':'55,3'}
    run('DECIMAL',decimal,'Scale survives renderer and language changes; equivalent step keeps decimal notation.')
    def assessment():
        start(mode='assessment');page.locator('.kp-answer').fill('999');page.locator('[data-submit]').click();expect(page.locator('#kp-question-position')).to_contain_text('2 dari');assert not page.locator('[data-answer-feedback]').count();assert receipt()['items'][0]['key'] is None
        finish();expect(page.locator('.kp-lead')).to_be_visible();page.get_by_role('button',name='Tinjau jawaban',exact=True).click();expect(page.locator('main')).to_contain_text('Kunci jawaban');assert page.locator('[role=math]').count()>=3
        return {'ongoing_key':False,'completed_key':True,'rendered_expressions':page.locator('[role=math]').count()}
    run('ASSESSMENT',assessment,'Ongoing evaluation withholds keys. Final review includes question, answer, method and key.')
    def speed():
        start(mode='speed');before=receipt()['deadline'];check('5');after=receipt()['deadline'];assert before==after and before>0
        return {'original':before,'after':after}
    run('SPEED',speed,'Checking a response leaves the running deadline unchanged.')
    def fixture_views():
        rendered=page.evaluate("""async(fs)=>{const {formula}=await import('./math/view.mjs');const out=[];const mount=document.createElement('div');document.body.append(mount);
         for(const lang of ['id','en']){for(const theme of ['light','dark']){document.documentElement.dataset.theme=theme;
          for(const f of fs){const e=formula(f.expression_ast,lang);mount.replaceChildren(e);await e.mathReady;out.push({id:f.fixture_id,lang,theme,svg:e.querySelectorAll('svg').length,fractions:e.querySelectorAll('[data-fraction-bar]').length,state:e.dataset.math,spoken:e.getAttribute('aria-label'),text:e.dataset.linear});}}}
         mount.remove();return out;}""",samples)
        assert len(rendered)==128 and all(x['state']=='svg' and x['svg']>0 and x['spoken'] for x in rendered)
        return rendered
    run('MATH-32',fixture_views,'32 fixtures × two locales × two themes rendered by actual local SVG typesetter.')
    def slow():
        with b.new_context(service_workers='block') as sc:
            f=sc.new_page();prefix=origin+'/probe-slowmath-'+str(uuid.uuid4())+'/school/math/'
            f.goto(prefix+'#/session/new?grade=1&level=1&op=ADD&mode=speed');f.locator('form.setup button[type=submit]').click()
            f.locator('.app-view[inert] .kp-answer').wait_for()
            def state():
                return f.evaluate("""async()=>{const s=await import('./data/store.js'),a=await s.getAttempt(location.hash.split('/').at(-1),s.activeScope());return {ready:a.ready,deadline:a.deadline,duration:a.duration_seconds,start:a.started_at,history:a.items[0].history.length};}""")
            before=state();assert not before['ready'] and before['deadline'] is None,before
            f.locator('.app-view:not([inert]):not([aria-busy]) #kp-expression[data-math=svg]').wait_for()
            after=state();assert after['ready'] and after['deadline'] and after['history']==0,after
            from datetime import datetime
            assert after['deadline']-round(datetime.fromisoformat(after['start']).timestamp()*1000)==after['duration']*1000
            return {'delay_ms':1500,'before':before,'after':after}
    run('SLOW-START',slow,'A delayed local renderer consumes no starting time and creates no early answer. Full speed duration begins after first SVG.')
    def fallback():
        isolated=b.new_context(service_workers='block',locale='id-ID')
        try:
            f=isolated.new_page();hits=[];messages=[];f.on('console',lambda m:messages.append(m.text[:200]));f.on('pageerror',lambda e:messages.append(str(e)));
            isolated.on('response',lambda r:hits.append([r.url,r.status]) if '/math/typeset.mjs' in r.url else None)
            prefix=origin+'/probe-renderer-'+str(uuid.uuid4())+'/school/math/'
            f.goto(prefix+'#/session/new?grade=1&level=1&op=ADD&count=2');f.locator('form.setup button[type=submit]').click()
            expect(f.locator('.app-view:not([inert]):not([aria-busy]) #kp-expression')).to_have_attribute('data-math','fallback',timeout=15000);f.locator('.kp-answer').fill('42')
            f.get_by_role('button',name='Coba tampilkan rumus').first.click();expect(f.locator('#kp-expression')).to_have_attribute('data-math','svg',timeout=15000)
            expect(f.locator('.kp-answer')).to_have_value('42');assert [x[1] for x in hits][:2]==[503,200]
            return {'fallback':'linear','retry':'SVG','preserved':'42','requests':hits}
        except Exception as exc:raise AssertionError((str(exc)[:220],hits,messages[-10:])) from exc
        finally:isolated.close()
    run('LOAD-FAILURE',fallback,'Blocked local renderer gives linear expression and actionable retry; typed answer persists.')
    def school():
        page.goto(base+'#/demo/student/demo-04');page.locator('a[href*="assignments?student=demo-04"]').click()
        assert 'Demo 04' in page.get_by_label('Siswa',exact=True).locator('option:checked').inner_text()
        page.go_back();note=page.locator('textarea');note.fill('Catatan asli 24 × 4');page.locator('[data-action=language]').click();expect(note).to_have_value('Catatan asli 24 × 4')
        page.goto(base+'#/reports?source=local_practice');select=page.get_by_role('combobox',name='Preview student');select.wait_for();alias=select.locator('option:checked').inner_text()
        page.get_by_text('Filter data',exact=True).click();page.get_by_role('button',name='Reset',exact=True).click();expect(select.locator('option:checked')).to_have_text(alias)
        return {'assignment':'Demo 04','saved_note':True,'report_alias':alias}
    run('TEACHER-3',school,'The assignment recipient, localized note draft and personal report reset preserve the selected person and source.')
    def responsive():
        page.goto(base+'#/session/new?grade=5&level=3&op=ADD&count=2');page.locator('form.setup button[type=submit]').click();page.locator('#kp-expression[data-math=svg]').wait_for();check('21/12');out=[]
        for width in [320,360,390,768,1024,1440]:
            page.set_viewport_size({'width':width,'height':720 if width<768 else 870})
            for textsize in ['100%','200%']:
                val=page.evaluate("""s=>{document.documentElement.style.fontSize=s;const h=document.documentElement,e=document.querySelector('[data-part=next]').getBoundingClientRect(),svg=document.querySelector('[data-answer-feedback] svg');return {width:h.clientWidth,scroll:h.scrollWidth,button:[e.width,e.height],ink:!!svg,overflow:Array.from(h.querySelectorAll('main *')).filter(x=>x.getBoundingClientRect().right>h.clientWidth+2).slice(0,8).map(x=>x.tagName+'.'+x.className)};}""",textsize)
                assert val['scroll']<=val['width']+2 and min(val['button'])>=47.5 and val['ink'],(width,textsize,val);out.append([width,textsize,val])
        return out
    run('REFLOW',responsive,'Six actual viewport widths and 200% root font with visible SVG and a 48px action.')
    def lifecycle():
        page.locator('main h1').wait_for()
        return page.evaluate("""async (fixtures)=>{
          const {formula,clearMath}=await import('./math/view.mjs'),box=document.createElement('div');
          document.body.append(box);box.style.width='280px';box.style.fontSize='2rem';
          const first=formula(fixtures[0].expression_ast,'id');box.append(first);
          clearMath(box);const second=formula(fixtures[1].expression_ast,'en');box.replaceChildren(second);
          await Promise.all([first.mathReady,second.mathReady]);if(first.querySelector('svg')||second.dataset.math!=='svg')throw Error('stale SVG');
          const measurements=[];for(const f of fixtures){const e=formula(f.expression_ast,'id');clearMath(box);box.replaceChildren(e);await e.mathReady;
            const glyphs=Array.from(e.querySelectorAll('svg'));if(!glyphs.length)throw Error(f.fixture_id);
            measurements.push({fixture:f.fixture_id,container:box.clientWidth,outer:e.offsetWidth,scroll:e.scrollWidth,groups:glyphs.length,widest_group:Math.round(Math.max(...glyphs.map(x=>x.getBoundingClientRect().width)))});
          }box.remove();return {removed_first_svg:0,replacement:'svg',cases:measurements};}""",samples)
    run('LIFECYCLE',lifecycle,'Stale nodes cannot receive late SVG. Measure the boundaries of every arithmetic fixture at large text size.')
    def contrast():
        page.set_viewport_size({'width':390,'height':844})
        page.evaluate("document.documentElement.style.fontSize='100%'");out=[]
        for forced in ['none','active']:
            page.emulate_media(forced_colors=forced)
            for theme in ['light','dark']:
                page.evaluate("t=>document.documentElement.dataset.theme=t",theme);btn=page.locator('[data-part=next]');btn.focus();btn.press('Tab');page.keyboard.press('Shift+Tab');val=page.evaluate("""()=>{let b=document.querySelector('[data-part=next]'),s=getComputedStyle(b),card=document.querySelector('[data-answer-feedback]');return {color:s.color,background:s.backgroundColor,outline:s.outlineStyle,width:s.outlineWidth,status:card.querySelector('h2').innerText,highContrast:matchMedia('(forced-colors: active)').matches};}""")
                assert val['status'] and val['outline']!='none',val
                out.append({'requested':forced,'theme':theme,**val})
                if name=='chromium' and forced=='active' and theme=='dark':page.screenshot(path=OUT/'kontras-tinggi.png')
        return out
    run('FOCUS-CONTRAST',contrast,'Focusable action and written verdict in normal and forced-colors media. Actual media state recorded.')
    external=[u for u in requests if u.startswith(('http://','https://')) and not u.startswith(origin+'/')]
    rows.append(dict(id='ORIGIN',expected='No external runtime request',status='FAIL' if external else 'PASS',actual=sorted(set(external))))
    status=dict(build=manifest['release'],engine=name,version=b.version,os=platform.platform(),utc=iso(),checks=rows,page_errors=problems,method='Native engine with local HTTP, synthetic profiles and real controls. Viewports and forced colors are simulated. No physical device or AT listener.')
    (OUT/f'browser-{name}.json').write_text(json.dumps(status,indent=2,ensure_ascii=False))
    b.close()
failed=[r['id'] for r in rows if r['status']!='PASS']
print('v12-browser',name,'assertions',len(rows),'failed',failed,'page_errors',len(problems),flush=True)
# A failed assertion or an unexpected page error is a failed suite, never exit status 0.
sys.exit(1 if failed or problems or not rows else 0)
