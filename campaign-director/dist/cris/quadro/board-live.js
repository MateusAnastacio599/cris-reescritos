export const LIVE_BUILD='directorcinematic02';
import {observeLiveConnection,liveConnectionStage,LIVE_STAGE_TEXT} from './board-live-diagnostics.js';
// LIVE-01A: PeerJS lifecycle and bounded, acknowledged board packets.
// Account IDs in peer metadata are presence claims, NEVER authorization proofs.
const clean=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(value);
// Shared by U() and accepted camcall; input is the already visible board only.
export function boardBounds(items,pins=[],height=item=>item.h||item.w){
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 const include=(x,y,rx=0,ry=0)=>{if(![x,y,rx,ry].every(Number.isFinite))return;left=Math.min(left,x-rx);right=Math.max(right,x+rx);top=Math.min(top,y-ry);bottom=Math.max(bottom,y+ry);};
 for(const item of items){const w=Math.abs(item.w||0),h=Math.abs(height(item)||0),scale=Math.abs(item.scale??1),angle=(item.rot||0)*Math.PI/180;include(item.x,item.y,(Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*h)*scale/2,(Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*h)*scale/2);}
 for(const pin of pins)include(pin.x,pin.y,12,12);
 return Number.isFinite(left)?{left,top,right,bottom}:null;
}
export function fitBoardCamera(bounds,{width,height,padding=36,maxZoom=1.6}){
 if(!bounds||![bounds.left,bounds.top,bounds.right,bounds.bottom,width,height].every(Number.isFinite)||width<=0||height<=0)return null;
 const margin=Math.min(padding,width/5,height/5),z=Math.min(maxZoom,(width-2*margin)/Math.max(1,bounds.right-bounds.left),(height-2*margin)/Math.max(1,bounds.bottom-bounds.top));
 if(!Number.isFinite(z)||z<=0)return null;
 return {z,x:(bounds.left+bounds.right)/2-width/(2*z),y:(bounds.top+bounds.bottom)/2-height/(2*z)};
}
export function fitCameraCall(view,viewport){
 if(!view||![view.x,view.y,view.w,view.h,view.z].every(Number.isFinite)||view.w<=0||view.h<=0||view.z<=0)return null;
 const w=view.w/view.z,h=view.h/view.z;return fitBoardCamera({left:view.x-w/2,right:view.x+w/2,top:view.y-h/2,bottom:view.y+h/2},{...viewport,maxZoom:6});
}
// A tap is not camera intent. In particular, early taps must not cancel the
// initial fit while images/snapshot are still being applied.
export function watchCameraIntent(element,onIntent,ready=()=>true){
 const points=new Map(),end=event=>points.delete(event.pointerId),down=event=>{if(points.size<10)points.set(event.pointerId,{x:event.clientX,y:event.clientY});},move=event=>{const p=points.get(event.pointerId);if(p&&Math.hypot(event.clientX-p.x,event.clientY-p.y)>=8){points.delete(event.pointerId);if(ready())onIntent();}},wheel=()=>{if(ready())onIntent();};
 const events={pointerdown:down,pointermove:move,pointerup:end,pointercancel:end,wheel};for(const [name,fn]of Object.entries(events))element.addEventListener(name,fn,{capture:true,passive:true});
 return ()=>{for(const [name,fn]of Object.entries(events))element.removeEventListener(name,fn,{capture:true});points.clear();};
}
export const LIVE_LIMITS=Object.freeze({chunk:12000,packet:32*1024*1024,asset:24*1024*1024,queue:64,queueChars:64*1024*1024,ack:10000,retries:2,heartbeat:10000,lease:70000,transientQueue:256,transientPoses:1024,transientBatch:96,channelHighWater:256*1024});
export const roomCode=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,32);
export function newRoom(random=crypto){const b=new Uint8Array(12);random.getRandomValues(b);return Array.from(b,n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');}
export function storedRoom(storage,campaign,fresh=false){const key='cris:live:room:'+campaign;let code;try{code=storage.getItem(key);}catch{}if(fresh||!/^[A-Z0-9]{12,32}$/.test(code||''))code=newRoom();try{storage.setItem(key,code);}catch{}return code;}
export async function digest(text){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');}
export const validAsset=value=>typeof value==='string'&&value.length<=LIVE_LIMITS.asset&&/^data:(?:image\/(?:png|jpeg|webp|gif)|audio\/[a-zA-Z0-9.+-]+);base64,[A-Za-z0-9+/=]+$/.test(value);
const ephemeral=new Set(['cur','fx','pose']);
export class LiveWire{
 constructor({connection,scope,session,receive,known=new Map(),remoteAssets={},log=()=>{},fail=()=>{},limits=LIVE_LIMITS,priority=false,now=()=>performance.now(),sendWindow=1,beforeChunk=null}){
  Object.assign(this,{connection,scope,session,receive,known,log,fail,limits,priority,now,beforeChunk});this.sendWindow=Math.max(1,Math.min(4,Number.isInteger(sendWindow)?sendWindow:1));this.inFlight=new Map();this.remoteAssets=new Map(Object.entries(remoteAssets).slice(0,1000));this.queue=[];this.serial=0;this.received=0;this.closed=false;this.inbound=Promise.resolve();this.inboundCount=0;this.bufferedChars=0;this.transients=new Map();this.deferred=new Map();this.replay=new Map();this.transientSequence=0;this.lastTransient=0;this.stats={packets:0,bytes:0,assets:0,reused:0,retries:0,ackMs:0,maxAckMs:0,hashMs:0,maxQueue:0,maxBufferedChars:0,lastTransferMs:0,transientSent:0,transientReceived:0,transientDropped:0,maxInFlight:0};
 }
 raw(message){if(this.closed||!this.connection.open)throw Error('Conexão encerrada');this.connection.send({...message,live:2,scope:this.scope,session:this.session});}
 send(message){
  if(this.closed)return Promise.reject(Error('Conexão encerrada'));
  if(this.priority&&ephemeral.has(message.t))return this.transient(message);
  // v2 compatibility keeps its ACK path and coalesces only the same actor/type.
  if(ephemeral.has(message.t)){
   const pending=this.queue.find(e=>e.message.t===message.t&&e.message.from===message.from);
   if(pending){try{const merged=this.mergeTransient(pending.message,message),size=JSON.stringify(merged).length;
    if(size>this.limits.packet||this.bufferedChars-pending.size+size>this.limits.queueChars)throw Error('Orçamento da fila de sincronização excedido');
    this.bufferedChars+=size-pending.size;pending.message=merged;pending.size=size;return pending.promise;
   }catch(error){this.abort(error);return Promise.reject(error);}}
  }
  if(this.queue.length>=this.limits.queue){const error=Error('Fila de sincronização excedida');this.abort(error);return Promise.reject(error);}
  const size=JSON.stringify(message).length;if(size>this.limits.packet)return Promise.reject(Error('Snapshot acima do limite de transmissão'));
  if(this.bufferedChars+size>(this.limits.queueChars??LIVE_LIMITS.queueChars)){const error=Error('Orçamento da fila de sincronização excedido');this.abort(error);return Promise.reject(error);}
  this.bufferedChars+=size;this.stats.maxBufferedChars=Math.max(this.stats.maxBufferedChars,this.bufferedChars);
  let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});this.queue.push({message:structuredClone(message),id:++this.serial,size,resolve,reject,promise});this.stats.maxQueue=Math.max(this.stats.maxQueue,this.queue.length);void this.pump();return promise;
 }
 async pump(){
  if(this.sending||this.closed)return;this.sending=true;
  try{while(this.queue.length&&!this.closed){
   const entry=this.queue.shift();this.current=entry;const started=this.now();
   try{
    const message={...entry.message},imgs={},hashes=new Map();
    for(const [id,data] of Object.entries(message.imgs||{})){
     if(!clean(id)||!validAsset(data))throw Error('Arquivo inválido ou acima do limite');
     const begin=this.now(),hash=await digest(data);this.stats.hashMs+=this.now()-begin;hashes.set(id,hash);
     if(this.remoteAssets.get(id)!==hash){imgs[id]=data;this.stats.assets++;}else this.stats.reused++;
    }
    if(message.imgs)message.imgs=imgs;
    const text=JSON.stringify(message);
    if(text.length>this.limits.packet)throw Error('Snapshot acima do limite de transmissão');
    const begin=this.now(),hash=await digest(text);this.stats.hashMs+=this.now()-begin;const id=entry.id,total=Math.ceil(text.length/this.limits.chunk);
    // Only Cinematic opts into a bounded 4-fragment window. Ordered durable
    // messages still commit sequentially; final ACK still waits for full SHA/apply.
    for(let start=0;start<total;start+=this.sendWindow){
     if(this.beforeChunk)await this.beforeChunk(message);if(this.closed)throw Error('Conexão encerrada');
     const batch=[];for(let index=start;index<Math.min(total,start+this.sendWindow);index++)batch.push(this.acknowledge({kind:'chunk',id,index,total,length:text.length,hash,data:text.slice(index*this.limits.chunk,(index+1)*this.limits.chunk)}));
     await Promise.all(batch);
    }
    for(const [key,hash] of hashes)this.remoteAssets.set(key,hash);
    this.stats.packets++;this.stats.bytes+=text.length;if(message.t==='full'||Object.keys(imgs).length)this.log(message.t==='full'?'snapshot-sent':'image-sent');this.stats.lastTransferMs=this.now()-started;entry.resolve(true);
   }catch(error){entry.reject(error);this.abort(error);break;}finally{this.bufferedChars=Math.max(0,this.bufferedChars-entry.size);this.current=null;}
  }}finally{this.sending=false;}
 }
 acknowledge(packet){return new Promise((resolve,reject)=>{
  let tries=0,sentAt=this.now();const key=packet.id+':'+packet.index;
  const finish=()=>{clearTimeout(pending.timer);this.inFlight.delete(key);};
  const pending={resolve:()=>{const elapsed=this.now()-sentAt;this.stats.ackMs=elapsed;this.stats.maxAckMs=Math.max(this.stats.maxAckMs,elapsed);finish();resolve();},reject:error=>{finish();reject(error);}};
  this.inFlight.set(key,pending);this.stats.maxInFlight=Math.max(this.stats.maxInFlight,this.inFlight.size);
  const send=()=>{sentAt=this.now();try{this.raw(packet);}catch(error){pending.reject(error);return;}pending.timer=setTimeout(()=>{if(++tries>this.limits.retries)pending.reject(Error('Tempo esgotado aguardando confirmação do quadro'));else{this.stats.retries++;send();}},this.limits.ack);};send();
 });}
 handle(packet){
  if(this.closed||packet?.live!==2||packet.scope!==this.scope||packet.session!==this.session)return false;
  if(packet.kind==='transient'&&this.priority){this.acceptTransient(packet);return true;}
  if(packet.kind==='ack'){this.inFlight.get(packet.id+':'+packet.index)?.resolve();return true;}
  if(packet.kind==='nack'){this.abort(Error('Quadro recusou a sincronização'));return true;}
  if(this.inboundCount>=this.limits.queue){this.abort(Error('Fila de fragmentos recebidos excedida'));return true;}
  this.inboundCount++;this.inbound=this.inbound.then(()=>this.accept(packet)).catch(error=>this.abort(error)).finally(()=>{this.inboundCount--;});return true;
 }
 async accept(packet){
  if(this.closed)return;
  const {id,index,total,length,hash,data}=packet;
  if(packet.kind!=='chunk'||!Number.isSafeInteger(id)||id<1||!Number.isInteger(index)||!Number.isInteger(total)||total<1||total>Math.ceil(this.limits.packet/this.limits.chunk)||index<0||index>=total||!Number.isInteger(length)||length<1||length>this.limits.packet||total!==Math.ceil(length/this.limits.chunk)||!/^\w{64}$/.test(hash)||typeof data!=='string'||data.length!==Math.min(this.limits.chunk,length-index*this.limits.chunk))throw Error('Fragmento inválido');
  // Retry of a committed packet: acknowledge without applying again.
  if(id===this.received){this.raw({kind:'ack',id,index});return;}
  if(id!==this.received+1)throw Error('Sequência inválida');
  if(!this.assembly)this.assembly={id,total,length,hash,chunks:[],size:0};
  const a=this.assembly;if(a.id!==id||a.total!==total||a.hash!==hash||a.length!==length)throw Error('Transferência inconsistente');
  if(index>a.chunks.length)throw Error('Fragmento fora de ordem');
  if(index<a.chunks.length){if(a.chunks[index]!==data)throw Error('Fragmento divergente');this.raw({kind:'ack',id,index});return;}
  a.chunks.push(data);a.size+=data.length;
  if(index===total-1){
   const text=a.chunks.join('');if(a.size!==length||await digest(text)!==hash)throw Error('Integridade do snapshot inválida');
   const message=JSON.parse(text);if(!message||typeof message!=='object'||typeof message.t!=='string')throw Error('Mensagem inválida');
   for(const [key,value] of Object.entries(message.imgs||{}))if(!clean(key)||!validAsset(value))throw Error('Mídia inválida');
   if(this.closed)return;this.applying=true;try{await this.receive(message);}finally{this.applying=false;}if(this.closed)return;
   this.received=id;this.assembly=null;this.flushDeferred(id);if(this.closed)return;
   for(const [key,value] of Object.entries(message.imgs||{})){const hash=await digest(value);if(this.closed)return;this.known.set(key,hash);}
   if(message.t==='full'||Object.keys(message.imgs||{}).length)this.log(message.t==='full'?'snapshot-received':'image-received');
  }
  if(!this.closed)this.raw({kind:'ack',id,index});
 }
 transientKey(message,after){return JSON.stringify([message.t,message.from||'',after]);}
 validTransient(message){
  if(!message||!ephemeral.has(message.t)||message.from!==undefined&&!clean(message.from))return false;
  if(message.t==='pose')return Array.isArray(message.p)&&message.p.length<=this.limits.transientPoses&&message.p.every(p=>Array.isArray(p)&&p.length===6&&clean(p[0])&&p.slice(1).every(Number.isFinite));
  if(message.t==='cur')return Number.isFinite(message.x)&&Number.isFinite(message.y);
  return message.f===null||!!message.f&&typeof message.f==='object'&&!Array.isArray(message.f);
 }
 transient(message){
  if(!this.validTransient(message))return Promise.reject(Error('Evento transitório inválido'));
  const after=this.serial,key=this.transientKey(message,after);
  try{
   const merged=this.mergeTransient(this.transients.get(key)?.message,message);
   if(message.t!=='pose'&&JSON.stringify(merged).length>this.limits.chunk)throw Error('Evento transitório acima do limite');
   if(!this.transients.has(key)&&this.transients.size>=this.limits.transientQueue)throw Error('Fila transitória excedida; resincronização necessária');
   this.transients.set(key,{message:merged,after});this.scheduleTransient();return Promise.resolve(true);
  }catch(error){this.abort(error);return Promise.reject(error);}
 }
 scheduleTransient(){if(!this.transientTimer&&!this.closed)this.transientTimer=setTimeout(()=>{this.transientTimer=null;this.flushTransients();},32);}
 flushTransients(){
  if(this.closed)return;
  // Keep PeerJS/SCTP queues bounded too; retain latest poses while the channel drains.
  if((this.connection.dataChannel?.bufferedAmount||0)>this.limits.channelHighWater||(this.connection.bufferSize||0)>0){this.scheduleTransient();return;}
  let budget=8;
  for(const [key,entry] of this.transients){
   if(!budget--)break;
   const value=entry.message;let message=value.t==='pose'?{...value,p:value.p.slice(0,this.limits.transientBatch)}:value;
   while(value.t==='pose'&&message.p.length>1&&JSON.stringify(message).length>this.limits.chunk)message={...message,p:message.p.slice(0,Math.ceil(message.p.length/2))};
   if(JSON.stringify(message).length>this.limits.chunk){this.abort(Error('Evento transitório acima do limite'));return;}
   try{this.raw({kind:'transient',sequence:++this.transientSequence,after:entry.after,message});this.stats.transientSent++;}catch(error){this.abort(error);return;}
   if(value.t==='pose'&&value.p.length>message.p.length){entry.message={...value,p:value.p.slice(message.p.length)};}else this.transients.delete(key);
  }
  if(this.transients.size)this.scheduleTransient();
 }
 mergeTransient(old,message){
  if(message.t!=='pose')return structuredClone(message);
  const poses=new Map([...(old?.p||[]),...message.p].map(p=>[p[0],p]));
  if(poses.size>this.limits.transientPoses)throw Error('Limite de movimentos transitórios excedido; resincronização necessária');
  return {...message,p:[...poses.values()].map(p=>p.slice())};
 }
 acceptTransient(packet){
  const m=packet.message,after=packet.after;
  if(!Number.isSafeInteger(packet.sequence)||packet.sequence<=this.lastTransient||!Number.isSafeInteger(after)||after<0||after>this.received+this.limits.queue+1||!this.validTransient(m)||JSON.stringify(m).length>this.limits.chunk){this.stats.transientDropped++;return;}
  this.lastTransient=packet.sequence;this.stats.transientReceived++;
  // A pose may overtake its snapshot. Apply for responsiveness, then replay only up to
  // its preceding durable packet. Never replay an older pose over a newer durable edit.
  if(m.t==='pose'){
   if(after<this.received||this.applying&&after<this.assembly.id){this.stats.transientDropped++;return;}
   if(after>this.received){
    const key=this.transientKey(m,after);
    if(!this.replay.has(key)&&this.replay.size>=this.limits.transientQueue){this.abort(Error('Fila de movimentos recebidos excedida'));return;}
    try{this.replay.set(key,{message:this.mergeTransient(this.replay.get(key)?.message,m),after});}catch(error){this.abort(error);return;}
   }
  }
  if(this.applying){if(m.t!=='pose'){const key=this.transientKey(m,0);if(!this.deferred.has(key)&&this.deferred.size>=this.limits.transientQueue){this.abort(Error('Fila de eventos recebidos excedida'));return;}this.deferred.set(key,m);}return;}
  this.dispatchTransient(m);
 }
 dispatchTransient(message){
  if(this.closed)return;try{Promise.resolve(this.receive(message,{transient:true})).catch(()=>this.abort(Error('Evento transitório inválido')));}catch{this.abort(Error('Evento transitório inválido'));}
 }
 flushDeferred(id){
  if(this.closed||this.applying)return;
  for(const [key,entry] of this.replay){if(entry.after>=id)this.dispatchTransient(entry.message);if(entry.after<=id)this.replay.delete(key);}
  for(const message of this.deferred.values())this.dispatchTransient(message);this.deferred.clear();
 }
 abort(error){if(this.closed)return;this.log('sync-failed');try{this.raw({kind:'nack'});}catch{}this.close();this.fail(error);}
 close(){if(this.closed)return;this.closed=true;clearTimeout(this.transientTimer);this.transients.clear();this.deferred.clear();this.replay.clear();for(const ack of this.inFlight.values())ack.reject(Error('Conexão encerrada'));this.inFlight.clear();this.current?.reject(Error('Conexão encerrada'));for(const entry of this.queue)entry.reject(Error('Conexão encerrada'));this.queue=[];this.assembly=null;this.bufferedChars=0;}
}

// Board mutations from every connection share one application queue. Cosmetic cursor/FX
// events are independent of board state; poses coalesce while an async render commits.
export class LiveApplyQueue{
 constructor(apply){this.apply=apply;this.queue=[];this.moves=new Map();this.closed=false;}
 push(message,connection,{transient=false}={}){
  if(this.closed)return Promise.reject(Error('Fila de aplicação encerrada'));
  if(transient){
   if(message.t!=='pose'||!this.busy)return Promise.resolve().then(()=>this.closed?undefined:this.apply(message,connection));
   const key=connection,old=this.moves.get(key),poses=new Map([...(old?.message.p||[]),...message.p].map(p=>[p[0],p]));
   if(poses.size>LIVE_LIMITS.transientPoses||!old&&this.moves.size>=64)return Promise.reject(Error('Fila de aplicação transitória excedida'));
   this.moves.set(key,{message:{...message,p:[...poses.values()]},connection});return Promise.resolve();
  }
  if(this.queue.length>=LIVE_LIMITS.queue)return Promise.reject(Error('Fila de aplicação durável excedida'));
  return new Promise((resolve,reject)=>{this.queue.push({message,connection,resolve,reject});void this.pump();});
 }
 async pump(){
  if(this.busy||this.closed)return;this.busy=true;
  try{while(this.queue.length&&!this.closed){const entry=this.queue.shift();this.current=entry;
   try{await this.apply(entry.message,entry.connection);
    for(const [key,move] of this.moves){this.moves.delete(key);if(!this.closed)await this.apply(move.message,move.connection);}
    entry.resolve();
   }catch(error){entry.reject(error);}finally{this.current=null;}
  }}finally{this.busy=false;}
 }
 close(){this.closed=true;this.current?.reject(Error('Fila de aplicação encerrada'));for(const entry of this.queue)entry.reject(Error('Fila de aplicação encerrada'));this.queue=[];this.moves.clear();}
}

export const liveLinkOnline=c=>!!c.open&&!!(c._legacy||c._syncReady)&&!['disconnected','failed','closed'].includes(c.peerConnection?.iceConnectionState)&&(!c.dataChannel||c.dataChannel.readyState==='open');

export class LivePeerSession{
 constructor({role,campaign,userId,tabId=crypto.randomUUID(),Peer,options=()=>({}),onReady=()=>{},onData=()=>{},onLost=()=>{},status=()=>{},changed=()=>{},now=Date.now,legacy=false,onControl=()=>false,onDrop=()=>{}}){
  if(!clean(campaign)||!clean(userId))throw Error('Campanha ou identidade indisponível');
  Object.assign(this,{role,campaign,userId,tabId,Peer,options,onReady,onData,onLost,status,changed,now,legacy,onControl,onDrop});
  this.links=new Set();this.generation=0;this.known=new Map();this.events=[];this.retries=0;this.traces=[];
 }
 log(event,details){this.events.push({at:new Date(this.now()).toISOString(),event,...(details?{stage:liveConnectionStage({...details,peerOpen:!!this.peer?.open,peerError:this.peerError}),elapsedMs:details.elapsedMs,connection:details.connection,ice:details.ice,gathering:details.gathering,signaling:details.signaling,channelState:details.channelState,configuration:details.configuration,remoteCandidates:details.remoteCandidates,localSdpCandidates:details.localSdpCandidates,remoteSdpCandidates:details.remoteSdpCandidates,statsLocalCandidates:details.statsLocalCandidates,statsRemoteCandidates:details.statsRemoteCandidates,candidateEvents:details.candidateEvents,emptyCandidateEvents:details.emptyCandidateEvents,errorType:details.errorType,localDescription:details.localDescription,remoteDescription:details.remoteDescription,candidates:details.candidates,iceErrorCodes:details.iceErrorCodes}: {})});if(this.events.length>120)this.events.shift();}
 participants(){const p=new Map();for(const c of this.links)if(c.open){const key=c._identity||c.peer;if(!p.has(key))p.set(key,{name:c._name||'Conectando…',connections:0,legacy:!!c._legacy,online:liveLinkOnline(c),state:liveConnectionStage({...c._trace?.read(),peerOpen:!!this.peer?.open,applied:!!c._syncReady,channelOpen:!!c.open}),identity:'declared-unverified',id:key});p.get(key).connections++;}return [...p.values()];}
 start(code){this.stop();this.peerError=null;this.code=roomCode(code);if(!this.code)throw Error('Sala inválida');const generation=this.generation;this.log('room-open');
  const peer=this.peer=new this.Peer(this.role==='host'?'qimesa-'+this.code:undefined,this.options());
  const owned=()=>this.generation===generation&&this.peer===peer,current=()=>owned()&&!peer.destroyed;
  peer.on('open',()=>{if(!current())return;this.retries=0;this.peerError=null;this.log('peer-open');this.status(this.role==='host'?'Ao vivo. Compartilhe o link desta campanha.':'Conectando à mesa…');if(this.role==='client')this.dial();});
  peer.on('connection',connection=>{if(!current()||this.role!=='host'){connection.close();return;}this.attach(connection,generation);});
  peer.on('disconnected',()=>{if(current()){this.status('Reconectando ao servidor de salas…');this.retry();}});
  peer.on('error',error=>{if(!current())return;this.peerError=error.type;this.log('peer-error-'+String(error.type||'unknown').replace(/[^a-z-]/g,''));if(error.type==='unavailable-id'){this.status('Esta sala já está aberta em outra aba ou computador. Gere um link novo; a outra mesa foi preservada.');return;}this.status('Conexão indisponível · '+(error.type||'rede'));this.retry();});
  peer.on('close',()=>{if(!owned())return;this.peer=null;this.log('peer-closed');this.retry();});
  this.beat=setInterval(()=>this.tick(),LIVE_LIMITS.heartbeat);return peer;
 }
 retry(){if(this.retryTimer||!this.code)return;const generation=this.generation;const delay=Math.min(1500*2**Math.min(this.retries++,4),15000);
  this.retryTimer=setTimeout(()=>{this.retryTimer=null;if(generation!==this.generation||!this.code)return;const p=this.peer;if(!p||p.destroyed){const code=this.code;this.start(code);}else if(p.disconnected){try{p.reconnect();}catch{this.retry();}}else if(this.role==='client'){if(p.open)this.dial();else this.retry();}},delay);
 }
 dial(){
  if(this.role!=='client'||!this.peer?.open||this.dialing||this.links.size)return;
  const connection=this.peer.connect('qimesa-'+this.code,{reliable:true,serialization:'json',metadata:{live:2,wire:3,campaign:this.campaign,room:this.code,userId:this.userId,tabId:this.tabId,cinematic:4,cinematicBuild:LIVE_BUILD,cinematicPrewarm:1,assets:Object.fromEntries(this.known)}});
  this.dialing=connection;this.attach(connection,this.generation);
 }
 attach(c,generation){
  const valid=()=>this.generation===generation&&!c._closed&&(this.links.has(c)||this.dialing===c||this.pending?.has(c));
  if((this.pending?.size||0)+this.links.size>=64){c.close();this.log('connection-limit');return;}
  (this.pending??=new Set()).add(c);c._lastSeen=this.now();
  c._trace=observeLiveConnection(c,{now:this.now,event:(name,value)=>{if(valid()){this.log(name,value);this.changed();if(this.role==='client'&&!c._syncReady)this.status(LIVE_STAGE_TEXT[liveConnectionStage({...value,peerOpen:!!this.peer?.open,peerError:this.peerError})]);}}});
  c._openTimer=setTimeout(()=>{if(valid()){const stage=liveConnectionStage({...c._trace.read(),peerOpen:!!this.peer?.open,peerError:this.peerError});this.drop(c,'connect-timeout');this.status(LIVE_STAGE_TEXT[stage]+' Tentativa encerrada; reconectando.');}},20000);
  c.on('open',()=>{
   if(!valid())return c.close();
   const m=c.metadata;
   if(this.role==='host'){
    clearTimeout(c._openTimer);
    const modern=m?.live===2&&m.campaign===this.campaign&&m.room===this.code&&clean(m.userId)&&clean(m.tabId);
    if(!modern&&!this.legacy){this.drop(c,'scope-rejected');return;}
    if(m?.live===2&&!modern){this.drop(c,'scope-rejected');return;}
    c._syncReady=false;c._cinematicVersion=m?.cinematic||1;c._cinematicBuild=m?.cinematicBuild;c._cinematicPrewarm=m?.cinematicPrewarm===1;c._identity=modern?m.userId:'legacy:'+c.peer;c._legacy=!modern;
    // Keep the active logical session; a second tab must not trigger takeover/retry ping-pong.
    if(modern&&[...this.links].some(old=>old._identity===c._identity)){
     c.send({live:'busy',campaign:this.campaign,room:this.code,tabId:m.tabId});
     c._openTimer=setTimeout(()=>this.drop(c,'duplicate-tab'),10000);this.log('duplicate-tab');return;
    }
    this.links.add(c);this.pending.delete(c);
    if(modern){c._session=crypto.randomUUID();c._wireVersion=m.wire===3?3:2;this.wire(c,m.assets);c.send({live:'welcome',campaign:this.campaign,room:this.code,session:c._session,wire:c._wireVersion,cinematic:4,cinematicBuild:LIVE_BUILD,cinematicPrewarm:1});}
    this.log('connection-open');this.changed();this.onReady(c);
   }
  });
  c.on('data',message=>{
   if(!valid())return;
   if(this.links.has(c)&&this.onControl(message,c))return;
   if(message?.live==='busy'&&this.role==='client'&&this.dialing===c&&message.campaign===this.campaign&&message.room===this.code&&message.tabId===this.tabId){this.stop();this.peerError='duplicate-tab';this.status('Esta conta já está na mesa em outra aba. Feche a outra aba e use Reconectar para continuar aqui.');return;}
   if(message?.live==='welcome'&&this.role==='client'&&this.dialing===c){
    if(message.campaign!==this.campaign||message.room!==this.code||!clean(message.session)){this.drop(c,'scope-rejected');return;}
    c._syncReady=false;c._cinematicVersion=message.cinematic||1;c._cinematicBuild=message.cinematicBuild;c._cinematicPrewarm=message.cinematicPrewarm===1;c._session=message.session;c._identity='host';c._wireVersion=message.wire===3?3:2;this.wire(c);this.links.add(c);this.pending.delete(c);this.dialing=null;clearTimeout(c._openTimer);this.log('connection-open');this.changed();this.onReady(c);return;
   }
   if(message?.live==='ping'){if(c._session&&c._session===message.session){c._lastSeen=this.now();c.send({live:'pong',session:c._session});}return;}
   if(message?.live==='pong'){if(c._session&&c._session===message.session)c._lastSeen=this.now();return;}
   if(c._wire){if(c._wire.handle(message))c._lastSeen=this.now();return;}
   // Compatibility is explicit and restricted to old room links. No cross-campaign upgrade.
   if(this.role==='client'&&this.legacy&&message?.t==='full'&&!c._session){c._legacy=true;this.links.add(c);this.pending.delete(c);this.dialing=null;this.log('legacy-connected');this.changed();this.onReady(c);}
   if(!c._legacy)return;c._lastSeen=this.now();
   let length;try{length=JSON.stringify(message).length;}catch{return;}
   if(length>LIVE_LIMITS.packet){this.drop(c,'legacy-packet-too-large');return;}
   c._inbound=(c._inbound||Promise.resolve()).then(()=>valid()?this.onData(message,c):undefined).catch(()=>this.drop(c,'apply-failed'));
  });
  c.on('close',()=>{if(valid())this.drop(c,'connection-closed');});c.on('error',()=>{if(valid())this.drop(c,'connection-error');});
 }
 wire(c,remoteAssets){c._wire=new LiveWire({connection:c,scope:this.campaign+':'+this.code,session:c._session,known:this.known,remoteAssets,
  priority:c._wireVersion===3,receive:async(message,options)=>{if(!this.links.has(c)||c._closed)return;await this.onData(message,c,options);if(message.t==='full'&&this.role==='client'){c._syncReady=true;this.changed();}},log:event=>this.log(event),fail:()=>this.drop(c,'sync-failed')});}
 send(c,message){if(!this.links.has(c)||!c.open)return Promise.resolve(false);if(c._wire)return c._wire.send(message).then(result=>{if(message.t==='full'&&this.role==='host'&&!c._closed){c._syncReady=true;this.changed();}return result;});try{if(JSON.stringify(message).length>LIVE_LIMITS.packet)throw Error('Snapshot muito grande para cliente antigo');c.send(message);return Promise.resolve(true);}catch(error){this.drop(c,'send-failed');return Promise.reject(error);}}
 drop(c,reason){
  if(c._closed)return;const owned=this.links.has(c)||this.pending?.has(c)||this.dialing===c;c._closed=true;clearTimeout(c._openTimer);if(c._trace){const trace=c._trace.read();this.traces.push({...trace,reason,stage:liveConnectionStage({...trace,peerOpen:!!this.peer?.open,peerError:this.peerError,protocolFailed:reason==='sync-failed'})});if(this.traces.length>8)this.traces.shift();c._trace.close();}c._wire?.close();this.links.delete(c);this.pending?.delete(c);if(this.dialing===c)this.dialing=null;try{c.close();}catch{}
  if(!owned)return;if(this.role==='client'&&reason==='scope-rejected')this.peerError=reason;this.onDrop(c,reason);this.log(reason);this.changed();if(this.role==='client'){this.onLost(reason);if(reason!=='scope-rejected')this.retry();}
 }
 diagnostics(){return {peerOpen:!!this.peer?.open,peerError:this.peerError||null,identity:'declared-unverified',connections:[...new Set([...this.links,...(this.pending||[])])].map(c=>{const v=c._trace?.read()||{};return {...v,stage:liveConnectionStage({...v,peerOpen:!!this.peer?.open,peerError:this.peerError})};}),recent:this.traces.slice(),events:this.events.slice()};}
 tick(){for(const c of [...this.links]){if(this.now()-c._lastSeen>LIVE_LIMITS.lease){this.drop(c,'lease-expired');continue;}if(c._session)try{c.send({live:'ping',session:c._session});}catch{this.drop(c,'heartbeat-failed');}}}
 stop(){this.generation++;clearTimeout(this.retryTimer);clearInterval(this.beat);this.retryTimer=null;this.code=null;for(const c of new Set([...this.links,...(this.pending||[])]))this.drop(c,'stopped');this.links.clear();this.pending?.clear();this.dialing=null;const peer=this.peer;this.peer=null;try{peer?.destroy();}catch{}this.log('room-stopped');}
}

export function publicBoard(state){
 const source=state.items||[],hidden=new Set(source.filter(i=>i.gm||i.hand||i.kind==='ativador').map(i=>i.id));
 for(let pass=0;pass<source.length;pass++){let changed=false;for(const i of source)if(!hidden.has(i.id)&&['parent','box','inside','clipBy','lidOf'].some(k=>hidden.has(i[k]))){hidden.add(i.id);changed=true;}if(!changed)break;}
 const items=source.filter(i=>!hidden.has(i.id)),ids=new Set(items.map(i=>i.id)),pins=(state.pins||[]).filter(p=>!p.gm&&!p.hand&&(!p.item||ids.has(p.item))),pinIds=new Set(pins.map(p=>p.id));
 return {...state,items,pins,strings:(state.strings||[]).filter(s=>pinIds.has(s.a)&&pinIds.has(s.b))};
}
// Transport boundary only: no player packet may address a concealed object,
// replace the master's whole snapshot, or inject asset URLs. Native per-object
// interaction permissions remain in the existing board rules.
export function playerPacket(message,state,actor){
 if(!message||!['hello','ops','pose','snd','grav','gact','tune','fx','cur','cor','ping','react','qroll','toast','hwfx'].includes(message.t))return null;
 const visible=publicBoard(state),ids=new Set(visible.items.map(i=>i.id));
 const out={...message,from:actor};
 if(message.t==='ops'){
  const owned=i=>i.by===actor||!!i.crisOwner&&actor==='p'+i.crisOwner;
  out.up=(message.up||[]).filter(i=>clean(i.id)&&!i.gm&&!i.hand&&i.kind!=='ativador'&&(ids.has(i.id)||owned(i)&&['note','mark','tape','scr','cont'].includes(i.type)&&!i.imgId&&!i.audioId));
  out.up=out.up.map(i=>{const old=visible.items.find(o=>o.id===i.id);if(!old)return {...i,by:actor};return {...i,type:old.type,kind:old.kind,by:old.by,crisOwner:old.crisOwner,imgId:old.imgId,audioId:old.audioId,gm:old.gm,hand:old.hand};});
  out.del=(message.del||[]).filter(id=>visible.items.some(i=>i.id===id&&owned(i)));
  delete out.glob;delete out.imgs;
  if(message.pins){
   const allIds=new Set([...ids,...out.up.map(i=>i.id)]),existing=visible.pins;
   const changes=message.pins.filter(p=>clean(p.id)&&(!p.item||allIds.has(p.item))&&(existing.some(e=>e.id===p.id)||owned(p)));
   // Only one's own pins can be removed; others keep their ownership and linkage.
   out.pins=[...(state.pins||[]).filter(p=>!owned(p)&&!changes.some(c=>c.id===p.id)),...changes.map(p=>{const old=existing.find(e=>e.id===p.id);return old?{...p,by:old.by,crisOwner:old.crisOwner,item:old.item}:p;})];
   const pinIds=new Set(out.pins.map(p=>p.id));
   const strings=(message.strings||[]).filter(s=>pinIds.has(s.a)&&pinIds.has(s.b)&&(visible.strings.some(e=>e.id===s.id)||owned(s)));
   out.strings=[...(state.strings||[]).filter(s=>!owned(s)&&!strings.some(c=>c.id===s.id)),...strings.map(s=>{const old=visible.strings.find(e=>e.id===s.id);return old?{...s,by:old.by,crisOwner:old.crisOwner}:s;})];
  }else{delete out.pins;delete out.strings;}
 }
 if(message.t==='pose')out.p=(message.p||[]).filter(p=>ids.has(p[0])&&p.length===6&&p.slice(1).every(Number.isFinite));
 if(['grav','gact','tune','react'].includes(message.t)&&!ids.has(message.id))return null;
 if(message.t==='hwfx'&&(message.k!=='tclick'||!ids.has(message.id)))return null;
 return out;
}
