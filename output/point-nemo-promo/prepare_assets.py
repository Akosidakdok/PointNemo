from pathlib import Path
import json, shutil
root=Path(__file__).parent
pub=root/'public';pub.mkdir(exist_ok=True)
for name in ['explorer','barreleye','gulper','goblin','fringehead','buoy','water','effects']:
 shutil.copyfile(f'assets/prepared/runtime/{name}.png',pub/f'{name}.png')
shutil.copyfile('assets/prepared/runtime/manifest.json',pub/'manifest.json')
shutil.copyfile('assets/maps/point-nemo-abyss-ocean.png',pub/'world.png')
shutil.copyfile('apps/web/public/fonts/PixelifySans-Variable.ttf',pub/'Pixelify.ttf')
for font in ['arial.ttf','arialbd.ttf','trebucbd.ttf']:
 p=Path('C:/Windows/Fonts')/font
 if p.exists():shutil.copyfile(p,pub/font)
data=json.loads((root/'library.json').read_text())['data']
qset=next(s for d in data if d['filename']=='point-nemo-marine-biology.pdf' for s in d['questionSets'] if s.get('compatible'))
(pub/'lesson.json').write_text(json.dumps(qset,indent=2))
print([(q['prompt'],q['options'][q['answerIndex']]) for q in qset['questions']])
