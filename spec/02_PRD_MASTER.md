# PRD MASTER — KALIBATAKU MENTAL MATH

Versi rancangan: **1.0 · 25 November 2026**. Pemilik produk: **Mursofi**. Bahasa dokumen: Indonesia; bahasa produk: Indonesia dan Inggris. Status: **spesifikasi implementasi**, dengan sumber dan koreksi yang dapat dilacak. Angka target di dokumen ini bukan hasil implementasi yang sudah tersedia.

## 1. Keputusan produk

Bangun aplikasi latihan mental math yang benar-benar dapat digunakan dari hosting statis: siswa memilih materi, mengerjakan jawaban numerik, memperoleh evaluasi, menyimpan perjalanan belajar pada perangkat, mengunduh hasil, dan menggunakan paket yang sudah dipasang saat offline. Semua mesin yang diperlukan untuk alur ini harus bekerja. Dashboard guru dan admin menyediakan simulasi fungsional yang memakai data serta layanan mock yang sama, sehingga perubahan jawaban dapat terlihat pada monitoring. Server Bridge disiapkan dan diuji terhadap kontrak. LMS pusat, autentikasi institusi dan monitoring antarperangkat diaktifkan ketika server nyata tersedia.

Pernyataan keberhasilan rilis wajib membedakan tiga hal: **kelengkapan aplikasi statis**, **kelengkapan bank soal**, dan **kesiapan integrasi LMS**. Tampilan dashboard saja tidak membuktikan monitoring server. Seratus persen cakupan kurikulum tidak berarti setiap slot merupakan soal unik. Kelulusan pengujian teknis tidak sama dengan kalibrasi pedagogis terhadap populasi siswa.

Dokumen ini mengonsolidasikan brief pengguna, kurikulum dan registry di `00_SUMBER/`. Perbaikan terarah tercatat di `08_AUDIT_KURIKULUM_DAN_KEPUTUSAN.md`; gunakan registry pelaksanaan di `curriculum/`, bukan menimpa sumber asli. Instruksi pengguna terbaru mengatasi usulan lama yang bertentangan. Dalam paket ini, kontrak data mengatur bentuk data, dokumen bank mengatur matematika dan isi, PRD mengatur perilaku, UX mengatur penyajian, serta acceptance mengatur bukti rilis. Konflik yang ditemukan kemudian dicatat dan diselesaikan secara eksplisit, tanpa menghapus fitur.

## 2. Masalah, sasaran, dan ukuran keberhasilan

Kebutuhan inti adalah latihan berhitung yang terarah, mudah dioperasikan, dapat diperluas dengan ribuan file soal, serta menghasilkan data akademik yang berguna bagi guru dan orang tua. Cangkang harus menampung perkembangan bank tanpa mengubah logika aplikasi untuk setiap paket. Rancangan tidak bergantung pada pembelian API AI, login, atau server ketika dipakai untuk latihan lokal.

| Sasaran | Ukuran keberhasilan rilis |
|---|---|
| Kurikulum terjangkau | Semua 12 kelas × 5 level tersedia; 281 kompetensi aktif mempunyai paket yang dapat dibuka; 19 slot nonaktif diberi alasan |
| Mudah mulai | Pengguna baru mencapai soal pertama melalui paling banyak tiga keputusan utama: materi, pengaturan ringkas, mulai; pengguna kembali memiliki tombol lanjut |
| Evaluasi dapat dipercaya secara hitung | Seluruh kunci pada bank rilis dihitung ulang oleh evaluator independen; pecahan/desimal dinilai eksak |
| Data dapat ditelusuri | Setiap hasil mengacu ke siswa/profil, sesi, paket, butir, versi, mode, kebijakan penilaian dan asal data |
| Cepat dipakai | Halaman awal tidak mengunduh seluruh bank, dashboard atau pustaka ekspor; memenuhi anggaran UX dan bukti performa |
| Akses luas | Uji matriks ukuran layar, keyboard, sentuh, pembaca layar, kedua bahasa, kedua tema dan browser yang dinyatakan didukung |
| Siap diperluas | Penambahan paket melalui generator dan manifest; API adapter diuji termasuk kegagalan, tanpa mengubah player |
| Pelaporan berguna | Laporan individual dan rekap dapat ditelusuri ke data yang sama; statistik kosong, tidak sebanding, dan simulasi tidak disamarkan |

Persentase cakupan dihitung dari daftar kompetensi aktif pada registry, bukan dari banyaknya kartu katalog. Keberhasilan suatu fitur memerlukan hasil end-to-end dan keadaan gagal yang tertangani. Data simulasi tetap berguna untuk pengujian, namun tidak dihitung sebagai adopsi siswa atau hasil belajar nyata.

