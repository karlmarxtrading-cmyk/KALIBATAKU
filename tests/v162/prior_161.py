"""Load the fixed production-test input independently of the candidate build.

The historical inventory is authenticated by the digest from the received
1.6.1 ZIP. An explicit input must be that exact archive. For self-contained
reruns, unchanged distribution members come from the checkout, while differing
historical members are restored from the small release-specific fixture.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import sys
import tempfile
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))
import qa_core

ZIP_SHA = "37169d1c06edd8216acd3a263282004d893494c74d3dabc6dcb9376e9d7bf198"
INVENTORY_SHA = "8a6b7a151e262b87b02fd76519cc1f2cdcaccebbb33c5ca254f4d8e9e2c3e46d"
DIST_SHA = "9693b517c9ef39df3e03a264e5484a7d83281b87673f204c654737e29fe4653b"
OLD_RELEASE = "a2f40449c4738fe6"
BANK_SHA = "6811a3554f5ecc3f0626bd258553f08016484c38e5acbe902fd1c34881f0fd43"
SOURCE_PIN = "a3a1b7d30d5594d13a295410e82e8f02ddc744bdd97178b8142465402bad997e"
ARCHIVED = ROOT / "evidence/v162/history-1.6.1/FILE_INVENTORY.json"
DELTA = Path(__file__).resolve().parent / "fixtures/prior-1.6.1-assets.zip"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def file_hash(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def tree_from_hashes(hashes):
    accumulator = hashlib.sha256()
    for name in sorted(hashes, key=lambda n: tuple(n.split("/"))):
        accumulator.update(f"{hashes[name]}  {name}\n".encode())
    return accumulator.hexdigest()


def inventory():
    require(file_hash(ARCHIVED) == INVENTORY_SHA, "1.6.1 inventory is missing or changed")
    entries = json.loads(ARCHIVED.read_bytes())["files"]
    indexed = {row["path"]: row for row in entries}
    require(len(indexed) == len(entries) == 7416, "Invalid 1.6.1 inventory cardinality")
    return indexed


@contextmanager
def original_archive():
    supplied = os.environ.get("KALIBATAKU_BASELINE_161")
    if not supplied:
        yield None
        return
    archive = Path(supplied)
    require(archive.is_file() and file_hash(archive) == ZIP_SHA,
            "KALIBATAKU_BASELINE_161 must point to the original, digest-matching 1.6.1 ZIP")
    with ZipFile(archive) as z:
        yield z


@contextmanager
def old_distribution():
    members = {name: row for name, row in inventory().items() if name.startswith("dist/")}
    with tempfile.TemporaryDirectory(prefix="kalibataku-old-161-") as t, original_archive() as original:
        old = Path(t) / "dist"
        # When no external input was supplied, reconstruct just the prior dist
        # in a throwaway directory. Hardlinks are read-only from the test.
        with ZipFile(DELTA) as fallback:
            overrides = set(fallback.namelist())
            require(overrides <= members.keys(), "Unrecognized prior release fixture member")
            for name, row in members.items():
                path = Path(t) / name
                path.parent.mkdir(parents=True, exist_ok=True)
                if original is None and name not in overrides:
                    source = ROOT / name
                    try:
                        os.link(source, path)
                    except OSError:
                        shutil.copyfile(source, path)
                else:
                    source_zip = original or fallback
                    with source_zip.open(name) as src, path.open("wb") as dest:
                        shutil.copyfileobj(src, dest)
                require(path.stat().st_size == row["bytes"] and file_hash(path) == row["sha256"],
                        f"Old distribution member differs from authenticated inventory: {name}")
        require(len(members) == 5054 and qa_core.tree_hash(old) == DIST_SHA,
                "Reconstructed 1.6.1 distribution hash mismatch")
        yield old, "original-1.6.1-zip" if original else "reconstructed-authenticated-1.6.1-dist"


def run_receipt(suite, scope, output, exercise):
    started = timestamp()
    build = qa_core.identity(ROOT)
    rows = []
    def check(key, expected, actual, passed):
        rows.append({"id": key, "expected": expected, "actual": actual,
                     "status": "PASS" if passed else "FAIL"})
    meta = {}
    try:
        exercise(check, meta)
    except Exception as exc:
        import traceback
        check("execution-error", "All test operations complete", traceback.format_exc(), False)
    status = "PASS" if rows and all(r["status"] == "PASS" for r in rows) else "FAIL"
    result = {"schema": "kalibataku-qa-receipt/1", "suite": suite, "scope": scope,
              "started": started, "finished": timestamp(), "build": build, "status": status,
              "runtime": {"os": platform.platform(), "python": platform.python_version()},
              "assertions": len(rows), "checks": rows, "baseline": meta}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8", newline="\n")
    print(suite, status, len(rows), "checks", [r["id"] for r in rows if r["status"] != "PASS"])
    return 0 if status == "PASS" else 1
