#!/usr/bin/env python3
"""Catch un-installable bundle provenance before publishing an Android APK.

Baseline digests intentionally describe the previous release, not the newly
patched source. This check verifies packaging and path coverage, not equality
between old and new source contents.
"""
from pathlib import PurePosixPath
import re
import sys
import zipfile


def check_apk(filename: str) -> None:
    with zipfile.ZipFile(filename) as apk:
        names = set(apk.namelist())
        prefix = "assets/ruru-extension-baselines/"
        manifests = sorted(name for name in names if name.startswith(prefix) and name.endswith(".properties"))
        if len(manifests) != 3:
            raise ValueError(f"Expected 3 bundled migration baselines, found {len(manifests)}")
        for manifest in manifests:
            package = PurePosixPath(manifest).stem
            root = f"assets/extensions/{package}/"
            entries = {}
            for raw in apk.read(manifest).decode("utf-8").splitlines():
                line = raw.strip()
                if not line or line.startswith(("#", "!")):
                    continue
                key, separator, digest = line.partition("=")
                if not separator or not re.fullmatch(r"[0-9a-f]{64}", digest):
                    raise ValueError(f"Invalid baseline digest in {manifest}: {key}")
                if key in entries or key.startswith("/") or "\\" in key or any(part in ("", ".", "..") for part in key.split("/")):
                    raise ValueError(f"Invalid/duplicate baseline path: {key}")
                entries[key] = digest
            if "package.json" not in entries:
                raise ValueError(f"Missing package identity in {manifest}")
            missing = [key for key in entries if root + key not in names]
            if missing:
                raise ValueError(f"{package}: baseline references unpackaged files: {missing}")
            print(f"{package}: {len(entries)} legacy paths present in APK; PASS")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: check-ruru-bundle-assets.py APK [APK ...]")
    for filename in sys.argv[1:]:
        check_apk(filename)
