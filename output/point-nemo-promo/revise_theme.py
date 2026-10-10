from pathlib import Path
import shutil
p=Path(__file__).parent
src=p/'src/Promo.tsx'
s=src.read_text(encoding='utf8')
s=s.replace("const ink='#172F39',coral='#EA735D',mint='#CBE9DA',cream='#FFF8F0';", "const ink='#EDF7FC',coral='#7BC8F3',mint='#30D6F2',cream='#061426';")
for old,new in {
 "fontFamily:'Round,Arial,sans-serif'":"fontFamily:'Pixel,Arial,sans-serif'",
 "fontFamily:'Round'":"fontFamily:'Pixel'",
 "letterSpacing:-4":"letterSpacing:-1",
 "'#496169'":"'#A7C0D3'","'#52696C'":"'#A7C0D3'","'#59716B'":"'#A7C0D3'",
 "'#FAFCF7'":"'#0B233A'","'#FFFCF8'":"'#0B233A'","'#FFFFFFE8'":"'#0B233AF0'",
 "'#FCE2D8'":"'#193B5A'","'#E2F2E9'":"'#123744'","'#FFFFFF99'":"'#426887'",
 "'#E5F3EA'":"'#123744'","'#FBE4D9'":"'#193B5A'",
 "background:'white'":"background:'#0B233A'","border:'1px solid white'":"border:'1px solid #426887'",
 "borderRadius:50":"borderRadius:6","borderRadius:28":"borderRadius:10","borderRadius:22":"borderRadius:8",
 "borderRadius:18":"borderRadius:6","borderRadius:16":"borderRadius:6","borderRadius:100":"borderRadius:14",
 "'#61726F'":"'#A7C0D3'","'#74847B'":"'#A7C0D3'",
 "#203F3928":"#00071088","#203F3915":"#00071055","#233D3520":"#00071088",
 "#224C3520":"#00071088","#324F3915":"#00071088","#173E3510":"#00071088",
 "#EA735D22":"#30D6F233",
 "fontSize:small?32:62":"fontSize:small?32:62",
 "<span>point<span style={{color:coral}}>nemo</span></span>":"<span>POINT <span style={{color:coral}}>NEMO</span></span>",
 "['#EEA394','#E8C67B','#94C8B0']":"['#30D6F2','#426887','#7BC8F3']",
 "i===1?'#193B5A':'white'":"i===1?'#193B5A':'#0B233A'",
}.items():s=s.replace(old,new)
s=s.replace("font-weight:700 900}*", "font-weight:700 900}@font-face{font-family:Pixel;src:url('${staticFile('Pixelify.ttf')}');font-weight:400 700}*")
start=s.index(' <AbsoluteFill style={{background:`radial-gradient')
end=s.index('\n <div style={{position:',start)
s=s[:start]+''' <AbsoluteFill style={{background:'radial-gradient(ellipse at 10% 5%,#36749E52,transparent 36%),radial-gradient(ellipse at 90% 15%,#1B578442,transparent 34%),linear-gradient(145deg,#061426,#0A2B49)'}}/>
 <AbsoluteFill style={{opacity:.12,background:'linear-gradient(125deg,#248BCF,#48B7DB 52%,#248BCF)',maskImage:`url(${staticFile('waves.svg')})`,maskSize:'1400px 700px',maskRepeat:'repeat',maskPosition:`${-f*1.2}px 0`}}/>
 <AbsoluteFill style={{opacity:.15,backgroundImage:'linear-gradient(#7BC8F311 1px,transparent 1px),linear-gradient(90deg,#7BC8F311 1px,transparent 1px)',backgroundSize:'64px 64px'}}/>
 {Array.from({length:18},(_,i)=><div key={i} style={{position:'absolute',left:(i*113+90)%1920,top:(1080+i*87-f*(.15+(i%3)*.05))%1080,width:i%3+2,height:i%3+2,background:'#7BC8F3',opacity:.2}}/>)}'''+s[end:]
s=s.replace("<Audio src={staticFile('score.wav')} volume={.65}/>","<Audio src={staticFile('score.wav')} volume={.18}/>\n <Audio src={staticFile('voiceover.wav')} volume={1}/>")
src.write_text(s,encoding='utf8')
shutil.copyfile('apps/web/public/waves.svg',p/'public/waves.svg')
print('Theme aligned to website tokens, ocean waves, Pixelify display and cyan accents.')
