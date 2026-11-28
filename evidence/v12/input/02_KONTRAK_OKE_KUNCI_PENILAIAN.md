# A2. Kontrak OKE, kunci jawaban dan hasil belajar

## 1. Keputusan yang menggantikan arahan sebelumnya

Permintaan terbaru pemilik produk adalah: setelah selesai mengisi jawaban dan menekan **OKE**, siswa melihat apakah jawabannya benar dan melihat kunci. Karena itu, aturan lama yang menunda kunci sampai beberapa klik bantuan **diganti untuk mode belajar**. Instruksi lama di spec sumber tetap berguna sebagai riwayat, tetapi tidak boleh mengalahkan keputusan baru ini.

Implementasi wajib mengubah perilaku aplikasi, bukan sekadar mengganti tulisan “Periksa jawaban” menjadi “OKE”. Kartu hasil muncul pada soal yang sama setelah satu submission yang sah. Data respons pertama direkam sebelum jawaban benar ditampilkan.

## 2. Isi kartu yang wajib muncul

Contoh jawaban salah untuk `8 × 7`:

| Elemen | Indonesia | English |
|---|---|---|
| Status | Belum tepat | Not quite |
| Respons | Jawabanmu: 54 | Your answer: 54 |
| Kunci | Kunci jawaban: 56 | Correct answer: 56 |
| Cara singkat | 8 × 5 = 40 dan 8 × 2 = 16. Jadi 40 + 16 = 56. | 8 × 5 = 40 and 8 × 2 = 16. So 40 + 16 = 56. |
| Aksi utama | Soal berikutnya | Next question |
| Aksi tambahan | Lihat langkah lengkap | See all steps |

Pada jawaban benar, tetap tampilkan respons dan kunci, tidak hanya warna hijau atau kata “Benar”. Pada pecahan ekuivalen, `21/12` dapat benar terhadap kunci `7/4` jika kebijakan soal menerima nilai ekuivalen. Tampilkan alasan “Nilainya sama”. Contoh perkalian ini adalah contoh copy desain, bukan penambahan paket bank.

Contoh format sebelum OKE memakai angka netral dan tidak menampilkan kunci soal yang sedang aktif atau bentuk ekuivalennya. Misalnya petunjuk pecahan memakai 1/2, bukan 7/4 pada soal yang berkunci 7/4. Cara singkat menggunakan konten terverifikasi yang sesuai tujuan materi. Informasi inti tidak disembunyikan dalam accordion. Langkah lengkap dapat dilipat jika panjang. Saat konten sedang disiapkan, status simpan dan render tetap jujur; jangan menampilkan nilai fiktif sementara menunggu.

## 3. Kebijakan mode yang dapat dipahami

| Mode | Sesudah input sah dan aksi utama | Kapan kunci muncul | Kebijakan hasil |
|---|---|---|---|
| Latihan / Practice | OKE menilai dan menampilkan kartu | Langsung pada soal sama | Respons pertama dibekukan; revisi setelah reveal diberi konteks bantuan. |
| Adaptif / Adaptive | Sama seperti Latihan | Langsung | Pemilihan materi memakai bukti mandiri yang sah; revisi setelah kunci tidak menaikkan estimasi penguasaan mandiri. |
| Pemulihan / Recovery | Sama, dengan arahan singkat yang mendukung | Langsung | Kemajuan setelah bantuan berguna untuk belajar, ditandai terpisah dari pengukuran mandiri. |
| Kecepatan / Speed | OKE menilai, menampilkan kartu dan menunggu tindakan berikutnya | Langsung | Tenggat sesi terus berjalan; tidak ada pause/bonus waktu diam-diam. Jelaskan sebelum mulai dan simpan versi kebijakan. |
| Evaluasi / Assessment | Simpan & lanjut; tidak menampilkan benar/salah | Setelah Kirim hasil akhir | Review dan kunci tersedia setelah final; respons sebelum final tidak dibantu kunci. |

