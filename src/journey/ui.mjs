// Student adventure screens: home, map, start point, mission launch, mission result.
import {element as e,icon,link,routeTo} from '../core/dom.mjs';
import {queryAttemptSummaries,getStatus} from '../data/store.js';
import {overview,createMission,chooseStart,loadRoute,prepareOffline,originAvailable} from './journey.mjs';
import {missionOutcome,kindFor,stageWindow,exposure} from './model.mjs';

const OPS={ADD:['Penjumlahan','Addition'],SUB:['Pengurangan','Subtraction'],MUL:['Perkalian','Multiplication'],DIV:['Pembagian','Division'],MIX:['Operasi campuran','Mixed operations']};
const tr=(f,lang)=>f?.[lang]??f?.id??'';
export const STATUS={
  locked:{icon:'lock',id:'Belum terbuka',en:'Not open yet'},
  open:{icon:'play',id:'Siap dimainkan',en:'Ready to play'},
  playing:{icon:'clock',id:'Sedang dimainkan',en:'In progress'},
  done:{icon:'check',id:'Selesai · siap lanjut',en:'Done · ready to move on'},
  reinforce:{icon:'leaf',id:'Perlu penguatan',en:'Needs reinforcement'},
  offline:{icon:'offline',id:'Belum diunduh',en:'Not downloaded'},
  repair:{icon:'offline',id:'Unduhan perlu dilengkapi',en:'Download needs repair'}
};
export const ACTION_TEXT={
  continue:['Lanjutkan misi yang sedang berjalan. Soal dan urutannya tetap sama.','Continue your mission in progress. The questions and their order stay the same.'],
  choose_start:['Mulai dari dasar, atau pilih titik mulai yang terasa pas.','Start from the basics, or choose a starting point that feels right.'],
  start:['Misi dari tahap pilihanmu.','A mission from the stage you chose.'],
  variation:['Misi berikut memakai soal baru pada keterampilan yang sama.','The next mission uses new questions on the same skill.'],
  reinforce:['Misi penguatan: soal lebih bertahap pada keterampilan yang sama.','Reinforcement mission: more gradual questions on the same skill.'],
  checkpoint:['Semua keterampilan di tahap ini siap. Coba tantangan penutup.','Every skill in this stage is ready. Try the closing challenge.'],
  advance:['Keterampilan sebelumnya siap. Lanjut ke keterampilan berikutnya.','The previous skill is ready. Move on to the next skill.'],
  review:['Semua yang terbuka sudah siap. Ulangi keterampilan yang paling lama tidak dilatih.','Everything open is ready. Review the skill practised longest ago.']
};
function readinessText(s,L){
  const passing=Math.min(s.passing.size,2),coverage=Math.min(s.coverage,s.coverage_needed);
  const strategies=Math.min(s.strategies_seen,s.strategies_needed);
  return L('Misi target mandiri '+passing+'/2 · soal unik dilihat '+coverage+'/'+s.coverage_needed+' · strategi dicoba '+strategies+'/'+s.strategies_needed,
    'Independent target missions '+passing+'/2 · unique questions viewed '+coverage+'/'+s.coverage_needed+' · strategies tried '+strategies+'/'+s.strategies_needed);
}
function nextReason(next,L){
  if(next.reason==='spaced_review')return L('Sudah sepekan sejak latihan terakhir di pos ini. Ingat kembali caranya dalam satu misi.','It has been a week since your last visit to this stop. Recall the method in one review mission.');
  if(next.reason==='practice_missing_strategy')return L('Coba cara hitung yang belum kamu latih. Misi berikut memuat soal untuk strategi itu.','Try a strategy you have yet to practise. The next mission includes a question that uses it.');
  if(next.reason==='expand_unique_coverage')return L('Coba soal berbeda pada keterampilan ini untuk melengkapi latihanmu.','Try different questions on this skill to complete your practice.');
  if(next.reason==='complete_passing_missions')return L('Latih lagi soal target. Jawab sedikitnya 80% benar pada percobaan pertama tanpa bantuan.','Practise the target questions again. Answer at least 80% correctly on your first try without help.');
  return L(...(ACTION_TEXT[next.action]||ACTION_TEXT.variation));
}
const KIND={intro:['Pengenalan · 6 soal','Introduction · 6 questions'],regular:['Misi · 8 soal','Mission · 8 questions'],reinforcement:['Penguatan · 8 soal','Reinforcement · 8 questions'],checkpoint:['Tantangan penutup · 10 soal','Closing challenge · 10 questions'],review:['Ulangan · 8 soal','Review · 8 questions']};
export function skillName(node,L){return L(...OPS[node.operation])+' · '+L(node.skill.id.split(' · ').slice(1).join(' · '),node.skill.en.split(' · ').slice(1).join(' · '));}
export function stageName(route,node,L){
  const st=route.stageById.get(node.stage_id);
  return L('Tahap '+(st.order+1)+' · Kelas '+st.grade+' · Level '+st.level,'Stage '+(st.order+1)+' · Grade '+st.grade+' · Level '+st.level);
}
function missionHref(next){return routeTo('mission',{node:next.node_id,kind:next.kind});}
function offlineDetail(cap,L){
  if(cap?.reason==='needs_teaching_material')return L('Paket tersimpan belum menyediakan materi untuk misi ini.','The saved packs do not cover this mission.');
  if(cap?.state==='repair')return L('Sebagian berkas misi hilang atau perlu diperbarui.','Some mission files are missing or need an update.');
  return L('Misi ini belum disimpan di perangkat.','This mission has not been saved on this device.');
}
export function statusChip(key,L){const st=STATUS[key];return e('span',{class:'node-status is-'+key},icon(st.icon,16),e('span',{},L(st.id,st.en)));}

