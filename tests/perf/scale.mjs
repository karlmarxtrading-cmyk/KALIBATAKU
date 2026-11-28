const base='/school/math/';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const clock=()=>performance.now();
const heap=()=>performance.memory?.usedJSHeapSize??null;
async function until(f,label){const end=clock()+10000;while(clock()<end){if(f())return;await wait(10);}throw Error(label);}
function check(cond,label){if(!cond)throw Error(label);}
function work(url,input){
  const worker=new Worker(url,{type:'module'});
  return new Promise((resolve,reject)=>{
    const stop=setTimeout(()=>{worker.terminate();reject(Error('Worker timed out'));},20000);
    worker.onmessage=({data})=>{clearTimeout(stop);worker.terminate();data.error?reject(Error(data.error)):resolve(data);};
    worker.onerror=e=>{clearTimeout(stop);worker.terminate();reject(Error(e.message));};
    worker.postMessage(input);
  });
}
async function exportsTest(reports,cancel=false){
  const worker=new Worker(base+'teacher/export/work.js',{type:'module'}), started=clock();
  const meter={emitted:0,longest_tick_gap_ms:0,ticks:0,input_ms:[],canceled:false};
  let last=clock(),firstInputTime=null;
  const input=document.createElement('input');input.setAttribute('aria-label','Synthetic typing during PDF export');document.querySelector('#screen').append(input);
  const timer=setInterval(()=>{const t=clock();meter.longest_tick_gap_ms=Math.max(meter.longest_tick_gap_ms,t-last);last=t;meter.ticks++;},25);
  try{return await new Promise((resolve,reject)=>{
    const end=setTimeout(()=>reject(Error('Batch export timed out')),90000);
    worker.onerror=e=>{clearTimeout(end);reject(Error(e.message));};
    worker.onmessage=({data})=>{
      if(data.done){
        check(data.done===meter.emitted+1,'Batch progression');meter.emitted=data.done;
        if(data.done===1||data.done===50){
          if(firstInputTime===null)firstInputTime=clock();
          const before=clock();
          input.oninput=()=>{meter.input_ms.push(clock()-before);};
          input.value='3/4';input.dispatchEvent(new Event('input',{bubbles:true}));
        }
        if(cancel&&data.done===3){clearTimeout(end);worker.terminate();meter.canceled=true;resolve(meter);}
      }else{
        clearTimeout(end);
        if(data.error||data.errors?.length){reject(Error(data.error||'Batch export had errors'));return;}
        check(data.data[0]===80&&data.data[1]===75&&meter.emitted===reports.length,'All 100 PDFs in ZIP');
        const tail=new DataView(data.data.buffer,data.data.byteOffset+data.data.byteLength-22,22);
        check(tail.getUint32(0,true)===0x06054b50,'ZIP end record');meter.zip_entries=tail.getUint16(10,true);
        check(meter.zip_entries===reports.length+1,'100 PDFs plus manifest');
        meter.elapsed_ms=clock()-started;meter.zip_bytes=data.data.byteLength;meter.heap_after=heap();resolve(meter);
      }
    };worker.postMessage({reports,format:'zip'});
  });}finally{clearInterval(timer);worker.terminate();input.remove();}
}
export async function scale(status) {
  const [store,db,common,report,demo,record]=await Promise.all(['data/store.js','data/db.js','data/common.js','teacher/report.js','teacher/demo.js','player/records.mjs'].map(p=>import(base+p)));
  const primary=await store.createProfile('QA-Lab 1200'),other=await store.createProfile('QA-Lab 41');
  const scope=store.scopeForLocal(primary.id),control=store.scopeForLocal(other.id);
  const source=demo.syntheticSessions(),sample=source.find(a=>a.items.length>0&&a.status==='completed');
  const start=Date.UTC(2026,0,1),total=1200;
  const result={reported_store:await store.getStatus(),dataset:{primary:total,other:41,items_per_session:sample.items.length},runs:[]};
  const make=(sc,i)=>{
    const at=new Date(start+i*60000).toISOString();
    return {...sample,attempt_id:'lab-session-'+String(i).padStart(5,'0'),profile_id:sc.profileId,data_origin:'local_practice',started_at:at,completed_at:at,
      mode:i%2?'practice':'assessment',status:i%6?'completed':'ongoing',metrics:{N:sample.items.length,C:sample.items.filter(x=>x.final_status==='correct').length}};
  };
  let observer;
  if(PerformanceObserver.supportedEntryTypes.includes('longtask')){
    result.long_tasks=[];observer=new PerformanceObserver(list=>{for(const e of list.getEntries())result.long_tasks.push({at:e.startTime,duration:e.duration});});observer.observe({type:'longtask'});
  }
  try{
    const mark=clock();
    await db.transaction(['attempts'],true,async tx=>{
      for(const [sc,count] of [[scope,total],[control,41]]){
        const ns=common.scopeKey(sc);
        await Promise.all(Array.from({length:count},(_,i)=>{const a=make(sc,i);return tx.put('attempts',db.row(ns,a.attempt_id,a));}));
      }
    });
    result.seed_ms=clock()-mark;
    const initial=clock(),first=await store.queryAttemptSummaries(scope,{limit:10});
    check(first.total===total&&first.rows.length===10&&first.rows[0].attempt_id==='lab-session-01199','Scoped first page');
    result.first_index_build_and_query_ms=clock()-initial;
    check((await store.queryAttemptSummaries(control,{limit:1})).total===41,'Control isolated');
    const people=Array.from({length:100},(_,i)=>({id:'sample-'+i,alias:'Sample '+(i+1),classId:'lab'}));
    const attempts=Array.from({length:total},(_,i)=>({...make(scope,i),data_origin:'demo',profile_id:people[i%people.length].id}));
    const filters=report.initialFilters(),size=attempts.length/people.length;
    const reports=people.map(person=>report.buildSnapshot({person,people,attempts:attempts.filter(a=>a.profile_id===person.id),filters,locale:'bilingual'}));
    result.dataset.batch_reports=reports.length;result.dataset.sessions_per_report=size;
    const ctx={root:document.querySelector('#screen'),lang:'en',L:(_id,en)=>en,go:()=>{},profileName:'QA-Lab',signal:new AbortController().signal};
    const cells=(await (await fetch(base+'bank/g01/l01.json')).json()).competencies;
    for(let i=0;i<5;i++){
      status('Scale sample '+(i+1)+'/5: indexed history, worker progress, preview and batch');
      const r={sample:i+1,heap_before:heap()};
      let t=clock();const page=await store.queryAttemptSummaries(scope,{offset:(i+1)*100,limit:10});
      check(page.total===total&&page.rows.length===10&&!page.rows[0].items,'Scoped page of summaries');
      r.page_ms=clock()-t;t=clock();
      const filtered=await store.queryAttemptSummaries(scope,{status:'completed',mode:'practice',offset:7,limit:10});
      check(filtered.total===600&&filtered.rows.every(x=>x.mode==='practice'&&x.status==='completed'),'Filter accuracy');
      r.filtered_ms=clock()-t;
      await record.history(ctx,scope,false);
      const screen=ctx.root;
      const prevRender=screen.querySelector('[data-range]');
      const sel=screen.querySelector('select');sel.value='completed';sel.dispatchEvent(new Event('change'));
      await until(()=>screen.querySelector('[data-range]')!==prevRender&&screen.querySelector('[data-range]')?.textContent.includes('1000'),'History filter');
      const next=[...screen.querySelectorAll('nav button')].find(b=>b.textContent==='Next');
      const before=screen.querySelector('[data-range]').textContent;t=clock();next.click();
      await until(()=>screen.querySelector('[data-range]')?.textContent!==before,'Next history page');
      screen.scrollIntoView();r.filtered_next_ms=clock()-t;r.history_dom=screen.querySelectorAll('*').length;r.history_articles=screen.querySelectorAll('article').length;
      check(r.history_articles===10&&r.history_dom<150,'Paged history did not grow');
      t=clock();const progress=await work(base+'player/progress-worker.mjs',{scope,cells});
      check(progress.model.total>0,'Worker calculated progress');r.progress_worker_ms=clock()-t;
      t=clock();const preview=await work(base+'teacher/report-work.js',{person:people[i],people,attempts,filters,locale:'bilingual'});
      check(preview.snapshot?.person.id===people[i].id,'Worker preview targeted person');
      r.preview_worker_ms=clock()-t;r.batch=await exportsTest(reports);r.cancel=await exportsTest(reports,true);
      check(r.batch.input_ms.length===2&&r.cancel.canceled,'Responsive batch and cancellation');
      r.heap_after=heap();r.ended_at=clock();result.runs.push(r);
    }
    return result;
  }finally{
    observer?.disconnect();document.querySelector('#screen').replaceChildren();
    await store.deleteProfile(primary.id);await store.deleteProfile(other.id);
  }
}
