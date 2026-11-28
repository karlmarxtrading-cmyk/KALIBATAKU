# Status rilis KALIBATAKU 1.5.0 (petualangan)

**Label rilis: HOLD**  ·  build `460c98b682110f7e`  ·  dist `e10803322291540a525e6edb0ad272395be6e5a172d2b4cb7aac1032c2ed3e0c`  ·  bank 1.2.0 (4.677 berkas identik)

Label diturunkan otomatis dari `evidence/v15/qa/binding.json` (diverifikasi ulang: ya) oleh `tools/release_registers_v15.py`. GO hanya bila semua kriteria WAJIB lulus pada build ini; READY_FOR_VALIDATION = gerbang otomatis lingkup lulus, validasi eksternal belum; HOLD = ada gerbang WAJIB belum terpenuhi.

## Rekap 71 kriteria

| Hasil | Jumlah |
|---|---|
| BLOCKED | 8 |
| NOT_RUN | 4 |
| PASS | 59 |

## Lingkup

| Lingkup | Label | Status skema | Kriteria |
|---|---|---|---|
| static_application | GO | PASS | AC:BANK-01=PASS; AC:BANK-02=PASS; AC:BANK-06=PASS; AC:REL-01=PASS; AC:REL-04=PASS; AC:REL-05=PASS; AC:DATA-01=PASS; AC:DATA-02=PASS; AC:DATA-03=PASS; AC:DATA-04=PASS; AC:DATA-05=PASS; AC:DATA-10=PASS; AC:DATA-11=PASS |
| adventure_journey | GO | PASS | AC:BANK-03=PASS; AC:BANK-04=PASS; AC:BANK-05=PASS; AC:PROG-01=PASS; AC:PROG-02=PASS; AC:PROG-03=PASS; AC:PROG-04=PASS; AC:PROG-05=PASS; AC:PROG-06=PASS; AC:PROG-07=PASS; AC:PROG-08=PASS; AC:PROG-09=PASS; AC:PROG-10=PASS; AC:PROG-11=PASS; AC:PROG-12=PASS; AC:DATA-06=PASS |
| ui_ux | READY_FOR_VALIDATION | TECHNICAL_PASS_USABILITY_NOT_VALIDATED | AC:UX-01=PASS; AC:UX-02=PASS; AC:UX-03=PASS; AC:UX-04=PASS; AC:UX-05=PASS; AC:UX-06=PASS; AC:UX-07=PASS; AC:UX-08=PASS; AC:UX-09=BLOCKED; AC:UX-10=PASS; AC:UX-11=PASS; AC:UX-12=PASS; AC:UX-13=PASS; AC:UX-14=PASS; AC:A11Y-01=PASS; AC:A11Y-02=PASS; AC:A11Y-03=PASS; AC:A11Y-05=PASS |
| backup_archive | GO | PASS | AC:DATA-07=PASS; AC:DATA-08=PASS; AC:DATA-09=PASS |
| offline | GO | PASS | AC:OFF-01=PASS; AC:OFF-02=PASS; AC:OFF-03=PASS; AC:OFF-04=PASS |
| teacher_reports | READY_FOR_VALIDATION | TECHNICAL_PASS_USABILITY_NOT_VALIDATED | AC:TEACH-01=PASS; AC:TEACH-02=PASS; AC:TEACH-03=BLOCKED; AC:TEACH-04=PASS |
| browsers_devices_assistive | READY_FOR_VALIDATION | TECHNICAL_PASS_USABILITY_NOT_VALIDATED | AC:DEVICE-01=PASS; AC:DEVICE-02=BLOCKED; AC:DEVICE-03=BLOCKED; AC:A11Y-04=BLOCKED |
| content_review | HOLD | HOLD | AC:BANK-07=BLOCKED |
| pedagogy_pilot | HOLD | NOT_PERFORMED | AC:PILOT-01=NOT_RUN; AC:PILOT-02=NOT_RUN; AC:PILOT-03=NOT_RUN |
| performance_lab | GO | PASS | AC:PERF-01=PASS; AC:PERF-02=PASS |
| field_performance | HOLD | NOT_RUN | AC:PERF-03=NOT_RUN |
| live_deployment | HOLD | PREVIEW_PASS | AC:REL-02=BLOCKED; AC:REL-03=BLOCKED |

## Gerbang yang belum terbukti

- AC:BANK-07 (BLOCKED): Butuh penelaah manusia. Roster 394 template siap (evidence/v15/review/roster-394-templates.csv, kolom penelaah kosong); protokol docs/PROTOKOL_EKSTERNAL_1.5.md.
- AC:UX-09 (BLOCKED): Belum ada hasil Android dan iOS fisik dengan keyboard sistem terbuka pada portrait dan landscape. Lihat docs/PROTOKOL_EKSTERNAL_1.5.md.
- AC:A11Y-04 (BLOCKED): Ujaran NVDA/VoiceOver/TalkBack belum direkam; inspeksi DOM otomatis bukan bukti ujaran. Protokol siap.
- AC:DEVICE-02 (BLOCKED): Tidak ada Android fisik. Emulasi viewport bukan bukti perangkat. Protokol siap.
- AC:DEVICE-03 (BLOCKED): Tidak ada iPhone/iPad fisik. Protokol siap.
- AC:TEACH-03 (BLOCKED): Penelaah belum merender dan memeriksa persamaan di Microsoft Word pada perangkat sasaran.
- AC:PILOT-01 (NOT_RUN): Belum ada peserta/izin pilot. Protokol dan formulir siap.
- AC:PILOT-02 (NOT_RUN): Belum ada guru peserta pilot.
- AC:PILOT-03 (NOT_RUN): Bergantung pada PILOT-01/02.
- AC:PERF-03 (NOT_RUN): Fase SETELAH_PILOT: butuh data lapangan p75 setelah pilot dan deployment.
- AC:REL-02 (BLOCKED): Tidak ada akses akun Cloudflare/domain; tidak ada klaim deployment. Panduan + perintah verifikasi siap (docs/DEPLOY.md).
- AC:REL-03 (BLOCKED): Update/rollback nyata memerlukan domain. Rollback lokal/kompatibilitas data dijelaskan; belum dijalankan di Pages.

Protokol penutupan: `docs/PROTOKOL_EKSTERNAL_1.5.md`. Register: `REGISTER_AC_FINAL.csv`, `REGISTER_TEMUAN_LAMA.csv`.
