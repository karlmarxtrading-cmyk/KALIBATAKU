# Kontrak penulisan matematika dan feedback — rancangan pelaksanaan

## 1. Perilaku yang diminta pengguna

Pada mode belajar, siswa memasukkan jawaban lalu memilih **OKE / Check answer**. Setelah commit berhasil, tampilkan satu kartu yang tetap berada dekat soal dan input:

- **Benar** atau **Belum tepat**, dengan teks dan simbol, bukan warna saja.
- **Jawabanmu**, yaitu respons yang benar-benar dikirim.
- **Kunci jawaban**, ditata sebagai matematika yang terbaca.
- Satu alasan atau langkah ringkas; pembahasan lengkap dapat dibuka terpisah.
- Satu tindakan berikutnya yang jelas, tanpa memindahkan soal secara otomatis.

Tombol dapat diberi nama “OKE — Periksa jawaban” pada rancangan awal agar tindakan jelas. Setelah hasil tampil, tindakan utama menjadi **Soal berikutnya**. Menampilkan kunci setelah jawaban salah berarti percobaan ulang pada soal itu sudah mendapatkan informasi jawaban; catat peristiwa keterbukaan kunci dan jangan menganggap respons setelahnya sebagai bukti mandiri. Respons pertama tetap utuh. Mengganti bahasa atau tema tidak mengulang submission atau menghilangkan kartu.

Pada evaluasi yang masih berjalan, tombol berarti **Simpan & lanjut** dan tidak membocorkan benar/salah/kunci sampai pengiriman final. Pengguna diberi penjelasan mode sebelum mulai. Jika pemilik produk kelak menginginkan kunci seketika pada semua mode, mode tersebut harus dilabeli latihan dengan umpan balik, dengan konsekuensi pengukuran yang dinyatakan; jangan mempertahankan klaim evaluasi mandiri yang sama.

Format salah, isian belum lengkap, dan kosong merupakan status input, bukan jawaban matematika yang salah. Tampilkan koreksi format; jangan membuka kunci atau menambah salah sebelum ada respons sah. Kesalahan jaringan/penyimpanan tidak mengubah kebenaran matematika; status nilai dan status simpan ditampilkan terpisah.

## 2. Satu model, beberapa representasi

Pertahankan `expression_ast` sebagai sumber nilai/struktur dan metadata `display` sebagai maksud penyajian. Jangan membangun rumus dengan mengganti slash pada string secara global. Serializer berjalan rekursif pada tipe yang diizinkan dan menghasilkan MathML/TeX yang aman; teks pengguna tetap diperlakukan sebagai teks, bukan markup yang dapat dieksekusi.

**Contoh penting:** pada `11/12 + 10/12`, operand kanan AST telah dinormalisasi menjadi `5/6`, tetapi `display` menyimpan `10/12`. Soal harus tetap memperlihatkan `10/12` karena penyebut sama adalah bagian latihan. Kunci akhir boleh disederhanakan menjadi `7/4`. Angka `20.0` juga mempunyai `decimal_places: 1`; jangan berubah menjadi `20` hanya karena nilai rasionalnya bilangan bulat. Pertahankan tanda, tanda kurung, operasi nonasosiatif, dan urutan AST ketika menyederhanakan tampilan.

Komponen bersama menghasilkan: tampilan web; teks ujaran ID/EN; teks linear untuk fallback/copy; representasi matematika untuk dokumen. Locale hanya mengubah presentasi yang dibaca manusia. Penyimpanan nilai rasional tetap berupa numerator/denominator; penilaian tidak dilakukan dengan hasil parsing TeX atau float.

## 3. Arah renderer

Gunakan **MathJax 4.1.3** sebagai kandidat versi terkunci berdasarkan rilis resmi yang diperiksa pada 26 November 2026; verifikasi ulang versi/kompatibilitas saat implementasi dan catat nomor tepat di lockfile serta bukti build. Rilis resmi tersebut mencakup perbaikan penting pada semantic enrichment/speech generation. Jangan memuat URL `latest` yang dapat berubah tanpa bukti baru. [S1]

Pilihan utama yang diusulkan: AST → representasi math terstruktur → CHTML untuk tampilan web. Gunakan satu font matematika yang sesuai, misalnya New Computer Modern atau STIX2, setelah membandingkan sampel bank dalam terang/gelap. Font UI tetap terpisah. Native MathML merupakan alternatif implementasi yang dapat dipertimbangkan bila memenuhi kompatibilitas/aksesibilitas yang sama; keputusan dan keterbatasannya harus dicatat. `mfrac` dan `mrow` merupakan struktur yang sesuai untuk pecahan dan pengelompokan, bukan sekadar penumpukan div. [S2,S5,S6]

Pecahan utama ditampilkan bertingkat. Operator `×`, `÷`, dan minus matematika konsisten. Kurung mengikuti tinggi isi dan jarak operator tidak dipersempit oleh negative letter-spacing font UI. Teks biasa di sekitar matematika tetap mengalir nyaman; satu operand tidak dipecah per karakter. Desimal Indonesia memakai koma dan Inggris titik. Tidak ada pemisah ribuan baru pada isian yang parsernya tidak menerima pemisah tersebut.

