"""Compare the frozen 1.6.0 bank with 1.6.1, then reconcile its complete pedagogical mapping."""

import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import platform
from zipfile import ZipFile


BASELINE_SHA = "94620186f0c6f6d530531db2d8f083ef0d3356a0603d7bdd23eff98ec707714d"
MAPPINGS = (
    "all_4604_packages_mapping.csv",
    "all_281_active_competencies.csv",
    "all_60_stages.csv",
)
FROZEN_DIRECTORIES = (
    "factory/",
    "spec/curriculum/",
    "spec/planning/",
    "src/journey/v1/",
    "dist/journey/v1/",
)


def file_sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def tree_hash(rows):
    digest = hashlib.sha256()
    for path in sorted(rows, key=lambda name: tuple(name.split("/"))):
        digest.update(f"{rows[path]}  {path}\n".encode("utf-8"))
    return digest.hexdigest()


def mapping_rows(archive, filename):
    content = archive.read("evidence/v160/audit-input/" + filename).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(content)))


def compare_bank(archive, root, out):
    previous = {name for name in archive.namelist() if name.startswith("dist/bank/")}
    current = {
        path.relative_to(root).as_posix()
        for path in (root / "dist/bank").rglob("*") if path.is_file()
    }
    assert current == previous and len(previous) == 4677, "Unexpected bank file set"
    hashes = {}
    compared = []
    for name in sorted(previous):
        old = archive.read(name)
        new = (root / name).read_bytes()
        assert old == new, f"Bank bytes changed: {name}"
        old_sha = hashlib.sha256(old).hexdigest()
        new_sha = hashlib.sha256(new).hexdigest()
        hashes[name.removeprefix("dist/bank/")] = new_sha
        compared.append((name, len(new), old_sha, new_sha, "PASS"))
    with (out / "bank-per-berkas.csv").open("w", encoding="utf-8", newline="") as target:
        writer = csv.writer(target, lineterminator="\n")
        writer.writerow(["path", "bytes", "sha256_1.6.0", "sha256_kandidat", "byte_comparison"])
        writer.writerows(compared)
    return hashes


def verify_preserved_sources(archive, root):
    counts = {}
    for prefix in FROZEN_DIRECTORIES:
        previous = {name for name in archive.namelist() if name.startswith(prefix)}
        current = {
            path.relative_to(root).as_posix()
            for path in (root / prefix).rglob("*")
            if path.is_file() and "__pycache__" not in path.parts
        }
        assert current == previous, f"Unexpected file set: {prefix}"
        for name in previous:
            assert archive.read(name) == (root / name).read_bytes(), name
        counts[prefix] = len(current)

    pin = json.loads(archive.read("factory/bank-lock.json"))
    sources = {}
    for name in archive.namelist():
        is_spec = name.startswith(("spec/curriculum/", "spec/planning/"))
        is_factory_source = (
            name.startswith("factory/") and name != "factory/bank-lock.json"
            and Path(name).suffix in {".py", ".js", ".mjs", ".json"}
        )
        if is_spec or is_factory_source:
            sources[name] = hashlib.sha256(archive.read(name)).hexdigest()
    assert tree_hash(sources) == pin["source"], "Generator and curriculum pin mismatch"
    return counts, pin


