# Arahan UI/UX KALIBATAKU

**Versi dokumen:** 1.0 · **Tanggal:** 25 November 2026  
**Produk:** Mental Math KALIBATAKU — kelas materi 1–12, lima level, jawaban numerik, Indonesia/English  
**Jenis dokumen:** spesifikasi implementasi dan penerimaan desain. Dokumen ini tidak menyatakan website, bank soal massal, atau LMS sudah dibangun.

## 1. Hasil pengalaman yang harus diwujudkan

Siswa dapat membuka aplikasi, memilih latihan yang sesuai, menjawab dengan nyaman, memahami hasilnya, dan melanjutkan latihan berikutnya. Guru dan admin dapat mencoba alur monitoring serta pelaporan dengan data simulasi yang konsisten. Ketika LMS pusat tersedia, komponen monitoring menggunakan data yang terotorisasi melalui bridge yang sama.

Desain mengikuti isi sumber `KALIBATAKU_MASTER_CURRICULUM_v1.md`, registry pendamping, dan brief pengguna. Kurikulum memiliki 60 kelas-level, 281 kategori kompetensi aktif, dan 19 kategori nonaktif. Angka ini menentukan cakupan navigasi, bukan alasan untuk menampilkan 281 pilihan sekaligus. Keterangan kelengkapan produksi bank mengikuti dokumen `05_BANK_SOAL_FACTORY.md`; contoh kurikulum tidak boleh ditampilkan sebagai seluruh bank produksi.

**Arti lazy loaded/lazy interaction di produk ini:** fitur dimuat ketika dibutuhkan; pilihan yang jarang dipakai muncul setelah pengguna meminta; fungsi yang dijanjikan tetap benar-benar bekerja. Tombol palsu, data dekoratif, spinner tanpa akhir, dan ekspor yang hanya mengganti ekstensi tidak memenuhi spesifikasi.

### 1.1 Prinsip keputusan

| Prinsip | Aturan konkret | Bukti penerimaan |
|---|---|---|
| Mulai cepat | Beranda memiliki satu aksi utama: lanjutkan sesi yang ada, atau mulai latihan | Pengguna baru mencapai soal pertama melalui pilihan ringkas; tanpa onboarding panjang |
| Beban pilihan bertahap | Kelas materi → level → operasi → paket; pilihan terakhir diingat | Pengguna tidak harus membuka 12 kelas dan 60 level sekaligus |
| Matematika paling menonjol | Ekspresi, input, dan aksi berada di pusat perhatian | Pada layar latihan tidak ada grafik, feed, leaderboard, atau promosi |
| Satu tindakan utama per keadaan | `Periksa jawaban`, `Lanjut`, atau `Simpan & lanjut`, sesuai keadaan | Tidak ada dua tombol utama bersaing pada panel soal |
| Ketepatan sebelum kecepatan | Latihan tanpa waktu menjadi default; tantangan waktu bersifat pilihan | Timer dan peringkat kecepatan tidak memblokir pembelajaran |
| Data dapat dipahami | Skor, akurasi, jumlah sampel, dan penguasaan menggunakan label berbeda | Nilai 90% tidak otomatis diberi cap menguasai |
| Status sesuai kenyataan | Lokal, simulasi, menunggu server, dan diterima server ditampilkan berbeda | Tidak ada status tersinkron berdasarkan ACK mock |
| Penggunaan lintas usia | Tipografi nyaman, aksen hangat, bahasa pendek; tanpa maskot wajib | SD mudah membaca dan SMA tidak merasa memakai aplikasi balita |
| Tugas tetap tersimpan | Ganti bahasa, tema, orientasi, dan ukuran layar tidak mereset sesi | Draft jawaban, posisi soal, urutan paket, dan waktu tidak berubah karena re-render |
| Kemampuan dapat berkembang | UI merender metadata/registry, tidak membuat switch untuk setiap paket | Penambahan bank yang sah tidak memerlukan desain ulang cangkang |

## 2. Arah visual: Warm Engineering

Gunakan karakter hangat, teliti, dan profesional. Identitas utama berupa wordmark **KALIBATAKU** dengan simbol sederhana `× ÷ + −` sebagai aksen. Jangan menjadikan semua permukaan kotak membulat dengan bayangan yang sama. Hirarki dibentuk melalui tipografi, jarak, garis pembatas, dan satu warna aksi.

Beranda terdiri atas sapaan singkat, latihan yang dapat dilanjutkan, pilihan mulai, lalu ringkasan progres. Hindari hero setinggi layar, slogan berulang, ilustrasi stok besar, gradien neon, glassmorphism, animasi angka dekoratif, confetti setiap jawaban, dan badge yang tidak membawa informasi.

Gunakan panel untuk unit kerja yang jelas: kartu sesi, formulir penyiapan, dan ringkasan hasil. Katalog paket lebih tepat berupa daftar baris. Data monitoring menggunakan tabel. Laporan orang tua mengikuti tata letak dokumen yang bersih. Jumlah kotak bukan indikator kualitas desain.

### 2.1 Hirarki merek dan istilah

- Merek tetap `KALIBATAKU` pada kedua bahasa.
- Subjudul ID: `Latihan berhitung mental`; EN: `Mental arithmetic practice`.
- Navigasi siswa: `Latihan`, `Progres`, `Paket offline`, `Pengaturan`.
- Bahasa Inggris: `Practice`, `Progress`, `Offline packs`, `Settings`.
- `Kelas materi / Material grade` dipakai ketika ada risiko tertukar dengan `Kelas sekolah / School class`.
- ID teknis seperti `arithmetic.division.g05.l03` berada di detail diagnostik atau ekspor, bukan judul layar siswa.
- Informasi implementasi seperti IndexedDB, AST, adapter, dan event ID tidak tampil pada alur belajar biasa.

## 3. Sistem warna dua tema

Semua warna harus berasal dari token semantik. Komponen tidak boleh mengunci warna tema melalui hex lokal. Nilai di bawah merupakan keputusan desain produk, bukan aturan warna dari W3C.

| Token | Terang | Gelap | Pemakaian |
|---|---|---|---|
| `canvas` | `#F5F3ED` | `#111B19` | Latar aplikasi |
| `surface` | `#FFFFFF` | `#192622` | Panel utama |
| `surfaceRaised` | `#ECEEE9` | `#22332D` | Kelompok input/menu terpilih |
| `text` | `#162F2A` | `#F2F4ED` | Judul dan isi |
| `textMuted` | `#53645E` | `#B1C0B7` | Metadata yang tetap harus terbaca |
| `borderDecorative` | `#D7DED7` | `#35483F` | Garis dekoratif pemisah |
| `borderControl` | `#75847D` | `#71877B` | Batas input/tombol yang perlu dikenali |
| `primary` | `#176B5B` | `#8ED4BA` | Aksi utama |
| `onPrimary` | `#FFFFFF` | `#10251E` | Teks pada aksi utama |
| `primaryHover` | `#105849` | `#A5E1CA` | Hover aksi utama |
| `successBg` / `successText` | `#E1F1E8` / `#0E5C49` | `#203A30` / `#A2E1C4` | Benar/selesai dengan label |
| `warningBg` / `warningText` | `#FFF0DB` / `#995B16` | `#382C1E` / `#F1C77C` | Perlu perhatian/penyimpanan tertunda |
| `errorBg` / `errorText` | `#FCEBEF` / `#A32F3D` | `#42272E` / `#FFB6BF` | Gagal/format tidak sah |
| `infoBg` / `infoText` | `#EAF2FA` / `#245D89` | `#203244` / `#A8CFF0` | Informasi netral/simulasi |
| `focusRing` | `#1F63B5` | `#A5C9FF` | Fokus keyboard |

