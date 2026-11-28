// Return the represented instant without rewriting the signed or archived string.
// NaN denotes a missing, ambiguous (no zone), or invalid date-time.
const isoInstant=/^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
export function epoch(value){
  if(typeof value!=='string')return NaN;
  const match=isoInstant.exec(value);
  if(!match)return NaN;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const lastDay=month===2?(leap?29:28):[4,6,9,11].includes(month)?30:31;
  return month>=1&&month<=12&&day>=1&&day<=lastDay?Date.parse(value):NaN;
}

export function compareInstants(a,b){
  const left=epoch(a),right=epoch(b);
  if(!Number.isFinite(left))return Number.isFinite(right)?-1:0;
  return Number.isFinite(right)?left-right:1;
}

export function utcTimestamp(value){
  const stamp=epoch(value);
  return Number.isFinite(stamp)?new Date(stamp).toISOString():'';
}
