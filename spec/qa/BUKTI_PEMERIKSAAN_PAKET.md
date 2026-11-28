# Bukti pemeriksaan paket arahan

Tanggal: **25 November 2026**. Ruang lingkup: dokumen, kontrak, contoh, rencana dan integritas paket. Hasil ini tidak menyatakan website, bank massal, LMS atau deployment sudah dibangun.

## Hasil yang benar-benar diperiksa

| Objek | Hasil | Batas pemeriksaan |
|---|---|---|
| Tiga berkas sumber | Byte dan SHA-256 tetap sama dengan input | Tidak mengubah sumber untuk menghilangkan temuan |
| Struktur kurikulum | 12 kelas, 60 level, 300 kategori kompetensi, 281 aktif, 19 nonaktif | Grade materi tetap berbeda dari grade administratif siswa |
| Contoh sumber asli | 281 ekspresi, AST, display answer dan kunci benar secara eksak; empat konflik contoh/aturan terdeteksi | PASS berarti audit dengan temuan yang diketahui berhasil, bukan semua aturan editorial telah diwujudkan menjadi kode |
| Registry draft.2 | 281 kunci benar; nol dari empat konflik contoh yang dikenal | Koreksi tetap mempunyai jejak before/after; bukan kalibrasi tingkat kesulitan |
| Rencana bank | 4.604 ID paket unik, 177.640 slot target; setiap kompetensi aktif memiliki dua rencana form assessment | Rencana belum berupa paket soal aktual dan slot bukan jumlah unik |
| Persyaratan dan acceptance | 68 ID persyaratan, 90 ID kasus uji berurutan, seluruh referensi tujuan tersambung | Status 90 tes aplikasi tetap NOT_RUN |
| Keputusan desain | 27 keputusan mempunyai referensi dokumen yang tersedia | Keputusan internal bukan hasil pilot siswa |
| Kontrak inti dan contoh | JSON Schema sah; empat contoh JSON lolos tipe yang dituju; modul ESM contoh sama dengan JSON | Tidak membuktikan server, otorisasi atau seluruh format laporan sudah bekerja |
| Semantik contoh | Jawaban, langkah ekuivalen, fingerprint dan hash event dihitung ulang | Hanya contoh kontrak yang tersedia di paket ini |
| Negative cases kontrak | Denominator nol, bahasa hilang, operator asing, mock verified, demo verified, count salah, hash berubah dan langkah salah ditolak | Memberi bukti bahwa verifier tidak hanya memeriksa parse JSON |
| Fixture input | 46 nilai/grammar konsisten, mencakup 20 input sah dan 26 format error | Belum menguji parser JavaScript aplikasi atau urutan prioritas kode error |
| Metrik | Rumus contoh skor, akurasi, denominator tertimbang dan perubahan poin persentase diperiksa | Tidak mengukur kemampuan siswa nyata |
| Tema dan microcopy | 18 pasangan kontras dihitung ulang dan lolos batas masing-masing; 23 pasangan microcopy; 18 ID layar tersedia | Bukan sertifikasi aksesibilitas website; microcopy adalah contoh acuan, bukan seluruh katalog produksi |
| Status rilis | Template lolos schema; PASS tanpa evidence dan verdict tanpa release_id ditolak | Path evidence tetap memerlukan bukti nyata saat implementasi |
| Integritas handoff | Manifest mencakup seluruh berkas selain manifest itu sendiri; ukuran dan SHA-256 cocok | Manifest tidak merupakan tanda tangan digital penerbit |

## Berkas hasil

- `SOURCE_VERIFICATION_ORIGINAL.json`: keluaran audit sumber asli, termasuk empat temuan.
- `SOURCE_VERIFICATION_DRAFT2.json`: keluaran audit registry efektif.
- `HANDOFF_VERIFICATION.json`: hasil verifier paket lengkap.
- `../ui/CONTRAST_REPORT.json`: nilai kontras penuh dan ambang per pasangan.
- `../SHA256SUMS.json`: inventaris ukuran dan hash semua berkas paket selain manifest tersebut.

## Reproduksi

Jalankan dari root paket yang sudah diekstrak, menggunakan Python 3.10+ dan dependensi pada `qa/requirements.txt`:

```bash
python3 qa/source_audit_verifier.py
python3 qa/source_audit_verifier.py --registry curriculum/KALIBATAKU_CURRICULUM_REGISTRY_v1_0_DRAFT2.json --patched
python3 qa/verify_handoff.py
```

Verifier bersifat read-only. Jika isi dokumen diubah, hash paket memang harus gagal sampai manifest versi baru disusun secara sengaja. Jangan memperbarui checksum hanya untuk menyembunyikan perubahan yang belum direview. `--skip-hashes` disediakan untuk penyusunan versi berikutnya; ia tidak merupakan verifikasi integritas paket final.

Kelengkapan isi bank, perilaku player, offline, hasil ekspor, keamanan peran LMS, kinerja browser dan deployment wajib dibuktikan oleh aplikasi yang akan dibangun melalui prompt. Batas itu tercermin pada template status rilis, bukan ditutup dengan hasil PASS pemeriksaan dokumen.
