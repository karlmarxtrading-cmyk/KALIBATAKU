# Spesifikasi bank soal dan Question Bank Factory

Tanggal: 25 November 2026. Ini kontrak produksi konten untuk pelaksana PRD; **file paket latihan massal belum diproduksi dalam paket arahan ini**. Sumber matematis lengkap disertakan di `00_SUMBER/`, registry dengan koreksi contoh di `curriculum/`, dan rencana setiap paket di `planning/package_plan.json`.

## 1. Makna bank “super lengkap”

Bank wajib mencakup **60 level dan 281 kompetensi aktif**, dengan **19 slot tetap nonaktif**. Semua kompetensi aktif harus dapat dilatih dan dinilai menggunakan isi yang benar-benar ada. Menu lengkap dengan isi contoh satu soal per kompetensi belum memenuhi syarat. Seluruh aturan kurikulum, kategori operasi, representasi angka, jumlah langkah dan strategi yang diwajibkan harus tercermin dalam template serta paket.

Baseline kapasitas:

| Kelas | Sel aktif | Paket per sel | Soal per paket | Rencana paket | Rencana slot |
|---|---:|---:|---:|---:|---:|
| 1 | 11 | 4 | 10 | 44 | 440 |
| 2 | 20 | 8 | 20 | 160 | 3.200 |
| 3–4 | 50 | 12 | 25 | 600 | 15.000 |
| 5–6 | 50 | 16 | 30 | 800 | 24.000 |
| 7–9 | 75 | 20 | 40 | 1.500 | 60.000 |
| 10–12 | 75 | 20 | 50 | 1.500 | 75.000 |
| **Total** | **281** | — | — | **4.604** | **177.640** |

Rencana mengikuti ceiling sumber. Jumlah aktual harus dilaporkan setelah kelayakan pool, pembagian purpose dan validasi selesai. Target bukan alasan membuat soal di luar kurikulum atau menyalin satu paket berulang kali. Penurunan terhadap target hanya dibolehkan jika ada bukti batas domain matematis atau blueprint pendidikan yang tidak memungkinkan, disertai `deviation_id`, hitungan pool, dampak dan alternatif yang tetap meliputi kompetensi. Keterbatasan waktu pengerjaan atau token model bukan alasan akademik.

Empat angka terpisah wajib dilaporkan: `question_slots` (penempatan dalam paket), `unique_canonical_items` (struktur/nilai unik), `representation_variants` (tampilan berbeda yang bernilai sama), dan `intentional_repeated_slots` (pengulangan terencana). Jangan menjumlahkannya sebagai satu jumlah “soal unik”. Satu butir yang digunakan tiga kali tetap satu butir kanonik dan tiga slot.

## 2. Hierarki identitas

| Entitas | Contoh | Makna |
|---|---|---|
| Modul | `mental-math` | Produk pembelajaran dalam ekosistem Bank Soal |
| Kurikulum | `kalibataku` + versi | Cakupan serta standar konten |
| Kompetensi | `arithmetic.multiplication.g03.l02` | Kemampuan target dengan ID stabil |
| Template | `MM-TPL-G03-L02-MUL-DECOMP-01` + versi | Resep parameter dan predikat struktur |
| Butir | ID stabil berbasis konten/registry | Ekspresi/nilai dan konteks representasi yang diidentifikasi |
| Revisi butir | `question_revision` | Perubahan kunci, tampilan atau pembahasan yang dapat dilacak |
| Paket | `MM-G03-L02-MUL-P001` + `content_version` | Kumpulan butir dan tujuan latihan |
| Form evaluasi | `form_family_id`, `form_id` | Blueprint setara dan bentuk konkretnya |
| Sesi | `attempt_id` | Pengerjaan satu profil terhadap snapshot form |
| Event | `event_id` | Peristiwa immutable yang dapat dikirim ulang |

