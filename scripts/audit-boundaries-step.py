from pathlib import Path
p = Path('pi-bridge/tests/runtime-boundaries.test.mjs')
s = p.read_text()
s = s.replace("'invoke_aether_action'", "'invoke_aether_extension_action'")
s = s.replace("'dispatch_aether_event'", "'dispatch_aether_extension_event'")
p.write_text(s)