export async function home(ctx){
  const {root,L,scope,lang}=ctx;
  const [{route,state,next,attempts},open,storage]=await Promise.all([overview(scope,ctx.signal),queryAttemptSummaries(scope,{status:'ongoing',limit:1}),getStatus()]);
  if(ctx.signal.aborted)return;
  const ongoing=open.rows[0];
  let title,meta,reason,href,cta,secondary=null,label;
  const legacy=ongoing&&!state.ongoing;
  if(ongoing){
    const n=ongoing.target_competency_id&&route.byId.get(ongoing.target_competency_id);
    label=L('Misi berlangsung','Mission in progress');
    title=n?skillName(n,L):tr(ongoing.package_title,lang);
    meta=L('Soal '+(ongoing.index+1)+' dari '+ongoing.item_count,'Question '+(ongoing.index+1)+' of '+ongoing.item_count)+(n?' · '+stageName(route,n,L):'');
    reason=legacy?L('Sesi latihan yang belum selesai. Lanjutkan dengan aturan saat sesi dibuat.','An unfinished practice session. It continues with the rules it was created with.'):L(...ACTION_TEXT.continue);
    if(state.startPending&&state.start?.intent_id!==state.ongoing?.journey.start_intent_id){
      const chosen=route.stageById.get(state.start.stage_id);
      reason+=' '+L('Setelah sesi ini selesai, kamu akan mulai dari Kelas '+chosen.grade+' · Level '+chosen.level+'.','After this session, you will start from Grade '+chosen.grade+' · Level '+chosen.level+'.');
    }
    href='session/'+encodeURIComponent(ongoing.attempt_id);cta=L('Lanjutkan petualangan','Continue the adventure');
  }else if(next.action==='choose_start'){
    const first=route.byId.get(route.order.find(id=>state.nodes.get(id)?.unlocked));
    label=L('Petualangan baru','New adventure');title=skillName(first,L);
    meta=stageName(route,first,L)+' · '+L(...KIND.intro);reason=L('Kenali cara hitungnya, lalu coba satu per satu.','Explore the method, then try one question at a time.');
    href=routeTo('mission',{node:first.competency_id,kind:'intro'});cta=L('Mulai dari dasar','Start from the basics');
    secondary=link('start-point',[icon('layers',17),L('Pilih titik mulai','Choose a starting point')],'btn');
  }else{
    const n=route.byId.get(next.node_id);
    label=L('Misi berikutnya','Next mission');title=skillName(n,L);
    meta=stageName(route,n,L)+' · '+L(...KIND[next.kind]);reason=nextReason(next,L);
    href=missionHref(next);cta=L('Lanjutkan petualangan','Continue the adventure');
  }
  const needsOfflineStatus=!ongoing&&!await originAvailable(ctx.signal);
  if(needsOfflineStatus){
    const node=route.byId.get(next.node_id||route.order[0]),progress=state.nodes.get(node.competency_id);
    const {missionInventory,missionCapability}=await import('./offline.mjs');
    const cap=await missionCapability(await missionInventory(ctx.signal),{node,kind:next.kind||'intro',
      policy:route.mission_policy,progress,seen:exposure(attempts,node.competency_id)});
    if(ctx.signal.aborted)return;
    if(cap.state!=='ready'){
      reason=offlineDetail(cap,L)+' '+L('Sambungkan internet untuk menyiapkannya.','Connect to prepare the download.');
      href=routeTo('map',{offline:node.competency_id});cta=L('Periksa unduhan misi','Check mission download');
    }
  }
  const ready=[...state.nodes.values()].filter(s=>s.ready).length;
  const lesson=e('section',{class:'lesson-strip adventure-strip','aria-labelledby':'next-mission-title'},
    e('div',{class:'lesson-intro'},e('span',{class:'lesson-label'},icon(ongoing?'clock':'play',18),label),
      e('h2',{id:'next-mission-title'},title),e('p',{class:'lesson-meta'},meta),e('p',{class:'lesson-reason'},reason),
      e('div',{class:'lesson-actions'},link(href,[cta,icon('arrow',19)],'btn primary',{dataset:{cta:'adventure'}}),secondary)),
    e('div',{class:'expedition-land','aria-hidden':'true'},e('i'),e('i'),e('i'),e('b')));
  const current=state.ongoing?.journey.node_id||next.node_id||route.order[0];
  const active=route.order.filter(id=>state.nodes.has(id)),at=active.indexOf(current);
  const nearby=active.slice(Math.max(0,Math.min(at-1,active.length-3)),Math.max(0,Math.min(at-1,active.length-3))+3);
  const trail=e('section',{class:'field-notes','aria-labelledby':'trail-heading'},
    e('div',{class:'section-head'},e('h2',{id:'trail-heading'},L('Jejak terdekat','Nearby stops')),link('map',[L('Buka peta','Open the map'),icon('arrow',16)],'text-link')),
    e('ol',{class:'nearby-stops'},nearby.map(id=>{
      const pos=state.nodes.get(id),here=id===current;
      return e('li',{'aria-current':here?'step':null},icon(here?'play':pos.ready?'check':pos.unlocked?'layers':'lock',18),
        e('div',{},e('strong',{},skillName(pos.node,L)),e('small',{},here?L('Kamu di sini','You are here'):L(STATUS[pos.status].id,STATUS[pos.status].en))));
    })));
  const stats=e('dl',{class:'journey-stats'},
    e('div',{},e('dt',{},L('Misi selesai','Missions done')),e('dd',{},String(state.journeyAttempts))),
    e('div',{},e('dt',{},L('Keterampilan siap lanjut','Skills ready to move on')),e('dd',{},ready+' / '+state.nodes.size)),
    e('div',{},e('dt',{},L('XP latihan','Practice XP')),e('dd',{},String(state.xp)),e('small',{},L('Penanda usaha, bukan nilai.','A marker of effort, not a grade.'))));
  root.replaceChildren(
    e('div',{class:'home-head'},e('h1',{},L('Petualangan','Adventure')),e('span',{class:'device-info'},icon('user',16),ctx.profileName)),
    e('div',{class:'expedition-grid'},lesson,trail),
    e('details',{class:'trail-record'},e('summary',{},L('Catatan perjalanan','Travel journal')),stats),
    e('section',{class:'home-section quiet-links'},e('h2',{},L('Lainnya','More')),
      e('ul',{class:'plain-links'},
        e('li',{},link('history',[icon('clock',17),L('Riwayat latihan','Practice history')])),
        e('li',{},link('curriculum',[icon('book',17),L('Latihan bebas · semua paket','Free practice · all packs')])),
        e('li',{},link('start-point',[icon('layers',17),L('Ubah titik mulai','Change the starting point')])))),
    e('p',{class:'privacy-line'},icon('user',16),ctx.t(storage.temporary?'storageTemp':'homePrivacy')));
  observeConnection(ctx,needsOfflineStatus);
}

