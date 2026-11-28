# Memelihara KALIBATAKU 1.6.2

## Arsitektur dan batas perubahan

Aplikasi disajikan dari `dist/` sebagai berkas statis. Sumber antarmuka, penyimpanan, renderer matematika, generator laporan dan service worker berada di `src/`. Build menyalin sumber, memakai bank dari distribusi, dan membuat indeks aset offline. Jalankan `npm run build` dari checkout lengkap. Untuk mempertahankan progres, jaga identitas soal, versi konten, snapshot misi dan ID event siswa. Simpan salinan profil sebelum mengubah origin atau struktur penyimpanan.

Bank 1.2.0 dibekukan. Verifikasi `dist/bank` terhadap pin byte-for-byte dengan `python3 tools/bank-preservation.py`. Reproduksi QA memakai bank bawaan. Prosedur generasi konten historis di bawah hanya relevan untuk proyek pengembangan bank baru yang memiliki mandat perubahan kurikulum.

Kontrak aktif berada di `docs/contracts/static-auto-v1/`. Semua suite rilis dan perintahnya ada di `tests/qa/suites.json`. Pemetaan historis tetap mencatat keadaan pengujian pada kandidat yang diperiksa. Bangun ulang dan ikat bukti terhadap identitas yang benar setelah perubahan source atau profil. Baca [panduan verifikasi dan pengemasan aktif](QA_1.6.2.md).

## Catatan pemeliharaan versi terdahulu

Perintah di bawah merekam arsitektur dan alur versi yang disebut pada tiap bagian. Untuk keputusan 1.6.2 gunakan evaluator dan register static-auto-v1.

# Pemeliharaan dan pengujian

## Rilis 1.6.1

Gunakan [panduan QA 1.6.1](QA_1.6.1.md) untuk urutan perintah saat ini, termasuk bukti yang berasal dari ekstraksi ulang. Lihat [kontrak Enter](ENTER_1.6.1.md) dan [kontrak perjalanan](contracts/JOURNEY_1.6.md) sebelum mengubah player atau pemilihan misi. Bank 1.2.0 dibekukan pada 4.677 berkas. Untuk penerimaan rilis ini, jalankan verifikasi hash dan evaluator pada bank terlampir. Bagian perubahan isi bank di bawah berlaku bagi proyek konten berversi di masa depan.

## Lingkungan yang digunakan

Aplikasi klien menggunakan ECMAScript Modules, IndexedDB, Service Worker, Cache Storage, Web Workers dan aritmetika rasional. Browser memuat aset dari origin aplikasi. Lokasi hasil build tersedia di `dist/`. Source ESM dapat dibaca langsung dan build tidak menerbitkan source map tambahan. Runtime siswa tidak perlu memasang Node, Python, font sistem khusus, atau database server.

Untuk membangun ulang gunakan Node 24.22.3 dan Python 3.12. Jika tim menggunakan Windows, jalankan perintah npm melalui Git Bash dengan `python3` tersedia pada PATH, WSL, atau runner Linux. Python 3.11 adalah minimum skrip build untuk hashing. Verifikasi kurikulum dengan `python3 -m pip install -r spec/qa/requirements.txt` bila jsonschema belum terpasang. Lihat persyaratan browser di `tests/integration/README.md`. Pembuktian laporan juga menggunakan parser Office, LibreOffice headless dan perender PDF sebagaimana dicatat dalam evidence.

