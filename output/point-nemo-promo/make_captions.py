from pathlib import Path
import json,re
root=Path(__file__).parent
voice=json.loads((root/'voiceover.json').read_text())
captions=[]
for entry in voice:
 words=entry['text'].split();lines=[];line=[]
 for word in words:
  if len(' '.join(line+[word]))>78:
   lines.append(' '.join(line));line=[]
  line.append(word)
  if word.endswith('.') and len(' '.join(line))>20:
   lines.append(' '.join(line));line=[]
 if line:lines.append(' '.join(line))
 total=sum(len(l) for l in lines);cursor=entry['start']
 for l in lines:
  duration=entry['duration']*len(l)/total
  captions.append({'start':cursor,'end':cursor+duration,'text':l});cursor+=duration
(root/'public/captions.json').write_text(json.dumps(captions,indent=2))
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
(root/'point-nemo-promo.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}' for i,c in enumerate(captions)))
print(f'{len(captions)} narration captions written.')
