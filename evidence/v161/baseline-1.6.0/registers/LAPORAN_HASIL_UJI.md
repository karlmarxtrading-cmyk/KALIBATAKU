# Hasil uji KALIBATAKU 1.6.0

**Keputusan rilis HOLD.** Kandidat ini dapat dimainkan di pratinjau lokal. Build offline `6c43a824957f99ed` mengikat source, distribusi dan bukti pengujian berikut.

| Objek | SHA-256 |
|---|---|
| ZIP sumber 1.5.1 | `03e0dd651667c7f9c1a81db027d45bdd7534fdf2c8ef8815ca20d85ae4211b52` |
| Source kandidat | `bd618847a10ec1cdfdabf9a6e65fbf815ec44504010f9f8f889bcc593eacbc6f` |
| Distribusi kandidat | `f6e679cf51e9e24f9017e85743aedf60ac92fa176790eeb61e96562122725df9` |
| Binding QA | `eb2f6f1b42c64324b642f9152ac5d85d11e7f0e868784019cd43527ef33cab0d` |

## Hasil otomatis

Seluruh 88 suite pada build ini berstatus PASS. Runner mencatat 1.798 pemeriksaan. Jumlah itu mengikuti unit hitung tiap suite. Uji cakupan seluruh bank dan simulasi 281 kompetensi masing-masing memiliki keluaran terperinci di log. Perintah, durasi, exit code, runtime dan SHA-256 keluaran tersimpan di evidence/v160/qa/binding.json.

| Kasus | Hasil yang diperiksa | Bukti |
|---|---|---|
| Dua Enter | Salah, benar, ekuivalen, revisi setelah melihat kunci, tahan/lepas, umpan balik setelah reload, hasil akhir dan attempt baru. Ledger membedakan respons pertama, revisi dan satu finalisasi. | enter-cycles-chromium, enter-cycles-firefox, enter-cycles-webkit |
| Gangguan penyimpanan | Transaksi nyata ditahan. Penekanan saat sibuk berlalu tanpa antrean. Gagal tulis memerlukan retry. Kegagalan menyiapkan misi berikut tidak menyisakan attempt. Satu retry membuka satu attempt kosong. | enter-cycles-chromium, route-faults, v12-browser-chromium |
| Navigasi dan akses | Rekomendasi antara beranda dan peta cocok, 19 node inactive tersimpan di registry, status katalog sesuai rute, filter dapat dibuka pada ponsel. Klik, sentuhan emulasi dan keyboard diuji terpisah. Pada 18/18 kombinasi dua viewport, tiga mesin dan tiga jenis jawaban, status, kunci dan tombol berikut tampak tanpa scroll penguji. | catalog-context, journey-browser-chromium, map-native-zoom, route-faults, evidence/v160/geometri/hasil.json |
| Kebijakan belajar | Seluruh 281 kompetensi aktif dapat dicapai dalam 60 tahap. Tujuh dari delapan benar keseluruhan dengan tiga dari empat benar mandiri pada target belum memenuhi ambang. Kesiapan lama bertahan saat pool dan aturan masukan diperluas. Tantangan penutup 0/10 mempertahankan kesiapan yang sudah diperoleh. | progression-bounds, learning-policy-160, format-readiness |
| Data dan distribusi | Pemulihan besar, offline, ekspor dan dua build bersih lulus. Update 1.5.1 → 1.6.0 → 1.5.1 pada origin lokal memakai dua tab, draf ongoing dan cache yang diverifikasi. | capacity-browser, offline-capability-webkit, clean-build-twice, evidence/v160/update-local/update-rollback.json |
| Konten | Semua 4.677 berkas bank identik per SHA-256. Dari 4.604 paket, 4.042 untuk pengajaran dan 562 form evaluasi. Seluruh bank berisi 177.640 penempatan dan 168.142 fingerprint unik. Tambahan baru nol. | bank-baseline-per-file.csv, inventaris-konten.json, audit-input/all_4604_packages_mapping.csv |

## Status penerimaan

Kriteria baseline wajib menghasilkan 8 BLOCKED, 3 NOT_RUN, 59 PASS. Satu kriteria p75 berlaku sesudah pilot. Register petualangan mencakup 39 kriteria dari audit dan 16 kasus master. Hasilnya 11 BLOCKED, 4 NOT_RUN, 40 PASS. Sebagian kriteria memerlukan pengujian otomatis sekaligus observasi manusia. Kolom hasil memperlihatkan keduanya.

Temuan audit berjumlah 12 dengan 5 BLOCKED, 2 NOT_RUN, 5 PASS. Temuan yang masih terbuka tercatat sebagai ADV-03, ADV-05, ADV-06, ADV-07, ADV-09, TECH-151-01, REL-151-01. REGISTER_PENUTUPAN_TEMUAN.csv menyebut penanggung jawab dan kriteria penutupannya.

Linux menjalankan pemeriksaan pin dan urutan path. Eksekusi Windows native masih memerlukan mesin Windows. Bukti Android/iOS fisik dan ujaran NVDA, VoiceOver, TalkBack menunggu pelaksanaan. Guru perlu menelaah 394 keluarga soal dan urutan strategi, menjalankan Microsoft Word sasaran, lalu mencatat pilot 12 siswa dan tiga guru. Domain sekolah memerlukan uji HTTPS, header, pemasangan serta update/rollback pada target. Protokol, formulir dan identitas build tersedia di VALIDASI_EKSTERNAL/.

## Membuka hasil

Buka PRATINJAU.html untuk melihat tujuh tangkapan layar dari sesi kandidat. Untuk mencoba sendiri, ikuti 00_MULAI_DI_SINI.txt. Hasil pengemasan ulang pada direktori bersih ada dalam evidence/v160/release/package-check.json. SHA-256 arsip akhir diberikan bersama tautan unduhan.
