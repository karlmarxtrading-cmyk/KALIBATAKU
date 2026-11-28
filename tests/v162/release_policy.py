"""Regression controls for automatic release decisions. Fixtures never certify an artifact."""
from copy import deepcopy
import json
from pathlib import Path
import shutil
import sys
import tempfile

import jsonschema

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import auto_release as release
import qa_core as qa


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    print('PASS ' + name)


def rejects(name, callback):
    try:
        callback()
    except (ValueError, OSError, jsonschema.ValidationError):
        print('PASS ' + name)
        return
    raise AssertionError(name)


def write(path, document):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def test_scope():
    profile, mapping, registry = release.contract(ROOT)
    gates = {g['id'] for g in profile['gates']}
    history = ROOT / release.HISTORY
    check('26 unique gates in the authorized contract', len(gates) == 26)
    check('23 package gates required independently of post-release access',
          [g['id'] for g in profile['gates'] if g['applicability']=='REQUIRED'] == release.PACKAGE_IDS)
    check('all 27 historical non-PASS rows preserved',
          len(mapping['rows']) == 27 and all(r['historical_evidence_status'] in ('BLOCKED','NOT_RUN') for r in mapping['rows']))
    snap = release.read(history / 'binding-1.6.1.json')
    check('prior execution is archived under its own version and hash',
          snap['build']['app_version']=='1.6.1' and len(snap['suites'])==94 and snap['assertions']==2325)
    for title, mutate in [
            ('historical evidence relabeled PASS', lambda m: m['rows'][0].update(historical_evidence_status='PASS')),
            ('required historical row missing', lambda m: m['rows'].pop()),
            ('duplicate cross-register identity', lambda m: m['rows'].append(m['rows'][0])),
            ('scope waiver without a replacement', lambda m: m['rows'][0].update(replacement_gates=[])),
            ('unknown replacement cannot authorize release', lambda m: m['rows'][0].update(replacement_gates=['AUTO-99']))]:
        altered = deepcopy(mapping)
        mutate(altered)
        rejects(title, lambda: release.validate_mapping(altered, history, gates))
    prior = release.read(history / 'suites.json')
    for title, mutate in [
            ('dropped regression suite', lambda r: r['suites'].pop(0)),
            ('duplicate registry identity', lambda r: r['suites'].append(r['suites'][0])),
            ('optionalized registered test', lambda r: r['suites'][0].update(required=False)),
            ('weakened original assertion threshold', lambda r: r['suites'][0].update(min_assertions=0)),
            ('altered original command', lambda r: r['suites'][0].update(command=['unused']))]:
        altered = deepcopy(registry)
        mutate(altered)
        rejects(title, lambda: release.validate_registry(profile, altered, prior))
    with tempfile.TemporaryDirectory() as td:
        checkout = Path(td)
        shutil.copytree(ROOT / release.CONTRACT, checkout / release.CONTRACT)
        path = checkout / release.CONTRACT / 'profile.json'
        for title, mutate in [('unknown profile ID',lambda p: p.update(profile_id='ANOTHER')),
                              ('attempt to waive correctness',lambda p:p['gates'][1].update(applicability='OPTIONAL_COMPATIBILITY'))]:
            altered=deepcopy(profile)
            mutate(altered)
            write(path,altered)
            rejects(title, lambda:release.contract(checkout))
        shutil.copyfile(ROOT / release.CONTRACT / 'profile.json',path)
        shutil.copytree(history,checkout / release.HISTORY)
        for path in history.glob('REGISTER_*.csv'):
            shutil.copyfile(path, checkout / path.name)
        path=checkout / release.HISTORY / 'REGISTER_AC_FINAL.csv'
        path.write_bytes(path.read_bytes()+b'\n')
        rejects('modified immutable snapshot',lambda:release.contract(checkout))
        write(checkout / release.CONTRACT / 'findings.json', {
            'schema':'kalibataku-technical-findings/1','findings':[
                {'id':'NEGATIVE','severity':'HIGH','status':'OPEN','evidence':'finding.txt'}]})
        (checkout/'finding.txt').write_text('fictional negative control')
        check('open technical finding blocks package', bool(release.open_findings(checkout)))
    rows = [{**g,'status':('PASS' if g['phase']=='PACKAGE' else 'NOT_RUN')} for g in profile['gates']]
    check('missing human field and domain results do not hold a complete package', release.package_ready(rows,[]))
    scope = release.hosting_states(rows,True)
    check('local hosting PASS leaves deployment and provider preview untested',
          scope == {'local_hosting':'PASS','deployment_status':'NOT_DEPLOYED','provider_preview':'NOT_DEPLOYED'})
    live_rows = [{**r,'status':'PASS'} if r['id']=='AUTO-24' else r for r in rows]
    check('verified custom domain does not certify a provider preview',
          release.hosting_states(live_rows,True,'https://school.example')['provider_preview']=='PENDING_ACCESS')
    check('verified provider URL only qualifies after artifact and domain checks',
          release.hosting_states(live_rows,True,'https://preview.project.pages.dev')['provider_preview']=='PASS'
          and release.hosting_states(live_rows,False,'https://preview.project.pages.dev')['provider_preview']!='PASS')
    check('one unresolved issue prevents readiness',not release.package_ready(rows,['OPEN HIGH fixture']))
    for state in ('FAIL','BLOCKED','BLOCKED_ENV','NOT_RUN'):
        check('mandatory gate '+state+' prevents readiness',not release.package_ready([{**rows[0],'status':state},*rows[1:]],[]))
    check('absent gate prevents readiness',not release.package_ready(rows[1:],[]))
    check('duplicate gate prevents readiness',not release.package_ready([rows[1],*rows[1:]],[]))
    check('deleted required applicability prevents readiness',
          not release.package_ready([{**rows[0],'applicability':'OPTIONAL_COMPATIBILITY'},*rows[1:]],[]))
    check('untested replacement gate stays NOT_RUN',release.suite_gate(['new'],{},[])[0]=='NOT_RUN')
    check('attempted PASS with invalid binding fails',
          release.suite_gate(['x'],{'x':{'status':'PASS','assertions':1}},['stale'])[0]=='FAIL')
    check('environment block remains visible',
          release.suite_gate(['x'],{'x':{'status':'BLOCKED_ENV','assertions':1}},[])[0]=='BLOCKED')
    schema=release.read(ROOT / release.CONTRACT / 'profile.schema.json')
    rejects('malformed gate suites schema',lambda:jsonschema.validate({**profile,'gates':[{'id':'AUTO-01'}]*26},schema))


