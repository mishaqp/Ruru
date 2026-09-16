#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "ruru-i18n-audit.txt"


def replace_exact(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:120]!r}")
    path.write_text(text.replace(old, new), encoding="utf-8")


# 1) Centralize notification localization at the bridge boundary. This affects
# presentation notifications only; tool schemas, prompts, ids and persisted
# extension values never pass through this helper.
bridge = ROOT / "pi-bridge/src/aether-extensions.ts"
replace_exact(
    bridge,
    'import { localizeAetherUiSnapshot } from "./aether-ui-i18n.js";',
    'import { localizeAetherUiSnapshot, localizeAetherUiText } from "./aether-ui-i18n.js";',
)
replace_exact(
    bridge,
    '''    host: {\n      invoke(method, args = {}) {\n        return transport.requestHost(method, cloneJson(args));\n      },\n    },''',
    '''    host: {\n      invoke(method, args = {}) {\n        const requestArgs = cloneJson(args);\n        if (method === "app.notify" && typeof requestArgs.message === "string") {\n          requestArgs.message = localizeAetherUiText(requestArgs.message, latestHostContext);\n        }\n        return transport.requestHost(method, requestArgs);\n      },\n    },''',
)
replace_exact(
    bridge,
    '''    notify(message, level = "info") {\n      transport.notify(message, level);\n    },''',
    '''    notify(message, level = "info") {\n      transport.notify(localizeAetherUiText(message, latestHostContext), level);\n    },''',
)

# 2) Complete the presentation-only extension translator with notification and
# compound-status handling. These patterns preserve names, paths, ids and URLs.
i18n = ROOT / "pi-bridge/src/aether-ui-i18n.ts"
text = i18n.read_text(encoding="utf-8")
notification_marker = '  // MCP descriptions.\n'
notification_entries = '''  // Dynamic extension notifications routed through pi-bridge.\n  "Subagent stopped.": "Субагент остановлен.",\n  "Subagent is no longer running.": "Субагент больше не выполняется.",\n  "That agent is not running.": "Этот агент сейчас не выполняется.",\n  "Reloaded subagent definitions.": "Определения субагентов перезагружены.",\n  "Subagent definition prompt added to the composer.": "Запрос на создание субагента добавлен в поле ввода.",\n  "Subagent setting updated.": "Настройка субагента обновлена.",\n  "Subagent setting updated. Some changes apply on the next Pi session.": "Настройка субагента обновлена. Некоторые изменения применятся в следующей сессии Pi.",\n  "The Pi MCP extension is not loaded yet.": "Расширение Pi MCP ещё не загружено.",\n  "MCP extension reloading.": "Расширение MCP перезагружается.",\n  "Authorization URL ready. Open it, approve access, then paste the callback URL back here.": "URL авторизации готов. Откройте его, разрешите доступ и вставьте callback URL сюда.",\n  "Paste the full callback URL or authorization code first.": "Сначала вставьте полный callback URL или код авторизации.",\n\n'''
if notification_entries not in text:
    if notification_marker not in text:
        raise SystemExit("MCP description marker missing in aether-ui-i18n.ts")
    text = text.replace(notification_marker, notification_entries + notification_marker, 1)

compound_marker = '''  match = value.match(/^Called (.+)$/);\n  if (match) return `Вызов ${match[1]} завершён`;\n\n  return undefined;\n}'''
compound_replacement = '''  match = value.match(/^Called (.+)$/);\n  if (match) return `Вызов ${match[1]} завершён`;\n\n  match = value.match(/^Message sent to (.+)\\.$/);\n  if (match) return `Сообщение отправлено ${match[1]}.`;\n  match = value.match(/^MCP server "(.+)" (enabled|disabled)\\.$/);\n  if (match) return `MCP-сервер "${match[1]}" ${match[2] === "enabled" ? "включён" : "отключён"}.`;\n  match = value.match(/^MCP server "(.+)" added\\. Tap Reload MCP extension to connect\\.$/);\n  if (match) return `MCP-сервер "${match[1]}" добавлен. Нажмите перезагрузку расширения MCP для подключения.`;\n  match = value.match(/^MCP server "(.+)" removed\\. Tap Reload MCP extension to apply\\.$/);\n  if (match) return `MCP-сервер "${match[1]}" удалён. Нажмите перезагрузку расширения MCP, чтобы применить изменение.`;\n  match = value.match(/^MCP server "(.+)" renamed to "(.+)"\\. Tap Reload MCP extension to apply\\.$/);\n  if (match) return `MCP-сервер "${match[1]}" переименован в "${match[2]}". Нажмите перезагрузку расширения MCP, чтобы применить изменение.`;\n  match = value.match(/^Inspection failed: (.+)$/);\n  if (match) return `Проверка не удалась: ${match[1]}`;\n  match = value.match(/^Web Access settings could not read the Pi config: (.+)$/);\n  if (match) return `Не удалось прочитать конфигурацию Pi для веб-доступа: ${match[1]}`;\n\n  // Compound status/stat rows are presentation text assembled by bundled\n  // extensions. Translate only recognized segments and preserve everything else.\n  if (value.includes(" · ")) {\n    const parts = value.split(" · ");\n    const translatedParts = parts.map((part) =>\n      RU_EXTRA_TEXT[part] ?? RU_TEXT[part] ?? translateDynamicText(part) ?? part\n    );\n    if (translatedParts.some((part, index) => part !== parts[index])) {\n      return translatedParts.join(" · ");\n    }\n  }\n\n  return undefined;\n}'''
if compound_replacement not in text:
    if compound_marker not in text:
        raise SystemExit("Dynamic translation marker missing in aether-ui-i18n.ts")
    text = text.replace(compound_marker, compound_replacement, 1)
