"""Compare every frozen bank path, size and SHA-256, plus corresponding source rules."""
import argparse
import hashlib
import json
from pathlib import Path

from prior_161 import (
    BANK_SHA, INVENTORY_SHA, ROOT, SOURCE_PIN, ZIP_SHA, file_hash, inventory,
    original_archive, run_receipt, tree_from_hashes,
)


def exercise(check, metadata):
    previous = inventory()
    app = json.loads((ROOT / "dist/build-info.json").read_bytes())
    check("historical-inventory", "Authenticated 1.6.1 inventory",
          {"rows": len(previous), "sha256": INVENTORY_SHA}, len(previous) == 7416)
    scope = "dist/bank/"
    frozen = {n[len(scope):]: r for n, r in previous.items() if n.startswith(scope)}
    bank = ROOT / "dist/bank"
    present = {p.relative_to(bank).as_posix(): p for p in bank.rglob("*") if p.is_file()}
    missing, extra = sorted(frozen.keys() - present), sorted(present.keys() - frozen)
    check("file-set", "Exact 4677 frozen paths, neither missing nor extra",
          {"count": len(present), "missing": missing, "extra": extra},
          len(present) == len(frozen) == 4677 and not missing and not extra)

    rows, changed, bad_counts = [], [], 0
    hashes = {}
    with original_archive() as z:
        mode = "direct-byte-and-digest" if z else "authenticated-size-and-sha256"
        for name in sorted(frozen.keys() & present):
            raw = present[name].read_bytes()
            digest = hashlib.sha256(raw).hexdigest()
            old = frozen[name]
            size_ok = len(raw) == old["bytes"]
            same = digest == old["sha256"] and size_ok and (z is None or z.read(scope + name) == raw)
            if not same:
                changed.append(name)
            if not size_ok:
                bad_counts += 1
            hashes[name] = digest
            rows.append([name, len(raw), digest])
    metadata.update(archive_sha256=ZIP_SHA, inventory_sha256=INVENTORY_SHA, method=mode)
    check("frozen-bytes", "Each member matches its 1.6.1 bytes or committed SHA-256 and size",
          {"method": mode, "changed": changed, "columns": ["path", "bytes", "sha256"],
           "files": rows}, not missing and not extra and not changed)
    check("member-sizes", "All 4677 sizes match the prior inventory",
          {"checked": len(rows), "mismatches": bad_counts}, len(rows) == 4677 and bad_counts == 0)

    pin_file = ROOT / "factory/bank-lock.json"
    pin = json.loads(pin_file.read_bytes())
    current_tree = tree_from_hashes(hashes)
    check("pinned-bank-tree", "Match the historical bank tree commitment",
          {"current": current_tree, "historical": BANK_SHA, "pin": pin["bank"], "count": pin["file_count"]},
          current_tree == pin["bank"] == BANK_SHA and pin["file_count"] == 4677)
    check("pin-file-unchanged", "Exact original factory lock bytes",
          {"current": file_hash(pin_file), "historical": previous["factory/bank-lock.json"]["sha256"]},
          file_hash(pin_file) == previous["factory/bank-lock.json"]["sha256"])
    source_hashes = {}
    for folder in ("factory", "spec/curriculum", "spec/planning"):
        for p in (ROOT / folder).rglob("*"):
            if not p.is_file() or "__pycache__" in p.parts or p == pin_file:
                continue
            if folder == "factory" and p.suffix not in (".py", ".json", ".js", ".mjs"):
                continue
            source_hashes[p.relative_to(ROOT).as_posix()] = file_hash(p)
    source_tree = tree_from_hashes(source_hashes)
    check("generator-and-curriculum", "Independent original generator/curriculum digest",
          {"files": len(source_hashes), "current": source_tree, "pin": pin["source"]},
          source_tree == pin["source"] == SOURCE_PIN)
    index = json.loads((bank / "index.json").read_bytes())
    expected = {"package_count": 4604, "question_slots": 177640,
                "unique_canonical_items": 168142, "active_competencies": 281, "version": "1.2.0"}
    actual = {k: index[k] for k in expected}
    check("public-bank-version-and-counts", expected, actual,
          actual == expected and app["bank_version"] == index["version"])
    check("package-members", "4604 immutable package modules",
          sum(n.endswith(".mjs") for n in present), sum(n.endswith(".mjs") for n in present) == 4604)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True, type=Path)
    raise SystemExit(run_receipt("bank-freeze-161", "All frozen public bank bytes and generator pin",
                                 ap.parse_args().out, exercise))