def test_binding(root):
    # A miniature checkout exercises the production read/write pipeline using its own
    # identity. It uses a single diagnostic control process and never enters package evidence.
    for name in ('package.json','package-lock.json','requirements-qa.txt','.python-version','.nvmrc','.gitattributes'):
        (root/name).write_text('{}\n',encoding='utf-8')
    shutil.copytree(ROOT / release.CONTRACT, root / release.CONTRACT)
    write(root/'dist/offline-assets.json',{'release':'NEGATIVE-CONTROL'})
    write(root/'dist/build-info.json',{'app_version':'1.6.2','bank_version':'fixture'})
    spec={'id':'case','command':['{python}','-c','print("PASS condition")'],'count_pattern':'^PASS ','min_assertions':1}
    registry={'suites':[spec]}
    registry_path=root/release.REGISTRY
    write(registry_path,registry)
    out=root/'evidence/fixture'
    identity=qa.identity(root)
    suite=qa.run_suite(spec,root,out,identity)
    rt={'python':'fixture','node':'fixture','os':'fixture'}
    initial=qa.write_binding(out,registry,[suite],identity,rt,qa.sha256_file(registry_path),policy=qa.policy_identity(root))
    def errors():
        return qa.verify_binding(root,out,registry_path,rt=rt)
    check('fixture production binding rechecks policy, registry, timestamp and actual command log',errors()==[])
    for name, mutate in [
            ('diagnostic binding refused',lambda b:b.update(diagnostic=True)),
            ('unrecognized profile in receipt refused',lambda b:b['release_policy'].update(profile_id='ALTERNATE')),
            ('modified profile hash refused',lambda b:b['release_policy'].update(profile_sha256='0'*64)),
            ('modified mapping hash refused',lambda b:b['release_policy'].update(mapping_sha256='0'*64)),
            ('modified registry hash refused',lambda b:b.update(registry_sha256='0'*64)),
            ('modified history hash refused',lambda b:b['release_policy'].update(history_index_sha256='0'*64)),
            ('missing overall run time refused',lambda b:b.pop('created_utc')),
            ('missing suite time refused',lambda b:b['suites'][0].pop('started_utc')),
            ('contradictory PASS with recorded errors refused',lambda b:b['suites'][0].update(problems=['broken'])),
            ('stale build identity refused',lambda b:b['build'].update(offline_release='older'))]:
        modified=deepcopy(initial)
        mutate(modified)
        write(out/'binding.json',modified)
        check(name,bool(errors()))
    write(out/'binding.json',initial)
    (out/'case/log.txt').write_text('unregistered observation\n')
    check('post-run mutation of proof refused',bool(errors()))


if __name__=='__main__':
    test_scope()
    with tempfile.TemporaryDirectory() as directory:
        test_binding(Path(directory))
