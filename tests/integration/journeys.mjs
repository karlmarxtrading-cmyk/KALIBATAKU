import {delay,until,visible,name,button,geometry,semantics,resources,resize,route,chooseLang,wideLayoutSnapshot} from './probes.mjs';

async function click(w,pattern) {
  const b=await until(()=>button(w.document,pattern), 'Button '+pattern);
  b.click();return b;
}
function type(w,value) {
  const n=w.document.querySelector('.app-view:not([inert]):not([aria-busy]) .kp-answer');
  if(!n)throw Error('Answer input missing');
  n.focus();n.value=value;n.dispatchEvent(new w.Event('input',{bubbles:true}));
}
async function start(w,base,mode,grade=1,level=1,op='ADD'){
  const d=await route(w,base,'session/new?grade='+grade+'&level='+level+'&op='+op+'&mode='+mode);
  const modeDrop=[...d.querySelectorAll('select')].find(s=>Array.from(s.options).some(o=>o.value===mode));
  if(modeDrop){modeDrop.value=mode;modeDrop.dispatchEvent(new w.Event('change',{bubbles:true}));}
  (await until(()=>d.querySelector('form.setup button[type=submit]:not(:disabled)'), 'Start confirmed session',20000)).click();
  await until(()=>w.document.querySelector('.app-view:not([inert]):not([aria-busy]) .kp-answer')&&!w.location.hash.includes('/new'),'Active '+mode,15000);
  return w.location.hash.slice('#/session/'.length);
}
async function finalize(w){
  // 1.4: practice ends via 'Akhiri latihan' + 'Selesaikan dan lihat hasil' (no review grid);
  // assessment keeps 'Tinjau & kirim' + 'Kirim hasil akhir'.
  await click(w,/^(Selesaikan sesi|Akhiri latihan|Akhiri misi|Tinjau & kirim|Finish session|End practice|End mission|Review & submit)$/i);
  await click(w,/^(Kirim hasil akhir|Selesaikan dan lihat hasil|Submit final answers|Finish and see results)$/i);
  await until(()=>w.location.hash.startsWith('#/results/'),'Final result',12000);
  await until(()=>w.document.querySelector('main h1'),'Results heading');
}
export async function runJourneys(w,r,base,check){
  r.journeys=[];
  await route(w,base,'');await chooseLang(w,'id');
  const p=await route(w,base,'profiles');
  const alias='QA journey '+crypto.randomUUID().slice(0,8);
  const nick=p.querySelector('main input[type=text]');const section=nick.closest('details');if(section&&!section.open)section.querySelector('summary').click();nick.value=alias;nick.dispatchEvent(new w.Event('input',{bubbles:true}));
  await click(w,/^Buat (dan gunakan )?profil$/);await until(()=>[...p.querySelectorAll('select option:checked')].some(n=>n.textContent===alias),'Test profile selected');
  await route(w,base,'settings');
  const motion=w.document.querySelector('[name=reduceMotion]'), timer=w.document.querySelector('[name=showTimer]');
  const state={motion:motion.checked,timer:timer.checked};
  if(!motion.checked)motion.click();if(timer.checked)timer.click();
  check(r,'reduced-motion',w.document.documentElement.dataset.reduceMotion==='true','Reduced-motion setting applied');
  const stages=[['practice',1,1,'ADD'],['recovery',1,1,'ADD'],['assessment',7,2,'SUB'],['speed',6,2,'DIV'],['adaptive',12,2,'MIX']];
  for(const [mode,grade,level,op] of stages){
    const record={mode,grade,level,op};r.journeys.push(record);
    try{
      if(mode==='speed'){
        const cfg=await route(w,base,'settings'),counter=cfg.querySelector('[name=showTimer]');
        if(counter.checked)counter.click();
      }
      const id=await start(w,base,mode,grade,level,op);
      record.attempt=id;record.expression=w.document.querySelector('#kp-expression')?.dataset.linear;
      record.spoken=w.document.querySelector('[role=math]')?.getAttribute('aria-label');
      record.loaded=resources(w);
      record.inputType=w.document.querySelector('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.type;
      record.t=semantics(w);
      const playerRequests=resources(w).length;
      check(r,'player-'+mode,record.inputType==='text'&&!!record.expression&&!!record.spoken,record.expression);
      if(mode==='practice'){
        await resize(w,390,430);record.narrow=geometry(w);
        await resize(w,320,568);const root=w.document.documentElement,original=root.style.fontSize;
        root.style.fontSize='32px';await delay(80);const enlarged=geometry(w);
        check(r,'player-200',enlarged.scroll<=enlarged.viewport+2,{geometry:enlarged});root.style.fontSize=original;await resize(w,390,430);
        const keypad=w.document.querySelector('.kp-pads');
        const chooser=keypad.closest('details');if(chooser&&!chooser.open)chooser.querySelector('summary').click();
        const symbols=[...keypad.querySelectorAll('button')];
        const entered=w.document.querySelector('.app-view:not([inert]):not([aria-busy]) .kp-answer');
        const replaces=[];
        for(const n of symbols){
          type(w,'1278');entered.setSelectionRange(1,3);n.click();
          const symbol=n.textContent==='−'?'-':n.textContent;
          replaces.push({label:n.getAttribute('aria-label')||n.textContent,value:entered.value,caret:entered.selectionStart,focused:entered===w.document.activeElement,expected:'1'+symbol+'8'});
        }
        check(r,'keypad-middle-selection',replaces.length===3&&replaces.every(x=>x.value===x.expected&&x.caret===2&&x.focused&&x.label),replaces);
        type(w,'');for(const n of symbols)n.click();
        const actual=entered.value;
        // Chrome's window manager may clamp a popup. Preserve the target geometry
        // by laying out the same rendered markup and production CSS at 390 x 430.
        const measureFit=win=>{
          const doc=win.document;
          const rect=selector=>{const element=doc.querySelector(selector);element.scrollIntoView({block:'center',behavior:'instant'});const box=element.getBoundingClientRect();return {top:box.top,bottom:box.bottom,width:box.width};};
          return {height:win.innerHeight,width:win.innerWidth,input:rect('.kp-answer'),submit:rect('[data-submit]'),tap_sizes:[...doc.querySelectorAll('.kp-pads button')].map(n=>[n.offsetWidth,n.offsetHeight])};
        };
        const live=w.innerWidth===390&&w.innerHeight===430;
        const fit=live?measureFit(w):await wideLayoutSnapshot(w,390,430,measureFit);
        const inside=box=>box.top>=0&&box.bottom<=fit.height;
        check(r,'short-viewport-keypad',(['−/,','-/,'].includes(actual))&&fit.height===430&&fit.width===390&&inside(fit.input)&&inside(fit.submit)&&fit.tap_sizes.every(([a,b])=>a>=44&&b>=44),{actual,...fit,live_window:[w.innerWidth,w.innerHeight],device:live?'Resized desktop Chromium; physical IME not measured':'Exact 390 × 430 CSS viewport using snapshot of the controls exercised in live Chromium; physical IME not measured'});
        check(r,'untimed-practice',!w.document.querySelector('[role=timer]'),'No deadline display on practice');
        type(w,'1,');await chooseLang(w,'en');
        check(r,'locale-dirty',w.document.querySelector('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value==='1,'&&w.document.querySelector('[data-separator]')?.textContent===',','ID draft and keypad at EN');
        await chooseLang(w,'id');type(w,'1/0');await click(w,/Periksa · Enter$/i);
        await until(()=>w.document.querySelector('[role=alert]'),'Format alert');
        check(r,'bad-input',!w.document.querySelector('[data-answer-feedback]'),w.document.querySelector('[role=alert]').innerText);
        type(w,'9999');await click(w,/Periksa · Enter$/i);await until(()=>w.document.querySelector('[data-answer-feedback]'),'Feedback');
        check(r,'valid-wrong',w.document.querySelector('[data-answer-feedback]').innerText.includes('Belum tepat'),'Wrong feedback');
        await click(w,/^Soal berikutnya · Enter$/i);await until(()=>w.document.querySelector('progress')?.value===2,'Second question');
        type(w,'2/');await until(()=>w.document.querySelector('.kp-question > .kp-row:last-child small')?.textContent.includes('Tersimpan'),'Draft transaction committed');const oldExpr=w.document.querySelector('#kp-expression').dataset.linear;
        const beforeReload=w.document;w.location.reload();await until(()=>w.document!==beforeReload,'Reload committed');await until(()=>w.document.querySelector('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value==='2/','Draft preserved after reload',15000);
        check(r,'resume-order',w.document.querySelector('#kp-expression').dataset.linear===oldExpr,'Same problem and unfinished draft');
        type(w,'1');
      } else if(mode==='assessment'){
        type(w,'4');(await until(()=>w.document.querySelector('[data-submit]'),'Save and advance')).click();await delay(150);
        check(r,'assessment-hidden',!w.document.querySelector('[data-answer-feedback]')&&!button(w.document,/Petunjuk/i),'No feedback or hint control');
        type(w,'4/');await click(w,/Tinjau & kirim/i);await click(w,/Kirim hasil akhir/i);
        await until(()=>w.document.querySelector('.kp-answer[aria-invalid=true]'),'Dirty assessment blocked');
        check(r,'dirty-block',w.location.hash.startsWith('#/session/')&&w.document.querySelector('.app-view:not([inert]):not([aria-busy]) .kp-answer').value==='4/','State remains editable');
        await click(w,/^Tandai kosong$/i);
      } else {
        if(mode==='speed')check(r,'hidden-timer',!w.document.querySelector('[role=timer]'),'Hidden timer preference in speed mode; fixed deadline tested by domain suite');
        type(w,'1');await click(w,/Periksa · Enter/i);await until(()=>w.document.querySelector('[data-answer-feedback]'),'Check '+mode);
      }
      const afterRequests=resources(w).slice(playerRequests);
      if(mode!=='practice') check(r,'next-network-'+mode,!afterRequests.some(x=>/\/bank\/.*\.mjs$/.test(x.path)),'No fresh pack during item response');
      await finalize(w);
      record.results=w.document.querySelector('main').innerText.slice(0,750);
      await route(w,base,'review/'+id);record.review=geometry(w).h1;
      check(r,'review-'+mode,!!record.review.length,'Review displays');
    } catch(e){record.error=e.message;record.current=w.document.querySelector('main')?.innerText?.slice(0,1050);check(r,'journey-'+mode,false,e.message);}
  }
  const settings=await route(w,base,'settings');
  for(const [key,prior] of [['reduceMotion',state.motion],['showTimer',state.timer]]){
    const f=settings.querySelector('[name='+key+']');if(f.checked!==prior)f.click();
  }
}
export async function runFaults(w,r,base,check){
  r.scope='Local server returns one synthetic 503 for root bank metadata, and delays metadata by 600 ms on a separate test base.';
  const stamp=Date.now();
  const bad=new URL('/probe-fault-'+stamp+'/school/math/',base).href;
  w.location.href=bad+'#/curriculum';
  let retry=await until(()=>button(w.document,/Coba lagi|Retry|Muat ulang/i),'Retry after 503',12000);
  r.failure=w.document.querySelector('main').innerText;retry.click();
  await until(()=>!button(w.document,/^Coba lagi$|^Retry$/i)&&w.document.querySelector('main a[href*="grade="]'),'Catalog recovered');
  check(r,'503-recovery',!!w.document.querySelector('main a[href*="grade="]'),r.failure);
  const slow=new URL('/probe-slow-'+stamp+'/school/math/',base).href;
  await route(w,slow,'');let path='curriculum?grade=1';let before=w.performance.now();w.location.hash='/'+path;
  await until(()=>w.document.querySelector('[aria-busy=true],.skeleton,[role=status]')?.textContent?.trim(),'Loading feedback',1600);
  r.feedback_latency_ms=Math.round(w.performance.now()-before);
  w.location.hash='/settings';
  await until(()=>w.document.querySelector('[name=theme]'),'Last navigation');
  await delay(1500);
  check(r,'stale-request',w.location.hash==='#/settings'&&!!w.document.querySelector('[name=theme]'),'Delayed metadata leaves last selection intact');
  await route(w,base,'unknown-release-check');
  check(r,'unknown-route',!!w.document.querySelector('main a'),w.document.querySelector('main').innerText.slice(0,250));
}
