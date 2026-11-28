# Hasil pengujian KALIBATAKU 1.6.2

Eksekusi rilis mencakup **106 suite dan 2.905 pemeriksaan**. Seluruh suite lulus. Waktu binding adalah 2026-11-28T18:52:46Z (UTC). Register dalam `REGISTER_OTOMATIS.csv` dan `RELEASE_STATUS.json` mencatat keputusan akhir paket dan deployment secara terpisah.

## Apa yang telah dicoba

- Uji ulang ketiga mesin browser melalui Enter dan klik. Pada Chromium, Firefox, dan WebKit, pemeriksaan geometri masing-masing berjumlah 145, 150, dan 145. Pengujian mengukur apakah nomor soal, ekspresi, input dan aksi berikutnya terlihat, termasuk clipping dan penutupan oleh elemen lain. Kontrol Enter menguji penahanan tombol, pelepasan sebelum simpan tuntas, input tidak sah, komposisi, revisi, kegagalan simpan, pengulangan dan satu finalisasi. Baca `evidence/v162/qa/enter-cycles-*/log.txt` dan `evidence/v162/qa/next-viewport-*/`.
- Validator bukti menjalankan 39 pemeriksaan regresi bentuk receipt dan 25 kontrol auditor. Evaluator rilis sendiri menjalankan 46 pemeriksaan. Bukti yang tidak sah atau diagnostik ditolak. Setiap log, kode keluar, perintah, jumlah pemeriksaan dan hash receipt ada dalam binding.
- Semua 4.677 berkas bank dibandingkan satu per satu terhadap sumber 1.6.1. Oracle independen menghitung kembali operasi dan langkah dari 4.604 paket dengan 177.640 penempatan dan 389.187 langkah. Register memuat 394 keluarga, ID contoh batas, strategi dan telaah AI dwibahasa. Lihat `tests/v162/family_review.json`, `evidence/v162/family/family-oracle.json` dan `evidence/v162/freeze/receipt.json`.
- Pemilih misi menjalankan 16.860 rencana, termasuk penguatan dan checkpoint. Pada kalender sintetis dengan delapan hari antarmisi, 1.070 misi mencakup 167 review, 60 checkpoint dan 281 kompetensi siap menurut aturan aplikasi. Hasil ini mengukur aturan progres. Efektivitas belajar manusia belum diukur.
- Alur siswa dan guru sintetis lulus 13 pemeriksaan. Semantik browser, fokus, bahasa, kontras dan reflow lulus 24 pemeriksaan tambahan, termasuk kontrol negatif. Contoh antarmuka dan catatan telaah AI terdapat di `PRATINJAU.html` dan `docs/REVIEW_UX_OTOMATIS_1.6.2.md`.
- Uji ekspor terhadap ledger sintetis lulus 18 pemeriksaan. Dua kasus melintasi tengah malam Jakarta. JSON, CSV, XLSX, DOCX dan PDF dibaca ulang. Struktur OMML dan PDF hasil render DOCX dengan LibreOffice diperiksa. Buka `evidence/v162/reports/examples/` untuk ledger beserta berkas yang benar-benar diperiksa.
- Pemasangan dan pengembalian 1.6.1 → 1.6.2 → 1.6.1 pada origin lokal lulus 12 pemeriksaan. Dua tab mempertahankan identitas soal dan urutan, respons pertama dan draf 37/9. Reload offline berjalan dengan aset terverifikasi dan misi berakhir sekali. Uji backup besar, kuota, transaksi dan pemulihan diterangkan oleh receipt masing-masing dalam `evidence/v162/qa/`.
- Hosting lokal diperiksa melalui HTTP dan TLS lokal pada root serta subpath. Header, tipe konten, 404, worker dan versi offline tercakup. Dua build bersih menghasilkan 5.054 berkas identik. Lihat `evidence/v162/release/clean-build/`, `evidence/v162/qa/clean-build-twice/` dan `evidence/v162/release/zip-roundtrip.json`. Segel akhir menjalankan ekstrak, verify, build dan verify sekali lagi pada ZIP pengiriman sebelum nama final diterbitkan.

## Membaca bukti

