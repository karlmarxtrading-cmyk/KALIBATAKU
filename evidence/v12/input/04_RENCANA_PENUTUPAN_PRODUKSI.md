# Rencana penutupan produksi: dari 1.1.0 ke versi berikutnya

**Tanggal: 26 November 2026. Status dokumen: arahan implementasi dan pengujian; seluruh pekerjaan masa depan dimulai sebagai NOT_RUN.**

## 1. Hasil yang harus dicapai

Versi berikutnya harus memberi pengalaman yang jelas: siswa menulis jawaban, menekan **OKE · Periksa jawaban**, lalu langsung melihat **Benar/Belum tepat**, **Jawabanmu**, **Kunci jawaban**, dan cara singkat pada soal yang sama. Matematika harus ditampilkan dengan struktur yang nyaman dibaca, termasuk pecahan, negatif, desimal, dan operasi campuran. Kebutuhan ini berlaku pada latihan dengan feedback langsung; evaluasi mandiri mempertahankan penahanan kebenaran/kunci sampai pengiriman akhir.

Keputusan produksi tetap berdasarkan bukti. Paket 1.1.0 menyatakan HOLD: 63 dari 73 kriteria wajib statis lulus. Rencana ini menutup kebutuhan baru sekaligus sepuluh gate statis yang masih terbuka; ia tidak menyatakan pekerjaan itu sudah dilakukan. Sumber acuan ialah `ACCEPTANCE_RESULTS.csv`, `STATUS_RILIS.md`, `KNOWN_LIMITATIONS.md`, serta audit baru feedback dan matematika.

Ada dua daftar penerimaan yang harus berjalan bersama. **AC-001–AC-080** adalah daftar sumber yang dipertahankan untuk regresi dan penerimaan lama. **Keluarga FM** adalah daftar tambahan untuk feedback langsung dan penyajian matematika pada revisi ini. Gunakan nomor FM dari matriks baru; jangan mengganti nama AC lama menjadi FM atau menyalin PASS 1.1.0 sebagai hasil build baru. Satu tes dapat mendukung beberapa kriteria, tetapi hubungan dan batas cakupannya harus ditulis.

## 2. Fase pertama — pertahankan perbaikan yang sudah terbukti

**Pemilik: penanggung jawab frontend, data, dan QA.** Bekukan identitas baseline ZIP dan hash distribusi; kerjakan pada salinan terpisah. Pertahankan 4.604 paket, 177.640 penempatan soal, 168.142 ekspresi kanonis unik, serta snapshot dan versi konten yang dipakai sesi lama. Perubahan presentasi tidak boleh mengubah nilai rasional, fingerprint atau kunci hanya agar hasil layar tampak cocok.

Simpan reproduksi sebelum/sesudah untuk kehilangan draf, reset sumber laporan, target penugasan, dan pergantian bahasa pada catatan guru. Pada versi berikutnya, jawaban valid yang diketik tetap aman saat navigasi/finalisasi; respons pertama tidak berubah setelah revisi; reset laporan tetap pada sumber/siswa semula; tugas dari detail siswa tetap menuju siswa itu; perubahan bahasa/tema menjaga pekerjaan.

**Syarat keluar:** verifikasi integritas baseline tercatat; tes komponen dan regresi yang relevan dijalankan pada kandidat baru; setiap kegagalan diperbaiki. Pemulihan backup 1.0.0/1.1.0 tetap mempertahankan pemilik, histori dan versi soal. Hasil sebelum perubahan menjadi baseline pembanding, bukan kelulusan otomatis kandidat baru.

## 3. Fase kedua — jadikan OKE sebagai titik feedback yang tegas

**Pemilik: frontend/player, data/analitik, penelaah pembelajaran, QA.** Sebelum OKE, letakkan soal, input, contoh format sesuai materi dan tindakan utama berdekatan. Setelah input sah diterima, pertahankan soal dan tampilkan kartu hasil lengkap tanpa mewajibkan dua klik bantuan. Kunci harus terlihat pada jawaban benar maupun salah. Pembahasan panjang boleh dibuka lebih lanjut; kunci langsung tidak disembunyikan lagi di balik pola petunjuk lama.

Contoh `8 + 7` dengan jawaban 14: **Belum tepat**, **Jawabanmu: 14**, **Kunci jawaban: 15**, kemudian “Lengkapi 8 menjadi 10 dengan mengambil 2 dari 7; sisanya 5.” Setelah feedback, tindakan utama menjadi **Soal berikutnya** atau **Tinjau hasil** pada soal terakhir. Jangan memindahkan soal otomatis ketika siswa masih membaca. Lewati merupakan tindakan terpisah; jalur Lanjut lama tidak boleh menjadi jalan melewati feedback tanpa kejelasan.

