# KALIBATAKU — Master Curriculum & Academic Integration Blueprint

**Versi:** 1.0.0-draft.2 · **Status:** Usulan kurikulum internal, untuk ditinjau guru sebelum produksi bank soal.  
**Catatan versi:** Empat contoh diperbaiki sesuai `ERRATA_APPLIED.json`; aturan, jumlah kelas/level/sel aktif dipertahankan. Spesifikasi pelaksanaan tambahan mengikuti PRD dan dokumen factory dalam paket ini.

**Modul:** Mental Math / Arithmetic Fluency · **Cakupan:** Kelas 1–12, 5 level per kelas.  
**Arsitektur:** Static-first, bilingual, numeric essay, modular JS, LMS-ready melalui Server Bridge.

## 1. Landasan dan batas cakupan

Dokumen ini memperluas rancangan dalam `Markdown yang ditempel (1)(10).md`: satu cangkang, kelas 1–12 dan lima level, empat operasi dasar beserta campuran, lima mode latihan, bank JS modular, analytics, mock adapter dan remote API adapter. Bagian kurikulum rinci, aturan paket, ambang penguasaan dan kebijakan evaluasi di bawah adalah keputusan desain usulan, bukan keputusan final pengguna atau kurikulum resmi pemerintah. Tidak ada klaim pemetaan kurikulum nasional, kalibrasi tingkat kesulitan empiris, atau implementasi website produksi.

Tujuan: siswa memperoleh ketepatan, kelancaran, fleksibilitas strategi, efisiensi mental, dan kemampuan memilih strategi. Siswa menjawab sendiri (numeric constructed response), tanpa opsi jawaban. Hanya `+`, `−`, `×`, `÷` dan tanda kurung untuk urutan operasi; tanda negatif adalah bagian representasi bilangan. Pecahan merupakan operand rasional, bukan materi baru. Tidak memasukkan soal persentase, eksponen sebagai operasi soal, akar, aljabar, geometri, cerita, kalkulus, atau tes psikometrik. Strategi skala 10, 100, 1000 tetap dilatih melalui kali/bagi.

Kelas 1–4: cacah nonnegatif, hasil dan langkah antara bulat nonnegatif, pembagian habis. Kelas 5–6: bilangan nonnegatif, desimal dan pecahan eksak. Kelas 7–12: bilangan bertanda dan rasional eksak, dengan struktur mental yang makin kaya. Kelas 10–12 bukan kursus kalkulus; latihan aritmetika tingkat lanjut yang sesuai kebutuhan sekolah menengah. Batas angka adalah batas desain, bukan target hafalan angka besar.

Kelas administratif (mis. 5A) berbeda dari kelas materi (G05). Siswa dapat melakukan remediasi atau akselerasi per kompetensi; semua histori mengikuti ID siswa, bukan nama kelas. Kurikulum bersifat spiral, sehingga kelas lebih tinggi boleh mengulang kompetensi prasyarat; kesulitan tidak dinilai hanya dari banyak digit.

## 2. Struktur kurikulum dan konvensi

| Level | Indonesia | English | Tujuan |
|---|---|---|---|
| L01 | Fondasi | Foundation | Memantapkan pola dasar pada cakupan kelas |
| L02 | Pengembangan | Developing | Memperluas variasi dan strategi |
| L03 | Menengah | Intermediate | Menghubungkan strategi dengan kelancaran |
| L04 | Lanjutan | Advanced | Menangani struktur yang lebih kompleks |
| L05 | Penguasaan | Mastery | Mengintegrasikan dan mempertahankan keterampilan |

| Kode | Indonesia | English |
|---|---|---|
| ADD | Penjumlahan | Addition |
| SUB | Pengurangan | Subtraction |
| MUL | Perkalian | Multiplication |
| DIV | Pembagian | Division |
| MIX | Operasi campuran | Mixed Operations |

Setiap pasangan kelas–level berisi lima slot kategori, termasuk status nonaktif. Setiap slot aktif adalah satu standar kompetensi granular untuk katalog paket dan laporan (bukan satu-satunya keterampilan yang dapat diukur). ID stabil: `arithmetic.<operation>.gXX.lXX`. Nama yang berubah tanpa mengubah makna tidak mengubah ID; perubahan kompetensi yang tidak kompatibel memerlukan ID atau versi baru. Hubungkan kompetensi dengan tag strategi per butir. Tag pada tiap level adalah kandidat, bukan bukti bahwa setiap tag diterapkan di setiap soal.

**Konvensi aturan teknis untuk Question Bank Factory:**

- `a,b` adalah operand; `q` hasil bagi; `d,e` penyebut positif; `m,n` pembilang atau indeks kelipatan sesuai konteks. Rentang inklusif, kecuali `<`/`>`. `dp` = jumlah tempat desimal. `magnitude` = nilai mutlak. `lcm` = KPK. Bilangan dalam rentang tanpa keterangan domain mengikuti domain kelas dan aturan lokal.
- `same as ADD` atau `as MUL` berarti menerapkan spesifikasi kategori yang dirujuk pada level yang sama; untuk DIV, `as MUL` digunakan pada pasangan faktor atau pembagian menjadi perkalian kebalikan sebagaimana dinyatakan. Penjumlahan/perkalian boleh menukar operand tanpa mengubah kompetensi. Pengurangan dan pembagian tidak boleh otomatis ditukar.
- `near 10n` berarti ada bilangan bulat n sehingga selisih dari 10n berada pada rentang yang ditentukan. Jika rentang tidak disebut, default untuk integer: 1–2 dari 10n atau 1–5 dari 100n; untuk desimal dekat integer: 0.001–0.25. `related denominators`: satu merupakan kelipatan yang lain atau memiliki faktor bersama >1. `complementary`: jumlah/selisih terarah membentuk bilangan bulat, kelipatan 10, 100, 1000 atau nilai patokan yang eksplisit. `anchor/friendly`: struktur eksak yang memungkinkan strategi sederhana; uji minimal satu template sah, misalnya kelipatan 10/100/1000, dekat patokan, pasangan faktor 2/5/10, 4/25/100, 8/125/1000, 16/625/10000, pecahan dyadic atau desimal eksak yang dapat dibatalkan, atau pembatalan silang. Jangan memilih angka acak tanpa kriteria tersebut.
- Pembatalan silang: faktor bersama pembilang pertama dengan penyebut kedua, atau sebaliknya (setelah membalik pembagi untuk DIV). Dua pembatalan berarti kedua pasangan memiliki faktor bersama >1, atau dua pengurangan faktor independen pada bentuk multioperasi.
- MIX wajib minimal dua jenis operasi biner berbeda; `a×b×c` hanya MUL, bukan MIX. Gunakan bentuk ekspresi yang dinyatakan. Jika bentuk hanya memberi jumlah operasi, pilih operand dan subekspresi dari kompetensi aktif pada level sekarang atau prasyarat; terapkan batas intermediate pada MIX, bukan seluruh batas operand untuk setiap subekspresi. Pengurangan berantai dihitung kiri ke kanan, seperti perkalian/pembagian dengan prioritas sama; tanda kurung didahulukan. Tidak ada pembagian nol atau bentuk ambigu seperti `6÷2(1+2)`.
- G01–G06: tidak boleh ada operand atau hasil antara negatif (termasuk untuk MIX); G01–G04: setiap hasil antara bilangan bulat. Semua DIV konstruksi dari `a=b×q`, b≠0, atau pecahan rasional yang hasilnya dibatasi aturan lokal. Semua hasil rasional disimpan eksak. Desimal tidak dihitung dengan float untuk menentukan kunci.
- Batas denominator hasil berlaku setelah penyederhanaan. Jika MIX tidak menyebut batas magnitude/denominator, gunakan batas terbesar kompetensi aktif yang relevan dan pertahankan domain kelas. Default batas magnitude global 50.000.000 dan penyebut hasil maksimum 1.000.000, kecuali batas lokal lebih kecil. Untuk pembagian, dividend hasil konstruksi boleh melampaui batas q/b, selama memenuhi batas lokal/global. Penyebut operand literal mengikuti spesifikasi lokal, sedangkan AST dapat menormalisasi pecahan.
- `−` adalah minus, `⁄` adalah garis pecahan literal; format internal tidak bergantung locale. Pembilang boleh negatif sesuai domain kelas; penyebut selalu positif. Notasi teks ID dan EN dirender dari AST, bukan mengganti separator secara membabi buta. Desimal UI ID menggunakan koma, EN titik. Untuk menghindari ambiguitas, input jawaban tidak memakai pemisah ribuan; `1,25` pada ID dan `1.25` pada EN ekuivalen, `1.250` tidak otomatis dianggap 1250. Terima pecahan seperti `2/4` sebagai 1/2 dan desimal eksak ekuivalen sesuai kebijakan paket; tidak ada toleransi floating point. Bentuk nonterminating dijawab dalam pecahan eksak, bukan dibulatkan. Tipe `numeric_essay` tetap satu jawaban numerik, bukan uraian langkah.
- Aturan tabel adalah spesifikasi editorial (notasi matematis bersama dan istilah ID/EN), bukan validator executable. Penyusun factory harus mengubah aturan ke template parameter eksplisit, menguji semua parameter, dan menyelesaikan ambiguitas bersama guru. Judul kelas, level, kompetensi, paket, strategi, instruksi, umpan balik, dan report harus bilingual. Narasi teknis utama dokumen menggunakan bahasa Indonesia; teks aturan memakai istilah teknis ID/EN.

## 3. Registry strategi mental (strategy tags)

Tag berarti soal memiliki peluang untuk strategi tertentu, bukan bukti cara berpikir siswa. Konfirmasi strategi aktual memerlukan observasi guru atau instrumen terpisah; tidak disimpulkan dari jawaban akhir.

| Tag | Indonesia | English |
|---|---|---|
| NB | Pasangan bilangan | Number bonds |
| MT | Membentuk sepuluh | Making ten |
| PV | Nilai tempat | Place value |
| CO | Kompensasi | Compensation |
| BR | Menjembatani batas bilangan | Bridging |
| DB | Penggandaan | Doubling |
| HL | Pembagian menjadi dua | Halving |
| DE | Dekomposisi | Decomposition |
| DS | Pemikiran distributif | Distributive thinking |
| PO | Penskalaan pangkat sepuluh | Power-of-ten scaling |
| INV | Operasi invers | Inverse operations |
| HD | Penggandaan dan pembagian faktor | Halving and doubling / factor regrouping |
| FR | Aritmetika pecahan | Fraction arithmetic |
| EQ | Representasi ekuivalen | Equivalent representations |
| SG | Aturan tanda | Sign rules |
| OO | Urutan operasi | Order of operations |

## 4. Matriks kompetensi lengkap — 60 level

Tanda `—` berarti kategori tidak aktif dan tidak boleh dibuat paketnya. Setiap baris aktif memiliki contoh eksak yang telah dihitung ulang. Contoh menggunakan format matematika netral bahasa; jawaban dapat ditampilkan menurut locale. Prasyarat default adalah kompetensi aktif sebelumnya pada operasi yang sama, dengan asesmen diagnostik sebagai alternatif. Untuk MIX, seluruh operasi yang digunakan wajib telah aktif. L05 mengulang inti kelas dalam asesmen kumulatif; cakupan baru tidak otomatis berarti penguasaan seluruh kemampuan sebelumnya.

### Kelas 01 / Grade 01

#### G01-L01 — Fondasi / Foundation

