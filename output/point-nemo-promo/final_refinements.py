from pathlib import Path
p=Path(__file__).parent/'src/Promo.tsx'
s=p.read_text(encoding='utf8')
s=s.replace('function Results(){return <Scene duration={150}>','function Results(){return <Scene duration={120}>')
s=s.replace('function End(){const f=useCurrentFrame();return <Scene duration={60}>','function End(){const f=useCurrentFrame();return <Scene duration={90}>')
s=s.replace('<Capture name="map" y={137} h={740} zoom={1.02} panY={-20}', '<Capture name="map" y={137} h={740} zoom={interpolate(f,[60,170],[1.02,1.13],clamp)} panY={interpolate(f,[60,170],[-20,-70],clamp)}')
s=s.replace('<Capture name={name} y={152} h={680} tilt={-1}/>', '<Capture name={name} y={152} h={680} tilt={-1} label="ACTUAL APPLICATION · EDITED FOR TIME"/>')
s=s.replace("border:'1px solid #FFFFFF99'","border:'1px solid #426887'")
p.write_text(s,encoding='utf8')
