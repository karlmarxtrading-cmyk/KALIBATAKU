// node tests/journey/viewed-coverage.mjs [--dist] [output-directory]
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const tree=process.argv.includes('--dist')?'dist':'src',root=fileURLToPath(new URL('../../',import.meta.url));
const load=p=>import(new URL('../../'+tree+'/'+p,import.meta.url));
const json=async rel=>JSON.parse(await readFile(resolve(root,rel)));
const out=resolve(process.argv.slice(2).find(x=>x!=='--dist')||root+'evidence/v151/exposure');
await mkdir(out,{recursive:true});
const {journeyState,nextMission,planMission,exposure,missionOutcome}=await load('journey/model.mjs');
const {itemWasViewed,EXPOSURE_POLICY}=await load('journey/exposure.mjs');
const {createAttempt,begin,visit,editDraft,submit,finish,clearResponse,noteHint}=await load('player/engine.mjs');
const {scopeForLocal,createProfile,listAttempts,listEvents,saveAttempt,deleteProfile}=await load('data/store.js');
const {exportBackup,exportArchive,importBackup,previewBackup}=await load('data/backup.js');
const {canonical,sha256}=await load('data/common.js');
const {buildSnapshot,initialFilters}=await load('teacher/report.js');
const {encode}=await load('teacher/export/index.js');
const started=new Date().toISOString(),cases=[],snapshots=[];
const check=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);cases.push({name,expected,actual});};
const route=await json(tree+'/journey/v1/route.json'),id='arithmetic.addition.g01.l01';
const node=route.nodes.find(n=>n.competency_id===id),shard=await json(tree+'/'+node.occ.url);
const level=await json('dist/bank/g01/l01.json'),packs=level.competencies.find(c=>c.competency_id===id).packages;
const profile=await createProfile('Exposure fixture'),scope=scopeForLocal(profile.id);
const frozen=await json('tests/journey/fixtures/sparse-v150.json');
let clock=Date.parse('2026-11-28T00:00:00Z');const tick=()=>clock+=1000;
const state=attempts=>journeyState(route,attempts);
const info=attempts=>{const n=state(attempts).nodes.get(id);return [n.coverage,n.passing.size,n.ready];};
function snapshot(attempts,person={id:profile.id,alias:'Exposure fixture',classId:''}){
  return buildSnapshot({person,people:[person],attempts,filters:{...initialFilters(),source:'local_practice',timezone:'UTC'},locale:'en',createdAt:'2026-12-01T00:00:00Z'});
}
async function play(attempts,mode,fixed=null,save=false){
  const before=state(attempts),p=before.nodes.get(id);
  const kind=fixed?.journey.mission_kind||(!attempts.length?'intro':nextMission(route,before).kind);
  const seed=123+attempts.length;
  const plan=fixed?null:planMission({shard,kind,policy:route.mission_policy,seen:exposure(attempts,id),progress:p,seed});
  const entry=packs.find(x=>x.package_id===(fixed?.package_id||plan.package.package_id));
  const pkg=(await import(new URL('../../dist/'+entry.url,import.meta.url))).default;
  const rows=fixed?fixed.journey.selected_occurrence_refs.map((r,k)=>({index:r.question_index,role:fixed.roles[k],band:fixed.bands[k],review:fixed.reviews[k]})):plan.rows;
  const items=rows.map(r=>{
    const q=pkg.questions[r.index];
    return {question:q,journey_role:r.role,journey_band:r.band,journey_review:r.review,occurrence_ref:{package_id:pkg.package_id,
      package_sha256:entry.sha256,content_version:pkg.content_version,question_index:r.index,question_id:q.question_id,question_revision:q.question_revision}};
  });
  const base=frozen[0].journey;
  const journey=fixed?structuredClone(fixed.journey):{...base,mission_kind:kind,seed,exposure_policy:EXPOSURE_POLICY,selected_occurrence_refs:items.map(x=>x.occurrence_ref),selection_trace:plan.trace};
  const a=createAttempt(pkg,scope,{items,journey,seed,now:tick()});
  const emit=async ev=>{if(save)await saveAttempt(a,ev,scope);};
  await emit(null);await emit(begin(a,tick()));
  if(mode!=='early'){
    for(let k=0;k<items.length;k++){
      const it=a.items[k];
      if(mode==='targets'&&it.journey_role==='a')break;
      visit(a,k,tick());
      if(mode==='targets'&&it.journey_role==='w'){await emit(clearResponse(a,k,true));continue;}
      if(mode==='hints')noteHint(a,k);
      const ans=it.question.answer;
      const answer=ans.denominator==='1'?ans.numerator:ans.numerator+'/'+ans.denominator;
      if(mode==='revised'||mode==='wrong'){editDraft(a,k,'-9999');await emit(submit(a,k,tick()));}
      if(mode!=='wrong'){editDraft(a,k,answer);await emit(submit(a,k,tick()));}
    }
  }
  for(const ev of finish(a,{now:tick()}))await emit(ev);
  attempts.push(a);return a;
}
function observed(attempts){
  const viewed=new Set(),answered=new Set();
  for(const a of attempts)for(const i of a.items){
    if(i.seen===true)viewed.add(i.question.fingerprint);
    if(i.history.length)answered.add(i.question.fingerprint);
  }
  return [viewed.size,answered.size];
}
const history=[];
for(const [i,mode] of ['early','targets','targets'].entries()){
  const a=await play(history,mode,frozen[i],true);
  snapshots.push({items:a.items.map(it=>({id:it.question.question_id,seen:it.seen,final_status:it.final_status,responses:it.history.length})),
    observed:observed(history),map:info(history),next:nextMission(route,state(history))});
  check('frozen allocation '+i+' independently counted',info(history)[0],observed(history)[0]);
}
check('early finish',snapshots[0].observed,[1,0]);
check('sparse fixed 1.5.0 seed 123',[...observed(history),...info(history)],[10,8,10,2,false]);
check('still on addition',nextMission(route,state(history)).node_id,id);
const sr=snapshot(history),jr=sr.journey.rows.find(r=>r.node_id===id);
check('actual teacher report matches map',[jr.unique_seen,jr.passing_missions,jr.ready,sr.journey.exposure_policy],[10,2,false,EXPOSURE_POLICY]);
check('other profile',snapshot(history,{id:'someone-else',alias:'Other',classId:''}).journey.rows.length,0);
const font=[await readFile(resolve(root,tree,'teacher/font/DejaVuSans.ttf')),await json(tree+'/teacher/font/metrics.json')];
for(const format of ['pdf','docx','xlsx','csv','json'])await writeFile(resolve(out,'report.'+format),await encode(sr,format,{font}));
const legacy=structuredClone(history);
for(const a of legacy)for(const it of a.items)delete it.seen;
check('old snapshot without flags uses first_seen_at/history',info(legacy),[10,2,false]);
const oldest=structuredClone(legacy[0]);delete oldest.items[0].first_seen_at;
check('index and blank alone supply no evidence',info([oldest]),[0,0,false]);
check('explicit false overrides history',itemWasViewed({seen:false,first_seen_at:history[0].started_at,history:[{}],final_status:'correct'}),false);
check('unseen never supplies exposure',itemWasViewed({seen:true,final_status:'unseen',history:[{}]}),false);
check('history establishes legacy exposure',itemWasViewed({final_status:'correct',history:[{}]}),true);
check('invalid legacy timestamp has no weight',itemWasViewed({final_status:'blank',first_seen_at:'invalid',history:[]}),false);
const ongoing=structuredClone(history[0]);ongoing.status='ongoing';ongoing.completed_at=null;
const frozenIdentity=JSON.stringify([ongoing.journey.seed,ongoing.journey.selected_occurrence_refs,ongoing.items.map(i=>i.draft)]);
check('ongoing renders resumed snapshot',nextMission(route,state([ongoing])).action,'continue');
check('ongoing reserves all refs but only 1 viewed', [ongoing.journey.selected_occurrence_refs.length,exposure([ongoing],id).size,info([ongoing])[0]],[6,1,0]);
check('reload preserves membership/order/seed/draft',JSON.stringify([ongoing.journey.seed,ongoing.journey.selected_occurrence_refs,ongoing.items.map(i=>i.draft)]),frozenIdentity);
ongoing.status='abandoned';
check('abandoned earns no readiness or variation credit',[exposure([ongoing],id).size,info([ongoing])[0]],[0,0]);
for(const mode of ['wrong','hints','revised']){
  const controls=[];
  for(let i=0;i<3;i++)await play(controls,mode);
  const s=state(controls).nodes.get(id),o=missionOutcome(controls.at(-1));
  check(mode+' does not pass',[s.ready,s.passing.size,o.first_independent],[false,0,0]);
  if(mode==='revised')check('revision after viewing key retains first answer',[o.revised_after_key,o.final_correct],[o.n,o.n]);
}
const replay=[];
for(const mode of ['early','targets','targets'])await play(replay,mode);
check('new selector on same seeds counts observed',info(replay)[0],observed(replay)[0]);
for(let i=0;i<8&&!state(replay).nodes.get(id).ready;i++)await play(replay,'perfect');
check('real coverage eventually advances',[state(replay).nodes.get(id).ready,nextMission(route,state(replay)).node_id],[true,'arithmetic.subtraction.g01.l01']);
const readAll=async()=>{const a=await listAttempts(scope);return {attempts:a.sort((a,b)=>a.attempt_id.localeCompare(b.attempt_id)),events:(await Promise.all(a.map(x=>listEvents(x.attempt_id,scope)))).flat().sort((a,b)=>a.event_id.localeCompare(b.event_id))};};
const before=await readAll(),fingerprint=x=>createHash('sha256').update(canonical(x,false)).digest('hex');
const backup=await exportBackup(scope),zip=await exportArchive(scope);
await writeFile(resolve(out,"sparse-profile.json"),JSON.stringify(backup)+"\n");
for(const [name,file] of [['JSON',JSON.stringify(backup)],['ZIP',zip]]){
  await deleteProfile(profile.id);
  check(name+' preview succeeds',(await previewBackup(file)).sessions,3);
  await importBackup(file);const restored=await readAll();
  check(name+' committed snapshot and event bytes',fingerprint(restored),fingerprint(before));
  check(name+' derived readiness after restore',info(restored.attempts),[10,2,false]);
}
const legacyBackup=structuredClone(backup);
for(const row of legacyBackup.records.attempts)for(const it of row.data.items)delete it.seen;
delete legacyBackup.checksum;legacyBackup.checksum=await sha256(canonical(legacyBackup,false));
await deleteProfile(profile.id);await importBackup(JSON.stringify(legacyBackup));
const restored=await readAll();
check('flags remain absent after legacy restore',restored.attempts.some(a=>a.items.some(i=>Object.hasOwn(i,'seen'))),false);
check('legacy ledger preserved',fingerprint(restored.events),fingerprint(before.events));
check('legacy restoration recomputes observation',info(restored.attempts),[10,2,false]);
const receipt={status:'PASS',release:(await json('dist/offline-assets.json')).release,tree,policy:EXPOSURE_POLICY,
  started,finished:new Date().toISOString(),runtime:process.version,cases,frozen:snapshots,
  current_selector_sparse:{actual:observed(replay.slice(0,3)),reported:info(replay.slice(0,3)),next:nextMission(route,state(replay.slice(0,3)))},
  correction:info(replay),ledger_sha256:fingerprint(before.events)};
await writeFile(resolve(out,'engine.json'),JSON.stringify(receipt,null,2)+'\n');
console.log('PASS',cases.length,'viewed-coverage assertions; sparse 10/12, 8 answered; five reports written');
