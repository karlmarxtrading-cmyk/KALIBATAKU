# 06 — Acceptance, pengujian dan keputusan rilis

**Versi arahan:** 1.0 · **Tanggal:** 25 November 2026 · **Status:** rencana penerimaan produk; belum merupakan hasil uji website.

PRD menentukan apa yang dibangun. Dokumen ini menentukan bukti yang dibutuhkan untuk menyatakan hasilnya selesai. Semua baris pengujian di bawah adalah **belum dijalankan** sampai ada artefak implementasi beserta hasil aktualnya. Dokumen, screenshot contoh dan persentase dari simulator tidak boleh diperlakukan sebagai evidence produksi.

## 1. Definisi selesai yang digunakan

Website statis dinyatakan selesai apabila semua fungsi dalam lingkup rilis statis bekerja, seluruh kurikulum aktif mempunyai bank soal yang dapat digunakan, data tetap konsisten dalam kondisi gagal yang relevan, UI dapat digunakan dalam ID/EN dan terang/gelap pada matriks perangkat, serta deployment statis dapat diulang dari source.

Gunakan enam field canonical pada `RELEASE_STATUS.json` sesuai PRD. Laporan Markdown manusia dapat dibuat sebagai turunan JSON yang sama:

| Dimensi | Contoh status | Syarat status lulus |
|---|---|---|
| `static_application` | NOT_IMPLEMENTED / NOT_RUN / FAIL / PASS | Seluruh fitur wajib dan state utama berjalan pada hasil `dist` |
| `bank_content` | NOT_IMPLEMENTED / INCOMPLETE / FAIL / PASS | 281 kompetensi aktif tercakup sesuai blueprint, audit matematika 100%, distribusi dan pool terbukti |
| `bridge_contract` | NOT_IMPLEMENTED / NOT_RUN / FAIL / PASS | Mock dan remote adapter lulus contract harness, termasuk kegagalan; bukan bukti server live |
| `live_lms` | DEFERRED_BY_SCOPE / NOT_IMPLEMENTED / NOT_RUN / FAIL / PASS | PASS memerlukan server autentikasi/izin/data sungguhan; rilis statis memakai DEFERRED_BY_SCOPE |
| `pedagogical_calibration` | NOT_PERFORMED / INTERNAL_REVIEW / PILOTED | Status menggambarkan review/pilot yang benar-benar dilakukan |
| `live_deployment` | NOT_PERFORMED / PREVIEW_PASS / PRODUCTION_PASS | Aset, headers, cache, deep link dan update diuji pada URL/lingkungan yang disebut |

Keputusan `GO_STATIC` mensyaratkan fungsi statis, bank, pengujian aksesibilitas/kinerja/integritas serta paket deployment lengkap lulus. Jika belum ada deployment publik tetapi preview HTTPS tervalidasi, gunakan istilah **siap dideploy**, bukan **sudah live**. Contract testing dinilai pada `bridge_contract`; `live_lms` tetap `DEFERRED_BY_SCOPE` untuk lingkup rilis statis ini. Kalibrasi pedagogis empiris dilaporkan tersendiri; jangan mengklaim norma kecepatan, kurikulum resmi atau efektivitas yang sudah terbukti bila belum dilakukan studi/pilot.

Tidak ada angka “100% siap” berdasarkan jumlah tes saja. Semua acceptance wajib mempunyai status dan bukti. `NOT_RUN` bukan `PASS`; skipped gate harus mempunyai alasan dan dampak pada klaim, tanpa menyembunyikan kekurangan.

## 2. Bukti rilis minimum

Rilis akhir website kelak memuat folder evidence berikut. Nama subfolder boleh mengikuti implementasi asal isi dan pemetaan jelas.

