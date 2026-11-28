# Perangkat fisik, papan ketik dan ujaran

## Satu acara perangkat, tiga kriteria wajib

Siapkan profil sintetis tersendiri per perangkat dan gunakan [lembar perangkat](formulir/perangkat.csv). Form memuat 12 kondisi yang berasal dari 3 konfigurasi perangkat/keyboard × 2 bahasa × 2 orientasi. Tiap kondisi menyediakan 13 baris observasi. Untuk pemeriksaan lintas perangkat, satu rekaman yang relevan dapat dirujuk pada beberapa baris. Isi model perangkat, OS, versi browser, identitas dan versi papan ketik, bahasa aplikasi, orientasi, serta ID acara. Uji dengan papan ketik **sistem benar-benar tampil**.

| Perangkat fisik | Aplikasi | Papan ketik | Orientasi dan bahasa |
|---|---|---|---|
| Android | Chrome | Gboard | Potret dan lanskap, ID serta EN |
| Android | Chrome | IME kedua, isi nama/versi produk | Potret dan lanskap, ID serta EN |
| iPhone atau iPad | Safari | Keyboard sistem | Potret dan lanskap, ID serta EN |

1. Mulai latihan dasar. Untuk latihan pecahan pilih tahap sesuai materi, misalnya kelas 5 level 3 penjumlahan pada katalog. Masukkan `21/12`. Gerakkan caret, ganti satu digit dan batalkan perubahan. Masukkan `0,5` untuk ID dan `0.5` untuk EN. Gunakan IME yang dapat memperlihatkan status komposisi, lalu tekan Enter selama komposisi. Catat apakah aplikasi sempat mengirim jawaban; tampilkan umpan balik hanya setelah komposisi selesai dan siswa mengirimnya.
2. Tulis draf, putar layar dengan keyboard terbuka, lalu amati caret, data, input, OKE dan safe-area. Tekan OKE, cocokkan jawaban siswa serta kunci pada kartu, buka langkah dan tekan Lanjut. Uji ketukan ganda pada kontrol akhir; hitung `attempt.completed` untuk attempt tersebut dalam cadangan sintetis. Target satu finalisasi.
3. Selama satu rangkaian 20 ketukan yang ditujukan ke OKE, Lanjut, Petunjuk, Lihat hasil, Misi berikutnya serta Peta, catat 20 target dan kontrol yang terpicu. Batas salah ketuk ≤1/20. Tulis total observasi nyata untuk Gboard, IME lain, dan keyboard iOS. Simpan pengamatan kontrol yang sulit dijangkau walaupun di bawah ambang.
4. Unduh cadangan sintetis, buka melalui penyimpanan lokal (termasuk Files pada iOS), preview dan pulihkan di perangkat asal serta perangkat kedua. Bandingkan alias profil, ID sesi/soal, draf, riwayat respons pertama/revisi dan jumlah finalisasi. Gunakan profil atau konteks peramban uji bersih untuk restore ke perangkat kedua. Catat perangkat tujuan dan hash cadangan.
5. Mulai misi, simpan paket lanjutan yang tersedia melalui Peta saat online, lalu aktifkan mode pesawat dan pastikan situs tidak mempunyai koneksi. Lanjutkan misi, jawab, baca feedback, akhirkan misi, dan mulai misi lanjutan yang telah disimpan. Tutup browser di tengah misi, buka kembali dan cocokkan ID soal serta draf. Aktifkan jaringan kembali untuk aktivitas berikutnya.
6. UX-09 memakai kasus platform-bahasa-orientasi. DEVICE-02 membedakan Gboard dan IME kedua; DEVICE-03 memakai keyboard sistem serta Files. Rujuk ID acara, artefak anonim dan observasi yang sama pada kriteria yang benar-benar dicakup. Catat FAIL saat kontrol tidak dapat digunakan, data berubah atau jumlah finalisasi salah.

## A11Y-04 · Dengarkan ujaran aktual

Isi [lembar ujaran](formulir/ujaran.csv). Jalankan enam pasangan platform/bahasa berikut. Catat pilihan aplikasi dan versinya bila protokol membolehkan beberapa pilihan.

| Pembaca | Kombinasi sasaran | Bahasa |
|---|---|---|
| NVDA | Windows + Firefox atau Chrome | ID dan EN |
| VoiceOver | Safari di iOS atau macOS | ID dan EN |
| TalkBack | Android + Chrome | ID dan EN |

Pada tiap kombinasi, catat persis apa yang terdengar untuk pecahan kelas 5 dan operasi campuran kelas 11. Aktifkan OKE dan dengarkan urutan status, jawaban siswa, kunci, cara menghitung serta langkah. Jelajahi langkah yang sudah dibuka dan dengarkan urutannya. Kembali ke tindakan utama, lepaskan lalu tekan Enter baru. Catat ujaran dan fokus soal berikutnya. Di peta, ulangi navigasi lewat daftar dan dengarkan nama keterampilan, status serta tindakan. Buat dua jawaban salah, dengarkan tawaran bantuan, hasil misi dan pesan ketika memasukkan `1/0`. Catat urutan fokus serta perbedaan kata yang berpotensi mengubah makna matematika. Lampirkan rekaman ujaran atau transkrip verbatim anonim dari operator yang mendengarkannya. Identifikasi setiap audio/transkrip dengan bahasa, versi pembaca layar dan langkah yang dicakup.