## 3. Ruang lingkup rilis

| Komponen | Wajib pada rilis statis penuh | Ketika LMS pusat tersedia |
|---|---|---|
| Kurikulum dan bank | Seluruh cakupan aktif; file JS modular; generator dan QA | Registry tepercaya dan versi konten untuk penugasan |
| Siswa | Profil lokal dengan alias opsional, latihan, hasil, riwayat, backup | Akun terautentikasi, kelas administratif, sinkronisasi |
| Lima mode | Practice, Speed, Assessment, Adaptive, Mistake Recovery bekerja | Kebijakan penugasan dan penilaian institusi |
| Guru | Workspace simulasi kelas, filter, drill-down, penugasan mock, catatan | Otorisasi kelas dan siswa nyata, monitoring terpusat |
| Admin | Simulasi institusi, katalog, ekspor individual dan massal, status integrasi | Pengelolaan akun, otorisasi institusi, laporan akademik resmi |
| Reports | PDF, XLSX, CSV, DOCX, JSON, ZIP; data lokal atau demo jelas | Penerbitan resmi dan audit ekspor server |
| Bridge | Local/mock/remote adapter, outbox, kontrak, tes retry | Endpoint nyata, identitas, verifikasi, ACK server |
| Offline | Paket terpasang, player, progres lokal, backup | Kebijakan penugasan offline dan rekonsiliasi |

Portal akun orang tua, pembayaran/premium, materi selain empat operasi, chat, video, OCR, proctoring dan AI generatif bukan pekerjaan rilis ini. Laporan parents meeting tetap wajib. Integrasi berikutnya tidak boleh menghilangkan riwayat versi statis atau mengubah data demo menjadi hasil resmi. Tidak ada pemaksaan aktivasi server untuk membuka latihan yang dijanjikan sebagai statis.

## 4. Pengguna dan konteks penggunaan

**Siswa SD awal** membutuhkan angka jelas, satu tugas per layar, target ketepatan, input sederhana dan sesi pendek. **Siswa SD lanjut–SMA** membutuhkan keyboard yang efisien, pecahan/desimal/tanda negatif, variasi strategi dan evaluasi yang dapat ditinjau. **Guru** membutuhkan cara melihat bukti per siswa dan memilih latihan lanjutan tanpa membaca ratusan log. **Admin** membutuhkan periode laporan, cakupan kelas dan ekspor yang konsisten. **Orang tua** membutuhkan penjelasan kemajuan serta rencana latihan yang dapat dipahami.

Perangkat sasaran: ponsel portrait/landscape, tablet, laptop, desktop; browser modern yang masuk matriks uji. Ungkapan “semua device” diimplementasikan sebagai tata letak adaptif dan dukungan yang teruji, bukan klaim untuk setiap perangkat atau browser yang pernah ada. Tidak mengunci orientasi, menuntut hover, menonaktifkan zoom, memblokir paste, atau membuat keypad buatan sebagai satu-satunya cara menjawab.

## 5. Model kurikulum dan penempatan

Identitas produk adalah `curriculum_id=kalibataku`, `module_id=mental-math`. Kelas materi G01–G12 mempunyai L01–L05, kategori ADD, SUB, MUL, DIV dan MIX. MIX menggabungkan sekurangnya dua jenis operasi; bukan operasi kelima. Essay berarti jawaban numerik yang diketik, bukan kewajiban menulis uraian.

Kelas 1–4 menggunakan bilangan cacah dan hasil antara bulat nonnegatif; pembagian habis. Kelas 5–6 memperluas desimal dan pecahan eksak nonnegatif. Kelas 7–12 menambahkan bilangan bertanda dan struktur aritmetika rasional yang lebih kompleks. Materi SMA tetap aritmetika; tidak memasukkan persentase sebagai topik baru, eksponen sebagai operator soal, akar, logaritma atau aljabar. Tanda kurung dan tanda negatif merupakan notasi yang didukung.

Kelas administratif dan kelas materi disimpan terpisah. Profil kompetensi per operasi boleh tidak sejajar: ADD G05-L04 tidak memaksa DIV G05-L04. Penempatan awal dapat dipilih guru/siswa atau dibantu diagnostik. Diagnostik memakai form yang sama-sama tervalidasi dengan metadata `purpose=diagnostic`; hasilnya menjadi rekomendasi awal, bukan diagnosis atau label kecerdasan.

`prerequisite_candidates` sumber hanyalah kandidat linear. Implementasi harus membuat peta prasyarat yang memuat dependensi lintas operasi, misalnya pembagian pertama terhadap fakta perkalian terkait; MIX terhadap semua operasi yang digunakan. Peta harus acyclic, merujuk ID aktif, mendukung pengecualian melalui hasil diagnostik, dan dapat ditinjau tanpa mengunci pengguna secara permanen.

