# Penyimpanan lokal dan kontrak LMS

Aplikasi menyimpan data latihan pada origin situs dan profil browser yang sedang dipakai. Daftar profil merupakan pemisah riwayat pada perangkat bersama. Institusi yang memerlukan akses terbatas per pengguna harus menyediakan autentikasi dan otorisasi pada server.

## Profil, pemulihan, dan cache

- Pada **Profil dan data**, buat nama panggilan, pilih profil aktif, lalu gunakan **Unduh cadangan JSON**. Cadangan memuat profil, snapshot sesi dan ledger latihan pribadi. Data simulasi dan outbox LMS berada pada namespace terpisah.
- Untuk memulihkan, pilih berkas JSON, lihat ringkasan jumlah baru/identik/konflik, lalu tekan **Gabungkan cadangan**. Batasnya 50 MiB dan 100.000 rekaman. ID bentrok dengan isi berbeda menghentikan seluruh transaksi. File dari origin lain bisa dipindah manual melalui alur ini. Semua hasil impor tetap berstatus latihan pribadi, belum terverifikasi.
- Import memeriksa format dan versi, checksum SHA-256, identitas, schema pertanyaan/event, jawaban eksak, fingerprint, langkah solusi, urutan, instance, catatan respons dan total skor. Checksum mendeteksi kerusakan. Verifikasi institusi membutuhkan sumber soal dan identitas di server.
- **Hapus data profil** meminta konfirmasi dan menghapus riwayat profil terpilih. **Hapus salinan** di halaman offline hanya membuang cache paket. Snapshot soal yang terikat pada sesi memungkinkan review/sambungan walaupun salinan paket telah dihapus.
- Penyimpanan IndexedDB versi 2 menambah indeks sehingga ledger bisa dibaca per attempt, serta membuat store tambahan tanpa menghapus data lama. Tab dengan koneksi versi lama menutup koneksinya saat diminta browser. Jika tab lama menahan upgrade, tutup tab tersebut, lalu muat ulang.
- Satu tab memegang lease tulis 15 detik, diperbarui saat aktif. Tab kedua dapat meminta pengalihan secara eksplisit. Revision check mencegah penulis lama menimpa snapshot lebih baru. Reload tab mendaur ulang identitas penulis apabila Web Lock dokumen lama telah dilepas. Browser dapat menghapus penyimpanan saat ruang penuh, data situs dibersihkan, atau sesi privat berakhir.
- Jika IndexedDB tidak tersedia, aplikasi menggunakan memori tab dan menandai hasil sebagai sementara. Unduh cadangan sebelum menutupnya. Jika ruang habis ketika menyimpan ke IndexedDB yang telah dipakai, perubahan belum tersimpan. Hapus salinan paket atau bebaskan ruang, lalu ulangi operasi.
- Pengguna memilih paket di katalog. Pengunduhan mencakup indeks, metadata kelas/level, ESM paket, antarmuka, modul player, bahasa, font dan ikon. Siap offline ditampilkan setelah byte yang dipin lolos pemeriksaan dan seluruh aset dapat dibaca. Cache pakai namespace base path dan versi rilis; katalog pada jaringan dibaca ulang. Pembaruan menunggu semua tab aplikasi lama ditutup. Data hasil dan antrean pengiriman disimpan di luar cache aset.
- Jika aset sudah tersimpan, personal practice dapat dimulai dari daftar **Paket offline**. Mode yang memilih paket lain, misalnya pemulihan kesalahan, membutuhkan paket terkait jika sedang tanpa jaringan. Pengguna dapat melanjutkan attempt dari Riwayat dengan snapshot yang sudah terikat.

## Adapter dan integrasi institusi

Implementasi antarmuka tersedia dalam `src/data/bridge.js`. Kontrak HTTP 3.1.0 terdapat di `openapi.json`. Contoh event dan ACK aktual sebagai fixture terdapat di `spec/examples/`. Semua adapter menyediakan capabilities, identity, list assignments, start, event batch, complete, progress dan report. Seluruh event memiliki metadata konten, environment, asal data dan urutan. Bentuk API dan policy dijelaskan lebih lanjut di `spec/schemas/BRIDGE_API_CONTRACT.md`.

