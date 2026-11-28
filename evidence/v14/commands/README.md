# Log perintah dan reproduksi audit (build 1.4.0, dist 4b4948fc…)

Semua perintah dijalankan pada salinan checkout (bukan repo) agar pipeline tidak menulis bukti historis. Setiap log memuat perintah, waktu UTC mulai/selesai, versi runtime dan exit code. Semua exit 0.

| Log | Perintah |
|---|---|
| npm-check.log | `npm run check` |
| npm-test.log | `npm test` |
| curriculum-check.log | `npm run curriculum:check` |
| npm-build.log | `npm run build` (dist hasil = dist yang diuji) |
| linear-roundtrip.log | `node tests/math/linear-roundtrip.mjs` |
| domain-prose.log | `python tests/bank/domain_prose.py` |
| bank-verify.log | `npm run bank:verify` |
| bank-preservation.log | `python3 tools/bank-preservation.py` |
| journey-check.log | `python3 tools/build-journey.py --check` |
| probe-next-practice.log/.json | probe attempt berikutnya (katalog dan misi) |
| audit-*.log + audit-repro/*.json | lima skrip `08_REPRODUKSI` audit, dijalankan tanpa perubahan |

`npm run release:verify` membutuhkan inventaris yang ditulis saat penyegelan; hasilnya ada di `evidence/v14/release/package-check.json` (dijalankan dalam salinan yang diekstrak dari ZIP percobaan) dan dilaporkan lagi setelah ZIP final diekstrak.

## Membaca hasil reproduksi audit pada 1.4.0

- `archive_edge_probes.json`: 150.000 record kini dipulihkan (150000); entri STORED tak konsisten ditolak `INVALID_ARCHIVE` tanpa membaca body (1.3.0: RangeError dan pembacaan 1.048.576 byte).
- `shipped-oracle-rerun.json` dan `bank-independent-audit.json`: PASS; bank tetap 4.604 paket / 177.640 slot.
- `progression-probe.json` masih menulis `same_question_order: True`. Probe itu membandingkan **prefiks paket** (`pkg.questions.slice(0,10)`), bukan soal attempt yang benar-benar dibuat, dan memakai jalur katalog dengan paket eksplisit. Bank sengaja tidak diubah, jadi prefiksnya memang sama. Attempt yang benar-benar dibuat berikutnya diukur oleh `probe-next-practice.json`: katalog overlap 0 soal (urutan sama: False); tiga misi berurutan G03L01ADD 22 soal, 22 unik.
- Keputusan adaptif lama (`adaptive_after_perfect_practice`) tetap `collect` karena mode adaptif katalog 1.3 tidak diubah; kelanjutan setelah latihan sempurna kini diberikan oleh `nextMission` (uji `perfect-practice-advances`).
- `session-selection-reproduction.json`: reproduksi pemilihan sesi katalog 1.3 dijalankan ulang tanpa perubahan untuk perbandingan.
