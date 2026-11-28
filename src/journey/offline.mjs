// Read only explicitly installed files. Matching an ID narrows the search; only
// the verified catalog chain, occurrence shard, package and selector establish playability.
import {verifyStored} from '../data/offline-verification.mjs';
import {planMission} from './model.mjs';
export {packageInventory as missionInventory} from '../data/offline-verification.mjs';

export function missionDependencies(gradeUrl,levelUrl,node){
  return ['bank/index.json',gradeUrl,levelUrl,node.occ];
}

/** Recomputed on each map/launch/repair. Return the plan and exact cache bytes
 * so a launch cannot accidentally reopen a same-URL asset from an older pack. */
export async function missionCapability(inventory,{node,kind,policy,progress,seen,seed=1}){
  const records=inventory.forNode(node);
  if(!records.length)return {state:'offline',reason:'not_downloaded'};
  const material=new Map();
  for(const record of records){
    inventory.signal?.throwIfAborted();
    const item=await verifyStored(inventory,record,node);
    if(item.state==='ready')material.set(record.id,item);
  }
  if(!material.size)return {state:'repair',reason:'incomplete_or_stale'};
  const {shard}=material.values().next().value;
  try{
    const plan=planMission({shard,kind,policy,progress,seen,seed,available:new Set(material.keys())});
    return {state:'ready',plan,...material.get(plan.package.package_id)};
  }catch(e){
    if(!['NOT_INSTALLED','NO_MATERIAL'].includes(e.code||e.message))throw e;
    return {state:'repair',reason:'needs_teaching_material'};
  }
}
