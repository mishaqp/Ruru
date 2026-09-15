#!/usr/bin/env python3
"""Validate the complete default/Russian Compose resource catalog without dependencies."""
from collections import Counter
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1] / "shared/src/commonMain/composeResources"
FORMAT = re.compile(r"%(?:\d+\$)?[-#+ 0,(<]*\d*(?:\.\d+)?(?:[tT][a-zA-Z]|[a-zA-Z%])")


def catalog(directory: Path) -> dict:
    result = {}
    files = sorted(directory.glob("*.xml"))
    if not files:
        raise ValueError(f"No resource XML files in {directory}")
    for file in files:
        root = ET.parse(file).getroot()
        if root.tag != "resources":
            raise ValueError(f"Invalid resource root: {file}")
        for item in root:
            name = item.get("name")
            if not name:
                continue
            key = (item.tag, name)
            if key in result:
                raise ValueError(f"Duplicate resource {key} in {file}")
            result[key] = (item, file.name)
    return result


def formats(item) -> Counter:
    if item.get("formatted") == "false":
        return Counter()
    return Counter(FORMAT.findall("".join(item.itertext())))


def validate(root: Path = ROOT) -> int:
    default, russian = catalog(root / "values"), catalog(root / "values-ru")
    required = {key for key, (item, _) in default.items() if item.get("translatable") != "false"}
    errors = []
    missing, extra = required - russian.keys(), russian.keys() - default.keys()
    if missing:
        errors.append(f"Missing Russian keys: {sorted(missing)}")
    if extra:
        errors.append(f"Unknown Russian keys: {sorted(extra)}")
    for key in default.keys() & russian.keys():
        en, _ = default[key]
        ru, _ = russian[key]
        if formats(en) != formats(ru):
            errors.append(f"Placeholder mismatch {key}: {formats(en)} != {formats(ru)}")
        if "".join(en.itertext()).strip() and not "".join(ru.itertext()).strip():
            errors.append(f"Empty Russian resource: {key}")
        if en.get("formatted", "true") != ru.get("formatted", "true"):
            errors.append(f"formatted attribute mismatch: {key}")
    if errors:
        raise ValueError("\n".join(errors))
    print(f"RU resource validation PASS: {len(default)} default = {len(russian)} Russian; XML, unique keys and placeholders valid.")
    return len(russian)


if __name__ == "__main__":
    try:
        validate()
    except (OSError, ET.ParseError, ValueError) as exc:
        print(f"::error::{exc}", file=sys.stderr)
        sys.exit(1)
