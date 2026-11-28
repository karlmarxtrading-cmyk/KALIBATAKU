"""Independent package acceptance using Python's standard library. Never import application code.

The baseline command inspects both input ZIPs. preseal compares the working payload with
the immutable 1.5.0 ZIP. final checks and rebuilds a sealed package in an empty folder.
All write destinations for final must be outside the ZIP and original source.
"""
import argparse
from datetime import datetime, timezone
import hashlib
from importlib import metadata
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import stat
import subprocess
import sys
import tempfile
from urllib.error import HTTPError
from urllib.request import urlopen
import zipfile

BASE = 'e61b032a091bda4e0867c15c3001e802bf808372f6dcee7ada073daefa21f534'
BANK_TREE = '6811a3554f5ecc3f0626bd258553f08016484c38e5acbe902fd1c34881f0fd43'


def check(condition, message):
    if not condition:
        raise ValueError(message)


def file_hash(path):
    with Path(path).open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def readrow(data):
    return (len(data), hashlib.sha256(data).hexdigest())


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def tree(rows):
    return hashlib.sha256(''.join(f'{digest}  {name}\n' for name, (_,digest) in sorted(rows.items(), key=lambda item:PurePosixPath(item[0]))).encode()).hexdigest()


def sub(rows, prefix):
    return {n[len(prefix):]:v for n,v in rows.items() if n.startswith(prefix)}


def disk_rows(folder):
    rows = {}
    for p in sorted(folder.rglob('*')):
        check(not p.is_symlink(),f'Unexpected symbolic link {p}')
        if p.is_file():
            rows[p.relative_to(folder).as_posix()] = (p.stat().st_size,file_hash(p))
    return rows


SOURCE_DIRS=('src','factory','tools','docs/contracts','spec','tests')
SOURCE_METADATA=('package.json','package-lock.json','requirements-qa.txt','.python-version','.nvmrc')


def source_rows(root):
    rows={}
    for folder in SOURCE_DIRS:
        for name,value in disk_rows(root/folder).items():
            p=PurePosixPath(name)
            if p.suffix!='.pyc' and not set(p.parts)&{'__pycache__','.git','.venv','node_modules'}:
                rows[folder+'/'+name]=value
    for name in SOURCE_METADATA:
        rows[name]=readrow((root/name).read_bytes())
    return rows


def archive_rows(z,strip=''):
    rows = {}
    aliases = set()
    for f in z.infolist():
        check(f.filename.startswith(strip),'ZIP root mismatch')
        n = f.filename[len(strip):]
        p = PurePosixPath(n)
        check(n and p.as_posix()==n and not p.is_absolute() and not re.search(r'[:\\\x00-\x1f]',n) and '..' not in p.parts, f'Non-portable ZIP name: {n}')
        check(not f.is_dir() and not stat.S_ISLNK(f.external_attr>>16) and not f.flag_bits&1, f'Unsupported ZIP member: {n}')
        check(n.casefold() not in aliases,f'Duplicate portable ZIP name: {n}')
        aliases.add(n.casefold())
        # read verifies ZIP CRC. Also hash all bytes for independent inventory checks.
        rows[n] = readrow(z.read(f))
    return rows


def compare_sums(z,rows,filename,prefix=''):
    lines = z.read(prefix+filename).decode().splitlines()
    stated = {}
    for line in lines:
        digest,name = line.split('  ',1)
        check(name not in stated, f'Duplicate checksum entry {name}')
        stated[name] = digest
    expected = {n:s for n,(_,s) in rows.items() if n!=filename}
    check(stated==expected, f'{filename} is incomplete or its digests differ')
    return len(stated)


def verify_release_indexes(z,rows):
    count = compare_sums(z,rows,'SHA256SUMS')
    entries = json.loads(z.read('FILE_INVENTORY.json'))['files']
    declared = {e['path']:(e['bytes'],e['sha256']) for e in entries}
    expected = {n:v for n,v in rows.items() if n not in {'FILE_INVENTORY.json','SHA256SUMS'}}
    check(len(entries)==len(declared) and declared==expected,'Inventory mismatch or duplicate')
    return {'checksum_entries':count,'payload_inventory_entries':len(declared)}


