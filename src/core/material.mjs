// Study choices belong to the learner. The old shared grade cannot establish an owner.
const cached=new Map();
const prefix='kalibataku.material.v2.';
function storageKey(scope){return prefix+[scope.origin,scope.environment,scope.profileId].map(encodeURIComponent).join('.');}
export function readMaterial(scope){
  const key=storageKey(scope);
  let value=cached.get(key);
  if(!value){try{value=JSON.parse(localStorage.getItem(key));}catch{}}
  if(!value||!Number.isInteger(value.grade)||value.grade<1||value.grade>12||!Number.isInteger(value.level)||value.level<1||value.level>5||!['ADD','SUB','MUL','DIV','MIX'].includes(value.op))return null;
  return {grade:value.grade,level:value.level,op:value.op};
}
export function rememberMaterial(scope,selection){
  const key=storageKey(scope),value={grade:selection.grade,level:selection.level,op:selection.comp.operation};
  cached.set(key,value);try{localStorage.setItem(key,JSON.stringify(value));}catch{}
}
export function clearMaterial(scope){
  const key=storageKey(scope);cached.delete(key);try{localStorage.removeItem(key);}catch{}
}
export const questionCount=(n,lang)=>lang==='id'?n+' soal':n+(n===1?' question':' questions');
