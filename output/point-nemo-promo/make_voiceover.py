from pathlib import Path
import sys,asyncio,json,subprocess,wave
root=Path(__file__).parent
sys.path.insert(0,str(root/'python-deps'))
import edge_tts
import imageio_ffmpeg
import numpy as np
segments=[
 (0.3,5.7,'Point Nemo turns your lesson PDF into a local underwater study adventure.'),
 (6.25,6.5,'Start with your own notes. Choose one English, text-based PDF from your local library.'),
 (13.25,5.5,'The safety gate checks the file and its signature before local processing begins.'),
 (19.25,7.5,'Sonar reads your lesson. Local Ollama creates nine questions, then validation checks answers against source evidence.'),
 (27.25,6.5,'Explore three topics on your ocean map. Clear each encounter to unlock the next.'),
 (34.25,10.5,'Every correction has a source. Miss a question, and see the correct answer, an explanation, and the exact supporting quote with its PDF page.'),
 (45.25,7.5,'Then face the final review: the same nine questions, shuffled. Get eight right to complete the run.'),
 (53.25,4.5,'See your result, and try the lesson again.'),
 (57.15,2.75,'One lesson. One descent.'),
]
ff=Path(imageio_ffmpeg.get_ffmpeg_exe())
probe=root/'node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe'
speech=root/'voice';speech.mkdir(exist_ok=True)
async def generate():
 for i,(start,slot,content) in enumerate(segments):
  out=speech/f'{i:02}.mp3'
  if not out.exists():
   talk=edge_tts.Communicate(content,'en-US-GuyNeural',rate='+4%')
   await talk.save(str(out))
  print(f'Generated narration {i+1}/{len(segments)}',flush=True)
asyncio.run(generate())
rate=48000;timeline=np.zeros(rate*60,dtype=np.float32)
report=[]
for i,(start,slot,content) in enumerate(segments):
 mp3=speech/f'{i:02}.mp3'
 info=json.loads(subprocess.check_output([str(probe),'-v','quiet','-show_format','-of','json',str(mp3)]))
 decoded=speech/f'{i:02}-trimmed.wav'
 subprocess.run([str(ff),'-y','-i',str(mp3),'-ar',str(rate),'-ac','1',str(decoded)],capture_output=True,check=True)
 with wave.open(str(decoded),'rb') as w:raw=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2')
 active=np.flatnonzero(np.abs(raw.astype(np.int32))>45)
 raw=raw[max(0,int(active[0])-int(.06*rate)):min(len(raw),int(active[-1])+int(.12*rate))]
 with wave.open(str(decoded),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(raw.tobytes())
 duration=len(raw)/rate
 speed=max(1,duration/(slot-.12))
 if speed>1.28:raise RuntimeError(f'Narration segment {i} too fast: {speed:.2f}; shorten script')
 wav=speech/f'{i:02}.wav'
 subprocess.run([str(ff),'-y','-i',str(decoded),'-af',f'atempo={speed},loudnorm=I=-17:TP=-2:LRA=7','-ar',str(rate),'-ac','1',str(wav)],capture_output=True,check=True)
 with wave.open(str(wav),'rb') as w:pcm=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float32)/32768
 a=int(start*rate);timeline[a:a+min(len(pcm),len(timeline)-a)]+=pcm[:len(timeline)-a]
 report.append({'start':start,'duration':len(pcm)/rate,'speed':speed,'text':content})
with wave.open(str(root/'public/voiceover.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((np.clip(timeline,-1,1)*32767).astype('<i2').tobytes())
(root/'voiceover.json').write_text(json.dumps(report,indent=2))
(root/'voiceover-script.txt').write_text('\n\n'.join(f'{s:05.2f}s: {t}' for s,d,t in segments))
print(json.dumps(report,indent=2))
