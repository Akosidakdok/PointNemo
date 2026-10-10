import React from 'react';
import {AbsoluteFill,Audio,Img,Sequence,interpolate,spring,staticFile,useCurrentFrame} from 'remotion';
import manifest from '../public/manifest.json';
import captions from '../public/captions.json';

const ink='#EDF7FC',coral='#7BC8F3',mint='#30D6F2',cream='#061426';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const ease=(f:number,delay=0)=>spring({frame:f-delay,fps:30,config:{damping:18,stiffness:100,mass:.8}});
const tag:React.CSSProperties={fontSize:20,fontWeight:700,letterSpacing:3,textTransform:'uppercase'};
const headline:React.CSSProperties={fontFamily:'Pixel,Arial,sans-serif',fontSize:78,lineHeight:1.04,letterSpacing:-1,fontWeight:900,margin:'26px 0'};

const Logo=({small=false}:{small?:boolean})=><div style={{display:'flex',alignItems:'center',gap:18,fontFamily:'Pixel',fontWeight:700,fontSize:small?32:62,letterSpacing:1}}><svg width={small?40:64} height={small?40:64} viewBox="0 0 64 64"><rect x="3" y="3" width="58" height="58" rx="3" fill="#0B233A" stroke={coral} strokeWidth="3"/><circle cx="32" cy="32" r="6" fill="none" stroke={coral} strokeWidth="2"/></svg><span>POINT <span style={{color:coral}}>NEMO</span></span></div>;

function Float({children,delay=0,style={}}:{children:React.ReactNode;delay?:number;style?:React.CSSProperties}){
 const f=useCurrentFrame(),p=ease(f,delay);return <div style={{...style,opacity:interpolate(f,[delay,delay+10],[0,1],clamp),transform:`translateY(${(1-p)*60+Math.sin(f/38)*5}px) scale(${.93+.07*p})`}}>{children}</div>;
}
function Pill({children,tone='mint'}:{children:React.ReactNode;tone?:string}){return <div style={{display:'inline-flex',alignItems:'center',padding:'14px 22px',borderRadius:6,fontWeight:700,fontSize:24,background:tone==='coral'?'#193B5A':'#123744',color:tone==='coral'?coral:ink,border:'1px solid #426887'}}>{children}</div>}
function Copy({step,title,body,children}:{step:string;title:React.ReactNode;body:string;children?:React.ReactNode}){
 return <Float style={{position:'absolute',left:105,top:225,width:420}}><div style={{...tag,color:coral}}>{step}</div><h1 style={headline}>{title}</h1><p style={{fontSize:29,lineHeight:1.4,color:'#A7C0D3',marginBottom:34}}>{body}</p>{children}</Float>;
}
function Capture({name,x=585,y=172,w=1220,h=735,zoom=1,panY=0,label='ACTUAL APPLICATION',tilt=-1.5}:{name:string;x?:number;y?:number;w?:number;h?:number;zoom?:number;panY?:number;label?:string;tilt?:number}){
 const f=useCurrentFrame(),p=ease(f,8);
 return <div style={{position:'absolute',left:x,top:y,width:w,transform:`translateY(${(1-p)*100+Math.sin(f/60)*5}px) rotate(${tilt*p}deg) scale(${.95+.05*p})`,opacity:interpolate(f,[8,20],[0,1],clamp)}}>
  <div style={{background:'#0B233A',borderRadius:10,padding:12,boxShadow:'0 40px 75px #00071088,0 3px 12px #00071055',border:'1px solid #426887'}}>
   <div style={{height:40,display:'flex',alignItems:'center',gap:9,paddingLeft:12}}>{['#30D6F2','#426887','#7BC8F3'].map(c=><span key={c} style={{width:10,height:10,borderRadius:10,background:c}}/>)}<span style={{fontSize:13,marginLeft:14,fontWeight:700,letterSpacing:1.5,color:'#A7C0D3'}}>POINT NEMO / {label}</span></div>
   <div style={{height:h,overflow:'hidden',borderRadius:6,background:'#061426',position:'relative'}}><Img src={staticFile(`captures/${name}.png`)} style={{display:'block',width:'100%',transform:`translateY(${panY}px) scale(${zoom})`,transformOrigin:'50% 0%'}}/></div>
  </div>
 </div>;
}
function Sprite({animation,x,y,size=160}:{animation:string;x:number;y:number;size?:number}){
 const f=useCurrentFrame();const m=manifest as any;const a=m.animations[animation];const frames=a?.frames??[animation];const id=frames[Math.floor(f/30*(a?.fps??1))%frames.length];const item=m.frames[id]??m.frames[m.aliases[id]];if(!item)return null;
 const rect=item.rect;const scale=size/(item.source?.width??rect.width);const atlas=m.atlases[item.atlas];
 return <div style={{position:'absolute',left:Math.round(x-item.anchor.x*scale),top:Math.round(y-item.anchor.y*scale),width:rect.width*scale,height:rect.height*scale,overflow:'hidden',imageRendering:'pixelated'}}><Img src={staticFile(atlas.image)} style={{position:'absolute',left:-rect.x*scale,top:-rect.y*scale,width:atlas.width*scale,maxWidth:'none'}}/></div>;
}
function Caption({children}:{children:React.ReactNode}){return null}
function VoiceCaptions(){const f=useCurrentFrame();const c=captions.find(c=>f/30>=c.start&&f/30<c.end);if(!c)return null;return <div style={{position:'absolute',bottom:40,left:140,right:140,display:'flex',justifyContent:'center'}}><div style={{background:'#061426F0',border:'1px solid #426887',padding:'15px 28px',borderRadius:6,fontSize:28,lineHeight:1.3,fontWeight:600,boxShadow:'0 8px 22px #00071088',textAlign:'center'}}>{c.text}</div></div>}
function Scene({children,duration}:{children:React.ReactNode;duration:number}){const f=useCurrentFrame();return <AbsoluteFill style={{opacity:interpolate(f,[0,10,duration-12,duration],[0,1,1,0],clamp)}}>{children}</AbsoluteFill>}

