# Kontrak Enter, fokus dan area baca · KALIBATAKU 1.6.1

Kontrak ini berlaku pada latihan petualangan. Satu perintah mengubah satu keadaan. Siswa memilih kapan meninggalkan pembahasan.

| Keadaan dan kontrol aktif | Aksi | Hasil yang diperiksa |
|---|---|---|
| Kotak jawaban siap | Ketik angka jawaban, tekan Enter biasa atau Numpad Enter | Jawaban sah dicatat satu kali, indeks tetap. Feedback menunjukkan jawaban siswa, kunci dan cara menghitung. Teks kosong atau tidak sah tetap dapat diperbaiki pada soal itu. |
| Kotak jawaban aktif | Shift, Ctrl, Alt atau Meta bersama Enter | Draf, indeks dan jumlah respons tetap. Submit implisit form tidak menilai atau melanjutkan. |
| Feedback siap | Lepas tombol, lalu tekan Enter baru atau pilih Soal berikutnya | Indeks bertambah satu. Ekspresi baru terbaca dan input baru siap menerima karakter pertama. Satu jawaban salah yang sah juga boleh dilanjutkan. |
| Feedback soal terakhir | Tekan Enter baru atau pilih Lihat hasil | Satu hasil tersimpan dan satu finalisasi untuk attempt. XP dihitung dari attempt unik. |
| Hasil | Tekan Enter baru atau pilih Misi berikutnya | Satu misi dipilih dan dibuka pada soal pertama. Pembaca bisa meninjau hasil selama diperlukan. |
| Petunjuk, langkah lengkap, revisi, tombol sekunder atau dialog | Aktifkan kontrol yang sedang fokus | Perilaku keyboard standar kontrol berjalan. Pembaca dapat menjelajahi pembahasan dan kembali tanpa pengiriman tambahan. |
| IME menyusun karakter, tombol masih ditahan, atau simpan/route sedang sibuk | Lanjutkan komposisi, tunggu atau lepaskan tombol | Komposisi dan key repeat tidak memeriksa atau melewati soal. Aksi selama sibuk tidak diantrekan. Bila komit gagal, gunakan jalur coba simpan lagi. |

Saat pindah soal, ukur persegi ekspresi, input dan tindakan utama terhadap visual viewport aktual, batas safe area, header atau bilah yang melekat. Pada layar biasa dalam matriks audit, ekspresi dan input harus terbaca bersama tanpa gulir manual. Bidang jawaban berfokus dan dapat diisi. Untuk rumus panjang, zoom besar atau ruang fisik yang terlalu pendek, pastikan seluruh rumus, input dan tombol dapat dijangkau dengan reflow/gulir yang sesuai. Saat siswa membaca langkah panjang, posisi baca bertahan sampai ia memilih tindakan berikut. Pemeriksaan memakai screenshot dan titik yang benar-benar terlihat, selain identitas elemen aktif.

Pada perangkat fisik, tombol tindakan keyboard virtual mengikuti kemampuan IME. Catat tindakan sebenarnya dan hasil ketukan layar. [Protokol perangkat](../VALIDASI_EKSTERNAL/02_PERANGKAT_DAN_UJARAN.md) memeriksa minus, pecahan, desimal dua bahasa, rotasi, safe area, jumlah respons dan finalisasi. [Panduan QA](QA_1.6.1.md) menjelaskan matriks browser otomatis. Evaluasi formal A/B mempunyai alur review dan finalisasi sendiri.

Sesudah karakter terakhir dari komposisi masuk ke draf, penekanan Enter baru yang berdiri sendiri harus segera dapat memeriksa jawaban. Uji jalur ini memakai input keyboard browser dengan dua perintah berdekatan dan mencocokkan jumlah respons. Enter yang masih mengonfirmasi kandidat IME menjaga teks yang sedang ditulis.