ID kanonik bukan nama siswa, bukan nomor array yang berubah saat sort, dan bukan teks locale. Untuk revisi semantik besar, tetapkan relasi `supersedes`/`equivalence_group`, jangan menyatakan bentuk lama dan baru sama tanpa alasan. Hash berbeda karena whitespace file tidak otomatis berarti kompetensi berubah; fingerprint nilai dan hash file memiliki tujuan berbeda.

## 3. Resep per kompetensi

Setiap baris aktif di `planning/competency_plan.json` harus diubah menjadi satu atau beberapa template executable. Properti minimum resep:

1. Identitas dan versi; sumber `competency_id`; rule sumber yang dirujuk; daftar issue/keputusan yang menafsirkannya.
2. Domain bilangan setiap operand: integer/decimal/fraction, tanda, nol, min/max inklusif, daftar nilai atau grid rasional yang finite.
3. Bentuk AST yang diperbolehkan; jumlah operator; himpunan jenis operator; syarat tanda kurung; aturan komutativitas dan representasi.
4. Predikat struktur: dekat patokan tertentu, offset, carry/borrow, pasangan faktor, pembatalan silang, hubungan penyebut atau komplemen menuju target yang dinyatakan.
5. Batas setiap hasil antara, numerator/denominator tereduksi, digit desimal hasil eksak, serta jawaban akhir.
6. Tag strategi dan bukti predikatnya; difficulty features (jumlah langkah, rentang, carry, tanda, representasi), bukan hanya satu angka kesulitan tanpa penjelasan.
7. Prasyarat wajib, review yang disarankan dan jalur diagnostik; referensi lintas operasi yang benar.
8. Template hint dan pembahasan ID/EN; parameter matematika yang disisipkan harus diuji.
9. Algoritma enumerasi/sampling deterministik, seed namespace, batas percobaan, deduplication, fallback finite dan statistik penolakan.
10. Positive, boundary dan negative fixtures untuk setiap predikat. Negative fixture harus ditolak karena aturan yang tepat, bukan kebetulan karena ID atau bahasa.

`same as ADD`, `as MUL`, `friendly`, `near`, `two affordances` tidak boleh dibiarkan sebagai string yang ditafsirkan LLM pada runtime. Expand inheritance menjadi daftar constraints aktual. Simpan `rule_spec` asli untuk traceability, bukan sebagai executable validator. `complementary` harus berarti target jelas (contoh menuju 100, 1000 atau integer patokan tertentu); hasil kebetulan integer saja tidak cukup untuk dua operand integer.

Tidak menuntut semua domain besar dienumerasi secara penuh. Untuk pool kecil lakukan enumerasi eksak. Untuk domain besar, bangun kandidat finite yang memenuhi resep dan laporkan jumlah konstruktif yang tersedia sebagai **batas bawah**, bukan ukuran keseluruhan pool yang tidak dihitung. Kegagalan sampler setelah sejumlah percobaan tidak membuktikan pool kecil; lakukan strategi enumerasi terarah sebelum mengurangi target.

## 4. Resep MIX yang tidak ambigu

Pecahan literal adalah satu leaf rational, bukan simpul DIV tambahan. `(1/2+1/4)×8` mempunyai dua operator biner. Ekspresi `a×b×c` tetap kategori MUL; MIX membutuhkan sekurangnya dua jenis operasi yang berbeda. Operator dihitung dari AST, bukan jumlah karakter `/` pada teks.

MIX dibentuk dari katalog shapes yang disetujui: misalnya `ADD(MUL(a,b),c)`, `DIV(ADD(a,b),c)`, `SUB(MUL(a,b),MUL(c,d))`. Setiap shape menetapkan batas leaf dan intermediate serta relasi strategi. Pengurangan/pembagian berurutan harus mengikuti associativity standar dan parenthesization eksplisit. `a/(b/c)` berbeda dari `(a/b)/c`.

