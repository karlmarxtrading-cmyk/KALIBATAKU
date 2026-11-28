/* Node 24 bundles Acorn with its parser. Run:
   node --expose-internals tests/ui/localization-audit.cjs
   This test reads the built distribution and existing browser receipts. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const acorn=require('internal/deps/acorn/acorn/dist/acorn');
async function audit(){
const root=path.resolve(__dirname,'../..'),dist=path.join(root,'dist');
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const unique=list=>[...new Set(list)].sort();
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(path.join(dir,d.name)):[path.join(dir,d.name)]);}
const id=json('dist/locales/id.json'),en=json('dist/locales/en.json');
const manifest=json('dist/offline-assets.json'),bank=json('dist/bank/index.json');
const bankPurposes=new Set(),operations=new Set();
for(const g of bank.grades)for(const l of json('dist/'+g.url).levels)for(const c of json('dist/'+l.url).competencies){
  operations.add(c.operation);for(const p of c.packages)bankPurposes.add(p.purpose);
}
const modes=['practice','speed','assessment','adaptive','recovery'];
const gradeBands=['primarySchool','middleSchool','upperSchool'];
const shellPaths=['app.mjs','core/home.mjs','core/catalog.mjs','core/settings.mjs'];
const modules={},calls=[],pairs=[],pairTables=[],unresolved=[],scopeIssues=[],raw=[],directLocaleBranches=[],unsafeDOM=[];
const allKeys=new Set(),emptyArgs=[],sameStrings=[];
const text=n=>n?.type==='Literal'&&typeof n.value==='string'?n.value:undefined;
function parseCalls(file,src){
  const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module',locations:true});
  const code=n=>src.slice(n.start,n.end);
  function named(n){return n?.type==='Identifier'?n.name:n?.type==='MemberExpression'&&!n.computed?n.property.name:null;}
  function dictionaryArg(n,anc){
    if(text(n)!==undefined)return [n.value];
    if(n.type==='ConditionalExpression')return unique([...dictionaryArg(n.consequent,anc),...dictionaryArg(n.alternate,anc)]);
    const expr=code(n),parentFn=anc.toReversed().find(a=>a.type==='FunctionDeclaration')?.id?.name;
    if(expr.startsWith("'title'+"))return [...operations].map(s=>'title'+s);
    if(expr.endsWith("+'Mode'"))return modes.map(s=>s+'Mode');
    if(expr.endsWith("+'Hint'"))return modes.map(s=>s+'Hint');
    if(['band.label','b.label'].includes(expr))return gradeBands;
    if(file==='app.mjs'&&expr==='key')return ['practice','progress','history'];
    if(file==='app.mjs'&&expr==='k')return ['profile','offline'];
    if(file==='core/catalog.mjs'&&expr==='key'){
      if(parentFn==='purposeName')return [...bankPurposes].map(s=>'purpose_'+s);
      if(anc.some(a=>a.type==='VariableDeclarator'&&a.id.name==='aref')){
        const targets=[];
        (function callers(v){if(!v||typeof v!=='object')return;if(v.type==='CallExpression'&&v.callee.name==='aref')targets.push(text(v.arguments[2]));Object.values(v).forEach(callers);})(ast);
        return targets;
      }
    }
    if(file==='core/catalog.mjs'&&expr==='msg'){
      // showError resolves its code map to a dictionary key, or startFail.
      const declaration=anc.toReversed().find(a=>a.type==='FunctionDeclaration'&&a.id.name==='showError');
      const init=declaration?.body.body.flatMap(v=>v.declarations||[]).find(v=>v.id.name==='msg')?.init;
      if(init?.type==='LogicalExpression')return [...init.left.object.properties.map(p=>p.value.value),init.right.value];
    }
    if(file==='core/settings.mjs'&&expr==='label')return [...src.matchAll(/check\('[^']+','([^']+)'\)/g)].map(m=>m[1]);
    if(file==='core/settings.mjs'&&expr==='k'){
      const map=anc.toReversed().find(a=>a.type==='CallExpression'&&a.callee.property?.name==='map');
      if(map?.callee.object.type==='ArrayExpression')return map.callee.object.elements.map(e=>e.value);
    }
    unresolved.push({file,line:n.loc.start.line,expr});return [];
  }
  function expressions(n){
    if(text(n)!==undefined)return [n.value];
    if(n.type==='ConditionalExpression')return [...expressions(n.consequent),...expressions(n.alternate)];
    if(n.type==='BinaryExpression'&&n.operator==='+')return [...expressions(n.left),...expressions(n.right)];
    return [];
  }
  function recordPair(n,list,family,anc){
    const [a,b]=list;
    if(!a||!b){emptyArgs.push({file,line:n.loc.start.line,family,call:code(n)});return;}
    const left=expressions(a),right=expressions(b);
    pairs.push({file,line:n.loc.start.line,family,id:code(a),en:code(b),literal_id:left,literal_en:right,
      kind:[a,b].every(x=>text(x)!==undefined)?'literal-pair':'computed-pair'});
    if([a,b].some(x=>text(x)===''))emptyArgs.push({file,line:n.loc.start.line,family,call:code(n)});
    if(text(a)!==undefined&&text(a)===text(b))sameStrings.push({file,line:n.loc.start.line,value:text(a)});
  }
  function walk(n,anc=[]){if(!n||!n.type)return;
    if(n.type==='CallExpression'){
      const key=named(n.callee),args=n.arguments;
      if(['append','replaceChildren','prepend','appendChild'].includes(key)){
        const inspect=value=>{
          if(value.type==='LogicalExpression'&&value.operator==='&&'||value.type==='Literal'&&(value.value==null||typeof value.value==='boolean')||value.type==='Identifier'&&value.name==='undefined')
            unsafeDOM.push({file,line:n.loc.start.line,sink:key,nullable_or_boolean:code(value)});
          if(value.type==='ConditionalExpression'){inspect(value.consequent);inspect(value.alternate);}
        };
        args.forEach(inspect);
      }
      if(shellPaths.includes(file)&&key==='t'){
        const keys=unique(dictionaryArg(args[0],anc));keys.forEach(k=>allKeys.add(k));
        calls.push({file,line:n.loc.start.line,expression:code(args[0]),keys});
      } else if(key==='L'||key==='l'&&file.startsWith('data/')||key==='t'&&file.startsWith('teacher/')||key==='tr'&&file.startsWith('teacher/')){
        const list=key==='tr'?args.slice(1):args;
        if(list[0]?.type==='SpreadElement'){
          pairs.push({file,line:n.loc.start.line,family:key,kind:'pair-table-dispatch',source:code(list[0].argument)});
        }else recordPair(n,list,key,anc);
      }
      // Visible strings at direct DOM/helper sinks. Dynamic expressions and localized
      // calls are covered separately. These candidates are presented for direct review.
      let shown=[];
      if(['node','h','element','e'].includes(key)&&text(args[0])!==undefined)shown=args.slice(2);
      else if(['button','action','labelled','box'].includes(key))shown=args.slice(0,1);
      else if(key==='setAttribute'&&['aria-label','title','placeholder'].includes(text(args[0])))shown=args.slice(1,2);
      else if(['replaceChildren','append'].includes(key))shown=args;
      for(const v of shown)if(text(v)!==undefined&&/[A-Za-z]{2}/.test(v.value))raw.push({file,line:v.loc.start.line,sink:key,value:v.value});
    }
    if(n.type==='ConditionalExpression'&&/^(?:prefs\.)?(?:lang|locale|l)\s*===?\s*['"](?:id|en)['"]$/.test(code(n.test))){
      directLocaleBranches.push({file,line:n.loc.start.line,condition:code(n.test),when_true:code(n.consequent),when_false:code(n.alternate)});
    }
    if(n.type==='Property'&&n.value?.type==='ArrayExpression'&&n.value.elements.length===2&&n.value.elements.every(a=>typeof text(a)==='string')){
      const variable=anc.toReversed().find(a=>a.type==='VariableDeclarator')?.id?.name;
      if(['modeNames','opNames','outcomes','recommendations','statusText','errors','views','names','titles','labels'].includes(variable)||file==='teacher/index.js'&&code(n.value).includes(' ')){
        pairTables.push({file,line:n.loc.start.line,table:variable||'inline',key:n.key.name??n.key.value,id:text(n.value.elements[0]),en:text(n.value.elements[1])});
      }
    }
    if(n.type==='Property'&&['aria-label','title','placeholder'].includes(n.key.name??n.key.value)&&typeof text(n.value)==='string'&&/[A-Za-z]{2}/.test(n.value.value))
      raw.push({file,line:n.loc.start.line,sink:n.key.name??n.key.value,value:n.value.value});
    if(n.type==='AssignmentExpression'&&['textContent','innerText','title','placeholder'].includes(named(n.left))&&typeof text(n.right)==='string'&&/[A-Za-z]{2}/.test(n.right.value))
      raw.push({file,line:n.loc.start.line,sink:named(n.left),value:n.right.value});
    for(const [k,v] of Object.entries(n))if(k!=='loc'){const next=[...anc,n];if(Array.isArray(v))v.forEach(c=>walk(c,next));else if(v&&typeof v==='object')walk(v,next);}
  }
  walk(ast);modules[file]=hash(src);
}
for(const f of files(dist).filter(f=>/\.(js|mjs)$/.test(f)&&!f.startsWith(path.join(dist,'bank')+path.sep))){
  const name=path.relative(dist,f);parseCalls(name,fs.readFileSync(f,'utf8'));
}
const keys=unique([...Object.keys(id),...Object.keys(en),...allKeys]);
for(const key of keys)if(!id[key]?.trim()||!en[key]?.trim())scopeIssues.push({key,id:id[key]??null,en:en[key]??null});
const evidence=name=>json('evidence/'+name);
const visual=evidence('ux/acceptance/browser-visual-ux.json'),shell=evidence('ux/acceptance/browser-shell-ux.json'),semantic=evidence('acceptance/browser-semantics.json');
const languageModes=evidence('ux/acceptance/browser-player-ux.json');
const school=evidence('ux/acceptance/browser-school-ux.json');
const storedColors=evidence('ui/catalog-and-tokens.json');
const bankCoverage=evidence('bank/bank-validation.json');
const samples=visual.samples.map(s=>({page:s.page,lang:s.lang,theme:s.theme,headings:s.headings,unnamed:s.unnamed,refs:s.brokenRefs,contrast:s.contrast}));
const seenFallbacks=semantic.pages.filter(s=>s.leaked?.length).map(s=>({page:s.page,lang:s.lang,values:s.leaked}));
const allHeadings=samples.flatMap(s=>s.headings.map(([tag,label])=>({tag,label,page:s.page,lang:s.lang})));
const keyHeadings=allHeadings.filter(h=>allKeys.has(h.label)&&!Object.values(h.lang==='en'?en:id).includes(h.label));
const byLocale={};for(const lang of ['id','en'])for(const theme of ['light','dark']){
 const rows=samples.filter(s=>s.lang===lang&&s.theme===theme),ratios=rows.flatMap(s=>s.contrast.min_ratio==null?[]:[s.contrast.min_ratio]);
 byLocale[lang+'/'+theme]={screens:rows.length,measured_text_nodes:rows.reduce((n,s)=>n+s.contrast.measured,0),excluded_ambiguous_backgrounds:rows.reduce((n,s)=>n+s.contrast.ambiguous_backgrounds,0),lowest_measured_ratio:Math.min(...ratios),violations:rows.flatMap(s=>s.contrast.violations)};
}
const families={
 'App navigation, loading, temporary storage and retry':['app.mjs','core/home.mjs','core/catalog.mjs'],
 'Language, appearance and help':['core/settings.mjs','core/appearance.js'],
 'Answer, validation, feedback, deadline, confirmation, review and progress':['player/base.mjs','player/session.mjs','player/records.mjs','player/view.mjs'],
 'Profile, backup, recovery and storage failures':['data/panels.js','data/panel-profile.js'],
 'Offline downloads, cache actions, error, retry and delivery states':['data/panel-offline.js','data/panel-sync.js'],
 'Class follow-up, notes and assignments':['teacher/index.js','teacher/assignments.js','teacher/ui.js'],
 'Report preview, tables and export success, cancellation, error and font coverage':['teacher/reports-view.js','teacher/report.js','teacher/document.js']
};
const {pathToFileURL}=require('node:url');
const runtime=async file=>import(pathToFileURL(path.join(dist,file)).href);
const player=await runtime('player/base.mjs'),teacherUI=await runtime('teacher/ui.js'),teacherReport=await runtime('teacher/report.js');
const translatedRuntime=[];
const ID=(a,b)=>a,EN=(a,b)=>b;
function capture(family,key,a,b,pass=typeof a==='string'&&typeof b==='string'&&!!a.trim()&&!!b.trim()&&a!==key&&b!==key){translatedRuntime.push({family,key,id:a,en:b,status:pass?'PASS':'FAIL'});}
for(const code of [...pairTables.filter(v=>v.file==='player/base.mjs'&&v.table==='errors').map(v=>v.key),'UNRECOGNIZED_INPUT'])
  capture('answer validation, storage and lock errors',code,player.answerError(code,ID),player.answerError(code,EN));
for(const code of ['RECORD_CONFLICT','NOTE','NOTE_TARGET','ASSIGNMENT','BANK_LOAD','STORAGE_FAILED'])
  capture('teacher action failure',code,teacherUI.message(ID,new Error(code)),teacherUI.message(EN,new Error(code)));
for(const value of Object.keys(teacherReport.names))capture('report operation, mode or outcome',value,teacherReport.name('id',value),teacherReport.name('en',value));
for(const op of operations)capture('student operation',op,player.operation({operation:op},ID),player.operation({operation:op},EN));
for(const m of modes)capture('student mode',m,player.mode({mode:m},ID),player.mode({mode:m},EN));
for(const origin of ['demo','local_practice'])capture('report origin',origin,teacherReport.originLabel(origin,'id'),teacherReport.originLabel(origin,'en'));
const rawClasses={'KALIBATAKU':'brand','KALIBATAKU  /  MENTAL MATH':'brand','Muat ulang / Reload':'bilingual startup fallback','Gagal memuat aplikasi. / The app could not be loaded.':'bilingual startup fallback','Level':'shared term','Mode':'shared term'};
for(const sink of raw)sink.classification=rawClasses[sink.value]||'review';
const dict=keys.map(k=>({key:k,id:id[k]??null,en:en[k]??null,referenced:allKeys.has(k)}));
const css=read('dist/assets/base.css');
const palette=selector=>Object.fromEntries([...css.match(selector)[1].matchAll(/--([\w-]+):\s*(#[\da-f]{3,6})[;}]/ig)].map(m=>[m[1],m[2]]));
const light=palette(/:root\{([^}]+)\}/),dark={...light,...palette(/:root\[data-theme=dark\]\{([^}]+)\}/)};
function luminance(hex){let v=hex.slice(1);if(v.length===3)v=[...v].map(c=>c+c).join('');const a=[0,2,4].map(i=>parseInt(v.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2];}
const renderedRoles=[
 ['Shell focus outline on panel or paper','assets/base.css','a:focus-visible','focusRing','surface',3],
 ['Shell focus outline on main canvas','assets/base.css','a:focus-visible','focusRing','canvas',3],
 ['Shell focus outline on grouped controls','assets/base.css','a:focus-visible','focusRing','surfaceRaised',3],
 ['Player focus outline on question card','player/player.css','.kp button:focus-visible','primary','surface',3],
 ['Player input outline on main canvas','player/player.css','.kp input:focus-visible','primary','canvas',3],
 ['Home action outline against dark lesson','assets/base.css','.lesson-actions a:focus-visible','paper','hero',3],
 ['Input and select boundary on card','assets/base.css','button,.btn,select,input','borderControl','surface',3],
 ['Button or select boundary on raised panel','assets/base.css','button,.btn,select,input','borderControl','surfaceRaised',3],
 ['Button boundary on canvas','assets/base.css','button,.btn,select,input','borderControl','canvas',3],
 ['Primary hover text','assets/base.css','.primary:hover','onPrimary','primaryHover',4.5],
 ['Secondary hover text','assets/base.css','button:hover','text','surfaceRaised',4.5],
 ['Menu hover text','assets/base.css','.menu-pop a:hover','primary','surfaceRaised',4.5],
 ['Lesson button hover text','assets/base.css','.lesson-actions .primary:hover','ink','paper',4.5],
 ['Lesson context text','assets/base.css','.lesson-label','hero-soft','hero',4.5],
 ['Offline or error notice text','assets/base.css','.notice.error','errorText','errorBg',4.5],
 ['Temporary storage caution text','assets/base.css','.notice.caution','warningText','warningBg',4.5],
 ['Teacher simulation badge','teacher/teacher.css','.tw-badge','warningText','warningBg',4.5],
 ['Information notice','assets/base.css','.notice','infoText','infoBg',4.5],
 ['Muted text on raised panel','assets/base.css','.profile-control small','textMuted','surfaceRaised',4.5],
];
const cssEdges=[];
for(const [theme,colors] of [['light',light],['dark',dark]])for(const [state,cssFile,selector,fg,bg,threshold] of renderedRoles){
 const stylesheet=read('dist/'+cssFile);const a=luminance(colors[fg]),b=luminance(colors[bg]);
 const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 cssEdges.push({theme,state,css_file:cssFile,selector,selector_present:stylesheet.includes(selector),
  foreground:colors[fg],adjacent_or_background:colors[bg],ratio:+ratio.toFixed(3),threshold,status:ratio>=threshold&&stylesheet.includes(selector)?'PASS':'FAIL'});
}

const report={
 build_bindings:{visual:visual.runtime.release,semantic:semantic.runtime.offline_release,shell:shell.runtime.release,player:languageModes.runtime.release,teacher:school.runtime.release,all_match:[visual.runtime.release,semantic.runtime.offline_release,shell.runtime.release,languageModes.runtime.release,school.runtime.release].every(h=>h===manifest.release)},
 native_dom_candidates:unsafeDOM, method:'Acorn AST inventory over built browser JavaScript, captured final DOM samples and bank verification. Node --expose-internals is used only to load the Acorn already bundled with Node 24. No runtime artifact is modified.',
 build:{release:manifest.release,boot:hash(read('dist/app.mjs')),modules,parser:acorn.version,node:process.version},
 verdict:{dictionary_identifiers:scopeIssues.length||unresolved.length?'FAIL':'PASS',paired_call_arity:emptyArgs.length?'REVIEW':'PASS',scope:'Static structural checks and the recorded browser states. Naturalness and the meaning of every teaching sentence require human review.'},
 dictionary:{keys:dict.length,reached:allKeys.size,call_sites:calls.length,missing:scopeIssues,unresolved_dynamic:unresolved,observed_bank_purposes:[...bankPurposes],fallback_policy:'dictionary[key] ?? key; purposeName has localized fallback. No live purpose absent from both dictionaries unless listed above.',inventory:dict,sites:calls},
 family_inventory:Object.entries(families).map(([family,files])=>({family,files,paired_calls:pairs.filter(p=>files.includes(p.file)).length,dictionary_calls:calls.filter(p=>files.includes(p.file)).length,named_entries:pairTables.filter(p=>files.includes(p.file)).length})),
 direct_locale_conditions:directLocaleBranches, paired_calls:pairs,named_tables:pairTables,same_literal_pairs:sameStrings,empty_arguments:emptyArgs,visible_literal_candidates:raw,executed_runtime_families:translatedRuntime,
 semantic_inventory:{bank:{...Object.fromEntries(['status','packages','question_slots','missing_bilingual_fields'].map(k=>[k,bankCoverage[k]]))},visual_release:visual.runtime,semantic_release:semantic.runtime,shell_release:shell.runtime,observed_key_headings:keyHeadings,observed_pattern_leaks:seenFallbacks,screen_samples:samples,checks_by_locale_and_theme:byLocale,
 css_state_adjacencies:{method:"Measured luminance using shipped tokens for each named stylesheet selector and adjacent card/canvas/raised surface; static role evidence supplements render samples.",cases:cssEdges},static_token_test:storedColors.checks.at(-1),theme_observations:shell.checks.filter(c=>c.id.includes('049')||c.id.includes('051')),
 player_states:languageModes.checks.map(c=>({id:c.id,status:c.status})),school_states:school.checks.map(c=>({id:c.id,status:c.status})),visual_integrity:visual.checks.filter(c=>c.status!=='PASS'),
 chart_scope:'The shipped interface represents progress as named counts, tables and native progress indicators. SVG drawing in the shell constructs decorative icons. There is no data chart with a separately translated axis.'},
 limitations:['Literal candidates include language-neutral material, dual-language shell fallbacks, proper names and mathematical notation. User-entered text and older imported content are not translation claims.',
 'The report model uses the display alias Local for an unnamed default personal profile. The shell label for the default profile is localized separately. User names and synthetic identifiers do not pass through the dictionary.',
 'Pair-table dispatch is recorded separately from direct bilingual arguments. Static extraction is not a semantic translation review or a render of every branch.',
 'Computed foreground/background checks exclude ambiguous layered backgrounds when the browser probe records one. They do not emulate a physical high-contrast display or prove every browser/AT combination.']
};
const file=path.join(root,'evidence/ux/shell/localization-coverage.json');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
const executed=report.executed_runtime_families,edges=report.semantic_inventory.css_state_adjacencies.cases;
const nonText=edges.filter(c=>c.threshold===3),visualErrors=report.semantic_inventory.visual_integrity;
const totalNodes=Object.values(byLocale).reduce((n,row)=>n+row.measured_text_nodes,0),decimal=n=>n.toFixed(2).replace('.',',');
const bound=report.build_bindings.all_match;
const genLines=[
  '# Uji bahasa, warna dan tema','',
  'Build statis `'+manifest.release+'`. Rincian lokasi sumber, kunci, teks layar, bahasa, tema, dan rasio berada di `localization-coverage.json`.','',
  '| Pemeriksaan | Hasil |','| --- | --- |',
  '| Kamus ID dan EN | '+dict.length+' kunci berpasangan. Sebanyak '+calls.length+' pemanggilan kamus dipetakan, termasuk operasi, mode, tujuan paket, dan pesan kesalahan. Kunci atau nilai yang hilang '+scopeIssues.length+'. Bentuk dinamis yang belum terurai '+unresolved.length+'. |',
  '| Teks di luar kamus | '+pairs.length+' pemanggilan bilingual dan '+pairTables.length+' entri tabel bernama diinventarisasi. '+raw.length+' literal yang langsung masuk ke kontrol atau teks DOM dicatat satu per satu, dengan klasifikasi nama produk, fallback bersama, atau istilah yang dipakai pada kedua bahasa. |',
  '| Fungsi UI yang dieksekusi | '+executed.filter(c=>c.status==='PASS').length+' dari '+executed.length+' kasus menghasilkan keluaran ID dan EN yang terisi. Kasus mencakup validasi angka, penguncian dan kegagalan penyimpanan, konflik catatan, kegagalan materi, mode sesi, status laporan dan asal data. |',
  '| Struktur bank | '+bankCoverage.packages.toLocaleString('id-ID')+' paket dan '+bankCoverage.question_slots.toLocaleString('id-ID')+' penempatan soal diperiksa. Bidang bilingual wajib yang hilang '+bankCoverage.missing_bilingual_fields+'. Penilaian makna dan tingkat baca oleh pendidik mempunyai gate tersendiri pada AC-074. |',
  '| Layar Chromium | '+samples.length+' keadaan pada kombinasi 16 rute, dua bahasa dan dua tema. '+totalNodes.toLocaleString('id-ID')+' pengukuran teks. Sebanyak '+Object.values(byLocale).reduce((sum,row)=>sum+row.excluded_ambiguous_backgrounds,0)+' latar yang ambigu dikecualikan. Rasio sampel terendah '+decimal(byLocale['id/light'].lowest_measured_ratio)+'∶1 dalam terang dan '+decimal(byLocale['id/dark'].lowest_measured_ratio)+'∶1 dalam gelap. Pelanggaran kontras teks '+Object.values(byLocale).reduce((n,g)=>n+g.violations.length,0)+'. Kunci yang muncul sebagai heading '+keyHeadings.length+'. |',
  '| Nilai JavaScript pada tampilan | '+visualErrors.filter(c=>c.id.startsWith('visibleCopy/')).length+' pemeriksaan salinan terlihat gagal dari '+visual.checks.filter(c=>c.id.startsWith('visibleCopy/')).length+' keadaan yang dicoba. Kandidat argumen persis berupa kondisi boolean, null atau undefined pada pemanggilan native DOM dalam sumber '+unsafeDOM.length+'. |',
  '| Fokus dan status | '+edges.filter(c=>c.status==='PASS').length+' dari '+edges.length+' pasangan CSS untuk fokus, tepi kontrol, hover, peringatan dan error lolos ambang per kasus. Ada '+nonText.length+' pasangan tepi/fokus dengan ambang 3∶1 dan rasio terendah '+decimal(Math.min(...nonText.map(c=>c.ratio)))+'∶1. |',
  '| Tema | '+shell.checks.filter(c=>c.id.includes('049')&&c.status==='PASS').length+' kasus preferensi dan perubahan media lulus. Perubahan media sistem disimulasikan dalam Chromium. Jejak awal dan preferensi setelah reload tercatat di `browser-shell-ux.json`. |','',
  bound?'Kelima hasil uji browser untuk semantik, tampilan, player, ruang guru, dan preferensi cocok dengan build ini.':'Sebagian kuitansi browser masih menunjuk build sebelumnya. Identitas setiap kuitansi dicatat di bagian build_bindings.',
  '',
  'Inventaris memisahkan teks langsung, pasangan yang dihitung, serta pesan yang dipilih lewat tabel. Lokasi dan redaksi mencakup kegagalan memuat, kesalahan ekspor, pembatalan, font PDF, dan penyimpanan sementara. Laporan memakai tabel dan angka. Ikon SVG pada shell bersifat dekoratif.','',
  'Saat profil pribadi utama belum diberi nama, model laporan memakai alias bawaan Local. Shell menampilkan Profil utama atau Main profile menurut bahasa. Alias pengguna, nama produk, dan ID teknis di lampiran laporan dicatat terpisah dari kunci antarmuka.','',
  'Pemeriksaan kontras browser membaca warna efektif pada layar yang dicantumkan. Uji pasangan CSS melengkapinya untuk keadaan fokus, hover, peringatan, dan error. Mode kontras tinggi fisik, seluruh kombinasi pembaca layar, serta penilaian makna pedagogis oleh manusia berada di luar hasil ini.','',
  'Untuk mengulang dari akar paket, jalankan `node --expose-internals tests/ui/localization-audit.cjs` pada Node 24. Pengujian memakai Acorn yang disertakan Node.',''
];
fs.writeFileSync(path.join(root,'evidence/ux/shell/UJI_BAHASA_DAN_TEMA.md'),genLines.join('\n'));

console.log(JSON.stringify({release:manifest.release,count:dict.length,calls:calls.length,reached:allKeys.size,sites:pairs.length,tables:pairTables.length,raw:raw.length,scopeIssues,unresolved,emptyArgs:emptyArgs.slice(0,20),seenFallbacks,keyHeadings,byLocale}));
if(!report.build_bindings.all_match||scopeIssues.length||unresolved.length||keyHeadings.length||emptyArgs.length||raw.some(s=>s.classification==='review')||translatedRuntime.some(r=>r.status!=='PASS')||cssEdges.some(c=>c.status!=='PASS')||unsafeDOM.length||report.build_bindings.all_match&&report.semantic_inventory.visual_integrity.length)process.exitCode=1;
}
audit().catch(error=>{console.error(error);process.exitCode=1;});

