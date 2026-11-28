import {element as h,labelled,link} from '../core/dom.mjs';
import {selectLocalProfile,getStatus,listProfiles,createProfile,deleteProfile,profileImpact} from './store.js';
import {exportArchive,exportBackup,previewBackup,importBackup} from './backup.js';

const forms=new Map();
function download(data,name){
  const url=URL.createObjectURL(data instanceof Blob?data:new Blob([JSON.stringify(data)],{type:'application/json'}));
  h('a',{download:name,href:url}).click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export async function render(ui){
  const {l,scope,content,status,current,action,section,group,rerender,showError,date}=ui;
  const unit=(n,id,singular,plural)=>n+' '+l(id,n===1?singular:plural);
  const [storage,profiles]=await Promise.all([getStatus(),listProfiles()]);
  if(!current())return;
  const profile=profiles.find(p=>scope.origin==='local_practice'&&p.id===scope.profileId);
  const name=p=>p?.name||l('Profil utama','Main profile');
  const identity=[scope.origin,scope.environment,scope.profileId].join('|');
  if(!forms.has(identity))forms.set(identity,{nickname:'',file:null});
  const form=forms.get(identity);
  const select=h('select',{},...profiles.map(p=>h('option',{value:p.id},name(p))));
  if(!profile)select.prepend(h('option',{value:''},l('Pilih profil pribadi','Choose personal profile')));
  select.value=profile?.id||'';
  const switcher=action(l('Gunakan profil pilihan','Use selected profile'),async()=>{
    if(!select.value)return;
    await selectLocalProfile(select.value);await rerender();
  },true);
  switcher.dataset.switchProfile='';
  const input=h('input',{type:'text',maxlength:'80',value:form.nickname,autocomplete:'off',name:'new-profile-name'});
  input.oninput=()=>{form.nickname=input.value;};
  const create=action(l('Buat dan gunakan profil','Create and use profile'),async()=>{
    const p=await createProfile(input.value);form.nickname='';
    await selectLocalProfile(p.id);await rerender();
  });
  const heading=profile?name(profile):l('Data simulasi','Demonstration data');
  content.append(section(heading,h('p',{},l('Di perangkat bersama, setiap pengguna browser ini dapat membuka profil dan riwayat lokal.','On a shared device, anyone using this browser can open its local profiles and history.')),
    labelled(l('Pilih profil latihan','Choose a practice profile'),select),group(switcher),
    h('details',{},h('summary',{},l('Tambah profil pada perangkat ini','Add a profile on this device')),
      labelled(l('Nama panggilan','Nickname'),input),group(create))));
  if(storage.temporary)content.append(h('p',{class:'notice'},l('Mode sementara. Unduh cadangan sebelum memuat ulang atau menutup tab ini.','Temporary storage. Download a backup before reloading or closing this tab.')));
  if(!profile)return;
  const file=h('input',{type:'file',accept:'.zip,.json,application/zip,application/json'}),summary=h('div',{'aria-live':'polite',class:'stack'});
  const progress=h('p',{class:'hint',role:'status'});
  const backup=action(l('Unduh cadangan profil','Download profile backup'),async()=>{
    status.textContent='';progress.textContent=l('Menyiapkan cadangan…','Preparing backup…');
    let info=null;try{info=await (await fetch(new URL('../build-info.json',import.meta.url))).json();}catch{}
    const blob=await exportArchive(scope,{signal:ui.signal,app_version:info?.app_version??null,onProgress:p=>{if(p.phase==='pack')progress.textContent=l('Mengemas bagian ','Packing part ')+p.done+l(' dari ',' of ')+p.total+'…';}});
    if(!current())return;
    const day=new Date().toISOString().slice(0,10);
    download(blob,'KALIBATAKU-cadangan-'+scope.profileId+'-'+day+'.zip');
    progress.textContent='';status.textContent=l('Cadangan siap diunduh · ','Backup ready to download · ')+ui.size(blob.size)+'. '+l('Simpan berkas ZIP ini utuh; jangan mengekstrak isinya untuk dipulihkan.','Keep this ZIP file intact; restore it without extracting.');
  },true);
  // Format 1 stays available for moving data back to 1.2.0 or older (rollback).
  const legacy=action(l('Unduh cadangan format lama (JSON)','Download older-format backup (JSON)'),async()=>{
    let data;
    try{data=await exportBackup(scope);}
    catch(error){
      if(error.code!=='BACKUP_TOO_LARGE')throw error;
      if(current()){
        status.textContent=l('Profil melebihi batas JSON (100.000 rekaman atau 50 MiB). Gunakan tombol Unduh cadangan profil untuk format ZIP.',
          'This profile exceeds the JSON limit (100,000 records or 50 MiB). Use Download profile backup for a ZIP archive.');
        backup.focus();
      }
      return;
    }
    if(!current())return;
    download(data,'KALIBATAKU-profile-backup-'+scope.profileId+'.json');
    status.textContent=l('Cadangan format lama siap diunduh. Gunakan hanya untuk versi 1.2.0 atau lebih lama.','Older-format backup ready to download. Use it only for version 1.2.0 or older.');
  });
  legacy.dataset.legacyBackup='';
  async function display(f){
    summary.replaceChildren();form.file=f;
    if(!f)return;
    try{
      status.textContent=l('Memeriksa isi, checksum dan riwayat cadangan… Data perangkat belum diubah.','Checking backup contents, checksums and event history… Device data is unchanged.');
      const p=await previewBackup(f,{signal:ui.signal});
      if(!current()||form.file!==f)return;
      status.textContent=l('Cadangan dapat ditinjau.','Backup ready to review.');
      const target=p.profile||l('Profil utama','Main profile');
      const prefix=l('Pulihkan ke profil ','Restore to profile ');
      const open=action(l('Buka profil hasil pemulihan','Open restored profile'),async()=>{await selectLocalProfile(p.profile_id);await rerender();},true);
      const confirmation=action(prefix+target,async()=>{
        status.textContent=l('Memulihkan… Semua rekaman ditulis bersamaan; bila gagal, tidak ada yang berubah.','Restoring… All records are written together; if it fails, nothing changes.');
        const result=await importBackup(f,{signal:ui.signal});status.textContent='';
        form.file=null;summary.replaceChildren(h('p',{role:'status'},l('Pemulihan selesai untuk ','Restore completed for ')+target+'. '+unit(result.additions,'rekaman dipulihkan.','record restored.','records restored.')),open);
        open.focus({preventScroll:true});
      },true);
      summary.append(h('h3',{},prefix+target),h('p',{},l('Profil aktif saat ini: ','Current profile: ')+name(profile)+'. '+(p.profile_id===profile.id?
        l('Rekaman baru ditambahkan ke profil ini.','New records will be added to this profile.'):
        l('Tujuan adalah profil asal berkas. Riwayat profil aktif tetap terpisah.','The destination is the original file owner. Your current profile keeps its own history.'))),
        h('p',{},unit(p.sessions,'sesi','session','sessions')+' · '+(p.sessions?date(p.first_date)+' – '+date(p.last_date):l('belum ada sesi','no sessions yet'))),
        h('p',{},unit(p.additions,'rekaman baru','new record','new records')+' · '+p.duplicates+l(' identik',' identical')+' · '+unit(p.conflicts.length,'konflik','conflict','conflicts')),
        h('p',{class:'hint'},(p.archive?l('Arsip cadangan','Backup archive')+' v'+p.archive.version+' · '+unit(p.archive.parts,'bagian','part','parts'):l('Cadangan profil (format 1)','Profile backup (format 1)'))+' · '+date(p.exported_at)));
      const checks=p.journey_checks;
      if(checks && (checks.bank_matched || checks.occurrences_matched || checks.internal_only)){
        summary.append(h('p',{class:'hint'},
          l('Misi yang dicocokkan dengan soal bank lokal: ','Missions checked against local bank questions: ')+checks.bank_matched+
          l('. Dicocokkan dengan indeks penempatan saja: ','. Checked against the occurrence index only: ')+checks.occurrences_matched+
          l('. Hanya konsistensi internal: ','. Internally consistent only: ')+checks.internal_only+'. '+
          l('Riwayat yang dipulihkan digunakan untuk latihan pribadi.','Restored history counts toward personal practice.')));
      }
      if(p.recovery_draft)summary.append(h('p',{},l('Termasuk satu draf jawaban untuk dilanjutkan.','Includes one answer draft to resume.')));
      if(p.conflicts.length)summary.append(h('p',{class:'notice'},l('Pemulihan diblokir karena isi berkas dan perangkat berbeda. Simpan cadangan perangkat dan periksa berkas sumber.','Restore is blocked because the file and device disagree. Back up this device and check the source file.')));
      else summary.append(p.additions?confirmation:open);
    }catch(error){if(current()&&form.file===f){form.file=null;showError(error);}}
  }
  file.onchange=()=>display(file.files?.[0]||null);
  content.append(section(l('Cadangan dan pemulihan','Backup and restore'),
    h('p',{},l('Cadangan profil memuat sesi, jawaban, dan riwayatnya dalam satu berkas ZIP terkompresi dengan checksum per bagian. Simpan berkas ini di tempat pribadi.','A profile backup holds sessions, answers and their history in one compressed ZIP with a checksum for each part. Keep this file in a private place.')),group(backup),progress,
    labelled(l('Pilih cadangan untuk ditinjau (.zip atau .json lama)','Choose a backup to preview (.zip, or an older .json)'),file),summary,
    h('details',{},h('summary',{},l('Pindah ke versi aplikasi yang lebih lama','Moving to an older app version')),
      h('p',{},l('Arsip ZIP dibaca oleh versi 1.3.0 ke atas. Untuk versi 1.2.0 atau lebih lama, unduh cadangan JSON format lama; batasnya 50 MiB atau 100.000 rekaman.','ZIP archives are read by version 1.3.0 and later. For version 1.2.0 or older, download the older JSON backup; its limit is 50 MiB or 100,000 records.')),group(legacy)),
    h('details',{},h('summary',{},l('Berkas apa yang bisa dipulihkan?','Which files can I restore?')),
      h('p',{},l('Gunakan arsip cadangan ZIP, cadangan profil JSON dari versi sebelumnya (hingga 50 MiB), atau cadangan pemulihan dari pemain. Salinan sesi mentah dan JSON laporan berfungsi sebagai arsip untuk dibaca.','Choose a ZIP backup archive, a profile JSON backup from an earlier version (up to 50 MiB), or a player recovery backup. Raw session copies and report JSON are read-only records.')))));
  if(form.file)await display(form.file);
  if(!current())return;
  const confirm=h('div',{class:'stack'});confirm.hidden=true;
  const review=action(l('Tinjau penghapusan','Review deletion'),async()=>{
    const impact=await profileImpact(profile.id);if(!current())return;
    confirm.hidden=false;
    const cancel=action(l('Batal','Cancel'),()=>{confirm.hidden=true;review.focus();});
    confirm.replaceChildren(h('p',{},name(profile)+' · '+unit(impact.sessions,'sesi','session','sessions')+' · '+unit(impact.events,'kejadian tercatat','recorded event','recorded events')+' · '+unit(impact.records,'catatan lain.','other record.','other records.')),
      h('p',{},l('Penghapusan permanen. Unduh cadangan terlebih dahulu jika riwayat ini masih diperlukan.','Deletion is permanent. Download a backup above if you will need this history.')),
      group(cancel,action(l('Hapus data ','Delete data for ')+name(profile),async()=>{
        await deleteProfile(profile.id,impact);forms.delete(identity);await rerender();
      })));
    cancel.focus();
  });
  content.append(section(l('Hapus data profil','Delete profile data'),review,confirm),
    link('history',l('Lihat riwayat profil','View profile history'),'text-link'));
}
