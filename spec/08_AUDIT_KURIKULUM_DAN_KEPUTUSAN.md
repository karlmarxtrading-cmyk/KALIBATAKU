# Audit akademik KALIBATAKU v1 dan aturan kelengkapan bank soal

Tanggal: 25 November 2026. Lingkup: kedua berkas di dalam ZIP kurikulum; pembacaan seluruh 60 level dan 281 spesifikasi aktif. Status: audit rancangan kurikulum dan contoh, bukan audit bank soal produksi yang belum dibuat.

## 1. Hasil utama

Struktur kurikulum konsisten: **12 kelas × 5 level = 60 level**, **300 slot kategori**, **281 aktif**, **19 nonaktif**. Jumlah batas perencanaan **4.604 paket dan 177.640 slot soal** cocok dengan hasil penjumlahan metadata tiap kompetensi. Kelas 1 memiliki11 kompetensi aktif, kelas 2 memiliki20; kelas 3–12 masing-masing25.

Semua **281 contoh memiliki hasil aritmetika yang benar**. Evaluator independen menggunakan tokenizer dan recursive-descent parser, dengan pecahan/desimal eksak, empat operasi biner dan tanda kurung. Tidak menggunakan `eval`, tidak menyalin fungsi solver pembentuk sumber. Hasil parsing ekspresi cocok dengan kunci numerator/denominator, AST, dan semua alternatif `display_answer`. Contoh kelas 1–4 memiliki operand dan langkah antara bulat; kelas 1–6 nonnegatif. Seluruh ID kompetensi unik, referensi kandidat prasyarat ada, dan graf kandidat tidak mengandung siklus.

Meski kunci benar, terdapat **empat ketidaksesuaian antara contoh dan spesifikasi**. Contoh tersebut harus dikoreksi sebelum dijadikan fixture acuan generator. Aturan editorial juga belum dapat langsung dijalankan sebagai validator.

## 2. Empat koreksi contoh yang dapat diterapkan tanpa mengubah cakupan

| ID | Kompetensi | Bukti konflik | Koreksi minimal |
|---|---|---|---|
| AC-001 | `arithmetic.addition.g02.l05` | `198+42=240` benar, tetapi198 dan42 sama-sama berjarak2 dari kelipatan10. Aturan meminta minimal satu operand kelipatan10 atau berjarak1. | Ganti contoh menjadi `199+42=241`; aturan tetap. |
| AC-002 | `arithmetic.mixed.g11.l03` | `144⁄175×245⁄216+1⁄3` hanya memuat2 operasi biner; aturan meminta3–4. | Ganti menjadi `(144⁄175×245⁄216+1⁄3)×15=19`;3 operasi, pembatalan silang tetap tersedia. |
| AC-003 | `arithmetic.division.g12.l01` | `249950÷25=9998`; q9998 melampaui batas q≤5000. | Ganti menjadi `249950÷9998=25`; pembagi9998 dekat10000 dengan selisih2, hasil25 berada dalam batas. |
| AC-004 | `arithmetic.mixed.g12.l02` | `(1⁄64+0.015625)×3200` hanya2 operasi, aturan meminta3–4. | Ganti menjadi `(1⁄64+0.015625)×3200÷10=10`;3 operasi, ekuivalensi dan penskalaan tetap terlatih. |

Garis `⁄` pada pecahan literal tidak dihitung sebagai operasi biner; ini konsisten dengan kebijakan sumber dan AST. Perubahan harus disalin serentak ke ekspresi, AST, kunci rasional, display_answer, dokumen kurikulum kerja, serta fixture. Simpan sumber asli tanpa perubahan dan catat koreksi dalam errata/version overlay. Tidak perlu membuka kembali pembagian12 kelas,60 level,281 aktif dan19 nonaktif.

## 3. Aturan yang harus dibuat eksplisit sebelum produksi

### 3.1 Predikat pembentuk soal

Istilah `friendly`, `anchor`, `near`, `related denominators`, `cancellation`, dan `two mental affordances` perlu diterjemahkan menjadi predikat yang dapat diperiksa. Definisi global `complementary` saat ini juga menerima pasangan dengan hasil bilangan bulat; pada dua operand bulat ini membuat syarat komplemen selalu benar. Generator harus menyebut target komplemen atau himpunan patokan tertentu, misalnya menuju1000, faktor125, atau pasangan yang menyelesaikan blok nilai tempat. Jangan memakai alasan “soal terlihat ramah” sebagai validator.

