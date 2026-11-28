# Visibilitas soal dan kesinambungan latihan

Skrip auditor mengulang dua jawaban × dua tindakan pada setiap ukuran di Firefox 153.0. Setiap percobaan dimulai dari profil baru. Nilai di tabel menghitung percobaan yang menampilkan seluruh ekspresi dan input terfokus setelah berpindah ke soal kedua. Posisi dinyatakan dalam piksel CSS dari atas viewport.

| Ukuran | 1.6.0 | 1.6.1 | Rentang vertikal ekspresi pada 1.6.0 | Rentang vertikal ekspresi pada 1.6.1 |
| --- | --- | --- | --- | --- |
| 320 × 568 | 0/4 | 4/4 | −65,4 hingga −12,0 | 55,4 hingga 108,8 |
| 390 × 844 | 4/4 | 4/4 | 317,0 hingga 370,4 | 200,0 hingga 253,4 |
| 844 × 390 | 0/4 | 4/4 | −108,4 hingga −21,6 | 54,9 hingga 141,7 |

[Ringkasan mesin, identitas build dan SHA-256 bukti](comparison.json) · [Hasil asli sebelum](baseline/original/visibility-matrix.json) · [Hasil asli sesudah](candidate/original/visibility-matrix.json)

## Pengujian tambahan

| Mesin desktop di Linux | Ukuran CSS | Pemeriksaan kandidat |
| --- | --- | --- |
| Chromium 151.0.7922.34 | 320 × 568, 390 × 844, 844 × 390, 1280 × 800 | 145/145 |
| Firefox 153.0 | Keempat ukuran, ditambah zoom halaman asli Firefox 200%, efektif 640 × 450 | 150/150 |
| WebKit 26.5 | Keempat ukuran | 145/145 |

Setiap ukuran mencakup jawaban benar, salah, serta pecahan ekuivalen, lalu maju melalui Enter, klik atau tap browser. Pemeriksaan merekam koordinat terhadap visualViewport, hit-test di titik tengah, posisi soal, fokus dan kesiapan input. Siswa uji langsung mengetik sesudah maju. Riwayat lokal menunjukkan satu penilaian dan satu perpindahan sesuai urutan. Pengujian meliputi kombinasi modifier pada input, tombol periksa, feedback, tombol lanjut dan hasil. Enter pada ringkasan pembahasan tetap membuka langkahnya.

Skenario tambahan mencakup revisi dengan bantuan, pemulihan feedback dan draft, misi berikutnya, rotasi, tinggi viewport yang diperkecil, tema gelap berbahasa Inggris, dan tombol simbol minus/pecahan. Dua penghalang pada server uji menunda respons HTTP font dan modul typesetter yang sebenarnya. Setelah pelepasan font pada soal kedua, pemeriksaan kembali mengukur letak rumus dan isian. Pada soal campuran kelas 12 yang panjang, ketiga mesin merender tujuh bagian SVG dengan huruf 32 px dalam kolom selebar 240 px. Tinggi konten 194–195 px dan seluruhnya dapat dilihat. [Pengukuran rumus panjang](candidate/long-expression.json)

Gambar PNG di setiap subfolder expanded diambil sesudah fokus dan pengukuran, sebelum pengetikan pada soal berikutnya. Masing-masing berkas JSON memuat nama dan SHA-256 untuk dua gambarnya. Program pembanding memeriksa seluruh dua belas gambar terhadap hash yang dicantumkan. Nama berkas memuat mesin, ukuran dan metode maju. Pada 1.6.0, sejumlah skenario lanjutan berhenti saat fokus atau langkah sebelumnya gagal. Jumlah pemeriksaan versi lama karena itu berbeda dari kandidat.

## Menjalankan kembali

Dari akar proyek, tentukan direktori keluaran kosong di luar evidence rilis. Jalankan setiap mesin, misalnya perintah berikut. Ganti firefox dengan chromium atau webkit. CHROMIUM_PATH dapat menunjuk executable Chromium yang kompatibel. Instalasi runtime tercantum dalam panduan QA proyek.

```sh
python tests/v161/viewport.py firefox --dist dist --out ../viewport-baru/firefox.json
python evidence/v161/viewport-comparison/long-expression.py --dist dist --out ../viewport-baru/rumus-panjang.json
mkdir -p ../probe-auditor
cp evidence/v161/viewport-comparison/candidate/original/visibility_matrix.py ../probe-auditor/
python ../probe-auditor/visibility_matrix.py .
```

Untuk 1.6.0, berikan direktori dist dari ekstraksi versi tersebut ke penguji yang sama. Pada perintah auditor, berikan akar ekstraksi versi tersebut. Skrip asli dipertahankan utuh termasuk cara penulisan keluaran. Evaluasi 4/12 dan 12/12 bersumber dari koordinat yang direkam skrip.

## Komposisi teks dan Enter

Pada build sementara 83fef50a05e52452, penguji mendeteksi Enter yang terlewat setelah komposisi teks Firefox selesai. Dalam pengulangan ini ada empat kegagalan di antara 29 pemeriksaan yang sempat dievaluasi. Satu di antaranya menggunakan penyisipan teks dan penekanan Enter tepercaya Firefox. Tiga lainnya memakai urutan peristiwa DOM terkendali pada Chromium, Firefox dan WebKit untuk menempatkan Enter sesudah input final dan sebelum pengendali berbasis timer berjalan.

Pada build a2f40449c4738fe6, 39/39 pemeriksaan lulus. Kode membedakan Enter baru setelah input final dari penekanan yang masih menerima kandidat IME. Pengujian memeriksa penyimpanan satu jawaban, perpindahan berikutnya, keyCode 229, isComposing, implicit submit, repeat dan pelepasan tombol. Hasil fisik Android/iOS dicatat melalui protokol perangkat.

[Hasil sebelum](development/compose-commit/before.json) · [Hasil sesudah](development/compose-commit/after.json) · [Matriks visibilitas build sementara](comparison-before-ime.json)

Perintah pengulangan dari akar proyek:

```sh
python tests/v161/compose_commit.py --dist dist --out ../komposisi-baru/receipt.json
```

## Temuan selama pengembangan

Pada percobaan Chromium, dua tap pada dua soal yang berbeda dapat menghasilkan click.detail 1 lalu 2 apabila sentuhan terjadi di tempat yang sama. Versi sementara menolak tap kedua. Jejak sebelum dan sesudah dalam folder development menyimpan urutan pointer, sentuhan, dan klik. Pada Firefox, kontrol HTML mandiri juga memperlihatkan pengembalian guliran ke fokus summary sesaat setelah aktivasi. Pemeriksaan posisi baca mengukur elemen langkah yang sebenarnya setelah disclosure tampil. Percobaan awal menunda aset dengan intersepsi Playwright mengalami penanganan rute ganda. Pemeriksaan final menunda respons pada origin lokal dan mengukur hasil render setelah respons dilepas.

Semua tes ini menggunakan mesin desktop. Ketukan browser dan perubahan ukuran mendokumentasikan perilaku otomatis. Gerbang perangkat nyata mencakup tampilan keyboard sistem, area aman dan aksi tombol pada Android/iOS fisik.
