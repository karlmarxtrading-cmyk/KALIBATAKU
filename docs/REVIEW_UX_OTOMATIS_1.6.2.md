# Tugas sintetis dan penelaahan antarmuka oleh AI

Versi aplikasi 1.6.2. Penelaahan visual oleh AI memeriksa dua tangkapan Chromium desktop Linux pada viewport 320 × 568 piksel CSS, dengan preferensi gerakan dikurangi. Bukti visual tersimpan di `evidence/v162/tasks/visual-review/`. Keputusan gerbang memakai hasil eksekusi terikat build di `evidence/v162/tasks/synthetic-journeys.json` dan `evidence/v162/tasks/semantic-access.json`.

## Temuan pada tampilan jawaban salah

Pada tampilan Indonesia terang, teks “Belum tepat” dan ikon tanda seru menyampaikan hasil. Nilai −997 dan kunci memiliki label tersendiri. Tombol “Soal berikutnya · Enter” berada di atas “Revisi jawaban”. Keduanya terlihat tanpa menggulir, dan garis fokus mengelilingi wilayah hasil. Pada tampilan Inggris gelap, urutan dan label tindakan setara. Judul pembahasan terlihat setelah kedua tindakan. Pada layar pendek, kelanjutan pembahasan dapat memerlukan gulir. Gambar memperlihatkan posisi ketika fokus berada pada hasil pemeriksaan. Pengujian mengukur kembali posisi ekspresi dan kolom setelah Enter berikutnya.

Pada lima sampel teks per tema (judul hasil, dua label nilai, tombol maju dan tombol revisi), rasio terendah yang diukur ialah 5,78∶1 pada tema terang dan 7,64∶1 pada tema gelap. Hasil per pasangan warna tersedia di pemeriksaan `rendered-contrast`. Pengujian semantik juga melepas nama rumus dan merusak referensi penjelasan galat pada DOM sementara. Pemeriksa menemukan kedua perubahan pada kedua bahasa, lalu memverifikasi pemulihannya.

## Tugas yang dieksekusi

Satu profil siswa sintetis memulai misi dari beranda melalui satu tindakan. Siswa meminta petunjuk, mengirim jawaban salah, membuka langkah, merevisi jawaban, memuat ulang halaman hasil, menyelesaikan misi berisi enam soal, lalu memulai misi berikutnya melalui satu tindakan. Satu pengiriman mempertahankan indeks sampai Enter berikutnya. Riwayat membedakan kesalahan pertama dari revisi setelah kunci terlihat.

Pada peran guru sintetis, laporan profil yang sama menampilkan satu misi selesai dan satu yang sedang berlangsung. Pengujian memeriksa sumber lokal, identitas profil dan pratinjau dua bahasa. Pada konteks browser kosong, alur pemulihan membaca arsip unduhan asli, menunjukkan nama profil sebelum impor, lalu membandingkan urutan butir, riwayat, ID kejadian dan draf. Setelah paket latihan tersedia di cache dan origin uji menolak koneksi, beranda membuka kembali sesi dengan draf 37/9 melalui satu tindakan. Permintaan ke alamat yang tidak tersimpan di cache juga diuji gagal.

`semantic-access` membaca accessibility tree Chromium melalui protokol DevTools, keadaan DOM, lokasi elemen, gaya hasil komputasi dan fokus keyboard. `map-native-zoom`, `v12-keyboard`, `v12-print-contrast` serta suite viewport dan keyboard Playwright melengkapi cakupan. Buka register untuk status masing-masing pada build final.

Bukti ini mencakup tugas sintetis, tampilan desktop yang dipersempit dan antarmuka aksesibilitas browser. Ujaran NVDA, VoiceOver, TalkBack, perangkat fisik, kenyamanan pengguna, efektivitas belajar dan kesesuaian penuh WCAG berada di luar pengamatan ini.
