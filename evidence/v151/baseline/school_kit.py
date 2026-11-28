"""Compare a school's review roster against the frozen packages without executing their modules."""
import argparse
from collections import Counter
import csv
from datetime import datetime,timezone
import json
from pathlib import Path
from release_artifacts import check, file_hash, write

parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args()
root=args.source.resolve()
kit=root/'VALIDASI_EKSTERNAL'
identity=json.loads((kit/'BUILD.json').read_bytes())
before=json.loads((root/'evidence/v151/baseline/bank-and-history.json').read_bytes())
for field in ('source_tree_sha256','dist_tree_sha256','offline_release'):
    check(identity['build'][field]==before[field],'School kit not bound to this '+field)
for name,want in identity['files'].items():
    p=(kit/name).resolve()
    check(kit in p.parents and p.is_file() and file_hash(p)==want,'School kit digest differs for '+name)

def read_csv(p):
    with p.open(encoding='utf-8-sig',newline='') as f:
        return list(csv.DictReader(f))

carried=read_csv(root/'evidence/v15/review/roster-394-templates.csv')
roster=read_csv(kit/'bank/roster-394.csv')
old_by_id={row['template_id']:row for row in carried}
new_by_id={row['template_id']:row for row in roster}
check(len(old_by_id)==len(new_by_id)==len(roster)==394 and set(old_by_id)==set(new_by_id),'Family roster differs')
for fam,old in old_by_id.items():
    check(all(new_by_id[fam][k]==v for k,v in old.items()),'Original review data differs for '+fam)

files=list((root/'dist/bank/v1.2').glob('*/*/*.mjs'))
package_paths={p.stem:p for p in files}
check(len(package_paths)==len(files)==4604,'Unexpected package names')
positions={'first_in_order','median_item','hardest_item'}
references=set()
packages={}
counts=Counter()
unique={}
for row in read_csv(kit/'bank/contoh-1182.csv'):
    fam=row['template_id']; position=row['posisi']
    check(fam in new_by_id and position in positions and (fam,position) not in references,'Duplicate or extra position')
    references.add((fam,position))
    package=row['paket']
    if package not in packages:
        path=package_paths[package]
        body=path.read_bytes()
        check(body.startswith(b'export default ') and body.rstrip().endswith(b';'),'Unexpected package framing')
        content=json.loads(body[len(b'export default '):].rstrip()[:-1])
        packages[package]=(content,file_hash(path))
    pack,digest=packages[package]
    offset=int(row['indeks_nol'])
    check(offset>=0,'Invalid item index')
    question=pack['questions'][offset]
    ref=f"{package}#{offset} (fp {question['fingerprint'][:16]}, band {row['band_heuristik']}, score {row['skor_heuristik']})"
    check(new_by_id[fam][position]==ref,'Sample does not match roster position '+ref)
    expected={
        'kelas':str(pack['grade']),'level':str(pack['level']),'tujuan_paket':pack['purpose'],'template_id':question['template_id'],
        'question_id':question['question_id'],'question_revision':question['question_revision'],'sha256_paket':digest,'ekspresi':question['neutral_expression'],
        'kunci_eksak':question['answer']['numerator']+'/'+question['answer']['denominator'],
        'strategi':'+'.join(question['strategy_tags']),
    }
    for lang in ('id','en'):
        expected['hint_'+lang.upper()]=question['hint'][lang]
        expected['penjelasan_'+lang.upper()]=question['explanation'][lang]
        expected['langkah_'+lang.upper()]=' | '.join(f'{i}. {step["text"][lang]}' for i,step in enumerate(question['solution_steps'],1))
    for field,want in expected.items():
        check(row[field]==want,f'{fam} {position} {field} does not match frozen source')
    counts[position]+=1
    unique.setdefault(fam,set()).add(question['question_id'])
check(len(references)==1182,'Expected every review position exactly once')
report={'status':'PASS','checked_utc':datetime.now(timezone.utc).isoformat(),'scope':'Independent data check of school materials. Human review status remains determined by authenticated evidence.',
        'build':identity['build'],'school_kit_manifest_sha256':file_hash(kit/'BUILD.json'),'school_kit_files_in_manifest_checked':len(identity['files']),'families':len(roster),'sample_positions':dict(counts),
        'source_packages_opened':len(packages),'original_roster_sha256':file_hash(root/'evidence/v15/review/roster-394-templates.csv'),
        'school_roster_sha256':file_hash(kit/'bank/roster-394.csv'),'school_samples_sha256':file_hash(kit/'bank/contoh-1182.csv'),
        'distinct_question_ids_within_template':dict(sorted(Counter(len(v) for v in unique.values()).items())),
        'fields_verified':['package_sha256','zero_based_index','question_id','question_revision','template_id','grade','level','purpose','expression','exact_answer','strategies','hint_id_en','explanation_id_en','worked_steps_id_en','baseline_position_reference']}
write(args.out,report)
print(json.dumps(report,indent=2))
