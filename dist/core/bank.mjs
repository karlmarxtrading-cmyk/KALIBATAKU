const catalogue = new Map();
export function safeBankURL(path) {
  const base = new URL('./',document.baseURI);
  const url = new URL(path,base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname+'bank/')) throw new Error('BANK_PATH');
  return url;
}
export async function readShard(path,signal) {
  const url=safeBankURL(path);
  if (catalogue.has(url.href)) return catalogue.get(url.href);
  const response=await fetch(url,{signal});
  if (!response.ok) throw new Error('BANK_'+response.status);
  const data=await response.json();catalogue.set(url.href,data);return data;
}
export const rootShard=signal=>readShard('bank/index.json',signal);
export async function selection(ctx,prefs={}) {
  const result={};
  const root=await rootShard(ctx.signal);
  result.root=root;
  const chosen=Number(ctx.params.get('grade') || prefs.grade || 1);
  result.gradeMeta=root.grades.find(g=>Number(g.grade)===chosen);
  if (!result.gradeMeta) throw new Error('SELECTION');
  result.grade=Number(result.gradeMeta.grade);
  result.gradeData=await readShard(result.gradeMeta.url,ctx.signal);
  const level=Number(ctx.params.get('level') || prefs.level || 1);
  result.levelMeta=result.gradeData.levels.find(item=>Number(item.level)===level);
  if (!result.levelMeta) throw new Error('SELECTION');
  result.level=Number(result.levelMeta.level);
  result.levelData=await readShard(result.levelMeta.url,ctx.signal);
  const active=result.levelData.competencies.filter(c=>c.active);
  const requested=ctx.params.get('op') || prefs.op;
  const match=active.find(c=>c.operation===requested);
  if(ctx.params.has('op')&&!match)throw new Error('SELECTION');
  result.comp=match||active[0];
  if (!result.comp) throw new Error('NO_CONTENT');
  const requestedPack=ctx.params.get('pack');
  result.entry=requestedPack?result.comp.packages.find(p=>p.package_id===requestedPack):result.comp.packages[0];
  if (!result.entry) throw new Error('SELECTION');
  return result;
}
export const symbols={ADD:'+',SUB:'−',MUL:'×',DIV:'÷',MIX:'±'};
export const bands=[{id:'sd',from:1,to:6,label:'primarySchool',css:'primary-school'},{id:'smp',from:7,to:9,label:'middleSchool',css:'middle'},{id:'sma',from:10,to:12,label:'upperSchool',css:'upper'}];
export const tr=(field,lang)=>typeof field==='string'?field:(field?.[lang]??field?.id??field?.en??'');
export function groupPath(ctx,sel,path='packs',extra={}) {
  const params=new URLSearchParams({grade:sel.grade,level:sel.level,op:sel.comp.operation,...extra});
  if(ctx.params?.get('source')==='demo')params.set('source','demo');
  return path+'?'+params;
}
