import argparse,hashlib,json,sys,time
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser(description="Reproduce the Firefox setup pointer timing against a selected distribution")
ap.add_argument("--dist",type=Path,required=True);ap.add_argument("--output",type=Path,required=True)
ap.add_argument("--runs",type=int,default=10)
args=ap.parse_args()
ROOT=Path.cwd()
if not (ROOT/'tests/integration/fixture_server.py').is_file():raise RuntimeError("Run from the project root")
DIST=args.dist.resolve()
sys.path.insert(0,str(ROOT/'tests/integration'))
import fixture_server as fixture
fixture.DIST=DIST
fixture_server=fixture.fixture_server
t=Path(__file__).resolve().parent
JS="""(()=>{const log=window._diag=[];const ids=new WeakMap();let seq=0;
const name=e=>e?e.tagName+'.'+e.className+'['+(e.name||e.textContent?.slice(0,22)||'')+']':null;
const form=()=>document.querySelector('form.setup');
const adv=()=>form()?.querySelector('[name=planning_pace]')?.closest('details');
const snap=(event,target)=>{
const f=form(),a=adv(),s=a?.querySelector('summary'); if(!s)return;
if(!ids.has(f))ids.set(f,++seq);let rect=s.getBoundingClientRect();log.push([Math.round(performance.now()),event,name(target),ids.get(f),Math.round(rect.y+rect.height/2),Math.round(scrollY),a.open,!!f.querySelector('[type=submit]').disabled, f.querySelector('.plan-line')?.textContent]);
};
window._snap=snap;for(const e of ['pointerdown','pointerup','click','toggle'])document.addEventListener(e,ev=>snap(e,ev.target),true);
navigator.serviceWorker?.addEventListener('controllerchange',()=>snap('controller',document.activeElement));
let prev='';const frame=()=>{const f=form(),s=adv()?.querySelector('summary');if(s){const v=(ids.get(f)||'') +':'+ f.querySelector('[type=submit]').disabled +':'+Math.round(s.getBoundingClientRect().y)+':'+adv().open;if(prev!==v){snap('frame',null);prev=v;}}requestAnimationFrame(frame)};frame();
})();"""
def test(page,base,mode):
 page.add_init_script(JS); page.goto(base+'#/session/new?grade=3&level=1&op=ADD&pack=MM-G03-L01-ADD-P001&count=12&mode=practice')
 summary=page.locator('form.setup details',has=page.locator('select[name=planning_pace]')).locator('summary').first
 summary.click();page.wait_for_timeout(120)
 a=page.locator('select[name=planning_pace]'); ok=a.is_visible()
 history=page.evaluate('window._diag')
 row={'visible':ok,'history':history}
 if not ok: return row
 a.select_option('90')
 page.locator('form.setup details',has_text='Ubah materi').locator('summary').click()
 page.locator('select[name=operation]').select_option('SUB')
 page.wait_for_url(__import__('re').compile('op=SUB'))
 assert page.locator('select[name=planning_pace]').input_value()=='90'
 page.locator('select[name=grade]').select_option('1')
 page.wait_for_url(__import__('re').compile('grade=1'))
 assert page.locator('select[name=planning_pace]').input_value()=='90'
 limit=page.locator('input[name=question_count]').get_attribute('max')
 count=page.locator('input[name=question_count]').input_value()
 row['material_changed']={'operation_switched_to':'SUB','grade_switched_to':1,'pace':'90','count':int(count),'max':int(limit)}
 assert 0<int(count)<=int(limit)
 return row
with fixture_server() as origin, sync_playwright() as pw:
 b=pw.firefox.launch();base=origin+'/school/math/';rows=[]
 for phase in ['normal','no-worker']:
  for i in range(args.runs):
   c=b.new_context(viewport={'width':1100,'height':860},locale='id-ID',service_workers='block' if phase=='no-worker' else 'allow')
   p=c.new_page();s=test(p,base,phase);rows.append({**s,'phase':phase,'i':i});c.close()
   if not s['visible']:
    print(phase,i,'HIT',s['history'],flush=True)
  print('done',phase,[(r['visible']) for r in rows if r['phase']==phase],flush=True)
 info=json.loads((DIST/'offline-assets.json').read_bytes())
 bad=sum(not r['visible'] for r in rows)
 out={'method':'Native Firefox pointer and material changes in fresh browser contexts. Capture listeners and requestAnimationFrame only observe DOM, control, and pointer state. No injected delays or simulated mouse handlers.','at_utc':datetime.now(timezone.utc).isoformat(),'browser':b.version,'offline_release':info['release'],'offline_manifest_sha256':hashlib.sha256((DIST/'offline-assets.json').read_bytes()).hexdigest(),'viewport':[1100,860],'locale':'id-ID','status':'PASS' if not bad else 'FAIL','failures':bad,'fields':['performance_ms','event','target','form_instance','summary_center_y_px','scroll_y_px','advanced_open','launch_disabled','plan_text'],'runs':rows}
 args.output.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n');sys.exit(bool(bad))
