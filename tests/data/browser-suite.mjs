const check=(v,m='assertion failed')=>{if(!v)throw Error(m);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(test,timeout=15000) {const end=Date.now()+timeout;while(Date.now()<end){const v=await test();if(v)return v;await wait(40);}throw Error('Timed out');}
async function rejects(fn,code){try{await fn();}catch(e){check(!code||(e.code===code||e.name===code||e.message===code),'expected '+code+' got '+e);return;}throw Error('Expected failure: '+code);}
async function frame(db,base,blocked=false){
  const url=new URL('frame.html',import.meta.url);url.search=new URLSearchParams({database:db,base,blocked:blocked?'1':'0'});
  const f=document.createElement('iframe');f.src=url;f.hidden=true;document.body.append(f);await until(()=>f.contentWindow.qaData);
  return {el:f,w:f.contentWindow,load:f.contentWindow.qaData.load};
}
async function legacy(name) {
  const db=await new Promise((res,rej)=>{const op=indexedDB.open(name,1);
    op.onupgradeneeded=()=>{for(const t of ['profiles','attempts','events','outbox','leases','records']){const s=op.result.createObjectStore(t,{keyPath:'key'});s.createIndex('scope','scope');}};
    op.onsuccess=()=>res(op.result);op.onerror=()=>rej(op.error);});
  const tx=db.transaction(['outbox'],'readwrite');
  tx.objectStore('outbox').put({key:'demo|demo|older|legacy-event',scope:'demo|demo|older',id:'legacy-event',data:{event_id:'legacy-event',state:'pending_sync'}});
  await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=rej;});return db;
}
export async function runDataSuite({base}){
  const results=[],frames=[],db='qa-kalibataku-'+crypto.randomUUID(), blockedDb='qa-kalibataku-'+crypto.randomUUID();
  const test=async(id,description,run)=>{try{const observations=await run();results.push({id,description,status:'PASS',observations});}
    catch(e){results.push({id,description,status:'FAIL',error:e.stack||String(e)});}};
  const withFrame=async(n=db,blocked=false)=>{const f=await frame(n,base,blocked);frames.push(f.el);return f;};
  const getJSON=p=>fetch(new URL(p,base)).then(async r=>{if(!r.ok)throw Error(r.status+' '+p);return r.json();});
  const old=await legacy(db);old.close();const first=await withFrame(),store=await first.load('data/store.js'),common=await first.load('data/common.js'),
    sync=await first.load('data/sync.js'),backup=await first.load('data/backup.js'),engine=await first.load('player/engine.mjs');
  let local,demo,pkg,g,l,c,entry,demoA,a;
  const runAttempt=async(scope,completed=true,writer=store,practice=engine)=>{
    const s=practice.createAttempt(pkg,scope,{mode:'practice',lang:'en',question_count:1});
    await writer.saveAttempt(s,practice.begin(s),scope);
    const answer=s.items[0].question.answer;practice.editDraft(s,0,answer.numerator+'/'+answer.denominator,'en');await writer.saveAttempt(s,practice.submit(s,0),scope);
    if(completed)await writer.saveAttempt(s,practice.finish(s),scope);return s;
  };
  try{
    await test('TC-132','Version 1 → 2 preserves pending outbox; blocked upgrade gives explicit status',async()=>{
      const retained=await sync.listOutbox({origin:'demo',environment:'demo',profileId:'older'});check(retained[0].event_id==='legacy-event');
      const old2=await legacy(blockedDb);try{
        const blocked=await withFrame(blockedDb), bs=await blocked.load('data/store.js');await rejects(()=>bs.getStatus(),'UPGRADE_BLOCKED');
      }finally{old2.close();}
      return {database:db,from:1,to:2,pending_retained:1};
    });
    await test('TC-129','Native IndexedDB rolls back snapshot + ledger + outbox when outbox write fails',async()=>{
      const root=await getJSON('bank/index.json');g=root.grades[0];l=(await getJSON(g.url)).levels[0];c=(await getJSON(l.url)).competencies.find(x=>x.active);entry=c.packages[0];
      pkg=(await first.load(entry.url)).default;demo={origin:'demo',environment:'demo',profileId:'qa'};
      local=store.scopeForLocal((await store.createProfile('QA synthetic')).id);
      demoA=engine.createAttempt(pkg,demo,{mode:'practice',lang:'en',question_count:1});const command=engine.begin(demoA);
      const proto=first.w.IDBObjectStore.prototype,original=proto.put;
      proto.put=function(...args){if(this.name==='outbox')throw new first.w.DOMException('Injected quota fault','QuotaExceededError');return original.apply(this,args);};
      try{await rejects(()=>store.saveAttempt(demoA,command,demo),'QuotaExceededError');}
      finally{proto.put=original;}
      check(!await store.getAttempt(demoA.attempt_id,demo));check(!(await store.listEvents(demoA.attempt_id,demo)).length);check(!(await sync.listOutbox(demo)).length);
      await store.saveAttempt(demoA,command,demo);await store.saveAttempt(demoA,command,demo);check((await sync.listOutbox(demo)).length===1);
      a=await runAttempt(local,false);check(!(await sync.listOutbox(local)).length);
      return {failed_write:'quota injected before outbox put',committed_retries:1,local_pending:0};
    });
    await test('TC-130','Unavailable browser storage exposes temporary namespace and downloadable backup',async()=>{
      const unavailable=await withFrame(db,true),s=await unavailable.load('data/store.js'),b=await unavailable.load('data/backup.js');
      check((await s.getStatus()).temporary);const p=await s.createProfile('Temporary');
      check((await b.exportBackup(s.scopeForLocal(p.id))).data_origin==='local_practice');return {temporary:true};
    });
    await test('TC-131','Concurrent browsing contexts, takeover, stale revision, crashed lease expires',async()=>{
      const other=await withFrame(),s2=await other.load('data/store.js'),s2a=await s2.getAttempt(a.attempt_id,local);
      await rejects(()=>s2.acquireAttempt(a.attempt_id,local),'LOCKED');await s2.acquireAttempt(a.attempt_id,local,{takeover:true});await s2.saveAttempt(s2a,null,local);
      await rejects(()=>store.saveAttempt(a,null,local),'STALE_REVISION');other.el.remove();
      // Advance wall clock only in the surviving document; no lease release signal.
      const saved=first.w.Date.now;first.w.Date.now=()=>saved()+20000;
      try{await store.acquireAttempt(a.attempt_id,local);}finally{first.w.Date.now=saved;}
      a=await store.getAttempt(a.attempt_id,local);await store.releaseAttempt(a.attempt_id,local);
      return {contexts:2,expired_after_simulated_ms:20000};
    });
    await test('TC-133','Profile and attempts/ledger round trip through JSON, compare before atomic import',async()=>{
      const b=await backup.exportBackup(local), json=JSON.stringify(b);const check1=await backup.previewBackup(json);check(check1.additions===0&&check1.conflicts.length===0);
      const e=await store.listEvents(null,local);await store.deleteProfile(local.profileId);const prev=await backup.previewBackup(json);check(prev.additions>0);
      await backup.importBackup(json);check(JSON.stringify(await store.listEvents(null,local))===JSON.stringify(e));
      const changed=JSON.parse(json);changed.profile.name='Different';delete changed.checksum;
      // Re-serialize in the app realm to exercise genuine JSON import semantics.
      changed.checksum=await common.sha256(await first.w.qaData.load('data/common.js').then(mod=>mod.canonical(first.w.JSON.parse(JSON.stringify(changed)),false)));
      check((await backup.previewBackup(JSON.stringify(changed))).conflicts.length===1);
      await rejects(()=>backup.importBackup(JSON.stringify(changed)),'IMPORT_CONFLICT');
      check(prev.sessions===1&&prev.profile_id===local.profileId&&prev.first_date&&prev.first_date===prev.last_date);
      const history=await store.queryAttemptSummaries(local,{limit:1});
      check(history.total===1&&!('items' in history.rows[0]));
      return {events:e.length,duplicates:check1.duplicates,created:prev.additions,target:prev.profile_id,dates:[prev.first_date,prev.last_date],summary_bytes:JSON.stringify(history).length};
    });
    await test('TC-134','Delete one local profile preserves other namespace',async()=>{
      const id=(await store.createProfile('Sibling')).id;await runAttempt(store.scopeForLocal(id));
      await store.deleteProfile(id);check((await store.listAttempts(local)).length===1);
      check((await store.listAttempts(store.scopeForLocal(id))).length===0);
      return {retained_profiles:1};
    });
    await test('TC-134-stale-alias','Stale alias at startup and deletion in another tab recover without copying attempts',async()=>{
      const previous=localStorage.getItem('kalibataku.localProfile'),stale=(await store.createProfile('Removed alias')).id;
      try{
        const victim=await withFrame(),vs=await victim.load('data/store.js');
        await vs.selectLocalProfile(stale);
        const staleScope=vs.scopeForLocal(stale);const old=await runAttempt(staleScope,false,vs,await victim.load('player/engine.mjs'));
        await store.deleteProfile(stale);
        await until(()=>vs.activeScope().profileId==='local-default');
        await rejects(()=>vs.saveAttempt(old,null,staleScope),'PROFILE_REMOVED');
        const fresh=await withFrame();
        fresh.w.sessionStorage.setItem('kalibataku.scope',JSON.stringify(staleScope));
        localStorage.setItem('kalibataku.localProfile',JSON.stringify(staleScope));
        const fs=await fresh.load('data/store.js');
        check(fs.activeScope().profileId==='local-default');
        check(await fs.getAttempt(old.attempt_id,fs.activeScope())===null);
        const newSession=await runAttempt(await fs.resolveActiveScope(),true,fs,await fresh.load('player/engine.mjs'));
        check(newSession.profile_id==='local-default');return {active:'local-default',old_attempt_copied:false,fresh_session:'completed'};
      }finally{
        if(previous===null)localStorage.removeItem('kalibataku.localProfile');else localStorage.setItem('kalibataku.localProfile',previous);
      }
    });
    await test('TC-133-panel-restore','Profiles panel previews and restores an actual backup file to the named owner on a shared device',async()=>{
      const owner=await store.createProfile('Archive owner'),origin=store.scopeForLocal(owner.id),other=await store.createProfile('Active sibling');
      const a=await runAttempt(origin,false),copy=await backup.exportBackup(origin),baseEvents=await store.listEvents(a.attempt_id,origin);
      await store.deleteProfile(owner.id);
      const panel=await first.load('data/panels.js'),w=first.w,root=w.document.createElement('div');w.document.body.append(root);
      const prior=store.activeScope(),preferred=w.localStorage.getItem('kalibataku.localProfile');
      const button=text=>[...root.querySelectorAll('button')].find(b=>b.textContent===text);
      const choose=data=>{
        const file=new w.File([JSON.stringify(data)],'qa.json',{type:'application/json'}),dt=new w.DataTransfer();dt.items.add(file);
        const input=root.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new w.Event('change',{bubbles:true}));
      };
      try{
        await store.selectLocalProfile(other.id);await panel.renderDataPanel(root,{locale:'en',page:'profiles'});
        choose(a);await until(()=>root.textContent.includes('A session copy is a read-only record'));
        choose({schema_version:'parents-report-1.0'});
        await until(()=>root.textContent.includes('This is a learning report'));
        choose(copy);
        const restore=await until(()=>button('Restore to profile Archive owner'));
        check(root.textContent.includes('1 session')&&root.textContent.includes('Active sibling')&&root.textContent.includes('original file owner'));
        check(await store.getAttempt(a.attempt_id,origin)===null);
        restore.click();const open=await until(()=>button('Open restored profile'));
        check(store.activeScope().profileId===other.id);
        check(JSON.stringify(await store.listEvents(a.attempt_id,origin))===JSON.stringify(baseEvents));
        open.click();await until(()=>root.querySelector('section h2')?.textContent==='Archive owner');
        const review=button('Review deletion');review.click();await until(()=>button('Delete data for Archive owner'));
        check(root.textContent.includes(baseEvents.length+' recorded events'));button('Cancel').click();
        return {source:'Archive owner',active_during_restore:'Active sibling',opened_only_after_explicit_choice:true,
          sessions:1,ledger:baseEvents.length,report_json_rejected:true,raw_session_rejected:true,deletion_review_includes_scope_and_counts:true};
      }finally{
        root.remove();await store.deleteProfile(owner.id);await store.deleteProfile(other.id);
        store.selectScope(prior);if(preferred===null)w.localStorage.removeItem('kalibataku.localProfile');else w.localStorage.setItem('kalibataku.localProfile',preferred);
      }
    });
    await test('TC-179','Foreground drain produces only correlated mock receipts and no Background Sync dependency',async()=>{
      const r=await sync.syncPending(demo),queue=await sync.listOutbox(demo);check(r.sent===1);check(queue[0].state==='mock_accepted'&&queue[0].grading_state==='unverified');
      const group=sync.deliverySummary(queue).get(queue[0].attempt_id);check(group.accepted===1&&group.last_ack);
      return {sent:r.sent,state:queue[0].state,last_mock_ack:group.last_ack,grading:'unverified'};
    });
    await test('TC-176','Select one pack; integrity failure and cancellation keep prior state, certified assets exist',async()=>{
      const off=await first.load('data/offline.js');
      const info={id:entry.package_id,version:entry.content_version,url:entry.url,sha256:entry.sha256,bytes:entry.bytes||0,dependencies:['bank/index.json',g.url,l.url]};
      const aborter=new AbortController();aborter.abort();
      await rejects(()=>off.installPackage(info,{signal:aborter.signal}),'AbortError');
      await rejects(()=>off.installPackage({...info,sha256:'0'.repeat(64)}),'CHECKSUM_MISMATCH');
      const manifest=await off.offlineManifest(),plan=await off.downloadPlan(info,manifest);
      check(manifest.capabilities.practice==='installed-pack'&&manifest.capabilities.reports==='online');
      const progress=[];const installed=await off.installPackage(info,{onProgress:p=>progress.push(p)});
      check(plan.bytes>0 && progress.at(-1).bytes===plan.bytes && installed.transfer_bytes===plan.bytes);
      check((await off.listInstalled()).some(x=>x.id===info.id));check(progress.at(-1).done===installed.shellUrls.length+installed.packUrls.length);
      return {installed:installed.id,shell_assets:installed.shellUrls.length,bank_assets:installed.packUrls.length,remaining_bytes:plan.bytes,verified_transferred:installed.transfer_bytes,capabilities:manifest.capabilities};
    });
    await test('TC-178','Eviction invalidates offline-ready status and leaves persisted ledger intact',async()=>{
      const off=await first.load('data/offline.js'),before=await store.listEvents(null,local),installed=(await off.listInstalled()).find(x=>x.id===entry.package_id);
      const cache=await caches.open(installed.packCache);await cache.delete(installed.url);
      check(!(await off.listInstalled()).some(x=>x.id===entry.package_id));check((await off.inspectInstalled()).find(x=>x.id===entry.package_id).state==='missing');await off.removeInstalled(installed.id,installed.version);
      check(JSON.stringify(before)===JSON.stringify(await store.listEvents(null,local)));return {events_retained:before.length};
    });
  }finally{for(const f of frames)f.remove();}
  return results;
}
