# Perubahan KALIBATAKU 1.5.0

## Siswa

- Jalur latihan memilih soal yang memenuhi strategi dan cakupan yang masih kurang. Pada perkalian kelas 12 level 1, strategi PO dapat muncul melalui penguatan dari paket review P017. Setiap misi tetap memakai satu paket. Soal evaluasi formal tetap dicadangkan.
- Pilihan titik mulai tersimpan per profil. Siswa yang sedang mengerjakan misi dapat menyelesaikannya, lalu memakai pilihan tahap terbaru. Pemilihan ulang tidak mengubah skor atau mengacak snapshot aktif.
- Peta memeriksa kelengkapan instalasi untuk jenis misi yang akan dimainkan. Paket dari katalog lama dapat diperbaiki ketika tersambung kembali. Soal yang sudah membentuk sesi aktif tetap berada di snapshot.

- Di layar 320 piksel dengan teks 138%, judul sementara saat latihan sedang dibuka kini mengikuti lebar panel. Pengujian mengukur tampilan pemuatan dan halaman yang sudah siap.

## Guru

Laporan membedakan aktivitas dalam rentang tanggal dari kesiapan kumulatif pada akhir rentang. Riwayat latihan biasa yang memenuhi syarat ikut menyumbang cakupan. PDF, DOCX, XLSX, CSV dan JSON menggunakan hasil yang sama. Nilai historis respons pertama dan revisi tetap tersimpan. Kesiapan melanjutkan misi merupakan kebijakan latihan. Penguasaan formal memiliki ukuran tersendiri.

Cetakan riwayat menggunakan kertas putih untuk kedua tema. Pengujian pada Chrome menghasilkan enam halaman berisi konten dalam bahasa Indonesia dan lima dalam bahasa Inggris.

## Cadangan dan kompatibilitas

Reader JSON dan ZIP memeriksa hubungan antara kompetensi, paket, butir dan metadata journey sebelum menulis. Bukti kecocokan dari paket lokal ditampilkan jika tersedia. Data dengan versi journey yang belum didukung diperlakukan sesuai kontrak pemulihan dan tidak memperoleh kredit kesiapan otomatis. Backup lama tanpa journey tetap dapat dipulihkan.

Batas JSON 100.000 record dan 50 MiB dihitung pada hasil serialisasi UTF-8. Draf pemulihan yang melewati salah satu batas menggunakan ZIP. Ringkasan menunjukkan profil dan isi yang akan dipulihkan sebelum commit.

## Versi dan jejak pengujian

Bank tetap pada 1.2.0. Metadata occurrence mempertahankan format 1.0.0. Rute, kebijakan perjalanan dan selector baru memakai 1.1.0. Alasan pemilihan pengganti dan batas kemajuan ada di bukti progresi. Persyaratan keyboard ponsel memakai bukti perangkat fisik. Suite desktop tetap memberi bukti pada lingkup desktop. Keputusan per temuan dapat ditelusuri melalui REGISTER_PENUTUPAN_AUD.csv.
