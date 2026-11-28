#!/usr/bin/env python3
"""KALIBATAKU 1.4.0 registers, derived from the verified QA binding (evidence/v14/qa).

Writes (repository root):
  REGISTER_AC_1.4.csv       71 acceptance criteria (namespace AC:) with the audit's original
                            columns kept and implementation, test method, environment, actual
                            result, evidence_path, build_hash and blocker added.
  REGISTER_TEMUAN_1.4.csv   16 audit findings (namespace TEMUAN:) with change, related AC,
                            result and closure state. The two registers never share a key.
  RELEASE_STATUS.json       verdict in schema docs/contracts/release-status-1.4.schema.json.
  STATUS_RILIS.md           human summary of the same verdict.

Rules: an AC is PASS only when the binding re-verifies and every cited suite is PASS and every
cited receipt row is PASS. A suite that is BLOCKED_ENV without cited rows makes the AC BLOCKED.
External criteria keep their fixed BLOCKED/NOT_RUN state and reason. Nothing is PASS because a
file exists.
  python3 tools/release_registers_v14.py --write
"""
import argparse, csv, io, json, sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import qa_core  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / "evidence/v14/qa"
REGISTRY = ROOT / "tests/qa/suites.json"
CRIT = ROOT / "tests/qa/criteria-1.4.json"
AUDIT = ROOT / "evidence/v14/audit-input"
PACKAGE_CHECK = ROOT / "evidence/v14/release/package-check.json"
ENV = "Linux x86_64 container; Node {node}; Python {py}; {chrome} (headless, Playwright {pw}); no physical devices, no screen readers, no public domain"

FINDING_AC = {
    "PG-01": ["PROG-02", "PROG-03"], "PG-02": ["PROG-04", "PROG-06"], "PG-03": ["PROG-05", "PROG-07", "PROG-10"],
    "PG-04": ["BANK-04", "BANK-05", "PROG-02"], "UX-01": ["UX-01", "UX-02", "UX-13"], "UX-02": ["UX-05", "UX-06", "UX-08"],
    "UX-03": ["UX-03", "UX-04", "A11Y-02"], "UX-04": ["UX-13", "UX-03"], "UX-05": ["UX-02", "PROG-10"],
    "UX-06": ["UX-10", "PROG-09", "OFF-04"], "TEK-01": ["DATA-07", "DATA-08"], "TEK-02": ["DATA-09"],
    "REL-01": ["DEVICE-01", "DEVICE-02", "DEVICE-03", "A11Y-04", "TEACH-03"], "REL-02": ["PILOT-01", "PILOT-02", "PILOT-03", "BANK-07"],
    "REL-03": ["REL-02", "REL-03"], "DOC-01": ["BANK-07"]}
FINDING_CHANGE = {
    "PG-01": "Bank tidak diubah. Misi menyusun ulang butir paket menurut peran (pemanasan/target/penerapan) dan band fitur strategi; acak hanya dalam bucket setara.",
    "PG-02": "Pemilih misi berbasis exposure per profil/kompetensi; paket dengan butir belum terlihat terbanyak; pool kecil → review berlabel.",
    "PG-03": "nextMission: variasi/penguatan/checkpoint/advance ke node penerus menurut graf prasyarat aktif; titik mulai opsional.",
    "PG-04": "Sidecar journey/v1: 16 fitur (carry, borrow, pasangan 10/100, fakta dasar, anchor, faktor, pecahan, desimal, tanda, penyebut, konversi, kedalaman, beban antara), strategi, domain, peran, band; authored_heuristic.",
    "UX-01": "Beranda petualangan dengan satu CTA; peta; katalog menjadi jalur sekunder.",
    "UX-02": "Practice: 'Lihat hasil' pada soal terakhir memfinalkan sekali; grid tinjau/kirim hanya evaluasi dan sesi 1.3.",
    "UX-03": "Kartu feedback ringkas: input/bantuan input disembunyikan saat feedback; satu aksi Lanjut; tawaran bantuan setelah dua salah.",
    "UX-04": "Nav siswa: Petualangan/Peta/Progres/Riwayat; menu dalam misi tanpa ruang guru/admin.",
    "UX-05": "'Mulai dari dasar' atau 'Pilih titik mulai' (60 tahap, bukan tes); dapat diubah.",
    "UX-06": "Peta berupa daftar tahap/keterampilan dengan status teks+ikon; ringkasan hasil menunjukkan posisi menuju siap lanjut.",
    "TEK-01": "Penggabungan record per baris; writer memecah record per part_target dan memeriksa max_rows reader.",
    "TEK-02": "readEntry memvalidasi size/csize/limit sebelum membaca body STORED.",
    "REL-01": "Chromium diuji pada build final; protokol Firefox/WebKit, Android, iOS, pembaca layar, Word disiapkan.",
    "REL-02": "Protokol pilot 12 siswa/3 guru + formulir; roster review 394 template disiapkan.",
    "REL-03": "Panduan GitHub→Cloudflare Pages, update, rollback + perintah verifikasi; belum ada akses domain.",
    "DOC-01": "Roster baru untuk bank 1.2 + urutan rute: 394 keluarga template, 3 butir per template (pertama, median, tersulit); kolom penelaah kosong sampai review nyata."}


