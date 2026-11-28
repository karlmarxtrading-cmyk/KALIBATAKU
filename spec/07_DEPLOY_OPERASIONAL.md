# Build, deployment dan operasi KALIBATAKU

Tanggal verifikasi referensi: 25 November 2026. Dokumen ini menjelaskan keluaran yang harus dibuat oleh pelaksana website. ZIP arahan yang sedang dibaca **belum mempunyai `dist/` aplikasi dan tidak dimaksudkan untuk langsung diunggah sebagai website**.

## 1. Isi ZIP rilis aplikasi nanti

| Lokasi | Tujuan | Masuk hosting publik? |
|---|---|---|
| Source root: `src/`, `public/`, `factory/`, tests, package/lockfile, config | Diedit dan dibangun melalui Git | Source tidak disajikan sebagai root website |
| `dist/` | Hasil build lengkap: HTML, aset, bank, manifest, SW, font dan header config | Ya, folder output publik |
| `docs/` | Panduan penggunaan, konten, kontrak, migrasi dan operasi | Tidak wajib dipublikasikan |
| `evidence/` | Hasil pengujian build yang sama | Tidak wajib dipublikasikan |
| `RELEASE_STATUS.json` dan checksums | Identitas rilis dan bukti kesiapan | Boleh disediakan terbatas; tanpa informasi sensitif |

Struktur akhir harus memungkinkan satu root repository yang jelas. Jangan memberi dua folder berisi package.json berbeda tanpa menjelaskan mana sumber kanonik. `dist` adalah hasil build yang disajikan ke browser; keberadaannya tidak berarti ada backend. Pengguna dapat memilih Git integration yang membangun source, atau upload `dist` yang sudah diverifikasi.

## 2. Perintah yang harus disediakan implementasi

Nama perintah berikut menjadi kontrak package scripts; pelaksana wajib benar-benar membuatnya, bukan hanya mencantumkan di README:

| Perintah | Hasil |
|---|---|
| `npm ci` | Memasang dependency sesuai lockfile pada runtime yang dipin |
| `npm run curriculum:check` | Validasi registry, errata, prasyarat dan kelengkapan resep |
| `npm run bank:build` | Membentuk seluruh bank deterministik |
| `npm run bank:verify` | Verifikasi seluruh bank, termasuk oracle independen atau langkah CI pendamping yang dijelaskan |
| `npm run check` | Typecheck/lint yang relevan tanpa menyembunyikan error |
| `npm test` | Unit/integration domain, parser, data dan kontrak |
| `npm run test:e2e` | Browser end-to-end dengan fixture dan versi browser tercatat |
| `npm run build` | Memvalidasi integritas bank yang dipakai dan membuat dist; gagal jika bank tidak ada/stale |
| `npm run preview` | Menyajikan dist untuk inspeksi lokal HTTP, bukan server produksi |
| `npm run release:verify` | Inventaris, hashes, file paths, budgets, coverage dan status gate |

Generator dan verifier Python jika dipakai harus menyertakan requirements/runtime atau menggunakan standard library. Jangan menyembunyikan kebutuhan Python pada skrip yang diklaim npm-only. CI menggunakan runtime yang sama, lockfile commit, seed tetap, serta cache yang tidak menutupi build bersih. Pustaka UI/bundler dipilih dan versinya dicatat saat implementasi; konfigurasi harus cocok dengan versi terpasang. Vite menghasilkan bundle untuk hosting statis dan mempunyai aturan base path serta kegagalan dynamic import yang perlu diperhatikan. [D01]

## 3. Strategi build bank pada hosting

Pilih satu strategi, dokumentasikan dan uji dari clone bersih:

**Default: bank dibangkitkan dan diverifikasi pada proses rilis/CI, lalu output data bank yang diperlukan ikut source release atau artefak yang terikat hash.** Cloudflare build memeriksa integritas dan membangun aplikasi tanpa mengulang pekerjaan generasi yang mahal. Dengan cara ini deployment rutin UI tidak mengubah bank atau membutuhkan random generation dari awal. Jika meng-commit output ESM bank, jangan ikut commit data siswa atau evidence yang tidak perlu publik.

**Alternatif yang harus dibuktikan:** `npm run build` membentuk dan memverifikasi bank penuh pada host. Catat waktu aktual, runtime dan limit; kegagalan generator tidak boleh membuat deploy sukses dengan bank kosong. Jangan mengunduh artefak bank dari URL sementara atau private credential yang tidak tersedia saat rebuild.