| Perintah dari root | Keluaran |
|---|---|
| `npm ci` | Menyiapkan lingkungan npm dari lockfile (aplikasi tidak memiliki dependensi npm). Renderer rumus bawaan ada di `src/math/typeset.mjs`; glyph-nya dibuat ulang dengan `python3 tools/build-glyphs.py`. |
| `npm run curriculum:check` | Memeriksa data sumber asli, registry efektif, errata, schema dan rencana. |
| `npm run bank:build` | Memproduksi modul ESM dari resep, membentuk shard katalog dan memperbarui pengikat SHA-256 bank. |
| `npm run bank:verify` | Memeriksa seluruh bank fisik terhadap evaluator independen, aturan, metadata dan tampilan angka. |
| `npm run check` dan `npm test` | Memeriksa sintaks source dan menjalankan tes komponen. |
| `npm run build` | Mencocokkan hash sumber/bank dan menyalin source beserta bank ke output bersih, lalu mengikat manifest offline. |
| `npm run test:e2e` | Menjalankan perintah pengujian browser yang dijelaskan di `tests/integration/README.md`. |
| `npm run preview` | Menyajikan hasil build secara lokal. |
| `npm run release:verify` | Mencocokkan isi arsip sumber yang telah diekstrak dengan inventaris dan checksum rilis. Jalankan sebelum memodifikasi file. |

## Mengubah atau menambah paket

1. Pertahankan sumber asli di `spec/00_SUMBER/`. Beri versi baru pada registry efektif dan dokumentasikan perubahan domain serta dampak pada kompetensi, prasyarat, form dan perbandingan hasil.
2. Ubah perencanaan serta resep finite di `factory/` dan validator yang berkaitan. Sertakan contoh batas sah dan contoh yang harus ditolak. Untuk kelas awal, periksa semua hasil antara. Pecahan literal adalah satu operand.
3. Ubah versi konten dan jalur distribusi untuk modul dengan isi baru. Turunkan fingerprint dari struktur dan nilai rasional. Catat representasi alternatif dan pengulangan sebagai hitungan yang terpisah.
4. Jalankan pemeriksaan kurikulum, pembuatan, verifikasi bank, tes dan build. Bandingkan dua generasi dari direktori kosong. Periksa bahwa contoh panel, form A/B dan batas performa sesuai. Simpan evidence baru sebelum mengisi verdict rilis.
5. Pertahankan hash, versi dan snapshot lama pada riwayat. Jika terjadi koreksi kunci, identifikasi attempt terdampak dengan versi konten. Rilis koreksi melalui prosedur yang dapat diaudit.

## Mengubah penyimpanan dan bridge

Beri nomor baru pada migrasi IndexedDB. Buat fixture database versi sebelumnya dengan profil, snapshot, event pending dan cache yang pernah dipasang. Uji peningkatan versi dan jalur blocked saat tab lain masih hidup. Salin/migrasikan record dalam satu transaksi upgrade. Periksa hasil melalui history, resume, preview impor, dan deduplikasi event. Beri pemberitahuan bila browser menolak storage dan unduh cadangan sebelum operasi yang menghapus data profil.

Saat menghubungkan LMS kelak, implementasikan kontrak `spec/schemas/BRIDGE_API_CONTRACT.md` dengan autentikasi, otorisasi, tenant dan registry tepercaya di server. Perbarui allowlist koneksi HTTP hanya untuk origin LMS yang ditentukan operator. Simulasi tetap berlabel demo. Gunakan event ID dan payload hash yang sama untuk retry. Tanda terima transport dan verifikasi penilaian memiliki arti berbeda. Rilis ini tidak menyertakan akun atau endpoint produksi.

## Dependensi dan aset

Kode runtime aplikasi dan semua penulis format laporan ada dalam source. Lockfile berisi root proyek saja. `evidence/deployment/npm-audit.json` berasal dari audit npm offline pada lockfile tanpa dependensi. Noto Sans lokal menyediakan aksara UI; DejaVu Sans untuk dokumen PDF. Salinan lisensi vendor berada di `src/assets/FONT-LICENSE.txt` dan `src/teacher/font/LICENSE.txt`. Browser dan tool pengujian tetap memiliki siklus pembaruan tersendiri. Versi aktual dicatat pada evidence.

Dokumentasi platform yang dipakai untuk memilih ESM dan hosting tertera di https://nodejs.org/api/esm.html dan `docs/DEPLOY.md`.


## Memeriksa perubahan UI/UX 1.1.0

