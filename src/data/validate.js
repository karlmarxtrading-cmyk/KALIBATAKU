import {epoch} from './time.js';
import definitions from './contract-defs.js';
import {invariant} from './common.js';
const patterns = new Map();
function matches(rule,v) {
  if (rule.$ref) return matches(definitions[rule.$ref.split('/').at(-1)],v);
  if (rule.oneOf && rule.oneOf.filter(r=>matches(r,v)).length!==1) return false;
  if (rule.anyOf && !rule.anyOf.some(r=>matches(r,v))) return false;
  if (rule.allOf && !rule.allOf.every(r=>matches(r,v))) return false;
  if (rule.if && matches(rule.if,v) && !matches(rule.then,v)) return false;
  if ('const' in rule && v !== rule.const || rule.enum && !rule.enum.includes(v)) return false;
  if (rule.type) {
    const type=rule.type;
    if (type==='integer' ? !Number.isSafeInteger(v) : type==='array' ? !Array.isArray(v) :
        type==='null' ? v!==null : type==='object' ? !v||Array.isArray(v)||typeof v!=='object' : typeof v!==type) return false;
  }
  if (typeof v === 'string') {
    if(v.length<(rule.minLength??0)||v.length>(rule.maxLength??Infinity)) return false;
    if(rule.pattern) {
      if(!patterns.has(rule.pattern)) patterns.set(rule.pattern,new RegExp(rule.pattern));
      if(!patterns.get(rule.pattern).test(v)) return false;
    }
    if(rule.format==='date-time' && !Number.isFinite(epoch(v)))return false;
  }
  if(typeof v==='number' && (v<(rule.minimum??-Infinity)||v>(rule.maximum??Infinity))) return false;
  if(Array.isArray(v)) {
    if(v.length<(rule.minItems??0)||v.length>(rule.maxItems??Infinity)) return false;
    if(rule.uniqueItems && new Set(v).size!==v.length) return false;
    if(rule.items && !v.every(x=>matches(rule.items,x))) return false;
  } else if(v && typeof v==='object') {
    if(rule.required?.some(k=>!Object.hasOwn(v,k))) return false;
    if(rule.additionalProperties===false && Object.keys(v).some(k=>!Object.hasOwn(rule.properties||{},k))) return false;
    if(rule.properties && Object.entries(rule.properties).some(([k,r])=>Object.hasOwn(v,k)&&!matches(r,v[k]))) return false;
  }
  return true;
}
export function validate(name,value) {
  invariant(matches(definitions[name],value),'INVALID_'+name.toUpperCase());
  if(name==='Event' && value.event_type==='answer.submitted') {
    const a=value.payload.answer;
    invariant(a.numerator.length<=160 && a.denominator.length<=160,'INVALID_RATIONAL');
    let x=BigInt(a.numerator), y=BigInt(a.denominator); x=x<0n?-x:x;
    while(y) [x,y]=[y,x%y];
    invariant(x===1n && a.numerator!=='-0','INVALID_RATIONAL');
  }
  return value;
}
