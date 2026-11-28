import {clearMath,formula} from '../math/view.mjs';
import {h,box,button,labelled,select,table} from './ui.js';
import {buildSnapshot,originLabel} from './report.js';
import {documentModel,fileStem} from './document.js';
import {draftFor,remember} from './drafts.js';
export function drawReports({page,data,l,t,filter:f,memory,reportKey,status,ctx}){
  const people=data.people.filter(p=>(!f.classId||p.classId===f.classId)&&(!f.studentId||p.id===f.studentId));
  if(!people.length){page.append(box(t('Pratinjau','Preview'),t('Tidak ada siswa yang sesuai dengan filter.','No students match the filters.')));return;}
  const controls=h('div',{class:'tw-form'}),paper=h('article',{class:'tw-paper','aria-label':t('Pratinjau laporan','Report preview')});
  const locale=select([['id','Indonesia'],['en','English'],['bilingual','Indonesia + English']],memory.locale||l);
  const target=select(people.map(p=>[p.id,p.alias]),people.some(p=>p.id===memory.reportId)?memory.reportId:people[0].id);
  const labels={pdf:t('PDF · cetak untuk keluarga','PDF · print for families'),docx:t('DOCX · sunting dokumen','DOCX · edit the document'),xlsx:t('XLSX · analisis spreadsheet','XLSX · analyse in a spreadsheet'),csv:t('CSV · tabel data','CSV · data tables'),json:t('JSON · pertukaran laporan','JSON · report interchange'),zip:t('ZIP · PDF beberapa siswa','ZIP · PDFs for several learners')};
  const format=select(Object.entries(labels),memory.reportFormat);
  const delimiter=select([[',',t('Koma (,)','Comma (,)')],[';',t('Titik koma (;)','Semicolon (;)')]],memory.delimiter);
  const delimField=labelled(t('Pemisah CSV','CSV delimiter'),delimiter);
  const scope=h('p',{class:'tw-context'}),batchStatus=h('p',{role:'status'}),batchPanel=h('fieldset',{class:'tw-subjects'},h('legend',{},t('Siswa untuk ZIP','Students in ZIP')));
  const checks=people.map(p=>{const c=h('input',{type:'checkbox',value:p.id,checked:memory.selected?memory.selected.includes(p.id):true});batchPanel.append(h('label',{class:'tw-check'},c,p.alias));return c;});
  const plan=h('textarea',{rows:2,maxlength:600}),review=h('input',{type:'date'}),appendix=h('input',{type:'checkbox',checked:!!memory.appendix});
  const planBox=h('details',{},h('summary',{},t('Atur rencana dan tanggal tinjauan','Set a practice plan and review date')),
    labelled(t('Rencana untuk siswa ini','Practice plan for this learner'),plan),labelled(t('Tanggal tinjauan','Review date'),review));
  const jsonHint=h('p',{},t('JSON ini adalah laporan. Untuk memulihkan sesi, gunakan cadangan dari halaman Profil.','This JSON contains a report. Use a backup from Profiles to restore sessions.'));
  const go=button(t('Unduh laporan','Download report'),download,true),stop=button(t('Batalkan ekspor','Cancel export'),cancel);stop.hidden=true;go.disabled=true;
  let job=null,renderWorker=null,current=null,running=false,token=0,jobSeq=0,previewTimer;
  const loadedSubjects=new Map(),snapshotCache=new Map(); // One immutable dataset per report view; discarded on filter/source/revision changes.
  const detailsFor=id=>draftFor(reportKey+':plan:'+id,{plan:'',reviewDate:''});
  const makeInput=async(p,createdAt)=>{
    if(!loadedSubjects.has(p.id))loadedSubjects.set(p.id,data.readSubject?data.readSubject(p.id):Promise.resolve(data.attempts.filter(a=>a.profile_id===p.id)));
    let attempts;try{attempts=await loadedSubjects.get(p.id);}catch(error){loadedSubjects.delete(p.id);throw error;}
    return {person:p,people:[p],attempts,
    notes:data.notes.filter(n=>n.profileId===p.id),filters:{...f},locale:locale.value,createdAt,appendix:appendix.checked,...detailsFor(p.id)};};
  function persist(){remember(reportKey,memory);}
  function updateSelection(){
    const ids=new Set(memory.selected||data.people.map(p=>p.id));
    checks.forEach(c=>c.checked?ids.add(c.value):ids.delete(c.value));memory.selected=[...ids];persist();
    const selected=checks.filter(c=>c.checked).length;
    batchStatus.textContent=t('Berkas PDF terpilih: ','Selected PDF files: ')+selected+' / '+people.length;
    if(!running)go.disabled=!current||(format.value==='zip'&&!selected);
  }
  function paint(){
    if(!current||ctx.signal?.aborted)return;
    const prefs=detailsFor(target.value);
    if(current.plan!==prefs.plan||current.reviewDate!==prefs.reviewDate||current.appendix!==appendix.checked){
      current={...current,...prefs,appendix:appendix.checked,core:{...current.core,report_id:'R-'+crypto.randomUUID(),created_at:new Date().toISOString()}};
      snapshotCache.set(target.value+'|'+locale.value,current);
    }
    const model=documentModel(current);paper.lang=locale.value==='bilingual'?'id':locale.value;
    paper.dataset.reportId=current.core.report_id;paper.dataset.subject=current.person.id;paper.dataset.origin=current.core.data_origin;
    const blocks=model.blocks,appendixAt=blocks.findIndex(b=>['Lampiran teknis','Technical appendix','Lampiran teknis / Technical appendix'].includes(b.text)),limit=12;let count=0;
    clearMath(paper);paper.replaceChildren(h('small',{},'KALIBATAKU  /  MENTAL MATH'),h('h2',{},model.title));
    function renderBlock(b){if(b.kind==='math')return h('p',{},b.label+' · ',formula(b.ast,current.core.locale,b.opts));return b.kind==='table'?table(b.headers,b.rows.slice(0,12)):h(b.kind==='h'?'h3':'p',{},b.text);}
    function next(){
      more.remove();const end=count===0?(appendixAt>0?appendixAt:blocks.length):count+limit;const batch=blocks.slice(count,end);count+=batch.length;
      for(const b of batch){
        const block=renderBlock(b);paper.append(block);if(b.kind==='table'&&b.rows.length>12){
          let offset=12;const another=button(t('Tampilkan baris selanjutnya','Show next rows'),()=>{
            const tbody=block.querySelector('tbody');
            for(const row of b.rows.slice(offset,offset+12))tbody.append(h('tr',{},row.map(cell=>h('td',{},String(cell??'—')))));
            offset+=12;if(offset>=b.rows.length)another.remove();
          });paper.append(another);}
      }
      if(count<blocks.length)paper.append(more);
    }
    const more=button(t('Baca lanjutan laporan','Read more of the report'),next);next();
    updateSelection();
  }
  async function preview(){
    memory.locale=locale.value;memory.reportId=target.value;persist();
    const subject=people.find(p=>p.id===target.value),details=detailsFor(subject.id);
    plan.value=details.plan;review.value=details.reviewDate;
    scope.textContent=[originLabel(f.source,l),subject.alias,subject.classId,[f.from,f.to].some(Boolean)?(f.from||'…')+' — '+(f.to||'…'):t('Semua tanggal','All dates'),f.timezone,locale.selectedOptions[0].textContent].filter(Boolean).join(' · ');
    current=null;go.disabled=true;renderWorker?.terminate();renderWorker=null;const seq=++token,key=subject.id+'|'+locale.value;
    clearMath(paper);paper.replaceChildren(h('p',{role:'status'},t('Menyiapkan ringkasan…','Preparing summary…')));
    try{
      let result=snapshotCache.get(key);
      if(!result){const input=await makeInput(subject,new Date().toISOString());if(ctx.signal?.aborted||seq!==token)return;
        if(input.attempts.length<24)result=buildSnapshot(input);
        else result=await new Promise((res,rej)=>{
          renderWorker=new Worker(new URL('./report-work.js',import.meta.url),{type:'module'});
          renderWorker.onmessage=({data:r})=>r.error?rej(Error(r.error)):res(r.snapshot);
          renderWorker.onerror=()=>rej(Error('WORKER'));renderWorker.postMessage(input);});
      }
      if(ctx.signal?.aborted||seq!==token)return;renderWorker?.terminate();renderWorker=null;snapshotCache.set(key,result);current=result;paint();
    }catch{if(ctx.signal?.aborted||seq!==token)return;renderWorker?.terminate();renderWorker=null;
      clearMath(paper);paper.replaceChildren(h('p',{},t('Ringkasan gagal dibuka. Periksa koneksi untuk memuat modul laporan.','The summary could not open. Check your connection to load the report module.')),button(t('Coba lagi','Retry'),preview));}
  }
  function choice(){memory.reportFormat=format.value;persist();delimField.hidden=format.value!=='csv';jsonHint.hidden=format.value!=='json';batchPanel.hidden=format.value!=='zip';updateSelection();}
  function finished(){jobSeq++;job?.terminate();job=null;running=false;stop.hidden=true;for(const c of [target,locale,format,review,plan,appendix,delimiter,...checks])c.disabled=false;updateSelection();}
  function cancel(){finished();status.textContent=t('Ekspor dibatalkan.','Export cancelled.');}
  const fontMessage=t('Font PDF belum dapat menampilkan semua karakter. Gunakan DOCX atau baca pratinjau HTML untuk mempertahankan ejaan aslinya.','The PDF font cannot display every character. Choose DOCX or read the HTML preview to keep the original spelling.');
  const errorText=err=>String(err).startsWith('FONT_COVERAGE')?fontMessage:t('Berkas gagal disiapkan. Periksa koneksi lalu coba lagi.','The file could not be prepared. Check the connection, then retry.');
  async function download(){
    if(running||!current||go.disabled)return;
    clearTimeout(previewTimer);paint();
    const kind=format.value,selected=kind==='zip'?people.filter((_,i)=>checks[i].checked):[];
    const ticket=++jobSeq;running=true;go.disabled=true;stop.hidden=false;for(const c of [target,locale,format,review,plan,appendix,delimiter,...checks])c.disabled=true;
    status.textContent=t('Menyiapkan berkas…','Preparing file…');
    try{
      const {mime}=await import('./export/index.js');if(ticket!==jobSeq||!running||ctx.signal?.aborted)return;
      const selectedInputs=[];
      if(kind==='zip'){
        for(const p of selected){
          if(ticket!==jobSeq||!running||ctx.signal?.aborted)return;
          selectedInputs.push(p.id===current.person.id?{snapshot:current}:{input:await makeInput(p,current.core.created_at)});
        }
      }else selectedInputs.push({snapshot:current});
      if(ticket!==jobSeq||!running||ctx.signal?.aborted)return;
      const stem=kind==='zip'?'KALIBATAKU_Batch_'+locale.value+'_'+new Date().toISOString().slice(0,10):fileStem(current);
      job=new Worker(new URL('./export/work.js',import.meta.url),{type:'module'});
      job.onerror=()=>{finished();status.textContent=errorText('WORKER');};
      job.onmessage=({data:r})=>{
        if(ticket!==jobSeq||ctx.signal?.aborted)return;
        if(r.total){status.textContent=t('Laporan selesai','Reports completed')+' '+r.done+' / '+r.total;return;}
        if(r.error){finished();status.textContent=errorText(r.error);return;}
        const url=URL.createObjectURL(new Blob([r.data],{type:mime[kind]})),a=h('a',{href:url,download:stem+(r.errors?.length?'_partial':'')+'.'+kind});
        document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);finished();
        status.replaceChildren(...(r.errors?.length?[t('Ekspor sebagian.','Partial export.'),h('ul',{},r.errors.map(e=>h('li',{},(people.find(p=>p.id===e.profile_id)?.alias||e.profile_id)+' — '+errorText(e.reason)))),
          t('Pilih kembali siswa yang gagal, lalu unduh dengan format lain.','Select the affected learner and download in another format.')]:[t('Berkas siap diunduh.','File prepared for download.')]));
      };
      job.postMessage({selectedInputs,format:kind,delimiter:delimiter.value});
    }catch(err){if(ticket===jobSeq){finished();status.textContent=errorText(err);}}
  }
  const printFull=()=>{
    if(!current||ctx.signal?.aborted)return;const model=documentModel(current);
    clearMath(paper);paper.replaceChildren(h('h2',{},model.title),...model.blocks.map(b=>b.kind==='math'?h('p',{},b.text):b.kind==='table'?table(b.headers,b.rows):h(b.kind==='h'?'h3':'p',{},b.text)));
  };
  window.addEventListener('beforeprint',printFull,{signal:ctx.signal});window.addEventListener('afterprint',paint,{signal:ctx.signal});
  for(const c of checks)c.onchange=updateSelection;
  target.onchange=locale.onchange=preview;format.onchange=choice;delimiter.onchange=()=>{memory.delimiter=delimiter.value;persist();};
  appendix.onchange=()=>{memory.appendix=appendix.checked;persist();paint();};
  plan.oninput=review.oninput=()=>{remember(reportKey+':plan:'+target.value,{plan:plan.value,reviewDate:review.value});clearTimeout(previewTimer);previewTimer=setTimeout(paint,200);};
  ctx.signal?.addEventListener('abort',()=>{++token;clearTimeout(previewTimer);renderWorker?.terminate();job?.terminate();running=false;},{once:true});
  controls.append(labelled(t('Pratinjau siswa','Preview student'),target),labelled(t('Bahasa laporan','Report language'),locale),labelled(t('Format berkas','File format'),format),delimField);
  batchPanel.append(batchStatus);
  page.append(box(t('Pilihan laporan','Report options'),scope,controls,jsonHint,planBox,h('label',{class:'tw-check'},appendix,t('Sertakan lampiran teknis','Include technical appendix')),batchPanel,h('div',{class:'tw-actions'},go,stop)),paper);
  choice();preview();
}