Mode Kecepatan tetap memiliki pengecualian alami ketika waktu habis: finalisasi otomatis menyimpan keadaan sesuai aturan yang dinyatakan. Kartu/hasil tidak lenyap; siswa dapat membaca kunci pada hasil sesi. Bila kelak dibuat mode yang menghentikan jam selama membaca hasil, berikan nama dan versi berbeda serta pisahkan perbandingan skornya. Perubahan pengalaman feedback ini sendiri dicatat dalam versi kebijakan agar hasil kecepatan lama dan baru tidak dianggap langsung setara.

Jika pemilik produk menghendaki kunci seketika untuk sebuah kegiatan yang sebelumnya bernama evaluasi, tawarkan sebagai **latihan dengan umpan balik** dan jelaskan arti nilainya. Aplikasi statis menyertakan kunci dalam berkas klien, sehingga penahanan tampilan kunci bukan mekanisme pengamanan ujian berisiko tinggi.

## 4. Transisi keadaan

| Keadaan | Yang terlihat | Yang terjadi ketika aksi dipilih |
|---|---|---|
| Memuat soal | Indikator dan informasi singkat | Tunggu kesiapan paket/renderer/font yang diperlukan; input lama aman. |
| Mengisi | Ekspresi, input, OKE | Validasi format tanpa mengubah draf mentah. |
| Kosong/belum lengkap | Pesan “Isi jawabanmu terlebih dahulu” atau contoh format | Fokus kembali ke input; belum dihitung salah; kunci tidak dibuka. |
| Mengirim lokal | Tombol sibuk yang tidak dapat menggandakan submission | Commit idempotent, rekam respons dan urutan peristiwa. |
| Hasil terlihat | Status, jawabanmu, kunci, cara singkat | Tombol utama berubah menjadi Soal berikutnya/Tinjau hasil. |
| Revisi sesudah kunci | Input dan label konteks bantuan | Respons tambahan tercatat; respons pertama tidak ditimpa. |
| Simpan gagal | Nilai tetap jelas, status penyimpanan gagal terpisah | Ulangi penyimpanan dengan id yang sama; draf dan hasil tidak dibuang. |
| Waktu habis | Penjelasan akhir dan hasil yang telah tersimpan | Ikuti finalisasi timer; format invalid tidak dikonversi menjadi nilai sah. |
| Evaluasi tersimpan | “Jawaban disimpan” tanpa petunjuk benar/salah | Lanjut atau tinjau; kunci tetap tertahan sebelum final. |

Enter pada input menjalankan OKE hanya ketika composition sudah selesai. Sesudah kartu muncul, Enter tidak boleh langsung mengirim ulang respons atau melompati feedback karena key-repeat/klik ganda. Aksi berikut memerlukan tindakan yang disengaja. Pastikan perilaku konsisten untuk mouse, keyboard, sentuhan dan keypad.

Tombol “Lanjut” yang dapat menyimpan sekaligus langsung berganti soal pada mode belajar disederhanakan menjadi transisi OKE → hasil → berikutnya. “Lewati” tetap jelas sebagai tindakan berbeda dan mencatat status dilewati. Menutup layar/tinjau akhir tetap mempertahankan commit draf sah yang telah diperbaiki pada versi 1.1.0.

## 5. Kontrak data dan pengukuran

Pertahankan data lama dan tambahkan metadata melalui migrasi versi, bukan reset penyimpanan. Nama field berikut adalah kontrak konseptual; padankan dengan schema existing tanpa membuat dua sumber kebenaran:

| Data | Arti dan aturan |
|---|---|
| attempt_id / question_id / event_id | Identitas sesi, soal dan submission; satu tindakan yang diulang tidak menjadi dua respons. |
| raw_response / parsed_value | Teks yang benar-benar dikirim dan nilai rasionalnya; jangan hilangkan bentuk asli. |
| first_response / first_correct | Respons sah pertama, tetap setelah revisi dan pergantian bahasa. |
| final_response / final_correct | Keadaan terakhir untuk pembelajaran; tidak mengganti respons mandiri pertama. |
| answer_key_revealed_at | Waktu kunci benar-benar terlihat atau dapat dibaca; tidak otomatis sama dengan waktu menjawab. |
| reveal_reason / feedback_policy_version | Mengapa kunci dibuka dan aturan feedback yang digunakan. |
| help_before_response / response_after_reveal | Bantuan sebelum respons dan revisi setelah melihat kunci, untuk penafsiran hasil. |
| response_elapsed / session_deadline | Waktu respons dan tenggat sesuai kebijakan mode; waktu membaca tidak diam-diam dihapus. |
| local_saved / sync_status / server_verified | Tiga arti berbeda; ACK penerimaan event belum tentu verifikasi nilai. |

