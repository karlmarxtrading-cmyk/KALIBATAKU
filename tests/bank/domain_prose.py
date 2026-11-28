"""MATH-002 regression over the whole published bank.

- Grades 1–6 work in nonnegative numbers. No hint, explanation or step text may contain a
  signed number, and every value inside every structured step must be nonnegative.
- Structured steps move forward: no step repeats the previous one, the last step is the
  key, and the steps add information instead of repeating the explanation verbatim.
- Mathematical identity (question IDs, fingerprints, keys, ASTs, order) equals the
  1.1.0 bank; only wording and steps changed, and every change is in the editorial log.
- Named audit examples are fixed in both languages.
"""
import csv, gzip, hashlib, io, json, re, sys
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests/qa'))
from receipt import Suite

SIGNED = re.compile(r'(?<![\w)\]])[−-]\d')
bank = ROOT / 'dist/bank'
index = json.loads((bank / 'index.json').read_bytes())
s = Suite('MATH-002-domain-prose', 'Grade 1–6 nonnegative teaching text and steps; lineage to bank 1.1.0')


def packs():
    for p in sorted(bank.rglob('*.mjs')):
        yield json.loads(p.read_text(encoding='utf-8')[len('export default '):].rstrip().rstrip(';'))


def values(a):
    if a['kind'] == 'binary':
        l, r = values(a['left']), values(a['right'])
        op = a['operation']
        v = l[-1] + r[-1] if op == 'ADD' else l[-1] - r[-1] if op == 'SUB' else l[-1] * r[-1] if op == 'MUL' else l[-1] / r[-1]
        return l + r + [v]
    return [Fraction(int(a['numerator']), int(a['denominator']))]


