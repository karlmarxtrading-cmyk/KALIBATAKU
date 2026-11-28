# Kontrak data pelaksanaan

`core.schema.json` memakai JSON Schema Draft 2020-12. Ini kontrak struktur yang disertakan untuk mengurangi tebakan pembangun; validator matematika, kurikulum, otorisasi, fingerprint dan rumus laporan tetap harus diimplementasikan. JSON Schema mendeskripsikan assertions struktur; ia tidak membuktikan relasi aritmetika lintas field. [C01]

Root schema menyediakan `$defs`; pilih definisi yang relevan melalui `$ref`, misalnya `#/$defs/Package`, `#/$defs/Event`, `#/$defs/BatchReceipt` atau `#/$defs/ReportSnapshot`. Jangan memvalidasi instance hanya terhadap root yang berisi definisi tanpa memilih tipe. Verifier handoff menyediakan contoh pemilihan tipe dan pemeriksaan semantik tambahan; ini bukan mesin aplikasi produksi.

## 1. Konvensi canonical

| Field/nama | Nilai dan makna |
|---|---|
| `data_origin` | `local_practice`, `demo`, `lms_client` |
| Adapter | LocalAdapter, MockAdapter, RemoteApiAdapter; nama adapter bukan nilai `data_origin` |
| `demo` | Dataset sintetis/aksi siswa demo; ACK mock tidak mengubah asalnya |
| `local_practice` | Aktivitas pengguna pada perangkat, belum diautentikasi institusi |
| `lms_client` | Aktivitas terhubung sesi LMS; hasil masih bisa unverified atau ditolak |
| `verification_status` | `unverified` atau `server_verified` pada report snapshot; hanya server tepercaya memberi yang kedua |
| `grading_state` | `unverified`, `queued`, `verified`, `rejected` pada receipt; berbeda dari penerimaan transport |
| `transport_result` | accepted, duplicate, rejected, retry_required, conflict per event ACK |
| `SyncState` | saved_local, pending_sync, sending, mock_accepted, server_accepted, retry_required, auth_required, rejected, conflict |
| Mode | practice, speed, assessment, adaptive, recovery; label UI bilingual terpisah |
| Tujuan paket | introduce, consolidate, transfer, review, assessment, diagnostic |

Istilah `mock` pada sumber lama dimigrasikan menjadi `demo` untuk origin; `remote` di dokumen konseptual berarti adapter/transport, bukan bukti server_verified. Catat mapping versi saat migrasi, jangan mempercayai label origin dari import untuk menerbitkan nilai resmi.

## 2. Nilai dan representasi

Rational menyimpan numerator/denominator integer string canonical, gcd=1, denominator>0, zero=0/1. Schema memeriksa bentuk string; semantic validator memeriksa reduksi dan batas. Node rational boleh mempunyai display integer, decimal dengan decimal_places, atau fraction dengan numerator/denominator literal. Nilai display harus tepat sama dengan nilai canonical. Metadata display boleh tidak ada pada langkah solusi yang dapat dirender dengan default, tetapi seluruh butir produksi wajib mendefinisikan bentuk operand yang sesuai tujuan kurikulum.

AST hanya rational leaf dan binary ADD/SUB/MUL/DIV. Batas produksi per expression ditetapkan sebelum traversal: default maksimum 31 node dan kedalaman 12 (lebih longgar daripada 6 operasi MIX terpanjang agar solusi ekuivalen masih muat); constraints kompetensi tetap lebih ketat. Periksa division by zero, domain kelas, batas intermediate, bentuk MIX dan representation. Jangan menerima constructor/function/symbol/user-defined operator atau object prototype yang mengubah perilaku.

Grammar input desain: trim spasi luar; normalisasi Unicode minus; integer `[+-]?[0-9]+`; desimal `[+-]?[0-9]+<separator>[0-9]+`; pecahan `[+-]?[0-9]+ / [0-9]+` dengan spasi sekitar slash opsional dan denominator>0. Batas input 80 karakter sebelum parsing. Digit ASCII; no grouping/scientific/formula. Leading zero dan plus diterima lalu canonicalized; decimal harus punya digit sebelum/sesudah separator, misalnya `0,5`, bukan `,5` atau `1,`. Validator harus membedakan incomplete draft dari jawaban final. Kode error fixture adalah keputusan produk, bisa diperluas tetapi perilakunya tidak boleh berubah diam-diam.

## 3. Fingerprint dan hash

