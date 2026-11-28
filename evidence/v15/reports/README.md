# AUD-04 · Kesiapan pada peta dan laporan

Baseline 1.4.0 memasukkan latihan katalog dalam cakupan pada peta. Laporan hanya membaca misi petualangan dalam daftar sesi terfilter. Reproduksi asli dengan empat snapshot yang valid menghasilkan 12/12 dan siap pada peta, 10/12 dan belum siap pada JSON. Angka dan versi dapat diperiksa di `baseline.json`.

Pada rilis ini, model peta menghitung kesiapan kumulatif dari sesi selesai pada profil, sumber dan modul yang bersangkutan. Guru melihat perhitungan yang sama menggunakan kebijakan rute saat ini. Riwayat sebelum tanggal awal, dan sesi yang tersembunyi karena filter mode atau paket, tetap menyumbang bukti. Kelas materi, level dan operasi memilih baris kompetensi yang ditampilkan. Batas akhirnya adalah saat pembuatan laporan (inklusif) atau awal hari setelah tanggal akhir (eksklusif), mana yang lebih dahulu. Baris misi, respons mandiri, bantuan dan XP periode hanya menghitung misi terpilih yang telah selesai sebelum batas itu. Paparan dalam sesi yang masih berjalan tetap dapat membantu pemilihan soal. Kesiapan bertambah ketika sesi selesai.

`sessions[].journey_at_creation` menyimpan salinan atribut kebijakan dari snapshot yang ditampilkan untuk penelusuran. Penanda kesiapan pada laporan merupakan hasil perhitungan menurut kebijakan saat ini dengan batas waktu yang tertera. Tanggapan, bantuan, skor, metadata dan aturan dalam snapshot lama tetap dipertahankan. Riwayat dengan versi petualangan yang tidak dikenal dikeluarkan dari perhitungan kesiapan.

Berkas dalam `tests/journey/fixtures/report-audit-04-v14.json` berisi empat attempt sintetis beserta event yang dibentuk oleh engine 1.4.0 dari dua paket bank riil melalui skenario audit. `tests/journey/report-readiness.mjs` memvalidasi snapshot tersebut, menguji batas waktu, periode kosong, filter, isolasi identitas dan kebijakan lama, serta memainkan satu misi tambahan dengan bantuan dan revisi. `audit-replay.json` adalah keluaran probe asli pada kode perbaikan. Probe historis mengembalikan kode 2 saat perbedaan hilang.

Dari akar paket sesudah build, jalankan:

```sh
node tests/journey/report-readiness.mjs --dist
python3 tests/journey/inspect-report-readiness.py
```

Format keluaran diperiksa melalui JSON dan CSV yang didekode, nilai sel XLSX dengan openpyxl, sel tabel DOCX dengan python-docx, dan teks hasil tata letak PDF dengan PyMuPDF. Seluruh format harus memuat 2/2 misi lulus, 12/12 soal unik, 2/2 strategi dan status siap. Bukti skenario, hash dan hasil pembacaan independen berada di `node-acceptance.json` dan `format-inspection.json`. Pemeriksaan tampilan persamaan di Microsoft Word sasaran masih memerlukan instalasi Word yang ditetapkan untuk TEACH-03.

Buka contoh persamaan di Microsoft Word dengan fixture-word-pecahan.docx. Isi persamaan dan hash file ada pada fixture-word-pecahan.json. Cetakan riwayat dari tema gelap tersedia sebagai print-cetak-id.pdf dan print-cetak-en.pdf. Bukti pengukuran margin, keterisian setiap halaman dan kontras pada skenario cetak ada di print-contrast.json.
