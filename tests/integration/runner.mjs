import {delay,until,visible,name,button,geometry,semantics,resources,resize,route,chooseLang,chooseTheme,contrastProbe,wideLayoutSnapshot} from './probes.mjs';
const canonicalBase = new URL('/school/math/',document.baseURI).href;
let base=canonicalBase;
const output=document.querySelector('#out'), actions=[...document.querySelectorAll('[data-suite]')];
const profiles=[[320,568],[360,800],[390,844],[568,320],[768,1024],[1024,768],[1366,768],[1440,900],[2560,1080]];
const navPages=['','curriculum','curriculum?grade=1','packs?grade=1&level=1&op=ADD','session/new?grade=1&level=1&op=ADD','history','progress','start','profiles','offline','settings','demo/teacher','demo/assignments','demo/admin','reports'];
const profileURL=(group,i)=>new URL('/probe-'+group+'-'+i+'/school/math/',canonicalBase).href;

function checked(r,id,ok,detail) {
  r.checks.push({id,status:ok?'PASS':'FAIL',detail});
}
const suites = {
  async offline(w,r){r.results=await (await import('../data/offline-journey.mjs')).runOfflineJourney(w,base);},
  async teacher(w,r){r.checks=await (await import('../teacher/browser-suite.mjs')).runTeacherSuite(w,base,checks=>r.checks=checks);
    r.worker_profile=await (await import('./worker-load.mjs')).workerLoad(w,base);
    checked(r,'batch-main-thread',r.worker_profile.progress.length===24&&r.worker_profile.emitted_bytes>100000&&r.worker_profile.responded_during_batch&&r.worker_profile.archive_signature.join()==='80,75,3,4',r.worker_profile);
  },
  async data(w,r){
    const {runDataSuite}=await import('../data/browser-suite.mjs');
    r.results=await runDataSuite({base:profileURL("data",Date.now())});
  },
  async performance(w,r){
    r.scope='Laboratory localhost desktop engine, no CPU throttling, unshaped network, unique base path each run. No field data.';
    r.runs=[];
    for(let i=0;i<3;i++){
      const cold=profileURL('cold',String(Date.now())+'-'+i);
      await route(w,cold,'');await delay(500);
      const d=w.document,nav=w.performance.getEntriesByType('navigation')[0];
      const lcp=[],shifts=[],sources=[];const PO=w.PerformanceObserver;
      if(PO.supportedEntryTypes.includes('largest-contentful-paint'))new PO(list=>lcp.push(...list.getEntries().map(x=>x.startTime))).observe({type:'largest-contentful-paint',buffered:true});
      if(PO.supportedEntryTypes.includes('layout-shift'))new PO(list=>{for(const x of list.getEntries().filter(x=>!x.hadRecentInput)){shifts.push(x.value);sources.push({score:x.value,start:x.startTime,nodes:x.sources.map(s=>[s.node?.nodeName,s.node?.id||s.node?.className?.toString()?.slice(0,90),s.previousRect?.y,s.currentRect?.y])});}}).observe({type:'layout-shift',buffered:true});
      await delay(250);
      const trace=resources(w), measuredLCP=lcp.length?Math.round(Math.max(...lcp)):null;
      r.runs.push({geometry:geometry(w),lcp_ms:measuredLCP,layout_shift_sum:shifts.reduce((s,v)=>s+v,0),shift_sources:sources,navigation_duration_ms:Math.round(nav.duration),request_count:trace.length,resources:trace});
      checked(r,'initial-'+(i+1),trace.length>0&&!trace.some(x=>/\/teacher\/|\/player\/|\.mjs$/.test(x.path)&&(/\/teacher\/|\/player\/|\/bank\/.*\.mjs$/).test(x.path)),'Initial requests '+trace.length);
      checked(r,'same-origin-'+(i+1),trace.every(x=>x.origin===location.origin),'No remote runtime requests');
    }
    const lcps=r.runs.map(x=>x.lcp_ms).filter(Number.isFinite).sort((a,b)=>a-b);
    r.median_lcp_ms=lcps.length===3?lcps[1]:null;
    checked(r,'lab-paint',lcps.length===3&&lcps[1]<=2500&&r.runs.every(x=>x.layout_shift_sum<=0.1),{lcp:lcps,layout_shifts:r.runs.map(x=>x.layout_shift_sum)});
  },
  async layout(w,r){
    r.screens=[];r.scope='Desktop browser pop-up window; actual innerWidth/innerHeight recorded separately for each requested size.';
    await route(w,base,'');
    for(const [width,height] of profiles) {
      await resize(w,width,height);
      for(const [lang,theme] of [['id','light'],['en','dark']]) {
        await chooseLang(w,lang);await chooseTheme(w,base,theme);
        for(const page of ['', 'curriculum?grade=1','packs?grade=1&level=1&op=ADD','demo/teacher','reports']) {
          await route(w,base,page);
          const snapshot=geometry(w); r.screens.push({path:page,width,height,theme,lang,...snapshot});
          checked(r,'reflow/'+width+'/'+lang+'/'+page,snapshot.scroll<=snapshot.viewport+2&&snapshot.h1.length===1,
            {viewport:snapshot.viewport,scroll:snapshot.scroll,offending:snapshot.overflowElements});
        }
      }
    }
    r.wide_css=[];r.text_200=[];
    for(const page of ['','packs?grade=1&level=1&op=ADD','session/new?grade=12&level=2&op=MIX','demo/teacher','reports']){
      await route(w,base,page);
      for(const [width,height] of [[1440,900],[2560,1080]]){
        const snapshot=await wideLayoutSnapshot(w,width,height);
        r.wide_css.push({page,width,height,...snapshot});
        checked(r,'wide-css/'+page+'/'+width,snapshot.innerWidth===width&&snapshot.scroll<=snapshot.viewport+2,{width:snapshot.innerWidth,scroll:snapshot.scroll});
      }
      await resize(w,320,568);
      const root=w.document.documentElement;
      const prior=root.style.fontSize, original=parseFloat(w.getComputedStyle(root).fontSize);
      root.style.fontSize=(original*2)+'px';await delay(70);
      const snapshot=w.innerWidth===320?geometry(w):await wideLayoutSnapshot(w,320,568);
      const rfs=parseFloat(w.getComputedStyle(root).fontSize);
      r.text_200.push({page,computed_font_px:rfs,default_font_px:original,...snapshot});
      checked(r,'text-200/'+page,rfs>=2*original-0.1&&snapshot.scroll<=snapshot.viewport+2,{width:snapshot.innerWidth,scroll:snapshot.scroll,offenders:snapshot.overflowElements});
      root.style.fontSize=prior;
      await resize(w,1150,700);
    }
    await chooseLang(w,'id');await chooseTheme(w,base,'system');
  },
  async semantics(w,r){
    r.pages=[];await resize(w,1100,750);
    for(const [lang,theme] of [['id','light'],['en','dark']]){
      await route(w,base,'');await chooseLang(w,lang);await chooseTheme(w,base,theme);
      for(const page of navPages){
        await route(w,base,page);
        const a=semantics(w); const contrast=contrastProbe(w);const leaked=w.document.querySelector('main').innerText.includes('[object HTML');
        r.pages.push({page,lang,theme,...a,contrast,leaked});
        checked(r,'actual-text-contrast/'+lang+'/'+page,contrast.measured>0&&!contrast.violations.length,{measured:contrast.measured,violations:contrast.violations});
        checked(r,'rendered-text/'+lang+'/'+page,!leaked,'DOM text serialization');
        checked(r,'semantics/'+lang+'/'+page,a.emptyNames.length===0&&a.duplicateIds.length===0&&a.missingLabelRefs.length===0&&a.headings.filter(h=>h[0]==='H1').length===1&&a.skip,
        {unnamed:a.emptyNames,duplicate:a.duplicateIds,missing:a.missingLabelRefs,headings:a.headings.filter(h=>h[0]==='H1')});
      }
    }
    await chooseLang(w,'id');await chooseTheme(w,base,'system');
  },
  async journeys(w,r){ await (await import('./journeys.mjs')).runJourneys(w,r,base,checked); },
  async faults(w,r){ await (await import('./journeys.mjs')).runFaults(w,r,base,checked); }
};
async function runtimeIdentity() {
  const id=profileURL('pin',Date.now());
  const get=async p=>{const x=await fetch(new URL(p,id),{cache:'no-store'});if(!x.ok)throw Error('Identity lookup '+p);return x;};
  const manifest=await (await get('offline-assets.json')).json();
  const bank=(await (await get('bank/index.json')).json());
  const worker=await (await get('teacher/export/work.js')).arrayBuffer();
  const hex=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',worker)),b=>b.toString(16).padStart(2,'0')).join('');
  return {offline_release:manifest.release,bootstrap_sha256:manifest.assets.find(x=>x.path==='app.mjs').sha256,
    bank_index_sha256:manifest.assets.find(x=>x.path==='bank/index.json').sha256,
    bank_version:bank.version,export_worker_sha256:hex};
}
async function runSuite(id,w){
  base=profileURL(id,Date.now());
  actions.forEach(a=>a.disabled=true);output.removeAttribute('data-complete');output.textContent='Running '+id+'…';
  const r={suite:id,user_agent:navigator.userAgent,created_utc:new Date().toISOString(),base,checks:[]};
  try {
    if(id!=='data'&&!w)throw Error('Browser did not open the test window');
    r.runtime=await runtimeIdentity();
    await suites[id](w,r);
    r.runtime_after=await runtimeIdentity();
    if(JSON.stringify(r.runtime)!==JSON.stringify(r.runtime_after))checked(r,"mixed-build",false,"Runtime changed during tests");
  } catch(e){checked(r,'runner',false,String(e.message));r.last_page=w&&!w.closed?{url:w.location.href,heading:w.document.querySelector('h1')?.innerText,controls:[...w.document.querySelectorAll('button')].filter(visible).map(name)}:null;}
  finally {
    r.finished_utc=new Date().toISOString();
    let saved;
    try{saved=(await fetch('/__qa/receipts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)})).ok;}catch{saved=false;}
    output.textContent=JSON.stringify(r,null,2);
    output.dataset.complete=id;output.dataset.saved=String(saved);
    actions.forEach(a=>a.disabled=false);
  }
  return r;
}
for(const b of actions)b.addEventListener('click',()=>runSuite(b.dataset.suite,b.dataset.suite==='data'?null:window.open('about:blank','_blank','popup,width=1024,height=768')));
for(const all of document.querySelectorAll('[data-sequence]'))all.addEventListener('click',async()=>{
  const w=window.open('about:blank','_blank','popup,width=1024,height=768');
  if(!w){output.textContent='Pop-up blocked';return;}
  all.disabled=true;const log=[];
  try{for(const id of (all.id==='all'?['performance']:[]).concat(all.id==='functional'?['data','teacher','journeys','faults','semantics','layout']:['data','offline','teacher','journeys','faults','semantics','layout'])){
    const r=await runSuite(id,id==='data'?null:w);
    log.push({suite:id,checks:(r.checks?.length||0)+(r.results?.length||0),failures:[...(r.checks||[]),...(r.results||[])].filter(a=>a.status!=='PASS').map(a=>a.id)});
  }}finally{w.close();all.disabled=false;output.textContent=JSON.stringify(log,null,2);output.dataset.complete='all';}
});
