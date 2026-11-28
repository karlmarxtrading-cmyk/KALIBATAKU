# Definisi metrik, evidence dan laporan parents meeting

Versi: `analytics-local-v1` · 25 November 2026. Semua ambang dalam dokumen ini merupakan kebijakan awal produk yang dapat dikonfigurasi, bukan norma nasional atau hasil penelitian kalibrasi pengguna. Definisi ini menyelesaikan ambiguitas teknis dari brainstorming tanpa mengubah cakupan kurikulum.

## 1. Rekaman yang dipakai

Satu attempt menyimpan snapshot daftar butir yang benar-benar ditugaskan, versi paket dan kebijakan. Setiap `question_instance_id` membedakan posisi sebuah butir dalam sesi; fingerprint mengidentifikasi bukti independen. Respons yang sama akibat double-click atau replay event tidak menjadi dua jawaban. Form selesai mempunyai paling banyak satu **respons final terhitung per instance**, beserta history jawaban pertama/revisi/retry yang tetap tersimpan.

`Practice` bisa mempunyai beberapa percobaan setelah feedback; `Assessment` bisa mempunyai revisi sebelum feedback final. Keduanya tidak boleh diperlakukan sama pada analitik. History percobaan setelah petunjuk bukan tambahan peluang pertama yang independen. Assessment dengan draft terbaru invalid setelah pernah menyimpan nilai valid tidak boleh memakai nilai lama sebagai final secara diam-diam: blokir finalisasi sampai draft diperbaiki atau dipilih kosong; pilihan kosong masuk B, bukan W. Dataset demo, local practice dan data LMS terverifikasi dikelompokkan terpisah; filter default tidak mencampurkannya.

## 2. Definisi matematika

Untuk form selesai: N = butir ditugaskan, C = final benar, W = final salah, S = skip eksplisit, B = kosong, U = belum sempat ditampilkan. Berlaku `N=C+W+S+B+U`. Untuk form yang kehabisan waktu, B/U tetap berada pada denominator skor form. Input invalid sebelum finalisasi merupakan masalah format, bukan W.

| Metrik | Rumus/kebijakan | Tampilan |
|---|---|---|
| Skor form | `100*C/N`, N>0 | Label “Skor paket”; denominator seluruh butir |
| Akurasi respons valid | `100*C/(C+W)`, denominator>0 | Label “Akurasi jawaban”; skip/blank terpisah |
| Respons terselesaikan | `100*(C+W+S)/N` | Label “Soal ditanggapi”; skip tetap terlihat |
| Form selesai | State submitted/completed | Tidak disamakan dengan semua butir dijawab |
| Akurasi gabungan | `100*sum(C)/sum(C+W)` untuk kelompok sebanding | Jangan rata-rata persentase tanpa bobot |
| Skor gabungan | `100*sum(C)/sum(N)` form selesai dan sebanding | Cantumkan jumlah form dan butir |
| First-response accuracy | Benar pada respons numerik pertama / semua respons numerik pertama | Pisahkan hint, retry dan mode |
| Evidence mastery | Benar pada kesempatan eligible pertama per fingerprint / jumlah fingerprint eligible termasuk skip/blank/unseen yang ditugaskan pada form selesai | Denominator tidak bisa ditingkatkan dengan hanya menjawab soal mudah |
| Waktu aktif | Durasi terlihat/aktif menurut policy timer | Client estimated; bukan ukuran perhatian otak |
| Kecepatan benar | Median/P90 waktu respons benar pertama tanpa hint | Wajib N dan kualitas data; data invalid dikeluarkan dengan count |
| Perubahan skor | Skor akhir − skor awal pada form sebanding | Poin persentase (pp) |
| Cakupan penguasaan | Kompetensi mastered / kompetensi aktif yang ditargetkan | Belum diuji tetap status terpisah |

N=0 atau denominator nol menghasilkan `null`/“Belum ada data”, bukan 0 atau NaN. Jangan mengubah incomplete attempt menjadi skor 0 pada rekap; tampilkan status ongoing/abandoned dan statistik yang sudah ada tanpa menyamakannya dengan evaluasi selesai. Kegagalan sinkronisasi tidak mengganti skor lokal menjadi nol.

