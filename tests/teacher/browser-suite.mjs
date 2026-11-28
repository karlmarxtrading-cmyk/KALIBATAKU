import {route,until,chooseLang,delay,name,visible} from '../integration/probes.mjs';
const text=n=>n?.textContent||'';
export async function runTeacherSuite(w,base,emit=()=>{}){
  const checks=[];
  const check=(id,ok,detail)=>{checks.push({id,status:ok?'PASS':'FAIL',detail});emit(checks);if(!ok)throw Error(id);};
  const find=(sel,pred=()=>true)=>[...w.document.querySelectorAll(sel)].find(n=>visible(n)&&!n.disabled&&pred(n));
  const click=async(sel,label)=>{const n=await until(()=>find(sel,x=>name(x)===label),label);n.click();};
  const button=s=>click('button',s);
  const choice=async(label,val)=>{const n=await until(()=>find('select',x=>x.getAttribute('aria-label')===label),label);n.value=val;n.dispatchEvent(new w.Event('change',{bubbles:true}));};
  const waitText=(sel,s)=>until(()=>[...w.document.querySelectorAll(sel)].some(n=>visible(n)&&text(n).includes(s)),sel+' '+s);
  await route(w,base,'demo/teacher');await chooseLang(w,'id');await waitText('.tw-person','Demo 01');
  check('roster',w.document.querySelectorAll('.tw-person').length===6,'Two synthetic classes, six personas');
  await click('.tw-filters summary','Filter data');await choice('Kelas administratif','3A');await button('Terapkan filter');await until(()=>w.document.querySelectorAll('.tw-person').length===3,'3A filter');
  check('class-filter',true,'Six -> three personas in class 3A');
  (await elEvidence()).click();
  function elEvidence(){return until(()=>find('.tw-person a',n=>n.href.endsWith('/demo-01')),'Open Demo 01 evidence');}await waitText('h1','Demo 01');
  const marker='Fixture '+crypto.randomUUID().slice(0,8),writeNote=async value=>{const n=await until(()=>find('textarea'),'Note field');n.value=value;n.dispatchEvent(new w.Event('input',{bubbles:true}));await button('Simpan catatan');await waitText('.tw-note',value);};
  await writeNote(marker+' <b>plain text</b>');const notes=[...w.document.querySelector('select[aria-label="Revisi"]').options];const id=notes.find(n=>n.textContent.includes(marker)).value;
  await choice('Revisi',id);await writeNote(marker+' / revision 2');
  check('revision',!!find('.tw-note',n=>text(n).includes('r2')&&text(n).includes(marker))&&!w.document.querySelector('.tw-note b'),'Append-only r1 and r2. Text is escaped.');
  (await until(()=>find('a',n=>n.href.includes('demo/assignments?student=demo-01')),'Assignment for Demo 01')).click();await button('Berikan tugas');await button('Kerjakan sebagai siswa demo');
  const inp=await until(()=>find('.kp-answer'),'Real bank answer field');inp.value='2';inp.dispatchEvent(new w.Event('input',{bubbles:true}));await button('Periksa · Enter');
  await waitText('[data-answer-feedback]','');await button('Akhiri latihan');await button('Selesaikan dan lihat hasil'); // 1.4 practice end (no review grid)
  await until(()=>w.location.hash.startsWith('#/results/'),'Immutable result');
  const attempt=w.location.hash.split('/').at(-1);
  await route(w,base,'demo/assignments');await waitText('.tw-person','Selesai');
  await route(w,base,'demo/student/demo-01');const summary=await until(()=>find('.tw-card details>summary'),'Session summary');summary.click();await waitText('.tw-card details[open]','Diterima simulasi');
  check('assignment-bridge',text(summary.parentElement).includes('2'),{attempt,detail:'Assigned real question, response, finalization, mock receipt and item drilldown.'});
  await button('Buka laporan siswa');await waitText('.tw-paper','Demo 01');await choice('Bahasa laporan','bilingual');await waitText('.tw-paper','Parent meeting report');
  check('report-preview',!!w.document.querySelector('.tw-paper table')&&!text(w.document.querySelector('.tw-paper')).includes('[object HTML'),'Real DOM headings, tables, and preview text');
  const captured=[],real=w.HTMLAnchorElement.prototype.click,createURL=w.URL.createObjectURL,blobs=new Map();
  w.URL.createObjectURL=function(blob){const url=createURL.call(w.URL,blob);blobs.set(url,blob);return url;};
  // Capture the browser-generated download bytes in this test window for validation.
  // The product still invokes a normal download link for users.
  w.HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){captured.push({name:this.download,blob:blobs.get(this.href)});return;}return real.call(this);};
  try{
    for(const kind of ['pdf','docx','xlsx','csv','json','zip']){
      await choice('Format berkas',kind);const before=captured.length;
      await button('Unduh laporan');await until(()=>captured.length>before,'Download '+kind,20000);
      const cap=captured.at(-1),bytes=new Uint8Array(await cap.blob.arrayBuffer());
      let valid=cap.name.endsWith('.'+kind)&&bytes.length>100;const dec=new TextDecoder();
      if(['xlsx','docx','zip'].includes(kind))valid&&=bytes[0]===80&&bytes[1]===75;
      if(kind==='pdf')valid&&=dec.decode(bytes.slice(0,5))==='%PDF-';
      if(kind==='csv')valid&&=dec.decode(bytes).includes('DEMONSTRATION DATA');
      if(kind==='json'){const j=JSON.parse(dec.decode(bytes));valid&&=j.person.id==='demo-01'&&j.core.assigned_count>=30&&j.notes.some(n=>n.text===marker+' / revision 2')&&j.core.locale==='bilingual';}
      check('download-'+kind,valid,{filename:cap.name,bytes:bytes.length});
    }
    await click('.tw-filters summary','Filter data');await choice('Sumber data','local_practice');await button('Terapkan filter');
    await waitText('.tw-paper','belum diverifikasi institusi');
    await choice('Format berkas','json');const before=captured.length;await button('Unduh laporan');await until(()=>captured.length>before,'Local report JSON');
    const local=JSON.parse(await captured.at(-1).blob.text());
    check('origin-isolation',local.core.data_origin==='local_practice'&&local.person.id!=='demo-01'&&!local.sessions.some(s=>s.id===attempt),'Personal report namespace restored');
  }finally{w.HTMLAnchorElement.prototype.click=real;w.URL.createObjectURL=createURL;blobs.clear();}
  return checks;
}
