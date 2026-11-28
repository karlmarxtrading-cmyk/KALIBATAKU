# AUD-06 — Cadangan dan pemulihan

Cadangan JSON format 1 memeriksa total baris dari tabel attempts, events dan records, serta ukuran berkas JSON lengkap dalam UTF-8. Nilai batasnya 100.000 baris dan 52.428.800 byte. Profil dan header berada di luar hitungan baris, tetapi seluruh isinya ikut dihitung dalam ukuran berkas. Checksum SHA-256 menempati 64 byte ASCII. Ukuran dihitung per baris agar profil yang terlalu besar untuk satu string JavaScript tetap dapat memakai ZIP. Jika profil terlalu besar, tombol cadangan JSON menjelaskan batas dan memindahkan fokus ke tombol cadangan ZIP.

Pemulihan pemain membaca profil, attempt, event serta catatan dari satu transaksi. Kedua format membawa draf dan revisi yang sama. Saat draf membuat JSON melebihi batas, pemain beralih ke arsip ZIP. Reader memeriksa arsip sebelum pemain mengunduhnya. Perbandingan dan penulisan restore berjalan dalam satu transaksi. Request IndexedDB yang independen dikelompokkan per 256 untuk mengurangi waktu tunggu pada profil besar. Konflik diperiksa sebelum commit.

## Bukti dan cara mengulang

Jalankan dari akar source aplikasi menggunakan Node >=22. Semua data uji bersifat sintetis. Hasil aktual tersedia di berkas JSON yang disebutkan di bawah.

| Pengujian | Perintah | Bukti |
| --- | --- | --- |
| Mengukur kegagalan pada source asli 1.4.0, dengan checkout 1.4.0 sebagai argumen | `node tests/v15/backup-capacity-baseline.mjs /path/ke/source-1.4.0` | before.json |
| Batas jumlah gabungan tiga tabel serta restore draf 100.003 baris | `node tests/v15/backup-capacity.mjs rows` | rows.json |
| Batas ukuran UTF-8 dan tambahan metadata draf | `node tests/v15/backup-capacity.mjs bytes` | bytes.json |
| Pemulihan profil melebihi batas string V8. JSON ditolak. Pemain membuat dan memvalidasi 69 bagian ZIP. Preview dan restore pada profil kosong memulihkan draf dan 6.800 nilai | `node tests/v15/backup-capacity-large-zip.mjs` | large-zip.json |
| Arsip 150.000 rekaman, arsip campuran dan pemeriksaan STORED sebelum body dibaca | `KALIBATAKU_RECEIPTS=evidence/v15/capacity node tests/data/archive-edges.mjs` | data-archive-edges.json |
| Unduhan dari tombol pemulihan dan restore lewat panel profil pada dua profil Chromium tersendiri | `python3 tests/v15/backup-capacity-browser.py` (set `CHROMIUM_PATH` bila diperlukan) | browser.json |

Pengujian Node memakai adapter penyimpanan sementara. Regresi JSON menguji hasil serialisasi yang sama dengan unduhan pengguna, lalu menjalankan preview dan restore pada profil kosong. Regresi byte menambahkan teks dua-byte hingga JSON tepat mencapai batas. Fixture memori lain menyajikan 6.000 rekaman dengan nilai bersama sepanjang total 576 juta karakter. Reader mengembalikan kode batas JSON sebelum membuat string sebesar itu. Pengujian pemulihan pada batas 50 MiB mengawasi serialisasi dan memeriksa bahwa ZIP keluar tanpa mencoba menyusun JSON utuh. Pengujian Chromium menjalankan IndexedDB, memicu satu kegagalan kuota sintetis, mengunduh ZIP dari kontrol pemain, menutup browser sumber, lalu memilih berkas tersebut pada panel impor di browser baru dengan profil penyimpanan tersendiri.
