import {CINEMATIC_BUILD,cinematicEnvironment,safeEnvironment,safeBuild,cinematicFailure,safeErrorType} from './cinematic-compat.js?v=live01b4';
export const CINEMATIC_REMOTE_BUILD='live01b4';
import {isCinematic,cinematicMediaIds,CINEMATIC_COMPOSITION_BYTES,cinematicTotal} from './cinematic-model.js?v=live01b4';
import {sceneSpan} from './cinematic-timing.js?v=live01b4';
import {imageKey,validateCompositionMedia} from './cinematic-media.js?v=live01b4';
const key=v=>typeof v==='string'&&/^[\w-]{1,128}$/.test(v);
const statuses=new Set(['preparando','aguardando','pronto','fullscreen','lento','bloqueado','conectado','recebendo','carregando','apresentando','falhou','encerrando','encerrado']);
const mime=new Set(['image/png','image/jpeg','image/webp','video/webm']);
const bytes64=bytes=>btoa(String.fromCharCode(...bytes));
const from64=text=>{const binary=atob(text),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;};
export const publicCinematic=item=>({...structuredClone(item),...(item.layers?{layers:item.layers.filter(l=>l.visible).map(l=>structuredClone(l))}:{})});
export const hostChallenge=(nonce,campaign,room,session)=>JSON.stringify({nonce,campaign,room,session});
export async function createHostProof(register,room){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);await register(room,publicKey);
 return async text=>bytes64(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(text))));
}
export async function verifyHostProof(publicKey,text,signature){
 if(!publicKey||publicKey.kty!=='EC'||publicKey.crv!=='P-256'||publicKey.d||typeof signature!=='string'||signature.length>256)return false;
 try{const imported=await crypto.subtle.importKey('jwk',publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},imported,from64(signature),new TextEncoder().encode(text));}catch{return false;}
}
export function validateManifest(message){
 if(!key(message.sid)||!Number.isSafeInteger(message.revision)||message.revision<1||!isCinematic(message.item)||!Array.isArray(message.assets)||!Number.isFinite(message.startedAt))return false;
 const ids=cinematicMediaIds(message.item);
 return ids.length===message.assets.length&&new Set(message.assets.map(a=>a.id)).size===ids.length&&message.assets.every(a=>ids.includes(a.id)&&mime.has(a.type)&&Number.isInteger(a.size)&&a.size>0&&a.size<=(a.type==='video/webm'?8:12)*1024*1024)&&message.assets.reduce((sum,a)=>sum+a.size,0)<=CINEMATIC_COMPOSITION_BYTES&&!(message.item.layers||[]).some(l=>!l.visible);
}
export class RemoteCinematics{
 constructor({Wire,frame,bridge,changed=()=>{},now=Date.now,presentation=null,lead=800,prepareTimeout=20000}){
  Object.assign(this,{Wire,frame,bridge,changed,now,presentation,lead,prepareTimeout});this.peers=new Map();this.cache=new Map();this.revision=0;this.watermark=0;this.generation=0;
  this.events=[];this.hostFailure=null;
  this.lease=setInterval(()=>{if(this.pending&&this.now()-this.pending.lastSeen>45000)void this.endClient('expired',true);},5000);
 }
 trace(peer,phase,code=''){if(peer)peer.phase=phase;this.events.push({at:this.now(),phase,...(code?{code}:{})});if(this.events.length>80)this.events.shift();}
 diagnostics(){return {build:CINEMATIC_BUILD,environment:cinematicEnvironment(),hostReady:!!this.sign,hostFailure:this.hostFailure,active:!!this.active,coordination:this.active?{phase:this.active.phase,startAt:this.active.startAt||null,local:this.active.metrics,canProceed:!!this.active.canProceed}:this.lastCoordination||null,peers:[...this.peers.values()].map(p=>({id:p.connection._identity||p.connection.peer||'unknown',phase:p.phase,failurePhase:p.failurePhase||null,errorType:p.errorType||null,build:safeBuild(p.connection._cinematicBuild),environment:p.environment||null,status:p.status,code:p.code||null,verified:p.verified,boardSynced:!!p.connection._syncReady,metrics:p.metrics||{},version:p.connection._cinematicVersion||1})),events:this.events.slice()};}
 notify(){this.changed([...this.peers.values()].map(p=>({id:p.connection._identity||p.connection.peer,name:String(p.connection._name||'Jogador').slice(0,80),status:p.status,label:({conectado:'Conectado',preparando:'Preparando apresentação',aguardando:'Aguardando preparo do jogador',pronto:'Mídia pronta',fullscreen:'Preparando tela',lento:'Demorando · mestre pode prosseguir',bloqueado:'Reprodução bloqueada · aguardando recuperação',recebendo:'Recebendo mídia',carregando:'Carregando apresentação',apresentando:'Apresentando',falhou:p.code==='legacy-client'?'Atualização necessária':'Falhou',encerrando:'Encerrando',encerrado:'Encerrado'})[p.status]+(p.status==='apresentando'&&p.metrics?.videoFallbacks?' · WebM em fallback estático':''),error:p.error||'',code:p.code||null})));this.checkCompletion();this.maybeStart();}
 state(peer,status,error=''){if(peer.status===status&&peer.error===error)return;peer.status=status;peer.error=error;this.notify();}
 fail(peer,code,text=cinematicFailure(code),error){peer.errorType=error?safeErrorType(error):null;peer.failurePhase=peer.phase;peer.code=code;this.trace(peer,'failed',code);this.state(peer,'falhou',text);if(peer.live.role==='client')this.control(peer,'failure',{code,phase:peer.failurePhase,errorType:peer.errorType,environment:cinematicEnvironment(),sid:this.pending?.sid||null});}
 refresh(){for(const peer of this.peers.values())if(peer.live.role==='host'&&peer.verified&&this.active&&!peer.run&&peer.offered!==this.active.sid&&peer.connection._syncReady!==false)void this.offer(peer,this.active);}
 waitForCompletion(){
  if(!this.operation&&!this.active)return Promise.resolve();
  return new Promise(resolve=>{this.completion??=new Set();const entry={resolve};this.completion.add(entry);this.checkCompletion();});
 }
 checkCompletion(){
  if(this.operation)return;
  const waiting=!!this.active&&[...this.peers.values()].some(p=>p.live.role==='host'&&(p.run===this.active||p.expected===this.active.sid)&&!['encerrado','falhou'].includes(p.status));
  if(waiting)return;
  for(const entry of this.completion||[])entry.resolve();this.completion?.clear();
 }
 async prepareHost(room){
  this.stop(true);this.sign=null;const generation=this.hostGeneration=(this.hostGeneration||0)+1;
  try{const sign=await createHostProof((r,jwk)=>this.bridge.registerLiveHost(r,jwk),room);if(this.hostGeneration!==generation)return;this.sign=sign;this.hostError='';this.hostFailure=null;this.trace(null,'host-key-registered');this.notify();return true;}
  catch(error){if(this.hostGeneration!==generation)return false;this.sign=null;const cause=/^(?:42501|PGRST\d+)$/.test(error?.code||'')?error.code:'host-registration-failed';this.hostFailure={phase:'host-key-registration',code:cause};this.trace(null,'host-key-registration',cause);this.hostError='Cinematics indisponíveis: não foi possível validar o mestre nesta campanha. Confira o acesso e reabra a mesa.';this.notify();return false;}
 }
 control(peer,kind,fields={}){
  if(peer.closed||!peer.connection.open||!peer.connection._session)return;
  try{const packet={...fields,cinematic:1,kind,campaign:peer.live.campaign,room:peer.live.code,session:peer.connection._session};if(JSON.stringify(packet).length>32768){this.fail(peer,'manifest-too-large','A apresentação excede o limite de instruções. Simplifique a composição.');return false;}peer.connection.send(packet);return true;}catch{this.state(peer,'falhou','A conexão foi interrompida.');}
 }
 bind(connection,live){
  const peer={connection,live,status:'conectado',phase:'connected',verified:false,closed:false};this.peers.set(connection,peer);this.notify();
  if(connection._legacy||connection._cinematicVersion!==undefined&&connection._cinematicVersion<4){peer.incompatible=true;this.fail(peer,'legacy-client','Este cliente precisa atualizar o CRIS para receber Cinematics.');return;}
  if(live.role==='client'&&!globalThis.crypto?.subtle){this.fail(peer,'crypto-unavailable');return;}
  if(live.role==='client'){this.watermark=0;peer.nonce=crypto.randomUUID();this.control(peer,'challenge',{nonce:peer.nonce});peer.proofTimer=setTimeout(()=>{if(!peer.verified)this.fail(peer,'host-proof-timeout','O mestre não confirmou a apresentação. Atualize os dois aparelhos e reabra a mesa.');},15000);}
 }
 packet(packet,connection){
  const peer=this.peers.get(connection);if(!peer)return false;if(peer.incompatible)return packet?.lane==='cinematic'||packet?.cinematic===1;
  if(packet?.lane==='cinematic'){
   if(peer.verified&&peer.wire)peer.wire.handle(packet);return true;
  }
  if(packet?.cinematic!==1)return false;
  if(peer.closed||packet.session!==connection._session||packet.campaign!==peer.live.campaign||packet.room!==peer.live.code||JSON.stringify(packet).length>32768)return true;
  void this.handle(peer,packet).catch(error=>{if(error?.name==='AbortError'||peer.closed)return;this.fail(peer,'presentation-failed','Não foi possível carregar a apresentação. Consulte o diagnóstico da mesa.');if(this.pending?.peer===peer)void this.endClient('failed',true);});return true;
 }
 async handle(peer,m){
  const host=peer.live.role==='host';
  if(host){
   if(m.kind==='clock'&&Number.isFinite(m.sent)){this.control(peer,'clock-result',{sent:m.sent,hostNow:this.now()});return;}
   if(m.kind==='clock-sample'&&Number.isFinite(m.rtt)&&m.rtt>=0&&m.rtt<=5000){peer.rtt=m.rtt;return;}
   if(m.kind==='failure'){if(m.sid&&m.sid!==peer.expected)return;const code=/^[a-z-]{1,64}$/.test(m.code||'')?m.code:'client-failed';this.fail(peer,code,cinematicFailure(code),m.errorType?{name:m.errorType}:null);peer.environment=safeEnvironment(m.environment)||peer.environment;if(/^[a-z-]{1,64}$/.test(m.phase||''))peer.failurePhase=m.phase;return;}
   if(m.kind==='challenge'&&key(m.nonce)){
    if(!this.sign){this.control(peer,'unavailable');this.state(peer,'falhou',this.hostError||'Reabra o compartilhamento.');return;}
    this.trace(peer,'host-proof-signing');const signature=await this.sign(hostChallenge(m.nonce,m.campaign,m.room,m.session));
    this.trace(peer,'host-proof-sent');this.control(peer,'proof',{nonce:m.nonce,signature,hostNow:this.now()});return;
   }
   if(m.kind==='verified'){peer.environment=safeEnvironment(m.environment);peer.verified=true;this.trace(peer,'host-proof-confirmed');this.refresh();return;}
   if(m.kind==='need'&&peer.run?.sid===m.sid&&Array.isArray(m.ids)&&m.ids.length<=27&&new Set(m.ids).size===m.ids.length&&m.ids.every(id=>peer.run.assets.some(a=>a.id===id))){
    if(peer.sending)return;peer.sending=true;this.trace(peer,'media-requested');this.state(peer,'recebendo');void this.transfer(peer,peer.run,m.ids);return;
   }
   if(m.kind==='ready'&&peer.run?.sid===m.sid&&peer.transferred&&!peer.ready){peer.ready=true;peer.metrics={...peer.metrics,...this.safeMetrics(m.metrics),readyAt:this.now()};this.trace(peer,'receiver-ready');this.state(peer,'pronto');if(peer.run.startAt)this.playPeer(peer,peer.run);else this.maybeStart();return;}
   if(m.kind==='state'&&(!peer.expected||peer.expected===m.sid)&&(peer.run?.sid===m.sid||!peer.run&&peer.ending===m.sid)&&statuses.has(m.status)){
    if(m.status==='encerrado'){peer.ending=null;if(peer.run){peer.run.completed??=new Set();peer.run.completed.add(peer.connection._identity||peer.connection.peer||peer.connection);}}if(m.status==='falhou'){peer.run=null;peer.wire?.close();}peer.metrics={...peer.metrics,...this.safeMetrics(m.metrics)};if(m.status!=='falhou')this.trace(peer,'participant-'+m.status);this.state(peer,m.status,m.status==='falhou'?cinematicFailure(peer.code):'');if(['apresentando','falhou','encerrando','encerrado'].includes(m.status))clearTimeout(peer.timeout);if(m.status==='apresentando'){peer.metrics.startSkewMs=Number.isFinite(m.actualAt)?m.actualAt-peer.run.startAt:null;peer.run.started??=new Map();if(!peer.run.started.has(peer.connection._identity||peer.connection.peer||peer.connection))peer.run.started.set(peer.connection._identity||peer.connection.peer||peer.connection,peer.run.startAt);}this.checkCompletion();return;
   }
   // Incoming client start/stop/media commands never reach the player or other peers.
   return;
  }
  if(m.kind==='clock-result'&&Number.isFinite(m.sent)&&Number.isFinite(m.hostNow)){const rtt=this.now()-m.sent;if(rtt>=0&&rtt<=5000){peer.clockOffset=this.now()-rtt/2-m.hostNow;peer.rtt=rtt;this.control(peer,'clock-sample',{rtt});}return;}
  if(m.kind==='unavailable'){this.state(peer,'falhou','O mestre precisa reabrir o compartilhamento para habilitar Cinematics.');return;}
  if(m.kind==='proof'&&m.nonce===peer.nonce&&!peer.verified){
   this.trace(peer,'host-key-reading');let publicKey;try{publicKey=await this.bridge.liveHostKey(peer.live.code);}catch{this.fail(peer,'host-key-unavailable','Não foi possível validar a chave da mesa. Peça ao mestre para reabrir o compartilhamento.');return;}
   const valid=await verifyHostProof(publicKey,hostChallenge(peer.nonce,m.campaign,m.room,m.session),m.signature);
   if(peer.closed)return;
   if(!valid){this.fail(peer,'host-proof-invalid','A identidade do mestre não foi confirmada. Reabra a mesa e tente novamente.');return;}
   peer.verified=true;this.trace(peer,'host-proof-verified');peer.clockOffset=Number.isFinite(m.hostNow)?this.now()-m.hostNow:0;clearTimeout(peer.proofTimer);this.control(peer,'verified',{environment:cinematicEnvironment()});this.control(peer,'clock',{sent:this.now()});this.state(peer,'conectado');return;
  }
  if(!peer.verified)return;
  if(m.kind==='prepare'){
   if(m.revision<=this.watermark)return;if(!validateManifest(m)){this.fail(peer,'manifest-invalid');return;}peer.code=null;peer.failurePhase=null;peer.errorType=null;
   this.pending?.controller?.abort();await this.presentation?.end();if(peer.closed||m.revision<=this.watermark)return;
   this.trace(peer,'manifest-received');this.watermark=m.revision;const generation=++this.generation;
   await this.frame.clear({immediate:true});if(peer.closed||generation!==this.generation)return;
   this.pending={...m,peer,lastSeen:this.now(),generation,controller:new AbortController()};
   this.pending.metrics={commandMs:Math.max(0,this.now()-(peer.clockOffset||0)-(m.offeredAt||this.now())),bytes:0,integrityMs:0};this.pending.receivedAt=this.now();
   this.trace(peer,'receiver-setup');try{await this.presentation?.begin({frame:this.frame,signal:this.pending.controller.signal});}catch(error){if(error?.name==='AbortError')return;this.fail(peer,'receiver-setup-failed',cinematicFailure('receiver-setup-failed'),error);await this.endClient('failed',true);return;}if(peer.closed||generation!==this.generation)return;clearTimeout(this.cacheTimer);
   this.makeWire(peer,m.sid);this.evict(m.assets);
   for(const a of m.assets){const cached=this.cache.get(a.id);if(cached&&(cached.type!==a.type||cached.size!==a.size))this.cache.delete(a.id);}
   const ids=m.assets.filter(a=>!this.cache.has(a.id)).map(a=>a.id);
   this.state(peer,'recebendo');this.control(peer,'need',{sid:m.sid,ids});return;
  }
  if(m.kind==='stop'&&Number.isSafeInteger(m.revision)&&m.revision>=this.watermark){
   this.watermark=m.revision;await this.endClient('manual',m.immediate===true);return;
  }
  if(!this.pending||this.pending.sid!==m.sid)return;
  if(m.kind==='heartbeat'){this.pending.lastSeen=this.now();return;}
  if(m.kind==='media-complete'){await this.prepareClient(this.pending);return;}
  if(m.kind==='play'&&this.pending.prepared&&Number.isFinite(m.startAt)){this.pending.startAt=m.startAt;await this.playClient(this.pending);}else if(m.kind==='play')this.trace(peer,'play-before-ready','protocol-order');
 }
 evict(assets){const allowed=new Set(assets.map(a=>a.id));let count=new Set([...this.cache.keys(),...assets.map(a=>a.id)]).size;let budget=assets.reduce((n,a)=>n+a.size,0)+[...this.cache].filter(([id])=>!allowed.has(id)).reduce((n,[,b])=>n+b.size,0);for(const [id,blob] of this.cache)if(!allowed.has(id)&&(budget>CINEMATIC_COMPOSITION_BYTES||count>64)){this.cache.delete(id);budget-=blob.size;count--;}}
 makeWire(peer,sid){
  peer.wire?.close();peer.sending=false;
  const connection={get open(){return peer.connection.open&&!peer.closed;},send:packet=>peer.connection.send({...packet,lane:'cinematic'})};
  peer.wire=new this.Wire({connection,sendWindow:4,scope:peer.live.campaign+':'+peer.live.code+':cinematic',session:peer.connection._session+':'+sid,
   receive:message=>this.receiveAsset(peer,message),fail:()=>{if(!peer.closed){this.fail(peer,'media-transfer-failed','A mídia não chegou íntegra ou a transferência demorou demais.');if(peer.live.role==='client')void this.endClient('failed',true);}}});
 }
 async present(item,asset,{prepareLocal=async()=>true,startLocal=async()=>true,countdownLocal=()=>{}}={}){
  this.stop(true);const revision=++this.revision,operation={revision};this.operation=operation;
  try{
   if(!isCinematic(item))throw Error('Apresentação inválida');
   const projected=publicCinematic(item),source=asset instanceof Blob?{[item.imageId]:asset}:asset;
   const media=Object.fromEntries(cinematicMediaIds(projected).map(id=>[id,source[id]]));
   await validateCompositionMedia(projected,media);if(this.operation!==operation)return;
   const run=this.active={sid:crypto.randomUUID(),revision,item:projected,media,assets:Object.entries(media).map(([id,b])=>({id,type:b.type,size:b.size})),offeredAt:this.now(),startedAt:this.now(),completed:new Set(),started:new Map(),phase:'preparando',metrics:{},startLocal,countdownLocal,localReady:false};
   run.begun=new Promise(resolve=>run.resolve=resolve);
   for(const peer of this.peers.values())if(peer.live.role==='host'){
    peer.ready=false;peer.expected=run.sid;
    if(peer.verified&&peer.connection._syncReady!==false)void this.offer(peer,run);else if(peer.verified)this.state(peer,'preparando','Aguardando sincronização do quadro.');else if(!peer.incompatible&&peer.status!=='falhou')this.state(peer,'aguardando');else if(peer.incompatible)this.state(peer,'falhou','Atualize o CRIS do jogador para receber a apresentação.');
   }
   this.operation=null;this.checkCompletion();
   run.timeout=setTimeout(()=>{if(this.active===run&&!run.startAt){run.canProceed=true;run.phase='aguardando';for(const peer of this.peers.values())if(peer.expected===run.sid&&!peer.ready&&!['falhou','encerrado'].includes(peer.status))peer.status='lento';this.notify();}},this.prepareTimeout);
   void (async()=>{try{const begin=this.now();const ready=await prepareLocal();if(this.active!==run)return;if(!ready)throw Error('Local prepare failed');run.metrics.prepareMs=this.now()-begin;run.localReady=true;this.maybeStart();}catch{if(this.active===run){run.phase='falhou';run.resolve(false);this.stop(true);this.hostError='Não foi possível preparar a apresentação local.';this.notify();}}})();
   this.heartbeat=setInterval(()=>{for(const peer of this.peers.values())if(peer.run===run)this.control(peer,'heartbeat',{sid:run.sid});},4000);return run;
  }catch{if(this.operation===operation){this.operation=null;this.checkCompletion();for(const peer of this.peers.values())this.state(peer,'falhou','A composição não pôde ser preparada para transmissão.');}}
 }
 safeMetrics(value){const result={};for(const key of ['commandMs','bytes','decodeBase64Ms','integrityMs','transferMs','prepareMs','firstFrameMs','readyToPlayMs','imageMs','videoMs','videoFallbacks'])if(Number.isFinite(value?.[key])&&value[key]>=0&&value[key]<=1e9)result[key]=Math.round(value[key]*100)/100;return result;}
 maybeStart(){
  const run=this.active;if(!run||run.startAt||!run.localReady)return;
  const peers=[...this.peers.values()].filter(p=>p.live.role==='host'&&p.expected===run.sid);
  if(!run.proceed&&peers.some(p=>!p.ready&&!['falhou','encerrado'].includes(p.status)))return;
  const rtt=Math.max(0,...peers.map(p=>p.rtt||0));run.startAt=this.now()+Math.max(this.lead,Math.min(2000,rtt*1.5+100));run.startedAt=run.startAt;run.phase='agendado';run.canProceed=false;clearTimeout(run.timeout);
  for(const peer of peers)if(peer.ready)this.playPeer(peer,run);
  run.countdownLocal(Math.max(0,run.startAt-this.now()));this.notify();run.startTimer=setTimeout(async()=>{
   if(this.active!==run)return;
   try{const shown=await run.startLocal(Math.max(0,(this.now()-run.startAt)/1000));if(this.active!==run)return;if(!shown)throw Error('Local play failed');run.metrics.startSkewMs=this.now()-run.startAt;run.phase='apresentando';run.resolve(true);this.notify();}catch{if(this.active===run){run.phase='falhou';run.resolve(false);this.hostError='Não foi possível iniciar a apresentação local.';this.stop(true);this.notify();}}
  },Math.max(0,run.startAt-this.now()));
 }
 proceed(){const run=this.active;if(!run?.canProceed||!run.localReady)return false;run.proceed=true;this.maybeStart();return true;}
 playPeer(peer,run){if(peer.playSent||!run.startAt)return;peer.playSent=true;this.control(peer,'play',{sid:run.sid,startAt:run.startAt});}
 waitStart(pending,delay){return new Promise((resolve,reject)=>{const signal=pending.controller?.signal,abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelado','AbortError'));},timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},delay);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});}
 async offer(peer,run){
  if(peer.closed||this.active!==run)return;const identity=peer.connection._identity||peer.connection.peer||peer.connection;if(run.completed?.has(identity)){this.state(peer,'encerrado');return;}peer.code=null;peer.failurePhase=null;peer.errorType=null;peer.transferred=false;peer.playSent=false;peer.ready=false;peer.expected=run.sid;peer.metrics={offeredAt:this.now(),totalBytes:run.assets.reduce((n,a)=>n+a.size,0)};peer.offered=run.sid;peer.run=run;this.trace(peer,'manifest-sent');this.state(peer,'preparando');peer.ending=null;this.makeWire(peer,run.sid);
  this.control(peer,'prepare',{sid:run.sid,revision:run.revision,item:run.item,assets:run.assets,startedAt:run.startedAt,offeredAt:this.now()});
  clearTimeout(peer.timeout);peer.timeout=setTimeout(()=>{if(peer.run===run){peer.run=null;peer.wire?.close();this.control(peer,'stop',{sid:run.sid,revision:run.revision,immediate:true});this.state(peer,'falhou','O jogador não confirmou a apresentação no prazo.');}},180000);
 }
 async transfer(peer,run,ids){
  try{
   const begin=this.now();peer.metrics.bytes=0;peer.metrics.reused=run.assets.length-ids.length;peer.metrics.base64Ms=0;
   for(const id of ids){
    if(peer.closed||peer.run!==run||this.active!==run)return;
    const encodeBegin=this.now(),blob=run.media[id],bytes=new Uint8Array(await blob.arrayBuffer()),parts=[];
    for(let i=0;i<bytes.length;i+=24576){if(peer.run!==run||this.active!==run)return;parts.push(bytes64(bytes.subarray(i,i+24576)));if(i% (24576*32)===0)await new Promise(resolve=>setTimeout(resolve,0));}
    if(peer.run!==run||this.active!==run)return;
    peer.metrics.bytes+=blob.size;peer.metrics.base64Ms+=this.now()-encodeBegin;
    await peer.wire.send({t:'cinematic-asset',sid:run.sid,id,type:blob.type,base64:parts.join('')});
   }
   if(peer.run===run&&this.active===run){peer.transferred=true;peer.metrics.transferMs=this.now()-begin;peer.metrics.applicationChars=peer.wire.stats.bytes;peer.metrics.maxInFlight=peer.wire.stats.maxInFlight;this.state(peer,'aguardando');this.control(peer,'media-complete',{sid:run.sid});}
  }catch{if(peer.run===run&&this.active===run){peer.run=null;peer.wire?.close();this.control(peer,'stop',{sid:run.sid,revision:run.revision,immediate:true});this.state(peer,'falhou','A transferência da mídia falhou.');}}
  finally{if(peer.run===run)peer.sending=false;}
 }
 async receiveAsset(peer,message){
  const pending=this.pending,entry=pending?.assets.find(a=>a.id===message.id);
  if(peer.live.role!=='client'||!peer.verified||pending?.peer!==peer||pending.sid!==message.sid||message.t!=='cinematic-asset'||!entry||entry.type!==message.type||typeof message.base64!=='string'||message.base64.length!==4*Math.ceil(entry.size/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(message.base64))throw Error('Mídia não solicitada ou inválida');
  const begin=this.now(),blob=new Blob([from64(message.base64)],{type:entry.type});
  const decodeMs=this.now()-begin,hashBegin=this.now();if(blob.size!==entry.size||await imageKey(blob)!==entry.id)throw Error('Integridade da mídia inválida');
  if(!this.current(pending))return;
  pending.metrics.decodeBase64Ms=(pending.metrics.decodeBase64Ms||0)+decodeMs;pending.metrics.integrityMs+=this.now()-hashBegin;pending.metrics.bytes+=blob.size;this.trace(peer,'media-validated');this.cache.set(entry.id,blob);if([...this.cache.values()].reduce((sum,b)=>sum+b.size,0)>CINEMATIC_COMPOSITION_BYTES)throw Error('Limite de mídia excedido');
 }
 current(pending){return this.pending===pending&&pending.generation===this.generation&&!pending.controller?.signal.aborted;}
 async prepareClient(pending){
  if(!this.current(pending)||pending.preparing)return;pending.preparing=true;const {peer,item}=pending;
  pending.metrics.transferMs=this.now()-pending.receivedAt;const prepareBegin=this.now();this.trace(peer,'receiver-preparing');this.state(peer,'carregando');this.control(peer,'state',{sid:pending.sid,status:'carregando'});
  try{
   pending.media=Object.fromEntries(pending.assets.map(a=>[a.id,this.cache.get(a.id)]));await validateCompositionMedia(item,pending.media);if(!this.current(pending))return;
   const asset=item.layers?.length||item.backgroundVideo?pending.media:pending.media[item.imageId];
   if(this.frame.prepare&&!await this.frame.prepare(asset,item,()=>{if(this.current(pending))void this.endClient('automatic',true);}))throw Error('Player recusou o preparo');
   if(!this.current(pending))return;pending.prepared=true;pending.readyAt=this.now();pending.metrics.prepareMs=this.now()-prepareBegin;pending.metrics.firstFrameMs=this.now()-pending.receivedAt;Object.assign(pending.metrics,this.frame.metrics||{});this.presentation?.ready();this.trace(peer,'media-ready');this.state(peer,'pronto');this.control(peer,'ready',{sid:pending.sid,metrics:pending.metrics});
  }catch(error){if(this.current(pending)&&error?.name!=='AbortError'){this.fail(peer,'media-prepare-failed',cinematicFailure('media-prepare-failed'),error);await this.endClient('failed',true);}}
 }
 async playClient(pending){
  if(!this.current(pending)||pending.playing)return;pending.playing=true;
  const {peer,item}=pending;
  try{
   if(!pending.prepared){await this.prepareClient(pending);if(!this.current(pending))return;}
   const start=async()=>{
    if(!this.current(pending))return false;
    const offset=Number.isFinite(pending.startAt)?Math.max(0,(this.now()-(peer.clockOffset||0)-pending.startAt)/1000):Number.isFinite(pending.offset)?Math.max(0,pending.offset):0;
    if(item.ending!=='loop'&&Number.isFinite(pending.startAt)&&offset>=cinematicTotal(item)){await this.endClient('automatic',true);return false;}
    this.trace(peer,'player-loading');
    const shown=this.frame.startPrepared?await this.frame.startPrepared():await this.frame.show(item.layers?.length||item.backgroundVideo?pending.media:pending.media[item.imageId],item,()=>{if(this.current(pending))void this.endClient('automatic',true);});
    if(!this.current(pending))return false;if(!shown)throw Error('Player recusou a apresentação');
    const position=Number.isFinite(pending.startAt)?Math.max(0,(this.now()-(peer.clockOffset||0)-pending.startAt)/1000):offset;this.frame.seek(item.ending==='loop'?position%sceneSpan(item):Math.min(position,Math.max(0,cinematicTotal(item)-.1)));return true;
   };
   if(Number.isFinite(pending.startAt)){const delay=Math.max(0,pending.startAt+(peer.clockOffset||0)-this.now());this.presentation?.countdown?.(delay);await this.waitStart(pending,delay);if(!this.current(pending))return;}
   const shown=this.presentation?await this.presentation.start(start,{signal:pending.controller.signal}):await start();
   if(!this.current(pending))return;if(!shown)throw Error('Player não iniciou');
   this.trace(peer,'player-started');this.state(peer,'apresentando');pending.metrics.readyToPlayMs=this.now()-(pending.readyAt||this.now());this.control(peer,'state',{sid:pending.sid,status:'apresentando',actualAt:this.now()-(peer.clockOffset||0),metrics:pending.metrics});
  }catch(error){if(this.current(pending)&&error?.name!=='AbortError'){this.fail(peer,'player-start-failed',cinematicFailure('player-start-failed'),error);await this.endClient('failed',true);}}
 }
 async endClient(reason,immediate=false){
  const pending=this.pending;this.pending=null;this.generation=(this.generation||0)+1;const generation=this.generation;
  if(pending){pending.controller?.abort();pending.peer.wire?.close();this.state(pending.peer,reason==='failed'?'falhou':'encerrando',reason==='failed'?cinematicFailure(pending.peer.code):'');}
  await this.frame.clear({immediate});if(this.generation!==generation)return;await this.presentation?.end();if(this.generation!==generation)return;
  if(pending){if(reason!=='failed')this.trace(pending.peer,'player-ended');const status=reason==='failed'?'falhou':'encerrado';this.state(pending.peer,status,reason==='failed'?cinematicFailure(pending.peer.code):'');this.control(pending.peer,'state',{sid:pending.sid,status});}
  if(reason==='failed')this.presentation?.failure();
  clearTimeout(this.cacheTimer);if(!this.closed)this.cacheTimer=setTimeout(()=>this.cache.clear(),30000);
 }
 stop(immediate=false){
  const run=this.active;this.operation=null;this.active=null;if(run){this.lastCoordination={phase:run.startAt?'encerrado':'cancelado',startAt:run.startAt||null,local:{...run.metrics},canProceed:false};clearTimeout(run.timeout);clearTimeout(run.startTimer);run.resolve?.(false);}this.checkCompletion();clearInterval(this.heartbeat);const revision=++this.revision;
  for(const peer of this.peers.values())if(peer.live.role==='host'){
   const run=peer.run;if(!run||['encerrado','falhou'].includes(peer.status)){peer.run=null;peer.wire?.close();clearTimeout(peer.timeout);peer.ending=null;continue;}peer.run=null;peer.ending=run.sid;peer.wire?.close();clearTimeout(peer.timeout);
   this.control(peer,'stop',{sid:run.sid,revision,immediate});this.state(peer,'encerrando');peer.timeout=setTimeout(()=>{if(!peer.run&&peer.ending===run.sid)this.state(peer,'falhou','O jogador não confirmou o encerramento.');},8000);
  }
 }
 disconnect(connection){const peer=this.peers.get(connection);if(!peer)return;peer.closed=true;peer.wire?.close();clearTimeout(peer.timeout);clearTimeout(peer.proofTimer);this.peers.delete(connection);if(this.pending?.peer===peer)void this.endClient('disconnected',true);this.notify();}
 close(){this.closed=true;this.stop(true);for(const connection of this.peers.keys())this.disconnect(connection);clearInterval(this.lease);clearTimeout(this.cacheTimer);this.cache.clear();void this.presentation?.close();this.checkCompletion();}
}
