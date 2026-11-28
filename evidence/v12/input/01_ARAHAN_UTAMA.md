# A1. Arahan UI/UX untuk pengalaman belajar yang paling mudah

## 1. Tujuan produk dan ukuran keberhasilan

KALIBATAKU adalah latihan berhitung mental bilingual untuk tambah, kurang, kali, bagi dan campurannya, dengan paket menurut kelas dan level. Pengalaman yang dituju sederhana: siswa memahami materi yang dipilih, menjawab dengan nyaman, langsung mengerti hasilnya, lalu mengetahui tindakan berikutnya. Guru memahami bukti pengerjaan; orang tua mendapatkan penjelasan yang mudah dibaca; admin memahami data apa yang benar-benar tersedia.

“Maksimal” dijadikan sasaran yang dapat diperiksa: tidak kehilangan jawaban, status mudah dipahami, matematika terbaca, bahasa konsisten, kontrol dapat dipakai di perangkat sasaran, laporan memiliki konteks, dan pengguna nyata dapat menyelesaikan tugas. Keindahan visual mendukung sasaran itu. Label 100% hanya boleh merujuk cakupan pengujian tertentu yang telah terpenuhi, bukan jaminan tanpa batas.

Versi 1.1.0 telah memperbaiki integritas draf dan beberapa konteks guru. Pertahankan perbaikan tersebut ketika menyederhanakan layar. Bank saat ini memuat 12 kelas, 60 kombinasi kelas–level dan 281 kompetensi aktif; 19 kombinasi tidak aktif memiliki alasan kurikulum. Kelas materi dan level kemampuan bukan label kecerdasan anak. Jangan mengaktifkan kombinasi kosong dengan soal acak hanya agar seluruh kotak terlihat terisi. [B/04; B/BUKTI_BARU/package_scan_results.json]

## 2. Prinsip interaksi yang menjadi kontrak

| Prinsip | Perilaku yang harus terlihat |
|---|---|
| Satu keputusan utama setiap saat | Sebelum diperiksa: OKE · Periksa jawaban. Setelah hasil: Soal berikutnya. Soal terakhir: Tinjau hasil. |
| Hasil tidak tersembunyi | Mode belajar menampilkan jawaban siswa dan kunci pada kartu yang sama sesudah OKE sah. |
| Nilai dan status simpan terpisah | “Benar” tidak berarti “sudah tersimpan ke server”. Setiap status memiliki label sendiri. |
| Perubahan konteks aman | Bahasa, tema, bantuan, navigasi dan pemuatan modul menjaga draf, sesi, profil dan asal data. |
| Bantuan sesuai kebutuhan | Instruksi singkat terlihat; langkah panjang, pilihan lanjutan dan rincian teknis dibuka saat diperlukan. |
| Makna matematika terjaga | Tampilan mengikuti AST dan metadata penyajian, tanpa mengubah operand, grouping atau ketelitian. |
| Pengguna mengendalikan tempo | Tidak ada perpindahan otomatis sesudah hasil; tenggat pada mode Kecepatan dijelaskan sejak awal. |
| Bukti lebih penting daripada badge | Lulus tes hanya diklaim untuk build, perangkat, bahasa, tema dan alur yang benar-benar diuji. |

## 3. Struktur navigasi menurut peran

Ruang siswa menjadi halaman awal: profil aktif, lanjutkan sesi bila ada, materi terakhir, dan tombol **Mulai latihan**. Menu sekunder berisi riwayat, pengaturan, bantuan dan ruang guru. Menu tetap dapat ditemukan tanpa mengalahkan latihan. Peralihan peran pada build statis diberi label simulasi; tampilan tombol bukan otorisasi server.

Guru masuk ke kelas yang dipantau, memilih siswa, membaca bukti, membuat rencana atau penugasan dan menyiapkan laporan. Identitas siswa tetap terlihat saat berpindah langkah. Admin memilih sumber data dan periode sebelum mengekspor. Orang tua membaca ringkasan bahasa sehari-hari dengan contoh, tanggal, asal data dan rencana pendampingan.

### Spesifikasi layar dan hasil yang diharapkan