function Intro(){const f=useCurrentFrame();return <Scene duration={180}>
 <Float style={{position:'absolute',left:105,top:126}}><Logo/></Float>
 <Float delay={5} style={{position:'absolute',left:105,top:305,width:860}}><div style={{...tag,color:coral}}>YOUR NOTES. A NEW ADVENTURE.</div><h1 style={{...headline,fontSize:112}}>One lesson.<br/>One <span style={{color:coral}}>local descent.</span></h1><p style={{fontSize:32,color:'#A7C0D3'}}>Turn your PDF into an underwater study run.</p></Float>
 <Float delay={12} style={{position:'absolute',left:1120,top:147,width:645,height:690}}><div style={{position:'absolute',inset:0,overflow:'hidden',borderRadius:14,boxShadow:'0 42px 80px #123A432A',transform:'rotate(5deg)',background:'#082136'}}><Img src={staticFile('world.png')} style={{width:'100%',height:'100%',objectFit:'cover',imageRendering:'pixelated',transform:`scale(${1.1+f*.0003})`}}/><div style={{position:'absolute',inset:0,background:'linear-gradient(0deg,#06142655,transparent)'}}/></div><Sprite animation="explorer.swim.right" x={330+Math.sin(f/30)*20} y={410} size={160}/></Float>
 <Float delay={27} style={{position:'absolute',left:1040,top:200,transform:'rotate(-8deg)'}}><div style={{background:'#0B233A',padding:'26px 36px',borderRadius:8,boxShadow:'0 18px 40px #00071088',fontSize:29,fontWeight:700}}>PDF <span style={{color:coral}}>→</span> Practice</div></Float>
 <Float delay={38} style={{position:'absolute',left:1280,top:748}}><Pill>Powered by local AI</Pill></Float>
 <Caption>A lesson to read. A world to explore. A reason to keep going.</Caption>
 </Scene>}
