from pathlib import Path
import numpy as np, wave
rate=48000;duration=60
t=np.arange(rate*duration)/rate
track=np.zeros((len(t),2),dtype=np.float64)
def add(start,length,freq,gain=.05,pan=0,kind='pad'):
 i=int(start*rate);n=min(int(length*rate),len(t)-i)
 if n<=0:return
 u=np.arange(n)/rate
 if kind=='ping':
  env=np.exp(-u*3)*(1-np.exp(-u*80));sound=np.sin(2*np.pi*(freq*u-18*u*u))*env
 elif kind=='pluck':
  env=np.exp(-u*5)*(1-np.exp(-u*100));sound=(np.sin(2*np.pi*freq*u)+.22*np.sin(4*np.pi*freq*u))*env
 else:
  env=np.minimum(u/1.2,1)*np.minimum((length-u)/1.8,1)
  sound=(np.sin(2*np.pi*freq*u)+.18*np.sin(2*np.pi*(freq*2+.2)*u))*env*.45
 track[i:i+n,0]+=sound*gain*(1-pan*.4);track[i:i+n,1]+=sound*gain*(1+pan*.4)
# Original restrained ambient composition: D major / B minor / G / A.
chords=[[146.83,220,293.66,369.99],[123.47,185,246.94,293.66],[98,146.83,196,246.94],[110,164.81,220,277.18]]
for bar in range(15):
 chord=chords[bar%4]
 for j,f in enumerate(chord):add(bar*4,5.5,f,.042,(j-1.5)/2)
 for beat in range(4):
  add(bar*4+beat+.15,1.7,chord[beat%4]*2,.024,(beat-1.5)/2,'pluck')
for sec in [0.4,6.2,13.2,19.2,27.2,34.2,45.2,53.2,58.2]:add(sec,1.7,740,.048,0,'ping')
fade=np.minimum(t/1.2,1)*np.minimum((duration-t)/2,1)
track*=fade[:,None]
track=np.tanh(track)*2.6
out=Path(__file__).parent/'public/score.wav'
with wave.open(str(out),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes((track*32767).astype('<i2').tobytes())
print(out, 'Original 60-second stereo score',float(abs(track).max()))