| Artefak | Isi wajib |
|---|---|
| `release-manifest.json` | Release ID, source hash, versi runtime/dependensi utama, versi kurikulum/bank/policy, hash dist, waktu build |
| `requirements-traceability.csv` | Requirement ID → implementasi → test ID → hasil → bukti → keterbatasan |
| `bank/bank-coverage.json` | 300 slot, aktif/nonaktif, template, paket, item, unique fingerprint dan tujuan per kompetensi |
| `bank/bank-validation.json` | Total diperiksa, lulus, gagal, contoh kegagalan dengan ID, verifier version |
| `bank/bank-pool-feasibility.json` | Metode menghitung pool, pool size atau lower bound, target/actual, pengulangan terencana, pengecualian kuota |
| `bank/bank-uniqueness.json` | Duplikat dalam/antar paket, lintas revisi, canonical fingerprint, alasan pengulangan sah |
| `bank/bank-bilingual-review.json` | Missing keys, pairing, template penjelasan, fallback, hasil pemeriksaan manusia/teknis yang benar-benar dilakukan |
| `tests/` | Hasil unit/property/integration/E2E, versi runner, tanggal, lingkungan, log kesalahan |
| `screens/` | Screenshot hasil aplikasi aktual pada matriks layar/tema/bahasa yang ditentukan, tanpa data pribadi asli |
| `a11y/` | Automated scan ditambah catatan keyboard, screen reader, zoom/reflow dan timer |
| `performance/` | Bundle report, network trace, ukuran compressed/uncompressed, profil lab dan konfigurasi throttle |
| `exports/` | PDF/XLSX/CSV/DOCX/JSON/ZIP aktual dari fixture diketahui, beserta hasil inspeksi |
| `deployment/` | Build log, asset check, MIME/header check, offline/update/rollback dan hasil preview |
| `RELEASE_STATUS.json` dan ringkasan MD turunannya | Enam dimensi canonical, keputusan GO/NO-GO, gate tersisa, batas klaim dan langkah deploy |

Evidence tidak memasukkan secret, cookie autentikasi, credential, atau data siswa nyata. Catatan data contoh menyatakan fixture sintetis. Hash mengikat laporan kepada source dan `dist` yang sama; jangan menguji satu build lalu mendistribusikan build berbeda tanpa mencatat perbedaannya.

## 3. Cakupan pengujian yang efisien dan memadai

Pengujian dibagi menurut risikonya. Seluruh item hasil generasi diperiksa secara programatis. UI memakai kombinasi perjalanan representatif dan parameterisasi semua kompetensi untuk memastikan seluruh paket dapat ditemukan/dimuat. Tidak perlu membuka ribuan paket secara manual. Pemeriksaan manual diarahkan kepada risiko yang tidak dipastikan oleh validator: kenyamanan angka, pembahasan pedagogis, screen reader, fokus, pemenggalan laporan dan perilaku keyboard perangkat.

| Lapisan | Cakupan wajib |
|---|---|
| Kurikulum/schema | Seluruh registry, slot, ID, prerequisite, versi dan patch |
| Matematika | Setiap butir dan langkah solusi, independen dari evaluator pembuat soal |
| Factory | Setiap template, constraint batas, domain, pool dan distribusi |
| Domain app | Semua state sesi, metrik, kebijakan mastery, input dan versi |
| Integrasi lokal | IndexedDB transaction, outbox, export/import, cache, worker dan tab |
| UI E2E | Lima mode, kelas awal/menengah/lanjut, seluruh jenis bilangan, offline dan failures |
| Browser/device | Matriks versi browser nyata yang dilaporkan, responsive dan aksesibilitas |
| Remote bridge | Fake server/contract runner terkontrol untuk semua status; uji nyata dipisah |
| Deploy | Clean build, dist HTTP/HTTPS, base path, MIME, asset hash, update/rollback |

Property-based tests harus memakai seed yang dicatat dan oracle independen. Menjalankan fungsi yang sama dua kali bukan verifikasi independen. Regression tests ditambahkan untuk bug yang ditemukan, bukan menyalin setiap baris implementasi menjadi assertion.

## 4. Gate bank soal super lengkap

Lihat `05_BANK_SOAL_FACTORY.md` dan blueprint per kompetensi untuk jumlah dan distribusi final. Baseline sumber: 12 kelas × 5 level = 60 level; 300 slot kategori; 281 aktif dan 19 nonaktif. Baseline kapasitas variabel: 4.604 paket dan 177.640 slot. Angka tersebut adalah batas perencanaan yang perlu diuji kelayakannya, bukan jumlah unik yang dijamin.

Bank rilis tidak boleh berhenti pada 281 contoh soal dari registry, satu paket per kelas, satu generator umum dengan angka acak, atau label “segera tersedia” pada kompetensi aktif. Definisi lengkap meliputi:

1. Seluruh 281 kompetensi aktif mempunyai template terimplementasi, butir valid, paket yang dapat dimuat dan tujuan latihan/evaluasi sesuai blueprint.
2. Seluruh 19 slot nonaktif tetap nonaktif, dengan pesan konteks dan tanpa tombol mulai menuju paket kosong.
3. Setiap kompetensi mempunyai jumlah paket/slot/unik aktual, pool yang layak, variasi subtipe dan distribusi bilangan, tag strategi yang benar serta penjelasan bilingual.
4. Target baseline dipenuhi bila feasible; setiap pengurangan karena pool kecil dibuktikan secara matematis/komputasional, ditulis per ID, dan diganti bentuk pengulangan terencana atau paket lebih pendek sesuai kurikulum. Tidak boleh memperluas rentang, menambah operasi, atau menurunkan standar demi kuota.
5. Assessment menyediakan bentuk setara yang dapat dibandingkan. Pool kecil boleh memiliki overlap yang dicatat; bukti mastery tidak menggandakan soal yang sama sebagai bukti independen.
6. Seluruh item dan langkah solusi lulus pemeriksaan eksak, constraint, parsing locale, dan schema. Kesalahan nol bukan berarti pembahasan pedagogis sudah dikalibrasi; kedua status dilaporkan terpisah.
7. Seluruh paket final tersedia dalam `dist`, tercantum pada manifest dan dapat diakses; generator saja tidak memenuhi kata “tersedia”.

Jika factory memakai sampling dari pool sangat besar, laporan menyatakan lower bound atau jumlah kandidat yang diverifikasi, bukan mengaku menghitung seluruh ruang kemungkinan. Definisi uniqueness harus menyatakan canonicalization ADD/MUL, representasi ekuivalen dan pengulangan antar sesi. Jawaban yang sama pada ekspresi berbeda bukan otomatis duplikat.

## 5. Daftar test case konten dan matematika

ID TC-100–TC-189 dikhususkan dokumen ini. Kolom “lulus bila” merupakan expected result, bukan hasil aktual.

| ID | Skenario | Lulus bila |
|---|---|---|
| TC-100 | Inventaris kurikulum penuh | 60 level, 300 slot, 281 aktif, 19 nonaktif; jumlah per kelas cocok sumber+errata |
| TC-101 | ID dan versi | Semua ID unik pada scope-nya, referensi resolve, revisi/versi tidak berbenturan |
| TC-102 | Prasyarat | Semua node prasyarat ada/aktif; tidak ada siklus tak disengaja; MIX hanya operasi yang diperbolehkan |
| TC-103 | Semua template | Setiap kompetensi aktif punya implementasi constraint; tidak ada aturan editorial yang dilewati diam-diam |
| TC-104 | Domain kelas awal | G01–G04: operand/hasil antara sesuai aturan dan integer nonnegatif; semua DIV habis |
| TC-105 | Domain rasional | G05–G06 tidak mempunyai nilai antara negatif; G07–G12 bertanda sesuai template |
| TC-106 | Nilai batas | Minimum/maksimum operand, hasil antara, denominator, carry/borrow dan near-base diuji per template |
| TC-107 | Oracle independen | Evaluator rasional independen cocok untuk semua item; pembagian nol atau kunci beda menggagalkan build |
| TC-108 | Langkah pembahasan | Setiap langkah valid, kesetaraan dipertahankan, hasil akhir cocok; label strategi sesuai langkah |
| TC-109 | MIX | Minimal dua jenis operasi biner; precedence dan parentheses eksplisit; tidak ada bentuk ambigu |
| TC-110 | Duplikat | Tidak ada duplikat tak disengaja dalam paket; lintas paket terukur; repeat sengaja diberi provenance |
| TC-111 | Pool kecil | Target disesuaikan dengan bukti pool; contoh G01-L01 ADD tidak diklaim punya ratusan unique pairs |
| TC-112 | Distribusi | Blueprint subtipe/friendly structure/tujuan dan keseimbangan jawaban dipenuhi atau deviasi tercatat |
| TC-113 | Form setara | A/B memiliki profil isi/kompleksitas yang sebanding; overlap tercatat, label ekuivalen tidak asal |
| TC-114 | Bilingual konten | Seluruh title/instruction/hint/explanation/error/label tersedia ID+EN; AST dan kunci sama |
| TC-115 | Manifest lengkap | Semua paket aktual di dist resolve dengan schema/hash/jumlah item benar; tidak ada file yatim tak disengaja |
| TC-116 | Determinisme factory | Seed+version+input sama menghasilkan canonical content hashes sama pada dua clean run |
| TC-117 | Data sintetis terisolasi | ID/data demo tidak berada dalam namespace skor aktual; tidak ada identitas siswa asli di source |
| TC-118 | Batas output bank | Total paket, slot dan unik aktual dilaporkan; selisih terhadap target punya penjelasan per kompetensi |
| TC-119 | Semantik ESM | Paket tidak mempunyai efek samping; hanya bentuk ekspor data yang diizinkan; tidak ada dependency remote runtime |

