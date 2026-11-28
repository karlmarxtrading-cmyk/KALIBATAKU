# Kontrak petualangan KALIBATAKU 1.6

Berlaku pada 1.6.0 dan 1.6.1, bank 1.2.0. Satu misi mengambil soal dari satu paket ajar. Siswa bisa mulai atau melanjutkan dari beranda, menjawab, membaca hasil, lalu membuka misi berikutnya. Peta memberi pilihan titik mulai dan latihan bebas tersedia melalui katalog.

## Pemilihan misi dan paket

`nextMission` dalam `src/journey/model.mjs` mendahulukan pemulihan attempt aktif, kemudian pilihan titik mulai yang sedang menunggu. Rekomendasi meneruskan kompetensi aktif sampai siap. Rasio jawaban pertama mandiri di bawah 60% pada misi terakhir memicu penguatan ketika kompetensi belum siap. Setelah semua kompetensi aktif dalam satu tahap siap, penutup tahap ditawarkan sekali pada kompetensi aktif terakhir tahap itu. Hasil penutup yang rendah tetap mempertahankan kesiapan yang sudah diperoleh.

| Jenis misi | Prioritas tujuan paket ajar, dari kiri |
|---|---|
| Pengenalan | Pengenalan, inti |
| Reguler | Inti, penerapan, pengenalan |
| Penguatan | Pengenalan, inti |
| Penutup tahap | Review, penerapan, inti |
| Review | Review, inti, penerapan, pengenalan |

Untuk reguler/penguatan pada kompetensi yang belum siap, selector mencari satu strategi dalam aturan kompetensi yang belum dicoba. Jika kebutuhan strategi sudah tercapai, selector mencari paparan unik yang masih kurang. Satu tempat dipesan, dengan prioritas peran target, pemanasan, kemudian penerapan. Selector membuka tujuan paket ajar lain bila semua paket biasa gagal menyediakan kebutuhan tersebut. Filter offline mengikuti daftar paket yang terpasang dan terverifikasi. Bila materi yang memenuhi aturan belum terpasang, pemasangan diperlukan. Form evaluasi A/B selalu terpisah.

Di antara kandidat yang memenuhi syarat, paket dengan cukup soal baru untuk ukuran misi didahulukan. Jika cukup, prioritas tujuan paket mendahului jumlah soal baru. Jika kurang, jumlah soal baru mendahului tujuan paket. ID paket memecah seri. Jejak mencatat paket terpilih, jumlah kandidat dan ringkasan hingga delapan kandidat pertama.

## Skor dan urutan butir

`planMission` memakai heuristik fitur AST. Besar bilangan, operasi, struktur, pecahan dan tanda ikut membentuk skor. Sebutan “pemanasan”, “target” dan “penerapan” menyatakan peran dalam misi. Urutan kesulitan empiris memerlukan pemeriksaan pada siswa.

1. Urutkan seluruh **nilai skor unik dalam paket terpilih**. Untuk `k` nilai, ambil indeks tengah bawah `floor((k−1)/2)` dengan indeks awal nol.
2. Skor sasaran pemanasan/target/penerapan mengikuti minimum/tengah/maksimum. Pada penguatan, gunakan minimum/minimum/tengah. Untuk skor unik 2, 3, 7, 9, misalnya, misi reguler memakai 2, 3, 9 dan penguatan memakai 2, 2, 3.
3. Pilih butir yang memenuhi peran dan belum dipakai dalam misi itu. Utamakan yang belum terpapar, jarak absolut ke skor sasaran, skor lebih rendah, lalu frekuensi paparan. Kemampuan peran, strategi dan domain mendahului pemecahan seri melalui seed, lalu indeks. Dua butir berskor sama memiliki jarak sama walaupun band historisnya berbeda. Seed hanya memecah seri setelah prioritas pedagogis tersebut.
4. Isi kuota pemanasan, target dan penerapan. Sisa tempat yang tidak dapat diisi sesuai kuota boleh memakai butir berbeda sebagai target. Paket kecil dapat menghasilkan misi lebih pendek. Alasan serta jumlah butir review tersimpan pada jejak seleksi. Tampilkan menurut peran, skor menaik, kemudian indeks asli. Identitas untuk mencegah duplikasi dalam misi ialah 16 digit awal fingerprint yang disimpan di shard.

Jejak baru menyimpan `micro_policy=score-distance-1` dan `role_target_scores` dengan bidang `w`, `t`, `a`. Band asal tetap disimpan untuk identifikasi occurrence dan kompatibilitas.