**Fokus / Focus:** Pasangan bilangan sampai 5 / Number bonds to 5.  
**Kandidat strategi / Strategy candidates:** NB, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=0–5; a+b≤5 | 2+3 | 5 |
| SUB | 0≤b≤a≤5 | 5−2 | 3 |
| MUL | — Tidak aktif / Inactive | — | — |
| DIV | — Tidak aktif / Inactive | — | — |
| MIX | — Tidak aktif / Inactive | — | — |

Target awal per kompetensi aktif: maksimal 4 paket × 10 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G01-L02 — Pengembangan / Developing

**Fokus / Focus:** Pasangan bilangan sampai 10 / Number bonds to 10.  
**Kandidat strategi / Strategy candidates:** NB, MT, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=0–10; a+b≤10 | 6+4 | 10 |
| SUB | 0≤b≤a≤10 | 9−4 | 5 |
| MUL | — Tidak aktif / Inactive | — | — |
| DIV | — Tidak aktif / Inactive | — | — |
| MIX | — Tidak aktif / Inactive | — | — |

Target awal per kompetensi aktif: maksimal 4 paket × 10 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G01-L03 — Menengah / Intermediate

**Fokus / Focus:** Belasan tanpa melewati puluhan / Teens without crossing ten.  
**Kandidat strategi / Strategy candidates:** PV, NB.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a=10–19,b=0–9; a+b≤19 | 13+4 | 17 |
| SUB | a=10–19,b=0–9; a−b≥10 | 17−5 | 12 |
| MUL | — Tidak aktif / Inactive | — | — |
| DIV | — Tidak aktif / Inactive | — | — |
| MIX | — Tidak aktif / Inactive | — | — |

Target awal per kompetensi aktif: maksimal 4 paket × 10 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G01-L04 — Lanjutan / Advanced

**Fokus / Focus:** Melewati batas sepuluh / Bridging ten.  
**Kandidat strategi / Strategy candidates:** MT, BR, DE.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=1–9; 10≤a+b≤18 | 8+7 | 15 |
| SUB | a=10–18,b=1–9; 0≤a−b<10 | 14−8 | 6 |
| MUL | — Tidak aktif / Inactive | — | — |
| DIV | — Tidak aktif / Inactive | — | — |
| MIX | — Tidak aktif / Inactive | — | — |

Target awal per kompetensi aktif: maksimal 4 paket × 10 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G01-L05 — Penguasaan / Mastery

**Fokus / Focus:** Puluhan dan satuan / Tens and ones.  
**Kandidat strategi / Strategy candidates:** PV, NB, BR.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a=10–90 kelipatan/multiple 10; b=0–9 atau/or kelipatan/multiple 10; a+b≤100 | 40+7 | 47 |
| SUB | a=10–100,b=0–90; b kelipatan/multiple 10 atau/or b≤digit satuan/ones digit; b≤a | 67−7 | 60 |
| MUL | — Tidak aktif / Inactive | — | — |
| DIV | — Tidak aktif / Inactive | — | — |
| MIX | a=kelipatan/multiple 10 (10–90), b=1–9, 1≤c≤b; a+b−c | 30+5−2 | 33 |

Target awal per kompetensi aktif: maksimal 4 paket × 10 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

### Kelas 02 / Grade 02

#### G02-L01 — Fondasi / Foundation

**Fokus / Focus:** Dua digit tanpa pengelompokan ulang / Two digits without regrouping.  
**Kandidat strategi / Strategy candidates:** PV, DE.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=10–89; jumlah digit/sum of digits per posisi/place≤9 | 34+25 | 59 |
| SUB | a,b=10–99; digit a≥digit b pada tiap posisi/each place | 76−34 | 42 |
| MUL | — Tidak aktif / Inactive | — | — |
| DIV | — Tidak aktif / Inactive | — | — |
| MIX | a+b−c; a,b,c=1–30; semua hasil antara/intermediates 0–99; tanpa regrouping/no regrouping | 21+15−4 | 32 |

Target awal per kompetensi aktif: maksimal 8 paket × 20 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G02-L02 — Pengembangan / Developing

**Fokus / Focus:** Dua digit dengan pengelompokan ulang / Two digits with regrouping.  
**Kandidat strategi / Strategy candidates:** MT, BR, CO, DE.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=10–89; a+b≤100; carry satuan/ones | 47+38 | 85 |
| SUB | 10≤b≤a≤99; borrow satuan/ones | 72−38 | 34 |
| MUL | — Tidak aktif / Inactive | — | — |
| DIV | — Tidak aktif / Inactive | — | — |
| MIX | a−b+c atau/or a+b−c; 1–99; hasil antara/intermediates 0–100; satu regrouping/one regrouping minimum | 64−28+9 | 45 |

Target awal per kompetensi aktif: maksimal 8 paket × 20 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G02-L03 — Menengah / Intermediate

**Fokus / Focus:** Fakta kali 2, 5, dan 10 / Facts of 2, 5 and 10.  
**Kandidat strategi / Strategy candidates:** DB, PV, NB, DE.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=10–99; a+b≤150 | 76+48 | 124 |
| SUB | 0≤b≤a≤150; selisih/difference≤100 | 102−48 | 54 |
| MUL | a∈{2,5,10}, b=0–10; kedua urutan/both orders | 5×7 | 35 |
| DIV | — Tidak aktif / Inactive | — | — |
| MIX | a×b+c atau/or a+b−c; a∈{2,5,10},b=0–10 untuk/for ×; c=0–20; hasil/result 0–120 | 5×6+4 | 34 |

Target awal per kompetensi aktif: maksimal 8 paket × 20 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G02-L04 — Lanjutan / Advanced

**Fokus / Focus:** Pembagian sebagai kebalikan perkalian / Division as inverse multiplication.  
**Kandidat strategi / Strategy candidates:** INV, HL, PV, CO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=10–199; a+b≤300; minimal satu kelipatan/at least one multiple of 10 | 120+70 | 190 |
| SUB | 0≤b≤a≤300; minimal satu kelipatan/at least one multiple of 10 | 210−80 | 130 |
| MUL | a∈{2,5,10}, b=0–12 | 10×12 | 120 |
| DIV | b∈{2,5,10}, q=0–12; a=b×q | 60÷5 | 12 |
| MIX | a÷b+c atau/or a×b−c; gunakan fakta di atas/use facts above; c=0–20; hasil antara/intermediates≥0 | 40÷5+7 | 15 |

Target awal per kompetensi aktif: maksimal 8 paket × 20 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G02-L05 — Penguasaan / Mastery

**Fokus / Focus:** Kelancaran dasar sampai ratusan / Core fluency to hundreds.  
**Kandidat strategi / Strategy candidates:** PV, CO, BR, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=10–299; a+b≤500; satu operand mudah/one friendly operand (kelipatan/multiple 10 atau/or ±1) | 199+42 | 241 |
| SUB | 0≤b≤a≤500; b kelipatan/multiple 10 atau/or ±1 dari/from 10n | 205−99 | 106 |
| MUL | a∈{2,3,4,5,10}, b=0–10 | 4×8 | 32 |
| DIV | b∈{2,3,4,5,10}, q=0–10; a=b×q | 36÷4 | 9 |
| MIX | dua operasi berbeda/two distinct operations; +−×÷ sesuai aturan di atas/as above; hasil antara/intermediates 0–500 | 4×9−7 | 29 |

Target awal per kompetensi aktif: maksimal 8 paket × 20 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

### Kelas 03 / Grade 03

#### G03-L01 — Fondasi / Foundation

**Fokus / Focus:** Fakta perkalian dan pembagian / Multiplication and division facts.  
**Kandidat strategi / Strategy candidates:** INV, DB, HL, PV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=0–999; satu kelipatan/one multiple of 100; a+b≤1000 | 300+245 | 545 |
| SUB | 0≤b≤a≤1000; b kelipatan/multiple 100 | 860−300 | 560 |
| MUL | a,b=0–10 | 7×8 | 56 |
| DIV | b=1–10,q=0–10; a=b×q | 72÷9 | 8 |
| MIX | a×b+c atau/or a÷b−c; fakta/facts 0–10; c=0–20; hasil antara/intermediates≥0 | 7×8+9 | 65 |

Target awal per kompetensi aktif: maksimal 12 paket × 25 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G03-L02 — Pengembangan / Developing

**Fokus / Focus:** Pemecahan nilai tempat / Place-value decomposition.  
**Kandidat strategi / Strategy candidates:** PV, DE, DS, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=10–999; a+b≤1500; satu operand memiliki nol pada satuan/one ends in 0 | 360+275 | 635 |
| SUB | 0≤b≤a≤1500; b berakhir nol/ends in 0 | 815−260 | 555 |
| MUL | a=11–39,b=2–9; a×b≤300 | 24×4 | 96 |
| DIV | b=2–9,q=11–39; a=b×q | 96÷4 | 24 |
| MIX | a×b±c atau/or a÷b±c; ×÷ seperti di atas/as above; c=1–40; hasil/intermediates≥0 | 18×4−9 | 63 |

Target awal per kompetensi aktif: maksimal 12 paket × 25 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G03-L03 — Menengah / Intermediate

**Fokus / Focus:** Kelipatan sepuluh dan kompensasi / Multiples of ten and compensation.  
**Kandidat strategi / Strategy candidates:** PV, CO, BR, PO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=10–999; a+b≤2000; satu operand berakhir/one ends in 8,9,1,2 | 398+47 | 445 |
| SUB | 0≤b≤a≤2000; b berakhir/ends in 8,9,1,2 | 703−198 | 505 |
| MUL | a=10–90 kelipatan/multiple 10, b=2–12 | 70×8 | 560 |
| DIV | b=2–10,q=10–90 kelipatan/multiple 10; a=b×q | 420÷6 | 70 |
| MIX | dua operasi/two operations; satu kompensasi/one compensation atau/or faktor/factor 10; hasil 0–2000 | 60×7−99 | 321 |

Target awal per kompetensi aktif: maksimal 12 paket × 25 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G03-L04 — Lanjutan / Advanced

**Fokus / Focus:** Perkalian dua digit dengan satu digit / Two-digit by one-digit multiplication.  
**Kandidat strategi / Strategy candidates:** DS, DE, DB, HL.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=100–999; a+b≤1800; carry diperbolehkan/allowed | 487+356 | 843 |
| SUB | 0≤b≤a≤1800; borrow diperbolehkan/allowed | 902−487 | 415 |
| MUL | a=12–99,b=2–9; pilih struktur mental/friendly structure: a dekat/near 10n atau/or b∈{2,4,5,8,9} | 98×6 | 588 |
| DIV | b=2–9,q=12–99; q dekat/near 10n atau/or b∈{2,4,5,8,9}; a=b×q | 392÷4 | 98 |
| MIX | (a+b)×c atau/or a×b−c; faktor kecil/small factor 2–9; hasil antara/intermediates 0–1800 | (18+2)×7 | 140 |

Target awal per kompetensi aktif: maksimal 12 paket × 25 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G03-L05 — Penguasaan / Mastery

**Fokus / Focus:** Integrasi operasi sampai ribuan / Integrated arithmetic to thousands.  
**Kandidat strategi / Strategy candidates:** CO, DS, INV, PV, OO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=100–1999; a+b≤3000; minimal satu dekat/near 100n ±1–5 | 995+368 | 1363 |
| SUB | 0≤b≤a≤3000; b dekat/near 100n ±1–5 | 1203−998 | 205 |
| MUL | a=10–99,b=2–12; a dekat/near 10n atau/or b∈{5,10,11,12} | 35×12 | 420 |
| DIV | b=2–12,q=10–99; a=b×q; gunakan struktur kali seperti di atas/use above multiplication structure | 840÷12 | 70 |
| MIX | 2–3 operasi/operations; minimal dua jenis/two types; hasil antara/intermediates 0–3000; ÷ tepat/exact | 120÷6+8×5 | 60 |

