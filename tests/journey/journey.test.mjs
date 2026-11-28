// Adventure journey: metadata, selector, progression, provenance, idempotent rewards,
// migration of 1.3 attempts and backup round-trip. Node memory adapter for storage.
//   node tests/journey/journey.test.mjs
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {Suite,receiptPath} from '../qa/receipt.mjs';
import {planMission,journeyState,nextMission,exposure,missionOutcome,firstIndependent,kindFor} from '../../src/journey/model.mjs';
import {createAttempt,begin,visit,editDraft,submit,finish,noteHint} from '../../src/player/engine.mjs';
import {createProfile,scopeForLocal,saveAttempt,listAttempts,listEvents,addRecord} from '../../src/data/store.js';
import {exportArchive,readArchive} from '../../src/data/backup.js';
import {validateSnapshot} from '../../src/data/snapshot-check.js';
import {buildSnapshot,initialFilters} from '../../src/teacher/report.js';
import {encode} from '../../src/teacher/export/index.js';
import {mkdirSync,writeFileSync} from 'node:fs';

const ROOT=new URL('../../',import.meta.url);
const S=new Suite('journey-model',{scope:'Journey sidecar, selector, progression, provenance, rewards, 1.3 compatibility (Node)'});
const route=JSON.parse(await readFile(new URL('src/journey/v1/route.json',ROOT),'utf8'));
route.byId=new Map(route.nodes.map(n=>[n.competency_id,n]));
const shardCache=new Map();
async function shard(id){if(!shardCache.has(id))shardCache.set(id,JSON.parse(await readFile(new URL('src/journey/v1/occ/'+id+'.json',ROOT),'utf8')));return shardCache.get(id);}
const pkgCache=new Map();
async function pack(id){
  if(pkgCache.has(id))return pkgCache.get(id);
  const [,g,l]=id.match(/^MM-G(\d\d)-L(\d\d)-/);
  const lv=JSON.parse(await readFile(new URL(`dist/bank/g${g}/l${l}.json`,ROOT),'utf8'));
  const info=lv.competencies.flatMap(c=>c.packages).find(p=>p.package_id===id);
  const p=(await import(new URL('dist/'+info.url,ROOT).href)).default;pkgCache.set(id,p);return p;
}
const policy=route.mission_policy;
const answerText=v=>v.denominator==='1'?v.numerator:v.numerator+'/'+v.denominator;
const wrongText=v=>v.denominator==='1'?String(BigInt(v.numerator)+1n):v.numerator+'/'+(BigInt(v.denominator)+1n);
let profile=await createProfile('Journey test');const scope=scopeForLocal(profile.id);
let clock=Date.parse('2026-11-28T08:00:00Z');
const tick=(ms=4000)=>(clock+=ms);

// Build and play one mission the same way the app does (frozen refs + trace).
async function mission(nodeId,kind,{answers='correct',attempts,seed=7,save=true,stopAfter=null}={}){
  const node=route.byId.get(nodeId),sh=await shard(nodeId);
  const progress=journeyState(route,attempts,null).nodes.get(nodeId);
  const plan=planMission({shard:sh,kind,policy,progress,seen:exposure(attempts,nodeId),seed});
  const pkg=await pack(plan.package.package_id);
  const items=plan.rows.map(r=>{const question=pkg.questions[r.index];
    if(String(question.fingerprint).slice(0,16)!==r.fp)throw new Error('FP_MISMATCH');
    return {question,journey_role:r.role,journey_band:r.band,journey_review:r.review,occurrence_ref:{package_id:pkg.package_id,content_version:pkg.content_version,package_sha256:plan.package.package_sha256,question_index:r.index,question_id:question.question_id,question_revision:question.question_revision}};});
  const journey={journey_id:'kalibataku-adventure',node_id:nodeId,stage_id:node.stage_id,mission_kind:kind,metadata_version:route.metadata_version,route_version:route.route_version,policy_version:policy.policy_version,seed,readiness_rule:{target_missions:2,min_rate:0.8,coverage_needed:Math.min(12,node.teaching_unique),strategies_needed:Math.min(2,node.teaching_strategies.length),label:'product_policy_not_psychometric'},selected_occurrence_refs:items.map(i=>i.occurrence_ref),selection_trace:plan.trace};
  const a=createAttempt(pkg,scope,{mode:'practice',items,journey,seed,now:tick()});
  const events=[];
  if(save)await saveAttempt(a,null,scope);
  events.push(begin(a,tick()));if(save)await saveAttempt(a,events.at(-1),scope);
  for(let i=0;i<a.items.length;i++){
    if(stopAfter!==null&&i>=stopAfter)break;
    if(i)visit(a,i,tick());
    const q=a.items[i].question;
    const mode=typeof answers==='function'?answers(i,a.items[i]):answers;
    if(mode==='hint')noteHint(a,i);
    editDraft(a,i,mode==='wrong'||mode==='wrong-then-key'?wrongText(q.answer):answerText(q.answer),'id');
    let ev=submit(a,i,tick());if(save)await saveAttempt(a,ev,scope);
    if(mode==='wrong-then-key'){editDraft(a,i,answerText(q.answer),'id');ev=submit(a,i,tick());if(save)await saveAttempt(a,ev,scope);}
  }
  if(stopAfter===null){const fin=finish(a,{now:tick()});if(save)for(const e of fin)await saveAttempt(a,e,scope);}
  return {a,plan};
}