### 3.1 Pasangan kontras yang sudah dihitung

Perhitungan menggunakan luminansi relatif sRGB tanpa transparansi, dibulatkan dua desimal. Nilai ini memeriksa pasangan warna; implementasi tetap harus memeriksa opacity, overlay, gradien, hover, ikon, dan latar aktual. W3C menetapkan minimum 4,5:1 untuk teks biasa dan 3:1 untuk teks besar; informasi visual penting pada komponen/grafik memiliki ketentuan nonteks 3:1.[R1][R2]

| Pasangan | Terang | Gelap |
|---|---:|---:|
| Teks utama / surface | 14,25:1 | 14,12:1 |
| Teks sekunder / canvas terang atau surfaceRaised gelap | 5,65:1 | 7,02:1 |
| Teks tombol utama / primary | 6,38:1 | 9,40:1 |
| Teks sukses / latar sukses | 6,78:1 | 8,25:1 |
| Teks peringatan / latar peringatan | 4,85:1 | 8,53:1 |
| Teks kesalahan / latar kesalahan | 6,03:1 | 8,13:1 |
| Teks informasi / latar informasi | 6,19:1 | 8,02:1 |
| Batas kontrol / canvas terang atau surfaceRaised gelap | 3,54:1 | 3,45:1 |
| Fokus / canvas terang atau surface gelap | 5,39:1 | 9,24:1 |

`borderDecorative` tidak boleh menjadi satu-satunya penanda batas input, status, atau kontrol interaktif. Status selalu memiliki teks dan ikon/bentuk, sehingga tidak bergantung pada warna. Grafik memakai pola garis atau penanda titik berbeda dan tabel data pendamping.

## 4. Tipografi, jarak, dan ekspresi matematika

### 4.1 Tipografi

Gunakan satu keluarga sans yang bentuk angkanya jelas, berlisensi sesuai distribusi, dan disertakan secara lokal bila bukan font sistem. Pilihan awal: **Noto Sans**; fallback `system-ui, sans-serif`. Paket font final wajib menyertakan lisensi. Font tidak boleh menjadi syarat agar siswa dapat mulai menjawab. Hindari memuat banyak keluarga/berat, dan gunakan fallback dengan metrik yang mendekati untuk menekan pergeseran tata letak.

| Peran | Desktop | Ponsel | Ketentuan |
|---|---|---|---|
| Isi utama | 17–18 px ekuivalen | 16–18 px ekuivalen | CSS `rem`, line-height 1,5–1,65 |
| Label/metadata | 14–16 px | 14–16 px | Informasi penting tidak di bawah 14 px |
| Judul layar | 30–36 px | 26–30 px | Hindari uppercase panjang |
| Judul bagian | 22–26 px | 20–24 px | Tidak lebih dari tiga tingkat visual dominan |
| Angka ringkasan | 28–36 px | 24–32 px | `tabular-nums`, satuan terpisah jelas |
| Soal sederhana | 48–64 px | 36–48 px | Ukuran fleksibel, ruang tanda minus/kali jelas |
| Soal campuran panjang | 32–44 px | 26–34 px | Turun menurut panjang ekspresi, tidak di bawah batas keterbacaan |
| Input jawaban | 28–36 px | 26–32 px | Tinggi minimal 60 px pada player |

W3C mengharuskan pembesaran teks sampai 200% tanpa kehilangan isi/fungsi untuk cakupan kriteria terkait; jangan menggunakan viewport yang menonaktifkan zoom.[R3] Ukuran di tabel merupakan target desain, bukan pengecualian terhadap pembesaran teks.

### 4.2 Jarak dan bentuk

Gunakan skala dasar 4, 8, 12, 16, 24, 32, 48 px; padding utama ponsel 16 px (12 px hanya pada 320 px), tablet 24 px, desktop 32 px. Lebar teks penjelasan 60–75 karakter. Radius input/tombol 10–12 px dan panel 16 px; badge status dapat menggunakan bentuk kapsul. Bayangan ringan hanya untuk menu mengambang, dialog, atau drawer. Baris tabel minimal 48 px; baris yang memuat kontrol sentuh minimal 52 px.

### 4.3 Menampilkan soal

Render ekspresi dari AST/nilai tepercaya, bukan menyisipkan HTML dari bank. Perkalian memakai `×`, pembagian `÷`, dan minus matematika `−`. Tanda kurung harus menghilangkan ambiguitas pembagian terhadap pecahan. Tampilkan, misalnya, `12 ÷ (3/4)` dengan pecahan bertumpuk atau literal terkelompok yang jelas.

Gunakan MathML semantik atau renderer yang mempertahankan pembacaan aksesibel; verifikasi dengan pembaca layar yang tercakup QA. Jika visual memakai elemen terpisah, sediakan satu representasi linear yang jelas bagi pembaca layar dan cegah pembacaan ganda. Tidak boleh memakai gambar raster untuk soal atau angka.

Pada ekspresi panjang, pecah baris pada batas operator yang sah atau kelompok AST; jangan memisahkan pembilang/penyebut maupun menukar urutan. Jika ruang benar-benar tidak mencukupi, berikan area ekspresi yang dapat digulir secara jelas, tanpa membuat seluruh halaman melebar. Jangan mengecilkan font hingga siswa kesulitan membaca.

## 5. Responsif dan dukungan perangkat

`Cocok di semua device` diwujudkan sebagai tata letak adaptif dengan matriks dukungan yang diuji. Ini bukan klaim bahwa semua browser historis telah diuji. Versi tepat browser dan sistem operasi dicatat saat rilis.

| Rentang lebar CSS | Tata letak |
|---|---|
| 320–599 px | Satu kolom, navigasi ringkas, kontrol penuh lebar bila perlu, filter sebagai panel yang dapat ditutup |
| 600–899 px | Satu/dua kolom sesuai isi, katalog dua kolom jika tidak mengurangi keterbacaan |
| 900–1199 px | Navigasi samping opsional, konten dua kolom, player tetap terpusat |
| ≥1200 px | Lebar konten maksimum 1280 px; player maksimum 760 px; tabel/admin maksimum 1440 px |
| Layar pendek/landscape | Hilangkan ruang dekoratif, izinkan scroll vertikal, kontrol dan input tetap dapat dicapai |

Breakpoint di atas adalah token desain yang boleh digeser sedikit bila bukti visual menuntut; jangan menyamakan lebar layar dengan jenis input. Laptop dapat memiliki layar sentuh dan tablet dapat menggunakan keyboard.

**Kasus wajib:** 320×568, 360×800, 390×844, 568×320, 768×1024, 1024×768, 1366×768, 1440×900, dan layar lebar 2560 px. Uji teks 200% dan reflow pada lebar 320 CSS px; W3C memberi pengecualian terbatas untuk konten yang memang memerlukan susunan dua dimensi, seperti tabel tertentu.[R4] Tabel monitoring tetap menyediakan mode ringkas per siswa agar pengguna ponsel tidak harus selalu menggulir kedua arah.

Jangan mengunci orientasi. Gunakan safe-area pada perangkat berponi. Keyboard virtual tidak boleh menutupi input atau aksi utama; tata letak harus merespons visual viewport atau menjaga aliran dokumen yang tetap dapat digulir. Tinggi layar tidak dikunci dengan `100vh` yang memotong bagian bawah. Pada player ponsel, navigasi bawah global boleh disembunyikan selama sesi agar ruang kerja mencukupi.

Uji minimal Chrome/Edge/Firefox desktop yang masih didukung proyek, Safari macOS, Safari iOS/iPadOS, dan Chrome Android. Otomasi Chromium/Firefox/WebKit memberi bukti mesin browser; hasil emulasi bukan klaim pengujian perangkat fisik. Catat pengujian perangkat nyata yang benar-benar dilakukan dan pisahkan yang belum.

