# Membaca bukti bank soal

Buka `bank-validation.json` untuk jumlah pemeriksaan dan lokasi arsip matematika. Buka `bank-coverage.json` untuk melihat seluruh 300 slot, termasuk 19 kategori yang dinonaktifkan kurikulum. Hash file yang benar-benar didistribusikan tersedia di `bank_sha256.json`.

| Berkas | Pemeriksaan yang dapat ditelusuri |
|---|---|
| `bank-inventory.json` | ID, versi, URL statis, SHA-256, tujuan, jumlah soal, dan pemeriksaan kedua bahasa untuk setiap paket |
| `bank-coverage.json` | Status aktif, jumlah template, subtipe terisi, paket dan slot soal di setiap kompetensi |
| `bank-uniqueness.json` | Bentuk kanonik, variasi tampilan, jumlah penggunaan ulang dan irisan kedua form pada tiap kompetensi |
| `bank-pool-feasibility.json` | Ukuran pool, batas bawah konstruktif, parameter yang dicoba, kandidat tertolak dan tabrakan sidik jari |
| `bank-validation.json` | Hasil pemeriksaan matematika, bahasa, struktur, langkah penjelasan dan lokasi validator |
| `bank-deviations.json` | Daftar target jumlah paket/soal yang disesuaikan. Daftar kosong berarti semua target jumlah terpenuhi |
| `template-review.json` | Metode review, contoh yang dibaca dalam dua bahasa, status review guru dan pilot siswa |
| `build-provenance.json` | Hash sumber, versi kurikulum, versi runtime, identitas keluaran, seed dan waktu audit |
| `semantic-by-cell.json` | Batas aktual tiap keluarga, perubahan operand yang harus ditolak serta banding pembilang dan penyebut kasus batas |
| `oracle-by-level.json` | Jumlah impor ESM, soal, teks bilingual dan langkah ekuivalen yang diperiksa dengan BigInt per level |
| `determinism.json` | Pembandingan seluruh byte dari dua generasi bersih dengan konfigurasi yang sama |
| `test-results.json` | Pemetaan kasus uji bank terhadap berkas bukti |
| `quarantine-test.json` | Hasil injeksi kegagalan registry yang mempertahankan keluaran sebelumnya |
| `distinct-question-math.json.gz` | JSON audit tiap representasi matematika berbeda yang diterbitkan, dengan referensi ke paket dan posisi soal |

## Menghubungkan JSON audit ke soal yang tampil pada website

1. Dekompresi `distinct-question-math.json.gz` dan baca `fields` pada root JSON.
2. Pada setiap baris di `math_records`, `example_package_index` menunjuk ke `package_ids` menggunakan indeks mulai nol.
3. Cari ID paket tersebut di `bank-inventory.json`. Buka path di bawah `dist/` lalu ambil `questions[example_zero_based_question_index]`.
4. Bandingkan `fingerprint`, AST dan jawaban. Setiap leaf di pohon audit menyimpan literal asal, termasuk nol desimal di belakang dan penyebut pecahan tampilan. Identitas representasi yang dapat direproduksi memakai SHA-256 atas JSON ringkas dari pohon ini. Sidik jari kompetensi tetap mengikuti `canonical-ast-v1`.
5. Baca `hint`, `explanation`, `strategy_tags` dan `solution_steps` langsung dari ESM produksi. Beberapa konteks kompetensi dapat menggunakan ekspresi yang sama dengan strategi pedagogis berbeda. JSON audit menunjukkan satu rujukan nyata untuk setiap representasi.

Perintah untuk membuat ulang indeks dan arsip audit setelah pengujian bank selesai tersedia di `tests/bank/export_evidence.py`.