def count_catalog(z,rows):
    bank=sub(rows,'dist/bank/')
    index=json.loads(z.read('dist/bank/index.json'))
    ids=set();nodes=set();families=set();slots=0;inactive=0
    for g in index['grades']:
        grade=json.loads(z.read('dist/'+g['url']))
        for lv in grade['levels']:
            level=json.loads(z.read('dist/'+lv['url']))
            for c in level['competencies']:
                if c['active']:nodes.add(c['competency_id'])
                else:inactive+=1
                for entry in c['packages']:
                    path='dist/'+entry['url']
                    check(entry['package_id'] not in ids and rows[path]==(entry['bytes'],entry['sha256']),path)
                    raw=z.read(path).decode().strip()
                    check(raw.startswith('export default ') and raw.endswith(';'),path)
                    pkg=json.loads(raw[15:-1]);questions=pkg['questions']
                    check(pkg['package_id']==entry['package_id'] and pkg['content_version']==entry['content_version']=='1.2.0' and len(questions)==entry['question_count'],path)
                    ids.add(pkg['package_id']);slots+=len(questions);families.update(q['template_id'] for q in questions)
    result={'files':len(bank),'bytes':sum(n for n,_ in bank.values()),'tree_sha256':tree(bank),'packages':len(ids),'question_placements':slots,'active_nodes':len(nodes),'inactive_nodes':inactive,'unique_template_ids':len(families)}
    check((len(bank),tree(bank),len(ids),slots,len(nodes),inactive,len(families))==(4677,BANK_TREE,4604,177640,281,19,394),'Frozen bank reference counts differ: '+str(result))
    return result


def manifest(path,rows):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(''.join(f'{s}  {n}\n' for n,(_,s) in sorted(rows.items())),encoding='utf-8')


def baseline(args):
    verify_hash=file_hash(args.candidate)
    check(verify_hash==BASE, 'Input candidate is not the source ZIP named by the audit')
    report={'status':'PASS','checked_utc':datetime.now(timezone.utc).isoformat(),'method':'Read ZIP payload bytes, verify CRC, recompute every SHA-256 and count actual package rows; no product module imported.'}
    with zipfile.ZipFile(args.candidate) as z:
        rows=archive_rows(z)
        bank=sub(rows,'dist/bank/')
        report['candidate']={'filename':args.candidate.name,'sha256':verify_hash,'bytes':args.candidate.stat().st_size,'files':len(rows),'uncompressed_bytes':sum(n for n,_ in rows.values()),'dist_files':len(sub(rows,'dist/')),'dist_tree_sha256':tree(sub(rows,'dist/')),'stored_offline_release':json.loads(z.read('dist/offline-assets.json'))['release'],**verify_release_indexes(z,rows)}
        report['bank']=count_catalog(z,rows)
        manifest(args.out/'bank-before.sha256',bank)
        manifest(args.out/'historical-evidence.sha256',sub(rows,'evidence/'))
        report['baseline_evidence_files']=len(sub(rows,'evidence/'))
    with zipfile.ZipFile(args.audit) as az:
        prefix=az.namelist()[0].split('/')[0]+'/'
        auditrows=archive_rows(az,prefix)
        report['audit']={'filename':args.audit.name,'sha256':file_hash(args.audit),'bytes':args.audit.stat().st_size,'files':len(auditrows),'checksums_checked':compare_sums(az,auditrows,'SHA256SUMS.txt',prefix)}
        d=json.loads(az.read(prefix+'08_RINGKASAN_AUDIT.json'))
        check(d['source']['sha256']==verify_hash and d['source']['files']==len(rows) and d['build']['dist_tree_sha256']==report['candidate']['dist_tree_sha256'] and d['build']['bank_tree_sha256']==tree(bank),'Audit and input identities differ')
        report['audit']['referenced_input_identity_matches']=True
        report['audit']['core_inputs']={name:v[1] for name,v in auditrows.items() if name.startswith(('00_','01_','06_','07_'))}
        report['audit']['mandatory_status_at_audit']=d['mandatory_criteria']['audit']
    write(args.out/'input-verification.json',report)
    print(json.dumps(report,indent=2))


def historical_status(rows,baseline):
    old=sub(baseline,'evidence/')
    current=sub(rows,'evidence/')
    changed=sorted(k for k,v in old.items() if k in current and current[k]!=v)
    lost=sorted(set(old)-set(current))
    return {'original_evidence_files':len(old),'unchanged':len(old)-len(changed)-len(lost),'changed':changed,'missing':lost}