Dua clean runs atas seed/configuration yang sama harus menghasilkan canonical content hashes yang sama. Timestamp rilis dapat berbeda di metadata provenance, sehingga jelaskan apakah determinisme berlaku pada canonical content atau seluruh archive byte-for-byte. Jangan mengklaim keduanya jika hanya satu yang diuji.

## 4. GitHub → Cloudflare Pages

Alur untuk pengguna setelah ZIP rilis tersedia: ekstrak ZIP, buka root source yang ditunjuk README, inisialisasi/pakai repository milik pengguna, commit source/lockfile/bank yang ditetapkan, lalu push ke repository yang memang dipilih pengguna. Hindari perintah hard-coded ke repository proyek lain. Jangan menjalankan `git reset --hard`, force push atau menghapus remote sebagai langkah rutin.

Di Cloudflare Pages, hubungkan repository, pilih branch, set root directory sesuai README, build command `npm run build` dan output `dist`. Jika monorepo, root bukan otomatis `/`. Runtime harus sesuai `.node-version`/config yang disertakan dan diuji. Semua fungsi inti rilis ini harus berjalan tanpa Pages Functions atau environment secrets. Konfigurasi API LMS kosong secara default dan tidak memunculkan request ke endpoint imajiner.

Cloudflare menyediakan panduan static HTML dan konfigurasi build; setting harus diperiksa kembali ketika pelaksana benar-benar deploy. [D02] Rilis aplikasi harus menyertakan tangkapan/hasil verifikasi konfigurasi yang dipakai jika deployment dilakukan, atau instruksi yang jelas jika hanya menyerahkan dist. Deployment publik baru dilakukan ketika pengguna memang memintanya dan akses tersedia; penyusunan ZIP tidak otomatis berarti publikasi.

## 5. Batas hosting yang relevan

Dokumentasi Pages yang diperiksa menyebut batas Free 20.000 file, ukuran maksimum satu aset 25 MiB dan timeout build 20 menit. Paket soal, aplikasi, font, worker, manifest dan retained bank versions semuanya ikut hitungan. [D03] Baseline 4.604 paket tidak otomatis memastikan dist lolos batas; inventaris seluruh file wajib dihitung. Hindari satu file per soal dan duplikasi source maps/ZIP laporan di folder publik. Batas platform bisa berubah; verifier rilis harus mencatat batas yang dipakai.

Jika jumlah melampaui batas, utamakan packaging konten yang mempertahankan logical packages dan lazy loading. Jangan menghapus kompetensi, menggabungkan seluruh bank menjadi satu unduhan besar, atau mewajibkan upgrade plan tanpa mengevaluasi struktur output. Pertimbangan paid plan bukan bagian wajib PRD ini.

## 6. Base path, route dan module loading

Uji hosting di root dan satu subfolder. URL untuk manifest, paket, worker, font dan SW harus dibangun dari base path yang benar, bukan string absolute yang hanya berjalan pada localhost. Route deep link/refreshed harus menghasilkan aplikasi atau halaman not-found yang jelas; missing `.js`/`.json`/font harus benar-benar gagal, tidak dikembalikan `index.html` dengan HTTP 200.

Jika memakai hash routing, sampaikan alasan portabilitas dan tetap uji query/state. Jika memakai history routing, sediakan fallback sesuai hosting yang tidak menelan missing assets. Jangan menaruh fallback universal tanpa menguji import error. Header `Content-Type` untuk JS/module harus benar. Dynamic import yang gagal setelah update perlu tindakan pulih; simpan sesi sebelum menawarkan reload dan jangan berulang tanpa batas. [D01]

## 7. Cache, header dan CSP

Kebijakan awal: HTML dan pointer manifest terbaru dapat diperiksa ulang; aset berhash/versi immutable boleh cache lama; data sesi/profil tidak dimasukkan cache publik. SW punya scope sesuai base dan release yang eksplisit. Paket yang dipin sesi tidak bercampur dengan revisi baru. Service Worker update tidak otomatis `skipWaiting` dan reload saat siswa mengerjakan tanpa jalur aman.

File `_headers` dan `_redirects` hanya dinyatakan benar setelah perilaku respons aktual diuji pada hosting target. CSP berawal dari `default-src 'self'`, kemudian daftar kebutuhan aktual worker/blob/font/style/connection dicatat; aturan final harus diuji dan tidak membutuhkan unsafe-eval. Jika runtime exporter perlu blob URL, atur hanya directive yang diperlukan. Remote API origin tidak ditambahkan sebelum ada konfigurasi sah. Referensi header/redirect Cloudflare tersedia untuk penyesuaian platform. [D04][D05]

