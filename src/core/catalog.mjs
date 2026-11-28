import {element as e,icon,link,heading,routeTo,labelled,select} from './dom.mjs';
import {bands,rootShard,readShard,selection,symbols,tr,groupPath} from './bank.mjs';
import {rememberMaterial,questionCount} from './material.mjs';
const modes=['practice','speed','assessment','adaptive','recovery'];
const modeLabel=(t,m)=>t(m+'Mode');
const aref=(ctx,route,key)=>link(route,[icon('back',16),ctx.t(key)],'crumb');
function purposeName(ctx,value){
  const key='purpose_'+value;
  return ctx.t(key)!==key?ctx.t(key):({'cumulative_review':ctx.L('Tinjau kumulatif','Cumulative review'),'fluency':ctx.L('Kelancaran','Fluency'),'mixed_transfer':ctx.L('Transfer strategi','Strategy transfer')}[value]??ctx.L('Latihan','Practice'));
}
function packTitle(ctx,entry){
  const name=tr(entry.title,ctx.lang);
  return name&&name!==entry.package_id?name:purposeName(ctx,entry.purpose)+' · '+ctx.t('pack')+' '+Number(entry.package_id?.match(/P(\d+)$/)?.[1]||1);
}
function gradeLinks(ctx,root,band,selected) {
  return e('div',{class:'grade-links'},root.grades.filter(g=>Number(g.grade)>=band.from&&Number(g.grade)<=band.to).map(g=>link(routeTo('curriculum',{band:band.id,grade:g.grade}),String(g.grade),'',{'aria-label':ctx.t('grade')+' '+g.grade,'aria-current':Number(g.grade)===selected?'page':null})));
}
async function curriculum(ctx) {
  const {t,root}=ctx;
  const data=await rootShard(ctx.signal);
  const requested=ctx.params.get('grade');
  const chosenBand=bands.find(b=>b.id===ctx.params.get('band'));
  const g=Number(requested||chosenBand?.from||ctx.material?.grade||1);
  const band=bands.find(b=>g>=b.from&&g<=b.to);
  const gm=data.grades.find(item=>Number(item.grade)===g);
  if(!gm||!band)throw new Error('SELECTION');
  const gd=await readShard(gm.url,ctx.signal);
  const {usedPackages}=await import('../data/store.js');
  const [levels,opened,completed]=await Promise.all([Promise.all(gd.levels.map(meta=>readShard(meta.url,ctx.signal))),usedPackages(ctx.scope),usedPackages(ctx.scope,{status:'completed'})]);
  if(ctx.signal.aborted)return;
  const bandNav=e('nav',{class:'choices','aria-label':t('chooseClass')},bands.map(b=>link('curriculum?band='+b.id,t(b.label),'',{'aria-current':band.id===b.id?'page':null})));
  const content=[aref(ctx,'','home'),heading(t('curriculum'),t('classTip')),
    e('section',{class:'sheet grade-picker'},e('h2',{},t('chooseClass')),bandNav,gradeLinks(ctx,data,band,g))];
  content.push(e('section',{class:'gap-section'},
    e('div',{class:'section-head'},e('h2',{},t('material')+' '+g+' · '+t('levels'))),
    e('div',{class:'stack-rows'},gd.levels.map((lm,i)=>{
      const cells=levels[i].competencies;
      return e('article',{class:'level-card'},e('div',{class:'level-heading'},e('span',{class:'level-no'},String(lm.level).padStart(2,'0')),e('h3',{},tr(lm.focus,ctx.lang))),
        e('div',{class:'level-ops'},cells.filter(c=>c.active).map(c=>{
          const finished=c.packages.some(p=>completed.has(p.package_id)),seen=finished||c.packages.some(p=>opened.has(p.package_id));
          return link(routeTo('packs',{grade:g,level:lm.level,op:c.operation}),[e('span',{},t('title'+c.operation),e('small',{},t(finished?'topicFinished':seen?'topicOpened':'topicFresh'))),icon('next',14)],'op-link');
        })),
        cells.some(c=>!c.active)?e('p',{class:'muted'},cells.filter(c=>!c.active).map(c=>t('title'+c.operation)).join(', ')+' · '+t('noOp')):null);
    }))));
  root.replaceChildren(...content);
}
function selectors(ctx,s,route,extras=()=>({})){
  const uri=x=>routeTo(route,{...extras(),...x});
  const {t,go}=ctx;
  const grade=select(s.root.grades.map(g=>[g.grade,t('grade')+' '+g.grade]),s.grade,ev=>go(uri({grade:ev.target.value,level:1})));
  const level=select(s.gradeData.levels.map(l=>[l.level,t('level')+' '+l.level+' · '+tr(l.focus,ctx.lang)]),s.level,ev=>go(uri({grade:s.grade,level:ev.target.value})));
  const op=select(s.levelData.competencies.filter(c=>c.active).map(c=>[c.operation,t('title'+c.operation)]),s.comp.operation,ev=>go(uri({grade:s.grade,level:s.level,op:ev.target.value})));
  grade.name='grade';level.name='level';op.name='operation';
  return [labelled(t('material'),grade),labelled(t('level'),level),labelled(t('operation'),op)];
}
async function catalogue(ctx,s){
  const {t,root}=ctx;
  const unavailable=s.levelData.competencies.filter(c=>!c.active);
  const purpose=ctx.params.get('purpose')||'';
  const search=e('input',{type:'search',placeholder:t('searchHelp'),name:'pack-search',value:ctx.params.get('q')||''});
  const filter=select([['',t('showAll')],...Array.from(new Set(s.comp.packages.map(p=>p.purpose))).map(p=>[p,purposeName(ctx,p)])],purpose);
  filter.name='purpose';
  const items=e('div',{class:'stack-rows'}),resultCount=e('p',{class:'muted result-range','aria-live':'polite',tabindex:'-1'});
  const pages=e('nav',{class:'pager','aria-label':ctx.L('Halaman paket','Package pages')});
  let page=Math.max(1,parseInt(ctx.params.get('page'),10)||1);
  const size=8;
  let opened=new Set(),completed=new Set();
  const {packageInventory,verifyPackage,packageStateLabel,watchInstalls}=await import('../data/offline-verification.mjs');
  let timer;
  try{
    const {usedPackages}=await import('../data/store.js');
    [opened,completed]=await Promise.all([usedPackages(ctx.scope),usedPackages(ctx.scope,{status:'completed'})]);
  }catch{}
  if(ctx.signal.aborted)return;
  function writeFilters(){
    const query=new URLSearchParams(ctx.params);
    for(const [k,v] of [['purpose',filter.value],['q',search.value],['page',page>1?page:'']])if(v)query.set(k,v);else query.delete(k);
    history.replaceState(null,'','#/packs?'+query);ctx.params=query;
  }
  function renderRows(focus=false){
    const q=search.value.trim().toLocaleLowerCase(ctx.lang);
    const filtered=s.comp.packages.filter(p=>(!filter.value||p.purpose===filter.value)&&(!q||[packTitle(ctx,p),p.package_id,purposeName(ctx,p.purpose)].join(' ').toLocaleLowerCase(ctx.lang).includes(q)));
    page=Math.min(page,Math.max(1,Math.ceil(filtered.length/size)));
    const start=(page-1)*size,end=Math.min(start+size,filtered.length),total=filtered.length;
    resultCount.textContent=total?ctx.L('Paket ','Packages ')+(start+1)+'–'+end+ctx.L(' dari ',' of ')+total:t('noPacks');
    const shown=filtered.slice(start,end);
    const labels=new Map();
    items.replaceChildren(...shown.map(p=>{
      const status=e('span',{'data-package-state':'checking'},packageStateLabel('checking',ctx.L));
      labels.set(p,status);
      const flags=[questionCount(p.question_count,ctx.lang),p.form_id?t('assessmentMode'):t('practiceMode'),t(completed.has(p.package_id)?'topicFinished':opened.has(p.package_id)?'topicOpened':'unusedPack')];
      return link(groupPath(ctx,s,'session/new',{pack:p.package_id}),[e('span',{class:'op-sign','aria-hidden':'true'},symbols[s.comp.operation]),e('span',{class:'stack'},e('strong',{},packTitle(ctx,p)),e('small',{},flags.join(' · '),' · ',status)),icon('next',18)],'pack-row');
    }));
    const setState=(el,state)=>{
      if(ctx.signal.aborted||!items.contains(el))return;
      el.dataset.packageState=state;el.textContent=packageStateLabel(state,ctx.L);
    };
    if(shown.length)packageInventory(ctx.signal).then(cycle=>Promise.all(shown.map(async p=>{
      const result=await verifyPackage(cycle,p.package_id,p.content_version);
      setState(labels.get(p),result.state);
    }))).catch(()=>{for(const el of labels.values())setState(el,'repair');});
    if(!total)items.append(e('div',{class:'notice'},[filter.value&&purposeName(ctx,filter.value),search.value].filter(Boolean).join(' · '),' ',e('button',{type:'button',onclick:()=>{filter.value='';search.value='';updateFilter();search.focus();}},t('resetFilters'))));
    const step=(delta,label)=>e('button',{type:'button',disabled:delta<0?page===1:end>=total,onclick:()=>{page+=delta;writeFilters();renderRows(true);}},label);
    pages.replaceChildren(...(total>size?[step(-1,t('previous')),step(1,t('next'))]:[]));
    if(focus){resultCount.focus();resultCount.scrollIntoView({block:'nearest'});}
  }
  function updateFilter(){page=1;writeFilters();renderRows();}
  search.addEventListener('input',()=>{page=1;writeFilters();clearTimeout(timer);timer=setTimeout(renderRows,100);});
  ctx.signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});filter.onchange=updateFilter;
  const side=e('details',{class:'sheet pack-filters',open:matchMedia('(min-width: 641px)').matches||null},e('summary',{},t('filters')),e('div',{class:'filters'},selectors(ctx,s,'packs'),labelled(t('purpose'),filter),labelled(t('search'),search)),
    unavailable.length?e('p',{class:'muted'},unavailable.map(c=>t('title'+c.operation)).join(', ')+' · '+t('noOp')):null);
  const list=e('section',{},e('h2',{},tr(s.comp.title,ctx.lang)||t('title'+s.comp.operation)),resultCount,items,pages);
  root.replaceChildren(aref(ctx,'curriculum?grade='+s.grade,'curriculum'),heading(t('packs'),t('catalogIntro')),e('div',{class:'catalog-layout'},side,list));
  watchInstalls(ctx.signal,()=>renderRows());
  renderRows();
}