Target awal per kompetensi aktif: maksimal 12 paket × 25 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

### Kelas 04 / Grade 04

#### G04-L01 — Fondasi / Foundation

**Fokus / Focus:** Bilangan ribuan dan nilai tempat / Thousands and place value.  
**Kandidat strategi / Strategy candidates:** PV, CO, PO, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=100–9999; a+b≤15000; satu kelipatan/one multiple of 100 atau/or 1000 | 4300+2750 | 7050 |
| SUB | 0≤b≤a≤15000; b kelipatan/multiple 100 atau/or 1000 | 8300−2700 | 5600 |
| MUL | a=10–999,b∈{10,100}; hasil/result≤100000 | 240×100 | 24000 |
| DIV | b∈{10,100},q=1–999; a=b×q | 4800÷100 | 48 |
| MIX | dua operasi/two operations; satu faktor/factor 10 atau/or 100; hasil antara/intermediates 0–100000 | 120×10−300 | 900 |

Target awal per kompetensi aktif: maksimal 12 paket × 25 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G04-L02 — Pengembangan / Developing

**Fokus / Focus:** Faktor 11, 12, 15, dan 20 / Factors 11, 12, 15 and 20.  
**Kandidat strategi / Strategy candidates:** DS, DE, DB, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=100–9999; a+b≤15000; satu dekat/near 100n ±1–10 | 3995+427 | 4422 |
| SUB | 0≤b≤a≤15000; b dekat/near 100n ±1–10 | 7203−2998 | 4205 |
| MUL | a=10–99,b∈{11,12,15,20} | 24×15 | 360 |
| DIV | b∈{11,12,15,20},q=10–99; a=b×q | 144÷12 | 12 |
| MIX | dua operasi/two operations; satu ×÷ dengan faktor di atas/with above factors; hasil 0–15000 | 24×15+40 | 400 |

Target awal per kompetensi aktif: maksimal 12 paket × 25 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G04-L03 — Menengah / Intermediate

**Fokus / Focus:** Faktor 25 dan 50 / Factors 25 and 50.  
**Kandidat strategi / Strategy candidates:** HD, PO, CO, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=100–9999; a+b≤20000; akhiran/endings 25,50,75 atau/or 00 pada satu operand/one operand | 4750+1285 | 6035 |
| SUB | 0≤b≤a≤20000; b berakhir/ends in 25,50,75,00 | 6125−2750 | 3375 |
| MUL | a=4–400,b∈{25,50}; a kelipatan/multiple 2 atau/or 4 | 48×25 | 1200 |
| DIV | b∈{25,50},q=2–400; a=b×q; q kelipatan/multiple 2 atau/or 4 | 2400÷25 | 96 |
| MIX | dua operasi/two operations; satu ×÷ faktor/factor 25 atau/or 50; hasil 0–20000 | 36×25−125 | 775 |

Target awal per kompetensi aktif: maksimal 12 paket × 25 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G04-L04 — Lanjutan / Advanced

**Fokus / Focus:** Faktor 9, 19 dan 99 / Factors 9, 19 and 99.  
**Kandidat strategi / Strategy candidates:** CO, DS, BR, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=100–9999; a+b≤20000; b dekat/near 1000n ±1–20 | 4920+1999 | 6919 |
| SUB | 0≤b≤a≤20000; b dekat/near 1000n ±1–20 | 12005−4998 | 7007 |
| MUL | a=10–99,b∈{9,19,99} | 47×99 | 4653 |
| DIV | b∈{9,19,99},q=10–99; a=b×q | 1881÷19 | 99 |
| MIX | 2–3 operasi/operations; satu ×÷ faktor di atas/above factors; hasil antara/intermediates 0–20000 | 19×32+32 | 640 |

Target awal per kompetensi aktif: maksimal 12 paket × 25 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G04-L05 — Penguasaan / Mastery

**Fokus / Focus:** Integrasi faktor ramah mental / Friendly-factor integration.  
**Kandidat strategi / Strategy candidates:** HD, DS, CO, OO, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=100–20000; a+b≤30000; satu operand mudah/one friendly operand (10n atau/or ±1–10 dari/from 100n) | 12750+3998 | 16748 |
| SUB | 0≤b≤a≤30000; b mudah/friendly (10n atau/or ±1–10 dari/from 100n) | 20600−7995 | 12605 |
| MUL | a=10–250,b∈{12,15,20,24,25,50,99,100,125}; hasil≤30000 | 125×24 | 3000 |
| DIV | b∈{12,15,20,24,25,50,99,100,125},q=10–250; a=b×q; a≤30000 | 3600÷25 | 144 |
| MIX | 2–3 operasi/operations; tanda kurung/parentheses; ÷ tepat/exact; hasil antara/intermediates 0–30000 | (48×25)÷12+20 | 120 |

Target awal per kompetensi aktif: maksimal 12 paket × 25 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

### Kelas 05 / Grade 05

#### G05-L01 — Fondasi / Foundation

**Fokus / Focus:** Desimal satu tempat / One-place decimals.  
**Kandidat strategi / Strategy candidates:** PV, DE, BR, PO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=0–99.9, maksimum/max 1 decimal place; a+b≤150 | 12.5+7.8 | 203/10 = 20.3 |
| SUB | 0≤b≤a≤150, max 1 decimal place | 18.2−7.6 | 53/5 = 10.6 |
| MUL | a=0–99.9 max 1 dp,b∈{2,5,10,100}; hasil≤10000 | 4.8×10 | 48 |
| DIV | b∈{2,5,10,100}; q=0–99.9 max 1 dp; a=b×q | 48÷10 | 24/5 = 4.8 |
| MIX | dua operasi/two operations; max 1 dp pada operand dasar/base operands; ×÷ seperti di atas/as above; exact | 4.8×10−3.5 | 89/2 = 44.5 |

Target awal per kompetensi aktif: maksimal 16 paket × 30 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G05-L02 — Pengembangan / Developing

**Fokus / Focus:** Desimal dua tempat / Two-place decimals.  
**Kandidat strategi / Strategy candidates:** PV, CO, BR, PO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=0–99.99 max 2 dp; a+b≤150; minimal satu/at least one akhiran/ending .25,.50,.75,.99 | 12.75+8.99 | 1087/50 = 21.74 |
| SUB | 0≤b≤a≤150 max 2 dp; b berakhiran/ends in .25,.50,.75,.99 | 25.50−9.75 | 63/4 = 15.75 |
| MUL | a=0–49.99 max 2 dp,b∈{2,4,5,10,100} | 12.25×4 | 49 |
| DIV | b∈{2,4,5,10,100},q=0–49.99 max 2 dp; a=b×q | 25.5÷2 | 51/4 = 12.75 |
| MIX | dua operasi/two operations; max 2 dp; satu ×÷ sesuai aturan di atas/as above | 12.5×4+0.75 | 203/4 = 50.75 |

Target awal per kompetensi aktif: maksimal 16 paket × 30 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G05-L03 — Menengah / Intermediate

**Fokus / Focus:** Pecahan berpenyebut sama / Like-denominator fractions.  
**Kandidat strategi / Strategy candidates:** NB, INV, FR, DE.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a=m/d,b=n/d; d∈{2,3,4,5,6,8,10,12}; 0≤m,n≤d; m+n≤2d | 3⁄8+2⁄8 | 5/8 = 0.625 |
| SUB | a=m/d,b=n/d; d seperti di atas/as above; 0≤n≤m≤2d | 7⁄10−3⁄10 | 2/5 = 0.4 |
| MUL | a=m/d; d seperti di atas/as above; 1≤m≤d; b=2–10 bilangan bulat/integer | 3⁄4×8 | 6 |
| DIV | a=m/d; d seperti di atas/as above; 1≤m≤2d; b=2–5 bilangan bulat/integer; hasil exact rational | 3⁄4÷3 | 1/4 = 0.25 |
| MIX | dua operasi/two operations; pecahan penyebut sama/like denominator dan faktor integer/and integer factor; hasil≥0 | (1⁄8+3⁄8)×4 | 2 |

Target awal per kompetensi aktif: maksimal 16 paket × 30 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G05-L04 — Lanjutan / Advanced

**Fokus / Focus:** Pecahan ekuivalen sederhana / Simple equivalent fractions.  
**Kandidat strategi / Strategy candidates:** FR, EQ, INV, HD.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a=m/d,b=n/e; d,e∈{2,3,4,5,6,8,10,12}; salah satu penyebut kelipatan/one denominator multiple of other; 0≤m≤d,0≤n≤e | 1⁄2+3⁄8 | 7/8 = 0.875 |
| SUB | d,e seperti di atas/as above; a≥b≥0 | 5⁄6−1⁄3 | 1/2 = 0.5 |
| MUL | a=m/d; 1≤m≤d≤12; b=2–60 kelipatan/multiple d | 3⁄8×24 | 9 |
| DIV | a=bilangan bulat/integer 1–60; b=m/d; 1≤m≤d≤12; a kelipatan/multiple m | 12÷3⁄4 | 16 |
| MIX | dua operasi/two operations; pecahan ekuivalen/equivalent fractions; hasil antara/intermediates denominator≤120 | (1⁄2+1⁄4)×12 | 9 |

Target awal per kompetensi aktif: maksimal 16 paket × 30 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G05-L05 — Penguasaan / Mastery

**Fokus / Focus:** Integrasi pecahan dan desimal ramah / Friendly fraction and decimal integration.  
**Kandidat strategi / Strategy candidates:** EQ, FR, HD, CO, OO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b nonnegatif/nonnegative ≤100; satu pecahan/one fraction penyebut/denominator 2,4,5,8,10; lainnya desimal/other decimal max 3 dp; hasil≤200 | 12.5+3⁄4 | 53/4 = 13.25 |
| SUB | 0≤b≤a≤100; satu pecahan/one fraction penyebut/denominator 2,4,5,8,10; lainnya desimal/other decimal max 3 dp | 10.25−3⁄4 | 19/2 = 9.5 |
| MUL | a∈{0.25,0.5,0.75,1.25,2.5,12.5,25,125}, b=2–160; b kelipatan/multiple 2,4,8 atau/or 10 | 125×16 | 2000 |
| DIV | b∈{0.25,0.5,0.75,1.25,2.5,12.5,25,125},q=2–160 integer; a=b×q | 125÷12.5 | 10 |
| MIX | 2–3 operasi/operations; konversi ekuivalen/equivalent conversion; denominators max 1000; hasil 0–10000 | (2.5+1⁄2)×8 | 24 |

Target awal per kompetensi aktif: maksimal 16 paket × 30 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

### Kelas 06 / Grade 06

#### G06-L01 — Fondasi / Foundation