// 1 · sidecar regenerates byte-identically from the bank
S.check('sidecar-reproducible','tools/build-journey.py --check exits 0',()=>{
  const r=spawnSync('python3',['tools/build-journey.py','--check'],{cwd:new URL('.',ROOT).pathname,encoding:'utf8'});
  if(r.status!==0)throw new Error(r.stdout+r.stderr);return r.stdout.trim();
});
S.check('route-covers-281-active','300 nodes, 281 active with shards, 19 inactive without',()=>{
  const active=route.nodes.filter(n=>n.active),inactive=route.nodes.filter(n=>!n.active);
  if(route.nodes.length!==300||active.length!==281||inactive.length!==19)throw new Error('counts');
  if(active.some(n=>!n.occ)||inactive.some(n=>n.occ))throw new Error('shard refs');
  return {active:active.length,inactive:inactive.length};
});
S.check('dag-acyclic-topological','every prerequisite active and earlier in route order',()=>{
  const pos=new Map(route.order.map((id,i)=>[id,i]));let edges=0;
  for(const n of route.nodes)for(const p of n.prerequisites){edges++;if(!route.byId.get(p).active||pos.get(p)>=pos.get(n.competency_id))throw new Error(p+'->'+n.competency_id);}
  return {edges};
});
S.check('first-subtraction-not-behind-all-addition','first SUB node depends only on grade-1 addition',()=>{
  const sub=route.order.map(id=>route.byId.get(id)).find(n=>n.active&&n.operation==='SUB');
  const anc=new Set(),st=[sub.competency_id];while(st.length)for(const p of route.byId.get(st.pop()).prerequisites)if(!anc.has(p)){anc.add(p);st.push(p);}
  if([...anc].some(p=>route.byId.get(p).grade>1))throw new Error([...anc].join());
  return {node:sub.competency_id,ancestors:[...anc]};
});
await S.checkAsync('all-placements-mapped','177,640 placements, each package sha matches the bank catalog',async()=>{
  let n=0,pk=0;
  for(const node of route.nodes.filter(x=>x.active)){
    const sh=await shard(node.competency_id);
    const [g,l]=[node.grade,node.level].map(v=>String(v).padStart(2,'0'));
    const cell=JSON.parse(await readFile(new URL(`dist/bank/g${g}/l${l}.json`,ROOT),'utf8')).competencies.find(c=>c.competency_id===node.competency_id);
    for(const p of sh.packages){pk++;const e=cell.packages.find(x=>x.package_id===p.package_id);if(!e||e.sha256!==p.package_sha256||e.question_count!==p.q.length)throw new Error(p.package_id);n+=p.q.length;}
  }
  if(n!==177640||pk!==4604)throw new Error(n+'/'+pk);return {placements:n,packages:pk};
});
S.check('heuristic-labelled','route and shards say authored_heuristic',()=>{if(route.reviewer_status!=='authored_heuristic')throw new Error();return route.reviewer_status;});

