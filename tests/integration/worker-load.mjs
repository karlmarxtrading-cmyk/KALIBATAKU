/** Exercise the shipped PDF batch worker while the main document handles input. */
export async function workerLoad(w,base) {
  const {buildSnapshot,initialFilters}=await import(new URL('teacher/report.js',base));
  const {roster,syntheticSessions}=await import(new URL('teacher/demo.js',base));
  const template=buildSnapshot({person:roster[0],people:roster,attempts:syntheticSessions(),filters:initialFilters(),locale:'bilingual'});
  const reports=Array.from({length:24},(_,i)=>({...template,person:{...template.person,id:'qa-load-'+i,alias:'Sample '+i},core:{...template.core,report_id:'qa-load-'+i}}));
  const work=new w.Worker(new URL('teacher/export/work.js',base),{type:'module'});
  const heap=()=>w.performance.memory?.usedJSHeapSize??null;
  const fields=w.document.querySelector('.tw-paper');
  const metrics={reports:reports.length,heap_before:heap(),peak_observed_heap:heap(),progress:[],ticks:0};
  const started=performance.now();
  const interval=setInterval(()=>{metrics.ticks++;if(heap())metrics.peak_observed_heap=Math.max(metrics.peak_observed_heap||0,heap());},25);
  const input=w.document.createElement('input');input.setAttribute('aria-label','Synthetic input responsiveness check');
  w.document.body.append(input);let responded=false;
  input.addEventListener('input',()=>{responded=true;});
  try {
    const content=await new Promise((resolve,reject)=>{
      let action=false;
      const timeout=setTimeout(()=>reject(Error('Batch load timed out')),60000);
      work.onerror=e=>{clearTimeout(timeout);reject(Error(e.message));};
      work.onmessage=({data})=>{
        if(data.done){metrics.progress.push(data.done);if(!action){
          const t=performance.now();input.value='1/2';input.dispatchEvent(new w.Event('input',{bubbles:true}));
          metrics.input_dispatch_ms=performance.now()-t;action=true;
        }return;}
        clearTimeout(timeout);
        if(data.error||data.errors?.length)reject(Error('Batch worker failed'));
        else resolve(data.data);
      };
      work.postMessage({format:'zip',reports});
    });
    metrics.elapsed_ms=Math.round(performance.now()-started);
    metrics.emitted_bytes=content.byteLength;metrics.archive_signature=Array.from(content.slice(0,4));
    metrics.responded_during_batch=responded;metrics.heap_after=heap();
    return metrics;
  }finally{clearInterval(interval);work.terminate();input.remove();}
}
