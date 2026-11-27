// Simulated latency with real RemoteCinematics/LiveWire/hash; NO browser decoder or WebRTC.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]||new URL('../../..',import.meta.url).pathname),large=process.argv[3];
const {RemoteCinematics}=await import(pathToFileURL(root+'/campaign-director/dist/cinematic-remote.js'));
const {LiveWire}=await import(pathToFileURL(root+'/quadro/board-live.js'));
const media=await import(pathToFileURL(root+'/campaign-director/dist/cinematic-media.js').href+'?v=live01b3');
const png=new Blob([readFileSync(new URL('./cinematic-theater/palco.png',import.meta.url))],{type:'image/png'}),layer=new Blob([readFileSync(new URL('./cinematic-studio/iris.png',import.meta.url))],{type:'image/png'}),video=new Blob([readFileSync(new URL('./cinematic-studio/iris.webm',import.meta.url))],{type:'video/webm'});
const [bgId,layerId,videoId]=await Promise.all([png,layer,video].map(media.imageKey));
const basic={id:'bench',imageId:bgId,name:'QA',motion:'living',seconds:12,intensity:10,ending:'loop',hold:0,fadeIn:0,fadeOut:0};
const complex={...basic,layers:[{id:'iris',name:'QA',imageId:layerId,x:.5,y:.6,scale:.35,parallax:1,visible:true,video:{mediaId:videoId,enabled:true,loop:true,rate:1,delay:0,end:'fallback',transparent:true}}]};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function measure(item,assets,{rtt=20,decodes=[40,100],label}){
 const clients=[],starts=[],frames=[],offsets=[],observations=[];let publicKey;
 const bridge={registerLiveHost:async(r,k)=>publicKey=k,liveHostKey:async()=>publicKey};
 const host=new RemoteCinematics({Wire:LiveWire,frame:{},bridge});await host.prepareHost('BENCHROOM');
 try{
 for(let i=0;i<decodes.length;i++){
  const observation={};observations.push(observation);const frame={prepare:async()=>{const at=performance.now();await pause(decodes[i]);observation.decoderStubMs=performance.now()-at;observation.readyAt=performance.now();return true;},startPrepared:async()=>{starts[i+1]=performance.now();return true;},show:async()=>{starts[i+1]=performance.now();return true;},seek:t=>offsets[i]=t,clear:async()=>true};frames.push(frame);
  const client=new RemoteCinematics({Wire:LiveWire,frame,bridge,now:()=>Date.now()+i*300});clients.push(client);
  const receive=client.receiveAsset.bind(client);client.receiveAsset=async(...args)=>{const at=performance.now();await receive(...args);observation.integrityMs=(observation.integrityMs||0)+performance.now()-at;};
  const originalPacket=client.packet.bind(client);client.packet=(m,c)=>{if(m.kind==='prepare'){observation.commandMs=performance.now()-observation.commandAt;observation.receivedAt=performance.now();}return originalPacket(m,c);};
  const a={open:true,_identity:'p'+i,_name:'QA',_session:'bench'+i,send:m=>{if(m.kind==='prepare')observation.commandAt=performance.now();return setTimeout(()=>client.packet(structuredClone(m),b),rtt/2);}},b={open:true,_session:'bench'+i,send:m=>setTimeout(()=>host.packet(structuredClone(m),a),rtt/2)};
  host.bind(a,{role:'host',campaign:'qa',code:'BENCHROOM'});client.bind(b,{role:'client',campaign:'qa',code:'BENCHROOM'});
 }
 while([...host.peers.values()].some(p=>!p.verified))await pause(5);await pause(rtt*3);
 const results=[];
 for(const cache of ['cold','warm']){
  starts.length=0;observations.forEach(o=>{for(const key of Object.keys(o))delete o[key];});const began=performance.now();let run;
  if(media.cinematicHashMetrics){for(const k of Object.keys(media.cinematicHashMetrics))media.cinematicHashMetrics[k]=0;}
  if('maybeStart' in host)run=await host.present(item,assets,{prepareLocal:async()=>{await pause(20);return true;},startLocal:async()=>{starts[0]=performance.now();return true;}});
  else {starts[0]=performance.now();await host.present(item,assets);}
  for(let tries=0;starts.filter(Number.isFinite).length!==clients.length+1;tries++){if(tries>12000)throw Error('benchmark timeout');await pause(5);}
  await pause(rtt*2);
  results.push({cache,wallToLastStartMs:Math.round(Math.max(...starts)-began),startSpreadMs:Math.round(Math.max(...starts)-Math.min(...starts)),startAfterCommandMs:starts.map(x=>Math.round(x-began)),offsets:[...offsets],observations:observations.map((o,i)=>({commandMs:o.commandMs,integrityMs:o.integrityMs||0,decoderStubMs:o.decoderStubMs,receiveToReadyMs:o.readyAt-o.receivedAt,readyToStartMs:starts[i+1]-o.readyAt})),participants:host.diagnostics().peers.map(p=>p.metrics||{}),hash:media.cinematicHashMetrics?{...media.cinematicHashMetrics}:null});
  host.stop(true);await pause(rtt*3);
 }
 return {label,rttMs:rtt,decoderDelayStubsMs:decodes,totalMediaBytes:Object.values(assets).reduce((n,b)=>n+b.size,0),results};
 }finally{host.close();clients.forEach(c=>c.close());}
}
const results=[];results.push(await measure(basic,{[bgId]:png},{label:'simple, 2 participants'}));results.push(await measure(complex,{[bgId]:png,[layerId]:layer,[videoId]:video},{label:'layers + WebM, 2 participants'}));
if(large){const webm=new Blob([readFileSync(large)],{type:'video/webm'}),id=await media.imageKey(webm),fallback=new Blob([readFileSync(new URL('./cinematic-theater/palco.png',import.meta.url))],{type:'image/png'});results.push(await measure({...basic,backgroundVideo:{mediaId:id,enabled:true,loop:true,rate:1,delay:0,end:'fallback',transparent:false}},{[bgId]:fallback,[id]:webm},{label:'large WebM, 1 participant',rtt:20,decodes:[100]}));}
let hashReads=0;class CountedBlob extends Blob{arrayBuffer(){hashReads++;return super.arrayBuffer();}}const counted=new CountedBlob([await png.arrayBuffer()],{type:'image/png'}),hashBegin=performance.now();for(let i=0;i<8;i++)await media.imageKey(counted);const hashReuse={calls:8,arrayBufferReads:hashReads,ms:performance.now()-hashBegin};
console.log(JSON.stringify({hashReuse,kind:'SIMULATION. Real hashes and LiveWire; decoder uses time stubs; no WebRTC or physical devices.',root,results},null,2));
