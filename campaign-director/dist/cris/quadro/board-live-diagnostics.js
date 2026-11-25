// Observation only: no SDP, candidate addresses/URLs, credentials or account IDs leave this module.
const types=['host','srflx','relay','prflx'];
const counts=()=>Object.fromEntries(types.map(t=>[t,0]));
const safe=value=>typeof value==='string'?value.replace(/[^a-z-]/g,'').slice(0,40):null;
export function liveConnectionStage(value={}){
 if(value.protocolFailed)return 'protocol-failed';
 if(value.peerError==='browser-incompatible')return 'browser-incompatible';
 if(value.ice==='failed')return 'ice-route-failed';
 if(['webrtc','sdp-error'].includes(value.errorType)||value.peerError==='webrtc')return 'sdp-rejected';
 if(!value.peerOpen)return 'signaling-unavailable';
 if(value.peerError==='peer-unavailable'&&!value.remoteDescription)return 'host-unavailable';
 if(value.ice==='disconnected'||value.connection==='disconnected')return 'ice-disconnected';
 if(value.channelState==='closed'||value.connection==='closed')return 'channel-closed';
 if(value.channelOpen)return value.applied?'connected':'loading-board';
 if(value.localDescription&&value.remoteDescription){
  if(value.gathering==='complete'&&value.candidates===0)return 'ice-no-candidates';
  if(value.gathering==='complete'&&value.candidates>0&&value.candidateEvents===0&&value.localSdpCandidates===0&&value.remoteCandidates===0)return 'ice-candidates-not-emitted';
  if(['connected','completed'].includes(value.ice))return 'datachannel-pending';
  return 'ice-checking';
 }
 return value.localDescription?'awaiting-remote-sdp':'sdp-pending';
}
export const LIVE_STAGE_TEXT=Object.freeze({
 'signaling-unavailable':'Servidor de salas indisponível ou conectando.',
 'host-unavailable':'O anfitrião não respondeu à sinalização. Confira se a sala está aberta.',
 'browser-incompatible':'Este navegador não oferece os recursos WebRTC necessários.',
 'sdp-rejected':'A negociação WebRTC falhou; consulte o diagnóstico da conexão.',
 'sdp-pending':'Preparando a negociação WebRTC.',
 'awaiting-remote-sdp':'Aguardando a resposta WebRTC da outra janela.',
 'ice-no-candidates':'O navegador não encontrou candidatos ICE. Confira a rede e as políticas do navegador.',
 'ice-candidates-not-emitted':'Há candidatos nas estatísticas locais, mas nenhum disponível para troca ICE. Consulte o diagnóstico.',
 'ice-route-failed':'A descoberta de rota ICE falhou. Nenhuma causa de rede foi presumida.',
 'ice-disconnected':'Rota ICE interrompida; aguardando recuperação.',
 'channel-closed':'O canal de dados foi encerrado.',
 'ice-checking':'Buscando uma rota de conexão entre os participantes.',
 'datachannel-pending':'Rota ICE disponível; aguardando abertura do canal de dados.',
 'loading-board':'Canal aberto · carregando quadro e arquivos.',
 'connected':'Quadro sincronizado · conectado.',
 'protocol-failed':'Canal aberto, mas a sincronização do quadro falhou.'
});
export function summarizeIceConfiguration(config={}){
 const servers=Array.isArray(config.iceServers)?config.iceServers:[];
 const result={serverCount:servers.length,stun:0,turn:0,turns:0,credentialed:0,iceTransportPolicy:config.iceTransportPolicy==='relay'?'relay':'all',iceCandidatePoolSize:Number.isInteger(config.iceCandidatePoolSize)?config.iceCandidatePoolSize:0};
 for(const server of servers){
  if(server.username||server.credential)result.credentialed++;
  for(const url of Array.isArray(server.urls)?server.urls:[server.urls]){const scheme=typeof url==='string'?url.split(':',1)[0]:'';if(['stun','turn','turns'].includes(scheme))result[scheme]++;}
 }
 return result;
}
function descriptionCounts(description){
 const result=counts();
 // Aggregate types only. Do not retain SDP addresses, IDs, fingerprints or passwords.
 for(const match of (description?.sdp||'').matchAll(/^a=candidate:[^\r\n]*? typ (host|srflx|relay|prflx)(?: |\r?$)/gm))result[match[1]]++;
 return result;
}
export function observeLiveConnection(connection,{event=()=>{},now=Date.now}={}){
 const started=now(),listeners=[],seenChannels=new WeakSet();let pc,channel,closed=false;
 const value={candidates:0,remoteCandidates:0,candidateEvents:0,emptyCandidateEvents:0,statsLocalCandidates:0,statsRemoteCandidates:0,candidateTypes:counts(),remoteCandidateTypes:counts(),iceErrorCodes:[],statsSamples:0,statsError:null,errorType:null};
 const snapshot=()=>{
  const local=descriptionCounts(pc?.localDescription),remote=descriptionCounts(pc?.remoteDescription);
  const candidateTypes=Object.fromEntries(types.map(t=>[t,Math.max(value.candidateTypes[t],local[t])])),remoteCandidateTypes=Object.fromEntries(types.map(t=>[t,Math.max(value.remoteCandidateTypes[t],remote[t])]));
  let config;try{config=pc?.getConfiguration?.();}catch{}
  return {...value,localSdpCandidates:Object.values(local).reduce((a,b)=>a+b,0),remoteSdpCandidates:Object.values(remote).reduce((a,b)=>a+b,0),candidateTypes,remoteCandidateTypes,candidates:Math.max(value.candidates,Object.values(candidateTypes).reduce((a,b)=>a+b,0)),remoteCandidates:Math.max(value.remoteCandidates,Object.values(remoteCandidateTypes).reduce((a,b)=>a+b,0)),iceErrorCodes:[...value.iceErrorCodes],elapsedMs:Math.max(0,now()-started),connection:safe(pc?.connectionState),ice:safe(pc?.iceConnectionState),gathering:safe(pc?.iceGatheringState),signaling:safe(pc?.signalingState),localDescription:!!pc?.localDescription,remoteDescription:!!pc?.remoteDescription,channelState:safe(channel?.readyState),channelOpen:!!connection.open&&(!channel||channel.readyState==='open'),applied:!!connection._syncReady,configuration:summarizeIceConfiguration(config),candidateEvidence:'events + SDP type counts + getStats; remote count is lower bound'};
 };
 const emit=name=>{if(!closed)event(name,snapshot());};
 const listen=(target,type,fn)=>{if(target?.addEventListener){target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));}};
 const bindChannel=dc=>{if(!dc||seenChannels.has(dc))return;channel=dc;seenChannels.add(dc);for(const type of ['open','close','error'])listen(dc,type,()=>emit('rtc-datachannel-'+type));emit('rtc-datachannel-observed');};
 const bind=()=>{
  if(closed)return;
  const next=connection.peerConnection;
  if(next&&next!==pc){
   pc=next;
   for(const type of ['signalingstatechange','iceconnectionstatechange','icegatheringstatechange','connectionstatechange'])listen(pc,type,()=>emit('rtc-'+type));
   listen(pc,'icecandidate',e=>{if(e.candidate){value.candidateEvents++;value.candidates++;if(types.includes(e.candidate.type))value.candidateTypes[e.candidate.type]++;}else value.emptyCandidateEvents++;emit('rtc-candidate-count');});
   listen(pc,'icecandidateerror',e=>{if(Number.isInteger(e.errorCode)&&!value.iceErrorCodes.includes(e.errorCode)&&value.iceErrorCodes.length<16)value.iceErrorCodes.push(e.errorCode);emit('rtc-candidate-error');});
   listen(pc,'datachannel',e=>bindChannel(e.channel));emit('rtc-observed');
  }
  bindChannel(connection.dataChannel);
 };
 const read=()=>{bind();return snapshot();};
 let sampling=false;
 const sample=async()=>{
  bind();if(closed||sampling||!pc?.getStats)return;sampling=true;
  try{const before=value.statsLocalCandidates+':'+value.statsRemoteCandidates,stats=await pc.getStats();if(closed)return;const local=counts(),remote=counts();for(const stat of stats.values()){
   if(stat.type==='local-candidate'&&types.includes(stat.candidateType))local[stat.candidateType]++;
   if(stat.type==='remote-candidate'&&types.includes(stat.candidateType))remote[stat.candidateType]++;
  }for(const t of types){value.candidateTypes[t]=Math.max(value.candidateTypes[t],local[t]);value.remoteCandidateTypes[t]=Math.max(value.remoteCandidateTypes[t],remote[t]);}value.statsLocalCandidates=Object.values(local).reduce((a,b)=>a+b,0);value.statsRemoteCandidates=Object.values(remote).reduce((a,b)=>a+b,0);value.statsSamples++;value.statsError=null;if(before!==value.statsLocalCandidates+':'+value.statsRemoteCandidates)emit('rtc-candidate-stats');}
  catch(error){if(!closed)value.statsError=safe(error?.name)||'unavailable';}finally{sampling=false;}
 };
 const onError=error=>{value.errorType=safe(error?.type);emit('rtc-error');};
 if(connection.on){for(const [type,fn] of [['open',()=>{bind();emit('rtc-channel-open');}],['close',()=>emit('rtc-channel-close')],['error',onError]]){connection.on(type,fn);listeners.push(()=>connection.off?.(type,fn));}}
 bind();void sample();const poll=setInterval(()=>{bind();void sample();},500);
 return {read,sample,close:()=>{closed=true;clearInterval(poll);for(const remove of listeners)remove();listeners.length=0;}};
}
