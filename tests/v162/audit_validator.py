"""Independent audit probes of actual QA runner/binding, inert synthetic inputs."""
import copy,json,sys,tempfile,shutil,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=Path(sys.argv[1]).resolve()
started=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
sys.path.insert(0,str(ROOT/'tools'));import qa_core as qa
records=[]
with tempfile.TemporaryDirectory(prefix='k161-audit-validator-') as folder:
    w=Path(folder);(w/'dist').mkdir()
    for n in ('offline-assets.json','build-info.json'):shutil.copyfile(ROOT/'dist'/n,w/'dist'/n)
    ident=qa.identity(w);rt={'python':sys.version.split()[0]}
    spec={'id':'auditor-independent','command':['{python}','producer.py'],'receipts':['receipt.json'],'min_assertions':1}
    (w/'producer.py').write_text("from pathlib import Path\nPath('receipt.json').write_bytes(Path('fixture.json').read_bytes())\n")
    reg={'suites':[spec]};rp=w/'registry.json';rp.write_text(json.dumps(reg));out=w/'qa'
    base={'schema':qa.SCHEMA,'suite':spec['id'],'status':'PASS','assertions':1,'checks':[{'id':'actual-check','status':'PASS'}],'build':ident,'errors':[]}
    cases=[('valid-control',{},'PASS'),('old-audit-string-null',{'checks':['not an assertion',None],'assertions':2},'FAIL'),
      ('pass-row-with-error',{'checks':[{'id':'actual-check','status':'PASS','error':'observed failure'}]},'FAIL'),
      ('pass-row-with-errors',{'checks':[{'id':'actual-check','status':'PASS','errors':['failure']}]},'FAIL'),
      ('both-row-containers',{'results':[{'id':'second','status':'PASS'}],'assertions':2},'FAIL'),
      ('number-count',{'assertions':1.0},'FAIL'),('negative-count',{'assertions':-1},'FAIL'),
      ('truthy-errors-object',{'errors':{'message':'observed failure'}},'FAIL'),
      ('empty-errors-object',{'errors':{}},'FAIL'),('hidden-page-error',{'page_errors':['exception']},'FAIL'),
      ('hidden-run-error',{'run_errors':['exception']},'FAIL'),
      ('mixed-pass-blocked',{'checks':[{'id':'ok','status':'PASS'},{'id':'blocked','status':'BLOCKED_ENV'}],'assertions':2},'FAIL'),
      ('wrong-runtime-type',{'runtime':['Linux']},'FAIL'),
      ('conflicting-release',{'release':'not-current'},'FAIL'),
      ('conflicting-runtime-release',{'runtime':{'release':'not-current'}},'FAIL'),
      ('wrong-app-version',{'build':{**ident,'app_version':'0.0.0'}},'FAIL'),
      ('wrong-bank-version',{'build':{**ident,'bank_version':'0.0.0'}},'FAIL'),
      ('wrong-dist-hash',{'build':{**ident,'dist_tree_sha256':'0'*64}},'FAIL'),
      ('status-as-list',{'status':['PASS']},'FAIL'),
      ('whitespace-duplicate-ids',{'checks':[{'id':'same','status':'PASS'},{'id':' same ','status':'PASS'}],'assertions':2},'FAIL')]
    for name,patch,expected in cases:
        body={**copy.deepcopy(base),**patch};(w/'fixture.json').write_text(json.dumps(body))
        run=qa.run_suite(spec,w,out,ident);binding=qa.write_binding(out,reg,[run],ident,rt,qa.sha256_file(rp))
        problems=qa.verify_binding(w,out,rp,rt=rt)
        good=run['status']==binding['status']==expected and bool(problems)==(expected=='FAIL')
        records.append({'id':name,'expected':expected,'runner_status':run['status'],'binding_status':binding['status'],'evaluated_assertions':run['assertions'],'verifier_problems':problems,'test_status':'PASS' if good else 'FAIL'})
    for name,raw in [('duplicate-json-field','{"schema":"'+qa.SCHEMA+'","status":"FAIL","status":"PASS"}'),('nonfinite-json','{"schema":"'+qa.SCHEMA+'","value":NaN}')]:
        (w/'fixture.json').write_text(raw);run=qa.run_suite(spec,w,out,ident);binding=qa.write_binding(out,reg,[run],ident,rt,qa.sha256_file(rp));problems=qa.verify_binding(w,out,rp,rt=rt)
        good=run['status']==binding['status']=='FAIL' and bool(problems)
        records.append({'id':name,'expected':'FAIL','runner_status':run['status'],'binding_status':binding['status'],'evaluated_assertions':run['assertions'],'verifier_problems':problems,'test_status':'PASS' if good else 'FAIL'})
    # A valid result does not certify an incomplete required suite registry.
    (w/'fixture.json').write_text(json.dumps(base));run=qa.run_suite(spec,w,out,ident)
    for name,suites,results,diag in [('duplicate-suite-result',[spec],[run,run],False),('missing-required-suite',[spec,{**spec,'id':'not-run'}],[run],False),('diagnostic-not-release',[spec],[run],True)]:
        reg={'suites':suites};rp.write_text(json.dumps(reg));binding=qa.write_binding(out,reg,results,ident,rt,qa.sha256_file(rp),diagnostic=diag);problems=qa.verify_binding(w,out,rp,rt=rt)
        good=bool(problems) and (diag or binding['status']=='FAIL')
        records.append({'id':name,'binding_status':binding['status'],'verifier_problems':problems,'test_status':'PASS' if good else 'FAIL'})
report={'scope':'Independent synthetic fixture probes of runner, binding writer and binding verifier; no human/device test claims','build':json.loads((ROOT/'dist/offline-assets.json').read_text())['release'],'cases':len(records),'pass':sum(r['test_status']=='PASS' for r in records),'fail':sum(r['test_status']=='FAIL' for r in records),'records':records}
OUT.parent.mkdir(parents=True,exist_ok=True)
checks=[{'id':r['id'],'status':r['test_status'],'expected':r.get('expected','Reject incomplete or diagnostic binding'),'actual':r} for r in records]
body={'schema':qa.SCHEMA,'suite':'audit-validator-25','scope':report['scope'],
      'started':started,'finished':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'build':qa.identity(ROOT),
      'status':'FAIL' if report['fail'] else 'PASS','assertions':len(checks),'checks':checks}
OUT.write_text(json.dumps(body,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(report['pass'],'of',len(records),'independent controls passed')
sys.exit(bool(report['fail']))
