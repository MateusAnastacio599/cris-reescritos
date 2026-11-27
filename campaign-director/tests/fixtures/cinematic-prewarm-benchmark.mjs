// Real Wire/hash/proof/coordinator with simulated links and player stubs. No WebRTC/decoder claim.
import {asset,harness,until,pause} from './cinematic-prewarm-harness.mjs';
const current=await asset(16000,'bench-current'),next=await asset(2*1024*1024,'bench-next');
const results=[];
for(const mode of ['none','partial','full']){
 const f=await harness({delays:[12,3],lead:1800,decode:20});f.host.prewarm.pace=8;let loopLag=0,currentLoopLag=0,foreground=false,last=performance.now(),peakCache=0;const interval=setInterval(()=>{const now=performance.now();loopLag=Math.max(loopLag,now-last-10);if(!foreground)currentLoopLag=Math.max(currentLoopLag,now-last-10);last=now;for(const c of f.clients)peakCache=Math.max(peakCache,[...c.client.cache.values()].reduce((n,b)=>n+b.size,0));},10);
 try{
  const first=await f.host.present(current.item,current.blob);await first.begun;await until(()=>f.clients.every(c=>c.calls.play===1));await until(()=>[...f.host.peers.values()].every(p=>p.status==='apresentando'));const before=f.clients.map(c=>c.calls.prepare);let warmMs=0,transferred=0;
  if(mode!=='none'){const start=Date.now();await f.host.prewarm.set(next.item,next.blob,{authorized:true});await until(()=>mode==='full'?f.host.prewarm.report().status==='ready':f.host.prewarm.report().participants[0]?.status==='ready',60000);warmMs=Date.now()-start;transferred=f.host.prewarm.report().participants.reduce((n,p)=>n+p.bytes,0);}
  foreground=true;const uninterrupted=f.clients.every((c,i)=>c.calls.prepare===before[i]&&c.calls.play===1),click=Date.now();let localStart;
  const run=await f.host.present(next.item,next.blob,{startLocal:async()=>{localStart=Date.now();return true;}});await run.begun;await until(()=>f.clients.every(c=>c.calls.play===2),15000);await pause(35);
  const peers=f.host.diagnostics().peers;results.push({mode,mediaBytes:next.blob.size,prewarmMs:warmMs,prewarmTransferredBytes:transferred,clickToLastStartMs:Math.max(localStart,...f.clients.map(c=>c.calls.starts[1]))-click,startSpreadMs:Math.max(localStart,...f.clients.map(c=>c.calls.starts[1]))-Math.min(localStart,...f.clients.map(c=>c.calls.starts[1])),foregroundTransferredBytes:peers.reduce((n,p)=>n+p.metrics.bytes,0),reusedBytes:peers.reduce((n,p)=>n+p.metrics.reusedBytes,0),peakClientCacheBytes:peakCache,cacheBudgetBytes:24*1024*1024,observedEventLoopLagMs:Math.round(loopLag*100)/100,currentPlaybackEventLoopLagMs:Math.round(currentLoopLag*100)/100,currentPlayerNotRemounted:uninterrupted,participants:peers.map(p=>p.metrics)});
 }finally{clearInterval(interval);f.close();}
}
console.log(JSON.stringify({kind:'SIMULATED network and player stubs',oneWayDelayMs:[12,3],preRollMs:1800,prewarmFragmentWindow:1,paceMs:8,results},null,2));
