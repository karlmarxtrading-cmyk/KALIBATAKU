// Shared receipt writer for KALIBATAKU QA suites (schema kalibataku-qa-receipt/1).
// A receipt records every assertion actually evaluated. Its status is derived from
// those rows; a suite cannot declare PASS for itself, and an empty suite is FAIL.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {platform,arch} from 'node:os';

const ROOT=new URL('../../',import.meta.url);

export function buildIdentity(){
  try{
    const m=JSON.parse(readFileSync(new URL('dist/offline-assets.json',ROOT),'utf8'));
    let app=null;try{app=JSON.parse(readFileSync(new URL('dist/build-info.json',ROOT),'utf8'));}catch{}
    return {offline_release:m.release,app_version:app?.app_version??null,bank_version:app?.bank_version??null};
  }catch{return {offline_release:null,app_version:null,bank_version:null};}
}

export class Suite{
  constructor(id,{scope=''}={}){this.id=id;this.scope=scope;this.checks=[];this.errors=[];this.started=new Date().toISOString();}
  // Record one evaluated assertion. `fn` may return an observed value.
  check(id,expected,fn){
    try{const actual=fn();this.checks.push({id,status:'PASS',expected,actual:actual===undefined?null:actual});return actual;}
    catch(e){this.checks.push({id,status:'FAIL',expected,actual:String(e?.stack||e).slice(0,2000)});return undefined;}
  }
  async checkAsync(id,expected,fn){
    try{const actual=await fn();this.checks.push({id,status:'PASS',expected,actual:actual===undefined?null:actual});return actual;}
    catch(e){this.checks.push({id,status:'FAIL',expected,actual:String(e?.stack||e).slice(0,2000)});return undefined;}
  }
  // Environment limits are distinct from failures and from PASS.
  blocked(id,expected,reason){this.checks.push({id,status:'BLOCKED_ENV',expected,actual:reason});}
  error(e){this.errors.push(String(e?.stack||e).slice(0,2000));}
  get status(){
    if(this.errors.length||!this.checks.length)return 'FAIL';
    if(this.checks.some(c=>c.status==='FAIL'))return 'FAIL';
    return this.checks.some(c=>c.status==='BLOCKED_ENV')?'BLOCKED_ENV':'PASS';
  }
  write(path,extra={}){
    const body={schema:'kalibataku-qa-receipt/1',suite:this.id,scope:this.scope,build:buildIdentity(),
      runtime:{node:process.version,platform:platform(),arch:arch()},started:this.started,finished:new Date().toISOString(),
      assertions:this.checks.length,status:this.status,errors:this.errors,checks:this.checks,...extra};
    const text=JSON.stringify(body,null,2)+'\n';
    mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text);
    const failed=this.checks.filter(c=>c.status==='FAIL').map(c=>c.id);
    console.log(`${this.id}: ${body.status} · ${body.assertions} assertions · ${failed.length} failed`+(failed.length?' · '+failed.slice(0,8).join(', '):''));
    return {status:body.status,sha256:createHash('sha256').update(text).digest('hex')};
  }
  // Exit code mirrors the derived status, so orchestration cannot read a FAIL as success.
  finish(path,extra){const r=this.write(path,extra);process.exitCode=r.status==='PASS'?0:r.status==='BLOCKED_ENV'?3:1;return r;}
}

export function receiptPath(name){
  const dir=process.env.KALIBATAKU_RECEIPTS||new URL('evidence/v13/receipts/',ROOT).pathname;
  return dir.replace(/\/?$/,'/')+name;
}
