const wait=ms=>new Promise(r=>setTimeout(r,ms));
function until(read,label,ms=14000){
  return new Promise((resolve,reject)=>{
    const begin=performance.now();
    function poll(){let value;try{value=read();}catch{} if(value)resolve(value);else if(performance.now()-begin>ms)reject(Error(label));else setTimeout(poll,20);}
    poll();
  });
}
function observe(w,type,accept){
  if(!w.PerformanceObserver.supportedEntryTypes.includes(type))return ()=>{};
  const o=new w.PerformanceObserver(list=>list.getEntries().forEach(accept));
  o.observe({type,buffered:true});
  return ()=>{o.takeRecords().forEach(accept);o.disconnect();};
}
function tuple(list){return list.map(x=>({path:new URL(x.name).pathname,raw:x.decodedBodySize,transfer:x.transferSize,start_ms:x.startTime,duration_ms:x.duration}));}
function cls(entries){
  let max=0,group=0,first=0,last=-Infinity;
  for(const e of entries.filter(e=>!e.input).sort((a,b)=>a.at-b.at)){
    if(e.at-last>=1000||e.at-first>=5000){group=0;first=e.at;}
    group+=e.value;max=Math.max(max,group);last=e.at;
  }
  return max;
}
async function effect(w,action,feedback,complete,label){
  const read=()=>feedback()||complete();
  const start=w.performance.now(), visible=w.document.visibilityState;
  let first=null, frame=null, resolveFrame;
  const afterPaintOpportunity = new Promise(resolve=>{resolveFrame=resolve;});
  function notice(){
    if(first!==null||!read())return;
    first=w.performance.now()-start;
    // Two animation frames bracket a rendering opportunity. Actual panel scan-out is not measurable here.
    w.requestAnimationFrame(()=>w.requestAnimationFrame(()=>{
      frame=w.performance.now()-start;resolveFrame();
    }));
  }
  const watch=new w.MutationObserver(notice);
  watch.observe(w.document.body,{childList:true,subtree:true,attributes:true,characterData:true});
  try{
    action();notice();
    await until(complete,label);const ready=w.performance.now()-start;
    if(first===null){first=ready;}
    await Promise.race([afterPaintOpportunity,wait(180)]);
    return {local_dom_feedback_ms:first,paint_opportunity_ms:frame,visible_at_dispatch:visible,ready_ms:ready};
  }finally{watch.disconnect();}
}
export async function runNavigation(w,base,number){
  const pathname='/probe-lab-'+crypto.randomUUID()+'/school/math/';
  const url=new URL(pathname,location.href).href;
  w.location.href=url;
  await until(()=>w.location.pathname===pathname&&w.document.querySelector('main h1')&&!w.document.documentElement.hasAttribute('data-opening'),'Home ready');
  const d=w.document, read=s=>d.querySelector(s);
  const lcp=[],shifts=[],long=[];
  const end=[observe(w,'largest-contentful-paint',e=>lcp.push(e.startTime)),
    observe(w,'layout-shift',e=>shifts.push({at:e.startTime,value:e.value,input:e.hadRecentInput})),
    observe(w,'longtask',e=>long.push({at:e.startTime,ms:e.duration}))];
  await wait(320);
  const all=()=>w.performance.getEntriesByType('resource');
  const homeEnd=w.performance.now();
  const initial=tuple(all()), run={number,viewport:[w.innerWidth,w.innerHeight],path:pathname,home:initial};
  try{
    const catalog=()=>read('main .pack-list, main [data-route="packs"]:not([aria-busy=true]) h1');
    run.catalog=await effect(w,()=>{w.location.hash='/packs?grade=1&level=1&op=ADD';},()=>read('[data-route="packs"][aria-busy=true]'),catalog,'Catalog ready');
    w.location.hash='/session/new?grade=1&level=1&op=ADD&mode=practice&pack=MM-G01-L01-ADD-P001';
    const go=await until(()=>read('form.setup button[type=submit]:not(:disabled)'),'Setup launch');
    const shuffle=read('[name=shuffle]');if(shuffle?.checked)shuffle.click();
    run.launch=await effect(w,()=>go.click(),()=>go.disabled||read('.kp-answer'),()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer'),'Player ready');
    const field=read('.kp-answer');
    field.value='5';field.dispatchEvent(new w.Event('input',{bubbles:true}));
    const submit=read('[data-submit]');
    run.submit=await effect(w,()=>submit.click(),()=>submit.disabled||read('fieldset:disabled'),()=>read('[data-answer-feedback]'),'Answer feedback');
    const before=read('#kp-question-position')?.textContent;
    const active=read('[data-submit]');
    run.next=await effect(w,()=>active.click(),()=>active.disabled||read('fieldset:disabled'),()=>read('#kp-question-position')?.textContent!==before&&!read('.kp-answer')?.value,'Next question');
    run.post_player=tuple(all()).filter(row=>!initial.some(x=>x.path===row.path));
    w.location.hash='/reports?source=demo&student=demo-04';
    await until(()=>read('.tw-paper[data-report-id]'),'Report preview',18000);
    const paper=read('.tw-paper'),prior=paper.dataset.reportId;
    const language=[...d.querySelectorAll('main select')].find(n=>[...n.options].some(o=>o.value==='bilingual'));
    if(!language)throw Error('Report preview language');
    language.value=language.value==='en'?'id':'en';
    run.preview=await effect(w,()=>language.dispatchEvent(new w.Event('change',{bubbles:true})),
      ()=>/Menyiapkan|Preparing/i.test(paper.textContent)||paper.dataset.reportId!==prior,()=>paper.dataset.reportId!==prior,'Preview language redraw');
    run.post_teacher=tuple(all()).filter(row=>!initial.some(x=>x.path===row.path)&&!run.post_player.some(x=>x.path===row.path));
  }finally{
    end.forEach(stop=>stop());
    Object.assign(run,{home_lcp_candidates_ms:lcp.filter(x=>x<=homeEnd),home_lcp_ms:lcp.filter(x=>x<=homeEnd).at(-1)??null,
      shifts,cls:cls(shifts.filter(e=>e.at<=homeEnd)),journey_cls:cls(shifts),long_tasks:long,navigation_ms:w.performance.getEntriesByType('navigation')[0]?.duration});
  }
  // Same asset URLs, fresh document. Cache policy and service-worker control remain browser-managed.
  w.location.href=url+'?lab=asset-warm';
  await until(()=>w.location.search==='?lab=asset-warm'&&w.document.querySelector('main h1')&&!w.document.documentElement.hasAttribute('data-opening'),'Warm home');
  const paints=[],shift=[];
  const stopWarm=[observe(w,'largest-contentful-paint',e=>paints.push(e.startTime)),
    observe(w,'layout-shift',e=>shift.push({at:e.startTime,value:e.value,input:e.hadRecentInput}))];
  await wait(320);stopWarm.forEach(stop=>stop());
  run.warm_home={lcp_ms:paints.at(-1)??null,cls:cls(shift),resources:tuple(w.performance.getEntriesByType('resource'))};
  return run;
}