## 6. Arsitektur informasi dan 18 layar

Rute berikut merupakan rute logis; implementasi boleh memakai hash router atau rute dengan fallback hosting sesuai dokumen arsitektur. Refresh dan deep link harus bekerja pada hosting statis yang dipilih. Jangan memasukkan nama lengkap siswa atau informasi pribadi lain ke query string.

| ID | Layar / rute logis | Isi wajib dan aksi utama | Lazy interaction dan keadaan penting |
|---|---|---|---|
| **UX-01** | Beranda `/` | Lanjutkan sesi, mulai latihan, ringkasan terbaru berbasis data, tautan progres | Rekomendasi lanjutan dibuka on demand; kosong menampilkan mulai, bukan grafik palsu |
| **UX-02** | Mulai cepat dan penempatan `/start` | Pilih kelas materi; opsi langsung memilih paket atau diagnostik terstruktur | Diagnostik memakai mode assessment yang ada; tidak menciptakan mode keenam atau menampilkan skor sebelum selesai |
| **UX-03** | Peta kurikulum `/curriculum` | Kelas 1–12, lima level; operasi aktif dan fokus level; kelas terakhir diingat | Metadata satu jenjang/kelas dahulu; 19 slot nonaktif berlabel belum masuk cakupan, bukan tombol mati tanpa alasan |
| **UX-04** | Katalog paket `/packs` | Daftar paket per kompetensi, tujuan, jumlah soal, status offline, status pernah dikerjakan | Filter utama sedikit; filter lanjutan di panel; pagination/load more yang tetap aksesibel; tidak mengimpor semua paket |
| **UX-05** | Penyiapan sesi `/session/new` | Ringkasan kelas-level-operasi, mode, jumlah soal yang tersedia, waktu bila relevan; tombol mulai | Opsi lanjutan tertutup; tampilkan alasan bila pilihan melebihi pool/paket; mulai hanya setelah paket valid dan siap |
| **UX-06** | Player `/session/{attemptId}` | Ekspresi, progres soal, input numerik, satu aksi utama, pause/keluar, status simpan ringkas | Lima mode menggunakan cangkang sama; feedback disesuaikan mode; locale/theme tidak mereset jawaban |
| **UX-07** | Jeda/pemulihan sesi `/resume/{attemptId}` atau dialog | Ringkasan posisi, lanjutkan, akhiri dengan status belum selesai | Refresh, tab konflik, paket versi lama, dan kegagalan simpan memiliki pilihan yang jelas; tidak membuat attempt ganda |
| **UX-08** | Hasil sesi `/results/{attemptId}` | Skor form, benar/salah/skip, ketepatan, waktu yang sah, bukti penguasaan, rekomendasi | Grafik/detail baru dimuat setelah ringkasan; data belum cukup berbeda dari nilai nol |
| **UX-09** | Tinjau jawaban dan pemulihan `/review/{attemptId}` | Soal asli, jawaban siswa, kunci, satu pembahasan ringkas ID/EN, latihan ulang setara | Filter salah/skip; detail per soal ekspansif; koreksi latihan tidak menulis ulang jawaban pertama |
| **UX-10** | Progres dan riwayat `/progress` | Peta kompetensi, histori sesi, filter mode/periode, status bukti | Grafik dimuat saat terlihat/dibuka; perbandingan harus setara; MIX tetap kategori sendiri |
| **UX-11** | Profil lokal dan data `/profiles` | Nama panggilan opsional, profil aktif, ekspor/impor cadangan lokal, hapus dengan cakupan jelas | Tidak meminta email/password; profil lokal berbeda dari akun LMS; konfirmasi hanya tindakan berisiko menghapus data |
| **UX-12** | Monitoring guru simulasi `/demo/teacher` | Kelas simulasi, daftar siswa, status tugas, filter, tautan detail | Banner simulasi menetap; data berasal dari fixture/events yang konsisten; bukan angka statis dekoratif |
| **UX-13** | Detail siswa simulasi `/demo/student/{id}` | Profil kompetensi, histori, jawaban per butir, catatan guru lokal, rekomendasi | Drill-down dimuat per sesi; jumlah sampel dan kelas materi terlihat; siswa demo tidak tercampur profil nyata lokal |
| **UX-14** | Penugasan simulasi `/demo/assignments` | Pilih paket/kompetensi, target siswa demo, mode, jadwal simulasi, pratinjau tugas | Membuat tugas lokal yang dapat dikerjakan dengan persona demo dan memutakhirkan dashboard; tidak mengirim undangan |
| **UX-15** | Admin simulasi dan cakupan bank `/demo/admin` | Ringkasan kelas demo, cakupan 281 aktif, versi konten, status QA bank, rekap/ekspor | Audit teknis berada di detail; tidak menampilkan pengelolaan akun produksi palsu; paket hilang adalah masalah rilis |
| **UX-16** | Laporan Parents Meeting `/reports` | Pilih sumber/periode/siswa/bahasa/format, pratinjau, catatan, unduh | Mesin ekspor dimuat saat dipilih; progres batch dan pembatalan; demo diberi watermark; lokal diberi label belum diverifikasi |
| **UX-17** | Paket offline dan status data `/offline` | Paket yang tersimpan, ukuran/versi, unduh/hapus cache, status outbox/bridge | Cache paket terpisah dari histori; status lokal/mock/server berbeda; online tidak otomatis berarti server menerima |
| **UX-18** | Pengaturan dan bantuan `/settings` | Bahasa, terang/gelap/sistem, ukuran teks, gerak/suara, cara input, privasi lokal, versi aplikasi | Preferensi berlaku tanpa restart; bantuan kontekstual ringkas; keadaan error global tetap memiliki jalur pulang |

### 6.1 Navigasi dan perjalanan utama

**Pengguna baru:** beranda → mulai cepat → pilih kelas materi dan operasi → pilih paket yang direkomendasikan → mulai. Tidak wajib memilih profil bernama, akun, avatar, atau menjalani tur.

**Pengguna kembali:** beranda → lanjutkan sesi yang tersimpan. Jika tidak ada sesi, gunakan pilihan latihan terakhir yang masih valid; siswa tetap dapat mengganti pilihan.

**Guru:** masuk ruang simulasi → pilih kelas → lihat siswa prioritas → tinjau bukti → buat latihan penguatan simulasi → buka laporan. Label simulasi tetap terbaca pada semua rute turunannya.

**Admin:** buka ruang simulasi admin → pilih periode dan kelompok → periksa kelengkapan data → pratinjau laporan → unduh. Jumlah siswa/berkas yang akan diekspor terlihat sebelum proses dimulai.

Navigasi utama siswa tidak didominasi menu guru/admin. Akses simulasi tersedia sebagai tautan sekunder yang jelas. Portal orang tua dengan login bukan persyaratan rilis statis; kebutuhan awal dipenuhi laporan yang dapat diunduh.

## 7. Spesifikasi layar player dan mesin interaksi

### 7.1 Susunan player

Dari atas ke bawah: identitas paket singkat → progres `Soal 3 dari 10` → ekspresi → label dan kolom jawaban → pesan format/feedback → satu aksi utama → aksi sekunder yang relevan. Timer kecil hanya hadir jika dipilih. Status simpan berada di tepi panel tanpa menutupi soal.

Pada desktop, ekspresi dan input tetap berada pada lebar baca terpusat, bukan diperbesar memenuhi monitor. Pada ponsel, kontrol berada dekat input sehingga siswa tidak perlu menggulir jauh setelah setiap jawaban. Angka yang berubah memakai lebar tabular agar tata letak stabil.

