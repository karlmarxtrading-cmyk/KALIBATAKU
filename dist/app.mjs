import {initializeEnter} from './core/enter-cycle.mjs';
initializeEnter();
import {element as e,icon,link} from './core/dom.mjs';
import {readMaterial,clearMaterial} from './core/material.mjs';
import {DEFAULT_PREFERENCES as defaults} from './core/preferences.mjs';
let prefs={...defaults};
try {const p=JSON.parse(localStorage.getItem('kalibataku.preferences.v1')||'{}');for(const key of Object.keys(defaults))if(typeof p[key]===typeof defaults[key]) prefs[key]=p[key];} catch {}
if(!['id','en'].includes(prefs.lang))prefs.lang='id';
let dictionary={}, localeCache={}, toastTimer, renderAbort, currentContext, cleanup, first=true, navigationSeq=0;
const media=matchMedia('(prefers-color-scheme: dark)');
const main=document.querySelector('#main'),header=document.querySelector('#app-header'),footer=document.querySelector('#app-footer');
function applyAppearance(){
  const theme=prefs.theme==='system'?(media.matches?'dark':'light'):(prefs.theme==='dark'?'dark':'light');
  Object.assign(document.documentElement.dataset,{theme,text:prefs.textSize,reduceMotion:String(prefs.reduceMotion)});
  document.documentElement.lang=prefs.lang;
}
applyAppearance();media.addEventListener?.('change',applyAppearance);
const t=key=>dictionary[key]??key;
const L=(id,en)=>prefs.lang==='en'?en:id;
function notify(message){const n=document.querySelector('#toast');clearTimeout(toastTimer);n.replaceChildren(message);toastTimer=setTimeout(()=>n.replaceChildren(),4200);}
function savePref(patch,feedback=false){
  Object.assign(prefs,patch);let persisted=true;
  try{localStorage.setItem('kalibataku.preferences.v1',JSON.stringify(prefs));}catch{persisted=false;}
  applyAppearance();
  if(feedback)notify(t(persisted?'saved':'prefsTemp'));
}
async function setLanguage(lang){
  if(!['id','en'].includes(lang))return;
  const keyboardToggle=document.activeElement?.dataset?.action==='language';
  const oldRoute=readRoute().route;
  const setup=['start','session/new'].includes(oldRoute)?currentContext?.root.querySelector('form.setup'):null;
  const setupDraft=setup?.readSetupDraft?.();
  const messages=await messagesFor(lang);
  savePref({lang});dictionary=messages;
  if(currentContext){currentContext.locale=lang;currentContext.lang=lang;if(currentContext.scope?.profileId==='local-default')currentContext.profileName=t('defaultProfile');}
  const route=readRoute().route;
  if(/^session\/(?!new$)/.test(route)){
    chromeUI(route);
    if(currentContext?.demo)demoBanner();
    window.dispatchEvent(new CustomEvent('kalibataku:language',{detail:{lang,locale:lang}}));
    document.title=(main.querySelector('h1')?.textContent||t('practice'))+' · KALIBATAKU';
  }else{
    await render({scroll:false,focus:false,setupDraft});
  }
  if(keyboardToggle)header.querySelector('[data-action=language]')?.focus({preventScroll:true});
  else if(readRoute().route==='settings')main.querySelector('[name=lang]')?.focus({preventScroll:true});
}
async function messagesFor(lang){
  if(localeCache[lang])return localeCache[lang];
  const r=await fetch('./locales/'+lang+'.json');if(!r.ok)throw new Error('LOCALE');
  return (localeCache[lang]=await r.json());
}
function readRoute(){
  const path=location.hash.replace(/^#\/?/,'');
  const [raw,query='']=path.split('?');
  return {route:raw.replace(/^\/+|\/+$/g,''),params:new URLSearchParams(query)};
}
function go(path=''){
  const normalized=String(path).replace(/^#?\/?/,'');
  const dest='#/'+normalized;
  if(location.hash===dest)return render({scroll:true,focus:true});
  location.hash=dest;
}
const navigate=go;
function chromeUI(route,ctx=currentContext) {
  document.querySelector('#skip').textContent=t('skip');
  const active=route.split('/')[0];
  const inSession=/^session\/(?!new$)/.test(route);
  const school=route.startsWith('demo/')||active==='reports';
  const source=ctx?.scope?.origin==='demo'?'?source=demo':'';
  const selected=(path)=>active===path?'page':null;
  const nav=e('nav',{class:'nav-links',id:'student-nav','aria-label':L('Ruang belajar','Study navigation')});
  if(!school&&!inSession){
    for(const [path,label,glyph] of [['',L('Petualangan','Adventure'),'play'],['map',L('Peta','Map'),'layers'],['progress',t('progress'),'graph'],['history',t('history'),'clock']]){
      const isActive=path?active===path:['','home','mission','result','start-point'].includes(active);
      nav.append(link(path+(path&&path!=='map'?source:''),[icon(glyph,18),label],'',{'aria-current':isActive?'page':null}));
    }
  }
  const language=e('button',{class:'lang-button',type:'button',dataset:{action:'language'},'aria-label':prefs.lang==='id'?'Switch to English':'Ganti ke Bahasa Indonesia',title:prefs.lang==='id'?'Switch to English':'Ganti ke Bahasa Indonesia'},icon('globe',18),prefs.lang.toUpperCase());
  language.onclick=async()=>{language.disabled=true;try{await setLanguage(prefs.lang==='id'?'en':'id');}catch{notify(t('loadFail'));}finally{language.disabled=false;}};
  language.onpointerdown=ev=>{if(inSession&&document.activeElement?.matches('.kp-answer'))ev.preventDefault();};
  const more=e('details',{class:'nav-more'});
  const menuToggle=e('summary',{'aria-label':t('menu')},icon('menu',19),e('span',{},t('menuShort')));
  const fromSession=inSession?'from='+encodeURIComponent(route)+(source?'&source=demo':''):'';
  const settingsRoute=fromSession?'settings?'+fromSession:'settings';
  const navRows=[['curriculum',L('Latihan bebas','Free practice'),'book'],[settingsRoute,t('settings'),'settings'],['offline',t('offline'),'offline'],['sync',t('deliveryStatus'),'save'],['demo/teacher',t('teacherSpace'),'school'],['demo/admin',t('adminSpace'),'layers'],['settings?section=help'+(fromSession?'&'+fromSession:''),t('help'),'help']];
  if(inSession||school)navRows.unshift(['',t('home'),'home'],['history'+source,t('history'),'clock']);
  // Inside a mission the menu keeps only what a learner needs; school spaces stay outside the arena.
  const rows=inSession?navRows.filter(([path])=>!path.startsWith('demo/')):navRows;
  more.append(menuToggle,e('nav',{class:'menu-pop','aria-label':t('menu')},rows.map(([path,label,glyph])=>link(path,[icon(glyph,18),label],'',{'aria-current':path==='curriculum'&&['curriculum','packs','start'].includes(active)?'page':selected(path)}))));
  more.onkeydown=ev=>{if(ev.key==='Escape'&&more.open){ev.preventDefault();more.open=false;menuToggle.focus();}};
  more.onfocusout=ev=>{if(ev.relatedTarget&&!more.contains(ev.relatedTarget))more.open=false;};
  const brand=link('',[e('img',{src:'./assets/mark.svg',alt:'',width:36,height:36}),e('span',{},e('strong',{},'KALIBATAKU'),e('small',{},t('brandSub')))],'brand',{'aria-label':t('goHome')});
  const profile=ctx?.profileName||t('defaultProfile');
  const account=link('profiles',[icon('user',17),e('span',{},e('small',{},t('activeProfile')),e('strong',{},profile))],'profile-control',{'aria-label':t('activeProfile')+' · '+profile+' · '+t('profile'),title:profile});
  header.replaceChildren(e('div',{class:'topbar'+(inSession?' is-session':'')},brand,nav.childElementCount?nav:null,e('div',{class:'top-tools'},account,language,more)));
  footer.replaceChildren(e('div',{class:'footer-inner'},e('span',{},'KALIBATAKU · '+t('brandSub')),e('nav',{class:'footer-links','aria-label':L('Tautan lainnya','Additional links')},link('demo/teacher',[icon('school',17),t('teacherSpace')]),link('reports',t('reports')),link('settings?section=help',t('help')))));
}
document.addEventListener('click',evt=>{const menu=header.querySelector('.nav-more[open]');if(menu&&!menu.contains(evt.target))menu.open=false;});
let playerStyleReady;
function playerStyle(){
  if(!playerStyleReady)playerStyleReady=new Promise((resolve,reject)=>{
    const sheet=e('link',{rel:'stylesheet',href:'./player/player.css',dataset:{playerStyle:'true'}});
    sheet.onload=resolve;
    sheet.onerror=()=>{sheet.remove();playerStyleReady=null;reject(new Error('STYLE_LOAD'));};
    document.head.append(sheet);
  });
  return playerStyleReady;
}
function demoBanner(){
  header.append(e('div',{class:'demo-banner'},e('strong',{},L('Siswa simulasi','Simulated student')),link('demo/assignments',L('Kembali ke penugasan','Back to assignments'),'text-link')));
}
let choosingScope=false;
async function enterPersonalScope(route,params){
  if(/^(session\/(?!new$)|results\/|review\/|resume(?:\/|$))/.test(route)||params.get('source')==='demo')return;
  const {activeScope,selectScope,scopeForLocal}=await import('./data/store.js');
  if(activeScope().origin!=='demo')return;
  let saved;
  try{saved=JSON.parse(localStorage.getItem('kalibataku.localProfile'));}catch{}
  choosingScope=true;
  try{selectScope(saved?.origin==='local_practice'?saved:scopeForLocal('local-default'));}finally{choosingScope=false;}
}
async function confirmTemporary(ctx){
  const opener=document.activeElement;
  const dialog=e('dialog',{class:'storage-dialog','aria-labelledby':'storage-consent-title'},e('h2',{id:'storage-consent-title'},t('temporaryMode')),e('p',{},t('storageTemp')));
  return new Promise(resolve=>{
    const finish=accepted=>{dialog.close();dialog.remove();opener?.focus?.();resolve(accepted);};
    dialog.append(e('div',{class:'actions'},
      e('button',{type:'button',onclick:()=>finish(false)},t('back')),
      e('button',{type:'button',class:'primary',onclick:()=>finish(true)},t('tempConsent'))));
    dialog.addEventListener('cancel',ev=>{ev.preventDefault();finish(false);});
    ctx.signal.addEventListener('abort',()=>{if(dialog.isConnected)finish(false);},{once:true});
    document.body.append(dialog);dialog.showModal();
  });
}
function failState(ctx,error){
  const copy=(error?.message==='SELECTION'||error?.message==='NO_CONTENT')?t('badPack'):t('loadHelp');
  ctx.root.replaceChildren(e('div',{class:'sheet'},e('h1',{},t('loadFail')),e('p',{class:'gap-top'},copy),e('div',{class:'actions'},e('button',{class:'primary',type:'button',onclick:()=>render()},t('retry')),link('offline',t('offline'),'btn'),link('',t('goHome'),'text-link'))));
}
async function render({scroll=true,focus=true,setupDraft=null}={}){
  const seq=++navigationSeq;
  renderAbort?.abort();if(typeof cleanup==='function')cleanup();cleanup=null;renderAbort=new AbortController();
  const {route,params}=readRoute();
  if(currentContext?.route!==route){clearTimeout(toastTimer);document.querySelector('#toast').replaceChildren();}
  const firstRoot=document.documentElement.hasAttribute('data-opening')?main.querySelector('.app-view'):null;
  const root=firstRoot || e('div',{class:'app-view'},e('div',{class:'loading',role:'status'},t('loading')));
  root.dataset.route=route||'home';root.setAttribute('aria-busy','true');
  if(!firstRoot)main.replaceChildren(root);
  if(scroll)window.scrollTo({top:0,behavior:'instant'});
  const ctx={root,route,params,setupDraft,defaults,lang:prefs.lang,locale:prefs.lang,prefs,L,t,go,navigate,notify,savePref,setLanguage,signal:renderAbort.signal,rerender:()=>render({scroll:false,focus:false}),profileId:'local-default'};
  currentContext=ctx;
  try{
    await enterPersonalScope(route,params);
    if(ctx.signal.aborted)return;
    const store=await import('./data/store.js');
    const scope=await store.resolveActiveScope();
    ctx.scope=scope;ctx.profileId=scope.profileId;ctx.material=readMaterial(scope);
    ctx.profileName=scope.origin==='demo'?scope.profileId.replace(/^demo-(\d+)$/,'Demo $1'):(await store.listProfiles()).find(p=>p.id===scope.profileId)?.name||t('defaultProfile');
    if(ctx.signal.aborted)return;
    chromeUI(route,ctx);
    if(route===''||route==='home'||route==='map'||route==='start-point'||route==='mission'){
      if(scope.origin==='demo'){const {home}=await import('./core/home.mjs');await home(ctx);}
      else{
        const ui=await import('./journey/ui.mjs');
        ctx.confirmTemporary=confirmTemporary;
        if(route==='map')await ui.map(ctx);
        else if(route==='start-point')await ui.startPointPage(ctx);
        else if(route==='mission'){const styleReady=playerStyle();await styleReady.catch(()=>{});await ui.launch(ctx);}
        else await ui.home(ctx);
      }
    }else if(['curriculum','packs','start','session/new'].includes(route)){
      const {renderCatalog}=await import('./core/catalog.mjs');await renderCatalog(ctx);
    }else if(route==='settings'||route==='help'){
      const {settings}=await import('./core/settings.mjs');settings(ctx);
    }else if(['profiles','offline','privacy','sync'].includes(route)){
      const {renderDataPanel}=await import('./data/panels.js');
      let packageInfo;
      if(route==='offline' && params.has('pack')){
        const {selection}=await import('./core/bank.mjs');const s=await selection(ctx,ctx.material||{});
        const {loadRoute}=await import('./journey/journey.mjs');
        const {missionDependencies}=await import('./journey/offline.mjs');
        const node=(await loadRoute(ctx.signal)).byId.get(s.comp.competency_id);
        packageInfo={id:s.entry.package_id,version:s.entry.content_version,url:s.entry.url,sha256:s.entry.sha256,title:s.entry.title,bytes:s.entry.bytes||0,launch:'session/new?'+params.toString(),dependencies:missionDependencies(s.gradeMeta.url,s.levelMeta.url,node)};
      }
      const extras=e('nav',{class:'choices data-tabs','aria-label':t('storage')},[['profiles','profile'],['offline','offline'],['sync','storage']].map(([path,k])=>link(path,path==='sync'?L('Pengiriman hasil','Result delivery'):t(k),'',{'aria-current':path===route?'page':null})));
      const body=e('div',{class:'data-body'});root.replaceChildren(extras,body);
      await renderDataPanel(body,{...ctx,page:route,packageInfo});
    }else if(route==='reports'||route.startsWith('demo/')){
      const [{renderTeacher},{activeScope,selectScope}]=await Promise.all([import('./teacher/index.js'),import('./data/store.js')]);
      ctx.profileId=activeScope().profileId;
      const {enableForegroundSync}=await import('./data/sync.js');enableForegroundSync();
      ctx.startAssignment=async assignment=>{
        const {start}=await import('./player/view.mjs');
        const storage=await store.getStatus();
        if(storage.temporary&&!await confirmTemporary(ctx))return;
        if(assignment.scope)await selectScope(assignment.scope);
        ctx.profileId=activeScope().profileId;
        const id=assignment.active_attempt_id||await start(ctx,assignment);go('session/'+encodeURIComponent(id));
      };
      await renderTeacher(root,ctx);
    }else if(/^(session\/[^/]+|review\/[^/]+|results\/[^/]+|resume(?:\/[^/]+)?|progress|history)$/.test(route)){
      // Attach the same route-level error handler to the stylesheet and modules
      // immediately. A reload may cancel the CSS before the imports finish.
      const [{render:playerRender},{activeScope}]=await Promise.all([
        import('./player/view.mjs'),import('./data/store.js'),playerStyle()
      ]);
      const scope=activeScope();ctx.profileId=scope.profileId;
      if(scope.origin==='demo'){
        ctx.go=path=>{
          if(/^(progress|history|session\/new)(?:\?|$)/.test(path)){
            const [dest,query='']=path.split('?');const next=new URLSearchParams(query);next.set('source','demo');go(dest+'?'+next);
          }else go(path);
        };
        ctx.demo=true;demoBanner();
      }
      if(ctx.signal.aborted)return;
      const dispose=await playerRender(ctx);
      if(seq===navigationSeq)cleanup=dispose;else if(typeof dispose==='function')dispose();
    }else{
      root.replaceChildren(e('h1',{},t('notFound')),link('',t('goHome'),'text-link'));
    }
    if(seq!==navigationSeq)return;
    document.title=(root.querySelector('h1')?.textContent||t('practice'))+' · KALIBATAKU';
    if(focus&&!first && !root.contains(document.activeElement)) main.focus({preventScroll:true});
  }catch(error){if(!ctx.signal.aborted){chromeUI(route,ctx);console.warn('KALIBATAKU route',route,error);failState(ctx,error);}}
  finally{root.removeAttribute('aria-busy');if(seq===navigationSeq){first=false;document.documentElement.removeAttribute('data-opening');}}
}
window.addEventListener('hashchange',()=>render());
document.querySelector('#skip').addEventListener('click',event=>{event.preventDefault();main.focus();main.scrollIntoView();});
window.addEventListener('kalibataku:profile',async()=>{
  if(choosingScope)return;
  const route=readRoute().route;
  if(['','home','map','start-point','progress','history','start','session/new','packs','curriculum'].includes(route)){render({scroll:false,focus:false});return;}
  const ctx=currentContext;
  if(!ctx)return;
  const {activeScope,listProfiles}=await import('./data/store.js');
  const scope=activeScope();const profiles=await listProfiles();
  if(ctx!==currentContext)return;
  ctx.scope=scope;ctx.profileId=scope.profileId;ctx.profileName=scope.origin==='demo'?scope.profileId.replace(/^demo-(\d+)$/,'Demo $1'):profiles.find(p=>p.id===scope.profileId)?.name||t('defaultProfile');
  chromeUI(route,ctx);
  if(ctx.demo)demoBanner();
});
window.addEventListener('kalibataku:profile-removed',ev=>{if(ev.detail?.profileId)clearMaterial({profileId:ev.detail.profileId,origin:'local_practice',environment:'device'});});
try{
  dictionary=await messagesFor(prefs.lang);
  await render();
  const register=()=>import('./data/offline.js').then(m=>m.registerOffline()).catch(()=>{});
  if('requestIdleCallback'in window)requestIdleCallback(register,{timeout:3000});else setTimeout(register,600);
}catch{
  document.documentElement.removeAttribute('data-opening');
  main.replaceChildren(e('div',{class:'sheet'},e('h1',{},'KALIBATAKU'),e('p',{},'Gagal memuat aplikasi. / The app could not be loaded.'),e('button',{type:'button',onclick:()=>location.reload()},'Muat ulang / Reload')));
}
