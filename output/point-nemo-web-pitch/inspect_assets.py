import json
from pathlib import Path
m=json.loads(Path('assets/prepared/runtime/manifest.json').read_text())
print(json.dumps({k:m[k] for k in m if k not in ['frames','animations']})[:1500])
print(list(m['frames'].items())[:1])
print(m['animations']['explorer.swim.right'])
