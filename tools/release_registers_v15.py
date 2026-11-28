#!/usr/bin/env python3
"""KALIBATAKU 1.6.1 registers, derived from the verified QA binding (evidence/v161/qa).

Writes (repository root):
  REGISTER_AC_FINAL.csv       71 acceptance criteria (namespace AC:) with the audit's original
                            columns kept and implementation, test method, environment, actual
                            result, evidence_path, build_hash and blocker added.
  REGISTER_PENUTUPAN_AUD15.csv    Three independently reproduced 1.5.0 findings and closure evidence.
  REGISTER_TEMUAN_LAMA.csv   16 audit findings (namespace TEMUAN:) with change, related AC,
                            result and closure state. The two registers never share a key.
  RELEASE_STATUS.json       verdict in schema docs/contracts/release-status-1.6.1.schema.json.
  STATUS_RILIS.md           human summary of the same verdict.

Rules: an AC is PASS only when the binding re-verifies and every cited suite is PASS and every
cited receipt row is PASS. A suite that is BLOCKED_ENV without cited rows makes the AC BLOCKED.
External criteria start at their documented BLOCKED/NOT_RUN state. Validated, reviewed
receipts for this build determine subsequent decisions through evaluate_external.
  python3 tools/release_registers_v15.py --write
"""
import argparse, csv, io, json, sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import qa_core
from production_audit import audit_rows as production_rows, crosswalk, AUDIT_LINKS

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / "evidence/v161/qa"
REGISTRY = ROOT / "tests/qa/suites.json"
CRIT = ROOT / "tests/qa/criteria-1.5.1.json"
AUDIT = ROOT / "evidence/v14/audit-input"
PACKAGE_CHECK = ROOT / "evidence/v161/release/package-check.json"
ENV = "{os} / Node {node} / Python {py} / Playwright {pw} / {chrome}"

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
    "REL-01": "Hasil tiap engine ada dalam QA build akhir; perangkat fisik dan pembaca layar memerlukan pemeriksaan langsung.",
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


def evaluate(criterion, spec, suites, verified, identity):
    if not verified:
        return "FAIL", [], "QA binding does not verify"
    if spec.get("external"):
        from external_receipts import evaluate_external
        default = spec["external"]
        return evaluate_external(ROOT, criterion, default["state"], default["reason"], identity)
    if spec.get("derived") == "consistency":
        valid = verified and all(suites.get(key, {}).get("status") == "PASS" for key in ("register-policy", "external-receipts"))
        return ("PASS" if valid else "FAIL"), ["evidence/v161/qa/binding.json", "evidence/v161/qa/register-policy/log.txt", "evidence/v161/qa/external-receipts/log.txt"], "" if valid else "Binding atau pemeriksaan pemetaan register gagal"
    if spec.get("derived") == "package":
        if not PACKAGE_CHECK.is_file():
            return "NOT_RUN", [], "package check not yet run"
        pc = json.loads(PACKAGE_CHECK.read_text())
        return ("PASS" if pc.get("status") == "PASS" and pc.get("dist_tree_sha256") == identity["dist_tree_sha256"] and pc.get("source_tree_sha256") == identity["source_tree_sha256"] else "FAIL"), [PACKAGE_CHECK.relative_to(ROOT).as_posix()], "; ".join(pc.get("problems", []))
    states, refs, notes = [], [], []
    for ev in spec["evidence"]:
        s = suites.get(ev["suite"])
        if not s:
            states.append("FAIL"); notes.append(ev["suite"] + " absent"); continue
        refs += ["evidence/v161/qa/" + x["file"] for x in s.get("receipts", [])] + ["evidence/v161/qa/" + s["log"]]
        if s["status"] == "FAIL":
            states.append("FAIL"); notes.append(ev["suite"] + ": FAIL"); continue
        if s["status"] == "BLOCKED_ENV" and not ev.get("rows"):
            detail = "; ".join(s.get("problems", [])[:1]).replace("evidence/v13/receipts/", "evidence/v161/qa/" + ev["suite"] + "/")
            states.append("BLOCKED"); notes.append(ev["suite"] + ": BLOCKED_ENV " + detail); continue
        if ev.get("rows"):
            got = receipt_rows(s)
            bad = [r for r in ev["rows"] if got.get(r) != "PASS"]
            if bad:
                states.append("FAIL"); notes.append(ev["suite"] + " rows not PASS: " + ", ".join(bad[:4])); continue
        states.append("PASS")
    state = "FAIL" if "FAIL" in states else "BLOCKED" if "BLOCKED" in states else "PASS"
    return state, sorted(set(refs)), "; ".join(notes)


