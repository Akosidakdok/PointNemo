import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer';
import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
const serveUrl=await bundle({entryPoint:resolve('src/index.tsx'),publicDir:resolve('public'),outDir:resolve('bundle')});
const composition=await selectComposition({serveUrl,id:'PointNemo'});
if(process.argv.includes('--stills')){
 await mkdir('stills',{recursive:true});
 for(const frame of [75,255,450,630,870,1140,1425,1635,1760]){
  await renderStill({serveUrl,composition,output:resolve(`stills/${frame}.png`),frame,imageFormat:'png'});
  console.log(`Preview ${frame}`);
 }
}else{
 let last=-1;
 await renderMedia({serveUrl,composition,codec:'h264',crf:18,pixelFormat:'yuv420p',audioCodec:'aac',outputLocation:resolve('point-nemo-promo.mp4'),concurrency:4,onProgress:({progress})=>{const p=Math.floor(progress*100);if(p!==last&&p%5===0){console.log(`Render ${p}%`);last=p}}});
 console.log('Rendered point-nemo-promo.mp4');
}
