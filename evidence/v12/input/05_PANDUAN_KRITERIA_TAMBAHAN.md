# Kriteria tambahan: OKE, kunci jawaban, dan matematika

**48 kriteria FM-001–FM-048 untuk build perbaikan berikutnya. Seluruhnya berstatus NOT_RUN.** File CSV merupakan daftar pengujian yang dapat diisi pengembang/penguji. Hasil yang benar-benar diamati harus dicatat bersama hash build, lingkungan, pelaksana, waktu, dan bukti.

## 1. Hubungan dengan 80 kriteria sumber

Kriteria FM melengkapi 80 AC yang sudah ada pada versi 1.1.0. Keduanya mempunyai ID berbeda agar perubahan kebutuhan dapat ditelusuri. Jangan mengganti hasil historis AC atau menganggap hasilnya otomatis berlaku pada renderer dan kebijakan feedback yang baru. Bila satu pengujian mencakup beberapa kriteria, bukti yang sama boleh dirujuk dengan alasan yang jelas; jumlah ID bukan jumlah bug atau jumlah eksperimen independen.

Prioritas P1/P2 pada FM menunjukkan kebutuhan pengujian untuk fitur baru; angka tersebut bukan tingkat keparahan setiap temuan baseline dan tidak berarti terdapat 43 bug P1.

Terdapat 47 kriteria dengan gate WAJIB_STATIC dan satu kriteria FM-048 dengan gate WAJIB_KLAIM_UX_MAKSIMAL. Sebagian merupakan perluasan dari gate yang sudah ada. Kelulusan teknis dan klaim kemudahan yang telah dibuktikan pengguna harus dilaporkan terpisah. LMS live dan kinerja lapangan tetap mengikuti batas cakupan AC-067/070; keduanya tidak menjadi lulus hanya karena typesetter bekerja.

## 2. Kebijakan hasil setelah OKE

Pada Practice, Adaptive, dan Recovery, satu OKE untuk jawaban sah harus menampilkan status, jawaban siswa, kunci benar, serta cara singkat pada soal yang sama. Penyampaian kunci langsung ini menggantikan bagian arahan lama yang mengharuskan kunci dibuka melalui petunjuk terlebih dahulu. Pembahasan yang panjang masih dapat dibuka bertahap. Respons pertama dipertahankan, dan percobaan setelah melihat kunci diberi konteks bantuan yang benar. Bantuan format sebelum OKE—termasuk placeholder, pesan validasi, dan deskripsi aksesibel—memakai contoh netral yang bukan kunci soal aktif maupun nilai ekuivalennya.

Assessment menahan kunci dan correctness sebelum hasil final dikirim, kemudian menyediakan review lengkap. Kebijakan tersebut terlihat sebelum mulai. Aktivitas yang membuka kunci per soal harus diperlakukan sebagai latihan dengan feedback, bukan disamakan dengan evaluasi mandiri. Penahanan UI di situs statis tidak diklaim sebagai keamanan soal server.

Speed menggunakan feedback langsung dengan kebijakan yang dinyatakan: tenggat tetap berjalan ketika feedback dibaca. Tidak ada tambahan waktu atau pause tersembunyi. Setelah tenggat habis, review final tetap menyediakan jawaban dan kunci. Bila kemudian dibuat mode dengan timer yang dijeda untuk membaca, mode itu harus memiliki nama dan versi kebijakan berbeda serta tidak dicampur dengan hasil Speed lama.

## 3. Fixture matematika dan bukti visual

Gunakan `math_typography_fixtures.json`: 32 kasus, terdiri atas enam contoh bank nyata dan 26 fixture sintetis. Pengujian aritmetika fixture telah dicatat secara terpisah dalam `math_fixtures_arithmetic_verification.json`. Nilai yang cocok dengan mesin belum berarti tampilannya telah lulus; semua status render fixture tetap NOT_RUN sampai ada hasil baru.

Kasus penting mencakup bentuk pedagogis 11/12 + 10/12 meskipun nilai canonical operand kanan 5/6, desimal 20.0 dan 1.20 yang mempertahankan nol, bilangan negatif, pembagian/kurung nonasosiatif, rasional exact besar, dan ekspresi bertingkat. Jangan menambahkan klaim bahwa bank berisi pangkat hanya karena ada fixture sintetik atau jenis notation lain yang disiapkan untuk masa depan.

