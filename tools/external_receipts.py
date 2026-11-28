"""Evaluate independently authorized, signed external observations for the current build."""
import argparse
import base64
import binascii
from functools import lru_cache
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
from external_cases import ACTORS, GATES, cases, meaningful, origin, require, utc, validate_case

ROOT=Path(__file__).resolve().parents[1]
SIGNER=Path(__file__).with_name('sign-external.mjs')
TRUST='release-authorization/external-trust.json'
RECEIPTS='evidence/external/receipts'
ARTIFACTS='evidence/external/artifacts'
BUILD_KEYS=('app_version','bank_version','offline_release','dist_tree_sha256','source_tree_sha256')
SNAPSHOT='kalibataku-external-receipt/1'
ID=re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z')
SHA=re.compile(r'[a-f0-9]{64}\Z')


def safe(root, rel, missing=False):
    require(isinstance(rel,str) and '\\' not in rel and ':' not in rel and not rel.startswith('/') and
            all(ID.fullmatch(p) and p not in ('.','..') for p in rel.split('/')), 'Unsafe evidence path')
    p=root
    for part in PurePosixPath(rel).parts:
        p=p/part
        require(not p.is_symlink(),'Symbolic links prohibited in evidence paths')
    require(missing or p.is_file(),'Missing file '+rel)
    return p


def load(data):
    def unique(pairs):
        out={}
        for key,value in pairs:
            require(key not in out,'Repeated JSON key');out[key]=value
        return out
    return json.loads(data,object_pairs_hook=unique,parse_constant=lambda _:require(False,'Nonfinite JSON number'))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def normalize_build(ident):
    subset={k:ident[k] for k in BUILD_KEYS}
    require(all(isinstance(v,str) and v for v in subset.values()) and
            re.fullmatch('[0-9a-f]{16}',subset['offline_release']) and
            all(SHA.fullmatch(subset[k]) for k in ('dist_tree_sha256','source_tree_sha256')), 'Incomplete candidate build identity')
    return subset


@lru_cache(maxsize=2)
def schema_validator(fixture):
    from jsonschema import Draft202012Validator
    schema=load((ROOT/'docs/contracts/external-receipt-1.schema.json').read_bytes())
    if fixture: schema['properties']['test_only']={'const':True}
    return Draft202012Validator(schema)


def validate_signed(root, gate, path, trust, fixture, verifier, refs):
    require(path.stat().st_size<=16*1024*1024,'Receipt is too large')
    body=path.read_bytes();r=load(body)
    issue=next(schema_validator(fixture).iter_errors(r),None)
    if issue is not None:
        raise ValueError('Receipt schema: '+'.'.join(map(str,issue.absolute_path))+' ('+str(issue.validator)+')')
    rid=r['receipt_id']
    require(r['schema']==SNAPSHOT and r['criterion']==gate and r['phase']==('SETELAH_PILOT' if gate=='PERF-03' else 'WAJIB'),'Wrong schema, criterion or phase')
    require(r['template_only'] is False and r['test_only'] is fixture,'Unsigned template or test-only evidence cannot enter release')
    require(ID.fullmatch(rid) and rid.startswith(gate+'-') and path.stem==rid,'Receipt ID must be unique and match filename/criterion')
    require(r['action'] in ('record','replace','revoke') and r['result'] in ('PASS','FAIL','REVOKED'),'Invalid lifecycle action or result')
    require((r['action']=='revoke')==(r['result']=='REVOKED'),'Revocation status mismatch')
    require(ID.fullmatch(r['test_event_id']) and meaningful(r['protocol_reference']), 'Missing test event or protocol')
    require(normalize_build(r['build'])==r['build'],'Unexpected candidate identity fields')
    require(utc(r['started_at_utc'])<=utc(r['finished_at_utc'])<=utc(r['operator']['at_utc'])<=utc(r['reviewer']['at_utc'])<=datetime.now(timezone.utc),'Invalid test/attestation chronology')
    require(r['operator']['actor_id']!=r['reviewer']['actor_id'],'Independent reviewer required')
    parties=[]
    for index,party in enumerate(('operator','reviewer')):
        signer=r[party]; actor=trust['actors'].get(signer['actor_id'])
        require(actor is not None and gate in actor['criteria'] and signer['role']==ACTORS[gate][index] and signer['role'] in actor['roles'],
                'Unauthorized signer role or criterion')
        require(meaningful(signer['statement']),'Missing human attestation or review rationale')
        if party=='reviewer':
            require(signer['decision'] in ('accept','reject') and (r['result']!='PASS' or signer['decision']=='accept'),'Missing approval of PASS receipt')
        key=actor['public_key']
        base64.b64decode(key,validate=True)
        rel=f'{RECEIPTS}/{gate}/{rid}.{party}.sig'
        sig=safe(root,rel).read_text().strip()
        require(len(base64.b64decode(sig,validate=True))==64,'Invalid signature length')
        refs.append(rel);parties.append([key,sig])
    require(parties[0][0]!=parties[1][0],'Two different authorized signer keys required')
    verifier.append({'body':base64.b64encode(body).decode(),'parties':parties})
    require(isinstance(r['previous'],list) and (r['action']=='record')==(not r['previous']),'Missing or unexpected supersession references')
    if r['previous']:
        require(meaningful(r['change_reason']),'Missing revocation/replacement reason')
        for previous in r['previous']:
            require(ID.fullmatch(previous['receipt_id']) and SHA.fullmatch(previous['sha256']),'Invalid previous receipt reference')
    return r,sha(body)