i18n.write_text(text, encoding="utf-8")

# 3) Agent Mode is a Ruru feature label, not a protocol/service identifier.
# Translate it consistently only in Russian resources; English remains unchanged.
ru_strings = ROOT / "shared/src/commonMain/composeResources/values-ru/strings.xml"
ru_text = ru_strings.read_text(encoding="utf-8")
ru_text = ru_text.replace("Agent Mode", "Режим агента")
ru_strings.write_text(ru_text, encoding="utf-8")

# 4) Audit remaining likely user-facing English without modifying technical data.
lines: list[str] = []
lines.append("=== Ruru i18n branch sweep audit ===")
lines.append("")

# Russian resources with Latin text but no Cyrillic. Many are intentionally
# technical; the report lets us review the finite remainder explicitly.
lines.append("[RU resources: Latin-only candidates]")
for xml_path in sorted((ROOT / "shared/src/commonMain/composeResources/values-ru").glob("*.xml")):
    root = ET.parse(xml_path).getroot()
    for node in root:
        if node.tag != "string" or node.get("translatable") == "false":
            continue
        value = "".join(node.itertext()).strip()
        if not value or not re.search(r"[A-Za-z]", value) or re.search(r"[А-Яа-яЁё]", value):
            continue
        lines.append(f"{xml_path.relative_to(ROOT)} :: {node.get('name')} = {value}")
lines.append("")

# Kotlin/Compose candidates: only well-known UI sinks, not arbitrary strings.
lines.append("[Kotlin/Compose hardcoded UI candidates]")
ui_patterns = [
    re.compile(r'\\bText\\s*\\(\\s*"([^"\\n]*[A-Za-z][^"\\n]*)"'),
    re.compile(r'contentDescription\\s*=\\s*"([^"\\n]*[A-Za-z][^"\\n]*)"'),
    re.compile(r'placeholder\\s*=\\s*"([^"\\n]*[A-Za-z][^"\\n]*)"'),
    re.compile(r'\\b(?:title|label|subtitle)\\s*=\\s*"([^"\\n]*[A-Za-z][^"\\n]*)"'),
    re.compile(r'\\b(?:showSnackbar|Toast\\.makeText)\\s*\\([^\\n]*"([^"\\n]*[A-Za-z][^"\\n]*)"'),
]
for base in [ROOT / "app/src", ROOT / "shared/src"]:
    if not base.exists():
        continue
    for kt in sorted(base.rglob("*.kt")):
        rel = kt.relative_to(ROOT)
        for number, source_line in enumerate(kt.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            stripped = source_line.strip()
            if stripped.startswith("//") or "@Preview" in stripped:
                continue
            for pattern in ui_patterns:
                match = pattern.search(source_line)
                if match:
                    lines.append(f"{rel}:{number}: {match.group(1)}")
                    break
lines.append("")

# Bundled extension presentation literals. Restrict to Aether UI/definition
# syntax; tool schema/source implementation strings are intentionally excluded.
lines.append("[Bundled extension presentation candidates]")
extension_files = [
    ROOT / "extensions/pi-mcp-adapter/aether.ts",
    ROOT / "extensions/pi-subagents/src/aether.ts",
    ROOT / "extensions/pi-web-access/aether.ts",
]
presentation = re.compile(
    r'(?:\\b(?:title|subtitle|label|description|placeholder|buttonLabel)\\s*:\\s*|'
    r'\\.ui\\.(?:text|button)\\(\\s*)"([^"\\n]*[A-Za-z][^"\\n]*)"'
)
for source in extension_files:
    for number, source_line in enumerate(source.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
        match = presentation.search(source_line)
        if match:
            lines.append(f"{source.relative_to(ROOT)}:{number}: {match.group(1)}")

REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(REPORT.read_text(encoding="utf-8"))