### 7.2 Keadaan player

| Keadaan | Perilaku | Yang harus dihindari |
|---|---|---|
| Memuat paket | Ringkasan pilihan tetap terlihat; placeholder ekspresi memiliki tinggi stabil | Menampilkan soal dummy yang bisa dijawab |
| Siap menjawab | Fokus logis pada input setelah pengguna memulai; keyboard tidak dipaksa muncul saat baru membuka beranda | Timer dimulai sebelum soal siap |
| Draft kosong/tidak lengkap | Input tetap dapat diedit; format tidak dinilai sebagai matematika salah | Mengurangi skor karena siswa masih mengetik minus atau garis pecahan |
| Format tidak sah | Pesan di bawah input, nilai tetap utuh, fokus kembali ke input | Menghapus input atau memberi cap salah tanpa menjelaskan format |
| Menyimpan jawaban | Cegah submit ganda; indikator singkat bila diperlukan; event hanya satu kali | Enter autorepeat menciptakan dua jawaban |
| Jawaban tersimpan | Feedback sesuai mode; tombol berubah menurut aksi berikutnya | Lanjut sebelum commit lokal selesai lalu menghilangkan jawaban |
| Simpan gagal | Jawaban tetap berada di memori/draft; pesan data belum aman; coba lagi/unduh cadangan jika dapat | Mengatakan tersimpan setelah transaksi penyimpanan gagal |
| Dijeda | Soal tidak menerima input; status waktu mengikuti kebijakan mode | Pause menghitung sebagai salah atau membuat attempt baru |
| Selesai | Ringkasan ditampilkan setelah finalisasi; dapat ditinjau lagi | Dashboard berbeda total dengan jawaban aktual |
| Konflik tab | Tab kedua hanya-baca sampai pengguna memilih mengambil alih secara eksplisit | Dua tab menulis attempt sama secara bersamaan tanpa koordinasi |

Jika penyimpanan gagal sementara, boleh menampilkan hasil perhitungan lokal dengan label belum tersimpan. Jangan meneruskan sesi tanpa memberi pilihan yang jelas untuk melindungi hasil sebelumnya. Pesan ini merupakan bagian dari alur kegagalan nyata, bukan banner peringatan permanen.

### 7.3 Perilaku lima mode

| Mode | Aksi/feedback | Waktu dan kelanjutan |
|---|---|---|
| Latihan / Practice | `Periksa jawaban`; benar → `Lanjut`; salah → coba lagi atau lihat cara, dengan retry/hint tercatat | Tanpa batas waktu default; pause tersedia; tidak auto-advance |
| Kecepatan / Speed | Jawaban final per soal; feedback ringkas; urutan berikutnya mengikuti preferensi yang dijelaskan sebelum mulai | Durasi dipilih sebelum sesi; pilihan tanpa batas mengalihkan ke Practice dengan materi sama; tab tersembunyi dan jeda tampilan tidak menghentikan deadline |
| Evaluasi / Assessment | `Simpan & lanjut`; jawaban belum diberi label benar/salah; daftar soal memudahkan tinjau sebelum final | Ringkasan soal kosong sebelum final; finalisasi sekali; jawaban terkunci setelah final |
| Adaptif / Adaptive | Antarmuka seperti latihan; penyesuaian pada batas blok kecil, bukan setiap ketikan | Tampilkan alasan sederhana saat tingkat berubah; tidak turun tingkat hanya karena satu kesalahan |
| Pemulihan / Mistake Recovery | Soal salah terdahulu dan variasi setara; identitas pengulangan tetap tercatat | Keberhasilan memperbarui hasil pemulihan, tanpa mengubah histori awal |

Diagnostik adalah tujuan/paket assessment, bukan mode tambahan. Tidak ada kewajiban timer dalam evaluasi lokal. Jika konfigurasi timer aktif, tampilkan aturan sebelum mulai dan sediakan kemampuan mematikan atau menyesuaikan sesuai cakupan aksesibilitas. Ketentuan waktu W3C mencakup pilihan mematikan, menyesuaikan, memperpanjang, atau pengecualian yang benar-benar berlaku; jangan menyatakan semua timer pendidikan otomatis dikecualikan.[R5]

Perbedaan antara waktu aktif belajar dan waktu batas sesi tidak boleh disamarkan. Keluar tab tidak otomatis membuktikan kecurangan. Ketika aplikasi kembali dari background, mesin menghitung sisa waktu sesuai kebijakan mode dan memperbarui UI satu kali; tidak mengulang suara atau animasi yang terlewat.

## 8. Input jawaban numerik: Indonesia dan Inggris

Gunakan `<input type="text">` dengan label yang terlihat. `inputmode` hanya petunjuk keyboard, bukan validator. Keyboard numeric/decimal pada perangkat tertentu tidak menyediakan minus; tombol tambahan harus tersedia agar jawaban negatif dan pecahan dapat ditulis.[R6]

### 8.1 Bentuk input

- Bilangan bulat: digit dengan tanda awal yang didukung grammar.
- Desimal: koma pada Indonesia, titik pada English.
- Pecahan: `p/q` dengan penyebut bilangan bulat positif; tanda negatif berada pada pembilang. Pecahan tak sederhana tetap dibandingkan sebagai nilai rasional eksak.
- Jawaban berupa ekspresi seperti `2+3` tidak diterima, karena aktivitas meminta satu nilai numerik.
- Pemisah ribuan tidak diterima pada input. Label bantuan singkat: `Tanpa pemisah ribuan / No thousands separators`.
- Separator bahasa lain ditolak dengan pesan spesifik, bukan ditebak. Dalam ID, `1.25` meminta koreksi menjadi `1,25`. Dalam EN, `1,25` meminta `1.25`.
- `1.250` pada EN berarti nilai desimal 1,25; pada ID tidak dianggap otomatis 1250. Untuk seribu dua ratus lima puluh, tulis `1250`.
- Batas panjang, karakter Unicode yang dinormalisasi, tanda, dan perilaku whitespace mengikuti grammar serta fixture kontrak. UI tidak boleh menggunakan aturan terpisah yang bertentangan dengan validator.

### 8.2 Keyboard fisik dan virtual

`Enter` menjalankan aksi utama hanya bila fokus berada pada input atau kontrol submit yang sesuai. Input method composition harus selesai sebelum submit; jangan memakai listener global yang menangkap Enter dari dialog atau pencarian. `Tab` berpindah kontrol sesuai urutan tampilan. Sediakan tombol minus/ubah tanda dan garis pecahan dengan label aksesibel; tombol ini menyisipkan pada posisi caret dan menjaga selection.

Pada ponsel, tampilkan satu baris alat kecil `−`, `/`, separator desimal, dan hapus bila keyboard sistem tidak memadai. Keypad khusus lengkap bersifat pilihan; selalu tersedia cara kembali ke keyboard sistem. Jangan tampilkan dua keypad yang saling menutupi. Semua tombol angka tambahan berukuran sentuh memadai. Jangan membuat UI untuk menggambar angka tulisan tangan sebagai syarat rilis.

Pengetikan `-`, `1/`, `1,` pada ID adalah draft belum lengkap; pesan bantuan boleh muncul setelah submit/blur yang relevan. Jangan menampilkan error merah pada tiap ketikan yang masih masuk akal. `3/0` adalah kesalahan format/domain numerik, bukan jawaban matematika salah. `0,333` untuk kunci `1/3` adalah nilai yang sah tetapi tidak ekuivalen; setelah diperiksa, umpan balik menyatakan jawaban belum tepat, bukan merusak input.

