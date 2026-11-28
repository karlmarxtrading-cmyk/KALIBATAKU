# Penelaahan bank dan render Word

## BANK-07 · 394 keluarga

Buka [roster penelaah](bank/roster-394.csv) dan [1.182 posisi contoh](bank/contoh-1182.csv) di aplikasi spreadsheet. Impor sebagai CSV UTF-8, pemisah koma. Jadikan kolom kunci eksak, ID, hash dan referensi sebagai **teks** agar pecahan tidak diubah menjadi tanggal. Urutkan menurut posisi perjalanan dan keluarga. Filter keluarga di kedua lembar memakai `template_id`.

- Guru jenjang terkait melihat tiga posisi setiap keluarga, memeriksa aritmetika secara mandiri, lalu mencocokkan kunci, hint, langkah, strategi, kesesuaian usia dan tingkat sebelumnya/berikutnya. Catat kasus batas nyata dari contoh, misalnya tanda, nilai kecil, penyebut atau operasi campuran jika ada.
- Penelaah bahasa memeriksa kalimat, petunjuk dan langkah dalam ID serta EN. Catat bagian yang jelas, bermakna ganda atau dapat mengarahkan siswa ke jawaban keliru, beserta referensi butir dan saran perbaikan.
- `first_in_order`, `median_item` dan `hardest_item` adalah posisi dalam urutan menurut skor heuristik materi. Pertama adalah posisi skor terendah dalam pilihan roster. Penyeleksi misi dapat memberi soal berbeda kepada siswa. Indeks setelah `#` mulai dari nol. Kolom `jumlah_contoh_unik` menunjukkan ketika dua posisi menunjuk soal yang sama. `band_heuristik` dan `skor_heuristik` merupakan metadata penulis. Kelulusan review manusia menyatakan keputusan tentang isi dan urutan pada build ini.
- Masukkan alias penelaah, peran, waktu UTC, hasil tiga pemeriksaan, kasus batas, keputusan dan alasan. Lengkapi pula lima kolom review asli untuk interoperabilitas. Gunakan `setuju`, `perbaiki_urutan`, `perbaiki_isi`, atau `tolak`. Tautkan keputusan koreksi dengan temuan, tindakan dan penilaian hasil uji ulang. Keluarga yang bermasalah tetap terbuka hingga dinilai lagi pada versi yang sesuai.
- Koordinator menilai kelengkapan 394 ID yang berbeda pada roster. Catat reviewer matematika dan bahasa yang bertanggung jawab per bagian. Metadata urutan dapat diusulkan melalui pengelola rute; perubahan materi memerlukan keputusan dan versi konten tersendiri. Pertahankan seluruh bank 1.2.0 di kandidat ini. Roster dan contoh ditujukan kepada penelaah, di luar aset publik siswa.

## TEACH-03 · Microsoft Word sekolah

Ada dua paket kontrol berisi latihan sintetis. Setiap dokumen memuat empat baris persamaan untuk membandingkan tampilan Word, PDF dan rujukan.

| Kontrol | Word dan PDF | Fokus |
|---|---|---|
| Pecahan | [DOCX](word/fixture-pecahan.docx) · [PDF](word/fixture-pecahan.pdf) | Soal 11/12 + 10/12, kunci 7/4, jawaban pertama 99, revisi 21/12 |
| Kurung dan minus | [DOCX](word/fixture-kurung-minus.docx) · [PDF](word/fixture-kurung-minus.pdf) | Operan awal −25/24, faktor 2/5, tanda tambah, posisi kurung, faktor 16 dan pembagian 2, kunci 14/3 |

1. Buka [rujukan visual](word/rujukan.html), [rujukan setiap baris dan checksum](word/rujukan.json) dan [formulir perbandingan](formulir/word.csv). Di Word yang dipakai sekolah, catat OS dan nomor versi/build Word. Buka kontrol DOCX. Catat teks dan tampilan aktual per baris, termasuk pecahan bertingkat, posisi tanda minus, pengelompokan dan keterbacaan. Simpan bukti render dari Word yang menampilkan bagian yang diperiksa.
2. Buat satu ekspor **baru di UI kandidat yang sama**. Pada profil lokal pengujian, buka menu cadangan dan pemulihan, pilih salah satu [profil pecahan sintetis](word/fixture-pecahan-profil-sintetis.json) atau [profil kurung dan minus sintetis](word/fixture-kurung-minus-profil-sintetis.json), tinjau preview, lalu pulihkan. Pilih sumber profil lokal di Ruang guru → Laporan, pilih nama `Demo uji fixture-…` dan periode yang meliputi sesi. Satu profil menyediakan satu sesi, dua jawaban dan satu revisi setelah kunci. Ekspor DOCX, PDF dan JSON dari tampilan laporan yang sama. Gunakan setidaknya kontrol kurung/minus dalam ekspor baru supaya bentuk tersebut ikut teramati.
3. Buka hasil ekspor baru di Word sekolah dan bandingkan seluruh persamaan dengan JSON, PDF dan rujukan. Isi hasil observasi, jumlah persamaan diperiksa dan jumlah keliru, hash dokumen, referensi tangkapan dan pengesahan manusia. Untuk kasus `supplied-fixture`, lampirkan kedua kontrol dengan hasil per dokumen; untuk `new-export` lampirkan dokumen ekspor baru dan bukti merendernya. Jika sekolah juga memakai aplikasi lain, catat pengamatan tambahan beserta nama aplikasinya secara terpisah.
4. Hanya nyatakan lulus jika semua persamaan yang diperiksa tampil benar di Word sasaran dan hasilnya sudah ditelaah. Jika salah, pertahankan bukti tampilan awal, perbaikan dan hasil uji ulang pada build yang disetujui.