Parser input perlu fixture terpisah untuk integer, negatif, `-0`, angka nol, trim luar, pecahan tak tereduksi, decimal exact, locale salah, separator ribuan, denominator nol, karakter asing, panjang berlebihan dan angka di luar domain jawaban. Contoh wajib: `0,5`/`0.5` dan `2/4` sama nilainya, sementara `0,333` tidak sama dengan `1/3`.

## 6. Test case mesin, data, dan bridge

| ID | Skenario | Lulus bila |
|---|---|---|
| TC-120 | Error format vs salah hitung | Input malformed tidak menambah salah; jawaban valid tetapi tidak sama kunci menambah salah sesuai mode |
| TC-121 | Pergantian locale saat mengetik | Nilai valid tetap sama, draft invalid mempertahankan teks serta validator/keypad `draft_locale` sampai valid/dikosongkan; posisi sesi/timer tidak reset |
| TC-122 | Input berulang cepat | Double click/Enter berulang menghasilkan satu submit dan satu event yang sah |
| TC-123 | Practice | Feedback/hint/retry bekerja, jawaban pertama tidak ditimpa retry, waktu tidak memaksa selesai |
| TC-124 | Speed | Countdown, timeout, skip dan hasil sesuai konfigurasi; deadline Speed terus berjalan saat hidden/jeda visual; tidak ada waktu negatif |
| TC-125 | Assessment | Feedback/kunci tidak bocor melalui UI sebelum selesai; revisi draft disimpan; dirty-invalid draft memblokir finalisasi atau ditandai kosong eksplisit, tidak memakai nilai lama; finalisasi idempotent |
| TC-126 | Adaptive | Rute sesuai bukti, N/prasyarat/policy; kasus bukti kurang tidak naik/turun secara sewenang-wenang |
| TC-127 | Recovery | Varian setara terkait soal asal, queue diperbarui, histori kesalahan asli tetap tersedia |
| TC-128 | Randomisasi/resume | Urutan tersimpan tetap identik setelah reload/back/theme/locale, tidak mengganti versi soal |
| TC-129 | Atomisitas simpan | Kegagalan transaksi tidak meninggalkan skor tanpa ledger/event terkait; outbox mock/remote ikut atomik, local adapter tidak membuat pending server |
| TC-130 | Storage diblokir/quota | Ada state gagal/temporer yang jujur; retry/ekspor aman; tidak ada toast simpan palsu |
| TC-131 | Dua tab satu attempt | Hanya satu writer sah; takeover jelas; tidak ada event sequence duplikat atau nilai ganda |
| TC-132 | Upgrade IndexedDB | Data fixture versi lama dan pending outbox tetap ada; blocked upgrade/recovery mempunyai jalur UI |
| TC-133 | Backup/import | Round-trip data canonical cocok; duplikat ID sama+payload sama tidak digandakan; conflict tidak ditimpa |
| TC-134 | Profil lokal | Filter/history/export sesuai profil, reset satu profil tidak menghapus lainnya; batas privasi shared device jelas |
| TC-135 | Remote tanpa config | Error `BRIDGE_NOT_CONFIGURED`, tidak ada request tak sah, tidak ada ACK mock yang disajikan sebagai server |
| TC-136 | Mock ACK | Receipt berlabel mock; simulasi partial ACK/latency/error dapat diulang; tidak memberi status verified |
| TC-137 | Idempotensi remote | Retry event ID+hash sama menerapkan satu kali; ID sama+isi berbeda menjadi konflik |
| TC-138 | Partial ACK | Hanya event yang diakui berubah status; 200 malformed/mismatched receipt tidak menghapus outbox |
| TC-139 | Error transport | 401/403/409/422/429/5xx/timeout diperlakukan sesuai kontrak; backoff, auth-required dan rejected berbeda |
| TC-140 | Urutan event/finalisasi | Complete sebelum missing events tidak menjadi final akademik; missing sequence dapat dipulihkan |
| TC-141 | Logout/pergantian identitas | Outbox profil lama tidak terkirim sebagai pengguna baru; pemisahan lingkungan tetap ada |
| TC-142 | Offline deadline | Waktu klien/diterima server tersimpan berbeda; keputusan terlambat/ditolak tampil jujur |
| TC-143 | ACK vs penilaian | `server_accepted` tidak otomatis `mastered_verified`; skor klien dan skor verifikasi berbeda asal |
| TC-144 | Upgrade schema bridge | Versi tak didukung ditolak dengan sebab; event lama tidak dibuang atau diberi versi baru palsu |

