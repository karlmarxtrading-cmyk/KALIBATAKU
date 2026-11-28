"""Run from the release root with Playwright and the project's browser engines."""
import json,os,sys,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
here=Path(__file__).resolve().parent
root=here.parents[2];sys.path.insert(0,str(root/'tests/journey'))
from offline_origin import TestOrigin
server=TestOrigin(root/'dist');runs=[]
with sync_playwright() as pw:
    for engine in ['chromium','firefox','webkit']:
        b=getattr(pw,engine).launch(executable_path=os.getenv('CHROMIUM_PATH') if engine=='chromium' else None)
        for w,h in [(320,568),(390,844)]:
            cm=b.new_context(viewport={'width':w,'height':h},reduced_motion='reduce');p=cm.new_page()
            p.goto(server.url);p.locator('[data-cta=adventure]').click()
            a=p.locator('#kp-answer');feedback=p.locator('[data-answer-feedback]')
            expect(a).to_be_focused()
            for index,state in enumerate(['correct','incorrect','equivalent']):
                ans=p.evaluate("""async()=>{const s=await import('./data/store.js');const a=await s.getAttempt(location.hash.split('/').at(-1),s.activeScope());return a.items[a.index].question.answer}""")
                num=int(ans['numerator']);den=int(ans['denominator'])
                value='-9999' if state=='incorrect' else f'{num*2}/{den*2}' if state=='equivalent' else str(num) if den==1 else f'{num}/{den}'
                a.fill(value);p.keyboard.press('Enter');expect(feedback).to_be_focused();expect(feedback).to_have_attribute('data-state',state)
                p.wait_for_timeout(150)
                bounds=p.evaluate("""()=>Object.fromEntries(Object.entries({heading:'#kp-verdict-title',key:'.verdict-tile.key',next:'[data-part=next]'}).map(([k,s])=>{const r=document.querySelector(s).getBoundingClientRect();return [k,[r.top,r.bottom,r.left,r.right]]}))""")
                visible=all(y1>=-1 and y2<=h+1 and x1>=-1 and x2<=w+1 for y1,y2,x1,x2 in bounds.values())
                runs.append(dict(engine=engine,version=b.version,viewport=[w,h],state=state,visible=visible,bounds=bounds))
                p.keyboard.press('Enter');expect(a).to_be_focused()
            cm.close()
        b.close()
server.close()
result={'build':json.loads((root/'dist/offline-assets.json').read_bytes())['release'],'observed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Viewport CSS desktop; keyboard fisik ponsel belum diuji. Koordinat sesudah grading tanpa scroll oleh penguji.','runs':runs}
(here/'hasil.json').write_text(json.dumps(result,indent=2)+'\n')
print('Visible',sum(r['visible'] for r in runs),'of',len(runs))
for r in runs:
 if not r['visible']:print(r)
