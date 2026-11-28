// All public rationals are serializable. BigInts remain inside exact arithmetic.
export function rational(n, d = 1n) {
  let a = BigInt(n), b = BigInt(d);
  if (b === 0n) throw new RangeError('ZERO_DENOMINATOR');
  if (b < 0n) { a = -a; b = -b; }
  let x = a < 0n ? -a : a, y = b;
  while (y) [x, y] = [y, x % y];
  return {numerator: String(a / x), denominator: String(b / x)};
}
export function equal(a,b) {
  return !!a && !!b && BigInt(a.numerator)*BigInt(b.denominator) === BigInt(b.numerator)*BigInt(a.denominator);
}
export function solve(node, depth = 0) {
  if (depth > 24 || !node || typeof node !== 'object') throw new Error('INVALID_AST');
  if (node.kind === 'rational') {
    if (!/^-?\d{1,80}$/.test(node.numerator) || !/^[1-9]\d{0,79}$/.test(node.denominator)) throw new Error('INVALID_AST');
    return rational(node.numerator,node.denominator);
  }
  if (node.kind !== 'binary') throw new Error('INVALID_AST');
  const l=solve(node.left,depth+1), r=solve(node.right,depth+1);
  const a=BigInt(l.numerator), b=BigInt(l.denominator), c=BigInt(r.numerator), d=BigInt(r.denominator);
  switch(node.operation) {
    case 'ADD': return rational(a*d+b*c,b*d);
    case 'SUB': return rational(a*d-b*c,b*d);
    case 'MUL': return rational(a*c,b*d);
    case 'DIV': return rational(a*d,b*c);
    default: throw new Error('INVALID_AST');
  }
}
const error = code => ({status:'format_error',error:code});
export function parseAnswer(raw, locale) {
  if (typeof raw !== 'string' || !['en','id'].includes(locale)) return error('INVALID_NUMBER');
  if (raw.length > 80) return error('INPUT_TOO_LONG');
  const s = raw.trim().replaceAll('−','-').replaceAll('⁄','/');
  const separator = locale === 'en' ? '.' : ',';
  if (!s) return error('EMPTY');
  if (/[<>]/.test(s)) return error('INVALID_NUMBER');
  if (/^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i.test(s)) return error('SCIENTIFIC_NOTATION_NOT_ALLOWED');
  if (/\d\s+\d/.test(s)) return error('GROUPING_NOT_ALLOWED');
  if (/^[+-]$/.test(s) || (/^[+-]?\d+\s*\/$/.test(s)) || (s.endsWith(separator) && /^[+-]?\d+[.,]$/.test(s))) return error('INCOMPLETE');
  let result;
  if (s.includes('/')) {
    if (/^[+-]?\d+\s*\/\s*-\d+$/.test(s)) return error('DENOMINATOR_MUST_BE_POSITIVE');
    const m = s.match(/^([+-]?\d+)\s*\/\s*(\d+)$/);
    if (!m) return error('INVALID_FRACTION');
    if (BigInt(m[2]) === 0n) return error('ZERO_DENOMINATOR');
    result=rational(m[1],m[2]);
  } else {
    if (/\d\s*[-+*×÷^]/.test(s) || /[()]/.test(s)) return error('FORMULA_NOT_ALLOWED');
    if (s.includes(locale === 'en' ? ',' : '.')) return error('WRONG_DECIMAL_SEPARATOR');
    if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(s)) return error('INVALID_NUMBER');
    const [i, f=''] = s.split(separator);
    result = rational(i+f,10n**BigInt(f.length));
  }
  return {status:'valid',value:result};
}
export function formatExact(value,locale,style='fraction') {
  const r=rational(value.numerator,value.denominator);
  if (r.denominator === '1') return r.numerator;
  const n=BigInt(r.numerator), d=BigInt(r.denominator);
  if (style==='decimal') {
    let x=d, twos=0, fives=0;
    while (x%2n===0n) { x/=2n; twos++; }
    while (x%5n===0n) { x/=5n; fives++; }
    if (x===1n) {
      const places=Math.max(twos,fives), scaled=(n<0n?-n:n)*10n**BigInt(places)/d;
      const digits=String(scaled).padStart(places+1,'0');
      return (n<0n?'-':'')+digits.slice(0,-places)+(locale==='en'?'.':',')+digits.slice(-places);
    }
  }
  return r.numerator+'/'+r.denominator;
}
export function localizeDraft(item, locale) {
  const parsed = parseAnswer(item.draft, item.draft_locale);
  if (!item.draft.trim()) item.draft_locale=locale;
  if (parsed.status==='valid') {
    item.draft=item.draft.replace(/[.,]/,locale==='id'?',':'.');
    item.draft_locale=locale;
  }
}
export function renderExpression(q, lang) {
  const exp=q.neutral_expression || '';
  return lang==='id'?exp.replace(/(\d)\.(?=\d)/g,'$1,'):exp;
}
export function speakExpression(q,lang) {
  const op = lang==='id' ? {'+':' tambah ','−':' minus ','-':' minus ','×':' kali ','÷':' dibagi ','⁄':' per ','/':' per ','(':' buka kurung ',')':' tutup kurung '} : {'+':' plus ','−':' minus ','-':' minus ','×':' times ','÷':' divided by ','⁄':' over ','/':' over ','(':' open parenthesis ',')':' close parenthesis '};
  return renderExpression(q,lang).replace(/[+−\-×÷⁄/()]/g,x=>op[x]);
}
