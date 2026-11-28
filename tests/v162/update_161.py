"""Run the production worker and complete a real upgrade/downgrade on one local origin."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from prior_161 import DIST_SHA, OLD_RELEASE, ROOT, ZIP_SHA, old_distribution, require, run_receipt
import qa_core

PHASES = (
    "baseline", "update waiting in two tabs", "update workers", "update resumed",
    "candidate cache", "offline candidate reload", "rollback waiting in two tabs",
    "rollback workers", "rollback resumed", "rollback cache", "offline rollback reload",
    "completed after rollback offline",
)


def exercise(check, metadata):
    candidate = qa_core.identity(ROOT)
    with old_distribution() as (old, method), tempfile.TemporaryDirectory(prefix="kalibataku-update-161-") as t:
        output = Path(t)
        command = [sys.executable, "tests/v15/update-rollback-local.py", str(old),
                   "--candidate", "dist", "--out", str(output)]
        probe = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
        proof_file = output / "update-rollback.json"
        require(proof_file.is_file(), probe.stderr[-3500:] or "Browser probe did not finish")
        proof = json.loads(proof_file.read_bytes())
        metadata.update(method=method, archive_sha256=ZIP_SHA, old=proof["baseline"],
                        new=proof["candidate"], browser=proof.get("engine"),
                        observed_utc=[proof.get("started"), proof.get("completed")],
                        page_errors=proof.get("page_errors"), probe_exit=probe.returncode)
        require(probe.returncode == 0 and proof["status"] == "PASS",
                proof.get("failure") or probe.stderr[-3500:])
    assess(proof, candidate, check)


def assess(proof, candidate, check, root=ROOT, live=False):
    old_id = proof["baseline"]["release"]
    new_id = proof["candidate"]["release"]
    require(old_id == OLD_RELEASE and old_id != new_id and proof["baseline"]["dist_tree_sha256"] == DIST_SHA,
            "Update target baseline is not the received 1.6.1")
    require(new_id == candidate["offline_release"] and proof["candidate"]["app"] == candidate["app_version"]
            and proof["candidate"]["dist_tree_sha256"] == candidate["dist_tree_sha256"],
            "Update exercised another distribution")
    require(proof.get("page_errors") == [], "Browser reported an unhandled page error")
    require([row["phase"] for row in proof["observations"]] == list(PHASES) + (["restored candidate"] if live else []),
            "Missing or repeated observations in the two-way update sequence")
    rows = {r["phase"]: r for r in proof["observations"]}
    reference = rows["baseline"]["snapshot"]
    baseline_cache = rows["baseline"]["cache"]
    package = baseline_cache["package"]
    for phase in PHASES:
        row = rows[phase]
        target = new_id if phase == "candidate cache" else old_id
        if phase == "baseline" or phase.endswith(" cache"):
            cache = row["cache"]
            expected = "All shell members, package bytes and ready marker match the installed release"
            minimum = len(json.loads((root / "dist/offline-assets.json").read_bytes())["assets"]) if target == new_id else 71
            passed = (cache["shell_assets_verified"] == minimum and cache["release"] == target
                      and cache["installed_release"] == target and cache["package"] == package
                      and cache["pack_sha256"] == baseline_cache["pack_sha256"])
            if phase == "baseline":
                passed = passed and row["draft"] == "37/9" and set(reference) == {"frozen", "events", "responses"}
        elif phase.endswith(" workers"):
            expected = "Two controlled tabs retain prior worker while the new worker waits"
            prior = old_id if phase.startswith("update") else new_id
            passed = row["two_clients"] == [prior, prior] and row["next_worker"] == "installed/waiting"
        elif phase == "completed after rollback offline":
            expected = "The offline mission completes exactly once; its first response stays intact"
            passed = row["completion_events"] == 1 and row["preserved_first_response"] is True and row["items"] == 6
        else:
            expected = "Same frozen questions/order, first response and events, with the saved draft 37/9"
            passed = row["draft"] == "37/9" and row["immutable_fields"] == reference
        check(phase.replace(" ", "-"), expected, row, passed)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True, type=Path)
    raise SystemExit(run_receipt("update-161", "Chromium, same loopback origin, two controlled tabs, "
                                 "IndexedDB and real service worker cache; local update and rollback",
                                 ap.parse_args().out, exercise))
