// v14 counterpart of the audit probe 08_REPRODUKSI/probe-progression.mjs. The audit probe
// compares the package prefix (pkg.questions.slice(0,10)); this probe compares the questions
// of the attempt that is actually created next, on the catalogue path and on the journey path.
//   node tests/journey/probe-next-practice.mjs [out.json]
import {readFile,writeFile} from 'node:fs/promises';
const ROOT=new URL('../../',import.meta.url),dist=new URL('dist/',ROOT),memory=new Map();
globalThis.document={baseURI:dist.href};globalThis.location=new URL(dist.href);
globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
globalThis.sessionStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
globalThis.fetch=async u=>new Response(await readFile(new URL(u)),{status:200});
const {selection}=await import(new URL('src/core/bank.mjs',ROOT));
const {prepareSession,launchPrepared}=await import(new URL('src/player/start.mjs',ROOT));
const {begin,visit,editDraft,submit,finish}=await import(new URL('src/player/engine.mjs',ROOT));
const {getAttempt,saveAttempt,activeScope,listAttempts}=await import(new URL('src/data/store.js',ROOT));
const {createMission,overview}=await import(new URL('src/journey/journey.mjs',ROOT));
const ctx={lang:'id',params:new URLSearchParams(),signal:new AbortController().signal};
async function play(id){const scope=activeScope(),a=await getAttempt(id,scope);let now=Date.now();await saveAttempt(a,begin(a,now),scope);
  for(let k=0;k<a.items.length;k++){if(k)visit(a,k,now+=1000);const v=a.items[k].question.answer;editDraft(a,k,v.denominator==='1'?v.numerator:v.numerator+'/'+v.denominator,'id');await saveAttempt(a,submit(a,k,now+=1000),scope);}
  for(const e of finish(a,{now:now+1000}))await saveAttempt(a,e,scope);return a;}
const s=await selection(ctx,{grade:3,level:1,op:'ADD'});
const opts={grade:3,level:1,operation:'ADD',entry:s.entry,mode:'practice',question_count:10,shuffle:false};
const a1=await play(await launchPrepared(ctx,await prepareSession(ctx,opts)));
const a2=await play(await launchPrepared(ctx,await prepareSession(ctx,opts)));
const ids=a=>a.items.map(i=>i.question.question_id);
const catalogue={package_id:a1.package_id,first:ids(a1),second:ids(a2),overlap:ids(a2).filter(x=>ids(a1).includes(x)).length};
// journey: three consecutive missions on G03 L01 ADD from a start point at that stage
const {chooseStart}=await import(new URL('src/journey/journey.mjs',ROOT));
await chooseStart(activeScope(),'S-G03-L01','probe');
const missions=[];
for(let k=0;k<3;k++){const id=await createMission(ctx,{nodeId:'arithmetic.addition.g03.l01'});const a=await play(id);missions.push({kind:a.journey.mission_kind,package_id:a.package_id,ids:ids(a),review:a.journey.selection_trace.review});}
const all=missions.flatMap(m=>m.ids);
const out={runtime:process.version,scope:'Node, in-memory store, built dist; no browser',catalogue_next_practice:{...catalogue,same_question_order:JSON.stringify(catalogue.first)===JSON.stringify(catalogue.second)},
  journey_three_missions:{missions:missions.map(m=>({kind:m.kind,package_id:m.package_id,n:m.ids.length,review:m.review})),total:all.length,unique:new Set(all).size},
  next_after:(await overview(activeScope(),ctx.signal)).next};
const file=process.argv[2]||new URL('evidence/v14/commands/probe-next-practice.json',ROOT).pathname;
await writeFile(file,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({catalogue_overlap:catalogue.overlap,same_order:out.catalogue_next_practice.same_question_order,journey:out.journey_three_missions},null,1));
if(catalogue.overlap||out.journey_three_missions.unique!==out.journey_three_missions.total)process.exitCode=1;
