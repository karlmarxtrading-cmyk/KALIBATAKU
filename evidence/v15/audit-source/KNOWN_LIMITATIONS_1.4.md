# Batas dukungan 1.4.0

Status per kriteria: `REGISTER_AC_1.4.csv`; ringkasan: `STATUS_RILIS.md`; protokol: `docs/PROTOKOL_EKSTERNAL_1.4.md`.

| Lingkup | Bukti tersedia (build final) | Belum terbukti |
|---|---|---|
| Browser | Chromium (Chrome for Testing 153, headless): alur petualangan, offline, reflow, keyboard, semua suite 1.3 | Firefox dan WebKit: biner tidak dapat diunduh di lingkungan ini (BLOCKED_ENV). |
| Perangkat | Viewport 320–2.560 px, teks terbesar, 200% | Android dan iPhone/iPad fisik. |
| Teknologi bantu | Struktur DOM, nama, urutan fokus | Ujaran NVDA/VoiceOver/TalkBack. |
| Dokumen | PDF/DOCX/XLSX/CSV/JSON dibuka ulang | Persamaan DOCX di Microsoft Word. |
| Pedagogi | Metadata `authored_heuristic`, roster 394 template | Review pengajar, pilot 12 siswa/3 guru; kalibrasi empiris. |
| Kinerja | Lab Chromium (5 run): JS beranda 38,7 KiB gzip, tambahan player 40,2 KiB (termasuk paket soal), misi siap median 262 ms, feedback median 35 ms / p95 45 ms | Data lapangan p75 (fase SETELAH_PILOT). |
| Deployment | Preview lokal root/subfolder HTTP/HTTPS | Domain Pages nyata, update dan rollback nyata. |
| Misi | Satu paket per attempt; pool kecil memakai review berlabel | Misi lintas paket tidak diterapkan. |
| Sinkronisasi | Profil lokal; ruang guru simulasi | LMS/server sekolah nyata (di luar lingkup statis). |

---

# Batas penerimaan 1.3.0

Status per kriteria ada di `ACCEPTANCE_RESULTS.csv`, `ACCEPTANCE_FM.csv` dan `PENUTUPAN_AUDIT_1.2.0.csv`; ringkasan di `STATUS_RILIS.md`. Protokol pelaksanaan: `docs/PROTOKOL_GATE_EKSTERNAL.md`.

| Lingkup | Bukti yang tersedia | Yang masih diperlukan |
|---|---|---|
| Firefox dan WebKit | Chromium 153 menjalankan seluruh suite browser | Binary Firefox/WebKit tidak tersedia di lingkungan pembuatan (BLOCKED_ENV). Jalankan `npm run qa:production` di mesin yang memilikinya. |
| Android dan iOS/iPadOS | Viewport 320–1.440 px, teks 138%, tema, fokus, keyboard desktop | Ponsel fisik: caret, IME/composition, salah ketuk, rotasi, area aman, unduhan dan Files. |
| Teknologi bantu | Nama rumus ID/EN, live region waktu, pengumuman ambang terbatas (diuji lewat DOM) | Ujaran nyata NVDA, VoiceOver dan TalkBack. |
| Dokumen | PDF vektor, OMML DOCX, XLSX/CSV/JSON dibaca ulang | LibreOffice 24.2 di sini tidak mengekspos teks persamaan OMML setelah render (BLOCKED_ENV); periksa DOCX di Word. |
| Kinerja | Anggaran gzip lulus; lab tanpa throttling | Perangkat sasaran dengan jaringan terbatas; p75 lapangan memerlukan trafik produksi. |
| Kurikulum dan UX | Oracle eksak, regenerasi byte-identik, pemeriksaan domain narasi, log editorial | Penelaah manusia, pilot siswa/guru/operator/orang tua. |
| Deployment dan LMS | HTTP/HTTPS root/subfolder lokal | Domain akhir, rollback nyata; LMS institusi di luar lingkup statis. |
