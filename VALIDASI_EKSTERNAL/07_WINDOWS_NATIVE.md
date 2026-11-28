# EXT160-02 · Verifikasi dari Windows asli

Operator memerlukan Windows, Git Bash dari Git for Windows, Node 24, Python 3.12 Windows dengan `jsonschema`, dan satu salinan utuh ZIP tersegel. Pelaksana serta penelaah mencatat alias, identitas kandidat, asal artefak, waktu UTC dan hasil dalam [lembar Windows](formulir/windows-native.csv). Pemilik memeriksa asal runner/perangkat. Nama pengguna pada jejak path dapat disamarkan dalam ringkasan yang dibagikan. Simpan byte log asli yang hash-nya tercantum dalam receipt.

1. Di Git Bash, periksa digest distribusi ZIP terhadap nilai yang diserahkan, menggunakan `sha256sum "nama-kandidat.zip"`. Ekstrak dengan fitur Extract All atau unzip ke direktori kosong dengan spasi, misalnya `C:\Uji Kalibataku\Kandidat 161\`. Masuk ke direktori hasil ekstraksi yang memuat `package.json`. Gunakan ekstraksi arsip langsung agar byte dan newline tersegel terpelihara.
2. Bila dijalankan pertama kali, pasang dependensi QA minimum melalui `py -3.12 -m pip install jsonschema`. Periksa `node --version` dan `git --version`. Lalu jalankan perintah satu kali berikut.

```bash
bash VALIDASI_EKSTERNAL/verifikasi-windows.sh
```

3. Skrip memeriksa Windows native dan path berspasi, mencatat versi runtime, menjalankan uji canonical path/pin, memverifikasi inventaris, membangun, lalu memverifikasi kembali. Hasil ditulis ke folder `native-windows-…` di samping akar proyek. Simpan seluruh folder, termasuk bila satu langkah gagal. Log bernomor mengikuti urutan langkah di `native.json`. Pada eksekusi lengkap tersedia empat log bernomor, status keluar per langkah, waktu, identitas sumber/dist sebelum serta setelah build, dan daftar hash berkas hasil.
4. Operator menjalankan `sha256sum -c SHA256SUMS-NATIVE` **dari folder hasil**, mencatat model/versi Windows dan asal pekerjaan, lalu menyerahkan salinan utuh ke penelaah. Penelaah memastikan OS Windows asli, Git Bash, path berspasi, seluruh langkah keluar 0, hash log valid dan identitas sebelum/sesudah sama dengan kandidat. Catat ID run/URL privat yang dapat diperiksa atau observasi langsung pada perangkat. Simpan nomor versi OS/Git/Python/Node dari rekaman runtime.
5. Pemilik rilis menempatkan bukti terverifikasi di `evidence/v161/native-windows/` pada **salinan pengemasan**. Bukti Linux untuk build yang sama masuk ke `evidence/v161/native-linux/`. Jalankan penilaian, pemeriksaan paket, penilaian ulang dan penyegelan menurut [panduan QA](../docs/QA_1.6.1.md). Periksa hasil `EXT160-02` dan baris native dalam register redesign. Uji emulasi path serta bukti dari WSL masing-masing hanya mencakup lingkungannya sendiri.
