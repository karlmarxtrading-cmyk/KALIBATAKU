import {runDataSuite} from '../data/browser-suite.mjs';
import {runOfflineJourney} from '../data/offline-journey.mjs';
import {route,chooseLang,until,button} from './probes.mjs';
const token=crypto.randomUUID();
const base=new URL('/probe-data-ux-'+token+'/school/math/',location.href).href;
async function runtime(){
  const m=await(await fetch(new URL('offline-assets.json',base),{cache:'no-store'})).json();
  return {release:m.release,bootstrap:m.assets.find(a=>a.path==='app.mjs')?.sha256,bank:m.assets.find(a=>a.path==='bank/index.json')?.sha256};
}
async function delivery(w){
  const mod=p=>import(new URL(p,base)),[store,engine,bridge,sync,db,summary]=await Promise.all(['data/store.js','player/engine.mjs','data/bridge.js','data/sync.js','data/db.js','data/summary.js'].map(mod));
  const root=await(await fetch(new URL('bank/index.json',base))).json(),g=await(await fetch(new URL(root.grades[0].url,base))).json();
  const cells=await(await fetch(new URL(g.levels[0].url,base))).json(),entry=cells.competencies.find(c=>c.active).packages[0];
  const pkg=(await mod(entry.url)).default;
  const scope={origin:'demo',environment:'qa-ux-'+token,profileId:'demo-qa-'+token},ns=store.scopeKey(scope);
  const results=[];
  const check=(id,desc,ok,actual)=>results.push({id,description:desc,status:ok?'PASS':'FAIL',observations:actual});
  const oldScope=w.sessionStorage.getItem('kalibataku.scope');
  try{
    const attempts=[];
    for(const options of [{},{status:401},{status:403},{status:409},{status:422},{status:429,retryAfter:3600000},{timeoutAfterCommit:true}]){
      const a=engine.createAttempt(pkg,scope,{lang:'en',question_count:1});await store.saveAttempt(a,engine.begin(a),scope);
      await store.releaseAttempt(a.attempt_id,scope);await sync.syncPending(scope,{adapter:new bridge.MockAdapter(scope,options)});attempts.push(a);
    }
    const before=await store.listEvents(null,scope),inboxBefore=await db.transaction(['mockInbox'],false,t=>t.count('mockInbox',ns));
    w.sessionStorage.setItem('kalibataku.scope',JSON.stringify(scope));
    await route(w,base,'sync?source=demo');await chooseLang(w,'en');
    const d=w.document,screen=await until(()=>d.querySelector('main')?.innerText?.includes('Last receipt:')&&d.querySelector('main').innerText,'Delivery status');
    const expected=['Demonstration data','Official grading: unverified','Last receipt:','Sign in to the school service','Access denied','conflicting results','rejection reason','Next retry:','Accepted by simulator'];
    check('AC-065-delivery-reasons','Visible mock delivery, per-session reasons and explicit separation from official grading',expected.every(x=>screen.includes(x)),
      {expected,visible:screen.slice(0,3700),scope:scope.profileId,live_lms:false});
    const retrying=attempts.at(-1);
    const q=await sync.listOutbox(scope),pending=q.find(e=>e.attempt_id===retrying.attempt_id);
    if(pending.state==='retry_required'){
      const delay=Math.max(0,pending.next_at-Date.now()+150);await new Promise(r=>setTimeout(r,delay));
    }
    (await until(()=>button(d,/Try sending to simulator/),'Retry action')).click();
    await until(()=>d.querySelector('main')?.innerText?.includes('2 accepted by simulator.'),'Retry accepted');
    const after=await store.listEvents(null,scope),queue=await sync.listOutbox(scope),receipt=queue.find(e=>e.attempt_id===retrying.attempt_id);
    const inboxAfter=await db.transaction(['mockInbox'],false,t=>t.count('mockInbox',ns));
    check('AC-066','Retry after a simulated lost acknowledgement keeps one event, obtains a duplicate receipt and preserves other blocked statuses',
      JSON.stringify(before)===JSON.stringify(after)&&inboxAfter===inboxBefore&&receipt.state==='mock_accepted'&&receipt.receipt?.transport_result==='duplicate'&&queue.some(r=>r.state==='auth_required')&&queue.some(r=>r.http_status===403),
      {expected:'Same IDs and hashes, same simulator inbox, duplicate ACK, denied rows still blocked',events:after.length,inbox_before:inboxBefore,inbox_after:inboxAfter,repeat_receipt:receipt.receipt?.transport_result,statuses:queue.map(r=>[r.state,r.http_status,r.grading_state]),live_lms:false});
  }finally{
    const tables=['attempts','events','leases','outbox','records','mockInbox','mockBindings'];
    await db.transaction(tables,true,async tx=>{
      for(const t of tables)await tx.scan(t,ns,r=>tx.del(t,r.key));
      await summary.forgetSummaries(tx,ns);
    });
    if(oldScope===null)w.sessionStorage.removeItem('kalibataku.scope');else w.sessionStorage.setItem('kalibataku.scope',oldScope);
  }
  return results;
}
document.querySelector('#run').onclick=async()=>{
  const w=window.open('about:blank','_blank','popup,width=1024,height=768'),r={suite:'data-ux',utc:new Date().toISOString(),user_agent:navigator.userAgent,checks:[]};
  const phase=document.querySelector('#phase'),out=document.querySelector('#out'),control=document.querySelector('#run');
  control.disabled=true;
  try{
    if(!w)throw Error('Popup blocked');r.runtime=await runtime();
    for(const [stage,work] of [['restore',()=>runDataSuite({base})],['offline',()=>runOfflineJourney(w,base)],['delivery',()=>delivery(w)]]){
      phase.textContent='Testing '+stage;
      try{
        const rows=await work();
        // TC-176 has an install case and an offline-launch case in this combined receipt.
        for(const row of rows)r.checks.push(stage==='offline'&&row.id==='TC-176'?{...row,id:'TC-176-offline-launch'}:row);
      }
      catch(error){r.checks.push({id:stage,description:stage,status:'FAIL',error:String(error),visible:w.document.querySelector('main')?.innerText?.slice(0,1700),url:w.location.href});}
    }
    r.runtime_after=await runtime();
    if(r.runtime.release!==r.runtime_after.release)throw Error('Mixed build receipts');
  }catch(e){r.error=String(e);}
  finally{
    r.finished_utc=new Date().toISOString();w?.close();
    const res=await fetch('/__qa/ux-receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});
    phase.textContent='Completed · '+res.status;out.textContent=JSON.stringify(r,null,2);control.disabled=false;
  }
};