**Fokus / Focus:** Pecahan beda penyebut / Unlike-denominator fractions.  
**Kandidat strategi / Strategy candidates:** FR, EQ, DE.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a=m/d,b=n/e; d,e∈{2,3,4,5,6,8,10,12}; lcm(d,e)≤60; 0≤m≤2d,0≤n≤2e | 2⁄3+3⁄4 | 17/12 |
| SUB | aturan seperti ADD/as ADD; a≥b | 5⁄6−1⁄4 | 7/12 |
| MUL | a=m/d,b=n/e; 1≤m≤2d,1≤n≤2e; d,e∈{2,3,4,5,6,8,10,12}; cross-cancel atau/or denominator hasil≤60 | 3⁄4×2⁄3 | 1/2 = 0.5 |
| DIV | a,b seperti MUL/as MUL; b>0; denominator hasil≤60 | 3⁄4÷1⁄2 | 3/2 = 1.5 |
| MIX | dua operasi/two operations; denominator hasil antara/intermediates≤60 | (1⁄3+1⁄6)÷1⁄2 | 1 |

Target awal per kompetensi aktif: maksimal 16 paket × 30 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G06-L02 — Pengembangan / Developing

**Fokus / Focus:** Desimal perkalian dan pembagian / Decimal multiplication and division.  
**Kandidat strategi / Strategy candidates:** PV, PO, EQ, HD.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=0–999.999, max 3 dp; satu operand mudah/one friendly operand (.125,.25,.5,.75,.875 atau/or dekat/near integer); hasil≤1000 | 12.375+0.125 | 25/2 = 12.5 |
| SUB | 0≤b≤a≤1000 max 3 dp; b mudah/friendly seperti ADD/as ADD | 50−0.875 | 393/8 = 49.125 |
| MUL | a=0–100 max 2 dp,b∈{0.1,0.2,0.25,0.5,2.5,5,10,100} | 2.5×48 | 120 |
| DIV | b∈{0.1,0.2,0.25,0.5,2.5,5,10,100},q=0–100 max 2 dp; a=b×q | 7.5÷0.25 | 30 |
| MIX | dua operasi/two operations; ×÷ seperti di atas/as above; hasil antara/intermediates max 4 dp | 2.5×48÷10 | 12 |

Target awal per kompetensi aktif: maksimal 16 paket × 30 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G06-L03 — Menengah / Intermediate

**Fokus / Focus:** Penskalaan pecahan dan desimal / Scaling fractions and decimals.  
**Kandidat strategi / Strategy candidates:** EQ, FR, HD, PO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=0–100; a pecahan/fraction denominator 2,4,5,8,10,20,25; b decimal max 3 dp | 1⁄8+2.375 | 5/2 = 2.5 |
| SUB | aturan seperti ADD/as ADD; a,b boleh bertukar/order may swap; a≥b | 7.5−3⁄8 | 57/8 = 7.125 |
| MUL | a=m/d, d∈{2,4,5,8,10,20,25}, 1≤m≤2d; b kelipatan/multiple d, 1–400 | 7⁄8×64 | 56 |
| DIV | b=m/d seperti MUL/as MUL; q=1–200 integer; a=b×q; a max 3 dp | 3.75÷3⁄4 | 5 |
| MIX | 2–3 operasi/operations; campuran desimal dan pecahan/mixed fractions and decimals; hasil antara/intermediates denominator≤1000 | (1.25+3⁄4)×16 | 32 |

Target awal per kompetensi aktif: maksimal 16 paket × 30 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G06-L04 — Lanjutan / Advanced

**Fokus / Focus:** Kompensasi dan faktor bertingkat / Compensation and layered factors.  
**Kandidat strategi / Strategy candidates:** CO, HD, DS, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b=0–10000; max 2 dp; satu dekat/near 10n atau/or 100n dengan/by 0.01–1 | 999.75+48.5 | 4193/4 = 1048.25 |
| SUB | 0≤b≤a≤10000 max 2 dp; b dekat/near 10n atau/or 100n dengan/by 0.01–1 | 1000−399.75 | 2401/4 = 600.25 |
| MUL | a=10–400,b∈{12,15,24,25,32,48,50,75,125}; minimal satu faktor mudah/one friendly factor pair | 125×32 | 4000 |
| DIV | b∈{12,15,24,25,32,48,50,75,125},q=10–400; a=b×q; struktur sesuai MUL/as MUL | 3600÷48 | 75 |
| MIX | 2–3 operasi/operations; kompensasi atau faktor bertingkat/compensation or layered factors; ÷ exact | (125×32)÷16+0.5 | 501/2 = 250.5 |

Target awal per kompetensi aktif: maksimal 16 paket × 30 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G06-L05 — Penguasaan / Mastery

**Fokus / Focus:** Penguasaan aritmetika nonnegatif / Nonnegative arithmetic mastery.  
**Kandidat strategi / Strategy candidates:** FR, EQ, CO, HD, OO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b nonnegative ≤1000; integer, decimal max 3 dp, fraction denominator≤24; lcm≤1000 | 125.75+3⁄4 | 253/2 = 126.5 |
| SUB | a≥b≥0; aturan seperti ADD/as ADD | 500.125−5⁄8 | 999/2 = 499.5 |
| MUL | a,b nonnegative ≤500; minimal satu faktor ramah/one friendly factor (25,125,0.125,0.25,0.5 atau/or simple fraction); denominator hasil≤1000 | 0.125×240 | 30 |
| DIV | b nonzero friendly factor, q=0–500 rational denominator≤24; a=b×q; denominator a≤1000 | 18÷3⁄8 | 48 |
| MIX | 2–4 operasi/operations; nonnegative intermediates; denominator≤1000; magnitude≤100000 | (3⁄4+0.25)×125−25 | 100 |

Target awal per kompetensi aktif: maksimal 16 paket × 30 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

### Kelas 07 / Grade 07

#### G07-L01 — Fondasi / Foundation

**Fokus / Focus:** Penjumlahan dan pengurangan bilangan bertanda / Signed addition and subtraction.  
**Kandidat strategi / Strategy candidates:** SG, BR, CO, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b integers −50–50; minimal satu negatif/one negative | −37+42 | 5 |
| SUB | a,b integers −50–50; minimal satu negatif/one negative | 12−(−18) | 30 |
| MUL | a,b integers −10–10; minimal satu negatif/one negative | −7×6 | -42 |
| DIV | b integer nonzero −10–10,q integer −10–10; a=b×q; ada operand negatif/negative operand | −56÷8 | -7 |
| MIX | dua operasi/two operations; integer −100–100; tanda kurung/parentheses; ÷ exact | −12+5×3 | 3 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G07-L02 — Pengembangan / Developing

**Fokus / Focus:** Tanda dan nilai tempat / Signs and place value.  
**Kandidat strategi / Strategy candidates:** SG, PV, DE, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b integers −200–200; satu dekat/near 10n ±1–2; one negative | −98+125 | 27 |
| SUB | a,b integers −200–200; satu dekat/near 10n ±1–2; one negative | −103−(−99) | -4 |
| MUL | a=−99–99 integer,b∈{−10,−5,−2,2,5,10}; at least one negative | −48×5 | -240 |
| DIV | b∈{−10,−5,−2,2,5,10},q integer −99–99; a=b×q; at least one negative | 240÷(−5) | -48 |
| MIX | 2–3 operasi/operations; signed integer; hasil antara/intermediates magnitude≤1000 | (−25+5)×(−4) | 80 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G07-L03 — Menengah / Intermediate

**Fokus / Focus:** Kompensasi bilangan bulat bertanda / Signed integer compensation.  
**Kandidat strategi / Strategy candidates:** SG, CO, DS, BR.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b integers −1000–1000; one near 100n ±1–5; one negative | −999+468 | -531 |
| SUB | a,b integers −1000–1000; one near 100n ±1–5; one negative | 305−(−298) | 603 |
| MUL | a integer −99–99,b∈{−99,−19,−9,9,19,99}; one negative | −37×99 | -3663 |
| DIV | b∈{−99,−19,−9,9,19,99},q integer −99–99; a=b×q; one negative | −1881÷19 | -99 |
| MIX | 2–3 operasi/operations; one near-base compensation; signed integer intermediates≤10000 magnitude | −19×12+12 | -216 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G07-L04 — Lanjutan / Advanced

**Fokus / Focus:** Desimal dan pecahan bertanda dasar / Basic signed decimals and fractions.  
**Kandidat strategi / Strategy candidates:** SG, FR, EQ, HD.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b rational magnitude≤50; denominator∈{2,4,5,8,10} atau/or decimal max 2 dp; one negative | −2.5+3⁄4 | -7/4 = -1.75 |
| SUB | same as ADD; one negative | 1.25−(−3⁄4) | 2 |
| MUL | a rational magnitude≤50 denominator≤10, b signed integer magnitude 1–40; denominator hasil≤100; one negative | −3⁄4×12 | -9 |
| DIV | b signed nonzero integer magnitude≤20, q rational magnitude≤20 denominator≤10; a=b×q; one negative | −7.5÷3 | -5/2 = -2.5 |
| MIX | dua operasi/two operations; signed rational; denominator hasil antara≤100; magnitude≤500 | (−1.5+0.5)×(−8) | 8 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G07-L05 — Penguasaan / Mastery

**Fokus / Focus:** Integrasi tanda dan urutan operasi / Signed order-of-operations integration.  
**Kandidat strategi / Strategy candidates:** SG, OO, CO, EQ, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b rational magnitude≤500; max 2 dp atau/or denominator≤12; one negative; lcm≤300 | −125.75+25.5 | -401/4 = -100.25 |
| SUB | same as ADD; one negative | −10.25−(−3⁄4) | -19/2 = -9.5 |
| MUL | a,b signed rational magnitude≤100; one friendly factor; denominator hasil≤300; one negative | −1.25×(−48) | 60 |
| DIV | b signed friendly nonzero factor, q rational magnitude≤100 denominator≤12; a=b×q; one negative | −24÷(−0.75) | 32 |
| MIX | 2–4 operasi/operations; signed rational, denominator hasil antara≤300, magnitude≤10000; parentheses | (−18+6)÷(−3)×5 | 20 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

### Kelas 08 / Grade 08

#### G08-L01 — Fondasi / Foundation

**Fokus / Focus:** Pecahan bertanda dan ekuivalensi / Signed fractions and equivalence.  
**Kandidat strategi / Strategy candidates:** SG, FR, EQ, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a=m/d,b=n/e; signed numerators magnitude≤2d,2e; d,e∈{2,3,4,5,6,8,10,12}; lcm≤60 | −2⁄3+5⁄6 | 1/6 |
| SUB | same as ADD | 3⁄4−(−5⁄6) | 19/12 |
| MUL | a,b signed fractions magnitude≤3; d,e≤12; cancellation or result denominator≤60 | −3⁄8×4⁄9 | -1/6 |
| DIV | a,b signed fractions magnitude≤3; b≠0; reduced result denominator≤60; d,e≤12 | −5⁄6÷2⁄3 | -5/4 = -1.25 |
| MIX | 2–3 operasi/operations; signed fractions, denominator hasil antara≤60 | (−1⁄2+3⁄4)÷1⁄8 | 2 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G08-L02 — Pengembangan / Developing

**Fokus / Focus:** Desimal bertanda dan penskalaan / Signed decimals and scaling.  
**Kandidat strategi / Strategy candidates:** SG, PV, PO, HD.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed decimal magnitude≤100, max 3 dp; one near integer or half | −12.375+4.5 | -63/8 = -7.875 |
| SUB | same as ADD | 0.125−(−2.875) | 3 |
| MUL | a signed decimal magnitude≤100 max 2 dp,b∈{−10,−2.5,−1.25,−0.5,−0.25,0.25,0.5,1.25,2.5,10,100} | −64×1.25 | -80 |
| DIV | b signed friendly decimal nonzero magnitude≤100, q signed decimal max 2 dp magnitude≤100; a=b×q | −12.5÷0.25 | -50 |
| MIX | 2–3 operasi/operations; signed decimals; intermediates max 4 dp; magnitude≤10000 | (−2.5×12)÷0.5 | -60 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G08-L03 — Menengah / Intermediate

