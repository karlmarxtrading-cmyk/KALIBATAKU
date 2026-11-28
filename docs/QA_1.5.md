# Mengulang verifikasi 1.5.0

Mulai dari ZIP yang diekstrak. Jalankan pemeriksaan inventaris sebelum membuat bukti baru. Untuk audit ulang, gunakan salinan kerja terpisah agar catatan pengiriman awal tetap tersedia.

```bash
npm run release:verify
npm run check
npm test
npm run curriculum:check
npm run build
python3 tools/build-journey.py --check
python3 tools/build-restore-index.py --check
python3 tools/bank-preservation.py
npm run qa:production
```

Runtime yang digunakan terdapat di evidence/v15/release/dependencies.json. Gunakan Playwright Python, PyMuPDF, python-docx, openpyxl, FontTools, jsonschema, ReportLab dan LibreOffice untuk seluruh suite. Pasang browser Playwright dan dependensi Linux. CHROMIUM_PATH dapat menunjuk langsung ke executable Chrome atau Chromium yang sesuai dengan versi Playwright. Firefox dan WebKit menggunakan executable Playwright. Pemeriksaan browser dilakukan dalam konteks baru dengan data uji sintetis.

Untuk mempercepat pengulangan, gunakan `npm run qa:production -- --parallel`. Opsi ini memakai dua direktori kerja terpisah. Uji kapasitas besar dan pengukuran performa tetap berjalan berurutan. Jika kapasitas direktori sementara terbatas, arahkan KALIBATAKU_QA_WORKDIR ke folder kerja yang sudah tersedia. Browser tetap menggunakan folder sementara sistem.

Binding mencatat perintah, exit code, durasi dan hash setiap log/receipt. Baca hasil per suite. Status BLOCKED_ENV yang berkaitan dengan render persamaan Word memerlukan tindak lanjut pada aplikasi sasaran. Menulis bukti baru mengubah inventaris paket.

Untuk menyusun rilis setelah seluruh pengujian selesai, jalankan dari salinan pengemasan:
```bash
python3 tools/release_pack.py preflight
npm run qa:assess
python3 tools/package_check.py
npm run qa:assess
python3 tools/release_pack.py seal ../KALIBATAKU_1.5.0_KANDIDAT_HOLD.zip
npm run release:verify
```

Operasi pengemasan memeriksa seluruh CRC, ukuran dan hash entri. Untuk pemeriksaan penerima, ekstrak ZIP akhir di folder kosong, jalankan release:verify, build, lalu release:verify kembali. Keputusan produksi bergantung pada 70 baris WAJIB. PERF-03 dijadwalkan setelah pilot.
