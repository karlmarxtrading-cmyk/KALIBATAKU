# KALIBATAKU 1.5.1

## Cakupan latihan dan rekomendasi

Mengakhiri misi lebih awal kini memberi kredit pada soal yang sempat dilihat. Siswa tetap dapat melihat satu soal dan meninggalkannya tanpa menjawab. Katalog memilih variasi berdasarkan paparan aktual. Peta, kesiapan dan laporan guru menggunakan perhitungan yang sama. Pada data lama, bukti kunjungan atau respons menentukan bagian yang dapat dihitung. Perhitungan ini membaca riwayat yang sudah tersimpan. Urutan soal, nilai respons pertama, bantuan dan revisi pada riwayat tetap tersimpan.

## Ketersediaan offline

Katalog dan daftar perangkat menampilkan hasil pemeriksaan salinan paket dan berkas pendukungnya. Saat pemeriksaan berlangsung, layar menunjukkan statusnya. Aplikasi dapat menawarkan pelengkapan, perbaikan atau pembaruan sesuai kondisi. Ketika siswa memulai latihan tanpa jaringan, peluncur memeriksa materi yang akan dibuka. Misi aktif mempertahankan snapshot sehingga dapat dilanjutkan selama data profil dan aplikasi tersedia.

## Stabilitas halaman awal

Saat aplikasi dibuka untuk pertama kali, aktivasi layanan offline sekarang mempertahankan beranda yang sudah tampil. Pada tiga pembukaan baru di Chromium, pergeseran tata letak kumulatif (CLS) turun dari 0,124 menjadi 0,053. Batas pengujian lokal adalah 0,10. Jejak elemen yang bergeser tersedia di evidence/v151/offline/cold-home/summary.json.

Pada peta, tombol yang sudah memiliki fokus keyboard tetap terpilih ketika layanan offline pertama kali mengambil alih halaman. Penggantian versi layanan berikutnya memicu pemeriksaan ulang. Pada formulir persiapan, jumlah soal dan rincian paket kini dihitung sebelum formulir tampil agar klik opsi latihan mengenai tombol yang sama sejak ditekan hingga dilepas. Catatan uji Firefox tersedia di evidence/v151/release/layout-stability/first-control/.

## Rentang tanggal laporan guru

Ruang guru menggunakan saat kejadian untuk menyaring dan mengurutkan sesi. Hari awal termasuk dalam periode, dan tengah malam setelah hari terakhir menjadi batas eksklusif. Pilihan zona waktu menentukan kedua batas tersebut. Cadangan yang menyimpan offset UTC yang berbeda untuk saat yang sama menghasilkan jumlah sesi, soal dan misi yang sama dalam ekspor.

## Penilaian bukti lapangan

Pemeriksa rilis mencocokkan identitas build, hasil pengamatan, tanda tangan penanggung jawab dan penelaah, keutuhan lampiran serta cakupan skenario. Sekolah dapat melengkapi bukti sesuai perangkat dan peran yang tersedia. Keputusan per kriteria dapat dibuat ulang dengan npm run qa:assess.

Versi aplikasi adalah 1.5.1. Bank tetap pada 1.2.0 dengan 4.604 paket. Kesesuaian seluruh berkas diperiksa langsung terhadap ZIP kandidat sebelumnya.
