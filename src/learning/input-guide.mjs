// Format examples describe a valid notation independently of the stored answer.
export function inputGuide(question, grade, locale = 'id') {
  const english = locale === 'en';
  const kinds = new Set();
  let negative = false;
  let division = false;
  function inspect(node) {
    if (!node) return;
    if (node.kind === 'binary') {
      if (node.operation === 'DIV') division = true;
      inspect(node.left);
      inspect(node.right);
      return;
    }
    kinds.add(node.display?.kind || 'integer');
    if (node.numerator.startsWith('-')) negative = true;
  }
  inspect(question?.expression_ast);
  const fractional = kinds.has('fraction') || (!kinds.has('decimal') && division && Number(grade) >= 5);
  const decimal = kinds.has('decimal');
  const type = fractional && decimal ? 'mixed' : fractional ? 'fraction' : decimal ? 'decimal' : 'integer';
  const instruction = english ? 'Work it out in your head. Enter your answer.' : 'Hitung dalam hati. Tulis jawabanmu.';
  let example;
  if (type === 'mixed') {
    example = english ? 'You can enter a fraction or a decimal, such as 1/2 or 0.5.' : 'Kamu boleh menulis pecahan atau desimal, misalnya 1/2 atau 0,5.';
  } else if (type === 'fraction') {
    example = english ? 'Use / for a fraction, such as 1/2.' : 'Gunakan / untuk pecahan, misalnya 1/2.';
  } else if (type === 'decimal') {
    example = english ? 'Use a point for a decimal, for example 0.5.' : 'Gunakan koma untuk desimal, misalnya 0,5.';
  } else if (negative || Number(grade) >= 7) {
    example = english ? 'Examples of integers are 4 and −3.' : 'Contoh bilangan bulat adalah 4 dan −3.';
  } else {
    example = english ? 'Use digits, for example 4.' : 'Gunakan angka, misalnya 4.';
  }
  // A format example must never accidentally equal the active answer.
  const value=question?.answer;
  if(value){
    const matches=(n,d=1n)=>BigInt(value.numerator)*d===BigInt(value.denominator)*BigInt(n);
    if((fractional||decimal)&&matches(1n,2n))example=example.replaceAll('1/2','3/4').replaceAll('0.5','0.75').replaceAll('0,5','0,75');
    if(type==='integer')example=example.replace(/4/g,matches(4n)?'8':'4').replaceAll('−3',matches(-3n)?'−7':'−3');
  }
  return { instruction, example, type };
}
