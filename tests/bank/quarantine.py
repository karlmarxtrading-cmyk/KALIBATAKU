"""An invalid registry must not replace the previously installed bank or its evidence."""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory() as tmp:
    base=Path(tmp)
    output, receipts, spec = base/'bank',base/'evidence',base/'invalid-spec'
    for folder in (output,receipts,spec): folder.mkdir()
    prior=b'{"existing":"verified release"}\n'
    (output/'index.json').write_bytes(prior)
    (receipts/'summary.json').write_bytes(prior)
    run=subprocess.run([sys.executable,str(ROOT/'factory/build_bank.py'),'--spec',str(spec),'--output',str(output),'--evidence',str(receipts)],
                       capture_output=True,text=True,env={**os.environ,'TMPDIR':tmp})
    assert run.returncode!=0
    failure=json.loads(next(line for line in run.stderr.splitlines() if line.startswith('{"status":"QUARANTINED"')))
    assert failure['error_type']=='StopIteration'
    assert (Path(failure['evidence'])/'failure.json').exists()
    assert (output/'index.json').read_bytes()==prior and (receipts/'summary.json').read_bytes()==prior
    report={'status':'PASS','bank_version':'1.1.0','test':'tests/bank/quarantine.py','injected_failure':'missing effective registry in isolated input',
            'candidate_quarantined':True,'previous_output_preserved':True,'previous_manifest_and_evidence_bytes_preserved':True}
    path=ROOT/'evidence/bank/quarantine-test.json'
    path.write_text(json.dumps(report,indent=2)+'\n')
    print('New candidate quarantined. Existing bank and evidence preserved.')
