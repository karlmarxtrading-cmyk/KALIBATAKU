#!/usr/bin/env python3
"""Build the versioned journey metadata sidecar (KALIBATAKU adventure route).

Read-only over the public bank: every bank file is opened for reading only and its
bytes are never rewritten. The output is a separate, versioned sidecar:

  src/journey/v1/route.json          stages, nodes (all 300 competencies), edges
  src/journey/v1/occ/<cid>.json      one compact row per placement of that competency
  evidence/v15/journey/coverage-matrix.csv  placements by competency x use x band
  evidence/v15/journey/summary.json   counts and validation results

Difficulty is an AUTHORED HEURISTIC computed from the question AST. It is not a
psychometric calibration and the files say so (reviewer_status=authored_heuristic).

Usage: python3 tools/build-journey.py [--check]
  --check  regenerate in memory and fail when the committed sidecar differs.
"""
import csv, hashlib, io, json, math, sys
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BANK = ROOT / "dist" / "bank"
OUT = ROOT / "src" / "journey" / "v1"
EVID = ROOT / "evidence" / "v15" / "journey"
METADATA_VERSION = "1.0.0"
ROUTE_VERSION = "route-1.1.0"
FEATURE_POLICY = "difficulty-heuristic-1.0.0"
OPS = ["ADD", "SUB", "MUL", "DIV", "MIX"]
OP_NAME = {"ADD": ("Penjumlahan", "Addition"), "SUB": ("Pengurangan", "Subtraction"),
           "MUL": ("Perkalian", "Multiplication"), "DIV": ("Pembagian", "Division"),
           "MIX": ("Operasi campuran", "Mixed operations")}
# Missions only draw from teaching material. Assessment forms stay reserved for
# formal evaluation, so A/B forms are never exposed early through practice.
USE = {"introduce": "mission_intro", "consolidate": "mission_core", "transfer": "mission_apply",
       "review": "mission_review", "assessment": "assessment_form_reserved"}
FEATURES = ["digits", "ops", "depth", "carry", "borrow", "pair10", "pair100", "basic_fact",
            "anchor", "factor_pair", "fraction", "decimal", "negative", "denominators",
            "conversion", "inter_digits"]


def load_json(path):
    with open(path, "rb") as f:
        return json.loads(f.read())


def load_package(rel):
    with open(BANK.parent / rel, "rb") as f:
        raw = f.read()
    text = raw.decode("utf-8")
    assert text.startswith("export default ") and text.rstrip().endswith(";"), rel
    return json.loads(text[len("export default "):text.rstrip().rfind(";")]), hashlib.sha256(raw).hexdigest()


def value(node):
    if node["kind"] == "rational":
        return Fraction(int(node["numerator"]), int(node["denominator"]))
    a, b = value(node["left"]), value(node["right"])
    op = node["operation"]
    return a + b if op == "ADD" else a - b if op == "SUB" else a * b if op == "MUL" else a / b


def leaves(node):
    if node["kind"] == "rational":
        return [node]
    return leaves(node["left"]) + leaves(node["right"])


def binaries(node):
    if node["kind"] == "rational":
        return []
    return [node] + binaries(node["left"]) + binaries(node["right"])


def depth(node):
    return 0 if node["kind"] == "rational" else 1 + max(depth(node["left"]), depth(node["right"]))


def digits_of(fr):
    n = abs(fr.numerator) // abs(fr.denominator) if fr.denominator else 0
    return len(str(n))


def column_events(a, b, op):
    """Carries (ADD) or borrows (SUB) for two non-negative integers."""
    if a < 0 or b < 0:
        return 0
    count, c = 0, 0
    if op == "ADD":
        while a or b:
            s = a % 10 + b % 10 + c
            c = 1 if s >= 10 else 0
            count += c
            a //= 10; b //= 10
        return count
    if a < b:
        a, b = b, a
    while a or b:
        d = a % 10 - c - b % 10
        c = 1 if d < 0 else 0
        count += c
        a //= 10; b //= 10
    return count


def near_round(x):
    x = abs(x)
    if x < 9 or x.denominator != 1:
        return False
    p = 10 ** (len(str(int(x))) - 1)
    for r in (p, 10 * p):
        if 0 < abs(int(x) - r) <= 2:
            return True
    return False


FACTOR_PAIRS = {(2, 5), (4, 25), (8, 125), (2, 50), (4, 250), (5, 20), (2, 500)}


