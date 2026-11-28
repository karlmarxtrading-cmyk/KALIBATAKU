# Kontrak bukti QA KALIBATAKU 1.6.1

`tools/qa_core.py` membaca bukti saat eksekusi, penulisan binding dan verifikasi ulang. Register dan pengemas memeriksa binding terhadap registry dan hash payload. Jalankan `python tests/qa/receipt_shape.py` untuk regresi AUD160-02. Jalankan QA produksi untuk mengikat seluruh suite pada distribusi dan sumber yang sama.

## Receipt berversi

Produsen menulis satu objek JSON `kalibataku-qa-receipt/1` dengan `suite`, `build`, `checks`, `assertions` dan `status`. Nama produsen mengikuti registry atau alias eksplisit di QA Core. Tiga produsen journey-browser memiliki nama suite bersama dan dibedakan dengan `runtime.browser`. Periksa identitas release build serta atribut versi dan hash yang dicantumkan. Nama properti JSON berulang ditolak.

Setiap anggota `checks` merupakan objek dengan `id` string berisi dan `status` persis PASS, FAIL atau BLOCKED_ENV. Identitas unik dalam **satu receipt**, sesudah mengabaikan spasi di kedua ujung. Satu kasus pada dua engine dapat memakai ID yang sama dalam dua receipt masing-masing. Nilai `expected` dan `actual` adalah observasi tambahan. Count harus bilangan bulat, harus cocok dengan jumlah baris valid yang beridentitas unik dan harus memenuhi batas minimum registry. Satu baris tidak sah menggagalkan receipt walaupun baris lainnya valid.

Status agregat diturunkan dari seluruh baris. FAIL, error atau bentuk tidak sah menggagalkan receipt. BLOCKED_ENV memerlukan baris yang mengalaminya dan izin registry. Exit 3 memerlukan bukti hambatan tersebut. Hambatan tetap berstatus BLOCKED_ENV pada binding. Semua assertion PASS memerlukan exit nol untuk menghasilkan suite PASS.

## Produsen lama

Hanya e2e-browser, ux-extended-browser dan v12-browser-chromium memakai adapter assertion tanpa schema. Seluruh isi `checks` dan `results` berbagi ruang identitas dalam satu receipt. Dua array boleh muncul bersama. Satu array boleh kosong bila array pasangan memuat cukup assertion. Setiap status agregat atau count yang dicantumkan harus sesuai.

Enam suite menggunakan adapter pengukuran khusus. Bank-model mencatat rendering dua bahasa dan hasil eksak. Keyboard mencatat event fokus dan keydown tepercaya. Print-contrast menyimpan rasio kontras per tema. Roles-reflow mengukur viewport per kombinasi rute, bahasa, tema, lebar dan ukuran teks. Clean-build mencatat dua hasil build beserta hash payload. Viewed-coverage menyimpan nama kasus serta perbandingan nilai aktual dan harapan. Kunci data dan bentuk observasi diperiksa per produsen. Suite berbasis log menggunakan pola dan jumlah minimum yang ditetapkan registry.

## Bukti kelulusan

Runner menghapus output lama, mengeksekusi perintah, memeriksa waktu pembuatan dan menyalin receipt yang dihasilkan. Penulis dan pembaca binding memeriksa ulang nama file terdaftar, digest log dan receipt, assertion, perintah, exit code dan hasil. Verifikasi produksi memerlukan semua suite wajib, hash registry serta identitas build yang sesuai. Binding subset memiliki penanda diagnosis. Payload yang diuji mempunyai hash tersendiri sehingga ZIP pembawa bukti dapat diberi checksum sesudah pengemasan.

Semua JSON masukan negatif pada receipt_shape adalah fixture regresi validator. Kontrol positif mengeksekusi produsen data-cache-policy yang sesungguhnya. Bukti eksternal menjalani protokol tersendiri untuk perangkat, peserta, lingkungan dan identitas rilis. Kelulusan regresi validator tidak membuktikan penerimaan eksternal tersebut.
