"""Verify decoded fields and printed cells in all five native report formats."""
import csv
import hashlib
import json
import platform
import re
import sys
from pathlib import Path
import argparse

import fitz
from docx import Document
from openpyxl import load_workbook

parser = argparse.ArgumentParser()
parser.add_argument("directory", type=Path, nargs="?", default=Path(__file__).resolve().parents[2] / "evidence/v15/reports")
parser.add_argument("--sparse", action="store_true", help="check the frozen AUD15-01 sparse coverage fixture")
args = parser.parse_args()
out = args.directory
node = "arithmetic.addition.g01.l01"
expected = {"passes": 2, "passing_target": 2, "unique": 12, "coverage_target": 12,
            "strategies": 2, "strategy_target": 2, "ready": True}
if args.sparse:
    expected.update(unique=10, ready=False)
observations = []


def verify(extension, values):
    assert values == expected, (extension, values)
    p = out / ("report." + extension)
    observations.append({"file": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "actual": values})


def from_table(row):
    return dict(zip(expected, [int(row[5]), int(row[14]), int(row[6]), int(row[7]), int(row[15]), int(row[16]), bool(int(row[12]))]))


def from_printed(cells):
    assert cells[0] == "1 · L1 · Addition" and cells[-1] in ["Ready", "Not yet"], cells
    pairs = [int(v) for pair in cells[1:4] for v in re.fullmatch(r"(\d+)\s*/\s*(\d+)", pair).groups()]
    return dict(zip(expected, pairs + [cells[-1] == "Ready"]))


report = json.loads((out / "report.json").read_bytes())
raw = next(r for r in report["journey"]["rows"] if r["node_id"] == node)
verify("json", dict(zip(expected, [raw["passing_missions"], raw["rule"]["target_missions"], raw["unique_seen"],
    raw["rule"]["coverage_needed"], raw["strategies_seen"], raw["rule"]["strategies_needed"], raw["ready"]])))

with (out / "report.csv").open(encoding="utf-8-sig", newline="") as f:
    row = next(r[1:] for r in csv.reader(f) if r[:2] == ["Journey", node])
verify("csv", from_table(row))
book = load_workbook(out / "report.xlsx", read_only=True, data_only=True)
verify("xlsx", from_table(next(r for r in book["Journey"].values if r[0] == node)))
book.close()

document = Document(out / "report.docx")
row = next([c.text for c in r.cells] for t in document.tables for r in t.rows if r.cells[0].text == "1 · L1 · Addition")
verify("docx", from_printed(row))
with fitz.open(out / "report.pdf") as pdf:
    row = next(block[4].strip().splitlines() for page in pdf for block in page.get_text("blocks") if block[4].startswith("1 · L1 · Addition\n"))
verify("pdf", from_printed(row))

result = {"status": "PASS", "command": "python3 tests/journey/inspect-report-readiness.py [output-dir]"+(" --sparse" if args.sparse else ""),
          "runtime": platform.python_version(), "scope": "decoded JSON, CSV, XLSX cells, DOCX cells and PDF text blocks",
          "expected": expected, "checks": observations,
          "word_render": "Requires Microsoft Word on the target installation."}
(out / "format-inspection.json").write_text(json.dumps(result, indent=2) + "\n")
print("PASS readiness values from JSON, CSV, XLSX, DOCX and PDF")
