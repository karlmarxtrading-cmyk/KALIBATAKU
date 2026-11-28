"""Rehearse a release, or validate the final ZIP before making its name available."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
from zipfile import ZipFile

from pack_gate import ACTIONS, PROOF, PROOF_LOGS, payload_identity, verify_roundtrip
from project import ROOT, digest, files, verify_app_copy
import qa_core
from release_pack import archive, index_payload, safe_extract, write_json


def utc():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def assess(flag, root=ROOT):
    subprocess.run([sys.executable, "tools/auto_release.py", flag], cwd=root, check=True)


def validate_archive(path, destination, expected_build, scope, expected_payload, archive_result):
    started = utc()
    root = destination / "Checkout Linux verification"
    safe_extract(path, root)
    with ZipFile(path) as source_zip:
        archive_count = len(source_zip.infolist())
    archive_size = path.stat().st_size
    archive_hash = digest(path)
    if (archive_count, archive_size, archive_hash) != (archive_result["files"], archive_result["bytes"], archive_result["sha256"]):
        raise ValueError("Extraction input differs from the ZIP writer's observations")
    ident = qa_core.identity(root)
    if ident != expected_build:
        raise ValueError("Safe extraction has a different source or distribution")
    observed = payload_identity(root)
    if observed != expected_payload:
        raise ValueError("Extracted file set or bytes differ from signed payload")
    log_dir = destination / "logs"
    log_dir.mkdir()
    steps = []
    for index, action in enumerate(ACTIONS):
        name = f"{index+1}-{action}.log"
        command = ["tools/project.py", action]
        with (log_dir / name).open("wb") as f:
            if index == 0:
                f.write(f"ZIP readback {archive_hash} {archive_size} bytes {archive_count} files\n".encode())
                f.flush()
            proc = subprocess.run([sys.executable, *command], cwd=root, stdout=f, stderr=subprocess.STDOUT)
        steps.append({"command": ["python", *command], "exit": proc.returncode,
                      "log": (PROOF_LOGS / name).as_posix(), "sha256": digest(log_dir / name)})
        if proc.returncode != 0:
            raise ValueError(f"Extracted {action} failed: " + (log_dir / name).read_text(encoding="utf-8", errors="replace")[-2000:])
    after = qa_core.identity(root)
    if after != ident or observed != payload_identity(root):
        raise ValueError("A clean rebuild changed a release member")
    binding = root / "evidence/v162/qa/binding.json"
    return {"schema": "kalibataku-release-roundtrip/1", "scope": scope, "status": "PASS",
            "started_utc": started, "finished_utc": utc(), "runtime": {
                "os": platform.system(), "platform": platform.platform(), "python": platform.python_version(),
                "node": subprocess.check_output(["node", "--version"],text=True).strip()},
            "build": ident, "build_after": after, "binding_sha256": digest(binding),
            "registry_sha256": digest(root / "tests/qa/suites.json"),
            "payload": expected_payload, "extracted_payload": observed, "archive": archive_result,
            "dist_file_count": len(files(root / "dist")), "steps": steps}


def assert_binding():
    problems = qa_core.verify_binding(ROOT, ROOT / "evidence/v162/qa", ROOT / "tests/qa/suites.json", check_runtime=False)
    if problems:
        raise ValueError("Current suite binding is invalid: " + "; ".join(problems[:5]))
    binding = json.loads((ROOT / "evidence/v162/qa/binding.json").read_bytes())
    if binding["status"] != "PASS":
        raise ValueError("Every required automated suite must pass before packaging")
    return binding["build"]


def rehearse():
    if platform.system() != "Linux":
        raise ValueError("The canonical artifact must be rehearsed on Linux")
    build = assert_binding()
    # The previous rehearsal's own output cannot participate in its input digest.
    (ROOT / PROOF).unlink(missing_ok=True)
    shutil.rmtree(ROOT / PROOF_LOGS,ignore_errors=True)
    assess("--write")
    assess("--verify")
    verify_app_copy()
    stable = payload_identity(ROOT)
    index_payload()
    with tempfile.TemporaryDirectory(prefix="kalibataku automatic rehearsal ") as directory:
        temp = Path(directory)
        path = temp / "candidate.zip"
        report = archive(path, files(ROOT))
        result = validate_archive(path, temp, build, "sealed-trial", stable, report)
        shutil.copytree(temp / "logs", ROOT / PROOF_LOGS)
        write_json(ROOT / PROOF, result)
    problems = verify_roundtrip(ROOT, build, digest(ROOT / "evidence/v162/qa/binding.json"))
    if problems:
        raise ValueError("; ".join(problems))
    print("PASS sealed trial, checked payload before and after the clean rebuild", stable["sha256"])


def seal_final(output):
    output = Path(output).resolve()
    if output.is_relative_to(ROOT):
        raise ValueError("Put the final ZIP outside the source checkout")
    build = assert_binding()
    required = f"KALIBATAKU_{build['app_version']}_PRODUCTION_READY.zip"
    if output.name != required:
        raise ValueError(f"Use the release filename {required}")
    assess("--verify")
    status = json.loads((ROOT / "RELEASE_STATUS.json").read_bytes())
    if status.get("artifact_status") != "ARTIFACT_READY":
        raise ValueError("All required gates must pass before publishing this filename")
    verify_app_copy()
    stable = payload_identity(ROOT)
    index_payload()
    output.parent.mkdir(parents=True,exist_ok=True)
    # A failing check never replaces an existing delivery or creates a READY ZIP.
    with tempfile.TemporaryDirectory(prefix=".kalibataku-package-",dir=output.parent) as staging:
        staged = Path(staging) / "staged.zip"
        report = archive(staged, files(ROOT))
        with tempfile.TemporaryDirectory(prefix="kalibataku final inspection ") as directory:
            temp = Path(directory)
            result = validate_archive(staged,temp,build,"delivery",stable,report)
            final_logs = output.parent / (output.name + ".verification-logs")
            final_logs.mkdir(exist_ok=True)
            for step in result["steps"]:
                name = Path(step["log"]).name
                dest = final_logs / name
                shutil.copyfile(temp/"logs"/name, dest)
                step["log"]=dest.relative_to(output.parent).as_posix()
        if digest(staged) != result["archive"]["sha256"]:
            raise ValueError("Final ZIP changed during verification")
        result["file"] = output.name
        receipt = Path(staging) / "delivery.json"
        write_json(receipt, result)
        os.replace(staged, output)
        os.replace(receipt, output.with_suffix(".verified.json"))
    print(json.dumps({"file":output.name,"decision":status["artifact_status"], **report}))


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
    rehearse()
