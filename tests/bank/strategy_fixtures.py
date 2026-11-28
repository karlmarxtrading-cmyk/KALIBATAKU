"""Guard the editorial choices, whole-expression equivalence, and bilingual examples."""
import sys
from pathlib import Path
from fractions import Fraction
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'factory'))
from pedagogy import teach

def evaluate(node):
    if node['kind'] == 'rational':
        return Fraction(int(node['numerator']),int(node['denominator']))
    a, b = evaluate(node['left']), evaluate(node['right'])
    import operator
    return {'ADD': operator.add, 'SUB': operator.sub, 'MUL': operator.mul, 'DIV': operator.truediv}[node['operation']](a,b)

def run():
    cases=[
        (('SUB','98','89'), 2, 'BR', 9, ['dari 89 ke 90', 'from 89 to 90']),
        (('MUL','50','5'), 3, 'HL', 250, ['setengahnya', 'take half']),
        (('ADD',('DIV',('MUL','156','32'),'4'),'17.5'), 6, 'HD', Fraction(2531,2), ['salah satu faktor','one factor']),
        (('DIV',('ADD',('MUL','99','269'),'269'),'10'), 9, 'DS', 2690, ['kelompok','groups']),
        (('ADD',('MUL',('SUB',('DIV',('ADD',('MUL','9999','220'),'220'),'10'),'91'),'0.125'),'1/8'),12,'DS',Fraction(109955,4),['kelompok','groups'])]
    for tree, grade, tag, expected, keywords in cases:
        q=teach(tree,grade,1,tree[0])
        assert tag in q['strategy_tags'] and evaluate(q['expression_ast'])==expected
        assert all(evaluate(step['expression_ast'])==expected for step in q['solution_steps'])
        assert all(word in q['explanation'][lang].lower() for word,lang in zip(keywords,('id','en')))
        for i,step in enumerate(q['solution_steps']):
            assert all(step['text'][lang].strip() for lang in ('id','en'))
            if i: assert step['expression_ast']!=q['solution_steps'][i-1]['expression_ast']
        if tag=='DS':
            assert all(x not in q['explanation']['en'] for x in ('10001','101.'))
            assert '÷' in ''.join(s['text']['en'] for s in q['solution_steps']) or 'Divide' in ''.join(s['text']['en'] for s in q['solution_steps'])
    print(f'{len(cases)} named pedagogical cases have the expected routes, exact values, and bilingual text.')
if __name__=='__main__':run()