## 6. Inventaris persyaratan

Daftar lengkap dengan kode, acceptance ringkas dan bukti terdapat di `planning/requirements.json` dan `planning/MATRIKS_PERSYARATAN.md`. Setiap persyaratan wajib memiliki status implementasi, kasus uji, artefak bukti dan catatan batas. Default status paket ini adalah `specified`, bukan `implemented` atau `passed`.

Kelompok REQ-001–007 mengatur cakupan dan kurikulum; REQ-008–019 mengatur pengalaman dan evaluasi dasar; REQ-020–033 mengatur pembelajaran; REQ-034–043 mengatur bank serta data lokal; REQ-044–054 mengatur guru/admin, laporan dan bridge; REQ-055–068 mengatur kualitas, rilis, operasi dan integrasi.

## 7. Alur utama siswa

### 7.1 Pengguna baru dan pengguna kembali

Pertama kali, bahasa Indonesia menjadi pilihan awal kecuali ada preferensi yang tersimpan; tema mengikuti perangkat sampai pengguna memilih terang/gelap. Beranda langsung menawarkan “Mulai latihan”. Tidak meminta email, tanggal lahir, nomor telepon, sekolah atau akun untuk mencoba. Alias lokal bersifat opsional. Daftar materi menampilkan kelas dan level; rincian tambahan baru terbuka saat diperlukan.

Pengguna kembali melihat satu tindakan utama “Lanjutkan latihan” jika sesi tersimpan masih valid, berikut konteks kelas/level/operasi dan jumlah soal tersisa. Bila paket berubah, sesi melanjutkan revisi yang dipin; jika revisi tidak dapat diperoleh, tampilkan pemulihan dengan pilihan mempertahankan hasil lama atau mulai sesi baru. Jangan mengganti butir di tengah attempt tanpa mencatat sesi baru.

### 7.2 Katalog dan pengaturan sesi

Katalog memuat hanya metadata yang diperlukan. Filter kelas → level → operasi → paket tidak perlu empat halaman penuh: tampilkan satu panel yang berkembang. Paket menampilkan tujuan, jumlah soal, representasi angka, prasyarat ringkas, status offline dan perkiraan durasi sebagai estimasi. Kompetensi belum aktif ditandai dengan alasan pendidikan, bukan tombol gagal.

Pengaturan awal ringkas: mode dan panjang sesi. Pengaturan lanjutan berisi timer, pengacakan, aksesibilitas dan cakupan review. Nilai default ditentukan jenjang; jumlah soal dalam file bukan kewajiban satu sesi. Mengubah jumlah soal assessment membuat `form_instance_id` dan blueprint sesi yang eksplisit; tidak boleh membandingkan form berbeda seolah identik.

### 7.3 Player

Player menyajikan konteks ringkas, urutan soal, ekspresi, input jawaban, serta satu tombol aksi sesuai mode. Tombol utama berubah dari periksa/simpan ke soal berikutnya setelah commit; mencegah klik ganda. Navigasi keluar selama sesi menawarkan simpan dan lanjut nanti atau akhiri; hasil yang sudah dicatat tidak hilang. Sesi tetap dapat diselesaikan dengan keyboard fisik tanpa mouse.

Ekspresi dirender dari AST yang diketahui, tidak dari HTML mentah. Pecahan memakai tata letak yang terbaca beserta label aksesibel; teks panjang memiliki reflow, tanpa memotong tanda minus atau penyebut. Operator untuk layar menggunakan × dan ÷, bukan karakter x yang membingungkan. Nomor soal tidak digeser ketika pesan umpan balik muncul.

### 7.4 Akhir sesi

Ringkasan membedakan benar, salah, dilewati, kosong dan belum ditampilkan; tampilkan skor paket dan akurasi dengan penyebut yang jelas. Pengguna dapat meninjau, berlatih kesalahan, memilih penguatan, melanjutkan materi atau mengunduh hasil. Tidak langsung memindahkan level hanya karena satu sesi selesai. Tautan tinjau menyajikan jawaban pertama, jawaban terakhir jika ada, kunci, strategi contoh, mode dan catatan hint.

## 8. Aturan angka dan penilaian

Gunakan rasional eksak: pembilang dan penyebut berupa integer string, penyebut positif, bentuk tereduksi, nol selalu `0/1`. BigInt dipakai dalam perhitungan, string pada JSON. Seluruh operasi dari AST memakai whitelist ADD/SUB/MUL/DIV. Parser jawaban menerima satu bilangan: integer bertanda, desimal menurut locale, atau pecahan `p/q` dengan penyebut integer positif. Tidak menerima formula `1+2`, notasi ilmiah, infinity, NaN, separator ribuan atau penyebut nol. Batas panjang input dan besaran komponen berlaku sebelum alokasi BigInt yang mahal.