function observeConnection(ctx,needsOfflineStatus=true){
  if(needsOfflineStatus)import('../data/offline-events.js').then(({watchInstalls})=>watchInstalls(ctx.signal,()=>{
    // The current map installer verifies the completed mission itself. Avoid
    // navigating away between installing the main teaching pack and its spare.
    if(!ctx.root.querySelector('.offline-mission button:disabled:not([hidden])'))ctx.rerender();
  })).catch(()=>{});
  for(const event of ['online','offline'])globalThis.addEventListener?.(event,ctx.rerender,{signal:ctx.signal});
}

export async function map(ctx){
  const {root,L,scope,params}=ctx;
  const [{route,state,next,attempts},{missionInventory,missionCapability}]=await Promise.all([overview(scope,ctx.signal),import('./offline.mjs')]);
  const [inventory,connected]=await Promise.all([missionInventory(ctx.signal),originAvailable(ctx.signal)]);
  if(ctx.signal.aborted)return;
  const offline=!connected;
  const activeNode=route.byId.get(next.node_id||route.order[0]);
  const all=params.get('all')==='1';
  const stages=all?route.stages:stageWindow(route,activeNode.stage_id,1);
  const request=route.byId.get(params.get('offline'));
  const storageNode=request&&state.nodes.get(request.competency_id)?.unlocked?request:activeNode;
  const capabilities=new Map();
  const visible=new Set([storageNode.competency_id,...(offline?stages.flatMap(st=>st.nodes):[])]);
  for(const id of visible){
    const progress=state.nodes.get(id);
    if(!progress?.unlocked)continue;
    const node=route.byId.get(id),kind=(next.node_id===id&&next.kind)||kindFor(state,id);
    const seen=inventory.forNode(node).length?exposure(attempts,id):new Map();
    const cap=await missionCapability(inventory,{node,kind,policy:route.mission_policy,progress,seen});
    capabilities.set(id,{state:cap.state,reason:cap.reason});
  }
  if(ctx.signal.aborted)return;
  const sections=stages.map(st=>{
    const items=st.nodes.filter(id=>state.nodes.has(id)).map(id=>{
      const n=route.byId.get(id);
      const s=state.nodes.get(id),cap=capabilities.get(id),isNext=next.node_id===id;
      const key=offline&&s.unlocked&&!s.ongoing&&cap?.state!=='ready'?cap?.state||'offline':s.status;
      const kind=kindFor(state,id);
      let detail,action=null;
      if(key==='locked'){
        detail=L('Perlu siap dulu: ','First get ready in: ')+s.unmet.map(p=>skillName(route.byId.get(p),L)+' ('+stageName(route,route.byId.get(p),L)+')').join('; ');
      }else if(key==='offline'||key==='repair'){
        detail=offlineDetail(cap,L)+' '+L('Sambungkan internet untuk menyiapkan unduhan.','Connect to prepare this download.');
        action=link(routeTo('map',{offline:id}),L('Periksa unduhan misi','Check mission download'),'btn');
      }else{
        detail=readinessText(s,L);
        const href=s.ongoing?'session/'+encodeURIComponent(s.ongoing):routeTo('mission',{node:id,kind:isNext&&next.kind?next.kind:kind});
        const text=s.ongoing?L('Lanjutkan','Continue'):key==='done'?L('Ulangi','Review'):s.missions.length?L('Main lagi','Play again'):L('Mainkan','Play');
        action=link(href,[text,e('span',{class:'sr-only'},' · '+skillName(n,L))],'btn'+(isNext?' primary':''),{dataset:{node:id}});
      }
      return e('li',{class:'map-node is-'+key+(isNext?' is-next':''),'aria-current':isNext?'step':null},
        statusChip(key,L),e('h3',{},skillName(n,L)),e('p',{class:'node-detail'},detail),isNext?e('p',{class:'node-next'},L('Misi yang disarankan: ','Suggested mission: ')+nextReason(next,L)):null,action);
    });
    return e('section',{class:'map-stage'+(st.stage_id===activeNode.stage_id?' is-active':''),'aria-labelledby':'stage-'+st.stage_id},
      e('h2',{id:'stage-'+st.stage_id},L('Tahap '+(st.order+1),'Stage '+(st.order+1)),e('small',{},L('Kelas '+st.grade+' · Level '+st.level+' · '+st.focus.id,'Grade '+st.grade+' · Level '+st.level+' · '+st.focus.en))),
      e('ol',{class:'map-path'},items));
  });
  root.replaceChildren(
    e('div',{class:'home-head'},e('h1',{},L('Peta petualangan','Adventure map')),e('span',{class:'device-info'},icon('user',16),ctx.profileName)),
    e('p',{class:'map-intro'},L('Ikuti pos yang disarankan. Pos berikut terbuka saat keterampilan prasyarat siap.','Follow the suggested stop. The next stop opens when its prerequisite skills are ready.')),
    e('details',{class:'map-legend'},e('summary',{},L('Arti status','What the statuses mean')),e('ul',{},Object.keys(STATUS).map(k=>e('li',{},statusChip(k,L))))),
    ...(!connected||request?[offlineBox(ctx,storageNode,capabilities.get(storageNode.competency_id),connected)]:[]),
    ...sections,
    ...(connected&&!request?[offlineBox(ctx,storageNode,capabilities.get(storageNode.competency_id),connected)]:[]),
    e('div',{class:'actions'},all?link('map',L('Tampilkan tahap di sekitar misi aktif','Show stages around the active mission'),'btn'):link('map?all=1',L('Tampilkan semua 60 tahap','Show all 60 stages'),'btn'),link('start-point',L('Ubah titik mulai','Change the starting point'),'text-link')));
  observeConnection(ctx);
  const target=root.querySelector('.map-node.is-next');
  if(target&&!all)requestAnimationFrame(()=>{if(!ctx.signal.aborted&&target.getBoundingClientRect().top>innerHeight)target.scrollIntoView({block:'center'});});
}

