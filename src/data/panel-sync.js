import {compareInstants} from './time.js';
import {element as h,link} from '../core/dom.mjs';
import {queryAttemptSummaries} from './store.js';
import {deliverySummary,listOutbox,syncPending,enableForegroundSync} from './sync.js';

const labels={pending_sync:['Menunggu pengiriman','Queued'],sending:['Sedang dikirim','Sending'],mock_accepted:['Diterima simulator','Accepted by simulator'],
  server_accepted:['Diterima server','Received by server'],auth_required:['Perlu masuk kembali','Sign-in required'],conflict:['Konflik data','Conflicting data'],
  rejected:['Ditolak','Rejected'],retry_required:['Menunggu percobaan ulang','Waiting to retry'],saved_local:['Tersimpan di perangkat','Saved on device']};
function followup(group,l,date){
  const states=group.states;
  if(states.auth_required)return l('Masuk kembali melalui layanan sekolah dengan identitas yang sama.','Sign in to the school service with the same identity.');
  if(group.forbidden)return l('Akses ditolak. Hubungi pengelola sekolah untuk memeriksa izin.','Access denied. Ask the school administrator to check your permissions.');
  if(states.conflict)return l('Pertahankan salinan lokal. Minta pengelola memeriksa hasil yang berbeda.','Keep the local copy. Ask the administrator to compare the conflicting results.');
  if(states.rejected)return l('Pertahankan hasil asli. Pengelola dapat memeriksa alasan penolakan di rincian teknis.','Keep the original result. An administrator can check the rejection reason in the technical details.');
  if(states.retry_required)return l('Periksa koneksi. Waktu percobaan berikutnya: ','Check your connection. Next retry: ')+(group.next_at?date(group.next_at):'—');
  if(states.pending_sync||states.sending)return l('Biarkan aplikasi terbuka saat tersambung.','Keep the app open while connected.');
  return l('Pengiriman selesai. Penilaian resmi memerlukan verifikasi sekolah.','Delivery complete. Official grading requires school verification.');
}
export async function render(ui){
  const {scope,content,l,locale,section,action,group,current,rerender}=ui;
  const time=value=>new Intl.DateTimeFormat(locale==='id'?'id-ID':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  enableForegroundSync();
  const queue=await listOutbox(scope),sessions=deliverySummary(queue);
  const local=scope.origin==='local_practice',demo=scope.origin==='demo';
  const personal=l('Latihan pribadi','Personal practice');
  const name=ui.profileName||l('Profil aktif','Active profile');
  if(!current())return;
  const totals=await queryAttemptSummaries(scope,{limit:0});
  if(!current())return;
  const waiting=[...sessions.values()].filter(a=>a.accepted<a.total).length;
  const accepted=[...sessions.values()].filter(a=>a.accepted===a.total).length;
  const last=[...sessions.values()].map(r=>r.last_ack).filter(Boolean).sort(compareInstants).at(-1);
  content.append(section((local?personal:demo?l('Data simulasi','Demonstration data'):l('Identitas sekolah','School identity'))+' · '+name,
    h('p',{},totals.total+l(' sesi tersimpan pada profil ini.',totals.total===1?' session saved in this profile.':' sessions saved in this profile.')),
    local?h('p',{},l('Hasil pribadi tersimpan di browser ini. Tidak ada pengiriman ke sekolah.','Personal results stay in this browser. There is no school delivery.')):
      h('p',{},waiting+l(' sesi belum terkirim lengkap · ',waiting===1?' session awaiting complete delivery · ':' sessions awaiting complete delivery · ')+accepted+(demo?l(' diterima simulator.',' accepted by simulator.'):l(' diterima server.',' received by server.'))),
    last&&h('p',{},l('Penerimaan terakhir: ','Last receipt: ')+time(last)),
    h('p',{class:'hint'},l('Penilaian resmi: belum diverifikasi. Layanan LMS sekolah belum terhubung.','Official grading: unverified. A school LMS has not been connected.')),
    demo&&waiting>0&&action(l('Coba kirim ke simulator','Try sending to simulator'),async()=>{await syncPending(scope);await rerender();},true),
    local&&link('history',l('Buka riwayat profil','Open profile history'),'btn')));
  if(!sessions.size||local)return;
  const area=h('div',{class:'stack'});content.append(section(l('Pengiriman per sesi','Delivery by session'),area));
  let token=0;
  async function page(offset){
    const request=++token;
    const {rows,total}=await queryAttemptSummaries(scope,{offset,limit:10});
    if(!current()||request!==token)return;
    const cards=rows.map(row=>{
      const session=sessions.get(row.attempt_id);
      const title=(row.package_title?.[locale]||row.operation)+' · '+time(row.started_at);
      if(!session)return h('article',{},h('h3',{},title),h('p',{},l('Tersimpan di perangkat.','Saved on this device.')));
      const items=queue.filter(r=>r.attempt_id===row.attempt_id&&r.error_code);
      const codes=[...new Set(items.map(r=>r.error_code).filter(Boolean))];
      return h('article',{class:'stack'},h('h3',{},title),
        h('p',{},Object.entries(session.states).map(([k,v])=>l(...(labels[k]||labels.rejected))+' '+v).join(' · ')),
        h('p',{},followup(session,l,time)),
        codes.length>0&&h('details',{},h('summary',{},l('Rincian teknis','Technical details')),
          h('p',{},l('Sesi ','Session ')+row.attempt_id+' · '+codes.filter(x=>/^[A-Z0-9_:-]{1,80}$/.test(x)).join(', '))));
    });
    area.replaceChildren(...cards,group(offset>0&&action(l('Sebelumnya','Previous'),()=>page(offset-10)),
      h('span',{},Math.min(offset+1,total)+'–'+Math.min(offset+10,total)+' / '+total),
      offset+10<total&&action(l('Berikutnya','Next'),()=>page(offset+10))));
  }
  await page(0);
}
