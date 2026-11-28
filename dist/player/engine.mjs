import {parseAnswer,equal,localizeDraft,solve} from './math.mjs';
import {summarizeAttempt,POLICY} from './analytics.mjs';
const iso=ms=>new Date(ms).toISOString();
const uuid=()=>crypto.randomUUID();
export const FEEDBACK_POLICY='visible-key-v2';
export const TIME_POLICY='continuous-deadline-v2';
// New practice attempts end on the last question straight into the result. Attempts
// created before 1.4.0 have no flow policy and keep the review-and-submit step.
export const FLOW_POLICY='direct-result-v1';
export function createAttempt(pkg,scope,{mode='practice',lang='id',duration_seconds=0,question_count,shuffle=false,assignment_id=null,pool_size,cycle={},recoveryItems,items,journey=null,adaptive=null,now=Date.now(),seed:fixedSeed}={}) {
  if (!['practice','speed','assessment','adaptive','recovery'].includes(mode) || !pkg.questions?.length) throw new Error('INVALID_PACKAGE');
  if (pkg.questions.some(q=>!equal(solve(q.expression_ast),q.answer))) throw new Error('INVALID_KEY');
  const id=uuid(), seed=Number.isSafeInteger(fixedSeed)?fixedSeed>>>0:crypto.getRandomValues(new Uint32Array(1))[0];
  if(items&&(!Array.isArray(items)||!items.length||items.some(r=>r.question?.competency_id!==pkg.target_competency_id||!pkg.questions.includes(r.question))))throw new Error('INVALID_SELECTION');
  let randomState=seed;
  const questions=[...pkg.questions];
  if (shuffle&&mode!=='assessment') {
    for(let i=questions.length-1;i>0;i--) {
      randomState=(Math.imul(1664525,randomState)+1013904223)>>>0;
      const j=Math.floor(randomState/4294967296*(i+1));
      [questions[i],questions[j]]=[questions[j],questions[i]];
    }
  }
  const limit=Number.isFinite(Number(question_count))?Math.max(1,Math.min(200,Math.floor(question_count))):questions.length;
  const rows=recoveryItems||items||questions.slice(0,mode==='assessment'?questions.length:limit).map(question=>({question}));
  const a={attempt_id:id,schema_version:'1.0.0',status:'ongoing',profile_id:scope.profileId,data_origin:scope.origin,mode,package_id:pkg.package_id,package_title:pkg.title,grade:pkg.grade,level:pkg.level,operation:pkg.operation,target_competency_id:pkg.target_competency_id,content_version:pkg.content_version,curriculum_version:pkg.curriculum_version,policy_version:POLICY,feedback_policy_version:FEEDBACK_POLICY,timing_policy_version:TIME_POLICY,form_id:pkg.form_id||null,form_family_id:pkg.form_family_id||null,form_instance_id:mode==='assessment'?uuid():null,assessment_cycle_id:null,...cycle,assignment_id,pool_size:pool_size??20,order_seed:String(seed),index:0,created_at:iso(now),started_at:iso(now),completed_at:null,duration_seconds:mode==='speed'?Math.max(1,Math.min(7200,Number(duration_seconds)||60)):mode==='assessment'?Math.max(0,Math.min(7200,Number(duration_seconds)||0)):0,deadline:null,ready:false,adaptive,...(journey?{journey}:{}),...(mode==='assessment'?{}:{flow_policy_version:FLOW_POLICY}),locale:lang,items:rows.map((row,index)=>({...row,question_instance_id:id+'.'+(index+1),seen:false,draft:'',draft_locale:lang,dirty:false,history:[],hint_used:false,feedback:false,final_status:'unseen',active_ms:0,timing_quality:'valid_client_estimate'}))};
  return a;
}
export function context(a) {
  return {...(a.feedback_policy_version?{feedback_policy_version:a.feedback_policy_version,timing_policy_version:a.timing_policy_version}:{}),module_id:'mental-math',curriculum_id:'kalibataku',curriculum_version:a.curriculum_version,package_id:a.package_id,content_version:a.content_version,material_grade:a.grade,level:a.level,mode:a.mode,locale:a.locale,policy_version:a.policy_version,assignment_id:a.assignment_id,form_id:a.form_id,assessment_cycle_id:a.assessment_cycle_id};
}
const event=(a,type,payload,id=uuid())=>({event_id:id,event_type:type,context:context(a),payload});
function ref(item) {
  const q=item.question;
  return {question_instance_id:item.question_instance_id,question_id:q.question_id,question_revision:q.question_revision,competency_id:q.competency_id};
}
function active(a) { if(a.status!=='ongoing') throw new Error('ATTEMPT_FINAL'); }
export function visit(a,index,now=Date.now()) {
  active(a);
  if (!Number.isInteger(index)||index<0||index>=a.items.length) throw new Error('INDEX');
  a.index=index;
  const item=a.items[index];
  item.seen=true;
  item.first_seen_at??=iso(now);
  if(item.final_status==='unseen') item.final_status='blank';
}
export function begin(a,now=Date.now()) {
  active(a); if(a.ready) return null;
  a.ready=true;a.started_at=iso(now);a.deadline=a.duration_seconds?now+a.duration_seconds*1000:null;
  visit(a,0,now);
  return event(a,'attempt.started',{instances:a.items.map(ref),order_seed:a.order_seed,started_at_client:a.started_at});
}
export function deadlineRemaining(a,wall=Date.now(),anchor=null,mono=performance.now()) {
  if (!a.deadline) return null;
  const effective=anchor?Math.max(wall,anchor.wall+Math.max(0,mono-anchor.mono)):wall;
  return Math.max(0,a.deadline-effective);
}
export function editDraft(a,index,text,locale=a.locale) {
  active(a);
  const item=a.items[index];
  if (item.draft===text) return;
  if (!item.draft) item.draft_locale=locale;
  item.draft=text;item.dirty=true;item.feedback=false;
  if(!text.trim()) item.draft_locale=locale;
  if(item.draft_locale!==locale) localizeDraft(item,locale);
}
export function changeLocale(a,locale) { a.locale=locale;for(const item of a.items) localizeDraft(item,locale); }
export function submit(a,index,now=Date.now(),{reveal=a.mode!=='assessment'}={}) {
  active(a);
  const item=a.items[index];
  if(!item.dirty&&item.last_event_id&&['correct','incorrect'].includes(item.final_status)) return null;
  const p=parseAnswer(item.draft,item.draft_locale);
  if(p.status!=='valid') throw new Error(p.error);
  const id=uuid(),isCorrect=equal(p.value,item.question.answer);
  const elapsed=now-Date.parse(item.first_seen_at);
  if(!Number.isFinite(elapsed)||elapsed<0) item.timing_quality='clock_anomaly';
  const payload={...ref(item),answer:p.value,raw_answer:item.draft,draft_locale:item.draft_locale,submission_kind:item.history.length?(a.mode==='assessment'?'revision':'retry'):'first',attempt_number:item.history.length+1,hint_used:item.hint_used,active_duration_ms:Math.max(0,Math.round(item.active_ms)),elapsed_duration_ms:Number.isFinite(elapsed)?Math.max(0,Math.round(elapsed)):null,timing_quality:item.timing_quality,client_is_correct:a.mode==='assessment'?null:isCorrect};
  // Capture assistance as it stood before scoring. Later reveals never rewrite this response.
  const showing=reveal&&a.mode!=='assessment';
  payload.key_seen_before=!!item.key_revealed_at;
  payload.hint_before=!!item.hint_used;
  payload.feedback_policy_version=FEEDBACK_POLICY;
  payload.first_correct=a.mode==='assessment'?null:(item.history[0]?.is_correct??isCorrect);
  if(showing){
    item.key_revealed_at??=iso(now);item.key_reveal_reason??='checked_response';
    payload.key_revealed_at=item.key_revealed_at;payload.key_reveal_reason=item.key_reveal_reason;
  }
  item.history.push({...payload,event_id:id,is_correct:isCorrect});
  item.first_correct=item.history[0].is_correct;item.final_correct=isCorrect;
  item.final_status=isCorrect?'correct':'incorrect';
  item.feedback=showing;item.dirty=false;item.last_event_id=id;
  return event(a,'answer.submitted',payload,id);
}
export function clearResponse(a,index,skipped=false) {
  active(a);
  const i=a.items[index]; const previous=i.final_status;
  if(skipped&&previous==='skipped'&&!i.dirty)return null;
  i.final_status=skipped?'skipped':'blank';i.draft='';i.dirty=false;i.draft_locale=a.locale;i.feedback=false;i.last_event_id=null;
  if(!skipped) return null;
  const e=event(a,'question.skipped',{question_instance_id:i.question_instance_id,question_id:i.question.question_id,competency_id:i.question.competency_id,reason:'user_skip'});
  i.last_event_id=e.event_id;return e;
}
export function noteHint(a,index) { active(a);if (a.mode==='assessment') throw new Error('HINT_UNAVAILABLE');a.items[index].hint_used=true; }
// The preview and the transaction use this same read-only decision for each row.
// A timed-out malformed revision keeps its last confirmed response and its raw draft.
export function projectFinal(a,{expired=false}={}) {
  const rows=a.items.map((item,index)=>{
    let status=item.final_status, action='keep';
    if(item.dirty) {
      const parsed=parseAnswer(item.draft,item.draft_locale);
      if(parsed.status==='valid') {
        action='submit';
        status=equal(parsed.value,item.question.answer)?'correct':'incorrect';
      } else if(expired) {
        action='retain';
      } else {
        action='edit';
        status='incomplete';
      }
    }
    return {index,status,action,flagged:!!item.flagged};
  });
  const counts={correct:0,incorrect:0,blank:0,skipped:0,unseen:0,incomplete:0,flagged:0};
  for(const row of rows){counts[row.status]++;if(row.flagged)counts.flagged++;}
  return {rows,counts};
}
export function commitDraft(a,index,now=Date.now()) {
  const item=a.items[index];
  if(!item.dirty)return null;
  if(parseAnswer(item.draft,item.draft_locale).status!=='valid'){
    const err=new Error('DIRTY_INVALID');err.index=index;throw err;
  }
  return submit(a,index,now,{reveal:false});
}
export function finish(a,{now=Date.now(),expired=false}={}) {
  if(a.status==='completed') return [];
  active(a);
  const {rows}=projectFinal(a,{expired});
  const invalid=rows.find(row=>row.action==='edit');
  if(invalid){const err=new Error('DIRTY_INVALID');err.index=invalid.index;throw err;}
  const events=[];
  for(const {index,action} of rows) {
    if(action==='submit')events.push(submit(a,index,now,{reveal:false}));
    if(action==='retain') {
      const i=a.items[index];
      i.unsubmitted_draft={text:i.draft,locale:i.draft_locale,reason:'time_expired'};
      const last=['correct','incorrect'].includes(i.final_status)?i.history.at(-1):null;
      i.draft=last?.raw_answer??'';i.draft_locale=last?.draft_locale??a.locale;i.dirty=false;
    }
  }
  a.status='completed';a.completed_at=iso(now);a.finish_reason=expired?'time_expired':'submitted';a.metrics=summarizeAttempt(a);
  const final_responses=a.items.map(i=>({question_instance_id:i.question_instance_id,response_event_id:i.last_event_id||null,status:['correct','incorrect'].includes(i.final_status)?'answered':i.final_status}));
  events.push(event(a,'attempt.completed',{expected_event_count:(a._seq||0)+events.length+1,final_responses,completed_at_client:a.completed_at}));
  return events.filter(Boolean);
}