Semua pengujian remote dalam paket statis dijalankan terhadap fake server terkontrol atau contract harness. Hasil tersebut berstatus **contract test**, bukan bukti production LMS. Integration test server nyata kelak menambahkan identity, authorization, tenant isolation, trusted item version, report download access, audit dan backup/restore.

## 7. Test case analisis dan laporan

Gunakan fixture deterministik yang mencakup: belum ada data; seluruh benar; seluruh salah; sebagian skip; percobaan ulang/hint; attempt belum selesai; timeout; kompetensi berbeda; level berbeda; form setara vs tidak setara; duplicate delivery; timestamp lintas hari; data demo/lokal/remote; dan materi yang belum pernah diuji.

| ID | Skenario | Lulus bila |
|---|---|---|
| TC-145 | Skor dan denominasi | Form 10 item: 6 benar, 2 salah, 2 skip → skor 60%, akurasi jawaban 75%, jumlah tiap status jelas |
| TC-146 | Completion | Respons/skip final dibandingkan total assigned; soal belum dilihat tidak dianggap terjawab; definisi ditampilkan |
| TC-147 | Tidak ada bukti | N=0 tampil “Belum dievaluasi/Not assessed”, tanpa angka 0% atau klaim lemah |
| TC-148 | Mastery | Minimal dua form dan bukti unik per assessment_cycle_id sesuai policy; gunakan final response pada form eligible pertama; skip/blank/unseen masuk denominator sebagai tidak benar; retest sesudah penguatan membuat siklus baru tanpa menghapus histori; duplicate/retry/hint/unfinished tidak menggelembungkan bukti |
| TC-149 | Perbandingan perkembangan | Form setara dipisahkan; 58→86 = +28 pp; perpindahan kesulitan tidak disebut peningkatan setara otomatis |
| TC-150 | Durasi | Median/P90 dan N mengikuti 09: median rata dua nilai tengah untuk N genap, P90 nearest-rank, tampil setelah N≥10; kualitas timing ditangani sesuai policy |
| TC-151 | Akurasi kelas | Metode pembobotan dan denominator tepat; aggregasi tidak merata-ratakan persentase tanpa definisi |
| TC-152 | Penguasaan per operasi | MIX terpisah; nilai ADD tinggi tidak menutup DIV belum diuji/rendah; level mastery memerlukan seluruh sel aktif |
| TC-153 | Filter lintas tampilan | Dashboard, detail siswa, preview laporan dan export memakai filter/snapshot identik |
| TC-154 | Rekomendasi | Alasan dapat ditelusuri ke bukti; data kurang diberi label; tidak mengklaim strategi aktual atau diagnosis siswa |
| TC-155 | PDF/DOCX | File valid, teks dan angka cocok, font matematika utuh, pagination/heading/table tidak terpotong |
| TC-156 | XLSX/CSV | Angka tetap angka, encoding/quotes/delimiter benar, field teks berformula disanitasi; angka negatif tidak rusak |
| TC-157 | JSON/ZIP | Schema/hash valid, archive utuh, file count benar, export-import konsisten untuk tipe yang didukung |
| TC-158 | Export besar/cancel | Progres nyata, UI responsif, cancel membersihkan pekerjaan/URL blob; partial failure dijelaskan |
| TC-159 | Provenance laporan | Demo watermark, local unverified, official gated; periode/versi/sumber/created-at sesuai data |

Pemeriksaan ekspor wajib menggunakan reader/renderer format sebenarnya. PDF perlu dirender halaman; DOCX dirender dengan engine tersedia; XLSX dibuka dengan parser workbook dan diperiksa nilai/sheet; CSV di-parse ulang; ZIP dites CRC. Sekadar ukuran file lebih dari nol tidak cukup.

## 8. Browser, perangkat, aksesibilitas, dan UI

“Cocok di semua device” diterjemahkan menjadi cakupan browser modern yang dapat dipertanggungjawabkan dan layout adaptif, bukan klaim semua browser historis. Pembangun mencatat versi yang benar-benar diuji; baseline dipilih saat implementasi. Browser yang tidak memenuhi fitur inti mendapatkan pesan kompatibilitas yang bisa dibaca, bukan layar kosong.