def features(q):
    ast = q["expression_ast"]
    ls, bs = leaves(ast), binaries(ast)
    vals = [Fraction(int(x["numerator"]), int(x["denominator"])) for x in ls]
    f = dict.fromkeys(FEATURES, 0)
    f["digits"] = max(digits_of(v) for v in vals)
    f["ops"] = len(bs)
    f["depth"] = depth(ast)
    dens = set()
    for x, v in zip(ls, vals):
        kind = (x.get("display") or {}).get("kind", "integer")
        if v.denominator != 1 or kind in ("fraction", "mixed"):
            f["fraction"] = 1
            dens.add(v.denominator)
        if kind == "decimal":
            f["decimal"] = 1
        if v < 0:
            f["negative"] = 1
    f["denominators"] = len(dens)
    f["conversion"] = 1 if f["fraction"] and f["decimal"] else 0
    inter = 0
    for b in bs:
        l, r = value(b["left"]), value(b["right"])
        res = value(b)
        inter = max(inter, digits_of(res))
        if res < 0:
            f["negative"] = 1
        if l.denominator == 1 and r.denominator == 1:
            li, ri = int(l), int(r)
            if b["operation"] in ("ADD", "SUB"):
                key = "carry" if b["operation"] == "ADD" else "borrow"
                f[key] += column_events(li, ri, b["operation"])
                if b["operation"] == "ADD" and li > 0 and ri > 0:
                    if (li + ri) % 100 == 0:
                        f["pair100"] = 1
                    elif (li + ri) % 10 == 0:
                        f["pair10"] = 1
            if b["operation"] in ("MUL", "DIV"):
                pair = tuple(sorted((abs(li), abs(ri))))
                if pair in FACTOR_PAIRS:
                    f["factor_pair"] = 1
            if len(bs) == 1 and abs(li) <= 10 and abs(ri) <= 10 and res.denominator == 1 and abs(res) <= 100:
                f["basic_fact"] = 1
    if any(near_round(v) for v in vals):
        f["anchor"] = 1
    f["inter_digits"] = inter
    return f


def score(f):
    s = (f["digits"] * 1.0 + f["carry"] * 0.8 + f["borrow"] * 0.8 + max(0, f["ops"] - 1) * 1.5 +
         f["depth"] * 0.5 + f["fraction"] * 1.5 + f["decimal"] * 1.0 + f["negative"] * 1.0 +
         max(0, f["denominators"] - 1) * 1.0 + f["conversion"] * 1.0 + f["inter_digits"] * 0.3 -
         f["basic_fact"] * 1.0 - (f["pair10"] + f["pair100"]) * 0.5 - f["factor_pair"] * 0.5)
    return round(s * 10)


