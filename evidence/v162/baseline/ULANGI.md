# Memeriksa kembali kandidat dan audit 1.6.1

Jalankan perintah berikut dari akar paket 1.6.2 di Git Bash. Sesuaikan dua jalur ZIP dengan lokasi unduhan asli. Python 3.11+, Node dan npm diperlukan. Untuk uji browser, gunakan Playwright Python dan Chromium seperti pada panduan QA proyek.

```bash
export KALIBATAKU_BASELINE_161='C:/Unduhan/KALIBATAKU_1.6.1_KANDIDAT_HOLD.zip'
AUDIT_161='C:/Unduhan/KALIBATAKU_1.6.1_AUDIT_DAN_MANDAT_OTOMATIS_20261129.zip'
mkdir -p /tmp/kalibataku-ulang-161
python evidence/v162/baseline/verify_supplied_inputs.py "$KALIBATAKU_BASELINE_161" "$AUDIT_161" --out /tmp/kalibataku-ulang-161
python evidence/v161/integrity/periksa_zip_akhir.py "$KALIBATAKU_BASELINE_161" --version 1.6.1 --sha256 37169d1c06edd8216acd3a263282004d893494c74d3dabc6dcb9376e9d7bf198 --dist-sha 9693b517c9ef39df3e03a264e5484a7d83281b87673f204c654737e29fe4653b --source-sha fdd195f40a594faef3fe582ae00a1156850321de3dc78f05785fac96ee792b41 --json /tmp/kalibataku-ulang-161/zip-1.6.1.json
python tests/v162/freeze_161.py --out /tmp/kalibataku-ulang-161/bank.json
python tests/v162/update_161.py --out /tmp/kalibataku-ulang-161/update.json
```

`zip-1.6.1.json` memeriksa CRC, SHA-256, header ZIP, inventaris, identitas build serta bukti QA yang disimpan kandidat asli. `input-1.6.1.json` memeriksa 94 checksum anggota audit, 7.418 baris inventaris auditor terhadap byte ZIP kandidat, serta hasil `npm run release:verify` pada ekstraksi baru. Status historis kandidat adalah **HOLD**.

Uji bank memeriksa 4.677 jalur publik dan byte setiap soal terhadap ZIP asli. Generator, kurikulum, perencanaan, lock bank dan indeks juga diperiksa. Setiap jalur bank, jumlah byte dan SHA-256 disimpan dalam bukti QA baru.

Uji pembaruan menggunakan origin HTTP lokal, Worker aktif, dua tab Chromium dan jaringan yang dapat diputus. Browser mengerjakan soal, menyimpan draf `37/9`, beralih ke distribusi baru, memuat ulang offline, kembali ke distribusi lama, memuat ulang offline lagi, dan menyelesaikan satu percobaan. Urutan soal, jawaban pertama dan event dicocokkan terhadap snapshot sebelum peralihan. Seluruh aset shell dan paket unduhan diperiksa dari cache.

Bila kedua ZIP masukan tersimpan di tempat lain, dua uji terakhir dapat diulang dari paket rilis dengan `unset KALIBATAKU_BASELINE_161`. Dalam mode itu uji bank memeriksa ukuran serta SHA-256 setiap berkas terhadap inventaris asli. Uji pembaruan merakit kembali distribusi lama di direktori sementara menggunakan aset identik dari `dist` dan salinan aset lama yang berubah. Sebelum browser berjalan, semua 5.054 anggota serta hash pohon distribusi 1.6.1 harus cocok. Metode yang dipakai tercatat di setiap bukti.

Untuk menguji kolektor domain dengan origin loopback dan masukan sintetis, jalankan `python evidence/v162/baseline/rehearse_live_collector.py --out /tmp/kalibataku-ulang-161/kolektor-lokal.json`. Uji ini memeriksa dua perpindahan versi, pemulihan versi terbaru, retensi percobaan tuntas, putus jaringan di Worker dan delapan contoh bukti cacat. Hasilnya berlingkup lokal. Bukti domain aktual hanya dihasilkan oleh perintah pada `docs/DEPLOY.md`.
