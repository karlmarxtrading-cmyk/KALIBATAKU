# Domain akhir, pembaruan dan rollback

Pengelola rilis mengisi domain/subpath tujuan, deployment lama, kandidat baru, identitas deployment yang dapat dipulihkan, serta otorisasi menguji/perubahan hosting. Gunakan [lembar catatan domain](formulir/rilis.csv) dan [panduan deployment proyek](../docs/DEPLOY.md). Publikasikan hanya isi `dist/`. Uji terbatas pada tujuan nyata memerlukan izin operator. Simpan persetujuan perubahan, kredensial dan informasi administrasi hosting secara privat.

## REL-02 · Bukti kandidat yang tersaji

1. Catat HTTPS origin **dan URL lengkap** termasuk subpath yang digunakan sekolah. Ambil identitas deployment dari pengelola hosting, upload/deployment manifest, sumber commit atau SHA paket unggahan, waktu aktivasi UTC dan identitas build. Hubungkan hash seluruh pohon dist ke **artefak deployment yang benar-benar dipublikasikan** melalui rekaman pipeline upload atau manifest artefak penyedia yang dapat diverifikasi. Cocokkan full digest SHA-256 dengan BUILD.json. Tanpa rangkaian bukti pengikatan deployment ke artefak, beri status terbuka.
2. Dari jaringan/perangkat operator buka beranda, peta, katalog dan tautan langsung latihan pada root/subpath yang memang digunakan. Mulai ulang halaman dan periksa pemuatan berkas relatif. Minta satu path yang memang tidak ada dan rekam 404. Periksa URL akhir, status HTTP, content type dan header yang berlaku pada dokumen, `journey/journey.mjs`, `journey/v1/route.json`, `sw.js`, `build-info.json`, `offline-assets.json` dan satu paket bank versi 1.2. Simpan response body kontrol dan digest SHA-256.
3. Periksa nilai `app_version` dan `bank_version` dari `build-info.json`, `release` dari `offline-assets.json`, cache untuk paket bank berversi, revalidasi shell, MIME modul/JSON, nosniff, CSP serta header aktual terhadap [konfigurasi publikasi](../dist/_headers). Hosting dapat menerapkan `_headers` sebagai konfigurasi, sehingga sumber bukti penerapannya adalah respons HTTP aktual. Catat konfigurasi proxy/subfolder jika ada.
4. Operator dapat mencatat body dan header kontrol dengan Git Bash pada host miliknya. Set `BASE` ke URL akhir berizin termasuk garis miring akhir. Jalankan di folder bukti privat. Sesuaikan nama `dist/` di pembandingan lokal dengan ekstraksi kandidat. Redaksi token dan header privat sebelum melampirkan ringkasan.

```bash
read -r -p "URL HTTPS tujuan, akhiri dengan /: " BASE
curl --fail --silent --show-error --location --dump-header build-info.headers --output build-info.served.json "${BASE}build-info.json"
curl --fail --silent --show-error --location --dump-header offline-assets.headers --output offline-assets.served.json "${BASE}offline-assets.json"
curl --silent --show-error --output missing.body --write-out '%{http_code}\n' "${BASE}kalibataku-verifikasi-halaman-tidak-ada.html"
sha256sum build-info.served.json offline-assets.served.json
```

Simpan artefak pengikat deployment penuh dari langkah pertama bersama bukti HTTP. Dua digest kontrol menunjukkan byte dua berkas tersebut.

## REL-03 · Dua perangkat, sesi lama dan pemulihan

| Titik pemeriksaan | Tindakan operator dan hasil yang dicatat |
|---|---|
| Deployment terdahulu | Catat ID, release dan digest dist. Pada dua perangkat beri alias berbeda, buka dua tab sesuai kebutuhan lintas versi, siapkan profil sintetis, simpan paket offline, mulai satu misi dan isi draf. Catat profil, ID/indeks soal, urutan, isi draf, riwayat serta digest cadangan. |
| Aktivasi kandidat terotorisasi | Pertahankan tab lama tetap terbuka selama update. Pada tab lama, jawab dan selesaikan sesi melalui alur yang asli. Periksa jawaban pertama, kunci, revisi, draf dan satu finalisasi. Catat worker yang mengendalikan tab serta release yang sedang menunggu. |
| Setelah semua tab ditutup | Tutup seluruh tab aplikasi, buka kembali target melalui koneksi, catat ID deployment dan release worker baru yang aktif. Mulai sesi baru pada kandidat, simpan cadangan, cek data lama dan cek misi offline pada dua perangkat. |
| Rollback | Operator mengaktifkan deployment terdahulu yang disetujui di URL akhir. Rekam URL, ID sebelum/baru/rollback, waktu dan digest ketiga keadaan. Verifikasi versi yang benar-benar tersaji dan worker aktif setelah siklus tab selesai. |
| Sesudah rollback | Buka profil dan riwayat pada kedua perangkat. Periksa sesi yang dibuat sebelum dan setelah update, urutan soal, jawaban mandiri/revisi, draf dan misi tersimpan dalam kondisi offline. Rekam hasil aktual per perangkat, apa yang pulih dan setiap perbedaan. |

Jangan menghapus data browser sebagai cara menyelesaikan uji migrasi. Jika rollback atau aktivasi gagal, tahan promosi, simpan bukti dan tanyakan tindakan lanjutan kepada penanggung jawab rilis. Keputusan keadaan akhir domain setelah percobaan berada pada operator yang berwenang.
