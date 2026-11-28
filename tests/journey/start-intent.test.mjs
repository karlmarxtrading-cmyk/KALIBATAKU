// Run from the project root with node tests/journey/start-intent.test.mjs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {overview,chooseStart,startPoint,createMission} from '../../src/journey/journey.mjs';
import {createProfile,scopeForLocal,selectScope,getAttempt,listAttempts,saveAttempt,addRecord,deleteProfile} from '../../src/data/store.js';
import {exportBackup,exportArchive,previewBackup,importBackup} from '../../src/data/backup.js';
import {begin,visit,editDraft,submit,finish} from '../../src/player/engine.mjs';
import {missionOutcome} from '../../src/journey/model.mjs';

const root=new URL('../../',import.meta.url);
globalThis.document={baseURI:new URL('dist/',root).href};
const readLocal=async url=>new Response(await readFile(new URL(url)));
globalThis.fetch=readLocal;
const target=(grade,op='addition')=>'arithmetic.'+op+'.g'+String(grade).padStart(2,'0')+'.l01';
const stage=grade=>'S-G'+String(grade).padStart(2,'0')+'-L01';
const profile=async label=>scopeForLocal((await createProfile(label)).id);
const scope=await profile('Pilihan');
selectScope(scope);
const signal=new AbortController().signal;
const current=async s=>(await overview(s,signal)).next;
const choose=(s,g)=>chooseStart(s,stage(g),'learner_choice');
const play=async (s,node,kind)=>{
  selectScope(s);
  const id=await createMission({scope:s,lang:'id',signal},{nodeId:node,kind});
  return getAttempt(id,s);
};
let time=Date.UTC(2026,10,28,10);
const tick=()=>time+=1000;
async function complete(s,a,correct=true){
  await saveAttempt(a,begin(a,tick()),s);
  for(let k=0;k<a.items.length;k++){
    visit(a,k,tick());
    const {numerator,denominator}=a.items[k].question.answer;
    const n=BigInt(numerator)+(correct?0n:BigInt(denominator));
    editDraft(a,k,denominator==='1'?String(n):n+'/'+denominator,'id');
    await saveAttempt(a,submit(a,k,tick()),s);
  }
  await saveAttempt(a,finish(a,{now:tick()}),s);
  return getAttempt(a.attempt_id,s);
}
const result=[];
function verify(id,expected,actual){assert.deepEqual(actual,expected,id);result.push({id,expected,actual,status:'PASS'});}
const digest=a=>createHash('sha256').update(JSON.stringify(a)).digest('hex');
verify('empty profile','choose_start',(await current(scope)).action);
const intro=await complete(scope,await play(scope,target(1),'intro'),false);
verify('audit history',[0,6,'reinforce'],[missionOutcome(intro).first_independent,intro.items.length,(await current(scope)).action]);
const original=digest(intro);
const choice=await choose(scope,5);
const reload=await import('../../src/journey/journey.mjs?reload');
const savedChoice=await reload.startPoint(scope);
verify('new module reads persisted choice',[stage(5),choice.intent_id,1],[savedChoice.stage_id,savedChoice.intent_id,savedChoice.revision]);
const selected=await current(scope);
verify('AUD-03 after failed G1 intro',[target(5),'intro'],[selected.node_id,selected.kind]);

// Launch failure must leave the intent applicable.
globalThis.fetch=async url=>{
  if(String(url).endsWith('/occ/'+target(5)+'.json'))return new Response('',{status:503});
  return readLocal(url);
};
await assert.rejects(()=>play(scope,target(5),'intro'));
globalThis.fetch=readLocal;
verify('failed preparation preserves intent',[1,target(5)],[(await listAttempts(scope)).length,(await current(scope)).node_id]);
const active=await play(scope,target(5),'intro');
verify('launch binds persisted intent',[choice.intent_id,1],[active.journey.start_intent_id,active.journey.start_intent_step]);
const ongoing=digest(active);
const changed=await choose(scope,7);
const resume=await current(scope);
verify('ongoing first',['continue',active.attempt_id],[resume.action,resume.attempt_id]);
const resumed=await play(scope,target(7),'intro');
verify('same frozen session',ongoing,digest(resumed));
await complete(scope,active,false);
verify('deferred stage used after final commit',target(7),(await current(scope)).node_id);

