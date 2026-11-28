# AUD-03 · Pilihan titik mulai

Pada 1.4.0, setelah pengenalan G1 dengan nol jawaban benar dari enam, pemilihan G5 masih menawarkan penguatan G1. Reproduksi pada salinan arsip asli tercatat di `baseline.json`.

## Perilaku pada kandidat 1.5

- Setiap pilihan siswa membuat catatan baru dalam profil tersebut. Catatan memiliki ID unik dan revisi. Satu transaksi IndexedDB menentukan revisi berikutnya dan menyimpan pilihan. Dua tab dengan jam yang sama menghasilkan dua revisi berbeda.
- Saat siswa memilih tahap, rekomendasi mengambil keterampilan terbuka pertama yang belum siap di tahap itu. Jika seluruh tahap sudah siap, rekomendasi menawarkan ulasan di tahap tersebut. Nilai, XP, prasyarat dan riwayat siswa berasal dari sesi yang benar-benar dilakukan.
- Sesi aktif di beranda atau di pemilih titik mulai tetap dapat dilanjutkan. Pilihan baru berlaku ketika sesi lama selesai. Misi yang berhasil dibuat menyimpan ID pilihan dan nomor urutan di snapshot. Setelah finalisasi, jalur meneruskan kemajuan dari misi itu. Percobaan memuat materi yang gagal mempertahankan pilihan. Jika misi pertama ditinggalkan sebelum selesai, titik mulai itu dapat dimainkan kembali.
- Jika dua tab meluncurkan rekomendasi yang sama, pengecekan sesi aktif dan penulisan pertama berjalan dalam satu transaksi. Kedua tab memperoleh ID sesi yang sama. Bukti sebelum pelindung transaksi diterapkan ada di `pre-atomic-creation.json`.
- Saat satu pilihan aktif, urutan misi yang terkait dengannya menentukan rekomendasi meskipun jam perangkat mundur. Membuka peta, mengulang render dan me-reload halaman tidak mengambil hak siswa untuk memulai dari pilihan baru.
- Catatan 1.4 memakai waktu tersimpan dengan ID sebagai pemecah seri. Catatan tersebut tetap dapat digunakan. Jika sejarah menunjukkan misi sudah diselesaikan di tahap itu, aplikasi meneruskan alur yang sudah berjalan. Revisi setelah pembaruan selalu mendahului pilihan lama. Jika dua arsip independen digabung dan memuat revisi yang sama, ID pilihan menghasilkan urutan konsisten. Siswa dapat mengganti pilihannya kembali.
- Pembaruan ini menambah dua field snapshot opsional, `journey.start_intent_id` dan `journey.start_intent_step`. Data lama tidak diubah saat dibaca.

## Reproduksi

```sh
node tests/journey/start-intent.test.mjs
python tests/journey/start_intent_browser.py --dist dist --out evidence/v15/intent/browser.json
```

Tes Node menjalankan pemilihan paket asli, verifikasi byte paket, mesin siswa dan transaksi penyimpanan memori. Dua pengujian memulihkan arsip JSON serta ZIP setelah profil uji dihapus, lalu mencocokkan ID pilihan, revisi, misi yang disarankan dan riwayat lengkap. Tes browser mengakses situs melalui HTTP lokal dan menjalankan pemilih tahap, isian jawaban, feedback, penyelesaian, reload, pemulihan draf dan transaksi IndexedDB dua tab. Tes ini memakai konteks browser baru dengan data buatan. Untuk Firefox gunakan `--browser firefox`, untuk WebKit gunakan `--browser webkit`. Untuk Chromium, `CHROMIUM_PATH` dapat menunjuk executable yang sesuai.