| Sumber | Namespace | Pengiriman |
| --- | --- | --- |
| Profil pribadi | local_practice / device / profileId | Commit lokal, tanpa outbox server |
| Simulasi | demo / demo / profileId | Outbox dan receipt dengan receipt_origin=mock dan grading_state=unverified |
| Sesi LMS | lms_client / environment / authenticated subject | Adapter HTTPS same-origin tersedia bagi integrator. Rilis statis tersaji dengan koneksi dinonaktifkan |

Ketika menambahkan server, institusi menyediakan API base HTTPS same-origin, environment, subject yang berasal dari sesi server dan CSRF token berumur pendek melalui injeksi sesi yang terautentikasi. Daftarkan adapter memakai nilai dari runtime, lewat `new RemoteApiAdapter(scope, config)`, lalu panggil `syncPending(scope,{adapter})`. Cookie HttpOnly dan CSRF diterapkan di server. Batalkan request yang berjalan dan hentikan penjadwalan pada saat sesi berubah. Adapter mencocokkan identity terhadap scope sebelum mengirim batch. Semua batas tenant, akses student/class/report, eligibility assignment dan penilaian final tetap ditetapkan di server. `testOrigin` hanya dipakai oleh runner Node yang tidak memiliki location.

Client menyimpan snapshot+event+outbox dalam satu transaksi, kemudian mengirim satu attempt per batch. Limit dasar 100 event/256 KiB dapat diperkecil melalui capabilities. Receipt diperiksa berdasarkan asal, batch, attempt, event dan hash. Status academic tetap terpisah dari status transport. Server harus menilai ulang berdasarkan registry terpercaya sebelum menerbitkan nilai resmi. Simulator menyimpan binding dan inbox untuk replay dan rekonsiliasi. Saat remote tidak dikonfigurasi, panggilan mengembalikan BRIDGE_NOT_CONFIGURED sebelum membuat permintaan.

| Keadaan pengiriman | Tindakan |
| --- | --- |
| Offline, timeout, 5xx | Retry dengan ID/hash identik setelah backoff |
| 429 | Hormati Retry-After dan backoff |
| 401 | Tahan sampai sesi yang sama kembali terautentikasi |
| 403, 400, 422, versi tidak didukung | Pertahankan event asli dan tampilkan penyebab penolakan |
| 409, ID sama dengan payload berbeda, sequence bertabrakan | Tahan untuk rekonsiliasi eksplisit |
| ACK parsial | Hanya event yang cocok berubah status |
| ACK rusak atau salah batch/attempt/hash | Pertahankan antrean untuk pemulihan |
| Complete mendahului jawaban | Tunda finalisasi dan minta urutan yang hilang |

Foreground sync pada simulasi berjalan setelah commit, saat aplikasi kembali terlihat, saat konektivitas berubah, dan dari halaman Status sinkronisasi. Dataset demo/riwayat personal tidak pernah dikirim ke backend institusi. Dukungan jaringan, backup, role, audit dan ACL bagi server produksi memerlukan pengujian pada instalasi institusi tersendiri.

## Menjalankan ulang pemeriksaan

Dari root paket jalankan `node tests/data/contract.mjs` untuk kontrak, atomic rollback dalam fallback, backup, exact hash, status transport dan simulasi HTTP. Jalankan `python3 tests/data/openapi.py` untuk membangkitkan dan memeriksa deskripsi OpenAPI (FastAPI, Pydantic dan jsonschema pada lingkungan QA). Skrip tersebut tidak diperlukan di hosting. Pengujian browser yang memakai IndexedDB, dua konteks browsing, upgrade, pemulihan dan Service Worker terdapat di `tests/integration/` dan `tests/data/`.

## Ekstensi bukti jawaban 1.2

Field tambahan opsional pada AnswerPayload menyimpan `first_correct`, `hint_before`, `key_seen_before`, `key_revealed_at`, `key_reveal_reason` dan `feedback_policy_version`. AttemptContext baru membawa identitas kebijakan penayangan dan waktu. Lihat schema di `../contracts/core-1.2.schema.json` dan `openapi.json`. Event lama mempertahankan hash aslinya. Penilaian institusi tetap memerlukan perhitungan dan ACL di server. Bukti per mode, termasuk dua ID event berbeda untuk 99 lalu 21/12, tersedia di `evidence/v12/reports/feedback-ledger.json`.
