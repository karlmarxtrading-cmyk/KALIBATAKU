import {compareInstants} from '../data/time.js';
import {resolveActiveScope,getAttempt,listAttempts,saveAttempt,listRecords,scopeKey} from '../data/store.js';
import {exposure} from '../journey/model.mjs';
import {adaptiveDecision,chooseCycle,recoveryQueue} from './analytics.mjs';
import {createAttempt} from './engine.mjs';
import {solve,equal} from './math.mjs';
import {readShard} from '../core/bank.mjs';
import {readVerifiedPackage} from '../core/package-data.mjs';

export async function cells(grade,level,signal) {
  const index=await readShard('bank/index.json',signal);
  const g=index.grades.find(v=>v.grade===Number(grade));
  if(!g)throw new Error('BANK_LOAD');
  const l=(await readShard(g.url,signal)).levels.find(v=>v.level===Number(level));
  if(!l)throw new Error('BANK_LOAD');
  return (await readShard(l.url,signal)).competencies;
}
const checked=new WeakSet();
export async function open(entry,signal,installedBytes) {
  const pkg=await readVerifiedPackage(entry,signal,installedBytes);
  if(!pkg||pkg.package_id!==entry.package_id||pkg.content_version!==entry.content_version||
    pkg.questions?.length!==entry.question_count||!pkg.questions.length)throw new Error('INVALID_PACKAGE');
  if(!checked.has(pkg)){
    if(pkg.questions.some(q=>!equal(solve(q.expression_ast),q.answer)))throw new Error('INVALID_KEY');
    checked.add(pkg);
  }
  return pkg;
}
// A snapshot resumes independently. A new session requires a fresh check at
// setup and another at commit since a cached file can change between clicks.
async function offlineReader(ctx){
  const {packageInventory,verifyPackage}=await import('../data/offline-verification.mjs');
  const inventory=await packageInventory(ctx.signal);
  let connected;
  return async entry=>{
    const copy=await verifyPackage(inventory,entry.package_id,entry.content_version);
    if(copy.state==='absent'){
      const {originAvailable}=await import('../core/reachability.mjs');
      connected??=await originAvailable(ctx.signal);
      if(connected)return open(entry,ctx.signal);
    }
    if(copy.state!=='ready'){
      const error=new Error('OFFLINE_'+copy.state.toUpperCase());
      error.packageId=entry.package_id;
      throw error;
    }
    return open(entry,ctx.signal,copy.bytes);
  };
}
function stableChoice(options,attempts) {
  const times=entry=>attempts.filter(a=>a.package_id===entry.package_id).length;
  return [...options].sort((a,b)=>times(a)-times(b))[0];
}
export async function prepareSession(ctx,options) {
  const scope=await resolveActiveScope(),mode=options.mode||'practice';
  if(!['practice','speed','assessment','adaptive','recovery'].includes(mode))throw new Error('INVALID_MODE');
  const assigned=options.assignment_id||options.assignmentId||options.id;
  const attempts=(assigned||['adaptive','recovery','assessment','practice','speed'].includes(mode))?await listAttempts(scope):[];
  const ongoing=assigned&&attempts.find(a=>a.assignment_id===assigned&&a.status==='ongoing');
  if(ongoing)return {scope,existing:ongoing.attempt_id};
  let entry=options.entry,pkg=options.pkg,adaptive=null,recoveryItems;
  const grade=Number(options.grade||pkg?.grade),level=Number(options.level||pkg?.level),op=options.operation||pkg?.operation;
  let cell=(await cells(grade,level,ctx.signal)).find(c=>c.operation===op&&c.active);
  if(!cell)throw new Error('BANK_LOAD');
  const requested=options.packageId||options.package_id||entry?.package_id||pkg?.package_id;
  if(requested){
    entry=cell.packages.find(x=>x.package_id===requested);
    if(!entry)throw new Error('BANK_LOAD');
  }
  if(mode==='adaptive'){
    adaptive=adaptiveDecision(attempts,cell.competency_id,cell.prerequisites||[]);
    if(adaptive.target!==cell.competency_id){
      const match=adaptive.target.match(/\.g(\d+)\.l(\d+)$/);
      if(match)cell=(await cells(+match[1],+match[2],ctx.signal)).find(c=>c.competency_id===adaptive.target)||cell;
    }
    const choices=cell.packages.filter(e=>!e.form_id);
    entry=stableChoice(choices.length?choices:cell.packages,attempts);pkg=null;
  }
  let cycle={};
  if(mode==='assessment'){
    const preferences=await listRecords('mastery-spacing',scope,{includeRecordId:true});
    const spacingHours=preferences.sort((a,b)=>compareInstants(b.at,a.at)||b.record_id.localeCompare(a.record_id))[0]?.hours??24;
    cycle=chooseCycle(attempts,cell.competency_id,{retest:!!options.retest,spacingHours});
    const forms=cell.packages.filter(p=>p.form_id&&p.form_family_id);
    if(!forms.length)throw new Error('NO_FORM');
    if((!options.explicit_package&&!assigned&&!pkg)||!entry?.form_id){
      entry=stableChoice(forms,attempts.filter(a=>a.assessment_cycle_id===cycle.assessment_cycle_id));pkg=null;
    }
  }else if(mode!=='recovery'&&entry?.form_id&&!assigned){
    // Keep A/B assessment material in its own mode; practice uses a teaching package.
    entry=stableChoice(cell.packages.filter(p=>!p.form_id),attempts);pkg=null;
  }
  const read=await offlineReader(ctx);
  const similar=mode==='practice'&&Boolean(options.fromAttempt||options.fromItem);
  if(mode==='recovery'||similar){
    let origin;
    if(similar){
      const attempt=options.fromAttempt&&await getAttempt(options.fromAttempt,scope);
      const item=attempt?.items.find(i=>i.question_instance_id===options.fromItem);
      if(!item||attempt.status!=='completed'||item.question.competency_id!==cell.competency_id)throw new Error('VARIANT_SOURCE');
      origin={attempt,item};
    }else{
      origin=recoveryQueue(attempts,cell.competency_id)[0];
      if(!origin)throw new Error('RECOVERY_EMPTY');
    }
    const q=origin.item.question;
    const originalSet=new Set(origin.attempt.items.map(item=>item.question.fingerprint));
    // Prefer teaching packages, and try the source within its group first.
    const rank=p=>Number(Boolean(p.form_id))*2+Number(p.package_id!==origin.attempt.package_id);
    const candidates=[...cell.packages].sort((left,right)=>rank(left)-rank(right));
    let variant,unavailable=false;
    for(const candidate of candidates){
      ctx.signal?.throwIfAborted();
      let data;
      try{data=await read(candidate);}
      catch(error){
        if(error.name==='TypeError'||error.message==='BANK_LOAD'||error.message.startsWith('OFFLINE_')){unavailable=true;continue;}
        throw error;
      }
      const eligible=data.questions.filter(i=>i.question_id!==q.question_id&&i.fingerprint!==q.fingerprint&&i.template_id===q.template_id&&i.competency_id===q.competency_id);
      variant=eligible.find(i=>!originalSet.has(i.fingerprint))||eligible[0];
      if(variant){entry=candidate;pkg=data;break;}
    }
    if(!variant)throw new Error(unavailable?'VARIANT_UNAVAILABLE':'NO_VARIANT');
    const provenance={source_attempt_id:origin.attempt.attempt_id,source_instance_id:origin.item.question_instance_id,source_fingerprint:q.fingerprint};
    recoveryItems=similar?[{question:variant,...provenance,practice_role:'similar'}]:
      [{question:q,...provenance,recovery_role:'original'},{question:variant,...provenance,recovery_role:'variation'}];
  }
  entry??=cell.packages[0];
  const actual=await read(entry);
  if(pkg&&pkg.package_id!==actual.package_id)throw new Error('INVALID_PACKAGE');
  pkg=actual;
  if(ctx.signal?.aborted)throw new DOMException('Navigation','AbortError');
  const fixed=mode==='assessment'||Boolean(recoveryItems);
  const max=recoveryItems?.length??pkg.questions.length;
  const count=fixed?max:Number(options.question_count??max);
  if(!Number.isInteger(count)||count<1||count>max)throw new Error('INVALID_COUNT');
  // PG-02 (catalogue path): a shorter practice set takes questions this profile has not
  // seen yet first, in package order, instead of always the same prefix. The set is frozen
  // in the attempt like before; shuffle and the journey keep their own ordering.
  let ordered;
  if(!fixed&&!options.shuffle&&count<max&&['practice','speed'].includes(mode)){
    const seen=exposure(attempts,pkg.target_competency_id);
    const viewed=q=>seen.has(q.fingerprint.slice(0,16));
    const fresh=pkg.questions.filter(q=>!viewed(q)),again=pkg.questions.filter(viewed);
    if(again.length)ordered=[...fresh,...again].slice(0,count).map(question=>({question}));
  }
  const seconds=mode==='speed'?Math.max(1,Math.min(7200,Number(options.duration_seconds)||60)):
    mode==='assessment'?Math.max(0,Math.min(7200,Number(options.duration_seconds)||0)):0;
  return {scope,pkg,entry,cell,count,max,mode,seconds,adaptive,fixed,similar,
    options:{mode,question_count:count,duration_seconds:seconds,shuffle:!fixed&&Boolean(options.shuffle),pool_size:cell.pool_size,assignment_id:assigned||null,cycle,recoveryItems,adaptive,...(ordered?{items:ordered}:{})}};
}

export async function launchPrepared(ctx,plan) {
  if(scopeKey(await resolveActiveScope())!==scopeKey(plan.scope))throw new Error('WRONG_PROFILE');
  if(ctx.signal?.aborted)throw new DOMException('Navigation','AbortError');
  if(plan.existing)return plan.existing;
  if(plan.committing)return plan.committing;
  plan.committing=(async()=>{
    const read=await offlineReader(ctx);
    await read(plan.entry);
    const attempt=createAttempt(plan.pkg,plan.scope,{...plan.options,lang:ctx.lang});
    await saveAttempt(attempt,null,plan.scope);
    return attempt.attempt_id;
  })();
  try{return await plan.committing;}
  catch(error){delete plan.committing;throw error;}
}
export async function start(ctx,options) {
  return launchPrepared(ctx,await prepareSession(ctx,options));
}
