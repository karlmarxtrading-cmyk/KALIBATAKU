# KALIBATAKU 1.3.0

Website latihan berhitung bilingual Indonesia–Inggris, kelas materi 1–12. Satu ZIP berisi aplikasi statis, bank lengkap, kode sumber, uji dan bukti. **Folder yang di-host adalah `dist/`.** Status produksi penuh: lihat [STATUS_RILIS.md](STATUS_RILIS.md) dan buka **[00_MULAI_DI_SINI.html](00_MULAI_DI_SINI.html)**.

## Menjalankan

```bash
python3 tools/preview.py        # http://127.0.0.1:4173/
npm run release:verify          # inventaris, checksum, sumber vs dist, binding QA
```

Deploy ke Cloudflare Pages: [docs/DEPLOY.md](docs/DEPLOY.md) (output **dist**, build command boleh kosong). Membangun ulang: Node ≥ 22 dan Python ≥ 3.11, `npm run build`.

## Menguji

```bash
CHROMIUM_PATH=/path/to/chrome npm run qa:production
npm run qa:assess
```

Lihat [docs/QA.md](docs/QA.md). Bukti 1.3.0: [evidence/v13/00_INDEKS.html](evidence/v13/00_INDEKS.html). Temuan audit 1.2.0 dan penutupannya: [TEMUAN_AUDIT_1.2.0.csv](TEMUAN_AUDIT_1.2.0.csv), [PENUTUPAN_AUDIT_1.2.0.csv](PENUTUPAN_AUDIT_1.2.0.csv).

## Mencoba sendiri

| Yang diperiksa | Alamat (setelah `#`) dan hasil yang semestinya |
|---|---|
| Kartu hasil setara | `/session/new?grade=5&level=3&op=ADD&pack=MM-G05-L03-ADD-P001&count=2`, jawab **21/12** → “Benar”, ubin 21/12 dan kunci 7/4, “Nilainya sama”. |
| Pecahan sebagai pembagi | `/session/new?grade=5&level=4&op=DIV&pack=MM-G05-L04-DIV-P001&count=2` → `21 ÷ 3/11` bertumpuk; teks salin dan fallback `21 ÷ (3/11)`; kunci 77. |
| Pembahasan kelas 3 | `/session/new?grade=3&level=5&op=DIV&pack=MM-G03-L05-DIV-P001&count=3`, soal 924 ÷ 11 → 880 + 44, langkah 80 + 4 → 84. |
| Waktu | Mode Kecepatan: tombol “Sisa waktu” atau Alt+T. |
| Cadangan | Profil dan data → Unduh cadangan profil (ZIP) → pulihkan di profil/perangkat lain. |
| Versi | Pengaturan → versi aplikasi 1.3.0, isi bank 1.2.0, ID build. |

Perubahan: [CHANGELOG_UIUX.md](CHANGELOG_UIUX.md) · [DECISIONS.md](DECISIONS.md) · [docs/MIGRASI_1.3.md](docs/MIGRASI_1.3.md) · [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) · [docs/PROTOKOL_GATE_EKSTERNAL.md](docs/PROTOKOL_GATE_EKSTERNAL.md).
