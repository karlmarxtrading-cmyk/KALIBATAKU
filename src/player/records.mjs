import {mountEnter} from '../core/enter-cycle.mjs';
import {compareInstants} from '../data/time.js';
import {activeScope,listRecords,addRecord,listAttempts,getStatus,queryAttemptSummaries,scopeKey} from '../data/store.js';
import {node,add,button,gradeLabel,mode,operation,fmtPct,date,statusText,outcomes,recommendations,opNames,workedMethod} from './base.mjs';
import {summarizeAttempt,progressModel,recoveryQueue,timingStats,changeInPoints,comparable} from './analytics.mjs';
import {clearMath,formula,mathProse} from '../math/view.mjs';
import {asRational,enteredAst,decimalPreference} from '../math/model.mjs';
const again=(a,m='practice',retest=false)=>'session/new?grade='+a.grade+'&level='+a.level+'&op='+encodeURIComponent(a.operation)+'&mode='+m+(retest?'&retest=1':'');
function metric(label,value,detail){return add(node('div','kp-metric'),node('span','kp-sub',label),node('strong','',value),detail?node('small','kp-sub',detail):null);}
function head(page,title,sub){add(page,add(node('header','kp-head'),node('h1','',title),sub?node('p','kp-sub',sub):null));}
function empty(page,L,go){add(page,add(node('div','kp-card'),node('p','',L('Belum ada sesi pada pilihan ini.','There are no sessions for this selection.')),button(L('Mulai latihan','Start practising'),()=>go('session/new'),'main')));}
function meta(a,L,lang){return gradeLabel(a,L)+' · '+operation(a,L)+' · '+mode(a,L)+' · '+date(a.started_at,lang);}
function select(label,values,chosen,update) {
  const wrap=node('label'),s=node('select');wrap.append(node('span','kp-sub',label),document.createElement('br'),s);
  for(const [value,text] of values){const o=node('option','',text);o.value=value;if(String(chosen)===String(value))o.selected=true;s.append(o);}
  s.addEventListener('change',()=>update(s.value));return wrap;
}
function pages(list,rows,render,start,L,update) {
  const size=10,end=Math.min(rows.length,start+size);
  for(const row of rows.slice(start,end))render(row);
  if(rows.length>size) {
    const nav=node('div','kp-actions'),prev=button(L('Sebelumnya','Previous'),()=>update(start-size)),next=button(L('Berikutnya','Next'),()=>update(start+size));
    prev.disabled=!start;next.disabled=end===rows.length;
    add(list,add(nav,prev,node('span','kp-sub',(start+1)+'–'+end+' / '+rows.length),next));
  }
}
const memory=new Map();
function stateFor(key,defaults){
  if(!memory.has(key))memory.set(key,defaults);
  if(memory.size>100)memory.delete(memory.keys().next().value);
  return memory.get(key);
}
function focusHere(root,selector){const target=root.querySelector(selector);if(target){target.tabIndex=-1;target.focus({preventScroll:true});}}
export async function history(ctx,scope,resume) {
  const {root,L,go,lang}=ctx;
  const state=stateFor(scopeKey(scope)+'/'+(resume?'resume':'history'),{filter:resume?'ongoing':'all',offset:0,y:0,last:null,days:'all',op:'all'});
  let serial=0;
  async function draw(focus) {
    const seq=++serial;
    const since=state.days==='all'?undefined:new Date(Date.now()-Number(state.days)*86400000).toISOString();
    const data=await queryAttemptSummaries(scope,{offset:state.offset,limit:10,status:state.filter,operation:state.op,since});
    if(ctx.signal?.aborted||seq!==serial)return;
    if(!data.rows.length&&state.offset&&data.total){state.offset=Math.floor((data.total-1)/10)*10;return draw(focus);}
    const page=node('section','kp');
    head(page,resume?L('Lanjutkan sesi','Resume a session'):L('Riwayat latihan','Practice history'),[ctx.profileName,L('Terbaru lebih dahulu','Newest first')].filter(Boolean).join(' · '));
    const filters=select(L('Status','Status'),[['all',L('Semua sesi','All sessions')],['ongoing',L('Berjalan','In progress')],['completed',L('Selesai','Completed')],['abandoned',L('Dihentikan','Abandoned')]],state.filter,v=>{state.filter=v;state.offset=state.y=0;state.last=null;draw('select');});
    const group=node('div','kp-actions');
    const update=(key,value,selector)=>{state[key]=value;state.offset=state.y=0;state.last=null;draw(selector);};
    const material=select(L('Materi','Topic'),[['all',L('Semua operasi','All operations')],...Object.entries(opNames).map(([key,name])=>[key,L(...name)])],state.op,v=>update('op',v,'[name=history_topic]'));
    material.querySelector('select').name='history_topic';
    const period=select(L('Periode','Period'),[['all',L('Semua tanggal','All dates')],['7',L('7 hari terakhir','Last 7 days')],['30',L('30 hari terakhir','Last 30 days')]],state.days,v=>update('days',v,'[name=history_period]'));
    period.querySelector('select').name='history_period';
    add(page,add(group,filters,material,period));
    add(page,node('p','kp-sub',scope.origin==='demo'?L('Sumber · Data simulasi','Source · Demonstration data'):L('Sumber · Riwayat pribadi perangkat ini','Source · Personal history on this device')));
    if(!data.total)empty(page,L,go);
    else {
      const list=node('div','kp-list');
      const first=state.offset+1,last=state.offset+data.rows.length,headline=node('h2','',L('Sesi ','Sessions ')+first+'–'+last+' / '+data.total);headline.dataset.range='';add(list,headline);
      for(const a of data.rows) {
        const finished=a.status==='completed',entry=node('article','kp-entry'),label=finished?L('Lihat hasil','View results'):L('Lanjutkan','Resume');
        add(entry,node('h3','',operation(a,L)+' · '+mode(a,L)),node('p','kp-sub',gradeLabel(a,L)+' · '+date(a.started_at,lang)),node('p','',finished?L('Jawaban benar ','Correct answers ')+a.metrics.C+' / '+a.metrics.N:a.status==='ongoing'?L('Sedang berjalan','In progress'):L('Dihentikan','Abandoned')));
        if(a.status!=='abandoned'){
          const action=button(label,()=>{state.last=a.attempt_id;state.y=window.scrollY;go((finished?'results/':'session/')+a.attempt_id);});
          action.dataset.attempt=a.attempt_id;action.setAttribute('aria-label',label+' · '+meta(a,L,lang));add(entry,action);
        }
        add(list,entry);
      }
      if(data.total>10){
        const nav=node('nav','kp-actions');nav.setAttribute('aria-label',L('Halaman riwayat','History pages'));
        for(const [step,title,disabled] of [[-10,L('Sebelumnya','Previous'),first===1],[10,L('Berikutnya','Next'),last>=data.total]]){
          const b=button(title,()=>{state.offset+=step;state.y=0;state.last=null;draw('[data-range]');});b.disabled=disabled;add(nav,b);
        }
        add(list,nav);
      }add(page,list);
    }
    add(page,button(L('Lihat progres','View progress'),()=>go('progress')));
    clearMath(root);root.replaceChildren(page);
    if(focus){if(focus==='select'||focus.startsWith('[name='))root.querySelector(focus)?.focus();else focusHere(root,focus);}
    else if(state.last){requestAnimationFrame(()=>{if(ctx.signal?.aborted)return;root.querySelector('[data-attempt="'+CSS.escape(state.last)+'"]')?.focus({preventScroll:true});window.scrollTo(0,state.y);});}
  }
  return draw();
}
export async function result(ctx,a,attempts) {
  const {root,L,go,lang}=ctx,m=a.metrics||summarizeAttempt(a);
  const page=node('section','kp');
  if(a.journey&&a.data_origin!=='demo'){
    head(page,L('Misi selesai','Mission complete'),ctx.profileName);
    try{
      const {missionResult}=await import('../journey/ui.mjs');
      const box=await missionResult(ctx,a,{node,add,button});
      if(ctx.signal?.aborted)return;
      add(page,box);clearMath(root);root.replaceChildren(page);
      const heading=root.querySelector('h1'),next=root.querySelector('[data-part=next-mission]');
      heading.tabIndex=-1;heading.focus({preventScroll:true});
      mountEnter(ctx.signal,target=>target===heading||target===next,()=>{if(next&&!next.disabled)next.click();});
      return;
    }catch(err){if(ctx.signal?.aborted)return;console.warn('mission result',err);}
  }
  head(page,L('Hasil sesi','Session results'),[ctx.profileName,meta(a,L,lang)].filter(Boolean).join(' · '));
  const card=node('div','kp-card kp-question');
  const summary=node('div','kp-metrics');
  add(summary,metric(L('Skor paket','Form score'),fmtPct(m.score_percent,lang),m.C+' / '+m.N),metric(L('Akurasi jawaban','Response accuracy'),m.accuracy_percent===null?L('Belum ada jawaban yang dinilai','No scored answers yet'):fmtPct(m.accuracy_percent,lang),m.C+' / '+(m.C+m.W)),metric(L('Soal ditanggapi','Questions responded to'),fmtPct(m.responded_percent,lang),(m.C+m.W+m.S)+' / '+m.N));
  add(card,node('h2','kp-lead',L(m.C+' dari '+m.N+' soal benar',m.C+' of '+m.N+' correct')),node('p','',m.C===m.N?L('Semua soal terjawab dengan benar. Siap mencoba paket lain?','You answered every question correctly. Ready for another set?'):L('Tinjau jawaban yang masih perlu dilatih.','Revisit the questions you would like to practise.')));
  const assisted=a.items.filter(i=>i.history?.some(h=>h.key_seen_before)).length;
  add(card,node('p','',L('Benar pada jawaban pertama · ','Correct on the first response · ')+(m.first_correct??0)+' / '+(m.first_response_count??0)),
    node('p','kp-sub',L('Soal direvisi setelah melihat kunci · ','Questions revised after seeing the key · ')+assisted));
  if(a.finish_reason==='time_expired')add(card,node('p','kp-sub',L('Waktu habis. Isian yang sah saat batas waktu sudah dihitung.','Time ran out. Valid entries at the deadline have been counted.')));
  add(card,node('p','kp-sub',[[m.C,L('benar','correct')],[m.W,L('salah','incorrect')],[m.S,L('dilewati','skipped')],[m.B,L('kosong','blank')],[m.U,L('belum dilihat','unseen')]].map(([n,s])=>n+' '+s).join(' · ')));
  const details=node('details'),s=node('summary','',L('Detail untuk orang tua dan guru','Details for families and teachers'));
  const t=timingStats(a.items||[]);add(details,s,summary,node('p','',L('Respons pertama benar: ','Correct first responses: ')+(m.first_correct??0)+' / '+(m.first_response_count??0)+'. '+L('Percobaan ulang: ','Retries: ')+(m.retries||0)+'. '+L('Soal dengan petunjuk: ','Questions with hints: ')+(m.hints||0)+'.'));
  add(details,node('p','kp-sub',L('Durasi respons benar pertama tanpa bantuan · ','First correct unassisted response time · ')+t.n+L(' observasi · ',t.n===1?' observation · ':' observations · ')+(t.median_ms==null?L('minimal 10 untuk median dan P90.','10 needed for median and P90.'):L('median ','median ')+(t.median_ms/1000).toLocaleString(lang)+' s · P90 '+(t.p90_ms/1000).toLocaleString(lang)+' s')+' · '+t.excluded+L(' dikecualikan',' excluded')));
  const series=attempts.filter(x=>x.status==='completed'&&x.attempt_id!==a.attempt_id&&compareInstants(x.completed_at,a.completed_at)<0&&comparable(x,a,a.target_competency_id)).sort((x,y)=>compareInstants(y.completed_at,x.completed_at)||x.attempt_id.localeCompare(y.attempt_id));
  const previous=series[0];
  if(previous){const change=changeInPoints(summarizeAttempt(previous,a.target_competency_id).score_percent,summarizeAttempt(a,a.target_competency_id).score_percent,true);if(change!==null)add(details,node('p','',L('Perubahan pada evaluasi sebanding: ','Change across comparable assessments: ')+(change>0?'+':'')+change.toLocaleString(lang,{maximumFractionDigits:1})+L(' poin persentase',' percentage points')));}
  add(details,button(L('Buka laporan','Open report'),()=>go('reports?source='+encodeURIComponent(a.data_origin)+'&student='+encodeURIComponent(a.profile_id))));
  add(card,node('p','kp-sub',a.data_origin==='demo'?'SIMULASI / DEMONSTRATION DATA':L('Hasil latihan lokal · belum diverifikasi institusi','Local practice results · not institutionally verified')));
  const actions=node('div','kp-actions');
  if(m.C<m.N)add(actions,button(L('Tinjau soal yang perlu dilatih','Review questions to practise'),()=>go('review/'+a.attempt_id+'?filter=missed'),'main'));
  else add(actions,button(L('Latihan lagi','Practise again'),()=>go(again(a)),'main'));
  add(actions,button(L('Tinjau jawaban','Review answers'),()=>go('review/'+a.attempt_id)),button(L('Lihat progres','View progress'),()=>go('progress?grade='+a.grade+'&level='+a.level)),button(L('Riwayat latihan','Practice history'),()=>go('history')));
  if(recoveryQueue(attempts,a.target_competency_id).length)add(actions,button(L('Latih ulang kesalahan','Practise missed questions'),()=>go(again(a,'recovery'))));
  add(card,actions,details);add(page,card);clearMath(root);root.replaceChildren(page);
}
export function review(ctx,a) {
  const {root,L,go,lang}=ctx;const state=stateFor(scopeKey(activeScope())+'/review/'+a.attempt_id+'/'+(ctx.params?.get('filter')||''),{filter:ctx.params?.get('filter')==='missed'||a.items.some(i=>['incorrect','skipped'].includes(i.final_status))?'missed':'all',offset:0});let {filter,offset}=state;
  function draw(){
    const page=node('section','kp');head(page,L('Tinjauan jawaban','Answer review'),meta(a,L,lang));
    add(page,select(L('Tampilkan','Show'),[['all',L('Semua jawaban','All answers')],['missed',L('Perlu dilatih','To practise')],...Object.entries(outcomes).map(([k,v])=>[k,L(...v)])],filter,v=>{state.filter=filter=v;state.offset=offset=0;draw();root.querySelector('select')?.focus();}));
    const list=node('div','kp-list');
    const rows=a.items.map((i,index)=>({i,index})).filter(({i})=>filter==='all'||(filter==='missed'&&i.final_status!=='correct')||i.final_status===filter);
    if(!rows.length)add(list,node('p','',L('Tidak ada jawaban dengan status ini.','There are no answers with this status.')));
    pages(list,rows,({i,index})=>{
      const q=i.question,entry=node('article','kp-entry');
      add(entry,node('p','kp-sub','#'+(index+1)+' · '+L(...(outcomes[i.final_status]||outcomes.blank))),add(node('h2'),formula(q.expression_ast,lang)));
      const counted=['correct','incorrect'].includes(i.final_status)?i.history?.at(-1):null;
      add(entry,add(node('p'),node('strong','',L('Jawabanmu · ','Your answer · ')),counted?formula(enteredAst(counted),lang):node('span','','—'),
        node('strong','',L(' · Kunci jawaban · ',' · Correct answer · ')),formula(asRational(q.answer),lang,decimalPreference(q))));
      if(q.hint?.[lang])add(entry,add(node('p','kp-sub'),node('strong','',L('Ide berhitung · ','Think it through · ')),mathProse(q.hint[lang],lang)));
      const steps=node('details');add(steps,node('summary','',L('Pembahasan dan respons','Solution and responses')),workedMethod(q,lang));
      if(i.history?.length){
        const answers=node('ol','kp-responses');
        for(const [n,h] of i.history.entries())add(answers,node('li','',[(n===0?L('Respons pertama','First response'):L('Percobaan ','Response ')+(n+1)),h.raw_answer,h.key_seen_before?L('Setelah melihat kunci','After seeing the key'):h.hint_used?L('Dengan petunjuk','With a hint'):L('Tanpa petunjuk','Without a hint')].join(' · ')));
        add(steps,answers);
      }
      if(i.unsubmitted_draft)add(steps,node('p','kp-sub',L('Draf belum lengkap saat waktu habis: ','Incomplete entry at the deadline: ')+i.unsubmitted_draft.text));
      if(i.source_instance_id)add(steps,button(L('Buka hasil sesi asal','Open original session results'),()=>go('review/'+i.source_attempt_id)));
      const code=/^arithmetic\.(addition|subtraction|multiplication|division|mixed)\.g(\d+)\.l(\d+)$/.exec(q.competency_id);
      const operations={addition:'ADD',subtraction:'SUB',multiplication:'MUL',division:'DIV',mixed:'MIX'};
      const params=new URLSearchParams({grade:String(code?Number(code[2]):a.grade),level:String(code?Number(code[3]):a.level),
        op:code?operations[code[1]]:a.operation,mode:'practice',fromAttempt:a.attempt_id,fromItem:i.question_instance_id});
      add(entry,steps,button(L('Coba soal sejenis','Try a similar question'),()=>go('session/new?'+params)));add(list,entry);
    },offset,L,n=>{state.offset=offset=n;draw();focusHere(root,'.kp-entry h2');});add(page,list,button(L('Kembali ke hasil','Back to results'),()=>go('results/'+a.attempt_id)));clearMath(root);root.replaceChildren(page);
  }
  draw();
}
async function computeProgress(scope,cells,signal) {
  if(typeof Worker!=='undefined'&&!(await getStatus()).temporary&&!signal?.aborted) {
    try {
      return await new Promise((resolve,reject)=>{
        const worker=new Worker(new URL('./progress-worker.mjs',import.meta.url),{type:'module'});
        const stop=()=>{worker.terminate();signal?.removeEventListener('abort',cancel);};
        const cancel=()=>{stop();reject(new DOMException('Navigation','AbortError'));};
        signal?.addEventListener('abort',cancel,{once:true});
        worker.onmessage=({data})=>{stop();if(data.error)reject(new Error(data.error));else resolve(data.model);};
        worker.onerror=()=>{stop();reject(new Error('WORKER_LOAD'));};
        worker.postMessage({scope,cells:cells.map(({competency_id,operation,pool_size,active,prerequisites})=>({competency_id,operation,pool_size,active,prerequisites}))});
      });
    } catch(error) {if(signal?.aborted)throw error;}
  }
  signal?.throwIfAborted();
  return progressModel(await listAttempts(scope),cells);
}
export async function progress(ctx) {
  const {root,L,lang,go}=ctx,page=node('section','kp');
  const grade=Math.max(1,Math.min(12,Number(ctx.params?.get('grade'))||ctx.material?.grade||1)),level=Math.max(1,Math.min(5,Number(ctx.params?.get('level'))||ctx.material?.level||1));
  const url='bank/g'+String(grade).padStart(2,'0')+'/l'+String(level).padStart(2,'0')+'.json';
  const r=await fetch(new URL(url,document.baseURI));if(!r.ok)throw new Error('BANK_LOAD');
  const cells=(await r.json()).competencies.filter(x=>x.active);
  const scope=activeScope();
  const [summary,recent]=await Promise.all([computeProgress(scope,cells,ctx.signal),queryAttemptSummaries(scope,{grade,level,limit:1})]);
  if(ctx.signal?.aborted)return;
  head(page,L('Progres belajarmu','Your learning progress'),L('Pilih keterampilan yang ingin kamu latih.','Choose a skill you would like to practise.'));
  add(page,button(L('Riwayat latihan','Practice history'),()=>go('history')));
  const filters=node('div','kp-actions');for(const [text,limit,val,change] of [[L('Kelas materi','Material grade'),12,grade,g=>go('progress?grade='+g+'&level='+level)],[L('Level','Level'),5,level,l=>go('progress?grade='+grade+'&level='+l)]])add(filters,select(text,Array.from({length:limit},(_,i)=>[i+1,String(i+1)]),val,change));add(page,filters);
  const last=recent.rows[0];
  const recommended=summary.rows.find(c=>c.evidence.review_due)||summary.rows.find(c=>c.operation===(last?.operation||ctx.material?.op))||summary.rows[0];
  if(recommended){
    const here={grade,level,operation:recommended.operation};
    const offer=recommended.evidence.review_due||recommended.decision.decision==='assess'?'assessment':'adaptive';
    const next=node('section','kp-card kp-next');
    add(next,node('h2','',L('Langkah berikutnya','Your next step')+' · '+L(...opNames[recommended.operation])));
    const reason=recommended.evidence.review_due?L('Sudah waktunya meninjau keterampilan ini lagi.','It is time to revisit this skill.'):
      last&&last.operation===recommended.operation?L('Ini materi terakhirmu pada level ini.','This was your latest topic at this level.'):
      L('Mulai dari materi ini untuk mengisi riwayat belajarmu.','Try this topic to start your learning history.');
    add(next,node('p','',reason));
    if(last?.status==='completed'&&last.operation===recommended.operation&&last.metrics)add(next,node('p','kp-sub',L('Sesi terakhir · '+last.metrics.C+' dari '+last.metrics.N+' soal benar.','Last session · '+last.metrics.C+' of '+last.metrics.N+' correct.')));
    add(next,button(offer==='assessment'?L('Mulai evaluasi berikutnya','Start next assessment'):L('Lanjutkan belajar','Continue learning'),()=>go(again(here,offer)),'main'));
    add(page,next);
  }
  const card=node('div','kp-card');
  add(card,node('h2','',L('Kelas '+grade+' · Level '+level,'Grade '+grade+' · Level '+level)));
  const adult=node('details','kp-card');add(adult,node('summary','',L('Detail untuk orang tua dan guru','Details for families and teachers')),node('p','kp-sub',summary.mastered+' / '+summary.total+L(' kompetensi dikuasai sementara.',' skills provisionally mastered.')));
  for(const c of summary.rows) {
    const m=c.evidence,d=c.decision;
    const row=node('article','kp-entry'),fake={grade,level,operation:c.operation};
    const explanations={
      collect:L('Coba latih keterampilan ini. Dua evaluasi terpisah akan membantu memilih langkah berikutnya.','Try this skill. Two separate assessments will help choose a next step.'),
      vary:L('Coba beberapa soal lain dengan keterampilan yang sama.','Try different questions using this skill.'),
      assess:L('Kedua evaluasi terakhirmu berjalan baik. Coba evaluasi berikutnya.','You did well on both recent assessments. Try the next assessment.'),
      prerequisite:L('Latih keterampilan dasar yang dipakai di soal-soal ini.','Practise the earlier skill these questions build on.')
    };
    add(row,node('h3','',L(...opNames[c.operation])),node('p','',explanations[d.decision]));
    const section=node('section','kp-entry');
    add(section,node('h3','',L(...opNames[c.operation])+' · '+L(...statusText[m.status])),node('p','kp-sub',m.forms+L(' evaluasi · ',m.forms===1?' assessment · ':' assessments · ')+m.correct+' / '+m.unique+L(' ekspresi unik benar · target ',' unique expressions correct · target ')+m.needed+'.'));
    if(m.forms)add(section,node('p','kp-sub',L('Skor per evaluasi: ','Scores per assessment: ')+m.scores.map(n=>fmtPct(n,lang)).join(' / ')+L('. Jarak: ','. Spacing: ')+m.spacing_hours.toLocaleString(lang,{maximumFractionDigits:1})+L(' jam. Soal berulang: ',' hours. Repeated items: ')+m.overlap+'.'));
    if(m.review_due)add(row,node('p','kp-sub',L('Waktunya meninjau kembali pada interval ','Time to review at the ')+m.review_interval_days+L(' hari.','-day interval.')));
    const actions=node('div','kp-actions');
    add(actions,button(L('Latihan terarah','Targeted practice'),()=>go(again(fake,'adaptive'))),button(L('Mulai evaluasi','Start assessment'),()=>go(again(fake,'assessment'))));
    if(c.trained)add(section,button(L('Mulai siklus evaluasi ulang','Start a new retest cycle'),()=>go(again(fake,'assessment',true))));
    add(adult,section);
    add(row,actions);add(card,row);
  }
  const settings=node('details','kp-card'),input=node('input','kp-answer');
  const prefs=await listRecords('mastery-spacing',activeScope(),{includeRecordId:true});
  if(ctx.signal?.aborted)return;
  input.type='number';input.min='0';input.max='168';input.step='1';input.id='kp-spacing';input.value=String(prefs.sort((a,b)=>compareInstants(b.at,a.at)||b.record_id.localeCompare(a.record_id))[0]?.hours??24);
  const label=node('label','',L('Jarak minimum dua form (jam)','Minimum time between forms (hours)'));label.htmlFor=input.id;
  const feedback=node('p','kp-sub');feedback.setAttribute('role','status');
  const save=button(L('Simpan kebijakan','Save policy'),async()=>{
    if(!input.value||!input.reportValidity())return;
    save.disabled=true;
    try{await addRecord('mastery-spacing',crypto.randomUUID(),{at:new Date().toISOString(),hours:input.valueAsNumber},activeScope());feedback.textContent=L('Berlaku mulai siklus baru.','Takes effect at the start of a new cycle.');}
    catch{feedback.textContent=L('Belum tersimpan. Coba lagi.','Could not save. Try again.');}finally{save.disabled=false;}
  });
  add(settings,node('summary','',L('Aturan evaluasi lokal','Local assessment policy')),label,input,node('p','kp-sub',L('Default 24 jam. Perubahan berlaku pada siklus baru di profil ini.','Default 24 hours. Changes apply to new cycles in this profile.')),save,feedback);
  add(adult,settings);add(page,card,adult);clearMath(root);root.replaceChildren(page);
}