function Library(){return <Scene duration={210}><Copy step="01 / YOUR LIBRARY" title={<>Start with<br/><span style={{color:coral}}>your notes.</span></>} body="Choose a text-based English PDF. Your lesson becomes the starting point."><Pill>One PDF per lesson</Pill></Copy><Capture name="library" y={162} h={690}/><Float delay={35} style={{position:'absolute',left:1410,top:840}}><Pill>9 questions · ready to practice</Pill></Float><Caption>Real lesson shown: point-nemo-marine-biology.pdf</Caption></Scene>}
function Safety(){const f=useCurrentFrame();return <Scene duration={180}><Copy step="02 / CHECK THE SOURCE" title={<>A careful<br/><span style={{color:coral}}>first step.</span></>} body="The browser checks file size and PDF signature before local processing."><div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:14}}><Pill>Up to 5 MiB</Pill><Pill>Readable English text</Pill></div></Copy><Capture name="safety" y={145} h={720} zoom={1.03} panY={-50} tilt={1}/><Float delay={38} style={{position:'absolute',left:970,top:805}}><Pill>PDF signature ✓ &nbsp; Size ✓</Pill></Float><Caption>Local API checks readable text and language. At least 300 characters.</Caption></Scene>}
function Sonar(){const f=useCurrentFrame();const name=f<62?'sonar-extraction':f<150?'sonar-generation':'sonar-progress';return <Scene duration={240}><Copy step="03 / SONAR" title={<>Local AI.<br/><span style={{color:coral}}>Your lesson.</span></>} body="Read the PDF. Create the questions. Check the answers and their evidence."><Pill>Ollama · qwen2.5:3b</Pill></Copy><Capture name={name} y={152} h={680} tilt={-1} label="ACTUAL APPLICATION · EDITED FOR TIME"/><Float delay={28} style={{position:'absolute',left:685,top:827,display:'flex',gap:18}}>{['Extraction','Generation','Validation'].map((t,i)=><div key={t} style={{background:i===0?'#123744':i===1?'#193B5A':'#0B233A',padding:'18px 28px',borderRadius:6,fontSize:26,fontWeight:700,boxShadow:'0 12px 28px #00071088'}}><span style={{color:coral,marginRight:14}}>0{i+1}</span>{t}</div>)}</Float><Caption>Actual processing captures · edited for time · all questions validated before play</Caption></Scene>}
function Map(){const f=useCurrentFrame();return <Scene duration={210}><Copy step="04 / OCEAN DESCENT" title={<>Follow<br/><span style={{color:coral}}>the current.</span></>} body="Explore your lesson’s map. Clear the active topic to unlock the next encounter."><Pill>3 topics × 3 questions</Pill></Copy><Capture name="map" y={137} h={740} zoom={interpolate(f,[60,170],[1.02,1.13],clamp)} panY={interpolate(f,[60,170],[-20,-70],clamp)} label="ACTUAL COMPONENT DEMO" tilt={1.2}/><Float delay={42} style={{position:'absolute',left:1135,top:805}}><Pill>W · A · S · D &nbsp; to explore</Pill></Float><Caption>Saved local questions · real gameplay components · sequential encounters</Caption></Scene>}
function Evidence(){const f=useCurrentFrame();const answer=f>=62;return <Scene duration={330}>
 <Float style={{position:'absolute',left:105,top:115}}><div style={{...tag,color:coral}}>05 / LEARN FROM EVERY ANSWER</div><h1 style={{...headline,fontSize:68,marginTop:18}}>Every correction has <span style={{color:coral}}>a source.</span></h1></Float>
 <Capture name={answer?'evidence-full':'question'} x={105} y={interpolate(f,[62,90],[300,365],clamp)} w={1050} h={interpolate(f,[62,90],[600,440],clamp)} panY={answer?-315:-20} tilt={-1} label="ACTUAL COMPONENT DEMO"/>
 {!answer&&f>24&&<div style={{position:'absolute',left:interpolate(f,[24,45],[440,320],clamp),top:interpolate(f,[24,45],[1000,738],clamp),width:40,height:40,borderRadius:40,border:`4px solid ${coral}`,boxShadow:'0 0 0 8px #30D6F233',opacity:interpolate(f,[24,35,58,62],[0,1,1,0],clamp)}}/>}
 <Float delay={65} style={{position:'absolute',left:1240,top:310,width:540}}><div style={{background:'#0B233A',borderRadius:10,padding:38,boxShadow:'0 24px 60px #00071088',transform:'rotate(2deg)',border:'1px solid #426887'}}><div style={{...tag,fontSize:17,color:coral}}>ACTUAL PDF · PAGE 1 · EXCERPT</div><div style={{fontFamily:'Body',fontSize:35,lineHeight:1.28,fontWeight:700,margin:'24px 0'}}>“The sunlit zone is the upper ocean layer where enough sunlight is available for photosynthesis.”</div><div style={{height:2,background:mint,margin:'28px 0'}}/><div style={{fontSize:22,color:'#A7C0D3'}}>Introduction to Marine Biology</div></div><div style={{marginTop:26,display:'flex',gap:12}}><Pill>Answer</Pill><Pill>Explanation</Pill><Pill>Page</Pill></div></Float>
 <Caption>{answer?'A missed answer reveals the correction, explanation, exact quote, and PDF page.':'Answer the question. See what you know.'}</Caption>
 </Scene>}
