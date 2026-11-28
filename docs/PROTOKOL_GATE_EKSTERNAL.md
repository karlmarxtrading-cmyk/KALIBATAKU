# Protokol gate eksternal 1.3.0

Gate di bawah ini tidak dapat ditutup oleh otomatisasi di lingkungan pengembangan. Statusnya di register tetap BLOCKED, NOT_RUN atau NOT_PERFORMED sampai hasil nyata dicatat. Jangan mengisi kolom hasil dengan asumsi.

Untuk setiap sesi, catat: tanggal, nama/peran pelaksana, perangkat (model), OS dan versi, browser dan versi, ID build (`Pengaturan → Identitas build`, juga `RELEASE_STATUS.json`), skenario, hasil aktual, bukti (rekaman/transkrip/berkas), keputusan dan tindak lanjut. Simpan di `evidence/external/<tanggal>-<gate>/`.

## QA-18 · Ponsel fisik (AC-030, AC-053, AC-055–057, FM-038–040, FM-044)

Perangkat minimal: satu Android (Chrome, keyboard Gboard + satu IME lain) dan satu iPhone atau iPad (Safari).

1. Buka `#/session/new?grade=5&level=3&op=ADD&pack=MM-G05-L03-ADD-P001&count=2`. Ketik `21/12` memakai keyboard sistem dan tombol simbol. Catat posisi caret setelah tombol `/` dan `−`.
2. Ketik desimal di ID (`0,5`) dan EN (`0.5`). Gunakan IME dengan composition aktif; Enter selama composition tidak boleh mengirim.
3. Putar perangkat saat jawaban terisi; draf tetap. Keyboard virtual tidak menutupi tombol OKE; area aman (notch) tidak memotong kontrol.
4. Ketuk setiap tombol kecil (Sisa waktu, Petunjuk, Lewati, simbol). Catat salah ketuk per 20 ketukan.
5. Unduh laporan PDF dan cadangan ZIP; buka di Files/Unduhan; pulihkan cadangan di perangkat yang sama dan perangkat lain.
6. Tutup tab di tengah sesi, buka lagi, lanjutkan.

Lulus bila semua langkah berhasil tanpa kehilangan data dan salah ketuk ≤ 1 per 20 pada kontrol utama.

## QA-19 · Pembaca layar (AC-045, AC-058, FM-041, FM-042)

NVDA + Firefox/Chrome (Windows), VoiceOver + Safari (iOS/macOS), TalkBack + Chrome (Android).

1. Soal `21 ÷ (3/11)` (`pack=MM-G05-L04-DIV-P001`): catat ujaran persis. Harus memuat “buka kurung 3 per 11 tutup kurung”.
2. Kartu hasil: status, jawabanmu, kunci, cara menghitung dan langkah terbaca berurutan setelah OKE; Enter kedua tidak melompati kartu.
3. Tantangan waktu 30 detik: tombol “Sisa waktu” dan Alt+T membacakan sisa waktu; pengumuman ambang 10 detik terdengar satu kali; tidak ada pengumuman tiap detik.
4. Galat input (`1/0`), dialog keluar sesi, laporan HTML (urutan judul, tabel).

Rekam audio atau transkrip ujaran. Lulus bila tidak ada informasi yang hilang dan tidak ada ujaran berulang yang mengganggu.

## QA-26 · Penelaahan editorial (AC-074, MATH-003)

Bahan: `evidence/v13/bank/editorial-changes-1.1.0-to-1.2.0.csv.gz` (teks lama/baru ID/EN), roster `evidence/v12/bank/editorial-roster.csv` (1.186 sampel dari 394 keluarga). Penelaah: guru matematika SD/SMP/SMA dan penelaah bahasa ID/EN. Untuk tiap baris catat keputusan (setuju / perbaiki / tolak), alasan dan teks usulan. Perbaikan dilakukan di `factory/`, bank diregenerasi dengan versi konten baru, lalu `npm run qa:production` diulang.

## QA-27 · Pilot pengguna (AC-076–079, FM-048)

Peserta: siswa baru dan kembali (kelas awal dan menengah), guru, operator, orang tua. Tugas mengikuti `evidence/v12/input/04_RENCANA_PENUTUPAN_PRODUKSI.md`. Catat N, keberhasilan tugas, waktu, kesalahan, kutipan, dan tindak lanjut; ulangi tugas yang gagal setelah perbaikan.

## QA-08 lanjutan · Firefox dan WebKit (AC-059, FM-045)

Lingkungan pembuatan rilis ini tidak memiliki binary Firefox/WebKit Playwright (unduhan CDN diblokir). Jalankan di mesin yang memilikinya:

```bash
python3 -m playwright install firefox webkit
npm run qa:production      # browser-v13-firefox dan browser-v13-webkit berubah dari BLOCKED_ENV menjadi PASS/FAIL
npm run qa:assess
```

## QA-25 · Deployment publik dan QA-28 · Kinerja lapangan

Ikuti `docs/DEPLOY.md`. Catat URL, deployment ID, hash `offline-assets.json` yang disajikan, hasil smoke (root, deep link `#/settings`, 404, MIME `.mjs`, header CSP, `sw.js` revalidasi), unduhan, dan uji rollback. p75 LCP/INP/CLS hanya dari data lapangan dengan periode, N dan kohort perangkat yang dinyatakan.