Untuk kelas awal, hasil antara tidak boleh negatif atau pecahan hanya karena hasil akhir kembali bulat. `1−3+4` ditolak pada G01–G06 walau hasilnya 2. `3÷2×2` ditolak pada G01–G04 walau hasilnya 3. Pembagian nol di subekspresi ditolak sebelum penilaian hasil akhir.

Kebijakan sumber memperbolehkan subekspresi dari kompetensi saat ini/prasyarat dengan batas MIX tersendiri. Jangan secara otomatis memaksa semua node memenuhi batas paket standalone, tetapi jangan pula mengabaikan cakupan bilangan. Resep G06-L04 yang memakai pembagi 16 sebagai rekombinasi faktor harus mendeklarasikan alasan dan dependensi itu secara khusus. Simpan daftar `embedded_skills` untuk keterlacakan; jawaban akhir MIX tidak memberi lima mastery terpisah.

## 5. Alokasi purpose paket

Distribusi berikut merupakan default pelaksanaan yang menambahkan struktur pada ceiling sumber:

| Paket/sel | Introduce | Consolidate | Transfer | Review | Assessment |
|---:|---:|---:|---:|---:|---:|
| 4 | 1 | 1 | 0 | 0 | 2 |
| 8 | 1 | 2 | 1 | 2 | 2 |
| 12 | 2 | 4 | 2 | 2 | 2 |
| 16 | 2 | 6 | 3 | 3 | 2 |
| 20 | 3 | 7 | 4 | 4 | 2 |

G01 tetap memiliki review dan transfer melalui sesi pendek yang menggunakan variasi dari pool serta penjadwalan; tidak perlu menambah kategori yang tidak aktif. Purpose paket berbeda dari mode sesi: paket consolidate dapat dijalankan Practice atau Speed, sedangkan evaluasi penguasaan memakai paket Assessment/form yang dipin.

Paket practice dapat mengikuti pembagian 30% fondasi, 50% target, 20% variasi setara dari sumber; ini blueprint default yang dirinci per template. Butir prasyarat tetap membawa competency_id aslinya, tidak diberi label target palsu untuk menaikkan statistik cakupan. Sisa pembulatan dibagikan dengan metode largest remainder yang deterministik. Assessment satu kompetensi menggunakan seluruh butir target dan strata yang sama pada dua form. Assessment kumulatif multioperasi adalah form lain dengan blueprint eksplisit, bukan rerata paket yang dipilih sembarang.

Setiap paket mempunyai `actual_question_count`, target, purpose, distribusi template, difficulty profile, collision/repeat counts dan eligibility mode. Jumlah sesi dapat lebih pendek daripada isi paket, tetapi subset assessment harus tetap memiliki blueprint dan identitas yang dapat dibandingkan.

## 6. Pool kecil, pengulangan dan kebocoran antarform

Contoh terhitung dari sumber: G01-L01 ADD 12 bentuk kanonik; G01-L01 SUB 21; G01-L02 ADD 36; G02-L03 MUL 30; G03-L01 MUL 66. Pertukaran operand ADD/MUL dihitung satu struktur untuk bukti independen. Kesamaan jawaban akhir tidak menyatukan dua ekspresi yang berbeda.

Untuk G01-L01 ADD, empat paket berisi 10 butir dapat mengambil dari pool 12; pengulangan lintas paket wajar dan dicatat. Tidak boleh ada pengulangan kanonik dalam satu paket. Jika pool lebih kecil dari panjang paket, panjang efektif `min(target_length, pool_size)`. Jika variasi paket benar-benar terbatas, laporkan jumlah subset/order yang tersedia dan gunakan assessment overlap yang transparan. Jangan membuat 20 salinan identik dengan ID baru lalu menyatakan 20 paket konten baru.

Untuk pool besar, pisahkan form assessment A/B dari paket practice sejauh memungkinkan. Catat irisan fingerprint per form dan exposure sebelumnya. Minimal dua form memakai strata template yang sama, batas angka setara, jumlah langkah sebanding, representasi sama, kebijakan waktu sama. Kesetaraan blueprint adalah **kesetaraan rancangan**, bukan bukti equating psikometrik yang belum diuji siswa.