def artifacts_for(root, receipt, refs):
    artifacts={}
    require(isinstance(receipt['artifacts'],list) and receipt['artifacts'],'Missing evidence artifacts')
    for a in receipt['artifacts']:
        aid=a['artifact_id'];require(ID.fullmatch(aid) and aid not in artifacts and meaningful(a['description']),'Invalid artifact ID or description')
        require(meaningful(a['media_type']) and meaningful(a['kind']) and SHA.fullmatch(a['sha256']),'Invalid artifact metadata')
        rel=f"{ARTIFACTS}/{a['path']}";path=safe(root,rel)
        require(path.stat().st_size>0,'Empty evidence artifact')
        with path.open('rb') as f:
            require(hashlib.file_digest(f,'sha256').hexdigest()==a['sha256'],'Artifact checksum mismatch: '+a['path'])
        mime=a['media_type'].lower().split(';',1)[0].strip()
        kind=a['kind']
        if kind=='docx':
            require(mime=='application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Word evidence requires DOCX media type')
            from zipfile import BadZipFile, ZipFile
            try:
                with ZipFile(path) as zipped:
                    require('word/document.xml' in zipped.namelist(), 'Word document structure missing')
            except BadZipFile as error:
                raise ValueError('Word evidence is not a DOCX file') from error
        if kind in ('word-render','device-recording'):
            require(mime.startswith(('image/','video/')) or mime=='application/pdf', 'Visual evidence requires image, video or PDF media type')
        if kind=='speech-record':
            require(mime.startswith(('audio/','video/','text/')) or mime=='application/pdf', 'Actual utterances require audio, video or transcript')
        refs.append(rel);artifacts[aid]=a
    return artifacts