Semua bukti teknis yang mengambil bagian dalam keputusan terdapat pada `evidence/v162/qa/binding.json`. Kolom bukti register merujuk ke log dan receipt aktual. Pemeriksaan CLI terpisah tersimpan pada `evidence/v162/regression/commands/`. Keadaan historis 1.6.1 tercatat pada `evidence/v162/history-1.6.1/`. Register pemetaan menyimpan 27 baris yang sebagian beririsan. Bukti historis asli tetap mempertahankan PASS, BLOCKED atau NOT_RUN masing-masing.

| Gerbang | Pemeriksaan | Bukti utama |
| --- | --- | --- |
| AUTO-01 | Integritas dan freeze bank | `evidence/v162/qa/bank-freeze-161/receipt.json` |
| AUTO-02 | Kebenaran matematika seluruh bank | `evidence/v162/qa/bank-verify/log.txt` |
| AUTO-03 | Cakupan 394 keluarga dan telaah AI | `evidence/v162/qa/family-oracle/family-oracle.json` |
| AUTO-04 | Progresi dan review terjadwal | `evidence/v162/qa/progression-bounds/log.txt` |
| AUTO-05 | Migrasi dan kesiapan historis | `evidence/v162/qa/semantic-restore/log.txt` |
| AUTO-06 | Kontrak Enter dan finalisasi | `evidence/v162/qa/enter-cycles-chromium/log.txt` |
| AUTO-07 | Visibilitas dan input responsif | `evidence/v162/qa/next-viewport-chromium/chromium.json` |
| AUTO-08 | Tugas siswa dan guru sintetis | `evidence/v162/qa/synthetic-journeys/synthetic-journeys.json` |
| AUTO-09 | Aksesibilitas otomatis | `evidence/v162/qa/semantic-access/semantic-access.json` |
| AUTO-10 | Ekspor guru | `evidence/v162/qa/report-ledger/receipt.json` |
| AUTO-11 | Penyimpanan dan pemulihan | `evidence/v162/qa/data-contract/log.txt` |
| AUTO-12 | Offline dan pemulihan cache | `evidence/v162/qa/offline-capability-chromium/offline-capability-chromium.json` |
| AUTO-13 | Pembaruan dan rollback lokal | `evidence/v162/qa/update-161/receipt.json` |
| AUTO-14 | Validator bukti QA | `evidence/v162/qa/qa-receipt-shape/log.txt` |
| AUTO-15 | Evaluator profil rilis | `evidence/v162/qa/auto-release-policy/log.txt` |
| AUTO-16 | Riwayat dan kejujuran klaim | `evidence/v162/qa/auto-release-policy/log.txt` |
| AUTO-17 | Matriks runtime dan browser | `evidence/v162/qa/browser-v13-chromium/browser-v13-chromium.json` |
| AUTO-18 | Build kanonis yang dapat direproduksi | `evidence/v162/qa/clean-build-twice/clean-build.json` |
| AUTO-19 | Hosting lokal dan konfigurasi | `evidence/v162/qa/hosting-static/hosting-static.json` |
| AUTO-20 | Keamanan fungsi statis | `evidence/v162/qa/hosting-static/hosting-static.json` |
| AUTO-21 | Performa laboratorium | `evidence/v162/qa/performance-budgets/performance-budgets.json` |
| AUTO-22 | ZIP final dan binding | `evidence/v162/release/zip-roundtrip.json` |
| AUTO-23 | Panduan dan status pengguna | `evidence/v162/qa/package-docs/package-docs.json` |

## Identitas dan batas dukungan

- Source SHA-256 `fd4dbd2442531a9b6adf42b476a5a9732b6ca0d9ba6dab799303521bfe9c2848`
- Dist SHA-256 `4e0e7265bdf5628bc0c9dd49c51b56939221fd6d846e4da61ba967dac7f43df8`
- Profil SHA-256 `eeb88b43e3018fce41b045ee05dc1fbb417c7f5aa8d242b910c9edbbabb8571b`
- Registry SHA-256 `13a9142e5ec30b759ca6cae92e04f73438a120abf468a993a27306a1f1975755`
- Build offline `f630b3dc6aa6b5a5` · Bank `1.2.0`

Pengujian memakai Linux, Chromium, Firefox dan WebKit. Perangkat Android/iOS fisik, ujaran pembaca layar, Microsoft Word native dan build Windows native belum diuji untuk artefak ini. p75 pengguna memerlukan data lapangan. Deployment domain berstatus NOT_DEPLOYED pada saat paket ini disiapkan. Panduan operasional tersedia dalam `00_MULAI_DI_SINI.txt` dan `docs/DEPLOY.md`.
