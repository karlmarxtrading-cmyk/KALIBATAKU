# Validasi eksternal KALIBATAKU 1.6.1

Paket ini mencakup **11 kriteria wajib pada register AC**, gerbang native Windows pada register redesign/audit dan pengukuran setelah pilot. Sebelas kriteria AC disiapkan untuk pengujian manusia, perangkat fisik, aplikasi sekolah dan domain akhir. **PERF-03** dijalankan setelah pilot dan deployment. Kolom observasi dan pengesahan menunggu pelaksana sebenarnya. Keputusan rilis resmi tercantum di register proyek.

1. Buka [identitas kandidat](./BUILD.json). Cocokkan versi aplikasi dan bank, identitas offline, SHA-256 pohon distribusi serta sumber dengan kandidat yang akan diuji. Gunakan salinan kerja privat untuk mengisi formulir.
2. Koordinator menugaskan pelaksana dan penelaah nyata menurut tabel. Catat ID acara, waktu UTC, build, instrumen/perangkat, hasil awal, bukti dan hasil uji ulang. Satu acara boleh dipakai untuk beberapa kriteria jika ada pemetaan langkah dan bukti.
3. Gunakan [panduan pengesahan](06_PENGESAHAN.md) untuk mengubah observasi yang sudah diperiksa menjadi receipt. Berkas formulir atau profil sintetis hanya bahan uji. Untuk menghitung kelulusan gunakan hasil loader dan register yang dihasilkan proyek.

| Kriteria | Siapa dan apa yang dibutuhkan | Berkas untuk mulai | Bukti yang dikembalikan |
|---|---|---|---|
| BANK-07 | Guru matematika SD/SMP/SMA sesuai kelompok materi dan penelaah ID/EN | [Bank dan Word](01_BANK_DAN_WORD.md) | Keputusan tiap keluarga, tiga referensi, kasus batas, alasan dan penyelesaian temuan |
| UX-09, DEVICE-02, DEVICE-03 | Android + Chrome + Gboard dan satu IME lain, iPhone/iPad + Safari + papan ketik sistem, operator dan penelaah | [Perangkat dan ujaran](02_PERANGKAT_DAN_UJARAN.md) | Rekaman keyboard sistem, persegi ekspresi/input/tombol sesudah Next, fokus/ketikan pertama, draf, finalisasi, restore serta offline |
| A11Y-04 | Pengguna/penguji NVDA, VoiceOver dan TalkBack pada pasangan platform yang tercantum | [Perangkat dan ujaran](02_PERANGKAT_DAN_UJARAN.md) | Ujaran persis dalam ID/EN, urutan fokus, galat dan hasil verifikasi |
| TEACH-03 | Pengguna Microsoft Word versi yang dipakai sekolah dan penelaah | [Bank dan Word](01_BANK_DAN_WORD.md) | DOCX kontrol serta ekspor baru, tampilan nyata tiap persamaan dan lembar perbandingan |
| PILOT-01, PILOT-02, PILOT-03 | Dua belas siswa dari tiga kelompok, tiga guru, moderator, penelaah dan pengembang jika ada perbaikan | [Pilot siswa dan guru](03_PILOT.md) | Log anonim per peserta, temuan, perubahan atau dasar keputusan, serta retest |
| REL-02, REL-03 | Pengelola target akhir yang diotorisasi, identitas deployment lama/baru, operator dan dua perangkat | [Domain dan rollback](04_DOMAIN_DAN_ROLLBACK.md) | Rekaman HTTP, bukti pemasangan, aktivasi versi dan pemulihan pada target nyata |
| EXT160-02 · native pada register redesign/audit | Pelaksana dan penelaah Windows asli, Git Bash, Python, Node serta ZIP tersegel di path berspasi | [Verifikasi Windows satu kali](07_WINDOWS_NATIVE.md) | OS/runtime, asal run dan hash dari uji pin → verify → build → verify, dibandingkan dengan pasangan Linux pada identitas yang sama |
| PERF-03 · SETELAH_PILOT | Operator yang mendapat akses pengukuran nyata, pengenal deployment dan periode setelah pilot | [Pengukuran lapangan](05_LAPANGAN.md) | Sampel per metrik, jendela pengamatan, populasi, keterbatasan dan p75 |

Untuk uji pada kandidat terkontrol, koordinator menyediakan URL yang dapat dijangkau perangkat. Periksa HTTPS dan identitas build sebelum menguji. Simpan direktori validasi dan bukti di luar `dist/`. Gunakan salinan kontrol Word yang sudah dibekukan. Pembuatan ulang menghasilkan profil, ID dan waktu baru, sehingga membutuhkan pengikatan kembali kit dan penelaahan pada kandidat yang sesuai. Nama/kontak siswa, formulir persetujuan, perekaman mentah berisi wajah/suara pribadi, kunci privat dan cadangan asli peserta tetap dalam penyimpanan privat operator. Arsip rilis menerima ringkasan anonim, bukti yang telah disamarkan dan diotorisasi, serta alias pelaksana yang dapat diverifikasi penelaah.

Keputusan per gate memakai hasil aktual dari register kandidat. Simpan bukti sasaran yang disamarkan dan dua tanda tangan sesuai [prosedur pengesahan](06_PENGESAHAN.md). Untuk Windows, gunakan direktori hasil dan lokasi impor pada panduannya. PERF-03 tetap pada fase setelah pilot.