### 8.3 Mengganti bahasa saat draft terisi

Jika draft sudah dapat diparse eksak, ubah tampilan separator ke locale baru dengan nilai yang sama; jangan membulatkan. Jika draft belum lengkap/invalid, simpan string bersama `draft_locale` dan pertahankan persis. Tampilkan catatan kecil bahwa draft masih memakai format bahasa asal sampai diperbaiki/dikosongkan. Validator memakai `draft_locale` tersebut, dan keypad memakai konteks draft yang sama. Setelah draft diselesaikan dan valid, UI dapat menormalisasi tampilan ke bahasa aktif tanpa mengubah nilai. Pilihan ini mencegah `1,` berubah diam-diam menjadi `1` saat bahasa berganti.

Perubahan locale tidak mengubah question ID, seed, urutan soal, tanggal kejadian, status jawaban, jumlah percobaan, durasi, ataupun hasil penilaian.

## 9. Bilingual sebagai sistem menyeluruh

Semua teks produk yang disediakan sistem memiliki pasangan ID/EN: navigasi, judul paket, nama level, instruksi, placeholder, tooltip, pesan kesalahan, aria-label, title halaman, dialog, tombol, pembahasan, rekomendasi, status penyimpanan, ekspor, tabel, grafik, keterangan sumbu, dan empty state.

Jangan merangkai kalimat dari fragmen terjemahan dengan urutan tetap. Gunakan key yang bermakna dan placeholder bernama. Pluralisasi bahasa Inggris harus benar. Angka tampilan dan tanggal memakai locale eksplisit; waktu kejadian disimpan dalam format universal dan ditampilkan dengan zona waktu yang disebut bila relevan. Bahasa UI tidak menentukan zona waktu akun.

Pilihan bahasa diberi teks `Bahasa Indonesia` dan `English`, tidak hanya bendera. Bahasa awal mengikuti preferensi tersimpan; bila belum ada, gunakan Indonesia. Bahasa browser tidak mengubah default ini secara diam-diam. Kedua bahasa diuji dengan string panjang, angka besar, pecahan, dan dialog sempit. Ketiadaan terjemahan merupakan kegagalan gate rilis; fallback teknis boleh mencegah blank screen, tetapi key mentah tidak boleh lolos QA.

Nama/alias dan catatan bebas yang diketik pengguna tetap pada bahasa asal; keduanya tidak diterjemahkan otomatis. Label formulir dan narasi yang dibuat sistem tetap bilingual.

Pembahasan boleh singkat, misalnya ID `24 × 4 = (20 × 4) + (4 × 4) = 96` dan EN dengan struktur matematika yang sama. Jika ada kalimat strategi, keduanya harus natural, konsisten, dan benar. Satu soal tidak diduplikasi hanya untuk mengganti bahasa.

## 10. Tema, gerak, suara, dan preferensi

Pengaturan tema memiliki tiga pilihan: **Terang / Light**, **Gelap / Dark**, dan **Ikuti sistem / System**. Pilihan tersimpan mengalahkan preferensi sistem; mode sistem mengikuti perubahan sistem. Warna awal diterapkan sebelum konten utama terlihat agar tidak terjadi kilatan tema yang berlawanan. Mekanisme initial theme harus tetap mengikuti CSP yang dipilih pada arsitektur.

Tema meliputi semua komponen: input native, menu, tooltip, scrollbar bila diubah, grafik, dialog, loading, halaman error, serta paket offline. Laporan cetak selalu memakai palet cetak yang hemat tinta; tema gelap aplikasi tidak memaksa PDF berlatar hitam.

Gerak kecil 120–180 ms diperbolehkan untuk opacity/perubahan keadaan. Hindari perpindahan layout, shake pada jawaban salah, parallax, progress bergelombang, atau perayaan yang menghalangi. Hormati `prefers-reduced-motion`; preferensi sistem ini menyampaikan keinginan mengurangi gerak nonesensial.[R7] Sediakan opsi dalam aplikasi untuk mengurangi gerak lebih lanjut. Fungsi tidak bergantung animasi.

Suara default mati. Jika diaktifkan, umpan balik tetap memiliki teks; tidak boleh ada suara tiba-tiba saat halaman dibuka. Kontrol suara menyebut keadaan kini. Preferensi ukuran teks, keypad, dan tampilan waktu dapat disimpan tanpa memengaruhi hasil akademik. Jika penyimpanan preferensi tidak tersedia, perubahan tetap berlaku selama sesi dan tidak menghalangi latihan.

## 11. Progres, monitoring, dan penggunaan data

### 11.1 Siswa

Beranda menampilkan data ringkas yang dapat ditindaklanjuti: sesi yang belum selesai, kompetensi yang sedang dipelajari, dan satu saran berikutnya. Peta kemampuan menggunakan teks status bersama warna: `Belum mulai`, `Bukti belum cukup`, `Sedang berkembang`, `Menguasai sementara`, serta `Perlu tinjau ulang` sesuai kebijakan analitik. Status verified hanya tersedia bila sumber data memang memenuhi kontrak LMS. `Perlu tinjau ulang / Review due` merupakan flag tambahan dengan tanggal, bukan pengganti yang menghapus status penguasaan historis.

Akurasi 90% dengan dua soal tidak disamakan dengan 90% dari bukti memadai. Tampilkan denominator, misalnya `18 dari 20 jawaban pertama tepat`. Jika tidak ada data, gunakan `Belum dievaluasi`, bukan `0%`. Hindari penamaan `lemah`, `gagal`, `bodoh`, atau klaim kecerdasan. Rekomendasi menyebut latihan berikutnya dan alasannya.

### 11.2 Guru

Layar monitoring menekankan siswa yang memerlukan tindak lanjut berdasarkan kondisi eksplisit, misalnya tugas belum selesai atau bukti kompetensi belum cukup. Tidak ada leaderboard default. Filter kelas administratif dan kelas materi dipisahkan. Mode latihan, periode, operasi, level, jumlah sampel, dan status verifikasi selalu dapat ditelusuri.

Ringkasan kelas dihitung dari data dan rumus yang jelas. Drill-down mempertahankan filter dan posisi ketika pengguna kembali. Nilai harus dapat dijelaskan melalui daftar sesi dan jawaban. Kelas simulasi dapat menggunakan nama sintetis seperti `Siswa Demo 01`; mengganti persona demo tidak mengubah profil latihan pribadi pengguna.

### 11.3 Admin dan cakupan bank

Panel cakupan menampilkan jumlah kompetensi aktif yang memiliki paket tervalidasi, kompetensi kosong, versi kurikulum, dan jumlah butir menurut definisi. Pisahkan `slot latihan`, `soal unik kanonik`, `paket`, dan `pengulangan terencana`. Jangan menampilkan kapasitas maksimum sebagai stok tersedia. Jumlah seluruh 281 kompetensi harus dapat ditelusuri ke manifest rilis.

Nomor kualitas contoh: `281/281 kompetensi aktif memiliki bank lolos QA` hanya boleh tampil jika kondisi tersebut benar pada rilis aktual. Bila ada 280/281, status panel adalah belum lengkap dan gate produksi harus gagal, meskipun UI lainnya tampak rapi.

### 11.4 Grafik

Utamakan grafik garis sederhana untuk perkembangan setara, diagram batang untuk perbandingan operasi, dan tabel untuk angka tepat. Sumbu persentase 0–100 untuk menghindari kesan peningkatan berlebihan. Tooltip tersedia melalui fokus keyboard serta sentuhan; nilai utama tidak hanya terlihat saat hover. Tabel pendamping selalu dapat dibuka dan diekspor.

