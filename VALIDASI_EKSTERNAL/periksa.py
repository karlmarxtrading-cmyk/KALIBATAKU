"""Verify the unopened external validation kit from the candidate root."""
import hashlib
import json
import re
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent
ROOT = KIT.parent
sys.path.insert(0, str(ROOT / "tools"))
from qa_core import identity


def main():
    manifest = json.loads((KIT / "BUILD.json").read_bytes())
    actual = identity(ROOT)
    if manifest["build"] != actual:
        raise SystemExit("Identitas build berbeda dari identitas kit.")
    for name, expected in manifest["files"].items():
        p = KIT / name
        with p.open("rb") as f:
            if hashlib.file_digest(f, "sha256").hexdigest() != expected:
                raise SystemExit(f"Digest tidak cocok: {name}")
    for doc in KIT.rglob("*.md"):
        for link in re.findall(r"\]\(([^)]+)\)", doc.read_text("utf-8")):
            if not (doc.parent / link).is_file():
                raise SystemExit(f"Rujukan hilang: {doc.name} → {link}")
    print(f"OK · {actual['app_version']} · {actual['offline_release']} · {len(manifest['files'])} berkas kit dan semua rujukan Markdown cocok.")


if __name__ == "__main__":
    main()