Jangan menganggap CSP menyembunyikan kunci jawaban atau membuat file JS publik tidak bisa diinspeksi. Header melindungi permukaan tertentu; integritas nilai resmi tetap tugas server dan kebijakan institusi.

## 8. Verifikasi setelah deploy

Checklist operasional yang harus menghasilkan bukti, bukan hanya dicentang:

1. Buka halaman baru dalam cache kosong: bahasa/tema/CTA benar, tidak meminta login untuk latihan lokal.
2. Buka paket G01, G05, G07 dan G12; periksa integer, pecahan, desimal, negatif, MIX, dua bahasa dan hasil yang diketahui.
3. Selesaikan sesi, reload, tinjau history, ubah tema/locale tanpa kehilangan data; coba backup/import fixture.
4. Muat teacher/admin demo, kerjakan sebagai siswa demo, pastikan monitoring berubah dan tetap berlabel demo.
5. Unduh setiap format laporan, buka hasil, cek angka/label/encoding dan pagination. Uji ZIP batch sebagian gagal.
6. Pasang satu paket offline, matikan jaringan, mulai/lanjut latihan yang cached; paket belum installed menunjukkan batas yang benar.
7. Periksa network: initial tidak mengunduh semua bank; report chunk hanya setelah ekspor; tidak ada request LMS tak terkonfigurasi, error console, asset404 atau JS yang menerima HTML.
8. Deploy perubahan kecil dengan sesi lama aktif; uji pin versi, pembaruan aman, backup dan rollback. Jangan menguji pada data siswa nyata tanpa rencana yang sah.

Hasil lokal static server tidak disebut production-host pass. Jika belum ada deployment yang diminta/diizinkan, `live_deployment=NOT_PERFORMED` dan dist tetap bisa memiliki hasil verifikasi lokal yang dinyatakan apa adanya.

## 9. Pembaruan konten dan rollback

Penambahan paket: ubah template/seed/version jika perlu → generate → verify → refresh manifest → run affected end-to-end → build → release inventory. Ganti kunci salah: buat revisi item, catat issue/dampak, jangan mengedit nilai histori tanpa rekalkulasi yang transparan. Update kurikulum besar memerlukan peta kompatibilitas competency_id lama/baru.

Rollback aplikasi tidak boleh membuang event baru atau migrasi database secara diam-diam. Simpan `min_reader_version`/compatibility pada schema; bila aplikasi lama tidak bisa membaca data baru, tampilkan pemulihan/backup, bukan database reset. Retained content versions dibatasi kebijakan yang menghormati attempt aktif dan laporan historis; inventaris file hosting diperiksa lagi.

## 10. Operasi dan tanggung jawab

| Peran | Tanggung jawab |
|---|---|
| Pemilik produk/guru | Meninjau progresi, bahasa pembahasan, contoh, blueprint dan kebijakan mastery; memberi feedback pilot |
| Pengembang | Engine, schemas, factory, storage, bridge, UI, keamanan relevan, tests dan distribusi |
| Reviewer QA | Memeriksa bukti build final, kegagalan, browser/aksesibilitas/ekspor dan traceability |
| Admin institusi nanti | Identitas, hak akses, penugasan, retensi dan publikasi laporan resmi melalui LMS |

Bukti review manusia harus merujuk peninjau nyata dan waktu aktual. Model tidak membuat tanda tangan atau data pilot fiktif. Pengguna memperoleh cara menambah paket tanpa memodifikasi cangkang, memeriksa coverage, menghapus data lokal, mengekspor backup, mengatasi storage penuh dan mengetahui status server.

## Referensi resmi

- [D01] Vite, Building for Production: https://vite.dev/guide/build — build statis, base path dan dynamic import failures.
- [D02] Cloudflare Pages, Static HTML: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/ — pola deployment situs statis.
- [D03] Cloudflare Pages, Limits: https://developers.cloudflare.com/pages/platform/limits/ — batas file/aset/build yang diverifikasi pada tanggal dokumen.
- [D04] Cloudflare Pages, Headers: https://developers.cloudflare.com/pages/configuration/headers/.
- [D05] Cloudflare Pages, Redirects: https://developers.cloudflare.com/pages/configuration/redirects/.

Anggaran performance, struktur release dan prosedur di luar fakta platform tersebut merupakan keputusan proyek, bukan persyaratan yang dikutip dari penyedia hosting.