def read_csv(path):
    return list(csv.DictReader(io.StringIO(path.read_text(encoding="utf-8-sig"))))


def receipt_rows(suite):
    rows = {}
    for rc in suite.get("receipts", []):
        data = json.loads((QA / rc["file"]).read_bytes())
        for r in qa_core.rows_of(data):
            k = str(r.get("id", r.get("name")))
            if rows.get(k) != "FAIL":
                rows[k] = r.get("status")
    return rows


def evaluate(spec, suites, verified):
    if spec.get("external"):
        return spec["external"]["state"], [], spec["external"]["reason"]
    if spec.get("derived") == "consistency":
        return ("PASS" if verified else "FAIL"), ["evidence/v14/qa/binding.json"], "" if verified else "QA binding does not verify"
    if spec.get("derived") == "package":
        if not PACKAGE_CHECK.is_file():
            return "NOT_RUN", [], "package check not yet run"
        pc = json.loads(PACKAGE_CHECK.read_text())
        return ("PASS" if pc.get("status") == "PASS" else "FAIL"), [PACKAGE_CHECK.relative_to(ROOT).as_posix()], "; ".join(pc.get("problems", []))
    if not verified:
        return "FAIL", [], "QA binding does not verify"
    states, refs, notes = [], [], []
    for ev in spec["evidence"]:
        s = suites.get(ev["suite"])
        if not s:
            states.append("FAIL"); notes.append(ev["suite"] + " absent"); continue
        refs += ["evidence/v14/qa/" + x["file"] for x in s.get("receipts", [])] + ["evidence/v14/qa/" + s["log"]]
        if s["status"] == "FAIL":
            states.append("FAIL"); notes.append(ev["suite"] + ": FAIL"); continue
        if s["status"] == "BLOCKED_ENV" and not ev.get("rows"):
            detail = "; ".join(s.get("problems", [])[:1]).replace("evidence/v13/receipts/", "evidence/v14/qa/" + ev["suite"] + "/")
            states.append("BLOCKED"); notes.append(ev["suite"] + ": BLOCKED_ENV " + detail); continue
        if ev.get("rows"):
            got = receipt_rows(s)
            bad = [r for r in ev["rows"] if got.get(r) != "PASS"]
            if bad:
                states.append("FAIL"); notes.append(ev["suite"] + " rows not PASS: " + ", ".join(bad[:4])); continue
        states.append("PASS")
    state = "FAIL" if "FAIL" in states else "BLOCKED" if "BLOCKED" in states else "PASS"
    return state, sorted(set(refs)), "; ".join(notes)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--write", action="store_true"); a = ap.parse_args()
    binding = json.loads((QA / "binding.json").read_bytes())
    problems = qa_core.verify_binding(ROOT, QA, REGISTRY, check_runtime=False)
    verified = not problems
    suites = {s["id"]: s for s in binding["suites"]}
    crit = json.loads(CRIT.read_text())["criteria"]
    ident = binding.get("build") or {}
    build = ident.get("offline_release", "") + " / dist " + ident.get("dist_tree_sha256", "")[:16]
    rt = binding.get("runtime", {})
    env = ENV.format(node=rt.get("node", "?"), py=rt.get("python", "?"), chrome=rt.get("chromium", rt.get("browser", "153")), pw=rt.get("playwright", "1.63"))
    ac_rows, states = [], {}
    for row in read_csv(AUDIT / "05_KRITERIA_PENERIMAAN.csv"):
        spec = crit[row["id"]]
        state, refs, note = evaluate(spec, suites, verified)
        states[row["id"]] = state
        method = "; ".join(e["suite"] + (" [" + ", ".join(e["rows"]) + "]" if e.get("rows") else "") for e in spec.get("evidence", [])) or \
                 ("protokol eksternal docs/PROTOKOL_EKSTERNAL_1.4.md" if spec.get("external") else spec.get("derived", ""))
        ac_rows.append({"namespace_id": "AC:" + row["id"], "id": row["id"], "prioritas": row["prioritas"], "fase": row["prioritas"],
                        "lingkup": row["lingkup"], "persyaratan": row["persyaratan"], "cara_uji": row["cara_uji"], "bukti_lulus": row["bukti_lulus"],
                        "status_audit_awal": row["status"], "implementasi": spec.get("impl", ""), "metode_uji": method,
                        "lingkungan": "" if spec.get("external") else env, "hasil_aktual": state,
                        "evidence_path": " | ".join(refs), "build_hash": build if not spec.get("external") else "",
                        "blocker": note if state != "PASS" else ""})
    fd_rows = []
    for row in read_csv(AUDIT / "04_TEMUAN_DAN_PRIORITAS.csv"):
        related = FINDING_AC[row["id"]]
        rs = [states[x] for x in related]
        closure = "CLOSED_VERIFIED" if all(s == "PASS" for s in rs) else "OPEN_EXTERNAL" if all(s in ("PASS", "BLOCKED", "NOT_RUN") for s in rs) else "OPEN_FAIL"
        if row["id"] == "DOC-01" and closure != "CLOSED_VERIFIED":
            closure = "PARTIAL_ROSTER_READY_REVIEW_NOT_PERFORMED"
        fd_rows.append({"namespace_id": "TEMUAN:" + row["id"], "id": row["id"], "prioritas": row["prioritas"], "temuan": row["temuan"],
                        "bukti_audit": row["bukti"], "perubahan_1.4": FINDING_CHANGE[row["id"]],
                        "ac_terkait": " ".join("AC:" + x for x in related), "hasil_ac": " ".join(f"AC:{x}={states[x]}" for x in related),
                        "status_penutupan": closure, "build_hash": build})
    required = [r for r in ac_rows if r["prioritas"] == "WAJIB"]
    counts = {}
    for r in ac_rows:
        counts[r["hasil_aktual"]] = counts.get(r["hasil_aktual"], 0) + 1
    automated_ok = all(r["hasil_aktual"] == "PASS" for r in required if not crit[r["id"]].get("external"))
    all_required_pass = all(r["hasil_aktual"] == "PASS" for r in required)
    # Label mapping (docs/contracts/release-status-1.4.schema.json): GO only when every WAJIB
    # criterion passed on this build; READY_FOR_VALIDATION is used per scope when its automated
    # gates passed and only external validation remains; HOLD whenever a WAJIB gate is unmet.
    label = "GO" if all_required_pass and verified else "HOLD"
    def scope(ids, ok_status="PASS"):
        st = [states[i] for i in ids]
        if all(s == "PASS" for s in st):
            return "GO", ok_status
        if any(s == "FAIL" for s in st):
            return "HOLD", "FAIL"
        auto = [states[i] for i in ids if not crit[i].get("external")]
        if all(s == "PASS" for s in auto) and auto:
            return "READY_FOR_VALIDATION", "TECHNICAL_PASS_USABILITY_NOT_VALIDATED" if ok_status == "PASS" else ok_status
        return "HOLD", "HOLD"
    groups = {
        "static_application": ["BANK-01", "BANK-02", "BANK-06", "REL-01", "REL-04", "REL-05", "DATA-01", "DATA-02", "DATA-03", "DATA-04", "DATA-05", "DATA-10", "DATA-11"],
        "adventure_journey": ["BANK-03", "BANK-04", "BANK-05", "PROG-01", "PROG-02", "PROG-03", "PROG-04", "PROG-05", "PROG-06", "PROG-07", "PROG-08", "PROG-09", "PROG-10", "PROG-11", "PROG-12", "DATA-06"],
        "ui_ux": ["UX-%02d" % i for i in range(1, 15)] + ["A11Y-01", "A11Y-02", "A11Y-03", "A11Y-05"],
        "backup_archive": ["DATA-07", "DATA-08", "DATA-09"],
        "offline": ["OFF-01", "OFF-02", "OFF-03", "OFF-04"],
        "teacher_reports": ["TEACH-01", "TEACH-02", "TEACH-03", "TEACH-04"],
        "browsers_devices_assistive": ["DEVICE-01", "DEVICE-02", "DEVICE-03", "A11Y-04"],
        "content_review": ["BANK-07"],
        "pedagogy_pilot": ["PILOT-01", "PILOT-02", "PILOT-03"],
        "performance_lab": ["PERF-01", "PERF-02"],
        "field_performance": ["PERF-03"],
        "live_deployment": ["REL-02", "REL-03"]}
    readiness = {}
    for k, ids in groups.items():
        lab, st = scope(ids)
        ext = [i for i in ids if crit[i].get("external")]
        if lab == "HOLD" and ext and all(states[i] in ("NOT_RUN",) for i in ids):
            st = "NOT_RUN"
        if k == "pedagogy_pilot" and all(states[i] == "NOT_RUN" for i in ids):
            st = "NOT_PERFORMED"
        if k == "live_deployment" and lab != "GO":
            st = "PREVIEW_PASS" if suites.get("hosting-smoke", {}).get("status") == "PASS" else "NOT_RUN"
        refs = sorted({p for r in ac_rows if r["id"] in ids for p in r["evidence_path"].split(" | ") if p})
        files = [p for p in refs if (ROOT / p).is_file()] or ["REGISTER_AC_1.4.csv"]
        readiness[k] = {"status": st, "label": lab, "criteria": ["AC:" + i for i in ids],
                        "evidence": files[:12], "claim_boundary": "; ".join(f"AC:{i}={states[i]}" for i in ids),
                        "blockers": [f"AC:{i}: " + next(r["blocker"] for r in ac_rows if r["id"] == i) for i in ids if states[i] != "PASS"]}
    verdict = {"artifact_status": "release_verdict", "schema": "release-status-1.4", "release_id": "kalibataku-static-1.4.0", "app_version": "1.4.0",
               "bank_version": ident.get("bank_version", "1.2.0"), "dist_tree_sha256": ident.get("dist_tree_sha256"), "offline_release": ident.get("offline_release"),
               "qa_binding": "evidence/v14/qa/binding.json", "qa_binding_verified": verified, "release_label": label,
               "label_mapping": {"GO": "every WAJIB criterion PASS on this build", "READY_FOR_VALIDATION": "automated gates of the scope PASS; external validation (people, devices, assistive technology, domain) not yet performed",
                                 "HOLD": "at least one WAJIB gate not met (FAIL, BLOCKED or NOT_RUN)"},
               "criteria_counts": counts, "automated_wajib_all_pass": automated_ok, "readiness": readiness,
               "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    if a.write:
        def wcsv(path, rows):
            buf = io.StringIO(); w = csv.DictWriter(buf, fieldnames=list(rows[0]), lineterminator="\n"); w.writeheader(); w.writerows(rows)
            path.write_text(buf.getvalue(), encoding="utf-8")
        wcsv(ROOT / "REGISTER_AC_1.4.csv", ac_rows)
        wcsv(ROOT / "REGISTER_TEMUAN_1.4.csv", fd_rows)
        (ROOT / "RELEASE_STATUS.json").write_text(json.dumps(verdict, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        md = ["# Status rilis KALIBATAKU 1.4.0 (petualangan)", "",
              f"**Label rilis: {label}**  ·  build `{ident.get('offline_release')}`  ·  dist `{ident.get('dist_tree_sha256')}`  ·  bank {verdict['bank_version']} (4.677 berkas identik)", "",
              "Label diturunkan otomatis dari `evidence/v14/qa/binding.json` (diverifikasi ulang: " + ("ya" if verified else "TIDAK") + ") oleh `tools/release_registers_v14.py`. "
              "GO hanya bila semua kriteria WAJIB lulus pada build ini; READY_FOR_VALIDATION = gerbang otomatis lingkup lulus, validasi eksternal belum; HOLD = ada gerbang WAJIB belum terpenuhi.", "",
              "## Rekap 71 kriteria", "", "| Hasil | Jumlah |", "|---|---|"] + [f"| {k} | {v} |" for k, v in sorted(counts.items())] + [
              "", "## Lingkup", "", "| Lingkup | Label | Status skema | Kriteria |", "|---|---|---|---|"] + [
              f"| {k} | {v['label']} | {v['status']} | {v['claim_boundary']} |" for k, v in readiness.items()] + [
              "", "## Gerbang yang belum terbukti", ""] + [f"- AC:{r['id']} ({r['hasil_aktual']}): {r['blocker']}" for r in ac_rows if r["hasil_aktual"] != "PASS"] + [
              "", "Protokol penutupan: `docs/PROTOKOL_EKSTERNAL_1.4.md`. Register: `REGISTER_AC_1.4.csv`, `REGISTER_TEMUAN_1.4.csv`."]
        (ROOT / "STATUS_RILIS.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(json.dumps({"verified": verified, "problems": problems[:5], "label": label, "counts": counts,
                      "findings": {r["id"]: r["status_penutupan"] for r in fd_rows}}, indent=1))


if __name__ == "__main__":
    main()
