"""Independent exact-arithmetic audit and reproducible evidence for the AI family review."""
import argparse
import ast
import json
import operator
import re
import sys
from collections import Counter, defaultdict
from fractions import Fraction
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests/qa'))
from receipt import Suite  # noqa: E402

REVIEW = json.loads(Path(__file__).with_name('family_review.json').read_text(encoding='utf-8'))
PATTERNS = {(id_text, en_text): ref for ref, id_text, en_text in REVIEW['language_pairs']}
NUM = re.compile(r'[−-]?[0-9]+(?:[.,][0-9]+)?')
MATH_LINE = re.compile(r'^[0-9−×÷⁄+()/*.,\s-]+$')
NORMALIZE = str.maketrans({'−': '-', '×': '*', '÷': '/', '⁄': '/', ',': '.'})
OPS = dict(ADD=operator.add, SUB=operator.sub, MUL=operator.mul, DIV=operator.truediv)
PARSE_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def frac(node):
    numerator, denominator = int(node['numerator']), int(node['denominator'])
    require(denominator > 0, 'nonpositive denominator')
    return Fraction(numerator, denominator)


def eval_tree(node, leaves=None, operations=None, branches=None):
    if node['kind'] == 'binary':
        op = node['operation']
        if operations is not None:
            operations.append(op)
        left = eval_tree(node['left'], leaves, operations, branches)
        right = eval_tree(node['right'], leaves, operations, branches)
        result = OPS[op](left, right)
        if branches is not None:
            branches.append((op, left, right, result))
        return result
    require(node['kind'] == 'rational', 'unknown AST kind')
    value = frac(node)
    display = node.get('display')
    if leaves is not None:
        require(display is not None, 'operand missing display')
        leaves.append((value, display['kind']))
    if display is not None:
        kind = display['kind']
        if kind == 'integer':
            require(value.denominator == 1, 'integer display cannot represent operand')
        elif kind == 'fraction':
            require(value == frac(display), 'fraction display differs from AST')
        else:
            places = display.get('decimal_places')
            require(kind == 'decimal' and type(places) is int and 0 <= places <= 30, 'invalid decimal display')
            require((value * 10 ** places).denominator == 1, 'decimal display rounds operand')
    return value


@lru_cache(maxsize=16384)
def printed_value(original):
    """A separate parser for the expression a learner reads. Decimal literals remain exact."""
    text = original.strip().translate(NORMALIZE)

    def visit(node):
        if isinstance(node, ast.BinOp):
            return PARSE_OPS[type(node.op)](visit(node.left), visit(node.right))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            value = visit(node.operand)
            return value if isinstance(node.op, ast.UAdd) else -value
        require(isinstance(node, ast.Constant) and type(node.value) in (int, float), 'invalid numeric text')
        return Fraction(text[node.col_offset:node.end_col_offset])

    return visit(ast.parse(text, mode='eval').body)


QUANTITY = re.compile(r'[−-]?[0-9]+(?:[.,][0-9]+)?(?:⁄[0-9]+)?')