Pemeriksaan struktur dan nilai dapat diotomatisasi; pemeriksaan visual harus memeriksa pecahan, baseline, operator, kurung, dan pemenggalan pada hasil render. Uji enam kasus bank pada seluruh permukaan yang memakai matematika: soal, feedback, petunjuk/metode, review, guru, dan laporan. Uji 32 fixture pada renderer dengan matriks bahasa, tema, dan ukuran yang ditetapkan. Catat kombinasi yang benar-benar dijalankan. Pengujian PDF/DOCX dilakukan pada hasil dokumen, sebab keduanya tidak otomatis menerima perubahan MathJax pada HTML.

Kandidat MathJax 4.1.3 berasal dari telaah sumber primer pada audit matematika; implementasi harus memverifikasi dan mem-pin versi yang benar-benar digunakan. Font, data font, worker/locale yang diperlukan harus ikut dalam cakupan aset lokal dan offline. Rujukan teknis ada pada spesifikasi matematika; tidak cukup memasang satu script lalu menyatakan seluruh penulisan matematika sudah sempurna.

## 4. Sepuluh gate statis sumber yang masih terbuka

Tabel ini menghubungkan kekurangan bukti yang sudah diakui rilis 1.1.0 dengan kriteria tambahan. AC-050 berstatus NOT_RUN, sembilan lainnya BLOCKED pada sumber. Ini bukan bukti seluruh perangkat gagal; ini bukti bahwa penerimaan belum lengkap.

| Gate sumber | Cakupan yang belum selesai | Kriteria terkait |
|---|---|---|
| AC-030 | Keypad dan caret | FM-038–040, FM-044 |
| AC-045 | Laporan aksesibel | FM-036, FM-042, FM-046 |
| AC-050 | Kontras dan status | FM-043 |
| AC-053 | Target sentuh | FM-038–039, FM-044 |
| AC-055 | Android fisik | FM-038 |
| AC-056 | iOS/iPadOS fisik | FM-039 |
| AC-057 | IME sistem | FM-009, FM-040 |
| AC-058 | Ucapan pembaca layar | FM-041–042 |
| AC-059 | Lintas engine browser | FM-034, FM-041–042, FM-045 |
| AC-080 | Keputusan rilis terikat build | FM-047 |

## 5. Daftar kriteria tambahan

Setiap baris CSV memuat langkah, hasil yang diharapkan, bukti wajib, dan kolom hasil aktual yang masih kosong. Gunakan PASS hanya setelah uji pada build yang disebut. Jika sebuah kriteria hanya diuji di DOM tetapi membutuhkan perangkat atau ucapan nyata, catat bagian yang sudah lulus dan sisanya sebagai BLOCKED; jangan menyimpulkan kelulusan keseluruhan.

