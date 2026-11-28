"""Bank lineage between content versions (MATH-002).

  python3 tools/bank-lineage.py snapshot <bank_dir> <out.json.gz>
      Identity of every placement: package, position, question ID, fingerprint, key,
      SHA-256 of the canonical expression AST, and SHA-256 of each bilingual text field.
  python3 tools/bank-lineage.py editorial <old_bank_dir> <new_bank_dir> <out.csv.gz>
      One row per distinct question ID and text field whose wording changed, with the
      old and new text in both languages. Mathematical identity must be unchanged.
"""
import csv, gzip, hashlib, io, json, sys
from pathlib import Path

FIELDS = ('hint', 'explanation')


def packs(bank):
    for p in sorted(Path(bank).rglob('*.mjs'),key=lambda p:p.relative_to(bank).parts):
        text = p.read_text(encoding='utf-8')
        yield json.loads(text[len('export default '):].rstrip().rstrip(';'))


def h(v):
    return hashlib.sha256(json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def texts(q):
    out = {f: q.get(f) or {} for f in FIELDS}
    out['steps'] = [s.get('text') for s in q.get('solution_steps', [])]
    out['step_asts'] = [s.get('expression_ast') for s in q.get('solution_steps', [])]
    return out


def snapshot(bank):
    """Per package: digest of the ordered mathematical identity and of the wording."""
    rows, content, placements = {}, set(), 0
    for pk in packs(bank):
        content.add(pk['content_version'])
        math = [[q['question_id'], q['fingerprint'], q['answer'], q['expression_ast'], q['neutral_expression']] for q in pk['questions']]
        prose = [[q.get('hint'), q.get('explanation'), [s.get('text') for s in q.get('solution_steps', [])]] for q in pk['questions']]
        rows[pk['package_id']] = {'n': len(math), 'math': h(math)[:32], 'prose': h(prose)[:32]}
        placements += len(math)
    return {'algorithm': 'sha256(json sorted keys)[:32] of ordered [question_id,fingerprint,answer,expression_ast,neutral_expression]',
            'content_versions': sorted(content), 'packages': len(rows), 'placements': placements, 'rows': rows}


def main():
    cmd = sys.argv[1]
    if cmd == 'snapshot':
        data = snapshot(sys.argv[2])
        with gzip.open(sys.argv[3], 'wt', encoding='utf-8', compresslevel=9) as f:
            json.dump(data, f, separators=(',', ':'), sort_keys=True)
        print('snapshot', data['content_versions'], data['placements'])
    elif cmd == 'editorial':
        old = {q['question_id']: (pk['package_id'], pk['grade'], q) for pk in packs(sys.argv[2]) for q in pk['questions']}
        seen, rows = set(), []
        for pk in packs(sys.argv[3]):
            for q in pk['questions']:
                if q['question_id'] in seen:
                    continue
                seen.add(q['question_id'])
                _, grade, o = old[q['question_id']]
                assert (o['fingerprint'], o['answer'], h(o['expression_ast'])) == (q['fingerprint'], q['answer'], h(q['expression_ast'])), q['question_id']
                a, b = texts(o), texts(q)
                for field in ('hint', 'explanation', 'steps'):
                    if h(a[field]) != h(b[field]):
                        pick = (lambda t, L: ' | '.join((s or {}).get(L, '') for s in t)) if field == 'steps' else (lambda t, L: (t or {}).get(L, ''))
                        rows.append({'grade': grade, 'package_example': pk['package_id'], 'question_id': q['question_id'], 'expression': q['neutral_expression'],
                                     'field': field, 'old_id': pick(a[field], 'id'), 'new_id': pick(b[field], 'id'), 'old_en': pick(a[field], 'en'), 'new_en': pick(b[field], 'en'),
                                     'strategy_old': ' '.join(o.get('strategy_tags', [])), 'strategy_new': ' '.join(q.get('strategy_tags', [])),
                                     'change_reason': 'MATH-002 nonnegative magnitude wording / dividend decomposition; structured steps added'})
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=list(rows[0]) if rows else ['question_id']); w.writeheader(); w.writerows(rows)
        with gzip.open(sys.argv[4], 'wt', encoding='utf-8', compresslevel=9, newline='') as f:
            f.write(buf.getvalue())
        by = {}
        for r in rows:
            by.setdefault(str(r['grade']), set()).add(r['question_id'])
        print(json.dumps({'changed_rows': len(rows), 'changed_question_ids': len({r['question_id'] for r in rows}), 'by_grade': {k: len(v) for k, v in sorted(by.items(), key=lambda x: int(x[0]))}}))
    else:
        raise SystemExit(__doc__)


if __name__ == '__main__':
    main()