Bahasa Indonesia memakai koma desimal; Inggris titik. Separator dari bahasa lain menghasilkan bantuan format, bukan penalti matematika. `1.250` tidak boleh diam-diam menjadi 1250. Ubah minus Unicode menjadi tanda minus standar untuk parsing; trim spasi luar dan spasi sekitar garis pecahan. Pecahan belum disederhanakan tetap diterima jika nilainya tepat. Negatif nol dinormalisasi menjadi nol. Jawaban desimal yang memotong 1/3 tidak benar untuk soal eksak.

Input kosong atau sintaks tidak valid tidak dihitung sebagai jawaban salah ketika menekan periksa; fokus tetap di input dengan pesan aksesibel. Jika peserta mengakhiri assessment dengan butir kosong, butir itu dihitung belum dijawab pada skor form. Jawaban valid tetapi bernilai salah adalah kesalahan matematika. Semua jalur ini punya fixtures eksplisit di `qa/answer_cases.json`.

Berpindah bahasa saat mengetik mempertahankan nilai dan konteks: draft yang valid dapat dirender ke locale baru; draft belum valid tetap disimpan dengan locale asal sampai diperbaiki. Mengganti tema tidak mengubah nilai, fokus, urutan, durasi atau attempt. Toleransi floating-point tidak digunakan untuk jawaban eksak.

## 9. Lima mode pembelajaran

| Mode | Umpan balik | Timer | Pencatatan dan keputusan |
|---|---|---|---|
| Practice | Benar/salah langsung; hint dan langkah tersedia | Tanpa batas secara default | Jawaban pertama, retry dan penggunaan hint disimpan terpisah; latihan tidak otomatis menjadi mastery |
| Speed | Benar/salah setelah respons, ringkasan saat habis | Durasi dipilih sebelum mulai | Deadline monotonic selama halaman aktif; waktu berlalu tidak berhenti karena tab disembunyikan; durasi/jeda dicatat |
| Assessment | Tidak membocorkan kunci sampai submit final | Tanpa batas secara default; batas opsional tercatat | Form tetap; satu respons final per butir, revisi sebelum submit diperbolehkan dan historinya tercatat; setelah final tidak ditimpa |
| Adaptive | Seperti practice, dengan alasan rekomendasi | Tidak wajib cepat | Pilihan kompetensi/variasi mengikuti bukti; penguasaan tetap lewat assessment terpisah |
| Mistake Recovery | Salah sebelumnya dan butir setara, pembahasan langsung | Tanpa batas | Tautkan ke respons asal; hasil pemulihan tidak menimpa hasil pertama |

**Speed:** timer mulai setelah butir siap dan siswa menekan mulai, bukan saat file masih diunduh. Tab tersembunyi tidak memberi tambahan waktu. Setelah reload, rekonstruksi durasi dengan timestamp tersimpan, tandai kualitas waktu menurun bila tidak bisa dipercaya; untuk tantangan skor kecepatan resmi tidak berlaku di versi lokal. Timer dapat dimatikan pada mode tanpa batas dan tidak menjadi syarat kelulusan kompetensi.

**Assessment:** konfirmasi penyelesaian menampilkan jumlah kosong, tanpa kunci. Perubahan jawaban sebelum submit merupakan revisi tanpa feedback, bukan retry setelah tahu kunci. Jika jawaban valid pernah tersimpan lalu draft terbaru menjadi invalid/incomplete, finalisasi diblokir sampai diperbaiki atau ditandai kosong secara eksplisit; nilai lama tidak dinilai diam-diam. History nilai lama tetap disimpan. Ukuran sampel, tipe bentuk, versi kebijakan dan kondisi hint harus tersimpan. Penilaian akhir dihitung dari snapshot form, bukan dari jumlah klik kirim. Kunci publik dalam file statis berarti ini evaluasi belajar mandiri; penggunaan evaluasi resmi mengikuti server dan kebijakan institusi.

**Adaptive:** usulan default deterministik menggunakan dua sesi penilaian relevan terakhir dan evidence yang cukup. <70% pada dua form setara mengusulkan prasyarat; 70–<90% mempertahankan target dengan pola berbeda; ≥90% mengusulkan assessment atau pengayaan setelah syarat lain diperiksa. Kecepatan memberi konteks, bukan gerbang tunggal. Jangan naik-turun level pada satu jawaban. Simpan versi aturan dan alasan. Jika data belum cukup, sampaikan bahwa rekomendasi masih awal dan lanjutkan target pilihan pengguna.

