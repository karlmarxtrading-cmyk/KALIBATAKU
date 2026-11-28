# Verifikasi arsip masukan dan bank 1.6.1

Jalankan dari direktori utama kandidat di Git Bash atau Bash, dengan Python 3.12, PyMuPDF, Node.js sesuai `package.json`, Playwright Python, dan Chromium terpasang. Contoh ini menempatkan ZIP kandidat 1.6.0 dan PDF audit terpisah di direktori saudara bernama `masukan`. ZIP audit asli disertakan di `evidence/v161/audit-input`. Simpan hasil ulangan di direktori baru di luar paket untuk mempertahankan berkas bukti rilis.

```bash
baseline=../masukan/KALIBATAKU_1.6.0_KANDIDAT_HOLD.zip
audit=evidence/v161/audit-input/KALIBATAKU_1.6.0_AUDIT_PRODUKSI_20261128.zip
pdf=../masukan/KALIBATAKU_1.6.0_LAPORAN_AUDIT_PRODUKSI_20261128.pdf
ulang="$(mktemp -d ../ulang-integritas.XXXXXX)"
python evidence/v161/integrity/periksa_masukan.py "$baseline" "$audit" "$pdf" "$ulang"
python -m zipfile -e "$baseline" "$ulang/1.6.0"
( cd "$ulang/1.6.0" && npm run release:verify )
python evidence/v161/integrity/periksa_bank.py "$baseline" . "$ulang"
python tests/v15/update-rollback-local.py "$ulang/1.6.0/dist" --candidate dist --out "$ulang/update-local"
```

| Hasil | Pemeriksaan |
| --- | --- |
| `identitas-masukan.json`, `inventaris-arsip-audit.csv` | CRC setiap entri, himpunan path, ukuran, hash setiap berkas, kelengkapan manifest dan kecocokan inventaris audit dengan ZIP kandidat. Hash teks hasil ekstraksi dan raster dicatat per halaman dari kedua PDF. |
| `release-verify-1.6.0.log`, `release-verify-1.6.0.json` | Verifikasi paket 1.6.0 dari ekstraksi tersendiri, identitas artefak serta status keluar proses. Jumlah suite lama merujuk ke binding yang dikirim bersama versi 1.6.0. |
| `bank-per-berkas.csv` | Satu baris per berkas bank. Periksa jumlah, ukuran dan dua hash. Pemeriksa juga membandingkan langsung seluruh byte. |
| `bank-dan-pemetaan.json` | Himpunan ID paket, kompetensi, tahap, prasyarat, penempatan, keluarga soal, fingerprint unik, dan pemisahan paket ajar dari form evaluasi A/B. Pin dihitung kembali dari sumber dan seluruh bank. |
| `../update-local/update-rollback.json` | Bukti browser dari dua distribusi. Bandingkan release, hash dist, hash soal/urutan/riwayat, isi draf, aktivasi service worker, integritas cache, dan penyelesaian misi dalam keadaan luring. |

Dua PDF audit 1.6.0 memiliki SHA-256 berkas yang berbeda. Seluruh 13 halaman mempunyai teks hasil ekstraksi, ukuran halaman dan gambar RGB 72 dpi yang sama. Riwayat audit Firefox tercatat lengkap di `identitas-masukan.json`: putaran pertama 9/10, ulangan kasus legacy 1/1, kemudian ulangan penuh 10/10. Angka tersebut berasal dari tiga rekaman historis yang tanggal dan SHA-256-nya tercantum di sana.

Bukti transisi versi menggunakan satu origin HTTP loopback, profil sintetis, IndexedDB, dan Cache Storage asli pada Chromium. Gerbang penerapan domain, OS dan perangkat fisik menggunakan protokol dalam kit validasi eksternal.

### Verifikasi ZIP pengiriman

Dari ekstraksi kandidat, gunakan skrip berikut pada ZIP asli. Sesuaikan lokasi ZIP. Hasil JSON ulangan ditempatkan di luar ZIP yang diukur agar checksum arsip dapat dihitung langsung.

```bash
python evidence/v161/integrity/periksa_zip_akhir.py ../KALIBATAKU_1.6.1_KANDIDAT_HOLD.zip \
  --version 1.6.1 \
  --source-sha fdd195f40a594faef3fe582ae00a1156850321de3dc78f05785fac96ee792b41 \
  --dist-sha 9693b517c9ef39df3e03a264e5484a7d83281b87673f204c654737e29fe4653b \
  --json "$ulang/zip-final.json"
```

Pemeriksa menggunakan format ZIP deterministik yang dihasilkan pembungkus proyek. Ia mencocokkan header lokal dengan direktori pusat, memeriksa batas entri ZIP termasuk rekaman akhir, membaca setiap entri untuk CRC, ukuran dan SHA-256, serta memeriksa liputan kedua manifest. Ia menghitung ulang identitas source, dist dan bank, lalu memeriksa hash log dan receipt yang tercatat pada QA binding. Untuk membandingkan checksum seluruh ZIP dengan nilai yang diterima terpisah, tambahkan opsi `--sha256` beserta nilai tersebut. Identitas kandidat saat uji transisi dan pengecekan bank tercantum dalam `ikatan-integritas.json`.