// 2 · selector: G03L01ADD sequential missions expand coverage (PG-02 regression)
let attempts=[];
const G3='arithmetic.addition.g03.l01';
await S.checkAsync('g03l01add-three-missions-disjoint','intro 6 then two regular 8, no repeated question',async()=>{
  const seen=new Set(),sizes=[];
  for(const [k,seed] of [['intro',11],['regular',12],['regular',13]]){
    const {a}=await mission(G3,k,{attempts,seed});attempts=await listAttempts(scope);
    sizes.push(a.items.length);
    for(const i of a.items){if(seen.has(i.question.fingerprint))throw new Error('repeat '+i.question.question_id);seen.add(i.question.fingerprint);}
  }
  if(sizes.join()!=='6,8,8')throw new Error(sizes.join());return {sizes,unique:seen.size};
});
S.check('roles-and-order','regular mission = 2 warm-up, 4 target, 2 apply in that order',()=>{
  const a=attempts.filter(x=>x.journey?.mission_kind==='regular').at(-1);
  const roles=a.items.map(i=>i.journey_role).join('');
  if(roles!=='wwttttaa')throw new Error(roles);return roles;
});
S.check('frozen-provenance','refs carry package, version, sha256, index, question id and revision',()=>{
  const a=attempts.at(-1),r=a.journey.selected_occurrence_refs;
  if(r.length!==a.items.length)throw new Error('len');
  a.items.forEach((it,k)=>{const ref=r[k];if(ref.question_id!==it.question.question_id||ref.question_revision!==it.question.question_revision||ref.package_id!==a.package_id||!/^[a-f0-9]{64}$/.test(ref.package_sha256)||!Number.isInteger(ref.question_index))throw new Error('ref '+k);});
  if(!a.journey.selection_trace?.candidates?.length||a.journey.seed==null)throw new Error('trace');
  return {package:a.package_id,refs:r.length,trace_reasons:a.journey.selection_trace.reasons};
});
S.check('no-assessment-forms-in-missions','no mission draws from A/B forms',()=>{
  const bad=attempts.filter(a=>a.journey&&(a.form_id||/assessment/.test(a.journey.selection_trace.candidates.map(c=>c.use).join())));if(bad.length)throw new Error(bad.length);return 0;
});
S.check('selector-deterministic','same inputs and seed give the same plan',()=>{
  const sh=shardCache.get(G3),x=planMission({shard:sh,kind:'regular',policy,seen:exposure(attempts,G3),seed:99}),y=planMission({shard:sh,kind:'regular',policy,seen:exposure(attempts,G3),seed:99});
  if(JSON.stringify(x.rows)!==JSON.stringify(y.rows))throw new Error();return x.trace.chosen;
});
await S.checkAsync('snapshots-valid','journey snapshots pass the backup snapshot validator',async()=>{
  for(const a of attempts)await validateSnapshot(a,await listEvents(a.attempt_id,scope));return attempts.length;
});

// 3 · progression: perfect play does not loop; readiness then advance
await S.checkAsync('perfect-practice-advances','after intro + 2 perfect target missions the node is ready and next is a different node',async()=>{
  const state=journeyState(route,attempts,null),s=state.nodes.get(G3);
  const next=nextMission(route,state);
  if(!s.ready||next.node_id===G3&&next.action!=='checkpoint')throw new Error(JSON.stringify({ready:s.ready,next}));
  return {ready:s.ready,passing:s.passing.size,coverage:s.coverage,next};
});
S.check('xp-idempotent','duplicate snapshots of one attempt do not add XP',()=>{
  const once=journeyState(route,attempts,null).xp,twice=journeyState(route,[...attempts,...attempts.map(a=>structuredClone(a))],null).xp;
  if(once!==twice||once<=0)throw new Error(once+' vs '+twice);return once;
});

// 4 · G05L01ADD before/after selection
await S.checkAsync('g05l01add-intro-then-regular','second mission uses new questions',async()=>{
  const id='arithmetic.addition.g05.l01';
  const first=(await mission(id,'intro',{attempts,seed:21})).a;attempts=await listAttempts(scope);
  const second=(await mission(id,'regular',{attempts,seed:22})).a;attempts=await listAttempts(scope);
  const overlap=second.items.filter(i=>first.items.some(j=>j.question.fingerprint===i.question.fingerprint)).length;
  if(overlap)throw new Error('overlap '+overlap);return {first:first.package_id,second:second.package_id};
});

