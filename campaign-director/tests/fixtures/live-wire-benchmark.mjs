// Deterministic latency/heap measurements, NOT WebRTC or proof of remote clients.
import {execFileSync} from 'node:child_process';
import {LiveWire,LIVE_LIMITS} from '../../integration-main/quadro/board-live.js';
const base=execFileSync('git',['show','dde353d:quadro/board-live.js'],{cwd:new URL('../../..',import.meta.url),encoding:'utf8'});
const {LiveWire:Before}=await import('data:text/javascript;base64,'+Buffer.from(base).toString('base64'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function measure(Class,{chars,clients,priority,rtt=8}){
 const started=performance.now(),cases=[],image='data:image/png;base64,'+'A'.repeat(chars);let peakHeap=process.memoryUsage().heapUsed;const memory=setInterval(()=>peakHeap=Math.max(peakHeap,process.memoryUsage().heapUsed),10);
 try{
 for(let i=0;i<clients;i++){
  let a,b,cursorAt,imageAt,cursorStart;const send=(target,message)=>setTimeout(()=>target().handle(structuredClone(message)),rtt/2),args={scope:'benchmark',session:'s'+i,fail:error=>{throw error;},limits:LIVE_LIMITS,priority};
  a=new Class({...args,connection:{open:true,send:m=>send(()=>b,m)},receive:()=>{}});
  b=new Class({...args,connection:{open:true,send:m=>send(()=>a,m)},receive:m=>{if(m.t==='cur'&&cursorAt===undefined)cursorAt=performance.now();if(m.t==='ops')imageAt=performance.now();}});
  const promise=(async()=>{const transfer=a.send({t:'ops',up:[{id:'a',imgId:'img'}],imgs:{img:image}});await wait(10);cursorStart=performance.now();await a.send({t:'cur',x:10,y:20});await transfer;await wait(40);const result={cursorWaitMs:Math.round(cursorAt-cursorStart),imageAppliedMs:Math.round(imageAt-started),stats:a.stats};a.close();b.close();return result;})();cases.push(promise);
 }
 const results=await Promise.all(cases);return {label:priority?'negotiated wire 3':'baseline wire 2',chars,clients,simulatedRTTMs:rtt,totalMs:Math.round(performance.now()-started),peakNodeHeapMiB:Math.round(peakHeap/1024/1024),results};
 }finally{clearInterval(memory);}
}
const results=[];
results.push(await measure(Before,{chars:1200000,clients:3,priority:false}));
results.push(await measure(LiveWire,{chars:1200000,clients:3,priority:true}));
results.push(await measure(LiveWire,{chars:LIVE_LIMITS.asset-64,clients:1,priority:true}));
console.log(JSON.stringify({kind:'SIMULATED transport, real SHA-256 and Node memory; NOT WebRTC; heap is process peak, not browser or isolated per-client.',results},null,2));
