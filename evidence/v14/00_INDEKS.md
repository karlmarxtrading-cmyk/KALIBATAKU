# Indeks bukti KALIBATAKU 1.4.0

| Folder | Isi | Terikat pada |
|---|---|---|
| `qa/` | Gerbang `npm run qa:production`: per suite `log.txt` + receipt (`kalibataku-qa-receipt/1`), `binding.json` (SHA-256 semua receipt/log, hash registry, build, runtime) | `dist_tree_sha256` dan `offline_release` di `RELEASE_STATUS.json` |
| `release/` | `release-manifest.json` (hash source + dist), `dependencies.json`, `archive-preflight.json`, `package-check.json` | build final |
| `bank/` | Manifest SHA-256 4.677 berkas bank sebelum (dari ZIP 1.3.0) dan sesudah | bank 1.2.0 |
| `journey/` | Ringkasan sidecar (300 node, 281 aktif, 712 sisi, 177.640 penempatan), `coverage-matrix.csv` (kompetensi × penggunaan × band) | metadata 1.0.0 / route-1.0.0 |
| `review/` | Roster 394 keluarga template (kolom penelaah kosong), ringkasan | DOC-01 |
| `browser/` | Tangkapan layar alur petualangan (Chromium headless) + receipt | build final |
| `exports/` | Laporan contoh dengan bagian petualangan (PDF/DOCX/XLSX/CSV/JSON) dari data sintetis | build final |
| `commands/` | Log perintah baseline (check, test, curriculum, build, roundtrip, domain prose, bank verify) dan reproduksi `08_REPRODUKSI` pada salinan source | build final |
| `audit-input/` | `04_TEMUAN_DAN_PRIORITAS.csv`, `05_KRITERIA_PENERIMAAN.csv` dari ZIP audit 2026-11-28 (tidak diubah) | — |
| `external/forms/` | Formulir kosong untuk sesi eksternal dan pilot | — |

Semua data siswa di bukti ini sintetis (alias “QA …”, “Journey test”). Tidak ada data siswa nyata.