def inspect(root,gate,default,reason,ident,fixture,cache):
    if gate in cache: return cache[gate]
    refs=[]
    def result(state, explanation, events=None):
        value=(state,sorted(set(refs)),explanation,events or {})
        cache[gate]=value
        return value
    try:
        folder=safe(root,f'{RECEIPTS}/{gate}',missing=True)
        if not folder.exists(): return result(default,reason)
        require(folder.is_dir(),'Receipt path is not a directory')
        entries=sorted(folder.iterdir())
        if not entries: return result(default,reason)
        paths=[p for p in entries if p.suffix=='.json']
        expected={f'{p.stem}.{party}.sig' for p in paths for party in ('operator','reviewer')}
        require(paths and all(p.suffix=='.json' or p.name in expected for p in entries),'Unexpected file or orphan signature in receipt folder')
        identity=normalize_build(ident)
        trust=load(safe(root,TRUST).read_bytes());refs.append(TRUST)
        require(trust['schema']=='kalibataku-external-trust/1' and isinstance(trust['actors'],dict),'Invalid release authorization')
        records={};verifier=[]
        for p in paths:
            rel=p.relative_to(root).as_posix();refs.append(rel);safe(root,rel)
            r,digest=validate_signed(root,gate,p,trust,fixture,verifier,refs)
            records[r['receipt_id']]=(r,digest)
        verification=subprocess.run(['node',str(SIGNER),'verify'],input=json.dumps(verifier),capture_output=True,text=True,timeout=120)
        require(verification.returncode==0,'Invalid operator/reviewer Ed25519 signature')
        retired=set()
        for r,_ in records.values():
            for prev in r['previous']:
                pid=prev['receipt_id'];require(pid in records and pid not in retired,'Missing or conflicting receipt predecessor')
                old,old_hash=records[pid];require(old_hash==prev['sha256'] and utc(old['reviewer']['at_utc'])<utc(r['reviewer']['at_utc']),
                                                  'Incorrect previous receipt digest or chronological order')
                require(r['action']!='replace' or utc(r['started_at_utc'])>=utc(old['finished_at_utc']), 'Replacement requires a new test event after the prior test')
                require(r['action']!='replace' or old['test_event_id']!=r['test_event_id'],'Retest must identify a new event')
                retired.add(pid)
        active=[r for k,(r,_) in records.items() if k not in retired and r['build']==identity]
        if not active: return result(default,'Tidak ada receipt aktif pada identitas build, source dan dist ini.')
        revoked=any(r['action']=='revoke' for r in active)
        active=[r for r in active if r['action']!='revoke']
        specs=cases(root,gate); observed={}; events={}; failure=False
        pilot=gate in ('PILOT-01','PILOT-02')
        for r in active:
            require(isinstance(r['scenarios'],list) and r['scenarios'],'No observed scenarios')
            failure |= r['result']=='FAIL' or r['reviewer']['decision']=='reject'
            artifacts=artifacts_for(root,r,refs)
            event=r['test_event_id']
            event_summary=events.setdefault(event,{'finished':r['finished_at_utc'],'deployments':set()})
            event_summary['finished']=max(event_summary['finished'],r['finished_at_utc'],key=utc)
            for case in r['scenarios']:
                key=case['case_id'];require(isinstance(key,str) and ID.fullmatch(key) and key not in observed,
                                            'Conflicting duplicate case or repeated participant alias; explicitly supersede the old receipt')
                spec=next(iter(specs.values())) if pilot else specs.get(key)
                require(spec is not None,'Unrecognized criterion scenario: '+key)
                passed=validate_case(case,spec,artifacts,gate,identity,trust)
                if gate.startswith('REL-') or gate=='PERF-03':
                    env=case['environment']
                    event_summary['deployments'].add((origin(env['candidate_url']),env['deployment_id']))
                if gate=='PERF-03':
                    require(utc(case['measurements']['end_utc'])<=utc(r['finished_at_utc']), 'Field execution ended before sampled window')
                if gate=='TEACH-03' and key=='supplied-fixture':
                    reference=load(safe(root,'VALIDASI_EKSTERNAL/word/rujukan.json').read_bytes())
                    expected={f['sha256'] for doc in reference['documents'] for f in doc['files'] if f['name'].endswith('.docx')}
                    actual={artifacts[a]['sha256'] for a in case['artifact_ids'] if artifacts[a]['kind']=='docx'}
                    require(reference['offline_release']==identity['offline_release'] and len(expected)==2 and expected<=actual,
                            'Supplied Word fixtures do not match candidate')
                    passed &= case['measurements']['equations_checked']>=sum(len(doc['rows']) for doc in reference['documents'])
                if gate=='BANK-07':
                    require(case['environment']['grade'] in trust['actors'][r['operator']['actor_id']]['grades'],'Math teacher authorization does not cover this grade')
                observed[key]=case;failure |= not passed
        if failure: return result('FAIL','Uji, pengukuran, atau keputusan review menyatakan gagal.',events)
        if revoked: return result('BLOCKED','Bukti dicabut; diperlukan pengujian dan receipt pengganti.')
        if pilot:
            require(len(observed)<=len(specs),'More unique participants than the predefined pilot cohort')
            if len(observed)<len(specs): return result('BLOCKED',f'Cakupan peserta {len(observed)}/{len(specs)}.',events)
            if gate=='PILOT-01':
                groups={c['environment']['material_group'] for c in observed.values()}
                require(groups=={'early','middle','upper'},'Missing material group in pilot cohort')
                success=sum(c['measurements']['start_unassisted'] and c['measurements']['continue_unassisted'] for c in observed.values())
                if success<11: return result('FAIL',f'Hanya {success}/12 siswa mulai dan melanjutkan mandiri.',events)
        else:
            missing=set(specs)-set(observed)
            if missing: return result('BLOCKED',f'Cakupan belum lengkap ({len(observed)}/{len(specs)}); contoh: '+', '.join(sorted(missing)[:3]),events)
        if gate=='REL-03':
            measures=[c['measurements'] for c in observed.values()]
            require(len({m['device_alias'] for m in measures})==2 and len({c['environment']['candidate_url'].split('/')[2] for c in observed.values()})==1,'Two distinct devices on same rollout required')
            require(len({tuple((k,v) for k,v in sorted(m.items()) if k!='device_alias') for m in measures})==1,'Devices exercised different rollout transitions')
        if gate in ('PILOT-03','PERF-03','REL-03'):
            deps={'PILOT-03':('PILOT-01','PILOT-02'),'PERF-03':('PILOT-03','REL-02'),'REL-03':('REL-02',)}[gate]
            for dep in deps:
                state,paths,_,prior_events=inspect(root,dep,'NOT_RUN','Belum ada bukti.',ident,fixture,cache); refs.extend(paths)
                if state!='PASS': return result('BLOCKED','Bukti prasyarat belum lulus: '+dep)
                if gate=='PILOT-03':
                    detail=observed['findings-and-retest']['measurements']
                    require(set(detail['student_events' if dep=='PILOT-01' else 'teacher_events'])==set(prior_events),'Pilot review must identify the actual event set')
                if dep=='REL-02':
                    approved_targets={item for e in prior_events.values() for item in e['deployments']}
                    actual_targets={item for e in events.values() for item in e['deployments']}
                    require(actual_targets<=approved_targets,'Deployment differs from the one verified by REL-02')
                if gate=='PILOT-03':
                    require(all(utc(e['finished'])<=max(utc(r['finished_at_utc']) for r in active) for e in prior_events.values()),
                            'Pilot review predates student or teacher observations')
                if gate=='PERF-03':
                    sample=observed['field-sample']['measurements']
                    require(all(utc(e['finished'])<=utc(sample['start_utc']) for e in prior_events.values()),'Field data must follow pilot and deployment')
        return result('PASS',f'{len(observed)} skenario/peserta tercakup; pengesahan pelaksana dan review terverifikasi.',events)
    except (ImportError,KeyError,TypeError,ValueError,OverflowError,AttributeError,OSError,RuntimeError,subprocess.SubprocessError,binascii.Error) as error:
        return result('FAIL','Receipt tidak memenuhi kontrak: '+str(error)[:240])