| Layar/keadaan | Informasi terpenting | Aksi utama dan perilaku |
|---|---|---|
| Beranda baru | Nama aplikasi, manfaat singkat, bahasa, profil | Buat/pilih profil lokal, lalu mulai; bantuan singkat tersedia. |
| Beranda kembali | Profil aktif dan sesi belum selesai | Lanjutkan sesi; memulai baru menjelaskan nasib sesi lama. |
| Profil | Nama panggilan, kelas materi, perangkat tempat menyimpan | Pilih profil; penjelasan sederhana bila perangkat dipakai bersama. |
| Pengaturan materi | Kelas, level dan operasi yang tersedia beserta tujuan | Materi terakhir menjadi awal; perubahan tidak membuka banyak panel sekaligus. |
| Kombinasi belum tersedia | Alasan kurikulum, pilihan materi terdekat | Pilih alternatif; tidak mengesankan bahwa server rusak. |
| Pengaturan sesi | Mode, jumlah soal, perkiraan waktu, aturan kunci | Mulai; ID paket, seed dan informasi mesin di rincian lanjutan. |
| Sesi memuat | Soal/renderer sedang disiapkan | Indikator, ulangi bila gagal; timer menunggu kesiapan tampilan awal. |
| Sesi mengisi | Nomor soal, ekspresi, input berlabel | OKE; Enter setara; keypad matematika membantu caret/seleksi. |
| Input belum sah | Lokasi masalah dan contoh yang relevan | Perbaiki jawaban; draf tetap ada, belum dinilai salah. |
| Hasil benar | Status, jawaban siswa, kunci, cara singkat | Soal berikutnya; ucapan status satu kali. |
| Hasil belum tepat | Status netral, jawaban siswa, kunci, cara singkat | Soal berikutnya; revisi opsional dilabeli setelah melihat kunci. |
| Soal terakhir | Kartu hasil dan jumlah yang sudah dijawab | Tinjau hasil, bukan “siap untuk soal berikutnya”. |
| Tinjau sebelum kirim | Terjawab, kosong, dilewati dan belum dilihat | Kembali memperbaiki atau kirim final, tanpa kehilangan draf sah. |
| Ringkasan sesi | Respons pertama dan hasil setelah belajar dibedakan | Lihat pembahasan, latihan sejenis atau kembali. |
| Riwayat | Tanggal, materi, mode, asal data dan status | Buka satu sesi; filter tidak mengganti profil/asal data. |
| Monitoring guru | Kelas, periode, siswa yang perlu ditinjau dan alasan | Buka bukti siswa; urutkan dengan konteks, tanpa peringkat memalukan. |
| Bukti siswa | Respons pertama, perubahan, bantuan dan contoh soal | Catat rencana; draf catatan aman saat ganti bahasa. |
| Penugasan | Penerima, materi, mode, tenggat dan aturan hasil | Tinjau, lalu simpan; penerima dari detail tetap dipilih. |
| Laporan | Sumber, siswa, periode, bahasa dan pratinjau | Unduh satu format; reset hanya mereset filter yang dijelaskan. |
| Pengaturan/data | Bahasa, tema, aksesibilitas, paket offline, ekspor cadangan | Pilihan bernama jelas; penghapusan data menjelaskan akibat dan cadangan. |

## 4. Susunan layar siswa

Bagian atas memuat profil kecil dan progres “Soal 3 dari 10”. Judul materi singkat berada di bawahnya. Ekspresi menjadi pusat visual, diikuti input berlabel **Jawabanmu**, petunjuk format yang sesuai soal, dan tombol utama. Bantuan tidak bertumpuk dengan tombol keluar atau selesai. Saat hasil muncul, kartu ditempatkan tepat di bawah input tanpa mendorong tombol utama keluar dari jangkauan layar kecil.

Pada ponsel, gunakan satu kolom dengan ruang jari yang cukup; kelompok jawaban dan tombol boleh menempel pada bagian bawah hanya jika aman terhadap keyboard virtual, safe-area dan pembesaran teks. Pastikan pengguna tetap dapat menggulir ke seluruh rumus dan kartu hasil. Pada desktop, lebar area belajar nyaman, bukan melebar ke seluruh layar hanya karena ruang tersedia. Dashboard guru dapat lebih lebar, tetapi panel detail tidak menutupi konteks siswa.

Simpan input mentah sebagai respons historis; tampilan matematika ternormalisasi boleh ditambahkan di sebelahnya. Untuk pecahan ekuivalen, tampilkan “Nilainya sama” bila relevan, misalnya siswa `21/12` dan kunci `7/4`. Keterangan ini memperjelas alasan diterima tanpa memaksa siswa mengubah respons historis.

## 5. Sistem visual, tema dan aksesibilitas