**Fokus / Focus:** Pecahan rasional dan faktor silang / Rational cross-cancellation.  
**Kandidat strategi / Strategy candidates:** FR, EQ, HD, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b rational magnitude≤10; denominators≤24; lcm≤120; pilih penyebut terkait/related denominators | 7⁄12+5⁄18 | 31/36 |
| SUB | same as ADD | −7⁄12−5⁄18 | -31/36 |
| MUL | a=m/d,b=n/e signed, \|m\|,\|n\|,d,e≤48; minimal satu cross-cancel/one cross-cancellation; denominator hasil≤120 | 14⁄15×25⁄28 | 5/6 |
| DIV | same as MUL after reciprocal; b≠0; denominator hasil≤120 | 21⁄32÷7⁄16 | 3/2 = 1.5 |
| MIX | 2–3 operasi/operations; one rational cancellation; intermediate denominators≤120 | (3⁄8×16⁄9)+1⁄3 | 1 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G08-L04 — Lanjutan / Advanced

**Fokus / Focus:** Rekombinasi faktor rasional / Rational factor regrouping.  
**Kandidat strategi / Strategy candidates:** HD, DS, EQ, CO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed rational magnitude≤200; one near integer by simple fraction denominator≤16 | 99.875+12.625 | 225/2 = 112.5 |
| SUB | same as ADD | 100.25−99.75 | 1/2 = 0.5 |
| MUL | a signed rational magnitude≤200,b∈{0.125,0.25,0.5,1.25,2.5,12.5,25,125}; signed variant allowed | 12.5×48 | 600 |
| DIV | b signed friendly factor as MUL, q signed integer magnitude≤800; a=b×q | 75÷0.125 | 600 |
| MIX | 2–4 operasi/operations; regroup friendly factors; intermediates magnitude≤100000; denominator≤1000 | 0.125×64+1.25×16 | 28 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G08-L05 — Penguasaan / Mastery

**Fokus / Focus:** Integrasi rasional bertanda / Signed rational integration.  
**Kandidat strategi / Strategy candidates:** SG, FR, EQ, HD, OO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed rational magnitude≤500; denominators≤40 atau/or decimal max 3 dp; lcm≤1000 | −125.625+5⁄8 | -125 |
| SUB | same as ADD | 12.125−(−7⁄8) | 13 |
| MUL | a,b signed rational magnitude≤200; one friendly factor or cross-cancel; result denominator≤1000 | −2.5×(−3⁄5) | 3/2 = 1.5 |
| DIV | a,b signed rational magnitude≤500; b nonzero friendly factor or reciprocal cancellation; result denominator≤1000 | −7.5÷3⁄8 | -20 |
| MIX | 3–4 operasi/operations; signed rational; denominator hasil antara≤1000; magnitude≤100000 | (−2.5+1⁄2)×(−12)÷0.75 | 32 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

### Kelas 09 / Grade 09

#### G09-L01 — Fondasi / Foundation

**Fokus / Focus:** Kompensasi basis 100 dan 1000 / Compensation around 100 and 1000.  
**Kandidat strategi / Strategy candidates:** CO, BR, PV, DS.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed integers magnitude≤10000; one near 100n or 1000n ±1–10 | 999+4687 | 5686 |
| SUB | same as ADD | 10000−3998 | 6002 |
| MUL | a integer magnitude 10–200,b∈{99,101,999,1001}; signed variant allowed; magnitude≤250000 | 999×37 | 36963 |
| DIV | b∈{99,101,999,1001},q integer magnitude 10–200; signed variant allowed; a=b×q | 36963÷999 | 37 |
| MIX | 2–3 operasi/operations; near-base factor, intermediate magnitude≤250000 | 999×37+37 | 37000 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G09-L02 — Pengembangan / Developing

**Fokus / Focus:** Faktor 16, 32, 64, 125, 250 / Factors 16, 32, 64, 125, 250.  
**Kandidat strategi / Strategy candidates:** HD, DB, HL, PO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b integers magnitude≤100000; one multiple of 125,250,500 or 1000 | 4875+1250 | 6125 |
| SUB | same as ADD | 16250−4875 | 11375 |
| MUL | a integer magnitude 2–500,b∈{16,32,64,125,250}; choose friendly factor pairing | 125×64 | 8000 |
| DIV | b∈{16,32,64,125,250},q integer magnitude 2–500; a=b×q | 8000÷64 | 125 |
| MIX | 2–3 operasi/operations; paired factors; intermediate magnitude≤500000 | 125×64÷16 | 500 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G09-L03 — Menengah / Intermediate

**Fokus / Focus:** Aritmetika pecahan dengan penyebut terkait / Related-denominator arithmetic.  
**Kandidat strategi / Strategy candidates:** FR, EQ, BR, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed fractions magnitude≤20; denominators≤60, lcm≤180; one related pair or complementary | 5⁄24+7⁄36 | 29/72 |
| SUB | same as ADD | 11⁄18−5⁄12 | 7/36 |
| MUL | a,b signed fractions; \|numerators\|,denominators≤120; cross-cancel; reduced denominator≤180 | 35⁄48×72⁄49 | 15/14 |
| DIV | same as MUL after reciprocal; b≠0 | 45⁄56÷15⁄28 | 3/2 = 1.5 |
| MIX | 2–4 operasi/operations; at least one cancellation; intermediate denominators≤180 | (5⁄6−1⁄3)×18÷3 | 3 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G09-L04 — Lanjutan / Advanced

**Fokus / Focus:** Desimal dekat bilangan patokan / Decimals near anchor numbers.  
**Kandidat strategi / Strategy candidates:** CO, EQ, PV, DS.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed decimals magnitude≤1000 max 3 dp; one near 1,10,100,1000 by 0.001–0.25 | 99.875+38.625 | 277/2 = 138.5 |
| SUB | same as ADD | 200−99.875 | 801/8 = 100.125 |
| MUL | a signed decimal magnitude≤200 max 2 dp,b∈{0.99,1.01,9.9,10.1,99.9,100.1}; signed variant allowed | 48×0.99 | 1188/25 = 47.52 |
| DIV | b as MUL,q signed rational magnitude≤200 max 2 dp; a=b×q | 47.52÷0.99 | 48 |
| MIX | 2–4 operasi/operations; one near-anchor decimal; intermediates max 5 dp; magnitude≤100000 | 48×0.99+0.48 | 48 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G09-L05 — Penguasaan / Mastery

**Fokus / Focus:** Integrasi strategi SMP / Middle-school strategy synthesis.  
**Kandidat strategi / Strategy candidates:** SG, CO, HD, FR, OO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed rational magnitude≤10000; denominators≤80 or decimal max 3 dp; lcm≤2000; one friendly anchor | 999.875+1⁄8 | 1000 |
| SUB | same as ADD | −1000.25−(−3⁄4) | -1999/2 = -999.5 |
| MUL | a,b signed rational magnitude≤1000; near-base, cross-cancel or friendly factor; reduced denominator≤2000 | 999×37 | 36963 |
| DIV | b nonzero friendly factor or cancellable rational,q signed rational magnitude≤1000 denominator≤80; a=b×q; denominator≤2000 | 1024÷32 | 32 |
| MIX | 3–4 operasi/operations; signed rational, at least two strategy affordances; intermediates magnitude≤1000000, denominator≤2000 | (999×24+24)÷125 | 192 |

Target awal per kompetensi aktif: maksimal 20 paket × 40 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

### Kelas 10 / Grade 10

#### G10-L01 — Fondasi / Foundation

**Fokus / Focus:** Penskalaan mental bilangan besar / Mental scaling of large numbers.  
**Kandidat strategi / Strategy candidates:** PV, PO, HD, CO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed integers magnitude≤1000000; one multiple of 1000 or near 100000n ±1–20 | 498000+72500 | 570500 |
| SUB | same as ADD | 1000000−399998 | 600002 |
| MUL | a integer magnitude 10–10000,b∈{10,100,1000,25,50,125}; friendly pairing; result magnitude≤10000000 | 3200×125 | 400000 |
| DIV | b∈{10,100,1000,16,25,32,64,125},q integer magnitude≤10000; a=b×q | 1024÷32 | 32 |
| MIX | 2–4 operasi/operations; power-of-ten scaling or friendly factor; intermediates magnitude≤10000000 | 3200×125÷1000+40 | 440 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G10-L02 — Pengembangan / Developing

**Fokus / Focus:** Distributivitas dan faktor dekat basis / Distributivity and near-base factors.  
**Kandidat strategi / Strategy candidates:** DS, CO, BR, DE.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed rational magnitude≤100000; max 2 dp; one near 1000n ±0.01–10 | 9998.75+375.25 | 10374 |
| SUB | same as ADD | 12000−9999.5 | 4001/2 = 2000.5 |
| MUL | a integer magnitude 10–999,b near 10,100,1000 by ±1–5; magnitude≤1000000 | 98×103 | 10094 |
| DIV | b as MUL,q integer magnitude 10–999; a=b×q | 10094÷103 | 98 |
| MIX | 2–4 operasi/operations; one distributive pattern; intermediates magnitude≤1000000 | 98×103−98×3 | 9800 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G10-L03 — Menengah / Intermediate

**Fokus / Focus:** Faktor rasional dan pembatalan / Rational factors and cancellation.  
**Kandidat strategi / Strategy candidates:** FR, EQ, HD, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed fractions magnitude≤100; denominators≤120; lcm≤360; related denominators | 13⁄45+7⁄30 | 47/90 |
| SUB | same as ADD | 17⁄24−5⁄36 | 41/72 |
| MUL | a,b signed fractions; numerators magnitude and denominators≤250; cross-cancel; reduced denominator≤360 | 84⁄125×75⁄28 | 9/5 = 1.8 |
| DIV | same as MUL after reciprocal; b≠0 | 125⁄84÷25⁄21 | 5/4 = 1.25 |
| MIX | 2–4 operasi/operations; denominator hasil antara≤360; at least one cancellation | (7⁄12+5⁄12)×125÷25 | 5 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G10-L04 — Lanjutan / Advanced

**Fokus / Focus:** Skala desimal ekstrem yang ramah / Friendly small and large decimal scales.  
**Kandidat strategi / Strategy candidates:** PO, HD, EQ, CO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed decimals magnitude≤10000 max 4 dp; one complementary decimal or power-of-ten anchor | 0.9999+0.0001 | 1 |
| SUB | same as ADD | 1000−0.0625 | 15999/16 = 999.9375 |
| MUL | a signed decimal magnitude≤1000 max 3 dp,b∈{0.001,0.01,0.1,0.0625,0.125,0.25,1.25,12.5,1000}; signed variant allowed | 0.0625×640 | 40 |
| DIV | b from MUL, q signed rational magnitude≤1000 max 3 dp; a=b×q | 0.48÷0.001 | 480 |
| MIX | 2–4 operasi/operations; intermediates max 8 dp and magnitude≤10000000; scaling | 0.0625×640÷0.01 | 4000 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G10-L05 — Penguasaan / Mastery

