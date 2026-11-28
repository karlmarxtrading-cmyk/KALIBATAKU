"""Index the actual paired questions for a human review and compare their mathematics with 1.0.0."""
import argparse
import csv
import hashlib
import json
import platform
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BANK = ROOT / 'dist' / 'bank'
OUTPUT = ROOT / 'evidence' / 'ux' / 'bank'
AUDIT_POSITIONS = {('MM-G02-L02-SUB-P001', 0), ('MM-G03-L03-MUL-P001', 0),
                   ('MM-G06-L04-MIX-P001', 0), ('MM-G09-L05-MIX-P001', 0),
                   ('MM-G12-L05-MIX-P019', 22)}
STABLE_FIELDS = ('question_id', 'fingerprint', 'fingerprint_policy', 'template_id', 'competency_id',
                 'question_type', 'expression_ast', 'neutral_expression', 'answer', 'answer_policy')

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def parse_module(raw):
    assert raw.startswith(b'export default ') and raw.endswith(b';\n')
    return json.loads(raw[15:-2])

def read_data(path):
    return json.loads(path.read_bytes())

def write_json(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')

def extent(node):
    if node['kind'] == 'rational':
        return Fraction(int(node['numerator']), int(node['denominator'])), []
    left, a = extent(node['left'])
    right, b = extent(node['right'])
    import operator
    fn = {'ADD':operator.add, 'SUB':operator.sub, 'MUL':operator.mul, 'DIV':operator.truediv}
    total = fn[node['operation']](left,right)
    return total, [left, right, total, *a, *b]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-zip', required=True, type=Path, help='Original release 1.0.0')
    args = parser.parse_args()
    baseline_file_hash = sha(args.baseline_zip.read_bytes())
    assert baseline_file_hash=='47594d89f492b440b365a080ba7654f136eef3bcd1537c5d241333c27f9cf3e9'
    inventory = read_data(ROOT/'evidence/bank/inventory.json')
    roster = defaultdict(dict)
    forms = defaultdict(list)
    competencies, totals, named = set(), Counter(), {}
    changes = Counter()
    with zipfile.ZipFile(args.baseline_zip) as baseline:
        members = {Path(n).name:n for n in baseline.namelist() if '/bank/v1/' in n and n.endswith('.mjs')}
        assert len(members)==len(inventory)==4604
        for meta in inventory:
            path=ROOT/'dist'/meta['url']
            raw=path.read_bytes()
            assert meta['bytes']==len(raw)==meta['uncompressed_bytes']
            assert sha(raw)==meta['sha256']
            pack=parse_module(raw)
            pid=pack['package_id']
            previous=parse_module(baseline.read(members[path.name]))
            assert pack['content_version']=='1.1.0' and previous['content_version']=='1.0.0'
            assert pack['instructions']!=previous['instructions']
            assert 'eksak' not in pack['instructions']['id']
            for key in ('package_id','grade','level','operation','target_competency_id','purpose','title','form_id','form_family_id','question_count','schema_version','curriculum_version'):
                assert pack[key]==previous[key], (pid,key)
            fingerprints=set()
            for idx,(q, old) in enumerate(zip(pack['questions'],previous['questions'],strict=True)):
                for key in STABLE_FIELDS:
                    assert q[key]==old[key], (pid,idx,key)
                assert q['question_revision']==q['template_version']==pack['content_version']
                assert q['fingerprint'] not in fingerprints
                fingerprints.add(q['fingerprint'])
                for field in ('hint','explanation','solution_steps','strategy_tags'):
                    changes[field]+=int(q[field]!=old[field])
                loc=(pid,idx)
                if loc in AUDIT_POSITIONS:
                    named[loc]={'package_id':pid,'index':idx,'question_id':q['question_id'],'expression':q['neutral_expression'],
                                'old_explanation':old['explanation'],'new_hint':q['hint'],'new_explanation':q['explanation'],
                                'new_steps':[s['text'] for s in q['solution_steps']]}
                family=roster[q['template_id']]
                if q['question_id'] not in family:
                    _, values=extent(q['expression_ast'])
                    span=(max(v.denominator for v in values),max(abs(v) for v in values),min(values))
                    length=sum(len(v) for v in q['explanation'].values())+sum(len(v) for s in q['solution_steps'] for v in s['text'].values())
                    family[q['question_id']]=(span,(len(q['solution_steps']),length),meta['url'],idx)
                competencies.add(q['competency_id'])
                totals['slots']+=1
                totals['revisioned_steps']+=len(q['solution_steps'])
                totals['legacy_steps']+=len(old['solution_steps'])
            if pack['form_id']:
                forms[pack['target_competency_id']].append((pid,fingerprints,meta['blueprint']))
    assert len(named)==5 and len(roster)==394 and len(competencies)==281
    assert totals['slots']==177640 and totals['legacy_steps']==356105
    coverage={c['competency_id']:c for c in read_data(ROOT/'evidence/bank/coverage.json')}
    pairs=[]
    for cid in sorted(forms):
        (a,fs_a,strata_a),(b,fs_b,strata_b)=sorted(forms[cid])
        same_blueprint=strata_a==strata_b
        overlap=len(fs_a & fs_b)
        c=coverage[cid]
        assert a==c['form_A'] and b==c['form_B'] and same_blueprint
        assert len(fs_a)==len(fs_b) and overlap==c['assessment_overlap']
        pairs.append({'competency_id':cid,'form_a':a,'form_b':b,'count_each':len(fs_a),'overlap':overlap,
                      'unique_across_forms':len(fs_a|fs_b),'pool_size':c['pool_size'],'matched_strata':len(strata_a)})
    assert len(pairs)==281
    OUTPUT.mkdir(parents=True, exist_ok=True)
    named_loc={r['question_id']:(r['package_id'],r['index']) for r in named.values()}
    url_by_pid={m['package_id']:m['url'] for m in inventory}
    rows=[]
    def append_row(tag,qid,url,ix):
        p=parse_module((ROOT/'dist'/url).read_bytes())
        q=p['questions'][ix]
        assert q['question_id']==qid
        rows.append(dict(template_id=q['template_id'],sample_role=tag,grade=p['grade'],competency_id=q['competency_id'],
                         question_id=qid,content_version=p['content_version'],package_url=url,question_index=ix,
                         expression=q['neutral_expression'],answer=q['answer']['numerator']+'/'+q['answer']['denominator'],
                         instruction_id=p['instructions']['id'],instruction_en=p['instructions']['en'],
                         hint_id=q['hint']['id'],hint_en=q['hint']['en'],explanation_id=q['explanation']['id'],explanation_en=q['explanation']['en'],
                         steps_id=' | '.join(s['text']['id'] for s in q['solution_steps']),steps_en=' | '.join(s['text']['en'] for s in q['solution_steps']),
                         reviewer_educator='',reviewer_language='',date_reviewed='',decision='NOT_RUN',comments='',revision_retest=''))
    for template, pool in sorted(roster.items()):
        remaining=dict(pool)
        # Typical is the median in the ordered boundary feature; boundary prioritises large denominator
        # and magnitude. The narrative role prioritises step count, then paired text length.
        order=sorted(remaining,key=lambda q:(remaining[q][0],q))
        chosen=[('typical',order[len(order)//2])]
        for kind,key in [('boundary',0),('long_worked_example',1)]:
            remaining.pop(chosen[-1][1])
            if not remaining: break
            chosen.append((kind,max(remaining,key=lambda q:(remaining[q][key],q))))
        included=set()
        for kind,qid in chosen:
            _,_,url,idx=pool[qid]
            if qid in named_loc:
                pid,idx=named_loc[qid]
                url=url_by_pid[pid]
                kind+='+audit_example'
            included.add(qid)
            append_row(kind,qid,url,idx)
        for qid in sorted((pool.keys() & named_loc.keys())-included):
            pid,idx=named_loc[qid]
            append_row('audit_example',qid,url_by_pid[pid],idx)
    assert set(competencies)=={r['competency_id'] for r in rows}
    assert len(set(r['template_id'] for r in rows))==394
    counts=Counter(r['template_id'] for r in rows)
    assert all(counts[k]>=min(3,len(pool)) for k,pool in roster.items())
    assert len(set(r['question_id'] for r in rows))==len(rows)
    with (OUTPUT/'editorial-roster.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,list(rows[0]));w.writeheader();w.writerows(rows)
    write_json(OUTPUT/'named-revisions.json',list(named.values()))
    write_json(OUTPUT/'assessment-pairs.json',pairs)
    bound=read_data(ROOT/'factory/bank-lock.json')
    report=dict(run_utc=datetime.now(timezone.utc).isoformat(),runner=platform.python_version(),bank_version='1.1.0',
                baseline_archive_sha256=baseline_file_hash,bank_hash=bound['bank'],factory_hash=bound['source'],
                status='PASS',package_comparisons=len(inventory),placement_comparisons=totals['slots'],
                preserved_question_fields=STABLE_FIELDS,comparison='Each old and new placement compared in order by package. All listed identities, authored ASTs/displays and exact keys matched.',
                changes_by_field=dict(changes),old_equivalent_steps=totals['legacy_steps'],new_equivalent_steps=totals['revisioned_steps'],
                matched_form_pairs=len(pairs),maximum_package_gzip_bytes=max(m['gzip_bytes'] for m in inventory),
                observed_templates=len(roster),active_competencies=len(competencies),review_rows=len(rows),roster_sha256=sha((OUTPUT/'editorial-roster.csv').read_bytes()),
                single_or_double_candidate_families={t:len(p) for t,p in roster.items() if len(p)<3},
                human_educator_review='NOT_RUN',human_language_review='NOT_RUN',learner_pilot='NOT_RUN',psychometric_equating='NOT_RUN')
    write_json(OUTPUT/'release-comparison.json',report)
    print(json.dumps(report,ensure_ascii=False))
if __name__ == '__main__':
    main()
