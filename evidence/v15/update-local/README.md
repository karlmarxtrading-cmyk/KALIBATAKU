# Perpindahan dua rilis pada satu origin lokal

Ekstrak ZIP 1.4.0 yang teridentifikasi di register input. Gunakan folder `dist` dari ZIP tersebut sebagai argumen. Dari akar source kandidat jalankan:

```sh
python3 tests/v15/update-rollback-local.py /path/ke/1.4.0/dist
```

Pengujian memerlukan Playwright Python dan Chromium. Bila memakai Chromium yang sudah terpasang, set `CHROMIUM_PATH` sesuai lokasi executable. Skrip memuat distribusi pada localhost di subpath `/app/`, mengganti direktori yang dilayani tanpa mengganti origin, dan memvalidasi respons HTTP dengan ETag berbasis isi untuk metadata rilis. Kedua service worker berjalan dengan siklus aktivasi aslinya.

Satu profil sintetis memulai misi 1.4.0, menjawab soal pertama dan menyimpan draf pecahan pada soal kedua. Saat tiap pergantian rilis, dua tab menahan worker sebelumnya dan worker berikutnya menunggu. Setelah kedua tab dilepas, halaman pemain yang dibuka kembali memulihkan sesi. Pemeriksaan membandingkan hash daftar soal, referensi occurrence, metadata misi, histori jawaban dan event yang tersimpan. Di 1.5.0 dan sesudah rollback ke 1.4.0, server dibuat tidak tersedia, Chromium turut diputus jaringannya, dan halaman dimuat ulang. Sesi diselesaikan offline sesudah rollback sampai satu event finalisasi tercatat. Semua aset shell dicocokkan dengan ukuran dan SHA-256 manifest, termasuk paket yang dipakai untuk sesi ini.

Hasil `update-rollback.json` mengidentifikasi kedua distribusi dan browser yang benar-benar diuji. Pelaksanaan pada domain produksi, termasuk caching CDN dan konfigurasi hosting, merupakan gate REL-03 tersendiri.
