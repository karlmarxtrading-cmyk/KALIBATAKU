# Keputusan pada 1.5.1

Cakupan menggunakan bukti paparan pada level soal. Satu respons dapat menambah riwayat jawaban, sedangkan soal yang sempat dibuka juga masuk ukuran dilihat. Rekomendasi berikutnya membaca nilai turunan dari snapshot asli. Tanggal sumber boleh memakai offset ISO yang sah. Perbandingan laporan memakai saat absolut dan batas hari pada zona yang dipilih guru.

Kesiapan offline berasal dari materi dan dependensi yang diperiksa. Kelayakan paket untuk misi petualangan tetap mengikuti tujuan ajar. Keputusan produksi membutuhkan seluruh 70 kriteria wajib dan ketiga temuan audit tertutup pada build yang sama. Integritas berkas bukti serta pengesahan manusia dicatat terpisah.

# Keputusan versi 1.5.0

Satu misi tetap bersumber dari satu paket. Seleksi, penguatan, bucket dan batas kemajuan ditetapkan dalam docs/contracts/JOURNEY_1.5.md. Snapshot lama mempertahankan identitas, urutan butir, first response, bantuan dan aturan yang direkam. Pilihan titik mulai baru disimpan per profil dengan identitas revisi.

Laporan menghitung aktivitas pada rentang yang dipilih dan kesiapan kumulatif sampai akhir rentang. Pemulihan mempertahankan format JSON dan ZIP. Validasi struktur dan pembuktian kecocokan terhadap paket lokal dicatat terpisah. Rincian pengujian implementasi ada di REGISTER_PENUTUPAN_AUD.csv.

## Arsip keputusan 1.4.0

# Keputusan rilis 1.4.0 (petualangan)

**D-1.4-01 Bank tetap, metadata terpisah.** Bank 1.2 tidak dibangkitkan ulang. Metadata rute dan occurrence adalah sidecar berversi (`journey/v1/`) yang dibangun baca-saja; shard occurrence hanya dimuat per kompetensi saat misi dibuat, sehingga peta tidak mengunduh bank. Hash shard dicatat di route dan diverifikasi.

**D-1.4-02 Kesulitan heuristik.** Band adalah tertil peringkat skor heuristik dari 16 fitur AST per kompetensi, bukan kalibrasi. Pada 13 kompetensi yang skornya hampir seragam, seri dipecah memakai fingerprint (`band_basis`) — urutan di sana tidak bermakna pedagogis dan ditandai untuk review.

**D-1.4-03 Satu paket per attempt.** Kontrak lama (`package_id` per attempt, event bridge) dipertahankan. Misi memilih subset terurut dari satu paket; paket dengan butir belum terlihat terbanyak menang. Lintas paket tidak diterapkan karena memerlukan perubahan kontrak event, laporan dan migrasi.

**D-1.4-04 Form A/B tidak dipakai misi.** Paket `assessment` (20.020 penempatan) dicadangkan untuk evaluasi formal agar form tidak bocor lewat latihan; tetap dapat diakses lewat katalog.

**D-1.4-05 Turunan, bukan counter.** Misi selesai, siap lanjut, cakupan, XP dihitung dari snapshot attempt. Tidak ada penulisan baru yang dapat ganda saat reload/klik ganda/ambil-alih tab. Skema IndexedDB tidak berubah (versi 2); tidak ada migrasi data.

**D-1.4-06 Aturan alur per attempt.** `flow_policy_version: direct-result-v1` ditulis pada attempt latihan baru; attempt tanpa field itu (1.3) memakai grid tinjau/kirim sampai selesai. Evaluasi tidak berubah.

**D-1.4-07 Ekspektasi uji lama yang diubah.** Tiga ekspektasi 1.3 mengkodekan perilaku yang diminta untuk dihapus: (a) beranda → formulir setup (AC-011-setup) diganti AC-011-direct (satu aksi ke soal); (b) akhir practice lewat “Selesaikan sesi” + “Kirim hasil akhir” (e2e journeys, v12-keyboard, demo guru) diganti “Lihat hasil”/“Akhiri latihan” + “Selesaikan dan lihat hasil”; (c) profil B “mengingat” pilihan katalog (AC-013-profiles) diganti B melanjutkan misi titik mulainya sendiri; (d) S02-composition mengirim Enter komposisi di dalam kartu feedback karena baris input disembunyikan saat feedback (UX-03); penjaga tetap di form. Semua pemeriksaan lain di suite tersebut tidak diubah dan dijalankan ulang pada build final.