## 4. Lazy loading dan pergantian layar

Muat renderer saat layar pertama yang membutuhkannya akan dibuka. Bank tetap dimuat per paket. Siapkan rumus, font yang diperlukan, dan input sebelum timer latihan dimulai. Jika renderer belum siap, tampilkan indikator singkat dan fallback linear yang jelas; jangan menampilkan delimiter TeX mentah atau layar kosong. Klik pertama tetap ditangani.

MathJax v4 dapat membutuhkan pemuatan data font tambahan sehingga gunakan API berbasis Promise. Gunakan `await MathJax.typesetPromise([container])` sesuai versi yang dikunci. Sebelum node matematika lama dibuang/diganti, panggil `MathJax.typesetClear([container])`. Pemanggilan versi 4 sudah diserialkan secara internal, tetapi aplikasi tetap perlu token generasi/cancellation untuk mencegah hasil layar lama dianggap siap setelah navigasi baru. Jangan menerapkan pola antrean global versi lama tanpa memeriksa dokumentasi versi yang dipilih. [S2]

Pisahkan pembaruan input, timer, dan status simpan dari typesetting rumus. Mengetik satu digit tidak boleh memproses ulang seluruh halaman. Pergantian soal, bahasa, pembahasan, dan hasil harus memproses container yang relevan tanpa memindahkan fokus secara mengejutkan. Cache terikat versi soal, metadata tampilan, bahasa, renderer dan font; bukan hanya string ekspresi.

## 5. Offline dan bobot aplikasi

Self-host berkas renderer, font/data font, worker/locale yang benar-benar diperlukan, dan lisensinya. Pada MathJax v4, font merupakan paket yang perlu diperhatikan terpisah; konfigurasi font bawaan tertentu dapat menunjuk ke CDN jika path tidak diatur. Uji daftar request aktual dan cold-start offline, jangan menganggap memasukkan satu JS berarti semua dependensi siap. [S5]

Anggaran awal aplikasi harus dipertahankan; ukur tambahan renderer sebagai komponen tersendiri dan laporkan dampaknya terhadap anggaran player. Jangan menyembunyikan bobot dengan mengeluarkannya dari laporan. Optimasi dipilih berdasarkan pengukuran: membatasi komponen, font yang dipilih, cache, dan prefetch yang proporsional. Font readiness dan layout shift diuji pada jaringan lambat; label offline hanya muncul setelah seluruh dependensi yang dijanjikan tersedia.

## 6. Aksesibilitas dan bahasa

Bentuk visual yang baik harus disertai struktur yang dapat dibaca. Terapkan fitur MathJax accessibility yang tepat untuk versi tersebut, lalu uji browser dan pembaca layar nyata. Aksesibilitas bukan hasil otomatis pemasangan paket. Dukungan bahasa Indonesia pada speech engine harus dibuktikan, bukan diasumsikan dari kemampuan bilingual UI. Bila perlu, sediakan ujaran Indonesia yang diturunkan dari AST dengan aturan pecahan, tanda negatif, dan kurung yang benar. [S3,S4]

Hindari dua salinan rumus yang keduanya dibaca. Kartu feedback mengumumkan status dan inti hasil satu kali; timer tidak mengganggu ujaran. Pengguna keyboard dapat membuka pembahasan, kembali ke input, dan melanjutkan soal dengan urutan fokus yang dapat diprediksi. Pengguna yang menonaktifkan gerak tetap mendapat hasil yang lengkap.

## 7. Semua permukaan memakai kontrak yang sama

Cakup soal aktif, kartu jawaban/kunci, petunjuk, langkah solusi, tinjau akhir, review sesi, bukti detail siswa, laporan keluarga, cetak, PDF, dan DOCX. Jangan hanya memperbaiki judul soal.

Model dokumen harus dapat membawa blok matematika; PDF/DOCX yang saat ini hanya menerima string tidak otomatis mendapat struktur typesetting. Tentukan output PDF yang menjaga ketajaman vektor dan pembacaan, serta OMML untuk Word bila menjanjikan persamaan yang dapat diedit. CSV/XLSX/JSON boleh memakai representasi linear/struktur data yang sesuai tujuan format, sambil mempertahankan nilai eksak dan keamanan ekspor. Jelaskan bila keluaran tertentu masih fallback linear; jangan menyatakan semua format memiliki kemampuan visual yang sama.

## 8. Matriks penerimaan khusus matematika

