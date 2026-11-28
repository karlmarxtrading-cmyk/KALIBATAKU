"""Verify the 1.6.0 archives, both copies of the audit report, and the supplied inventories."""

import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

import pymupdf


SOURCE_SHA = "94620186f0c6f6d530531db2d8f083ef0d3356a0603d7bdd23eff98ec707714d"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def index(archive):
    entries = {}
    for info in archive.infolist():
        name = info.filename
        path = PurePosixPath(name)
        assert not path.is_absolute() and ".." not in path.parts and "\\" not in name, name
        assert name not in entries and name == path.as_posix() and not info.is_dir(), name
        # Reading each entry also verifies the uncompressed CRC recorded by ZipFile.
        data = archive.read(info)
        assert len(data) == info.file_size, name
        entries[name] = (len(data), digest(data), f"{info.CRC:08x}")
    return entries


def verify_sums(data, observed, excluded):
    declared = {}
    for line in data.decode("utf-8-sig").splitlines():
        sha, name = line.split("  ", 1)
        assert name not in declared and len(sha) == 64, name
        declared[name] = sha
    assert set(declared) == set(observed) - set(excluded), "Incomplete manifest"
    for name, sha in declared.items():
        assert sha == observed[name][1], name
    return len(declared)


def compare_pdfs(separate_pdf, contained_pdf):
    rows = []
    with pymupdf.open(separate_pdf) as separate, pymupdf.open(stream=contained_pdf, filetype="pdf") as contained:
        assert len(separate) == len(contained) == 13
        for i in range(len(separate)):
            left, right = separate[i], contained[i]
            assert left.rect == right.rect and left.get_text() == right.get_text(), f"Text or page size changed on {i+1}"
            first, second = left.get_pixmap(), right.get_pixmap()
            assert (first.width, first.height, first.samples) == (second.width, second.height, second.samples), i + 1
            rows.append({
                "page": i + 1,
                "text_sha256": digest(left.get_text().encode()),
                "render72_rgb_sha256": digest(first.samples),
                "pixels": [first.width, first.height],
            })
    return rows


def verify(args):
    with ZipFile(args.candidate) as src, ZipFile(args.audit) as audit:
        baseline = index(src)
        assert file_digest(args.candidate) == SOURCE_SHA
        assert len(baseline) == 6922
        declared = json.loads(src.read("FILE_INVENTORY.json"))["files"]
        entries = {row["path"]: (row["bytes"], row["sha256"]) for row in declared}
        assert len(entries) == len(declared)
        assert entries == {
            name: row[:2] for name, row in baseline.items()
            if name not in {"FILE_INVENTORY.json", "SHA256SUMS"}
        }
        checks = verify_sums(src.read("SHA256SUMS"), baseline, ["SHA256SUMS"])

        full_audit = index(audit)
        roots = {PurePosixPath(path).parts[0] for path in full_audit}
        assert len(roots) == 1
        prefix = roots.pop() + "/"
        audited = {name.removeprefix(prefix): row for name, row in full_audit.items()}
        checksum_name = "SHA256SUMS_AUDIT.txt"
        audit_checks = verify_sums(audit.read(prefix + checksum_name), audited, [checksum_name])
        pdf_rows = compare_pdfs(args.pdf, audit.read(prefix + "01_LAPORAN_AUDIT.pdf"))
        declared_csv = list(csv.DictReader(io.StringIO(
            audit.read(prefix + "05_INVENTARIS_SELURUH_6922_FILE.csv").decode("utf-8-sig")
        )))
        predicted = {row["path"]: (int(row["size_bytes"]), row["sha256"]) for row in declared_csv}
        assert len(declared_csv) == len(predicted) == len(baseline)
        assert predicted == {name: row[:2] for name, row in baseline.items()}

        with (args.output / "inventaris-arsip-audit.csv").open("w", encoding="utf-8", newline="") as target:
            writer = csv.writer(target, lineterminator="\n")
            writer.writerow(["path", "bytes", "sha256", "crc32"])
            writer.writerows((name, *audited[name]) for name in sorted(audited))

        chronology = []
        for name in ("offline-firefox", "offline-legacy-firefox-rerun", "offline-firefox-repeat"):
            path = "07_BUKTI/rilis/" + name + ".json"
            receipt = json.loads(audit.read(prefix + path))
            counts = dict(Counter(row["status"] for row in receipt["checks"]))
            chronology.append({
                "audit_path": path, "started": receipt["started"],
                "engine": receipt["engine"], "status": receipt["status"],
                "counts": counts, "sha256": audited[path][1],
            })
        separate_pdf_sha = file_digest(args.pdf)
        audit_pdf_sha = audited["01_LAPORAN_AUDIT.pdf"][1]
        return {
            "status": "PASS",
            "observed_utc": datetime.now(timezone.utc).isoformat(),
            "source_archive": {
                "name": args.candidate.name, "bytes": args.candidate.stat().st_size,
                "sha256": SOURCE_SHA, "expanded_bytes": sum(row[0] for row in baseline.values()),
                "files_crc_ok": len(baseline), "file_inventory_rows": len(declared),
                "sha256sums_rows": checks, "rows_matching_external_audit": len(predicted),
            },
            "audit_archive": {
                "name": args.audit.name, "bytes": args.audit.stat().st_size,
                "sha256": file_digest(args.audit), "files_crc_ok": len(audited),
                "sha256sums_rows": audit_checks, "separate_pdf_byte_identical": separate_pdf_sha == audit_pdf_sha,
                "audit_pdf_sha256": audit_pdf_sha, "pdf_text_raster_matches": pdf_rows,
                "pymupdf": pymupdf.VersionBind, "separate_pdf_sha256": separate_pdf_sha,
                "firefox_offline_history_from_audit": chronology,
            },
            "baseline_release": json.loads(src.read("RELEASE_STATUS.json"))["release_label"],
            "baseline_build": json.loads(src.read("dist/offline-assets.json"))["release"],
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("candidate", "audit", "pdf", "output"):
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    if not __debug__:
        parser.error("This verifier requires assertions. Run Python without optimization.")
    args.output.mkdir(exist_ok=True, parents=True)
    result = verify(args)
    with (args.output / "identitas-masukan.json").open("w", encoding="utf-8", newline="\n") as target:
        json.dump(result, target, indent=2, ensure_ascii=False)
        target.write("\n")
    print(f"PASS {result['source_archive']['files_crc_ok']} source files, "
          f"{result['audit_archive']['files_crc_ok']} audit files, "
          "PDF text and rendering at 72 dpi reconciled on 13 pages.")


if __name__ == "__main__":
    main()