**Fokus / Focus:** Integrasi aritmetika efisien / Efficient arithmetic synthesis.  
**Kandidat strategi / Strategy candidates:** CO, DS, EQ, HD, OO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed rational magnitude≤100000; denominator≤120 or max 4 dp; lcm≤10000; one anchor | 9999.875+1⁄8 | 10000 |
| SUB | same as ADD | 10000−999.875 | 72001/8 = 9000.125 |
| MUL | a,b signed rational magnitude≤10000; friendly factor, cancellation or near-base; result denominator≤10000 | 199×125 | 24875 |
| DIV | b nonzero friendly or near-base factor,q signed rational magnitude≤10000; denominator≤120; a=b×q; denominator a≤10000 | 24875÷125 | 199 |
| MIX | 3–5 operasi/operations; ≥2 strategy affordances; intermediates magnitude≤10000000, denominator≤10000 | (199×125+125)÷25 | 1000 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

### Kelas 11 / Grade 11

#### G11-L01 — Fondasi / Foundation

**Fokus / Focus:** Desimal eksak dan pecahan patokan / Exact decimals and anchor fractions.  
**Kandidat strategi / Strategy candidates:** EQ, FR, PO, HD.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed rational magnitude≤1000; denominators∈{2,4,5,8,10,16,20,25,32,40,50,80,100,125}; lcm≤10000 | 0.96875+1⁄32 | 1 |
| SUB | same as ADD | 1.0625−1⁄16 | 1 |
| MUL | a signed integer or decimal magnitude≤10000 max 2 dp,b∈{0.03125,0.0625,0.125,0.375,0.625,1.25,3.125,6.25,12.5,62.5}; friendly pairing | 0.125×768 | 96 |
| DIV | b as MUL,q signed integer magnitude≤10000; a=b×q | 24÷0.03125 | 768 |
| MIX | 2–4 operasi/operations; exact fraction/decimal equivalence; denominator≤100000 | (0.0625+1⁄16)×800 | 100 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G11-L02 — Pengembangan / Developing

**Fokus / Focus:** Kompensasi multi-digit terstruktur / Structured multidigit compensation.  
**Kandidat strategi / Strategy candidates:** CO, DS, BR, PV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed integers magnitude≤1000000; one near 1000n or 10000n ±1–50 | 99999+37568 | 137567 |
| SUB | same as ADD | 100002−49998 | 50004 |
| MUL | a integer magnitude 10–2000,b near 100,1000,10000 by ±1–10; product magnitude≤20000000 | 998×1002 | 999996 |
| DIV | b near-base as MUL,q integer magnitude 10–2000; a=b×q | 999996÷1002 | 998 |
| MIX | 2–4 operasi/operations; at least one near-base factor; intermediates magnitude≤20000000 | 998×1002+4 | 1000000 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G11-L03 — Menengah / Intermediate

**Fokus / Focus:** Faktor bertingkat dan pecahan silang / Layered factors and cross-cancellation.  
**Kandidat strategi / Strategy candidates:** FR, HD, EQ, DS.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed fractions magnitude≤50; denominators≤180; lcm≤720; friendly/common factors | 17⁄60+7⁄45 | 79/180 |
| SUB | same as ADD | 13⁄72−5⁄48 | 11/144 |
| MUL | a,b signed fractions; numerators magnitude and denominators≤500; at least two common-factor reductions available; result denominator≤720 | 144⁄175×245⁄216 | 14/15 |
| DIV | same as MUL after reciprocal; b≠0 | 175⁄144÷245⁄216 | 15/14 |
| MIX | 3–4 operasi/operations; multiple cancellations; denominators≤720 | (144⁄175×245⁄216+1⁄3)×15 | 19 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G11-L04 — Lanjutan / Advanced

**Fokus / Focus:** Rekombinasi multioperasi / Multi-operation regrouping.  
**Kandidat strategi / Strategy candidates:** HD, CO, DS, OO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed rational magnitude≤100000; max 4 dp or denominators≤100; complementary endpoints | 12345.625+0.375 | 12346 |
| SUB | same as ADD | 9876.25−0.25 | 9876 |
| MUL | a,b signed rational magnitude≤10000; friendly pairing or near-base; result denominator≤10000 | 3.125×3200 | 10000 |
| DIV | b nonzero friendly rational, q signed rational magnitude≤10000 max 3 dp; a=b×q | 10000÷3.125 | 3200 |
| MIX | 3–5 operasi/operations; two regroupable products or sums; intermediates magnitude≤20000000, denominator≤10000 | 48×25+52×25−200 | 2300 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G11-L05 — Penguasaan / Mastery

**Fokus / Focus:** Kelancaran rasional lanjut / Advanced rational fluency.  
**Kandidat strategi / Strategy candidates:** SG, EQ, CO, FR, HD, OO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed rational magnitude≤100000; denominators≤250 or max 5 dp; lcm≤100000; one anchor | −9999.96875+(−0.03125) | -10000 |
| SUB | same as ADD | 10000−0.03125 | 319999/32 = 9999.96875 |
| MUL | a,b signed rational magnitude≤10000; at least one strong mental affordance; result denominator≤100000 | 0.03125×6400 | 200 |
| DIV | b nonzero friendly rational, q signed rational magnitude≤10000; denominator≤250; a=b×q; denominator a≤100000 | 312.5÷0.125 | 2500 |
| MIX | 3–5 operasi/operations; signed rational; ≥2 strategy affordances; intermediates magnitude≤20000000, denominator≤100000 | (0.125×768−16)÷0.625 | 128 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

### Kelas 12 / Grade 12

#### G12-L01 — Fondasi / Foundation

**Fokus / Focus:** Basis besar dan pasangan komplemen / Large anchors and complementary pairs.  
**Kandidat strategi / Strategy candidates:** CO, BR, PV, DS.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed integers magnitude≤10000000; one near 100000n ±1–100 or exact complementary pair | 999999+375001 | 1375000 |
| SUB | same as ADD | 1000000−999875 | 125 |
| MUL | a integer magnitude 10–5000,b near 1000,10000 by ±1–20; result magnitude≤50000000 | 9998×25 | 249950 |
| DIV | b near-base as MUL or friendly factor 25,125,250; q integer magnitude 10–5000; a=b×q; magnitude≤50000000 | 249950÷9998 | 25 |
| MIX | 2–4 operasi/operations; near-base compensation or complementary terms; magnitude≤50000000 | 9998×25+50 | 250000 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G12-L02 — Pengembangan / Developing

**Fokus / Focus:** Penskalaan lintas representasi / Cross-representation scaling.  
**Kandidat strategi / Strategy candidates:** EQ, PO, HD, FR.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed rational magnitude≤100000; denominators∈{2,4,5,8,10,16,20,25,32,40,50,64,100,125,250}; lcm≤100000; or decimal max 5 dp | 0.984375+1⁄64 | 1 |
| SUB | same as ADD | 1.015625−1⁄64 | 1 |
| MUL | a signed integer or decimal magnitude≤100000 max 2 dp,b∈{0.015625,0.03125,0.0625,0.125,0.375,1.25,3.125,12.5,125,250}; friendly pairing | 0.015625×6400 | 100 |
| DIV | b as MUL, q signed integer magnitude≤100000; a=b×q; friendly pairing | 156.25÷0.03125 | 5000 |
| MIX | 3–4 operasi/operations; at least one conversion and one scaling; intermediate denominators≤1000000; magnitude≤50000000 | (1⁄64+0.015625)×3200÷10 | 10 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G12-L03 — Menengah / Intermediate

**Fokus / Focus:** Rasional eksak dan pembatalan majemuk / Exact rationals and compound cancellation.  
**Kandidat strategi / Strategy candidates:** FR, EQ, HD, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed fractions magnitude≤100; denominators≤360; lcm≤1440; related denominators | 19⁄120+7⁄180 | 71/360 |
| SUB | same as ADD | 29⁄144−5⁄96 | 43/288 |
| MUL | a,b signed fractions; numerators magnitude and denominators≤1000; ≥2 common-factor reductions; result denominator≤1440 | 288⁄385×539⁄432 | 14/15 |
| DIV | same as MUL after reciprocal; b≠0 | 385⁄288÷539⁄432 | 15/14 |
| MIX | 3–5 operasi/operations; multiple cancellations; intermediate denominators≤1440; magnitude≤100000 | (7⁄12+5⁄18)×36÷31 | 1 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G12-L04 — Lanjutan / Advanced

**Fokus / Focus:** Efisiensi komputasi dengan beberapa strategi / Multi-strategy computational efficiency.  
**Kandidat strategi / Strategy candidates:** CO, DS, HD, EQ, OO.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed rational magnitude≤1000000; max 5 dp or denominators≤250; complementary/near-base pair; lcm≤100000 | 99999.96875+0.03125 | 100000 |
| SUB | same as ADD | 100000.125−99999.875 | 1/4 = 0.25 |
| MUL | a,b signed rational magnitude≤100000; two mental affordances, e.g. near-base and friendly factor; result denominator≤100000; magnitude≤50000000 | 9998×125 | 1249750 |
| DIV | b nonzero near-base or friendly factor, q signed rational magnitude≤100000; denominator≤250; a=b×q; magnitude a≤50000000; denominator a≤100000 | 1249750÷125 | 9998 |
| MIX | 4–5 operasi/operations; at least two regrouping/compensation opportunities; intermediates magnitude≤50000000; denominator≤100000 | (9998×125+250)÷25−100 | 49900 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

#### G12-L05 — Penguasaan / Mastery

**Fokus / Focus:** Penguasaan kumulatif KALIBATAKU / Cumulative KALIBATAKU mastery.  
**Kandidat strategi / Strategy candidates:** NB, PV, SG, CO, DS, HD, FR, EQ, OO, INV.

| Kompetensi | Spesifikasi pembentukan soal / Item constraints | Contoh / Example | Kunci eksak / Answer |
|---|---|---|---|
| ADD | a,b signed rational magnitude≤10000000; denominator≤360 or decimal max 6 dp; lcm≤1000000; friendly structure; result magnitude≤50000000 | 999999.984375+1⁄64 | 1000000 |
| SUB | same as ADD | 1000000.125−999999.875 | 1/4 = 0.25 |
| MUL | a,b signed rational magnitude≤100000; near-base, friendly factor or cross-cancellation; reduced denominator≤1000000; magnitude≤50000000 | 9998×125 | 1249750 |
| DIV | b nonzero friendly or cancellable factor,q signed rational magnitude≤100000; denominator≤360; a=b×q; magnitude≤50000000, denominator≤1000000 | 0.125÷1⁄64 | 8 |
| MIX | 3–6 operasi/operations; at least two distinct operations and ≥2 mental affordances; intermediates magnitude≤50000000, denominator≤1000000 | ((9998×25+50)÷125−1000)×0.125 | 125 |

Target awal per kompetensi aktif: maksimal 20 paket × 50 soal per paket, tunduk pada kelayakan pool dan pemeriksaan pedagogis.

## 5. Skala bank soal dan Question Bank Factory

| Cakupan | Sel aktif | Target paket/sel | Target soal/paket | Batas perencanaan file JS | Batas slot soal |
|---|---:|---:|---:|---:|---:|
| G01–G01 | 11 | 4 | 10 | 44 | 440 |
| G02–G02 | 20 | 8 | 20 | 160 | 3,200 |
| G03–G04 | 50 | 12 | 25 | 600 | 15,000 |
| G05–G06 | 50 | 16 | 30 | 800 | 24,000 |
| G07–G09 | 75 | 20 | 40 | 1,500 | 60,000 |
| G10–G12 | 75 | 20 | 50 | 1,500 | 75,000 |
| **Total** | **281** | — | — | **4,604** | **177,640** |

