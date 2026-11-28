import {route,until,button,delay,chooseLang} from '../integration/probes.mjs';

// Runs through the served application. All data created here is synthetic.
export async function runPlayerUX(w,base){
  if(!base.endsWith('/'))base+='/';
  const checks=[];let owner;
  const read=sel=>w.document.querySelector(sel);
  async function tap(selector){
    const target=await until(()=>{const e=read(selector);return e&&!e.matches(':disabled')&&!e.closest('[inert],[aria-busy=true]')&&e;},selector);
    target.click();
  }
  function fill(value){
    const input=read('.app-view:not([inert]):not([aria-busy]) .kp-answer');input.focus();input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));
  }
  function record(id,ok,expected,actual){checks.push({id,status:ok?'PASS':'FAIL',expected,actual});if(!ok)throw Error(id+': '+JSON.stringify(actual));}
  async function launch(mode){
    const suffix=mode==='practice'?'&pack=MM-G01-L01-ADD-P001':'';
    await route(w,base,'session/new?grade=1&level=1&op=ADD&mode='+mode+suffix);
    if(mode==='practice'){
      const length=await until(()=>read('[name=question_count]'),'Question count');
      length.value='2';
      for(const name of ['input','change'])length.dispatchEvent(new w.Event(name,{bubbles:true}));
      const shuffle=read('[name=shuffle]');if(shuffle?.checked)shuffle.click();
    }
    const go=await until(()=>read('form.setup button[type=submit]:not(:disabled)'),'Start');
    go.click();await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer'),'Player ready');
  }
  async function snapshot(){
    const api=await import(base+'data/store.js');
    const id=w.location.hash.split('/').pop().split('?')[0];
    return {a:await api.getAttempt(id,owner),events:await api.listEvents(id,owner)};
  }
  try{
    // Other suites use the same synthetic origin. Pin this tab's own synthetic
    // identity before loading the app modules, independently of device defaults.
    await route(w,base,'');
    const store=await import(base+'data/store.js'),alias='QA player '+crypto.randomUUID().slice(0,8);
    const profile=await store.createProfile(alias);owner=store.scopeForLocal(profile.id);
    w.sessionStorage.setItem('kalibataku.scope',JSON.stringify(owner));
    const beforeReload=w.document;w.location.reload();
    await until(()=>w.document!==beforeReload&&!w.document.documentElement.hasAttribute('data-opening')&&read('[data-route=home]:not([aria-busy]) h1')&&read('header')?.innerText.includes(alias),'Isolated player profile fully rendered');
    await launch('practice');
    const terms=[read('#kp-expression').dataset.linear];
    fill('5');await tap('[data-submit]');await until(()=>read('[data-answer-feedback]'),'Checked Q1');await tap('[data-part=next]');await until(()=>read('#kp-question-position')?.textContent.match(/2/)&&read('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value==='','Q2');
    terms.push(read('#kp-expression').dataset.linear);fill('4');await tap('[data-part=review]');
    await until(()=>read('[data-projection]'),'Review');
    const totals=Object.fromEntries([...w.document.querySelectorAll('[data-count]')].map(n=>[n.dataset.count,Number(n.dataset.value)]));
    const before=await snapshot();
    record('S01-preview',terms.join('|')==='0 + 5|0 + 4'&&totals.blank===0&&totals.correct===2&&before.events.filter(e=>e.event_type==='answer.submitted').length===1,'Exact audited expression pair; preview 2 correct/0 blank, only first answer committed so far',{terms,totals,events:before.events.map(e=>e.event_type)});
    await tap('[data-part=finish]');await until(()=>w.location.hash.includes('/results/')&&read('.kp-lead'),'Results');
    const {a,events}=await snapshot(),m=a.metrics;
    record('S01-final',m.C===2&&m.B===0&&m.score_percent===100&&events.length===4&&events.at(-1).payload.expected_event_count===4,'2/2, 100%, four sequenced events with matching final references',{metrics:m,sequence:events.map(e=>e.event_sequence),references:events.at(-1).payload.final_responses});
    await launch('practice');fill('999');await tap('[data-submit]');await until(()=>read('[data-answer-feedback]'),'Wrong answer feedback');
    const feedback=read('[data-answer-feedback]').textContent;
    record('S08-policy-update',/Correct answer|Kunci jawaban/i.test(feedback)&&read('[data-part=next]'),'Wrong answer shows the key before any hint, and stays on the item',feedback);
    const disclosure=read('[data-answer-feedback] details');disclosure.querySelector('summary').click();
    record('S09-method',disclosure.open,'Complete steps can be opened without leaving the feedback card',disclosure.open);
    await tap('[data-part=revise]');
    fill('5');await tap('[data-submit]');await until(()=>read('[data-answer-feedback]')&&/Berikutnya|berikutnya|next/i.test(read('[data-submit]').textContent),'Correct response');
    // 1.4 (UX-03): the input row is hidden while practice feedback is open; the composition
    // guard sits on the form, so the Enter is dispatched inside the feedback card instead.
    const input=read('.app-view:not([inert]):not([aria-busy]) .kp-answer')||read('[data-answer-feedback]');const imeEvent=new w.KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true});
    input.dispatchEvent(imeEvent);
    record('S02-composition',imeEvent.defaultPrevented,'Composition Enter is not a submit',imeEvent.defaultPrevented);
    await tap('[data-part=next]');await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value===''&&read('#kp-question-position')?.textContent.includes('2'),'Enter default submit advances');
    record('S02-primary',(await snapshot()).a.index===1,'Input form submission advances after correct answer',read('#kp-question-position').textContent);
    await tap('[data-part=pause]');await until(()=>read('[data-part=resume]'),'Pause');await chooseLang(w,'en');await until(()=>read('[data-part=resume]')?.textContent==='Resume practice','Pause in English');
    record('L07-pause',(await snapshot()).a.ui_paused===true,'Persisted pause survives language change',read('[data-state-heading]').textContent);
    await tap('[data-part=resume]');await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer'),'Resumed');await tap('[data-part=review]');await tap('[data-part=finish]');await until(()=>read('.kp-lead'),'Result');
    await launch('assessment');fill('5');await tap('[data-part=flag]');await until(()=>read('[data-part=flag]')?.getAttribute('aria-pressed')==='true','Flag saved');
    await tap('[data-submit]');await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value==='','Next assessment question');
    await tap('[data-part=review]');await until(()=>read('[data-projection]'),'Non-revealing review');
    const rows=[...w.document.querySelectorAll('[data-review-index]')],startLabel=rows[0].getAttribute('aria-label');
    record('S03-map',rows.length>2&&/flagged/i.test(startLabel)&&!w.document.querySelector('[data-count=correct],[data-count=incorrect],[data-answer-feedback]'),'Neutral answered, blank, unseen and flagged map',rows.slice(0,3).map(n=>n.getAttribute('aria-label')));
    await tap('[data-review-index="0"]');await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value==='5','Direct jump to first answer');
    fill('1/');await tap('[data-part=review]');await tap('[data-part=finish]');await until(()=>read('.kp-answer[aria-invalid=true]'),'Rejected incomplete entry');
    record('S03-invalid',read('.app-view:not([inert]):not([aria-busy]) .kp-answer').value==='1/'&&w.document.activeElement===read('.app-view:not([inert]):not([aria-busy]) .kp-answer'),'Invalid revision is retained and focused',read('.app-view:not([inert]):not([aria-busy]) .kp-answer').value);
    await tap('[data-part=blank]');await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value==='','Explicit blank');await tap('[data-part=review]');await tap('[data-part=finish]');
    await until(()=>w.location.hash.includes('/results/')&&read('.kp-lead'),'Assessment result');
    const final=await snapshot();
    record('S03-final',final.a.metrics.W===0&&final.a.metrics.B===2&&final.a.items[0].history.length===1&&final.events.find(e=>e.event_type==='answer.submitted')?.payload.client_is_correct===null,'Explicit blank, same first response and neutral submitted event',final.a.metrics);
    const review=button(w.document,/^Review answers$/i);review.click();await until(()=>read('.kp-entry details'),'Completed review');
    const details=read('.kp-entry details');details.querySelector('summary').click();
    record('AC032-snapshot',details.open&&details.textContent.includes('First response')&&details.textContent.includes('5')&&read('.kp-entry h2').textContent===final.a.items[0].question.neutral_expression,'Post-session disclosure shows the actual retained first response and pinned expression',{first:final.a.items[0].history[0].raw_answer,heading:read('.kp-entry h2').textContent});
    (await until(()=>button(w.document,/^Try a similar question$/i),'Try related question')).click();
    const launchRelated=await until(()=>w.location.hash.includes('fromItem=')&&read('form.setup button[type=submit]:not(:disabled)'),'Pinned related item setup');
    const setupLabel=launchRelated.textContent;launchRelated.click();await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer'),'Related question');
    const related=await snapshot(),item=related.a.items[0],origin=final.a.items[0];
    record('AC032-similar',related.a.mode==='practice'&&related.a.items.length===1&&item.source_instance_id===origin.question_instance_id&&item.source_attempt_id===final.a.attempt_id&&item.question.template_id===origin.question.template_id&&item.question.fingerprint!==origin.question.fingerprint,'Review → related example → real one-question practice, same template with different expression and exact original provenance',{setup:setupLabel,source:origin.question_instance_id,target:item.source_instance_id,old:origin.question.neutral_expression,variation:item.question.neutral_expression});
    await tap('[data-part=review]');await tap('[data-part=finish]');await until(()=>read('.kp-lead'),'Related practice closed');
    await route(w,base,'progress');
    const rec=await until(()=>read('.kp-next button.main'),'Student recommendation');
    const nextTitle=read('.kp-next h2').textContent,nextCta=rec.textContent;
    const firstSkill=read('.kp-entry'),inOrder=Boolean(read('.kp-next').compareDocumentPosition(firstSkill)&w.Node.DOCUMENT_POSITION_FOLLOWING);
    rec.click();await until(()=>w.location.hash.startsWith('#/session/new')&&read('form.setup button[type=submit]:not(:disabled)'),'Recommended setup');
    record('AC035-next',inOrder&&new URLSearchParams(w.location.hash.split('?')[1]).get('op')==='ADD'&&/Addition/i.test(nextTitle),'Progress shows one primary recommendation for the recently practised skill before the complete matrix; CTA opens its real setup',{title:nextTitle,cta:nextCta,destination:w.location.hash,setup:read('form.setup button[type=submit]').textContent});
    await route(w,base,'progress');await until(()=>button(w.document,/Practice history/i),'History path');button(w.document,/Practice history/i).click();
    const filter=await until(()=>w.location.hash.startsWith('#/history')&&read('[data-route=history] .kp select'),'History status filter');filter.value='completed';filter.dispatchEvent(new w.Event('change',{bubbles:true}));
    await until(()=>read('[data-attempt]'),'A completed session');
    await delay(100);
    for(const [field,value] of [['history_topic','ADD'],['history_period','7']]){
      const pick=read('[name='+field+']');pick.value=value;pick.dispatchEvent(new w.Event('change',{bubbles:true}));
      await until(()=>w.document.activeElement?.name===field,'Filter updated '+field);
    }
    const target=w.document.querySelectorAll('[data-attempt]')[1]||read('[data-attempt]'),chosen=target.dataset.attempt;
    target.click();await until(()=>w.location.hash.includes('results/'+chosen)&&read('.kp-lead'),'Exact selected session');
    (await until(()=>button(w.document,/^Practice history$/i),'Return to history')).click();
    await until(()=>read('[data-attempt]')&&read('.kp select')?.value==='completed','Retained filter');
    await until(()=>w.document.activeElement?.dataset.attempt===chosen,'Return to chosen row');
    record('AC033-history',w.document.activeElement.dataset.attempt===chosen&&read('[name=history_topic]').value==='ADD'&&read('[name=history_period]').value==='7','Progress → history → completed session → same filter and focused row',{filter:read('.kp select').value,chosen});
    const api=await import(base+'data/store.js'),engine=await import(base+'player/engine.mjs');
    const meta=await (await fetch(base+'bank/g01/l01.json')).json(),pack=meta.competencies.find(c=>c.operation==='ADD').packages.find(e=>e.package_id==='MM-G01-L01-ADD-P001');
    const {default:pkg}=await import(base+pack.url);
    for(const mode of ['practice','assessment','speed','adaptive','recovery']){
      // Independent UI-state fixtures. Native setup/recovery item selection is exercised by journeys.
      const form=mode==='assessment'?meta.competencies.find(c=>c.operation==='ADD').packages.find(e=>e.form_id):null;
      const subject=form?(await import(base+form.url)).default:pkg;
      const seeded=engine.createAttempt(subject,owner,{lang:'en',mode,question_count:2,duration_seconds:mode==='speed'?60:0});
      await api.saveAttempt(seeded,null,owner);await api.releaseAttempt(seeded.attempt_id,owner);
      await route(w,base,'session/'+seeded.attempt_id);await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer'),'Fixture '+mode);
      fill('999');await tap('[data-submit]');
      if(mode==='assessment'){
        await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value==='','Saved assessment response');
        await tap('[data-part=review]');await tap('[data-review-index="0"]');
      }else{await until(()=>read('[data-answer-feedback]'),'Recorded first response '+mode);await tap('[data-part=revise]');}
      const correct=seeded.items[0].question.answer.numerator;
      await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value==='999','Original checked answer '+mode);fill(correct);
      await tap('[data-part=pause]');await until(()=>read('[data-part=resume]'),'Pause '+mode);
      const paused=await snapshot();
      const old=w.document;w.location.reload();
      await until(()=>w.document!==old&&!w.document.documentElement.hasAttribute('data-opening')&&read('[data-part=resume]'),'Restore pause '+mode);
      const leave=button(w.document,/^Leave and resume later$/i);leave.click();
      await until(()=>w.location.hash.includes('/history')&&read('.kp select'),'Saved session history');
      await route(w,base,'session/'+seeded.attempt_id);await until(()=>read('[data-part=resume]'),'Reopen '+mode);
      await tap('[data-part=resume]');await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value===correct,'Revised draft '+mode);
      await tap('[data-part=review]');await until(()=>read('[data-projection]'),'Preview revised draft '+mode);
      const projected=Object.fromEntries([...w.document.querySelectorAll('[data-count]')].map(n=>[n.dataset.count,+n.dataset.value]));
      const back=button(w.document,/^Return to questions$/i);back.click();
      await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value===correct,'Cancel finish '+mode);
      await tap('[data-part=review]');await tap('[data-part=finish]');await until(()=>read('.kp-lead'),'Committed '+mode);
      const persisted=await snapshot();
      const row=persisted.a.items[0],history=row.history.map(h=>h.raw_answer);
      const ok=paused.a.ui_paused&&paused.a.items[0].dirty&&row.final_status==='correct'&&history.join('|')==='999|'+correct&&
        paused.a.attempt_id===persisted.a.attempt_id&&paused.a.deadline===persisted.a.deadline&&
        (projected.correct??projected.answered)===1&&projected.unseen===persisted.a.metrics.U&&projected.blank===persisted.a.metrics.B&&persisted.events.length===4;
      record('AC002-003-012-027-'+mode,ok,'Checked 999 → valid revision → pause → reload → leave → same attempt → resume → preview → cancel → submit once',{mode,history,projection:projected,metrics:persisted.a.metrics,sequence:persisted.events.map(e=>e.event_type),deadline:persisted.a.deadline});
    }
    for(const raw of ['5','1/']){
      const seeded=engine.createAttempt(pkg,owner,{lang:'en',mode:'speed',question_count:2,duration_seconds:3});
      await api.saveAttempt(seeded,null,owner);await api.releaseAttempt(seeded.attempt_id,owner);
      await route(w,base,'session/'+seeded.attempt_id);await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer'),'Timed session');fill(raw);
      await until(()=>read('.kp-lead')&&w.location.hash.includes('/results/'),'Real time expiry',7000);
      const {a:timed,events:timedEvents}=await snapshot();
      const valid=raw==='5';
      record('AC023-deadline-'+(valid?'valid':'incomplete'),timed.finish_reason==='time_expired'&&timed.metrics.C===Number(valid)&&timed.metrics.B===Number(!valid)&&timed.metrics.U===1&&timedEvents.filter(e=>e.event_type==='attempt.completed').length===1&&(valid||timed.items[0].unsubmitted_draft.text===raw),'Real browser deadline processes last entry once, retains incomplete text and unseen status',{input:raw,counts:timed.metrics,reason:timed.finish_reason,events:timedEvents.map(e=>e.event_type)});
    }
    await launch('practice');
    const draftID=w.location.hash.split('/').pop(),savedBefore=await snapshot();
    const proto=w.IDBObjectStore.prototype,put=proto.put;
    const makeURL=w.URL.createObjectURL,anchorClick=w.HTMLAnchorElement.prototype.click;
    let triggered=0,downloaded,filename='';
    try{
      proto.put=function(value,...args){
        if(this.name==='attempts'&&value.id===draftID&&triggered===0){
          triggered++;
          throw new w.DOMException('Synthetic quota exhaustion','QuotaExceededError');
        }
        return put.call(this,value,...args);
      };
      // Capture the generated payload instead of prompting the test browser to save a file.
      w.URL.createObjectURL=function(blob){downloaded=blob;return makeURL.call(this,blob);};
      w.HTMLAnchorElement.prototype.click=function(){
        if(this.download){filename=this.download;return;}
        return anchorClick.call(this);
      };
      fill('3/');await until(()=>read('[data-save-issue]')&&read('[data-rescue]'),'Save failure handled');
      const heading=read('[data-save-issue]').textContent,failed=await snapshot();
      record('AC008-unsaved',triggered===1&&/storage is full|penyimpanan perangkat penuh/i.test(heading)&&read('.app-view:not([inert]):not([aria-busy]) .kp-answer').value==='3/'&&failed.a._rev===savedBefore.a._rev&&failed.a.items[0].draft==='','Rolled-back draft write leaves prior durable revision unchanged, draft visible with a quota-specific message',{heading,visible:read('.app-view:not([inert]):not([aria-busy]) .kp-answer').value,stored:failed.a.items[0].draft,revision:failed.a._rev});
      const unload=new w.Event('beforeunload',{cancelable:true});
      w.dispatchEvent(unload);
      const historyLink=w.document.querySelector('header a[href="#/history"]');
      historyLink.click();await until(()=>read('[data-part=stay]'),'Protected navigation');
      const guarded=w.location.hash.endsWith('/'+draftID)&&!!read('[data-part=leave]');
      await tap('[data-part=stay]');await until(()=>read('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value==='3/','Stay retains input');
      record('AC008-exit',guarded&&unload.defaultPrevented,'Reload event requests native confirmation; in-page navigation offers Stay or Leave without losing the draft',{native_cancelled:unload.defaultPrevented,guarded,retained:read('.app-view:not([inert]):not([aria-busy]) .kp-answer').value});
      await tap('[data-rescue]');await until(()=>{const err=read('[data-recovery-message]')?.dataset.errorCode;if(err)throw Error('Backup: '+err);return filename;},'Formal recovery backup');
      const backup=await (await import(base+'data/backup.js')).readBackup(await downloaded.text());
      record('AC008-rescue',backup.recovery_draft?.text==='3/'&&backup.recovery_draft?.attempt_id===draftID&&backup.profile.id===failed.a.profile_id&&backup.records.events.filter(r=>r.data.attempt_id===draftID).length===1,'Backup downloaded via real recovery control validates and retains unsaved draft separately with original event ledger',{format:backup.format,patch:backup.recovery_draft,filename});
      (await until(()=>button(w.document,/^Try saving again$|^Coba simpan lagi$/i),'Retry save')).click();
      await until(()=>!read('[data-save-issue]')&&read('.app-view:not([inert]):not([aria-busy]) .kp-answer')?.value==='3/','Retry completed');
      const retried=await snapshot();
      record('AC008-retry',retried.a.items[0].draft==='3/'&&retried.a.items[0].dirty&&retried.events.length===1&&retried.a._rev>failed.a._rev,'Retry stores the exact draft, never an answer event or grade',{draft:retried.a.items[0].draft,revision:retried.a._rev,events:retried.events.map(e=>e.event_type)});
    }finally{
      proto.put=put;w.URL.createObjectURL=makeURL;w.HTMLAnchorElement.prototype.click=anchorClick;
    }
  }catch(e){checks.push({id:'player-journey',status:'FAIL',expected:'all scenarios above complete',actual:String(e.message),location:w.location.hash,visible:w.document.querySelector('main')?.innerText.slice(0,1100)});}
  return checks;
}
