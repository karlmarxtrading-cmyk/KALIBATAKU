# Memverifikasi kandidat KALIBATAKU 1.6.1

Untuk memeriksa **paket yang diterima**, ekstrak ZIP ke folder kosong yang memuat `package.json` dan gunakan urutan berikut. Di Git Bash gunakan `py -3.12` jika nama perintah `python3` tidak tersedia. Pemeriksa inventaris membutuhkan jsonschema. Hash SHA-256 ZIP diberikan bersama pengiriman, di luar ZIP. Untuk mengeksekusi QA yang menulis bukti baru, gunakan salinan kedua.

```bash
export PYTHONDONTWRITEBYTECODE=1 PYTHONUTF8=1
python3 tools/project.py verify
python3 tools/project.py build
python3 tools/project.py verify
python3 -B VALIDASI_EKSTERNAL/periksa.py
```

## Menjalankan pengujian perilaku

Dari salinan QA, aktifkan Node 24 dan Python 3.12. Buat virtual environment di luar akar proyek. Pasang dependensi Python dan browser Playwright, serta aplikasi LibreOffice dengan perintah soffice yang dapat dipanggil oleh runner. Pada Linux, administrator dapat menjalankan `python3 -m playwright install --with-deps chromium firefox webkit`. Bila memakai Chromium sistem yang cocok, tetapkan `CHROMIUM_PATH` ke executable-nya. Firefox dan WebKit menggunakan executable Playwright. Versi alat saat penerimaan tersedia pada catatan dependensi di direktori release dan pada receipt suite terkait.

```bash
python3 -m pip install -r requirements-qa.txt
npm run check
npm test
npm run curriculum:check
npm run build
python3 tools/build-journey.py --check
python3 tools/build-restore-index.py --check
python3 tools/bank-preservation.py
npm run qa:production
```

Daftar suite dan perintah berada di `tests/qa/suites.json`. Opsi `--parallel` memakai area kerja terpisah untuk suite yang kompatibel. Untuk diagnosis, jalankan perintah berikut. Runner mencetak lokasi folder temporer tempat hasil subset disimpan. Eksekusi subset menghasilkan bukti diagnosis. Keputusan rilis memakai binding seluruh suite.

```bash
npm run qa:production -- --only next-viewport-chromium,next-viewport-firefox,next-viewport-webkit,qa-receipt-shape,compose-commit,offline-legacy-repeat-firefox
```

| Hal yang diperiksa | Apa yang harus ditelaah |
|---|---|
| AUD160-01 | Ulangi kombinasi 320 × 568, 390 × 844 dan 844 × 390 × respons benar/salah × Enter/klik. Cocokkan capture, persegi ekspresi/input/tombol, batas area efektif, halangan, kesiapan ketik dan kenaikan indeks. Catat zoom, tema, bahasa, orientasi, awal misi, resume, misi berikut dan rumus panjang pada kasus tambahan. Baca [kontrak Enter](./ENTER_1.6.1.md). |
| AUD160-02 | Bandingkan reproduksi baseline dengan hasil suite qa-receipt-shape. Periksa bukti malformed, ID duplikat, enum/count tidak sesuai, FAIL terselubung, hambatan lingkungan, perubahan hash dan kontrol sah. Perlakukan setiap pemeriksaan sesuai kontrak produsen. Hasil FAIL/BLOCKED_ENV tetap terlihat pada tingkat pemeriksaan yang bersangkutan. |
| Petualangan dan data | Periksa pemetaan 177.640 penempatan, evaluator aritmetika, jalur 281 kompetensi, 16.860 rencana selector dan review terjadwal. Bandingkan sesi aktif, snapshot lintas versi, draf dan jawaban pertama setelah restore. Rujuk [kontrak petualangan](contracts/JOURNEY_1.6.md). |
| Offline dan pembaruan | Baca log setiap putaran, termasuk kegagalan awal yang disimpan. Bandingkan status cache, mekanisme readiness, fokus dan ledger ketika tersedia. Untuk mengulang update lokal di origin yang sama, ekstrak dist 1.6.0 di luar kandidat dan jalankan perintah di bawah. Validasi domain menggunakan protokol lapangan. |
| Native | Uji urutan path, checksum, pin bank, build dan verifikasi ulang pada Linux serta Windows asli. Catat OS, runtime dan hash sebelum/sesudah. Jalur Windows dan formulir tersedia di [panduan Windows](../VALIDASI_EKSTERNAL/07_WINDOWS_NATIVE.md). |

```bash
python3 tests/v15/update-rollback-local.py /lokasi/baseline-160/dist --out ../qa-update-161
```

## Menilai dan menyegel

Simpan hasil uji pada hash sumber, distribusi dan rilis offline yang benar. Pindahkan hanya hasil eksekusi asli ke salinan pengemasan. Catat bukti sebelum dan sesudah perubahan serta tiap percobaan gagal. [Kit eksternal](../VALIDASI_EKSTERNAL/00_MULAI_DI_SINI.md) menjelaskan tanda tangan, penelaah dan bukti sasaran asli. Saat penilaian ulang, pertahankan arsip lama secara utuh.

```bash
python3 tools/release_pack.py preflight
npm run qa:assess
python3 tools/package_check.py
npm run qa:assess
python3 tools/release_registers_v15.py --verify
python3 tools/release_pack.py seal ../KALIBATAKU_1.6.1_KANDIDAT_HOLD.zip
npm run release:verify
```

Contoh nama arsip berlaku untuk keputusan HOLD. Periksa kembali hash ZIP final, ekstrak ke direktori kosong lain dan ulangi verify → build → verify pada ekstraksi tersebut. Baca satu per satu REGISTER_AC_FINAL.csv, REGISTER_PENERIMAAN.csv, REGISTER_AUDIT_160.csv, REGISTER_IRISAN.csv dan status rilis. Tabel irisan menunjukkan persyaratan yang berbagi bukti. PERF-03 berada pada fase setelah pilot. Nama produksi diperuntukkan bagi keputusan GO yang sah pada seluruh gerbang wajib terkait.