Isian kosong, pecahan belum selesai, penyebut nol, dan pemisah desimal tidak sesuai diberi pesan format; jangan dinilai salah matematika atau membuka kunci hanya karena Enter ditekan. Jika penyimpanan gagal, jaga jawaban serta feedback yang terlihat dan jelaskan bahwa hasil belum tersimpan. Status tersimpan baru muncul setelah operasi penyimpanan yang mendasarinya berhasil.

Untuk latihan adaptif, recovery dan tantangan waktu, gunakan kebijakan feedback yang dinyatakan sebelum mulai. Pada tantangan waktu, jelaskan aturan timer selama membaca feedback dan sediakan pilihan latihan tanpa timer. Untuk evaluasi mandiri, tindakan tetap **Simpan & lanjut**; peta soal hanya menunjukkan keadaan netral. Setelah hasil final terkunci, review menampilkan jawaban, kunci dan solusi. Penahanan tampilan ini bukan keamanan ujian terhadap pemeriksaan bundle statis.

Tambahkan semantik penayangan kunci yang terpisah dari petunjuk dan pembahasan. Catat kebijakan feedback, respons sebelum kunci terlihat, dan percobaan berikutnya dengan konteks bantuan. Perbaikan setelah melihat kunci dihargai sebagai hasil belajar, tetapi tidak ditulis ulang sebagai jawaban pertama mandiri. Perubahan schema memerlukan versi, migrasi, ekspor/impor serta validator bridge yang sesuai; jangan mengarang event untuk histori lama.

**Syarat keluar:** tes FM menunjukkan satu OKE menghasilkan kartu lengkap pada semua mode latihan terkait, input invalid tidak membuka kunci, evaluasi tetap menahan kunci, dan fixture salah→benar menjaga respons pertama. Hasil siswa, guru dan laporan memakai definisi yang sama.

## 4. Fase ketiga — satukan matematika dari AST sampai layar dan dokumen

**Pemilik: frontend matematika, penelaah konten, aksesibilitas, exporter, QA.** Bangun satu model presentasi yang menerima AST, nilai rasional eksak, locale dan metadata bentuk bilangan. Pasang MathJax dengan versi serta font yang dikunci. Gunakan konverter terkontrol untuk empat operator bank saat ini: tambah, kurang, kali dan bagi. Jangan membangun TeX/HTML bebas dari string input siswa, dan jangan mengganti aritmetika eksak dengan floating point.

Pakai komponen yang sama pada soal, jawaban yang telah diterima, kunci, cara singkat, langkah solusi, review, hasil, detail guru dan preview laporan. Pecahan bertingkat memiliki pembilang/penyebut yang jelas; tanda unary tidak terlepas dari bilangan; kurung mengikuti struktur AST; pemenggalan panjang terjadi pada batas yang aman. Jangan memperkecil seluruh rumus agar muat. Bahasa Indonesia menggunakan koma pada representasi desimal yang sesuai; bukti respons mentah tetap disimpan utuh.

Metadata strategi harus menjaga tujuan pengajaran. Pada soal desimal, perubahan menjadi pecahan perlu alasan; jangan menghasilkan `50 + 53/10` secara kebetulan ketika langkah yang dimaksud ialah `50 + 5,3`. Korpus uji mencakup contoh integer, pecahan, desimal, negatif, campuran dan AST dalam dari bank nyata. Pangkat merupakan perluasan renderer bila ditambahkan, bukan cakupan soal yang telah ditemukan pada bank ini.

Ikuti lifecycle asinkron pada dokumentasi versi MathJax yang dipilih: tunggu typesetting container terkait dan bersihkan catatan matematika sebelum node dibuang. Navigasi, perubahan bahasa dan perubahan soal harus mencegah hasil render lama menimpa layar baru. Input, timer dan indikator simpan tidak memicu typesetting seluruh halaman pada setiap ketukan. Font, komponen, lisensi dan dependensi offline harus ikut distribusi yang diverifikasi. [R1]

PDF dan DOCX mempunyai pipeline sendiri. Menambahkan MathJax ke HTML tidak otomatis memperbaiki keduanya. Model dokumen perlu membawa blok matematika; PDF memerlukan keluaran tajam serta urutan baca yang diuji, sedangkan DOCX memakai equation OMML jika menjanjikan persamaan yang dapat diedit. CSV/XLSX/JSON tetap mengutamakan data eksak dan struktur analisis. Fallback linear harus dinyatakan sesuai kemampuan format. HTML semantik tetap tersedia; PDF tidak disebut bertag/aksesibel tanpa pembuktian.

