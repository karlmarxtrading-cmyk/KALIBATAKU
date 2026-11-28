# Menyajikan KALIBATAKU 1.6.2 melalui GitHub dan Cloudflare Pages

Publikasikan **isi folder dist** dari arsip yang lolos verifikasi. Di GitHub, folder tersebut berada pada `dist/` relatif terhadap akar repositori situs. Cadangan, source, dokumentasi internal dan bukti QA disimpan di luar situs publik.

## Git Bash pada Windows

Pasang Git untuk Windows. Contoh berikut memakai direktori yang mengandung spasi. Sesuaikan dua path awal dengan lokasi ZIP yang diterima dan folder ekstraksi baru. Masukkan SHA-256 persis seperti yang tertera pada pesan pengiriman. Jalankan blok dalam shell Git Bash yang sama.

```bash
set -e
archive='/c/Unduhan Kelas/KALIBATAKU_1.6.2_PRODUCTION_READY.zip'
release_dir='/c/Pekerjaan Kelas/KALIBATAKU 1.6.2'
read -r -p 'SHA-256 ZIP dari pesan pengiriman: ' expected
printf '%s  %s\n' "$expected" "$archive" | sha256sum --check -
test ! -e "$release_dir"
mkdir -p "$release_dir"
unzip -q "$archive" -d "$release_dir"
cd "$release_dir"
sha256sum --check --quiet SHA256SUMS
test -f dist/index.html
```

Untuk pratinjau lokal, buka terminal lain di folder ekstraksi lalu jalankan `py -3.12 tools/preview.py` dan buka `http://127.0.0.1:4173/`. Untuk versi di subfolder, jalankan `py -3.12 tools/preview.py --prefix /sekolah/math/` dan buka URL sesuai awalan. Panduan pengujian bersih serta dependensi build tercantum di [QA 1.6.2](QA_1.6.2.md).

## Menyiapkan cabang GitHub

Gunakan repositori yang disetujui dan checkout baru. Contoh memakai remote dengan cabang dasar yang sudah ada. Bila repositori baru kosong, buat satu commit awal terlebih dahulu melalui fungsi inisialisasi repositori GitHub. Nilai `work_dir` menunjuk folder yang belum ada. Perintah pemindahan dan penambahan di bawah hanya memengaruhi checkout baru. Salinan `.gitattributes` menjaga byte bank dan aset saat checkout di Windows.

```bash
work_dir='/c/Pekerjaan Kelas/Repo Publik KALIBATAKU 1.6.2'
read -r -p 'URL GitHub repositori situs: ' repo_url
test ! -e "$work_dir"
git clone "$repo_url" "$work_dir"
cd "$work_dir"
git switch -c rilis/kalibataku-1.6.2
if test -e dist; then
  test ! -e "${work_dir}.dist-lama"
  mv dist "${work_dir}.dist-lama"
fi
cp -a "$release_dir/dist" ./dist
cp "$release_dir/.gitattributes" ./.gitattributes
git add -A -- .gitattributes dist
git diff --cached --stat
git diff --cached --name-status | head -30
git commit -m "Siapkan distribusi statis KALIBATAKU 1.6.2"
git rev-parse HEAD
```

Setelah meninjau daftar perubahan, operator yang berwenang mengirim cabang dengan `git push -u origin rilis/kalibataku-1.6.2`. Push ke cabang yang terhubung ke Pages dapat memicu deployment. Simpan ID commit dan identitas deployment. Jika repo situs memerlukan aturan Git lain, gabungkan aturan agar `dist/** -text` berlaku di akhir aturan terkait dan periksa jumlah file serta byte terhadap dist yang diverifikasi.

## Menghubungkan proyek Pages