Setiap template wajib menetapkan domain operand, batas inklusif/eksklusif, operand bertanda, representasi literal, offset patokan, KPK penyebut, syarat pembatalan, jumlah operasi, jenis operasi berbeda, batas setiap intermediate, serta kebijakan nol. Pewarisan `same as ADD`/`as MUL` diekspansi ke kontrak mesin yang eksplisit. Browser tidak menafsirkan bahasa alami dalam `rule_spec` ketika siswa mulai latihan.

Pada MIX, siapkan resep bentuk AST, bukan penggabungan angka acak. Tentukan apakah tanda kurung wajib atau hanya diizinkan dan bagaimana batas suboperasi diwariskan. Contoh G06-L04 `(125×32)÷16+0.5` memperlihatkan faktor16 sebagai bagian dekomposisi, sementara beberapa kompetensi DIV mandiri sebelumnya memakai himpunan pembagi berbeda. Ini membutuhkan aturan komponensasi faktor yang jelas; jangan mengubah seluruh rentang pembagian mandiri hanya untuk membenarkan satu bentuk campuran.

### 3.2 Prasyarat

Daftar `prerequisite_candidates` benar secara referensi, tetapi sebagian besar hanya menunjuk kompetensi sebelumnya pada operasi yang sama. Perkalian pertama, pembagian pertama, dan MIX pertama mempunyai daftar kosong. Penjumlahan pecahan pertama hanya mengikuti penjumlahan desimal sebelumnya. Ini belum merupakan graf prasyarat pedagogis lengkap.

Pertahankan daftar sumber sebagai kandidat. Tambahkan hubungan yang membedakan **prasyarat wajib**, **penguatan yang disarankan**, dan **jalur diagnostik pengganti**. DIV perlu hubungan dengan fakta MUL yang relevan; MIX perlu operasi pembentuknya; pecahan dan bilangan bertanda perlu kemampuan representasi. Periksa siklus, referensi yang hilang, dan jalur penempatan siswa. Jangan menjadikan daftar linear sebagai kunci keras seluruh kelas: siswa dapat maju pada ADD sambil memperkuat DIV.

### 3.3 Jawaban dan representasi

Nilai rasional eksak berbeda dari cara menampilkannya. Nilai1/2 dapat sengaja ditampilkan sebagai0.5,0,5,1/2, atau2/4 untuk tujuan berbeda. AST kanonik menyimpan nilai, sedangkan metadata tampilan menyimpan representasi yang dikehendaki. Pergantian bahasa tidak boleh mengubah nilai, identitas butir, atau sesi.

Tampilkan pecahan sebagai pecahan yang jelas atau gunakan tanda kurung. Bentuk teks `12÷3/4` ambigu; gunakan `12÷(3/4)` bila fraction layout tidak tersedia. Penyebut harus positif dan nilai dinormalisasi dengan FPB; numerator boleh negatif. Frasa sumber mengenai numerator/denominator positif jangan diinterpretasikan seolah numerator wajib positif pada kelas 7–12.

Fingerprint bukti independen harus berdasarkan nilai dan struktur yang sesuai, bukan teks locale. Dua soal dengan jawaban sama belum tentu duplikat. Dua representasi dari nilai dan struktur identik dapat menjadi latihan representasi berbeda, tetapi jangan otomatis dihitung sebagai dua bukti independen untuk penguasaan. Tetapkan versi kebijakan fingerprint.

## 4. Kapasitas berbeda dengan banyak soal unik

| Jenjang | Sel aktif | Paket/sel | Slot/paket | Paket | Slot |
|---|---:|---:|---:|---:|---:|
| Kelas 1 | 11 | 4 | 10 | 44 | 440 |
| Kelas 2 | 20 | 8 | 20 | 160 | 3.200 |
| Kelas 3–4 | 50 | 12 | 25 | 600 | 15.000 |
| Kelas 5–6 | 50 | 16 | 30 | 800 | 24.000 |
| Kelas 7–9 | 75 | 20 | 40 | 1.500 | 60.000 |
| Kelas 10–12 | 75 | 20 | 50 | 1.500 | 75.000 |
| **Total** | **281** | — | — | **4.604** | **177.640** |

Angka ini adalah ceiling perencanaan yang dinyatakan sumber, bukan isi ZIP yang sudah ada. ZIP sumber hanya menyediakan281 contoh. Bahkan apabila target slot dipenuhi, tidak berarti177.640 bentuk unik.

Berikut pool kecil yang dihitung dengan enumerasi seluruh domain sumber. Untuk ADD/MUL, pertukaran operand dianggap satu bentuk; SUB/DIV mempertahankan urutan. Kesamaan jawaban akhir tidak menggabungkan bentuk berbeda.

