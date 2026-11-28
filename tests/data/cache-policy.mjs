// TECH-04 policy matrix for offline cache retention (pure decisions; the browser suite
// applies the same policy to real Cache Storage through the service worker).
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Suite,receiptPath} from '../qa/receipt.mjs';
const ctx={};vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../../src/cache-policy.js',import.meta.url),'utf8'),ctx);
const {plan}=ctx.KalibatakuCachePolicy;
const s=new Suite('TECH-04-cache-policy',{scope:'Retention decisions for shells, packs, rollback, installs and locks'});
const P='kalibataku:/school/math/:',shell=r=>P+'shell:'+r,pack=(r,id)=>P+'ready-pack:'+r+':'+id;
const base={prefix:P,release:'cccc',installs:[]};
const eq=(a,b)=>{if(JSON.stringify([...a].sort())!==JSON.stringify([...b].sort()))throw Error(JSON.stringify({got:[...a].sort(),want:[...b].sort()}));};
s.check('repeated-updates','After updates A→B→C only C and one rollback (B) remain',()=>{
  const r=plan({...base,names:[shell('aaaa'),shell('bbbb'),shell('cccc')],complete:[shell('aaaa'),shell('bbbb'),shell('cccc')]});
  eq(r.remove,[shell('aaaa')]);if(r.rollback!==shell('bbbb'))throw Error(r.rollback);return r.reasons;});
s.check('cancelled-download','A partial shell of an older release is removed; a partial current shell is kept for resume',()=>{
  const r=plan({...base,names:[shell('aaaa'),shell('cccc')],complete:[]});eq(r.remove,[shell('aaaa')]);return r.reasons;});
s.check('offline-install-protected','A shell and pack used by an offline install survive even when older',()=>{
  const installs=[{shellCache:shell('aaaa'),packCache:pack('aaaa','MM-1@1.2.0:u1')}];
  const r=plan({...base,installs,names:[shell('aaaa'),pack('aaaa','MM-1@1.2.0:u1'),shell('bbbb'),shell('cccc')],complete:[shell('aaaa'),pack('aaaa','MM-1@1.2.0:u1'),shell('bbbb'),shell('cccc')]});
  eq(r.remove,[]);return r.reasons;});
s.check('remove-last-pack','After the last pack is removed its old shell becomes collectable; rollback still kept',()=>{
  const r=plan({...base,names:[shell('aaaa'),shell('bbbb'),shell('cccc')],complete:[shell('aaaa'),shell('bbbb'),shell('cccc')],installs:[]});
  eq(r.remove,[shell('aaaa')]);return r.reasons;});
s.check('orphan-packs','Pack caches without an install record (crash or cancel) are removed',()=>{
  const r=plan({...base,names:[shell('cccc'),pack('cccc','A@1:u'),pack('bbbb','B@1:v')],complete:[shell('cccc'),pack('cccc','A@1:u')]});
  eq(r.remove,[pack('cccc','A@1:u'),pack('bbbb','B@1:v')]);return r.reasons;});
s.check('install-in-progress','While another tab installs (lock held) nothing is removed',()=>{
  const r=plan({...base,locked:true,names:[shell('aaaa'),pack('cccc','A@1:u')],complete:[]});if(r.skipped!=='install-in-progress'||r.remove.length)throw Error(JSON.stringify(r));return r.skipped;});
s.check('records-unreadable','If install records cannot be read nothing is removed',()=>{
  const r=plan({...base,installs:null,names:[shell('aaaa')],complete:[]});if(r.skipped!=='install-records-unavailable'||r.remove.length)throw Error(JSON.stringify(r));return r.skipped;});
s.check('other-scopes-untouched','Caches of another base path or other apps are never considered',()=>{
  const other='kalibataku:/other/:shell:aaaa';const r=plan({...base,names:[other,'workbox-precache',shell('cccc')],complete:[]});
  if(r.remove.includes(other)||r.keep.includes(other)||r.remove.includes('workbox-precache'))throw Error(JSON.stringify(r));return r.keep;});
s.check('legacy-pack-referenced','A v1.0 pack cache referenced by an install record is kept',()=>{
  const legacy=P+'pack:MM-1@1.0.0';const r=plan({...base,installs:[{shellCache:shell('aaaa'),packCache:legacy}],names:[shell('aaaa'),legacy,shell('cccc')],complete:[shell('aaaa'),shell('cccc')]});
  eq(r.remove,[]);return r.reasons;});
s.check('two-releases-active','During an update the waiting release does not collect; the active worker (old release) keeps its own shell',()=>{
  const r=plan({...base,release:'bbbb',names:[shell('aaaa'),shell('bbbb'),shell('cccc')],complete:[shell('aaaa'),shell('bbbb'),shell('cccc')]});
  if(r.remove.includes(shell('bbbb')))throw Error('active shell removed');return r.reasons;});
s.finish(receiptPath('data-cache-policy.json'));
