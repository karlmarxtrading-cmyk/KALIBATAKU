import {utcTimestamp} from './time.js';
// This index uses the existing v2 records store. Returning to an older static shell
// can still open the device database. The index never enters a profile backup.
import {row,key} from './db.js';
const namespace=ns=>'summary:v2:'+ns;
const meta=ns=>key('summary-counts-v2',ns);
export function compactAttempt(a){
  const {attempt_id,grade,level,operation,mode,status,started_at,completed_at,index,
    package_id,package_title,content_version,target_competency_id,metrics,assignment_id}=a;
  return {attempt_id,grade,level,operation,mode,status,started_at,completed_at,index,
    package_id,package_title,content_version,target_competency_id,metrics,assignment_id,last_saved_at:a._saved_at||null,item_count:a.items?.length||0};
}
const sortId=a=>utcTimestamp(a.started_at)+'|'+a.attempt_id;
async function storeOne(tx,ns,a) {
  await tx.put('records',row(namespace(ns),sortId(a),compactAttempt(a)));
}
export async function forgetSummaries(tx,ns){
  await tx.scan('records','summary:v1:'+ns,r=>tx.del('records',r.key));
  await tx.del('records',key('summary-counts',ns));
  await tx.scan('records',namespace(ns),r=>tx.del('records',r.key));
  await tx.del('records',meta(ns));
}
export async function syncSummary(tx,ns,a,added,eventCount,previous){
  if(previous && sortId(previous)!==sortId(a))await tx.del('records',key(namespace(ns),sortId(previous)));
  await storeOne(tx,ns,a);
  const mark=await tx.get('records',meta(ns));
  if(mark){
    mark.data.attempts+=Number(added);mark.data.events+=eventCount;
    await tx.put('records',mark);
  }
}
export async function ensureSummaries(tx,ns){
  const [attempts,events,mark]=await Promise.all([tx.count('attempts',ns),tx.count('events',ns),tx.get('records',meta(ns))]);
  // Includes an import or sessions created using a previous release. Backfill one
  // snapshot at a time inside a single transaction, then use the compact index.
  if(mark && mark.data.attempts===attempts && mark.data.events===events)return;
  await forgetSummaries(tx,ns);
  await tx.scan('attempts',ns,rec=>storeOne(tx,ns,rec.data));
  await tx.put('records',row('summary-counts-v2',ns,{attempts,events}));
}
export async function pageSummaries(tx,ns,{offset=0,limit=10,...filter}={}){
  const skip=Math.max(0,Math.trunc(Number(offset))||0),size=Math.max(0,Math.min(100,Math.trunc(Number(limit))||0));
  const criteria=['grade','level','operation','mode','status'].filter(k=>filter[k]!==undefined&&filter[k]!==null&&filter[k]!==''&&filter[k]!=='all');
  const since=filter.since==null?null:utcTimestamp(filter.since);
  if(filter.since&&!since)throw new Error('INVALID_HISTORY_TIME');
  const filtered=criteria.length>0||!!since,scope=namespace(ns),rows=[];
  let total=filtered?0:await tx.count('records',scope),matched=0;
  if(filtered||size)await tx.scan('records',scope,r=>{
    const a=r.data;
    if(since && utcTimestamp(a.started_at)<since)return false;
    if(criteria.some(k=>String(a[k])!==String(filter[k])))return;
    if(filtered)total++;
    if(matched++>=skip&&rows.length<size)rows.push(a);
    if(!filtered&&rows.length>=size)return false;
  },'prev');
  return {rows,total};
}
export async function packageSet(tx,ns,{status}={}){
  const packages=new Set();
  await tx.scan('records',namespace(ns),r=>{if(!status || status==='all' || r.data.status===status)packages.add(r.data.package_id);});
  return packages;
}
