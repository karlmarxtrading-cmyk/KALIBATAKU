import {element as h} from '../core/dom.mjs';
import {resolveActiveScope} from './store.js';
const errors={
  QUOTA_EXCEEDED:['Ruang perangkat penuh. Hapus salinan paket offline, lalu coba lagi.','Device storage is full. Remove an offline pack and retry.'],
  STORAGE_UNAVAILABLE:['Penyimpanan tidak tersedia. Unduh cadangan sebelum menutup tab.','Storage is unavailable. Download a backup before closing this tab.'],
  UPGRADE_BLOCKED:['Tutup tab KALIBATAKU lain, lalu muat ulang untuk memperbarui penyimpanan.','Close other KALIBATAKU tabs, then reload to upgrade storage.'],
  OFFLINE_UNAVAILABLE:['Browser ini tidak mendukung pemasangan offline di alamat ini.','This browser cannot install offline packs at this address.'],
  CHECKSUM_MISMATCH:['Isi berkas berbeda dari checksum. Unduh kembali salinan asli.','The file checksum differs. Download the original file again.'],
  BACKUP_TOO_LARGE:['Berkas melebihi batas aman (JSON lama 50 MiB; arsip ZIP 512 MiB atau 2 juta rekaman).','The file exceeds the safe limit (older JSON 50 MiB; ZIP archive 512 MiB or 2 million records).'],
  ARCHIVE_TOO_LARGE:['Salah satu bagian arsip lebih besar dari yang diizinkan. Berkas tidak dipulihkan.','An archive part is larger than allowed. Nothing was restored.'],
  ARCHIVE_PART_MISSING:['Arsip tidak lengkap: ada bagian yang hilang. Gunakan berkas ZIP asli tanpa diekstrak.','The archive is incomplete: a part is missing. Use the original ZIP without extracting it.'],
  INVALID_BACKUP_JOURNEY:['Data misi tidak cocok dengan soal, paket, atau kebijakan perjalanan. Gunakan salinan cadangan asli.','Mission data disagrees with its questions, package or journey policy. Use the original backup.'],
  UNSUPPORTED_BACKUP_JOURNEY:['Versi perjalanan dalam cadangan ini belum didukung. Simpan berkas asli dan buka dengan versi KALIBATAKU yang sesuai.','This journey version is unsupported. Keep the original file and open it in a compatible KALIBATAKU release.'],
  BACKUP_JOURNEY_SOURCE_DAMAGED:['Salinan materi lokal gagal pemeriksaan checksum. Pasang ulang paket materi, lalu tinjau kembali cadangan.','Local material failed its checksum. Reinstall the material package and preview the backup again.'],
  INVALID_ARCHIVE:['Berkas ZIP ini bukan arsip cadangan KALIBATAKU yang utuh.','This ZIP is not a complete KALIBATAKU backup archive.'],
  ARCHIVE_UNSUPPORTED:['Browser ini tidak dapat membuka arsip terkompresi. Perbarui browser lalu coba lagi.','This browser cannot open compressed archives. Update the browser and retry.'],
  INVALID_PROFILE:['Gunakan nama panggilan sepanjang 1–80 karakter.','Enter a nickname between 1 and 80 characters.'],
  IMPORT_CONFLICT:['ID yang sama memiliki isi berbeda. Data perangkat dipertahankan.','Matching IDs have different content. Device records have been kept.'],
  LOCAL_PROFILE_ONLY:['Pilih profil latihan pribadi untuk menggunakan cadangan.','Select a personal practice profile to use backups.'],
  BRIDGE_NOT_CONFIGURED:['LMS sekolah belum dikonfigurasi.','The school LMS is not configured.'],
  SESSION_COPY:['Salinan sesi adalah arsip untuk dibaca. Pilih berkas cadangan profil atau cadangan pemulihan dari pemain.','A session copy is a read-only record. Choose a profile backup or a recovery backup from the player.'],
  REPORT_FILE:['Ini laporan hasil belajar. Untuk memulihkan profil, pilih cadangan profil KALIBATAKU.','This is a learning report. To restore a profile, choose a KALIBATAKU profile backup.'],
  PROFILE_CHANGED:['Data profil baru saja berubah. Tinjau kembali jumlah sesi sebelum menghapus.','This profile has changed. Review the session count again before deleting.'],
  RECOVERY_STALE:['Sesi berubah di tab lain. Periksa versi terakhir lalu pilih cadangan yang sesuai.','The session changed in another tab. Check its latest version before choosing a backup.'],
  NETWORK:['Unduhan belum lengkap. Periksa koneksi dan coba lagi.','Download incomplete. Check your connection and retry.']
};
export async function renderDataPanel(container,opts={}){
  const {locale='id',page='profiles',packageInfo,signal}=opts;
  const l=(id,en)=>locale==='en'?en:id;
  if(signal?.aborted)return;
  const titles={offline:['Paket offline','Offline packs'],profiles:['Profil dan data','Profiles and data'],privacy:['Privasi perangkat','Device privacy'],sync:['Status sinkronisasi','Sync status']};
  const content=h('div',{class:'stack'},h('header',{class:'page-heading'},h('h1',{},l(...(titles[page]||titles.profiles)))));
  container.replaceChildren(content);
  const status=h('p',{role:'status','aria-live':'polite',class:'hint'});
  const current=()=>!signal?.aborted&&container.contains(content);
  const showError=e=>{
    if(!current())return;
    const code=e?.name==='QuotaExceededError'?'QUOTA_EXCEEDED':e?.code||e?.message;
    const text=errors[code]||((String(code).includes('BACKUP')||String(code).includes('QUESTION')||code==='SyntaxError'||e instanceof SyntaxError)?
      ['Format cadangan tidak valid.','Backup format or contents are invalid.']:errors.NETWORK);
    status.textContent=l(...text);
    status.setAttribute('role','alert');
  };
  const action=(name,handler,primary=false)=>{
    const b=h('button',{type:'button',class:primary?'primary':''},name);
    b.addEventListener('click',async()=>{b.disabled=true;try{await handler();}catch(e){if(e.name!=='AbortError')showError(e);}finally{b.disabled=false;}});
    return b;
  };
  const section=(title,...children)=>h('section',{class:'panel stack'},h('h2',{},title),...children);
  const rerender=()=>current()&&renderDataPanel(container,opts);
  const group=(...buttons)=>h('div',{class:'actions'},...buttons);
  content.append(status);
  const date=v=>v?new Intl.DateTimeFormat(locale==='id'?'id-ID':'en-GB',{dateStyle:'medium'}).format(new Date(v)):'—';
  const size=bytes=>new Intl.NumberFormat(locale==='id'?'id-ID':'en-GB',{maximumFractionDigits:1}).format(bytes>=1048576?bytes/1048576:bytes/1024)+(bytes>=1048576?' MiB':' KiB');
  try{
    const scope=await resolveActiveScope();
    const ui={...opts,scope,locale,l,date,size,current,content,status,action,section,group,rerender,showError};
    const panel=page==='offline'?await import('./panel-offline.js'):page==='sync'?await import('./panel-sync.js'):await import('./panel-profile.js');
    if(current())await panel.render(ui);
  }catch(e){if(e.name!=='AbortError')showError(e);}
}
