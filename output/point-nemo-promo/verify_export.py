from pathlib import Path
import sys,subprocess,json,zipfile
from PIL import Image,ImageDraw
root=Path(__file__).parent
sys.path.insert(0,str(root/'python-deps'))
import imageio_ffmpeg
ff=imageio_ffmpeg.get_ffmpeg_exe()
probe=root/'node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe'
mp4=root/'point-nemo-promo.mp4'
info=json.loads(subprocess.check_output([str(probe),'-v','quiet','-show_streams','-show_format','-of','json',str(mp4)]))
(root/'export-metadata.json').write_text(json.dumps(info,indent=2))
v=next(s for s in info['streams'] if s['codec_type']=='video')
a=next(s for s in info['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['avg_frame_rate'])==(1920,1080,'30/1')
assert abs(float(info['format']['duration'])-60)<.1
assert a['codec_name']=='aac'
qa=root/'qa';qa.mkdir(exist_ok=True)
times=[2.5,8.5,15,22,30,38,47.5,55,58.5]
sheet=Image.new('RGB',(1440,3*294),'#061426');d=ImageDraw.Draw(sheet)
for i,t in enumerate(times):
 out=qa/f'{t}.jpg'
 subprocess.run([ff,'-y','-ss',str(t),'-i',str(mp4),'-frames:v','1','-vf','scale=960:-1',str(out)],capture_output=True,check=True)
 im=Image.open(out);im.thumbnail((480,270));x=i%3*480;y=i//3*294
 sheet.paste(im,(x,y));d.text((x+12,y+274),f'{t:.1f} seconds',fill='#7BC8F3')
sheet.save(root/'preview-contact.jpg')
stats=subprocess.run([ff,'-i',str(mp4),'-af','volumedetect','-vn','-f','null','-'],capture_output=True,text=True)
(root/'audio-verification.txt').write_text(stats.stderr)
print('Export verified:',v['codec_name'],v['width'],v['height'],v['avg_frame_rate'],info['format']['duration'],a['codec_name'])
print('\n'.join(l for l in stats.stderr.splitlines() if 'mean_volume' in l or 'max_volume' in l))
include=['src','public','README.md','package.json','package-lock.json','tsconfig.json','render.mjs','make_score.py','make_voiceover.py','make_captions.py','voiceover-script.txt','voiceover.json','point-nemo-promo.srt','export-metadata.json']
with zipfile.ZipFile(root/'point-nemo-editable-project.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name in include:
  p=root/name
  if p.is_dir():
   for f in p.rglob('*'):
    if f.is_file():z.write(f,Path('point-nemo-promo')/f.relative_to(root))
  elif p.exists():z.write(p,Path('point-nemo-promo')/p.relative_to(root))
print('Editable project ZIP created.')
