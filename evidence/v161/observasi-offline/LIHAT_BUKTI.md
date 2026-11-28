# Timeout Firefox pada cache lama

Audit 1.6.0 mencatat timeout ketika menunggu ubin jawaban siswa tampil setelah Enter. Dari sepuluh skenario, sembilan lulus pada putaran pertama, satu dari satu lulus saat skenario diulang tersendiri dan sepuluh dari sepuluh lulus saat seluruh rangkaian diulang. Log asli berada di `07_BUKTI/rilis/` dalam ZIP audit 1.6.0. Satu ulangan tambahan dengan browser dan harness 1.6.0 ada di `../baseline-1.6.0/offline-firefox-extra-legacy.json`.

Pada kandidat baru, `offline-capability-firefox` menjalankan kesepuluh skenario. `offline-legacy-repeat-firefox` menjalankan enam proses browser Firefox terpisah dengan profil kosong (tiga pemasangan dari peta, tiga perbaikan legacy). Masing-masing memasang versi materi, memodelkan instalasi lama, memeriksa status perbaikan di luar jaringan, memperbaiki saat tersambung, lalu menyelesaikan misi tanpa jaringan. Batas tunggu interaksi tetap 14 detik. Instrumen pasif merekam keadaan input, fokus dan keyboard. Setelah kedua ubin terlihat, penguji memeriksa indeks tersimpan dan satu respons per soal. Log akhir mencatat ID respons dan jumlah finalisasi. Jika timeout terjadi, trace mempertahankan fase yang gagal dan keadaan terakhir browser. Untuk hasil terminal build ini, baca dua receipt di `../qa/`.

Pada putaran sertifikasi pertama 1.6.1, skenario peta juga melewati batas 14 detik saat menunggu ubin jawaban. Sembilan skenario lain termasuk legacy lulus pada putaran ini. Receipt putaran tersebut disimpan di sini. Instrumentasi diperluas ke dua jalur dan tambahan uji berulang mencakup keduanya. Pemeriksaan periode berikutnya, ID build dan semua hasil dapat ditelusuri dari binding.
 
Penyelidikan terpisah pada Firefox mengonfirmasi bahwa Enter baru sesaat setelah input komposisi selesai dapat diabaikan meskipun draf sudah terisi. Uji dan perbaikan kondisi itu tercatat pada bukti komposisi dan suite regresi. Receipt timeout pertama tidak memuat jejak peristiwa yang diperlukan untuk memastikan penyebab yang sama pada percobaan tersebut.

Penyebab timeout 1.6.0 belum teridentifikasi. Sukses berulang hanya berlaku pada kondisi yang tercatat.

Putaran lama hanya dapat diverifikasi terhadap source dan dist yang tercantum pada receipt putaran itu. Saat uji lama berakhir, pemeriksaan binding terhadap pohon kerja yang sudah diperbaiki menolak perbedaan identitas. Putaran penuh berikutnya memakai satu checkout versi perbaikan yang dibekukan selama pengujian. Dua nilai SHA tersedia dalam arsip putaran serta binding final.