function offlineBox(ctx,node,cap,connected){
  const {L}=ctx;
  const ready=cap?.state==='ready';
  const status=e('p',{role:'status',class:'kp-sub'});
  const box=e('section',{class:'panel offline-mission','aria-labelledby':'offline-mission-title'},
    e('h2',{id:'offline-mission-title'},L('Main tanpa internet','Play without internet')),
    e('p',{dataset:{offlineState:cap?.state||'offline'}},ready?L('Misi berikutnya untuk '+skillName(node,L)+' sudah tersimpan di perangkat ini.','The next mission for '+skillName(node,L)+' is saved on this device.'):
      offlineDetail(cap,L)+' '+L('Simpan misi berikutnya ('+skillName(node,L)+') supaya bisa dimainkan, dilanjutkan, dan diselesaikan tanpa internet. Hanya paket misi ini dan cadangannya yang diunduh, bukan seluruh bank soal.','Save the next mission ('+skillName(node,L)+') so it can be played, resumed and finished offline. Only this mission pack and one spare are downloaded, not the whole question bank.')),status);
  if(!ready&&connected){
    const b=e('button',{type:'button'},icon('offline',18),cap?.state==='repair'?L('Lengkapi unduhan misi','Repair mission download'):L('Simpan misi untuk offline','Save the mission for offline'));
    b.onclick=async()=>{
      b.disabled=true;status.textContent=L('Menyimpan…','Saving…');
      try{const r=await prepareOffline(ctx,node.competency_id,{onProgress:p=>{status.textContent=p.done+' / '+p.total;}});status.textContent=L('Tersimpan: ','Saved: ')+r.packages.join(', ');const label=box.querySelector('[data-offline-state]');label.dataset.offlineState='ready';label.textContent=L('Misi berikutnya sudah tersimpan di perangkat ini.','The next mission is saved on this device.');b.hidden=true;}
      catch(err){b.disabled=false;status.textContent=err.code==='STORAGE_UNAVAILABLE'||err.message==='STORAGE_UNAVAILABLE'?L('Mode penyimpanan sementara tidak dapat menyimpan offline.','Temporary storage mode cannot save offline.'):err.code==='QUOTA_EXCEEDED'?L('Ruang perangkat tidak cukup.','Not enough device space.'):L('Belum tersimpan. Coba lagi saat terhubung.','Not saved. Try again while connected.');}
    };
    box.append(b);
  }
  box.append(link('offline',L('Kelola penyimpanan offline','Manage offline storage'),'text-link'));
  return box;
}