| Kelompok | Target pemeriksaan minimum |
|---|---|
| Desktop Windows | Chrome/Edge dan Firefox stabil pada waktu rilis; keyboard-only dan zoom |
| macOS | Safari stabil, setidaknya satu Chromium untuk perbandingan |
| Android | Chrome pada satu perangkat nyata kelas menengah/rendah bila tersedia; portrait+landscape dan keyboard |
| iPhone/iPad | Safari perangkat nyata bila tersedia; safe area, visual viewport, scroll, pecahan/minus dan download |
| Engine otomatis | Chromium, Firefox, WebKit E2E; catat bahwa emulasi WebKit bukan pengganti seluruh Safari perangkat nyata |
| Viewport | Seluruh kasus wajib UX: 320×568, 360×800, 390×844, 568×320, 768×1024, 1024×768, 1366×768, 1440×900, serta lebar 2560 CSS px; lebar 1920 dapat menjadi pemeriksaan tambahan |
| Variasi | ID/EN × terang/gelap; system theme; font scaling, reduced motion, high contrast bila didukung |

Jika perangkat nyata tidak tersedia, tulis `NOT_RUN_REAL_DEVICE` untuk item tersebut dan jelaskan cakupan emulasi; jangan menuliskan “teruji di semua perangkat”. Pembangun tetap menyelesaikan semua pengujian yang dapat dijalankan dan memperbaiki temuan konkret, tanpa mengganti bukti dengan pernyataan umum.

| ID | Skenario | Lulus bila |
|---|---|---|
| TC-160 | Layout minimum/zoom | Tidak ada horizontal scroll halaman yang tidak perlu; soal/input/CTA tetap terbaca pada 320px dan zoom sesuai target aksesibilitas |
| TC-161 | Keyboard virtual | Input/CTA tidak tertutup; scroll mempertahankan konteks, minus/slash/decimal dapat dimasukkan tanpa paste |
| TC-162 | Tema/bahasa | Semua screen/state termasuk modal, chart, tooltip, error dan export benar; tidak ada lost state/flash kontras parah |
| TC-163 | Keyboard-only | Urutan fokus logis, skip link, dialog tidak menjebak, Esc/Enter sesuai tujuan, focus terlihat dan tidak tertutup |
| TC-164 | Screen reader | Nama kontrol, bentuk pecahan/negatif, progres, error dan hasil diumumkan bermakna tanpa pengumuman per detik yang mengganggu |
| TC-165 | Aksesibilitas visual | Contrast, non-color cues, target sentuh, reflow dan focus sesuai arahan UI; scan otomatis dilengkapi pemeriksaan manual |
| TC-166 | Reduced motion/timer | Animasi berkurang, countdown opsional/akomodasi bekerja, tidak ada kilat atau timeout tanpa konteks |
| TC-167 | Slow/offline/error state | Loading, retry, cached/not cached, quota, unknown route dan failed export punya tindakan yang tepat |
| TC-168 | Kepadatan data | Tabel guru/admin responsif; mobile memprioritaskan data, pagination/filter tetap dapat dioperasikan |
| TC-169 | UI benar-benar berfungsi | Tiap CTA mempunyai aksi lengkap atau disabled state beralasan; tidak ada tautan mati, lorem ipsum atau angka demo tanpa label |

Target WCAG dan anggaran kinerja mengikuti `01_ARAHAN_UI_UX.md`. Kontras dan automated accessibility score saja tidak membuktikan semua kebutuhan pengguna terpenuhi. Pemeriksaan manual perlu merekam tugas, alat/browser, hasil dan perbaikan, bukan hanya screenshot.

## 9. Lazy loading, cache dan kinerja

Kata “lazy” harus dibuktikan oleh network trace dan penggunaan CPU. Fungsi lengkap tidak harus dimuat sekaligus. Ambang angka merupakan target produk dalam arahan UI; hasil lab tidak boleh dipresentasikan sebagai field data pengguna nyata.