Dari 300 kombinasi kelas-level-kategori, 281 aktif dan 19 nonaktif. Jika menggunakan konfigurasi seragam 20 paket × 50 soal per sel aktif, batas teoritisnya 5,620 file paket dan 281,000 slot soal. Angka 300.000 dalam brainstorming awal merupakan simulasi seluruh kategori aktif; bukan target wajib. **Slot tidak sama dengan soal unik.** Contoh G01-L01 ADD hanya memiliki 12 pasangan komutatif unik jika 0 diperbolehkan dan jumlah maksimal 5. Karena itu jangan memaksa produksi 50 soal unik dalam satu paket. Hitung pool valid terlebih dahulu; pendekkan paket atau jumlah paket ketika pool kecil; gunakan pengulangan terencana lintas paket dan lintas sesi. Jangan mengubah standar kesulitan hanya demi memenuhi kuota.

### 5.1 Blueprint paket

Paket per kompetensi dapat memiliki tujuan `introduce`, `consolidate`, `transfer`, `review`, atau `assessment`. Distribusi yang direkomendasikan untuk practice: 30% penguatan pola dasar, 50% target level saat ini, 20% variasi setara (pembulatan jumlah dengan tetap menjaga total; sesuaikan pool). Pada assessment, gunakan bentuk paralel yang setara dalam rentang bilangan, tipe operand, jumlah langkah, struktur target dan cakupan kompetensi. Paket practice boleh memberi umpan balik per soal; assessment baru memberi umpan balik setelah submit final. Paket review/pemulihan menggunakan kesalahan sebelumnya dan variasi yang setara.

Paket 10–50 soal adalah target isi file, bukan kewajiban siswa menyelesaikannya sekaligus. Sesi latihan awal: G01 5–10 menit, G02–G06 5–15 menit, G07–G12 10–20 menit; waktu fleksibel tanpa mengurangi nilai. Guru dapat memilih jumlah soal atau menyesuaikan akomodasi. Kecepatan diperkenalkan setelah akurasi stabil, tidak menjadi paksaan bagi anak.

### 5.2 Produksi dan validasi

1. Baca registry, aktifkan hanya kompetensi aktif, tetapkan template parameter per `competency_id` dan versi generator.
2. Enumerasi kandidat/seed deterministik; periksa domain, rentang operand, hasil antara, jenis operasi, struktur mental, tidak ada pembagi nol, serta format bilingual.
3. Hitung kunci dengan aritmetika rasional eksak (BigInt atau implementasi rasional setara), lalu verifikasi dengan evaluator independen. Jangan memakai JavaScript `eval` untuk input atau ekspresi pengguna. Parse AST dengan whitelist operasi. Simpan numerator dan denominator sebagai string dalam JSON; denominator selalu positif, gcd=1.
4. Deteksi duplikasi dengan fingerprint struktural atas AST ternormalisasi. Untuk ADD/MUL, urutkan anak komutatif saat membuat fingerprint; untuk SUB/DIV, jangan ubah urutan. Jangan menyamakan semua ekspresi hanya karena jawabannya sama. Bentuk representasi 0.5 dan 1/2 boleh jadi latihan ekuivalensi yang disengaja, tetapi jangan dihitung dua kali sebagai bukti independen jika struktur nilainya identik. Catat ulang sengaja sebagai spaced repetition.
5. Pilih distribusi subtipe soal; cegah konsentrasi jawaban identik, pola berurutan, dan perubahan tingkat kesulitan yang tak terkontrol. Tinjau strategi per butir, bukan hanya tag global. Tinjau guru per template dan sampel paket; kalibrasi dengan pilot siswa.
6. Ekspor paket ES module, manifest ber-shard per kelas/level, checksum, versi kurikulum, ID paket, versi konten, jumlah soal, dan laporan QA. Jangan menyimpan data siswa di bank soal atau repo publik.
7. Simulasikan paket pada cangkang, uji locale, render matematika, input jawaban, hasil evaluasi, outbox, dan laporan. Paket yang gagal tetap berstatus draft/quarantine, tidak masuk manifest publik.

### 5.3 Kontrak paket JS (contoh satu soal, bukan paket penuh)

```javascript
export default {
  schema_version: '1.0.0',
  curriculum_id: 'kalibataku',
  curriculum_version: '1.0.0-draft.1',
  module_id: 'mental-math',
  package_id: 'MM-G03-L02-MUL-P001',
  content_version: '1.0.0',
  grade: 3, level: 2, operation: 'MUL',
  purpose: 'consolidate',
  title: {id: 'Perkalian — Latihan 1', en: 'Multiplication — Practice 1'},
  questions: [{
    question_id: 'MM-Q-DEMO-0001',
    competency_id: 'arithmetic.multiplication.g03.l02',
    strategy_tags: ['DE', 'DS'],
    expression_ast: {kind: 'binary', operation: 'MUL',
      left: {kind: 'rational', numerator: '24', denominator: '1'},
      right: {kind: 'rational', numerator: '4', denominator: '1'}},
    expression: '24 × 4',
    answer: {numerator: '96', denominator: '1'},
    explanation: {id: '20 × 4 + 4 × 4 = 96', en: '20 × 4 + 4 × 4 = 96'}
  }]
};
```

ID `MM-Q-DEMO-0001` hanya ilustrasi. Pada factory gunakan ID stabil global, konten yang sama memakai question_id yang sama meskipun muncul di paket lain; `content_version` membedakan revisi, `package_id` dan `attempt_id` membedakan konteks. Label subtipe, template_id, seed/generator_version, fingerprint dan question revision dapat ditambahkan. Jika tujuan pedagogis membutuhkan tampilan desimal versus pecahan yang ekuivalen, simpan representasi tampilan terpisah dari nilai AST. Manifest tidak perlu memuat semua soal: metadata saja lalu lazy import satu paket. Jangan menjalankan file JS tidak tepercaya dari upload pengguna.

## 6. Mode pembelajaran dan alur akademik

| Mode | Fungsi | Data untuk LMS |
|---|---|---|
| Practice / Latihan | Bebas waktu, feedback langsung, strategi opsional | Jawaban pertama, percobaan ulang, hint, waktu aktif |
| Speed / Kecepatan | Tantangan opsional dengan durasi yang disesuaikan guru | Jawaban benar, salah, dilewati, waktu dan konfigurasi timer |
| Assessment / Evaluasi | Paket paralel, feedback akhir, tanpa hint | Jawaban, skor final, kondisi pengerjaan dan status verifikasi |
| Adaptive / Adaptif | Memilih kompetensi/level berdasarkan bukti terbaru | Rute rekomendasi, aturan yang digunakan, alasan rekomendasi |
| Mistake Recovery / Pemulihan | Ulang kesalahan dan latihan setara | Soal asal, subtipe salah, hasil pemulihan |

Alur: diagnostik awal per operasi → pilih kompetensi → latihan tanpa tekanan → evaluasi formatif → rekomendasi remediasi/pengayaan → asesmen ulang setara → penguasaan. Siswa boleh melatih kompetensi paralel (misalnya ADD lebih maju daripada DIV), bukan dipaksa naik kelas serempak.

### 6.1 Kebijakan penguasaan awal (usulan, perlu pilot)

- `not_started`: belum ada data. `insufficient_evidence`: ada data tetapi jumlah/jenis bukti tidak cukup. `developing`: bukti memadai tetapi belum mencapai ambang. `mastered_provisional`: ambang tercapai dalam mock/latihan lokal; `mastered_verified`: memenuhi kebijakan penilaian institusi setelah verifikasi server dan peninjauan jika perlu. `review_due`: penguatan terjadwal; tidak menghapus histori penguasaan.
- Per kompetensi aktif: minimal dua sesi assessment selesai, idealnya berselang ≥24 jam, form setara dan tanpa hint. Jumlah bukti unik minimal `min(20, ukuran pool valid kanonik)`, sekurangnya 8; jika pool lebih kecil, gunakan peninjauan guru, bukan label mastery otomatis. Bentuk soal boleh tumpang tindih jika pool kecil; untuk akurasi gabungan, hitung hanya kesempatan pertama setiap fingerprint dalam jendela bukti. Akurasi gabungan ≥90%, skor tiap form ≥80%; batas ini adalah hipotesis desain yang harus diuji dan dapat dikonfigurasi. Sesi yang tidak selesai tidak otomatis menjadi bukti mastery.
- Penguasaan level memerlukan penguasaan seluruh kompetensi aktif pada level, bukan rata-rata yang menutupi kelemahan DIV. Untuk akselerasi gunakan evaluasi diagnostik yang mencakup prasyarat dan persetujuan guru. Jangan menggunakan satu jawaban salah sebagai alasan otomatis menurunkan kelas.
- Jika <70% pada dua form setara, usulkan penguatan kompetensi/prasyarat; 70–<90% tetap latihan target dengan variasi; ≥90% tetapi bukti belum cukup, lanjut evaluasi. Terapkan aturan per mode, jumlah sampel dan jenis soal. Guru dapat override dengan alasan yang tercatat. Tidak ada ranking kecerdasan, diagnosis belajar, atau kewajiban target detik universal.
- Pengukuran retensi: review opsional 7 dan 30 hari setelah penguasaan; hasil dibandingkan pada kompetensi dan tingkat kesulitan yang sama. Jadwal ini merupakan kebijakan pembelajaran usulan, bukan jaminan retensi.

## 7. Academic Intelligence: pengukuran dan monitoring

| Metrik | Definisi | Perlakuan data |
|---|---|---|
| Skor form | benar / jumlah soal yang ditugaskan pada form selesai × 100% | Salah, kosong, skip, atau waktu habis = tidak benar; form ongoing/abandoned dilaporkan terpisah |
| Akurasi jawaban | benar / (benar + salah) × 100% | Hanya jawaban valid, skip terpisah; N=0 = tidak ada data |
| Completion | jumlah butir yang diberi respons atau skip final / jumlah butir ditugaskan | Tampilkan jumlah benar/salah/skip dan belum dilihat terpisah |
| First-attempt accuracy | ketepatan jawaban pertama tanpa hint / butir dengan jawaban pertama valid | Pisahkan retry dan jawaban setelah hint; bukti mastery memakai skor form dan bukti unik sesuai §6.1 |
| Waktu aktif | durasi fokus yang diperkirakan pada setiap soal | Pause/tab tersembunyi/idle diperlakukan sesuai aturan timer, status kualitas dicatat; durasi klien tidak tepercaya untuk high stakes |
| Kelancaran | median (P50) dan P90 durasi jawaban benar pertama yang valid | Sajikan N; usulan minimal 10 observasi per kelompok sebelum klaim tren; tidak menghukum akomodasi |
| Konsistensi | variasi skor pada form paralel sebanding | Tampilkan rentang dan N, pisahkan mode dan kesulitan |
| Mastery | cakupan dan status setiap competency_id | Provisional vs verified, jumlah bukti dan versi kebijakan |
| Perkembangan | selisih skor pada form ekuivalen lintas periode | Poin persentase, bukan persentase relatif; jika bentuk tidak setara, tampilkan data tanpa klaim peningkatan kemampuan |
| Pola kesalahan | error teramati, mis. selisih off-by-one, tanda, hasil faktor 10 | Hanya indikasi, bukan klaim proses berpikir; guru mengonfirmasi |
| Rekomendasi | kompetensi prioritas sesuai data dan aturan | Alasan, bukti, confidence/insufficient evidence, versi aturan |

