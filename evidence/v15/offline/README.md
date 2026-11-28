# AUD-02 · Instalasi terpilih, pemulihan dan reflow

Reproduksi 1.4.0 menggunakan probe audit asli dan input dengan SHA-256 `86b030e3196cbf2116ce37bad3a6b7bcb350eadee4d1931cff8ba7bcf094046d`. Berkas `baseline.json` merekam klaim “sudah tersimpan” untuk paket P001 tanpa shard dan P003 yang hanya dapat dipakai pada assessment. Pembuat misi memberi JOURNEY_LOAD dan NO_MATERIAL pada kedua kasus itu. Kontrol P001 dengan shard berhasil. Lingkungan baseline adalah Node dan adaptor DOM/cache memori.

## Uji setelah perubahan

Jalankan perintah berikut di folder utama setelah build. Opsi `--engine` pada dua suite browser menerima `chromium`, `firefox`, atau `webkit`. Gunakan direktori hasil yang berbeda bagi setiap browser. Versi browser, identitas rilis, waktu, dan pengamatan masing-masing skenario tercatat di JSON. Laporan tangkapan layar historis tidak dipakai untuk menilai hasil saat ini.

```sh
python3 tests/journey/offline_capability.py --engine chromium --out evidence/v15/offline/chromium/offline-capability-chromium.json
python3 tests/journey/browser_flow.py --engine chromium --out screenshots-temp --receipts evidence/v15/offline/chromium
python3 tests/journey/map_native_zoom.py
```

- Katalog dan peta memulai dengan penyimpanan browser kosong pada kasus yang terpisah. Instalasi katalog memilih paket lewat UI, membuka Atur latihan → Rincian paket, lalu mengunduh. Instalasi peta mengunduh maksimal dua paket. Uji mengikuti misi enam soal hingga satu event `attempt.completed`, termasuk reload, jawaban dan kunci, serta kelanjutan snapshot dengan ID dan urutan yang sama.
- Untuk fixture instalasi katalog lama, tes menghapus shard serta referensinya dari receipt, kemudian memperbaiki instalasi lewat katalog. Kasus pembanding menggunakan assessment saja, metadata versi kedaluwarsa, serta perubahan satu byte pada shard, paket, dan modul player. Pada setiap kondisi itu, peta dan akses langsung ke misi diperiksa sebelum perbaikan. Perbaikan di peta/katalog harus memungkinkan misi lengkap setelah asal kembali di luar jangkauan.
- Kasus berkas pembuka mengubah satu byte `app.mjs`. Worker menolak menyajikan byte itu saat asal tidak terhubung. Dokumen baru setelah terkoneksi mengambil kembali berkas pembuka yang sesuai SHA rilis dan dapat dimuat ulang tanpa jaringan.
- Setiap pengujian offline memverifikasi kegagalan fetch yang melewati cache. Origin terisolasi memutus koneksi TCP tanpa memberikan respons. Pada alur main dan reload, Chromium dan Firefox juga memakai sakelar jaringan browser. Pada pemeriksaan HTTP 503 untuk berkas pembuka yang rusak, tes memakai pemutusan TCP saja agar browser menyerahkan fetch kepada worker. Pada WebKit, sakelar protokol Playwright juga memblokir navigasi yang semestinya ditangani service worker. Pengujian WebKit menggunakan pemutusan TCP sungguhan pada origin dengan service worker, IndexedDB, dan Cache Storage browser tetap aktif.
- Uji reflow mengecek 1440, 768 dan 320 piksel CSS serta ukuran font akar 32 px pada 320 px. Berkas Firefox `map-native-zoom.json` memeriksa zoom penuh 400% milik browser pada jendela 1280 px. Pengujian memeriksa lebar area, cakupan kontrol dan aktivasi misi dengan keyboard. Semua browser berjalan di desktop Linux.
