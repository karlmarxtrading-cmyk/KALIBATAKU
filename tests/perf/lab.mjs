import {runNavigation} from './navigation.mjs';
import {scale} from './scale.mjs';
const base='/school/math/';
const btn=document.querySelector('#run'),display=document.querySelector('#status');
const notify=message=>display.textContent=message;
btn.onclick=async()=>{
  const mode=new URLSearchParams(location.search).get('mode')||'both';
  const w=mode==='scale'?null:window.open('about:blank','_blank','popup,width=1080,height=760');
  btn.disabled=true;
  const r={suite:'perf-ux',mode,utc:new Date().toISOString(),navigator:navigator.userAgent,hardware_concurrency:navigator.hardwareConcurrency,
    device_memory_gib:navigator.deviceMemory||null,cpu:'Unthrottled',network:'Managed preview; no artificial network throttling',method:'Synthetic scripted interaction. Mutation feedback measures DOM update, not trusted event or field INP. The cold path is unique for every navigation.',
    runs:[],errors:[]};
  let store,profile;
  try{
    const manifest=await (await fetch(base+'offline-assets.json',{cache:'no-store'})).json();
    r.release=manifest.release;r.bootstrap=manifest.assets.find(x=>x.path==='app.mjs').sha256;
    if(mode!=='scale'){
      try{
        store=await import(base+'data/store.js');profile=await store.createProfile('QA-Lab navigation');
        if(!w)throw Error('Popup blocked');
        w.sessionStorage.setItem('kalibataku.scope',JSON.stringify(store.scopeForLocal(profile.id)));
        for(let i=1;i<=5;i++){notify('Navigation sample '+i+'/5');r.runs.push(await runNavigation(w,base,i));}
      }catch(e){r.errors.push({stage:'navigation',error:String(e.message),path:w?.location?.hash,visible:w?.document?.querySelector('main')?.innerText.slice(0,500)});}
      finally{w?.close();if(profile)await store.deleteProfile(profile.id);}
    }
    if(mode!=='navigation'){try{r.scale=await scale(notify);}catch(e){r.errors.push({stage:'scale',error:String(e.stack)});}}
  }catch(e){r.errors.push({stage:'initialize',error:String(e.stack)});}
  finally{
    try {
      const after=await (await fetch(base+'offline-assets.json',{cache:'no-store'})).json();
      r.release_after=after.release;
      if(r.release!==r.release_after)r.errors.push({stage:'identity',error:'Build changed during measurement; repeat on frozen build.'});
    }catch(e){r.errors.push({stage:'identity',error:String(e)});}
    r.finished=new Date().toISOString();
    const response=await fetch('/__qa/ux-receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});
    notify('Completed performance study · receipt '+response.status+' · '+r.runs.length+' navigation samples · '+(r.scale?.runs.length||0)+' scale samples');
    document.querySelector('#result').textContent=JSON.stringify(r.errors);btn.disabled=false;
  }
};
