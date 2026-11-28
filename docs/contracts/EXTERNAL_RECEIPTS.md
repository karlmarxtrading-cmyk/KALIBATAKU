# Pengesahan bukti eksternal KALIBATAKU

`tools/external_receipts.py` memeriksa hasil 11 kriteria WAJIB eksternal dan PERF-03 pada fase SETELAH_PILOT. Register menerima hasil yang dikembalikan oleh `evaluate_external(root, criterion_id, default_state, default_reason, identity)`. Keputusan awal tetap BLOCKED atau NOT_RUN sesuai register apabila belum ada receipt aktif untuk kandidat.

## Pemisahan wewenang dan berkas

| Lokasi dari root kandidat | Isi dan pemilik |
| --- | --- |
| `release-authorization/external-trust.json` | Pemilik rilis menetapkan alias operator dan penelaah, kunci publik, peran, cakupan kriteria/kelas, serta target deployment yang diotorisasi. Berkas ini dipasok melalui saluran pengelola yang terpisah dari pengiriman receipt. |
| `evidence/external/receipts/<AC-ID>/<receipt_id>.json` | Dokumen UTF-8 final. Nama folder memakai ID tanpa awalan AC, misalnya UX-09. ID receipt dimulai ID kriteria diikuti tanda hubung. |
| `<receipt_id>.operator.sig` dan `<receipt_id>.reviewer.sig` | Dua tanda tangan Ed25519 atas byte dokumen yang sama, disimpan di samping JSON. |
| `evidence/external/artifacts/` | Berkas pendukung anonim yang benar-benar ditelaah. Setiap referensi menyebut path relatif, jenis artefak, MIME, deskripsi dan SHA-256. |

Kepercayaan berawal dari pemilik rilis yang memverifikasi identitas manusia, peran, akses domain dan sidik kunci melalui saluran terpisah. Operator dan penelaah memakai kunci masing-masing dan menandatangani setelah membaca dokumen serta bukti. Verifikasi kriptografi menunjukkan siapa pemegang kunci yang mengesahkan byte tersebut. Isinya, kenyataan pengujian dan kecukupan bukti tetap merupakan tanggung jawab manusia yang disebut. Siapa pun yang dapat mengubah daftar otorisasi dapat mempengaruhi keputusan. Lindungi daftar itu menggunakan kontrol perubahan organisasi dan periksa kembali saat menerima hasil. Daftar ini terpisah dari identitas source kandidat agar penugasan operator dapat dilakukan sesudah kandidat dibuat.

Kirim bukti anonim yang dapat ditinjau dan cocok dengan digest. Rekaman pribadi yang perlu disimpan terbatas dapat diganti dalam pengiriman dengan ringkasan yang telah dianonimkan, ditinjau serta cukup terperinci untuk skenario tersebut. Catat di tempat terkontrol hubungan alias dengan pelaksana/izin asli. Simpan kunci privat dan data peserta di luar ZIP dan luar direktori web.

## Menyiapkan kunci dan otorisasi

Setiap orang dapat menggunakan pasangan kunci Ed25519 yang dimiliki atau membuatnya secara lokal. Node 22+ tersedia sebagai runtime proyek. Jalankan misalnya `node tools/sign-external.mjs keygen /lokasi-privat/penelaah.pem`. Program membuat kunci privat baru dengan akses lokal terbatas dan mencetak kunci publik dalam bentuk DER SubjectPublicKeyInfo yang dikodekan Base64. Pindahkan hanya kunci publik melalui jalur pemilik rilis. Periksa izin file sesuai sistem operasi.

Bentuk daftar otorisasi berikut memuat tempat pengisian untuk pemilik rilis. Tidak ada orang yang diberi wewenang oleh contoh ini.

```json
{
  "schema": "kalibataku-external-trust/1",
  "actors": {
    "<alias operator nyata>": {
      "public_key": "<public SPKI base64>",
      "roles": ["device-operator"],
      "criteria": ["UX-09", "DEVICE-02"]
    },
    "<alias penelaah nyata>": {
      "public_key": "<public SPKI base64 penelaah>",
      "roles": ["reviewer"],
      "criteria": ["UX-09", "DEVICE-02"]
    }
  },
  "targets": []
}
```

Untuk BANK-07, beri operator `roles:["math-teacher"]`, `criteria:["BANK-07"]` dan `grades` sebagai array angka kelas yang benar-benar menjadi wewenangnya. Penelaah harus memiliki `bilingual-reviewer`. Peran operator untuk gerbang lain adalah `device-operator` (UX dan perangkat), `accessibility-operator` (ujaran), `word-operator` (Word), `pilot-moderator` (pilot), `hosting-operator` (dua uji rilis), atau `field-operator` (Web Vitals). Penelaah gerbang tersebut memakai `reviewer` dengan daftar kriteria yang diizinkan. Untuk REL-02, REL-03 dan PERF-03, pemilik menambahkan objek target berisi `origin` HTTPS dan `deployment_ids` berupa array ID deployment yang benar-benar diotorisasi. Untuk uji update/rollback masukkan ID lama, baru, dan deployment rollback yang sebenarnya.

