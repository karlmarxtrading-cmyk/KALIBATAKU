import {readAny,journeyCheckSummary} from './backup.js';
self.onmessage=async({data})=>{
  try{const backup=await readAny(data);self.postMessage({backup,journey_checks:journeyCheckSummary(backup)});}
  catch(error){self.postMessage({error:error.code||error.name});}
};
