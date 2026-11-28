# Migrasi dan kompatibilitas 1.2.0 → 1.3.0

## Versi

| Komponen | 1.2.0 | 1.3.0 |
|---|---|---|
| Aplikasi | 1.2.0 (Pengaturan salah menampilkan 1.1.0) | 1.3.0, dibaca dari `dist/build-info.json` |
| Isi bank | 1.1.0, jalur `bank/v1.1/` | 1.2.0, jalur `bank/v1.2/` |
| Format cadangan | 1 (satu JSON, maks. 50 MiB) | 2 (arsip ZIP); format 1 tetap dapat dipulihkan |
| Renderer rumus | MathJax 4.1.3 lokal | Renderer SVG bawaan (`src/math/typeset.mjs`) |
| Database IndexedDB | `kalibataku-learning` v2 | tidak berubah |

## Isi bank 1.2.0 dan sesi lama

- Matematika tidak berubah: ID soal, fingerprint, kunci, AST, urutan dan jumlah penempatan identik dengan 1.1.0 di seluruh 4.604 paket (`tests/bank/domain_prose.py`, `evidence/v13/bank/bank-1.1.0-identity.json.gz`).
- Kata-kata petunjuk, pembahasan dan langkah berubah untuk 19.966 soal (MATH-002). Daftar lengkap teks lama dan baru: `evidence/v13/bank/editorial-changes-1.1.0-to-1.2.0.csv.gz`.
- Sesi yang dibuat dengan bank 1.1.0 menyimpan snapshot butir. Sesi itu dilanjutkan, diselesaikan dan ditinjau dengan teks yang dilihat siswa waktu itu; tidak ditulis ulang. Sesi baru memakai teks 1.2.0. Diuji oleh `tests/upgrade/bank-1.2.mjs` dengan cadangan autentik yang dibuat aplikasi 1.2.0.
- Seperti pada 1.1.0, jalur bank lama tidak lagi disajikan. Paket offline 1.1.0 yang terpasang tetap dilayani dari cache sampai dipasang ulang; status paket di layar Offline menunjukkan perlu pembaruan.

## Cadangan format 2

- Satu berkas ZIP: `manifest.json` (format `kalibataku-profile-archive`, versi arsip 2, schema data 1.0.0, identitas profil, waktu ekspor, versi aplikasi, total sesi/event/catatan, daftar bagian berurutan dengan ukuran dan SHA-256, checksum manifest) serta `parts/part-NNNNN.json` (deflate). Satu sesi dan seluruh event-nya selalu berada dalam bagian yang sama.
- Batas: bagian ≤ 32 MiB setelah dekompresi, total ≤ 1 GiB, berkas ≤ 512 MiB, ≤ 2 juta baris, ≤ 4.000 bagian. Dekompresi dihentikan saat melewati batas.
- Pemulihan menolak bagian hilang, duplikat, tidak terdaftar, rusak, milik profil lain atau manifest yang tidak cocok sebelum menulis apa pun. Semua baris ditulis dalam satu transaksi; kuota penuh, pembatalan atau konflik tidak meninggalkan pemulihan setengah jalan. Impor ulang bersifat idempoten.
- Cadangan format 1 dari 1.0.0–1.2.0 tetap dipulihkan (batas 50 MiB lamanya dipertahankan untuk berkas JSON). Cadangan pemulihan pemain memakai format 1 bila muat, format 2 bila tidak.
- Jangan mengekstrak ZIP sebelum memulihkan.

## Preferensi

Tujuh preferensi browser tidak berubah kunci maupun default (`kalibataku.preferences.v1`): `lang=id`, `theme=system`, `textSize=regular`, `sound=false`, `reduceMotion=false`, `keypad=true`, `showTimer=true`. Default kini bersumber dari `src/core/preferences.mjs`. Tombol “Pulihkan preferensi bawaan” hanya mengubah ketujuh nilai ini. Materi terakhir dan aturan evaluasi lokal tetap per profil.

## Cache offline

Service worker 1.3.0 menjalankan kebijakan retensi saat aktif: shell rilis aktif, shell/paket yang dirujuk instalasi, dan satu shell lengkap sebelumnya (rollback) dipertahankan; shell lama/parsial dan cache paket yatim dihapus. IndexedDB tidak pernah dibersihkan oleh proses ini.