## Membuat receipt dan menjalankan penilaian

1. Dari root kandidat, jalankan `python3 tools/external_receipts.py template UX-09 --output /lokasi-privat/formulir.json`. Gunakan kriteria yang akan diuji. Bentuk lengkap setiap skenario termasuk subset langkah, versi dan pengukuran berasal dari `tools/external_cases.py`. Template memiliki identitas kandidat saat dibuat dan tidak dapat dihitung untuk rilis.
2. Isi kolom aktual untuk konfigurasi yang benar-benar diuji. Hapus skenario yang dikerjakan oleh pelaksana lain dari kiriman. Untuk anggota cohort pilot ganti alias contoh dengan alias unik yang telah ditetapkan. Satu acara dapat disebut oleh beberapa receipt dengan ID kriteria berbeda. Setiap artefak dapat dirujuk ulang melalui digest yang sama.
3. Tambahkan berkas anonim di folder artefak. Isi `artifacts` dan hubungkan `artifact_ids` pada setiap skenario. Bentuk entri memiliki `artifact_id`, `path`, `sha256`, `kind`, `media_type`, dan `description`. Jenis bukti wajib tercantum di `required_artifact_kinds` pada template. Validator mengambil ketentuan jenis dari kontrak kandidat. Nama komponen path hanya memakai huruf, angka, titik, garis bawah dan tanda hubung. Setiap komponen diawali huruf/angka. Symlink, path absolut dan lompatan direktori ditolak.
4. Isi hasil aktual, `checks` berisi observasi langsung, keputusan skenario PASS/FAIL, pengukuran dan hasil receipt. Untuk skenario yang gagal, catat kondisi, langkah yang belum dapat dijalankan dan penyebabnya secara jujur. Penelaah mencatat keputusan `accept` atau `reject`. Pengesahan mencakup alias, peran, pernyataan bebas pelaksana serta alasan penelaahan dan waktu UTC, secara berurutan sesudah waktu uji. Format UTC memakai akhiran Z. Hapus status template dengan mengatur `template_only:false` hanya untuk hasil nyata yang lengkap. `test_only:false` wajib bagi jalur rilis.
5. Simpan JSON dengan nama sesuai `receipt_id`. Jalankan `node tools/sign-external.mjs sign RECEIPT.json operator /lokasi-privat/operator.pem` dan, di lingkungan penelaah, `node tools/sign-external.mjs sign RECEIPT.json reviewer /lokasi-privat/reviewer.pem`. Tanda tangan memakai byte asli termasuk spasi, akhir baris dan newline terakhir. Distribusikan JSON yang sama; simpan kedua signature Base64 di samping JSON.
6. Jalankan `python3 tools/external_receipts.py check UX-09`. Kode keluar 0 berarti PASS. `python3 tools/release_registers_v15.py --write` membangun register kandidat sesuai bukti aktual. Ikuti panduan rilis untuk verifikasi binding, pengemasan dan penyegelan ulang setelah perubahan isi. Domain akhir hanya diperlukan bagi gerbang domain dan pengukuran lapangan.

## Cakupan dan ambang