Jalankan `npm test` untuk menguji kode dengan salinan direktori sementara. Untuk memperbarui bukti komponen setelah perubahan, jalankan `npm test -- --record` dari salinan proyek yang digunakan untuk QA. Berkas bukti hanya disalin setelah seluruh suite komponen pada daftar `tests/commands.json` lulus. Ekspor ulang dapat menghasilkan ID laporan dan waktu uji yang baru.

`python3 tools/clean-build.py` memeriksa dua hasil build. `python3 tools/hosting-smoke.py` menyajikan dist lewat HTTP dan HTTPS pada root serta subfolder, lalu memeriksa MIME, header, 404, hash paket dan aset offline. `python3 tools/dist-review.py` memeriksa referensi modul, ukuran dan muatan distribusi. `python3 tests/teacher/inspect_exports.py` membaca dan merender contoh ekspor yang dibuat oleh suite komponen.

Bukti lama ada di `evidence/v12/historical-1.1.0.zip`. Untuk menilai perubahan berikutnya gunakan matriks audit, browser, dan perangkat yang sesuai; publikasikan hasil terhadap hash build yang benar. Pengeditan bukti atau pengulangan tes yang menghasilkan file baru akan mengubah checksum arsip kerja.

## Pengujian 1.2.0

Pada salinan QA jalankan `npm run check`, `npm test -- --record`, `npm run curriculum:check`, `npm run bank:verify` dan `node tests/v12/bank-and-model.mjs`. Bandingkan bank ke ZIP sumber dengan `python3 tests/v12/compare-bank.py PATH_ZIP_1.1.0`. Untuk bukti dokumen jalankan `node tests/v12/feedback-and-export.mjs` kemudian `python3 tests/v12/inspect-reports.py`. Paket memuat Python Playwright scripts dan daftar versi alat di manifest. Instal browser uji lokal dengan Playwright dan gunakan `CHROMIUM_PATH` bila memakai Chromium sistem.

`python3 tests/v12/browser.py chromium`, `firefox` atau `webkit` memakai server lokal dinamis. Jalankan juga `python3 tests/integration/browser.py`, `python3 tests/v12/extended.py player shell school data visual reflow perf`, `python3 tests/v12/keyboard.py` serta `python3 tests/v12/print-contrast.py`. Untuk lintas mesin tambahkan `--engine firefox --suites data teacher offline` atau `--engine webkit --suites data teacher offline` ke browser.py pada direktori integration. `tests/perf/analyze.py` dan `tests/integration/budgets.py` menghasilkan anggaran aktual.

Renderer rumus 1.3.0 tidak memakai vendor. `python3 tools/build-glyphs.py --check` memastikan `src/math/glyphs.mjs` sama dengan ekstraksi ulang dari `src/assets/noto-Regular.woff`. PHP, CDN eksternal dan dependensi runtime lain tidak dipakai.

## Gerbang QA 1.3.0

`npm run qa:production` menjalankan seluruh suite wajib di sandbox dan menulis `evidence/v13/qa/`; `npm run qa:assess` membuat register dari binding yang lolos verifikasi ulang. Penjelasan lengkap: `docs/QA.md`. Alat 1.2.0 `tools/assess_release.py`, `tools/bind-evidence.py`, `tools/dist-review.py`, `tools/vendor-mathjax.py` dan `tests/v12/compare-bank.py` dipensiunkan dan menolak dijalankan.

## Mengubah isi bank

Ubah `factory/`, naikkan `VER` di `factory/build_bank.py` (jalur publik mengikuti, mis. `bank/v1.3/`), perbarui `src/_headers`, jalankan `npm run bank:build`, bangun bank kedua ke direktori kosong dan `python3 tests/bank/verify_bank.py --compare-bank <dir>`, lalu `python3 tools/bank-lineage.py editorial <bank lama> dist/bank <log.csv.gz>` dan perbarui snapshot identitas yang dipakai `tests/bank/domain_prose.py`.
