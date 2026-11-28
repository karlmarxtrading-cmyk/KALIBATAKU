# Memeriksa rilis 1.6.2

## Membaca sebuah rilis

Mulai dari `RELEASE_STATUS.json` dan `REGISTER_OTOMATIS.csv`. Cocokkan identitas versi, source, dist, bank, profil, daftar suite dan bukti dengan manifest rilis. Baca status package dan deployment secara terpisah. Untuk keputusan lama, gunakan `REGISTER_PEMETAAN_HISTORIS.csv` dan `evidence/v162/history-1.6.1/`. Binding 1.6.1 mencatat 94 suite dan 2.325 pemeriksaan historis.

## Memverifikasi unduhan tanpa membangun ulang

Di Git Bash, gunakan `sha256sum "nama ZIP yang diterima"` dan bandingkan nilai lengkap dengan pesan pengiriman. Ekstrak ke folder kosong. Periksa seluruh byte di dalamnya dari direktori yang memuat `package.json`.

```bash
sha256sum --check --quiet SHA256SUMS
```

Perintah mengembalikan kode 0 jika seluruh entri cocok. Pemeriksaan menyeluruh terhadap inventaris, file tambahan, identitas, register dan kebijakan menggunakan `python3 tools/project.py verify` dari Linux atau `py -3.12 tools/project.py verify` dari Git Bash dengan Node dan jsonschema terpasang. Lakukan QA yang menulis bukti baru pada **salinan kerja terpisah**.

## Mereproduksi dari source di Linux

Versi alat yang dipin tercantum dalam `.nvmrc`, `.python-version`, `requirements-qa.txt` dan manifest lingkungan. Gunakan Node 24, Python 3.12, Playwright dengan ketiga mesin browser, LibreOffice (`soffice`), serta dependensi sistem browser dan font. Sediakan ruang untuk ZIP, checkout QA dan hasil render. Untuk uji lintasversi, gunakan input baseline yang ditentukan pada suite dan pin yang menyertainya. Seluruh profil uji harus sintetis.

```bash
export PYTHONDONTWRITEBYTECODE=1 PYTHONUTF8=1
python3 -m venv ../venv-kalibataku
source ../venv-kalibataku/bin/activate
python3 -m pip install -r requirements-qa.txt
python3 -m playwright install --with-deps chromium firefox webkit
node --version
python3 --version
soffice --version
npm run check
npm test
npm run curriculum:check
npm run bank:verify
npm run build
npm run release:preflight
npm run qa:production -- --parallel
npm run qa:assess
npm run release:roundtrip
npm run qa:assess
```

Jika memakai Chromium sistem, atur `CHROMIUM_PATH` ke executable yang sesuai. Direktori kerja, log dan hasil suite dapat ditemukan dari keluaran runner. Daftar perintah dan kriteria bukti setiap suite berada pada `tests/qa/suites.json`. Lihat nama dan versi alat yang **benar-benar berjalan** pada receipt. Evaluator membaca bukti yang terikat ke source, dist dan profil rilis. Perubahan source yang masuk identitas rilis memerlukan bukti baru. Hasil diagnosis dari `--only` berguna untuk menelusuri kegagalan.

Untuk membuat arsip setelah gerbang wajib lulus, jalankan dari salinan rilis:

```bash
npm run release:pack -- ../KALIBATAKU_1.6.2_PRODUCTION_READY.zip
sha256sum ../KALIBATAKU_1.6.2_PRODUCTION_READY.zip
```

ZIP memuat inventaris dan `SHA256SUMS`. Hash luar ZIP dihitung setelah penyegelan. Untuk menguji ekstraksi secara manual, ikuti urutan verify → build → verify dari direktori kosong. Suite build bersih juga membandingkan pohon dist dari dua build. Hasil lokal yang gagal dapat didiagnosis dari exit code, expected/actual, artefak dan identitas build pada receipt. Pertahankan log upaya awal sebelum mengulang.

## Menelusuri satu temuan

| Area | Sumber dan pemeriksaan |
| --- | --- |
| AUD160-01 | Lihat suite `next-viewport-*` dan `enter-cycles-*`. Periksa geometri nomor/ekspresi/input/aksi, clipping/occlusion, indeks soal dan pengetikan sesudah Enter baru atau klik. Kontrak transisi dijelaskan dalam `docs/ENTER_1.6.1.md`. |
| AUD160-02 | `qa-receipt-shape` dan kontrol evaluator menguji jenis assertion, duplikasi, jumlah, status, identitas/hash dan asal hasil rilis. Simpan hasil kontrol penolakan bersama contoh bukti sah. |
| Laporan | `report-ledger` memakai jawaban awal salah, revisi pecahan benar dan dua tanggal lokal per kasus. Dua kontrol per kasus mengganti kunci/tanggal acuan. OOXML, workbook, data tabel dan teks/gambar PDF dibaca ulang, termasuk PDF yang dirender dari DOCX. |
| Stabilitas data | Bandingkan riwayat, draf, ID, urutan, respons pertama, revisi dan finalisasi sebelum/sesudah restore, pergantian versi serta perbaikan aset offline. |
| Hosting dan operasi | Uji lokal mencakup root dan subpath. Verifikasi domain terikat ke URL dan deployment penyedia yang benar-benar tersedia. Bukti p75 lapangan baru dapat berasal dari penggunaan nyata. |

Rincian semantik petualangan, progres dan pemulihan tersedia pada kontrak di `docs/contracts/`. Untuk klaim perangkat, ujaran, Word, pilot, Windows serta hosting, lihat `KNOWN_LIMITATIONS.md` di akar arsip.
