"""Temporary, scoped correction; removed from the final diff."""
from pathlib import Path
for filename in ('openai-search.ts', 'xai-search.ts'):
    path = Path('extensions/pi-web-access') / filename
    source = path.read_text()
    old = 'headers: resolved.headers ?? {}'
    assert source.count(old) == 1, filename
    source = 'import { httpProviderHeaders } from "./provider-headers.ts";\n' + source.replace(old, 'headers: httpProviderHeaders(resolved.headers)')
    path.write_text(source)
for filename, count in (('index.ts', 1), ('summary-review.ts', 2)):
    path = Path('extensions/pi-web-access') / filename
    source = path.read_text()
    old = 'headers?: Record<string, string>'
    assert source.count(old) == count, (filename, source.count(old))
    source = 'import type { CompletionHeaders } from "./provider-headers.ts";\n' + source.replace(old, 'headers?: CompletionHeaders')
    path.write_text(source)