// Old history is dated later than the new attempts after a clock adjustment.
time=Date.UTC(2025,0,1);
let chosen=await current(scope);
const firstAtNewStage=await complete(scope,await play(scope,chosen.node_id,chosen.kind));
const continuation=await current(scope);
verify('clock rollback after choosing',[target(7),'regular',changed.intent_id],[continuation.node_id,continuation.kind,firstAtNewStage.journey.start_intent_id]);
for(let i=0;i<6;i++){
  const summary=await overview(scope,signal);
  if(summary.state.nodes.get(target(7)).ready)break;
  await complete(scope,await play(scope,summary.next.node_id,summary.next.kind));
}
const ready=(await overview(scope,signal)).state.nodes.get(target(7));
assert(ready.ready);
await choose(scope,7);
chosen=await current(scope);
verify('selecting a stage with a ready first skill',target(7,'subtraction'),chosen.node_id);
verify('prior counts and answers unchanged',original,digest(await getAttempt(intro.attempt_id,scope)));
const stageNodes=(await overview(scope,signal)).route.stages.find(s=>s.stage_id===stage(7)).nodes;
for(let i=0;i<60;i++){
  const {state,next}=await overview(scope,signal);
  if(stageNodes.every(id=>!state.nodes.has(id)||state.nodes.get(id).ready))break;
  assert.equal(state.nodes.get(next.node_id).node.stage_id,stage(7));
  await complete(scope,await play(scope,next.node_id,next.kind));
}
await choose(scope,7);
chosen=await current(scope);
verify('selecting a fully ready stage offers its own review',[target(7),'review'],[chosen.node_id,chosen.kind]);

const other=await profile('Terpisah');
verify('profile isolation, before choice',null,await startPoint(other));
await addRecord('journey-start','v14-legacy',{stage_id:stage(1),method:'learner_choice',at:'2099-01-01T00:00:00Z'},other);
const legacy=await startPoint(other);
verify('legacy preserved',[stage(1),0],[legacy.stage_id,legacy.revision]);
const RealDate=Date;
globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-01-02T00:00:00Z']));}};
let parallel;
try{parallel=await Promise.all([choose(other,5),choose(other,6),choose(other,8)]);}finally{globalThis.Date=RealDate;}
const finalChoice=await startPoint(other);
verify('three writes with equal clocks',[1,2,3],parallel.map(p=>p.revision).sort((x,y)=>x-y));
verify('three equal timestamps',1,new Set(parallel.map(p=>p.at)).size);
verify('ordered by committed revision above a future-dated legacy choice',3,finalChoice.revision);
verify('last revision governs recommendation',target(Number(finalChoice.stage_id.slice(3,5))),(await current(other)).node_id);
verify('other profile leaves original choice intact',stage(7),(await startPoint(scope)).stage_id);
const beforeRestore={choice:await startPoint(scope),next:await current(scope),history:digest(await listAttempts(scope))};
for(const [format,writer] of [['JSON',exportBackup],['ZIP',exportArchive]]){
  const backup=await writer(scope);
  await deleteProfile(scope.profileId);
  const preview=await previewBackup(backup);
  assert(preview.additions>0 && preview.conflicts.length===0);
  await importBackup(backup);
  const after={choice:await startPoint(scope),next:await current(scope),history:digest(await listAttempts(scope))};
  verify(format+' actual restore preserves choice and recommendation',true,
    after.choice.intent_id===beforeRestore.choice.intent_id&&after.choice.revision===beforeRestore.choice.revision&&
    after.next.node_id===beforeRestore.next.node_id&&after.next.kind===beforeRestore.next.kind&&after.history===beforeRestore.history);
}
console.log(JSON.stringify({suite:'AUD-03 start intent',method:'Node, real selector, verified package bytes, player, store transactions with memory adapter',runtime:process.version,at:new Date().toISOString(),cases:result},null,2));