Di **Workers & Pages → Create application → Pages → Connect to Git**, pilih GitHub dan repositori situs yang berwenang. Pilih production branch sesuai kebijakan pemilik, misalnya `main`, dan aktifkan preview pada cabang rilis. Hubungkan custom domain hanya jika pemilik meminta target tersebut. [Integrasi Git Pages](https://developers.cloudflare.com/pages/get-started/git-integration/)

| Pengaturan | Nilai untuk jalur prabuild |
| --- | --- |
| Framework preset | None |
| Root directory | Akar repositori yang menyimpan `dist/` |
| Build command | Kosong |
| Build output directory | `dist` |

Konfigurasi ini mengunggah file yang telah dibangun tanpa memasang toolchain QA atau meregenerasi bank. [Konfigurasi build Pages](https://developers.cloudflare.com/pages/configuration/build-configuration/)

## Memeriksa deployment sesungguhnya

Pada URL deployment preview, bandingkan ID commit, waktu serta ID penyedia dengan catatan operator. Dari folder bukti tersendiri, jalankan:

```bash
read -r -p 'URL HTTPS aktual yang diotorisasi, akhiri dengan /: ' base
curl --fail --silent --show-error -D build.headers -o served-build.json "${base}build-info.json"
curl --fail --silent --show-error -D offline.headers -o served-offline.json "${base}offline-assets.json"
cmp "$release_dir/dist/build-info.json" served-build.json
cmp "$release_dir/dist/offline-assets.json" served-offline.json
test "$(curl -sS -o missing.body -w '%{http_code}' "${base}kalibataku-halaman-tidak-ada.html")" = 404
```

Periksa juga `index.html`, MIME JavaScript, JSON, webmanifest, header CSP/nosniff, cache bank berversi dan revalidasi shell menurut `dist/_headers`. Pastikan service worker aktif pada scope URL yang dituju. Buka misi, isi jawaban dan periksa feedback/soal berikut. Simpan misi untuk offline, putuskan jaringan, muat ulang dan periksa kelanjutannya. Cocokkan byte aset dan ID offline dengan kandidat. Pada hosting yang memakai subpath, aturan cache untuk bank mengikuti awalan aktual. Simpan keluaran, URL, SHA-256 dist, ID commit/deployment dan waktu UTC. Lokal, preview penyedia dan produksi memiliki bukti masing-masing. Terapkan pemeriksaan yang sama pada hostname produksi setelah operator mempromosikan commit terverifikasi.

## Merekam verifikasi live lintasversi

Jalankan kolektor pada **salinan kerja untuk operasi** yang memiliki koneksi ke URL produksi sebenarnya dan dependensi QA. Simpan ZIP rilis asli beserta SHA-256 di tempat lain. Tetapkan target yang diotorisasi, pilih jendela pemeliharaan, dan mulai dari deployment 1.6.1 pada URL tersebut. Pada terminal pemeriksa:

```bash
read -r -p 'URL HTTPS produksi sebenarnya, akhiri dengan /: ' base
python3 tools/live_gate.py collect --url "$base" --wait-seconds 1200
python3 tools/live_gate.py verify
npm run qa:assess
```

Kolektor membaca situs tanpa kredensial publikasi. Operator pada sesi penyedia yang berwenang menerbitkan 1.6.2 saat kolektor meminta tahap pembaruan, melakukan rollback ke 1.6.1 pada tahap berikut, lalu memulihkan 1.6.2 pada tahap terakhir. Gunakan hostname, origin dan subpath yang sama sepanjang rangkaian. Hasil berada di `evidence/v162/deployment/live.json` pada salinan kerja. Nilai keputusan dari bukti terverifikasi dan simpan manifest/register operasi tersendiri. Jika URL atau salah satu tahap belum dapat diuji, pertahankan status aktualnya.

## Update dan rollback

1. Sebelum promosi, simpan ZIP lama, hash, ID commit/deployment lama dan cadangan profil sintetis. Catat ID/urutan soal, draf, jumlah attempt dan respons pertama.
2. Pada origin dan subpath yang sama, biarkan tab A memuat versi lama saat versi baru tersedia. Selesaikan satu tindakan di A, lalu buka tab B. Catat versi worker, refresh dan finalisasi di kedua tab. Tutup semua tab dan buka kembali. Cocokkan identitas rilis baru, hash, draf, riwayat, satu finalisasi per attempt dan operasi offline. Pertahankan data situs.
3. Bila identitas aset, pemulihan atau penilaian berbeda, hentikan promosi. Di Pages buka proyek → **Deployments** → menu deployment produksi terdahulu yang berhasil dan masih tersedia → **Rollback to this deployment**. Untuk preview, sajikan commit lama kembali melalui cabang preview. [Panduan rollback Pages](https://developers.cloudflare.com/pages/configuration/rollbacks/)
4. Sesudah rollback, verifikasi kembali byte, versi worker sesudah semua tab ditutup, draf, urutan serta riwayat pada origin yang sama. Catat waktu UTC dan ketiga ID deployment. Periksa cabang produksi sebelum push berikut agar build bermasalah tidak diterbitkan kembali.

Untuk memulihkan profil pada perangkat yang berbeda, ikuti [panduan cadangan, restore dan offline](PANDUAN_CADANGAN_OFFLINE.md). Git dan Pages menyimpan aplikasi. Cadangan profil browser menyimpan pekerjaan siswa.