**Syarat keluar:** korpus FM benar nilai dan urutan operasinya, terbaca di semua permukaan, tanpa markup mentah atau glyph hilang; ID/EN, terang/gelap, pembesaran, fokus dan state gagal dimuat diuji. Penambahan renderer tidak mengubah jawaban, menghapus draf, atau menggandakan submit.

## 5. Fase keempat — tutup sepuluh gate wajib statis yang masih terbuka

Gunakan judul kriteria sumber berikut secara utuh. Status awal pengujian kandidat berikutnya **NOT_RUN**; status BLOCKED/NOT_RUN dari 1.1.0 hanya menjadi informasi baseline. Pemilik adalah disiplin pekerjaan yang diusulkan.

| ID dan kriteria sumber | Pemilik | Bukti dan syarat PASS kandidat baru |
|---|---|---|
| **AC-030 — Keypad matematika mempertahankan caret dan konteks** | Frontend input + QA perangkat | Video perangkat/browser menunjukkan penyisipan minus, slash dan desimal pada caret yang benar; pindah keyboard↔sentuh, seleksi dan hapus menjaga fokus. Nama tombol dapat dibaca; keypad sesuai jenis jawaban. |
| **AC-045 — Laporan dapat diakses tanpa bergantung PDF visual** | Aksesibilitas + exporter | Rekaman ucapan dan navigasi heading/tabel/angka; HTML berisi informasi setara dengan urutan bermakna. Picu kegagalan font PDF dan buktikan opsi DOCX/HTML mempertahankan nama serta isi. |
| **AC-050 — Kontras dan status tidak bergantung warna** | Desain + QA aksesibilitas | Ukur pasangan warna aktual, bukan token saja. Teks normal minimal 4,5:1, teks besar 3:1, indikator/kontrol bermakna 3:1 sesuai kasus. Periksa hover, disabled, error, fokus, monokrom/kontras tinggi; status juga memakai teks/ikon. |
| **AC-053 — Ukuran sasaran sentuh dan jarak kontrol** | Desain + QA perangkat | Catat bounding box, jarak dan salah ketuk pada ponsel. Target produk utama/keypad 48×48 CSS px, kontrol lain diutamakan 44×44. Pengecualian harus beralasan; jangan menyebut 44/48 sebagai minimum WCAG AA. |
| **AC-055 — Keyboard virtual Android fisik** | QA Android + frontend | Video model/OS/browser/IME nyata: ketik, pilih teks, slash/minus/desimal, rotasi, buka/tutup keyboard, submit dan resume. Input/OKE tetap dapat dijangkau; caret stabil dan tidak submit saat composition aktif. |
| **AC-056 — Keyboard virtual dan unduhan iOS/iPadOS fisik** | QA Apple + frontend/exporter | Video perangkat nyata membuktikan input, rotasi, zoom, safe area, keypad, resume serta unduh dan buka PDF/backup. File benar-benar ditemukan; kegagalan memiliki pemulihan. Emulasi WebKit dicatat terpisah. |
| **AC-057 — IME composition tidak memicu submit sebelum selesai** | Frontend input + QA | Rekam urutan `composition`/`isComposing` pada IME nyata. Enter saat composing menyelesaikan input; submit berikutnya hanya terjadi pada form/fokus yang dimaksud, tanpa duplikasi atau listener global yang mengirim form lain. |
| **AC-058 — Pembaca layar aktual mengucapkan matematika dan feedback** | Penguji teknologi bantu + frontend | Catat ucapan NVDA/VoiceOver/TalkBack yang benar-benar dipakai, OS/browser/versi dan hasil tugas. Negatif/pecahan terbaca; feedback/error diumumkan sekali; fokus dapat diikuti; timer tidak dibacakan setiap detik. AX tree saja belum PASS. |
| **AC-059 — Lintas mesin browser dan fallback kompatibilitas** | QA lintas browser | Matriks Chromium, Firefox dan WebKit/Safari berisi versi serta hasil alur inti, storage, worker, download dan offline. Tidak ada layar kosong; fallback sesuai kemampuan. Pisahkan bukti mesin otomatis dari perangkat fisik. |
| **AC-080 — Keputusan rilis, deploy dan bukti terikat build yang sama** | Penanggung jawab rilis + QA | Manifest/hash, clean build, 80 AC, FM, log dan batas klaim konsisten. Semua WAJIB_STATIC lulus; tidak ada P0/P1 terbuka dalam lingkup yang diklaim atau P2 yang melanggar acceptance. URL/deployment ID hanya dicatat jika benar-benar diterbitkan. |

