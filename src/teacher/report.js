import {epoch,compareInstants} from '../data/time.js';
import {enteredAst} from '../math/model.mjs';
import {summarizeAttempt,aggregateCounts,mastery,comparable,timingStats} from '../player/analytics.mjs';
import {journeySummary} from '../journey/report.mjs';
// Versioned report extension. The strict handoff ReportSnapshot is preserved in .core.
export const operations = ['ADD','SUB','MUL','DIV','MIX'];
export const names = {
  ADD:['Penjumlahan','Addition'],SUB:['Pengurangan','Subtraction'],MUL:['Perkalian','Multiplication'],
  DIV:['Pembagian','Division'],MIX:['Campuran','Mixed operations'],
  practice:['Latihan','Practice'],speed:['Kecepatan','Speed'],assessment:['Evaluasi','Assessment'],
  recovery:['Pemulihan','Recovery'],adaptive:['Adaptif','Adaptive'],
  completed:['Selesai','Completed'],ongoing:['Berjalan','In progress'],abandoned:['Ditinggalkan','Abandoned'],
  correct:['Benar','Correct'],incorrect:['Salah','Incorrect'],skipped:['Dilewati','Skipped'],blank:['Kosong','Blank'],unseen:['Belum dilihat','Unseen'],
};
export const tr=(locale,id,en)=>locale==='bilingual'? (id===en?id:id+' / '+en):locale==='en'?en:id;
export const name=(locale,key)=>names[key]?tr(locale,...names[key]):String(key??'—');
export const fmt=(n,l)=>n==null?tr(l,'Belum dievaluasi','Not assessed'):new Intl.NumberFormat(l==='id'?'id-ID':'en-GB',{maximumFractionDigits:1}).format(n)+'%';
export const originLabel=(origin,l)=>origin==='demo'?'SIMULASI / DEMONSTRATION DATA':tr(l,'Hasil latihan lokal · belum diverifikasi institusi','Local practice results · institutionally unverified');
export function dateAt(iso,zone,locale) {
  if (!Number.isFinite(epoch(iso))) return '—';
  return new Intl.DateTimeFormat(locale==='id'?'id-ID':'en-GB',{timeZone:zone,year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso));
}
// Compare local calendar days using IANA zone rules, including historical offsets.
export const zones={'Asia/Jakarta':7,'Asia/Makassar':8,'Asia/Jayapura':9,'UTC':0};
const calendar=new Map(), midnightCache=new Map();
function dayBoundary(day,zone){
  const key=zone+' '+day;
  if(midnightCache.has(key))return midnightCache.get(key);
  const utc=epoch(day+'T00:00:00Z');
  if(!Number.isFinite(utc))throw new Error('RANGE');
  if(zone==='UTC')return utc;
  if(!calendar.has(zone))calendar.set(zone,new Intl.DateTimeFormat('en-CA',{
    timeZone:zone,calendar:'iso8601',numberingSystem:'latn',year:'numeric',month:'2-digit',day:'2-digit'
  }));
  // First instant of this civil date. This also handles a midnight offset
  // transition, when a literal local 00:00 can be ambiguous or nonexistent.
  let low=utc-86400000,high=utc+86400000;
  while(low<high){
    const mid=Math.floor((low+high)/2);
    const parts=Object.fromEntries(calendar.get(zone).formatToParts(mid).map(p=>[p.type,p.value]));
    const date=parts.year.padStart(4,'0')+'-'+parts.month+'-'+parts.day;
    if(date<day)low=mid+1;else high=mid;
  }
  if(midnightCache.size>=128)midnightCache.clear();
  midnightCache.set(key,low);return low;
}
export function periodBounds(filters) {
  const zone=filters.timezone||'Asia/Jakarta',start=filters.from||'1970-01-01',end=filters.to||'2099-12-31';
  const endDay=epoch(end+'T00:00:00Z');
  if(!Object.hasOwn(zones,zone)||start>end||!Number.isFinite(endDay))throw new Error('RANGE');
  const nextDay=new Date(endDay+86400000).toISOString().slice(0,10);
  return [dayBoundary(start,zone),dayBoundary(nextDay,zone)].map(t=>new Date(t).toISOString());
}
export const initialFilters=()=>({source:'demo',classId:'',studentId:'',from:'',to:'',timezone:'Asia/Jakarta',module:'mental-math',grade:'',level:'',operation:'',mode:'',status:'',packageId:''});
export function filterSessions(attempts,people,f) {
  const [start,end]=periodBounds(f).map(epoch), ids=new Set(people.filter(p=>(!f.classId||p.classId===f.classId)&&(!f.studentId||p.id===f.studentId)).map(p=>p.id));
  return attempts.filter(a=>{
    const started=epoch(a.started_at);
    return ids.has(a.profile_id) && a.data_origin===f.source &&
    (!f.module||(a.module_id||'mental-math')===f.module)&&started>=start&&started<end&&
    [['grade',f.grade],['level',f.level],['operation',f.operation],['mode',f.mode],['status',f.status],['package_id',f.packageId]].every(([k,v])=>!v||String(a[k])===String(v));
  }).sort((a,b)=>compareInstants(b.started_at,a.started_at)||a.attempt_id.localeCompare(b.attempt_id));
}
export function sumCounts(attempts,competency) {
  const stats=attempts.filter(a=>a.status==='completed').map(a=>!competency&&a.metrics?a.metrics:summarizeAttempt(a,competency));
  const m=aggregateCounts(stats), sum=key=>stats.reduce((v,r)=>v+(r[key]||0),0);
  return {...m,firstCorrect:sum('first_correct'),firstTotal:sum('first_response_count'),hintCount:sum('hints'),retryCount:sum('retries'),score:m.score_percent,accuracy:m.accuracy_percent,responded:m.responded_percent};
}
function compare(a,b){
  if(!a||!b||a.target_competency_id!==b.target_competency_id||!comparable(a,b,a.target_competency_id))return null;
  if(a.items.some(i=>i.hint_used)||b.items.some(i=>i.hint_used)||a.blueprint_id!==b.blueprint_id)return null;
  const x=sumCounts([a]),y=sumCounts([b]);return x.score==null||y.score==null?null:y.score-x.score;
}
export function buildSnapshot({person,people,attempts,notes=[],filters,locale='id',createdAt=new Date().toISOString(),plan='',reviewDate='',appendix=false}) {
  const f={...filters,studentId:person.id}, [start,end]=periodBounds(f);
  const startTime=epoch(start),endTime=epoch(end),createdTime=epoch(createdAt);
  if(!Number.isFinite(createdTime))throw new Error('INVALID_REPORT_TIME');
  const asOf={utc:new Date(Math.min(createdTime,endTime)).toISOString(),inclusive:createdTime<endTime};
  const byCutoff=iso=>{const at=epoch(iso);return at<endTime&&at<=createdTime;};
  // A session that had started but finished later was still ongoing at the cutoff.
  // Its finalized answers cannot be used to reconstruct a historical draft.
  const sessions=filterSessions(attempts,people,{...f,status:''})
    .filter(a=>byCutoff(a.started_at)&&(a.status!=='completed'||Number.isFinite(epoch(a.completed_at))))
    .map(a=>a.status==='completed'&&!byCutoff(a.completed_at)?{...a,status:'ongoing',completed_at:null,items:[],metrics:null}:a)
    .filter(a=>!f.status||a.status===f.status);
  const m=sumCounts(sessions),done=sessions.filter(a=>a.status==='completed');
  const compareSessions=done.filter(a=>a.mode==='assessment');
  // All completed sessions of this learner/source/module may contribute to readiness.
  const inClass=people.some(p=>p.id===person.id&&(!f.classId||p.classId===f.classId));
  const history=attempts.filter(a=>inClass&&a.profile_id===person.id&&a.data_origin===f.source&&
    a.status==='completed'&&(!f.module||(a.module_id||'mental-math')===f.module)&&byCutoff(a.completed_at));
  const journey=journeySummary(history,{period:done,filters:f,asOf});
  const delta=compare(compareSessions[1],compareSessions[0]);
  const groups=new Map();
  for(const a of sessions) for(const id of new Set(a.items.map(i=>i.question.competency_id))) {if(!groups.has(id))groups.set(id,[]); groups.get(id).push(a);}
  const scopedNotes=notes.filter(n=>n.profileId===person.id&&epoch(n.at)>=startTime&&byCutoff(n.at))
    .sort((a,b)=>compareInstants(a.at,b.at)||String(a.id??'').localeCompare(String(b.id??'')));
  const byMetric = [...groups].map(([id,ls])=>({id,grade:ls[0].grade,level:ls[0].level,operation:ls[0].operation,...sumCounts(ls,id),mastery:mastery(ls,id,{now:Date.parse(createdAt)})}));
  const groupsByContext=new Map();
  for(const a of done){
    for(const id of new Set(a.items.map(i=>i.question.competency_id))){
      const k=JSON.stringify([id,a.grade,a.level,a.mode,a.feedback_policy_version||'legacy',a.timing_policy_version||'legacy']);
      if(!groupsByContext.has(k))groupsByContext.set(k,{id,grade:a.grade,level:a.level,mode:a.mode,operation:a.operation,feedback_policy_version:a.feedback_policy_version||'legacy',timing_policy_version:a.timing_policy_version||'legacy',attempts:[]});
      groupsByContext.get(k).attempts.push(a);
    }
  }
  const contexts=[...groupsByContext.values()].map(({attempts:ls,...c})=>{
    const metrics=sumCounts(ls,c.id);
    const independent=ls.flatMap(a=>a.items.filter(i=>i.question.competency_id===c.id&&i.history?.[0]?.is_correct&&!(i.history[0].hint_before??i.history[0].hint_used)&&!i.history[0].key_seen_before)).length;
    return {...c,...metrics,independent,sessions:ls.length,period:[ls.at(-1).started_at,ls[0].started_at]};
  });
  const example=done.flatMap(a=>a.items.filter(i=>i.history?.[0]?.is_correct===false).slice(0,1).map(i=>({
    first_ast:enteredAst(i.history[0]),final_ast:enteredAst(i.history.at(-1)),expression_ast:i.question.expression_ast||null,key:i.question.answer,feedback_policy_version:a.feedback_policy_version||'legacy',after_key:!!i.history.at(-1)?.key_seen_before,expression:i.question.neutral_expression,first:i.history[0].raw_answer,final:i.history.at(-1).raw_answer,hint:!!i.hint_used,mode:a.mode,grade:a.grade,level:a.level,at:a.started_at,attempt:a.attempt_id
  })))[0]||null;
  const activeNotes=scopedNotes.filter(n=>!n.id||!scopedNotes.some(other=>other.supersedes===n.id));
  const core={schema_version:'1.0.0',report_id:'R-'+crypto.randomUUID(),data_origin:f.source,verification_status:'unverified',locale,
    period_start_utc:start,period_end_exclusive_utc:end,display_timezone:f.timezone,policy_version:'analytics-local-v1',created_at:createdAt,
    assigned_count:m.N,correct_count:m.C,incorrect_count:m.W,skipped_count:m.S,blank_count:m.B,unseen_count:m.U,form_score_percent:m.score,valid_response_accuracy_percent:m.accuracy,responded_percent:m.responded};
  return {schema_version:'parents-report-1.3',core,contexts,firstDifficulty:example,activeNotes,plan,reviewDate,appendix,person:{id:person.id,alias:person.alias,classId:person.classId||''},filters:f,
    content_versions:[...new Set(sessions.map(a=>a.content_version||'1.0.0'))],counts:m,completed:done.length,ongoing:sessions.filter(a=>a.status==='ongoing').length,
    operations:operations.map(op=>({operation:op,...sumCounts(sessions.filter(a=>a.operation===op))})),competencies:byMetric,
    timing:timingStats(done.flatMap(a=>a.items)),journey,change_pp:delta,notes:scopedNotes,sessions:sessions.map(a=>({id:a.attempt_id,started:a.started_at,ended:a.completed_at||null,status:a.status,
      operation:a.operation,mode:a.mode,grade:a.grade,level:a.level,package:a.package_id,
      ...(a.journey?{journey_at_creation:{node_id:a.journey.node_id,kind:a.journey.mission_kind,mission_policy:a.journey.policy_version,
        route_version:a.journey.route_version,readiness_rule:a.journey.readiness_rule}}:{}),assignment:a.assignment_id||null,...sumCounts([a])}))};
}
export function nextStep(s,l) {
  const t=(id,en)=>tr(l,id,en);
  if(!s.counts.N)return t('Mulai satu latihan singkat untuk mengumpulkan bukti awal.','Complete a short practice session to collect initial evidence.');
  const scoped=(s.contexts||[]).filter(c=>c.C+c.W>=8).sort((a,b)=>a.firstCorrect/a.firstTotal-b.firstCorrect/b.firstTotal);
  if(!scoped.length)return t('Kumpulkan lebih banyak jawaban pada satu materi dan mode sebelum menarik kesimpulan.','Collect more responses in one topic and mode before drawing conclusions.');
  const c=scoped[0];
  const focus=locale=>name(locale,c.operation).toLowerCase()+' · '+(locale==='en'?'grade ':'kelas ')+c.grade+' · level '+c.level+' · '+name(locale,c.mode);
  return t('Bahas satu contoh '+focus('id')+' bersama, lalu minta siswa mencoba satu soal sejenis sendiri ('+c.firstCorrect+' dari '+c.firstTotal+' respons pertama benar).',
    'Discuss one example of '+focus('en')+' together, then try one similar item independently ('+c.firstCorrect+' of '+c.firstTotal+' first responses correct).');
}
