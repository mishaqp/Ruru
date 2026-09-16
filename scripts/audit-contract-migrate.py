"""Temporary GitHub Actions migration; removed from the final PR diff."""
from pathlib import Path
import json
import re

SDK = '@baimoqilin/aether-extension-api'
items = [
    ('extensions/pi-mcp-adapter/aether.ts', 'const PAGE_ID =', True),
    ('extensions/pi-subagents/src/aether.ts', '// ---- Bridge to the Pi extension', False),
    ('extensions/pi-web-access/aether.ts', 'const SETTINGS_PAGE_ID =', False),
]
for filename, boundary, preserve_exports in items:
    path = Path(filename)
    source = path.read_text()
    start = source.index('type AetherJsonObject =')
    end = source.index(boundary, start)
    declarations = source[start:end]
    names = re.findall(r'^(?:export )?(?:type|interface) (Aether\w+)', declarations, re.M)
    exported = re.findall(r'^export (?:type|interface) (Aether\w+)', declarations, re.M)
    assert names and 'AetherExtensionAPI' in names, filename
    replacement = '// Type-only: both loaders share the host contract without runtime imports.\n'
    replacement += 'import type {\n' + ''.join(f'  {name},\n' for name in names) + f'}} from "{SDK}";\n'
    if preserve_exports:
        replacement += '\nexport type {\n' + ''.join(f'  {name},\n' for name in exported) + f'}} from "{SDK}";\n'
    path.write_text(source[:start] + replacement + '\n' + source[end:])

for name in ('pi-mcp-adapter', 'pi-subagents', 'pi-web-access'):
    path = Path('extensions') / name / 'tsconfig.json'
    config = json.loads(path.read_text())
    config['compilerOptions'].setdefault('paths', {})[SDK] = ['../../packages/extension-api/dist/index.d.ts']
    if name == 'pi-web-access':
        config['compilerOptions']['types'] = ['node']
        config['compilerOptions']['strict'] = True
    path.write_text(json.dumps(config, indent=2) + '\n')

host = json.loads(Path('pi-bridge/package.json').read_text())
path = Path('extensions/pi-web-access/package.json')
manifest = json.loads(path.read_text())
for name in ('@earendil-works/pi-ai', '@earendil-works/pi-coding-agent', '@earendil-works/pi-tui'):
    manifest['devDependencies'][name] = host['dependencies'][name]
manifest['devDependencies']['@types/node'] = host['devDependencies']['@types/node']
# Keep the package's compiler generation; the lockfile pins the installed build.
path.write_text(json.dumps(manifest, indent=2) + '\n')
