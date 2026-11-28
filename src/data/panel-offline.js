import {element as h,link,routeTo} from '../core/dom.mjs';
import {offlineManifest,downloadPlan,installPackage,removeInstalled,registerOffline} from './offline.js';
import {packageInventory,verifyStored,verifyPackage,packageStateLabel,packageTarget,watchInstalls} from './offline-verification.mjs';

const pageSize=8;
export async function render(ui){
  const {l,locale,content,status,current,action,section,group,rerender,packageInfo:info,signal,size}=ui;
  const label=state=>packageStateLabel(state,l);
  const title=r=>typeof r.title==='object'?r.title?.[locale]||r.id:r.title||r.id;
  const message=state=>h('p',{'data-package-state':state},label(state));
  const manage=(id,caption)=>link(routeTo('offline',packageTarget(id)),caption,'btn');
  const open=id=>link(routeTo('session/new',packageTarget(id)),l('Buka latihan','Open practice'),'btn primary');
  const checking=message('checking');
  checking.setAttribute('role','status');content.append(checking);
  let mutating=false;
  watchInstalls(signal,()=>{if(current()&&!mutating)rerender();});
  const manifest=await offlineManifest(signal).catch(()=>null);
  const inventory=await packageInventory(signal,manifest),records=inventory.records;
  if(!current())return;
  if(info){
    const result=await verifyPackage(inventory,info.id,info.version),state=result.state;
    if(!current())return;
    if(state==='ready')content.append(section(title(info),message(state),h('p',{},l('Siap untuk latihan offline.','Ready for offline practice.')),open(info.id)));
    else{
      const estimate=manifest?await downloadPlan(info,manifest).catch(()=>null):null;
      if(!current())return;
      const desc=estimate?.bytes!=null?l('Perkiraan unduhan tersisa, termasuk aplikasi dan dependensi: ','Estimated remaining download including the app and dependencies: ')+size(estimate.bytes)+'.':
        l('Ukuran unduhan lengkap belum tersedia. Sambungkan internet untuk memeriksa aset.','Total download size is unavailable. Connect to check the required assets.');
      const progress=h('progress',{'aria-label':l('Kemajuan persiapan paket','Pack preparation progress'),max:'100',value:'0'}),reading=h('p',{'aria-live':'off'});
      let controller;
      const cancel=action(l('Batalkan unduhan','Cancel download'),()=>controller?.abort());
      progress.hidden=true;cancel.hidden=true;
      const caption=state==='repair'?l('Perbaiki salinan offline','Repair offline copy'):state==='update'?l('Perbarui salinan offline','Update offline copy'):l('Siapkan untuk offline','Prepare for offline');
      const save=action(caption,async()=>{
        mutating=true;controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
        cancel.hidden=false;progress.hidden=false;status.textContent=l('Sedang menyiapkan paket…','Preparing the pack…');
        try{
          await installPackage(info,{signal:controller.signal,onProgress:p=>{
            progress.value=p.total?p.done*100/p.total:0;
            reading.textContent=p.done+' / '+p.total+l(' berkas · ',' files · ')+size(p.bytes)+(p.totalBytes!=null?' / '+size(p.totalBytes):'');
          }});
          await rerender();
        }catch(error){
          if(error.name==='AbortError')status.textContent=l('Unduhan dibatalkan. Pilih siapkan untuk mencoba lagi.','Download cancelled. Choose prepare to try again.');
          else throw error;
        }finally{mutating=false;cancel.hidden=true;progress.hidden=true;signal?.removeEventListener('abort',abort);}
      },true);
      content.append(section(title(info),message(state),h('p',{},desc),h('small',{},l('Ukuran isi sebelum kompresi jaringan.','Content size before network compression.')),progress,reading,group(save,cancel)));
    }
  }
  checking.remove();
  const cards=h('div',{class:'stack'}),nav=h('nav',{class:'actions','aria-label':l('Halaman paket','Pack pages')});
  let page=0;
  function renderPage(){
    const shown=records.slice(page*pageSize,(page+1)*pageSize);
    cards.replaceChildren(...shown.map(r=>{
      const card=h('article',{class:'stack','data-package-id':r.id},h('h3',{},title(r)),message('checking'));
      verifyStored(inventory,r).then(({state})=>{
        if(!current()||!cards.contains(card))return;
        const remove=action(l('Hapus salinan offline','Remove offline copy'),async()=>{
          mutating=true;try{await removeInstalled(r.id,r.version);await rerender();}finally{mutating=false;}
        });
        card.replaceChildren(h('h3',{},title(r)),message(state),h('small',{},size(r.bytes)+' · v'+r.version),group(state==='ready'?open(r.id):manage(r.id,state==='update'?l('Perbarui salinan offline','Update offline copy'):l('Perbaiki salinan offline','Repair offline copy')),remove));
      }).catch(()=>{});
      return card;
    }));
    nav.replaceChildren();
    if(page>0)nav.append(action(l('Sebelumnya','Previous'),()=>{page--;renderPage();}));
    if((page+1)*pageSize<records.length)nav.append(action(l('Berikutnya','Next'),()=>{page++;renderPage();}));
  }
  content.append(section(l('Paket di perangkat ini','Packs on this device'),
    !records.length&&h('p',{},l('Belum ada paket tersimpan. Pilih materi lalu siapkan paket saat terhubung.','No saved packs yet. Choose a topic, then prepare a pack while connected.')),
    cards,nav,link('packs',l('Pilih paket latihan','Choose a practice pack'),'btn'),
    h('p',{class:'hint'},l('Menghapus salinan offline hanya menghapus berkas paket. Riwayat jawaban tetap berada di profil.','Removing an offline copy deletes the pack files. Answer history stays in its profile.'))));
  renderPage();
  content.append(section(l('Yang tersedia tanpa internet','What works offline'),
    h('p',{},l('Latihan, tinjauan jawaban, dan riwayat lokal dapat dibuka setelah satu paket siap.','Once a pack is ready, you can practise, review answers and read local history offline.')),
    h('p',{},l('Mengunduh materi baru, membuka ruang guru, dan membuat laporan atau ekspor memerlukan koneksi.','Downloading new topics, opening the teacher workspace, and preparing reports or exports require a connection.'))));
  const reg=await registerOffline().catch(()=>null);
  if(current()&&reg?.waiting)content.append(h('p',{class:'notice'},l('Pembaruan siap. Selesaikan latihan, lalu tutup semua tab KALIBATAKU untuk mengaktifkannya.','An update is ready. Finish your practice, then close all KALIBATAKU tabs to activate it.')));
}