def supply_chain(root):
    p=json.loads((root/'package.json').read_bytes())
    lock=json.loads((root/'package-lock.json').read_bytes())
    check(lock['packages']['']['version']==p['version']==lock['version'],'npm lock/source version mismatch')
    source= (root/'src/_headers').read_text()
    headers=(root/'dist/_headers').read_text()
    check(source==headers and "object-src 'none'" in headers and "connect-src 'self'" in headers and "frame-ancestors 'none'" in headers and "'unsafe-eval'" not in headers,'Distribution header policy differs')
    distfiles=disk_rows(root/'dist')
    public_dirs={'bank','core','assets','data','locales','journey','learning','math','player','teacher'}
    public_nonfolders={'404.html','index.html','_headers','app.mjs','manifest.webmanifest','offline-assets.json','cache-policy.js','sw.js','build-info.json'}
    for n in distfiles:
        first=n.split('/')[0]
        check(first in public_dirs|public_nonfolders and not n.lower().endswith(('.bak','.zip','.pdf','.docx','.pem','.map','.key')),f'Unexpected public resource {n}')
    for font in ['assets/noto-Bold.woff','assets/noto-Regular.woff','teacher/font/DejaVuSans.ttf']:
        check((root/'dist'/font).exists(),font)
    reqs=[line for line in (root/'requirements-qa.txt').read_text().splitlines() if line and not line.startswith('#')]
    versions={}
    for line in reqs:
        name,want=line.split('==',1)
        try: actual=metadata.version(name)
        except metadata.PackageNotFoundError: actual=None
        versions[name]={'declared':want,'installed':actual,'identical':want==actual}
    return {'application_version':p['version'],'dependencies':p.get('dependencies',{}),
            'npm_packages_excluding_project':len(lock['packages'])-1,'npm_engines':p.get('engines'),
            'declared_node':(root/'.nvmrc').read_text().strip(),'node':subprocess.check_output(['node','-v'],text=True).strip(),
            'npm':subprocess.check_output(['npm','-v'],text=True).strip(),'declared_python':(root/'.python-version').read_text().strip(),
            'python':platform.python_version(),'qa_dependency_versions':versions,'publish_directory':'dist',
            'public_file_count':len(distfiles),'public_top_level':sorted({n.split('/')[0] for n in distfiles}),
            'dist_headers_sha256':file_hash(root/'dist/_headers'),'build_script':p['scripts']['build'],
            'note':'Prebuilt static distribution, local font assets and deployment header policy inspected. No external vulnerability feed queried. Physical devices and public domain remain separate acceptance tests.'}


def preseal(args):
    with zipfile.ZipFile(args.candidate) as z:
        check(file_hash(args.candidate)==BASE,'Wrong baseline ZIP')
        baseline_rows=archive_rows(z)
    after=disk_rows(args.source/'dist/bank')
    before=sub(baseline_rows,'dist/bank/')
    check(before==after,'Frozen bank differs by name, length or digest')
    manifest(args.out/'bank-after.sha256',after)
    data={'checked_utc':datetime.now(timezone.utc).isoformat(),'status':'PASS','baseline_zip_sha256':BASE,'bank_files':len(after),'bank_tree_sha256':tree(after),'bank_changes':0,
          'dist_tree_sha256':tree(disk_rows(args.source/'dist')),'source_app_version':json.loads((args.source/'package.json').read_bytes())['version'],'offline_release':json.loads((args.source/'dist/offline-assets.json').read_bytes())['release']}
    current={'evidence/'+name:v for name,v in disk_rows(args.source/'evidence').items()}
    history=historical_status(current,baseline_rows)
    # Some release control tools used to write to evidence/v15. Expose every
    # changed legacy record by name so the packager can preserve or explain it.
    inputs=source_rows(args.source)
    data.update(source_files=len(inputs),source_tree_sha256=tree(inputs))
    data['historical_evidence']=history
    check(not history['changed'] and not history['missing'],'An original historical evidence file changed or disappeared')
    write(args.out/'bank-and-history.json',data)
    write(args.out/'runtime-and-deploy.json',supply_chain(args.source))
    print(json.dumps(data,indent=2))