// 5 · wrong → key seen → revision correct is not independent
await S.checkAsync('revision-after-key-not-independent','first-response independence excludes revisions after the key',async()=>{
  const id='arithmetic.subtraction.g03.l01';
  const {a}=await mission(id,'intro',{attempts,seed:31,answers:i=>i===0?'wrong-then-key':i===1?'hint':'correct'});attempts=await listAttempts(scope);
  if(firstIndependent(a.items[0])||firstIndependent(a.items[1]))throw new Error('counted');
  if(a.items[0].final_status!=='correct'||!a.items[0].history[1].key_seen_before)throw new Error('revision not recorded');
  const o=missionOutcome(a);return {first_independent:o.first_independent,final_correct:o.final_correct,assisted:o.assisted};
});

// 6 · low score → reinforcement, never a punishment wait
await S.checkAsync('wrong-streak-reinforcement','mission below 60% independent gives a reinforcement mission on the same node',async()=>{
  const id='arithmetic.addition.g04.l01';
  await mission(id,'intro',{attempts,seed:41,answers:'wrong'});attempts=await listAttempts(scope);
  const st=journeyState(route,attempts,null),next=nextMission(route,st);
  if(next.action!=='reinforce'||next.node_id!==id||next.kind!=='reinforcement')throw new Error(JSON.stringify(next));
  const plan=planMission({shard:await shard(id),kind:'reinforcement',policy,seen:exposure(attempts,id),seed:42});
  if(plan.rows.length!==8)throw new Error('size');return {next,bands:plan.rows.map(r=>r.band).join('')};
});

// 7 · small pool: honest review counts
await S.checkAsync('small-pool-review-honest','G1L1 ADD (12 unique) marks review items and reports unique counts',async()=>{
  const id='arithmetic.addition.g01.l01';const sh=await shard(id);
  let seen=new Map(),reviewSeen=false,trace;
  for(let k=0;k<4;k++){
    const p=planMission({shard:sh,kind:'regular',policy,seen,seed:50+k});trace=p.trace;
    if(p.trace.review){reviewSeen=true;if(p.trace.unique_new+p.trace.review!==p.rows.length||!p.trace.reasons.length)throw new Error('trace');}
    for(const r of p.rows)seen.set(r.fp,(seen.get(r.fp)||0)+1);
  }
  if(!reviewSeen)throw new Error('no review');
  const teaching=route.byId.get(id).teaching_unique;if(seen.size!==teaching)throw new Error('coverage '+seen.size+'/'+teaching);
  return {unique_total:seen.size,teaching_unique:teaching,last_trace:trace};
});

// 8 · checkpoint once, start point, ongoing resume, 1.3 compatibility
S.check('start-point-unlocks-later-stage','choosing stage G05L01 opens that stage without readiness of earlier stages',()=>{
  const st=journeyState(route,[],{stage_id:'S-G05-L01'}),next=nextMission(route,st);
  if(!st.nodes.get('arithmetic.addition.g05.l01').unlocked||next.node_id!=='arithmetic.addition.g05.l01')throw new Error(JSON.stringify(next));
  if(st.nodes.get('arithmetic.addition.g05.l01').ready)throw new Error('start point must not grant readiness');
  return next;
});
S.check('new-user-choose-start','no history and no start point → choose_start',()=>{const n=nextMission(route,journeyState(route,[],null));if(n.action!=='choose_start')throw new Error(n.action);return n;});
await S.checkAsync('ongoing-resumes','an ongoing mission is the next action',async()=>{
  const {a}=await mission('arithmetic.addition.g06.l01','intro',{attempts,seed:61,stopAfter:2});attempts=await listAttempts(scope);
  const n=nextMission(route,journeyState(route,attempts,null));
  if(n.action!=='continue'||n.attempt_id!==a.attempt_id)throw new Error(JSON.stringify(n));return n;
});
await S.checkAsync('legacy-13-attempts-untouched','1.3-style attempts (no journey, no flow policy) are read without change',async()=>{
  const pkg=await pack('MM-G03-L01-ADD-P001');
  const legacy=createAttempt(pkg,scope,{mode:'practice',question_count:10,now:tick()});
  delete legacy.flow_policy_version; // shape of a 1.3.0 snapshot
  await saveAttempt(legacy,null,scope);const ev=begin(legacy,tick());await saveAttempt(legacy,ev,scope);
  const before=JSON.stringify((await listAttempts(scope)).find(x=>x.attempt_id===legacy.attempt_id));
  attempts=await listAttempts(scope);const st=journeyState(route,attempts,null);
  const after=JSON.stringify((await listAttempts(scope)).find(x=>x.attempt_id===legacy.attempt_id));
  if(before!==after)throw new Error('mutated');
  if(st.ongoing?.attempt_id===legacy.attempt_id)throw new Error('legacy treated as journey');
  if(!exposure(attempts,G3).size)throw new Error('exposure');
  return {legacy_flow_policy:null,exposure:exposure(attempts,G3).size};
});

