# Cakupan soal yang pernah dilihat

Kebijakan turunan `viewed-items-1.0.0` berlaku pada peta, ringkasan siswa, rekomendasi dan laporan petualangan. Setiap paket tetap menyimpan alokasi seluruh soal, seed, peran dan urutannya saat misi dimulai. Engine menandai `seen` dan menyimpan `first_seen_at` ketika soal dikunjungi.

| Keadaan butir | Cakupan kunjungan | Strategi dicoba | Respons pertama mandiri |
|---|---|---|---|
| Dialokasikan dan belum dilihat | 0 | 0 | 0 |
| Dikunjungi lalu dibiarkan kosong atau dilewati | 1 | 0 tanpa riwayat jawaban | 0 |
| Hanya melihat petunjuk | 1 | 0 tanpa riwayat jawaban | 0 |
| Dijawab setelah petunjuk | 1 | Tag strategi soal itu | 0 |
| Jawaban pertama salah, diperbaiki setelah kunci terbuka | 1 | Tag strategi soal itu | 0 |
| Jawaban pertama benar tanpa bantuan | 1 | Tag strategi soal itu | 1 |

Kemunculan ulang fingerprint yang sama memberi satu soal unik. Strategi dihitung dari tag berbeda dalam teaching pool. Setiap misi target lulus tetap memerlukan sedikitnya 80% respons pertama benar mandiri. Strategi mencoba cara hitung direkam melalui respons, terpisah dari apakah responsnya benar.

Untuk kesiapan peta, hasil dan guru, cakupan berasal dari sesi **selesai** dalam profil dan kompetensi terkait. Untuk variasi, selector juga dapat memakai kunjungan nyata pada sesi berjalan. Misi aktif dilanjutkan dari seluruh alokasi snapshot, sehingga menyimpan posisinya tanpa mengkreditkan pertanyaan berikutnya sebagai latihan. Sesi yang ditinggalkan tidak menambah kesiapan atau riwayat variasi. Penguasaan formal A/B, bentuk soal dan ambang kelulusan tetap memakai kontraknya sendiri.

Pada riwayat 1.5.0 dan yang lebih lama, seluruh alokasi pada misi selesai dahulu ikut dihitung. Riwayat kini dibaca ulang menggunakan bukti kunjungan. Jika sebagian soal belum dilihat, jumlah unik dan status siap lanjut dapat turun. Misi berikutnya memprioritaskan soal yang masih perlu dilihat. Membuka riwayat tidak menulis ulang seed, draf, skor, revisi atau event. Restore JSON maupun ZIP menyimpan byte logis aslinya.

Penanda `seen=false` atau status akhir `unseen` tidak memberi kredit. Untuk data lama yang benar-benar tidak mempunyai field `seen`, timestamp `first_seen_at` yang sah atau riwayat respons membuktikan kunjungan selama statusnya bukan `unseen`. Butir tanpa kedua bukti tersebut diberi nol. Nomor soal aktif, draf, label kosong atau dilewati saja tidak membuktikan suatu kunjungan historis. Angka lama di arsip tetap dapat dibaca dengan format asalnya, sedangkan peta dan ekspor baru menjelaskan kebijakan cakupan yang digunakan.