| Kompetensi | Bentuk kanonik unik |
|---|---:|
| G01-L01 ADD | 12 |
| G01-L01 SUB | 21 |
| G01-L02 ADD | 36 |
| G01-L02 SUB | 66 |
| G01-L03 ADD / SUB | 55 /55 |
| G01-L04 ADD / SUB | 25 /45 |
| G01-L05 ADD / SUB / MIX | 115 /955 /405 |
| G02-L03 MUL | 30 |
| G02-L04 MUL | 36 |
| G02-L05 MUL | 45 |
| G03-L01 MUL | 66 |

Empat paket10 soal untuk G01-L01 ADD masih dapat dibuat dengan pengulangan lintas paket dari pool12, tanpa duplikasi dalam satu paket. Pengulangan itu harus dinyatakan sebagai penguatan terencana. Jangan menambahkan angka di luar domain hanya untuk memperbesar pool. Jika suatu template atau blueprint benar-benar tidak mampu memenuhi ukuran paket, catat bukti matematis dan sesuaikan jumlah butir/paket secara eksplisit. Keterbatasan waktu, token, atau kemudahan coding bukan alasan pengurangan cakupan.

## 5. Definition of Complete untuk bank soal produksi

Bank dapat dinyatakan lengkap terhadap kurikulum ketika seluruh syarat berikut terbukti pada build yang sama:

1. **Cakupan:**60 level tersedia;281/281 kompetensi aktif mempunyai paket yang dapat dijalankan;19 kategori nonaktif tetap nonaktif. Tidak ada cell aktif yang hanya berisi halaman “segera hadir”, contoh satu soal, manifest kosong, atau fallback ke soal dari kelas lain.
2. **Spesifikasi:** seluruh aturan editorial dipetakan ke template/parameter/validator yang eksplisit dan berversi. Errata empat contoh diterapkan. Semua tujuan kompetensi serta subtipe wajib tercakup, bukan satu pola yang diulang dengan nomor berbeda.
3. **Produksi fisik:** generator menghasilkan file paket nyata, indeks dan checksum; jumlah manifest sama dengan file dan jumlah soal. Factory dapat direproduksi menggunakan seed, versi generator, versi kurikulum dan lockfile yang sama. Paket assessment memakai konten tetap berversi.
4. **Kapasitas dan keunikan:** laporan memisahkan jumlah slot, butir kanonik unik, varian representasi, pengulangan terencana, serta tumpang tindih antarform. Setiap penyesuaian terhadap target memiliki alasan kelayakan pool dan tidak menghilangkan kompetensi aktif.
5. **Matematika:** seluruh butir yang diproduksi, termasuk seluruh intermediate, diperiksa evaluator rasional independen. Tidak ada pembagian nol, jawaban NaN/Infinity, pelanggaran domain kelas atau pemakaian floating point sebagai sumber kebenaran.
6. **Kepatuhan kurikulum:** semua operand, bentuk, batas, prasyarat, jumlah operasi dan struktur strategi lolos validator kompetensi. Pengujian contoh saja tidak cukup. Validator negatif harus menolak soal yang sengaja keluar batas.
7. **Kualitas akademik:** ada review template dan sampling butir yang terdokumentasi; status reviewer nyata dan bukti pilot dilaporkan apa adanya. Jangan menciptakan tanda tangan guru atau hasil pilot. Status teknis dan status validasi akademik dibedakan.
8. **Bilingual:** semua teks produk, instruksi, feedback, penjelasan strategi, katalog, status dan laporan memiliki ID/EN yang setara; angka dan pecahan dirender benar pada kedua locale. Istilah bilingual di rule_spec tidak membuktikan antarmuka telah diterjemahkan.
9. **Evaluasi:** minimal dua form yang setara per kompetensi, jika pool memungkinkan; form yang tumpang tindih memiliki catatan bukti unik. Soal kosong/skip tidak boleh meningkatkan status mastery melalui manipulasi denominator.
10. **Integrasi:** kompetensi, paket, question_id, content_version, fingerprint, attempt dan event terhubung pada laporan lokal serta bridge. Perubahan konten tidak merusak riwayat hasil yang merujuk versi lama.
11. **Distribusi:** seluruh paket lazy-loaded benar, cached hanya sesuai pilihan, dapat dimuat dari hosting statis, dan tidak membutuhkan akses ke endpoint server untuk memulai latihan lokal. Paket hasil build bukan placeholder yang baru diisi ketika siswa mengklik.
12. **Bukti rilis:** satu laporan cakupan yang dapat dihitung ulang dan daftar fail/blocker menyertai artefak rilis. Kriteria yang belum diuji ditandai belum diuji; tidak diubah menjadi PASS karena dokumen spesifikasinya ada.