**D-1.4-08 Modul player dimuat malas.** Beranda/peta tidak memuat `player/`; `journey.mjs` mengimpor engine/start hanya saat misi dibuat (anggaran beranda dan uji `initial-*`).

**D-1.4-09 Label rilis.** Enum status 1.3 tidak diubah; skema 1.4 menambah `release_label` dan label per lingkup yang dipetakan dari status. GO hanya bila semua kriteria WAJIB lulus pada build ini.

---

# Keputusan rilis 1.3.0

**Renderer.** Ekspresi bank hanya memuat bilangan rasional (bulat, pecahan, desimal), empat operasi dan kurung. Renderer khusus (`src/math/typeset.mjs`) menata token yang sama dengan model lama sebagai SVG dari kontur glyph Noto Sans 2.004 yang sudah dikirim aplikasi (OFL); U+2212 digambar dari batang tanda tambah. `tools/build-glyphs.py --check` membuktikan modul glyph dapat diekstrak ulang. Status `pending → svg | fallback` dan nama aksesibel dipertahankan, sehingga timer tetap mulai setelah rumus siap. MathJax dihapus dari runtime; batas AC-068 90 KiB dipertahankan dan kini lulus (48,9 KiB). Tipografi menu MathJax/SRE (penjelajah ujaran) tidak lagi tersedia; ujaran rumus berasal dari model AST ID/EN seperti sebelumnya.

**Teks linear.** Pecahan diperlakukan sebagai pembagian berprioritas perkalian: berkurung bila menjadi operand kanan × atau ÷ (aturan yang sama untuk node biner), tidak berkurung di kiri atau di bawah + dan −. Kurung untuk bilangan negatif di kanan tetap seperti 1.2.

**Pedagogi.** Untuk operand nonnegatif, koreksi dinyatakan sebagai besaran dengan arah. Pembagian bilangan bulat ≥ 10 memecah dividen menjadi puluhan hasil × pembagi ditambah sisanya (keduanya kelipatan pembagi) atau memakai puluhan bila sisa nol. Perubahan juga mengenai kelas 7–12 bila operandnya nonnegatif, karena penjelasan besaran lebih jelas; operand negatif kelas 7–12 memakai penjelasan bertanda seperti sebelumnya. Langkah pendek ditambahkan agar narasi dan langkah saling melengkapi.

**Cadangan.** Format arsip dipilih karena satu berkas tetap mudah disimpan pengguna, sementara bagian berchecksum membatasi memori per bagian dan mendeteksi kerusakan. Validasi seluruh bagian selesai sebelum satu transaksi IndexedDB, karena transaksi IndexedDB tidak dapat menunggu dekompresi tanpa ter-commit otomatis. Batas format 1 (50 MiB) tidak dinaikkan.

**Gerbang QA.** Suite lama yang hanya mencetak satu baris penutup dihitung sebagai satu assertion tingkat suite (unit tercatat di registry); assertion internalnya tetap menghentikan proses bila gagal. Suite baru menulis receipt per assertion. Sandbox mencegah pengujian menulis ulang bukti historis.

**Desain.** Palet hijau hangat dipertahankan sebagai identitas; ditambah warna status semantik (benar/setara/belum tepat/berbantuan) yang dipasangkan dengan ikon dan teks agar tidak bergantung warna. Target sentuh utama 48 px, kontrol lain ≥ 44 px (target produk, bukan batas WCAG 24 px). Ukuran teks aplikasi 100/118/138% terpisah dari zoom browser.

---

# Keputusan rilis 1.2.0

**Kebijakan penilaian.** `visible-key-v2` membedakan respons sebelum dan sesudah penayangan kunci. `continuous-deadline-v2` menjalankan tenggat kecepatan sepanjang sesi. Pembukaan tinjauan selesai memiliki catatan perangkat tersendiri. Schema runtime kompatibel terdapat di `docs/contracts/core-1.2.schema.json`; spesifikasi sumber di `spec/` dipertahankan untuk verifikasi handoff asli.

