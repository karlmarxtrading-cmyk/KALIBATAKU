# KALIBATAKU 1.4.0 · Petualangan (2026-11-28)

Basis: 1.3.0 (ZIP SHA-256 5d0a6a1c…e1e50). Bank konten 1.2.0 tidak berubah: 4.677 berkas publik identik byte-per-byte, 4.604 paket, 177.640 penempatan.

## Siswa
- Beranda petualangan: satu tombol utama. Profil baru: **Mulai dari dasar** atau **Pilih titik mulai** (opsional, bukan tes). Pengguna lama: **Lanjutkan petualangan** ke snapshot yang sedang berjalan atau ke misi berikutnya beserta alasannya. Profil aktif selalu terlihat.
- **Peta** baru (`#/map`): tahap aktif ±2, daftar bernomor yang sama untuk keyboard/pembaca layar, status teks+ikon (belum terbuka, siap dimainkan, sedang dimainkan, selesai · siap lanjut, perlu penguatan, belum diunduh), nama keterampilan di setiap tahap, “Tampilkan semua 60 tahap”.
- Misi: Pengenalan 6 soal, misi 8 soal (2 pemanasan, 4 target, 2 penerapan), cek tahap 10 soal, penguatan, ulangan. Tanpa timer, tanpa nyawa/streak/penantian.
- Arena: satu soal, satu input, OKE. Saat feedback terbuka, baris input disembunyikan (jawaban tampil di kartu); tidak ada lompatan otomatis; dua salah beruntun menawarkan bantuan tanpa mengganti soal; menu dalam misi tanpa ruang guru/admin.
- Practice berakhir dengan **Lihat hasil** pada soal terakhir (finalisasi sekali, tanpa grid tinjau/kirim). Evaluasi formal tidak berubah. Sesi 1.3 yang sedang berjalan tetap memakai alur lamanya.
- Hasil misi: benar pertama tanpa bantuan, jawaban akhir, bantuan/kunci, XP (penanda usaha), posisi menuju siap lanjut, satu tindakan **Misi berikutnya** beralasan.
- Offline terpilih: **Simpan misi untuk offline** di peta (paket aktif + satu cadangan + metadata node; bukan seluruh bank). Status *Belum diunduh* dibedakan dari *Belum terbuka*.

## Data dan pemilih soal
- Sidecar berversi `journey/v1/` (route + 281 shard occurrence) dari `tools/build-journey.py` (baca-saja atas bank). 16 fitur kesulitan, strategi, domain, peran, band; `authored_heuristic`.
- Pemilih misi berbasis exposure per profil/kompetensi; seed, `selected_occurrence_refs`, node/tahap, versi metadata/kebijakan dan `selection_trace` dibekukan di snapshot. Satu paket per attempt.
- `nextMission`: lanjutkan, pilih titik mulai, mulai, variasi, penguatan, cek tahap, maju, ulangan; offline memakai paket terpasang.
- Siap lanjut (2 misi target ≥80% respons pertama mandiri + cakupan + strategi), penguasaan formal (A/B, tidak berubah), XP — terpisah dan diturunkan dari attempt (idempoten).
- TEK-01: penggabungan record arsip tanpa spread; writer memecah record dan menyelaraskan batas reader (150.000 record lulus roundtrip). TEK-02: ukuran entri STORED divalidasi sebelum body dibaca.

## Guru
- Laporan dan ekspor (PDF/DOCX/XLSX/CSV/JSON) memuat bagian *Petualangan · siap lanjut* dan lembar *Journey*: misi, misi target lulus, soal unik, respons pertama mandiri, bantuan, revisi setelah kunci, siap lanjut (kebijakan produk), XP (bukan nilai).
- Roster review 394 keluarga template untuk bank 1.2 + urutan rute (DOC-01), kolom penelaah kosong.

## QA dan rilis
- Suite baru: `bank-preservation`, `review-roster`, `journey-sidecar`, `journey-model` (34), `journey-exports-reopened`, `data-archive-edges` (10), `journey-browser-chromium` (41), `journey-perf-lab` (5). Gerbang `npm run qa:production` menulis `evidence/v14/qa/`.
- Ekspektasi lama yang sengaja diubah karena perilaku baru diminta (lihat DECISIONS.md D-1.4-07): alur beranda → setup, akhir practice via grid kirim, pengingat profil lewat katalog.
- Register `REGISTER_AC_1.4.csv` (71, namespace `AC:`) dan `REGISTER_TEMUAN_1.4.csv` (16, namespace `TEMUAN:`); status rilis skema 1.4 dengan label GO/READY_FOR_VALIDATION/HOLD.
