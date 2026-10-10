import json
from pathlib import Path
Path('tmp/merge-pr.json').write_text(json.dumps({
    'title': 'Integrate local AI improvements and complete quiz progression',
    'head': 'codex/pr-5-playground-resolution',
    'base': 'main',
    'body': Path('tmp/merge-pr.md').read_text(encoding='utf-8'),
}), encoding='utf-8')
