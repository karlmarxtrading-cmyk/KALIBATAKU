# Cadangan, pemulihan, dan offline (1.6.2)

## Backup dan restore profil

- Klik **Profil aktif** (kanan atas) → halaman *Profil dan data* → **Unduh cadangan profil**. Profil besar disimpan sebagai arsip ZIP format 2 (dipecah per bagian ±8 MiB). Batas yang diuji: 150.000 record tambahan dalam satu profil dipulihkan utuh (ID, nilai dan jumlah sama); batas baca/tulis sama: 2.000.000 baris, 32 MiB per bagian, 512 MiB per berkas.
- Pemulihan: halaman *Profil dan data* → pilih berkas cadangan → periksa pratinjau (alias, tanggal, penambahan, duplikat, konflik) → konfirmasi.
- Misi petualangan ikut tersimpan lengkap: daftar soal yang dibekukan, peran soal, `occurrence_ref`, seed dan jejak pemilihan. Setelah dipulihkan, misi yang belum selesai berlanjut dengan soal yang sama.
- Arsip yang ukurannya tidak konsisten atau melebihi batas ditolak sebelum isinya dibaca.

Untuk cadangan JSON, batasnya 100.000 baris gabungan dan 50 MiB setelah pengodean UTF-8. Saat salah satu batas terlampaui, gunakan cadangan ZIP. Tombol pemulihan draf memilih ZIP secara otomatis bila tambahan draf melewati batas JSON.

Periksa identitas profil dan keterangan pemeriksaan misi saat pratinjau. Aplikasi memeriksa isi snapshot secara lokal. Bila bahan yang sesuai tersedia di perangkat, aplikasi juga mencocokkan referensi atau isi soal dengannya. Jika data misi memakai versi yang belum didukung atau berisi referensi yang bertentangan, impor dibatalkan sebelum data profil ditulis. Simpan arsip asli untuk pemulihan dengan versi yang mendukungnya.

## Menyimpan dan memainkan misi offline

Di **Peta**, pilih **Simpan misi untuk offline** saat terhubung. Aplikasi menyimpan berkas aplikasi, katalog yang diperlukan, metadata keterampilan, serta paket yang sesuai untuk misi berikutnya. Jika tersedia, satu paket cadangan ikut disimpan. Di katalog, buka paket, pilih **Atur latihan → Rincian paket**, lalu siapkan paket untuk offline. Paket ajar yang memenuhi kebutuhan misi juga bisa dipakai dari peta. Paket form A/B tetap tersedia untuk evaluasi tersendiri.

| Status pada peta | Tindakan |
| --- | --- |
| Belum terbuka | Baca prasyarat pada baris keterampilan dan selesaikan latihan yang diperlukan. |
| Belum diunduh | Sambungkan internet lalu simpan misi dari peta. |
| Unduhan perlu dilengkapi | Sambungkan internet dan pilih **Lengkapi unduhan misi**. Pesan menjelaskan apakah ada berkas yang hilang/kedaluwarsa atau apakah materi ajar lain dibutuhkan untuk misi ini. |
| Sedang dimainkan | Lanjutkan sesi yang tersimpan. Soal, jawaban, dan urutannya berasal dari snapshot profil. |

Peta memeriksa kelengkapan berkas, identitas rilis, SHA-256 katalog, indeks kemunculan soal, dan paket yang benar-benar dapat memenuhi kebijakan misi saat ini. Bila riwayat latihan membuat strategi baru diperlukan, peta dapat meminta tambahan paket untuk misi berikutnya. Salinan katalog lama dapat dilengkapi dari peta atau tombol **Perbaiki salinan offline** pada halaman unduhan paket. Proses ini tidak mengubah riwayat.

Setelah satu pemasangan lengkap, sesi aktif dapat dimuat ulang dan diselesaikan di luar jaringan selama aplikasi dan data profil masih tersedia. Menghapus cache paket misi baru tidak mengubah soal sesi aktif. Perangkat dalam mode penyimpanan sementara perlu mengaktifkan penyimpanan persisten sebelum menyiapkan unduhan.

Jika berkas pembuka aplikasi rusak ketika perangkat di luar jaringan, sambungkan internet dan muat ulang. Selama server masih menyediakan versi yang sama, pengelola cache mengunduh kembali berkas yang rusak dan mencocokkan SHA-256 dengan rilis aktif. Bila pengelola sudah mengganti versi website, tutup seluruh tab KALIBATAKU, buka kembali saat terhubung, lalu lengkapi unduhan misi. Perbaikan unduhan tidak menghapus profil.

## Memeriksa paket di perangkat

Saat membuka katalog atau daftar unduhan, tunggu status pemeriksaan selesai. Untuk salinan rusak atau belum lengkap, sambungkan jaringan dan gunakan tindakan perbaikan pada detail paket. Salinan versi lama dapat meminta pembaruan. Paket evaluasi A/B yang lengkap dapat digunakan sesuai tujuannya; misi petualangan membutuhkan paket ajar yang memenuhi rekomendasi saat itu.


## Mencoba pemulihan sebelum update

Gunakan profil sintetis dan simpan ZIP lama serta identitas deployment. Siapkan satu misi aktif dengan draf dan satu sesi selesai dengan respons pertama, bantuan atau revisi. Unduh cadangan di luar folder publik. Pada konteks browser uji terpisah, baca pratinjau, cocokkan profil, jumlah sesi/event, duplikat dan konflik, konfirmasi pemulihan dan buka kembali sesi. Periksa urutan, draf, kunci yang sudah terlihat dan satu finalisasi per attempt.

Selama update atau rollback, pertahankan origin, subpath dan data browser. Catat draf, urutan dan ID sesi pada profil sintetis. Buka versi baru pada tab kedua, lalu selesaikan satu tindakan di tab lama. Tutup semua tab, buka kembali, cocokkan identitas rilis dan pastikan satu finalisasi per attempt. Jika perubahan mengganggu proses belajar, pulihkan deployment lama beserta seluruh asetnya dan ulangi pemeriksaan yang sama. Sebelum memindahkan profil ke domain lain, pulihkan cadangan di profil browser uji terlebih dahulu dan cocokkan hasil. [Panduan GitHub, Pages dan rollback](DEPLOY.md)
