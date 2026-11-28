#!/usr/bin/env python3
"""Read-only verification of the KALIBATAKU specification handoff, not the future app."""
from pathlib import Path
from fractions import Fraction
import argparse
import copy
import hashlib
import json
import math
import re
import subprocess
import sys

BASE=Path(__file__).resolve().parents[1]
checks=[]
errors=[]

def check(name,ok,detail=None):
    checks.append({'check':name,'status':'PASS' if ok else 'FAIL','detail':detail})
    if not ok:errors.append(name)

def unique_object(pairs):
    data={}
    for k,v in pairs:
        if k in data:raise ValueError('Duplicate JSON key: '+k)
        data[k]=v
    return data

def read(path):
    return json.loads((BASE/path).read_text(encoding='utf-8'),object_pairs_hook=unique_object)

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def value(node):
    if node['kind']=='rational':
        n,d=int(node['numerator']),int(node['denominator'])
        assert d>0 and math.gcd(abs(n),d)==1 and (n!=0 or d==1)
        v=Fraction(n,d)
        dis=node.get('display')
        if dis:
            if dis['kind']=='integer':assert d==1
            elif dis['kind']=='fraction':assert Fraction(int(dis['numerator']),int(dis['denominator']))==v
            elif dis['kind']=='decimal':assert (v*10**dis['decimal_places']).denominator==1
            else:raise ValueError('Unknown display')
        return v
    assert node['kind']=='binary'
    a,b=value(node['left']),value(node['right'])
    return {'ADD':lambda:a+b,'SUB':lambda:a-b,'MUL':lambda:a*b,'DIV':lambda:a/b}[node['operation']]()

def encode(node):
    if node['kind']=='rational':return 'R:'+node['numerator']+'/'+node['denominator']
    a,b=encode(node['left']),encode(node['right'])
    if node['operation'] in ('ADD','MUL'):a,b=sorted([a,b])
    return node['operation']+'('+a+','+b+')'

def semantic_package(pkg):
    assert pkg['question_count']==len(pkg['questions'])
    fps=[]
    for q in pkg['questions']:
        a=Fraction(int(q['answer']['numerator']),int(q['answer']['denominator']))
        assert value(q['expression_ast'])==a
        assert all(value(s['expression_ast'])==a for s in q['solution_steps'])
        fp=hashlib.sha256(encode(q['expression_ast']).encode('utf-8')).hexdigest()
        assert fp==q['fingerprint'];fps.append(fp)
    assert len(fps)==len(set(fps))

