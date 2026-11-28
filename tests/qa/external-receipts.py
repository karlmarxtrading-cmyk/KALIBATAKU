"""Test-only Ed25519 signers and synthetic observations, isolated from all release receipt paths."""
import base64
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from io import BytesIO
from zipfile import ZipFile, ZipInfo
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory

SITE=Path(__file__).resolve().parents[2];sys.path.insert(0,str(SITE/'tools'))
import external_receipts as loader
from external_cases import ACTORS, GATES, ROSTER, cases

BUILD={'app_version':'1.5.1','bank_version':'1.2.0','offline_release':'1'*16,'source_tree_sha256':'2'*64,'dist_tree_sha256':'3'*64}
TARGET='https://authorized-school.edu'
UTC=['2020-01-01T01:00:00Z','2020-01-01T02:00:00Z','2020-01-01T03:00:00Z']


def dump(path,data):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')


class Fixture:
    def __init__(self,root):
        self.root=root;self.num=0;self.proofs={}
        for alias in ('operator','reviewer'):
            key=root/(alias+'.pem')
            pub=subprocess.check_output(['node',str(loader.SIGNER),'keygen',str(key)],text=True).strip()
            self.proofs[alias]={'public_key':pub,'roles':sorted({pair[0 if alias=='operator' else 1] for pair in ACTORS.values()}),
                                'criteria':list(GATES),'grades':list(range(1,13))}
        self.trust={'schema':'kalibataku-external-trust/1','actors':self.proofs,
                    'targets':[{'origin':TARGET,'deployment_ids':['prior','current','rollback']}]}
        dump(root/loader.TRUST,self.trust)
        (root/ROSTER).parent.mkdir(parents=True);shutil.copyfile(SITE/ROSTER,root/ROSTER)
        self.art=root/loader.ARTIFACTS;self.art.mkdir(parents=True)
        docs=[]
        for name in ('one.docx','two.docx'):
            h=self.artifact(name,'docx')['sha256']
            docs.append({'rows':[{'reference':'test-only'}],'files':[{'name':name,'sha256':h}]})
        dump(root/'VALIDASI_EKSTERNAL/word/rujukan.json',{'offline_release':BUILD['offline_release'],'documents':docs})

    def artifact(self,name,kind):
        data=('test-only synthetic artifact '+name).encode()
        mime='text/plain'
        if kind=='docx':
            blob=BytesIO()
            with ZipFile(blob,'w') as z:z.writestr(ZipInfo('word/document.xml'),'<test-only>'+name+'</test-only>')
            data=blob.getvalue();mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        elif kind in ('word-render','device-recording'):
            data=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=');mime='image/png'
        (self.art/name).write_bytes(data)
        return {'artifact_id':name,'path':name,'kind':kind,'description':'test-only observed fixture','media_type':mime,'sha256':hashlib.sha256(data).hexdigest()}

    def receipt(self,gate,when=0):
        timestamp=UTC[when];self.num+=1
        specs=cases(self.root,gate)
        r={'schema':loader.SNAPSHOT,'criterion':gate,'phase':'SETELAH_PILOT' if gate=='PERF-03' else 'WAJIB','receipt_id':gate+'-'+str(self.num),
           'template_only':False,'test_only':True,'action':'record','result':'PASS','previous':[],'change_reason':'',
           'test_event_id':'observed-'+gate,'build':dict(BUILD),'protocol_reference':'test-only-method','started_at_utc':timestamp,'finished_at_utc':timestamp,
           'operator':{'actor_id':'operator','role':ACTORS[gate][0],'at_utc':timestamp,'statement':'TEST ONLY signed observation'},
           'reviewer':{'actor_id':'reviewer','role':ACTORS[gate][1],'at_utc':timestamp,'statement':'TEST ONLY evidence review','decision':'accept'},
           'scenarios':[],'artifacts':[]}
        assets={}
        for index,(case_id,spec) in enumerate(specs.items()):
            case=deepcopy(spec);case['result']='PASS'
            for k in case['checks']:case['checks'][k]='Observed test fixture step '+k
            for k,v in case['environment'].items():
                if isinstance(v,str):case['environment'][k]=v.split('|')[0] if v else 'fixture version 3'
            env=case['environment'];m=case['measurements']
            if gate=='BANK-07':m['decision']='setuju'
            if gate=='UX-09':m['final_commits']=1
            if gate.startswith('DEVICE'):
                env['keyboard']='Gboard 1' if case_id=='gboard' else 'Keyboard beta 2'
                m.update(mistaps=0,restore_target_model='Device two')
            if gate=='TEACH-03':m.update(equations_checked=8,incorrect_equations=0)
            if gate in ('PILOT-01','PILOT-02'):
                m.update(permission_confirmed=True,critical_data_failure=False,dead_end=False,elapsed_seconds=12,mistaps=0,moderator_notes='Observed independent task')
                if gate.endswith('01'):
                    m.update(start_unassisted=True,continue_unassisted=True);env['material_group']=['early','middle','upper'][index%3]
                else:m['understands_report']=True
            if gate=='PILOT-03':
                m.update(student_events=['observed-PILOT-01'],teacher_events=['observed-PILOT-02'],no_change_rationale='Observed no remaining issue during cohort tasks')
            if gate.startswith('REL-') or gate=='PERF-03':env.update(candidate_url=TARGET+'/kelas/',deployment_id='current')
            if gate=='REL-02':m.update(served_release=BUILD['offline_release'],served_dist_sha256=BUILD['dist_tree_sha256'])
            if gate=='REL-03':
                m.update(before_deployment='prior',after_deployment='current',rollback_deployment='rollback',before_release='0'*16,
                         after_release='1'*16,rollback_release='0'*16,before_dist_sha256='0'*64,after_dist_sha256='3'*64,rollback_dist_sha256='0'*64,device_alias=case_id)
            if gate=='PERF-03':m.update(start_utc=UTC[1],end_utc=UTC[2],lcp_ms=[200,2500],inp_ms=[200],cls=['0.1'])
            for kind in spec['required_artifact_kinds']:
                names=['one.docx','two.docx'] if kind=='docx' and case_id=='supplied-fixture' else [kind+'.txt']
                for name in names:
                    if name not in assets:assets[name]=self.artifact(name,kind)
                    case['artifact_ids'].append(name)
            r['scenarios'].append(case)
        r['artifacts']=list(assets.values());return r

    def save(self,r):
        folder=self.root/loader.RECEIPTS/r['criterion'];p=folder/(r['receipt_id']+'.json')
        dump(p,r)
        for party in ('operator','reviewer'):
            sig=p.with_suffix('.'+party+'.sig');sig.unlink(missing_ok=True)
            subprocess.run(['node',str(loader.SIGNER),'sign',str(p),party,str(self.root/(party+'.pem'))],check=True)
        return p

    def state(self,gate,public=False):
        if public:return loader.evaluate_external(self.root,gate,'NOT_RUN','Unavailable',BUILD)
        return loader.inspect(self.root,gate,'NOT_RUN','Unavailable',BUILD,True,{})

    def check(self,gate,status,label,public=False):
        got=self.state(gate,public);assert got[0]==status,(gate,label,status,got[:3]);print('PASS',label)

    def clear(self,gate):
        shutil.rmtree(self.root/loader.RECEIPTS/gate,ignore_errors=True)


