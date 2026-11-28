// Normal application launch and a full two-revision update on an isolated test URL.
// Only fixture_server.py recognizes these availability controls, never a deployed app.
const poll=async(check,message,ms=18000)=>{
  const end=Date.now()+ms;while(Date.now()<end){try{const v=await check();if(v)return v;}catch{}await new Promise(r=>setTimeout(r,50));}
  throw Error(message);
};
export async function runOfflineJourney(w,base){
  if(!w)throw Error('Test window required');
  const savedPreference=localStorage.getItem('kalibataku.localProfile');
  const token=crypto.randomUUID(),testBase=new URL('/probe-offline-'+token+'/school/math/',base).href;
  const setState=async state=>{
    const r=await fetch('/__qa/availability',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,state})});
    if(!r.ok)throw Error('Could not set test availability '+r.status);
  };
  const getJSON=async p=>(await fetch(new URL(p,testBase),{cache:'no-store'})).json();
  const fingerprint=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const observedFile=async()=>fingerprint(await(await w.fetch(new URL('app.mjs',testBase))).arrayBuffer());
  const show=async route=>{
    const dest=testBase+'#/'+route,routeName=route.split('?')[0]||'home';
    w.location.href=dest;
    await poll(()=>w.location.href===dest && w.document.querySelector('.app-view:not([aria-busy="true"])')?.dataset.route===routeName,'App load timeout: '+route);
  };
  const press=async rx=>{
    const button=await poll(()=>[...w.document.querySelectorAll('main button')].find(b=>!b.disabled&&!b.hidden&&rx.test(b.innerText.trim())),'Missing control '+rx);
    button.click();return button;
  };
  const mainText=()=>w.document.querySelector('main')?.innerText||'';
  const leave=async()=>{w.location.href=new URL('/__qa/integration/index.html',base);await poll(()=>w.location.pathname==='/__qa/integration/index.html','Leaving old client');};
  const diag={};
  const results=[],test=async(id,title,fn)=>{try{results.push({id,description:title,status:'PASS',observations:await fn()});}
    catch(e){results.push({id,description:title,status:'FAIL',error:e.message,url:w.location.href,heading:w.document.querySelector('h1')?.textContent,diag});}};
  let reg,pinned,saved,url,original,activeHash,updated,waitingWorker,selected,modifiedHash,scope,attemptId;
  await setState('original');
  try{
    await test('TC-176','Launch a pinned assessment in a new application document while every source request returns HTTP 503',async()=>{
      const index=await getJSON('bank/index.json'),g=index.grades[0],l=(await getJSON(g.url)).levels[0],comp=(await getJSON(l.url)).competencies.find(x=>x.active);
      const entry=comp.packages.find(p=>p.form_id)||comp.packages[0];
      const mod=await import(new URL('data/offline.js',testBase)),store=await import(new URL('data/store.js',testBase));
      scope=store.scopeForLocal((await store.createProfile('QA offline')).id);
      const setup='session/new?'+new URLSearchParams({grade:g.grade,level:l.level,op:comp.operation,pack:entry.package_id,mode:'assessment'});
      selected={id:entry.package_id,version:entry.content_version,url:entry.url,sha256:entry.sha256,dependencies:['bank/index.json',g.url,l.url],launch:setup};
      original=await getJSON('offline-assets.json');activeHash=original.assets.find(a=>a.path==='app.mjs').sha256;
      reg=await mod.registerOffline();
      await poll(()=>reg?.active?.state==='activated','Scoped worker installation and activation');
      await show('profiles');
      // A client created before activate/claim may still be uncontrolled or use
      // a parent-scope worker. A new document after activation must bind this
      // exact scope before using it for the outage, upgrade and rollback proof.
      if(w.navigator.serviceWorker.controller?.scriptURL!==reg.active.scriptURL){
        await leave();await show('profiles');
      }
      await poll(()=>w.navigator.serviceWorker.controller?.scriptURL===reg.active.scriptURL,'Waiting for exact scoped client controller');
      // Set the test popup's profile without touching other browser data.
      const chooser=await poll(()=>w.document.querySelector('.data-body select'),'Profile chooser');
      chooser.value=scope.profileId;chooser.dispatchEvent(new w.Event('change',{bubbles:true}));
      w.document.querySelector('[data-switch-profile]').click();await poll(()=>w.document.querySelector('.data-body h2')?.textContent==='QA offline','Active profile switch');
      await show('offline?'+setup.split('?')[1]);
      const estimateText=await poll(()=>mainText().split('\n').find(t=>/Perkiraan unduhan|Estimated remaining/.test(t)),'Exact selected download size');
      if(!/KiB|MiB/.test(estimateText))throw Error('Missing download size');
      const nativeStorage=!!w.navigator.storage;
      if(!nativeStorage)Object.defineProperty(w.navigator,'storage',{configurable:true,value:{}});
      const descriptor=Object.getOwnPropertyDescriptor(w.navigator.storage,'estimate');
      Object.defineProperty(w.navigator.storage,'estimate',{configurable:true,value:async()=>({quota:10,usage:10})});
      try{
        await press(/^Siapkan untuk offline$|^Prepare for offline$/);
        await poll(()=>/Ruang perangkat penuh|Device storage is full/.test(mainText()),'Capacity error visible');
        if((await mod.listInstalled()).some(x=>x.id===selected.id))throw Error('Quota failure labelled ready');
      }finally{if(descriptor)Object.defineProperty(w.navigator.storage,'estimate',descriptor);else delete w.navigator.storage.estimate;if(!nativeStorage)delete w.navigator.storage;}
      await press(/^Siapkan untuk offline$|^Prepare for offline$/);
      await poll(()=>/Siap untuk latihan offline|Ready for offline practice/.test(mainText()),'Installed from visible control');
      pinned=(await mod.listInstalled()).find(x=>x.id===selected.id);
      if(!pinned||!/guru|teacher/i.test(mainText()))throw Error('Missing capability state');
      results.push({id:'AC-060',description:'Selected pack size, quota message, retry, verified practice and teacher/report capabilities on the offline screen',status:'PASS',
        observations:{expected:'Exact estimate, actionable full storage, no ready flag on failure; successful retry identifies supported features.',size_label:estimateText,
          native_storage_manager:nativeStorage,quota_recovery:true,final_state:mainText().slice(0,1250),decoded_bytes:pinned.transfer_bytes}});
      await show('sync');
      const personal=mainText();
      if(!/Tidak ada pengiriman ke sekolah|There is no school delivery/.test(personal)||!/belum diverifikasi|unverified/.test(personal))throw Error('Personal result delivery ambiguous');
      results.push({id:'AC-065',description:'Personal delivery panel identifies device-only scope and unverified academic status',status:'PASS',observations:{expected:'Local only without delivery claim',visible:personal.slice(0,850)}});
      diag.registration_scope=reg.scope;diag.active=reg.active?.scriptURL;diag.controller=w.navigator.serviceWorker.controller?.scriptURL;
      diag.pinned_shell=pinned.shellCache;diag.original_release=original.release;
      diag.cached_entry=!!await caches.match(new URL('index.html',testBase),{cacheName:pinned.shellCache});
      diag.active_name=(await fetch(reg.active.scriptURL,{cache:'no-store'}).then(r=>r.text())).match(/const RELEASE='([^']+)'/)?.[1];
      await leave();await setState('outage');
      const response=await fetch(new URL('bank/index.json',testBase),{cache:'no-store'});
      if(response.status!==503)throw Error('Fixture outage was not active');
      await show(setup);const button=await poll(()=>w.document.querySelector('form.setup button[type=submit]'),'Offline setup missing');
      button.click();await poll(()=>w.document.querySelector('.kp-answer'),'Offline player did not start');
      url=w.location.href;attemptId=decodeURIComponent(w.location.hash.split('/').at(-1));
      await poll(()=>w.document.querySelector('.app-view:not([inert]):not([aria-busy]) #kp-expression[data-math=svg]'),'Offline typesetter did not finish');saved=await store.getAttempt(attemptId,scope);if(!saved?.ready||saved.package_id!==selected.id)throw Error('Session did not bind pinned offline data');
      return {pack:pinned.id,attempt_mode:saved.mode,loaded:saved.items.length,network_status:503,controller:w.navigator.serviceWorker.controller.scriptURL};
    });
    await test('TC-177','New worker waits throughout a live assessment; closing its client switches to the verified new shell',async()=>{
      if(!saved)throw Error('Offline assessment prerequisite failed');
      await setState('updated');updated=await getJSON('offline-assets.json');modifiedHash=updated.assets.find(a=>a.path==='app.mjs').sha256;
      if(updated.release===original.release||modifiedHash===activeHash)throw Error('Test releases identical');
      await reg.update();waitingWorker=await poll(()=>reg.waiting,'New service worker did not enter waiting');
      if(w.location.href!==url||!w.document.querySelector('.kp-answer')||await observedFile()!==activeHash)throw Error('Active assessment switched release');
      const mod=await import(new URL('data/offline.js',testBase));await mod.installPackage(selected);
      await leave();await poll(()=>waitingWorker.state==='activated','Updated worker did not activate');
      await show('history');await poll(()=>w.document.querySelector('h1'),'History after update');
      if(await observedFile()!==modifiedHash)throw Error('New client did not load updated release');
      const store=await import(new URL('data/store.js',testBase)),after=await store.getAttempt(attemptId,scope);
      if(after.package_id!==saved.package_id || after.items.map(i=>i.question_instance_id).join()!==saved.items.map(i=>i.question_instance_id).join())throw Error('Session changed across update');
      return {old_release:original.release,new_release:updated.release,old_js_sha256:activeHash,new_js_sha256:modifiedHash,items_retained:after.items.length};
    });
    await test('TC-186','Roll back to archived revision A, verify original JS bytes and retained local assessment from revision B',async()=>{
      if(!updated||!waitingWorker)throw Error('Upgrade prerequisite failed');
      await setState('original');await reg.update();const rollbackWorker=await poll(()=>reg.waiting,'Rollback worker failed to install');
      await leave();await poll(()=>rollbackWorker.state==='activated','Rollback worker did not activate');
      await show('history');await poll(()=>w.document.querySelector('h1'),'History after rollback');
      if(await observedFile()!==activeHash)throw Error('Original asset digest not restored');
      const store=await import(new URL('data/store.js',testBase));
      if(!(await store.getAttempt(attemptId,scope))?.ready)throw Error('No attempt after rollback');
      return {restored_js_sha256:activeHash,restored_release:original.release,local_attempt_preserved:true};
    });
    await test('AC-061','Complete a cached assessment during HTTP 503, then open an unavailable teacher route and return to local work',async()=>{
      await leave();await setState('outage');await show('session/'+attemptId);
      const ready=await poll(()=>w.document.querySelector('.kp-answer')||[...w.document.querySelectorAll('main button')].find(b=>/Ambil alih di tab ini|Take over in this tab/.test(b.innerText)),'Offline resume');
      const takeover=ready.tagName==='BUTTON';
      if(takeover)ready.click();
      const input=await poll(()=>w.document.querySelector('.kp-answer'),'Offline answer');
      const answer=saved.items[0].question.answer;
      input.value=answer.numerator+'/'+answer.denominator;input.dispatchEvent(new w.Event('input',{bubbles:true}));
      await press(/^Simpan & lanjut$|^Save & continue$/);
      await poll(()=>w.document.querySelector('.kp-answer')?.value==='','Committed next question');
      await press(/^Tinjau & kirim$|^Review & submit$/);await press(/^Kirim hasil akhir$|^Submit final answers$/);
      await poll(()=>w.location.hash.startsWith('#/results/')&&/correct|benar/i.test(w.document.querySelector('main h2')?.textContent||''),'Offline final result');
      const store=await import(new URL('data/store.js',testBase)),after=await store.getAttempt(attemptId,scope);
      if(after.status!=='completed'||after.metrics.C!==1)throw Error('Committed metrics absent');
      await show('reports');
      const unavailable=mainText(),link=w.document.querySelector('main a[href="#/offline"]');
      if(!link||!w.document.querySelector('main button'))throw Error('Missing offline recovery actions');
      link.click();await poll(()=>w.document.querySelector('.data-body h1'),'Return to available packs');
      await show('session/new?grade=2&level=1&op=ADD&mode=practice');
      const uncached=mainText(),back=w.document.querySelector('main a[href="#/offline"]');
      if(!back||!w.document.querySelector('main button'))throw Error('Missing recovery actions on uncached material');
      back.click();await poll(()=>w.document.querySelector('.data-body h1'),'Recover from uncached material');
      return {expected:'Saved answer and result at 503; unavailable report and uncached material offer retry/back to packs',correct:after.metrics.C,
        items:after.metrics.N,explicit_resume_takeover:takeover,teacher_fallback:unavailable.slice(0,650),uncached_fallback:uncached.slice(0,650),return_route:w.location.hash};
    });
    await test('AC-062','Remove an offline copy from the interface while retaining the completed session and event sequence',async()=>{
      const store=await import(new URL('data/store.js',testBase)),mod=await import(new URL('data/offline.js',testBase));
      await show('offline');
      const before=await store.listEvents(attemptId,scope);
      const note=mainText().split('\n').find(t=>/Menghapus salinan offline|Removing an offline copy/.test(t));
      await press(/^Hapus salinan offline$|^Remove offline copy$/);
      await poll(async()=>!(await mod.listInstalled()).some(p=>p.id===selected.id),'Copy removed');
      const after=await store.listEvents(attemptId,scope);
      if(!note||!after.length||JSON.stringify(after)!==JSON.stringify(before))throw Error('Removal changed history');
      return {expected:'Explanation visible, removed pack no longer ready, exact event ledger retained',visible_explanation:note,events:after.length,profile:scope.profileId};
    });
  }finally{
    await setState('original');await leave().catch(()=>{});
    if(reg)await reg.unregister();
    const prefix='kalibataku:'+new URL(testBase).pathname+':';for(const name of await caches.keys())if(name.startsWith(prefix))await caches.delete(name);
    if(scope){const store=await import(new URL('data/store.js',testBase));await store.deleteProfile(scope.profileId);}
    if(savedPreference===null)localStorage.removeItem('kalibataku.localProfile');else localStorage.setItem('kalibataku.localProfile',savedPreference);
  }
  return results;
}
