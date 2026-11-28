# KALIBATAKU 1.6.1 · Hasil verifikasi kandidat

**Status produksi HOLD.** Build offline `a2f40449c4738fe6`. Siswa dapat memeriksa jawaban dengan Enter, membaca jawaban sendiri, kunci dan pembahasan, kemudian menekan Enter baru untuk membuka soal berikutnya. Rekomendasi misi dijalankan langsung dari hasil.

Seluruh 94 suite resmi dijalankan pada build ini. Jumlah unit pemeriksaan sesuai definisi masing-masing suite adalah 2,325. Perintah, waktu, exit code dan checksum setiap bukti tersedia di `evidence/v161/qa/binding.json`.

## Ekspresi dan fokus pada soal berikutnya

Empat kondisi per sel mencakup jawaban benar dan salah, masing-masing dengan Enter dan klik. Kelulusan berarti soal berikutnya diukur di viewport dan input menerima fokus setelah aksi siswa. Semua kolom kandidat memakai browser desktop di Linux.

| Viewport CSS | Firefox 1.6.0, audit | Chromium 1.6.1 | Firefox 1.6.1 | WebKit 1.6.1 |
|---|---:|---:|---:|---:|
| 320 × 568 | 0/4 | 4/4 | 4/4 | 4/4 |
| 390 × 844 | 4/4 | 4/4 | 4/4 | 4/4 |
| 844 × 390 | 0/4 | 4/4 | 4/4 | 4/4 |

Pengujian tambahan mengamati jawaban ekuivalen, ketukan, modifier, status soal, ID attempt, riwayat dan jumlah finalisasi. Bukti masing-masing mesin ada di `next-viewport-*` dan `enter-cycles-*`. Pengamatan keyboard sistem Android/iOS fisik dicatat di gate perangkat.

## Bukti QA dan offline

Pada 1.6.0, probe auditor menghasilkan PASS dari dua entri rusak. Pada 1.6.1, probe yang sama menghasilkan FAIL dan nol assertion tervalidasi. Pengujian regresi juga memeriksa bukti sah, status terhalang, duplikasi, jumlah, kesesuaian hash dan penilaian ulang binding. Lihat `evidence/v161/validator-comparison/` dan suite `qa-receipt-shape`.

Riwayat Firefox 1.6.0 menyimpan putaran awal 9/10, ulangan terarah 1/1, lalu 10/10. Pada putaran pertama 1.6.1, skenario peta mengalami timeout di titik yang sama dan hasil 9/10 disimpan. Suite akhir penuh serta enam sesi Firefox terpisah (tiga peta dan tiga legacy) dijalankan dengan batas 14 detik untuk interaksi. Jejak mencatat cache sebelum/sesudah perbaikan, fokus dan keadaan input saat Enter, enam respons tersimpan dan satu finalisasi untuk setiap misi. Dalam uji waktu terpisah, Enter baru sesudah komposisi teks selesai pernah terabaikan walaupun angka sudah masuk draf. Percobaan Firefox dengan dua belas urutan masukan nyata mencatat 4/12 respons sebelum perbaikan dan 12/12 sesudahnya. Suite compose-commit juga menguji perlindungan terhadap Enter konfirmasi IME dan tombol tertahan. Penyebab timeout pada putaran pertama belum dapat dipastikan.

## Bank, progres dan operasi

Bank frozen memuat 4.677 berkas. Verifier independen memeriksa 4,604 paket, 177,640 penempatan, 168,142 fingerprint unik dan 389,187 langkah solusi. Bukti per berkas ada dalam `evidence/v161/integrity/`. Bank mencakup 4.042 paket pengajaran dan 562 paket evaluasi.

Probe kurikulum menguji 281 kompetensi aktif dan 16.860 rencana selector. Uji review terjadwal serta perbandingan dengan mesin 1.5.1 tersimpan dalam `evidence/v161/learning/`. Update/rollback dari 1.6.0 melalui 1.6.1 menggunakan penyimpanan lokal, dua tab, draf aktif dan cache pada origin uji. Lihat `evidence/v161/update-local/`.

Pengujian backup/restore, dua tab, masa laporan, ekspor guru, layout, aksesibilitas otomatis, cache, penyimpanan yang gagal dan dua build bersih termasuk di binding. Bukti Linux native di `evidence/v161/native-linux/` memakai hasil ekstraksi dengan spasi di path. Manifest akhir dan checksum setiap berkas ada di root ZIP.

## Keputusan per register

| Register atau fase | Hasil |
|---|---|
| Baseline wajib | 59 PASS, 8 BLOCKED, 3 NOT_RUN |
| Baseline setelah pilot | 1 NOT_RUN |
| Redesign, semua fase | 4 NOT_RUN, 40 PASS, 11 BLOCKED |
| Temuan 1.6.0 | 3 BLOCKED, 5 PASS |

Register baseline dan redesign saling beririsan. Hubungan ID dapat ditelusuri di `REGISTER_IRISAN.csv`. Delapan butir audit, bukti lokal dan syarat eksternal tercatat di `REGISTER_AUDIT_160.csv`.

Gerbang tersisa mencakup telaah 394 keluarga soal, validasi perangkat dan pembaca layar, Microsoft Word sasaran, pilot dengan 12 siswa dan tiga guru, domain tujuan serta Windows native. PERF-03 mengukur p75 lapangan setelah pilot. Paket `VALIDASI_EKSTERNAL/` memuat bahan, formulir, identitas build, skrip Windows dan prosedur impor untuk penilaian ulang.

| Objek | SHA-256 |
|---|---|
| Source kandidat | `fdd195f40a594faef3fe582ae00a1156850321de3dc78f05785fac96ee792b41` |
| Distribusi | `9693b517c9ef39df3e03a264e5484a7d83281b87673f204c654737e29fe4653b` |
| Binding QA | `19fe3aa1e36c6d5e260c6077c817352fd85e7fcf98d7fe957c6447ecaa6bdf8d` |