def semantic_event(e):
    x={k:v for k,v in e.items() if k!='payload_hash'}
    h=hashlib.sha256(json.dumps(x,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode('utf-8')).hexdigest()
    assert e['payload_hash']==h

def parse_fixture(s,locale):
    if len(s)>80:raise ValueError('length')
    s=s.strip().replace('−','-')
    if not s:raise ValueError('empty')
    if '/' in s:
        m=re.fullmatch(r'([+-]?[0-9]+)\s*/\s*([0-9]+)',s)
        if not m or int(m[2])==0:raise ValueError('fraction')
        return Fraction(int(m[1]),int(m[2]))
    sep=',' if locale=='id' else '.'
    if not re.fullmatch(r'[+-]?[0-9]+(?:'+re.escape(sep)+r'[0-9]+)?',s):raise ValueError('grammar')
    return Fraction(s.replace(',','.'))

def contrast(fg,bg):
    def luminance(h):
        vs=[int(h[i:i+2],16)/255 for i in (1,3,5)]
        lin=[v/12.92 if v<=0.04045 else ((v+.055)/1.055)**2.4 for v in vs]
        return sum(a*b for a,b in zip(lin,[.2126,.7152,.0722]))
    a,b=sorted([luminance(fg),luminance(bg)])
    return (b+.05)/(a+.05)

def rejected(name,func):
    try:func()
    except Exception:check(name,True)
    else:check(name,False)

def run(skip_hashes=False):
    try:
        from jsonschema import Draft202012Validator,FormatChecker
    except ImportError:
        raise RuntimeError('jsonschema unavailable: install qa/requirements.txt. Structural validation is NOT_RUN, not PASS.')

    for p in sorted(BASE.rglob('*.json')):
        read(p.relative_to(BASE))
    check('all_json_parse_without_duplicate_keys',True)
    prov=read('planning/source_provenance.json')
    check('original_source_bytes_preserved',all(digest(BASE/x['relative_path'])==x['sha256'] for x in prov['original_members_and_brief']))

    for patched,reg in [(False,'00_SUMBER/KALIBATAKU_CURRICULUM_REGISTRY_v1.json'),(True,'curriculum/KALIBATAKU_CURRICULUM_REGISTRY_v1_0_DRAFT2.json')]:
        cmd=[sys.executable,str(BASE/'qa/source_audit_verifier.py'),'--registry',str(BASE/reg)]
        if patched:cmd.append('--patched')
        proc=subprocess.run(cmd,capture_output=True,text=True,check=False)
        report=json.loads(proc.stdout)
        check('patched_source_audit' if patched else 'original_source_audit_with_known_findings',proc.returncode==0 and report['status']=='PASS',
              {'exact_answers':report['counts']['exact_answers_passed'],'known_findings':len(report['findings']),'scope':report['scope']})

    registry=read('curriculum/KALIBATAKU_CURRICULUM_REGISTRY_v1_0_DRAFT2.json')
    cells=[c for l in registry['levels'] for c in l['competencies']]
    lookup={c['competency_id']:c for c in cells}
    cp=read('planning/competency_plan.json')['cells']
    pp=read('planning/package_plan.json')['packages']
    check('competency_plan_300_cells_281_active_19_inactive',len(cp)==300 and sum(c['active'] for c in cp)==281 and len({c['competency_id'] for c in cp})==300)
    check('package_plan_4604_targets_177640_slots',len(pp)==4604 and sum(p['target_questions'] for p in pp)==177640)
    check('planned_packages_have_unique_ids',len({p['package_id'] for p in pp})==4604)
    for c in cp:
        packages=[p for p in pp if p['competency_id']==c['competency_id']]
        if c['active']:
            assert len(packages)==c['target_packages']
            assert sum(p['purpose']=='assessment' for p in packages)==2
            assert all(p['target_questions']==c['target_items_per_package'] for p in packages)
            assert c['source_rule']==lookup[c['competency_id']]['rule_spec']
        else:assert not packages
    check('every_planned_active_cell_has_correct_quota_and_two_assessment_forms',True)
    check('plans_not_misrepresented_as_runtime_bank',all(p['status']=='planned_content_not_generated' for p in pp))

    reqs=read('planning/requirements.json')['requirements']
    tests=read('qa/release_test_matrix.template.json')['tests']
    testids={t['test_id'] for t in tests}
    check('68_unique_requirements',len(reqs)==68 and {r['id'] for r in reqs}=={f'REQ-{i:03}' for i in range(1,69)})
    check('90_contiguous_test_cases_all_not_run',len(tests)==90 and testids=={f'TC-{i}' for i in range(100,190)} and all(t['status']=='NOT_RUN' for t in tests))
    check('requirements_resolve_docs_and_test_ids',all((BASE/r['definition_file']).is_file() and set(r['test_cases'])<=testids for r in reqs))
    decisions=read('planning/decision_log.json')['decisions']
    check('27_decisions_resolve_references',len(decisions)==27 and len({d['decision_id'] for d in decisions})==27 and all((BASE/ref).is_file() for d in decisions for ref in d['references']))
    qa_text=(BASE/'06_ACCEPTANCE_QA_DAN_RILIS.md').read_text()
    check('test_matrix_matches_document',all(t['test_id'] in qa_text and t['expected'] in qa_text for t in tests))

    schema=read('schemas/core.schema.json')
    Draft202012Validator.check_schema(schema)
    check('core_schema_meta_validation',True)
    def validator(name):return Draft202012Validator({'$schema':schema['$schema'],'$defs':schema['$defs'],'$ref':'#/$defs/'+name},format_checker=FormatChecker())
    example_types={'PACKAGE_CONTRACT_EXAMPLE.json':'Package','ANSWER_EVENT_EXAMPLE.json':'Event','MOCK_ACK_EXAMPLE.json':'BatchReceipt','REPORT_SNAPSHOT_EXAMPLE.json':'ReportSnapshot'}
    examples={}
    for f,t in example_types.items():
        data=read('examples/'+f);validator(t).validate(data);examples[t]=data
    check('four_contract_examples_structurally_valid',True)
    semantic_package(examples['Package']);semantic_event(examples['Event'])
    check('example_math_solution_fingerprint_event_hash',True)
    rc=examples['BatchReceipt'];ev=examples['Event']
    check('mock_receipt_matches_event_and_is_unverified',rc['attempt_id']==ev['attempt_id'] and rc['receipts'][0]['payload_hash']==ev['payload_hash'] and rc['receipts'][0]['event_id']==ev['event_id'] and rc['receipts'][0]['grading_state']=='unverified')
    text=(BASE/'examples/PACKAGE_CONTRACT_EXAMPLE.mjs').read_text()
    module=json.loads(text[text.index('export default ')+len('export default '):].strip().removesuffix(';'))
    check('esm_example_is_data_only_same_as_json',module==examples['Package'])

    bad=copy.deepcopy(examples['Package']);bad['questions'][0]['answer']['denominator']='0'
    rejected('negative_schema_zero_denominator',lambda:validator('Package').validate(bad))
    bad=copy.deepcopy(examples['Package']);del bad['title']['en']
    rejected('negative_schema_missing_language',lambda:validator('Package').validate(bad))
    bad=copy.deepcopy(examples['Package']);bad['questions'][0]['expression_ast']['operation']='POW'
    rejected('negative_schema_unknown_operation',lambda:validator('Package').validate(bad))
    bad=copy.deepcopy(examples['BatchReceipt']);bad['receipts'][0]['grading_state']='verified'
    rejected('negative_schema_mock_verified',lambda:validator('BatchReceipt').validate(bad))
    bad=copy.deepcopy(examples['ReportSnapshot']);bad['verification_status']='server_verified'
    rejected('negative_schema_demo_report_verified',lambda:validator('ReportSnapshot').validate(bad))
    bad=copy.deepcopy(examples['Package']);bad['question_count']=2
    rejected('negative_semantic_package_count',lambda:semantic_package(bad))
    bad=copy.deepcopy(examples['Event']);bad['payload']['answer']['numerator']='97'
    rejected('negative_semantic_mutated_event_hash',lambda:semantic_event(bad))
    bad=copy.deepcopy(examples['Package']);bad['questions'][0]['solution_steps'][0]['expression_ast']['left']['left']['numerator']='21'
    rejected('negative_semantic_wrong_solution_step',lambda:semantic_package(bad))

    cases=read('qa/answer_cases.json')['cases']
    for c in cases:
        try:v=parse_fixture(c['input'],c['locale'])
        except ValueError:
            assert c['expected_status']=='format_error',c['case_id']
        else:
            assert c['expected_status']=='valid',c['case_id']
            assert v==Fraction(int(c['expected_canonical']['numerator']),int(c['expected_canonical']['denominator'])),c['case_id']
    check('46_answer_fixture_values_and_grammar_consistent',len(cases)==46,'Validates fixtures only; does not test a future JavaScript parser or its error-code precedence.')
    analytics=read('qa/analytics_cases.json')['cases']
    for c in analytics:
        if {'N','C','W','S','B','U'}<=set(c):
            assert c['N']==sum(c[k] for k in ['C','W','S','B','U'])
            assert Fraction(100*c['C'],c['N'])==c['score_percent']
            assert format(100*c['C']/(c['C']+c['W']),'.1f')==c['accuracy_display_one_decimal']
            assert Fraction(100*(c['C']+c['W']+c['S']),c['N'])==c['responded_percent']
    assert format(100*59/110,'.1f')=='53.6' and 86-58==28
    check('analytics_numeric_fixture_arithmetic',True)
    pol=read('planning/mastery_policy.json')
    check('mastery_policy_has_cycle_and_explicit_eligibility',pol['assessment_cycle_max_age_days']==60 and pol['default_min_spacing_hours']==24 and 'unseen' in pol['noncorrect_evidence_outcomes'] and pol['per_competency_slice'])

    tok=read('ui/design-tokens.json');contrast_report=read('ui/CONTRAST_REPORT.json');micro=read('ui/MICROCOPY_ID_EN.json')
    ux=BASE/'01_ARAHAN_UI_UX.md'
    check('ui_artifacts_match_ux_source_hash',all(x['source_sha256']==digest(ux) for x in [tok,contrast_report,micro]))
    ratios=[]
    for c in contrast_report['checks']:
        color=tok['color'][c['theme']]
        assert c['foreground_hex']==color[c['foreground_token']] and c['background_hex']==color[c['background_token']]
        ratio=contrast(c['foreground_hex'],c['background_hex']);ratios.append(ratio)
        assert abs(ratio-c['contrast_ratio'])<1e-7 and ratio>=c['minimum_ratio'] and c['passed']
    check('18_theme_contrast_pairs_recalculated',len(ratios)==18,{'minimum_text_ratio':min(c['contrast_ratio'] for c in contrast_report['checks'] if c['usage']=='text')})
    check('23_bilingual_microcopy_pairs',len(micro['messages'])==23 and all(x['id'] and x['en'] for x in micro['messages'].values()))
    uxids=set(re.findall(r'UX-\d{2}',ux.read_text()))
    check('18_screens_present',uxids=={f'UX-{i:02}' for i in range(1,19)})

    rschema=read('schemas/release-status.schema.json')
    Draft202012Validator.check_schema(rschema)
    Draft202012Validator(rschema).validate(read('qa/RELEASE_STATUS.template.json'))
    check('release_status_schema_and_template',True)
    bad=read('qa/RELEASE_STATUS.template.json');bad['readiness']['static_application']['status']='PASS'
    rejected('negative_release_pass_without_evidence',lambda:Draft202012Validator(rschema).validate(bad))
    bad=read('qa/RELEASE_STATUS.template.json');bad['artifact_status']='release_verdict'
    rejected('negative_release_verdict_without_release_id',lambda:Draft202012Validator(rschema).validate(bad))

    for p in BASE.glob('*.md'):
        fences=[l for l in p.read_text().splitlines() if l.startswith('```')]
        assert len(fences)%2==0,p.name
    check('main_markdown_fences_balanced',True)
    if skip_hashes:
        checks.append({'check':'manifest_file_hashes','status':'NOT_RUN','detail':'--skip-hashes requested during assembly'})
    else:
        manifest=read('SHA256SUMS.json')
        entries=manifest['files']
        files={p.relative_to(BASE).as_posix() for p in BASE.rglob('*') if p.is_file() and p.name!='SHA256SUMS.json' and '__pycache__' not in p.parts}
        check('manifest_covers_all_files',files=={x['path'] for x in entries})
        check('manifest_file_hashes',all((BASE/x['path']).stat().st_size==x['bytes'] and digest(BASE/x['path'])==x['sha256'] for x in entries))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skip-hashes',action='store_true')
    args=parser.parse_args()
    try:run(args.skip_hashes)
    except Exception as exc:
        errors.append(type(exc).__name__+': '+str(exc))
    result={'status':'PASS' if not errors else 'FAIL','scope':'specification_handoff_only_not_website_or_production_bank',
            'checks':checks,'errors':errors,'future_website_tests_status':'NOT_RUN',
            'limitations':['All 281 editorial rule predicates are not implemented here.','No website, mass question bank, real LMS, deployment or pedagogical pilot is certified by this check.']}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    sys.exit(1 if errors else 0)
