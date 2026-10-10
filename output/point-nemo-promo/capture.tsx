import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {GameplayModule} from '../../apps/web/src/components/gameplay/GameplayModule';
import {loadAssetBundle} from '../../apps/web/src/game/sprites';
import {questionSetToLessonRecord} from '../../apps/web/src/game/lessonCatalog';
import '../../apps/web/src/styles.css';
import '../../apps/web/src/styles/pixel-ocean.css';
import lesson from './public/lesson.json';
const lessons=[questionSetToLessonRecord(lesson as any)];
const noop=()=>{};
function Capture(){const [bundle,setBundle]=useState<any>(null);useEffect(()=>{loadAssetBundle('/assets/runtime/manifest.json').then(setBundle)},[]);return <div className="playground-shell"><div className="app-frame"><div style={{fontFamily:'sans-serif',padding:'16px 0',color:'#8fe8c7',fontSize:14}}>POINT NEMO · PRODUCT COMPONENT DEMO · SAVED LOCAL QUESTIONS</div><main className="playground-main">{bundle&&<GameplayModule bundle={bundle} customLessons={lessons} initialSubscreen="seas" onNavigateScreen={noop} onUploadNewPdf={noop}/>}</main></div></div>}
createRoot(document.getElementById('root')!).render(<Capture/>);