Kecepatan memakai satuan dan kualitas data. Median/P90 tidak diubah menjadi label kemampuan bila sampel tidak cukup. Grafik lintas mode/level yang tidak sebanding boleh menunjukkan riwayat, tetapi tidak diberi narasi otomatis peningkatan kemampuan.

## 12. Laporan Parents Meeting dan ekspor

Laporan memuat identitas minimal, periode, kelas administratif bila ada, kelas materi, mode, jumlah sesi/butir, definisi skor, ringkasan per operasi, status bukti, perkembangan setara, target berikutnya, dan catatan guru. Catatan harus mempunyai ruang yang memadai tanpa memotong teks. Kesimpulan berasal dari data, bukan narasi optimistis tetap.

### 12.1 Tiga sumber laporan

| Sumber | Label di UI dan berkas | Makna |
|---|---|---|
| `local_practice` | `Catatan latihan pada perangkat ini — belum diverifikasi sekolah` | Hasil penggunaan nyata lokal, bukan rekam server resmi |
| `demo` / mock | `SIMULASI — BUKAN REKAM AKADEMIK RESMI` / `SIMULATION — NOT AN OFFICIAL ACADEMIC RECORD` | Dataset sintetis untuk menguji alur |
| Remote LMS | Status verifikasi dan sumber yang diterima dari server | Hanya aktif setelah integrasi nyata dan otorisasi |

Sumber tidak berubah hanya karena pengguna memilih tampilan guru atau menghapus watermark. UI statis tidak menyediakan tombol untuk mengangkat demo menjadi verified.

### 12.2 Bentuk laporan

Gunakan satu/dua halaman ringkasan per siswa bila data memungkinkan, dengan lampiran rinci terpisah. Pada A4, margin awal 16–18 mm, isi 10,5–11,5 pt, judul jelas, tabel tidak terpotong. Bilingual dapat memakai subjudul dan paragraf ID/EN berurutan atau dua kolom hanya ketika benar-benar cukup lebar. Ponsel menggunakan pratinjau reflow atau tombol buka dokumen; jangan memaksa membaca A4 yang dikecilkan menjadi 320 px.

Format yang diminta dalam PRD harus dihasilkan dengan format file sebenarnya: PDF, XLSX, CSV, DOCX, JSON, dan ZIP sesuai cakupan ekspor. HTML print preview boleh membantu, tetapi tidak boleh dilabeli mesin DOCX/PDF hanya dengan mengganti ekstensi. Sanitasi ekspor dan struktur data mengikuti dokumen keamanan/analitik.

### 12.3 Proses ekspor

Tampilkan cakupan dan perkiraan jumlah berkas sebelum mulai. Muat mesin untuk format terpilih setelah tindakan pengguna. Tampilkan tahap faktual seperti `Menyiapkan 12 dari 30 laporan`; jangan membuat persentase palsu. Beri batal untuk batch, dan pulihkan UI jika proses gagal. Gagal satu siswa menghasilkan daftar kegagalan yang eksplisit, bukan ZIP yang disebut lengkap tanpa pemeriksaan.

Tautan unduh memakai nama aman yang bermakna: nama produk, jenis laporan, ID/nama yang diizinkan, periode, bahasa, dan versi. Pencetakan/ekspor tidak menyalin kontrol navigasi, tooltip, atau warna dark mode. Verifikasi dengan membuka hasil, bukan hanya mengecek file ada.

## 13. Lazy loading dan anggaran kinerja

### 13.1 Yang dimuat pada saat yang tepat

| Bagian | Kapan dimuat | Fallback/keadaan gagal |
|---|---|---|
| Shell, navigasi, tema, bahasa aktif | Kunjungan awal | Halaman error ringan jika bootstrap gagal; tombol muat ulang yang tetap menjelaskan status data |
| Manifest ringkas kurikulum | Beranda/pemilihan kelas | Metadata cache jika versinya cocok; pesan tidak tersedia jika tidak ada |
| Shard katalog | Kelas/level dipilih | Coba lagi tanpa mereset filter |
| Paket soal | Paket dipilih dan sebelum sesi dimulai | Soal tidak mulai sampai paket lengkap/valid; tersedia alternatif cached |
| Player dan validator | Niat mulai latihan | Mulai dinonaktifkan dengan alasan selama pemuatan; tidak diam tanpa respons |
| Grafik analitik | Bagian grafik terlihat/dibuka | Ringkasan dan tabel tetap bekerja |
| Guru/admin simulasi | Ruang simulasi dibuka | Shell siswa tetap ringan dan bebas fixture demo besar |
| Mesin ekspor | Format dipilih/unduh dimulai | Pesan spesifik dan retry; draft pengaturan laporan tidak hilang |
| Offline manager/service worker UI | Sesudah shell siap; panel saat diminta | Latihan online tetap tersedia jika cache offline tidak didukung |
| Penjelasan lengkap soal | Feedback/review dibuka bila data dipisah | Kunci dan jawaban tetap dapat ditinjau; jangan mengaku pembahasan tersedia bila file gagal |

Lazy loading bukan memuat ulang program untuk setiap soal. Paket sesi sudah tersedia sebelum timer mulai; perpindahan soal di paket tersebut tidak bergantung internet. Prefetch dibatasi pada pilihan yang kuat dan ukuran kecil, dibatalkan saat pilihan berubah, serta tidak menjadi unduhan seluruh bank. Jangan pre-cache ribuan paket pada kunjungan pertama.

Pencarian bekerja pada metadata ringkas, bukan dengan mengimpor setiap paket. Daftar panjang menggunakan pagination atau virtualisasi aksesibel; virtualisasi tidak boleh menghilangkan urutan/total item bagi teknologi bantu. Filter mengetik memakai debounce singkat dan pembatalan hasil usang. Jangan menunda feedback input inti demi animasi.

### 13.2 Anggaran proyek yang wajib diukur

Anggaran berikut adalah target desain proyek yang harus diverifikasi pada build rilis. Satuan **KiB gzip** berarti ukuran transfer terkompresi dengan gzip; catat juga ukuran aktual hosting bila menggunakan Brotli. Anggaran tidak membuktikan kecepatan dengan sendirinya.

| Unit | Target awal | Aturan penerimaan |
|---|---:|---|
| JavaScript awal kumulatif | ≤150 KiB | Tidak termasuk chunk yang memang belum diminta; catat dependensi shared |
| CSS awal | ≤35 KiB | CSS kritis sederhana; tidak memuat seluruh gaya fitur ekspor |
| Bahasa per locale | ≤25 KiB | Bahasa aktif tersedia; chunk kedua dimuat saat diperlukan |
| Manifest root | ≤20 KiB | Metadata ringkas, tanpa isi soal |
| Shard katalog terpilih | ≤50 KiB | Pecah shard bila tumbuh melebihi batas |
| Chunk player tambahan | ≤90 KiB | Validator/core shared tidak dihitung ganda |
| Satu paket soal | ≤60 KiB | Pisahkan data penjelasan/indeks bila perlu; seluruh soal sesi tetap siap sebelum mulai |
| Rute guru/admin masing-masing | ≤150 KiB tambahan | Mesin ekspor dan fixture massal dipisah |
| Font yang dibutuhkan awal | ≤100 KiB total | Jika tidak tercapai, pakai sistem font atau subset berlisensi dengan cakupan glyph lengkap |
| Paket ekspor PDF/DOCX/XLSX/ZIP | Anggaran per-format dicatat | Bukan initial bundle; tidak boleh menurunkan kualitas format untuk mengejar angka arbitrer |

Target respons interaksi lokal: indikator klik/input terlihat dalam ≤100 ms pada profil perangkat uji; hitung/validasi tidak memblokir pengetikan. Pekerjaan berat seperti rekap besar dan ekspor menggunakan worker atau chunk kerja yang memungkinkan UI tetap responsif. Jangan memindahkan pekerjaan sepele ke worker hanya demi nama arsitektur.

