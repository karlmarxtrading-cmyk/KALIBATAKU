import {compareInstants} from '../data/time.js';
export const POLICY='mastery-local-v1';
export const DAY=86400000;
const pct=(a,b)=>b?100*a/b:null;
const codes={correct:'C',incorrect:'W',skipped:'S',blank:'B',unseen:'U'};
export function metricsFromCounts(c={}) {
  const {C=0,W=0,S=0,B=0,U=0,N=C+W+S+B+U}=c;
  return {N,C,W,S,B,U,score_percent:pct(C,N),accuracy_percent:pct(C,C+W),responded_percent:pct(C+W+S,N)};
}
export function summarizeAttempt(a,competency) {
  const counts={C:0,W:0,S:0,B:0,U:0};
  const items=(a.items||[]).filter(x=>!competency||x.question.competency_id===competency);
  let firstN=0,firstCorrect=0,retries=0,hints=0;
  for (const item of items) {
    counts[codes[item.final_status] || (item.seen?'B':'U')]++;
    if (item.history?.length) {
      firstN++;
      firstCorrect+=Number(item.history[0].is_correct===true);
      retries+=item.history.filter(r=>r.submission_kind==='retry').length;
    }
    hints+=Number(!!item.hint_used);
  }
  return {...metricsFromCounts(counts),first_response_count:firstN,first_correct:firstCorrect,first_response_accuracy:pct(firstCorrect,firstN),retries,hints};
}
export function aggregateCounts(rows) {
  const sum={N:0,C:0,W:0,S:0,B:0,U:0};
  for (const obj of rows) for (const key of Object.keys(sum)) sum[key]+=obj[key]||0;
  return metricsFromCounts(sum);
}
export function timingStats(items) {
  const candidates=items.flatMap(i=>i.history?.slice(0,1)||[]);
  const numeric=candidates.filter(x=>x.is_correct&&!(x.hint_before??x.hint_used)&&!x.key_seen_before);
  const samples=numeric.filter(x=>x.timing_quality==='valid_client_estimate'&&Number.isFinite(x.active_duration_ms)&&x.active_duration_ms>0&&x.active_duration_ms<=x.elapsed_duration_ms).map(x=>x.active_duration_ms).sort((a,b)=>a-b);
  const n=samples.length,m=Math.floor(n/2);
  return {n,excluded:numeric.length-n,median_ms:n<10?null:n%2?samples[m]:(samples[m-1]+samples[m])/2,p90_ms:n<10?null:samples[Math.ceil(.9*n)-1]};
}
function cmpDate(field) { return (a,b)=>compareInstants(a[field],b[field])||String(a.attempt_id).localeCompare(String(b.attempt_id)); }
function sliceRows(rows,id) {
  return rows.filter(a=>a.mode==='assessment'&&a.status==='completed'&&a.form_family_id&&a.form_id&&a.assessment_cycle_id&&a.items?.some(i=>i.question.competency_id===id)&&!a.items.some(i=>i.hint_used)).sort(cmpDate('completed_at'));
}
function groupKey(a,id) {
  const items=a.items.filter(i=>i.question.competency_id===id);
  return JSON.stringify([a.form_family_id,a.content_version,a.policy_version,a.feedback_policy_version||'legacy',a.timing_policy_version||'legacy',a.grade,a.level,a.duration_seconds||0,a.profile_id,a.data_origin,items.length]);
}
export function comparable(first,second,competency) {
  if (!first || !second || first.mode!=='assessment'||second.mode!=='assessment'||!first.form_family_id||!second.form_family_id) return false;
  return groupKey(first,competency)===groupKey(second,competency);
}
export function changeInPoints(first,second,isComparable) {
  return isComparable&&first!=null&&second!=null ? second-first : null;
}
export function adaptiveDecision(attempts,competency,prerequisites=[]) {
  const forms=sliceRows(attempts,competency);
  const last=forms.at(-1), pair=last?forms.filter(a=>comparable(a,last,competency)).slice(-2):[];
  if (pair.length<2) return {decision:'collect',target:competency,forms:pair.length,evidence:pair.map(a=>a.attempt_id)};
  const scores=pair.map(a=>summarizeAttempt(a,competency).score_percent);
  let decision='vary',target=competency;
  if (scores.every(n=>n<70)&&prerequisites.length) { decision='prerequisite'; target=prerequisites[0]; }
  else if (scores.every(n=>n>=90)) decision='assess';
  return {decision,target,forms:2,scores,evidence:pair.map(a=>a.attempt_id)};
}
export function chooseCycle(attempts,id,{retest=false,now=Date.now(),spacingHours=24}={}) {
  const previous=attempts.filter(a=>a.mode==='assessment'&&a.assessment_cycle_id&&a.target_competency_id===id).sort(cmpDate('started_at')).at(-1);
  const reinforcement=attempts.filter(a=>['practice','recovery','adaptive'].includes(a.mode)&&a.status==='completed'&&a.items?.some(i=>i.question.competency_id===id&&i.history?.length)&&previous&&Date.parse(a.completed_at)>Date.parse(previous.completed_at||previous.started_at)).sort(cmpDate('completed_at')).at(-1);
  if (retest&&(!previous||!reinforcement)) throw new Error('RETEST_NEEDS_PRACTICE');
  if (previous&&!retest&&now-Date.parse(previous.cycle_started_at||previous.started_at)<60*DAY)
    return {assessment_cycle_id:previous.assessment_cycle_id,cycle_started_at:previous.cycle_started_at||previous.started_at,cycle_trigger:previous.cycle_trigger||'initial',spacing_hours_policy:previous.spacing_hours_policy??24};
  return {assessment_cycle_id:crypto.randomUUID(),cycle_started_at:new Date(now).toISOString(),spacing_hours_policy:spacingHours,cycle_trigger:retest?'retest':previous?'expired':'initial',reinforcement_attempt_id:retest?reinforcement.attempt_id:null};
}
export function mastery(attempts,id,{now=Date.now(),spacingHours,pool_size,cycle_id}={}) {
  const forms=sliceRows(attempts,id);
  const recent=attempts.filter(a=>a.mode==='assessment'&&a.assessment_cycle_id&&a.items?.some(i=>i.question.competency_id===id)).sort(cmpDate('started_at')).at(-1);
  const cycle=cycle_id||recent?.assessment_cycle_id;
  const current=forms.filter(a=>a.assessment_cycle_id===cycle);
  const last=current.at(-1);
  const selected=last?current.filter(a=>comparable(a,last,id)):[];
  const pool=pool_size??last?.pool_size??20, needed=Math.min(20,pool);
  const seen=new Map(), allSeen=new Set();
  for (const a of forms) for (const i of a.items) if(i.question.competency_id===id) allSeen.add(i.question.fingerprint);
  let exposures=0;
  for (const a of selected) for (const i of a.items) {
    if (i.question.competency_id!==id) continue;
    exposures++;
    if (!seen.has(i.question.fingerprint)) seen.set(i.question.fingerprint,i.final_status==='correct');
  }
  const unique=seen.size,correct=[...seen.values()].filter(Boolean).length, scores=selected.map(a=>summarizeAttempt(a,id).score_percent);
  const spacing=selected.length>1?(Date.parse(last.completed_at)-Date.parse(selected[0].completed_at))/3600000:0;
  const formInstances=new Set(selected.map(a=>a.form_instance_id||a.attempt_id));
  const distinctForms=new Set(selected.map(a=>a.form_id));
  const cycleStart=Date.parse(last?.cycle_started_at||selected[0]?.started_at);
  const end=Date.parse(last?.completed_at);
  const eligibleLifetime=Number.isFinite(cycleStart)&&end>=cycleStart&&end-cycleStart<=60*DAY;
  const gates={pool:pool>=8,sample:unique>=needed,accuracy:unique>0&&correct/unique>=.9,forms:formInstances.size>=2&&distinctForms.size>=2,spacing:spacing>=(spacingHours??last?.spacing_hours_policy??24),scores:scores.length>0&&scores.every(s=>s>=80),lifetime:eligibleLifetime};
  const passed=Object.values(gates).every(Boolean);
  const status=passed?'mastered_provisional':pool<8?'insufficient_evidence':unique>=needed?'developing':forms.length||recent?'insufficient_evidence':'not_started';
  return {status,gates,policy_version:POLICY,assessment_cycle_id:cycle||null,forms:selected.length,unique,correct,needed,accuracy_percent:pct(correct,unique),scores,spacing_hours:spacing,overlap:exposures-unique,all_time_unique:allSeen.size,exposures,review_due:passed&&now-end>=7*DAY,review_interval_days:passed&&now-end>=30*DAY?30:7,cycle_expired:Number.isFinite(cycleStart)&&now-cycleStart>=60*DAY};
}
export function levelMastery(attempts,cells) {
  const active=cells.filter(x=>x.active);
  const rows=active.map(c=>mastery(attempts,c.competency_id,{pool_size:c.pool_size}));
  const count=rows.filter(r=>r.status==='mastered_provisional').length;
  return {total:active.length,mastered:count,complete:active.length>0&&count===active.length};
}
export function recoveryQueue(attempts,id) {
  const sorted=attempts.filter(a=>a.status==='completed').sort(cmpDate('completed_at'));
  const pending=new Map();
  for(const a of sorted) for(const i of a.items??[]) {
    if (id&&i.question.competency_id!==id) continue;
    if (a.mode==='recovery'&&i.recovery_role==='variation'&&i.final_status==='correct') pending.delete(i.source_instance_id);
    if (a.mode!=='recovery'&&(['incorrect','skipped'].includes(i.final_status)||i.history?.[0]?.is_correct===false)) pending.set(i.question_instance_id,{item:i,attempt:a});
  }
  return [...pending.values()].reverse();
}

export function progressModel(attempts,cells) {
  const rows=cells.filter(c=>c.active).map(c=>{
    const evidence=mastery(attempts,c.competency_id,{pool_size:c.pool_size});
    const decision=adaptiveDecision(attempts,c.competency_id,c.prerequisites||[]);
    const prior=attempts.filter(a=>a.mode==='assessment'&&a.target_competency_id===c.competency_id).sort(cmpDate('started_at')).at(-1);
    const trained=!!prior&&attempts.some(a=>['practice','recovery','adaptive'].includes(a.mode)&&a.status==='completed'&&a.target_competency_id===c.competency_id&&a.items?.some(i=>i.history?.length)&&compareInstants(a.completed_at,prior.completed_at||prior.started_at)>0);
    return {competency_id:c.competency_id,operation:c.operation,evidence,decision,trained};
  });
  return {rows,total:rows.length,mastered:rows.filter(x=>x.evidence.status==='mastered_provisional').length};
}