| Uji | Bukti yang diperlukan |
|---|---|
| Nilai AST sama sebelum/sesudah serializer | Seluruh ekspresi bank dan kunci tetap bernilai eksak sama; fingerprints/versi tidak berubah tanpa migrasi yang sah. |
| Metadata pedagogis | `10/12` tetap `10/12` pada soal; `20.0` tetap satu tempat desimal; pengurangan/pembagian bertingkat tidak berubah makna. |
| Pecahan dan tanda negatif | Garis pecahan, numerator/denominator, minus, dan kurung tidak tumpang tindih; enam kasus bank dan tambahan nested diperiksa. |
| Feedback setelah OKE | Benar/salah, respons aktual, dan kunci muncul untuk mode latihan; format invalid tidak dihitung salah. |
| Kunci dan pengukuran mandiri | Event key reveal tersimpan; respons sesudah membuka kunci tidak diangkat menjadi bukti mandiri; evaluasi belum final tidak membocorkan kunci. |
| Bahasa | ID/EN pada soal, kunci, pembahasan, detail guru dan laporan; respons mentah serta draft locale tetap terjaga. |
| Layar sempit dan pembesaran | 320/360/390 px, landscape dan 200% teks; operand tidak pecah sembarang; kontrol jawaban tetap dapat dijangkau. |
| Pergantian soal/language | 100 pergantian dengan typesetting tanpa duplikasi, stale render, memory growth tak terkendali, fokus hilang atau event jawaban ganda. |
| Font/renderer gagal | Fallback terbaca, retry bekerja, timer tidak berjalan sebelum siap, data input tetap utuh. |
| Cold offline | Renderer/font/data/worker yang diperlukan tersedia; tidak ada request CDN yang diperlukan untuk menyelesaikan sesi yang dijanjikan. |
| Pembaca layar | Ujaran matematika nyata pada matriks yang dipilih, termasuk bahasa Indonesia; tidak ada pembacaan ganda. |
| Ekspor | Preview/cetak/PDF/DOCX sesuai kontrak tiap format; ekspresi panjang, desimal dan pecahan diverifikasi pada hasil file. |

Seluruh uji renderer baru dimulai sebagai NOT_RUN. Keberhasilan probe fungsi pada renderer lama tidak boleh dipindahkan menjadi PASS MathJax.

## Rujukan primer

- [S1] https://github.com/mathjax/MathJax/releases — rilis 4.1.3 yang teramati.
- [S2] https://docs.mathjax.org/en/latest/web/typeset.html — typesetPromise, typesetClear, async font data, lifecycle konten dinamis.
- [S3] https://docs.mathjax.org/en/latest/basic/a11y-extensions.html — fitur aksesibilitas dan bahasa speech.
- [S4] https://docs.mathjax.org/en/stable/web/components/accessibility.html — semantic enrichment, speech, explorer, assistive MathML.
- [S5] https://docs.mathjax.org/en/latest/web/hosting.html — self-hosting, font, dan batas file://.
- [S6] https://www.w3.org/TR/mathml-core/ — struktur mfrac, mrow, operator dan presentasi matematika.

Keterangan implementasi di atas adalah rancangan produk hasil audit; rujukan digunakan untuk API/kemampuan teknis terkait, bukan sebagai bukti bahwa aplikasi ini sudah menerapkannya.

## 9. Kumpulan 32 fixture matematika

Gunakan `math_typography_fixtures.json`: **6 kasus bank nyata dan 26 kasus sintetis**. Semua uji render masih NOT_RUN; nilai harapan dihitung eksak dengan Python Fraction. Data sintetis merupakan bahan QA, tidak boleh ditambahkan diam-diam sebagai paket kurikulum baru. Tidak ada fixture pangkat karena bank aktif yang diaudit hanya menggunakan empat operasi.

Periksa struktur dan nilai sekaligus: pohon operator, urutan operand, metadata penyajian pecahan/desimal, tanda unary, dan hasil rasional. Dua kasus `12 − (5 − 2)` versus `(12 − 5) − 2`, serta `24 ÷ (6 ÷ 2)` versus `(24 ÷ 6) ÷ 2`, sengaja mempunyai hasil berbeda untuk mendeteksi serializer yang membuang grouping. Fixture bilangan besar mendeteksi kehilangan presisi karena konversi float. Screenshot memperlihatkan layout, tetapi tidak dapat menggantikan pemeriksaan semantik tersebut.

Jalankan 32 fixture pada setiap keluarga komponen yang memiliki renderer berbeda; bila seluruh layar memakai komponen bersama, uji komponen lengkap dan buktikan wiring setiap permukaan. Catat tema, bahasa, viewport, output format, font yang benar-benar terpakai, versi renderer, waktu font siap, status error serta bukti. Bandingkan teks/AST yang diserialisasi sebelum dan sesudah, bukan hanya jumlah elemen atau kemiripan gambar.

Tambahkan uji penolakan AST/operator tak dikenal dan nilai nonnumerik yang menyisipkan makro/HTML/URL. Serializer hanya menerima schema yang sudah tervalidasi; tidak menerima TeX/HTML mentah dari input siswa, catatan guru, atau impor. Sanitasi yang tidak sesuai schema tidak boleh diam-diam mengubah soal menjadi ekspresi lain.
