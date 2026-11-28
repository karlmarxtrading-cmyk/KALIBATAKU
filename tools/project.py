"""Build and audit the portable static distribution. Run from any directory."""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "spec"
DIST = ROOT / "dist"
PIN = ROOT / "factory" / "bank-lock.json"
SOURCE = ROOT / "src"
EXCLUDED = {"__pycache__", "node_modules", ".git", ".venv"}
PYTHON = sys.executable


def files(folder):
    return sorted((p for p in folder.rglob("*") if p.is_file() and
                  not EXCLUDED.intersection(p.relative_to(folder).parts) and p.suffix != ".pyc"), key=lambda path:path.relative_to(folder).parts)


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def tree_hash(folder, selected=None):
    h = hashlib.sha256()
    for path in files(folder) if selected is None else sorted(selected,key=lambda p:p.relative_to(folder).parts):
        h.update(f"{digest(path)}  {path.relative_to(folder).as_posix()}\n".encode())
    return h.hexdigest()


def run(*args, cwd=ROOT):
    print("+", *args, flush=True)
    subprocess.run(args, cwd=cwd, check=True)


def source_inputs():
    selected = [p for p in files(ROOT / "factory") if p != PIN and p.suffix in {".py", ".json", ".js", ".mjs"}]
    selected += files(SPEC / "curriculum") + files(SPEC / "planning")
    return selected


def release_sources(root=ROOT):
    directories = (".github/workflows","src", "factory", "tools", "docs/contracts", "spec", "tests")
    metadata = ("package.json", "package-lock.json", "requirements-qa.txt", ".python-version", ".nvmrc", ".gitattributes")
    return [p for folder in directories for p in files(root / folder)] + [root / name for name in metadata]


def verify_app_copy():
    for source in files(SOURCE):
        public = DIST / source.relative_to(SOURCE)
        if source.name == "sw.js" and source.parent == SOURCE:
            release = json.loads((DIST/"offline-assets.json").read_bytes())["release"]
            expected = source.read_text().replace("__KALIBATAKU_BUILD__", release)
            if expected != public.read_text():
                raise ValueError("Published service worker differs from source and release ID")
        elif source.read_bytes() != public.read_bytes():
            raise ValueError(f"Published asset differs from source: {public}")
    manifest = json.loads((ROOT/"evidence/v162/release/release-manifest.json").read_bytes())
    if manifest["dist_tree_sha256"] != tree_hash(DIST) or manifest["source_tree_sha256"] != tree_hash(ROOT,release_sources()):
        raise ValueError("Final release manifest does not match source or distribution")


def bank_pin():
    bank = DIST / "bank"
    if not (bank / "index.json").is_file():
        raise ValueError("Bank belum dibangun. Jalankan npm run bank:build.")
    return {"algorithm": "sha256-of-sorted-sha256-path-lines-v1",
            "source": tree_hash(ROOT, source_inputs()), "bank": tree_hash(bank),
            "file_count": len(files(bank))}


def check_pin():
    if not PIN.is_file() or json.loads(PIN.read_text()) != bank_pin():
        raise ValueError("Checksum factory/bank berubah. Periksa perubahan, bangun dan validasi bank kembali.")


def build():
    check_pin()
    for name in ("index.html", "sw.js", "_headers"):
        if not (SOURCE / name).is_file():
            raise ValueError(f"Missing required source: {name}")
    with tempfile.TemporaryDirectory(prefix=".build-", dir=ROOT) as tmp:
        tmp = Path(tmp)
        staging = tmp / "dist"
        shutil.copytree(SOURCE, staging, ignore=shutil.ignore_patterns("__pycache__", "*.map"))
        # These are immutable checked files. Only the surrounding directory is exchanged.
        try:
            shutil.copytree(DIST / "bank", staging / "bank", copy_function=os.link)
        except OSError:
            shutil.rmtree(staging / "bank", ignore_errors=True)
            shutil.copytree(DIST / "bank", staging / "bank")
        run("node", "tests/data/build-offline.mjs", str(staging))
        backup = tmp / "previous"
        os.replace(DIST, backup)
        try:
            os.replace(staging, DIST)
        except BaseException:
            os.replace(backup, DIST)
            raise
    print("dist", tree_hash(DIST), len(files(DIST)), "files")


def curriculum():
    run(PYTHON, "qa/source_audit_verifier.py", cwd=SPEC)
    run(PYTHON, "qa/source_audit_verifier.py", "--registry",
        "curriculum/KALIBATAKU_CURRICULUM_REGISTRY_v1_0_DRAFT2.json", "--patched", cwd=SPEC)
    run(PYTHON, "qa/verify_handoff.py", cwd=SPEC)
    cells = json.loads((SPEC/"planning/competency_plan.json").read_bytes())["cells"]
    rows = json.loads((ROOT/"evidence/bank/coverage.json").read_bytes())
    graph = {r["competency_id"]:r["prerequisites"] for r in rows}
    if set(graph) != {c["competency_id"] for c in cells if c["active"]}:
        raise ValueError("Active curriculum/recipe coverage differs")
    visited = set()
    def visit(node, branch):
        if node in branch or node not in graph:
            raise ValueError(f"Invalid prerequisite: {node}")
        if node not in visited:
            for prerequisite in graph[node]:
                visit(prerequisite,branch | {node})
            visited.add(node)
    for node in graph:
        visit(node,set())
    print(f"{len(graph)} active recipes and prerequisite graph verified.")


