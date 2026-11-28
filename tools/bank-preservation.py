#!/usr/bin/env python3
"""BANK-01/BANK-02: compare the public bank bytes with the manifest frozen from the
audited 1.3.0 source (SHA-256 5d0a6a1c…) before any change. Zero changed, zero missing,
zero added files under dist/bank, plus 4,604 packages and 177,640 placements.
  python3 tools/bank-preservation.py [--write-after]"""
import hashlib, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
BEFORE = ROOT / "evidence/v14/bank/bank-manifest-before-1.3.0.json"
AFTER = ROOT / "evidence/v162/release/bank-manifest-after.json"
bank = ROOT / "dist" / "bank"
now = {p.relative_to(bank).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(bank.rglob("*"),key=lambda p:p.relative_to(bank).parts) if p.is_file()}
before = json.loads(BEFORE.read_text())["sha256"]
changed = sorted(k for k in before if k in now and now[k] != before[k])
missing = sorted(k for k in before if k not in now)
added = sorted(k for k in now if k not in before)
sys.path.insert(0, str(ROOT / "tools"))
from project import tree_hash  # same algorithm as the frozen manifest
tree = tree_hash(bank)
index = json.loads((bank / "index.json").read_text())
report = {"files_before": len(before), "files_now": len(now), "changed": changed, "missing": missing, "added": added,
          "tree_sha256_before": json.loads(BEFORE.read_text())["tree_sha256"], "tree_sha256_now": tree,
          "package_count": index["package_count"], "question_slots": index["question_slots"]}
if "--write-after" in sys.argv:
    AFTER.write_text(json.dumps({"files": len(now), "tree_sha256": tree, "sha256": now}, indent=0) + "\n")

ok = report["tree_sha256_before"] == tree and not changed and not missing and not added and len(now) == 4677 and index["package_count"] == 4604 and index["question_slots"] == 177640
print(json.dumps({k: (v if not isinstance(v, list) else len(v)) for k, v in report.items()}))
print("bank preserved: 4677 files byte-identical" if ok else "BANK CHANGED")
sys.exit(0 if ok else 1)
