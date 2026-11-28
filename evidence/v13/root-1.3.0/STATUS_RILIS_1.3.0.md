# KALIBATAKU 1.3.0 · Status rilis

**HOLD untuk produksi penuh.** Folder `dist/` dapat dipasang dan diuji sekarang.

AC (80) · 9 BLOCKED, 1 DEFERRED_BY_SCOPE, 1 NOT_PERFORMED, 5 NOT_RUN, 64 PASS. FM (48) · 8 BLOCKED, 1 NOT_RUN, 39 PASS. Kriteria penutupan audit (30) · 5 BLOCKED, 1 DEFERRED_BY_SCOPE, 2 NOT_PERFORMED, 2 NOT_RUN, 20 PASS.

Gerbang produksi: BLOCKED_ENV · 40 suite · 1302 assertion · build `d69d4921d7f04c1a`.

| Lingkup | Status | Batas klaim |
|---|---|---|
| static_application | HOLD | Build statis lengkap dan terverifikasi untuk hosting. Gate wajib yang membutuhkan perangkat fisik, pembaca layar atau mesin browser lain masih terbuka. |
| ui_ux | TECHNICAL_PASS_USABILITY_NOT_VALIDATED | Redesain dan temuan UX diuji otomatis di Chromium dengan viewport/teks/tema. Usability dengan pengguna nyata belum dilakukan. |
| arithmetic_bank | PASS | Bank konten 1.2.0: 4.604 paket, 177.640 penempatan, oracle eksak dan regenerasi byte-identik. |
| representation_narrative | PASS | Teks linear seluruh soal/langkah setara AST; narasi G1–6 nonnegatif. Ini pemeriksaan otomatis, bukan penelaahan guru. |
| pedagogy_pilot | NOT_PERFORMED | Penelaah manusia dan pilot peserta belum ada. |
| bridge_contract | PASS | Kontrak, retry, ACK dan isolasi diuji dengan fixture. |
| live_lms | DEFERRED_BY_SCOPE | LMS institusi live di luar lingkup statis. |
| performance_lab | PASS | Player + renderer 50090 B gzip (batas 90 KiB). Lab tanpa throttling; bukan data lapangan. |
| field_performance | NOT_RUN | p75 LCP/INP/CLS memerlukan trafik produksi. |
| live_deployment | PREVIEW_PASS | HTTP/HTTPS root dan subfolder lulus di pratinjau lokal. Deployment publik belum dilakukan. |

## Temuan audit 1.2.0

| ID | Prioritas | Status 1.3.0 |
|---|---|---|
| MATH-001 | P1 | FIXED_VERIFIED |
| MATH-002 | P1 | FIXED_VERIFIED |
| MATH-003 | GAP | NOT_PERFORMED |
| TECH-01 | P1 | FIXED_VERIFIED |
| TECH-02 | P1 | FIXED_VERIFIED |
| TECH-03 | P1 | FIXED_VERIFIED |
| TECH-04 | P2 | FIXED_VERIFIED |
| UX-001 | P2 | FIXED_VERIFIED |
| UX-002 | P2 | FIXED_VERIFIED |
| UX-003 | P3 | FIXED_VERIFIED |
| UX-004 | P3 | FIXED_VERIFIED |
| UX-005 | P3 | FIXED_VERIFIED |
| UX-006 | P2 | FIXED_VERIFIED |

## Gate wajib yang masih terbuka

- **AC-030** · BLOCKED · Perlu keyboard dan caret pada perangkat Android dan iOS fisik.
- **AC-045** · BLOCKED · Perlu pendengar pembaca layar pada laporan HTML.
- **AC-053** · BLOCKED · Perlu observasi salah ketuk serta jarak kontrol pada perangkat fisik.
- **AC-055** · BLOCKED · Perlu perangkat Android dan IME sistem.
- **AC-056** · BLOCKED · Perlu Safari iPhone/iPad dan Files pada perangkat fisik.
- **AC-057** · BLOCKED · Perlu IME asli dengan composition pada perangkat sasaran.
- **AC-058** · BLOCKED · Perlu rekaman ujaran NVDA, TalkBack dan VoiceOver.
- **AC-059** · BLOCKED · browser-v13-firefox: BLOCKED_ENV; browser-v13-webkit: BLOCKED_ENV
- **AC-080** · BLOCKED · Masih ada gate WAJIB_STATIC terbuka: AC-030, AC-045, AC-053, AC-055, AC-056, AC-057, AC-058, AC-059, FM-036, FM-038, FM-039, FM-040, FM-041, FM-042, FM-044, FM-045, QA-08, QA-18, QA-19, QA-22. Domain akhir belum diuji.
- **FM-036** · BLOCKED · documents-reopened/docx-render-equations: BLOCKED_ENV
- **FM-038** · BLOCKED · Android fisik.
- **FM-039** · BLOCKED · Safari dan Files pada iPhone/iPad fisik.
- **FM-040** · BLOCKED · IME fisik.
- **FM-041** · BLOCKED · Pendengar NVDA.
- **FM-042** · BLOCKED · Pendengar VoiceOver dan TalkBack.
- **FM-044** · BLOCKED · Observasi sentuh fisik.
- **FM-045** · BLOCKED · browser-v13-firefox: BLOCKED_ENV; browser-v13-webkit: BLOCKED_ENV
- **QA-08** · BLOCKED · browser-v13-firefox: BLOCKED_ENV; browser-v13-webkit: BLOCKED_ENV
- **QA-18** · BLOCKED · Perangkat Android dan iPhone/iPad fisik diperlukan (caret, IME, safe area, rotasi, unduhan). Uji desktop dan emulasi viewport bukan pengganti.
- **QA-19** · BLOCKED · Pendengar NVDA, VoiceOver dan TalkBack diperlukan. Pengumuman waktu dan nama rumus diuji melalui DOM/aria, bukan ujaran nyata.
- **QA-22** · BLOCKED · documents-reopened/docx-render-equations: BLOCKED_ENV
- **QA-30** · BLOCKED · Masih ada gate WAJIB_STATIC terbuka: AC-030, AC-045, AC-053, AC-055, AC-056, AC-057, AC-058, AC-059, FM-036, FM-038, FM-039, FM-040, FM-041, FM-042, FM-044, FM-045, QA-08, QA-18, QA-19, QA-22. Domain akhir belum diuji.

Build dist SHA-256 `d49eb6de1f8df3e2f22151e3efd282127de4bfcf25f207cfbb728772f2a56461`.
