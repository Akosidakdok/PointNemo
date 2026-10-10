import importlib.util, json, os
from pathlib import Path
print({m:bool(importlib.util.find_spec(m)) for m in ['PIL','imageio_ffmpeg','cv2','numpy']})
for p in [Path('C:/Users/redd/Videos/Screen Recordings'),Path('C:/Users/redd/.cache/codex-runtimes/codex-primary-runtime/dependencies')]:
 print(str(p),[str(x) for x in p.glob('*')][:40])
