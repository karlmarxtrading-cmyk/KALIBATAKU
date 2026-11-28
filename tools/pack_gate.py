"""Check the payload and retained evidence for the automatic package roundtrip."""
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

from project import files, digest

PROOF = Path("evidence/v162/release/zip-roundtrip.json")
PROOF_LOGS = PROOF.parent / "roundtrip-logs"
OUTPUTS = {
    "FILE_INVENTORY.json", "SHA256SUMS", "RELEASE_STATUS.json", "STATUS_RILIS.md",
    "REGISTER_OTOMATIS.csv", "REGISTER_PEMETAAN_HISTORIS.csv",
    PROOF.as_posix(),
}
# Work copies may collect domain/native receipts after the immutable ZIP is delivered.
# Both manifests and the final archive readback still cover any file packaged.
SEPARATE_PHASES = {Path("evidence/v162/deployment"), Path("evidence/v162/native-windows")}
ACTIONS = ("verify", "build", "verify")
HEX = re.compile(r"[a-f0-9]{64}")


def payload_identity(root):
    """Bind package-phase inputs independently of the outer seal and subsequent deployment."""
    tree = hashlib.sha256()
    count = total = 0
    for path in files(root):
        rel = path.relative_to(root)
        if rel.as_posix() in OUTPUTS or PROOF_LOGS in rel.parents or SEPARATE_PHASES.intersection(rel.parents):
            continue
        tree.update(f"{digest(path)}  {rel.as_posix()}\n".encode())
        count += 1
        total += path.stat().st_size
    return {"files": count, "bytes": total, "sha256": tree.hexdigest()}


def stamp_valid(value):
    return isinstance(value, str) and datetime.fromisoformat(value).utcoffset() is not None


def verify_roundtrip(root, build, binding_sha256):
    """Empty on a valid seal rehearsal for this payload, otherwise report the reason."""
    root = Path(root)
    try:
        proof = json.loads((root / PROOF).read_bytes())
        if proof["schema"] != "kalibataku-release-roundtrip/1" or proof["scope"] != "sealed-trial" or proof["status"] != "PASS":
            return ["Unexpected package roundtrip schema, scope or result"]
        if proof["build"] != build or proof["build_after"] != build or proof["binding_sha256"] != binding_sha256:
            return ["Package roundtrip describes another build or suite binding"]
        binding = json.loads((root / "evidence/v162/qa/binding.json").read_bytes())
        if proof["registry_sha256"] != binding["registry_sha256"] or proof["registry_sha256"] != digest(root / "tests/qa/suites.json"):
            return ["Suite registry differs from seal rehearsal"]
        if proof["runtime"]["os"] != "Linux" or not proof["runtime"]["python"] or not proof["runtime"]["node"]:
            return ["Canonical Linux extraction did not run"]
        if not (stamp_valid(proof["started_utc"]) and stamp_valid(proof["finished_utc"])
                and datetime.fromisoformat(proof["started_utc"]) <= datetime.fromisoformat(proof["finished_utc"])):
            return ["Invalid package roundtrip timestamps"]
        archive = proof["archive"]
        if not (isinstance(archive,dict) and HEX.fullmatch(archive["sha256"]) and type(archive["bytes"]) is int
                and archive["bytes"] > 0 and type(archive["files"]) is int and archive["files"] > 0):
            return ["Invalid roundtrip archive observations"]
        payload = payload_identity(root)
        if payload != proof["payload"] or payload != proof["extracted_payload"]:
            return ["Sealable payload differs from the extracted release rehearsal"]
        steps = proof["steps"]
        if not isinstance(steps,list) or len(steps)!=len(ACTIONS):
            return ["Incomplete extraction rehearsal"]
        expected_logs = {f"{i+1}-{action}.log" for i,action in enumerate(ACTIONS)}
        if {p.name for p in (root / PROOF_LOGS).iterdir()} != expected_logs:
            return ["Roundtrip log directory differs from the three expected records"]
        for index,(action,record) in enumerate(zip(ACTIONS, steps)):
            name = f"{index + 1}-{action}.log"
            rel = PROOF_LOGS / name
            if (record["command"] != ["python", "tools/project.py", action] or type(record["exit"]) is not int
                    or record["exit"] != 0 or record["log"] != rel.as_posix() or digest(root / rel) != record["sha256"]):
                return [f"Invalid command evidence for {name}"]
            lines=(root / rel).read_text(encoding="utf-8").splitlines()
            if index == 0 and f"ZIP readback {archive['sha256']} {archive['bytes']} bytes {archive['files']} files" not in lines:
                return ["Archive byte count or SHA-256 differs from the extraction log"]
            if action == "build":
                expected = f"dist {build['dist_tree_sha256']} {proof['dist_file_count']} files"
            else:
                expected = f"Verified {archive['files']-1} checksums / source {build['source_tree_sha256']} / dist {build['dist_tree_sha256']}"
            if expected not in lines:
                return [f"Unexpected output from {name}"]
        if proof["dist_file_count"] != len(files(root / "dist")):
            return ["Distribution file count differs"]
    except (KeyError, TypeError, ValueError, OSError, UnicodeError, AttributeError) as exc:
        return [f"Invalid package roundtrip evidence: {exc}"]
    return []
