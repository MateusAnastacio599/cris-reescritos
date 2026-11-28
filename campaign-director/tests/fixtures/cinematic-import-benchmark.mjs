// Actual PNG recompression and Wire/hash/proof; network/player are simulated.
import {importPNG,pngParts} from './cinematic-import-png.mjs';
import {optimizeCinematicPNG} from '../../dist/cinematic-import.js';
import {imageKey} from '../../dist/cinematic-media.js';
import {harness,until} from './cinematic-prewarm-harness.mjs';
const source=importPNG().blob,at=performance.now(),optimized=await optimizeCinematicPNG(source),importMs=performance.now()-at,results=[];
for(const [variant,blob]of [['original',source],['lossless-png',optimized.blob]]){
 const f=await harness({delays:[12,3],lead:1800,decode:20});try{const item={id:'import-bench',name:'Import QA',imageId:await imageKey(blob),motion:'living',seconds:12,intensity:10,ending:'loop',hold:0,fadeIn:0,fadeOut:0};let localStart;const click=Date.now(),run=await f.host.present(item,blob,{startLocal:async()=>{localStart=Date.now();return true;}});await run.begun;await until(()=>f.clients.every(c=>c.calls.play===1),15000);results.push({variant,mediaBytes:blob.size,clickToLastStartMs:Math.max(localStart,...f.clients.map(c=>c.calls.starts[0]))-click,foregroundTransferredBytes:f.host.diagnostics().peers.reduce((n,p)=>n+p.metrics.bytes,0)});}finally{f.close();}
}
const before=await pngParts(source),after=await pngParts(optimized.blob);
console.log(JSON.stringify({kind:'Real lossless PNG transform; SIMULATED network/player',oneWayDelayMs:[12,3],preRollMs:1800,importMs,identicalFilteredPixelStream:before.raw.equals(after.raw),savedBytes:optimized.savedBytes,results},null,2));
