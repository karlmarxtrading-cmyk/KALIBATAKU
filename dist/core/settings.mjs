import {element as e,heading,icon,labelled,link,select} from './dom.mjs';
import {audioAvailable} from './audio.mjs';
import {DEFAULT_PREFERENCES} from './preferences.mjs';
// Four groups: Display and Practice controls apply to this browser (all profiles);
// Device data and the Local assessment policy follow the active profile.
async function buildInfo(){
  const out={app_version:null,bank_version:null,release:null};
  try{Object.assign(out,await (await fetch(new URL('../build-info.json',import.meta.url))).json());}catch{}
  try{out.release=(await (await fetch(new URL('../offline-assets.json',import.meta.url),{cache:'no-cache'})).json()).release;}catch{}
  return out;
}
export function settings(ctx){
  const {root,t,prefs,L}=ctx;
  const choice=(key,options,change)=>{const control=select(options,prefs[key],event=>change(event.target.value));control.name=key;return control;};
  const check=(key,label,hint)=>{const input=e('input',{type:'checkbox',name:key,checked:prefs[key],onchange:event=>ctx.savePref({[key]:event.target.checked},true)});return e('div',{class:'check-block'},e('label',{class:'check-field'},input,t(label)),hint?e('p',{class:'field-hint'},hint):null);};
  const scope=(text)=>e('p',{class:'scope-note'},icon(text==='browser'?'globe':'user',16),text==='browser'?L('Berlaku untuk browser ini dan semua profil lokal di dalamnya.','Applies to this browser and every local profile in it.'):L('Mengikuti profil aktif: ','Follows the active profile: ')+(ctx.profileName||L('Profil utama','Main profile'))+'.');
  const display=e('section',{class:'sheet settings-section'},e('h2',{},t('display')),scope('browser'),
    e('div',{class:'field-grid'},labelled(t('lang'),choice('lang',[['id','Bahasa Indonesia'],['en','English']],ctx.setLanguage)),labelled(t('theme'),choice('theme',['system','light','dark'].map(k=>[k,t(k)]),v=>ctx.savePref({theme:v},true))),labelled(t('textSize'),choice('textSize',['regular','large','xlarge'].map(k=>[k,t(k)+(k==='regular'?' · 100%':k==='large'?' · 118%':' · 138%')]),v=>ctx.savePref({textSize:v},true)))),
    e('p',{class:'size-example'},t('sizeExample')),
    e('p',{class:'field-hint'},L('Ukuran teks aplikasi terpisah dari pembesaran browser (Ctrl/⌘ +). Keduanya dapat dipakai bersama.','App text size is separate from browser zoom (Ctrl/⌘ +). Both can be used together.')),
    check('reduceMotion','reduceMotion',L('Mematikan animasi kecil pada kartu hasil dan panel.','Turns off small animations on result cards and panels.')));
  const sound=audioAvailable()?check('sound','sound',L('Nada singkat setelah memeriksa jawaban. Hasil tertulis selalu tampil.','A short tone after checking an answer. Written results always appear.')):e('p',{class:'field-hint'},t('noSound'));
  const controls=e('section',{class:'sheet settings-section'},e('h2',{},t('playerOptions')),scope('browser'),e('div',{class:'stack-rows'},sound,
    check('keypad','keypad',L('Tombol − / , atau . di bawah kotak jawaban, berguna pada keyboard ponsel yang tidak menampilkan simbol itu.','Buttons for − / and the decimal separator below the answer box, useful when a phone keyboard hides those symbols.')),
    check('showTimer','timer',L('Jika dimatikan, angka waktu disembunyikan tetapi tenggat tetap berjalan. Tombol “Sisa waktu” (Alt+T) tetap membacakan sisa waktu, dan pemberitahuan singkat tetap muncul pada 5 menit, 2 menit, 1 menit, 30 detik dan 10 detik terakhir.','When off, the numbers are hidden but the deadline still runs. The “Time left” button (Alt+T) still reads the remaining time, and short notices still appear at 5 minutes, 2 minutes, 1 minute, 30 seconds and 10 seconds left.'))),
    e('p',{class:'tagline'},t('timerInfo')));
  const confirm=e('div',{class:'notice',hidden:true});
  const reset=e('button',{type:'button',class:'btn','data-action':'reset-preferences',onclick:()=>{
    confirm.hidden=false;
    confirm.replaceChildren(e('p',{},L('Pulihkan tujuh preferensi browser ke bawaan: Bahasa Indonesia, tema sistem, teks standar, suara mati, gerakan normal, tombol simbol aktif, waktu tampil. Profil, riwayat, paket offline, cadangan dan hasil tidak berubah.','Restore the seven browser preferences to their defaults: Indonesian, system theme, standard text, sound off, normal motion, symbol buttons on, timer shown. Profiles, history, offline packs, backups and results are not changed.')),
      e('div',{class:'settings-actions'},e('button',{type:'button',class:'btn primary','data-action':'confirm-reset',onclick:async()=>{const lang=DEFAULT_PREFERENCES.lang;ctx.savePref({...DEFAULT_PREFERENCES},true);if(lang!==ctx.lang)await ctx.setLanguage(lang);else ctx.rerender();}},L('Pulihkan preferensi','Restore preferences')),
        e('button',{type:'button',class:'btn',onclick:()=>{confirm.hidden=true;reset.focus();}},L('Batal','Cancel'))));
    confirm.querySelector('[data-action=confirm-reset]').focus();
  }},L('Pulihkan preferensi bawaan…','Restore default preferences…'));
  controls.append(e('div',{class:'settings-actions'},reset),confirm);
  const data=e('section',{class:'sheet settings-section'},e('h2',{},L('Data perangkat','Device data')),scope('profile'),
    e('p',{},L('Riwayat latihan tersimpan di browser ini, bukan di server sekolah. Cadangan berupa satu berkas ZIP yang dapat dipulihkan di perangkat lain.','Practice history is stored in this browser, not on a school server. A backup is one ZIP file you can restore on another device.')),
    e('div',{class:'settings-actions'},link('profiles',[icon('user',16),L('Profil dan cadangan','Profiles and backup')],'btn'),link('offline',[icon('offline',16),L('Paket offline','Offline packs')],'btn'),link('sync',L('Status pengiriman','Delivery status'),'btn')));
  const policy=e('section',{class:'sheet settings-section'},e('h2',{},L('Aturan evaluasi lokal','Local assessment policy')),scope('profile'),
    e('p',{},L('Jarak minimum antara dua form evaluasi untuk status “dikuasai sementara”. Rentang 0–168 jam, bawaan 24 jam. Perubahan berlaku pada siklus evaluasi baru; hasil yang sudah tercatat tidak ditulis ulang.','The minimum time between two assessment forms for “provisionally mastered”. Range 0–168 hours, default 24 hours. Changes apply to new assessment cycles; recorded results are not rewritten.')),
    e('div',{class:'settings-actions'},link('progress',L('Atur di halaman Progres','Set it on the Progress page'),'btn')));
  const versions=e('dl',{},e('dt',{},t('version')),e('dd',{'data-version':'app'},'…'),e('dt',{},L('Versi isi bank soal','Question bank content')),e('dd',{'data-version':'bank'},'…'),e('dt',{},L('Identitas build','Build ID')),e('dd',{'data-version':'release'},'…'));
  const help=e('section',{class:'sheet settings-section',id:'input-help'},e('h2',{},t('help')),
    e('details',{open:ctx.params.get('section')==='help'||ctx.route==='help'},e('summary',{},t('inputHelp')),e('p',{},t('inputHelpText'))),
    e('details',{},e('summary',{},t('writeFraction')),e('p',{},t('fractionHelp'))),
    e('details',{},e('summary',{},L('Bagaimana mendengar sisa waktu?','How do I hear the time left?')),e('p',{},L('Pada tantangan waktu, pilih “Sisa waktu” di atas soal atau tekan Alt+T. Pembaca layar juga mendapat pemberitahuan singkat pada beberapa ambang, bukan setiap detik.','In a timed challenge, choose “Time left” above the question or press Alt+T. Screen readers also get a short notice at a few thresholds, not every second.'))),
    e('details',{},e('summary',{},t('whereSaved')),e('p',{},t('privacyHelp')),link('profiles',t('profile'),'text-link')),
    e('details',{},e('summary',{},t('switchProfile')),e('p',{},t('switchHelp')),link('profiles',t('profile'),'text-link')),
    e('details',{},e('summary',{},t('teacherReceived')),e('p',{},t('deliveryHelp')),link('sync',L('Lihat status pengiriman','View delivery status'),'text-link')),
    e('div',{class:'tagline version-tag'},versions));
  const from=ctx.params.get('from');
  const back=from&&/^session\/[a-zA-Z0-9-]{1,100}$/.test(from)?link(from,[icon('back',16),t('continue')],'crumb'):link('',[icon('back',16),t('home')],'crumb');
  root.replaceChildren(e('div',{class:'settings'},back,heading(t('settings')),display,controls,data,policy,help));
  // UX-001: versions come from the build metadata, never from literals in this file.
  buildInfo().then(info=>{
    if(!root.contains(versions))return;
    versions.querySelector('[data-version=app]').textContent=info.app_version||L('tidak tersedia','unavailable');
    versions.querySelector('[data-version=bank]').textContent=info.bank_version||L('tidak tersedia','unavailable');
    versions.querySelector('[data-version=release]').textContent=info.release||L('tidak tersedia','unavailable');
  });
  if(ctx.params.get('section')==='help')requestAnimationFrame(()=>help.scrollIntoView({block:'nearest'}));
}