## 3. Fixture angka yang harus menghasilkan keluaran sama di semua format

**Fixture A:** form 20 soal: 14 benar, 3 salah, 2 skip, 1 blank, 0 unseen. Skor 70%; akurasi 14/17 = 82,3529…%, ditampilkan 82,4%; soal ditanggapi 19/20 = 95%. Form dapat berstatus selesai walau satu kosong. Ketiga persentase benar tetapi menjawab pertanyaan berbeda.

**Fixture B:** form 10 soal hanya 5 dijawab dan semuanya benar; 5 blank. Skor 50%, akurasi 100%, soal ditanggapi 50%. Status mastery tidak boleh muncul hanya karena akurasi respons 100%.

**Fixture C:** dua form sebanding, pertama 9/10 benar tanpa skip, kedua 50/100 benar. Akurasi gabungan 59/110 = 53,636…%, ditampilkan 53,6%; bukan `(90+50)/2=70%`. Jika blueprint tidak sebanding, jangan membuat satu klaim tren kemampuan meski rekap aktivitas tetap dapat menjumlahkan respons.

**Fixture D:** butir 24×4 dijawab 92, lalu 96 setelah melihat petunjuk. First response salah; current/final practice response benar; retry count 1; hint used true; eligible mastery evidence false. Waktu jawaban kedua tidak menggantikan waktu respons pertama.

**Fixture E:** hasil awal 58%, akhir 86%, form setara. Perubahan 28 pp. Label “+28%” tidak dipakai untuk menyatakan selisih persentase. Bila berbeda kompetensi/level, tampilkan dua observasi dengan konteks dan tanpa panah klaim peningkatan yang sebanding.

**Fixture F:** dataset 0 sesi mempunyai semua metrik null, teks “Belum ada hasil”, dan tombol mulai latihan. Dashboard tidak otomatis mengisi contoh prestasi agar terlihat menarik.

## 4. Kebijakan mastery

`mastery-local-v1` menggunakan siklus evaluasi (`assessment_cycle_id`) dengan masa berlaku maksimum 60 hari sebagai keputusan implementasi awal. Lookback laporan boleh mencakup beberapa siklus, tetapi evidence penguasaan tidak digabung lintas siklus tanpa jejak. Syarat: minimal dua form selesai yang sebanding, tanpa hint, minimal 24 jam terpisah secara default (dapat diatur guru/policy), skor setiap form ≥80%, akurasi unique evidence ≥90%, dan unique count ≥min(20,pool_size) dengan minimum 8. Pada rumus syarat penguasaan, gunakan nama `pool_size` untuk ukuran pool kanonik terverifikasi, bukan jumlah random seed; jangan mencampurkannya dengan U (unseen) pada rumus skor.

Jika pool_size tidak diketahui eksak tetapi constructive pool ≥20 telah tersedia, target sampel tetap 20. Jika pool_size<8 terbukti, minta tinjauan guru pada konteks institusi; versi lokal menampilkan “Bukti terbatas”, bukan membuat identitas guru palsu. Istilah “sebanding” memeriksa form family, strata template, target, panjang/blueprint, waktu, mode, bantuan dan versi kebijakan. Mengulang form yang sama berkali-kali tidak memperbesar unique count.

Kesempatan eligible pertama untuk suatu fingerprint dalam siklus menjadi bukti. Outcome-nya adalah respons FINAL pada form pertama tersebut, setelah revisi yang sah sebelum feedback; ini berbeda dari first-response accuracy yang menggunakan respons numerik pertama. Skip, blank dan assigned-unseen semuanya dihitung tidak benar dalam denominator evidence. Untuk form kumulatif, gunakan slice per kompetensi target dan periksa ukuran/blueprint slice; skor total tinggi tidak dapat menutupi kelemahan satu kompetensi. Jika butir di-skip pada form selesai lalu benar pada form berikutnya dalam siklus yang sama, bukti pertama tetap skip; progress remedial ditampilkan terpisah. Setelah sesi penguatan/recovery tercatat, pengguna dapat memilih evaluasi ulang yang membuka siklus baru dengan pemicu dan tanggal mulai, bukan membuang hanya jawaban salah. Siklus baru memerlukan dua pengerjaan baru dengan attempt/form_instance_id baru (boleh menggunakan form A/B yang tersedia; exposure dan overlap tetap dicatat) dan semua syarat yang sama; histori serta jumlah exposure lama tetap terlihat. Pool 12 dengan dua salah pada siklus pertama dapat membuktikan pemulihan melalui siklus baru, tanpa harus menunggu 60 hari dan tanpa mengklaim 12 butir itu belum pernah dilihat. Catat cycle_id, cutoff, trigger, prior exposure dan policy_version.

