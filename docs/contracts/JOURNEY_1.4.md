# Kontrak data perjalanan (journey) · KALIBATAKU 1.4.0

Status: `authored_heuristic` — penetapan awal oleh penulis, belum ditelaah pengajar dan belum dikalibrasi. Tidak ada parameter psikometrik.

## 1. Sidecar metadata (terpisah dari bank)

Dibangkitkan oleh `tools/build-journey.py` dari bank 1.2 yang hanya dibaca. Bank tidak ditulis ulang (bukti `evidence/v14/bank/`). Pemeriksaan reproduksi: `python3 tools/build-journey.py --check`.

### `journey/v1/route.json` — skema `kalibataku-journey-route/1`

| Field | Isi |
|---|---|
| `metadata_version` | `1.0.0` |
| `route_version` | `route-1.0.0` |
| `feature_policy` | `difficulty-heuristic-1.0.0` |
| `reviewer_status` | `authored_heuristic` |
| `bank_content_version` | `1.2.0` |
| `mission_policy` | `policy_version` `mission-policy-1.0.0`; `intro` 6 (2 pemanasan, 4 target); `regular` 8 (2/4/2); `checkpoint` 10 (2/5/3); `readiness` {2 misi target, ≥0,8 respons pertama mandiri, cakupan min(12, butir ajar unik), strategi min(2, strategi ajar), label `product_policy_not_psychometric`} |
| `stages[]` | 60 tahap (kelas × level): `stage_id` `S-Gxx-Lyy`, `order`, `grade`, `level`, `focus{id,en}`, `nodes[]` (urutan ADD, SUB, MUL, DIV, MIX) |
| `order[]` | 300 kompetensi dalam urutan topologis rute |
| `nodes[]` | 300 node; 281 `active`. Per node: `competency_id`, `stage_id`, `operation`, `title`, `skill{id,en}` (nama keterampilan), `bank_prerequisites`, `prerequisites` (prasyarat aktif; prasyarat nonaktif diganti prasyarat aktifnya secara transitif, dicatat di `bypassed_inactive`), `pool_size`, `placements`, `unique_items`, `teaching_unique`, `teaching_strategies`, `domains`, `distinct_scores`, `band_basis`, `occ{url,sha256,bytes}` |

Graf: 712 sisi, asiklik, urutan rute topologis; pengurangan pertama (`subtraction.g01.l01`) hanya bergantung pada `addition.g01.l01`.

### `journey/v1/occ/<competency_id>.json` — skema `kalibataku-journey-occurrences/1`

Satu berkas per kompetensi aktif (281). `packages[]`: `package_id`, `content_version`, `package_sha256`, `purpose`, `form_id`, `use`, `q[]`. Setiap baris `q` adalah satu penempatan:

`[question_index, fingerprint16, band, score10, roles, features[16], repeat_of, strategy_tags, domain, template_id]`

- `use`: `mission_intro` (introduce), `mission_core` (consolidate), `mission_apply` (transfer), `mission_review` (review), `assessment_form_reserved` (form A/B; tidak dipakai misi, tetap tersedia lewat katalog/evaluasi).
- `features`: digits, ops, depth, carry, borrow, pair10, pair100, basic_fact, anchor, factor_pair, fraction, decimal, negative, denominators, conversion, inter_digits.
- `band` 1–3: tertil peringkat skor heuristik atas butir unik kompetensi (seri dipecah dengan fingerprint; `band_basis` mencatatnya).
- `roles`: `w` pemanasan, `t` target, `a` penerapan.
- `repeat_of`: penempatan pertama dengan fingerprint sama (duplikasi terencana tetap ada).

Seluruh 177.640 penempatan dari 4.604 paket tercatat (`evidence/v14/journey/summary.json`, `coverage-matrix.csv`).

## 2. Blok `journey` pada snapshot attempt (aditif)

Attempt 1.4 yang dibuat dari peta/beranda menyimpan, saat dibuat (dibekukan):

```json
"journey": {
  "journey_id": "kalibataku-adventure", "node_id": "...", "stage_id": "S-G03-L01",
  "mission_kind": "intro|regular|reinforcement|checkpoint|review",
  "metadata_version": "1.0.0", "route_version": "route-1.0.0", "policy_version": "mission-policy-1.0.0",
  "journey_policy": "journey-policy-1.0.0", "feature_policy": "difficulty-heuristic-1.0.0", "seed": 123,
  "readiness_rule": {"target_missions": 2, "min_rate": 0.8, "coverage_needed": 12, "strategies_needed": 2, "label": "product_policy_not_psychometric"},
  "selected_occurrence_refs": [{"package_id": "...", "content_version": "1.2.0", "package_sha256": "...", "question_index": 7, "question_id": "...", "question_revision": "1.2.0"}],
  "selection_trace": {"selector_version": "selector-1.0.0", "kind": "...", "seed": 123, "policy_version": "...", "candidates": [], "chosen": "...", "unique_new": 8, "review": 0, "reasons": [], "offline_filter": false},
  "created_at": "..."
}
```

Setiap item juga membawa `journey_role`, `journey_band`, `journey_review`, `occurrence_ref`. Satu attempt = satu paket (`package_id` attempt = paket semua item); lintas paket tidak diterapkan.

`flow_policy_version: "direct-result-v1"` ada pada attempt latihan baru (bukan evaluasi): soal terakhir langsung ke hasil. Attempt tanpa field ini (1.3.0) memakai aturan lamanya (grid tinjau + kirim).

## 3. Kompatibilitas dan migrasi

- Skema IndexedDB tidak berubah (`DB_VERSION` 2). Tidak ada migrasi data; field baru opsional. Snapshot 1.3 tidak ditulis ulang (uji `legacy-13-attempts-untouched`).
- Event (`attempt.started`, `answer.submitted`, …) tidak berubah dan tetap memenuhi kontrak bridge; provenance journey ada di snapshot.
- Cadangan format 2 membawa blok journey utuh (uji `archive-roundtrip-journey`).

## 4. Turunan (tidak disimpan sebagai counter)

Dihitung dari attempt setiap kali: misi selesai, misi target lulus, cakupan unik, strategi, siap lanjut, XP (5 + 10 × respons pertama mandiri per attempt selesai, dihitung sekali per `attempt_id`). Karena turunan, reload, replay, klik ganda, ambil-alih tab atau retry transaksi tidak dapat menggandakannya.
