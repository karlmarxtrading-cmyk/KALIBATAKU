import {epoch} from './time.js';
import {canonical,sha256,SAFE_ID,invariant} from './common.js';
import {validate} from './validate.js';
import {solve,equal,parseAnswer} from '../player/math.mjs';
import {summarizeAttempt} from '../player/analytics.mjs';
const assert=(v)=>invariant(v,'INVALID_BACKUP_ATTEMPT');
const validDate=s=>Number.isFinite(epoch(s));
function encode(node) {
  if(node.kind==='rational') {
    const reduced=solve(node);assert(node.numerator===reduced.numerator&&node.denominator===reduced.denominator);
    if(node.display?.kind==='integer')assert(node.denominator==='1');
    if(node.display?.kind==='fraction')assert(equal(node,node.display));
    return 'R:'+node.numerator+'/'+node.denominator;
  }
  const children=[encode(node.left),encode(node.right)];if(['ADD','MUL'].includes(node.operation))children.sort();
  return node.operation+'('+children.join(',')+')';
}
export async function validateSnapshot(a,events,journeySource) {
  assert(['ongoing','completed','abandoned'].includes(a.status)&&['id','en'].includes(a.locale) &&
    Number.isInteger(a.index)&&a.index>=0&&a.index<a.items.length&&typeof a.ready==='boolean'&&
    validDate(a.started_at)&&Number.isInteger(a.grade)&&a.grade>=1&&a.grade<=12&&Number.isInteger(a.level)&&a.level>=1&&a.level<=5&&
    ['ADD','SUB','MUL','DIV','MIX'].includes(a.operation) && typeof a.package_title?.id==='string'&&typeof a.package_title?.en==='string' &&
    typeof a.policy_version==='string'&&typeof a.content_version==='string'&&(!a.completed_at||validDate(a.completed_at)));
  const byInstance=new Map(),byEvent=new Map(events.map(e=>[e.event_id,e]));
  let start,end;
  for(const i of a.items){
    const id=i.question_instance_id,q=validate('Question',i.question);
    assert(SAFE_ID.test(id)&&!byInstance.has(id)&&(typeof i.seen==='boolean'||(!Object.hasOwn(i,'seen')&&!a.journey?.exposure_policy))&&typeof i.hint_used==='boolean'&&
      typeof i.draft==='string'&&i.draft.length<=80&&['en','id'].includes(i.draft_locale)&&Array.isArray(i.history)&&
      ['correct','incorrect','skipped','blank','unseen'].includes(i.final_status));
    byInstance.set(id,i);assert(equal(solve(q.expression_ast),q.answer));
    assert(await sha256(encode(q.expression_ast))===q.fingerprint);
    for(const step of q.solution_steps)assert(equal(solve(step.expression_ast),q.answer));
    for(const [index,h] of i.history.entries()){
      const e=byEvent.get(h.event_id);
      assert(e?.event_type==='answer.submitted' && e.payload.question_instance_id===id && e.payload.attempt_number===index+1);
      const {event_id,is_correct,...payload}=h;
      assert(canonical(payload)===canonical(e.payload) && is_correct===equal(e.payload.answer,q.answer));
    }
    if(['correct','incorrect'].includes(i.final_status)){
      const last=i.history.at(-1);assert(last&&i.last_event_id===last.event_id&&last.is_correct===(i.final_status==='correct'));
    }else if(i.last_event_id)assert(i.final_status==='skipped'&&byEvent.get(i.last_event_id)?.event_type==='question.skipped');
  }
  for(const e of events){
    const ctx=e.context;assert(ctx.package_id===a.package_id&&ctx.content_version===a.content_version&&ctx.mode===a.mode&&ctx.policy_version===a.policy_version&&
      ctx.material_grade===a.grade&&ctx.level===a.level&&ctx.assignment_id===a.assignment_id&&ctx.assessment_cycle_id===a.assessment_cycle_id);
    if(e.event_type==='attempt.started'){
      assert(!start&&e.event_sequence===1&&e.payload.instances.length===a.items.length);start=e;
      e.payload.instances.forEach((x,n)=>{const i=a.items[n];
        assert(x.question_instance_id===i.question_instance_id&&x.question_id===i.question.question_id&&x.question_revision===i.question.question_revision&&x.competency_id===i.question.competency_id);});
    }else if(['answer.submitted','question.skipped'].includes(e.event_type)){
      const p=e.payload,i=byInstance.get(p.question_instance_id);
      assert(i&&p.question_id===i.question.question_id&&p.competency_id===i.question.competency_id);
      if(e.event_type==='answer.submitted'){
        const parsed=parseAnswer(p.raw_answer,p.draft_locale);
        assert(p.question_revision===i.question.question_revision&&parsed.status==='valid'&&equal(parsed.value,p.answer));
        assert(p.client_is_correct===(a.mode==='assessment'?null:equal(p.answer,i.question.answer)));
        assert(i.history[p.attempt_number-1]?.event_id===e.event_id);
      }
    }else if(e.event_type==='attempt.completed'){
      assert(!end&&e.event_sequence===a._seq&&e.payload.expected_event_count===a._seq&&e.payload.final_responses.length===a.items.length);end=e;
      const ids=new Set();
      for(const f of e.payload.final_responses){
        const i=byInstance.get(f.question_instance_id);assert(i&&!ids.has(f.question_instance_id));ids.add(f.question_instance_id);
        const actual=['correct','incorrect'].includes(i.final_status)?'answered':i.final_status;
        assert(f.status===actual&&f.response_event_id===(i.last_event_id||null));
      }
    }
  }
  assert(a.ready===!!start&&((a.status==='completed')===!!end));
  if(end)assert(a.completed_at===end.payload.completed_at_client&&canonical(summarizeAttempt(a),false)===canonical(a.metrics,false));
  if (Object.hasOwn(a,'journey') && a.journey !== null) {
    const {validateJourneySnapshot} = await import('./journey-snapshot.js');
    return validateJourneySnapshot(a,journeySource);
  }
  assert(a.items.every(item=>!('occurrence_ref' in item) && !('journey_role' in item) && !('journey_band' in item) && !('journey_review' in item)));
  return null;
}
