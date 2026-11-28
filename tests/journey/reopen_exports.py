"""Read the published journey fixture with independent parsers and compare its representations."""
import csv
import json
import sys
from pathlib import Path

import docx
import fitz
import openpyxl

folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / 'evidence/v15/exports'
model = json.loads((folder / 'journey-report.json').read_bytes())['journey']
expected = {r['node_id']: r for r in model['rows']}
assert expected
with fitz.open(folder / 'journey-report.pdf') as pdf:
    pdf_text = ' '.join(' '.join(page.get_text().split()) for page in pdf)
doc = docx.Document(str(folder / 'journey-report.docx'))
doc_text = ' '.join(p.text for p in doc.paragraphs) + ' ' + ' '.join(
    cell.text for table in doc.tables for row in table.rows for cell in row.cells
)
book = openpyxl.load_workbook(folder / 'journey-report.xlsx', read_only=True, data_only=True)
sheet = list(book['Journey'].values)
book.close()
with (folder / 'journey-report.csv').open(encoding='utf-8-sig', newline='') as source:
    csv_rows = [row[1:] for row in csv.reader(source) if row and row[0]=='Journey']

def correct_rows(rows):
    headers = rows[0]
    actual = {r[0]: dict(zip(headers,r)) for r in rows[1:]}
    fields = {'Misi periode':'missions','Misi lulus kumulatif':'passing_missions',
              'Soal unik kumulatif':'unique_seen','Siap lanjut':'ready','XP periode':'xp'}
    return actual.keys()==expected.keys() and all(
        int(actual[node][column]) == int(snapshot[field])
        for node,snapshot in expected.items() for column,field in fields.items()
    )

def correct_text(text):
    normalized = ' '.join(text.split())
    return all(term in normalized for term in (
        'Kesiapan petualangan', model['mission_policy'], 'Misi dalam periode',
        'XP mencatat usaha.', 'Evaluasi A/B mengukur penguasaan formal.'
    ))

out = {'pdf':correct_text(pdf_text), 'docx':correct_text(doc_text),
       'xlsx':correct_rows(sheet), 'csv':correct_rows(csv_rows), 'json':bool(expected)}
print(json.dumps(out))
sys.exit(0 if all(out.values()) else 1)
