# AUD15-03 · Satu saat, empat zona laporan

Pada 1.5.0, empat sesi yang dicatat dengan UTC masuk ke laporan 28 November, sedangkan representasi +07:00 untuk saat yang sama menghasilkan nol sesi sesudah cadangan valid dipulihkan. Hasil reproduksi yang dijalankan ulang tersedia di `baseline.json` beserta sepuluh ekspor aktual dan pembacaan independennya di folder `baseline`.

Laporan 1.5.1 menggunakan saat absolut untuk identifikasi periode, urutan sesi, urutan catatan, dan riwayat kumulatif. Awal hari termasuk dalam periode. Awal hari berikutnya berada di luar periode. Tanggal tampilan mengikuti zona yang dipilih. Batas tengah malam mengikuti aturan IANA yang berlaku pada tanggal tersebut. ID membedakan record yang jatuh pada saat yang sama. Kolom berjudul UTC di CSV/XLSX menampilkan waktu UTC. Timestamp dan hash event dari cadangan tetap tersimpan dalam representasi asal.

Regresi memeriksa empat representasi murni (Z, +07:00, +08:00, −05:00) serta satu cadangan dengan representasi campuran. Setiap kelompok menguji empat zona tampilan (UTC, Jakarta, Makassar dan Jayapura), satu milidetik sebelum dan sesudah kedua batas, riwayat berurutan, batas finalisasi, catatan, serta tanggal yang tidak valid. Masing-masing melewati import JSON, ekspor ZIP, pengosongan profil, lalu restore ZIP aktual. Kasus +07:00 menggunakan salinan persis berkas audit `tests/v151/fixtures/timezone-offset-valid-backup.json`. Kasus tambahan memeriksa batas waktu setempat sebelum 1950.

Dari akar rilis sesudah build:

```sh
node tests/v151/time-offset-engine.mjs
python3 tests/v151/time-offset-exports.py
```

`engine.json` merekam jumlah pemeriksaan dan ID rilis. Subfolder `z`, `plus07`, `plus08`, `minus05`, dan `mixed` memuat hasil per pemeriksaan dan file yang dihasilkan. `formats.json` mencatat SHA-256 dan hasil pembacaan terpisah JSON, CSV, XLSX, DOCX dan PDF dari kelima kelompok. Sumber acuan waktu menggunakan fixture mentah dan zona dari Python. Angka wajib di tiap format adalah empat sesi selesai, 32 soal dengan 32 jawaban benar, serta tiga misi. Pemeriksaan dokumen menggunakan nilai dan teks lokal, termasuk posisi catatan dan urutan sesi. Tampilan persamaan pada Microsoft Word dan pemakaian lapangan mempunyai bukti tersendiri.

Kontrol tambahan melalui Chromium memulihkan berkas audit dengan pemilih berkas aplikasi, memuat ulang IndexedDB, memilih profil yang dipulihkan, menerapkan filter 28 November di Jakarta, lalu mengunduh laporan JSON melalui tombol aplikasi. Nilai 4 sesi, 32 soal benar, 3 misi dan timestamp asli +07:00 tercatat dalam `browser.json` dan `browser-report.json`. Untuk mengulang, jalankan `python3 tests/v151/time-offset-browser.py` dari akar rilis dengan Chromium Playwright terpasang atau variabel `CHROMIUM_PATH` menunjuk ke browser Chromium.
