#!/usr/bin/env python3
"""DOC-01: review roster for bank 1.2 and the adventure order (read-only over the bank).

One row per template family (394) with its competency, journey position, placements,
unique items, band spread, strategies and three concrete question references to review:
the first item a learner meets in the journey order (lowest band/score), the median and
the hardest (highest heuristic score) — edge cases. Reviewer columns are left EMPTY: they
are filled only by a real human reviewer after a real review (see docs/PROTOKOL_EKSTERNAL_1.5.md).

  python3 tools/build-roster.py   -> evidence/v15/review/roster-394-templates.csv (+ summary.json)
"""
import csv, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OCC = ROOT / "src" / "journey" / "v1" / "occ"
OUT = ROOT / "evidence" / "v15" / "review"


def main():
    route = json.loads((ROOT / "src/journey/v1/route.json").read_text("utf-8"))
    pos = {cid: i for i, cid in enumerate(route["order"])}
    nodes = {n["competency_id"]: n for n in route["nodes"]}
    fam = {}
    for f in sorted(OCC.glob("*.json"),key=lambda p:p.relative_to(OCC).parts):
        sh = json.loads(f.read_text("utf-8"))
        cid = sh["competency_id"]
        for p in sh["packages"]:
            for r in p["q"]:
                idx, fp, band, score, roles, feats, repeat, strat, dom, tpl = r
                e = fam.setdefault(tpl, {"cid": cid, "rows": [], "fps": set(), "bands": [0, 0, 0], "strategies": set(), "domains": set(), "uses": set()})
                e["rows"].append((score, band, p["package_id"], idx, fp, p["use"]))
                e["fps"].add(fp); e["bands"][band - 1] += 1; e["uses"].add(p["use"])
                e["strategies"].update(s for s in strat.split("+") if s); e["domains"].add(dom)
    OUT.mkdir(parents=True, exist_ok=True)
    cols = ["template_id", "competency_id", "grade", "level", "operation", "journey_position", "stage_id", "placements", "unique_items",
            "band1", "band2", "band3", "strategies", "domains", "uses",
            "first_in_order", "median_item", "hardest_item",
            "reviewer_name", "reviewer_role", "reviewed_at", "decision", "notes"]
    rows = []
    for tpl, e in sorted(fam.items(), key=lambda kv: (pos[kv[1]["cid"]], kv[0])):
        n = nodes[e["cid"]]
        teach = sorted(x for x in e["rows"] if x[5] != "assessment_form_reserved") or sorted(e["rows"])
        ref = lambda x: "%s#%d (fp %s, band %d, score %d)" % (x[2], x[3], x[4], x[1], x[0])
        rows.append({"template_id": tpl, "competency_id": e["cid"], "grade": n["grade"], "level": n["level"], "operation": n["operation"],
                     "journey_position": pos[e["cid"]] + 1, "stage_id": n["stage_id"], "placements": len(e["rows"]), "unique_items": len(e["fps"]),
                     "band1": e["bands"][0], "band2": e["bands"][1], "band3": e["bands"][2],
                     "strategies": "+".join(sorted(e["strategies"])), "domains": "+".join(sorted(e["domains"])), "uses": "+".join(sorted(e["uses"])),
                     "first_in_order": ref(teach[0]), "median_item": ref(teach[len(teach) // 2]), "hardest_item": ref(teach[-1]),
                     "reviewer_name": "", "reviewer_role": "", "reviewed_at": "", "decision": "", "notes": ""})
    with open(OUT / "roster-394-templates.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
    summary = {"templates": len(rows), "placements": sum(r["placements"] for r in rows), "competencies": len({r["competency_id"] for r in rows}),
               "reviewed": 0, "review_status": "NOT_PERFORMED", "note": "Reviewer columns intentionally empty. No agent output is recorded as a human review."}
    (OUT / "summary.json").write_text(json.dumps(summary, indent=1) + "\n", "utf-8")
    print("roster", summary["templates"], "templates", summary["placements"], "placements")


if __name__ == "__main__":
    main()