def build():
    index = load_json(BANK / "index.json")
    nodes, stages, occ, coverage = [], [], {}, []
    totals = {"placements": 0, "packages": 0, "by_use": {}}
    for gref in index["grades"]:
        grade = load_json(BANK.parent / gref["url"])
        for lref in grade["levels"]:
            lvl = load_json(BANK.parent / lref["url"])
            stage_id = "S-G%02d-L%02d" % (lvl["grade"], lvl["level"])
            stage = {"stage_id": stage_id, "order": len(stages), "grade": lvl["grade"], "level": lvl["level"],
                     "focus": lvl["focus"], "nodes": []}
            for comp in sorted(lvl["competencies"], key=lambda c: OPS.index(c["operation"])):
                cid = comp["competency_id"]
                stage["nodes"].append(cid)
                rows, scores = [], []
                for pref in comp["packages"]:
                    pkg, sha = load_package(pref["url"])
                    assert sha == pref["sha256"] and pkg["package_id"] == pref["package_id"]
                    assert len(pkg["questions"]) == pref["question_count"]
                    use = USE[pref["purpose"]]
                    totals["packages"] += 1
                    qrows = []
                    for i, q in enumerate(pkg["questions"]):
                        assert q["competency_id"] == cid
                        f = features(q)
                        sc = score(f)
                        scores.append(sc)
                        qrows.append([i, q["question_id"], q["question_revision"], q["fingerprint"], sc, f])
                        totals["placements"] += 1
                        totals["by_use"][use] = totals["by_use"].get(use, 0) + 1
                    rows.append((pref, pkg, sha, use, qrows))
                # Bands are rank tertiles of the heuristic score over the competency's
                # unique items (ties broken by fingerprint, so a repeated item keeps one
                # band). band 1 is the easiest third. This is ordering, not calibration.
                uniq = {}
                for _pref, _pkg, _sha, _use, qrows in rows:
                    for i, qid, rev, fp, sc, f in qrows:
                        uniq.setdefault(fp, sc)
                ranked = sorted(uniq, key=lambda fp: (uniq[fp], fp))
                band_of = {fp: 1 + (3 * r) // max(1, len(ranked)) for r, fp in enumerate(ranked)}
                distinct_scores = len(set(uniq.values()))
                cut1 = cut2 = None
                seen_fp = {}
                pk_rows = []
                strategies, domains = set(), set()
                for pref, pkg, sha, use, qrows in rows:
                    out = []
                    for i, qid, rev, fp, sc, f in qrows:
                        band = band_of[fp]
                        # roles: w=warm-up, t=target, a=apply. A question may serve several.
                        roles = ("w" if band == 1 else "") + ("t" if band in (1, 2) or use == "mission_core" else "") + \
                                ("a" if band == 3 or use == "mission_apply" else "")
                        repeat = seen_fp.get(fp)
                        seen_fp.setdefault(fp, "%s#%d" % (pkg["package_id"], i))
                        q = pkg["questions"][i]
                        dom = "signed" if f["negative"] else "fraction_decimal" if f["conversion"] else "fraction" if f["fraction"] else "decimal" if f["decimal"] else "integer"
                        out.append([i, fp[:16], band, sc, roles or "t", [f[k] for k in FEATURES], repeat,
                                    "+".join(q.get("strategy_tags") or []), dom, q["template_id"]])
                        if use != "assessment_form_reserved":
                            strategies.update(q.get("strategy_tags") or [])
                            domains.add(dom)
                        coverage.append((cid, pkg["package_id"], use, band))
                    pk_rows.append({"package_id": pkg["package_id"], "content_version": pkg["content_version"],
                                    "package_sha256": sha, "purpose": pref["purpose"], "form_id": pref["form_id"],
                                    "use": use, "q": out})
                prereq = [p for p in comp["prerequisites"]]
                node = {"competency_id": cid, "stage_id": stage_id, "grade": lvl["grade"], "level": lvl["level"],
                        "operation": comp["operation"], "active": comp["active"], "title": comp["title"],
                        "skill": {"id": OP_NAME[comp["operation"]][0] + " · " + lvl["focus"]["id"],
                                  "en": OP_NAME[comp["operation"]][1] + " · " + lvl["focus"]["en"]},
                        "bank_prerequisites": prereq, "pool_size": comp["pool_size"],
                        "placements": sum(len(r["q"]) for r in pk_rows),
                        "unique_items": len(seen_fp),
                        "teaching_unique": len({q[1] for r in pk_rows if r["use"] != "assessment_form_reserved" for q in r["q"]}),
                        "teaching_strategies": sorted(strategies), "domains": sorted(domains),
                        "distinct_scores": distinct_scores,
                        "band_basis": "score_rank_tertile" if distinct_scores >= 3 else "rank_tertile_tiebreak_fingerprint"}
                nodes.append(node)
                if comp["active"]:
                    occ[cid] = {"schema": "kalibataku-journey-occurrences/1", "metadata_version": METADATA_VERSION,
                                "feature_policy": FEATURE_POLICY, "reviewer_status": "authored_heuristic",
                                "competency_id": cid, "feature_keys": FEATURES,
                                "row_format": ["question_index", "fingerprint16", "band", "score10", "roles", "features", "repeat_of", "strategy_tags", "domain", "template_id"],
                                "packages": pk_rows}
                else:
                    assert not pk_rows, cid
            stages.append(stage)
    # Journey prerequisites: the bank graph restricted to active nodes. An inactive
    # prerequisite is replaced by its own (transitive) active prerequisites.
    by_id = {n["competency_id"]: n for n in nodes}
    def active_prereqs(cid, trail=()):
        out = []
        for p in by_id[cid]["bank_prerequisites"]:
            if p in trail:
                raise ValueError("cycle at " + p)
            if by_id[p]["active"]:
                out.append(p)
            else:
                out.extend(active_prereqs(p, trail + (p,)))
        return sorted(set(out))
    edges = []
    for n in nodes:
        n["prerequisites"] = active_prereqs(n["competency_id"]) if n["active"] else []
        n["bypassed_inactive"] = sorted(p for p in n["bank_prerequisites"] if not by_id[p]["active"])
        for p in n["prerequisites"]:
            edges.append([p, n["competency_id"]])
    order = [n["competency_id"] for n in nodes]
    route = {"schema": "kalibataku-journey-route/1", "metadata_version": METADATA_VERSION,
             "route_version": ROUTE_VERSION, "feature_policy": FEATURE_POLICY,
             "reviewer_status": "authored_heuristic", "bank_content_version": index["version"],
             "mission_policy": {"policy_version": "mission-policy-1.1.0",
                                "intro": {"size": 6, "roles": {"w": 2, "t": 4}},
                                "regular": {"size": 8, "roles": {"w": 2, "t": 4, "a": 2}},
                                "checkpoint": {"size": 10, "roles": {"w": 2, "t": 5, "a": 3}},
                                "readiness": {"target_missions": 2, "first_response_unassisted_min": 0.8,
                                              "coverage_min_unique": 12, "strategy_min": 2, "label": "product_policy_not_psychometric"}},
             "stages": stages, "order": order, "nodes": nodes}
    return route, occ, coverage, totals, edges


def validate(route, occ, totals, edges):
    nodes = {n["competency_id"]: n for n in route["nodes"]}
    active = [c for c, n in nodes.items() if n["active"]]
    errors = []
    if len(nodes) != 300: errors.append("node count %d" % len(nodes))
    if len(active) != 281: errors.append("active count %d" % len(active))
    if set(occ) != set(active): errors.append("occurrence shards differ from active set")
    # references and acyclicity
    for c, n in nodes.items():
        for p in n["prerequisites"]:
            if p not in nodes or not nodes[p]["active"]:
                errors.append("bad prerequisite %s -> %s" % (c, p))
    state = {}
    def visit(c):
        if state.get(c) == 1: raise ValueError("cycle " + c)
        if state.get(c) == 2: return
        state[c] = 1
        for p in nodes[c]["prerequisites"]: visit(p)
        state[c] = 2
    for c in active: visit(c)
    # route order is a topological order
    pos = {c: i for i, c in enumerate(route["order"])}
    for p, c in edges:
        if pos[p] >= pos[c]: errors.append("order violates %s -> %s" % (p, c))
    roots = [c for c in active if not nodes[c]["prerequisites"]]
    # first subtraction must not require addition beyond its own grade
    first_sub = next(c for c in route["order"] if nodes[c]["active"] and nodes[c]["operation"] == "SUB")
    anc, stack = set(), [first_sub]
    while stack:
        for p in nodes[stack.pop()]["prerequisites"]:
            if p not in anc: anc.add(p); stack.append(p)
    if any(nodes[a]["grade"] > nodes[first_sub]["grade"] for a in anc):
        errors.append("first subtraction requires later-grade addition")
    if totals["placements"] != 177640: errors.append("placements %d" % totals["placements"])
    if totals["packages"] != 4604: errors.append("packages %d" % totals["packages"])
    mapped = sum(len(p["q"]) for s in occ.values() for p in s["packages"])
    if mapped != 177640: errors.append("mapped %d" % mapped)
    return {"nodes": len(nodes), "active": len(active), "inactive": len(nodes) - len(active), "edges": len(edges),
            "roots": roots, "acyclic": True, "topological_order": not any(e.startswith("order") for e in errors),
            "first_subtraction": first_sub, "first_subtraction_ancestors": sorted(anc),
            "placements_mapped": mapped, "packages": totals["packages"], "by_use": totals["by_use"],
            "errors": errors}


def dumps(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=False) + "\n"


def main():
    check = "--check" in sys.argv
    route, occ, coverage, totals, edges = build()
    report = validate(route, occ, totals, edges)
    files = {}
    by_id = {n["competency_id"]: n for n in route["nodes"]}
    for cid, shard in occ.items():
        text = dumps(shard)
        files[OUT / "occ" / (cid + ".json")] = text
        raw = text.encode("utf-8")
        by_id[cid]["occ"] = {"url": "journey/v1/occ/" + cid + ".json", "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)}
    files[OUT / "route.json"] = dumps(route)
    agg = {}
    for cid, pkg, use, band in coverage:
        k = (cid, use); agg.setdefault(k, [0, 0, 0]); agg[k][band - 1] += 1
    buf = io.StringIO(); w = csv.writer(buf, lineterminator="\n")
    w.writerow(["competency_id", "use", "band1", "band2", "band3", "total"])
    for (cid, use), b in sorted(agg.items()):
        w.writerow([cid, use, *b, sum(b)])
    files[EVID / "coverage-matrix.csv"] = buf.getvalue()
    report["sidecar_sha256"] = hashlib.sha256("".join(
        hashlib.sha256(files[p].encode()).hexdigest() for p in sorted(files,key=lambda p:p.relative_to(ROOT).parts) if EVID not in p.parents).encode()).hexdigest()
    report["metadata_version"] = METADATA_VERSION
    report["route_version"] = ROUTE_VERSION
    report["reviewer_status"] = "authored_heuristic"
    files[EVID / "summary.json"] = json.dumps(report, indent=1, ensure_ascii=False) + "\n"
    if report["errors"]:
        print("\n".join(report["errors"])); sys.exit(1)
    if check:
        bad = [str(p.relative_to(ROOT)) for p, text in files.items() if not p.exists() or p.read_text("utf-8") != text]
        expected = {p.name for p in files if p.parent == OUT / "occ"}
        extra = sorted(p.name for p in (OUT / "occ").glob("*.json") if p.name not in expected) if (OUT / "occ").exists() else []
        if bad or extra:
            print("journey sidecar out of date:", bad[:5], extra[:5]); sys.exit(1)
        print("journey sidecar ok", report["sidecar_sha256"][:16], report["placements_mapped"], "placements")
        return
    for p, text in files.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, "utf-8",newline="\n")
    print("journey sidecar written", report["sidecar_sha256"][:16], report["nodes"], "nodes",
          report["placements_mapped"], "placements")


if __name__ == "__main__":
    main()
