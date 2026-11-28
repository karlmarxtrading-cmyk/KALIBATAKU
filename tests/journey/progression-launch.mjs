// Default recommendation → real createMission, save, submit, finalize and re-read.
// No manual node selection or tag injection. Pass --root PATH to compare releases.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
const arg=flag=>{const i=process.argv.indexOf(flag);return i===-1?null:process.argv[i+1];};
const root=arg('--root')?pathToFileURL(path.resolve(arg('--root'))+'/'):new URL('../../',import.meta.url);
const dist=new URL('dist/',root),memory=new Map();
globalThis.document={baseURI:dist.href};globalThis.location=new URL(dist.href);
globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
globalThis.sessionStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
globalThis.fetch=async u=>new Response(await readFile(new URL(u)),{status:200});
const {begin,visit,editDraft,submit,finish}=await import(new URL('src/player/engine.mjs',root));
const {getAttempt,saveAttempt,activeScope}=await import(new URL('src/data/store.js',root));
const {chooseStart,createMission,overview}=await import(new URL('src/journey/journey.mjs',root));
// Fix the mission seed stream for before/after replay. UUIDs, digests and player
// submission code are untouched. The bounds proof does not depend on these seeds.
const platformRandom=crypto.getRandomValues.bind(crypto);
let missionSeed=0;
crypto.getRandomValues=target=>{
  if(target instanceof Uint32Array && target.length===1){target[0]=++missionSeed;return target;}
  return platformRandom(target);
};
const ctx={lang:'id',signal:new AbortController().signal};
const scope=activeScope(),stage='S-G12-L01',target='arithmetic.multiplication.g12.l01';
await chooseStart(scope,stage,'learner_choice');
const receipt={environment:'Node; in-memory profile storage, actual launch/engine/commit/recommendation paths, real bank',runtime:process.version,
  started_at:new Date().toISOString(),stage,target,history:[]};
let clock=Date.now();
try{
  for(let step=0;step<160;step++){
    const {state,next,route}=await overview(scope,ctx.signal),s=state.nodes.get(target);
    receipt.policy=route.mission_policy.policy_version;
    if(s.ready){assert.notEqual(next.node_id,target);receipt.next=next;break;}
    assert(['start','advance','variation','reinforce','checkpoint'].includes(next.action),JSON.stringify(next));
    const id=await createMission(ctx,{nodeId:next.node_id,kind:next.kind});
    const a=await getAttempt(id,scope);
    assert.equal(a.journey.node_id,next.node_id);
    assert.equal(a.form_id,null);
    await saveAttempt(a,begin(a,++clock),scope);
    for(let i=0;i<a.items.length;i++){
      if(i)visit(a,i,++clock);
      const ans=a.items[i].question.answer;
      editDraft(a,i,ans.denominator==='1'?ans.numerator:ans.numerator+'/'+ans.denominator);
      await saveAttempt(a,submit(a,i,++clock),scope);
      assert(a.items[i].history[0].is_correct);
    }
    for(const e of finish(a,{now:++clock}))await saveAttempt(a,e,scope);
    const saved=await getAttempt(id,scope);
    assert.equal(saved.status,'completed');
    const post=(await overview(scope,ctx.signal)).state.nodes.get(a.journey.node_id);
    receipt.history.push({node:a.journey.node_id,kind:a.journey.mission_kind,package_id:a.package_id,answer_count:a.items.length,
      unique:post.coverage,passing:post.passing.size,strategies:[...post.strategies].sort(),ready:post.ready,
      reasons:a.journey.selection_trace.reasons,
      ...(a.journey.node_id===target?{selected_indices:a.journey.selected_occurrence_refs.map(ref=>ref.question_index)}:{})});
    if(receipt.history.filter(row=>row.node===target).length===5 && !post.ready)break;
  }
  const s=(await overview(scope,ctx.signal)).state.nodes.get(target);
  receipt.actual={ready:s.ready,unique:s.coverage,passing:s.passing.size,strategies:[...s.strategies].sort(),strategies_needed:s.strategies_needed};
  assert(s.ready,'default path failed to advance; target missions '+receipt.history.filter(m=>m.node===target).length);
  assert(receipt.history.some(m=>m.node===target&&m.package_id==='MM-G12-L01-MUL-P017'&&m.selected_indices.includes(16)));
  receipt.status='PASS';
}catch(e){receipt.status='FAIL';receipt.error=e.message;process.exitCode=1;}
receipt.finished_at=new Date().toISOString();
if(arg('--out'))await writeFile(arg('--out'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:receipt.status,actual:receipt.actual,missions:receipt.history.length,next:receipt.next,error:receipt.error}));