// 9 · archive round-trip keeps journey fields byte-for-byte
await S.checkAsync('archive-roundtrip-journey','format-2 archive restores journey blocks and item refs unchanged',async()=>{
  const blob=await exportArchive(scope);const b=await readArchive(blob);
  const byId=new Map(b.records.attempts.map(r=>[r.id,r.data]));let n=0;
  for(const a of await listAttempts(scope)){if(!a.journey)continue;n++;const r=byId.get(a.attempt_id);
    if(JSON.stringify(r.journey)!==JSON.stringify(a.journey)||JSON.stringify(r.items.map(i=>i.occurrence_ref))!==JSON.stringify(a.items.map(i=>i.occurrence_ref)))throw new Error(a.attempt_id);}
  return {journey_attempts:n,bytes:blob.size};
});
S.check('kind-for-node','map choice kind follows node state',()=>{const st=journeyState(route,attempts,null);return {g3:kindFor(st,G3),new:kindFor(st,'arithmetic.addition.g12.l05')};});

// 11 · ordering, randomness, start correction, versioned policy, untimed, assessment intact
S.check('intro-order-by-strategy-band','missions run warm-up → target → apply with non-decreasing AST scores inside each role',()=>{
  for(const a of attempts.filter(x=>x.journey)){
    const rank={w:0,t:1,a:2};let prev=[-1,0];
    for(const i of a.items){const pack=shardCache.get(a.journey.node_id).packages.find(p=>p.package_id===a.package_id);const k=[rank[i.journey_role],pack.q[i.occurrence_ref.question_index][3]];if(k[0]<prev[0]||(k[0]===prev[0]&&k[1]<prev[1]))throw new Error(a.attempt_id);prev=k;}
  }
  return attempts.filter(x=>x.journey).length;
});
S.check('random-only-within-equal-buckets','different seeds change items only inside the same role/score bucket',()=>{
  const sh=shardCache.get(G3),seq=seed=>planMission({shard:sh,kind:'regular',policy,seen:new Map(),seed}).rows.map(r=>r.role+r.score).join();
  const ref=seq(1);for(const sd of [2,3,4,5,6,7,8])if(seq(sd)!==ref)throw new Error(sd+': '+seq(sd)+' vs '+ref);return ref;
});
S.check('start-point-correctable','a later start choice replaces the earlier one',()=>{
  const st=journeyState(route,[],{stage_id:'S-G02-L01'}),n=nextMission(route,st);
  if(n.node_id!=='arithmetic.addition.g02.l01')throw new Error(JSON.stringify(n));return n.node_id;
});
S.check('policy-versioned-with-reasons','attempts carry selector/policy/metadata versions; next actions carry a reason',()=>{
  const a=attempts.find(x=>x.journey);const j=a.journey;
  if(!j.metadata_version||!j.route_version||!j.policy_version||!j.selection_trace.selector_version||!Array.isArray(j.selection_trace.reasons))throw new Error('versions');
  const n=nextMission(route,journeyState(route,attempts,null));if(!n.reason)throw new Error('reason');
  return {metadata:j.metadata_version,route:j.route_version,policy:j.policy_version,selector:j.selection_trace.selector_version,next_reason:n.reason};
});
S.check('missions-untimed','journey missions have no deadline; speed stays optional in the catalogue',()=>{
  const bad=attempts.filter(a=>a.journey&&(a.duration_seconds||a.deadline));if(bad.length)throw new Error(bad.length);return 0;
});
await S.checkAsync('assessment-unchanged','assessment attempts get no direct-result flow and keep the key hidden',async()=>{
  const lv=JSON.parse(await readFile(new URL('dist/bank/g03/l01.json',ROOT),'utf8'));
  const form=lv.competencies[0].packages.find(p=>p.form_id);const pkg=(await import(new URL('dist/'+form.url,ROOT).href)).default;
  const a=createAttempt(pkg,scope,{mode:'assessment'});begin(a);editDraft(a,0,'1','id');submit(a,0);
  if(a.flow_policy_version||a.items[0].feedback||a.items[0].key_revealed_at)throw new Error('assessment changed');
  return {form:pkg.form_id,flow_policy:a.flow_policy_version??null};
});
await S.checkAsync('profile-isolation','a second profile sees none of the first profile\'s journey',async()=>{
  const other=await createProfile('Journey other'),s2=scopeForLocal(other.id);
  const st=journeyState(route,await listAttempts(s2),null);if(st.journeyAttempts||st.xp)throw new Error('leak');return {other_missions:0};
});
await S.checkAsync('local-profile-wording','student journey copy never claims an account, login or server',async()=>{
  const text=await readFile(new URL('src/journey/ui.mjs',ROOT),'utf8');
  const hits=[...text.matchAll(/'([^']*)'/g)].map(m=>m[1]).filter(x=>/\b(akun|login|masuk akun|server|account|sign in)\b/i.test(x));
  if(hits.length)throw new Error(hits.join(' | '));return 0;
});
await S.checkAsync('offline-shell-not-whole-bank','offline shell lists route metadata but no bank package and no occurrence shard',async()=>{
  const m=JSON.parse(await readFile(new URL('dist/offline-assets.json',ROOT),'utf8'));
  const paths=m.assets.map(a=>a.path);
  if(paths.some(p=>/^bank\/v1\.2\//.test(p)||p.startsWith('journey/v1/occ/')))throw new Error('prefetch');
  if(!paths.includes('journey/v1/route.json'))throw new Error('route missing');
  return {assets:paths.length,bytes:m.assets.reduce((x,a)=>x+a.bytes,0)};
});

// 10 · teacher report keeps independent / assisted / readiness / XP apart, every format
await S.checkAsync('teacher-report-journey-exports','PDF, DOCX, XLSX, CSV and JSON written with the journey section',async()=>{
  const all=await listAttempts(scope),person={id:profile.id,alias:'Journey test',classId:''};
  const snap=buildSnapshot({person,people:[person],attempts:all,locale:'id',filters:{...initialFilters(),source:'local_practice'},createdAt:new Date(clock).toISOString(),appendix:true});
  const j=snap.journey;if(!j.rows.length||j.readiness_label!=='product_policy_not_psychometric'||j.xp_label!=='effort_marker_not_academic')throw new Error('journey summary');
  const g3=j.rows.find(r=>r.node_id===G3),mapNode=journeyState(route,all).nodes.get(G3);
  if(!g3.ready||g3.passing_missions!==2||g3.unique_seen!==mapNode.coverage||
    g3.strategies_seen!==mapNode.strategies_seen||j.mission_policy!==route.mission_policy.policy_version||
    j.as_of.utc!==new Date(clock).toISOString()||!j.as_of.inclusive)throw new Error(JSON.stringify(g3));
  const sub=j.rows.find(r=>r.node_id==='arithmetic.subtraction.g03.l01');if(sub.assisted!==2||sub.revised_after_key!==1||sub.first_independent!==4)throw new Error(JSON.stringify(sub));
  const font=[new Uint8Array(await readFile(new URL('src/teacher/font/DejaVuSans.ttf',ROOT))),JSON.parse(await readFile(new URL('src/teacher/font/metrics.json',ROOT),'utf8'))];
  const dir=process.env.KALIBATAKU_JOURNEY_EXPORTS||new URL('evidence/v15/exports/',ROOT).pathname;mkdirSync(dir,{recursive:true});
  const sizes={};for(const k of ['pdf','docx','xlsx','csv','json']){const b=await encode(snap,k,{font});writeFileSync(dir+'journey-report.'+k,b);sizes[k]=b.length;}
  return {rows:j.rows.length,xp:j.xp,sizes,dir};
});

S.finish(receiptPath('journey-model.json'));