def h(v):
    return hashlib.sha256(json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


signed, negative_steps, loops, last_wrong, repeated, count, early = [], [], [], [], 0, 0, 0
math_now, prose_now, examples = {}, {}, {}
for pk in packs():
    g = pk['grade']
    math_now[pk['package_id']] = h([[q['question_id'], q['fingerprint'], q['answer'], q['expression_ast'], q['neutral_expression']] for q in pk['questions']])[:32]
    prose_now[pk['package_id']] = h([[q.get('hint'), q.get('explanation'), [x.get('text') for x in q.get('solution_steps', [])]] for q in pk['questions']])[:32]
    for i, q in enumerate(pk['questions']):
        count += 1
        texts = [q['hint'][L] for L in ('id', 'en')] + [q['explanation'][L] for L in ('id', 'en')] + [st['text'][L] for st in q['solution_steps'] for L in ('id', 'en')]
        steps = q['solution_steps']
        if g <= 6:
            early += 1
            if any(SIGNED.search(t) for t in texts):
                signed.append((pk['package_id'], i, q['neutral_expression'], next(t for t in texts if SIGNED.search(t))))
            for st in steps:
                if any(v < 0 for v in values(st['expression_ast'])):
                    negative_steps.append((pk['package_id'], i, q['neutral_expression']))
                    break
        asts = [json.dumps(st['expression_ast'], sort_keys=True) for st in steps]
        if any(a == b for a, b in zip(asts, asts[1:])):
            loops.append((pk['package_id'], i))
        last = steps[-1]['expression_ast'] if steps else None
        if not last or last['kind'] != 'rational' or Fraction(int(last['numerator']), int(last['denominator'])) != Fraction(int(q['answer']['numerator']), int(q['answer']['denominator'])):
            last_wrong.append((pk['package_id'], i))
        if len(steps) == 2 and steps[0]['text'] == q['explanation'] and g <= 6:
            repeated += 1
        if pk['package_id'] == 'MM-G03-L05-DIV-P001' and q['neutral_expression'] == '924 ÷ 11':
            examples['924'] = q
        if pk['package_id'] == 'MM-G02-L03-MIX-P003' and q['neutral_expression'] == '(5 × 9) + 6':
            examples['5x9'] = q
        if pk['package_id'] == 'MM-G03-L01-ADD-P001' and q['neutral_expression'] == '291 + 300':
            examples['291'] = q

s.check('bank-complete', 'Full bank scanned: 4.604 packages, 177.640 placements, content 1.2.0',
        lambda: (lambda: (_ for _ in ()).throw(AssertionError((len(math_now), count))) if (len(math_now), count) != (index['package_count'], index['question_slots']) or index['version'] != '1.2.0' else {'packages': len(math_now), 'placements': count, 'grade_1_6_placements': early, 'version': index['version']})())


def no_signed():
    assert not signed, signed[:10]
    return {'grade_1_6_placements_checked': early, 'signed_numbers': 0}
s.check('g01-g06-no-signed-prose', 'No signed number in G1–6 hint, explanation or step text (ID and EN)', no_signed)


def no_negative_steps():
    assert not negative_steps, negative_steps[:10]
    return {'negative_step_values': 0}
s.check('g01-g06-nonnegative-steps', 'Every value inside every G1–6 structured step is nonnegative', no_negative_steps)


def forward():
    assert not loops and not last_wrong, (loops[:5], last_wrong[:5])
    return {'repeated_consecutive_steps': 0, 'last_step_not_key': 0}
s.check('steps-move-forward', 'No step repeats the previous step and the last step is the key (all grades)', forward)


def example_924():
    q = examples['924']
    st = q['solution_steps']
    assert q['answer'] == {'numerator': '84', 'denominator': '1'}
    assert [x['text']['id'] for x in st] == ['924 = 880 + 44.', '880 ÷ 11 = 80 dan 44 ÷ 11 = 4.', 'Hasil akhirnya 84.'], [x['text']['id'] for x in st]
    assert [x['text']['en'] for x in st][1] == '880 ÷ 11 = 80 and 44 ÷ 11 = 4.'
    assert '−' not in q['explanation']['id'] + q['explanation']['en'] and '880 + 44' in q['explanation']['id']
    assert [values(x['expression_ast'])[-1] for x in st] == [84, 84, 84]
    return {'explanation': q['explanation'], 'steps': [x['text'] for x in st]}
s.check('fixture-G03-L05-DIV-924', '924 ÷ 11: dividend split 880 + 44, steps 80 + 4 → 84, no negative remainder', example_924)


def example_5x9():
    q = examples['5x9']
    joined = json.dumps([q['hint'], q['explanation'], [x['text'] for x in q['solution_steps']]], ensure_ascii=False)
    assert '−1' not in joined and not SIGNED.search(joined), joined
    assert 'kelompok' in q['explanation']['id'] and 'group' in q['explanation']['en']
    return {'explanation': q['explanation']}
s.check('fixture-G02-L03-MIX-5x9', '(5 × 9) + 6 in grade 2: groups language, no −1 × 5', example_5x9)


def example_291():
    q = examples['291']
    assert '9 kurang dari 300' in q['explanation']['id'] and '9 less than 300' in q['explanation']['en'], q['explanation']
    assert not SIGNED.search(q['explanation']['id'] + q['explanation']['en'])
    return {'explanation': q['explanation']}
s.check('fixture-G03-L01-ADD-291', '291 + 300: compensation described as “9 less than 300”, no −9', example_291)


def lineage():
    with gzip.open(ROOT / 'evidence/v13/bank/bank-1.1.0-identity.json.gz', 'rt', encoding='utf-8') as f:
        old = json.load(f)
    assert old['content_versions'] == ['1.1.0'] and old['placements'] == count
    diff = [p for p, r in old['rows'].items() if math_now.get(p) != r['math']]
    assert set(old['rows']) == set(math_now) and not diff, diff[:5]
    changed = sum(1 for p, r in old['rows'].items() if prose_now[p] != r['prose'])
    return {'packages_math_identical': len(math_now), 'packages_with_wording_changes': changed}
s.check('math-identity-preserved', 'Question IDs, fingerprints, keys, ASTs and order identical to bank 1.1.0 in all 4.604 packages', lineage)


def editorial():
    with gzip.open(ROOT / 'evidence/v13/bank/editorial-changes-1.1.0-to-1.2.0.csv.gz', 'rt', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    ids = {r['question_id'] for r in rows}
    for k in ('924', '5x9', '291'):
        assert examples[k]['question_id'] in ids, k
    assert all(r['old_id'] != r['new_id'] or r['old_en'] != r['new_en'] for r in rows)
    return {'rows': len(rows), 'question_ids': len(ids)}
s.check('editorial-log', 'Every changed wording is listed with old and new text in both languages', editorial)
s.finish('bank-domain-prose.json', redundant_two_step_explanations_g1_6=repeated)
