import {mountEnter,compositionActive} from '../core/enter-cycle.mjs';
import {clearMath,formula,mathProse} from '../math/view.mjs';
import {asRational,enteredAst,decimalPreference,linear,tokens} from '../math/model.mjs';
import {saveAttempt,getAttempt,acquireAttempt,releaseAttempt,getStatus} from '../data/store.js';
import {begin,visit,clearResponse,finish,changeLocale,editDraft,submit,noteHint,deadlineRemaining,commitDraft,projectFinal} from './engine.mjs';
import {inputGuide} from '../learning/input-guide.mjs';
import {renderExpression,speakExpression,parseAnswer,formatExact} from './math.mjs';
import {node,add,button,gradeLabel,mode,operation,answerError,date,downloadSession,recommendations,stepList} from './base.mjs';
import {audioContextClass} from '../core/audio.mjs';

export async function session(ctx,a,scope) {
  const root=ctx.root, lang=()=>ctx.lang, L=(id,en)=>lang()==='en'?en:id;
  let stopped=false,removed=false,busy=false,errorText='',errorField=false,confirming=false,paused=!!a.ui_paused;
  let ownsLease=false,composing=false, retrying=false, saveFault=null, skipDecision=false,reviewCursor=null;
  let pendingGrade=null,readyForInput=false,previousPointerCommand=false;
  // 1.4 practice attempts finish on the last question straight into the result.
  const direct=a.flow_policy_version==='direct-result-v1'&&a.mode!=='assessment';
  let departure=null,approvedExit=false,backedRevision=null,writing=0;
  let timer,draftTimer,tail=Promise.resolve(),touched=false,clock=performance.now();
  let anchor={mono:clock,wall:Date.now()},timerNode,statusNode,form;
  let wasVisible=!document.hidden,temporary=(await getStatus()).temporary;
  // A short page-scoped journal bridges the time between a keystroke and its
  // IndexedDB commit. It never contains results, keys or synchronization events.
  const journalKey=['kalibataku','draft',scope.origin,scope.environment,scope.profileId,a.attempt_id].join(':');
  function readJournal(){try{return JSON.parse(sessionStorage.getItem(journalKey));}catch{return null;}}
  function markDraft(){
    try{const i=a.items[a.index];sessionStorage.setItem(journalKey,JSON.stringify({index:a.index,instance:i.question_instance_id,sequence:a._seq||0,draft:i.draft,locale:i.draft_locale}));}catch{}
  }
  function dropDraft(mark=null){
    try{const j=readJournal();if(!mark||JSON.stringify(mark)===JSON.stringify(j))sessionStorage.removeItem(journalKey);}catch{}
  }
  function recoverDraft(){
    const j=readJournal(),i=a.items[a.index];
    if(j&&j.sequence===(a._seq||0)&&j.index===a.index&&j.instance===i.question_instance_id&&typeof j.draft==='string'&&j.draft.length<=80&&['id','en'].includes(j.locale)){
      if(i.draft!==j.draft||i.draft_locale!==j.locale){i.draft=j.draft;i.draft_locale=j.locale;i.dirty=true;i.feedback=false;touched=true;}
    } else if(j)dropDraft();
  }
  function revealControl(target) {
    if(stopped||removed||ctx.signal?.aborted||target!==document.activeElement||!root.contains(target))return;
    const viewport=window.visualViewport;
    const viewportTop=viewport?.offsetTop??0;
    const padding=getComputedStyle(document.documentElement);
    const top=viewportTop+(parseFloat(padding.scrollPaddingTop)||6);
    const bottom=viewportTop+(viewport?.height??window.innerHeight)-(parseFloat(padding.scrollPaddingBottom)||6);
    const available=bottom-top;
    if(available<=0)return;
    const bounds=target.getBoundingClientRect();
    let start=bounds.top,end=bounds.bottom;
    if(target.matches('.kp-answer')){
      const expression=root.querySelector('#kp-expression').getBoundingClientRect();
      const position=root.querySelector('#kp-question-position').getBoundingClientRect();
      // Keep the question number, formula and entry in one view whenever they fit.
      start=end-position.top<=available?position.top:expression.top;
      if(end-start>available)start=end-available;
    }else if(target.matches('[data-answer-feedback]')){
      // The answer, key, Next action and short explanation are in reading order.
      const idea=target.querySelector('.verdict-idea').getBoundingClientRect();
      end=Math.min(idea.bottom,start+available);
    }
    const distance=start<top?Math.floor(start-top):end>bottom?Math.ceil(end-bottom):0;
    if(distance)window.scrollBy({top:distance,behavior:'instant'});
  }
  function revealAfterLayout(target) {
    revealControl(target);
    const scroll=window.scrollY;
    const pending=[...root.querySelectorAll('[data-math]')].map(math=>math.mathReady);
    pending.push(document.fonts?.ready);
    Promise.allSettled(pending).then(()=>requestAnimationFrame(()=>{
      // Respect a reader who has already scrolled away from the equation.
      if(Math.abs(window.scrollY-scroll)<2)revealControl(target);
    }));
  }
  function viewportChanged() {
    const target=document.activeElement;
    if(target?.matches('.kp-answer,[data-answer-feedback]'))requestAnimationFrame(()=>revealControl(target));
  }
  function focusControl(selector) {
    queueMicrotask(()=>{
      if(stopped||removed||ctx.signal?.aborted)return;
      const target=root.querySelector(selector);
      if(!target)return;
      target.focus({preventScroll:true});
      if(target.matches('.kp-answer')&&retrying)target.select();
      revealAfterLayout(target);
    });
  }
  function focusAnswer(){focusControl(confirming||paused||skipDecision||departure?'[data-state-heading]':a.items[a.index]?.feedback?'[data-answer-feedback]':'.kp-answer');}
  function stateHeading(text){const h=node('h2','',text);h.tabIndex=-1;h.dataset.stateHeading='';return h;}
  function tagged(text,act,kind,tag){const b=button(text,act,kind);b.dataset.part=tag;return b;}
  const push=(events=null)=>{
    tail=tail.catch(()=>{}).then(()=>{
      if(removed)throw new Error('PROFILE_REMOVED');
      return saveAttempt(a,events,scope);
    });
    writing++;tail.finally(()=>{writing--;}).catch(()=>{});
    return tail;
  };
  async function activate(takeover=false) {
    await acquireAttempt(a.attempt_id,scope,{takeover});
    ownsLease=true;
    if(removed)return;
    if(takeover){const current=await getAttempt(a.attempt_id,scope);if(!current)throw new Error('PROFILE_REMOVED');a=current;}
    if(a.status!=='ongoing'){ctx.go('results/'+a.attempt_id);return;}
    if(ctx.signal?.aborted) {await releaseAttempt(a.attempt_id,scope);return;}
    const fresh=!a.ready;
    if(!fresh)readyForInput=true;
    if(!fresh)a.items[a.index].timing_quality='resumed_estimate';
    recoverDraft();changeLocale(a,lang());paused=!!a.ui_paused;draw();
    if(fresh){
      root.inert=true;if(form)form.disabled=true;
      const waiting=node('p','kp-sub',L('Menyiapkan tampilan soal…','Preparing the question…'));root.prepend(waiting);
      try{
        await Promise.all([...root.querySelectorAll('[data-math]')].map(x=>x.mathReady));
        if(ctx.signal?.aborted||removed){await releaseAttempt(a.attempt_id,scope);ownsLease=false;return;}
        clock=performance.now();anchor={mono:clock,wall:Date.now()};await push(begin(a));
      readyForInput=true;
      }finally{root.inert=false;if(form)form.disabled=!readyForInput;waiting.remove();}
      if(statusNode)statusNode.textContent=savedText();
    }
    focusAnswer();tick();if(touched)await flushDraft();
  }
  function conflict(e,reading=false) {
    ownsLease=false;
    if((e.code||e.message)==='PROFILE_REMOVED'){retire();return;}
    const page=node('section','kp'),heading=node('h1','',reading?L('Sesi hanya-baca','Read-only session'):L('Sesi sedang digunakan','Session in use'));
    heading.tabIndex=-1;add(page,heading,node('p','',answerError(e.code||e.message,L)));
    if(reading){
      const item=a.items[a.index];
      add(page,node('p','kp-sub',[ctx.profileName,gradeLabel(a,L),mode(a,L)].filter(Boolean).join(' · ')),
        node('h2','',L('Soal '+(a.index+1)+' dari '+a.items.length,'Question '+(a.index+1)+' of '+a.items.length)),
        formula(item.question.expression_ast,lang()),
        node('p','',L('Jawaban terakhir tersimpan · ','Last saved entry · ')+(item.draft||L('Kosong','Blank'))),
        node('p','kp-sub',a._saved_at?date(a._saved_at,lang()):L('Waktu simpan tidak tersedia untuk sesi ini.','A save time is unavailable for this session.')));
    }
    add(page,button(reading?L('Perbarui tampilan','Refresh view'):L('Lihat saja','View read-only'),async()=>{
      const latest=await getAttempt(a.attempt_id,scope);
      if(!latest){retire();return;}
      a=latest;if(a.status==='completed'){ctx.go('results/'+a.attempt_id);return;}
      conflict(e,true);
    },'main'),button(L('Ambil alih di tab ini','Take over in this tab'),async()=>{try{await activate(true);}catch(err){conflict(err);}}),button(L('Riwayat','History'),()=>ctx.go('history')));
    clearMath(root);root.replaceChildren(page);heading.focus({preventScroll:true});
  }
  function accrue() {
    const now=performance.now();
    if(ownsLease&&wasVisible&&!paused&&!confirming&&!skipDecision&&!departure&&a.ready&&a.status==='ongoing')a.items[a.index].active_ms+=Math.max(0,now-clock);
    clock=now;wasVisible=!document.hidden;
  }
  async function flushDraft() {
    clearTimeout(draftTimer);
    if(removed)return;
    if(pendingGrade||!touched||a.status!=='ongoing')return tail;
    touched=false;
    const mark=readJournal();
    try {await push();saveFault=null;if(mark)dropDraft(mark);if(statusNode&&!touched)statusNode.textContent=savedText();}
    catch(e){touched=true;saveError(e);}
  }
  function savedText(){
    if(temporary)return L('Mode sementara · unduh sebelum menutup','Temporary mode · download before leaving');
    return L('Tersimpan di perangkat','Saved on this device')+(a._saved_at?' · '+date(a._saved_at,lang()):'');
  }
  function removedNotice() {
    if(stopped||ctx.signal?.aborted)return;
    const page=node('section','kp'),card=node('section','kp-card');
    const title=node('h1','',L('Profil latihan telah dihapus','Practice profile removed'));
    title.tabIndex=-1;
    add(card,title,node('p','',L('Profil untuk sesi ini telah dihapus. Pilih profil untuk memulai sesi baru. Catatan sesi lama dapat diunduh untuk dibaca. Pemulihan profil membutuhkan berkas cadangan profil.','The profile for this session was removed. Choose a profile to start another session. You can download a readable record of the old session. Restoring the profile requires a profile backup.')));
    const actions=node('div','kp-actions');
    add(actions,button(L('Pilih profil','Choose a profile'),()=>ctx.go('profiles'),'main'),button(L('Unduh salinan sesi lama','Download old session copy'),()=>downloadSession(a)));
    add(page,add(card,actions));clearMath(root);root.replaceChildren(page);title.focus({preventScroll:true});
  }
  function retire() {
    if(stopped||removed)return;
    removed=true;touched=false;paused=true;form=null;
    clearInterval(timer);clearTimeout(draftTimer);dropDraft();
    releaseAttempt(a.attempt_id,scope).catch(()=>{});removedNotice();
  }
  function onProfileRemoved(e){if(scope.origin==='local_practice'&&e.detail?.profileId===scope.profileId)retire();}
  function problem(e){return e.name==='QuotaExceededError'?'QUOTA_EXCEEDED':typeof e.code==='string'?e.code:e.message;}
  function saveError(e) {
    if((e.code||e.message)==='PROFILE_REMOVED'){retire();return;}
    saveFault=problem(e);errorText=saveMessage(saveFault);errorField=false;
    if(!stopped){draw();focusControl('[data-save-issue]');}
  }
  function saveMessage(code){
    if(code==='QUOTA_EXCEEDED')return L('Penyimpanan perangkat penuh. Unduh cadangan sebelum keluar.','Device storage is full. Download a backup before leaving.');
    if(['LOCKED','STALE_REVISION','FINALIZED'].includes(code))return L('Sesi berubah di tab lain. Simpan salinan jawaban ini lalu buka sesi terbaru.','Another tab changed this session. Save a copy of this answer, then open the latest session.');
    return L('Perubahan belum tersimpan. Coba simpan lagi atau unduh cadangan sebelum keluar.','Your changes are unsaved. Try saving again or download a backup before leaving.');
  }
  function primaryLabel(item){
    if(a.mode==='assessment')return L('Simpan & lanjut','Save & continue');
    if(item.feedback&&!item.dirty){
      
      return (a.index===a.items.length-1?(direct?L('Lihat hasil','See results'):L('Tinjau hasil','Review results')):L('Soal berikutnya','Next question'))+' · Enter';
    }
    return L('Periksa · Enter','Check · Enter');
  }
  function changed() {
    if(!readyForInput||busy||!ownsLease||pendingGrade||a.items[a.index].feedback)return;
    previousPointerCommand=false;
    const input=root.querySelector('.kp-answer');
    if(deadlineRemaining(a,Date.now(),anchor)===0){input.value=a.items[a.index].draft;finalize(true);return;}
    const item=a.items[a.index];
    editDraft(a,a.index,input.value,lang());
    if(input.value!==item.draft)input.value=item.draft;
    input.removeAttribute('aria-invalid');input.setAttribute('aria-describedby','kp-question-position kp-expression kp-input-help');
    const err=root.querySelector('.kp-error');if(err)err.remove();
    const feedback=root.querySelector('[data-answer-feedback]');if(feedback)feedback.remove();
    const submitBtn=root.querySelector('[data-submit]');if(submitBtn)submitBtn.textContent=primaryLabel(item);
    const sep=root.querySelector('[data-separator]');if(sep)sep.textContent=item.draft_locale==='id'?',':'.';
    const label=root.querySelector('[data-draft-label]');if(label)label.textContent=draftHelp(item);
    if(composing)return;
    retrying=false;errorText='';errorField=false;markDraft();touched=true;clearTimeout(draftTimer);statusNode.textContent=L('Menyimpan…','Saving…');
    draftTimer=setTimeout(flushDraft,220);
  }
  async function action(mutator,{next,focus=true,allowExpired=false,after,grade=false,retrySave=false}={}) {
    if(!readyForInput||busy||stopped||removed||!ownsLease||pendingGrade&&!retrySave)return;
    if(!allowExpired&&deadlineRemaining(a,Date.now(),anchor)===0)return finalize(true);
    busy=true;clearTimeout(draftTimer);
    if(form)form.disabled=true;
    if(statusNode)statusNode.textContent=L('Menyimpan…','Saving…');
    for(const control of root.querySelectorAll('button,input,select'))control.disabled=true;
    accrue();errorText='';errorField=false;
    await tail.catch(()=>{});
    if(removed||stopped){busy=false;return;}
    const old=structuredClone(a),oldView={confirming,paused,skipDecision,retrying};
    let events,mutated=false;
    try{
      events=mutator();mutated=true;
      await push(events??null);pendingGrade=null;saveFault=null;touched=false;dropDraft();
      if(stopped||removed)return;
      if(next)ctx.go(next());
      else {draw();if(focus===true)focusAnswer();else if(typeof focus==='string')focusControl(focus);}
      if(after)after();
    } catch(e) {
      const code=problem(e);
      if((grade||retrySave)&&mutated){
        pendingGrade??={events,before:old};
      }else{a=old;({confirming,paused,skipDecision,retrying}=oldView);}
      if(code==='PROFILE_REMOVED'){retire();return;}
      if(code==='DIRTY_INVALID'&&e.index>=0){confirming=false;skipDecision=false;paused=false;visit(a,e.index);}
      const format=['DIRTY_INVALID','EMPTY','INCOMPLETE','WRONG_DECIMAL_SEPARATOR','ZERO_DENOMINATOR','DENOMINATOR_MUST_BE_POSITIVE','GROUPING_NOT_ALLOWED','INPUT_TOO_LONG','INVALID_NUMBER','INVALID_FRACTION','FORMULA_NOT_ALLOWED','SCIENTIFIC_NOTATION_NOT_ALLOWED'];
      errorField=format.includes(code);
      if(!errorField){saveFault=code;touched=true;}
      errorText=errorField?answerError(code,L):saveMessage(code);
      draw();focusControl(errorField?'.kp-answer':'[data-save-issue]');
    } finally {busy=false;if(form)form.disabled=Boolean(pendingGrade);}
  }
  function sound(correct) {
    const Audio=audioContextClass();
    if(!ctx.prefs?.sound || !Audio)return;
    try {
      const audio=new Audio(),osc=audio.createOscillator(),gain=audio.createGain();
      osc.connect(gain);gain.connect(audio.destination);gain.gain.value=.035;osc.frequency.value=correct?660:350;
      osc.start();osc.stop(audio.currentTime+.1);osc.onended=()=>audio.close();
    } catch {}
  }
  // UX-002: the visible clock is not a live region. Remaining time is spoken on request
  // and at a few thresholds only, so screen readers are not interrupted every second.
  const announced=new Set();let timeNode;
  function spokenTime(sec){
    const m=Math.floor(sec/60),r=sec%60;
    return L('Sisa waktu ','Time left ')+[m?m+L(' menit',m===1?' minute':' minutes'):'',r||!m?r+L(' detik',r===1?' second':' seconds'):''].filter(Boolean).join(' ')+'.';
  }
  function remainingSeconds(){const remain=deadlineRemaining(a,Date.now(),anchor);return remain===null?null:Math.ceil(remain/1000);}
  function announceTime(text){if(!timeNode)return;timeNode.textContent='';requestAnimationFrame(()=>{if(timeNode)timeNode.textContent=text;});}
  function tick() {
    if(!ownsLease||!a.ready||a.status!=='ongoing'||stopped||removed)return;
    const remain=deadlineRemaining(a,Date.now(),anchor);
    if(remain===null)return;
    const sec=Math.ceil(remain/1000);
    if(timerNode)timerNode.textContent=L('Sisa ','Left ')+Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
    for(const t of [300,120,60,30,10]){
      if(sec<=t&&sec>0&&!announced.has(t)){announced.add(t);for(const x of [300,120,60,30,10])if(x>t)announced.add(x);if(a.duration_seconds>t)announceTime(spokenTime(sec));break;}
    }
    if(remain===0&&!busy&&!saveFault)finalize(true);
  }
  function onTimeKey(e){if(e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.key==='t'||e.key==='T')&&a.deadline){e.preventDefault();const sec=remainingSeconds();if(sec!==null)announceTime(spokenTime(sec));}}
  function finalize(expired=false) {
    return action(()=>finish(a,{expired}),{next:()=>'results/'+a.attempt_id,allowExpired:expired});
  }
  function nextItem() {
    if(a.index<a.items.length-1)visit(a,a.index+1);
    else confirming=true;
  }
  function move(direction){
    if(direct&&direction===1&&a.index===a.items.length-1){
      // Finalized once: the busy guard, the stored status and finish() all ignore repeats.
      if(a.items[a.index].feedback&&!a.items[a.index].dirty)return finalize();
    }
    action(()=>{
      const command=commitDraft(a,a.index);
      if(direction===1)nextItem();else visit(a,a.index-1);
      retrying=false;
      return command;
    });
  }
  function draftHelp(item){
    const guide=inputGuide(item.question,a.grade,lang());
    const held=item.draft_locale!==lang();
    return guide.instruction+' '+(held?L('Draf ini memakai titik. Teruskan dengan titik sampai angkanya lengkap.','This entry uses a comma. Keep using the comma until the number is complete.'):guide.example);
  }
  function showReview(){return action(()=>{confirming=true;skipDecision=false;retrying=false;},{focus:reviewCursor===null?true:'[data-review-index="'+reviewCursor+'"]'});}
  function commandState(){
    if(!readyForInput||stopped||removed||!ownsLease||ctx.signal?.aborted||saveFault||pendingGrade||paused||confirming||skipDecision||departure)return 'unavailable';
    if(busy)return 'saving';
    if(a.status!=='ongoing')return 'finalizing';
    return a.items[a.index].feedback&&!a.items[a.index].dirty?'feedback':'answer';
  }
  function primaryAction(){
    const state=commandState();
    if(state==='answer'||state==='feedback')return numericActions(a.items[a.index]);
  }
  mountEnter(ctx.signal,target=>a.mode!=='assessment'&&root.contains(target)&&
    (target.matches('.kp-answer,[data-submit],[data-answer-feedback]')),()=>{
      previousPointerCommand=false;primaryAction();
  });
  function numericActions(i){
    if(a.mode==='assessment')return move(1);
    if(i.feedback&&!i.dirty){
      
      return move(1);
    }
    return action(()=>{const command=submit(a,a.index);if(!command&&i.history.length)i.feedback=true;return command;},{grade:true,focus:'[data-answer-feedback]',after:()=>sound(a.items[a.index].final_status==='correct')});
  }
  function skip(){
    if(busy)return;
    if(!skipDecision&&(a.items[a.index].draft||a.items[a.index].history.length)){
      skipDecision=true;draw();focusAnswer();return;
    }
    return action(()=>{const command=clearResponse(a,a.index,true);skipDecision=false;nextItem();return command;});
  }
  function exitRisk(){
    return ownsLease&&!removed&&!stopped&&!approvedExit&&a.ready&&a.status==='ongoing'&&
      (saveFault||touched||writing||busy||(temporary&&backedRevision!==a._rev));
  }
  function guardUnload(ev){
    if(exitRisk()){ev.preventDefault();ev.returnValue='';}
  }
  async function considerExit(url){
    if(!temporary&&!saveFault&&!busy&&(touched||writing))await flushDraft().catch(()=>{});
    if(stopped||removed)return;
    if(!exitRisk()){location.assign(url);return;}
    if(!departure){accrue();departure={url};draw();focusControl('[data-state-heading]');}
  }
  function linkExit(ev){
    if(ev.defaultPrevented||ev.button!==0||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey||!exitRisk())return;
    const link=ev.target.closest?.('a[href]');
    if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
    const url=new URL(link.href,location.href);
    if(url.href===location.href||url.hash==='#main'||!['https:','http:'].includes(url.protocol))return;
    ev.preventDefault();ev.stopImmediatePropagation();considerExit(url.href);
  }
  function backExit(ev){
    if(!exitRisk()||!ev.oldURL||!ev.newURL||ev.oldURL===ev.newURL)return;
    // The browser has already traversed the history entry. Keep the current player
    // visible until the learner chooses whether to leave this exact attempt.
    ev.stopImmediatePropagation();history.pushState(null,'',ev.oldURL);considerExit(ev.newURL);
  }
  async function rescue(){
    const trigger=root.querySelector('[data-rescue]');if(trigger)trigger.disabled=true;
    try{
      const {exportRecoveryBackup}=await import('../data/backup.js');
      const captured=a._rev,draftAtExport=a.items[a.index].draft;
      const body=await exportRecoveryBackup(scope,pendingGrade?.before||a);
      const url=URL.createObjectURL(body instanceof Blob?body:new Blob([typeof body==='string'?body:JSON.stringify(body)],{type:'application/json'}));
      const link=document.createElement('a');link.download='KALIBATAKU-profile-backup-'+a.attempt_id+(body instanceof Blob&&body.type==='application/zip'?'.zip':'.json');link.href=url;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      if(captured===a._rev&&draftAtExport===a.items[a.index].draft)backedRevision=captured;
    }catch(err){
      const msg=root.querySelector('[data-recovery-message]');
      if(msg)msg.dataset.errorCode=err.code||err.message;
      if(msg)msg.textContent=L('Cadangan tidak dapat dibuat. Unduh catatan sesi untuk dibaca.','The backup could not be created. Download a readable session record.');
    }finally{if(trigger)trigger.disabled=false;}
  }
  function draw() {
    if(stopped||removed||ctx.signal?.aborted)return;
    const page=node('section','kp'), header=node('header','kp-head');
    add(header,node('p','kp-sub',(a.journey?[L('Pos latihan','Practice stop'),gradeLabel(a,L)]:[ctx.profileName,gradeLabel(a,L),mode(a,L)]).filter(Boolean).join(' · ')),node('h1','',operation(a,L)));
    add(page,header);
    if(a.adaptive)add(page,node('p','kp-alert',L(...recommendations[a.adaptive.decision])));
    const card=node('section','kp-card kp-question'), head=node('div','kp-row');
    const progressText=L('Soal '+(a.index+1)+' dari '+a.items.length,'Question '+(a.index+1)+' of '+a.items.length);
    const position=node('strong','',progressText);position.id='kp-question-position';add(head,position);
    timerNode=node('span','kp-timer');timerNode.setAttribute('role','timer');timerNode.setAttribute('aria-live','off');timerNode.setAttribute('aria-hidden','true');
    timeNode=node('span','sr-only');timeNode.setAttribute('role','status');timeNode.setAttribute('aria-live','polite');timeNode.setAttribute('aria-atomic','true');timeNode.dataset.timeAnnouncer='';
    const clockBox=node('span','kp-clock');
    if(a.deadline||a.duration_seconds){
      if(ctx.prefs?.showTimer!==false)add(clockBox,timerNode);
      else add(clockBox,node('span','kp-timer muted',L('Waktu berjalan','Clock running')));
      const ask=button(L('Sisa waktu','Time left'),()=>{const sec=remainingSeconds();announceTime(sec===null?L('Waktu mulai setelah soal siap.','Time starts when the question is ready.'):spokenTime(sec));},'quiet small');
      ask.dataset.part='time';ask.setAttribute('aria-keyshortcuts','Alt+T');ask.title=L('Bacakan sisa waktu (Alt+T)','Read the time left (Alt+T)');add(clockBox,ask);
    }else add(clockBox,node('span','kp-sub',L('Tanpa batas waktu','Untimed')));
    add(head,clockBox,timeNode);
    const progress=node('progress');progress.max=a.items.length;progress.value=a.index+1;progress.setAttribute('aria-label',progressText);
    add(card,head,progress);
    if(departure){
      add(card,stateHeading(L('Keluar dari sesi?','Leave this session?')),
        node('p','',temporary?L('Sesi ini memakai penyimpanan sementara. Saat tab ditutup, pekerjaan dapat hilang. Unduh cadangan untuk memulihkannya.','This session uses temporary storage. Closing the tab can erase your work. Download a backup to restore it.'):L('Perubahan terakhir belum tersimpan. Tetap di sesi untuk mencoba menyimpan lagi atau unduh cadangan.','The latest changes are unsaved. Stay to retry saving or download a backup.')));
      const controls=node('div','kp-actions');
      add(controls,tagged(L('Tetap di sesi','Stay in session'),()=>{departure=null;clock=performance.now();draw();focusAnswer();},'main','stay'),
        tagged(L('Tetap keluar','Leave anyway'),()=>{const url=departure.url;approvedExit=true;location.assign(url);},'','leave'));
      add(card,controls);
    } else if(confirming) {
      const {rows,counts:c}=projectFinal(a);
      const assessing=a.mode==='assessment';
      const names={
        answered:L('Terisi','Answered'),blank:L('Kosong','Blank'),unseen:L('Belum dilihat','Unseen'),
        skipped:L('Dilewati','Skipped'),incomplete:L('Perlu diperbaiki','Needs editing'),flagged:L('Ditandai','Flagged'),
        correct:L('Benar','Correct'),incorrect:L('Belum tepat','Incorrect')
      };
      const visible=assessing?{answered:c.correct+c.incorrect,blank:c.blank,unseen:c.unseen,skipped:c.skipped,flagged:c.flagged}:
        {correct:c.correct,incorrect:c.incorrect,blank:c.blank,unseen:c.unseen,skipped:c.skipped};
      if(c.incomplete)visible.incomplete=c.incomplete;
      add(card,stateHeading(assessing?L('Tinjau jawabanmu','Review your answers'):L('Selesaikan sesi ini?','Finish this session?')));
      const breakdown=node('ul','kp-totals');breakdown.dataset.projection='';
      for(const [key,value] of Object.entries(visible)){const li=node('li','',names[key]+' · '+value);li.dataset.count=key;li.dataset.value=value;add(breakdown,li);}
      add(card,breakdown,node('p','kp-sub',direct?L('Soal yang belum dijawab dicatat sebagai belum dilihat atau kosong.','Questions you have not answered are recorded as unseen or blank.'):L('Pilih nomor untuk mengubah jawaban. Setelah dikirim, hasil terkunci.','Choose a number to change your answer. Submitting locks the results.')));
      const nav=node('nav','kp-map');nav.setAttribute('aria-label',L('Daftar nomor soal','Question list'));
      for(const row of rows){
        const status=assessing&&['correct','incorrect'].includes(row.status)?'answered':row.status;
        const label=names[status]+(row.flagged?' · '+names.flagged:'');
        const tile=button('',()=>action(()=>{confirming=false;retrying=false;reviewCursor=row.index;visit(a,row.index);}));
        add(tile,node('strong','',String(row.index+1)),node('small','',label));tile.dataset.reviewIndex=row.index;
        tile.setAttribute('aria-label',L('Soal ','Question ')+(row.index+1)+' · '+label);add(nav,tile);
      }
      if(!direct)add(card,nav);
      const actions=node('div','kp-actions');add(actions,tagged(direct?L('Selesaikan dan lihat hasil','Finish and see results'):L('Kirim hasil akhir','Submit final answers'),()=>finalize(),'main','finish'),button(L('Kembali ke soal','Return to questions'),()=>{confirming=false;draw();focusAnswer();}));
      add(card,actions);
    } else if(paused) {
      add(card,stateHeading(L('Latihan dijeda','Practice paused')),node('p','',progressText+'. '+(a.deadline?L('Batas waktu tetap berjalan.','The deadline clock keeps running.'):L('Waktu aktif berhenti selama jeda.','Active practice time stops while paused.'))),
        tagged(L('Lanjutkan latihan','Resume practice'),()=>action(()=>{clock=performance.now();paused=false;a.ui_paused=false;}),'main','resume'));
      add(card,button(L('Keluar dan lanjut nanti','Leave and resume later'),()=>{if(exitRisk())considerExit(new URL('#/history'+(scope.origin==='demo'?'?source=demo':''),location.href).href);else ctx.go('history');}));
    } else if(skipDecision){
      add(card,stateHeading(L('Lewati soal ini?','Skip this question?')),node('p','',L('Isian sekarang tidak dihitung sebagai jawaban akhir. Respons yang sudah diperiksa tetap ada di riwayat.','This entry will not count as the final answer. Previously checked answers stay in the response history.')),
        button(L('Simpan dan kembali','Keep working'),()=>{skipDecision=false;draw();focusAnswer();},'main'),button(L('Ya, lewati','Yes, skip'),skip));
    } else {
      const i=a.items[a.index],q=i.question;
      if(i.recovery_role)add(card,node('p','kp-sub',i.recovery_role==='original'?L('Tinjau kembali soal asal','Revisit the original question'):L('Coba variasi yang setara','Try an equivalent variation')));
      const eq=formula(q.expression_ast,lang());eq.classList.add('kp-eq');eq.id='kp-expression';
      const f=node('form'),fieldset=node('fieldset');form=fieldset;f.noValidate=true;
      const input=node('input','kp-answer');input.id='kp-answer';input.type='text';input.inputMode=inputGuide(q,a.grade,lang()).type==='integer'?'numeric':'decimal';input.autocomplete='off';input.spellcheck=false;input.maxLength=80;input.value=i.draft;
      input.setAttribute('aria-describedby','kp-question-position kp-expression kp-input-help'+(errorField?' kp-input-error':''));
      if(errorField)input.setAttribute('aria-invalid','true');
      const label=node('label','',L('Jawabanmu','Your answer'));label.htmlFor=input.id;
      input.addEventListener('input',()=>{if(!composing)changed();});
      input.addEventListener('compositionstart',()=>{composing=true;});
      input.addEventListener('compositionend',()=>{composing=false;changed();});
      f.addEventListener('keydown',e=>{if(e.key==='Enter'&&(composing||e.isComposing||e.keyCode===229||e.repeat))e.preventDefault();});
      const help=node('small','kp-sub',draftHelp(i));help.id='kp-input-help';help.dataset.draftLabel='';
      const answerRow=node('div','answer-row');add(answerRow,input);
      const stage=node('div','kp-stage');add(stage,eq);
      // UX-03: while practice feedback is open the answer already sits in the 'Jawabanmu'
      // tile, so the input row, its help and the keypad step aside to keep the page short.
      const showingFeedback=i.feedback&&a.mode!=='assessment';
      add(fieldset,stage,showingFeedback?null:label,showingFeedback?null:answerRow,showingFeedback?null:help);
      if(errorField&&errorText) {const n=node('div','kp-error',errorText);n.id='kp-input-error';n.setAttribute('role','alert');add(fieldset,n);}
      const actions=node('div','kp-actions'),check=node('button','kp-btn main',primaryLabel(i));
      check.type='submit';check.dataset.submit='';
      check.addEventListener('click',e=>{
        // A touch click count may span a new question and an intervening keyboard
        // grade. Ignore consecutive taps only while that original command is active.
        if(composing||compositionActive()||(e.detail>1&&previousPointerCommand)){
          e.preventDefault();return;
        }
        previousPointerCommand=e.detail>0;
        if(check.dataset.part==='next'&&!pendingGrade)primaryAction();
      });
      f.addEventListener('submit',ev=>{ev.preventDefault();if(!composing&&!compositionActive()&&!i.feedback)primaryAction();});
      if(!i.feedback||a.mode==='assessment')add(answerRow,add(actions,check));
      else input.readOnly=true;
      if(ctx.prefs?.keypad!==false&&!i.feedback){
        const keys=node('details','kp-symbols');
        add(keys,node('summary','',L('Simbol jawaban','Answer symbols')));
        if(inputGuide(q,a.grade,lang()).type!=='integer'||a.grade>6||i.draft.includes('/')||i.draft.includes(',')||i.draft.includes('.'))keys.open=true;
        const pads=node('div','kp-pads');
        for(const symbol of ['−','/',i.draft_locale==='id'?',':'.']) {
          const key=button(symbol,()=>{const start=input.selectionStart,end=input.selectionEnd;const v=key.textContent==='−'?'-':key.textContent;input.setRangeText(v,start,end,'end');input.focus();changed();});
          key.setAttribute('aria-label',symbol==='−'?L('Tanda minus','Minus sign'):symbol==='/'?L('Garis pecahan','Fraction slash'):L('Pemisah desimal','Decimal separator'));
          key.dataset.symbol='';if(symbol===','||symbol==='.')key.dataset.separator='';
          add(pads,key);
        }add(fieldset,add(keys,pads));
      }
      if(i.feedback&&a.mode!=='assessment'){
        // UX-006: status → your answer → key → one idea → full steps. Equations sit in
        // their own blocks; steps add information instead of repeating the idea.
        const h=i.history.at(-1),correct=i.final_status==='correct',last=a.index===a.items.length-1;
        const answer=enteredAst(h),key=asRational(q.answer),opts=decimalPreference(q);
        const sameText=linear(tokens(answer,lang()))===linear(tokens(key,lang(),opts));
        const state=!correct?'incorrect':sameText?'correct':'equivalent';
        const feedback=node('section','kp-verdict');feedback.dataset.answerFeedback='';feedback.dataset.state=state;feedback.tabIndex=-1;
        const head=node('header','verdict-head'),badge=node('span','verdict-badge',state==='incorrect'?'!':state==='equivalent'?'=':'✓');badge.setAttribute('aria-hidden','true');
        const title=node('h2','',correct?L('Benar','Correct'):L('Belum tepat','Not quite'));title.id='kp-verdict-title';
        feedback.setAttribute('aria-labelledby',title.id);add(head,badge,add(node('div'),title,h.key_seen_before?node('p','verdict-note',L('Revisi setelah melihat kunci. Dicatat sebagai jawaban dengan bantuan.','Revision after seeing the answer. Recorded as an assisted answer.')):null));
        add(feedback,head);
        const pairs=node('dl','verdict-compare');
        const tile=(name,value,cls)=>add(pairs,add(node('div','verdict-tile '+cls),node('dt','',name),add(node('dd'),value)));
        tile(L('Jawabanmu','Your answer'),formula(answer,lang()),'mine');tile(L('Kunci jawaban','Correct answer'),formula(key,lang(),opts),'key');add(feedback,pairs);
        if(state==='equivalent')add(feedback,node('p','verdict-equal',L('Nilainya sama. Bentuk paling sederhana adalah kunci di atas.','These have the same value. The key shows the simplest form.')));
        const idea=node('section','verdict-idea');
        add(idea,node('h3','',L('Salah satu cara menghitung','One way to calculate')),add(node('p'),mathProse(q.explanation?.[lang()]||q.solution_steps?.[0]?.text?.[lang()]||'',lang())));
        add(feedback,idea);
        const steps=node('details','verdict-steps');add(steps,node('summary','',L('Lihat langkah lengkap','See all steps')),stepList(q,lang()));add(feedback,steps);
        if(last)add(feedback,node('p','verdict-note',direct?L('Soal terakhir selesai. Pilih Lihat hasil.','Last question completed. Choose See results.'):L('Soal terakhir selesai. Tinjau hasilmu.','Last question completed. Review your results.')));
        // Two wrong first responses in a row: offer help without changing the question.
        const streak=a.index>0&&!correct&&i.history[0]?.is_correct===false&&a.items[a.index-1].history?.[0]?.is_correct===false;
        if(streak){
          const help=node('aside','kp-help-offer');help.setAttribute('role','note');help.dataset.wrongStreak='';
          add(help,node('p','',L('Dua soal berturut-turut belum tepat. Itu wajar. Buka langkah lengkap, lalu pakai Petunjuk di soal berikutnya bila perlu.','Two questions in a row were not quite right. That is normal. Open all steps, then use the Hint on the next question if you need it.')));
          add(help,tagged(L('Buka langkah lengkap','Open all steps'),()=>{const d=root.querySelector('.verdict-steps');if(d){d.open=true;d.querySelector('summary')?.focus();}},'light','open-steps'));
          add(feedback,help);
        }
        // Moving focus to a non-interactive heading prevents the Enter used to check
        // from immediately activating Next. A new deliberate action is required.
        check.type='button';check.dataset.part='next';
        add(actions,check,tagged(L('Revisi jawaban','Revise answer'),()=>{if(pendingGrade)return;i.feedback=false;retrying=true;draw();focusAnswer();},'secondary','revise'));
        actions.classList.add('verdict-actions');feedback.insertBefore(actions,idea);
        add(fieldset,feedback);
      }else if(a.mode!=='assessment'){
        const assistance=node('div','kp-assistance');
        if(!i.hint_used)add(assistance,tagged(L('Petunjuk','Hint'),()=>action(()=>noteHint(a,a.index),{focus:'[data-hint]'}),'light','hint'));
        else{const hint=node('p','kp-feedback');hint.tabIndex=-1;hint.dataset.hint='';add(hint,mathProse(q.hint?.[lang()]||'',lang()));add(assistance,hint);}
        add(fieldset,assistance);
      }
      const secondary=node('div','kp-actions secondary');
      if(a.mode==='assessment'){
        const mark=tagged(i.flagged?L('Hapus tanda','Unflag question'):L('Tandai untuk ditinjau','Flag for review'),()=>action(()=>{i.flagged=!i.flagged;},{focus:'[data-part=flag]'}),'light','flag');
        mark.setAttribute('aria-pressed',String(!!i.flagged));add(secondary,mark);
        if(a.index>0)add(secondary,button(L('Soal sebelumnya','Previous question'),()=>move(-1),'light'));
      }
      if(a.mode==='assessment'||errorField)add(secondary,tagged(L('Tandai kosong','Mark blank'),()=>action(()=>clearResponse(a,a.index)),'light','blank'));
      add(secondary,button(L('Lewati','Skip'),skip,'light'));
      if(!i.feedback||a.mode==='assessment')add(fieldset,secondary);add(f,fieldset);add(card,f);
      const foot=node('footer','kp-actions');
      add(foot,tagged(a.mode==='assessment'?L('Tinjau & kirim','Review & submit'):direct?(a.journey?L('Akhiri misi','End mission'):L('Akhiri latihan','End practice')):L('Selesaikan sesi','Finish session'),showReview,'light','review'));
      add(foot,tagged(L('Jeda','Pause'),()=>action(()=>{paused=true;a.ui_paused=true;}),'light','pause'));add(card,foot);
      if(a.deadline)add(card,node('small','kp-sub',L('Saat waktu habis, isian yang sah dihitung. Isian belum lengkap mempertahankan jawaban terakhir atau menjadi kosong.','At the deadline, valid entries count. An incomplete entry keeps the last answer, or stays blank if there was none.')));
    }
    statusNode=node('small','kp-sub',saveFault?L('Belum tersimpan','Unsaved'):touched?L('Menyimpan…','Saving…'):savedText());
    const bottom=node('div','kp-row');add(bottom,statusNode);
    if(saveFault){
      const issue=node('p','kp-error',saveMessage(saveFault));issue.setAttribute('role','alert');issue.dataset.saveIssue='';issue.tabIndex=-1;
      add(bottom,issue);
      if(['LOCKED','STALE_REVISION','FINALIZED'].includes(saveFault))add(bottom,button(L('Buka sesi terbaru','Open latest session'),()=>ctx.go('resume')));
      else add(bottom,button(L('Coba simpan lagi','Try saving again'),()=>pendingGrade?action(()=>pendingGrade.events,{retrySave:true,allowExpired:true,focus:'[data-answer-feedback]'}):action(()=>null)));
    }
    if(temporary||saveFault||departure){
      if(scope.origin==='local_practice'){
        const backup=button(L('Unduh cadangan yang dapat dipulihkan','Download restorable backup'),rescue);backup.dataset.rescue='';
        const msg=node('p','kp-sub');msg.dataset.recoveryMessage='';msg.setAttribute('role','status');add(bottom,backup,msg);
      }
      add(bottom,button(L('Unduh catatan sesi untuk dibaca','Download readable session record'),()=>downloadSession(a),'light'));
    }
    add(card,bottom);add(page,card);if(pendingGrade&&form)form.disabled=true;clearMath(root);root.replaceChildren(page);tick();
  }
  function visibility(){if(removed)return;accrue();if(document.hidden){clearTimeout(draftTimer);flushDraft();}tick();}
  function language(ev) {
    if(!ownsLease&&!removed){ctx.lang=ev.detail?.lang||document.documentElement.lang;conflict(new Error('LOCKED'));return;}
    if(removed){ctx.lang=ev.detail?.lang||document.documentElement.lang;removedNotice();return;}
    const focus=document.activeElement,wasInput=focus?.matches('.kp-answer'),sel=wasInput?[focus.selectionStart,focus.selectionEnd]:null;
    ctx.lang=ev.detail?.lang||document.documentElement.lang;changeLocale(a,lang());draw();
    if(wasInput){const input=root.querySelector('.kp-answer');if(input){input.focus({preventScroll:true});input.setSelectionRange(...sel);revealAfterLayout(input);}}
    else if(confirming||paused||skipDecision||departure||a.items[a.index].feedback)focusAnswer();
    touched=true;clearTimeout(draftTimer);draftTimer=setTimeout(flushDraft,100);
  }
  function unload(){if(!stopped)flushDraft();}
  const cleanup=()=>{
    if(stopped)return;stopped=true;accrue();
    document.removeEventListener('visibilitychange',visibility);document.removeEventListener('keydown',onTimeKey);window.removeEventListener('kalibataku:language',language);window.removeEventListener('pagehide',unload);window.removeEventListener('kalibataku:profile-removed',onProfileRemoved);
    window.removeEventListener('beforeunload',guardUnload);window.removeEventListener('hashchange',backExit,true);document.removeEventListener('click',linkExit,true);
    clearInterval(timer);clearTimeout(draftTimer);
    if(ownsLease&&!removed&&a.status==='ongoing')flushDraft().catch(()=>{}).finally(()=>releaseAttempt(a.attempt_id,scope));
  };
  window.addEventListener('resize',viewportChanged,{signal:ctx.signal});
  window.visualViewport?.addEventListener('resize',viewportChanged,{signal:ctx.signal});
  window.addEventListener('kalibataku:profile-removed',onProfileRemoved);
  try{
    await activate();
  }catch(e){
    const code=problem(e);
    if(code==='PROFILE_REMOVED')retire();
    else if(code==='LOCKED')conflict(e);
    else {window.removeEventListener('kalibataku:profile-removed',onProfileRemoved);throw e;}
  }
  if(!removed)timer=setInterval(tick,300);
  document.addEventListener('click',linkExit,true);window.addEventListener('hashchange',backExit,true);window.addEventListener('beforeunload',guardUnload);
  document.addEventListener('visibilitychange',visibility);window.addEventListener('kalibataku:language',language);window.addEventListener('pagehide',unload);document.addEventListener('keydown',onTimeKey);
  ctx.signal?.addEventListener('abort',cleanup,{once:true});
  return cleanup;
}
