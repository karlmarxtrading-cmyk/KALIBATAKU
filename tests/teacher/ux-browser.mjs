import {route,until,chooseLang,visible,delay} from '../integration/probes.mjs';

// Drive native controls in a second, same-origin application window.
export async function runSchoolUX(w,base,baseline=false){
  const rows=[],d=()=>w.document;
  const wait=(read,why)=>until(read,why,16000);
  async function el(sel,where=()=>true){return wait(()=>[...d().querySelectorAll(sel)].find(n=>visible(n)&&!n.disabled&&where(n)),sel);}
  async function click(sel,label){const n=await el(sel,n=>n.textContent.trim()===label);n.click();await delay(40);}
  async function pick(label,value){const n=await el('select',n=>n.getAttribute('aria-label')===label);n.value=value;n.dispatchEvent(new w.Event('change',{bubbles:true}));}
  async function filter(){const details=await el('.tw-filters');if(!details.open)details.querySelector('summary').click();}
  function record(id,expected,actual){rows.push({id,status:JSON.stringify(actual)===JSON.stringify(expected)?'PASS':'FAIL',expected,actual});}
  await route(w,base,'demo/student/demo-04');await chooseLang(w,'id');await el('h1',n=>n.textContent.includes('Demo 04'));
  const note=await el('textarea');note.value='Satu langkah, 24 × 4 = 96.';note.dispatchEvent(new w.Event('input',{bubbles:true}));
  if(!baseline)await pick('Jenis','override');
  await chooseLang(w,'en');record('TB-03','Satu langkah, 24 × 4 = 96.',(await el('textarea')).value);
  if(!baseline){
    record('note-type-dirty',['override',true],[(await el('select',n=>n.getAttribute('aria-label')==='Type')).value,d().body.innerText.includes('Unsaved draft.')]);
    await chooseLang(w,'id');
    const txt=await el('textarea'),marker='Uji catatan '+crypto.randomUUID().slice(0,8);
    txt.value=marker;txt.dispatchEvent(new w.Event('input',{bubbles:true}));
    const save=await el('button',n=>n.textContent==='Simpan catatan');save.click();save.click();
    await el('.tw-note',n=>n.textContent.includes(marker));
    const prev=await el('select',n=>n.getAttribute('aria-label')==='Revisi'),noteId=[...prev.options].find(o=>o.textContent.includes(marker)).value;
    await pick('Revisi',noteId);
    const edit=await el('textarea');edit.value=marker+' revisi';edit.dispatchEvent(new w.Event('input',{bubbles:true}));await chooseLang(w,'en');
    record('revision-draft',[noteId,marker+' revisi'],[(await el('select',n=>n.getAttribute('aria-label')==='Revision')).value,(await el('textarea')).value]);
    await click('button','Save note');await el('.tw-note',n=>n.textContent.includes(marker+' revisi')); 
    record('revision-display',true,[...d().querySelectorAll('.tw-note')].some(n=>n.textContent.includes('Current')&&n.textContent.includes(marker+' revisi'))&&[...d().querySelectorAll('details .tw-note')].some(n=>n.textContent.includes('Superseded')&&n.textContent.includes(marker)));
  }
  await chooseLang(w,'id');(await el('a',n=>n.href.includes('demo/assignments')&&/Buat/.test(n.textContent))).click();
  const recipient=await el('select',n=>n.getAttribute('aria-label')==='Siswa');
  record('TB-02','demo-04',recipient.value);
  if(!baseline){
    await pick('Kelas materi','5');await pick('Level','3');await el('select',n=>n.getAttribute('aria-label')==='Paket'&&n.value.includes('G05-L03'));
    await chooseLang(w,'en');await el('select',n=>n.getAttribute('aria-label')==='Package'&&n.value.includes('G05-L03'));
    record('assignment-draft',['demo-04','5','3'],['Student','Material grade','Level'].map(label=>d().querySelector('select[aria-label="'+label+'"]').value));
    await chooseLang(w,'id');
    const ns=await import(new URL('teacher/demo.js',base));
    const count=(await ns.workspace('demo')).assignments.length;
    const submit=await el('button',n=>n.textContent==='Berikan tugas');submit.click();submit.click();
    await el('.tw-person',n=>n.textContent.includes('Demo 04'));
    const after=await ns.workspace('demo');const assignments=after.assignments.filter(a=>a.profileId==='demo-04'&&a.grade===5&&a.level===3);
    record('recipient-on-disk','demo-04',assignments[0]?.profileId);record('fresh-double-submit',1,after.assignments.length-count);
  }
  await route(w,base,baseline?'reports':'reports?source=demo');await filter();await pick('Sumber data','local_practice');
  await click('button','Terapkan filter');await el('.tw-paper',n=>n.textContent.includes('belum diverifikasi institusi'));
  const before=(await el('select',n=>n.getAttribute('aria-label')==='Pratinjau siswa')).value;
  await filter();await click('button','Atur ulang');await delay(180);
  const after=(await el('select',n=>n.getAttribute('aria-label')==='Pratinjau siswa')).value;
  record('TB-01',{person:before,local:true},{person:after,local:d().querySelector('.tw-paper')?.textContent.includes('belum diverifikasi institusi')});
  if(!baseline){
    await route(w,base,'reports?source=demo');await filter();await pick('Operasi','MUL');
    await chooseLang(w,'en');await filter();
    record('unapplied-filter','MUL',(await el('select',n=>n.getAttribute('aria-label')==='Operation')).value);
    await click('button','Reset');await el('.tw-paper');
    await pick('File format','zip');const all=[...d().querySelectorAll('.tw-subjects input')];
    for(const n of all){n.checked=n.value==='demo-04';n.dispatchEvent(new w.Event('change',{bubbles:true}));}
    await pick('Report language','bilingual');await chooseLang(w,'id');await el('.tw-paper',n=>n.textContent.includes('Parent meeting report'));
    record('batch-format-scope',['zip','bilingual',['demo-04']],[(await el('select',n=>n.getAttribute('aria-label')==='Format berkas')).value,(await el('select',n=>n.getAttribute('aria-label')==='Bahasa laporan')).value,[...d().querySelectorAll('.tw-subjects input:checked')].map(n=>n.value)]);
    const NativeWorker=w.Worker,originalClick=w.HTMLAnchorElement.prototype.click;let jobs=0,captured=0;
    try{
      w.Worker=new Proxy(NativeWorker,{construct(ctor,args){if(String(args[0]).includes('export/work.js'))jobs++;return Reflect.construct(ctor,args);}});
      w.HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){captured++;return;}return originalClick.call(this);};
      const download=await el('button',n=>n.textContent==='Unduh laporan');download.click();download.click();await wait(()=>captured>0,'batch download');
      record('double-batch',[1,1],[jobs,captured]);
    }finally{w.Worker=NativeWorker;w.HTMLAnchorElement.prototype.click=originalClick;}
    await route(w,base,'demo/teacher');const cards=[...d().querySelectorAll('.tw-person')];
    record('roster-follow-up',true,cards.length===6&&cards.every(n=>n.querySelector('p')&&n.querySelector('a').getAttribute('aria-label').includes('Demo '))&&d().body.innerText.includes('Semua kelas'));
  }
  return rows;
}