Status: `not_started`, `insufficient_evidence`, `developing`, `mastered_provisional`, `mastered_verified`. `review_due` adalah flag tambahan dan tanggal review, bukan penghapus status. Hanya layanan tepercaya institusi dapat menerbitkan verified; nilai dari browser yang mengirim field verified tidak dipercaya. Status seluruh level dikuasai memerlukan seluruh kompetensi aktif pada level tersebut. Penyelesaian subset pilihan hanya menghasilkan status target individual tercapai; navigasi tetap memungkinkan remediasi/pengayaan per operasi.

## 5. Waktu, kondisi dan kualitas data

Gunakan clock monotonic untuk interval selama dokumen hidup, timestamp untuk identitas kejadian/recovery, serta deadline wall-clock untuk merekonstruksi sesi bertimer setelah reload dengan label kualitas. Durasi input mencakup berpikir dan mengetik; jangan memisahkan keduanya tanpa instrumen.

Practice tanpa batas dapat pause saat hidden dan pengguna dapat pause manual. Speed tetap menghabiskan batas waktu ketika hidden. Assessment mengikuti kebijakan yang dipin, dengan no-limit default. `active_duration_ms` dan `elapsed_duration_ms` berbeda; kualitas `valid_client_estimate`, `resumed_estimate`, `interrupted`, `clock_anomaly`, atau `unavailable` disimpan.

Jangan mendeteksi tidak bergeraknya keyboard sebagai tidak berpikir; timer aktif tidak dihentikan hanya karena siswa diam. Peristiwa hidden atau window focus bukan bukti kecurangan. Durasi yang mustahil, clock anomaly, atau storage recovery masuk statistik kualitas, bukan label negatif siswa. Median/P90 ditampilkan setelah minimal 10 observasi relevan; sebelumnya tampilkan N tanpa klaim tren kuat. Gunakan nearest-rank untuk P90 dan rata dua nilai tengah untuk median N genap; policy dicatat agar semua exporter sama.

## 6. Perbandingan dan rekomendasi

Analisis mengelompokkan competency_id, operation, material_grade, level, template strata, mode, assistance, form family dan policy_version. Dataset kelas memakai weighting respons untuk angka kelas serta distribusi per siswa; jangan menyimpulkan satu siswa lemah dari rata-rata kelas. Ranking publik tidak wajib dan bukan default.

Rekomendasi deterministik memprioritaskan: bukti kurang → kumpulkan bukti; ketepatan rendah berulang → latihan prasyarat; ketepatan berkembang → variasi target; syarat mastery terpenuhi → pengayaan/review; timer hanya menambah konteks. Tampilkan satu langkah berikutnya yang jelas dan satu alasan singkat. Kontradiksi antar mode dinyatakan, bukan digabung menjadi satu skor kecerdasan.

Deteksi error memakai pola hasil yang bisa diverifikasi, misalnya jawaban bernilai negatif dari kunci positif, berbeda faktor 10, atau selisih kecil. Label “indikasi pola” harus disertai contoh dan N; tidak mengklaim penyebab psikologis, gangguan belajar, kelalaian atau strategi yang benar-benar dipakai. Catatan guru dapat memperkaya konteks dengan author/time/revision.

## 7. Isi laporan parents meeting

Laporan individual terdiri dari: identitas minimal/alias dan kelas administratif bila ada; kelas materi; periode serta timezone; asal data/status verifikasi; ringkasan aktivitas; skor dan akurasi dengan denominator; profil ADD/SUB/MUL/DIV/MIX; kompetensi belum diuji; perubahan yang sebanding; kekuatan teramati; prioritas latihan; target periode berikutnya; catatan guru; metadata report/version; ruang tindak lanjut orang tua jika diinginkan.