## Review terjadwal

`spaced-review-1` menyisipkan satu misi review bila kompetensi terakhir siap, penutup tahap tidak sedang didahulukan dan masih ada kompetensi terbuka yang belum siap. Empat misi petualangan selesai terakhir harus semuanya selain review. Kandidat review adalah kompetensi lain yang siap dan terbuka, dengan waktu selesai terakhir yang sah sedikitnya 7 × 24 jam yang lalu. Pilih yang paling lama tidak berlatih, lalu ID kompetensi bila waktunya sama. Setelah review, riwayat empat misi diperiksa kembali. Jika semua kompetensi terbuka sudah siap, rekomendasi beralih ke review kompetensi siap yang paling lama tidak berlatih tanpa syarat jeda empat misi/tujuh hari tersebut.

## Kesiapan, paparan, XP dan laporan

Aturan 281 kompetensi aktif memakai registry `readiness-bank-1.2.0/v1`. Setiap ID mengikat daftar prasyarat, strategi, dan cakupan pada materi ajar baseline. Dibutuhkan dua attempt berbeda yang lulus, hingga 12 fingerprint unik sesuai kapasitas materi dan hingga dua strategi yang tercantum pada aturan. Perubahan pool pada waktu berikutnya tidak menaikkan ambang historis. Pilihan titik mulai lanjut menghormati prasyarat dalam tahap yang dipilih dan berikutnya.

- Misi reguler, penguatan atau penutup selesai dihitung lulus jika jumlah benar pertama mandiri pada butir **target** sedikitnya `ceil(0,8 × jumlah target aktual)`. Pada snapshot kompatibel tanpa peran target, gunakan seluruh butir. Tiga dari empat target benar mandiri masih kurang, sekalipun tujuh dari delapan butir secara keseluruhan benar. Hint yang dibuka sebelum respons pertama, kunci yang sudah dilihat dan revisi dibedakan.
- Cakupan kesiapan memakai sesi selesai dan butir yang benar-benar dilihat. Strategi memerlukan riwayat jawaban pada butir itu. Pemilihan misi berikutnya juga mempertimbangkan paparan pada sesi yang masih berlangsung. Rincian pembacaan penanda lama tersedia di [kontrak paparan](EXPOSURE_1.5.1.md).
- Setiap ID attempt petualangan selesai menyumbang `5 + 10 × jumlah benar pertama mandiri` pada seluruh butir, sekali saja. XP mengukur aktivitas. Form A/B mengukur penguasaan formal secara terpisah. Ringkasan guru memakai derivasi petualangan yang sama dan membedakan keadaan kumulatif pada akhir periode dari aktivitas selama periode.

## Snapshot, pemulihan dan pemeriksaan

`src/journey/journey.mjs` membekukan attempt, bank, metadata, node, paket, seed, urutan item/occurrence dan jejak seleksi pada pembuatan. Sesi aktif menyimpan posisi, draf, respons pertama, bantuan, revisi dan tahap feedback. Saat lanjut atau restore, aplikasi memakai snapshot yang tersimpan. `src/data/journey-snapshot.js` memeriksa struktur, referensi item berurutan dan kecocokan materi bila sumbernya tersedia. [Kontrak restore](RESTORE_JOURNEY_1.5.md) menjelaskan keputusan preview dan impor.

Tuple baru memakai `route-1.1.0`, `mission-policy-1.1.0`, `journey-policy-1.1.0`, `selector-1.1.0`, metadata 1.0.0, `difficulty-heuristic-1.0.0` dan `viewed-items-1.0.0`. Tuple historis yang konsisten pada keluarga 1.0.0 atau 1.1.0 diterima sesuai bidang opsional yang dikenal di `src/journey/versions.mjs`. Kebijakan mikro dan registry dicatat pada snapshot baru. Snapshot lama yang sah mempertahankan pilihan lamanya. Tuple asing ditolak saat impor dan dikecualikan dari derivasi.

Jalankan dari root proyek. Perintah pertama mencakup semantik skor, kesiapan historis, penutup tahap dan review terjadwal. Perintah kedua menelusuri jalur sempurna dan variasi selector untuk seluruh kompetensi. Perintah ketiga memeriksa pemulihan snapshot.

```bash
node tests/v160/learning.mjs
node tests/journey/progression-bounds.mjs
node tests/data/journey-restore.mjs
```