Angka rasio dan sasaran di atas mengikuti kontrak penerimaan sumber; evaluasi aksesibilitas lengkap tetap membutuhkan pemeriksaan aturan dan pengecualian yang berlaku. Menambahkan pengumuman matematika dua bahasa memerlukan pendengar nyata; jangan menganggap pilihan locale otomatis membuktikan ucapan Indonesia.

## 6. Fase kelima — buktikan distribusi, offline dan performa

**Pemilik: frontend infrastruktur, QA dan operator hosting.** Sajikan hanya `dist/`. Pada host publik yang benar-benar digunakan, jalankan smoke test: buka beranda, deep link sesi/hasil, refresh, 404, root/subpath, aset dengan MIME benar, unduhan dan ekspor. Catat URL, deployment ID dan hash build. Jika publikasi belum dilakukan, status tetap PREVIEW_PASS; jangan membuat tanda terbit palsu. Pelaksanaan publikasi mengikuti otorisasi sesi implementasi.

Uji cold cache dan cache hangat. Unduh paket beserta renderer/font yang dijanjikan, putuskan jaringan, tutup/buka aplikasi, lalu selesaikan soal, buka kunci dan pembahasan. Label siap offline hanya muncul setelah dependensi lengkap. Guru dan exporter tidak ikut dianggap siap hanya karena satu paket latihan tersimpan. Simulasikan font gagal, cache parsial, kuota habis serta pembaruan service worker; sesi aktif dan snapshot lama tetap dapat dipulihkan.

Pertahankan anggaran sumber dan ukur tambahan MathJax/font secara terbuka. Jika tambahan melampaui anggaran player lama, buat keputusan anggaran baru beserta alasan dan angka aktual; jangan mengeluarkan file dari laporan agar lulus. **Usulan target baru**, yang belum diukur: perubahan status OKE terlihat dalam 100 ms setelah input sah diproses, dan typesetting container pada cache hangat selesai pada p95 maksimal 300 ms di profil perangkat uji yang ditetapkan. Angka ini target produk, bukan hasil audit atau standar universal. Pengujian juga harus menunjukkan nol typesetting halaman penuh per ketukan input.

Pisahkan hasil laboratorium dari p75 lapangan. LCP cepat pada Chrome desktop tanpa throttling tidak membuktikan ponsel lemah. Ukur jaringan lambat, font awal, navigasi berulang, histori besar dan batch ekspor; simpan konfigurasi, jumlah pengulangan, median/rentang serta kegagalan.

## 7. Keputusan akhir per lingkup

**GO_STATIC** hanya diberikan setelah seluruh gate statis dan kebutuhan FM yang relevan lulus. Klaim kemudahan maksimal membutuhkan pilot siswa, guru, admin dan orang tua AC-076–079; kualitas strategi/terjemahan membutuhkan review AC-074. Roster sampel bukan persetujuan reviewer. Kalibrasi tingkat kesulitan/evaluasi tidak lahir dari oracle aritmetika.

LMS live tetap pekerjaan integrasi tersendiri: endpoint institusi, identitas, otorisasi kelas/peran, penilai server, idempotensi, retry dan ACK. Jangan meniru RBAC dengan flag lokal atau mengklaim server menerima hasil dari status browser. Selesaikan adapter/harness statis sambil menyebut batas live secara jelas.

Serahkan ZIP kandidat dengan source/dist/bank lengkap, petunjuk operator, matriks AC dan FM berstatus aktual, daftar penutupan, bukti, manifest dan checksum. Gate yang memerlukan perangkat/peserta/server dan belum diuji tetap terbuka dengan langkah penyelesaian konkret. Ini menjaga kemajuan yang sudah dibuktikan sekaligus membuat target produksi dapat diperiksa.

### Rujukan

- Kontrak proyek: `ACCEPTANCE_RESULTS.csv`, `STATUS_RILIS.md`, `KNOWN_LIMITATIONS.md`, `AUDIT_CLOSURE.csv` pada ZIP 1.1.0.
- Audit baru: laporan feedback, matematika, cakupan bank dan bukti rilis pada paket ini.
- [R1] Dokumentasi primer MathJax untuk konten dinamis: https://docs.mathjax.org/en/latest/web/typeset.html . Gunakan dokumentasi yang sesuai versi dependency yang benar-benar dikunci saat implementasi.
