import {h,box,button,labelled,select,message} from './ui.js';
import {name,dateAt} from './report.js';
import {createAssignment,demoScope} from './demo.js';
import {getStatus} from '../data/db.js';
import {draftFor,remember,forget} from './drafts.js';
export async function drawAssignments({page,data,l,t,freshBank,refresh,status,ctx,filter}){
  const roster=data.people,from=ctx.params?.get('student')||filter.studentId||'';
  const valid=id=>roster.some(p=>p.id===id);
  const draftKey='assignment:demo:'+(from||'all'),draft=draftFor(draftKey,{
    target:from||roster[0]?.id||'',grade:'1',level:'1',op:'ADD',pack:'',mode:'practice',goal:'',
    due:new Date(Date.now()+7*86400000).toISOString().slice(0,10)
  });
  const form=h('form',{class:'tw-form'}),existing=box(t('Tugas pada perangkat ini','Assignments on this device'));
  const target=select([['',t('Pilih siswa','Choose a student')],...roster.map(p=>[p.id,p.alias+' · '+p.classId])],valid(draft.target)?draft.target:'');
  const goal=h('input',{maxlength:160,value:draft.goal,placeholder:t('Misalnya, melatih pasangan bilangan','For example, practise number bonds')});
  const grade=select(Array.from({length:12},(_,i)=>[String(i+1),String(i+1)]),draft.grade);
  const level=select(Array.from({length:5},(_,i)=>[String(i+1),String(i+1)]),draft.level);
  const op=h('select'),pack=h('select'),mode=select(['practice','assessment','speed','adaptive'].map(v=>[v,name(l,v)]),draft.mode);
  const due=h('input',{type:'date',required:true,value:draft.due});
  const save=h('button',{type:'submit',class:'primary',disabled:true},t('Berikan tugas','Assign task'));
  const summary=h('p',{class:'tw-assignment-summary tw-full','aria-live':'polite'});
  form.append(labelled(t('Siswa','Student'),target),labelled(t('Tujuan belajar (opsional)','Learning goal (optional)'),goal),
    labelled(t('Kelas materi','Material grade'),grade),labelled('Level',level),labelled(t('Operasi','Operation'),op),
    labelled(t('Paket','Package'),pack),labelled('Mode',mode),labelled(t('Tenggat · Asia/Jakarta','Due date · Asia/Jakarta'),due),summary,save);
  page.append(box(t('Buat tugas simulasi','Create a demo assignment'),form),existing);
  let seq=0,shard,saving=false;
  function objectChoice(){const c=shard?.competencies.find(x=>x.operation===op.value);return [c,c?.packages.find(x=>x.package_id===pack.value)];}
  function details(){const [comp,p]=objectChoice(),person=roster.find(x=>x.id===target.value);
    save.disabled=saving||!p||!person||!due.value;
    if(!person){summary.textContent=t('Pilih kembali penerima sebelum menyimpan tugas.','Choose a recipient before saving the assignment.');return;}
    summary.textContent=p?[person.alias+' · '+person.classId,goal.value.trim()||comp.title[l],p.title[l],p.question_count+' '+t('soal','questions'),name(l,mode.value),due.value+' · 23.59 Asia/Jakarta'].join(' — '):t('Pilih kelas atau level lain untuk melihat paket yang tersedia.','Choose another grade or level to see available packages.');
  }
  function persist(){Object.assign(draft,{target:target.value,goal:goal.value,grade:grade.value,level:level.value,mode:mode.value,due:due.value});
    if(!op.disabled)draft.op=op.value;if(!pack.disabled)draft.pack=pack.value;remember(draftKey,draft);}
  function choosePackages(){
    const c=shard?.competencies.find(x=>x.operation===op.value);
    const list=(c?.packages||[]).filter(p=>mode.value==='assessment'?p.purpose==='assessment':p.purpose!=='assessment');
    pack.replaceChildren(...list.map(p=>h('option',{value:p.package_id},p.title[l]+' · '+p.question_count+' '+t('soal','questions'))));
    if(list.some(p=>p.package_id===draft.pack))pack.value=draft.pack;persist();details();
  }
  async function load(){
    const n=++seq;save.disabled=true;op.disabled=true;pack.disabled=true;shard=undefined;persist();summary.textContent=t('Memuat pilihan paket…','Loading available packages…');
    try{const g=grade.value.padStart(2,'0'),v=level.value.padStart(2,'0'),r=await freshBank('bank/g'+g+'/l'+v+'.json');
      if(ctx.signal?.aborted||n!==seq)return;shard=r;const ops=r.competencies.filter(c=>c.active);
      op.replaceChildren(...ops.map(c=>h('option',{value:c.operation},name(l,c.operation))));
      if(ops.some(c=>c.operation===draft.op))op.value=draft.op;op.disabled=false;pack.disabled=false;choosePackages();}
    catch(e){if(n!==seq||ctx.signal?.aborted)return;summary.replaceChildren(message(t,e),' ',button(t('Coba lagi','Retry'),load));}
  }
  grade.onchange=level.onchange=load;op.onchange=mode.onchange=choosePackages;
  target.onchange=pack.onchange=due.oninput=goal.oninput=()=>{persist();details();};
  form.onsubmit=async e=>{
    e.preventDefault();if(saving||save.disabled)return;saving=true;save.disabled=true;
    try{const [c,p]=objectChoice();if(!p||!valid(target.value))throw new Error('ASSIGNMENT');
      await createAssignment({profileId:target.value,goal:goal.value.trim(),packageId:p.package_id,competencyId:c.competency_id,grade:+grade.value,level:+level.value,operation:op.value,mode:mode.value,
        entry:{...p,competency_id:c.competency_id,pool_size:c.pool_size,prerequisites:c.prerequisites,grade:+grade.value,level:+level.value,operation:op.value},
        due:new Date(due.value+'T23:59:59+07:00').toISOString(),zone:'Asia/Jakarta'});
      forget(draftKey);if(ctx.signal?.aborted)return;await refresh();status.textContent=(await getStatus()).temporary?t('Tugas tersedia selama tab ini terbuka. Penyimpanan perangkat tidak tersedia.','Assignment kept for this tab only. Device storage is unavailable.'):t('Tugas simulasi tersimpan pada perangkat ini.','Demo assignment saved on this device.');
    }catch(err){saving=false;details();status.textContent=message(t,err);}
  };
  const shown=data.assignments.filter(a=>!from||a.profileId===from);
  if(!shown.length)existing.append(h('p',{},t('Belum ada tugas untuk penerima ini.','No assignments for this recipient yet.')));
  for(const a of shown){
    const attempts=data.attempts.filter(x=>x.assignment_id===a.id),done=attempts.find(x=>x.status==='completed'),ongoing=attempts.find(x=>x.status==='ongoing'),subject=roster.find(p=>p.id===a.profileId);
    if(!subject)continue;
    const start=button(ongoing?t('Lanjutkan sebagai siswa demo','Resume as demo student'):t('Kerjakan sebagai siswa demo','Start as demo student'),async()=>{
      if(start.disabled)return;start.disabled=true;try{await ctx.startAssignment({...a,assignment_id:a.id,active_attempt_id:ongoing?.attempt_id,scope:demoScope(a.profileId)});}
      catch(err){status.textContent=message(t,err);start.disabled=false;}
    });
    existing.append(h('div',{class:'tw-person'},h('div',{},h('strong',{},subject.alias+' · '+subject.classId+' · '+name(l,a.mode)),a.goal&&h('p',{},a.goal),h('small',{},(a.entry?.title?.[l]||name(l,a.operation))+' · '+dateAt(a.due,a.zone,l)+' '+a.zone),h('small',{},done?t('Selesai','Completed'):ongoing?t('Berjalan','In progress'):t('Belum dikerjakan','Not started'))),!done&&start));
  }
  await load();
}
