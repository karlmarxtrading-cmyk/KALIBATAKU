"""Check a sealed KALIBATAKU ZIP itself without extracting or importing its code."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath, PureWindowsPath
import re
import struct
import zlib
from zipfile import ZIP_DEFLATED, ZipFile


# tools/release_pack.py writes ordinary, seekable UTF-8/ASCII ZIPs: regular Deflate
# files with all sizes in their local headers, no descriptors or multi-disk sections.
LOCAL = struct.Struct("<4s5H3I2H")
END = struct.Struct("<4s4H2IH")
INDEX = {"FILE_INVENTORY.json", "SHA256SUMS"}
SHA = re.compile(r"[0-9a-f]{64}")
SOURCE_DIRS = (".github/workflows/", "src/", "factory/", "tools/", "docs/contracts/", "spec/", "tests/")
SOURCE_ROOTS = {
    "package.json", "package-lock.json", "requirements-qa.txt", ".python-version", ".nvmrc", ".gitattributes"
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check_name(name):
    path = PurePosixPath(name)
    require(bool(name) and path.as_posix() == name and not path.is_absolute(), f"Invalid path: {name!r}")
    require(not PureWindowsPath(name).drive and ".." not in path.parts, f"Non-relative path: {name!r}")
    require(not any(c in name for c in ("\\", "\x00", "\r", "\n")), f"Unexpected path character: {name!r}")
    require(not any(part.endswith((" ", ".")) for part in path.parts), f"Non-portable path: {name!r}")


def read_local_header(raw, info):
    name = info.filename
    raw.seek(info.header_offset)
    header = LOCAL.unpack(raw.read(LOCAL.size))
    signature, version, flags, method, dos_time, dos_date, crc, size_compressed, size, name_len, extra_len = header
    require(signature == b"PK\x03\x04", f"Local header not found: {name}")
    require(flags == info.flag_bits and flags in (0, 0x800), f"Unexpected flags: {name}")
    require(version == info.extract_version and method == info.compress_type == ZIP_DEFLATED, f"Method/version: {name}")
    require((crc, size_compressed, size) == (info.CRC, info.compress_size, info.file_size), f"CRC/size header: {name}")
    decoded = raw.read(name_len).decode("utf-8" if flags & 0x800 else "cp437")
    require(decoded == name == info.orig_filename, f"Local/central name mismatch: {name}")
    year, month, day, hour, minute, second = info.date_time
    require(dos_time == (hour << 11 | minute << 5 | second // 2), f"Local time: {name}")
    require(dos_date == ((year - 1980) << 9 | month << 5 | day), f"Local date: {name}")
    require(raw.read(extra_len) == info.extra == b"", f"Unexpected ZIP extension: {name}")
    require(info.create_system == 3 and (info.external_attr >> 16) == 0o100644, f"Unexpected mode: {name}")
    return raw.tell() + size_compressed


def hash_members(archive, raw):
    hashes = {}
    sizes = {}
    aliases = set()
    cursor = 0
    for member in sorted(archive.infolist(), key=lambda record: record.header_offset):
        name = member.filename
        check_name(name)
        require(name.casefold() not in aliases and not member.is_dir(), f"Duplicate/directory: {name}")
        require(member.header_offset == cursor, f"Overlapping or unindexed local records before {name}")
        cursor = read_local_header(raw, member)
        aliases.add(name.casefold())
        digest = hashlib.sha256()
        length = 0
        crc = 0
        with archive.open(member) as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
                crc = zlib.crc32(chunk, crc)
                length += len(chunk)
        require(crc == member.CRC and length == member.file_size, f"Decoded CRC/length: {name}")
        hashes[name] = digest.hexdigest()
        sizes[name] = length
    require(cursor == archive.start_dir, "Local payload boundary differs from central directory offset")
    raw.seek(-END.size, 2)
    offset = raw.tell()
    marker, disk, start_disk, count_disk, count, central_bytes, central, comment = END.unpack(raw.read())
    require(marker == b"PK\x05\x06" and disk == start_disk == comment == 0, "Invalid end-of-central-directory record")
    require(count_disk == count == len(hashes) and central == cursor and central + central_bytes == offset, "Central offsets/counts")
    for name in hashes:
        require(not any(parent.as_posix().casefold() in aliases for parent in PurePosixPath(name).parents),
                f"File/directory prefix collision: {name}")
    return hashes, sizes


def verify_indexes(archive, hashes, sizes):
    inventory = json.loads(archive.read("FILE_INVENTORY.json"))["files"]
    entries = {}
    for row in inventory:
        name = row["path"]
        require(name not in entries and type(row["bytes"]) is int, f"Invalid inventory row: {name}")
        entries[name] = (row["bytes"], row["sha256"])
    require(set(entries) == set(hashes) - INDEX, "Incomplete/extra FILE_INVENTORY.json paths")
    for name, pair in entries.items():
        require(pair == (sizes[name], hashes[name]), f"Inventory size/digest mismatch: {name}")
    sums = {}
    for line in archive.read("SHA256SUMS").decode("utf-8").splitlines():
        value, name = line.split("  ", 1)
        require(SHA.fullmatch(value) and name not in sums, f"Invalid/duplicate SHA256SUMS entry: {name}")
        sums[name] = value
    require(set(sums) == set(hashes) - {"SHA256SUMS"}, "Incomplete/extra SHA256SUMS paths")
    for name, digest in sums.items():
        require(hashes[name] == digest, f"SHA256SUMS mismatch: {name}")
    return len(entries), len(sums)


def tree_hash(mapping):
    digest = hashlib.sha256()
    for name in sorted(mapping, key=lambda path: tuple(path.split("/"))):
        digest.update(f"{mapping[name]}  {name}\n".encode("utf-8"))
    return digest.hexdigest()


def verify_build(archive, hashes):
    status = json.loads(archive.read("RELEASE_STATUS.json"))
    version = json.loads(archive.read("dist/build-info.json"))
    dist = {name.removeprefix("dist/"): sha for name, sha in hashes.items() if name.startswith("dist/")}
    bank = {name.removeprefix("bank/"): sha for name, sha in dist.items() if name.startswith("bank/")}
    source = {name: sha for name, sha in hashes.items() if name.startswith(SOURCE_DIRS) or name in SOURCE_ROOTS}
    release = json.loads(archive.read("dist/offline-assets.json"))["release"]
    ident = {
        "app_version": version["app_version"], "bank_version": version["bank_version"],
        "offline_release": release, "dist_tree_sha256": tree_hash(dist), "source_tree_sha256": tree_hash(source),
    }
    binding_name = status["qa_binding"]
    binding = json.loads(archive.read(binding_name))
    for key, value in ident.items():
        require(status[key] == binding["build"][key] == value, f"Release/binding identity differs for {key}")
    pin = json.loads(archive.read("factory/bank-lock.json"))
    require(tree_hash(bank) == pin["bank"] and len(bank) == pin["file_count"], "Bank pin mismatch")
    require(binding["registry_sha256"] == hashes["tests/qa/suites.json"], "QA registry hash mismatch")
    base = str(PurePosixPath(binding_name).parent) + "/"
    receipts = 0
    for suite in binding["suites"]:
        require(hashes[base + suite["log"]] == suite["log_sha256"], f"QA log digest: {suite['id']}")
        for receipt in suite["receipts"]:
            require(hashes[base + receipt["file"]] == receipt["sha256"], f"QA receipt digest: {suite['id']}")
            receipts += 1
    return {
        **ident, "release_label": status["release_label"], "dist_files": len(dist), "source_files": len(source),
        "bank_files": len(bank), "bank_tree_sha256": pin["bank"], "qa_logs": len(binding["suites"]),
        "qa_receipt_hashes": receipts, "qa_binding_sha256": hashes[binding_name],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--json", type=Path, help="Optional report outside the input ZIP")
    for name in ("version", "source-sha", "dist-sha", "sha256"):
        parser.add_argument("--" + name, help="Optionally pin this value using an independently supplied identifier")
    args = parser.parse_args()
    if args.json:
        require(args.json.resolve() != args.archive.resolve(), "Report must differ from input archive")
    with args.archive.open("rb") as raw, ZipFile(args.archive) as archive:
        archive_sha = hashlib.file_digest(raw, "sha256").hexdigest()
        if args.sha256:
            require(archive_sha == args.sha256, "Unexpected SHA-256 of the full ZIP")
        hashes, sizes = hash_members(archive, raw)
        rows, sums = verify_indexes(archive, hashes, sizes)
        build = verify_build(archive, hashes)
    for name, actual in (
        (args.version, build["app_version"]),
        (args.source_sha, build["source_tree_sha256"]),
        (args.dist_sha, build["dist_tree_sha256"]),
    ):
        require(name is None or name == actual, f"Unexpected build identity: {actual}")
    result = {
        "status": "PASS", "checked_utc": datetime.now(timezone.utc).isoformat(),
        "zip_filename": args.archive.name, "zip_sha256": archive_sha, "zip_bytes": args.archive.stat().st_size,
        "uncompressed_bytes": sum(sizes.values()), "local_central_crc_sha_verified": len(hashes),
        "inventory_rows": rows, "sha256sums_rows": sums, "sha256sums_sha256": hashes["SHA256SUMS"],
        "file_inventory_sha256": hashes["FILE_INVENTORY.json"], "build": build,
    }
    text = json.dumps(result, indent=2) + "\n"
    if args.json:
        args.json.write_text(text, encoding="utf-8", newline="\n")
    print(text, end="")


if __name__ == "__main__":
    main()
