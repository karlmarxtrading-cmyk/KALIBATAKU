"""Package a settled checkout, verify all archive paths, hashes and CRCs."""
import argparse
import importlib.metadata
import json
import platform
import re
import stat
import unicodedata
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
from project import ROOT, DIST, files, digest, tree_hash, check_pin, release_sources, verify_app_copy

INDEX = {"SHA256SUMS", "FILE_INVENTORY.json"}
FORBIDDEN = {"node_modules", "__pycache__", ".git", ".env", ".DS_Store"}
META = ROOT / "evidence/v162/release"
FILEDATE = (2026,11,29,0,0,0)


def write_json(path,data):
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')


def inventory(paths):
    rows = []
    for path in paths:
        name = path.relative_to(ROOT).as_posix()
        check_name(name)
        if path.is_symlink() or not path.is_file():
            raise ValueError("Release members must be regular files: " + name)
        rows.append({"path": name, "bytes": path.stat().st_size, "sha256": digest(path)})
    return rows


def check_name(s):
    p=PurePosixPath(s)
    windows_devices = {"CON", "PRN", "AUX", "NUL", *(f"{v}{i}" for v in ("COM", "LPT") for i in range(1,10))}
    if (not s or p.as_posix()!=s or p.is_absolute() or not p.parts or
        any(ord(char)<32 or char in '\\:<>"|?*' for char in s) or
        any(part in FORBIDDEN or part in ('.','..') or part.startswith('.build-') or
            part.endswith((' ','.')) or part.split('.')[0].upper() in windows_devices for part in p.parts) or
        p.suffix.lower() in ('.pem','.key','.pyc') or re.search(r'(^|/)\.env($|\.)',s)):
        raise ValueError("Unexpected archive member: "+s)


def safe_extract(archive_path, destination):
    """Read and validate every path before writing into a newly created directory."""
    import shutil
    if destination.exists():
        raise ValueError('Use a new directory for release extraction')
    with ZipFile(archive_path) as archive_file:
        items=archive_file.infolist()
        names=set()
        for item in items:
            check_name(item.filename)
            key=unicodedata.normalize('NFC', item.filename).casefold()
            mode=item.external_attr >> 16
            if key in names or not stat.S_ISREG(mode) or item.flag_bits & 1:
                raise ValueError('Duplicate, non-regular or encrypted ZIP entry: '+item.filename)
            names.add(key)
        if any('/'.join(key.split('/')[:i]) in names for key in names for i in range(1,key.count('/')+1)):
            raise ValueError('File/directory collision in release ZIP')
        destination.mkdir(parents=True)
        for item in items:
            target=destination.joinpath(*PurePosixPath(item.filename).parts)
            target.parent.mkdir(parents=True,exist_ok=True)
            with archive_file.open(item) as source, target.open('xb') as output:
                shutil.copyfileobj(source,output,1024*1024)
            if target.stat().st_size != item.file_size:
                raise ValueError('Extracted size differs: '+item.filename)


def archive(dest,paths):
    if dest.resolve().is_relative_to(ROOT):
        raise ValueError("Put the ZIP outside the release checkout")
    rows=inventory(paths)
    with ZipFile(dest,'w',compression=ZIP_DEFLATED,compresslevel=7) as z:
        for path,row in zip(paths,rows):
            info=ZipInfo(row['path'],date_time=FILEDATE)
            info.create_system=3
            info.external_attr=0o100644<<16
            z.writestr(info,path.read_bytes(),compress_type=ZIP_DEFLATED,compresslevel=7)
    import hashlib
    with ZipFile(dest) as z:
        if sorted(z.namelist())!=sorted(r['path'] for r in rows) or z.testzip() is not None:
            raise ValueError("ZIP member list or CRC mismatch")
        for row in rows:
            data=z.read(row['path'])
            if len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256']:
                raise ValueError('Archived bytes differ: '+row['path'])
    return {"verified":"CRC-32 for every entry, original file SHA-256 and byte count, safe relative paths; no symbolic links","files":len(rows),"bytes":dest.stat().st_size,"sha256":digest(dest)}


def versions():
    def version(cmd):return subprocess.check_output(cmd,text=True).strip()
    assets=[]
    for path in [*files(ROOT/'src/assets'),*files(ROOT/'src/teacher/font')]:
        if path.suffix in ('.woff','.woff2','.ttf'):
            assets.append({"file":path.relative_to(ROOT).as_posix(),"sha256":digest(path),
                           "license":("src/teacher/font/LICENSE.txt" if 'teacher' in path.parts else "src/assets/FONT-LICENSE.txt")})
    tools={}
    for key in ('jsonschema','playwright','PyMuPDF','python-docx','openpyxl','fonttools'):
        try:tools[key]=importlib.metadata.version(key)
        except importlib.metadata.PackageNotFoundError:pass
    return {"node":version(['node','-v']),"npm":version(['npm','-v']),"python":platform.python_version(),
            "test_tools_installed":tools,"lockfile_npm_dependencies":0,"math_renderer":{"module":"src/math/typeset.mjs","glyphs":"src/math/glyphs.mjs generated by tools/build-glyphs.py from src/assets/noto-Regular.woff","glyphs_sha256":digest(ROOT/'src/math/glyphs.mjs')},"local_fonts":assets}


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("action",choices=("preflight","seal"));ap.add_argument("zip",type=Path,nargs="?")
    args=ap.parse_args()
    check_pin()
    if args.action=="preflight":
        META.mkdir(parents=True,exist_ok=True)
        write_json(META/"dependencies.json",versions())
        selection=release_sources()
        write_json(META/'release-manifest.json',{'release_id':'kalibataku-static-'+json.loads((ROOT/'package.json').read_bytes())['version'],'verified_utc':datetime.now(timezone.utc).isoformat(),
            'source_tree_sha256':tree_hash(ROOT,selection),'source_hash_scope':'src, factory, tools, docs/contracts, spec, tests, workflows, package and lock, requirements-qa, .python-version, .nvmrc and .gitattributes; case-sensitive relative path components',
            'dist_tree_sha256':tree_hash(DIST),'dist_file_count':len(files(DIST)),'dist_bytes':sum(p.stat().st_size for p in files(DIST)),
            'runtime':versions(),'curriculum':'1.0.0-draft.2','bank':json.loads((DIST/'bank/index.json').read_bytes())['version'],'mastery_policy':'mastery-local-v1', 'offline_manifest_release':json.loads((DIST/'offline-assets.json').read_bytes())['release']})
        with tempfile.TemporaryDirectory() as tmp:
            result=archive(Path(tmp)/'trial.zip',files(DIST))
        write_json(META/'archive-preflight.json',{'status':'PASS','scope':'All dist paths in the ZIP writer/reader round-trip. Final whole-archive checksum emitted externally after sealing.',**result})
    else:
        if not args.zip:
            raise ValueError('Provide the ZIP output path outside the checkout')
        from package_check import seal_final
        seal_final(args.zip)


def index_payload():
    rows=inventory([p for p in files(ROOT) if p.relative_to(ROOT).as_posix() not in INDEX])
    write_json(ROOT/'FILE_INVENTORY.json',{'scope':'All payload files except this inventory and SHA256SUMS. The checksum list covers this inventory.', 'files':rows})
    checks=[(row['path'],row['sha256']) for row in rows]
    checks.append(('FILE_INVENTORY.json',digest(ROOT/'FILE_INVENTORY.json')))
    (ROOT/'SHA256SUMS').write_text(''.join(f"{h}  {p}\n" for p,h in sorted(checks)), encoding='utf-8',newline='\n')


if __name__=='__main__':
    main()