| Gerbang | Pemeriksaan |
| --- | --- |
| BANK-07 | 394 ID keluarga unik dan tiga referensi spesifik per keluarga dari roster. Angka kelas ditautkan dengan cakupan guru dan penelaah ID/EN menandatangani. Setiap keputusan akhir harus `setuju`. Kolom observasi menyebut bahasa, matematika, usia/strategi, urutan dan kasus batas. |
| UX-09 | Delapan kombinasi perangkat fisik Android/iOS, dua bahasa dan dua orientasi. Seluruh kontrol diperiksa dengan keyboard terbuka, draf utuh dan satu final commit. |
| DEVICE-02/03 | Android Chrome dengan Gboard dan IME kedua, serta iPhone/iPad Safari. Pemeriksaan mencakup pecahan, kedua desimal, komposisi, rotasi, safe area, pemulihan lintas perangkat, reopen, offline dan ≤1 salah ketuk dari 20. |
| A11Y-04 | Enam kombinasi ID/EN dan NVDA pada Windows Chrome/Firefox, VoiceOver pada Safari iOS/macOS, serta TalkBack pada Android Chrome. Ujaran rumus, status, urutan feedback, peta, bantuan, hasil dan galat dilengkapi bukti ujaran. |
| TEACH-03 | Kedua DOCX kontrol dicocokkan dengan SHA-256 rujukan build dan dibandingkan dengan Word sasaran. Periksa juga ekspor baru. Simpan dokumen, hasil render serta tabel perbandingan dengan jumlah persamaan dan jumlah keliru. |
| PILOT-01/02 | Tepat 12 alias siswa pada tiga kelompok materi dan tiga alias guru, izin terkonfirmasi. Setiap alias dihitung sekali. ≥11 siswa yang sama mulai dan lanjut tanpa petunjuk filter, 3/3 guru paham mandiri/revisi, nol insiden data kritis/jalan buntu. |
| PILOT-03 | Mengikat ID acara observasi siswa dan guru pada hasil aktual. Setiap temuan berisi perbaikan, bukti dan hasil retest pada build kini. Jika tidak ada masalah yang menuntut perubahan, penelaah mengesahkan alasan berbasis observasi. |
| REL-02/03 | Origin dan ID deployment diperiksa terhadap wewenang pemilik. REL-02 memeriksa hash/versi yang tersaji serta perilaku HTTP. REL-03 memeriksa dua perangkat berbeda pada transisi deployment yang sama, tab lama dan draf, worker lama/baru, serta hash, riwayat dan offline setelah rollback. |
| PERF-03 | Sesudah PILOT-03 dan REL-02 yang sesuai. Data per metrik diambil dari pengguna nyata pada deployment terverifikasi dan jendela UTC yang sudah berlalu. P75 dihitung dengan metode nearest rank, urut naik pada posisi `ceil(0,75 × n)`. Batas LCP 2.500 ms, INP 200 ms, CLS 0,1. Cantumkan populasi dan keterbatasan sampel pada observasi. |

Digest, label media, tanda tangan dan string observasi tidak memungkinkan program menilai isi audio, wawancara atau gambar secara mandiri. Penelaah wajib memeriksa bukti aktual. Ujaran harus berupa audio atau transkrip langsung; hasil Word memerlukan pemeriksaan visual pada Microsoft Word. Perangkat dan peserta benar-benar dibutuhkan pada kriteria yang mensyaratkannya.

## Kegagalan, pencabutan dan retest

Receipt biasa memakai `action:"record"` serta `previous:[]`. Cakupan beberapa receipt per AC digabung jika kasus/pesertanya berbeda. Kasus ganda yang masih aktif menimbulkan konflik. Kegagalan pengukuran atau keputusan manusia menghasilkan FAIL, meski konfigurasi lain belum diuji. Cakupan sah yang sebagian menghasilkan BLOCKED. Receipt rusak, salah peran, bukti hilang, digest salah atau attestation tidak sah menghasilkan FAIL dan alasan yang terlihat. Receipt valid build lain disimpan sebagai sejarah. Tanpa bukti yang cocok, default kriteria berlaku. Gerbang terkait memeriksa prasyarat sebelum memberi PASS.

Untuk mencabut hasil, simpan JSON baru dengan ID baru, `action:"revoke"`, `result:"REVOKED"`, `previous:[{"receipt_id":"…","sha256":"…"}]`, alasan keputusan dan kedua pengesahan. Daftar skenario serta artefak boleh kosong untuk pencabutan. Pencabutan aktif membuat kriteria BLOCKED. Pengganti memakai `action:"replace"`, ID acara retest baru, digest receipt sebelumnya dan semua bukti yang ingin tetap digunakan. Penelaahan baru harus lebih akhir dan retest tidak mendahului selesainya uji yang diganti. Penerus ganda atas pendahulu yang sama, perubahan byte pendahulu atau siklus ditolak. Riwayat gagal, pencabutan, serta hubungan pengganti tetap tersimpan. Bila beberapa hasil bertentangan, satu pengganti dapat menyebut semua pendahulu dan mencatat penyelesaian perbedaan.

Identitas build memakai kelima nilai `app_version`, `bank_version`, `offline_release`, `dist_tree_sha256` dan `source_tree_sha256`. Perubahan salah satunya membuka kembali kelulusan untuk kandidat baru. Catat dampak perubahan, uji ulang bagian relevan dan pengesahan untuk build baru dengan tanggal aktual. Untuk riwayat otorisasi yang sah pertahankan kunci publik historis sesuai proses pemilik. Ketika otorisasi dicabut atau salah diberikan, keluarkan/mutakhirkan melalui pemilik, pertahankan jejak audit dan lakukan penilaian serta pengesahan ulang sesuai penyebabnya.

Pemeriksaan perangkat lunak dapat diulang dengan `python3 tests/qa/external-receipts.py`. Suite membuat kunci dan data sintetis berlabel test-only di direktori sementara terpisah. Register selalu memakai jalur produksi yang menolak semua receipt test-only.
