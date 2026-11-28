# Panduan guru · Petualangan dan laporan (1.6.2)

**Ruang guru · simulasi** (Menu navigasi → Ruang guru · simulasi) tetap memuat katalog, penugasan, pemantauan per profil, evaluasi, riwayat, laporan, dan ekspor PDF/DOCX/XLSX/CSV/JSON. Di versi statis ini ruang guru memakai **data simulasi** atau **profil lokal di perangkat yang sama**; tidak ada akun sekolah, server, atau sinkronisasi nyata. Laporan lokal berlabel *belum diverifikasi institusi*.

**Membaca laporan petualangan.** Pilih profil dan rentang tanggal. Bagian *Kesiapan petualangan* menggunakan riwayat sampai akhir rentang. Di XLSX, buka lembar *Journey*. Di CSV, cari baris *Journey*. Latihan biasa yang memenuhi syarat turut dihitung.

| Ukuran | Arti |
|---|---|
| Misi dalam periode | Misi petualangan yang selesai pada keterampilan itu dalam rentang tanggal yang dipilih. |
| Misi lulus kumulatif | Misi target yang memenuhi syarat hingga akhir rentang. |
| Respons pertama mandiri | Benar pada percobaan pertama, tanpa petunjuk dan sebelum kunci terlihat. |
| Dengan bantuan | Soal yang memakai petunjuk atau direvisi setelah kunci terlihat. Revisi benar setelah kunci **tidak** dihitung mandiri. |
| Revisi setelah kunci | Jumlah soal yang diperbaiki setelah kunci tampak. |
| Soal unik dan strategi kumulatif | Cakupan butir berbeda dan strategi yang telah dicoba sampai akhir rentang, termasuk dari latihan biasa yang memenuhi syarat. |
| Siap lanjut | Aturan produk untuk membuka keterampilan berikutnya (2 misi target ≥80% mandiri + cakupan). **Bukan** penguasaan formal. |
| Penguasaan formal | Tetap dari evaluasi A/B (tabel *Bukti penguasaan*). |
| XP periode | Usaha yang tercatat selama rentang tanggal laporan. |

Waktu respons hanya memakai respons pertama yang benar tanpa bantuan dengan kualitas waktu sah; jumlah sampel *N* selalu ditulis, dan median/P90 baru tampil bila N ≥ 10.

**Tanggal laporan.** Pilih zona waktu untuk periode kelas. Sesi pada tengah malam pertama masuk. Sesi pada tengah malam setelah tanggal akhir masuk periode berikutnya. Waktu pada cadangan boleh memakai offset, termasuk +07:00. Cakupan menyatakan soal yang sudah dilihat, sehingga angka soal dilihat dapat lebih besar daripada jumlah soal dijawab.

**Mencari kesulitan.** Lihat keterampilan dengan *Respons pertama mandiri* rendah tetapi *Jawaban akhir* tinggi: siswa sering bergantung pada kunci. Buka sesi itu untuk melihat jawaban pertama dan akhir per soal.

## Membaca hasil misi 1.6.2

Pada hasil 7/8 benar keseluruhan dan 3/4 benar mandiri pada target, misi belum memenuhi ambang 80% target. Lihat rincian bantuan, revisi dan cakupan sebelum membahas langkah selanjutnya. Tantangan penutup berisi latihan pada satu keterampilan anchor. Pos dan review memakai urutan heuristik. Lima format laporan tetap memakai sumber riwayat profil yang sama.

## Memilih format unduhan

| Pertanyaan | Cara memeriksa |
| --- | --- |
| Berapa sesi selesai pada periode ini? | Tetapkan profil, zona waktu dan tanggal, lalu bandingkan ringkasan dengan baris sesi di XLSX/CSV. Sesi pada pukul 00.00 sesudah hari terakhir masuk ke periode berikut. |
| Apa yang berubah setelah siswa membaca kunci? | Pada contoh kesulitan, bandingkan jawaban pertama, kunci dan jawaban akhir. Misalnya, jawaban akhir `21/12` setara dengan kunci `7/4`. Jawaban awal yang salah tetap tercatat. |
| Berkas mana yang sesuai? | PDF menyediakan tata letak tetap. DOCX memuat persamaan OMML yang dapat diedit. XLSX dan CSV memudahkan pengolahan angka. JSON memuat data laporan untuk pemeriksaan terstruktur. |

Periksa nama profil, sumber dan periode sebelum berbagi sebuah unduhan. Data demo diberi label simulasi. Untuk memindahkan progres ke browser lain, gunakan **cadangan profil** pada halaman **Profil dan data**. Ekspor laporan memuat keluaran untuk dibaca. Pengujian DOCX menggunakan struktur OOXML dan LibreOffice. Tampilan di Microsoft Word belum divalidasi. [Panduan pemulihan profil](PANDUAN_CADANGAN_OFFLINE.md)
