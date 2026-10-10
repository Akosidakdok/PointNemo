from pathlib import Path
import subprocess

Path("require('fs').writeFileSync(p").unlink(missing_ok=True)

for name in ['apps/web/src/styles/pixel-ocean.css', 'apps/web/src/styles/playground-theme.css']:
    p = Path(name)
    p.write_text(p.read_text(encoding='utf-8').rstrip()+'\n', encoding='utf-8')

paths = subprocess.check_output(['git', 'ls-files'], text=True).splitlines()
markers=[]
for name in paths:
    path=Path(name)
    if path.suffix in {'.ts','.tsx','.js','.css','.md','.html','.json'} and path.exists():
        for n,line in enumerate(path.read_text(encoding='utf-8', errors='replace').splitlines(),1):
            if line.startswith(('<<<<<<< ', '>>>>>>> ', '=======')):
                markers.append(f'{name}:{n}:{line}')
print('\n'.join(markers) if markers else 'No conflict markers in tracked source files.')
raise SystemExit(bool(markers))