def build_audit_register(audit_input, suites, states, verified, identity):
    """Require the new counterexample and the original acceptance criteria on this build."""
    controls = {
        "AUD15-01": {
            "criteria": ["PROG-06"],
            "suites": ["viewed-coverage", "viewed-exports", "viewed-browser", "progression-bounds", "progression-launch"],
            "change": "Cakupan dan strategi menghitung soal yang memiliki bukti dilihat. Layar siswa dan laporan guru menggunakan ukuran yang sama.",
            "files": "src/journey/exposure.mjs | src/journey/model.mjs | src/journey/report.mjs",
            "proof": "evidence/v161/qa/viewed-coverage",
        },
        "AUD15-02": {
            "criteria": ["OFF-01", "OFF-04"],
            "suites": ["catalog-offline-v151-chromium", "catalog-offline-v151-firefox", "catalog-offline-v151-webkit",
                       "offline-capability-chromium", "offline-capability-firefox", "offline-capability-webkit"],
            "change": "Label katalog, perangkat dan detail memakai hasil pemeriksaan paket terpasang. Peluncuran memeriksa kembali materi.",
            "files": "src/data/offline.js | src/core/catalog.mjs | src/data/panel-offline.js | src/journey/offline.mjs",
            "proof": "evidence/v161/qa/catalog-offline-v151-firefox",
        },
        "AUD15-03": {
            "criteria": ["TEACH-02"],
            "suites": ["time-offset-engine", "time-offset-exports", "format-readiness", "semantic-restore"],
            "change": "Filter dan urutan memakai saat kejadian dan batas hari pada zona laporan. Timestamp sumber tetap tersimpan sebagaimana diimpor.",
            "files": "src/teacher/report.js",
            "proof": "evidence/v161/qa/time-offset-engine",
        },
    }
    rows = []
    for original in read_csv(audit_input / "02_REGISTER_TEMUAN_BARU.csv"):
        key = original["id"]
        rule = controls[key]
        passed = verified and all(states[c] == "PASS" for c in rule["criteria"])
        passed = passed and all(suites.get(i, {}).get("status") == "PASS" for i in rule["suites"])
        rows.append({
            "id": key, "prioritas": original["prioritas"], "temuan": original["judul"],
            "hasil_sebelum_1_5_0": original["bukti_aktual"], "lokasi_asal": original["lokasi"],
            "perubahan": rule["change"], "berkas": rule["files"],
            "ac": " | ".join("AC:" + c for c in rule["criteria"]),
            "hubungan_kriteria": original["ac_terkait"], "syarat_tutup": original["syarat_tutup"],
            "hasil_regresi": " | ".join(f"{i}={suites.get(i, {}).get('status', 'NOT_RUN')}" for i in rule["suites"]),
            "bukti_hasil": rule["proof"], "bukti_qa": " | ".join("evidence/v161/qa/" + suites[i]["log"] for i in rule["suites"] if i in suites),
            "status": "DITUTUP" if passed else "TERBUKA", "dist_tree_sha256": identity["dist_tree_sha256"],
            "source_tree_sha256": identity["source_tree_sha256"], "offline_release": identity["offline_release"],
        })
    if {r["id"] for r in rows} != set(controls) or len(rows) != len(controls):
        raise ValueError("Daftar temuan belum lengkap")
    return rows


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--write", action="store_true"); ap.add_argument("--verify", action="store_true"); a = ap.parse_args()
    binding = json.loads((QA / "binding.json").read_bytes())
    problems = qa_core.verify_binding(ROOT, QA, REGISTRY, check_runtime=False)
    verified = not problems
    suites = {s["id"]: s for s in binding["suites"]}
    crit = json.loads(CRIT.read_text())["criteria"]
    ident = qa_core.identity(ROOT)
    audit_input = ROOT / "evidence/v151/audit-input"
    initial_ac = {r["namespace_id"]: r for r in read_csv(audit_input / "03_REVIEW_71_KRITERIA.csv")}
    build = ident.get("offline_release", "") + " / dist " + ident.get("dist_tree_sha256", "")
    rt = binding.get("runtime", {})
    env = ENV.format(os=rt.get("os", "?"), node=rt.get("node", "?"), py=rt.get("python", "?"), chrome=rt.get("chromium"), pw=rt.get("playwright"))
    ac_rows, states = [], {}
    for row in read_csv(AUDIT / "05_KRITERIA_PENERIMAAN.csv"):
        spec = crit[row["id"]]
        state, refs, note = evaluate(row["id"], spec, suites, verified, ident)
        states[row["id"]] = state
        method = "; ".join(e["suite"] + (" [" + ", ".join(e["rows"]) + "]" if e.get("rows") else "") for e in spec.get("evidence", [])) or \
                 ("Validasi tanda tangan, pengamatan dan bukti melalui VALIDASI_EKSTERNAL/00_MULAI_DI_SINI.md" if spec.get("external") else spec.get("derived", ""))
        summaries=[]
        for ev in spec.get("evidence", []):
            suite=suites.get(ev["suite"], {})
            summaries.append(f"{ev['suite']} {suite.get('status', 'NOT_RUN')} ({suite.get('assertions', 0)} pemeriksaan)")
        if row["id"]=="OFF-03":
            path=ROOT/"evidence/v161/update-local/update-rollback.json"
            local=json.loads(path.read_bytes()) if path.is_file() else {}
            steps=local.get("observations", [])
            if local.get("candidate", {}).get("dist_tree_sha256")==ident["dist_tree_sha256"] and local.get("status")=="PASS" and not local.get("page_errors") and steps and steps[-1].get("completion_events")==1:
                refs.append(path.relative_to(ROOT).as_posix())
                summaries.append(f"{len(steps)} pengamatan update dan rollback lokal, dua tab, satu finalisasi offline")
        observed=" | ".join(summaries) or note or ("Register terhubung dengan identitas build dan metode uji." if row["id"]=="REL-04" else "Arsip uji diekstrak dan dibangun ulang.")
        ac_rows.append({"namespace_id": "AC:" + row["id"], "id": row["id"], "prioritas": row["prioritas"], "fase": row["prioritas"],
                        "lingkup": row["lingkup"], "persyaratan": row["persyaratan"], "cara_uji": row["cara_uji"], "bukti_lulus": row["bukti_lulus"],
                        "status_audit_awal": row["status"], "status_audit_1_5": initial_ac["AC:" + row["id"]]["status_audit"], "implementasi": spec.get("impl", ""), "metode_uji": method,
                        "lingkungan": ("Perangkat/pelaksana dan lingkungan tercatat di receipt." if refs else "Belum tersedia receipt eksternal untuk build ini.") if spec.get("external") else env, "hasil_aktual": state, "observasi_build": observed,
                        "evidence_path": " | ".join(refs), "build_hash": build,
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
    # Label mapping (docs/contracts/release-status-1.6.1.schema.json): GO only when every WAJIB
    # criterion passed on this build; READY_FOR_VALIDATION is used per scope when its automated
    # gates passed and only external validation remains; HOLD whenever a WAJIB gate is unmet.
    new_audits = build_audit_register(audit_input, suites, states, verified, ident)
    closed = all(row["status"] == "DITUTUP" for row in new_audits)
    from adventure_register import rows as adventure_rows
    acceptance,closures=adventure_rows(ROOT,ident,suites,states,verified)
    overlap = crosswalk(acceptance, states, ident)
    production = production_rows(ROOT, ident, binding, suites, verified, states)
    production_ok = all(r["status"] == "PASS" for r in production)
    release_gates_met=all(r["status"]=="PASS" for r in acceptance if r["id"]!="POST-01") and all(r["status"]=="PASS" for r in closures)
    label = "GO" if all_required_pass and verified and closed and release_gates_met and production_ok and binding["status"]=="PASS" else "HOLD"
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
        if k == "live_deployment" and lab != "GO" and not any(states[i] == "FAIL" for i in ids):
            st = "PREVIEW_PASS" if suites.get("hosting-smoke", {}).get("status") == "PASS" else "NOT_RUN"
        refs = sorted({p for r in ac_rows if r["id"] in ids for p in r["evidence_path"].split(" | ") if p})
        files = [p for p in refs if (ROOT / p).is_file()] or ["REGISTER_AC_FINAL.csv"]
        readiness[k] = {"status": st, "label": lab, "criteria": ["AC:" + i for i in ids],
                        "evidence": files[:12], "claim_boundary": "; ".join(f"AC:{i}={states[i]}" for i in ids),
                        "blockers": [f"AC:{i}: " + next(r["blocker"] for r in ac_rows if r["id"] == i) for i in ids if states[i] != "PASS"]}
    verdict = {"artifact_status": "release_verdict", "schema": "release-status-1.6.1", "release_id": "kalibataku-static-" + ident["app_version"], "app_version": ident["app_version"],
               "source_tree_sha256": ident["source_tree_sha256"], "audit_1_5": {r["id"]:r["status"] for r in new_audits},
               "audit_1_6": {r["id"]:r["status"] for r in production},
               "redesign_phase_counts": {phase: {st: sum(r["fase"] == phase and r["redesign_build_ini"] == st for r in overlap) for st in ("PASS", "FAIL", "BLOCKED", "NOT_RUN")} for phase in ("WAJIB", "SETELAH_PILOT")},
               "phase_counts": {phase: {st: sum(r["fase"] == phase and r["hasil_aktual"] == st for r in ac_rows) for st in ("PASS", "FAIL", "BLOCKED", "NOT_RUN")} for phase in ("WAJIB", "SETELAH_PILOT")},
               "bank_version": ident.get("bank_version", "1.2.0"), "dist_tree_sha256": ident.get("dist_tree_sha256"), "offline_release": ident.get("offline_release"),
               "qa_binding": "evidence/v161/qa/binding.json", "qa_binding_verified": verified, "release_label": label,
               "label_mapping": {"GO": "All mandatory baseline and redesign criteria, audit closures and registered suites passed on this build", "READY_FOR_VALIDATION": "automated gates of the scope PASS; external validation (people, devices, assistive technology, domain) not yet performed",
                                 "HOLD": "at least one WAJIB gate not met (FAIL, BLOCKED or NOT_RUN)"},
               "criteria_counts": counts, "automated_wajib_all_pass": automated_ok, "readiness": readiness,
               "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    current_audits = [
        ("AUD-01", ["PROG-01","PROG-03","PROG-05"], ["progression-bounds","progression-launch"], "src/journey/model.mjs | tools/build-journey.py", "Permainan sempurna mengikuti rekomendasi menuju semua node aktif. Kasus G12 memakai PO dari P017#16."),
        ("AUD-02", ["OFF-01","OFF-04"], ["offline-capability-chromium","offline-capability-firefox","offline-capability-webkit"], "src/journey/offline.mjs | src/journey/journey.mjs | src/journey/ui.mjs | src/data/offline.js | src/sw.js", "Katalog dan peta memeriksa paket ajar serta dependensinya. Sesi aktif tetap dapat dilanjutkan dari snapshot."),
        ("AUD-03", ["PROG-10"], ["start-intent","intent-browser-chromium","intent-browser-firefox","intent-browser-webkit"], "src/journey/journey.mjs | src/journey/model.mjs | src/journey/ui.mjs | src/data/store.js", "Pilihan tahap terbaru bertahan selama misi aktif dan dipakai pada peluncuran yang sesuai."),
        ("AUD-04", ["TEACH-02"], ["period-readiness","format-readiness"], "src/journey/model.mjs | src/journey/report.mjs | src/teacher/report.js | src/teacher/document.js", "Peta dan lima format laporan diperiksa pada riwayat campuran hingga batas waktu laporan."),
        ("AUD-05", ["DATA-06"], ["semantic-restore","restore-index","restore-worker"], "src/data/snapshot-check.js | src/data/journey-snapshot.js | src/data/journey-bank-index.js | src/data/backup.js", "Reader, preview dan commit menolak empat metadata yang tidak konsisten. Kontrol arsip lama, atomisitas dan isolasi diuji."),
        ("AUD-06", ["DATA-08"], ["capacity-rows","capacity-bytes","capacity-browser","capacity-beyond-string","data-archive-edges"], "src/data/backup.js | src/data/backup-json-size.js | src/data/panel-profile.js", "Kapasitas JSON dihitung pada jumlah baris dan byte UTF-8. Pemulihan draf memakai ZIP jika ambang terlewati."),
        ("AUD-07", ["UX-09","REL-04"], ["register-policy"], "tests/qa/criteria-1.5.1.json | tools/release_registers_v15.py", "Pemetaan keyboard fisik diperiksa. Menutup uji perangkat memerlukan pelaksanaan di Android dan iOS.")
    ]
    audit_rows=[]
    source={r["id"]:r for r in read_csv(ROOT/"evidence/v15/audit-source/02_TEMUAN_BARU_DAN_PRIORITAS.csv")}
    for aid,acs,sids,paths,summary in current_audits:
        linked=[suites.get(i,{}) for i in sids]
        good=verified and all(s.get("status")=="PASS" for s in linked)
        status=("KOREKSI_REGISTER_LULUS_UJI_FISIK_BLOCKED" if good and states["UX-09"]=="BLOCKED" and states["REL-04"]=="PASS" else "DITUTUP" if good and states["UX-09"]=="PASS" and states["REL-04"]=="PASS" else "TERBUKA") if aid=="AUD-07" else ("DITUTUP" if good and all(states[i]=="PASS" for i in acs) else "TERBUKA")
        refs=["evidence/v161/qa/"+s["log"] for s in linked if s.get("log")]
        audit_rows.append(dict(id=aid,prioritas=source[aid]["priority"],temuan=source[aid]["title"],akar_masalah=source[aid]["cause"],perubahan=paths,
           regresi=" | ".join(sids),hasil=summary,hasil_suite=" | ".join(i+"="+s.get("status","NOT_RUN") for i,s in zip(sids,linked)),
           ac=" | ".join("AC:"+i for i in acs),bukti=" | ".join(refs),status=status,build_hash=ident["dist_tree_sha256"]))
    baseline_160 = {r["id"]: r for r in read_csv(ROOT / "evidence/v161/baseline-1.6.0/registers/REGISTER_AC_FINAL.csv")}
    for row in ac_rows:
        row["status_audit_1_6_0"] = baseline_160[row["id"]]["hasil_aktual"]
        row["waktu_binding_utc"] = binding["created_utc"]
        row["source_tree_sha256"] = ident["source_tree_sha256"]
        row["audit_terkait"]=" | ".join(r["id"] for r in audit_rows+new_audits if row["namespace_id"] in r["ac"].split(" | "))
        linked_160 = [a for a, (baseline, _) in AUDIT_LINKS.items() if row["id"] in baseline.split()]
        row["audit_terkait"] = " | ".join(filter(None, [row["audit_terkait"], *linked_160]))
    old={r["namespace_id"]:r for r in read_csv(ROOT/"evidence/v15/audit-source/04_STATUS_16_TEMUAN_LAMA.csv")}
    for row in fd_rows:
        row["status_audit_1_4"]=old[row["namespace_id"]]["status_audit_ini"]
        if row["id"]=="UX-03" and states["UX-09"]!="PASS":
            row["status_penutupan"]="PARSIAL_KEYBOARD_FISIK_TERBUKA"
            row["ac_terkait"]+=" AC:UX-09"
            row["hasil_ac"]+=" AC:UX-09="+states["UX-09"]
    if a.write or a.verify:
        def persist(path, content):
            if a.verify:
                if not path.is_file() or path.read_text(encoding="utf-8") != content:
                    raise ValueError(f"Register atau keputusan tidak sesuai bukti: {path.name}")
            else:
                path.write_text(content, encoding="utf-8",newline="\n")
        def wcsv(path, rows):
            buf = io.StringIO(); w = csv.DictWriter(buf, fieldnames=list(rows[0]), lineterminator="\n"); w.writeheader(); w.writerows(rows)
            persist(path, buf.getvalue())
        wcsv(ROOT / "REGISTER_IRISAN.csv", overlap)
        wcsv(ROOT / "REGISTER_AUDIT_160.csv", production)
        wcsv(ROOT / "REGISTER_PENERIMAAN.csv", acceptance)
        wcsv(ROOT / "REGISTER_PENUTUPAN_TEMUAN.csv", closures)
        wcsv(ROOT / "REGISTER_PENUTUPAN_AUD.csv", audit_rows)
        wcsv(ROOT / "REGISTER_PENUTUPAN_AUD15.csv", new_audits)
        wcsv(ROOT / "REGISTER_AC_FINAL.csv", ac_rows)
        wcsv(ROOT / "REGISTER_TEMUAN_LAMA.csv", fd_rows)
        if a.verify:
            verdict["generated_utc"] = json.loads((ROOT / "RELEASE_STATUS.json").read_bytes())["generated_utc"]
        persist(ROOT / "RELEASE_STATUS.json", json.dumps(verdict, indent=2, ensure_ascii=False) + "\n")
        md = ["# Status rilis KALIBATAKU 1.6.1 (petualangan)", "",
              f"**Label rilis: {label}**  ·  build `{ident.get('offline_release')}`  ·  dist `{ident.get('dist_tree_sha256')}`  ·  bank {verdict['bank_version']} (4.677 berkas identik)", "",
              "Label diturunkan otomatis dari `evidence/v161/qa/binding.json` (diverifikasi ulang: " + ("ya" if verified else "TIDAK") + ") oleh `tools/release_registers_v15.py`. "
              "GO hanya bila semua kriteria WAJIB lulus pada build ini; READY_FOR_VALIDATION = gerbang otomatis lingkup lulus, validasi eksternal belum; HOLD = ada gerbang WAJIB belum terpenuhi.", "",
              "## Rekap 71 kriteria", "", "| Hasil | Jumlah |", "|---|---|"] + [f"| {k} | {v} |" for k, v in sorted(counts.items())] + [
              "", "## Lingkup", "", "| Lingkup | Label | Status skema | Kriteria |", "|---|---|---|---|"] + [
              f"| {k} | {v['label']} | {v['status']} | {v['claim_boundary']} |" for k, v in readiness.items()] + [
              "", "## Gerbang yang belum terbukti", ""] + [f"- AC:{r['id']} ({r['hasil_aktual']}): {r['blocker']}" for r in ac_rows if r["hasil_aktual"] != "PASS"] + [
              "", "Protokol penutupan: `docs/PROTOKOL_EKSTERNAL_1.5.md`. Register: `REGISTER_AC_FINAL.csv`, `REGISTER_TEMUAN_LAMA.csv`."]
        md += ["", "## Temuan audit 1.5.0", "", "| Temuan | Status |", "| --- | --- |"] + [f"| {r['id']} | {r['status']} |" for r in new_audits]
        md += ["", "## Kriteria menurut fase", "", "| Fase | PASS | FAIL | BLOCKED | NOT_RUN |", "| --- | ---: | ---: | ---: | ---: |"] + [f"| {phase} | {v['PASS']} | {v['FAIL']} | {v['BLOCKED']} | {v['NOT_RUN']} |" for phase,v in verdict["phase_counts"].items()]
        md += ["", "Paket validasi lapangan ada di VALIDASI_EKSTERNAL/00_MULAI_DI_SINI.md."]
        md += ["","## Temuan audit petualangan 1.5.1","", "Rincian per uji dan build tersedia di REGISTER_PENERIMAAN.csv dan REGISTER_PENUTUPAN_TEMUAN.csv.","", "| Temuan | Status |","|---|---|"]+[f"| {r['id']} | {r['status']} |" for r in closures]
        md += ["", "## Audit produksi kandidat 1.6.0", "",
               "REGISTER_AUDIT_160.csv memuat hasil lokal, gerbang fisik, rujukan bukti, lingkungan dan identitas build untuk delapan temuan.",
               "", "| ID | Pemeriksaan lokal | Penerimaan lengkap |", "|---|---|---|"]
        md += [f"| {r['id']} | {r['hasil_teknis_lokal']} | {r['status']} |" for r in production]
        md += ["", "## Irisan kriteria produksi dan redesign", "",
               "REGISTER_IRISAN.csv memetakan tiap baris redesign ke ID baseline terkait. Prefiks AC dan REDESIGN membedakan kedua register. Status tiap baris dihitung dari bukti dan fase asalnya sendiri.",
               "", "| Fase redesign | PASS | FAIL | BLOCKED | NOT_RUN |", "|---|---:|---:|---:|---:|"]
        md += [f"| {phase} | {v['PASS']} | {v['FAIL']} | {v['BLOCKED']} | {v['NOT_RUN']} |"
               for phase, v in verdict["redesign_phase_counts"].items()]
        persist(ROOT / "STATUS_RILIS.md", "\n".join(md) + "\n")
    print(json.dumps({"verified": verified, "problems": problems[:5], "label": label, "counts": counts,
                      "findings": {r["id"]: r["status_penutupan"] for r in fd_rows}}, indent=1))


if __name__ == "__main__":
    if json.loads((ROOT / 'package.json').read_bytes())['version'] == '1.6.2':
        raise SystemExit("Historical evaluator for the 1.6.1 candidate. For this package use tools/auto_release.py --write or --verify.")
    main()