**Recovery:** antrean memuat kesalahan dengan fingerprint, tanggal dan subtipe. Tawarkan butir asal untuk memahami kesalahan lalu variasi baru yang setara. Menjawab benar butir yang diingat tidak dianggap bukti independen. Jika tidak ada kesalahan, tampilkan keadaan kosong dengan opsi review, bukan daftar contoh siswa lain.

## 10. Strategi, pembahasan dan petunjuk

Setiap butir mempunyai satu atau lebih tag peluang strategi yang benar-benar didukung struktur soal; 16 tag mengikuti registry. Setiap template memiliki alasan matematis yang diuji. Hint pertama memberi arah, bukan jawaban akhir; pembahasan menunjukkan transformasi yang sah dan ringkas, dalam kedua bahasa. Penjelasan tersusun dari template dan parameter tervalidasi, tidak memerlukan API AI saat runtime.

Tidak menulis “siswa memakai strategi kompensasi” hanya dari jawaban numerik. Label yang tepat adalah “pada soal dengan peluang strategi kompensasi”. Pola kesalahan seperti salah tanda, dekat satu unit atau kelipatan sepuluh merupakan indikasi teramati. Jika lebih dari satu penyebab mungkin, tampilkan tanpa diagnosis dan beri ruang catatan guru.

## 11. Penilaian, penguasaan dan retensi

Definisi rinci, fixture angka, pembobotan agregasi dan template laporan ada di `09_METRIK_DAN_LAPORAN.md`. Tidak menghitung rata-rata persentase dua paket berbeda ukuran sebagai akurasi gabungan. Tidak memperlakukan belum diuji sebagai nol. Tidak menyebut perubahan dari 60% ke 80% sebagai kenaikan 20%: gunakan 20 poin persentase.

Mastery awal memakai dua form assessment setara dan selesai, tanpa hint, dengan jarak ≥24 jam sebagai default yang dapat dikonfigurasi, skor setiap form ≥80%, akurasi bukti unik ≥90%, dan jumlah bukti `min(20, pool kanonik terverifikasi)` dengan minimum 8. Jika pool di bawah 8, status memerlukan tinjauan guru. Ini aturan produk awal dari sumber, bukan standar nasional. Kecukupan dan waktu harus terlihat pada laporan; kondisi yang belum terpenuhi tidak disembunyikan oleh badge hijau.

Default operasional: setiap siklus evaluasi (`assessment_cycle_id`) memiliki masa berlaku maksimum 60 hari, versi kebijakan `mastery-local-v1`, sebagai keputusan desain yang bisa dikonfigurasi. Setelah penguatan atau recovery tercatat, pengguna dapat memulai siklus evaluasi ulang secara eksplisit; histori siklus lama dan exposure tetap terlihat, dan siklus baru kembali membutuhkan dua pengerjaan form yang memenuhi syarat (boleh menggunakan A/B yang tersedia dengan instance baru). Ini mencegah kesalahan awal pada pool kecil mengunci penguasaan sampai 60 hari. Kesempatan eligible pertama untuk suatu fingerprint pada form selesai dalam siklus tersebut menjadi bukti: gunakan respons FINAL pada form pertama itu, termasuk revisi sah sebelum feedback. First-response accuracy tetap metrik terpisah. Skip, blank dan assigned-unseen merupakan evidence tidak benar; retry setelah hint tidak menambah sampel. Untuk evaluasi kumulatif, syarat mastery diperiksa pada slice kompetensi target, bukan memakai skor total lintas kompetensi. Status lokal selalu provisional. `review_due` adalah penanda tambahan 7/30 hari, tidak menghapus penguasaan historis. Notifikasi hanya saat membuka aplikasi; tidak mengasumsikan push atau penjadwalan server.

## 12. Profil dan penyimpanan lokal

Default satu profil lokal; profil tambahan dengan alias boleh dibuat untuk perangkat keluarga. Ini pemisahan kenyamanan, bukan kontrol keamanan akun. Beri peringatan singkat yang relevan pada perangkat bersama: orang lain yang memakai browser yang sama dapat mengakses data tersebut. Hapus profil dan data hanya lewat tindakan jelas serta konfirmasi; preferensi tema/bahasa dapat diatur per perangkat.

IndexedDB menyimpan attempt snapshot, respons, event, outbox, agregat yang dapat dihitung ulang dan katalog paket terpasang. Penulisan jawaban, event dan perubahan attempt harus atomik. Jangan menampilkan “tersimpan” sebelum transaksi sukses. Jika quota/storage unavailable, tawarkan mode sementara yang jelas dan unduh hasil; jangan berpura-pura persist. Jika dua tab membuka attempt sama, satu tab memiliki lease menulis atau konflik ditangani; tidak last-write-wins tanpa jejak.