| ID | Skenario | Lulus bila |
|---|---|---|
| TC-170 | Initial load | Tidak memuat seluruh bank, generator, dashboard guru/admin, chart atau library export; budget shell sesuai dokumen UI |
| TC-171 | Request paket | Pilih satu paket hanya memuat shard/aset relevan; jumlah request dan byte tercatat; prefetch dibatasi |
| TC-172 | Interaksi saat lazy load | Klik mempunyai feedback segera, error dapat diulang, hasil load usang tidak mengubah pilihan terakhir |
| TC-173 | Sesi stabil | Submit/next/timer tidak menjalankan import/generasi besar; input responsif selama analytics/export berjalan |
| TC-174 | Lab performance | Profil network/CPU/viewport/versi runner dilaporkan; LCP/CLS dan interaksi representatif sesuai budget |
| TC-175 | Memory/batch | Daftar ribuan paket tidak membuat ribuan node aktif; export/cache besar tidak crash pada target perangkat yang diuji |
| TC-176 | Offline install | Status ready baru setelah semua aset wajib tersimpan; paket belum cached tetap mendapat penjelasan dan pilihan yang benar |
| TC-177 | Update SW | Update saat assessment tidak mencampur versi/hilang jawaban; aktivasi sesudah aman dan retry download bekerja |
| TC-178 | Cache eviction | Penghapusan/kehilangan cache tidak menghapus ledger; paket aktif dipin atau mempunyai pemulihan jelas |
| TC-179 | Background sync fallback | App tetap menyinkron melalui foreground tanpa API Background Sync; status online tidak diperlakukan sebagai ACK |

Untuk field Core Web Vitals setelah situs mendapat traffic, catat measurement scope dan percentile sesuai metodologi alat; jangan mengarang hasil field saat belum ada pengguna. Pada rilis awal, gunakan lab traces dan interaksi terukur yang tersedia, lalu jadwalkan evaluasi field sebagai tindak lanjut operasional yang eksplisit, bukan nilai PASS yang dibuat-buat.

## 10. Keamanan, build, dan deployment

| ID | Skenario | Lulus bila |
|---|---|---|
| TC-180 | Clean build | Source+lockfile+runtime tercatat menghasilkan dist dan bank sesuai manifest, tanpa dependensi file dari mesin pembuat |
| TC-181 | Static deploy | Latihan berjalan di static HTTP/HTTPS; tidak memanggil server/API eksternal yang tidak tersedia untuk fungsi inti |
| TC-182 | Deep link/base path/MIME | Refresh route bekerja, semua module/font/worker/bank mempunyai path/MIME benar; missing JS tidak menjadi HTML 200 |
| TC-183 | Header/CSP | Header aktual diperiksa, fitur berfungsi, CSP tidak memerlukan eval atau sumber tak dikenal; no secret in dist |
| TC-184 | Import/XSS | Script/HTML/URL berbahaya pada nama/catatan/import tidak dieksekusi; schema/batas file bekerja |
| TC-185 | Privasi dan export | Demo/local terpisah, tidak ada transmisi otomatis ke pihak ketiga, tidak ada data asli/credential di ZIP |
| TC-186 | Update/rollback | Rilis baru dan rollback mempertahankan/menangani sesi lama dengan jelas; data tidak dibersihkan otomatis |
| TC-187 | Dependency dan lisensi | Lockfile, asset provenance, lisensi dan advisory relevan diperiksa; unresolved risk dengan dampak nyata memblokir GO |
| TC-188 | Paket rilis | Source/dist/docs/evidence lengkap, SHA-256 benar, ZIP CRC lulus, file guide menunjuk lokasi yang benar |
| TC-189 | Klaim hasil | RELEASE_STATUS cocok evidence; tidak mengklaim server aktif, jumlah unik, real-device pass atau official curriculum tanpa bukti |

Uji dependency bukan perintah otomatis menaikkan major semua paket; perbaiki kerentanan relevan, rerun gate yang terdampak dan catat version pin. Hindari “memperbaiki” error dengan menonaktifkan CSP, schema validator, quality gate atau menandai tes gagal menjadi skip tanpa alasan.

## 11. Kriteria severitas dan keputusan

| Severitas | Contoh | Dampak rilis |
|---|---|---|
| P0 | Kunci salah, nilai salah tersimpan, data hilang, secret bocor, skor demo menjadi official | NO-GO sampai diperbaiki dan regression lulus |
| P1 | Kompetensi aktif kosong, mode utama tidak bekerja, pecahan tak bisa diinput mobile, pending data dihapus, ekspor wajib palsu/rusak | NO-GO untuk lingkup yang dijanjikan |
| P2 | Masalah tampilan terbatas yang mengganggu pemahaman, fokus sulit dilacak, wording bilingual menyesatkan | Perbaiki sebelum GO bila melanggar acceptance; jangan sembunyikan sebagai kosmetik |
| P3 | Penyempurnaan minor yang tidak menghalangi tugas dan tidak melanggar spesifikasi | Boleh dicatat untuk iterasi jika bukti menunjukkan scope wajib tetap terpenuhi |

