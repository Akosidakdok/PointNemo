import sys, subprocess, pathlib, re
sys.path.insert(0,str(pathlib.Path(__file__).parent/'python-deps'))
import imageio_ffmpeg
from PIL import Image, ImageDraw
root=pathlib.Path(__file__).parent
ff=imageio_ffmpeg.get_ffmpeg_exe()
ref=pathlib.Path('C:/Users/redd/Videos/Screen Recordings/Screen Recording 2026-10-10 083727.mp4')
p=subprocess.run([ff,'-i',str(ref)],capture_output=True,text=True)
(root/'reference-metadata.txt').write_text(p.stderr)
print(p.stderr[-4000:])
duration=re.search(r'Duration: (\d+):(\d+):([\d.]+)',p.stderr)
h,m,s=map(float,duration.groups()); seconds=h*3600+m*60+s
frames=root/'reference';frames.mkdir(exist_ok=True)
times=[i*seconds/12 for i in range(12)]
sheet=Image.new('RGB',(1280,4*264),'#18222a'); d=ImageDraw.Draw(sheet)
for i,t in enumerate(times):
 path=frames/f'{i:02}.jpg'
 subprocess.run([ff,'-y','-ss',str(t),'-i',str(ref),'-frames:v','1','-vf','scale=640:-1',str(path)],capture_output=True)
 im=Image.open(path);im.thumbnail((420,236));x=(i%3)*426;y=(i//3)*264
 sheet.paste(im,(x,y));d.text((x+10,y+238),f'{t:.1f} seconds',fill='white')
sheet.save(root/'reference-contact.jpg')
