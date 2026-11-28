// Read the active profile's ledger inside the worker. Large snapshots never cross
// the main-thread boundary: only compact mastery summaries are sent back.
import {listAttempts,getStatus} from '../data/store.js';
import {progressModel} from './analytics.mjs';
self.onmessage=async ({data})=>{
  try {
    if ((await getStatus()).temporary) throw new Error('WORKER_STORAGE_UNAVAILABLE');
    const attempts=await listAttempts(data.scope);
    self.postMessage({model:progressModel(attempts,data.cells)});
  } catch(err) {
    self.postMessage({error:String(err.code||err.message)});
  }
};