export async function startPointPage(ctx){
  const {root,L,scope}=ctx;
  const [route,active]=await Promise.all([loadRoute(ctx.signal),queryAttemptSummaries(scope,{status:'ongoing',limit:1})]);
  if(ctx.signal.aborted)return;
  const grades=[...new Set(route.stages.map(s=>s.grade))];
  let saving=false;
  const pick=async(stage,button)=>{
    if(saving)return;saving=true;button.disabled=true;
    try{
      await chooseStart(scope,stage.stage_id,'learner_choice');
      if(ctx.signal.aborted)return;
      const {next,attempts}=await overview(scope,ctx.signal);
      if(ctx.signal.aborted)return;
      if(attempts.some(a=>a.status==='ongoing')){ctx.go('');return;}
      ctx.go(next.action==='continue'?'session/'+encodeURIComponent(next.attempt_id):next.node_id?missionHref(next):'map');
    }catch(err){if(!ctx.signal.aborted){saving=false;button.disabled=false;ctx.notify(L('Periksa pilihanmu di beranda, atau coba lagi.','Check your selection on the home page or try again.'));}}
  };
  root.replaceChildren(
    e('div',{class:'home-head'},e('h1',{},L('Pilih titik mulai','Choose a starting point'))),
    e('p',{},L('Pilih kelas, lalu materi yang ingin kamu latih. Kamu bisa kembali ke pos sebelumnya lewat peta. Ini pilihan materi, bukan tes kemampuan.','Choose a grade, then the material you want to practise. Revisit earlier stops on the map. This is a choice of material, not a test.')),
    active.rows.length?e('p',{role:'status'},L('Kamu punya sesi yang sedang berjalan. Pilihanmu disimpan untuk misi setelah sesi itu selesai.','You have a session in progress. Your choice will apply to the next mission after that session ends.')):null,
    e('div',{class:'start-grades'},grades.map(g=>e('details',{class:'start-grade',open:g===1||null},
      e('summary',{},L('Kelas '+g,'Grade '+g)),
      e('ul',{class:'start-stages'},route.stages.filter(s=>s.grade===g).map(st=>{
        const b=e('button',{type:'button',class:'start-stage'},e('strong',{},L('Tahap '+(st.order+1)+' · Level '+st.level,'Stage '+(st.order+1)+' · Level '+st.level)),e('span',{},L(st.focus.id,st.focus.en)));
        b.onclick=()=>pick(st,b);return e('li',{},b);
      }))))),
    link('',L('Kembali ke beranda','Back to home'),'text-link'));
}

