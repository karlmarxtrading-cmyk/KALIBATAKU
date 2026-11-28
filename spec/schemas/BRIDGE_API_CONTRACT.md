# Kontrak API untuk implementasi LMS berikutnya

Status: **kontrak rancangan, tidak ada endpoint produksi yang disediakan dalam paket ini**. Pada pembangunan website statis, pelaksana wajib membuat adapter dan contract tests terhadap mock service yang mengikuti kontrak ini. OpenAPI 3.1 lengkap dihasilkan pada pekerjaan implementasi, dari kontrak/schema yang sudah diselaraskan, dan harus lolos validator OpenAPI serta tes request/response.

## 1. Batas layanan

Konfigurasi publik: apiBaseUrl, environment_id, accepted_schema_versions dan feature flags. Rahasia sesi tidak ditanam di static bundle. Layanan auth/identity dimiliki LMS; local/demo tidak membuat password atau token semu. Preferensi arsitektur future same-origin HTTPS dengan session cookie HttpOnly serta proteksi CSRF untuk mutasi; jika cross-origin digunakan, kebijakan credentials/CORS/CSRF ditetapkan dan diuji, bukan `Access-Control-Allow-Origin:*` untuk sesi bercredential.

Server menentukan tenant, subject dan peran dari sesi. `student_id`, `server_subject_ref`, classroom dan organization yang dikirim klien hanya referensi klaim yang harus dicocokkan. Mentor hanya melihat siswa yang diotorisasi; admin terbatas institusinya; orang tua kelak terbatas anaknya. Mock role switch bukan bukti authorization.

## 2. Endpoint dan idempotensi

| Method dan path | Input | Respons berhasil | Kegagalan penting |
|---|---|---|---|
| GET `/api/v1/capabilities` | Schema/environment yang didukung klien | Versi schema, flags, server time, batch limits, auth requirements | Unsupported version, unavailable |
| GET `/api/v1/me` | Sesi yang sah | subject, institution scope, roles, classroom memberships, locale/timezone preference | 401/403 |
| GET `/api/v1/assignments` | cursor, filters yang diizinkan | items, next_cursor, assignment policy/content version | 401/403, invalid filters |
| POST `/api/v1/attempts` | client attempt_id, assignment/package refs, origin dan policy; idempotency key | Server binding attempt, content/form yang sah, policy, offline rules | 409 ID conflict, assignment closed, disallowed content |
| POST `/api/v1/events/batch` | batch_id, Event[] sesuai schema dan session scope | BatchReceipt dengan ACK per event dan missing_sequences | 400/422, 401/403, 409, 429, 5xx |
| POST `/api/v1/attempts/complete` | attempt_id, final_event_id, expected_event_count, content/policy version | grading_state queued/verified atau requires_missing_events | Missing sequence, deadline, version, conflict |
| GET `/api/v1/students` | Scope/filters/cursor | Daftar siswa minimal yang diizinkan | 403 lintas institusi/kelas |
| GET `/api/v1/students/{id}/progress` | Periode, module, competency/mode | Progress snapshot + policy/evidence metadata | Unauthorized subject, no evidence |
| GET `/api/v1/students/{id}/analytics` | Filters dan comparable-form policy | Analysis snapshot, N, provenance, quality flags | Unsupported dimensions |
| GET `/api/v1/classes/{id}/analytics` | Periode/module/mode | Agregat dengan weighting dan eligibility jelas | Scope mismatch |
| POST `/api/v1/reports` | Scope siswa/kelas, periode, language, format, snapshot policy | report_job_id, status, accepted scope | 403, data unavailable, quota |
| GET `/api/v1/reports/{id}` | ID job | status/progress/file count/failures | 403/404 |
| GET `/api/v1/reports/{id}/download` | ID job + sesi sah | Berkas atau URL berumur terbatas yang terotorisasi | Not ready, expired, denied |