Gunakan skala jarak konsisten 4/8/12/16/24/32/48 piksel CSS; ukuran teks antarmuka awal 16–18 piksel, judul bertingkat dan panjang paragraf terkendali. Angka soal lebih besar daripada metadata. Gunakan font matematika khusus untuk struktur rumus dan font UI untuk kalimat; jangan menerapkan letter-spacing negatif UI pada pecahan atau operator. Angka matematika tidak dipaksa mengecil agar rumus panjang masuk satu baris.

Target produk untuk kontrol utama/keypad adalah **48 × 48 piksel CSS atau lebih**, dengan jarak yang mencegah salah tekan. Ini pilihan desain untuk kenyamanan, bukan klaim bahwa WCAG AA mensyaratkan 48 piksel. WCAG 2.2 SC 2.5.8 memiliki ambang 24 × 24 dengan sejumlah pengecualian. [R1]

Warna gelap/terang memakai token semantik: latar, permukaan, teks, teks sekunder, batas, aksi, sukses, perlu diperbaiki dan fokus. Status mempunyai kata dan ikon, sehingga warna bukan satu-satunya petunjuk. Token awal tersedia di `DESIGN_TOKENS.json`; rasio pasangan warna yang dihitung tersedia di `TOKEN_CONTRAST_CHECK.csv`. Pemeriksaan token ini tidak menggantikan inspeksi hover, disabled, fokus, high contrast dan hasil render aktual.

Gunakan fokus terlihat, urutan heading, label input, navigasi keyboard, pesan status yang tidak berulang dan pengaturan reduced motion. Layar harus mempertahankan informasi dan fungsi pada lebar setara 320 piksel CSS; reflow dan pembesaran teks adalah pemeriksaan yang berbeda. Area dua dimensi yang memang diperlukan ditangani khusus, tanpa menyebabkan seluruh halaman ikut bergulir horizontal. [R2]

Semua state wajib diuji pada kedua tema: normal, hover, focus, pressed, disabled, invalid, saving, saved, offline dan retry. Tema sistem dapat menjadi default, disertai pilihan Terang/Gelap/Sistem yang persisten. Pergantian tema tidak mereset jawaban atau membuat MathJax menghitung ulang nilai.

## 6. Bilingual yang mempertahankan makna

Gunakan satu kamus pesan dengan parameter, plural/jumlah yang tepat dan padanan istilah yang dipahami siswa. Indonesia memakai “bilangan bulat”; Inggris memakai “integers” ketika contoh mencakup negatif. “Whole numbers” tidak digunakan untuk contoh −3. Bahasa antarmuka, bahasa laporan dan bahasa data historis dibedakan bila memang berbeda.

Desimal Indonesia memakai koma, Inggris titik. Parser input dan formatter tampilan memiliki kontrak yang sama; jangan menambahkan pemisah ribuan pada input bila parser belum mendukungnya. Slash pada input pecahan tetap boleh digunakan, sementara hasilnya ditata sebagai matematika. Format pecahan campuran dan bentuk lain hanya ditawarkan jika benar-benar didukung parser serta kebijakan soal.

Pergantian bahasa menjaga nilai draf, respons pertama, posisi soal, pembahasan terbuka dan fokus yang masuk akal. Draf yang belum lengkap seperti `-` atau `1/` dipertahankan sebagai teks, bukan dipaksa dikonversi. Catatan guru dan identitas siswa tidak diterjemahkan otomatis. Teks laporan harus menjelaskan “respons pertama”, “setelah bantuan” dan asal data tanpa istilah teknis yang tidak diperlukan.

## 7. Lazy loading yang terasa cepat

Muat cangkang, navigasi dan pengaturan dasar terlebih dahulu. Modul siswa, dashboard guru, pembuat laporan dan ekspor dimuat sesuai rute atau tindakan. Paket bank tetap dimuat per paket; jangan mengimpor 4.604 paket pada halaman awal. Prefetch terbatas dapat dilakukan setelah pengguna menunjukkan pilihan materi, dengan mempertimbangkan koneksi dan cache.

Lazy interaction berarti pekerjaan mahal ditunda sampai dibutuhkan sambil menjaga klik pertama. Saat pengguna menekan “Unduh laporan”, status segera berubah menjadi “Menyiapkan laporan”; pemuatan modul tidak membuat pengguna perlu menekan dua kali. Kesalahan memiliki tindakan ulangi yang menjaga filter dan pilihan siswa. Worker untuk olahan besar, pembatalan dan pembatasan DOM diterapkan sesuai pengukuran.