Aturan penerimaan: seluruh acceptance wajib lulus, P0/P1 nol, serta tidak ada P2 yang melanggar kebutuhan UI/aksesibilitas/bilingual atau fungsi. Kegagalan provider eksternal, tidak adanya akun deploy atau tidak tersedianya perangkat nyata dicatat dengan nama aksi dan bukti yang belum ada. Jangan menyatakan hasil yang belum bisa diverifikasi; hasil build/source yang sudah selesai tetap diserahkan.

## 12. Urutan pemeriksaan menuju rilis

1. Cocokkan sumber dan errata, bekukan versi blueprint; schema/registry lulus.
2. Implementasikan template dan factory; hasilkan seluruh bank; periksa semua butir dengan oracle independen.
3. Verifikasi coverage, pool, solusi bilingual, form setara, fingerprint dan manifest; tidak ada kompetensi aktif kosong.
4. Implementasikan dan uji arithmetic/parser, session, storage, analytics, bridge, export dan migration.
5. Uji perjalanan lima mode dan seluruh state utama terhadap `dist` melalui server lokal.
6. Uji layout/bahasa/tema, keyboard/mobile, screen reader dan failure paths; koreksi temuan.
7. Profil lazy loading, CPU, memori, offline install, update dan outbox pada kondisi lambat/gagal.
8. Buat clean release build, uji preview HTTPS/deployment yang tersedia, periksa header/MIME/cache dan rollback.
9. Ikat semua evidence ke build yang sama; susun manifest/hash/laporan readiness dan ZIP source+dist+evidence.
10. Berikan instruksi deploy yang sesuai output aktual, berikut batas tersisa yang nyata; jangan menyebut dokumen rencana sebagai test pass.

Pengembang bergerak sampai kebutuhan yang dapat dikerjakan selesai. Satu keterbatasan tidak digunakan untuk menghentikan seluruh pekerjaan atau mengurangi bank menjadi sampel. Keputusan yang tidak mengubah ruang lingkup boleh diambil dan didokumentasikan; ketidakjelasan yang memengaruhi standar akademik diselesaikan melalui errata yang transparan, bukan perubahan diam-diam.

## 13. Format laporan keputusan akhir

```text
RELEASE_ID: <versi aktual>
SOURCE_HASH: <hash aktual>
BANK_VERSION: <versi aktual>
CURRICULUM_VERSION: <versi+errata aktual>

static_application: PASS | FAIL | NOT_IMPLEMENTED | NOT_RUN
bank_content: PASS | FAIL | NOT_IMPLEMENTED | INCOMPLETE
bridge_contract: PASS | FAIL | NOT_IMPLEMENTED | NOT_RUN
live_lms: DEFERRED_BY_SCOPE | NOT_IMPLEMENTED | NOT_RUN | FAIL | PASS
pedagogical_calibration: INTERNAL_REVIEW | PILOTED | NOT_PERFORMED
live_deployment: NOT_PERFORMED | PREVIEW_PASS | PRODUCTION_PASS

ACTIVE_COMPETENCIES_COVERED: <n>/281
INACTIVE_COMPETENCIES_RESPECTED: <n>/19
ACTUAL_PACKAGES: <n>
ACTUAL_QUESTION_SLOTS: <n>
ACTUAL_CANONICAL_UNIQUE_ITEMS: <n>
INDEPENDENTLY_VALIDATED_ITEMS: <n>/<total>
UNRESOLVED_P0: <n>
UNRESOLVED_P1: <n>
REQUIRED_GATES_NOT_RUN: <daftar>

DECISION: GO_STATIC | NO_GO_STATIC
DEPLOYMENT_LOCATION: <URL yang benar-benar diuji atau not deployed>
EVIDENCE_ROOT: <folder dalam ZIP>
KNOWN_LIMITATIONS: <batas nyata dan dampak>
```

Format teks di atas menjelaskan isi `RELEASE_STATUS.json`, bukan format JSON literal. Field readiness menggunakan enam nama canonical PRD; schema final mengikuti kontrak rilis. Nilai tidak boleh diisi `PASS` sebagai default. Referensi teknis dan alasan pemilihan mekanisme tersedia pada `04_ARSITEKTUR_STATIC_DAN_BRIDGE_LMS.md`; detail WCAG/kinerja pada `01_ARAHAN_UI_UX.md`; petunjuk hosting pada `07_DEPLOY_OPERASIONAL.md`.
