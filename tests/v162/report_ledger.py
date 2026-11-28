"""Measure report contents against persisted synthetic events using independent readers."""
import argparse
import csv
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from datetime import datetime
from fractions import Fraction
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile
from zoneinfo import ZoneInfo

import fitz
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests/qa'))
from receipt import Suite

M = {'m': 'http://schemas.openxmlformats.org/officeDocument/2006/math'}
CASES = {
    'fraction': ('11/12 + 10/12', Fraction(11,12)+Fraction(10,12), '21/12'),
    'grouped': ('(−25/24 × (2/5) + 5/5) × 16 ÷ 2',
                (Fraction(-25,24)*Fraction(2,5)+1)*16/2, '14/3'),
}


def normalized(text):
    return ''.join(text.split())


def expectation(folder, name):
    expression, key, revision = CASES[name]
    bundles = json.loads((folder/'ledger.json').read_bytes())
    day = lambda b: datetime.fromisoformat(b['completed']).astimezone(ZoneInfo('Asia/Jakarta')).day
    assert sorted(day(b) for b in bundles) == [28, 29]
    selected, = [b for b in bundles if day(b) == 29]
    events = selected['events']
    assert [e['event_type'] for e in events] == ['attempt.started','answer.submitted','answer.submitted','attempt.completed']
    assert all(e['attempt_id'] == selected['id'] for e in events)
    first, last = [e['payload'] for e in events[1:3]]
    assert first['question_id'] == last['question_id'] == selected['question_id']
    assert not first['client_is_correct'] and last['client_is_correct'] and last['key_seen_before']
    assert first['raw_answer'] == '99' and last['raw_answer'] == revision and Fraction(revision) == key
    assert events[-1]['payload']['final_responses'][0]['response_event_id'] == events[2]['event_id']
    return {'id': selected['id'], 'start': selected['started'], 'question': selected['question_id'],
            'expression':expression, 'key':str(key), 'first':first['raw_answer'], 'last':last['raw_answer'],
            'excluded_id':next(b['id'] for b in bundles if day(b) == 28)}


def inspect_json(path, ref):
    data = json.loads(path.read_bytes())
    item = data['firstDifficulty']
    assert [s['id'] for s in data['sessions']] == [ref['id']]
    actual = (data['completed'], data['counts']['N'], data['counts']['C'],
              data['counts']['firstCorrect'], data['counts']['retryCount'])
    assert actual == (1, 1, 1, 0, 1)
    assert item['attempt'] == ref['id'] and item['at'] == ref['start']
    assert (item['first'],item['final'],item['after_key']) == (ref['first'],ref['last'],True)
    assert f"{item['key']['numerator']}/{item['key']['denominator']}" == ref['key']
    assert data['core']['period_start_utc'] == '2026-11-28T17:00:00.000Z'
    assert data['core']['period_end_exclusive_utc'] == '2026-11-29T17:00:00.000Z'
    return {'counts':actual,'first':item['first'],'last':item['final'],'key':ref['key'],'included_id':ref['id']}


def inspect_table(path, ref):
    if path.suffix == '.xlsx':
        book=load_workbook(path, read_only=True, data_only=True)
        try:
            tables={name:list(book[name].values) for name in ('Sessions','Math','Summary')}
        finally:
            book.close()
    else:
        tables=defaultdict(list)
        with path.open(encoding='utf-8-sig', newline='') as f:
            for sheet,*row in csv.reader(f):
                tables[sheet].append(row)
    _, session = tables['Sessions']
    _, math = tables['Math']
    assert list(session[:2]) == [ref['id'],ref['start']]
    assert [int(v) for v in session[5:10]] == [1,1,0,0,0]
    assert [int(v) for v in tables['Summary'][1][2:4]] == [1,1]
    actual = list(map(str,math[1:7]))
    numerator,denominator = ref['key'].split('/')
    assert actual == [ref['id'], ref['expression'], numerator, denominator, ref['first'], ref['last']], actual
    return actual


def omml_text(node):
    tag=node.tag.split('}')[-1]
    if tag == 'f':
        return omml_text(node.find('m:num', M)) + '/' + omml_text(node.find('m:den', M))
    if tag == 't':
        return node.text or ''
    return ''.join(omml_text(child) for child in node)


