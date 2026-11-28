# Protokol awal validasi KALIBATAKU 1.5.0

**Kandidat 1.5.1.** Formulir resmi untuk build baru, dua fixture Word, tugas penelaah, prosedur perangkat dan cara mengajukan receipt ada di [paket validasi 1.5.1](../VALIDASI_EKSTERNAL/00_MULAI_DI_SINI.md). Bagian berikut menyimpan prosedur 1.5.0 sebagai riwayat.

Cocokkan identitas build dengan RELEASE_STATUS.json sebelum mencatat hasil. Register lengkap ada di REGISTER_AC_FINAL.csv. Rekam tanggal, pelaksana, model perangkat, versi OS dan browser, bahasa, orientasi, skenario, hasil aktual, bukti, keputusan, perbaikan dan hasil uji ulang. Formulir tersedia di evidence/v14/external/forms/. Gunakan alias untuk peserta. Simpan catatan di folder privat operator dan ringkasan anonim di evidence/external/.

## AC:UX-09 · Keyboard sistem pada Android dan iOS

Gunakan perangkat fisik pada bagian berikut. Ulangi dalam orientasi potret dan lanskap dengan keyboard sistem tetap terbuka. Masukkan pecahan, tampilkan feedback, periksa jawaban siswa dan kunci, tekan Lanjut, uji pemulihan draf dan verifikasi satu commit final setelah ketukan ganda. Catat model keyboard, bahasa dan hasil setiap kombinasi. Rekaman dapat menggunakan profil sintetis.

## AC:DEVICE-01 · Browser desktop

Lihat hasil terpisah untuk Chromium, Firefox dan WebKit di evidence/v15/qa/. Jalankan kembali kombinasi yang gagal jika versi browser atau build berubah. Pengujian browser desktop dilakukan pada perangkat Linux. Pemeriksaan Safari di perangkat fisik tercakup pada DEVICE-03.

## AC:DEVICE-02 · Android fisik · AC:DEVICE-03 · iPhone/iPad fisik

Perangkat: satu Android (Chrome; Gboard + satu IME lain), satu iPhone atau iPad (Safari).
1. Mulai dari dasar; ketik jawaban dengan keyboard sistem; untuk pecahan buka misi kelas 5 (Pilih titik mulai → Kelas 5) dan ketik `21/12` dengan tombol simbol; catat posisi caret.
2. Desimal `0,5` (ID) dan `0.5` (EN). Enter saat komposisi IME aktif tidak boleh mengirim.
3. Putar perangkat saat jawaban terisi; draf tetap; OKE tidak tertutup keyboard; safe-area tidak memotong kontrol.
4. Ketuk OKE, Soal berikutnya, Petunjuk, Lihat hasil, Misi berikutnya, tombol peta: catat salah ketuk per 20 ketukan (target ≤1).
5. Unduh cadangan profil; pulihkan di perangkat yang sama dan perangkat lain.
6. Peta → Simpan misi untuk offline → mode pesawat → lanjutkan dan selesaikan misi → mulai misi berikutnya.
7. Tutup browser di tengah misi; buka lagi; Lanjutkan petualangan harus membuka soal yang sama.

## AC:A11Y-04 · Pembaca layar (ujaran aktual)

NVDA + Firefox/Chrome (Windows), VoiceOver + Safari (iOS/macOS), TalkBack + Chrome (Android).
1. Soal pecahan dan campuran (Pilih titik mulai → Kelas 5/11): catat ujaran persis rumus.
2. Setelah OKE: status, jawabanmu, kunci, cara menghitung, langkah lengkap terbaca berurutan; Enter kedua tidak melompati kartu.
3. Peta: daftar bernomor, status (teks), tombol aksi dengan nama keterampilan.
4. Tawaran bantuan setelah dua salah; halaman hasil; galat input (`1/0`).
Rekam audio atau transkrip. Pemeriksaan DOM otomatis (`v12-roles-reflow`, `ux-extended-browser`) **bukan** bukti ujaran.

