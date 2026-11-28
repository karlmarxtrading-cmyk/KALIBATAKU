import {compareInstants} from '../data/time.js';
import {listAttempts,listRecords,addRecord,scopeForLocal,activeScope,listProfiles,queryAttemptSummaries,usedPackages} from '../data/store.js';
import {MockAdapter} from '../data/bridge.js';
import {listOutbox,syncPending,deliverySummary} from '../data/sync.js';
export const staff={origin:'demo',environment:'demo',profileId:'demo-staff'};
export const demoScope=profileId=>({...staff,profileId});
export const classes=[{id:'3A',teacher:'Demo A'},{id:'4B',teacher:'Demo B'}];
export const roster=Array.from({length:6},(_,i)=>({id:'demo-0'+(i+1),alias:'Demo '+String(i+1).padStart(2,'0'),classId:classes[Number(i>=3)].id}));
const day=86400000,base=Date.UTC(2026,10,1,3);
const demoForms=[
  ['demo-01',3,1,'ADD','assessment',1,8,2],['demo-01',3,1,'ADD','assessment',4,9,1],
  ['demo-02',2,1,'SUB','practice',2,3,7],['demo-02',2,1,'SUB','practice',5,4,6],
  ['demo-03',3,1,'ADD','practice',3,2,0,'ongoing'],['demo-04',3,1,'MUL','assessment',3,3,2],
  ['demo-04',4,2,'MUL','assessment',6,7,3],['demo-05',4,1,'DIV','speed',8,2,1],
];
// Seed records are labelled author-created examples. Keys and response outcomes derive from integer expressions.
export function syntheticSessions(){
  const sessions=demoForms.map(([who,grade,level,op,mode,d,n,w,status='completed'],k)=>{
    const competency='arithmetic.'+({ADD:'addition',SUB:'subtraction',MUL:'multiplication',DIV:'division'}[op])+'.g'+String(grade).padStart(2,'0')+'.l'+String(level).padStart(2,'0');
    const stem='DEMO-FIXTURE-'+(k+1),started=new Date(base+d*day).toISOString();
    const items=Array.from({length:10},(_,i)=>{
      const right=2+(i%6),left=op==='DIV'?right*(i+2):10+2*i+k;
      const ans=op==='ADD'?left+right:op==='SUB'?left-right:op==='MUL'?left*right:left/right;
      const expr=left+({ADD:' + ',SUB:' − ',MUL:' × ',DIV:' ÷ '}[op])+right;
      const final=i<n?'correct':i<n+w?'incorrect':mode==='speed'?'unseen':status==='ongoing'?'unseen':i%2?'blank':'skipped';
      const response=final==='correct'?ans:final==='incorrect'?ans+1:null;
      const dur=1050+i*140;
      const history=response==null?[]:[{raw_answer:String(response),answer:{numerator:String(response),denominator:'1'},submission_kind:'initial',is_correct:response===ans,hint_used:false,active_duration_ms:dur,elapsed_duration_ms:dur,timing_quality:'valid_client_estimate'}];
      return {question_instance_id:stem+'-'+i,question:{question_id:stem+'-'+i,competency_id:competency,fingerprint:expr,expression_ast:{kind:'binary',operation:op,left:{kind:'rational',numerator:String(left),denominator:'1'},right:{kind:'rational',numerator:String(right),denominator:'1'}},neutral_expression:expr,answer:{numerator:String(ans),denominator:'1'}},seen:final!=='unseen',history,draft:response==null?'':String(response),draft_locale:'id',hint_used:false,final_status:final};
    });
    return {attempt_id:stem,profile_id:who,data_origin:'demo',module_id:'mental-math',package_id:stem,content_version:'demo-fixture-1.0',grade,level,operation:op,mode,status,started_at:started,
      completed_at:status==='completed'?new Date(base+d*day+55000).toISOString():null,target_competency_id:competency,form_family_id:'demo-'+grade+'-'+level+'-'+op,form_id:k%2?'B':'A',
      form_instance_id:stem,assessment_cycle_id:'demo-cycle-'+who,cycle_started_at:new Date(base).toISOString(),policy_version:'mastery-local-v1',items};
  });
  const source=sessions.find(a=>a.profile_id==='demo-04'),first=source.items[0],id='DEMO-FIXTURE-HELP-1';
  const answer={numerator:'96',denominator:'1'};
  const responses=['92','96'].map((value,index)=>({raw_answer:value,answer:{numerator:value,denominator:'1'},submission_kind:index?'retry':'first',is_correct:!!index,hint_used:!!index,active_duration_ms:2100,elapsed_duration_ms:2200,timing_quality:'valid_client_estimate'}));
  sessions.push({...source,attempt_id:id,package_id:id,mode:'practice',form_id:null,form_family_id:null,form_instance_id:null,assessment_cycle_id:null,
    started_at:new Date(base+9*day).toISOString(),completed_at:new Date(base+9*day+8000).toISOString(),items:[{...first,question_instance_id:id+'.1',
      question:{...first.question,question_id:id+'.1',neutral_expression:'24 × 4',expression_ast:{kind:'binary',operation:'MUL',left:{kind:'rational',numerator:'24',denominator:'1'},right:{kind:'rational',numerator:'4',denominator:'1'}},fingerprint:'MUL:24:4',answer,explanation:{id:'Hitung 20 × 4 dan 4 × 4, lalu jumlahkan 80 dan 16.',en:'Multiply 20 and 4 by 4 separately, then add 80 and 16.'}},
      draft:'96',final_status:'correct',history:responses,hint_used:true}]});
  return sessions;

}
async function compactList(scope){
  let cursor=0,total=0;const records=[];
  do{
    const page=await queryAttemptSummaries(scope,{offset:cursor,limit:100});total=page.total;
    records.push(...page.rows.map(row=>({...row,profile_id:scope.profileId,data_origin:scope.origin})));
    cursor+=page.rows.length;if(!page.rows.length)break;
  }while(cursor<total);
  return records;
}
export async function workspace(origin,preferredProfileId,{view,student}={}){
  if(origin==='local_practice'){
    let scope=activeScope();
    if(scope.origin!=='local_practice'){
      try{scope=JSON.parse(localStorage.getItem('kalibataku.localProfile')||'null')||scopeForLocal('local-default');}catch{scope=scopeForLocal('local-default');}
    }
    const profiles=await listProfiles(),p=profiles.find(x=>x.id===scope.profileId);
    const people=[{id:scope.profileId,alias:p?.name||'Local',classId:''}];
    if(view==='reports')return {people,attempts:[],notes:[],assignments:[],packages:[...await usedPackages(scope)],readSubject:id=>id===scope.profileId?listAttempts(scope):Promise.resolve([])};
    return {people,attempts:await listAttempts(scope),notes:[],assignments:[]};
  }
  const [notes,assignments]=await Promise.all([listRecords('teacher-note',staff),listRecords('assignment',staff)]);
  const fixture=syntheticSessions(),common={people:roster,notes:notes.sort((a,b)=>compareInstants(a.at,b.at)||String(a.id).localeCompare(String(b.id))),assignments:assignments.sort((a,b)=>compareInstants(b.createdAt,a.createdAt)||String(a.id).localeCompare(String(b.id)))};
  if(view==='reports'){
    const catalog=await Promise.all(roster.map(p=>usedPackages(demoScope(p.id))));
    return {...common,attempts:[],packages:[...new Set([...fixture.map(a=>a.package_id),...catalog.flatMap(c=>[...c])])],
      readSubject:async id=>roster.some(p=>p.id===id)?[...fixture.filter(a=>a.profile_id===id),...await listAttempts(demoScope(id))]:[]};
  }
  const scopePeople=view==='demo/student'?roster.filter(p=>p.id===student):roster;
  const compact=['demo/teacher','demo/admin','demo/assignments'].includes(view);
  const groups=await Promise.all(scopePeople.map(async p=>{
    const scope=demoScope(p.id),adapter=new MockAdapter(scope);await syncPending(scope,{adapter});
    const [rows,receipts]=await Promise.all([compact?compactList(scope):listAttempts(scope),listOutbox(scope)]);
    const deliveryBySession=deliverySummary(receipts);
    return rows.map(a=>{
      const delivery=deliveryBySession.get(a.attempt_id),states=delivery?.states||{};
      const transport=['conflict','rejected','retry_required','pending_sync','sending','mock_accepted'].find(state=>states[state])||'saved_local';
      return {...a,transport,delivery};
    });
  }));
  return {...common,attempts:[...fixture.filter(a=>scopePeople.some(p=>p.id===a.profile_id)),...groups.flat()]};
}
export async function recordNote(person,text,type,parent,reason=''){
  const group=classes.find(c=>c.id===person.classId);
  if(!group||!text.trim()||text.trim().length>2000)throw new Error('NOTE');
  if(parent&&(parent.profileId!==person.id||!parent.id))throw new Error('NOTE_TARGET');
  // One successor key per parent. IndexedDB rejects a concurrent competing revision.
  const digest=parent&&new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(parent.id)));
  const id=parent?'revision-'+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join(''):crypto.randomUUID();
  const value={id,profileId:person.id,type,author:group.teacher,at:new Date().toISOString(),revision:(parent?.revision||0)+1,supersedes:parent?.id||null,reason:reason.trim().slice(0,300),text:text.trim()};
  await addRecord('teacher-note',id,value,staff);return value;
}
export async function createAssignment(data){
  if(!roster.some(p=>p.id===data.profileId)||!data.packageId||!data.mode)throw new Error('ASSIGNMENT');
  const id=crypto.randomUUID(),a={...data,id,createdAt:new Date().toISOString(),source:'demo',policy:'mastery-local-v1'};await addRecord('assignment',id,a,staff);return a;
}
