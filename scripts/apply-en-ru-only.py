#!/usr/bin/env python3
"""Apply the reviewed English/Russian-only localization migration."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def load(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def save(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def remove_resource_keys(path: str, keys: list[str]) -> None:
    text = load(path)
    for key in keys:
        pattern = re.compile(r'^\s*<string\s+name="' + re.escape(key) + r'"[^>]*>.*?</string>\s*\n', re.M)
        text, count = pattern.subn('', text)
        if count != 1:
            raise SystemExit(f"{path}: expected one resource {key}, found {count}")
    save(path, text)


# 1) Supported languages: only English and Russian.
path = "shared/src/commonMain/kotlin/com/zhousl/aether/data/AppSettings.kt"
text = load(path)
text = replace_once(text, '''    SimplifiedChinese(\n        storageValue = "zh-CN",\n        languageTag = "zh-CN",\n    ),\n    Persian(\n        storageValue = "fa",\n        languageTag = "fa",\n    ),\n''', '', "remove legacy language enum entries")
text = replace_once(text, '''fun appLanguageForTag(languageTag: String): AppLanguage = when {\n    languageTag.startsWith("zh", ignoreCase = true) -> AppLanguage.SimplifiedChinese\n    languageTag.startsWith("fa", ignoreCase = true) -> AppLanguage.Persian\n    languageTag.startsWith("ru", ignoreCase = true) -> AppLanguage.Russian\n    else -> AppLanguage.English\n}\n''', '''fun appLanguageForTag(languageTag: String): AppLanguage = when {\n    languageTag.startsWith("ru", ignoreCase = true) -> AppLanguage.Russian\n    else -> AppLanguage.English\n}\n''', "limit language tag mapping")
save(path, text)

path = "shared/src/androidMain/kotlin/com/zhousl/aether/data/PlatformDefaults.android.kt"
text = load(path)
text = replace_once(text, '''fun defaultAppLanguage(locale: Locale): AppLanguage = when {\n    locale.language.equals("zh", ignoreCase = true) -> AppLanguage.SimplifiedChinese\n    locale.language.equals("fa", ignoreCase = true) -> AppLanguage.Persian\n    locale.language.equals("ru", ignoreCase = true) -> AppLanguage.Russian\n    else -> AppLanguage.English\n}\n''', '''fun defaultAppLanguage(locale: Locale): AppLanguage = when {\n    locale.language.equals("ru", ignoreCase = true) -> AppLanguage.Russian\n    else -> AppLanguage.English\n}\n''', "limit Android locale mapping")
save(path, text)

path = "app/src/main/java/com/zhousl/aether/ui/SettingsScreen.kt"
text = load(path)
text = text.replace('    AppLanguage.SimplifiedChinese -> stringResource(R.string.language_simplified_chinese)\n', '')
text = text.replace('    AppLanguage.Persian -> stringResource(R.string.language_persian)\n', '')
text = text.replace('    AppLanguage.SimplifiedChinese -> stringResource(R.string.settings_language_simplified_chinese_interface)\n', '')
text = text.replace('    AppLanguage.Persian -> stringResource(R.string.settings_language_persian_interface)\n', '')
if "AppLanguage.SimplifiedChinese" in text or "AppLanguage.Persian" in text:
    raise SystemExit("SettingsScreen still references removed languages")
save(path, text)

path = "app/src/main/res/xml/locales_config.xml"
text = load(path)
text = replace_once(text, '    <locale android:name="zh-CN" />\n', '', "remove Android Chinese locale")
text = replace_once(text, '    <locale android:name="fa" />\n', '', "remove Android Persian locale")
save(path, text)

# 2) Persian-only typography/RTL code and font assets are no longer needed.
path = "app/src/main/java/com/zhousl/aether/ui/theme/Theme.kt"
text = load(path)
for line in (
    'import androidx.compose.ui.text.font.Font\n',
    'import androidx.compose.ui.unit.LayoutDirection\n',
    'import androidx.compose.ui.platform.LocalLayoutDirection\n',
    'import com.zhousl.aether.R\n',
):
    text = text.replace(line, '')
text = re.sub(
    r'\nval VazirmatnFontFamily = FontFamily\(.*?\n\)\n',
    '\n',
    text,
    count=1,
    flags=re.S,
)
text = replace_once(text, '''    val currentFontFamily = if (language == AppLanguage.Persian) {\n        VazirmatnFontFamily\n    } else {\n        FontFamily.SansSerif\n    }\n    val layoutDirection = if (language == AppLanguage.Persian) {\n        LayoutDirection.Rtl\n    } else {\n        LayoutDirection.Ltr\n    }\n''', '''    val currentFontFamily = FontFamily.SansSerif\n''', "remove Persian Android typography branch")
text = text.replace('        LocalLayoutDirection provides layoutDirection,\n', '')
save(path, text)

path = "shared/src/iosMain/kotlin/com/zhousl/aether/ui/SharedTheme.kt"
text = load(path)
text = replace_once(text, '''    val layoutDirection = if (language == AppLanguage.Persian) {\n        LayoutDirection.Rtl\n    } else {\n        LayoutDirection.Ltr\n    }\n''', '''    val layoutDirection = LayoutDirection.Ltr\n''', "remove Persian shared RTL branch")
save(path, text)

# 3) Remove dead language labels from both surviving catalogs.
removed_keys = [
    "language_simplified_chinese",
    "language_persian",
    "settings_language_simplified_chinese_interface",
    "settings_language_persian_interface",
]
for locale in ("values", "values-ru"):
    remove_resource_keys(f"shared/src/commonMain/composeResources/{locale}/strings.xml", removed_keys)

# 4) Existing tests now exercise Russian, and explicitly cover migration from old stored locale values.
for base in (
    ROOT / "app/src/androidTest",
    ROOT / "app/src/test",
    ROOT / "shared/src/commonTest",
    ROOT / "shared/src/iosTest",
):
    if not base.exists():
        continue
    for file in base.rglob("*.kt"):
        content = file.read_text(encoding="utf-8")
        updated = content.replace("AppLanguage.SimplifiedChinese", "AppLanguage.Russian")
        updated = updated.replace("AppLanguage.Persian", "AppLanguage.Russian")
        if updated != content:
            file.write_text(updated, encoding="utf-8")

path = "shared/src/commonTest/kotlin/com/zhousl/aether/data/AppSettingsSerializationTest.kt"
text = load(path)
marker = '''    @Test\n    fun unknownFieldsRemainForwardCompatible() {\n'''
new_test = '''    @Test\n    fun removedLocalesFallBackToSupportedEnglish() {\n        assertEquals(AppLanguage.English, AppLanguage.fromStorage("zh-CN", AppLanguage.English))\n        assertEquals(AppLanguage.English, AppLanguage.fromStorage("fa", AppLanguage.English))\n        assertEquals(AppLanguage.English, appLanguageForTag("zh-CN"))\n        assertEquals(AppLanguage.English, appLanguageForTag("fa-IR"))\n        assertEquals(AppLanguage.Russian, appLanguageForTag("ru-RU"))\n    }\n\n'''
text = replace_once(text, marker, new_test + marker, "insert removed-locale migration test")
save(path, text)

# 5) Localize only the presentation snapshot. Model-facing tool schemas/prompts stay English.
path = "pi-bridge/src/aether-extensions.ts"
text = load(path)
import_marker = '''import {\n  ensureExtensionPackageDependencies,\n  packageRootForExtensionPath,\n} from "./extension-dependencies.js";\n'''
text = replace_once(text, import_marker, import_marker + 'import { localizeAetherUiSnapshot } from "./aether-ui-i18n.js";\n', "import extension UI localizer")
old_return = '''  return {\n    api_version: AETHER_API_VERSION,\n    version: runtimeVersion,\n    extensions: runtime.extensions.map((extension) => ({\n      id: extension.id,\n      name: extension.name,\n      path: extension.path,\n    })),\n    surfaces,\n    components,\n    settings,\n    composer_menu_items: composerMenuItems,\n    message_types: messageTypes,\n    tool_titles: toolTitles,\n    custom_messages: customMessages,\n    event_names: [...runtime.events.keys()].sort(),\n    errors: runtime.errors,\n  };\n'''
new_return = '''  return localizeAetherUiSnapshot({\n    api_version: AETHER_API_VERSION,\n    version: runtimeVersion,\n    extensions: runtime.extensions.map((extension) => ({\n      id: extension.id,\n      name: extension.name,\n      path: extension.path,\n    })),\n    surfaces,\n    components,\n    settings,\n    composer_menu_items: composerMenuItems,\n    message_types: messageTypes,\n    tool_titles: toolTitles,\n    custom_messages: customMessages,\n    event_names: [...runtime.events.keys()].sort(),\n    errors: runtime.errors,\n  }, hostContext);\n'''
text = replace_once(text, old_return, new_return, "localize extension snapshot")
save(path, text)

# 6) Extend the real bundled-extension test to prove English stays English and Russian UI is localized.
path = "pi-bridge/tests/bundled-runtime.test.mjs"
text = load(path)
needle = '''    assert.ok(ui.snapshot.settings.length >= 3);\n'''
addition = '''    assert.ok(ui.snapshot.settings.length >= 3);\n    const ruSnapshot = JSON.stringify(ui.snapshot);\n    assert.match(ruSnapshot, /Веб-доступ/);\n    assert.match(ruSnapshot, /MCP-серверы/);\n    assert.match(ruSnapshot, /Субагенты/);\n    assert.doesNotMatch(ruSnapshot, /\"Web Access\"/);\n    assert.doesNotMatch(ruSnapshot, /\"MCP Servers\"/);\n    const enUi = await request("reload_aether_extensions", { context: { platform: "android", language: "en" } });\n    const enSnapshot = JSON.stringify(enUi.snapshot);\n    assert.match(enSnapshot, /Web Access/);\n    assert.match(enSnapshot, /MCP Servers/);\n    assert.match(enSnapshot, /Subagents/);\n'''
text = replace_once(text, needle, addition, "add EN/RU bundled UI regression assertions")
save(path, text)

# 7) Reject stale production references before the branch can be merged.
production_roots = [ROOT / "app/src/main", ROOT / "shared/src/commonMain", ROOT / "shared/src/androidMain", ROOT / "shared/src/iosMain"]
stale = []
for base in production_roots:
    if not base.exists():
        continue
    for file in base.rglob("*"):
        if not file.is_file() or file.suffix not in {".kt", ".xml", ".kts"}:
            continue
        content = file.read_text(encoding="utf-8", errors="ignore")
        if "AppLanguage.SimplifiedChinese" in content or "AppLanguage.Persian" in content:
            stale.append(str(file.relative_to(ROOT)))
if stale:
    raise SystemExit("stale removed-language references: " + ", ".join(stale))

print("EN/RU-only source migration applied successfully")
