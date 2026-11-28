# KALIBATAKU — Paket arahan pembangunan website statis

**Versi paket:** 1.0 · **Tanggal:** 25 November 2026.  
**Isi:** arahan UI/UX, PRD, prompt eksekusi, spesifikasi bank soal, integrasi LMS, acceptance, kontrak dan sumber kurikulum.  
**Status:** dokumen pelaksanaan yang telah diperiksa; **website dan bank massal akan dibuat dengan prompt yang disertakan**.

## Cara memakai paket ini

1. Untuk memahami produk, baca `02_PRD_MASTER.md`. Untuk arah tampilan, baca `01_ARAHAN_UI_UX.md`.
2. Untuk meminta ChatGPT Work mengerjakan website, lampirkan **seluruh ZIP ini**, buka `03_PROMPT_EKSEKUSI_CHATGPT_WORK.txt`, lalu salin instruksi dari TUJUAN hingga AKHIR PROMPT.
3. Pilih tingkat penalaran sangat tinggi yang tersedia pada sesi kerja. Prompt meminta eksekusi lengkap, integrasi, verifikasi dan satu ZIP rilis aplikasi, tanpa berhenti meminta konfirmasi rutin.
4. Pelaksana membaca semua spesifikasi pendukung dan sumber yang sudah ada di paket. Tidak perlu mencari kembali lampiran percakapan sebelumnya untuk memenuhi isi handoff ini.
5. ZIP aplikasi yang dihasilkan nanti diperiksa dengan `06_ACCEPTANCE_QA_DAN_RILIS.md`; `07_DEPLOY_OPERASIONAL.md` menjelaskan source, dist dan jalur GitHub → Cloudflare.

Paket ini bukan `dist` website. Jangan mengunggah ZIP arahan sebagai aplikasi dan mengharapkan player sudah berfungsi. Tugas pada giliran ini adalah menyiapkan spesifikasi dan prompt yang diminta; status implementasi website pada matriks masih belum dijalankan.

## Tiga dokumen utama

| File | Fungsi |
|---|---|
| `01_ARAHAN_UI_UX.md` | Arah visual hangat dan profesional; 18 layar; state lengkap; bilingual; terang/gelap; perangkat; aksesibilitas; lazy loading dan performance budget |
| `02_PRD_MASTER.md` | Tujuan produk, ruang lingkup, pengguna, alur, lima mode, matematika, data, guru/admin, laporan, bridge dan Definition of Done |
| `03_PROMPT_EKSEKUSI_CHATGPT_WORK.txt` | Instruksi siap ditempel untuk membangun, mengisi bank, menguji, memperbaiki dan mengemas seluruh aplikasi statis |

## Dokumen pendukung

| File | Fungsi |
|---|---|
| `04_ARSITEKTUR_STATIC_DAN_BRIDGE_LMS.md` | Mesin, modularitas, IndexedDB, worker, offline, data provenance dan sinkronisasi |
| `05_BANK_SOAL_FACTORY.md` | Kelengkapan bank, template, pool, purpose, validasi eksak, deduplikasi dan manifest |
| `06_ACCEPTANCE_QA_DAN_RILIS.md` | 90 kasus uji website dan syarat bukti rilis yang dapat dinilai |
| `07_DEPLOY_OPERASIONAL.md` | Build, source/dist, hosting, header, cache, update/rollback dan tanggung jawab |
| `08_AUDIT_KURIKULUM_DAN_KEPUTUSAN.md` | Audit seluruh contoh sumber, empat koreksi dan keputusan pelaksanaan |
| `09_METRIK_DAN_LAPORAN.md` | Rumus skor/evidence/mastery, siklus retest, timing dan parents meeting |
| `10_SUMBER_DAN_KETERLACAKAN.md` | Sumber, otoritas dokumen, pembeda usulan/standar/bukti dan referensi primer |

## Berkas yang dapat dibaca mesin

