# Bank KALIBATAKU 1.1.0

Seluruh isi paket dihasilkan dari registry efektif `1.0.0-draft.2` dan `planning/package_plan.json`. Jalankan perintah dari direktori yang berisi `package.json`. Python hanya memakai pustaka standar. Verifikasi impor ESM dan oracle rasional kedua memakai Node.

```sh
npm run bank:build
python3 factory/build_bank.py --output /tmp/kalibataku-second/bank --evidence /tmp/kalibataku-second/evidence
python3 tests/bank/verify_bank.py --compare-bank /tmp/kalibataku-second/bank
python3 factory/export_recipes.py
node tools/audit-bank.mjs
```

Pakai dua direktori kosong untuk mengulang pengujian determinisme dari awal. Simpan keluaran percobaan dan paket gagal di luar `dist/`. Factory membuat kandidat di direktori sementara dan menjalankan oracle BigInt pada seluruh paket sebelum menginstal hasil. Jika terjadi pelanggaran, kandidat dan failure.json masuk karantina sistem sementara. Bank yang telah terpasang dipertahankan. Publikasikan hasil baru sesudah semua validasi selesai. Mengubah bagian matematika, pembahasan, metadata tampilan, alokasi, atau struktur bank memerlukan versi konten dan jalur bank baru agar percobaan lama tetap mengacu pada materi semula.

## Berkas untuk penulis soal

| Lokasi | Fungsi |
|---|---|
| `domains.py` | Grid parameter finite dan pemeriksaan domain eksak tiap operasi tunggal, termasuk aturan inverse pembagian |
| `mixed.py` | Bentuk AST MIX, ikatan variabel berulang, predikat pola mental, dan batas setiap hasil antara |
| `pedagogy.py` | Hint dwibahasa dan langkah-langkah ekuivalen yang mempertahankan nilai seluruh ekspresi |
| `build_bank.py` | Alokasi paket, prasyarat, sidik jari kanonik, hash berkas serta indeks berjenjang |
| `tests/bank/oracle.mjs` | Penghitungan kedua dengan pembilang/penyebut BigInt, nilai display, seluruh langkah, impor seluruh paket dan bentuk JSON tanpa efek samping |
| `tests/bank/verify_bank.py` | Pemeriksaan domain ulang dari berkas publik, kasus batas/negatif, DAG prasyarat, pool, bentuk evaluasi, distribusi, dan determinisme |
| `evidence/bank/recipes.json` | Katalog 281 resep, bentuk AST, domain operand dan referensi kode pemeriksa |
| `evidence/bank/operand-grids.json.gz` | Kamus grid operand dengan nilai aktual, jenis tampilan, rentang dan identitas SHA-256 |
| `evidence/bank/coverage.json` | Hasil setiap sel, hitungan pool, subtipe, overlap A/B, histogram blueprint |
| `evidence/bank/inventory.json` | Bukti jumlah, hash, ukuran, target, alokasi dan pengulangan tiap paket |
| `evidence/bank/semantic-by-cell.json` | Kasus batas, fixture negatif, batas yang teramati dan distribusi jawaban |
| `evidence/bank/oracle-by-level.json` | Jumlah file, soal dan langkah yang benar-benar diperiksa oleh oracle kedua |

## Makna hitungan

`question_slots` menghitung seluruh penempatan dalam paket. `unique_canonical_items` menghitung sidik jari matematika global. Locale, pengurutan ulang operand komutatif dan cara menulis rasional ekuivalen mempertahankan sidik jari. `intentional_repeated_slots` menghitung selisih total slot dan bentuk kanonik global. `representation_variants` menghitung ekspresi/tampilan tambahan yang benar-benar diterbitkan di atas jumlah bentuk kanonik. Penyebut pecahan tampilan asli disimpan bersama nilai kanonik tereduksi. Encoder v1 menulis leaf sebagai R:n/d dan node sebagai OP(kiri,kanan), mengurutkan kedua string anak untuk ADD/MUL. Contoh kurikulum MUL(R:24/1,R:4/1) diuji langsung terhadap fingerprint contoh kontrak sebelum tes domain. Satu bentuk kanonik dapat menargetkan lebih dari satu kompetensi. ID butir memasukkan kompetensi dan sidik jari.