def verify_roles(text, branches):
    """Bind numeric roles in worked strategies to actual, recursively evaluated local branches."""
    def quantities():
        return [printed_value(token) for token in QUANTITY.findall(text)]

    if text.startswith('Using ') and 'original operand differs' in text:
        anchor, intermediate, offset, adjust = quantities()
        for op, a, b, z in branches:
            if op == 'ADD' and (a, b) == (anchor + offset, intermediate - anchor):
                if z == intermediate + adjust:
                    return
            if op in ('ADD', 'SUB') and b == anchor + offset and OPS[op](a, anchor) == intermediate:
                if z == intermediate + adjust:
                    return
        raise ValueError('compensation numbers differ from actual operands')
    elif text.startswith('Temporarily replace '):
        original, _ = quantities()
        require(any((op == 'ADD' and original in (a, b)) or (op == 'SUB' and original == b)
                    for op, a, b, _ in branches), 'anchor hint replaces an unrelated operand')
    elif text.startswith('With denominator '):
        d, a, b, first, second, result, top, bottom = quantities()
        op = 'SUB' if ' − ' in text else 'ADD'
        require(d == bottom and result == top and d > 0 and (first, second) == (a, b)
                and OPS[op](a, b) == result and (op, a / d, b / d, result / d) in branches,
                'common-denominator prose differs from actual operands')
    elif 'After cross-cancelling common factors, compute ' in text:
        before, after = text.removeprefix('Start with ').split('. After cross-cancelling common factors, compute ')
        initial = printed_value(before)
        require(initial == printed_value(after.rstrip('.')) and any(z == initial for _, _, _, z in branches),
                'cross-cancellation differs from local expression')
    elif text.startswith('Start with ') and '. ' in text:
        prefix = text[len('Start with '):].split('. ', 1)[0]
        if MATH_LINE.fullmatch(prefix):
            require(any(z == printed_value(prefix) for _, _, _, z in branches), 'wrong local expression')
            verify_roles(text[len('Start with '):].split('. ', 1)[1], branches)
    elif text.startswith('Split the divisor '):
        divisor, factor, other = quantities()
        require(factor * other == divisor and any(op == 'DIV' and b == divisor for op, _, b, _ in branches),
                'incorrect divisor factorization')
    elif text.startswith('The reciprocal of '):
        divisor, reciprocal, dividend, multiplier = quantities()
        require(divisor * reciprocal == 1 and multiplier == reciprocal
                and ('DIV', dividend, divisor, dividend * reciprocal) in branches, 'incorrect reciprocal roles')


def text_pair(text, answer, branches=()):
    id_text, en_text = text['id'], text['en']
    pattern = (NUM.sub('{n}', id_text), NUM.sub('{n}', en_text))
    ref = PATTERNS.get(pattern)
    require(ref is not None, f'unreviewed ID/EN pair {pattern}')
    id_numbers = [n.translate(NORMALIZE) for n in NUM.findall(id_text)]
    en_numbers = [n.translate(NORMALIZE) for n in NUM.findall(en_text)]
    expected = id_numbers
    if pattern[0].startswith('Tambahkan {n} ke {n} untuk mencapai'):
        expected = [id_numbers[i] for i in (0, 1, 2, 4, 3)]
    elif pattern[0] == 'Penggandaan {n} sama dengan {n} + ({n}).':
        require(id_numbers[0] == id_numbers[1] == id_numbers[2], 'doubling used unequal terms')
        expected = id_numbers[:2]
    elif pattern[0].startswith('Dari {n} ke {n} perlu {n} langkah.'):
        require(id_numbers[1] == id_numbers[3], 'broken number-line bridge')
        expected = [id_numbers[i] for i in (2, 0, 1, 5, 4)]
    require(expected == en_numbers, f'mismatched number roles in {ref}')
    if en_text.startswith('The final value is '):
        require(printed_value(en_text[len('The final value is '):-1]) == answer, 'incorrect final prose')
    verify_roles(en_text, branches)
    # Pure arithmetic sentences often describe an intermediate subexpression.
    # Check equality locally, independently of the surrounding whole expression.
    for sentence in en_text.split('. '):
        pieces = sentence.removesuffix('.').split(' = ')
        if len(pieces) > 1 and all(MATH_LINE.fullmatch(part) for part in pieces):
            values = [printed_value(part) for part in pieces]
            require(len(set(values)) == 1, f'false displayed equality {sentence}')
    return ref


def inspect_question(q):
    leaves, operations, branches = [], [], []
    answer = eval_tree(q['expression_ast'], leaves, operations, branches)
    require(answer == frac(q['answer']), 'key disagrees with independent oracle')
    require(printed_value(q['neutral_expression']) == answer, 'printed expression disagrees with AST')
    require(q['question_id'] == q['competency_id'] + '.' + q['fingerprint'], 'question identity mismatch')
    steps = q['solution_steps']
    require(steps and steps[-1]['expression_ast']['kind'] == 'rational', 'missing worked result')
    patterns = {text_pair(q['hint'], answer, branches), text_pair(q['explanation'], answer, branches)}
    for step in steps:
        require(step['kind'] == 'equivalent_expression', 'unknown step kind')
        require(eval_tree(step['expression_ast']) == answer, 'step changes value')
        patterns.add(text_pair(step['text'], answer, branches))
    return answer, leaves, operations, patterns