def compile_sources():
    for folder in ("src", "factory", "tools", "tests"):
        for path in files(ROOT / folder):
            if path.suffix in {".js", ".mjs"}:
                run("node", "--check", str(path))
            elif path.suffix == ".py":
                compile(path.read_bytes(), str(path), "exec")
            elif path.suffix in {".json", ".webmanifest"}:
                json.loads(path.read_bytes())


def tests(record=False):
    config = json.loads((ROOT / "tests" / "commands.json").read_text())
    # Some suites generate realistic sample exports. Leave the signed evidence in this tree intact.
    with tempfile.TemporaryDirectory(prefix="kalibataku-tests-") as tmp:
        tmp = Path(tmp)
        for name in ("src", "spec", "tests", "tools"):
            shutil.copytree(ROOT/name, tmp/name, ignore=shutil.ignore_patterns("__pycache__"))
        (tmp/"package.json").write_bytes((ROOT/"package.json").read_bytes())
        for name in ("player", "data", "ui", "teacher"):
            (tmp/"evidence"/name).mkdir(parents=True)
        try:
            shutil.copytree(DIST,tmp/"dist",copy_function=os.link)
        except OSError:
            shutil.rmtree(tmp/"dist",ignore_errors=True)
            shutil.copytree(DIST,tmp/"dist")
        for cmd in config:
            run(*[PYTHON if a == "{python}" else a for a in cmd],cwd=tmp)
        if record:
            shutil.copytree(tmp/"evidence", ROOT/"evidence", dirs_exist_ok=True)


def verify():
    check_pin()
    verify_app_copy()
    inventory = json.loads((ROOT / "FILE_INVENTORY.json").read_bytes())
    from release_pack import check_name
    declared = set()
    for row in inventory["files"]:
        rel = row["path"]
        check_name(rel)
        if rel in declared or rel in {"FILE_INVENTORY.json", "SHA256SUMS"}:
            raise ValueError(f"Invalid repeated or reserved inventory path: {rel}")
        declared.add(rel)
        p = ROOT / rel
        if p.is_symlink():
            raise ValueError(f"Symbolic link in release: {rel}")
        if p.stat().st_size != row["bytes"] or digest(p) != row["sha256"]:
            raise ValueError(f"Content verification failed: {p}")
    expected = {row["path"] for row in inventory["files"]} | {"FILE_INVENTORY.json", "SHA256SUMS"}
    present = {p.relative_to(ROOT).as_posix() for p in files(ROOT)}
    if expected != present:
        raise ValueError(f"Inventory differs: {sorted(expected ^ present)[:10]}")
    verified_paths = set()
    for line in (ROOT / "SHA256SUMS").read_text().splitlines():
        sha, rel = line.split("  ", 1)
        if rel not in expected or rel in verified_paths:
            raise ValueError(f"Unexpected or duplicate checksum path: {rel}")
        verified_paths.add(rel)
        if digest(ROOT / rel) != sha:
            raise ValueError(f"Checksum mismatch: {rel}")
    if verified_paths != expected - {"SHA256SUMS"}:
        raise ValueError("Checksum list must cover every payload file and FILE_INVENTORY.json")
    status = json.loads((ROOT / "RELEASE_STATUS.json").read_bytes())
    # The shared evaluator verifies the entire suite binding and regenerates the
    # decision and both active registers without trusting their existing labels.
    run(PYTHON, "tools/auto_release.py", "--verify")
    print("Verified inventory, distribution, bank sources, release evidence and QA binding", flush=True)
    print(f"Verified {len(verified_paths)} checksums / source {status['source_tree_sha256']} / dist {status['dist_tree_sha256']}", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("curriculum", "bank", "build", "check", "test", "verify"))
    parser.add_argument("--record", action="store_true", help="Copy fresh reports after all component tests pass")
    options = parser.parse_args()
    action = options.action
    if options.record and action != "test":
        parser.error("--record is only available for test")
    if action == "bank":
        # Stage a new bank so failed generation leaves the currently served modules usable.
        DIST.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".build-bank-", dir=ROOT) as work:
            work = Path(work)
            next_bank, next_evidence = work/"bank", work/"evidence"
            run(PYTHON, "factory/build_bank.py", "--output", str(next_bank), "--evidence", str(next_evidence))
            generation = json.loads((next_evidence/"summary.json").read_bytes())
            if generation["active_competencies"] != 281 or generation["package_count"] != 4604:
                raise ValueError("Incomplete bank generation")
            prior, live = work/"prior", DIST/"bank"
            if live.exists(): os.replace(live,prior)
            try:
                os.replace(next_bank,live)
            except BaseException:
                if prior.exists(): os.replace(prior,live)
                raise
            (ROOT/"evidence/bank").mkdir(parents=True,exist_ok=True)
            for generated in next_evidence.iterdir():
                os.replace(generated,ROOT/"evidence/bank"/generated.name)
            PIN.write_text(json.dumps(bank_pin(), indent=2) + "\n")
    else:
        {"curriculum": curriculum, "build": build, "check": compile_sources,
         "test": lambda: tests(options.record), "verify": verify}[action]()


if __name__ == "__main__":
    main()