## Uji Enter pada 1.6.1

Pada Android dan iOS, jalankan potret dan lanskap dengan keyboard sistem terbuka. Coba bilangan benar, salah, dan pecahan ekuivalen. Catat apa yang dilakukan tombol aksi keyboard sebenarnya. Catat fokus, indeks, jumlah respons dan kemampuan mencapai tombol layar. Tahan, lepaskan, tekan lagi, lalu selesaikan soal terakhir. Ulangi dengan revisi, bantuan, jaringan mati dan kembali dari aplikasi lain. Gunakan profil sintetis. Untuk setiap kondisi rekam merek perangkat, OS, IME, bahasa, orientasi, build, hasil yang terlihat serta delta ledger. Lulus bila setiap aksi menghasilkan satu perubahan yang dimaksud dan kontrol/rumus dapat dibaca tanpa tertutup. Untuk ujaran, catat transkrip nyata fokus input, hasil salah, bentuk ekuivalen, soal berikut dan hasil misi.

Gunakan [lembar pengamatan Enter](formulir/enter-dua-langkah.csv) untuk pasangan kondisi di atas.


## AUD160-01 dan UX-09 · Apa yang tampak tepat setelah lanjut

Gunakan [lembar transisi soal](formulir/transisi-soal.csv) bersama rekaman layar fisik. Baris yang tersedia memasangkan perangkat/IME, orientasi, bahasa, jawaban benar/salah/ekuivalen dan tindakan keyboard/ketuk. Untuk IME yang hanya menutup keyboard, rekam perilakunya apa adanya dan lanjutkan dengan kontrol layar. Catat cara lanjut yang sungguh digunakan. Isi identitas dari [build kandidat](BUILD.json) dan tautkan ke skenario receipt platform, bahasa dan orientasi yang tepat.

1. Mulai dari beranda pada layar pendek. Catat posisi tombol mulai. Aktifkan, ketik karakter pertama tanpa menyentuh input lagi bila keyboard mendukungnya. Dokumentasikan fokus dan ketersediaan keyboard. Pada soal berikutnya, biarkan keyboard sistem terbuka lalu periksa jawaban. Rekam ekspresi lama, feedback dan indeks. Buka langkah panjang dan berhenti membaca di tengah. Pastikan posisi tidak terambil hingga siswa memilih tindakan.
2. Lepaskan lalu tekan aksi Enter baru atau ketuk Soal berikutnya. Ambil tangkapan tepat setelah layout stabil dan sebelum gulir manual. Catat visual viewport dalam piksel CSS termasuk offset, lebar, tinggi dan skala, lalu batas efektif setelah safe area serta header/footer. Catat kotak ekspresi, input dan tombol sebagai x,y,lebar,tinggi pada kerangka koordinat yang sama. Bila memakai inspeksi jarak jauh, rekam koordinat visualViewport dan getBoundingClientRect pada momen yang sama. Catat apa yang menutupi titik tengah atau tepi kontrol. Cocokkan dengan rekaman nyata saat keyboard sistem tampil. Jika koordinat suatu platform tidak dapat diukur, catat keterbatasan serta simpan rekaman yang menunjukkan seluruh area.
3. Pastikan indeks naik tepat satu, ekspresi baru terlihat dan ketikan pertama masuk ke input yang benar. Periksa pada cadangan sintetis bahwa periksa menambah satu respons dan lanjut menambah nol respons. Pada soal terakhir, periksa lalu buka hasil dengan penekanan baru. Hitung satu finalisasi untuk attempt dan satu misi baru setelah tindakan terpisah dari hasil.
4. Putar layar saat keyboard terbuka, ulangi dengan zoom dan ekspresi panjang. Pada tinggi normal, ekspresi dan bidang jawaban harus terlihat bersama tanpa gulir manual serta tindakan dapat dicapai. Jika tinggi fisik terlalu pendek untuk rumus panjang, catat area yang dapat dibaca dahulu, bagaimana seluruh ekspresi/input/tombol dijangkau, dan apakah posisi stabil saat dibaca. Uji pada 320 × 568, 390 × 844 dan 844 × 390 di browser lab untuk pembanding. Pada ponsel tulis dimensi aktual, termasuk bila berbeda dari pembanding. Data simulasi dan perangkat asli disimpan dengan lingkungan masing-masing.
5. Dengan keyboard fisik pada perangkat yang mendukungnya, coba Enter biasa, Numpad Enter serta Shift/Ctrl/Alt/Meta+Enter pada input. Kombinasi modifier harus mempertahankan indeks, draf dan jumlah respons. Pada kontrol sekunder yang fokus, periksa aktivasi kontrol tersebut. Simpan kegagalan awal, bukti perbaikan serta retest. Rekam jika konfigurasi keyboard tidak menyediakan tombol yang diuji.