Core Web Vitals menilai pengalaman lapangan dengan ambang baik LCP ≤2,5 detik, INP ≤200 ms, CLS ≤0,1 pada persentil ke-75, dipisahkan antara mobile dan desktop.[R8] Target proyek mengikuti angka tersebut. Sebelum publikasi, gunakan pengukuran laboratorium yang direproduksi: cold cache, throttling yang dicatat, viewport/perangkat/browser spesifik, minimal tiga run dan tampilkan median serta rentang. Hasil Lighthouse atau TBT tidak boleh diklaim sebagai INP lapangan. Situs baru dapat belum memiliki data lapangan; tulis status itu secara jujur.

## 14. Offline, versi, dan status data

Panel offline memungkinkan pengguna memilih paket/kelompok yang ingin disimpan, melihat ukurannya, memeriksa versi, dan menghapus cache konten tanpa menghapus riwayat jawaban. Tombol `Hapus paket offline` dan `Hapus hasil latihan` harus terpisah secara visual dan secara implementasi.

Jika pengguna offline, paket cached tetap dapat dikerjakan. Paket belum tersimpan menampilkan `Perlu internet untuk menyiapkan paket ini`, disertai opsi paket tersedia. Jangan menampilkan gambar centang offline sebelum seluruh aset wajib dan versi paket telah tersimpan. Bila unduhan parsial gagal, statusnya belum siap.

Versi aplikasi baru tidak mengambil alih sesi aktif secara paksa. Tawarkan pembaruan setelah sesi aman; pertahankan versi soal yang dipakai attempt lama agar review tetap benar. Jika aset lama hilang, tampilkan masalah versi dan lindungi histori. Detail kebijakan cache mengikuti arsitektur.

| Status internal | Teks ID | Teks EN |
|---|---|---|
| `saved_local` | Tersimpan pada perangkat ini | Saved on this device |
| `pending_sync` | Menunggu pengiriman | Waiting to send |
| `sending` | Sedang mengirim | Sending |
| `mock_accepted` | Diterima dalam simulasi | Accepted in simulation |
| `server_accepted` | Diterima server | Accepted by server |
| `rejected` | Belum diterima; perlu ditinjau | Not accepted; review needed |
| `retry_required` | Pengiriman belum berhasil | Sending was unsuccessful |

Pada rilis statis tanpa remote yang dikonfigurasi, status normal latihan adalah lokal. Jangan membiarkan antrean seolah menunggu server yang sebenarnya belum ada; beri satu penjelasan bahwa LMS belum terhubung. Detail teknis antrean berada di panel diagnostik, bukan mengganggu tiap soal. Percobaan ulang manual tersedia ketika ada tujuan pengiriman yang sah; retry tidak membuat nilai ganda.

Jika penyimpanan perangkat penuh atau tidak tersedia, jelaskan dampak pada sesi tersebut dan beri pilihan ekspor/coba lagi/lanjut sementara dengan persetujuan eksplisit di UI. Jangan menutupi kegagalan dengan pesan sukses. Ekspor cadangan merupakan tindakan pengguna; tidak ada pengiriman otomatis data siswa ke layanan analitik eksternal.

## 15. Komponen dan aksesibilitas

Target produk adalah **WCAG 2.2 AA** untuk alur yang disediakan, dengan verifikasi otomatis dan manual. Ini target penerimaan, bukan sertifikasi hanya karena dokumen ini mencantumkannya.[R3]

### 15.1 Komponen minimum

Button primary/secondary/text; input jawaban; select sederhana; radio/segmented choice; breadcrumb; tab bila memang perlu; disclosure; dialog; toast nonesensial; inline alert; status chip; progress soal; katalog baris; tabel sort/filter; chart dengan tabel; empty state; skeleton; error boundary; download row; report preview; dan language/theme controls.

Setiap komponen memiliki default, hover, focus-visible, active/selected, disabled, loading, success/error bila relevan, serta variasi kedua tema. Disabled memiliki alasan yang dapat dibaca dan bukan sekadar opacity rendah. Aksi yang belum diimplementasikan tidak muncul sebagai tombol aktif pada rilis.

### 15.2 Keyboard dan fokus

Gunakan elemen HTML semantik, satu H1 per layar, skip link, urutan tab sesuai urutan baca, dan nama aksesibel untuk ikon. Fokus tampak dengan ring 2–3 px serta offset yang terlihat. Konten sticky tidak boleh menutupi kontrol yang menerima fokus; WCAG 2.4.11 mensyaratkan fokus tidak sepenuhnya tersembunyi oleh konten yang dibuat aplikasi.[R9] Target produk lebih kuat: kontrol dan labelnya sebisa mungkin terlihat penuh.

Dialog memindahkan fokus ke elemen yang logis, menahan navigasi tab di dalam, menyediakan tombol tutup/batal, mendukung Escape pada dialog yang dapat dibatalkan, dan mengembalikan fokus ke pemicu. Untuk hapus data, fokus awal pada pilihan yang aman. Ikuti pola dialog WAI-ARIA dan uji dengan teknologi bantu.[R10]

Jangan menonaktifkan copy/paste, pemilihan teks, shortcut pembaca layar, zoom, atau menu konteks untuk mengklaim keamanan bank soal. Perlindungan penilaian resmi merupakan urusan arsitektur server; mengganggu aksesibilitas tidak menjaga kunci yang sudah dikirim ke klien.

### 15.3 Sentuh dan pointer

Target sentuh produk minimal 44×44 CSS px; aksi utama dan keypad player minimal 48×48 px dengan jarak sekitar 8 px. Angka 44/48 adalah pilihan desain proyek. WCAG 2.5.8 AA memiliki minimum 24×24 CSS px atau ketentuan jarak/pengecualian tertentu; jangan salah melabeli 44 px sebagai minimum seluruh WCAG AA.[R11]

Semua fungsi hover memiliki padanan fokus/tap. Tidak ada drag sebagai satu-satunya cara mengurutkan/menyeleksi. Tidak ada gestur swipe wajib. Tooltip tidak memuat satu-satunya instruksi penting dan dapat ditutup tanpa kehilangan fokus.

### 15.4 Pembaca layar dan feedback

Pesan hasil/perubahan status memakai live region sopan bila tepat; error submit yang menghalangi harus diumumkan jelas. Jangan mengumumkan semua angka dashboard pada setiap re-render. Timer tidak dibaca tiap detik; berikan pengumuman ambang yang sedikit dan dapat dinonaktifkan, serta waktu tersedia ketika fokus pada kontrol timer.

Jangan menggunakan warna sebagai satu-satunya penanda benar/salah/mastery. Jangan menggunakan bintang sebagai pengganti label hasil yang tepat. Input memiliki label, petunjuk, dan error yang dihubungkan secara semantik. Grafik memiliki judul, rangkuman, dan tabel data. Ringkasan hasil memiliki urutan baca yang masuk akal tanpa bergantung grid visual.

## 16. Microcopy bilingual acuan