Pada pool terbatas, kedua form boleh overlap, tetapi laporan unique evidence tidak menggandakan count. Variasi locale, urutan operand komutatif atau representasi 1/2 menjadi 0,5 tidak otomatis menjadi bukti baru. Fingerprint mendefinisikan policy version dan canonical ordering; jangan menerapkan associative flattening tanpa mencatat perubahan kebijakan karena bisa mengubah kesulitan mental.

## 7. Nilai, tampilan dan pembahasan

AST menyimpan nilai rasional exact; leaf menyimpan metadata tampilan: integer, decimal dengan decimal_places, atau fraction literal numerator/denominator. Validator harus membuktikan display value sama dengan canonical value. Ini menjaga soal pecahan berpenyebut sama tetap tampil dengan penyebut yang dimaksud walaupun nilai direduksi.

Teks plain fallback menulis `12 ÷ (3/4)` untuk menghindari ambiguity. UI ID merender 0,125, EN 0.125; jawaban internal 1/8. Ribuan boleh diberi pengelompokan pada statistik/teks, tetapi input jawaban tidak menerima separator ribuan. Nilai benar `1/2`, `2/4`, `0,5` (ID) dan `0.5` (EN) dinilai setara pada kebijakan jawaban eksak. Generator tidak perlu menduplikasi dua bank bahasa.

Pembahasan wajib punya ID/EN. Langkah solusi yang merupakan ekspresi lengkap harus bernilai sama dengan jawaban. Kontrak v1 menetapkan setiap entri `solution_steps` sebagai `equivalent_expression` yang mempertahankan nilai seluruh ekspresi. Perhitungan komponen disertakan dalam narasi atau di dalam AST penuh yang tetap ekuivalen, bukan sebagai entri komponen tersendiri yang tidak didukung schema. Jangan menerapkan tes kesetaraan seluruh ekspresi pada kalimat penjelas yang hanya menjelaskan subhasil; parameter narasi tetap diperiksa terhadap relasi matematisnya. Hint dan solusi tidak menambah operasi di luar cakupan siswa tanpa penjelasan yang sesuai.

## 8. Pipeline produksi

1. Validasi dan bekukan registry efektif, errata, policy fingerprint serta rencana paket.
2. Implementasikan resep per kompetensi dan validator semantik independen dari sampler; ekspansi prasyarat dan MIX shapes disimpan sebagai data.
3. Hitung pool kecil; konstruksi pool besar secara deterministik; klasifikasikan strata; ukur distribusi jawaban, operand dan strategi.
4. Buat butir kanonik, representasi serta hint/solusi bilingual. Jawaban dihitung solver rasional produksi.
5. Periksa **seluruh butir** dengan evaluator independen (misalnya verifier Python Fraction terhadap AST/teks), kemudian validator domain/struktur. Jangan memverifikasi solver menggunakan panggilan fungsi yang sama.
6. Uji fixture negatif dan property/metamorphic checks yang bermakna: invariansi komutatif ADD/MUL, relasi inverse, konsistensi locale/display, boundary dan division by zero. Tes tersebut melengkapi pemeriksaan item; bukan penggantinya.
7. Susun paket sesuai purpose/blueprint, hindari duplikasi internal, catat reuse lintas paket dan irisan form assessment.
8. Ekspor JSON artefak build untuk audit dan file ESM data untuk distribusi. File ESM berisi data, tidak menjalankan side effect atau dependensi jaringan.
9. Buat manifest metadata root → kelas/level → paket; hash SHA-256 tiap file; daftar URL immutable dan asset dependency set untuk offline.
10. Jalankan tes import semua paket, tes player representatif setiap family/boundary, audit bilingual dan snapshot laporan; hasil gate menentukan status rilis.

