import * as store from '/school/math/data/store.js';
import {exportBackup,readBackup,importBackup} from '/school/math/data/backup.js';
import {createAttempt} from '/school/math/player/engine.mjs';
import {session} from '/school/math/player/session.mjs';
const output=document.querySelector('#result'),run=document.querySelector('#run'),root=document.querySelector('#fixture');
const wait=async predicate=>{
  const end=performance.now()+6000;
  do{if(await predicate())return;await new Promise(r=>setTimeout(r,30));}while(performance.now()<end);
  throw new Error('Timed out waiting for UI');
};
const check=(test,message)=>{if(!test)throw new Error(message);};
run.onclick=async()=>{
  run.disabled=true;const evidence={status:'RUNNING',checks:[],browser:navigator.userAgent};let backup,dispose,scope;
  const controller=new AbortController();let destination='';
  try{
    check(!(await store.getStatus()).temporary,'Requires native IndexedDB');
    const profile=await store.createProfile('Synthetic session removal '+Date.now());
    scope=store.scopeForLocal(profile.id);
    const shard=await (await fetch('/school/math/bank/g01/l01.json',{cache:'no-store'})).json();
    const entry=shard.competencies.find(c=>c.operation==='ADD').packages[0];
    const url='/school/math/'+entry.url+'?sha256='+entry.sha256;
    const bytes=await (await fetch(url,{cache:'no-store'})).arrayBuffer();
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    check(digest===entry.sha256,'Package differs from released manifest');
    evidence.verified_package_sha256=digest;
    const mod=await import(url);
    const a=createAttempt(mod.default,scope,{mode:'practice',question_count:2});
    await store.saveAttempt(a,null,scope);
    const ctx={root,lang:'id',prefs:{keypad:true},go:path=>{destination=path;},signal:controller.signal};
    dispose=await session(ctx,a,scope);
    const input=root.querySelector('#kp-answer');input.value='3/';input.dispatchEvent(new Event('input',{bubbles:true}));
    await wait(async()=> (await store.getAttempt(a.attempt_id,scope))?.items[0].draft==='3/');
    const symbols=root.querySelector('.kp-symbols');if(symbols&&!symbols.open)symbols.querySelector('summary').click();
    const keys=[...root.querySelectorAll('.kp-pads button,.kp-btn.main')];
    const bounds=keys.map(b=>[b.textContent.trim(),b.getBoundingClientRect().width,b.getBoundingClientRect().height]);
    check(bounds.length===4&&bounds.every(([,w,h])=>w>=48&&h>=48),'Touch target under 48 px');
    evidence.checks.push({test_id:'TC-161',observed:bounds});
    backup=await readBackup(await exportBackup(scope));
    check(backup.records.attempts[0].data.items[0].draft==='3/','Backup is missing latest draft');
    await store.deleteProfile(profile.id);
    await wait(()=>root.textContent.includes('Profil latihan telah dihapus'));
    check(!root.querySelector('input,form'),'Old session is still editable');
    const labels=[...root.querySelectorAll('button')].map(b=>b.textContent);
    check(labels.includes('Pilih profil')&&labels.includes('Unduh salinan sesi lama'),'Missing actions');
    window.dispatchEvent(new CustomEvent('kalibataku:language',{detail:{lang:'en'}}));
    check(root.textContent.includes('Practice profile removed'),'Removal notice did not update locale');
    [...root.querySelectorAll('button')].find(b=>b.textContent==='Choose a profile').click();
    check(destination==='profiles','Wrong recovery route');
    check(!await store.getAttempt(a.attempt_id,store.scopeForLocal('local-default')),'Orphan session transferred into default profile');
    evidence.checks.push({test_id:'TC-134',observed:['Distinct removed-profile notice in ID and EN','Writer inputs removed; original draft copy offered for download','Choose a profile opened profiles route','No transfer into local-default']});
    evidence.status='PASS';
  }catch(err){evidence.status='FAIL';evidence.error=String(err.stack||err);}
  finally{
    if(dispose)dispose();controller.abort();
    if(backup){try{await importBackup(backup);evidence.synthetic_backup_restored=true;}catch(e){evidence.status='FAIL';evidence.restore_error=String(e);}}
    root.replaceChildren();output.textContent=JSON.stringify(evidence,null,2);run.disabled=false;
  }
};