def fresh_family():
    return {'placements': 0, 'steps': 0, 'patterns': set(), 'packages': set(), 'tags': Counter(),
            'domains': Counter(), 'operators': Counter(), 'step_lengths': Counter(), 'examples': {},
            'limits': {}, 'sample_read': False, 'errors': []}


def observe(family, package, q, slot):
    fid = q['template_id']
    reviewed = REVIEW['families'][fid]
    answer, leaves, operations, patterns = inspect_question(q)
    grade, level, op = package['grade'], package['level'], package['operation']
    prefix = f'MM-TPL-G{grade:02}-L{level:02}-{op}-'
    require(fid.startswith(prefix), 'family grade, operation or level mismatch')
    require(op == 'MIX' or operations == [op], 'simple family has different operations')
    tag_key = '+'.join(q['strategy_tags'])
    require(tag_key in reviewed['tags_reviewed'] and all(tag in REVIEW['strategy_observations']
            for tag in q['strategy_tags']), 'unexpected family strategy')
    if reviewed['package'] == package['package_id'] and reviewed['example_id'] == q['question_id']:
        require(q['neutral_expression'] == reviewed['expression'], 'reviewed example changed')
        family['sample_read'] = True
    family['patterns'].update(patterns)
    family['packages'].add(package['package_id'])
    family['tags'][tag_key] += 1
    family['domains'].update(kind for _, kind in leaves)
    family['operators'].update(operations)
    family['step_lengths'][len(q['solution_steps'])] += 1
    family['placements'] += 1
    family['steps'] += len(q['solution_steps'])
    leaf_values = [v for v, _ in leaves]
    measures = {'lowest_answer': (answer, min), 'highest_answer': (answer, max),
                'lowest_operand': (min(leaf_values), min), 'highest_operand': (max(leaf_values), max),
                'largest_denominator': (max(v.denominator for v in leaf_values), max),
                'most_operations': (len(operations), max)}
    for name, (value, extreme) in measures.items():
        previous = family['limits'].get(name)
        if previous is None or value != previous and extreme(value, previous) == value:
            family['limits'][name] = value
            family['examples'][name] = {'question_id': q['question_id'], 'package': package['package_id'],
                                        'position': slot, 'expression': q['neutral_expression'],
                                        'answer': str(answer), 'strategy': q['strategy_tags']}


def summary(fid, family):
    reviewed = REVIEW['families'][fid]
    require(not family['errors'], str(family['errors']))
    require(family['sample_read'], 'reviewed example absent')
    require(set(reviewed['tags_reviewed']) == set(family['tags']), 'strategy combination missing')
    require(set(reviewed['language_pairs_reviewed']) == family['patterns'], 'per-family reviewed ID/EN set changed')
    return {'grade_lens': REVIEW['grade_lenses'][str(int(fid[8:10]))],
            'reviewed_example': reviewed['example_id'], 'placements': family['placements'],
            'package_count': len(family['packages']), 'steps': family['steps'],
            'strategy_combinations': dict(family['tags']), 'operand_renderings': dict(family['domains']),
            'operator_uses': dict(family['operators']), 'solution_lengths': dict(family['step_lengths']),
            'observed_parameter_limits': {k: str(v) for k, v in family['limits'].items()},
            'boundary_examples': family['examples'], 'language_pair_refs': sorted(family['patterns'])}