`POST /attempts` dapat dipanggil ulang dengan attempt_id yang sama dan payload identik; binding yang sama dikembalikan. Start event juga dapat ada di batch sebagai ledger, tetapi bukan creation kedua. Klien offline menggunakan ID lokal yang stabil dan baru menghubungkan ke server melalui start/bind yang sah; server boleh menolak penugasan offline berdasarkan policy. Penolakan tersebut tidak menghapus catatan lokal.

`attempt.completed` adalah event ledger; endpoint complete adalah permintaan grading/finalization setelah seluruh event diterima. Keduanya idempotent dan merujuk snapshot yang sama, bukan dua kali nilai. ACK diterima tanpa data lengkap mengembalikan missing_sequences, tidak final verified. Server menilai ulang dari konten tepercaya dan snapshot final; client_is_correct tidak menjadi otoritas.

## 3. Batas batch dan ordering

Default rancangan maksimum 100 event atau 256 KiB uncompressed per batch, mana yang lebih dahulu; angka final dinegosiasikan capabilities dan diukur. Ukuran tersebut adalah kebijakan proyek awal, bukan batas platform universal. Setiap batch wajib memuat tepat satu attempt_id; seluruh Event di dalamnya harus cocok dengan attempt_id receipt. Klien memecah batch dengan urutan per attempt; antarattempt memakai batch terpisah dengan concurrency terbatas. Event yang terlanjur masuk dan request timeout dikirim ulang dengan ID/hash yang sama.

Server menyimpan uniqueness pada scope environment+institution+subject+event_id atau kunci yang memberi isolasi setara. ID sama/hash berbeda menghasilkan conflict. Sequence sama/event berbeda pada attempt yang sama diperiksa sebagai konflik; jangan menerima dua nilai untuk posisi yang sama tanpa aturan revisi. Clock klien bukan urutan otoritatif; sequence, version dan timestamps server disimpan.

## 4. Error envelope

Gunakan struktur `error={code,message_key,details,retryable,request_id}`. `message_key` diterjemahkan klien, details tidak membocorkan data tenant lain. 401 menghentikan pengiriman sampai sesi pulih; 403 ditolak oleh scope; 409 perlu rekonsiliasi; 422 payload salah tidak diretry tanpa perubahan versi/record baru yang sah; 429 menghormati Retry-After; 5xx/network retry exponential backoff+jitter. Payload event immutable tidak diedit lalu dikirim dengan event_id lama.

Error klien `BRIDGE_NOT_CONFIGURED` terjadi sebelum jaringan. Local mode tidak membuat retry loop ke URL kosong. Mock faults dikendalikan seed/skenario test dan tidak memerlukan internet. UI membedakan tersimpan lokal, antre, mengirim, perlu login, konflik, ditolak, diterima mock dan diterima server; grading/verification merupakan status kedua.

## 5. Identitas, migrasi dan trust

Saat akun berganti, hentikan pengiriman outbox milik subject/environment lama; record menunggu tetap di namespace asal. Migrasi hasil local_practice ke akun hanya dilakukan melalui import yang diakui sebagai rekam latihan belum terverifikasi. Dataset demo tidak dimigrasikan sebagai catatan sekolah. Nomor kelas dapat berubah tetapi ID siswa dan enrollment history tetap.

Bank frontend dapat tetap modular; server harus mempunyai sumber pembanding tepercaya (snapshot/metadata jawaban atau generator terversi). Public answer key membuat nilai benar tidak membuktikan tidak adanya bantuan. Form resmi sensitif tidak boleh memakai janji keamanan yang hanya bersumber dari client-side script.

## 6. Contract tests wajib

Uji happy path attempt→jawaban→complete→progress/report; partial ACK; ACK salah attempt/hash; duplicate identik; collision hash/payload; gap sequence; complete mendahului jawaban; replay setelah timeout commit; schema lama/baru; session expired; subject berbeda; cross-tenant request; offline deadline; versi konten hilang; respons malformed; server unavailable; batch cancel; proses tab/app restart. Setiap hasil mock diberi provenance demo/unverified. Tes real-server authorization baru boleh dinyatakan lulus setelah benar-benar dilakukan pada layanan yang dituju.
