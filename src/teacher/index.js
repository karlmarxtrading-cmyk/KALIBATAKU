import {compareInstants} from '../data/time.js';
import {workedMethod} from '../player/base.mjs';
import {formula,mathProse,clearMath} from '../math/view.mjs';
import {asRational,enteredAst,decimalPreference} from '../math/model.mjs';
import {h,link,icon,labelled,select,button,box,chips,table,message} from './ui.js';
import {tr,name,dateAt,originLabel,buildSnapshot,initialFilters,filterSessions,sumCounts,periodBounds,zones,nextStep,operations} from './report.js';
import {workspace,recordNote,classes} from './demo.js';
import {getStatus} from '../data/db.js';
import {draftFor,remember,forget} from './drafts.js';
const views={'demo/teacher':['Monitoring kelas','Class monitoring'],'demo/student':['Detail siswa','Student detail'],'demo/assignments':['Penugasan','Assignments'],'demo/admin':['Administrasi','Administration'],reports:['Laporan','Reports']};
const nav=[['demo/teacher','school'],['demo/assignments','pencil'],['demo/admin','layers'],['reports','report']];

const style=new URL('./teacher.css',import.meta.url).href;
function setupStyle(){if(!document.querySelector('link[href="'+style+'"]'))document.head.append(h('link',{rel:'stylesheet',href:style}));}
const freshBank=async(path='bank/index.json')=>{const r=await fetch(new URL(path,document.baseURI));if(!r.ok)throw new Error('BANK '+r.status);return r.json();};
export async function renderTeacher(root,ctx) {
  setupStyle();
  const route=(ctx.route||'demo/teacher').replace(/^#?\//,'').split('?')[0],key=route.startsWith('demo/student/')?'demo/student':route;
  const l=ctx.locale==='en'?'en':'id',t=(a,b)=>tr(l,a,b),isReport=key==='reports';
  const page=h('div',{class:'tw'});clearMath(root);root.replaceChildren(page);
  const contextKey='context:'+(isReport?'reports:'+ctx.profileId:'demo');
  let filter={...initialFilters(),...draftFor(contextKey).filters};
  const explicit=ctx.params?.get('source'),subject=ctx.params?.get('student');
  if(isReport){
    if(!['demo','local_practice'].includes(explicit)&&!draftFor(contextKey).filters){
      page.append(h('h1',{},t('Laporan','Reports')),box(t('Pilih sumber laporan','Choose a report source'),
        link('reports?source=local_practice',t('Latihan profil aktif pada perangkat ini','Practice from the active local profile'),'btn'),
        link('reports?source=demo',t('Simulasi kelas · data contoh','Class demonstration · example data'),'btn')));return;
    }
    if(['demo','local_practice'].includes(explicit)&&filter.source!==explicit)filter={...initialFilters(),source:explicit};
    if(subject&&filter.source==='demo')filter={...filter,studentId:subject};
  }else filter.source='demo';
  function setFilter(next){
    filter=next;remember(contextKey,{filters:next});
    if(isReport){const q=new URLSearchParams({source:next.source});if(next.studentId)q.set('student',next.studentId);
      history.replaceState(history.state,'','#/reports?'+q);}
  }
  const status=h('p',{class:'tw-status','aria-live':'polite'});let generation=0,viewAbort;
  ctx.signal?.addEventListener('abort',()=>viewAbort?.abort(),{once:true});
  const refresh=async()=>{
    viewAbort?.abort();viewAbort=new AbortController();
    const viewCtx={...ctx,signal:viewAbort.signal};
    const token=++generation;let data;
    try{data=await workspace(filter.source,ctx.profileId,{view:key,student:route.split('/').at(-1)});}catch(e){if(ctx.signal?.aborted)return;status.textContent=message(t,e);page.replaceChildren(status,button(t('Coba lagi','Retry'),refresh));return;}
    if(ctx.signal?.aborted||token!==generation)return;
    const person=key==='demo/student'?data.people.find(p=>p.id===route.split('/').at(-1)):null;
    if(person&&filter.studentId&&filter.studentId!==person.id)filter={...filter,studentId:person.id};
    if(person&&filter.classId&&person.classId!==filter.classId)filter={...filter,classId:person.classId};
    page.replaceChildren();
    const title=person?person.alias:t(...(views[key]||views['demo/teacher']));
    page.append(h('header',{class:'tw-head'},h('div',{},h('h1',{},title),h('p',{},t(...({
      'demo/teacher':['Tinjau sesi dan bukti belajar setiap siswa.','Review sessions and learning evidence for each student.'],
      'demo/student':['Riwayat, jawaban dan tindak lanjut pada perangkat ini.','History, responses and follow-up on this device.'],
      'demo/assignments':['Pilih materi dan kerjakan tugas sebagai siswa simulasi.','Choose material and complete a task as a simulated student.'],
      'demo/admin':['Periksa cakupan konten dan aktivitas kelas simulasi.','Inspect content coverage and simulated class activity.'],
      reports:['Pratinjau dan unduh laporan dari data pada perangkat ini.','Preview and download reports from data on this device.']
    }[key]||['',''])))),h('span',{class:'tw-badge'},originLabel(filter.source,l))),
      h('nav',{class:'tw-nav','aria-label':t('Ruang guru','Teaching workspace')},nav.map(([path,mark])=>link(path==='reports'?(isReport?'reports':'reports?source=demo'):path,[icon(mark,17),t(...views[path])],'',{'aria-current':path===key||key==='demo/student'&&path==='demo/teacher'?'page':null}))));
    if(!views[key]||key==='demo/student'&&!person){page.append(t('Siswa tidak ditemukan.','Student not found.'));return;}
    const reportKey='report:'+filter.source+':'+(filter.source==='local_practice'?ctx.profileId:'staff');
    const env={page,data,l,t,key,ctx:viewCtx,status,refresh,filter,person,memory:draftFor(reportKey,{locale:l,reportId:'',reportFormat:'pdf',delimiter:','}),reportKey,freshBank,setFilter};
    if(key!=='demo/assignments')filters(env);
    if(key==='demo/teacher')monitor(env);
    if(key==='demo/student')student(env);
    if(key==='demo/admin')await admin(env);
    if(key==='demo/assignments'){const mod=await import('./assignments.js');if(!ctx.signal?.aborted&&token===generation)await mod.drawAssignments(env);}
    if(isReport){const mod=await import('./reports-view.js');if(!ctx.signal?.aborted&&token===generation)mod.drawReports(env);}
    if(!ctx.signal?.aborted&&token===generation)page.append(status);
  };
  await refresh();
}
function filters({page,data,l,t,key,ctx,filter,setFilter,refresh,person,status}) {
  const draftKey=['filter',key,filter.source,ctx.profileId,person?.id||filter.studentId||'all'].join(':');
  const saved=draftFor(draftKey), draft={...filter,...saved.form};
  const keep=()=>remember(draftKey,{...saved,form:{...draft}});
  const form=h('form',{});
  async function refreshFilter(){await refresh();if(page.isConnected)page.querySelector('.tw-filters summary')?.focus({preventScroll:true});}
  const choose=(k,label,items,optional=true)=>{const opts=optional?[['',t('Semua','All')],...items]:items;form.append(labelled(label,select(opts,draft[k],e=>{draft[k]=e.target.value;keep();})));};
  const inp=(k,label,type)=>{const el=h('input',{type,value:draft[k],oninput:e=>{draft[k]=e.target.value;keep();}});form.append(labelled(label,el));};
  if(key==='reports')choose('source',t('Sumber data','Data source'),[['demo',t('Simulasi','Demonstration')],['local_practice',t('Latihan pribadi','Local practice')]],false);
  if(filter.source==='demo')choose('classId',t('Kelas administratif','Administrative class'),classes.map(c=>[c.id,c.id]));
  if(!person)choose('studentId',t('Siswa','Student'),data.people.map(p=>[p.id,p.alias]));
  inp('from',t('Mulai tanggal','From date'),'date');inp('to',t('Sampai tanggal','Through date'),'date');
  choose('timezone',t('Zona waktu','Time zone'),Object.keys(zones).map(s=>[s,s]),false);
  choose('module',t('Modul','Module'),[['mental-math','Mental Math']],false);
  choose('grade',t('Kelas materi','Material grade'),Array.from({length:12},(_,i)=>[i+1,String(i+1)]));
  choose('level','Level',Array.from({length:5},(_,i)=>[i+1,String(i+1)]));
  choose('operation',t('Operasi','Operation'),operations.map(k=>[k,name(l,k)]));
  choose('mode','Mode',['practice','speed','assessment','adaptive','recovery'].map(k=>[k,name(l,k)]));
  choose('status','Status',['completed','ongoing','abandoned'].map(k=>[k,name(l,k)]));
  choose('packageId',t('Paket','Package'),(data.packages||[...new Set(data.attempts.map(a=>a.package_id))]).map(k=>[k,k]));
  const apply=h('button',{class:'primary',type:'submit'},t('Terapkan filter','Apply filters'));
  form.append(h('div',{class:'tw-actions tw-full'},apply,button(t('Atur ulang','Reset'),()=>{forget(draftKey);setFilter({...initialFilters(),source:filter.source,studentId:filter.studentId,classId:filter.classId});refreshFilter();})));
  form.onsubmit=e=>{e.preventDefault();try{periodBounds(draft);}catch{status.textContent=t('Tanggal akhir mendahului tanggal mulai.','The end date precedes the start date.');return;}
    if(draft.source!==filter.source){draft.studentId='';draft.classId='';draft.packageId='';}forget(draftKey);setFilter({...draft});status.textContent='';refreshFilter();};
  const panel=h('details',{class:'tw-filters',open:!!saved.open},h('summary',{},t('Filter data','Filter data')),form);
  panel.ontoggle=()=>{if(!panel.isConnected)return;saved.open=panel.open;keep();};
  const activePerson=person||data.people.find(p=>p.id===filter.studentId);
  const scope=[activePerson?.alias,filter.source==='demo'?(filter.classId||activePerson?.classId||t('Semua kelas','All classes')):null,
    filter.from||filter.to?(filter.from||'…')+' — '+(filter.to||'…'):t('Semua tanggal','All dates'),
    filter.grade&&t('Kelas materi ','Material grade ')+filter.grade,filter.level&&'Level '+filter.level,
    filter.operation&&name(l,filter.operation),filter.mode&&name(l,filter.mode),filter.status&&name(l,filter.status),filter.timezone];
  page.append(h('p',{class:'tw-context'},scope.filter(Boolean).join(' · ')),panel);
}
function monitor({page,data,l,t,filter:f}){
  const rows=filterSessions(data.attempts,data.people,f), people=data.people.filter(p=>(!f.classId||p.classId===f.classId)&&(!f.studentId||p.id===f.studentId));
  page.append(chips([[t('Siswa','Students'),people.length],[t('Sesi selesai','Completed sessions'),rows.filter(a=>a.status==='completed').length],
    [t('Tugas pada daftar siswa ini','Assignments for these learners'),data.assignments.filter(a=>people.some(p=>p.id===a.profileId)).length]]));
  const list=h('div',{class:'tw-list'});
  for(const p of people){
    const a=rows.filter(x=>x.profile_id===p.id),done=a.find(x=>x.status==='completed'),m=done&&sumCounts([done]);
    let reason=t('Belum ada sesi selesai. Ajak siswa mencoba latihan singkat.','No completed sessions. Invite the learner to try a short practice session.');
    if(m){
      const context=name(l,done.operation)+' · '+name(l,done.mode)+' · '+t('kelas','grade')+' '+done.grade+' · level '+done.level;
      reason=context+' — '+(m.hintCount?t('Tinjau '+m.hintCount+' soal yang memakai petunjuk.', 'Review '+m.hintCount+' questions answered using hints.'):
        m.firstCorrect<m.firstTotal?t('Bahas kembali '+(m.firstTotal-m.firstCorrect)+' dari '+m.firstTotal+' respons pertama.','Revisit '+(m.firstTotal-m.firstCorrect)+' of '+m.firstTotal+' first responses.'):
        t('Lihat konsistensi pada soal berikutnya.','Check consistency on the next questions.'));
    }
    const detail=link('demo/student/'+p.id,t('Lihat bukti','View evidence'),'btn',{'aria-label':t('Lihat bukti '+p.alias,'View evidence for '+p.alias)});
    detail.dataset.student=p.id;detail.addEventListener('click',()=>remember('roster:position',{id:p.id,y:window.scrollY}));
    list.append(h('div',{class:'tw-person'},h('div',{},h('strong',{},p.alias+' · '+p.classId),h('p',{},reason),
      h('small',{},(a[0]?dateAt(a[0].started_at,f.timezone,l):'—')+' · '+t('Sesi: ','Sessions: ')+a.length+' · '+t('Tugas: ','Assignments: ')+data.assignments.filter(x=>x.profileId===p.id).length)),detail));
  }
  const returnTo=draftFor('roster:position');if(returnTo.id)requestAnimationFrame(()=>{if(!page.isConnected)return;const anchor=[...list.querySelectorAll('a')].find(n=>n.dataset.student===returnTo.id);if(anchor){window.scrollTo({top:returnTo.y||0,behavior:'instant'});anchor.focus({preventScroll:true});}forget('roster:position');});
  page.append(box(t('Siswa dan tindak lanjut','Learners and follow-up'),list,!people.length&&h('p',{},t('Tidak ada siswa yang sesuai.','No matching students.'))));
}
function student({page,data,l,t,ctx,filter:f,person:p,status,refresh}){
  const snap=buildSnapshot({person:p,people:data.people,attempts:data.attempts,notes:data.notes,filters:f,locale:l});
  const all=filterSessions(data.attempts,data.people,{...f,studentId:p.id});
  const assign=link('demo/assignments?student='+encodeURIComponent(p.id),t('Buat penugasan','Create assignment'),'primary',{'aria-label':t('Buat penugasan untuk '+p.alias,'Create an assignment for '+p.alias)});
  const report=button(t('Buka laporan siswa','Open student report'),()=>{
    const reportFilters={...f,studentId:p.id,source:'demo'};remember('context:reports:'+ctx.profileId,{filters:reportFilters});
    location.hash='#/reports?'+new URLSearchParams({source:'demo',student:p.id});
  });
  page.append(h('div',{class:'tw-actions'},assign,report),box(t('Materi dan langkah berikutnya','Learning focus and next step'),h('p',{},nextStep(snap,l)),
    snap.contexts.length?table([t('Materi','Topic'),'Mode',t('Respons pertama benar','Correct on first try'),t('Soal dengan petunjuk','Questions with hints')],
    snap.contexts.map(c=>[name(l,c.operation)+' · '+t('kelas ','grade ')+c.grade+' · L'+c.level,name(l,c.mode),c.firstCorrect+' / '+c.firstTotal,c.hintCount])):t('Belum ada sesi selesai.','No completed sessions.')));
  const sessionBox=box(t('Sesi dan jawaban','Sessions and responses')),pageSize=10;
  const list=h('div',{}),position=h('p',{role:'status'});let slice=0;
  const back=button(t('Sebelumnya','Previous'),()=>{slice-=pageSize;paint();}),more=button(t('Berikutnya','Next'),()=>{slice+=pageSize;paint();});
  function paint(){
    list.replaceChildren();all.slice(slice,slice+pageSize).forEach(a=>{
      const d=h('details',{},h('summary',{},dateAt(a.started_at,f.timezone,l)+' · '+name(l,a.operation)+' · '+name(l,a.mode)+' · '+name(l,a.status)));
      d.ontoggle=()=>{if(!d.open||d.children.length>1)return;
        const transport=a.transport==='mock_accepted'?t('Diterima simulasi','Accepted by simulation'):a.transport?t('Tersimpan pada perangkat','Saved on device'):t('Contoh sintetis','Synthetic fixture');
        d.append(h('p',{},transport+' · '+a.package_id));if(a.mode==='assessment'&&a.status==='ongoing'){
          d.append(h('p',{},t('Kunci dan hasil per soal tersedia setelah evaluasi selesai.','Answers and item outcomes are available after the assessment ends.')));return;}
        for(const [index,i] of a.items.entries()){
          const history=i.history||[],first=history[0],last=history.at(-1),answer=i.question.answer;
          const hints=i.hint_used?t('Pernah menggunakan petunjuk','Hint used'):t('Tanpa petunjuk','No hint used');
          const timing=last?.timing_quality==='valid_client_estimate'?t('Estimasi perangkat','Device estimate'):t('Waktu belum cukup pasti','Timing unavailable or uncertain');
          const item=h('details',{class:'tw-item'},h('summary',{},(index+1)+'. ',i.question.expression_ast?formula(i.question.expression_ast,l):i.question.neutral_expression,' · '+name(l,i.final_status)),h('p',{},t('Respons pertama','First response')+' · '+(first?.raw_answer||'—')+(first?' ('+name(l,first.is_correct?'correct':'incorrect')+')':'')),
            h('p',{},t('Respons terakhir','Last response')+' · '+(last?.raw_answer||'—')+' · '+hints+' · '+t('Percobaan ulang: ','Retries: ')+history.filter(v=>v.submission_kind==='retry').length),
            h('p',{},t('Kunci jawaban','Correct answer')+' · ',answer?formula(asRational(answer),l,decimalPreference(i.question)):'—',' · '+timing),last?.key_seen_before&&h('p',{},t('Revisi setelah melihat kunci','Revision after seeing the answer')),first?.answer&&h('p',{},t('Nilai respons pertama · ','First response value · '),formula(enteredAst(first),l)),
            history.length>1&&h('ol',{},history.map(r=>h('li',{},r.raw_answer+' · '+name(l,r.is_correct?'correct':'incorrect')))));
          const solution=i.question.solution?.[l]||i.question.explanation?.[l];if(i.question.solution_steps?.length)item.append(workedMethod(i.question,l));
          else if(typeof solution==='string')item.append(h('p',{},mathProse(solution,l)));
          d.append(item);
        }
      };list.append(d);
    });
    position.textContent=all.length?(slice+1)+'–'+Math.min(slice+pageSize,all.length)+' / '+all.length:t('Belum ada sesi.','No sessions yet.');back.disabled=slice===0;more.disabled=slice+pageSize>=all.length;
  }
  paint();
  sessionBox.append(list,position);
  if(all.length>pageSize) sessionBox.append(h('div',{class:'tw-actions'},back,more));
  page.append(sessionBox);
  const draftKey='note:demo:'+p.id,draft=draftFor(draftKey,{type:'note',revision:'',text:'',reason:''});
  const form=h('form',{class:'tw-form'}),txt=h('textarea',{maxlength:2000,required:true,rows:3}),reason=h('input',{maxlength:300,value:draft.reason});
  txt.value=draft.text;
  const notes=snap.notes,active=snap.activeNotes;
  const type=select([['note',t('Catatan','Note')],['override',t('Keputusan guru dan alasan','Teacher decision and reason')]],draft.type);
  const stale=draft.revision&&!active.some(n=>n.id===draft.revision)?draft.revision:'';
  const revisions=[['',t('Entri baru','New entry')],...active.map(n=>[n.id,'r'+n.revision+' · '+n.text.slice(0,60)])];
  if(stale)revisions.push([stale,t('Versi ini telah digantikan','This revision was superseded')]);
  const prev=select(revisions,draft.revision);
  const reasonField=labelled(t('Alasan revisi (opsional)','Reason for revision (optional)'),reason);
  const dirty=h('p',{class:'tw-full tw-muted',role:'status'});
  function sync(){Object.assign(draft,{type:type.value,revision:prev.value,text:txt.value,reason:reason.value});remember(draftKey,draft);reasonField.hidden=!prev.value;
    submit.disabled=Boolean(stale&&prev.value===stale);
    if(submit.disabled){dirty.textContent=t('Ada revisi yang lebih baru. Pilih revisi berlaku atau entri baru sebelum menyimpan draf ini.','A newer revision exists. Choose the current revision or a new entry before saving this draft.');return;}
    dirty.textContent=txt.value.trim()?t('Draf belum disimpan.','Unsaved draft.') : '';}
  type.onchange=reason.oninput=txt.oninput=sync;prev.onchange=()=>{const n=active.find(n=>n.id===prev.value);if(n){if(!stale)txt.value=n.text;type.value=n.type;}sync();};
  const submit=h('button',{type:'submit',class:'primary'},t('Simpan catatan','Save note'));
  form.append(labelled(t('Jenis','Type'),type),labelled(t('Revisi','Revision'),prev),h('div',{class:'tw-full'},labelled(t('Isi catatan atau alasan keputusan','Note or reason for decision'),txt)),reasonField,dirty,submit);sync();
  form.onsubmit=async e=>{e.preventDefault();if(submit.disabled)return;submit.disabled=true;
    try{await recordNote(p,txt.value,type.value,notes.find(n=>n.id===prev.value),reason.value);forget(draftKey);if(ctx.signal?.aborted)return;await refresh();status.textContent=(await getStatus()).temporary?t('Catatan tersedia selama tab ini terbuka. Penyimpanan perangkat tidak tersedia.','Note kept for this tab only. Device storage is unavailable.'):t('Catatan tersimpan.','Note saved.');}
    catch(err){status.textContent=message(t,err);submit.disabled=false;}};
  const noteLine=(n,state)=>h('p',{class:'tw-note'},state+' · '+n.author+' · '+dateAt(n.at,f.timezone,l)+' · r'+n.revision+' — '+n.text+(n.reason?' · '+n.reason:''));
  const old=notes.filter(n=>!active.includes(n));
  const history=h('details',{},h('summary',{},t('Riwayat perubahan','Revision history')+' ('+old.length+')'),old.map(n=>noteLine(n,t('Digantikan oleh revisi ','Superseded by revision ')+notes.find(v=>v.supersedes===n.id)?.revision)));
  page.append(box(t('Catatan guru','Teacher notes'),active.map(n=>noteLine(n,t('Berlaku','Current'))),old.length&&history||null,form));
}
async function admin({page,data,l,t,filter:f,freshBank,status,ctx,refresh}){
  const rows=filterSessions(data.attempts,data.people,f),stored=rows.filter(a=>a.transport),ack=stored.filter(a=>a.transport==='mock_accepted'),waiting=stored.filter(a=>['pending_sync','sending','retry_required'].includes(a.transport));
  const needs=stored.filter(a=>['rejected','conflict'].includes(a.transport));
  const panel=box(t('Pengiriman sesi simulasi','Demo session delivery'),h('p',{},t('LMS sekolah belum terhubung. Tanda terima simulasi menyatakan pengiriman contoh. Nilai belum diverifikasi institusi.','The school LMS is not connected. Demo receipts confirm simulated delivery. Grades are institutionally unverified.')),
    chips([[t('Sesi tersimpan','Sessions on device'),stored.length],[t('Menunggu pengiriman','Awaiting delivery'),waiting.length],[t('Diterima simulasi','Accepted by simulation'),ack.length],[t('Perlu tindakan','Needs attention'),needs.length]]));
  for(const a of [...needs,...waiting,...ack].slice(0,12)){
    const alias=data.people.find(p=>p.id===a.profile_id)?.alias||a.profile_id;
    const advice=a.transport==='conflict'?t('Konflik. Simpan cadangan dan periksa rincian sesi.','Conflicting records. Back up the data and inspect the session.'):a.transport==='rejected'?t('Ditolak. Periksa konteks sesi dan izin sebelum mencoba lagi.','Rejected. Check the session context and permissions before retrying.'):a.transport==='mock_accepted'?t('Diterima oleh simulasi','Accepted by the simulation'):t('Menunggu pengiriman ulang.','Awaiting another delivery attempt.');
    panel.append(h('div',{class:'tw-person'},h('div',{},h('strong',{},alias+' · '+name(l,a.operation)),h('p',{},advice),a.delivery?.last_ack&&h('small',{},t('Tanda terima terakhir · ','Last receipt · ')+dateAt(a.delivery.last_ack,f.timezone,l))),
      link('demo/student/'+encodeURIComponent(a.profile_id),t('Buka sesi siswa','View learner sessions'),'btn')));
  }
  if(waiting.length)panel.append(button(t('Periksa kembali antrean simulasi','Check the demo queue again'),refresh));
  page.append(panel);
  const host=box(t('Cakupan bank soal','Question bank coverage'));page.append(host);
  try{const b=await freshBank();if(ctx.signal?.aborted)return;
    const vals=[[t('Paket','Packages'),b.package_count],[t('Slot latihan','Practice slots'),b.question_slots],[t('Soal unik kanonik','Canonical unique items'),b.unique_canonical_items],
      [t('Slot berulang','Repeated slots'),b.question_slots-b.unique_canonical_items],[t('Kompetensi aktif','Active competencies'),b.active_competencies??b.active_count??b.competency_count??'—']];
    host.append(chips(vals),h('p',{},t('Versi konten','Content version')+' '+b.version),link('packs',t('Buka katalog','Open catalogue'),'btn'));
  }catch(err){host.append(h('p',{},message(t,err)));}
  page.append(box(t('Rekap kelas','Class summaries'),table([t('Kelas','Class'),t('Guru','Teacher'),t('Sesi','Sessions'),t('Respons benar / dijawab','Correct / answered')],classes.filter(c=>!f.classId||c.id===f.classId).map(c=>{
    const a=rows.filter(a=>data.people.find(p=>p.id===a.profile_id)?.classId===c.id);return [c.id,c.teacher,a.length,sumCounts(a).C+' / '+(sumCounts(a).C+sumCounts(a).W)];}))),
    box(t('Jejak tindakan simulasi','Demo action log'),h('p',{},t('Koneksi LMS produksi belum dikonfigurasi.','The production LMS connection is unconfigured.')),
      [...data.assignments.map(a=>[a.createdAt,t('Penugasan','Assignment'),a.profileId,a.packageId,a.id]),...data.notes.map(n=>[n.at,n.type==='override'?t('Keputusan','Decision'):t('Catatan','Note'),n.profileId,n.author,n.id])].sort((a,b)=>compareInstants(b[0],a[0])||String(a[4]).localeCompare(String(b[4]))).slice(0,50).map(row=>h('p',{},[dateAt(row[0],f.timezone,l),...row.slice(1,4)].join(' · '))),
      !data.assignments.length&&!data.notes.length&&h('p',{},t('Belum ada tindakan staf pada perangkat ini.','No staff actions on this device yet.'))));
}