| ID | Kriteria | Prioritas | Gate |
|---|---|---|---|
| FM-001 | OKE mempunyai arti jelas dan mengikuti keadaan | P1 | Statis |
| FM-002 | Jawaban benar langsung memperlihatkan kunci | P1 | Statis |
| FM-003 | Jawaban salah langsung memperlihatkan kunci tanpa mengubah isian historis | P1 | Statis |
| FM-004 | Isian kosong tidak dinilai dan tidak membuka kunci | P1 | Statis |
| FM-005 | Format invalid dibedakan dari jawaban salah | P1 | Statis |
| FM-006 | Jawaban rasional setara diakui benar | P1 | Statis |
| FM-007 | Pergantian bahasa mempertahankan input dan hasil yang sama | P1 | Statis |
| FM-008 | Hasil tidak hilang karena perpindahan otomatis | P1 | Statis |
| FM-009 | Klik/Enter berulang tidak menggandakan respons | P1 | Statis |
| FM-010 | Soal terakhir menggunakan salinan yang sesuai | P2 | Statis |
| FM-011 | Respons pertama dikunci sebelum kunci diberikan | P1 | Statis |
| FM-012 | Penayangan kunci dibedakan dari petunjuk dan pembahasan | P1 | Statis |
| FM-013 | Percobaan sesudah kunci tidak diberi label kemampuan mandiri | P1 | Statis |
| FM-014 | Evaluasi tetap menahan kunci sebelum kirim akhir | P1 | Statis |
| FM-015 | Evaluasi membuka review lengkap setelah finalisasi sah | P1 | Statis |
| FM-016 | Speed mempunyai kebijakan waktu feedback yang terlihat | P1 | Statis |
| FM-017 | Navigasi dan finalisasi mempertahankan regresi S01 yang sudah diperbaiki | P1 | Statis |
| FM-018 | Gagal simpan tidak memberi janji hasil sudah aman | P1 | Statis |
| FM-019 | Renderer berasal dari AST tepercaya dan model tampilan | P1 | Statis |
| FM-020 | Empat operasi dasar mempunyai bentuk dan jarak yang konsisten | P2 | Statis |
| FM-021 | Pecahan soal mempertahankan bentuk pedagogis aslinya | P1 | Statis |
| FM-022 | Pembagian dan pecahan bertingkat tidak mengubah pengelompokan | P1 | Statis |
| FM-023 | Bilangan negatif terbaca sebagai bilangan atau operasi yang benar | P1 | Statis |
| FM-024 | Desimal mempertahankan skala tampilan dan locale | P1 | Statis |
| FM-025 | Kurung dipilih berdasarkan struktur dan keterbacaan | P2 | Statis |
| FM-026 | Kunci dan hasil besar tetap exact tanpa pembulatan diam-diam | P1 | Statis |
| FM-027 | Kontrak matematika dipakai di seluruh permukaan | P1 | Statis |
| FM-028 | Langkah desimal tidak berubah menjadi pecahan tanpa alasan | P2 | Statis |
| FM-029 | Versi MathJax dan dependensi dipin serta dapat dibangun ulang | P1 | Statis |
| FM-030 | Font, data font, worker dan locale tersedia dari origin aplikasi | P1 | Statis |
| FM-031 | Typesetter dimuat sesuai kebutuhan tanpa menghalangi aksi awal | P2 | Statis |
| FM-032 | Typesetting async diselesaikan sebelum timer belajar siap | P1 | Statis |
| FM-033 | Render usang dibatalkan dan node typesetter dibersihkan | P1 | Statis |
| FM-034 | Kegagalan renderer menghasilkan fallback yang utuh | P1 | Statis |
| FM-035 | Offline dan pembaruan versi mencakup aset matematika | P1 | Statis |
| FM-036 | PDF dan DOCX diuji pada pipeline dokumennya sendiri | P1 | Statis |
| FM-037 | Rumus panjang dan pecahan tidak terpotong pada layar sempit | P1 | Statis |
| FM-038 | Android fisik mempertahankan input, caret dan OKE | P1 | Statis |
| FM-039 | iOS/iPadOS fisik menjaga input dan hasil unduhan | P1 | Statis |
| FM-040 | IME fisik tidak mengirim sebelum composition selesai | P1 | Statis |
| FM-041 | NVDA membaca struktur matematika dan feedback tepat | P1 | Statis |
| FM-042 | VoiceOver dan TalkBack diuji dengan ucapan aktual | P1 | Statis |
| FM-043 | Kontras dan status diuji pada hasil render aktual | P1 | Statis |
| FM-044 | Target sentuh feedback dan matematika nyaman digunakan | P1 | Statis |
| FM-045 | Semua mesin browser yang didukung menjalankan alur yang sama | P1 | Statis |
| FM-046 | Cetak panjang mempertahankan soal, kunci dan label sumber | P1 | Statis |
| FM-047 | Bukti rilis dan acceptance diperbarui untuk kebijakan baru | P1 | Statis |
| FM-048 | Siswa dan keluarga memahami hasil serta cara membacanya | P1 | Klaim UX maksimal |

## 6. Cara menutup pekerjaan

Reproduksi kasus yang relevan pada baseline, ubah implementasi, lalu jalankan ulang kasus pada build kandidat. Simpan respons sebelum/sesudah, keadaan render, dan konteks sumber. Jangan menjadikan perubahan label atau screenshot tunggal sebagai pengganti pengujian penilaian, state, atau aksesibilitas. Bila tes lama seperti S08-gated memuat kebijakan bantuan lama, perbarui expected result berdasarkan kebutuhan terbaru sambil mempertahankan perlindungan respons pertama.

Rangkuman akhir harus menyebut bagian yang selesai, yang gagal, yang belum dijalankan, dan yang menunggu sumber daya eksternal. File ini merupakan spesifikasi penerimaan, bukan sertifikat bahwa versi 1.1.0 atau build yang belum dibuat telah memenuhi seluruh kriteria.