async function setup(ctx,s){
  const {root,t,L}=ctx;
  const {getStatus}=await import('../data/store.js');
  let player;
  const storage=await getStatus();
  if(ctx.signal.aborted)return;
  const initial=ctx.setupDraft||{};
  const fromAttempt=ctx.params.get('fromAttempt'),fromItem=ctx.params.get('fromItem');
  const similarMode=()=>chooser.value==='practice'&&Boolean(fromAttempt||fromItem);
  const requested=initial.mode||ctx.params.get('mode')||ctx.params.get('goal');
  const chooser=select(modes.map(m=>[m,modeLabel(t,m)]),modes.includes(requested)?requested:s.entry.form_id?'assessment':'practice');chooser.name='mode';
  const duration=select([30,60,120,300].map(v=>[v,v<60?v+' '+t('seconds'):new Intl.NumberFormat(ctx.lang,{style:'unit',unit:'minute',unitDisplay:'long'}).format(v/60)]),initial.duration||ctx.params.get('seconds')||60);duration.name='duration';
  // UX-004: choices carried across a material change are re-validated for the new pack.
  const carried=Number(initial.length??ctx.params.get('count'));
  const length=e('input',{type:'number',name:'question_count',inputmode:'numeric',min:1,step:1,value:Number.isInteger(carried)&&carried>=1?Math.min(carried,s.entry.question_count):Math.min(10,s.entry.question_count)});
  const shuffle=e('input',{type:'checkbox',name:'shuffle',checked:initial.shuffle??ctx.params.get('shuffle')==='1'});
  const countField=labelled(t('count'),length),timerField=labelled(t('duration'),duration);
  const shuffleField=e('label',{class:'check-field'},shuffle,t('shuffle'));
  const form=e('form',{class:'sheet setup'});
  const launch=e('button',{type:'submit',class:'btn primary',disabled:true},t('preparing'));
  const error=e('div',{'aria-live':'polite'});
  const state=e('p',{class:'notice','aria-live':'polite',role:'status'});
  const topic=e('h2',{},tr(s.comp.title,ctx.lang));
  const meta=e('p',{class:'muted'}),policy=e('p',{class:'tagline'});
  const summary=e('p',{class:'plan-line','aria-live':'polite'});
  const identity=e('dl',{class:'stats-list'});
  const offline=link(groupPath(ctx,s,'offline',{pack:s.entry.package_id}),[icon('offline',17),t('download')],'text-link');
  const timeEstimate=e('p',{class:'tagline'});
  const paceParam=Number(initial.pace||ctx.params.get('pace'));
  const pace=select([20,30,60,90].map(v=>[v,v+' '+t('seconds')]),[20,30,60,90].includes(paceParam)?paceParam:30);pace.name='planning_pace';
  const advanced=e('details',{open:!!initial.advanced||ctx.params.get('advanced')==='1'},e('summary',{},t('practiceOptions')),shuffleField,
    labelled(L('Perkiraan detik per soal','Estimated seconds per question'),pace),timeEstimate,
    e('details',{},e('summary',{},t('packDetails')),identity,offline));
  const scopeChoice=()=>({mode:chooser.value,count:length.value||1,seconds:duration.value,shuffle:shuffle.checked?'1':'',pace:pace.value,advanced:advanced.open?'1':'',change:'1',source:ctx.params.get('source')||''});
  const material=e('details',{open:!!initial.change||ctx.params.get('change')==='1'},e('summary',{},t('changeTopic')),e('p',{class:'muted'},t('classTip')),e('div',{class:'field-grid'},selectors(ctx,s,ctx.route,scopeChoice)),link(groupPath(ctx,s),t('chooseFromList'),'text-link'));
  const temp=e('input',{type:'checkbox',name:'temporary_consent',checked:!!initial.consent});
  const tempWarning=storage.temporary?e('div',{class:'notice caution'},e('strong',{},t('temporaryMode')),e('p',{},t('storageTemp')),e('label',{class:'check-field'},temp,t('tempConsent')),
    e('div',{class:'actions'},e('button',{type:'button',onclick:()=>location.reload()},t('retryStorage')),link('',t('back'),'text-link'))):null;
  const pre=e('div',{class:'prereqs'});
  const supporting=e('details',{},e('summary',{},L('Materi dan prasyarat','Content and prerequisites')),pre);
  form.readSetupDraft=()=>({mode:chooser.value,duration:duration.value,length:rememberedLength,shuffle:shuffle.checked,pace:pace.value,advanced:advanced.open,change:material.open,consent:temp.checked});
  let plan=null,seq=0,busy=false,rememberedLength=length.value;
  function configure(){
    if(!plan||busy){launch.disabled=true;return;}
    const fixed=plan.fixed;
    const n=fixed?plan.max:Number(length.value),valid=Number.isInteger(n)&&n>=1&&n<=plan.max;
    const seconds=plan.mode==='speed'?Number(duration.value):0;
    if(!valid){launch.disabled=true;summary.textContent=L('Pilih antara 1 dan '+plan.max+' soal.','Choose between 1 and '+plan.max+' questions.');launch.textContent=t('startSession');timeEstimate.textContent='';return;}
    plan.count=n;plan.seconds=seconds;Object.assign(plan.options,{question_count:n,duration_seconds:seconds,shuffle:!fixed&&shuffle.checked});
    summary.textContent=[questionCount(n,ctx.lang),seconds?new Intl.NumberFormat(ctx.lang,{style:'unit',unit:'second',unitDisplay:'long'}).format(seconds):t('untimed')].join(' · ');
    launch.disabled=!!(storage.temporary&&!temp.checked);launch.replaceChildren(L('Mulai ','Start ')+questionCount(n,ctx.lang),icon('arrow',18));
    timeEstimate.textContent=L('Perkiraan sesuai pilihanmu · sekitar ','Estimate at your chosen pace · about ')+new Intl.NumberFormat(ctx.lang,{style:'unit',unit:'minute',unitDisplay:'long'}).format(Math.ceil(n*Number(pace.value)/60));
  }
  function describe(prepared){
    const {entry,pkg,cell}=prepared;
    topic.textContent=tr(cell.title,ctx.lang);
    meta.textContent=t('material')+' '+pkg.grade+' · '+t('level')+' '+pkg.level+' · '+purposeName(ctx,entry.purpose)+(entry.form_id?' · '+L('Form ','Form ')+entry.form_id.split('.').pop():'');
    identity.replaceChildren(...[[t('pack'),packTitle(ctx,entry)],[L('Kode paket','Package ID'),entry.package_id],[t('versionContent'),entry.content_version]].map(([k,v])=>e('div',{},e('dt',{},k),e('dd',{},v))));
    offline.href='#/'+routeTo('offline',{grade:pkg.grade,level:pkg.level,op:pkg.operation,pack:entry.package_id});
    const kinds=new Set();
    function walk(ast){if(ast.kind==='binary'){walk(ast.left);walk(ast.right);}else kinds.add(ast.display?.kind||'integer');}
    for(const q of pkg.questions)walk(q.expression_ast);
    const labels={integer:L('bilangan bulat','whole numbers'),fraction:L('pecahan','fractions'),decimal:L('desimal','decimals')};
    pre.replaceChildren(e('p',{},L('Bentuk bilangan · ','Number types · ')+[...kinds].map(k=>labels[k]||labels.integer).join(', ')));
    const prereqs=cell.prerequisites.map(key=>/^arithmetic\.(addition|subtraction|multiplication|division|mixed)\.g(\d+)\.l(\d+)$/.exec(key)).filter(Boolean).map(m=>{
      const op={addition:'ADD',subtraction:'SUB',multiplication:'MUL',division:'DIV',mixed:'MIX'}[m[1]];
      return e('li',{},link(routeTo('packs',{grade:+m[2],level:+m[3],op}),t('title'+op)+' · '+t('material')+' '+Number(m[2])+' · '+t('level')+' '+Number(m[3])));
    });
    pre.append(prereqs.length?e('ul',{},prereqs):e('p',{class:'muted'},L('Dapat dimulai langsung.','You can start here.')));
    if(prepared.adaptive){
      const reason={collect:L('Bukti evaluasi belum cukup. Latih materi ini dahulu.','There are too few comparable assessments. Start with this topic.'),vary:L('Hasil evaluasi menunjukkan materi ini masih layak dilatih.','Recent assessments support more practice on this topic.'),prerequisite:L('Dua evaluasi terakhir di bawah 70%. Latihan ini menguatkan materi pendukung.','Both recent assessments scored below 70%. Practise a supporting topic.'),assess:L('Dua evaluasi terakhir mencapai 90%. Kamu dapat mencoba evaluasi baru setelah latihan ini.','Both recent assessments reached 90%. You can try another assessment after this practice.')};
      policy.textContent=reason[prepared.adaptive.decision];
    }else policy.textContent=prepared.similar?t('singleVariation'):chooser.value==='recovery'?L('Dua soal: ulangi satu soal terdahulu lalu coba variasinya.','Two questions: revisit a previous question, then try a variation.'): '';
    state.textContent=t(chooser.value+'Hint');
  }
  function showError(err){
    const code=err.code||err.message;
    if(['OFFLINE_ABSENT','OFFLINE_REPAIR','OFFLINE_UPDATE'].includes(code)){
      const state=code.slice(8).toLowerCase();
      const label=state==='repair'?L('Perlu perbaikan','Repair needed'):state==='update'?L('Perlu diperbarui','Update needed'):L('Belum diunduh','Not downloaded');
      const path=groupPath(ctx,s,'offline',{pack:err.packageId||s.entry.package_id});
      error.replaceChildren(e('p',{class:'notice error',role:'alert','data-package-state':state},label+' · '+L('Sambungkan internet untuk menyiapkan paket ini.','Connect to prepare this pack.')),link(path,L('Kelola salinan offline','Manage offline copy'),'btn'));
      return;
    }
    const msg=({VARIANT_SOURCE:'noVariantSource',VARIANT_UNAVAILABLE:'cannotLoadVariation',RECOVERY_EMPTY:'recoverEmpty',NO_VARIANT:'noVariation',RETEST_NEEDS_PRACTICE:'retestNeedsPractice',CHECKSUM_MISMATCH:'invalidPack',INVALID_KEY:'invalidPack',INVALID_PACKAGE:'invalidPack',WRONG_PROFILE:'wrongProfile'})[code]||'startFail';
    error.replaceChildren(e('p',{class:'notice error',role:'alert'},t(msg)),e('div',{class:'actions'},
      e('button',{type:'button',onclick:()=>{if(code==='RECOVERY_EMPTY'||code==='NO_VARIANT'||code==='VARIANT_SOURCE'){
        if(fromAttempt||fromItem){ctx.go(groupPath(ctx,s,'session/new',{mode:'practice'}));return;}chooser.value='practice';
      }refresh();}},t(['RECOVERY_EMPTY','NO_VARIANT','VARIANT_SOURCE'].includes(code)?'practiceMode':'retry')),
      code==='VARIANT_UNAVAILABLE'?link(groupPath(ctx,s,'session/new',{mode:'practice'}),t('practiceMode'),'text-link'):null,
      link('offline',t('offline'),'text-link'),link('history',t('history'),'text-link')));
  }
  async function refresh({background=false}={}){
    const turn=++seq,mode=chooser.value;
    const fixed=mode==='assessment'||mode==='recovery'||similarMode();
    plan=null;launch.disabled=true;
    if(!background){
      error.replaceChildren();topic.textContent=tr(s.comp.title,ctx.lang);meta.textContent='';identity.replaceChildren();pre.replaceChildren();offline.hidden=true;
      launch.textContent=t('preparing');state.textContent=t('preparing');summary.textContent='';policy.textContent='';timeEstimate.textContent='';
    }
    if(!length.disabled)rememberedLength=length.value;
    length.disabled=fixed;length.required=!fixed;countField.hidden=fixed;shuffleField.hidden=fixed;timerField.hidden=mode!=='speed';
    try{
      try{player=await import('../player/start.mjs');}
      catch(err){
        // An evicted player module can prevent the launcher itself from loading.
        // Keep the installed package's diagnosis and repair action accessible.
        const {packageInventory,verifyPackage}=await import('../data/offline-verification.mjs');
        const copy=await verifyPackage(await packageInventory(ctx.signal),s.entry.package_id,s.entry.content_version);
        if(copy.state!=='ready')throw new Error('OFFLINE_'+copy.state.toUpperCase());
        throw err;
      }
      const prepared=await player.prepareSession(ctx,{grade:s.grade,level:s.level,operation:s.comp.operation,entry:s.entry,fromAttempt,fromItem,explicit_package:ctx.params.has('pack'),mode,retest:ctx.params.get('retest')==='1'});
      if(ctx.signal.aborted||turn!==seq)return;
      plan=prepared;error.replaceChildren();offline.hidden=false;length.max=String(plan.max);length.value=fixed?plan.max:rememberedLength;
      describe(plan);configure();
    }catch(err){if(!ctx.signal.aborted&&turn===seq){summary.textContent='';policy.textContent='';timeEstimate.textContent='';offline.hidden=true;state.textContent=t(mode+'Hint');launch.textContent=t('startSession');showError(err);}}
  }
  length.oninput=()=>{rememberedLength=length.value;configure();};shuffle.onchange=configure;duration.onchange=configure;pace.onchange=configure;temp.onchange=configure;chooser.onchange=refresh;
  form.onsubmit=async ev=>{
    ev.preventDefault();if(!plan||busy||launch.disabled)return;
    busy=true;launch.disabled=true;launch.setAttribute('aria-busy','true');launch.textContent=t('preparing');
    for(const c of [chooser,length,duration,shuffle])c.disabled=true;
    try{const id=await player.launchPrepared(ctx,plan);if(!ctx.signal.aborted){rememberMaterial(ctx.scope,s);ctx.go('session/'+encodeURIComponent(id));}}
    catch(err){if(!ctx.signal.aborted){showError(err);busy=false;launch.removeAttribute('aria-busy');chooser.disabled=duration.disabled=shuffle.disabled=false;length.disabled=plan.fixed;if(err.message.startsWith('OFFLINE_'))plan=null;configure();}}
  };
  form.append(topic,meta,material,labelled(t('mode'),chooser),state,e('div',{class:'field-grid'},countField,timerField),summary,policy,...(tempWarning ? [tempWarning] : []),error,e('div',{class:'actions launch-actions'},launch),advanced,supporting);
  const {watchInstalls}=await import('../data/offline-verification.mjs');
  await refresh();
  if(ctx.signal.aborted)return;
  // Render once at the prepared size. Inserting pack details between pointerdown
  // and pointerup can otherwise move a disclosure out from under the pointer.
  root.replaceChildren(aref(ctx,'','home'),heading(t('setup'),ctx.params.has('orientation')?t('orientationHelp'):null),form);
  watchInstalls(ctx.signal,()=>{if(!busy)refresh({background:true});});
}
export async function renderCatalog(ctx) {
  if(ctx.route==='curriculum')return curriculum(ctx);
  const s=await selection(ctx,ctx.material||{});
  if(ctx.signal.aborted)return;
  if(ctx.route==='packs'){rememberMaterial(ctx.scope,s);await catalogue(ctx,s);}
  else await setup(ctx,s);
}
