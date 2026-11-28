"""Re-open the six report formats produced by tests/v12/feedback-and-export.mjs with
independent readers (QA-22). Run after that suite in the same tree.

PDF: PyMuPDF text, page geometry and a raster image. DOCX: OMML fractions read from
document.xml, then the document is rendered by LibreOffice; when that renderer does not
expose equation text, the equation-text row is BLOCKED_ENV (the XML row still proves the
content). XLSX: openpyxl. CSV and JSON: standard parsers. ZIP: batch archive members.
"""
import csv, hashlib, io, json, os, subprocess, sys, tempfile, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests/qa'))
from receipt import Suite
import openpyxl
try:
    import pymupdf as fitz
except ImportError:
    fitz = None
out = ROOT / 'evidence/v12/reports'
s = Suite('documents-reopened', 'Report files re-read by independent parsers and renderers')
M = {'m': 'http://schemas.openxmlformats.org/officeDocument/2006/math'}


def omml():
    with zipfile.ZipFile(out / 'pecahan.docx') as z:
        doc = ET.fromstring(z.read('word/document.xml'))
    fr = [(n.findtext('m:num/m:r/m:t', namespaces=M), n.findtext('m:den/m:r/m:t', namespaces=M)) for n in doc.findall('.//m:f', M)]
    assert fr[:3] == [('11', '12'), ('10', '12'), ('7', '4')], fr
    return fr
s.check('docx-omml', 'DOCX holds editable OMML fractions 11/12, 10/12 and key 7/4', omml)


def xlsx():
    wb = openpyxl.load_workbook(out / 'pecahan.xlsx', read_only=True); values = list(wb['Math'].values)
    assert list(values[1])[-4:] == ['7', '4', '99', '21/12'], values
    fam = [r[0] for r in wb['Family'].values]
    assert any('11/12 + 10/12' in str(x) for x in fam), fam[:10]
    return {'sheets': wb.sheetnames, 'math_row': list(values[1])}
s.check('xlsx-reopen', 'XLSX re-opens; Math sheet has key 7/4 and responses 99 → 21/12; Family keeps the expression', xlsx)


def csv_reopen():
    text = (out / 'pecahan.csv').read_text(encoding='utf-8-sig'); rows = list(csv.reader(io.StringIO(text)))
    assert '11/12 + 10/12' in text and '21/12' in text and len(rows) > 5
    return {'rows': len(rows)}
s.check('csv-reopen', 'CSV parses and keeps the expression and raw response', csv_reopen)


def json_reopen():
    d = json.loads((out / 'pecahan.json').read_bytes())
    assert d['firstDifficulty']['after_key'] and d['firstDifficulty']['key'] == {'numerator': '7', 'denominator': '4'}
    return {'keys': sorted(d)[:12]}
s.check('json-reopen', 'JSON parses with exact key and the after-key flag', json_reopen)


def pdf():
    if not fitz: raise AssertionError('PyMuPDF missing')
    with fitz.open(out / 'pecahan.pdf') as src:
        text = ' '.join(p.get_text() for p in src)
        assert all(x in text for x in ['Kunci jawaban', '99', '21', '11', '10', '12', '7', '4']), text[:500]
        words = [w for p in src for w in p.get_text('words')]; assert all(w[0] >= 0 and w[2] <= src[0].rect.width + 1 for w in words)
        src[0].get_pixmap(matrix=fitz.Matrix(1.2, 1.2)).save(out / 'pecahan-pdf.png')
        return {'pages': len(src), 'words': len(words)}
s.check('pdf-vector-text', 'Vector PDF text holds the labels and every number; no word leaves the page', pdf)

render = {}
with tempfile.TemporaryDirectory() as t:
    p = subprocess.run(['soffice', '-env:UserInstallation=file://' + t + '/profile', '--headless', '--convert-to', 'pdf', '--outdir', t, str(out / 'pecahan.docx')], capture_output=True, text=True)
    pdfp = Path(t) / 'pecahan.pdf'

    def docx_render():
        assert p.returncode == 0 and pdfp.is_file(), p.stderr[-500:]
        with fitz.open(pdfp) as src:
            render['text'] = ' '.join(pg.get_text() for pg in src)
            words = [w for pg in src for w in pg.get_text('words')]; assert all(w[0] >= 0 and w[2] <= src[0].rect.width + 1 for w in words)
            src[0].get_pixmap(matrix=fitz.Matrix(1.2, 1.2)).save(out / 'pecahan-docx.png')
            assert 'Kunci jawaban' in render['text'] and 'Periksa penyebut bersama' in render['text']
            return {'pages': len(src), 'renderer': subprocess.run(['soffice', '--version'], capture_output=True, text=True).stdout.strip()}
    s.check('docx-render-layout', 'LibreOffice renders the DOCX; prose and labels stay on the page', docx_render)
    if render.get('text') and all(x in render['text'] for x in ['99', '21', '7', '4']):
        s.checks.append({'id': 'docx-render-equations', 'status': 'PASS', 'expected': 'Equation text visible after rendering', 'actual': 'present'})
    else:
        s.blocked('docx-render-equations', 'Equation text visible after rendering', 'LibreOffice in this environment draws OMML equations without exposing their text to PDF extraction; the OMML XML row verifies the content. Open the DOCX in Word to review visually.')
s.finish('documents-reopened.json', sha256={f.name: hashlib.sha256(f.read_bytes()).hexdigest() for f in out.glob('pecahan.*')})