| Keadaan | Indonesia | English |
|---|---|---|
| Aksi awal | Mulai latihan | Start practice |
| Ada sesi tersimpan | Lanjutkan latihan | Continue practice |
| Petunjuk | Hitung dalam pikiran, lalu tulis jawabanmu. | Work it out mentally, then enter your answer. |
| Label input | Jawabanmu | Your answer |
| Submit latihan | Periksa jawaban | Check answer |
| Submit evaluasi | Simpan & lanjut | Save & continue |
| Kosong | Tulis jawaban terlebih dahulu. | Enter an answer first. |
| Koma ID | Gunakan koma untuk desimal, misalnya 1,25. | Use a comma in Indonesian number format, for example 1,25. |
| Titik EN | Gunakan titik pada format Inggris, misalnya 1.25. | Use a decimal point, for example 1.25. |
| Pecahan invalid | Tulis pecahan seperti 3/4, dengan penyebut bilangan bulat positif. | Enter a fraction such as 3/4, with a positive integer denominator. |
| Benar | Benar. | Correct. |
| Salah | Belum tepat. Coba periksa kembali. | Not quite. Check your calculation and try again. |
| Lihat strategi | Lihat satu cara menghitung | See one way to calculate it |
| Tidak ada bukti | Belum cukup data untuk menilai penguasaan. | There is not enough evidence to assess mastery yet. |
| Paket nonaktif | Operasi ini belum masuk cakupan level ini. | This operation is not included at this level. |
| Offline belum siap | Paket ini belum tersimpan untuk penggunaan offline. | This pack has not been saved for offline use. |
| Simpan gagal | Jawabanmu belum tersimpan. Coba lagi sebelum melanjutkan. | Your answer has not been saved. Try again before continuing. |
| Simulasi | Ruang simulasi guru — data contoh | Teacher simulation — sample data |
| Lokal | Hasil tersimpan pada perangkat ini. | Results are saved on this device. |
| Hapus cache | Hapus salinan paket offline | Remove offline pack copies |
| Hapus histori | Hapus hasil latihan yang dipilih | Delete selected practice results |
| Ekspor gagal | Laporan belum berhasil dibuat. Pengaturanmu tetap tersimpan. | The report could not be created. Your settings have been kept. |
| Skor belum ada | Belum dievaluasi | Not assessed |

Copy akhir boleh dirapikan untuk konteks, tetapi tidak boleh mengubah makna akademik maupun status data. Hindari slogan `100% aman`, `pasti pintar`, `anti-cheat total`, atau `langsung menguasai`.

## 17. QA visual dan interaksi sebelum rilis

### 17.1 Bukti yang harus disimpan oleh pembangun

1. Screenshot layar utama pada ponsel, tablet, desktop; bahasa Indonesia dan Inggris; terang dan gelap.
2. Screenshot player dengan bilangan bulat pendek, negatif, pecahan, desimal panjang, dan MIX terpanjang yang sah dalam kurikulum.
3. Rekaman/hasil uji keyboard dari memilih paket sampai review; bukti tab order, fokus dialog, dan pengembalian fokus.
4. Pemeriksaan pembaca layar untuk player, hasil, monitoring, dan laporan; catat kombinasi alat/browser yang benar-benar digunakan.
5. Audit kontras token dan keadaan aktual, termasuk input, disabled reason, hover, focus, chart, dan alert.
6. Uji locale/theme saat draft valid, draft belum lengkap, feedback, dialog, pause, dan setelah reload.
7. Uji loading lambat, offline, paket hilang, storage gagal, retry, tab konflik, dan pembaruan versi saat sesi aktif.
8. Network trace yang membuktikan tidak semua bank/mesin ekspor dimuat pada awal; laporan ukuran bundle dan pengukuran kinerja yang dapat diulang.
9. File ekspor nyata yang sudah dibuka/divalidasi untuk setiap format yang ditawarkan; jumlah laporan sesuai cakupan.
10. Perbandingan angka layar hasil, histori, monitoring, dan laporan terhadap fixture akademik yang sama.

### 17.2 Matriks keadaan minimum

| Permukaan | Kasus utama | Kasus kosong/gagal | Kriteria lulus |
|---|---|---|---|
| Navigasi/katalog | 12 kelas, 60 level, 281 aktif | Filter tanpa hasil, shard gagal | Pilihan pulih, kategori nonaktif jelas |
| Player | Semua lima mode | Input invalid, save gagal, duplicate submit | Jawaban/attempt tidak hilang atau terhitung ganda |
| Locale | ID/EN seluruh UI | Terjemahan hilang, separator salah | Tidak ada key mentah, nilai jawaban tidak berubah |
| Tema/responsif | Semua ukuran target | Keyboard terbuka, zoom, landscape pendek | Tidak ada kontrol/teks penting terpotong |
| Hasil/analitik | Sesi benar/salah/skip | N=0, sampel kecil, sesi terhenti | Tidak ada persen palsu/NaN/claim mastery tanpa bukti |
| Monitoring demo | Tugas dibuat/dikerjakan | Siswa belum mulai, data parsial | Hasil fixture dapat ditelusuri; label demo menetap |
| Laporan | Satu siswa dan batch | Export engine gagal, satu item gagal | Isi/label/total benar; hasil parsial tidak disebut lengkap |
| Offline/bridge | Cache lengkap dan outbox | Partial cache, rejected/timeout | Status sesuai ACK dan versi; retry aman |

Auto-check aksesibilitas bukan pengganti pengujian manual. Screenshot bukan bukti fungsi. Build berhasil bukan bukti seluruh PRD terwujud. Temuan yang memengaruhi penyelesaian soal, integritas hasil, aksesibilitas inti, bank yang diwajibkan, atau ekspor yang ditawarkan merupakan blocker rilis.

## 18. Ketentuan serah terima desain

Pembangun menyerahkan token terpusat, komponen reusable, seluruh 18 layar yang relevan, katalog keadaan, bukti QA, dan dokumentasi keputusan yang berubah. Tidak cukup menyerahkan satu landing page atau mock dashboard dengan angka tetap. Tidak perlu membuat backend LMS sekarang, tetapi UI harus mempunyai batas sumber data dan status yang benar sehingga integrasi berikutnya tidak memerlukan penulisan ulang alur belajar.

Apabila suatu target teknis perlu direvisi karena bukti nyata, tulis keputusan, alasan, dampak, dan pengujian penggantinya di laporan implementasi. Jangan menyembunyikan penurunan cakupan dengan mengganti label menjadi `coming soon`. Pada rilis statis final, semua fungsi yang ditampilkan sebagai tersedia harus dapat digunakan dan semua 281 kompetensi aktif harus menunjuk bank yang memenuhi definisi lengkap pada dokumen bank soal.

## Referensi resmi dan konteks sumber

Diakses 25 November 2026. Tautan standar dipakai untuk batas aksesibilitas/kinerja dan perilaku platform. Warna, ukuran lebih besar, navigasi, budget, copy, dan alur produk merupakan keputusan desain KALIBATAKU.

- **[R1]** W3C WAI — [Understanding SC 1.4.3: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- **[R2]** W3C WAI — [Understanding SC 1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- **[R3]** W3C — [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/), khususnya resize text, struktur, keyboard, dan cakupan level AA.
- **[R4]** W3C WAI — [Understanding SC 1.4.10: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- **[R5]** W3C WAI — [Understanding SC 2.2.1: Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html).
- **[R6]** MDN — [inputmode](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode).
- **[R7]** MDN — [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).
- **[R8]** Google web.dev — [Web Vitals](https://web.dev/articles/vitals) dan [Defining Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds).
- **[R9]** W3C WAI — [Understanding SC 2.4.11: Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
- **[R10]** W3C WAI — [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- **[R11]** W3C WAI — [Understanding SC 2.5.8: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- **Sumber kebutuhan produk:** brief pengguna yang disertakan serta `KALIBATAKU_MASTER_CURRICULUM_v1.md` dan `KALIBATAKU_CURRICULUM_REGISTRY_v1.json` dalam ZIP sumber. Koreksi sumber yang disetujui paket pengarahan dijelaskan pada dokumen audit, bukan dilakukan diam-diam oleh desainer.