- `curriculum/`: registry dan master curriculum efektif `1.0.0-draft.2`, errata before/after dan temuan audit. Empat contoh disesuaikan; 12 kelas, 60 level, 281 aktif, 19 nonaktif serta aturan sumber tetap dipertahankan.
- `planning/`: **68 persyaratan**, rencana **300 slot kompetensi**, rencana **4.604 paket/177.640 slot soal**, kebijakan mastery dan log keputusan. Rencana paket bukan manifest isi yang sudah diproduksi.
- `schemas/`: JSON Schema kontrak, konvensi canonical dan API bridge masa depan. Kontrak struktur tidak menggantikan validator 281 aturan kurikulum.
- `examples/`: contoh paket ESM/JSON, event, ACK mock dan report snapshot. Semua diberi label contoh kontrak; bukan bank lengkap.
- `ui/`: token tema, **18 pemeriksaan pasangan kontras**, serta **23 contoh microcopy ID/EN**. Katalog microcopy produksi tetap perlu dilengkapi pembangun.
- `qa/`: **46 fixture input jawaban**, fixture analitik, template 90 kasus uji, template status rilis, verifier sumber/handoff, dan hasil pemeriksaan paket dokumen.
- `00_SUMBER/`: ketiga berkas sumber dengan byte asli, untuk audit dan perbandingan.

## Makna “production ready” yang dipakai

Website statis yang diminta nanti harus memiliki bank lengkap, lima mode bekerja, hasil lokal konsisten, monitoring demo terhubung ke mesin, enam ekspor valid, dua bahasa/tema, offline terpilih dan bridge yang lolos kontrak. Semua klaim harus mengacu ke source/dist/bank serta bukti pengujian yang sama.

LMS pusat tetap tahap berikutnya. Autentikasi institusi, monitoring antarperangkat, penyimpanan server dan hasil resmi baru dinyatakan beroperasi setelah ada server nyata yang diuji. Data demo tidak berubah menjadi data akademik resmi. Kebijakan mastery adalah rancangan internal yang harus dapat ditinjau; tidak diklaim sebagai kurikulum pemerintah atau norma usia terkalibrasi.

## Hasil audit awal yang dibawa ke implementasi

Seluruh 281 kunci contoh pada sumber benar secara aritmetika. Empat contoh melanggar batas/struktur level meskipun kuncinya benar; perbaikannya ada dalam errata dan registry draft.2. Angka 177.640 adalah slot rencana, bukan jumlah soal unik dan bukan isi ZIP sumber. Contoh G01-L01 ADD hanya memiliki 12 bentuk kanonik; pengulangan terencana lintas paket dicatat sebagai pengulangan.

## Pemeriksaan ulang paket dokumen

Python 3.10 atau lebih baru diperlukan untuk seluruh verifier. Verifier sumber memakai standard library. Verifier handoff menggunakan `jsonschema` yang versinya dicantumkan pada `qa/requirements.txt`; pasang dependensi tersebut dalam lingkungan Python kerja sebelum menjalankannya.

```bash
python3 qa/source_audit_verifier.py
python3 qa/source_audit_verifier.py --registry curriculum/KALIBATAKU_CURRICULUM_REGISTRY_v1_0_DRAFT2.json --patched
python3 qa/verify_handoff.py
```

Jalankan dari root paket setelah diekstrak; `python` dapat menggantikan `python3` jika sesuai sistem. Sumber asli PASS berarti semua hitungan benar **dan empat temuan yang diketahui terdeteksi**, bukan sumber tanpa masalah. Versi patched harus mempunyai nol dari empat konflik tersebut. Verifier handoff memeriksa struktur, schema/contoh, perhitungan, rencana, traceability, token dan hash paket; tidak menguji website yang belum dibangun.

Satu ZIP ini adalah bahan pelaksanaan lengkap. Hasil yang diminta dari prompt adalah ZIP aplikasi tersendiri dengan `dist/`, seluruh bank aktual dan bukti rilis.
