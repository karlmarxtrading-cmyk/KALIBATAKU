import {encode,batch} from './index.js';
import {buildSnapshot} from '../report.js';
self.onmessage=async ({data:{reports,selectedInputs,format,delimiter}})=>{
  try{if(selectedInputs)reports=selectedInputs.map(r=>r.snapshot||buildSnapshot(r.input));
    const result=format==='zip'?await batch(reports,{onProgress:(done,total)=>self.postMessage({done,total})}):{data:await encode(reports[0],format,{delimiter})};
    self.postMessage({data:result.data,errors:result.manifest?.errors||[]},[result.data.buffer]);}
  catch(e){self.postMessage({error:String(e.message)});}
};
