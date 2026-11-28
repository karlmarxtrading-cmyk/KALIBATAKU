import {activeScope,getAttempt,listAttempts} from '../data/store.js';
import {node,add,button} from './base.mjs';
export {start} from './start.mjs';
let stylesheet;
function styles(){
  if(stylesheet)return stylesheet;
  stylesheet=new Promise((resolve,reject)=>{
    const existing=document.querySelector('link[data-player-style]');
    if(existing?.sheet){resolve();return;}
    const link=existing||document.createElement('link');
    link.addEventListener('load',resolve,{once:true});
    link.addEventListener('error',()=>{link.remove();stylesheet=null;reject(new Error('PLAYER_STYLES'));},{once:true});
    if(!existing){link.rel='stylesheet';link.href=new URL('./player.css',import.meta.url);link.dataset.playerStyle='';document.head.append(link);}
  });
  return stylesheet;
}
export async function render(ctx) {
  await styles();if(ctx.signal?.aborted)return;
  const {root,L,go,signal}=ctx,scope=activeScope(),[name,id]=ctx.route.split('/');
  if(['session','results','review'].includes(name)&&id){
    const a=await getAttempt(id,scope);if(signal?.aborted)return;
    if(!a){root.replaceChildren(add(node('section','kp'),node('h1','',L('Sesi tidak ditemukan','Session not found')),button(L('Buka riwayat','Open history'),()=>go('history'))));return;}
    if(a.status==='abandoned'){
      root.replaceChildren(add(node('section','kp'),node('h1','',L('Sesi dihentikan','Session stopped')),
        node('p','',L('Sesi ini berakhir tanpa mengirim hasil akhir.','This session ended without submitting final results.')),
        button(L('Buka riwayat','Open history'),()=>go('history'),'main')));return;
    }
    if(a.status==='ongoing'&&name!=='session'){go('session/'+id);return;}
    if(a.status==='completed'&&name==='session'){go('results/'+id);return;}
    if(name==='session')return (await import('./session.mjs')).session(ctx,a,scope);
    const records=await import('./records.mjs');if(signal?.aborted)return;
    if(name==='review'){
      // The graded attempt is immutable. The first observed post-final review lives in the local record store.
      const {addRecord}=await import('../data/store.js');
      if(signal?.aborted)return;
      records.review(ctx,a);
      addRecord('review-opened',a.attempt_id,{at:new Date().toISOString(),reason:'post_final_review',feedback_policy_version:a.feedback_policy_version||'legacy'},scope).catch(()=>{});
      return;
    }
    const attempts=await listAttempts(scope);if(!signal?.aborted)await records.result(ctx,a,attempts);
    return;
  }
  if(name==='progress')return (await import('./records.mjs')).progress(ctx);
  const records=await import('./records.mjs');
  if(signal?.aborted)return;
  return records.history(ctx,scope,name==='resume'||name==='session');
}
