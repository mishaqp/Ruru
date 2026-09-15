#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path): return (ROOT / path).read_text(encoding='utf-8')
def write(path, text): (ROOT / path).write_text(text, encoding='utf-8')
def once(text, old, new, label):
    n = text.count(old)
    if n != 1: raise SystemExit(f'{label}: expected 1 match, found {n}')
    return text.replace(old, new, 1)

# --- Core Android runtime strings that are visible during normal chat use. ---
p='app/src/main/java/com/zhousl/aether/ui/AetherViewModel.kt'
s=read(p)
s=once(s, '                        title = "New chat",\n', '                        title = if (current.settings.language == AppLanguage.Russian) "Новый чат" else "New chat",\n', 'new chat title')
write(p,s)

p='app/src/main/java/com/zhousl/aether/data/SessionExecutionManager.kt'
s=read(p)
s=once(s, 'class SessionExecutionManager(\n', 'class SessionExecutionManager(\n', 'manager marker')
marker='''    private val _showcaseStates = MutableStateFlow<Map<String, ShowcaseReplayState>>(emptyMap())\n    val showcaseStates = _showcaseStates.asStateFlow()\n'''
helper='''    private val _showcaseStates = MutableStateFlow<Map<String, ShowcaseReplayState>>(emptyMap())\n    val showcaseStates = _showcaseStates.asStateFlow()\n\n    private fun localizedUiText(english: String, russian: String): String =\n        if (currentSettings.value.language == AppLanguage.Russian) russian else english\n\n    private fun reasoningSummarySystemPrompt(): String =\n        ReasoningSummarySystemPrompt + if (currentSettings.value.language == AppLanguage.Russian) {\n            " Write the user-visible title and detail in Russian."\n        } else {\n            " Write the user-visible title and detail in English."\n        }\n'''
s=once(s, marker, helper, 'runtime localization helper')
s=once(s, '                    title = "Reasoning",\n', '                    title = localizedUiText("Reasoning", "Рассуждение"),\n', 'reasoning title')
s=once(s, '            systemPrompt = ReasoningSummarySystemPrompt,\n', '            systemPrompt = reasoningSummarySystemPrompt(),\n', 'reasoning summary prompt language')
s=once(s, '            title = "Thinking through the next step",\n', '            title = localizedUiText("Thinking through the next step", "Продумываю следующий шаг"),\n', 'reasoning fallback title')
s=once(s, '                .ifBlank { "Preparing the next action." },\n', '                .ifBlank { localizedUiText("Preparing the next action.", "Готовлю следующее действие.") },\n', 'reasoning fallback detail')
write(p,s)

# --- Common Compose showcase controls: use normal resource system. ---
p='shared/src/commonMain/kotlin/com/zhousl/aether/ui/ShowcaseControls.kt'
s=read(p)
imports='''import com.zhousl.aether.ui.theme.AetherSurface\n'''
newimports='''import com.zhousl.aether.ui.theme.AetherSurface\nimport com.zhousl.aether.shared.resources.Res\nimport com.zhousl.aether.shared.resources.showcase_pause\nimport com.zhousl.aether.shared.resources.showcase_replay_controls\nimport com.zhousl.aether.shared.resources.showcase_replay_from_beginning\nimport com.zhousl.aether.shared.resources.showcase_resume\nimport com.zhousl.aether.shared.resources.showcase_show_completed_session\nimport org.jetbrains.compose.resources.stringResource\n'''
s=once(s, imports, newimports, 'showcase imports')
s=once(s, '            contentDescription = "Replay controls",\n', '            contentDescription = stringResource(Res.string.showcase_replay_controls),\n', 'showcase content description')
s=once(s, '                text = { Text("Replay from beginning") },\n', '                text = { Text(stringResource(Res.string.showcase_replay_from_beginning)) },\n', 'showcase replay')
s=once(s, '                text = { Text(if (controls.paused) "Resume" else "Pause") },\n', '                text = { Text(stringResource(if (controls.paused) Res.string.showcase_resume else Res.string.showcase_pause)) },\n', 'showcase pause/resume')
s=once(s, '                text = { Text("Show completed session") },\n', '                text = { Text(stringResource(Res.string.showcase_show_completed_session)) },\n', 'showcase restore')
write(p,s)