def verify_graph(archive, root, hashes):
    route = json.loads((root / "dist/journey/v1/route.json").read_bytes())
    nodes = {node["competency_id"]: node for node in route["nodes"] if node["active"]}
    stages = {stage["stage_id"]: stage for stage in route["stages"]}
    packages, competencies, steps = [mapping_rows(archive, file) for file in MAPPINGS]
    assert {r["competency_id"] for r in competencies} == nodes.keys()
    assert len(competencies) == len(nodes)
    assert {row["stage_id"] for row in steps} == stages.keys()
    assert len(steps) == len(stages)
    for row in steps:
        stage = stages[row["stage_id"]]
        active = [nodes[key] for key in stage["nodes"] if key in nodes]
        assert [node["operation"] for node in active] == row["active_operations"].split("+")
        assert len(active) == int(row["active_nodes"])
        assert active[-1]["competency_id"] == row["checkpoint_anchor"]

    shards = {}
    for row in competencies:
        node = nodes[row["competency_id"]]
        assert row["stage_id"] == node["stage_id"]
        assert [key for key in row["prerequisites"].split("|") if key] == node["prerequisites"]
        assert node["placements"] == int(row["placements"])
        assert node["unique_items"] == int(row["unique"])
        occurrence = node["occ"]
        contents = (root / "dist" / occurrence["url"]).read_bytes()
        assert len(contents) == occurrence["bytes"]
        assert hashlib.sha256(contents).hexdigest() == occurrence["sha256"]
        pack_list = json.loads(contents)["packages"]
        assert len(pack_list) == int(row["packages"])
        for package in pack_list:
            package_id = package["package_id"]
            assert package_id not in shards, f"Duplicate occurrence package: {package_id}"
            shards[package_id] = package

    assert len(packages) == len(shards) == len({row["package_id"] for row in packages})
    fingerprints = set()
    families = set()
    placements = 0
    uses = Counter()
    by_node = Counter()
    for row in packages:
        name = row["path"]
        raw = (root / name).read_bytes()
        assert raw.startswith(b"export default ") and raw.rstrip().endswith(b";"), name
        pack = json.loads(raw[len(b"export default "):].rstrip()[:-1])
        ident = pack["package_id"]
        competency = pack["target_competency_id"]
        assert ident == row["package_id"] and competency == row["competency_id"], name
        assert nodes[competency]["stage_id"] == row["stage_id"], name
        shard = shards.pop(ident)
        count = len(pack["questions"])
        placements += count
        by_node[competency] += count
        assert hashes[name.removeprefix("dist/bank/")] == row["sha256"] == shard["package_sha256"], name
        assert pack["purpose"] == row["purpose"], name
        assert (pack["form_id"] or "") == row["formal_form"], name
        assert shard["use"] == row["mission_use"], name
        assert count == int(row["questions"]) == pack["question_count"] == len(shard["q"]), name
        for field in ("grade", "level", "operation"):
            assert str(pack[field]) == row[field], name
        assert bool(pack["form_id"]) == (shard["use"] == "assessment_form_reserved"), name
        uses[shard["use"]] += 1
        local = set()
        for index, (item, occurrence) in enumerate(zip(pack["questions"], shard["q"], strict=True)):
            fingerprint = item["fingerprint"]
            families.add(item["template_id"])
            local.add(fingerprint)
            assert item["competency_id"] == competency, (name, index)
            assert occurrence[0] == index and occurrence[1] == fingerprint[:16], (name, index)
            assert occurrence[9] == item["template_id"], (name, index)
        assert len(local) == int(row["unique_questions"]), name
        fingerprints.update(local)

    assert not shards
    for competency, node in nodes.items():
        assert by_node[competency] == node["placements"], competency
    formal = uses["assessment_form_reserved"]
    inventory = {
        "files": len(hashes),
        "packages": len(packages),
        "placements": placements,
        "unique_fingerprints": len(fingerprints),
        "active_competencies": len(nodes),
        "stages": len(stages),
        "prerequisites": sum(len(node["prerequisites"]) for node in nodes.values()),
        "families": len(families),
        "formal_packages": formal,
        "teaching_packages": len(packages) - formal,
    }
    assert inventory == json.loads(archive.read("evidence/v160/inventaris-konten.json"))["combined"]
    return inventory, dict(uses)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_1_6_0", type=Path)
    parser.add_argument("root_kandidat", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if not __debug__:
        parser.error("This verifier requires assertions. Run Python without optimization.")
    root = args.root_kandidat.resolve()
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    assert file_sha256(args.zip_1_6_0) == BASELINE_SHA, "Incorrect 1.6.0 archive"
    app = json.loads((root / "dist/build-info.json").read_bytes())
    assert app["app_version"] == "1.6.1", f"Expected 1.6.1 candidate, obtained {app['app_version']}"
    with ZipFile(args.zip_1_6_0) as archive:
        hashes = compare_bank(archive, root, out)
        counts, pin = verify_preserved_sources(archive, root)
        assert tree_hash(hashes) == pin["bank"] and len(hashes) == pin["file_count"]
        content, uses = verify_graph(archive, root, hashes)

    dist = root / "dist"
    distribution = {
        path.relative_to(dist).as_posix(): file_sha256(path)
        for path in dist.rglob("*") if path.is_file()
    }
    release = json.loads((dist / "offline-assets.json").read_bytes())["release"]
    record = {
        "status": "PASS",
        "observed_utc": datetime.now(timezone.utc).isoformat(),
        "platform": platform.platform(),
        "python": platform.python_version(),
        "baseline_sha256": BASELINE_SHA,
        "app_version": app["app_version"],
        "offline_release": release,
        "dist_tree_sha256": tree_hash(distribution),
        "generator_and_bank_pin": pin,
        "identical_scope_counts": counts,
        "bank_changes": {"added": 0, "removed": 0, "modified": 0},
        "baseline_and_combined": content,
        "additional": {"packages": 0, "placements": 0, "unique_fingerprints": 0},
        "package_uses": uses,
        "mapping_files": ["evidence/v160/audit-input/" + name for name in MAPPINGS],
    }
    with (out / "bank-dan-pemetaan.json").open("w", encoding="utf-8", newline="\n") as target:
        json.dump(record, target, indent=2, ensure_ascii=False)
        target.write("\n")
    print("PASS", json.dumps(content), release, record["dist_tree_sha256"])


if __name__ == "__main__":
    main()