def reject(fn):
    try:
        fn()
    except (ValueError, ZeroDivisionError, KeyError):
        return 'Rejected by independent verifier'
    raise AssertionError('Mutated fixture accepted')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    suite = Suite('family-oracle', 'AUTO-02 and AUTO-03: exact rational oracle, bilingual texts, boundaries and AI review')
    roster = defaultdict(fresh_family)
    paths = sorted((ROOT / 'dist/bank').rglob('*.mjs'))
    all_ids, all_patterns = set(), set()
    total = step_count = 0
    for path in paths:
        payload = path.read_bytes()
        require(payload.startswith(b'export default ') and payload.endswith(b';\n'), 'invalid module envelope')
        package = json.loads(payload[15:-2])
        for pos, q in enumerate(package['questions'], 1):
            fid = q['template_id']
            total += 1
            step_count += len(q['solution_steps'])
            all_ids.add(q['question_id'])
            family = roster[fid]
            try:
                observe(family, package, q, pos)
            except (ValueError, ZeroDivisionError, SyntaxError, KeyError) as err:
                if len(family['errors']) < 4:
                    family['errors'].append(f"{package['package_id']}:{pos} {err}")
    for fid in sorted(set(REVIEW['families']) | set(roster)):
        family = roster[fid]
        all_patterns.update(family['patterns'])
        suite.check(fid, 'All placements pass; authored family sample, strategy, and ID/EN references agree.',
                    lambda: summary(fid, family))
    totals = [len(paths), total, step_count, len(roster), len(all_patterns)]
    def coverage():
        require(totals == [4604, 177640, 389187, 394, len(PATTERNS)], str(totals))
        require(len(set(REVIEW['families'])) == 394, 'incomplete reviewed roster')
        return totals
    suite.check('corpus-and-reviewed-roster', [4604, 177640, 389187, 394, len(PATTERNS)], coverage)
    # Independent fixtures: corrupt a genuine question and verify that each mutation is rejected.
    raw = json.loads(paths[0].read_bytes()[15:-2])['questions'][0]
    from copy import deepcopy
    wrong = deepcopy(raw)
    wrong['answer']['numerator'] = str(int(wrong['answer']['numerator']) + 1)
    suite.check('reject-wrong-key', 'reject', lambda: reject(lambda: inspect_question(wrong)))
    wrong = deepcopy(raw)
    wrong['solution_steps'][-1]['expression_ast']['numerator'] = str(int(wrong['solution_steps'][-1]['expression_ast']['numerator']) + 1)
    suite.check('reject-wrong-solution-step', 'reject', lambda: reject(lambda: inspect_question(wrong)))
    leaf = {'kind': 'rational', 'numerator': '1', 'denominator': '2',
            'display': {'kind': 'fraction', 'numerator': '2', 'denominator': '3'}}
    suite.check('reject-mismatched-display', 'reject', lambda: reject(lambda: eval_tree(leaf)))
    bad_translation = {'id': 'Hasil akhirnya 4.', 'en': 'The final value is 5.'}
    suite.check('reject-mismatched-translation', 'reject', lambda: reject(lambda: text_pair(bad_translation, Fraction(4))))
    wrong_end = {'id': 'Hasil akhirnya 8.', 'en': 'The final value is 8.'}
    suite.check('reject-shared-bilingual-error', 'reject', lambda: reject(lambda: text_pair(wrong_end, Fraction(7))))
    # Both languages agree and all numbers are plausible, but belong to another expression.
    unrelated = {'id': 'Perhitungan dengan 10 memberi 12. Selisih antara operand asli dan patokan adalah 1. Koreksi hasil sebesar 1.',
                 'en': 'Using 10 gives 12. The original operand differs from the anchor by 1. Adjust the result by 1.'}
    suite.check('reject-foreign-compensation', 'reject',
                lambda: reject(lambda: text_pair(unrelated, Fraction(13), [('ADD', 5, 8, 13)])))
    # Absolute paths also work under the shared receipt writer; directory and filename are both preserved.
    suite.finish(str(args.out.resolve()), assessment=REVIEW['scope'], review_type=REVIEW['review_type'],
                 strategy_observations=REVIEW['strategy_observations'], editorial_observations=REVIEW['editorial_observations'],
                 language_pairs=REVIEW['language_pairs'], unique_question_ids=len(all_ids),
                 observed_dimensions=['packages','placements','solution_steps','families','reviewed_language_pairs'])


if __name__ == '__main__':
    main()