function Boss(){const f=useCurrentFrame();return <Scene duration={240}><Copy step="06 / FINAL REVIEW" title={<>Return.<br/>Recall.<br/><span style={{color:coral}}>Go deeper.</span></>} body="The boss revisits the same nine questions in a shuffled order."><div style={{display:'flex',gap:12}}><Pill>Same 9</Pill><Pill tone="coral">8/9 to pass</Pill></div></Copy><Capture name={f<105?'boss':'boss-question'} y={160} h={690} panY={f<105?0:-180} label="ACTUAL COMPONENT DEMO" tilt={-1.5}/><Caption>Mixed-topic review · same questions, a new order</Caption></Scene>}
function Results(){return <Scene duration={120}><Copy step="07 / YOUR RESULT" title={<>Finish the run.<br/><span style={{color:coral}}>Keep learning.</span></>} body="Review the outcome, then start a fresh attempt with the same lesson."><Pill>Practice with purpose</Pill></Copy><Capture name="results" y={152} h={710} label="ACTUAL COMPONENT DEMO · SESSION RESULT" tilt={1}/><Caption>Three topics cleared. A final review completed.</Caption></Scene>}
function End(){const f=useCurrentFrame();return <Scene duration={90}><Float style={{position:'absolute',left:0,right:0,top:260,display:'flex',justifyContent:'center'}}><Logo/></Float><Float delay={4} style={{position:'absolute',top:430,left:0,right:0,textAlign:'center'}}><h1 style={{...headline,fontSize:100}}>One lesson. <span style={{color:coral}}>One descent.</span></h1><p style={{fontSize:30,color:'#A7C0D3'}}>Point Nemo · Local AI study adventure</p></Float></Scene>}
export function Promo(){const f=useCurrentFrame();return <AbsoluteFill style={{color:ink,fontFamily:'Body,Arial,sans-serif',background:cream}}>
 <style>{`@font-face{font-family:Body;src:url('${staticFile('arial.ttf')}')}@font-face{font-family:Round;src:url('${staticFile('trebucbd.ttf')}');font-weight:700 900}@font-face{font-family:Pixel;src:url('${staticFile('Pixelify.ttf')}');font-weight:400 700}*{box-sizing:border-box}`}</style>
 <AbsoluteFill style={{background:'radial-gradient(ellipse at 10% 5%,#36749E52,transparent 36%),radial-gradient(ellipse at 90% 15%,#1B578442,transparent 34%),linear-gradient(145deg,#061426,#0A2B49)'}}/>
 <AbsoluteFill style={{opacity:.12,background:'linear-gradient(125deg,#248BCF,#48B7DB 52%,#248BCF)',maskImage:`url(${staticFile('waves.svg')})`,maskSize:'1400px 700px',maskRepeat:'repeat',maskPosition:`${-f*1.2}px 0`}}/>
 <AbsoluteFill style={{opacity:.15,backgroundImage:'linear-gradient(#7BC8F311 1px,transparent 1px),linear-gradient(90deg,#7BC8F311 1px,transparent 1px)',backgroundSize:'64px 64px'}}/>
 {Array.from({length:18},(_,i)=><div key={i} style={{position:'absolute',left:(i*113+90)%1920,top:(1080+i*87-f*(.15+(i%3)*.05))%1080,width:i%3+2,height:i%3+2,background:'#7BC8F3',opacity:.2}}/>)}
 <div style={{position:'absolute',right:105,top:55,...tag,fontSize:14,color:'#A7C0D3'}}>LOCAL LEARNING / POINT NEMO</div>
 <Audio src={staticFile('score.wav')} volume={.18}/>
 <Audio src={staticFile('voiceover.wav')} volume={1}/>
 <Sequence from={0} durationInFrames={180}><Intro/></Sequence>
 <Sequence from={180} durationInFrames={210}><Library/></Sequence>
 <Sequence from={390} durationInFrames={180}><Safety/></Sequence>
 <Sequence from={570} durationInFrames={240}><Sonar/></Sequence>
 <Sequence from={810} durationInFrames={210}><Map/></Sequence>
 <Sequence from={1020} durationInFrames={330}><Evidence/></Sequence>
 <Sequence from={1350} durationInFrames={240}><Boss/></Sequence>
 <Sequence from={1590} durationInFrames={120}><Results/></Sequence>
 <Sequence from={1710} durationInFrames={90}><End/></Sequence>
 <VoiceCaptions/>
 </AbsoluteFill>}