def evaluate_external(root,criterion_id,default_state,default_reason,identity):
    gate=criterion_id.removeprefix('AC:')
    require(gate in GATES and default_state in ('BLOCKED','NOT_RUN'),'Unknown external gate or invalid default')
    return inspect(Path(root),gate,default_state,default_reason,identity,False,{})[:3]


def template(root,gate):
    from qa_core import identity
    ident=normalize_build(identity(root))
    return {'schema':SNAPSHOT,'receipt_id':gate+'-','criterion':gate,'phase':'SETELAH_PILOT' if gate=='PERF-03' else 'WAJIB',
        'template_only':True,'test_only':False,'action':'record','result':None,'previous':[],'change_reason':'',
        'test_event_id':'','build':ident,'protocol_reference':'','started_at_utc':'','finished_at_utc':'',
        'operator':{'actor_id':'','role':ACTORS[gate][0],'statement':'','at_utc':''},
        'reviewer':{'actor_id':'','role':ACTORS[gate][1],'statement':'','at_utc':'','decision':None},
        'scenarios':list(cases(root,gate).values()),'artifacts':[]}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=('template','check'))
    parser.add_argument('criterion',choices=GATES)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    draft=template(ROOT,args.criterion)
    if args.command=='template':
        text=json.dumps(draft,ensure_ascii=False,indent=2)+'\n'
        if args.output:
            with args.output.open('x',encoding='utf-8') as f: f.write(text)
        else: print(text,end='')
    else:
        state,paths,reason=evaluate_external(ROOT,args.criterion,'NOT_RUN' if args.criterion.startswith('PILOT-') or args.criterion=='PERF-03' else 'BLOCKED','Belum diuji.',draft['build'])
        print(json.dumps({'state':state,'evidence':paths,'reason':reason},ensure_ascii=False,indent=2));sys.exit(0 if state=='PASS' else 1)
