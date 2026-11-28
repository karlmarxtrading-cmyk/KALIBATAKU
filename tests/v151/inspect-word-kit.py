"""Inspect true DOCX math structure in the generated reviewer kit with a separate reader."""
import hashlib
import json
import platform
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

root=Path(__file__).resolve().parents[2]
folder=root/'VALIDASI_EKSTERNAL/word'
reference=json.loads((folder/'rujukan.json').read_bytes())
release=json.loads((root/'dist/offline-assets.json').read_bytes())['release']
assert reference['offline_release']==release, 'Word fixtures belong to another build'
assert reference['target_word_review']=='BELUM_DIUJI'
ns={'m':'http://schemas.openxmlformats.org/officeDocument/2006/math','w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
expected={
    'fixture-pecahan':[['11/12','+','10/12'],['7/4'],['99'],['21/12']],
    'fixture-kurung-minus':[['(','−25/24','×','2/5','+','5/5',')','×','16','÷','2'],['14/3'],['99'],['14/3']],
}
checked=[]
for d in reference['documents']:
    for item in d['files']:
        assert hashlib.sha256((folder/item['name']).read_bytes()).hexdigest()==item['sha256'], item['name']
    path=folder/(d['name']+'.docx')
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
        doc=ET.fromstring(z.read('word/document.xml'))
    equations=[]
    for equation in doc.findall('.//m:oMath',ns):
        tokens=[]
        for el in equation:
            if el.tag.endswith('}f'):
                numerator=el.find('m:num',ns);denominator=el.find('m:den',ns)
                assert numerator is not None and denominator is not None
                tokens.append(''.join(numerator.itertext()).strip()+'/'+''.join(denominator.itertext()).strip())
            else:
                tokens.append(''.join(el.itertext()).strip())
        equations.append(tokens)
    assert equations==expected[d['name']],(d['name'],equations)
    checked.append({'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                    'equations':equations})
assert len(checked)==2
out=root/'evidence/v151/reports';out.mkdir(parents=True,exist_ok=True)
(out/'word-independent.json').write_text(json.dumps({'file_level':'PASS','target_word_render':'NOT_RUN',
    'release':release,'reader':'Python '+platform.python_version()+' zipfile and ElementTree',
    'method':'Verified six file hashes, inspected native OMML numerator/denominator order and expression tokens for two synthetic DOCX files.',
    'documents':checked},ensure_ascii=False,indent=2)+'\n')
print('PASS Word kit structure, 2 DOCX files, 8 equations; target Microsoft Word review remains open.')
