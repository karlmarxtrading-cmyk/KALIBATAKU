import {runTeacherSuite} from './browser-suite.mjs';
const out=document.querySelector('#out'),b=document.querySelector('button');
b.onclick=async()=>{
  const w=window.open('about:blank','_blank','popup,width=1280,height=800'),r={status:'RUNNING',checks:[],browser:navigator.userAgent,started:new Date().toISOString()};
  b.disabled=true;out.textContent='Running';
  try{if(!w)throw Error('Popup blocked');r.checks=await runTeacherSuite(w,new URL('/school/math/',location).href,c=>{r.checks=c;out.textContent=JSON.stringify(c,null,2);});r.status='PASS';}
  catch(e){r.status='FAIL';r.error=e.message;r.last=w?.document?.querySelector('main')?.innerText?.slice(0,2400);}
  finally{r.finished=new Date().toISOString();await fetch('/__qa/teacher-result',{method:'POST',body:JSON.stringify(r),headers:{'Content-Type':'application/json'}});out.textContent=JSON.stringify(r,null,2);b.disabled=false;}
};