Tidak perlu semua angka mentah pada halaman pertama. Gunakan satu ringkasan, tabel kompetensi dan satu visual sederhana bila data cukup. Lampiran sesi/jawaban menjadi bagian opsional laporan panjang. PDF dan DOCX mempunyai heading, header tabel berulang, penomoran halaman, font tertanam/tersedia secara sah, margin dan page break yang diperiksa; tidak ada tabel terpotong atau warna gelap yang tercetak sebagai blok tinta.

Contoh kalimat otomatis bilingual:

| Kondisi | Indonesia | English |
|---|---|---|
| Evidence cukup, DIV lebih rendah | “Pembagian menjadi prioritas latihan berikutnya berdasarkan 24 respons pada materi yang sebanding.” | “Division is the next practice priority based on 24 responses on comparable material.” |
| Evidence kurang | “Data belum cukup untuk menyimpulkan penguasaan kompetensi ini.” | “There is not enough evidence to determine mastery of this competency.” |
| Perubahan setara | “Skor meningkat 12 poin persentase pada dua evaluasi dengan blueprint yang setara.” | “The score increased by 12 percentage points across two assessments with comparable blueprints.” |
| Berbeda level | “Hasil berasal dari tingkat materi berbeda; tampilkan sebagai riwayat, bukan perubahan skor yang setara.” | “The results come from different material levels and are shown as history, not as a comparable score change.” |

Jangan menulis “berkembang pesat” dari satu observasi, “menguasai” ketika belum memenuhi bukti, atau “lambat” sebagai atribut kepribadian. Orang tua menerima rencana latihan spesifik dan realistis, bukan jargon mesin analitik.

## 8. Format ekspor dan sumber kebenaran

| Format | Struktur |
|---|---|
| PDF | Report individual siap baca/cetak; data dan locale sama dengan preview |
| DOCX | Struktur editable yang mempertahankan heading/tabel dan status data |
| XLSX | Sheet ringkasan, kompetensi, sesi, kamus data dan metadata; tipe angka benar |
| CSV | UTF-8 dengan quoting sesuai delimiter; pilihan delimiter bila diperlukan; sanitasi formula teks |
| JSON | Canonical machine data beserta schema/version/provenance; backup berbeda kontrak dari report |
| ZIP | Kumpulan laporan terpilih + manifest sukses/gagal + metadata periode |

Exporter menerima `ReportSnapshot` yang sama dari analytics engine. Hitung sekali dengan kebijakan yang dipin, format sesuai locale terakhir; jangan menerapkan rumus berbeda per exporter. Pembulatan untuk tampilan satu desimal, nilai exact/precision internal disimpan untuk audit. Waktu disimpan UTC dan ditampilkan menurut timezone pilihan yang tercetak di laporan; periode akhir menggunakan batas eksklusif pada query agar hari terakhir tidak hilang.

Batch besar diproses per siswa dengan concurrency terbatas, progress dan tombol batal; memori dilepas setelah blob diunduh. Blob URL dicabut setelah aman; jangan menganggap file tersimpan ke disk hanya karena object URL dibuat. Kesalahan sebagian menghasilkan manifest yang menjelaskan file mana gagal. PDF wajib dapat diunduh langsung jika UI menyebut “Unduh PDF”; print browser adalah fitur tambahan.

## 9. Pengujian laporan

Fixture A–F wajib cocok di player/result, teacher/admin, PDF, DOCX, XLSX, CSV dan JSON. Uji dua bahasa + bilingual, dua tema layar dengan print theme terang, nama panjang, judul panjang, data kosong, banyak halaman, denominator nol, periode lintas bulan, pecahan, nilai negatif dan label simbol. Batch ZIP diverifikasi dapat dibuka, total file cocok, nama aman, data setiap siswa tidak tertukar. Bukti visual PDF/DOCX harus nyata dari renderer, bukan klaim bahwa template rapi karena HTML terlihat baik.

Status demo dan lokal harus masuk teks dokumen, bukan hanya badge web yang hilang saat ekspor. Data yang belum dikirim atau belum diverifikasi tetap demikian setelah unduh. Admin produksi nantinya memerlukan authorization dan audit server sebelum mengekspor data siswa lain; versi statis hanya memakai dataset yang tersedia pada perangkat/demo.