Backup JSON mencantumkan schema, checksum isi, asal data dan versi. Import memvalidasi ukuran, struktur, nama properti, konflik ID dan referensi sebelum mutasi. Pilihan merge dan restore mempunyai pratinjau jumlah; transaksi bisa dibatalkan. Data masuk tidak boleh mengeksekusi JS, HTML atau URL arbitrer. Laporan bukan pengganti backup, dan file bank soal bukan backup data siswa.

## 13. Offline dan perubahan versi

Pengguna memilih paket/level yang ingin tersedia offline dan melihat ukuran serta status pemasangan. Daftar “tersedia offline” hanya muncul setelah seluruh aset wajib untuk set itu berhasil disimpan. Download set besar dapat dibatalkan atau dilanjutkan; batas storage diperiksa. Jangan precache seluruh 177.640 slot atau ribuan paket saat pertama masuk.

Service Worker dan indeks konten mempunyai versi. Sesi aktif memin versi paket dan schema; pembaruan ditawarkan pada batas aman, tanpa refresh paksa yang membuang respons. Paket lama yang masih dipakai sesi atau laporan historis tidak dihapus sebelum migrasi selesai. Cache gagal tidak menghapus progres. Offline kosong, set belum lengkap dan modul ekspor belum pernah dimuat mempunyai pesan dan jalur pulih yang nyata.

## 14. Guru dan admin dalam versi statis

Workspace simulasi terpisah dari profil latihan pribadi. Dataset demo memuat sekurangnya dua kelas, dua guru, profil dengan belum mulai, ongoing, selesai, salah berulang, sampel tidak cukup, perubahan materi dan hasil tidak sebanding. Angka dashboard dihitung dari event/attempt demo yang dapat diperiksa, bukan ditempel pada kartu. Tindakan “Coba sebagai siswa demo” mengerjakan soal sebenarnya pada profil demo lalu memperbarui monitoring melalui mock adapter.

Guru memilih kelas, siswa, periode, modul, kelas materi, level, operasi, paket, mode dan status. Ringkasan kelas mengarah ke siswa, kompetensi, sesi dan jawaban; status belum dikerjakan/berjalan/selesai dibedakan. Penugasan lokal memiliki target, form/kompetensi, tanggal, mode dan kebijakan; deadline demo memakai timezone yang terlihat. Semua penugasan statis hanya tersedia pada data perangkat yang sama.

Admin melihat katalog, kelengkapan kompetensi, rekap kelas, ekspor batch, status bridge dan jejak tindakan demo. Tombol akun, undang guru atau reset password tidak dibuat seolah bekerja sebelum ada autentikasi server. Pengelolaan peran demo merupakan simulator, bukan server-side authorization. API dan data model LMS tetap mendefinisikan hak akses yang harus diuji nanti.

Catatan guru mempunyai penulis, waktu dan revisi. Koreksi hasil atau override penguasaan tidak menghapus jawaban mentah; tampilkan nilai terhitung dan keputusan guru dengan alasan. Pada mode demo, catatan dan override tetap berlabel simulasi.

## 15. Laporan dan ekspor

Pilih data asal, siswa/kelas, periode, bahasa dan format, lalu tampilkan pratinjau sebelum unduh. Pilihan bahasa ID, EN atau bilingual berlaku sampai judul, label metrik, periode, penjelasan, catatan otomatis dan keterangan status. Nama pengguna dan catatan bebas tidak diterjemahkan otomatis. Rekomendasi hanya berdasar kompetensi yang punya evidence; untuk data kurang gunakan kalimat yang menyebut kekurangannya.

Enam format harus dibuat dan diuji: PDF individual, DOCX yang dapat diedit, XLSX rekap terstruktur, CSV interoperabel, JSON data integrasi/backup sesuai tujuan, ZIP ekspor banyak laporan. Print dialog browser boleh disediakan sebagai tambahan, tetapi tidak boleh menjadi satu-satunya jalur jika UI menjanjikan file PDF. Ekspor berat dimuat saat diminta; proses batch memakai antrean, progres, batal dan laporan kegagalan per file. ZIP selesai sebagian tidak dinamai “seluruh laporan berhasil”.

Label laporan: `SIMULASI / DEMONSTRATION DATA` untuk demo; `HASIL LATIHAN LOKAL / LOCAL PRACTICE RESULTS — belum diverifikasi institusi` untuk aktivitas pengguna lokal; label resmi hanya dari kebijakan server terverifikasi. Semua grafik memiliki padanan tabel. Nilai, pembulatan dan total harus sama di layar, PDF, DOCX dan spreadsheet. Sertakan report_id, policy_version, content_version, timestamp, timezone dan filter periode.