MathJax dimuat saat diperlukan, dengan renderer/font yang siap sebelum timer awal sesi berjalan. Perubahan angka input atau tick timer tidak memproses ulang seluruh rumus. Pemuatan, penilaian, penyimpanan dan sinkronisasi adalah keadaan terpisah. Rincian implementasi ada pada A3.

Ukur cold/warm/offline, perangkat sasaran dan jaringan lambat. Sasaran Core Web Vitals untuk pengalaman baik adalah LCP ≤2,5 detik, INP ≤200 ms dan CLS ≤0,1, dinilai pada persentil ke-75 data pengguna bila data lapangan sudah tersedia. Angka laboratorium digunakan untuk menemukan masalah, bukan diklaim sebagai data lapangan. [R3]

## 8. Laporan yang membantu percakapan keluarga

Halaman pertama menjawab empat hal: yang sudah terlihat, bagian yang masih perlu latihan, contoh bukti, dan rencana sederhana berikutnya. Cantumkan materi, rentang waktu, jumlah sesi/respons dan bantuan yang digunakan. Data sedikit diberi kalimat yang proporsional; satu respons tidak dijadikan diagnosis kemampuan anak.

Respons pertama tanpa bantuan dan jawaban akhir setelah belajar dijelaskan terpisah. Setelah kunci otomatis diperlihatkan, revisi jawaban memiliki konteks bantuan yang jelas. Tampilkan asal “latihan lokal”, “simulasi”, atau “terverifikasi server” sesuai keadaan nyata. Label data tersinkron tidak berarti penilaian sudah diverifikasi server.

Pratinjau HTML tetap berguna bagi pembaca layar dan pengguna yang tidak mengunduh PDF. PDF, DOCX, XLSX, CSV, JSON dan ZIP memiliki kontrak keluaran berbeda. Keindahan matematika web perlu diteruskan melalui adapter PDF/Word; CSV/JSON lebih mengutamakan nilai dan struktur yang dapat dianalisis. Pilih data/siswa dahulu, baru format, lalu unduh. Pesan gagal menyebut tindakan yang bisa dilakukan.

## 9. Data lokal dan jembatan LMS

Latihan lokal tetap dapat berjalan sesuai paket yang telah tersedia. Beri tahu pengguna tempat hasil disimpan dengan kalimat pendek. Profil lokal bukan akun institusi. Sistem sinkronisasi menampilkan tahap lokal → menunggu kirim → diterima server → terverifikasi sesuai fakta. Simulasi guru dipisahkan dari data pribadi dan status filter mempertahankan sumbernya.

Untuk integrasi sekolah, adapter melayani identitas, otorisasi per kelas, event idempotent, retry, ACK dan penilaian server. Kunci berada pada file statis sehingga aplikasi mandiri tidak menjanjikan kerahasiaan ujian berisiko tinggi. Ini batas arsitektur yang harus dinyatakan dalam penggunaan, bukan alasan mempersulit latihan harian. Server kemudian menentukan akses dan validitas hasil institusional.

## 10. Uji kemudahan bersama pengguna

Jalankan uji formatif pada siswa dari beberapa rentang kelas, guru, admin dan orang tua, termasuk pengguna ponsel dan teknologi bantu. Contoh tugas siswa: mulai latihan, masukkan pecahan, periksa hasil, jelaskan beda jawaban sendiri dan kunci, lanjutkan sesi, temukan riwayat. Guru: telusuri siswa dan buat penugasan dengan penerima yang benar. Orang tua: jelaskan hasil pertama, bantuan dan rencana dari laporan.

Catat berhasil mandiri, berhasil dengan bantuan, gagal, waktu, salah tekan, salah tafsir dan alasan. Target awal usulan untuk tugas kritis adalah ≥90% penyelesaian tanpa bantuan pada peserta yang diuji serta nol kehilangan jawaban; ukuran sampel dan denominator harus ditampilkan. Hasil kelompok kecil merupakan masukan desain, bukan statistik seluruh populasi. Ulangi setelah masalah besar diperbaiki. Jangan menandai pilot lulus bila peserta atau pengamatan belum ada.

### Rujukan

- R1: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- R2: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- R3: https://web.dev/articles/vitals

Semua ukuran tambahan dan susunan layar di dokumen ini adalah target desain hasil audit, bukan bukti bahwa versi 1.1.0 telah memenuhinya.
