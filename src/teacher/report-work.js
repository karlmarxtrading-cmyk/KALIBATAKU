import {buildSnapshot} from './report.js';
self.onmessage=({data})=>{
  try{self.postMessage({snapshot:buildSnapshot(data)});}
  catch(error){self.postMessage({error:String(error.message)});}
};
