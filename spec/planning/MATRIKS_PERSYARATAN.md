# Matriks persyaratan dan keterlacakan

68 persyaratan wajib untuk implementasi website. Status paket ini adalah **ditetapkan**, bukan telah dibangun. Semua TC mengacu ke `06_ACCEPTANCE_QA_DAN_RILIS.md`.

| ID | Persyaratan | Acceptance ringkas | Kasus uji |
|---|---|---|---|
| REQ-001 | Cakupan empat operasi | ADD/SUB/MUL/DIV dan MIX saja; tidak ada materi luar cakupan | TC-100, TC-109 |
| REQ-002 | Essay numerik | Jawaban diketik; tanpa pilihan ganda dan tanpa wajib uraian | TC-120, TC-169 |
| REQ-003 | Kurikulum 60 level | 12 kelas ×5 level, metadata konsisten di seluruh katalog | TC-100 |
| REQ-004 | Cakupan bank 281 aktif | 281/281 mempunyai template dan paket nyata sesuai rencana kelayakan | TC-103, TC-115, TC-118 |
| REQ-005 | 19 slot nonaktif | Tidak dibuat paket palsu; UI memberi alasan kategori belum aktif | TC-100, TC-169 |
| REQ-006 | Kelas administratif terpisah | Material grade berbeda classroom/enrollment pada record dan report | TC-101, TC-153 |
| REQ-007 | Penempatan per kompetensi | Prasyarat DAG dan diagnostik dapat direproduksi tanpa hard-lock keliru | TC-102, TC-126 |
| REQ-008 | Bilingual menyeluruh | ID/EN lengkap termasuk error, hint, laporan dan accessibility label | TC-114, TC-121, TC-162 |
| REQ-009 | Terang gelap system | Token semantic, persist preference, print theme, seluruh states | TC-162, TC-165 |
| REQ-010 | Responsif lintas perangkat | Viewport dan orientasi UX lulus tanpa kontrol terpotong | TC-160, TC-161, TC-168 |
| REQ-011 | Aksesibilitas | Keyboard, pembaca layar, kontras, target sentuh dan timer accommodation | TC-163, TC-164, TC-165, TC-166 |
| REQ-012 | 18 layar dan states | Alur utama, kosong, loading, gagal, retry dan keputusan UI bekerja | TC-167, TC-169 |
| REQ-013 | Onboarding lokal | Mulai tanpa login; alias opsional; lanjut sesi kembali berfungsi | TC-134, TC-169 |
| REQ-014 | Katalog lazy | Root/shard/paket dimuat sesuai intent; filter tidak membuat eager bank | TC-170, TC-171, TC-172 |
| REQ-015 | Manifest konsisten | ID/path/hash/count setiap paket aktual resolve di dist | TC-101, TC-115 |
| REQ-016 | Setup sesi | Mode, panjang, timer, randomisasi dan form instance dipin | TC-113, TC-128 |
| REQ-017 | Player utuh | Input-submit-next-review-resume end-to-end tanpa dummy action | TC-122, TC-128, TC-169 |
| REQ-018 | Parser numeric locale | Grammar ketat, wrong separator format error, equivalence exact | TC-120, TC-121 |
| REQ-019 | Penilaian rasional | BigInt/rational exact; 0 division/NaN/float authority tidak ada | TC-104, TC-105, TC-107 |
| REQ-020 | Practice | Feedback/hint/retry nyata, kesempatan pertama tersimpan | TC-123 |
| REQ-021 | Speed | Deadline berjalan saat hidden; timeout dan kualitas durasi benar | TC-124, TC-150 |
| REQ-022 | Assessment | Revisi pra-feedback valid; final snapshot immutable dan idempotent | TC-125 |
| REQ-023 | Adaptive | Aturan berbasis evidence/policy, tidak random atau satu jawaban flapping | TC-126, TC-154 |
| REQ-024 | Mistake Recovery | Soal asal plus variasi setara; tidak menimpa histori | TC-127 |
| REQ-025 | Hint dan pembahasan | ID/EN bermakna; langkah matematis benar dan tag strategi tepat | TC-108, TC-114 |
| REQ-026 | Timer dan kualitas waktu | Aktif vs elapsed, reload anomaly dan no-speed-gate tercatat | TC-124, TC-150, TC-166 |
| REQ-027 | Autosave/resume atomik | Sesi, event, jawaban dan outbox relevan tidak terpisah saat gagal | TC-128, TC-129, TC-131 |
| REQ-028 | Riwayat dan progres | Per profil, per versi dan per kompetensi; tidak menghapus histori | TC-132, TC-134, TC-153 |
| REQ-029 | Mastery dan retest cycle | Dua form, unique evidence, denominator benar, cycle remediasi dan provisional | TC-148, TC-152 |
| REQ-030 | Metrik konsisten | Skor/akurasi/completion/pp/weighted aggregation sesuai fixture | TC-145, TC-146, TC-147, TC-149, TC-150, TC-151 |
| REQ-031 | Analisis kesalahan | Indikasi berbasis bukti, tanpa diagnosis atau klaim strategi aktual | TC-154 |
| REQ-032 | Randomisasi deterministik | Seed/order/fingerprint tetap setelah reload, locale atau tema | TC-110, TC-116, TC-128 |
| REQ-033 | Kenaikan level per cakupan | Seluruh active competencies level diperlukan; target personal berbeda | TC-148, TC-152 |
| REQ-034 | Factory seluruh bank | Generator deterministik finite dengan parameter dan provenance | TC-103, TC-116, TC-118 |
| REQ-035 | Validator aturan executable | Setiap rule family dan boundary punya predikat serta negative fixtures | TC-103, TC-106, TC-109 |
| REQ-036 | Pool dan repetisi | Slots vs unique/repeats/form overlap dihitung; deviasi berbukti | TC-110, TC-111, TC-112, TC-113, TC-118 |
| REQ-037 | ID dan versioning | Stable IDs, revisions, immutable manifests, migrasi histori | TC-101, TC-128, TC-177, TC-186 |
| REQ-038 | Bilingual konten | Semua butir punya title/instruction/hint/solution yang dibutuhkan ID/EN | TC-114 |
| REQ-039 | Solusi independen | Semua kunci dan langkah diverifikasi oracle berbeda dari generator | TC-107, TC-108 |
| REQ-040 | Offline terpilih | Set installed valid; cached only; update aman dan fallback foreground | TC-176, TC-177, TC-178, TC-179 |
| REQ-041 | IndexedDB lokal | Profil/attempt/ledger/source namespace dan transaksi benar | TC-129, TC-131, TC-132, TC-134 |
| REQ-042 | Backup dan restore | Round-trip schema/hash, preview konflik, aman dan atomik | TC-133, TC-184 |
| REQ-043 | Quota dan kehilangan storage | Mode sementara/ekspor jelas, tidak mengaku data tersimpan | TC-130, TC-167, TC-178 |
| REQ-044 | Monitoring guru simulasi | Data dihitung; drill-down dan jawaban siswa demo memperbarui dashboard | TC-117, TC-136, TC-153, TC-169 |
| REQ-045 | Panel admin simulasi | Cakupan katalog, filter, ekspor dan boundary role demo bekerja | TC-117, TC-153, TC-159, TC-169 |
| REQ-046 | Penugasan lokal mock | Target/form/deadline/policy bisa dikerjakan pada siswa demo dan dimonitor | TC-125, TC-136, TC-153 |
| REQ-047 | Parents meeting report | Struktur, evidence, rekomendasi, provenance dan preview lengkap | TC-153, TC-154, TC-155, TC-159 |
| REQ-048 | Enam ekspor asli | PDF/DOCX/XLSX/CSV/JSON/ZIP valid; batch/cancel/failure bekerja | TC-155, TC-156, TC-157, TC-158 |
| REQ-049 | Catatan dan override | Author/time/revision/reason; respons asli dan nilai hitung tidak dihapus | TC-153, TC-159 |
| REQ-050 | Academic event contract | Envelope tipe, sequence, content/competency/provenance/version valid | TC-101, TC-129, TC-144 |
| REQ-051 | Mock adapter | ACK mock jelas, simulasi latency/errors dapat direproduksi | TC-136, TC-138, TC-140 |
| REQ-052 | Remote adapter fail closed | Tanpa config/identity tidak kirim dan tidak fallback sukses | TC-135, TC-141 |
| REQ-053 | Sync idempotensi dan retry | Partial ACK, same ID hash, ordering, error status, pending aman | TC-137, TC-138, TC-139, TC-140, TC-142 |
| REQ-054 | Identitas dan verifikasi | Server menerima bukan otomatis grading; lintasakun terisolasi | TC-141, TC-143, TC-144 |
| REQ-055 | Keamanan statis | No secret/eval/untrusted import; XSS/CSV/CSP diuji; anti-inspect bukan kontrol | TC-119, TC-156, TC-183, TC-184 |
| REQ-056 | Minimasi data | Alias opsional, no tracking pihak ketiga default, demo terpisah | TC-117, TC-185 |
| REQ-057 | Performa dan lazy interaction | Budget gzip/network/interaksi/worker/memory dipenuhi dan dibuktikan | TC-170, TC-171, TC-172, TC-173, TC-174, TC-175 |
| REQ-058 | Dukungan browser teruji | Versi/metode real/emulasi, keyboard dan offline fallback dinyatakan | TC-160, TC-161, TC-163, TC-164, TC-179 |
| REQ-059 | QA seluruh lingkup | TC-100..189 punya status dan evidence, tidak PASS fiktif | TC-189 |
| REQ-060 | Build reproduktif | Clone bersih+lockfile+seed menghasilkan source/dist/bank konsisten | TC-116, TC-180 |
| REQ-061 | Deploy hosting statis | Root/subpath, deep link, MIME, headers, update dan rollback jelas | TC-181, TC-182, TC-183, TC-186 |
| REQ-062 | Dokumentasi operasi | README, build/deploy/backup/tambah bank/recovery lengkap | TC-188 |
| REQ-063 | Evidence dan hashes | Seluruh laporan cocok build final; checksum dan ZIP CRC valid | TC-188, TC-189 |
| REQ-064 | Status rilis jujur | Static, bank, bridge, LMS, pilot dan live deployment terpisah | TC-189 |
| REQ-065 | Privasi perangkat bersama | Profil bukan akun aman; hapus terarah; tidak ada data anak di artefak | TC-134, TC-185 |
| REQ-066 | LMS masa depan | Kontrak API/otorisasi/grade trust terdefinisi; server nyata deferred by scope | TC-135, TC-143, TC-144, TC-189 |
| REQ-067 | Skala bank tanpa rombak | Tambahkan paket lewat factory/manifest, initial tetap ringan | TC-115, TC-170, TC-171, TC-175 |
| REQ-068 | Lisensi dan dependensi | Provenance aset/font, lockfile/advisory dan lisensi tercatat | TC-187 |