## 16. Kontrak akademik dan bridge

Setiap envelope memiliki event_id, attempt_id, sequence, module, versi schema, dataset/provenance dan timestamp klien. Enum data_origin canonical adalah `local_practice`, `demo`, `lms_client`; mock/remote adalah nama adapter, bukan alias origin. `lms_client` tidak berarti hasil terverifikasi; verification_status/receipt grading terpisah. Respons soal menambahkan question_id/revision, competency_id, package_id/version, jawaban canonical, attempt number, penggunaan hint serta kualitas waktu. Payload tidak memuat email atau password. Identitas server nantinya diturunkan dari sesi autentikasi dan tidak dipercaya dari field klien.

Local adapter menyelesaikan kebutuhan perangkat tanpa membuat antrean server yang tidak akan terkirim. Mock adapter memakai outbox demo dan ACK `mock_accepted`. Remote adapter hanya aktif ketika endpoint/configuration sah serta sesi server valid; jika belum dikonfigurasi, tampilkan “LMS belum terhubung”, tanpa request ke endpoint khayalan atau fallback sukses.

Sinkronisasi mengembalikan ACK per event; retry idempotent dengan event_id dan payload hash yang sama. ID sama dengan payload berbeda adalah konflik, bukan duplikat sukses. ACK batch sebagian, request timeout setelah server commit, out-of-order sequence, 401/403/409/422/429/5xx, pemutusan jaringan dan restart aplikasi wajib diuji. `attempt.completed` tidak boleh membuat finalisasi server sebelum sequence yang diperlukan diterima. Status transport terpisah dari status grading/verification; diterima server belum otomatis berarti nilai terverifikasi.

## 17. Keamanan dan integritas yang relevan

Konten statis di browser dapat dibaca pengguna. Blokir inspect atau salin tidak menyembunyikan kunci dan dapat merusak aksesibilitas; bukan kontrol penerimaan rilis. Server masa depan memiliki registry jawaban/aturan tepercaya dan menilai ulang. Hal itu memastikan konsistensi penilaian, tetapi tidak membuktikan siswa tanpa bantuan. Evaluasi berisiko tinggi memerlukan desain distribusi item dan pengawasan tersendiri.

Tidak ada secret di Vite env yang dibundel, hard-coded credential, runtime eval, import JS dari upload tak tepercaya atau HTML mentah dari catatan. Sanitasi teks pada ekspor spreadsheet agar formula injection tidak dieksekusi. Gunakan CSP dan header yang cocok dengan worker/font/ekspor aktual; jangan menyalin header yang memutus fitur. Semua resource produksi inti disajikan sendiri agar offline dan privasi tidak bergantung CDN.

Identitas anak diminimalkan. Analytics perilaku pihak ketiga, iklan, session replay dan pelacakan lintas situs tidak dipasang sebagai default. Catatan privasi menjelaskan data lokal, penghapusan, backup dan asal demo. Retensi server, persetujuan dan administrasi institusi dirinci ketika LMS nyata dibangun; rancangan teknis ini tidak mengklaim sertifikasi hukum tertentu.

## 18. Bilingual, tema dan aksesibilitas

Tidak ada string produk penting yang tersisa hanya dalam satu bahasa: katalog, mode, tombol, pesan kesalahan, loading, empty state, sync, report, email-independent instructions dan penjelasan matematika. Uji kesetaraan makna, bukan sekadar key count. Perubahan locale memperbarui atribut lang, format angka/tanggal, teks aksesibel dan ekspor tanpa menggandakan bank konten.

Tema gelap dan terang memiliki token semantic yang diuji masing-masing; pilihan mengikuti perangkat/terang/gelap tersimpan. Cetak menggunakan tema kertas yang dapat dibaca. Fokus, error, disabled, grafik, pembahasan, skeleton dan form diperiksa dalam kedua tema. Warna bukan satu-satunya pembeda benar/salah atau mastery.

Target aksesibilitas adalah WCAG 2.2 AA untuk alur inti, diperiksa manual dan otomatis; rincian dan sumber ada di dokumen UX. Jika suatu pemeriksaan belum dilakukan, tulis `NOT_RUN`, bukan menyimpulkan kepatuhan dari skor alat. Siswa dapat memperbesar teks, memakai keyboard, memilih tanpa timer dan mengurangi animasi.

## 19. Lazy loading, lazy interaction dan performa

Lazy loading adalah penundaan unduh, parsing dan komputasi sampai benar-benar dibutuhkan. Lazy interaction adalah pengurangan keputusan awal melalui default yang jelas dan pengungkapan bertahap, tanpa menyembunyikan hasil atau kegagalan. Semua fitur tetap diimplementasikan penuh.

