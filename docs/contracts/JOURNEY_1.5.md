# Seleksi misi dan kesiapan pada KALIBATAKU 1.5

Arsip kebijakan 1.5. Untuk selector, review terjadwal dan kesiapan pada 1.6.0–1.6.1, baca [kontrak petualangan 1.6](JOURNEY_1.6.md).

Rute memakai `route-1.1.0`, `mission-policy-1.1.0`, `journey-policy-1.1.0` dan `selector-1.1.0`. Bank tetap 1.2.0. Versi serta isi 281 shard occurrence tetap 1.0.0. Hasil seleksi disimpan sekali di snapshot. Sesi yang sudah berjalan melanjutkan soal dan urutan tersimpannya.

## Mengisi kekurangan latihan

Peta, rekomendasi, dan hasil misi menampilkan jumlah latihan target mandiri, cakupan dan strategi yang sudah dicoba. Persyaratan tetap dua misi target dengan sedikitnya 80% jawaban pertama benar tanpa bantuan, hingga 12 soal unik dan hingga dua strategi dalam materi ajar. Koreksi setelah melihat kunci tidak membantu persyaratan jawaban pertama mandiri.

Misi reguler atau penguatan mencari paket biasa yang memuat strategi yang masih dibutuhkan. Setelah target strategi terpenuhi, pemilihan mengutamakan satu soal yang belum masuk cakupan. Satu tempat di misi dipesan untuk kebutuhan itu. Seluruh soal misi tetap berasal dari paket yang sama. Jika semua paket biasa untuk jenis misi tersebut tidak bisa memenuhi kebutuhan, selector membuka paket ajar dari tujuan lain, termasuk review. Pengecualian berlangsung per misi dan tercatat di `selection_trace.reasons`. Form evaluasi A/B selalu dikeluarkan dari kandidat.

Pada G12 L1 perkalian, misi setelah pengenalan dapat mengambil `MM-G12-L01-MUL-P017`, indeks 16. Ini memberi kesempatan mencoba PO. Jika paket yang dapat memenuhi kebutuhan tersebut belum terpasang saat offline, aplikasi memerlukan pemasangan yang sesuai sebelum misi itu dimulai. Snapshot aktif menyimpan materinya sendiri.

## Variasi dalam kelompok setara

Pemilihan paket deterministik untuk keadaan dan ketersediaan yang sama. Kandidat yang dapat memenuhi kebutuhan masuk lebih dahulu. Urutan tujuan paket, jumlah soal baru yang tersedia dan ID paket memecah seri. Di dalam paket, selector mengutamakan soal belum pernah terpapar, preferensi band untuk peran tersebut, frekuensi paparan, kemampuan peran lengkap, strategi, domain dan skor heuristik. Seed baru memecah seri sesudah dimensi tersebut setara. Urutan tampilan tetap pemanasan, target, penerapan dengan band lalu skor menaik dalam peran. Saat kuota peran tidak bisa diisi, sisa tempat diisi sebagai target dan alasannya dicatat. Misi dapat lebih pendek untuk paket kecil. Setiap pengulangan tetap bertanda review. Band dan skor berasal dari fitur AST dan belum memiliki kalibrasi empiris.

## Batas kemajuan untuk permainan sempurna

Untuk simpul baru, hitung kekurangan strategi `S` dan soal unik `C` setelah pengenalan, serta misi target lulus yang masih dibutuhkan `P`. Satu misi reguler yang dijawab sempurna memberi satu kelulusan. Jika masih ada kekurangan strategi, satu butir terpilih menjamin setidaknya satu strategi baru. Setelah strategi cukup, satu butir terpilih menjamin setidaknya satu tambahan cakupan. Semua paket ajar tersedia pada jalur online. Ketika kekurangan positif, kesamaan inventaris shard dengan seluruh soal ajar memastikan ada materi yang dapat memajukan syarat tersebut. Setiap butir memiliki peran yang dapat ditempatkan pada misi reguler. Dengan demikian jumlah misi, termasuk pengenalan, paling banyak `1 + max(P, S + C)`. Perhitungan tidak membutuhkan keberuntungan pada seed.

Untuk mendapatkan batas sebelum memainkan pengenalan dengan seed apa pun, uji mengambil jumlah butir unik terkecil di semua paket pengenalan yang sah, dibatasi ukuran misi. Jika semua butir pengenalan memiliki tag, sedikitnya satu strategi akan dicoba. Dari batas bawah ini dihitung batas atas per simpul. Pembuktian ini berlaku untuk jawaban pertama benar tanpa bantuan dalam semua misi di jalur default dengan semua materi ajar tersedia. Siswa yang menggunakan bantuan tetap mendapat kesempatan belajar kembali.

## Reproduksi

- `node tests/journey/progression-bounds.mjs evidence/v15/progression/all-nodes.json` menjalankan semua node dari dasar sampai rekomendasi review. Engine menerima jawaban dari setiap soal aktual. Tes menghitung persyaratan secara terpisah, memeriksa prasyarat sebelum launch, mencocokkan paket dan fingerprint, dan memeriksa reservasi strategi/soal baru. Seluruh 281 node diuji untuk kelima jenis misi pada tiga riwayat paparan dan empat seed. Fixture kecil menguji cakupan yang hanya dapat dipenuhi melalui review, pemasangan parsial dan pemisahan form.
- `node tests/journey/progression-launch.mjs --out evidence/v15/progression/launch.json` menelusuri rekomendasi dari pilihan tahap G12 L1 memakai fungsi penyimpanan dan pembuatan misi aplikasi. Seed dipatok agar hasil dua versi dapat dibandingkan. Untuk baseline, gunakan `--root DIREKTORI_SOURCE_1.4.0`. Kode keluar 1 pada baseline adalah kegagalan mencapai persyaratan setelah lima misi sempurna G12L1MUL.
- `evidence/v15/progression/baseline-engine.json` menyimpan reproduksi probe audit asli pada source 1.4.0. `occurrence-audit-original-policy.json` membandingkan 177.640 penempatan dengan bank. Kolom `unreachable_strategy_nodes` dalam berkas itu memakai daftar jenis paket statis versi 1.4.0. Hasil pengujian kebijakan 1.5 ada di `all-nodes.json`.