**Urutan penting:** validasi → catat respons pertama/submit dengan idempotensi → tampilkan status/kunci sesuai mode → catat reveal → terima revisi bila ada. Jika penyimpanan gagal, tahan navigasi yang berisiko kehilangan data dan berikan opsi ulangi yang jelas. Jangan menandai respons sebelum kunci sebagai “berbantuan” hanya karena kunci otomatis tampil sesudahnya. Sebaliknya, jangan menyebut revisi sesudah melihat kunci sebagai respons mandiri.

Kasus `999 → 5` pada soal `0 + 5` harus menghasilkan respons pertama salah dan jawaban akhir benar. Ringkasan dapat berkata: “Jawaban pertama: 0 dari 1 benar. Setelah melihat kunci: jawaban diperbaiki.” Guru tetap melihat riwayat yang akurat. Batas penguasaan dan rekomendasi adaptif menggunakan ukuran yang telah didefinisikan, bukan sekadar skor final tertinggi.

## 6. Penyajian matematika dan bahasa

Soal, jawaban siswa yang sah, kunci dan langkah memakai komponen presentasi matematika bersama. Respons mentah invalid ditampilkan sebagai teks aman, tidak diserahkan langsung sebagai TeX/HTML. Contoh `11/12 + 10/12` mempertahankan metadata operand pada soal, sementara kunci boleh `7/4`. Desimal `20,0 + 35,3` dapat dijelaskan sebagai `50 + 5,3` jika memang strategi desimal; perubahan menjadi `53/10` harus disengaja dan diterangkan.

Bahasa Inggris/Indonesia dan tema dapat diganti tanpa membatalkan kartu, menambah event jawaban, mengubah waktu respons pertama atau membocorkan hasil evaluasi. Rumus panjang dipenggal sesuai struktur, bukan di antara digit pembilang/penyebut. Struktur matematika, urutan baca dan feedback diuji dengan teknologi bantu nyata; `aria-live` saja belum merupakan bukti kelulusan.

## 7. Contoh penerimaan yang wajib dibuktikan

1. `0 + 5`, input `5`: satu OKE menampilkan Benar, Jawabanmu 5, Kunci 5; soal belum pindah.
2. Soal sama, input `999`: satu OKE menampilkan Belum tepat, 999, kunci 5; respons pertama salah tersimpan.
3. Sesudah kunci terlihat, revisi menjadi `5`: akhir benar, awal tetap salah, bantuan tercatat.
4. Input kosong, `-`, `1/`, `1/0` atau format tidak didukung: pesan format, tanpa jawaban benar/salah baru atau pembukaan kunci.
5. `11/12 + 10/12`, input `21/12`: benar sesuai kebijakan ekuivalensi; kunci 7/4; operand soal tidak berubah menjadi 5/6.
6. `20,0 + 35,3`, input `55,3`: benar; bahasa Inggris mengubah presentasi menjadi 55.3 dengan riwayat mentah tetap tersimpan.
7. Klik ganda, Enter saat composition dan retry setelah gagal simpan: tidak menggandakan respons atau melompati kartu.
8. Evaluasi belum final: semua jalur bantuan, review, bahasa, URL dan state UI mengikuti penahanan hasil; setelah final kunci tersedia.
9. Soal terakhir: tindakan Tinjau hasil dan kalimat konteks akhir, tanpa janji soal berikutnya.
10. Kecepatan: jam tetap berjalan saat membaca kartu; deadline tidak diperpanjang; hasil setelah batas waktu tetap dapat dibaca.

Gunakan matriks **FM-001–FM-048** untuk bukti formal build berikutnya. Contoh HTML dalam paket hanya memperagakan prinsip pada mode Latihan, dengan Native MathML dan tanpa penyimpanan/server; kelulusan interaksi contoh tidak dipindahkan menjadi PASS aplikasi sumber.