Fingerprint kanonik `canonical-ast-v1`: leaf `R:<numerator>/<denominator>` dalam bentuk tereduksi; binary `OP(left,right)`; untuk ADD/MUL urutkan encoding kedua anak secara leksikografis sebelum encoding parent, sedangkan SUB/DIV pertahankan urutan. Tidak flatten associativity. Hilangkan metadata display/locale dari fingerprint evidence. SHA-256 atas UTF-8 encoding itu menjadi fingerprint. Contoh `MUL(R:24/1,R:4/1)` untuk contoh kontrak. Representation variant mempunyai ID/revision sendiri bila diperlukan tetapi tidak menambah unique evidence dari nilai/struktur yang sama.

Hash file adalah SHA-256 byte file yang benar-benar disajikan. Hash event dihitung dari envelope lengkap **tanpa field `payload_hash`**, dengan canonical JSON: key objek diurutkan rekursif leksikografis, array mempertahankan urutan, tanpa whitespace antartoken, UTF-8, karakter Unicode tidak dipaksa ASCII escape, angka envelope hanya safe integer, nilai rasional string, negatif nol dinormalisasi. Jangan membandingkan JSON.stringify default yang mempertahankan urutan insertion dengan keluaran canonical lain. Implementasi harus menyediakan cross-language fixture; contoh event dalam paket ini mengikuti kebijakan tersebut. Jika beralih ke standar canonicalization lain, bump versi hash dan uji migrasi.

## 4. Event dan finalisasi

`event_sequence` mulai dari 1 dan meningkat dalam attempt. `attempt.started` berisi snapshot instance order. `answer.submitted` berarti nilai numerik valid disimpan; `submission_kind=revision` sebelum feedback assessment berbeda dari retry sesudah hint. `client_is_correct` dapat null agar UI assessment tidak perlu menerima feedback. Null bukan salah.

`attempt.completed` berisi final_responses untuk seluruh instance dan expected_event_count. Status final answered menunjuk event respons sah; skipped menunjuk event skip jika ada; blank/unseen tidak menunjuk jawaban valid lama. Pemeriksaan semantik memastikan semua instance muncul tepat sekali, event referenced berada pada attempt yang sama, total count/sequence cocok dan tidak ada dirty-invalid draft yang belum diselesaikan. Assessment cycle dikaitkan ke context; finalisasi tidak menghapus revisi historis.

Receipt harus cocok attempt/event/hash dan berasal dari environment yang dimaksud. HTTP 200 atau status jaringan online bukan ACK. Duplicate sah hanya untuk payload identik; conflict memerlukan pemulihan. Mock receipt tidak boleh mempunyai grading_state selain unverified. Server receipt yang menyatakan verified masih harus berasal dari sesi/endpoint tepercaya; schema tidak mengautentikasi asal respons.

## 5. Keterbatasan kontrak contoh

`ReportSnapshot` adalah irisan minimal untuk menguji rumus serta provenance, bukan seluruh struktur laporan visual. Implementasi menambah identitas yang terotorisasi, per-competency rows, notes, distributions dan metadata dengan versi schema yang jelas. `Package` contoh hanya satu butir untuk demonstrasi format; tidak memenuhi kriteria bank penuh. `core.schema.json` tidak mengandung 281 validator constraints dan bukan generator.

Semua contoh harus divalidasi struktural dan semantik. Negative fixtures meliputi denominator0, locale key hilang, operation di luar whitelist, mock verified, hash salah, count mismatch, duplikasi instance dan respons dari attempt berbeda. Event client yang mengklaim student_id terverifikasi tetap harus ditolak/ditautkan ulang oleh layanan identitas yang sah.

## 6. Status rilis

`release-status.schema.json` mengatur template dan laporan rilis final dengan enam bidang readiness di dalam objek `readiness`. Setiap bidang memuat `status`, `evidence`, `blockers` dan `claim_boundary`. Daftar status mengikuti dokumen acceptance. Template yang disertakan belum merupakan hasil pengujian aplikasi; pembangun mengubah `artifact_status` menjadi `release_verdict` dan mengisi `release_id` build yang sebenarnya.

Schema menolak status PASS tanpa referensi evidence, PASS dengan blocker yang belum selesai, dan verdict final tanpa identitas rilis. Referensi evidence berupa path relatif berkas bukti di ZIP rilis atau URL lingkungan yang diperiksa. Bukti tersebut tetap harus dibuka dan diverifikasi; keberadaan nama berkas di JSON tidak membuktikan pengujian dilakukan. Status kesiapan tidak boleh disimpulkan dari keberhasilan verifier paket arahan.

## Referensi

[C01] JSON Schema, Validation Draft 2020-12: https://json-schema.org/draft/2020-12/json-schema-validation — diperiksa 25 November 2026. Pemilihan tipe serta seluruh constraints domain di atas merupakan keputusan desain KALIBATAKU.
