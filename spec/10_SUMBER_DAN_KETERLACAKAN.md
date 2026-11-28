# Sumber, keputusan dan batas bukti

Tanggal: 25 November 2026. Dokumen ini membedakan isi yang berasal dari pengguna, hasil pemeriksaan sumber, pilihan desain proyek dan fakta teknis dari dokumentasi resmi.

## 1. Sumber pengguna yang dipakai

| ID | Sumber | Lokasi salinan dalam ZIP | Perlakuan |
|---|---|---|---|
| S1 | `KALIBATAKU_MASTER_CURRICULUM_v1.zip` | Dua berkas hasil ekstrak di `00_SUMBER/` | Kedua anggota dibaca; byte file dipertahankan |
| S1A | `KALIBATAKU_MASTER_CURRICULUM_v1.md` | `00_SUMBER/KALIBATAKU_MASTER_CURRICULUM_v1.md` | 60 level, spesifikasi tiap operasi, pedagogi, struktur dan integrasi |
| S1B | `KALIBATAKU_CURRICULUM_REGISTRY_v1.json` | `00_SUMBER/KALIBATAKU_CURRICULUM_REGISTRY_v1.json` | 300 sel, status, 281 contoh, AST/kunci, kapasitas dan metadata |
| S2 | `Markdown yang ditempel (1)(20261125-145228).md` | `00_SUMBER/BRIEF_PENGGUNA_20261125.md` | Nama dinormalisasi, byte isi tetap; seluruh brainstorming mesin, monitoring dan LMS |
| S3 | Instruksi pengguna terbaru pada percakapan ini | Dirumuskan pada PRD dan README | ZIP UI/UX + PRD super lengkap + prompt Work + persyaratan produksi/bank; bilingual, semua device, terang/gelap, lazy/full functionality |

Metadata file percakapan lama tidak dipakai untuk mengklaim berkas yang tidak dibuka. Lampiran saat ini dan isi percakapan yang terlihat mencukupi cakupan tugas. Tidak mengambil data siswa asli, credentials, kode aplikasi proyek lain atau keputusan bisnis proyek lain ke dalam spesifikasi KALIBATAKU.

Hash SHA-256 sumber dan ZIP input tercatat di `planning/source_provenance.json`. Tidak ada penimpaan sumber. Registry kerja berada di `curriculum/` dan mempunyai versi `1.0.0-draft.2`; `ERRATA_APPLIED.json` merinci keempat perubahan contoh. Perubahan nomor versi/kalimat canonical numerator adalah editorial, bukan perluasan materi.

## 2. Yang diwarisi dan yang ditetapkan sebagai keputusan pelaksanaan

| Pokok | Sumber/jenis keputusan |
|---|---|
| 12 kelas, 5 level, 281 aktif/19 nonaktif | Struktur S1A/S1B, dihitung ulang |
| Empat operasi, numeric essay, bilingual, bank modular | S1/S2/S3 |
| Lima mode, analytics, reports dan future bridge | S1/S2, dijabarkan menjadi acceptance |
| 4.604 paket dan 177.640 slot | Ceiling S1B, dihitung ulang; bukan bank terisi |
| Empat contoh diperbaiki | Audit matematis/range/jumlah operasi, scope tidak berubah |
| 18 layar, Warm Engineering, token dan breakpoints | Pilihan desain yang ditetapkan untuk memenuhi preferensi pengguna |
| Budget gzip/chunk, bentuk pipeline, stack default | Target rekayasa proyek, bukan standar universal |
| Pembagian introduce/consolidate/transfer/review/assessment | Blueprint pelaksanaan untuk memanfaatkan ceiling sumber |
| Strict locale grammar dan draft_locale | Keputusan untuk mencegah tafsir angka ambigu |
| Local/demo/lms_client serta transport/grading terpisah | Keputusan kontrak untuk menjaga asal data dan integritas |
| Jarak 24 jam dapat dikonfigurasi, retest cycle max60hari | Kebijakan produk awal, bukan klaim validasi ilmiah; source awal memberi usulan interval |
| Level mastery vs target individual | Penajaman semantik agar subset tidak diklaim seluruh level |
| Bukti official mastery, otorisasi server | Pekerjaan LMS berikutnya, tidak dipalsukan oleh static mock |

Sumber tetap mengandung aturan editorial yang perlu menjadi predikat executable. Rencana semua template tidak disamakan dengan keberadaan kode generator. Standar pedagogis empiris, hasil uji siswa dan efektivitas intervensi belum dibuktikan oleh paket dokumen.