## AC:TEACH-03 · Persamaan DOCX di Microsoft Word

1. Untuk uji awal, buka `evidence/v15/reports/fixture-word-pecahan.docx` menggunakan versi Word yang dipakai sekolah. Catat versi, sistem operasi dan hasil tampilan tiap pecahan dalam formulir sesi. Rujukan nilai setiap pecahan ada di `evidence/v15/reports/fixture-word-pecahan.json`.
2. Di aplikasi, buka Ruang guru · simulasi → Laporan → ekspor DOCX untuk siswa dengan misi pecahan.
3. Buka di Microsoft Word (Windows/Mac) dan, bila dipakai sekolah, Google Docs / LibreOffice.
4. Bandingkan setiap persamaan dengan PDF/HTML: pembilang/penyebut, tanda kurung, minus.
Lulus: semua persamaan tampil benar di aplikasi target. Validitas ZIP/XML saja tidak cukup.

## AC:BANK-07 · TEMUAN:DOC-01 · Review 394 keluarga template pada urutan baru

Bahan: `evidence/v15/review/roster-394-templates.csv` (394 baris; urut posisi rute; tiga butir per template: pertama ditemui, median, tersulit). Penelaah: guru matematika SD/SMP/SMA + penelaah bahasa ID/EN.
Isi `reviewer_name`, `reviewer_role`, `reviewed_at`, `decision` (`setuju` / `perbaiki_urutan` / `perbaiki_isi` / `tolak`), `notes`. Perubahan urutan → `tools/build-journey.py` dengan versi metadata baru; perubahan isi → `factory/` dengan versi konten baru. Label `authored_heuristic` tetap sampai review selesai.

## AC:PILOT-01..03 · Pilot formatif

Peserta: 12 siswa dari tiga kelompok materi (kelas awal, menengah, atas) + 3 guru; izin orang tua/sekolah sesuai aturan setempat. Data nyata siswa **tidak** dikirim ke mana pun; gunakan alias.
Tugas siswa: pilih titik mulai; mulai misi; menjawab salah dan memahami hasil; lanjut ke misi berikut/penguatan; kembali setelah browser ditutup.
Tugas guru: temukan siswa/keterampilan yang sulit; bedakan respons mandiri dari revisi setelah kunci; tentukan arah lanjut.
Target formatif: ≥11/12 siswa mulai dan lanjut tanpa arahan tentang filter; 3/3 guru memahami pembedaan; nol kegagalan data kritis atau jalan buntu. Catat kebingungan, salah ketuk, waktu, bantuan moderator, perbaikan, dan uji ulang (`forms/pilot-siswa.csv`, `forms/pilot-guru.csv`).

## AC:PERF-03 · Web Vitals lapangan (fase SETELAH_PILOT)

Setelah pilot dan deployment nyata: kumpulkan p75 LCP, INP, CLS dari pengguna nyata (tanpa layanan pihak ketiga baru kecuali diotorisasi). Target: LCP ≤2,5 s, INP ≤200 ms, CLS ≤0,1. Angka lab (`journey-perf-lab`, `performance-budgets`) bukan data lapangan.

## AC:REL-02 · AC:REL-03 · TEMUAN:REL-03 · Domain akhir, update, rollback

Kebutuhan: akses ke akun Cloudflare dan domain sekolah (tidak tersedia saat rilis ini dibuat).
1. Deploy sesuai `docs/DEPLOY.md`; jalankan pemeriksaan bagian D; catat `build-info.json`, `offline_release`, header, MIME, 404.
2. Buka di dua perangkat; pasang misi offline; deploy build berikut (mis. perubahan teks kecil di cabang uji); pastikan tab lama tetap berjalan, sesi berjalan selesai, lalu SW baru aktif setelah semua tab ditutup.
3. Rollback ke deployment sebelumnya; pastikan riwayat terbaca dan misi terpasang tetap bermain.