Konstruksi memakai perkalian dan penjumlahan modular pada indeks produk Kartesius, dengan langkah yang relatif prima terhadap ukuran grid. Seed stabil berasal dari SHA-256 identitas resep atau kompetensi. Kandidat dibaca bergiliran dari setiap cabang. Jika `canonical_domain_size` berisi bilangan, seluruh parameter resep finite tersebut telah dienumerasi. Untuk grid besar dengan enumerasi terpotong, `pool_size` menyatakan jumlah konstruktif yang tersedia bagi versi bank ini. Formasi lain yang sah di kurikulum dapat diperoleh dengan memperluas resep pada versi berikutnya. Tiap paket hanya menggunakan satu kompetensi target.

## Keputusan matematika dan pembelajaran

- Definisi “dekat” memakai jarak eksak dari patokan yang disebutkan di registry. Jika jarak ke kelipatan sepuluh tidak ditentukan pada perkalian kelas 3, resep memakai kelipatan itu sendiri atau tetangga satu dan dua satuan. Faktor “mudah” diartikan sebagai daftar eksplisit atau hubungan habis bagi, dapat diperiksa di setiap cabang.
- Dua penyebut “terkait” memiliki faktor persekutuan lebih besar dari satu atau termasuk pasangan kelipatan yang disyaratkan per level. Pembatalan silang diuji pada pembilang/penyebut tereduksi, juga sesudah mengambil resiprok untuk pembagian. Dua pembatalan memerlukan dua relasi silang.
- Pasangan komplemen pecahan/desimal dibuat dari sasaran bilangan bulat dan sisa pecahan yang eksplisit. Pasangan komplemen integer G12-L01 menyasar 100, 1.000, 10.000, 100.000 atau 1.000.000. Kompensasi faktor membentuk identitas seperti `(B−1)×a+a=B×a`. Variabel berulang harus membawa nilai yang sama saat pemeriksaan ulang.
- Pada G06-L04 MIX, pemecahan faktor 16 menjadi 2×8 menggunakan fakta kali/bagi kelas 3 serta pengelompokan kembali faktor. Setiap pembagian perantara pada pola itu harus menghasilkan bilangan bulat sebelum penyesuaian desimal.
- Setiap paket membagi slot 30% fondasi, 50% target, 20% variasi dengan metode sisa terbesar. Pengurutan kesulitan konstruktif memakai banyak operand, tanda, penyebut, kompleksitas digit, dan magnitudo. Label strata menggambarkan rancangan internal. Semua butir tetap memenuhi kompetensi target. Urutan soal dalam paket diacak deterministik. Pemilihan ulang mengutamakan sidik jari dengan paparan paling sedikit.
- Dua form evaluasi tiap kompetensi mempunyai histogram sama untuk strata, keluarga, bentuk AST, jenis tampilan dan jumlah soal. Alokasi menyediakan dua himpunan berbeda sejauh pool tiap stratum mengizinkan. `assessment_overlap` merekam irisan aktual. Kalibrasi kesukaran dan equating psikometrik memerlukan data siswa yang sesuai.
- Semua daun dan jawaban internal berupa rasional exact. Desimal yang memerlukan lebih dari delapan angka desimal pada tampilan operand turunan ditulis sebagai pecahan literal eksak di level yang menerima bentuk rasional. Nilai negatif, operasi campuran dan prioritas dipertahankan dengan tanda kurung.
- Prasyarat menggabungkan urutan kompetensi pada registry dan dependensi lintas operasi yang aktif. Diagnostik meninjau kompetensi prasyarat tersebut. Ketuntasan satu butir MIX memberi bukti pada kompetensi MIX yang dikerjakan.


## Edisi pembahasan 1.1.0

Versi konten ini memakai jalur publik `bank/v1.1/`. Seluruh penempatan, ID, urutan, representasi dan kunci dicocokkan terhadap rilis sebelumnya. Ekspor attempt membawa snapshot butir, versi dan peristiwa yang asli. Nilai identitas revisi baru berlaku untuk sesi yang mengambil konten baru dari manifest. Review ulang sesi lama membaca snapshot yang tersimpan.

Kedua bahasa memakai petunjuk langkah pertama dan pembahasan terpisah. Operasi campuran mempertahankan nilai seluruh ekspresi pada setiap langkah. Roster di `evidence/ux/bank/editorial-roster.csv` mencakup sampel tipikal, batas dan pembahasan terpanjang dari setiap keluarga serta contoh bernama pada audit. Kolom review manusia disediakan bagi guru dan penelaah bahasa. Tanggal, identitas penelaah, keputusan dan catatan diisi saat penelaahan dilakukan.