def serve_selection(root, expected, prefix):
    # Exercise the shipped preview CLI through localhost. It resolves files and
    # interprets the packaged _headers. This is a lab host, not the user's domain.
    proc=subprocess.Popen([sys.executable,'tools/preview.py','--port','0','--prefix',prefix],cwd=root,
        text=True,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})
    try:
        base=proc.stdout.readline().strip()
        check(re.fullmatch(r'http://127\.0\.0\.1:\d+'+re.escape(prefix),base),'Preview did not announce bound local port')
        sample=next(n for n in sorted(expected) if n.startswith('bank/v1.2/') and n.endswith('.mjs'))
        cases=[('', 'index.html'),('app.mjs','app.mjs'),('sw.js','sw.js'),('build-info.json','build-info.json'),('offline-assets.json','offline-assets.json'),
               ('bank/index.json','bank/index.json'),(sample,sample)]
        observed=[]
        for path,name in cases:
            with urlopen(base+path,timeout=10) as res:
                body=res.read()
                check(res.status==200 and readrow(body)==expected[name],f'Wrong published bytes at {path}')
                mime=res.headers.get_content_type()
                want='application/json' if name.endswith('.json') else 'text/javascript' if name.endswith(('.mjs','.js')) else 'text/html'
                check(mime==want and res.headers.get('X-Content-Type-Options')=='nosniff',f'MIME/header at {path}')
                check("connect-src 'self'" in (res.headers.get('Content-Security-Policy') or ''),f'CSP at {path}')
                if name==sample:check('immutable' in (res.headers.get('Cache-Control') or ''),'Frozen package cache rule missing')
                observed.append({'path':path or 'index.html','status':res.status,'mime':mime,'bytes':len(body),'sha256':readrow(body)[1]})
        for path in ['missing-kalibataku-page.html','_headers','RELEASE_STATUS.json','evidence/v151/qa/binding.json']:
            try:
                with urlopen(base+path,timeout=10) as res: raise ValueError('Unexpected public path '+path)
            except HTTPError as err:
                check(err.code==404 and readrow(err.read())==expected['404.html'],f'Custom 404 at {path}')
                observed.append({'path':path,'status':404,'custom_404':True})
        return {'prefix':prefix,'scope':'localhost, packaged preview server and byte-identical extracted dist','requests':observed}
    finally:
        proc.terminate()
        try: proc.wait(timeout=10)
        except subprocess.TimeoutExpired: proc.kill();proc.wait()
        proc.stdout.close()