Target pengguna “super lengkap” perlu diterjemahkan menjadi cakupan dan bukti di atas, bukan klaim jumlah yang dapat dipenuhi dengan menduplikasi file. Target4.604 paket/177.640 slot dapat dipertahankan sebagai rencana produksi default dengan pengecualian yang dihitung, sambil tetap melaporkan jumlah aktual.

## 6. Penilaian, adaptasi, dan pelaporan

Ambang90% gabungan,80% per form, dua sesi, interval24jam, minimal bukti unik20 dengan batas pool, dan review7/30hari adalah **kebijakan usulan** dari sumber. Pertahankan sebagai konfigurasi berversi. Jangan menyebutnya norma nasional, standardisasi kelas empiris atau bukti psikometrik.

Kenaikan level memerlukan seluruh kompetensi aktif pada level, bukan rata-rata tinggi yang menyembunyikan pembagian lemah. Prioritaskan ketepatan; kecepatan tidak menjadi syarat mutlak. Data mode Speed, Practice, Assessment dan penggunaan hint dipisahkan. Waktu aktif harus menampilkan jumlah observasi dan kualitas pencatatan; jawaban akhir tidak membuktikan strategi mental tertentu.

Laporan Parents Meeting perlu membedakan skor form, akurasi jawaban, kelengkapan, penguasaan provisional, dan hasil terverifikasi. Perbandingan lintas periode hanya disebut peningkatan yang setara jika kompetensi, tingkat kesulitan, kebijakan dan kondisi bentuk sebanding. `Belum diuji` berbeda dari0%. MIX dilaporkan tersendiri; hasil akhirnya tidak membuktikan semua langkah komponennya dikuasai.

Cangkang statis dapat menghasilkan laporan lokal yang benar secara hitung, tetapi autentikasi guru, akses lintas perangkat dan hasil resmi institusi baru tersedia setelah LMS server benar-benar aktif. Dataset simulasi tidak boleh berubah label menjadi catatan akademik resmi ketika bridge tersambung. Penilaian lokal yang jujur juga tidak sama dengan penilaian anti-cheat; kunci publik pada JS dapat dilihat pengguna.

## 7. Batas audit ini

Audit membaca seluruh aturan sumber dan memeriksa semua contoh secara independen. Pemeriksaan range contoh dilakukan dengan membaca setiap spesifikasi dan menemukan empat konflik konkret di atas. **Belum ada validator executable untuk seluruh281 rentang/template**, sehingga laporan ini tidak boleh disebut pembuktian penuh seluruh rule. Tidak ada bank massal yang tersedia untuk diuji, tidak ada pilot siswa, dan tidak ada kurikulum resmi yang diklaim sebagai acuan. Semua koreksi yang disarankan mempertahankan cakupan sumber, menggunakan patch yang dapat ditelusuri, dan belum mengubah berkas asli.

Rincian yang dapat dibaca mesin tersedia pada `academic_findings.json`, termasuk identitas sumber, temuan, metode, hitungan dan koreksi minimal.


## 8. Keputusan pelaksanaan dalam paket ini

Empat koreksi contoh diterapkan pada `curriculum/KALIBATAKU_CURRICULUM_REGISTRY_v1_0_DRAFT2.json` dan Markdown pendamping. Sumber asli di `00_SUMBER/` tidak diubah. `curriculum/ERRATA_APPLIED.json` menyimpan before/after, AST, kunci dan issue ID. Versi efektif 1.0.0-draft.2 masih merupakan kurikulum internal rancangan, bukan hasil kalibrasi siswa.

Temuan AC-005–AC-011 dijadikan persyaratan di PRD, factory, kontrak dan acceptance. Ini menetapkan pekerjaan yang wajib dilakukan saat membangun website, bukan menyatakan seluruh validator atau bank sudah tersedia. Kebijakan implementasi tambahan: ID default, tema system default, timer Speed tetap berjalan saat hidden, grammar locale ketat, numerator boleh negatif sesuai domain dan denominator selalu positif, evidence dari respons final kesempatan eligible pertama, serta siklus evaluasi mastery maksimum 60 hari dengan jarak default 24 jam yang bisa dikonfigurasi. Sesudah penguatan dan tindakan retest eksplisit, siklus baru dapat dibuka dengan dua pengerjaan baru; form A/B yang tersedia boleh digunakan kembali, sementara histori, exposure dan overlap tetap dicatat. Semua kebijakan tersebut mempunyai versi dan tidak boleh dipresentasikan sebagai norma ilmiah terkalibrasi.
