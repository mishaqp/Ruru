"""Temporary GitHub-only source patcher; removed before final PR merge."""
from pathlib import Path
import json

common = [
    'AetherJsonObject', 'AetherView', 'AetherRenderContext',
    'AetherSettingDefinition', 'AetherSettingsSection', 'AetherExtensionAPI',
]
packages = [
    ('extensions/pi-mcp-adapter/aether.ts', 'const PAGE_ID =',
     common + ['AetherSettingOption', 'AetherSettingActionItem', 'AetherSettingDetailItem', 'AetherSettingsCategory', 'AetherSettingsDefinition']),
    ('extensions/pi-subagents/src/aether.ts', '// ---- Bridge to the Pi extension',
     common + ['AetherMessageTypeDefinition']),
    ('extensions/pi-web-access/aether.ts', 'const SETTINGS_PAGE_ID =',
     common + ['AetherSettingsCategory', 'AetherMessageTypeDefinition']),
]
for file, end_marker, names in packages:
    p = Path(file)
    source = p.read_text()
    if 'type AetherJsonObject =' not in source:
        assert 'from "@baimoqilin/aether-extension-api";' in source, file
        continue
    start = source.index('type AetherJsonObject =')
    end = source.index(end_marker, start)
    imports = 'import type {\n' + ''.join(f'  {name},\n' for name in names) + '} from "@baimoqilin/aether-extension-api";\n'
    if 'pi-mcp-adapter' in file:
        exported = [name for name in names if name not in ['AetherJsonObject', 'AetherView', 'AetherRenderContext', 'AetherSettingsSection']]
        # Preserve the previous public type export surface of this adapter.
        exported += ['AetherSettingsSection']
        imports += 'export type {\n' + ''.join(f'  {name},\n' for name in exported) + '} from "@baimoqilin/aether-extension-api";\n'
    p.write_text(source[:start] + imports + '\n' + source[end:])
    print(f'Migrated shared SDK types: {file}')
p = Path('pi-bridge/package.json')
manifest = json.loads(p.read_text())
manifest['devDependencies']['@types/cross-spawn'] = '6.0.6'
manifest['devDependencies']['@types/turndown'] = '5.0.6'
p.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