## 3. Otoritas dan mapping artefak

PRD 02 menentukan perilaku; dokumen 09 memberi definisi metrik terinci; factory 05 menentukan kelengkapan konten; schema mengatur field canonical; UX01 mengatur penyajian, input dan anggaran; QA06 menentukan evidence; deployment07 menentukan distribusi. Bila terjadi mismatch baru, satukan dan catat keputusan, lalu perbarui konsumen, contoh dan tes. Jangan mengubah dokumen sumber asli.

Path canonical laporan bank rilis adalah `evidence/bank/`, dengan filename `bank-coverage.json`, `bank-inventory.json`, `bank-uniqueness.json`, `bank-pool-feasibility.json`, `bank-validation.json`, `bank-deviations.json`, `bank-bilingual-review.json`, `template-review.json`, dan `build-provenance.json`. Ringkasan boleh menautkan nama tersebut; jangan membuat dua sumber angka yang berbeda. `RELEASE_STATUS.json` adalah sumber readiness mesin; Markdown dibuat dari data yang sama.

`planning/requirements.json` berisi 68 kebutuhan yang ditautkan ke test IDs. `qa/release_test_matrix.template.json` memuat TC-100–TC-189 dengan status NOT_RUN. Template itu menjadi hasil hanya setelah pembangun benar-benar mengujinya; hasil pemeriksaan dokumen saat ini tersimpan terpisah di `qa/HANDOFF_VERIFICATION.json`.

## 4. Referensi teknis primer

Seluruh tautan berikut diperiksa dalam penyusunan paket pada 25 November 2026. Angka budget internal dan pilihan produk diberi label keputusan proyek. Referensi bukan jaminan implementasi sudah memenuhi standar.

| Topik | Referensi primer |
|---|---|
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ |
| Kontras teks | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html |
| Kontras nonteks | https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html |
| Reflow | https://www.w3.org/WAI/WCAG22/Understanding/reflow.html |
| Timer dapat disesuaikan | https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html |
| Fokus tidak tertutup | https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html |
| Target sentuh minimum | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| Pola modal aksesibel | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ |
| Inputmode | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode |
| Reduced motion | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion |
| Core Web Vitals | https://web.dev/articles/vitals |
| Vite production build | https://vite.dev/guide/build |
| Vite aset statis/public | https://vite.dev/guide/assets |
| Storage quota dan eviction | https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria |
| Web Workers | https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers |
| Service Workers | https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers |
| Background Sync | https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API |
| BigInt dan JSON | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/BigInt_not_serializable |
| Structured clone | https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm |
| JSON Schema 2020-12 | https://json-schema.org/draft/2020-12/json-schema-validation |
| Static HTML Cloudflare | https://developers.cloudflare.com/pages/framework-guides/deploy-anything/ |
| Batas Cloudflare Pages | https://developers.cloudflare.com/pages/platform/limits/ |
| Headers Pages | https://developers.cloudflare.com/pages/configuration/headers/ |
| Redirects Pages | https://developers.cloudflare.com/pages/configuration/redirects/ |

Sumber W3C menjelaskan kriteria aksesibilitas; web.dev membedakan pengalaman lapangan dan pengukuran; dokumentasi runtime/platform menjelaskan perilaku fitur serta batas. Rancangan KALIBATAKU menerapkannya pada konteks latihan angka, namun kepatuhan baru dapat disimpulkan setelah situs final diperiksa. Versi tool dan batas hosting dapat berubah; pelaksana mengecek ulang sumber resmi saat mengunci build.

## 5. Hasil pemeriksaan paket dan batasnya

Pemeriksaan saat penyusunan meliputi seluruh contoh sumber serta versi dikoreksi, angka kapasitas, ID/referensi/rencana, schema dan contoh, nilai rasional/langkah contoh, fixture angka, token/kontras, referensi persyaratan, struktur berkas serta hash/integritas ZIP. Penambahan 90 kasus uji adalah penyusunan rencana verifikasi website, **bukan 90 website test yang sudah lulus**.

Belum dilakukan pada tugas ini: pembuatan website, produksi 4.604 paket, implementasi semua validator akademik, deployment, uji browser aplikasi, pengujian server nyata, review guru eksternal dan pilot siswa. Semua hal tersebut dicantumkan sebagai pekerjaan dan gate pada prompt sehingga hasil berikutnya dapat diperiksa secara konkret.