def check_omml(path, ref):
    with ZipFile(path) as z:
        root=ET.fromstring(z.read('word/document.xml'))
    actual=[normalized(omml_text(n)) for n in root.findall('.//m:oMath', M)]
    # Display parentheses around the rational 2/5 are redundant in the linear
    # representation. OMML carries the grouping in the fraction node itself.
    expected=[ref['expression'].replace('(2/5)','2/5'), ref['key'],ref['first'],ref['last']]
    assert actual == [normalized(t) for t in expected],actual
    return actual


def inspect_pdf(path, ref):
    with fitz.open(path) as doc:
        page_checks=[]
        for page in doc:
            words=page.get_text('words')
            assert len(words)>=10
            assert all(0 <= x0 < x1 <= page.rect.width+1 and 0 <= y0 < y1 <= page.rect.height+1
                       for x0,y0,x1,y1,*_ in words)
            raster=page.get_pixmap(matrix=fitz.Matrix(1,1), colorspace=fitz.csGRAY)
            assert sum(value < 64 for value in raster.samples)>150
            page_checks.append({'words':len(words),'raster_sha256':hashlib.sha256(raster.samples).hexdigest()})
        text=normalized(' '.join(p.get_text() for p in doc))
        assert 'Asia/Jakarta' in text
        assert 'Sesiselesaidalamperiodeini:1·Berjalan:0' in text and '29Nov2026,00.00' in text
        # Stacked fraction glyphs have no slash in PDF text. The editable DOM
        # and workbook checks independently establish numerator/denominator roles.
        output=(ref['expression'].replace('(2/5)','2/5'),ref['key'],ref['first'],ref['last'])
        labels=('Soal','Kunci jawaban','Jawaban pertama','Jawaban terakhir')
        projected=normalized(''.join(a+'·'+b.replace('/','') for a,b in zip(labels,output)))
        assert projected in text,(projected,text[text.find('Soal·'):text.find('Revisisetelah')])
    return {'pages':page_checks,'projected_math':projected}


def must_reject(fn,*args):
    try:
        fn(*args)
    except AssertionError:
        return 'rejected the controlled discrepancy'
    raise AssertionError('Invalid control was accepted')


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args()
    out=args.out.resolve()
    out.parent.mkdir(parents=True,exist_ok=True)
    suite=Suite('report-ledger','Synthetic events straddling Jakarta midnight; local structured formats, PDF and LibreOffice')
    artifacts={}
    with tempfile.TemporaryDirectory(prefix='kalibataku-ledger-') as tmp:
        workspace=Path(tmp)
        subprocess.run(['node',str(Path(__file__).with_name('report_emit.mjs')),str(workspace)],check=True)
        for case in CASES:
            folder=workspace/case
            ref=expectation(folder,case)
            suite.check(case+'-ledger','Two event bundles, four validated events in the included attempt; one excluded day',lambda:ref)
            for ext,reader in [('json',inspect_json),('csv',inspect_table),('xlsx',inspect_table),('docx',check_omml),('pdf',inspect_pdf)]:
                path=folder/('report.'+ext)
                suite.check(case+'-'+ext,'Match included session and mathematics for '+ext,lambda:reader(path,ref))
            rendered=folder/'rendered'
            rendered.mkdir()
            subprocess.run(['soffice','-env:UserInstallation='+(workspace/'profile').as_uri(),'--headless',
                            '--convert-to','pdf','--outdir',str(rendered),str(folder/'report.docx')],check=True)
            suite.check(case+'-libreoffice','PDF rendered from actual DOCX preserves labels, math, counts and layout',
                        lambda:inspect_pdf(rendered/'report.pdf',ref))
            suite.check(case+'-reject-key','Mismatched reference answer is detected independently',
                        lambda:must_reject(inspect_table,folder/'report.csv',{**ref,'key':'313/17'}))
            suite.check(case+'-reject-period','The session on the excluded local day is rejected',
                        lambda:must_reject(inspect_json,folder/'report.json',{**ref,'id':ref['excluded_id']}))
            # Keep exactly the synthetic ledger and outputs that the independent readers inspected.
            shutil.copytree(folder, out.parent / 'examples' / case, dirs_exist_ok=True)
            artifacts[case]={p.relative_to(folder).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
                             for p in sorted(folder.rglob('*')) if p.is_file()}
    suite.finish(out, formats=artifacts, libreoffice=subprocess.check_output(['soffice','--version'],text=True).strip())