export async function launch(ctx){
  const {root,L,params}=ctx;
  root.replaceChildren(e('div',{class:'sheet'},e('h1',{},L('Menyiapkan misi…','Preparing the mission…')),e('p',{role:'status'},L('Soal dipilih dan disimpan sebelum misi dimulai.','Questions are chosen and saved before the mission starts.'))));
  try{
    const storage=await getStatus();
    if(storage.temporary&&ctx.confirmTemporary&&!await ctx.confirmTemporary(ctx)){ctx.go('');return;}
    const id=await createMission(ctx,{nodeId:params.get('node'),kind:params.get('kind')});
    if(ctx.signal.aborted)return;
    location.replace('#/session/'+encodeURIComponent(id));
  }catch(err){
    if(ctx.signal.aborted)return;
    const code=err.code||err.message;
    const copy=code==='LOCKED_NODE'?L('Misi ini belum terbuka. Siapkan dulu keterampilan prasyaratnya di peta.','This mission is not open yet. Get its prerequisite skills ready on the map first.'):
      code==='OFFLINE_REPAIR'?L('Unduhan belum lengkap untuk misi ini. Sambungkan internet lalu lengkapi unduhan di peta.','The download is incomplete for this mission. Connect and repair the download on the map.'):
      code==='NOT_INSTALLED'||(navigator.onLine===false)?L('Misi ini belum diunduh untuk offline. Sambungkan internet lalu coba lagi.','This mission has not been downloaded for offline use. Connect and try again.'):
      code==='WRONG_PROFILE'?L('Profil aktif berubah. Buka kembali beranda.','The active profile changed. Open the home page again.'):
      L('Misi belum dapat disiapkan. Periksa koneksi lalu coba lagi.','The mission could not be prepared. Check the connection and try again.');
    const h=e('h1',{tabindex:'-1'},L('Misi belum dimulai','Mission not started'));
    root.replaceChildren(e('div',{class:'sheet','data-error-code':code},h,e('p',{},copy),e('div',{class:'actions'},e('button',{type:'button',class:'primary',onclick:()=>ctx.rerender()},L('Coba lagi','Try again')),link(code==='OFFLINE_REPAIR'||code==='NOT_INSTALLED'?routeTo('map',{offline:params.get('node')}):'map',L('Buka peta','Open the map'),'btn'),link('',L('Beranda','Home'),'text-link'))));
    h.focus({preventScroll:true});
  }
}

