#!/usr/bin/env bash
# Jalankan dari Git Bash di Windows pada hasil ekstraksi ZIP yang masih tersegel.
set -euo pipefail
export PYTHONUTF8=1 PYTHONDONTWRITEBYTECODE=1
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
cd "$root"
case "$(uname -s)" in
    MINGW*|MSYS*) ;;
    *) echo 'Jalankan di Git Bash pada Windows asli.' >&2; exit 2 ;;
esac
if [[ "$root" != *' '* ]]; then
    echo 'Ekstrak ZIP ke direktori baru dengan spasi pada path untuk kasus EXT160-02.' >&2
    exit 2
fi
if command -v py >/dev/null && py -3.12 -c 'import jsonschema' >/dev/null 2>&1; then
    pycmd=(py -3.12)
elif command -v python >/dev/null && python -c 'import jsonschema' >/dev/null 2>&1; then
    pycmd=(python)
else
    echo 'Pasang Python 3.12 dan jsonschema, lalu jalankan kembali.' >&2
    exit 2
fi
"${pycmd[@]}" -c 'import platform, sys; assert platform.system() == "Windows" and sys.version_info >= (3, 11), "Perlu Python native Windows 3.11 atau lebih baru"'
command -v node >/dev/null || { echo 'Pasang Node 24 dan buka kembali Git Bash.' >&2; exit 2; }
out=$(mktemp -d "../native-windows-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXXXX")
out=$(cd "$out" && pwd -P)
# Gunakan path Windows eksplisit untuk Python native; sha256sum memakai path Git Bash.
out_win=$(cygpath -aw "$out")
{
    date -u '+mulai_utc=%Y-%m-%dT%H:%M:%SZ'
    printf 'git_bash=%s\n' "$BASH_VERSION"
    printf 'path_ekstraksi_memuat_spasi=ya\n'
    uname -srvmo
    git --version
    node --version
    "${pycmd[@]}" -c 'import platform, sys; print(platform.platform()); print(sys.version)'
} > "$out/runtime.txt"
set +e
"${pycmd[@]}" tools/native_receipt.py "$out_win" > "$out/runner.log" 2>&1
status=$?
set -e
{
    date -u '+selesai_utc=%Y-%m-%dT%H:%M:%SZ'
    printf 'kode_keluar=%s\n' "$status"
} >> "$out/runtime.txt"
(
    cd "$out"
    shopt -s nullglob
    files=(runtime.txt *.log)
    if [[ -f native.json ]]; then files+=(native.json); fi
    sha256sum "${files[@]}" > SHA256SUMS-NATIVE
)
printf 'Bukti untuk penelaah: %s\nKode keluar: %s\n' "$out" "$status"
exit "$status"