def run(root):
    f=Fixture(root);snapshot={}
    for gate in GATES:
        f.check(gate,'NOT_RUN','absent '+gate,public=True)
    for gate in ('BANK-07','UX-09','DEVICE-02','DEVICE-03','A11Y-04','TEACH-03','PILOT-01','PILOT-02','PILOT-03','REL-02','REL-03','PERF-03'):
        r=f.receipt(gate,2 if gate=='PERF-03' else 0);f.save(r);snapshot[gate]=r
        f.check(gate,'PASS','complete signed synthetic '+gate)
        f.check(gate,'FAIL','test fixture excluded by release API '+gate,public=True)
    def change(gate,name,mutation,want='FAIL'):
        r=deepcopy(snapshot[gate]);mutation(r);f.save(r);f.check(gate,want,name);f.save(snapshot[gate])
    def missing(r):r['scenarios'].pop()
    for gate in ('BANK-07','UX-09','DEVICE-02','A11Y-04','TEACH-03','PILOT-01','PILOT-02','REL-03'):
        change(gate,'partial '+gate,missing,'BLOCKED')
    base=snapshot['UX-09']
    for key in loader.BUILD_KEYS:
        change('UX-09','other candidate '+key,lambda r,k=key:r['build'].__setitem__(k,{'offline_release':'f'*16,'dist_tree_sha256':'f'*64,'source_tree_sha256':'f'*64}.get(k,'2.0.0')),'NOT_RUN')
    change('UX-09','template rejected',lambda r:r.update(template_only=True))
    change('UX-09','missing attestation rejected',lambda r:r['operator'].update(statement=''))
    change('UX-09','unreviewed PASS rejected',lambda r:r['reviewer'].update(decision='reject'))
    change('UX-09','substituted signer rejected',lambda r:r['operator'].update(actor_id='unauthorized'))
    change('UX-09','outside role rejected',lambda r:r['reviewer'].update(role='unregistered'))
    change('UX-09','chronology rejected',lambda r:r.update(finished_at_utc='2099-01-01T00:00:00Z'))
    change('UX-09','wrong phase rejected',lambda r:r.update(phase='SETELAH_PILOT'))
    change('UX-09','observations required',lambda r:r['scenarios'][0]['checks'].update(fraction='PASS'))
    change('UX-09','actual device required',lambda r:r['scenarios'][0]['environment'].update(mode='emulator'))
    change('UX-09','physical emulator string rejected',lambda r:r['scenarios'][0]['environment'].update(model='emulated iPhone'))
    change('UX-09','double finalization fails',lambda r:r['scenarios'][0]['measurements'].update(final_commits=2))
    change('UX-09','partial failure visible',lambda r:(r['scenarios'].pop(),r['scenarios'][0].update(result='FAIL')))
    change('UX-09','missing artifact',lambda r:r['artifacts'][0].update(path='missing.dat'))
    change('UX-09','changed artifact digest',lambda r:r['artifacts'][0].update(sha256='a'*64))
    change('UX-09','path traversal refused',lambda r:r['artifacts'][0].update(path='../elsewhere.json'))
    (f.art/'link.txt').symlink_to(f.art/'device-recording.txt')
    change('UX-09','symlink refused',lambda r:r['artifacts'][0].update(path='link.txt'))
    change('DEVICE-02','both keyboards required',lambda r:r['scenarios'][1]['environment'].update(keyboard='Gboard 1'))
    change('DEVICE-03','mistap threshold',lambda r:r['scenarios'][0]['measurements'].update(mistaps=2))
    change('BANK-07','wrong exemplar',lambda r:r['scenarios'][0]['measurements'].update(median_item='another'))
    change('BANK-07','review requests correction',lambda r:r['scenarios'][0]['measurements'].update(decision='perbaiki_isi'))
    change('A11Y-04','DOM cannot attest speech',lambda r:r['scenarios'][0]['environment'].update(mode='DOM'))
    change('A11Y-04','unknown screen reader rejected',lambda r:r['scenarios'][0]['environment'].update(at='automation'))
    change('TEACH-03','Word school version required',lambda r:r['scenarios'][0]['environment'].update(app='XML'))
    change('TEACH-03','text cannot substitute for rendered Word evidence',lambda r:next(a for a in r['artifacts'] if a['kind']=='word-render').update(media_type='text/plain'))
    change('TEACH-03','both Word controls required',lambda r:r['scenarios'][0]['artifact_ids'].remove('two.docx'))
    change('PILOT-01','pilot denominator deduplicated',lambda r:r['scenarios'][-1].update(case_id=r['scenarios'][0]['case_id']))
    change('PILOT-01','pilot all three material groups',lambda r:[c['environment'].update(material_group='upper') for c in r['scenarios']])
    change('PILOT-01','pilot critical data loss fails',lambda r:r['scenarios'][0]['measurements'].update(critical_data_failure=True))
    change('PILOT-01','11 of 12 accepted',lambda r:r['scenarios'][0]['measurements'].update(start_unassisted=False),'PASS')
    change('PILOT-01','10 of 12 fails',lambda r:[c['measurements'].update(continue_unassisted=False) for c in r['scenarios'][:2]])
    change('PILOT-02','all three teachers required',lambda r:r['scenarios'][0]['measurements'].update(understands_report=False))
    change('PILOT-03','actual pilot events required',lambda r:r['scenarios'][0]['measurements'].update(student_events=[]))
    change('PILOT-03','retest evidence required',lambda r:r['scenarios'][0]['measurements'].update(issues=[{'finding':'test problem'}]))
    change('REL-02','localhost refused',lambda r:r['scenarios'][0]['environment'].update(candidate_url='https://127.0.0.1/'))
    change('REL-02','wrong deployment refused',lambda r:r['scenarios'][0]['environment'].update(deployment_id='unapproved'))
    change('REL-02','wrong served hash refused',lambda r:r['scenarios'][0]['measurements'].update(served_dist_sha256='f'*64))
    change('REL-03','same device not counted twice',lambda r:r['scenarios'][1]['measurements'].update(device_alias='device-1'))
    change('REL-03','wrong rollback hash refused',lambda r:r['scenarios'][0]['measurements'].update(rollback_dist_sha256='f'*64))
    change('PERF-03','field p75 exceeds budget',lambda r:r['scenarios'][0]['measurements'].update(cls=['0.01','0.01','0.22','0.30']))
    change('PERF-03','different authorized deployment refused',lambda r:r['scenarios'][0]['environment'].update(deployment_id='prior'))
    change('PERF-03','lab cannot attest field',lambda r:r['scenarios'][0]['environment'].update(mode='lighthouse'))
    change('PERF-03','actual post-pilot window',lambda r:r['scenarios'][0]['measurements'].update(start_utc='2019-01-01T00:00:00Z'))
    path=f.save(base);raw=path.read_bytes();path.write_bytes(raw+b' ')
    f.check('UX-09','FAIL','signature binds exact bytes')
    path.write_bytes(raw)
    other=f.receipt('UX-09');f.save(other);f.check('UX-09','FAIL','conflicting overlapping receipts detected');f.clear('UX-09')
    part1=deepcopy(base);part1['scenarios']=part1['scenarios'][:4];f.save(part1)
    other['scenarios']=other['scenarios'][4:];f.save(other);f.check('UX-09','PASS','complementary real configurations aggregate')
    f.clear('UX-09')
    failed=deepcopy(base);failed['scenarios'][0]['result']='FAIL';p=f.save(failed)
    f.check('UX-09','FAIL','root failure retained')
    revoke=f.receipt('UX-09',1);revoke.update(action='revoke',result='REVOKED',change_reason='Device configuration correction',scenarios=[],artifacts=[],
        previous=[{'receipt_id':failed['receipt_id'],'sha256':loader.sha(p.read_bytes())}])
    q=f.save(revoke);f.check('UX-09','BLOCKED','signed revocation withdraws evidence')
    new=f.receipt('UX-09',2);new.update(action='replace',change_reason='Repeat on physical handset',test_event_id='fresh-retest',
                                      previous=[{'receipt_id':revoke['receipt_id'],'sha256':loader.sha(q.read_bytes())}])
    f.save(new);f.check('UX-09','PASS','documented fresh retest supersedes revocation')
    new['previous'][0]['sha256']='0'*64;f.save(new);f.check('UX-09','FAIL','predecessor bytes bound')
    f.clear('PILOT-02');f.check('PILOT-03','BLOCKED','pilot review depends on actual teacher cohort')
    f.check('PERF-03','BLOCKED','field gate depends on pilot closure')
    f.clear('REL-02');f.check('REL-03','BLOCKED','update requires actual target validation')

if __name__=='__main__':
    with TemporaryDirectory(prefix='kalibataku-test-only-external-') as tmp: run(Path(tmp))