/** Result block for a completed mission: summary + one reasoned next action. */
export async function missionResult(ctx,a,{node:makeNode,add,button}){
  const {L,scope}=ctx;
  const {route,state,next}=await overview(scope,ctx.signal);
  const o=missionOutcome(a),n=route.byId.get(a.journey.node_id),s=state.nodes.get(a.journey.node_id);
  const box=makeNode('section','kp-card mission-result');
  const target=o.target_n;
  add(box,makeNode('p','kp-sub',skillName(n,L)+' · '+stageName(route,n,L)+' · '+L(...KIND[a.journey.mission_kind]||KIND.regular)),
    makeNode('h2','kp-lead',L(o.first_independent+' dari '+o.n+' benar pada jawaban pertama tanpa bantuan',o.first_independent+' of '+o.n+' correct on the first try without help')));
  const facts=makeNode('ul','mission-facts');
  add(facts,makeNode('li','',L('Soal dilihat · ','Questions viewed · ')+o.viewed+' / '+o.n),
    makeNode('li','',L('Soal dijawab · ','Questions answered · ')+o.first_total+' / '+o.n),
    makeNode('li','',L('Jawaban akhir benar · ','Final answers correct · ')+o.final_correct+' / '+o.n),
    makeNode('li','',L('Soal dengan petunjuk atau kunci terlihat · ','Questions with a hint or a seen key · ')+o.assisted),
    makeNode('li','',L('Soal target mandiri · ','Independent target questions · ')+o.target_independent+' / '+target),
    makeNode('li','',L('XP misi ini · ','XP from this mission · ')+(5+10*o.first_independent)+L(' (penanda usaha, bukan nilai)',' (effort marker, not a grade)')));
  const details=makeNode('details','result-journal');
  add(details,makeNode('summary','',L('Rincian misi','Mission details')),facts);
  const minimum=Math.ceil(target*s.rule.min_rate);
  add(box,makeNode('p','target-outcome',L('Target mandiri: ','Independent targets: ')+o.target_independent+' / '+target+
    L(' · perlu '+minimum+' benar pada jawaban pertama tanpa bantuan.',' · '+minimum+' first answers correct without help needed.')));
  add(details,makeNode('p','mission-readiness',s.ready?L('Keterampilan ini siap lanjut.','This skill is ready to move on.'):
    readinessText(s,L)));
  if(a.journey.selection_trace?.review)add(details,makeNode('p','kp-sub',L('Misi ini memuat '+a.journey.selection_trace.review+' soal ulangan karena materi baru di keterampilan ini terbatas.','This mission included '+a.journey.selection_trace.review+' review questions because new material for this skill is limited.')));
  const nextNode=next.node_id&&route.byId.get(next.node_id);
  const reason=makeNode('p','mission-next',nextReason(next,L)+(nextNode?' · '+skillName(nextNode,L):''));
  const actions=makeNode('div','kp-actions');
  let starting=false;
  const primary=button(L('Misi berikutnya · Enter','Next mission · Enter'),()=>{
    if(starting||ctx.signal.aborted)return;
    starting=true;primary.disabled=true;
    ctx.go(next.action==='continue'?'session/'+next.attempt_id:missionHref(next));
  },'main');primary.dataset.part='next-mission';
  add(actions,primary,button(L('Tinjau jawaban','Review answers'),()=>ctx.go('review/'+a.attempt_id)),button(L('Peta','Map'),()=>ctx.go('map')),button(L('Beranda','Home'),()=>ctx.go('')));
  add(box,reason,actions,details);
  return box;
}
