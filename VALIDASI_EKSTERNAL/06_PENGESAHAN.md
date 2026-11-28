# Mendaftarkan hasil dan memeriksa keputusan

Gunakan [kontrak receipt dan otorisasi](../docs/contracts/EXTERNAL_RECEIPTS.md) sebagai acuan format. Proses dijalankan dari root kandidat. `template_only: true` menandai setiap [formulir JSON siap isi](template-receipt/INDEX.md); semuanya memuat identitas build yang sama. Salin draf ke area kerja operator. Pertahankan berkas kosong asli sebagai bahan untuk sesi berikutnya.

## Persiapan oleh pemilik rilis

- Verifikasi kandidat dan kit dengan `python3 -B VALIDASI_EKSTERNAL/periksa.py`. Pemilik rilis memverifikasi identitas dan peran pelaksana serta penelaah melalui saluran independen, lalu mengonfigurasi daftar pemberian wewenang pada `release-authorization/external-trust.json`. Catat jenjang yang sah untuk guru matematika, serta origin dan ID deployment yang sah untuk REL-02/03 dan PERF-03.
- Setiap orang menggunakan kunci Ed25519 miliknya sendiri. Subperintah `keygen` dapat digunakan jika dibutuhkan. Simpan berkas privat di luar folder proyek dan kirim hanya kunci publik kepada pemilik rilis. Pemilik menetapkan kepercayaan secara terpisah dari kiriman bukti operator. Daftar identitas maupun izin riil menunggu penetapan pemilik.
- Untuk membuat draf baru secara lokal, jalankan dari root kandidat, arahkan hasil ke nama baru di folder kerja privat yang sudah ada. Ganti `UX-09` sesuai gerbang.

```bash
python3 tools/external_receipts.py template UX-09 --output /path/privat/draf-UX-09.json
```

## Mengisi dan menandatangani

1. Tetapkan `receipt_id` unik, misalnya pola `UX-09-<acara>-<nomor>`, dan nama berkas yang sama diikuti `.json`. Isi `test_event_id`, fase, protokol yang benar-benar digunakan, waktu mulai dan selesai dalam UTC dengan akhiran `Z`, identitas/peran pelaksana dan penelaah, waktu serta pernyataan pengesahan mereka. Jangan menebak versi, jumlah, peran atau hasil yang belum diamati.
2. Isi setiap `checks` dengan **observasi nyata pada langkah tersebut**, `measurements` dengan angka atau referensi nyata, lalu tentukan `result` berdasarkan pengamatan. Pilih satu nilai aktual untuk placeholder seperti `Chrome|Firefox`. Isilah dua belas alias berbeda untuk cohort siswa dan tiga alias berbeda untuk cohort guru. Untuk BANK-07 guru per jenjang dapat mengirim subset keluarga dengan guru/penelaah yang berwenang. Agregasi memerlukan cakupan lengkap; jangan duplikasi kasus dari beberapa receipt dalam satu kriteria.
3. Siapkan salinan bukti terotorisasi yang sudah dianonimkan di `evidence/external/artifacts/`. Catat untuk setiap artefak `artifact_id`, `path` relatif terhadap folder tersebut, `kind`, MIME, deskripsi dan SHA-256. Samakan referensi pada `artifact_ids` di skenario. Gunakan `sha256sum NAMA_BERKAS` terhadap byte final yang akan diserahkan. Untuk Word, lampirkan kontrol asli, ekspor baru, bukti render aktual dan tabel perbandingan. Bukti privat yang tidak dapat dibagikan dapat ditelaah oleh pihak berwenang di tempat; lampirkan ringkasan anonim yang cukup untuk audit. Berkas yang disebut receipt harus dapat diperiksa loader dan penelaah.
4. Setelah observasi, artefak dan keputusan review final terisi, set `template_only` menjadi `false` dan pertahankan `test_only: false` pada pelaksanaan nyata. Berkas uji perangkat lunak sintetis tidak boleh dimasukkan sebagai pelaksanaan eksternal. Pindahkan JSON final ke `evidence/external/receipts/<AC-ID>/<receipt_id>.json`. Dua orang menandatangani **byte JSON yang sama**, masing-masing di lingkungan pribadinya. Contoh perintah berikut memakai nama receipt yang sudah diisi operator pada variabel `RECEIPT`.

```bash
read -r -p "Berkas receipt JSON hasil observasi: " RECEIPT
node tools/sign-external.mjs sign "$RECEIPT" operator /path/privat/operator.pem
node tools/sign-external.mjs sign "$RECEIPT" reviewer /path/privat/reviewer.pem
```

Koordinator menyimpan dua berkas tanda tangan `.operator.sig` dan `.reviewer.sig` di samping JSON. Setiap pihak hanya mengoperasikan perintah yang sesuai dengan perannya. Pengelola rilis tidak perlu menerima kunci privat mereka.

## Memeriksa dan memperbarui register

```bash
python3 tools/external_receipts.py check UX-09
python3 tools/release_registers_v15.py --write
python3 tools/release_registers_v15.py --verify
```

Ganti kriteria pada perintah pertama sesuai bukti yang didaftarkan. Periksa status dan alasan untuk setiap kriteria. Data hilang/cakupan sebagian, kegagalan nyata, serta receipt rusak atau salah identitas mempunyai konsekuensi spesifik sesuai kontrak loader. Status dan alasan harus tetap terbaca. Keputusan produksi memerlukan seluruh 70 WAJIB lulus dan temuan terkait ditutup. Laporkan PERF-03 secara terpisah.

Untuk membatalkan atau mengganti receipt lama gunakan `action: revoke` atau `replace`, sertakan ID/digest dokumen asli, alasan, waktu, dua pengesahan dan hasil retest yang sesuai. Setelah build berubah, buat receipt baru pada identitas yang benar serta dokumentasikan apa yang diuji kembali dan apa yang diperiksa relevansinya. Simpan bukti awal dan jejak penggantian. Setiap paket rilis yang berubah setelah bukti masuk perlu disegel dan diverifikasi kembali melalui proses rilis proyek.

Setelah ada tambahan atau penggantian bukti, [jalankan kembali pemeriksaan paket, penilaian dan penyegelan](../docs/QA_1.6.1.md). Inventaris yang sudah ditandatangani hash merujuk ke paket semula sampai proses tersebut selesai. Buka juga REGISTER_AUDIT_160.csv dan REGISTER_IRISAN.csv untuk persyaratan yang memakai hasil ini.
