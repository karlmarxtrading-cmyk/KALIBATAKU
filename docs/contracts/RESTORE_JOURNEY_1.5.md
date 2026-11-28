# Pemulihan riwayat petualangan

## Format dan kompatibilitas

Pembaca JSON dan ZIP menjalankan pemeriksaan yang sama sebelum transaksi penulisan profil. Sesi versi 1.3 dapat dipulihkan dengan snapshot dan urutan soal aslinya. Versi 1.4 dan 1.5 membawa blok journey. Pemeriksaan mengenali pasangan rute, kebijakan misi, pemilih soal, metadata dan kebijakan kesulitan yang didukung masing-masing rilis. Versi yang belum dikenali memblokir seluruh impor. Simpan arsip asli agar dapat dibuka di aplikasi yang mendukung versi tersebut. Riwayat dengan versi asing yang sudah tersimpan tetap tersedia sebagai riwayat mentah dan dikecualikan dari progres petualangan.

## Pemeriksaan sebelum penyimpanan

- Node, operasi, kelas, level, tahap, kompetensi setiap soal, jenis misi dan batas kesiapan harus sesuai dengan kontrak tersimpan.
- Setiap misi memakai satu paket pengajaran dan satu versi konten. Daftar penempatan harus sama persis dengan referensi item dalam urutan snapshot. Indeks harus berada dalam paket, unik, dan menunjuk ID serta revisi soal yang konsisten. Paket assessment dicadangkan untuk evaluasi formal.
- Peran, band, urutan peran, jumlah soal review, seed dan data seleksi dicocokkan dengan misi. Intent titik mulai baru merujuk rekaman pilihan dalam profil asal. Pemeriksaan skema soal, fingerprint, jawaban, nilai matematika, urutan event, ringkasan hasil dan konsistensi checksum tetap dijalankan.
- Indeks ringkas untuk pemulihan mengikat struktur 281 kompetensi aktif, susunan paket, batas kesiapan dan SHA-256 katalog serta shard per node. Indeks dibaca saat memeriksa misi. Buat ulang dengan `python tools/build-restore-index.py` dan periksa konsistensi dengan `python tools/build-restore-index.py --check`. Masukan adalah bank 1.2.0 dan sidecar journey yang dikemas.
- Seluruh catatan dan rekaman profil disimpan dalam satu transaksi setelah validasi seluruh arsip. Konflik, referensi yang gagal atau versi asing membatalkan penulisan. Memulihkan profil lain mempertahankan profil yang sedang aktif.

## Makna hasil pratinjau

| Pemeriksaan tertinggi per misi | Yang dapat dibuktikan |
| --- | --- |
| `internal_only` | Isi snapshot saling sesuai dan memenuhi kontrak struktural bank. Jika katalog tingkat tersedia, hash paket yang diklaim juga harus cocok. Butir asli belum dibandingkan secara penuh. |
| `occurrences_matched` | Shard penempatan lokal ber-checksum cocok dengan indeks rilis. Indeks, fingerprint ringkas, strategi, template, band, peran dan paket cocok. |
| `bank_matched` | Isi paket lokal sesuai SHA-256 dari katalog atau shard tepercaya. Seluruh objek soal pada setiap indeks dibandingkan dengan snapshot, termasuk teks, strategi, hint dan langkah penyelesaian. Ketika shard tersedia, pemeriksaan penempatan juga dijalankan. |

Pemulihan memakai CacheStorage lokal untuk tingkat pemeriksaan yang tersedia. Pembaca tidak mengambil berkas bank lewat jaringan. Perbedaan positif dengan materi tepercaya memblokir impor. Saat checksum salinan materi perangkat rusak, pasang ulang paket yang ditunjukkan sebelum meninjau kembali. Setiap hasil di atas berlaku untuk riwayat latihan pribadi. Misi yang konsisten secara internal dapat digunakan untuk melanjutkan latihan dan rekomendasi lokal. Sumber, peserta, penguasaan formal dan hasil ujian tidak mendapat pengesahan melalui proses impor. Ringkasan pemeriksaan berasal dari pembaca dan tidak disalin dari arsip.

## Uji ulang

1. Jalankan `python tools/build-restore-index.py --check`.
2. Jalankan `node tests/data/journey-restore.mjs` untuk reader, preview dan commit kedua format, kondisi tanpa jaringan, kontrol bank asli, riwayat 1.3/1.4, atomisitas dan isolasi profil.
3. Sesudah membangun dist, jalankan `python tests/data/journey-restore-browser.py --engine chromium`. Pilihan `--executable` menerima path biner Chromium yang kompatibel. `--engine firefox` dan `--engine webkit` menjalankan alur yang sama pada browser tersebut. Uji membuat profil sintetis tersendiri, memilih berkas melalui formulir, memeriksa pesan kesalahan, memulihkan sesi ongoing, dan membaca ulang seluruh snapshot dari IndexedDB.
4. Hasil pengujian tersedia di `evidence/v15/restore/`. Receipt browser merekam identitas offline build yang benar-benar dilayani.
