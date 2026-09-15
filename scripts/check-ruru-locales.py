#!/usr/bin/env python3
"""Validate Ruru's English/Russian-only resource policy and translation parity."""
from collections import Counter
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / "shared/src/commonMain/composeResources"
LOCALES_CONFIG = REPO / "app/src/main/res/xml/locales_config.xml"
FORMAT = re.compile(r"%(?:\d+\$)?[-#+ 0,(<]*\d*(?:\.\d+)?(?:[tT][a-zA-Z]|[a-zA-Z%])")
LANGUAGE_DIR = re.compile(r"^values-([a-z]{2,3})(?:-r[A-Z]{2})?$")


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


def validate_locale_policy() -> None:
    language_dirs = {p.name for p in ROOT.iterdir() if p.is_dir() and LANGUAGE_DIR.match(p.name)}
    if language_dirs != {"values-ru"}:
        raise ValueError(f"Only Russian may exist beside default English resources; found {sorted(language_dirs)}")

    root = ET.parse(LOCALES_CONFIG).getroot()
    android_name = "{http://schemas.android.com/apk/res/android}name"
    declared = [node.get(android_name, "") for node in root.findall("locale")]
    if declared != ["en", "ru"]:
        raise ValueError(f"Android localeConfig must declare exactly en, ru; found {declared}")


def validate(root: Path = ROOT) -> int:
    validate_locale_policy()
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
    print(
        f"EN/RU resource validation PASS: {len(default)} English = {len(russian)} Russian; "
        "XML, unique keys, placeholders and locale policy valid."
    )
    return len(russian)


if __name__ == "__main__":
    try:
        validate()
    except (OSError, ET.ParseError, ValueError) as exc:
        print(f"::error::{exc}", file=sys.stderr)
        sys.exit(1)
