"""Exercise consecutive trusted text insertion and Enter without synthetic events or timer changes."""
import argparse,asyncio,hashlib,json,sys
from datetime import datetime,timezone
from pathlib import Path
from playwright.async_api import async_playwright
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[3]/'tests/journey'))
from offline_origin import TestOrigin
TRACE="""
window.__compositionAudit=[];
for(const event of ['keydown','keyup','compositionstart','compositionend','beforeinput','input','submit','click']){
  window.addEventListener(event,e=>{
    if(!location.hash.startsWith('#/session/'))return;
    window.__compositionAudit.push({type:e.type,ms:performance.now(),trusted:e.isTrusted,key:e.key,code:e.code,
      keyCode:e.keyCode,isComposing:e.isComposing,repeat:e.repeat,inputType:e.inputType,data:e.data,
      target:e.target.id||e.target.tagName,value:document.querySelector('#kp-answer')?.value});
  },true);
}
"""
LEDGER="""async()=>{const s=await import('./data/store.js'),id=decodeURIComponent(location.hash.split('/').at(-1));
 const a=await s.getAttempt(id,s.activeScope()),i=a.items[a.index];
 return {id,index:a.index,answers:i.history.length,feedback:i.feedback,draft:i.draft};
}"""
async def run(args):
 out={"schema":"kalibataku-qa-receipt/1","suite":"firefox-trusted-compose-enter-investigation",
 "started":datetime.now(timezone.utc).isoformat(),"build":{"offline_release":json.loads((args.dist/'offline-assets.json').read_bytes())['release'],
 "enter_sha256":hashlib.sha256((args.dist/'core/enter-cycle.mjs').read_bytes()).hexdigest()},"checks":[]}
 async with async_playwright() as pw:
  o=TestOrigin(args.dist);b=await pw.firefox.launch();out["runtime"]={"engine":"firefox","version":b.version}
  try:
   c=await b.new_context(viewport={'width':390,'height':844});await c.add_init_script(TRACE)
   p=await c.new_page();await p.goto(o.url);await p.locator('[data-cta=adventure]').click()
   for j in range(args.rounds):
    await p.locator('#kp-answer:focus').wait_for();prior=await p.evaluate(LEDGER)
    await p.evaluate('window.__compositionAudit=[]')
    await asyncio.gather(p.keyboard.insert_text(str(j+1)),p.keyboard.press('Enter'))
    try:await p.locator('[data-answer-feedback]:focus').wait_for(timeout=1400)
    except Exception: pass
    actual=await p.evaluate(LEDGER);events=await p.evaluate('window.__compositionAudit')
    passed=actual['id']==prior['id'] and actual['index']==prior['index'] and actual['feedback'] and actual['answers']==prior['answers']+1
    out['checks'].append(dict(id=f'native-sequence-{j+1}',status='PASS' if passed else 'FAIL',expected='The distinct Enter after a committed insertion grades the active item once.',actual=dict(prior=prior,after=actual,trusted_events=events)))
    if not passed:
     await p.keyboard.press('Enter');await p.locator('[data-answer-feedback]:focus').wait_for()
    await p.locator('[data-part=revise]').click()
  finally:await b.close();o.close()
 out.update(finished=datetime.now(timezone.utc).isoformat(),assertions=len(out['checks']),status='PASS' if all(r['status']=='PASS' for r in out['checks']) else 'FAIL')
 args.out.write_text(json.dumps(out,indent=2)+'\n');print(out['status'],sum(x['status']=='PASS' for x in out['checks']),len(out['checks']),flush=True)
if __name__=='__main__':
 arg=argparse.ArgumentParser();arg.add_argument('--dist',type=Path,required=True);arg.add_argument('--out',type=Path,required=True);arg.add_argument('--rounds',type=int,default=12);asyncio.run(run(arg.parse_args()))
