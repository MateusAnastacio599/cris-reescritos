// Test-only. No account tokens, SDP contents, candidate addresses or production data.
const $=s=>document.querySelector(s),report=$('#result');
const result={fixture:'LIVE-01A.1 · isolação e WebRTC',scope:'Contas FICTÍCIAS; não autentica membros',isolation:null,rtc:null};
const show=()=>{report.textContent=JSON.stringify(result,null,2);};
async function isolation(){
 const key='cris:live:probe',readCookie=()=>document.cookie.split('; ').find(x=>x.startsWith('cris_live_probe='))?.split('=')[1];
 const local=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,local);
 const cookie=readCookie()||crypto.randomUUID();document.cookie='cris_live_probe='+cookie+'; path=/; SameSite=Lax';
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cris-live-homologation-probe',1);r.onupgradeneeded=()=>r.result.createObjectStore('probe');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const indexed=await new Promise((resolve,reject)=>{const tx=db.transaction('probe','readwrite'),store=tx.objectStore('probe'),r=store.get('marker');let id;r.onsuccess=()=>{id=r.result||crypto.randomUUID();store.put(id,'marker');};tx.oncomplete=()=>resolve(id);tx.onerror=()=>reject(tx.error);});db.close();
 const session=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,session);
 result.isolation={localStorage:local,cookie:readCookie(),indexedDB:indexed,tabSession:session,warning:'Compare os 3 primeiros marcadores em perfis distintos. Nomes de aba ou tabSession diferentes NÃO comprovam isolamento de autenticação.'};show();
}
$('#isolation').onclick=()=>isolation().catch(e=>{result.isolation={error:e.name};show();});
$('#rtc').onclick=async()=>{
 $('#rtc').disabled=true;const started=performance.now(),pcs=[],channels=[],timers=new Set(),events=[],pending=new Map();
 const data=result.rtc={stage:'starting',events,candidates:0,candidateTypes:{host:0,srflx:0,relay:0},candidateCompleteEvents:0,candidateErrors:0,constructorAvailable:typeof RTCPeerConnection==='function',secureContext:isSecureContext,description:'Par nativo sem PeerJS; STUN opcional, sem TURN: apenas diagnóstico da API; não prova multiplayer.'};
 const event=(name,pc)=>{if(events.length>=80)events.shift();events.push({ms:Math.round(performance.now()-started),name,signaling:pc.signalingState,ice:pc.iceConnectionState,gathering:pc.iceGatheringState,connection:pc.connectionState,localDescription:!!pc.localDescription,remoteDescription:!!pc.remoteDescription});show();};
 const timeout=(operation,label,ms=5000)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{timers.delete(timer);reject(Error(label+' timeout ('+ms+' ms)'));},ms);timers.add(timer);Promise.resolve(operation).then(value=>{clearTimeout(timer);timers.delete(timer);resolve(value);},error=>{clearTimeout(timer);timers.delete(timer);reject(error);});});
 try{
  const config={iceServers:$('#stun').checked?[{urls:'stun:stun.l.google.com:19302'}]:[]};data.publicStun=!!config.iceServers.length;
  const a=new RTCPeerConnection(config),b=new RTCPeerConnection(config);pcs.push(a,b);
  for(const [label,pc,other] of [['a',a,b],['b',b,a]]){
   for(const type of ['signalingstatechange','iceconnectionstatechange','icegatheringstatechange','connectionstatechange'])pc.addEventListener(type,()=>event(label+':'+type,pc));
   pc.addEventListener('icecandidate',e=>{if(e.candidate){data.candidates++;if(Object.hasOwn(data.candidateTypes,e.candidate.type))data.candidateTypes[e.candidate.type]++;if(other.remoteDescription)other.addIceCandidate(e.candidate).catch(error=>{data.candidateErrors++;data.candidateError=error.name;});else{const list=pending.get(other)||[];list.push(e.candidate);pending.set(other,list);}}else data.candidateCompleteEvents++;});
   pc.addEventListener('icecandidateerror',e=>{(data.iceErrorCodes??=[]).push(e.errorCode);show();});
  }
  const channel=a.createDataChannel('live-probe');channels.push(channel);channel.addEventListener('open',()=>{data.channel='open';show();});
  b.addEventListener('datachannel',e=>{channels.push(e.channel);e.channel.addEventListener('message',m=>e.channel.send(m.data));});
  const flush=async pc=>{for(const candidate of pending.get(pc)||[])await pc.addIceCandidate(candidate);pending.delete(pc);};
  data.stage='createOffer';event('before-createOffer',a);const offer=await timeout(a.createOffer(),'createOffer');data.offerType=offer?.type;
  data.stage='setLocalDescription';show();await timeout(a.setLocalDescription(offer),'setLocalDescription');
  data.stage='setRemoteDescription';show();await timeout(b.setRemoteDescription(offer),'setRemoteDescription');await flush(b);
  data.stage='createAnswer';show();const answer=await timeout(b.createAnswer(),'createAnswer');await timeout(b.setLocalDescription(answer),'answer-setLocalDescription');await timeout(a.setRemoteDescription(answer),'answer-setRemoteDescription');await flush(a);
  data.stage='DataChannel';show();await timeout(new Promise(resolve=>channel.readyState==='open'?resolve():channel.addEventListener('open',resolve,{once:true})),'DataChannel',8000);
  const ping=performance.now();const pong=new Promise(resolve=>channel.addEventListener('message',resolve,{once:true}));channel.send('probe');await timeout(pong,'echo');data.echoRTTMs=Math.round(performance.now()-ping);data.stage='passed';
 }catch(error){data.error=error.name==='Error'&&/timeout/.test(error.message)?error.message:'WebRTC operation rejected; inspect stage and errorName';data.errorName=error.name;data.failedStage=data.stage;data.stage='failed';}
 finally{data.elapsedMs=Math.round(performance.now()-started);data.final=[];for(const pc of pcs){const summary={signaling:pc.signalingState,ice:pc.iceConnectionState,gathering:pc.iceGatheringState,connection:pc.connectionState,localDescription:!!pc.localDescription,remoteDescription:!!pc.remoteDescription,localSdpCandidates:(pc.localDescription?.sdp.match(/^a=candidate:/gm)||[]).length,remoteSdpCandidates:(pc.remoteDescription?.sdp.match(/^a=candidate:/gm)||[]).length,statsLocalCandidates:0,statsRemoteCandidates:0};try{const stats=await pc.getStats();for(const v of stats.values()){if(v.type==='local-candidate')summary.statsLocalCandidates++;if(v.type==='remote-candidate')summary.statsRemoteCandidates++;}}catch(error){summary.statsError=error.name;}data.final.push(summary);}for(const t of timers)clearTimeout(t);for(const c of channels)c.close();for(const pc of pcs)pc.close();$('#rtc').disabled=false;show();}
};
show();
