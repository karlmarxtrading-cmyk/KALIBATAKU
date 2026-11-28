# Perubahan dari kandidat 1.6.0 ke 1.6.1

**Belajar.** Setelah Periksa, siswa dapat membuka semua langkah dan membaca selama diperlukan. Ketika memilih Soal berikutnya, arena mengatur kembali posisi ekspresi dan kotak jawaban terhadap ruang yang terlihat. Tombol Enter biasa dan Numpad Enter menjalankan satu tindakan baru setelah dilepas. Kombinasi modifier pada kotak jawaban menjaga draf. Baca [kontrak Enter](docs/ENTER_1.6.1.md) dan [panduan siswa](docs/PANDUAN_SISWA.md).

**QA dan bukti.** Pemeriksaan penerimaan menghitung assertion yang memiliki bentuk dan status sah, menilai konsistensi hitungan dan hasil, lalu memeriksa ulang bukti ketika binding dibangun dan dibaca. Suite visibilitas membandingkan geometri dan keterhalangan, termasuk pada 320 × 568 dan 844 × 390. Register audit menghubungkan perubahan dengan bukti sebelum/sesudah. Ringkasan angka dan lingkungan yang benar-benar dijalankan tercantum di LAPORAN_HASIL_UJI.md dan STATUS_RILIS.md.

**Konten dan data.** Bank 1.2.0 mencakup 4.677 berkas. Kandidat memakai identitas soal, kunci, solusi, urutan snapshot aktif, aturan kesiapan dan data profil yang telah ada. [Kontrak petualangan 1.6](docs/contracts/JOURNEY_1.6.md) mendokumentasikan skor per peran, registry kesiapan dan jadwal review. Laporan membedakan respons pertama mandiri, bantuan dan revisi.

**Penerimaan.** REGISTER_IRISAN.csv menghubungkan register baseline, redesign dan temuan saat ini. [Kit validasi](VALIDASI_EKSTERNAL/00_MULAI_DI_SINI.md) memuat formulir pengamatan setelah Next pada perangkat asli, uji Windows Git Bash berspasi dan prosedur pendaftaran bukti. Status eksternal bergantung pada pengamatan dan penelaahan pada target terkait.

Enter baru setelah komposisi angka selesai kini dapat memeriksa draf yang sudah diterima. Pengujian Firefox memakai dua belas urutan input dan Enter nyata, dan suite lintas browser memeriksa perlindungan terhadap konfirmasi IME, tombol tertahan dan pengiriman ganda.