**Anggaran renderer.** MathJax 4.1.3 berisi pengolah lokal dan glyph NewCM. Komponen MML/SVG resmi berukuran 1.702.534 byte sebelum kompresi, 571.290 byte dengan gzip-6. Pada alur uji, keseluruhan tambahan player beserta runtime berjumlah 613.534 byte (599,2 KiB gzip). Batas implementasi versi 1.2 ditetapkan 640 KiB gzip untuk kelompok tersebut. Batas lama 90 KiB tetap menghasilkan FAIL di AC-068. Worker dan peta ujaran yang disimpan untuk offline masuk inventaris per berkas. Halaman awal memuat shell dan menunda renderer hingga rumus diperlukan. Lihat `evidence/ux/performance/bundle-gzip.csv`.

**Aksesibilitas dan dokumen.** Rumus diproduksi dari AST berisi bilangan serta operator yang dikenal. Angka dan kunci dihitung dengan bilangan bulat presisi arbitrer. SVG disertai satu nama matematika ID/EN. Bentuk linear tetap tersedia ketika pemuatan gagal. PDF memakai vektor, DOCX menggunakan OMML, cetak HTML memakai notasi linear dengan pengelompokan.

**Riwayat keputusan sebelumnya**

# Keputusan implementasi 1.0.0

- **Distribusi ESM native.** Modul per fitur dan modul data mandiri per paket dapat dimuat browser secara langsung. Build Node/Python menyalin keluaran bersih dan memverifikasi sumber/bank. Pilihan ini menjaga jalur Git → hosting sederhana dan menghindari dependensi bundler dalam aplikasi.
- **Hash route dan URL relatif.** Navigasi menggunakan fragmen agar root maupun subfolder dilayani host statis dengan aturan 404 yang sederhana. Sesi memakai ID dan snapshot butir untuk pemulihan.
- **Nilai dan representasi.** Kunci disimpan sebagai numerator/denominator tereduksi. Literal soal mempertahankan representasi integer, desimal atau pecahan. Soal yang muncul di beberapa locale dan pertukaran ADD/MUL yang setara berbagi fingerprint. Batas delapan digit desimal pada schema dijaga dengan representasi pecahan eksak apabila diperlukan.
- **Pembahasan setara pada seluruh ekspresi.** Perubahan lokal pada operasi campuran ditulis kembali di dalam ekspresi lengkap. Strategi mencakup pembentukan puluhan, kompensasi, penyebut bersama, pencoretan faktor dan sifat distributif bila struktur soal mendukungnya.
- **Distribusi bank.** Seluruh modul soal aktual ikut dalam dist. Prefix versi publik mengikat URL immutable. Aset shell dapat direvalidasi. Origin LMS harus disetujui pada tahap server. Aset sendiri, cache pilihan dan font lokal memenuhi kebutuhan belajar tanpa ketergantungan CDN.
- **Simulasi dan bukti.** Hasil pribadi, demo sekolah dan status transport punya asal yang dapat ditelusuri. Preview dan eksportir memakai snapshot laporan yang sama. Kalibrasi siswa, deployment publik dan API LMS yang aktif dilaporkan tersendiri.

## Perubahan keputusan pada 1.1.0

- Rencana sesi yang sama memasok ringkasan setup dan pembuatan attempt. Paket baru disiapkan dan diperiksa terhadap manifest sebelum batas waktu dimulai. Sesi yang sedang berlangsung menggunakan snapshot semula.
- Revisi strategi mental yang mengubah byte bank mendapat versi baru dan URL baru. Cakupan serta identitas matematika diperiksa kembali terhadap setiap penempatan pada rilis asli.
- Browser yang menolak penyimpanan memerlukan pilihan sadar dari pengguna. Transaksi simpan mengikat snapshot dengan peristiwa jawaban dan finalisasi. Tampilan membedakan kegagalan simpan, salinan sesi untuk pemeriksaan dan cadangan yang dapat diimpor.
- Putusan 1.1 mengikuti 80 kriteria A5 dan 47 temuan audit baru. Bukti 1.0 disimpan terpisah. Pratinjau yang dapat dipasang, penerimaan produksi, pemahaman keluarga dan integrasi sekolah mempunyai persyaratan bukti yang berbeda.
