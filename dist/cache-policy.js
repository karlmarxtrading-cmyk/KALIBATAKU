// Offline cache retention policy (TECH-04). Classic script: loaded by sw.js through
// importScripts and by tests through a VM context. It only decides; callers delete.
// Kept: the active release shell; shells and packs referenced by install records; the
// newest previous complete shell (one rollback). Removed: partial or older shells and
// pack caches that no install record references. Nothing outside this scope prefix,
// and never IndexedDB.
(function(root){
  function plan({prefix,release,names,complete,installs,locked}){
    const done=new Set(complete||[]),mine=names.filter(n=>n.startsWith(prefix));
    if(locked)return {skipped:'install-in-progress',keep:mine,remove:[],reasons:{}};
    if(!Array.isArray(installs))return {skipped:'install-records-unavailable',keep:mine,remove:[],reasons:{}};
    const current=prefix+'shell:'+release,reasons={};
    const referencedShells=new Set(installs.map(r=>r&&r.shellCache).filter(Boolean));
    const referencedPacks=new Set(installs.map(r=>r&&r.packCache).filter(Boolean));
    const shells=mine.filter(n=>n.startsWith(prefix+'shell:'));
    // Cache Storage lists names in creation order; the last complete older shell is the newest.
    const rollback=[...shells].reverse().find(n=>n!==current&&done.has(n)&&!referencedShells.has(n))||null;
    for(const n of shells){
      if(n===current)reasons[n]='active-release';
      else if(referencedShells.has(n))reasons[n]='used-by-offline-install';
      else if(n===rollback)reasons[n]='rollback';
      else reasons[n]=done.has(n)?'remove:older-release':'remove:partial-download';
    }
    for(const n of mine.filter(n=>n.startsWith(prefix+'ready-pack:')||n.startsWith(prefix+'pack:'))){
      reasons[n]=referencedPacks.has(n)?'used-by-offline-install':'remove:'+(done.has(n)?'orphan-pack':'partial-pack');
    }
    for(const n of mine)if(!reasons[n])reasons[n]='unknown-kept';
    const remove=Object.keys(reasons).filter(n=>reasons[n].startsWith('remove:'));
    return {skipped:null,keep:mine.filter(n=>!remove.includes(n)),remove,reasons,rollback};
  }
  root.KalibatakuCachePolicy={plan,version:1};
})(typeof self!=='undefined'?self:globalThis);