Shell memuat navigasi, preferensi, locale aktif dan manifest ringkas. Pemilihan kelas memuat shard katalog; memulai sesi memuat player dan satu paket; membuka analisis memuat modul analitik/chart; memilih ekspor memuat exporter yang relevan. Worker menghitung agregat besar/generasi/ekspor tanpa memblokir ketikan. Prefetch terbatas pada niat pengguna dan tidak mengabaikan penghemat data. Tombol ditekan saat chunk belum ada menampilkan loading yang terukur, bukan klik pertama yang hilang.

Budget angka mengikuti `01_ARAHAN_UI_UX.md` sebagai kontrak performa internal. Core Web Vitals lapangan, hasil lab, ukuran gzip, perangkat uji, CPU/network throttling dan cache state dilaporkan terpisah. Optimasi tidak boleh menunda penyimpanan jawaban atau mengorbankan pemeriksaan matematika.

## 20. Struktur dan keputusan teknis

Default stack: TypeScript + Vite untuk build statis; lapisan tampilan komponen ringan yang memenuhi budget, aritmetika dan analitik berupa fungsi pure, persistence IndexedDB, worker, serta paket ESM hasil build. Pilih dan pin versi dependensi yang benar-benar tersedia ketika implementasi. Framework UI boleh dipilih berdasarkan kelayakan, tetapi jangan mengubah aplikasi menjadi server SSR atau menambah backend untuk fitur lokal.

Bank diletakkan sebagai aset terpisah dengan manifest yang diproduksi generator, bukan ribuan import eager pada entry. Data referensi akademik dan presentasi dipisahkan. Pengaturan base path harus konsisten pada import, worker, SW, font dan katalog, agar hosting root dan subfolder dapat diuji. Source, dist, bank, tests, docs dan evidence memiliki batas yang jelas; instruksi deploy menyebut satu folder publik.

## 21. Kontrol perubahan dan publikasi

Versi schema, kurikulum, aturan generator, paket, butir, kebijakan mastery, template laporan dan aplikasi mempunyai fungsi berbeda. Koreksi kunci memerlukan versi baru dan daftar dampak; hasil historis tidak ditimpa diam-diam. Kode ID stabil mengikuti kompetensi yang sama, bukan nomor urutan file. Kebijakan migrasi harus mampu mempertahankan sesi lama dan menandai laporan yang menggunakan versi lama.

Bank baru melewati pipeline: rules → generator → solver → validator independen → pengecekan bilingual/strategi → paket → manifest → uji player → evidence. Paket gagal dikarantina dan tidak muncul sebagai siap pakai. Menghapus satu kompetensi untuk membuat test hijau merupakan perubahan scope yang tidak diperbolehkan.

## 22. Hasil kerja implementasi yang diwajibkan

Satu ZIP rilis aplikasi nantinya memuat source lengkap beserta lockfile, dist siap deploy, seluruh bank final, factory dan verifier, kontrak bridge, dokumentasi operasi, registry efektif, manifest konten, laporan coverage/deduplication, inventaris dependensi/lisensi, hasil tes dan panduan GitHub → Cloudflare. Tidak menyertakan node_modules, secret, data anak nyata atau cache pribadi.

`RELEASE_STATUS.json` harus mempunyai status terpisah untuk static_application, bank_content, bridge_contract, live_lms, pedagogical_calibration dan live_deployment. Seluruh tes aplikasi statis dapat selesai walau live_lms berstatus `DEFERRED_BY_SCOPE`; status keseluruhan tidak boleh menyiratkan LMS sudah beroperasi. Data belum diuji tidak ditutup dengan istilah “100%” tanpa bukti.

## 23. Definition of Done

Pekerjaan dinyatakan selesai untuk lingkup aplikasi statis ketika semua persyaratan wajib berstatus lulus dengan bukti; seluruh 281 kompetensi aktif memiliki isi nyata sesuai aturan dan rencana kelayakan pool; seluruh bahasa, tema dan alur UI inti berfungsi; tidak ada tombol placeholder; hasil bisa disimpan, dipulihkan, ditinjau dan diekspor; cache serta mock bridge tahan kegagalan yang ditetapkan; build dapat direproduksi; serta dist diuji pada hosting statis. Penetapan label penguasaan akademik resmi tetap menunggu kebijakan dan server institusi.

Paket dokumen ini sendiri selesai jika sumber utuh, keputusan dapat dilacak, kontrak/fixtures dapat divalidasi, angka kapasitas cocok, prompt memuat semua keluaran dan gate, dan ZIP dapat dibuka. Pengujian paket dokumen tidak diklaim sebagai pengujian website yang belum dibuat.