# Insert matching EN/RU resources before </resources>.
entries={
 'values': [
  ('showcase_replay_controls','Replay controls'),
  ('showcase_replay_from_beginning','Replay from beginning'),
  ('showcase_resume','Resume'),
  ('showcase_pause','Pause'),
  ('showcase_show_completed_session','Show completed session'),
 ],
 'values-ru': [
  ('showcase_replay_controls','Управление воспроизведением'),
  ('showcase_replay_from_beginning','Воспроизвести с начала'),
  ('showcase_resume','Продолжить'),
  ('showcase_pause','Пауза'),
  ('showcase_show_completed_session','Показать завершённую сессию'),
 ]
}
for locale, pairs in entries.items():
    p=f'shared/src/commonMain/composeResources/{locale}/strings.xml'
    s=read(p)
    for key,_ in pairs:
        if f'name="{key}"' in s: raise SystemExit(f'duplicate {key} in {p}')
    block='\n    <!-- Showcase playback -->\n' + ''.join(f'    <string name="{k}">{v}</string>\n' for k,v in pairs)
    s=once(s, '\n</resources>', block+'\n</resources>', f'append showcase resources {locale}')
    write(p,s)

# --- Extension snapshot dictionary: translate remaining human-facing static subtitle. ---
p='pi-bridge/src/aether-ui-i18n.ts'
s=read(p)
needle='  "Web search tools": "Инструменты веб-поиска",\n'
s=once(s, needle, needle+'  "Master switch for web search and source verification": "Главный переключатель веб-поиска и проверки источников",\n', 'web master subtitle')
write(p,s)

# --- Web Access dynamic notifications and composer insertion need runtime language, not snapshot translation. ---
p='extensions/pi-web-access/aether.ts'
s=read(p)
activate='export const activateAether = async (aether: AetherExtensionAPI) => {\n'
helper='''function isRussianContext(context: Record<string, unknown> | undefined): boolean {\n\tif (!context) return false;\n\tconst direct = typeof context.language === "string" ? context.language : "";\n\tconst settings = context.settings && typeof context.settings === "object" && !Array.isArray(context.settings)\n\t\t? context.settings as Record<string, unknown>\n\t\t: undefined;\n\tconst nested = typeof settings?.language === "string" ? settings.language : "";\n\treturn (direct || nested).toLowerCase().startsWith("ru");\n}\n\nfunction uiText(context: Record<string, unknown> | undefined, english: string, russian: string): string {\n\treturn isRussianContext(context) ? russian : english;\n}\n\nexport const activateAether = async (aether: AetherExtensionAPI) => {\n'''
s=once(s, activate, helper, 'web context language helper')
s=once(s, 'aether.registerAction(`settings:${SETTINGS_PAGE_ID}:${binding.setting.id}`, async (payload) => {', 'aether.registerAction(`settings:${SETTINGS_PAGE_ID}:${binding.setting.id}`, async (payload, context) => {', 'settings action context')
s=once(s, 'await aether.host.invoke("app.notify", { message: "Credential or base URL updated. Reload the Pi extension to apply it." }).catch(() => {});', 'await aether.host.invoke("app.notify", { message: uiText(context, "Credential or base URL updated. Reload the Pi extension to apply it.", "Учётные данные или базовый URL обновлены. Перезагрузите расширение Pi, чтобы применить изменения.") }).catch(() => {});', 'sensitive setting notification')
s=once(s, 'await aether.host.invoke("app.notify", { message: "Web Access setting saved. Reload the Pi extension to apply it." }).catch(() => {});', 'await aether.host.invoke("app.notify", { message: uiText(context, "Web Access setting saved. Reload the Pi extension to apply it.", "Настройка веб-доступа сохранена. Перезагрузите расширение Pi, чтобы применить изменение.") }).catch(() => {});', 'setting saved notification')
s=once(s, 'aether.registerAction("research-draft", async () => {\n\t\tawait aether.host.invoke("app.appendDraftInput", { text: "Research this on the web with multiple independent sources: " });\n\t});', 'aether.registerAction("research-draft", async (_payload, context) => {\n\t\tawait aether.host.invoke("app.appendDraftInput", { text: uiText(context, "Research this on the web with multiple independent sources: ", "Исследуй это в интернете по нескольким независимым источникам: ") });\n\t});', 'research draft language')
# Dynamic latest-activity card title is rendered after snapshot generation.
s=once(s, 'const title = type === "web-search-error" ? "Web access error" : type === "web-search-content-ready" ? "Web content ready" : "Latest web activity";', 'const title = type === "web-search-error"\n\t\t\t\t? uiText(context, "Web access error", "Ошибка веб-доступа")\n\t\t\t\t: type === "web-search-content-ready"\n\t\t\t\t\t? uiText(context, "Web content ready", "Веб-контент готов")\n\t\t\t\t\t: uiText(context, "Latest web activity", "Последняя веб-активность");', 'latest activity title')
write(p,s)

print('Final user-visible EN/RU localization pass staged')
