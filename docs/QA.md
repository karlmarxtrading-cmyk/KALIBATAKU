# QA KALIBATAKU

Untuk build 1.6.2 gunakan [panduan verifikasi static-auto-v1](QA_1.6.2.md). Bagian berikut merekam prosedur historis dan nama arsip pada versinya.

# Gerbang QA produksi (1.4.0)

```bash
npm run build
python3 tools/release_pack.py preflight          # manifest rilis (hash source + dist) di evidence/v14/release/
CHROMIUM_PATH=/path/to/chrome npm run qa:production   # 49 suite → evidence/v14/qa/binding.json
python3 tools/release_registers_v14.py --write   # REGISTER_AC_1.4.csv, REGISTER_TEMUAN_1.4.csv, RELEASE_STATUS.json, STATUS_RILIS.md
python3 tools/package_check.py                    # AC:REL-05: ZIP percobaan → ekstrak → seal + release:verify + build ulang identik
python3 tools/release_registers_v14.py --write   # perbarui REL-05
python3 tools/release_pack.py seal ../KALIBATAKU_ADVENTURE_SOURCE_DIST_BANK_EVIDENCE.zip
```

Pemetaan perintah lama → baru: semua perintah 1.3 (`release:verify`, `check`, `test`, `curriculum:check`, `build`, `qa:production`) tetap sama; keluaran gerbang pindah dari `evidence/v13/qa` ke `evidence/v14/qa` (bukti 1.3 tidak ditimpa). `npm run qa:assess` (register QA-xx 1.3) digantikan `tools/release_registers_v14.py` untuk 71 kriteria audit 1.3.0 (namespace `AC:`) dan 16 temuan (`TEMUAN:`). Suite baru: `bank-preservation`, `review-roster`, `journey-sidecar`, `journey-model`, `journey-next-practice-probe`, `journey-exports-reopened`, `data-archive-edges`, `journey-browser-chromium`, `journey-perf-lab`. Reproduksi audit (`08_REPRODUKSI`) dijalankan pada salinan source; log di `evidence/v14/commands/`.

---

# Gerbang QA produksi (1.3.0)

Satu perintah menjalankan seluruh pengujian wajib pada build yang akan dikemas:

```bash
npm run build                      # dist/ final, termasuk dist/build-info.json
CHROMIUM_PATH=/path/to/chrome npm run qa:production
npm run qa:assess                  # tulis register dari binding yang lolos verifikasi ulang
```

## Cara kerja

- `tools/qa_gate.py` menyalin proyek ke sandbox sementara (dist ditautkan keras dan diperiksa tidak berubah), lalu menjalankan 40 suite di `tests/qa/suites.json`. Bukti lama di repository tidak pernah ditulis ulang.
- Suite lulus hanya jika proses keluar 0, setiap receipt yang dideklarasikan benar-benar dibuat pada run ini, jumlah assertion yang dievaluasi ≥ ambang registry, tidak ada baris FAIL atau galat, dan identitas build receipt sama dengan dist yang diuji. Suite lama tanpa receipt dihitung dari baris hasil yang benar-benar dicetak; nol baris berarti FAIL.
- `BLOCKED_ENV` (exit 3) hanya diterima untuk suite yang terdaftar dapat diblokir lingkungan (Firefox/WebKit, render rumus DOCX oleh LibreOffice). Status ini tidak pernah menjadi PASS dan menahan kriteria terkait.
- `evidence/v13/qa/binding.json` menyimpan SHA-256 setiap receipt dan log, hash registry, identitas build dan versi runtime. `tools/assess.py` memverifikasi ulang semuanya dari disk sebelum menulis register; binding yang basi, berbeda runtime, receipt yang diubah atau registry yang dilonggarkan ditolak.
- `tests/qa/fault_injection.py` adalah tes negatif permanen (19 kasus) untuk gerbang dan assessor, termasuk reproduksi TECH-02: assertion yang disuntik gagal pada `tests/v12/browser.py` wajib menghasilkan exit nonzero.

## Alat

| Alat | Versi teruji |
|---|---|
| Node.js | 22.23.5 (`.nvmrc`) |
| Python | 3.13 (`.python-version` minimal 3.11) |
| Chrome for Testing | 153.0.8010.12 (`CHROMIUM_PATH`) |
| Python QA | `requirements-qa.txt` |
| LibreOffice | 24.2 (render DOCX) |

Aplikasi sendiri tidak punya dependensi npm (lockfile tanpa paket).

## Kode keluar

`0` semua suite wajib PASS · `3` ada suite yang diblokir lingkungan (diizinkan) · `1` ada kegagalan atau binding tidak terverifikasi · `2` prasyarat (build) belum ada.