Mastery bukti unik menghitung fingerprint yang muncul sebagai butir form selesai, dengan hasil benar/salah/skip pada kesempatan pertama. Batas sampel dan ambang harus dilaporkan, bukan disembunyikan. Jika satu kompetensi tidak diuji, tampilkan `Belum dievaluasi / Not assessed`, bukan 0%. Per kategori MIX, analisis dilaporkan terpisah; tag ADD/SUB/MUL/DIV di dalam soal MIX adalah peluang operasi, tidak boleh mengklaim siswa menguasai masing-masing langkah hanya dari jawaban akhir.

Teacher Dashboard: filter siswa, kelas administratif, kelas materi, periode, modul, level, operasi, paket, assignment, mode, bukti dan status sync. Drill-down dari kelas → siswa → kompetensi → sesi → jawaban per soal; bandingkan bentuk setara dan pisahkan nilai simulasi/aktual. Catatan guru dan koreksi memiliki author/time/reason. Admin dapat mengunduh laporan sesuai institusi, bukan seluruh institusi lain. Orang tua opsional hanya data anak terkait.

Parents Meeting: laporan ID / EN / bilingual berisi identitas minimal, periode, kelas materi vs administratif, jumlah sesi/soal, skor/akurasi/completion, perubahan setara, kecepatan dengan kualitas data, penguasaan ADD/SUB/MUL/DIV/MIX, kompetensi belum diuji, kelebihan dan kebutuhan latihan yang berbasis bukti, target berikutnya, catatan guru dan status verifikasi. Jangan menampilkan data siswa lain. Ekspor akhir yang dirancang: PDF individual, XLSX rekap, CSV data tabular, DOCX bila perlu diedit, JSON integrasi, ZIP batch. Pada mock statis, ekspor demo harus berlabel `SIMULASI / NOT AN OFFICIAL RECORD`. Ekspor aktual dari LMS memakai otorisasi dan audit log; untuk CSV/XLSX sanitasi formula dari teks yang berasal dari pengguna.

## 8. Static-first dan integrasi LMS pusat

### 8.1 Tahap saat ini — functional static mock

Cangkang HTML/CSS/JS (deploy melalui HTTPS, bukan keharusan dibuka sebagai file://), locale ID/EN, ES modules, manifest per level, lazy loading, Practice/Speed/Assessment/Adaptive/Mistake Recovery, generator untuk build/QA, validator angka eksak, timer, progres, analisis lokal, mock dashboard dan laporan. IndexedDB menyimpan sesi, antrean outbox, dan dataset demonstrasi; LocalStorage hanya preferensi nonrahasia; Service Worker opsional meng-cache paket yang dipilih dan memiliki versioning. Tidak ada akun nyata, autentikasi produksi, sinkronisasi antarperangkat atau keamanan server semu. Gunakan data sintetis untuk guru/admin/siswa, tidak menyalin data anak sebenarnya ke repo publik. Browser dapat menghapus penyimpanan lokal, sehingga data mock bukan arsip institusi.

### 8.2 Universal Academic Data Contract

Siapkan ID modul, ID kurikulum dan versi, ID kompetensi, versi konten, paket, soal, attempt, assignment, event, urutan event, mode dan locale. Event `attempt.started`, `answer.submitted`, `question.skipped`, `attempt.completed`, `attempt.abandoned` menggunakan envelope yang konsisten lintas modul. Server nantinya menghitung skor ulang; client_score hanya provisional. Contoh kontrak (nilai simulasi):

```json
{
  "schema_version": "1.0.0",
  "event_id": "EVT-DEMO-001",
  "event_type": "answer.submitted",
  "event_sequence": 2,
  "attempt_id": "ATT-DEMO-001",
  "module_id": "mental-math",
  "curriculum_id": "kalibataku",
  "curriculum_version": "1.0.0-draft.1",
  "student_id": "STU-DEMO-001",
  "assignment_id": null,
  "material_grade": 3,
  "level": 2,
  "package_id": "MM-G03-L02-MUL-P001",
  "content_version": "1.0.0",
  "question_id": "MM-Q-DEMO-0001",
  "question_type": "numeric_essay",
  "competency_id": "arithmetic.multiplication.g03.l02",
  "strategy_tags": ["DE", "DS"],
  "mode": "assessment",
  "locale": "id",
  "answer": {"numerator": "96", "denominator": "1"},
  "client_is_correct": true,
  "active_duration_ms": 4200,
  "timing_quality": "client_estimated",
  "attempt_number": 1,
  "hint_used": false,
  "occurred_at_client": "2026-11-25T12:00:00Z",
  "data_origin": "mock",
  "verification_status": "unverified"
}
```

`student_id`, institution dan role di production diturunkan/divalidasi dari sesi server; jangan percaya data klaim browser. Timestamp server terpisah. Skema universal memakai `answer` terstruktur sesuai question_type dan dapat diperluas untuk MCQ/essay lain. `classroom_id` dan enrollment administratif diambil dari identitas server, bukan menggantikan material_grade. ID demo tidak boleh diakui sebagai data produksi. JSON ini adalah contoh kontrak, bukan JSON Schema/OpenAPI executable yang sudah diuji.

### 8.3 Server Bridge dan sinkronisasi

Alur: Event Collector → Serializer → IndexedDB Outbox → Adapter → ACK → status → analisis/dashboard. Implementasikan `MockAdapter` dan `RemoteApiAdapter` yang menggunakan interface yang sama. Mock ACK diberi status `mock_accepted`, berbeda dari ACK produksi. Status: `saved_local`, `pending_sync`, `sending`, `mock_accepted`, `server_accepted`, `rejected`, `retry_required`. Simpan event sampai ACK tepercaya diterima; retry dengan backoff/jitter, idempotency per `event_id`, urutan attempt, resolusi konflik eksplisit. Batch harus mengembalikan ACK per event; gagal sebagian tidak menghilangkan event lain. Offline hanya untuk paket cached; evaluasi resmi offline tunduk kebijakan server. Pengiriman ulang tidak boleh menggandakan skor. Retry saat aplikasi aktif; tidak mengandalkan background sync selalu tersedia.

API masa depan (bukan server berjalan): `GET /api/v1/me`, `GET /api/v1/assignments`, `POST /api/v1/attempts`, `POST /api/v1/events/batch`, `POST /api/v1/attempts/complete`, `GET /api/v1/students`, `GET /api/v1/students/{id}/progress`, `GET /api/v1/students/{id}/analytics`, `GET /api/v1/classes/{id}/analytics`, `POST /api/v1/reports`, `GET /api/v1/reports/{id}/download`. Future server contract harus memiliki auth, role/institution scope, response schema, retry semantics, validation error dan version compatibility. Jangan membuat endpoint demo seolah endpoint produksi.

### 8.4 Tahap LMS ketika seluruh Bank Soal diintegrasikan

Central Academic Server mengelola identity/organization/enrollment, role guru dan admin, assignment, module/competency/version registry, attempts/answers/events, hasil verified, mastery/analytics, report, notes/audit logs dan backup. Gunakan ID siswa tunggal lintas modul; riwayat tetap ada ketika naik kelas. Bank soal JS tetap modular di frontend. Untuk penilaian resmi, server menentukan item yang sah dari registry tepercaya, generator deterministik yang dikendalikan server, atau metadata jawaban verifikasi terpisah; jangan percaya jawaban benar yang dikirim klien. Jika kunci publik di JS, verifikasi hitung hanya membuktikan kebenaran hasil, bukan siswa mengerjakan tanpa bantuan atau tanpa melihat kunci. High-stakes memerlukan form terpisah yang tidak mengekspor kunci ke klien, penugasan server, pengawasan yang proporsional dan kebijakan offline. Jangan mengiklankan anti-cheat 100%.

Gunakan TLS, server-side RBAC dengan batas institusi dan kelas, data minimization, perlindungan data anak, kebijakan retensi/penghapusan, enkripsi sesuai kebutuhan, audit perubahan nilai/ekspor, backup/restore serta mekanisme koreksi data. Mock harus terisolasi dari production, termasuk credential dan origin. Migrasi dataset mock dilarang sebagai catatan akademik resmi; data nyata baru dikirim lewat alur autentikasi yang sah ketika LMS aktif.

## 9. Rekomendasi struktur folder proyek

```text
mental-math/
  app/                    # student, practice, assessment, result, mock teacher/admin
  engines/                # loader, validator, difficulty, adaptive, timing, scoring,
                          # progress, analytics, randomization, offline
  languages/              # id.js, en.js
  curriculum/             # registry JSON dan spesifikasi ini
  question-bank/          # manifest.js → grade-XX/level-XX/operation/package-NNN.js
  question-bank-factory/  # template, generator, exact solver, independent verifier, QA
  academic-contract/      # schema, competency/event registry, versioning
  server-bridge/          # adapters/mock & remote, outbox, sync, collector, auth interface
  report-engine/          # bilingual reports dan demo exports
  integration-contract/   # OpenAPI, DB proposal, integration guide (perlu dibuat)
  tests/                  # math, locale, content, UI, data, integration, security
```

Cangkang tidak memiliki asumsi khusus untuk Laravel/Cloudflare Workers. Implementasi production LMS terpisah, bukan bagian dari rilis statis. Question Bank Factory dijalankan saat build/tooling; opsional dynamic practice generation tidak menggantikan paket assessment yang berversi.

## 10. Acceptance gates pengembangan berikutnya

| Gate | Kriteria |
|---|---|
| Curriculum | 60 level dan 300 slot tervalidasi; 281 aktif sesuai usulan; semua ID unik, bilingual labels dan prereq valid; guru menyetujui progresi |
| Content | Semua template terimplementasi; seluruh butir memenuhi domain dan rules, kunci dihitung ulang independen, pool/duplikasi terukur; review pedagogis dan pilot |
| Interface | Numeric essay tanpa pilihan ganda; semua mode, keyboard/mobile/a11y, locale, error state dan paket nonaktif diuji |
| Performance | Manifest hanya metadata/shard; paket lazy-loaded; profil runtime pada perangkat sasaran, cache dan versi konsisten |
| Analytics | Fixture mencakup kosong, salah, benar, skip, retry, hint, timeout, form tidak selesai, perubahan level, mode campuran; metrik dan status tepat |
| Local data | Reload/resume, offline cached, tab collision, storage quota, loss warning; data simulasi terlabel |
| Bridge | Mock ACK, retry, partial batch, idempotency, out-of-order, 401/403, rejected payload; tidak mengaku tersinkron ketika belum ACK |
| Report | Data contoh konsisten; PDF/CSV/XLSX/DOCX/JSON/ZIP hanya dinyatakan selesai jika benar-benar diimplementasi dan diuji; demo watermark |
| Future LMS | Integration contract implementable; production auth, authorization, data isolation, trusted scoring, reporting dan backup baru dinyatakan siap setelah real-server end-to-end |

**Status dokumen ini:** rancangan kurikulum dan registry, bukan website, generator, LMS, paket soal massal atau audit production-ready. Contoh soal dihitung secara eksak dan dicek tipe operasi, status kategori, serta domain dasar kelas; spesifikasi range/template masih perlu diimplementasikan dan diuji secara menyeluruh. Tingkat kesulitan dan ambang mastery membutuhkan validasi empiris oleh guru. File JSON pendamping mencakup 60 level, ID 300 slot, spesifikasi editorial, contoh AST dan kunci 281 sel aktif, kandidat prasyarat, tag strategi dan metadata integrasi.
