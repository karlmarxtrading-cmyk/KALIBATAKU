import sys,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=Path(__file__).resolve().parent;ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else BASE/'work'
sys.path.insert(0,str(ROOT/'tests/journey'))
from offline_origin import TestOrigin
origin=TestOrigin(ROOT/'dist');out={'engine':'firefox','fresh_context_per_case':True,'runs':[]}
with sync_playwright() as pw:
 b=pw.firefox.launch();out['version']=b.version
 for w,h in [(320,568),(390,844),(844,390)]:
  for status in ['correct','incorrect']:
   for method in ['Enter','click']:
    c=b.new_context(viewport={'width':w,'height':h},reduced_motion='reduce');p=c.new_page();p.goto(origin.url);p.locator('[data-cta=adventure]').wait_for()
    count=p.evaluate("async()=>{const s=await import('./data/store.js');return (await s.listAttempts(s.activeScope())).length}");assert count==0
    p.locator('[data-cta=adventure]').click();expect(p.locator('#kp-answer')).to_be_focused()
    row={'viewport':[w,h],'answer':status,'next_method':method,'fresh_attempts':count,'states':[]}
    def state(label):
     d=p.evaluate('''label=>{const r=sel=>{const e=document.querySelector(sel);if(!e)return null;const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,fullyVisible:b.top>=0&&b.bottom<=innerHeight,intersectsViewport:b.bottom>0&&b.top<innerHeight}};return {label,viewport:[innerWidth,innerHeight],scrollY,questionText:document.querySelector('#kp-expression')?.textContent,question:r('#kp-expression'),input:r('#kp-answer'),focus:document.activeElement.id||document.activeElement.dataset.part||document.activeElement.tagName,position:document.querySelector('#kp-question-position')?.textContent}}''',label);row['states'].append(d)
    state('initial')
    key=p.evaluate("async()=>{const s=await import('./data/store.js');const a=(await s.listAttempts(s.activeScope()))[0];return a.items[0].question.answer}")
    value='999' if status=='incorrect' else str(key['numerator']) if str(key['denominator'])=='1' else str(key['numerator'])+'/'+str(key['denominator'])
    p.locator('#kp-answer').fill(value);p.keyboard.press('Enter');expect(p.locator('[data-answer-feedback]')).to_have_attribute('data-state',status);expect(p.locator('[data-answer-feedback]')).to_be_focused();state('feedback')
    if method=='Enter':p.keyboard.press('Enter')
    else:p.locator('[data-part=next]').click()
    expect(p.locator('#kp-answer')).to_be_focused();state('next');assert row['states'][-1]['position'].startswith('Soal 2')
    p.keyboard.type('1');state('typed');out['runs'].append(row);c.close()
 b.close()
origin.close();(BASE/'visibility-matrix.json').write_text(json.dumps(out,indent=2))
for row in out['runs']:print(row['viewport'],row['answer'],row['next_method'],row['states'][-2])
