import {route,until,delay,chooseLang,button} from './probes.mjs';
const base=new URL('/school/math/',location.href).href,original=new URL('/baseline/',location.href).href;
const checks=(id,expected,actual)=>({id,expected,actual,status:JSON.stringify(expected)===JSON.stringify(actual)?'PASS':'FAIL'});
async function identity(base){
  const m=await (await fetch(new URL('offline-assets.json',base),{cache:'no-store'})).json();
  return {release:m.release,bootstrap:m.assets.find(a=>a.path==='app.mjs')?.sha256,bank:m.assets.find(a=>a.path==='bank/index.json')?.sha256};
}
async function baseline(w,r){
  await route(w,original,'session/new?grade=1&level=1&op=ADD&mode=practice&pack=MM-G01-L01-ADD-P001');await chooseLang(w,'id');
  const d=w.document;
  const count=await until(()=>d.querySelector('[name=question_count]'),'Baseline count');count.value=2;count.dispatchEvent(new w.Event('input',{bubbles:true}));
  (await until(()=>button(d,/^Mulai sesi$/i),'Start')).click();await until(()=>d.querySelector('.kp-answer'),'Opened player');
  const expressions=[];
  for(const [v,action] of [['5',/^Lanjut$/],['4',/^Selesaikan sesi$/]]){
    const input=await until(()=>d.querySelector('.kp-answer'),'Answer');expressions.push(d.querySelector('[role=math]')?.innerText);input.value=v;input.dispatchEvent(new w.Event('input',{bubbles:true}));(await until(()=>button(d,action),'Click '+action)).click();await delay(250);
  }
  const preview=d.querySelector('main').innerText;
  (await until(()=>button(d,/^Kirim hasil akhir$/),'Commit')).click();
  await until(()=>w.location.hash.startsWith('#/results/')&&d.querySelector('main').innerText.includes('%'),'Final result');
  const final=d.querySelector('main').innerText;
  r.checks.push({id:'S01',expected:'0 blank in preview and final, 2 correct',actual:{expressions,preview,final},status:preview.includes('0 soal kosong')&&/0%/.test(final)&&final.includes('2')?'REPRODUCED_FAILURE':'INCONCLUSIVE'});
  const school=await (await import('../teacher/ux-browser.mjs')).runSchoolUX(w,original,true);
  r.checks.push(...school.map(row=>({...row,status:row.status==='FAIL'?'REPRODUCED_FAILURE':'UNEXPECTED_PASS'})));
}
async function guide(w,r){
  w.location.href=new URL('/guide?visit='+Date.now(),location.origin);const d=await until(()=>w.document.readyState==='complete'&&w.document.getElementById('finding-count')&&w.document,'Guide');
  const theme=d.querySelector('#reader-theme'),q=d.querySelector('#section-query'),sev=d.querySelector('#severity');
  q.value='prompt';q.dispatchEvent(new w.Event('input'));await delay(100);const promptResults=d.getElementById('search-status')?.textContent;
  theme.value='dark';theme.dispatchEvent(new w.Event('change'));sev.value='P0';sev.dispatchEvent(new w.Event('change'));
  r.checks.push(checks('guide-controls',true,!!(promptResults&&d.querySelector('#toc')&&d.querySelector('#finding-query'))));
  r.guide={title:d.title,search_feedback:promptResults,theme:theme.value,priority:sev.value,visibleFindings:[...d.querySelectorAll('.finding')].filter(n=>!n.hidden).length};
}
for(const btn of document.querySelectorAll('[data-run]'))btn.onclick=async()=>{
  const suite=btn.dataset.run,w=window.open('about:blank','_blank','popup,width=1100,height=780'),r={suite,utc:new Date().toISOString(),user_agent:navigator.userAgent,checks:[]};
  const out=document.querySelector('pre');out.textContent='Running '+suite;
  try{
    if(!w)throw Error('Window blocked');if(suite!=='guide')r.runtime=await identity(suite==='baseline-ux'?original:base);
    if(suite==='baseline-ux')await baseline(w,r);
    if(suite==='guide')await guide(w,r);
    if(suite==='school-ux')r.checks=await (await import('../teacher/ux-browser.mjs')).runSchoolUX(w,base);
    if(suite==='player-ux')r.checks=await (await import('../player/ux-browser.mjs')).runPlayerUX(w,base);
    if(['shell-ux','visual-ux','reflow-ux'].includes(suite))await (await import('./ux-visual.mjs')).run(w,r,base);
    if(suite!=='guide'){r.runtime_after=await identity(suite==='baseline-ux'?original:base);if(JSON.stringify(r.runtime)!==JSON.stringify(r.runtime_after))r.checks.push(checks('build-stability',r.runtime,r.runtime_after));}
  }catch(e){r.error=String(e);r.failure_url=w?.location.href;r.visible_text=w?.document.body?.innerText?.slice(0,1500);}
  finally{w?.close();r.finished_utc=new Date().toISOString();const res=await fetch('/__qa/ux-receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});out.textContent=suite+' · '+res.status+' · '+r.checks.map(x=>x.id+' '+x.status).join(', ')+' '+(r.error||'');}
};