def final(args):
    check(args.out.resolve()!=args.source.resolve() and args.source.resolve() not in args.out.resolve().parents,'Final receipt must be outside the sealed package')
    args.out.mkdir(parents=True,exist_ok=True)
    report={'stage':'post-seal clean extraction','started_utc':datetime.now(timezone.utc).isoformat(),'zip_filename':args.zip.name,'zip_bytes':args.zip.stat().st_size,'zip_sha256':file_hash(args.zip),'notes':[],'commands':[]}
    with zipfile.ZipFile(args.candidate) as z0:
        check(file_hash(args.candidate)==BASE,'Wrong baseline ZIP')
        old=archive_rows(z0)
    with zipfile.ZipFile(args.zip) as z, tempfile.TemporaryDirectory(prefix='kalibataku-final-',dir=args.out) as directory:
        names=archive_rows(z)
        checkout=disk_rows(args.source)
        transient=[k for k in checkout if '__pycache__' in PurePosixPath(k).parts and k.endswith('.pyc')]
        report['transient_interpreter_cache_files_omitted_from_archive']=len(transient)
        for name in transient: del checkout[name]
        check(names==checkout,'ZIP and sealed workspace differ')
        report.update(verify_release_indexes(z,names))
        root=Path(directory)
        z.extractall(root)
        check(names==disk_rows(root),'Clean extraction differs from ZIP')
        frozen=sub(old,'dist/bank/')
        check(sub(names,'dist/bank/')==frozen,'Final bank differs from original')
        report['bank_files_verified']=len(frozen)
        report['bank_tree_sha256']=tree(frozen)
        report['zip_files']=len(names)
        report['historical_evidence']=historical_status(names,old)
        check(not report['historical_evidence']['changed'] and not report['historical_evidence']['missing'],'Historical evidence differs in final release')
        status=json.loads(z.read('RELEASE_STATUS.json'))
        if status['app_version']=='1.5.1':
            source_files={k:v for k,v in names.items() if k.startswith(tuple(d+'/' for d in SOURCE_DIRS)) or k in SOURCE_METADATA}
            source_hash=tree(source_files)
            public=sub(names,'dist/')
            public_hash=tree(public)
            packaged=json.loads(z.read('evidence/v151/release/release-manifest.json'))
            qa=json.loads(z.read(status['qa_binding']))
            for name,value in [('source_tree_sha256',source_hash),('dist_tree_sha256',public_hash)]:
                check(qa['build'][name]==packaged[name]==value,'Independent '+name+' differs from recorded release/QA')
                if name in status:check(status[name]==value,'Verdict is for a different '+name)
            check(qa['build']['offline_release']==status['offline_release'] and qa['build']['app_version']==status['app_version'] and qa['build']['bank_version']==status['bank_version'],'Incorrect QA build identity')
            report['identity']={'source_files':len(source_files),'source_tree_sha256':source_hash,'dist_files':len(public),'dist_tree_sha256':public_hash,'release_status':status['release_label'],'qa_binding':status['qa_binding'],'qa_suites':len(qa['suites']),'qa_status':qa['status']}
        for n in names:
            p=PurePosixPath(n)
            check(not any(part in {'.git','.env','node_modules','__pycache__','playwright-report','test-results'} for part in p.parts) and not n.lower().endswith(('.pem','.key','.pyc')),f'Unwanted packaging data {n}')
        report['release']=json.loads((root/'RELEASE_STATUS.json').read_bytes())['offline_release']
        check(report['release']==json.loads((root/'dist/offline-assets.json').read_bytes())['release'],'Release manifest mismatch')
        report['supply_chain']=supply_chain(root)
        expected=sub(names,'dist/')
        for n,cmd in [('verify-before',['npm','run','release:verify']),('rebuild',['npm','run','build']),('verify-after',['npm','run','release:verify'])]:
            begin=datetime.now(timezone.utc).isoformat()
            run=subprocess.run(cmd,cwd=root,capture_output=True,text=True,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','npm_config_audit':'false','npm_config_fund':'false'},timeout=300)
            log=args.out/(n+'.log');log.write_text(run.stdout+run.stderr)
            report['commands'].append({'cmd':cmd,'start_utc':begin,'finish_utc':datetime.now(timezone.utc).isoformat(),'exit_code':run.returncode,'log':log.name,'log_sha256':file_hash(log)})
            check(run.returncode==0,n+' failed, see '+str(log))
        after=disk_rows(root/'dist')
        check(expected==after,'Rebuild differs from the sealed dist')
        report['rebuild']={'dist_files':len(expected),'packaged_dist_sha256':tree(expected),'rebuilt_dist_sha256':tree(after),'different_paths':0}
        report['local_http']=[serve_selection(root,expected,prefix) for prefix in ['/','/school/math/']]
        if status['app_version']=='1.5.1':
            runtime={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'}
            audit,=list((root/'evidence/v151/audit-input').glob('*.zip'))
            focus=args.out.resolve()/'post-seal-behavior.json'
            command=[sys.executable,'evidence/v151/baseline/behavior.py','--source','.', '--audit',str(audit.resolve()),'--out',str(focus)]
            result=subprocess.run(command,cwd=root,capture_output=True,text=True,env=runtime,timeout=120)
            check(result.returncode==0,'Independent focused replay failed: '+result.stderr)
            actual=json.loads(focus.read_bytes())
            check(actual['status']=='PASS' and actual['dist_tree_sha256']==report['identity']['dist_tree_sha256'],'Focused replay tested a different distribution')
            report['focused_replay']={'receipt':focus.name,'sha256':file_hash(focus),'actual':json.loads(result.stdout)}
        check(disk_rows(root)==names,'Check/rebuild modified non-dist evidence files')
    report.update(status='PASS',finished_utc=datetime.now(timezone.utc).isoformat())
    write(args.out/'post-seal-receipt.json',report)
    print(json.dumps({k:report[k] for k in ['status','zip_sha256','zip_files','bank_files_verified','rebuild']}))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    s=p.add_subparsers(dest='action',required=True)
    b=s.add_parser('baseline');b.add_argument('--candidate',type=Path,required=True);b.add_argument('--audit',type=Path,required=True);b.add_argument('--out',type=Path,required=True)
    for name in ('preseal','final'):
        f=s.add_parser(name);f.add_argument('--candidate',type=Path,required=True);f.add_argument('--source',type=Path,required=True);f.add_argument('--out',type=Path,required=True)
        if name=='final':f.add_argument('--zip',type=Path,required=True)
    args=p.parse_args()
    {'baseline':baseline,'preseal':preseal,'final':final}[args.action](args)