Generator berhenti dengan error terstruktur jika suatu sel tidak dapat dipenuhi. Output gagal masuk direktori quarantine dan tidak dihitung sebagai tersedia. Proses dapat dilanjutkan deterministik dari seed/index tanpa membuat duplikat atau mengubah paket yang sudah valid.

## 9. Manifest, penyimpanan file dan deploy

Rencana 4.604 file paket masih perlu dihitung bersama aplikasi, shard, worker, font dan dokumentasi publik. Jangan mengekspor satu file per soal jika mengakibatkan limit hosting terlampaui. Format default satu file per paket cukup; jika satu paket melampaui budget gzip UX, kurangi metadata repetitif melalui referensi template atau pecah data internal dengan manifest yang transparan tanpa mengubah jumlah logical package.

Root manifest hanya memuat kelas/level/count/URL metadata, bukan seluruh jawaban. Metadata katalog boleh menampilkan jumlah butir, label bilingual dan kategori. Lazy import memuat paket yang dipilih; jangan membuat eager `import.meta.glob` yang menarik semuanya ke chunk utama. Worker/engine dapat berbagi data template umum yang juga versi immutable.

Hash file menjamin integritas terhadap manifest tepercaya; bukan mekanisme menyembunyikan kunci atau membuktikan keaslian jika file dan manifest sama-sama dimodifikasi oleh pemilik browser. Builder memverifikasi ESM yang dihasilkannya; runtime tidak mengimpor file JS dari upload pengguna.

## 10. Bukti yang wajib dihasilkan bersama website

Semua filename tabel berikut disimpan pada folder canonical `evidence/bank/`.

| Artefak | Isi wajib |
|---|---|
| `bank-coverage.json` | Seluruh 300 slot; active/inactive; template count; paket nyata; jumlah butir; coverage subtipe; status |
| `bank-inventory.json` | package_id/version/path/hash/count/purpose/locale status |
| `bank-uniqueness.json` | Slot, butir kanonik, representasi, reuse, duplicate di dalam paket, overlap assessment |
| `bank-pool-feasibility.json` | Exact finite pool atau constructive lower bound; metode, domain, seed, rejection counts |
| `bank-validation.json` | Seluruh item diperiksa, kesalahan matematika/domain/struktur/teks, versi verifier |
| `bank-deviations.json` | Setiap sel yang berbeda dari target; alasan terukur dan perubahan aktual |
| `template-review.json` | Review matematis, bilingual, pedagogis; reviewer/proses sebenarnya dan bagian belum di-review |
| `build-provenance.json` | Hash sumber, patch, versi tools/generator, seed, timestamp dan environment |

Setiap status PASS merujuk build dan file hash yang sama. Form yang belum dihasilkan tidak boleh mempunyai hash palsu. Jika review guru atau pilot belum terjadi, status tetap `NOT_PERFORMED`; aplikasi boleh memiliki kesiapan teknis yang terpisah, tetapi laporan tidak mengiklankan standar usia tervalidasi atau penguasaan resmi.

## 11. Acceptance konten

Wajib: 281/281 kompetensi memiliki isi nyata; 19 nonaktif tidak diproduksi; seluruh isi patuh domain dan versi; 0 kunci salah; 0 pembagian nol; 0 butir gagal constraint; 0 duplikasi kanonik dalam paket; 0 string bilingual penting hilang; 0 path manifest hilang; angka inventaris cocok file; setiap target tidak tercapai punya bukti kelayakan; seluruh form assessment dapat dijalankan dan hasilnya dilacak. Kriteria kualitas penuh ada di `06_ACCEPTANCE_QA_DAN_RILIS.md`.

Tidak ada klaim “soal tak terbatas”. Generator membentuk variasi dalam domain yang finite atau terbatas oleh kebijakan. Yang dijanjikan adalah cakupan kurikulum lengkap, variasi yang sah dan kemampuan memperluas bank secara terkontrol.
