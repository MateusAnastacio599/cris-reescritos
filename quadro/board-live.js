// LIVE-01A: PeerJS lifecycle and bounded, acknowledged board packets.
// Account IDs in peer metadata are presence claims, NEVER authorization proofs.
const clean=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(value);
export const LIVE_LIMITS=Object.freeze({chunk:12000,packet:32*1024*1024,asset:24*1024*1024,queue:64,ack:10000,retries:2,heartbeat:10000,lease:70000});
export const roomCode=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,32);
export function newRoom(random=crypto){const b=new Uint8Array(12);random.getRandomValues(b);return Array.from(b,n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');}
export function storedRoom(storage,campaign,fresh=false){const key='cris:live:room:'+campaign;let code;try{code=storage.getItem(key);}catch{}if(fresh||!/^[A-Z0-9]{12,32}$/.test(code||''))code=newRoom();try{storage.setItem(key,code);}catch{}return code;}
export async function digest(text){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');}
export const validAsset=value=>typeof value==='string'&&value.length<=LIVE_LIMITS.asset&&/^data:(?:image\/(?:png|jpeg|webp|gif)|audio\/[a-zA-Z0-9.+-]+);base64,[A-Za-z0-9+/=]+$/.test(value);
const ephemeral=new Set(['cur','fx','pose']);
export class LiveWire{
 constructor({connection,scope,session,receive,known=new Map(),remoteAssets={},log=()=>{},fail=()=>{},limits=LIVE_LIMITS}){
  Object.assign(this,{connection,scope,session,receive,known,log,fail,limits});this.remoteAssets=new Map(Object.entries(remoteAssets).slice(0,1000));this.queue=[];this.serial=0;this.received=0;this.closed=false;this.inbound=Promise.resolve();this.stats={packets:0,bytes:0,assets:0,reused:0};
 }
 raw(message){if(this.closed||!this.connection.open)throw Error('Conexão encerrada');this.connection.send({...message,live:2,scope:this.scope,session:this.session});}
 send(message){
  if(this.closed)return Promise.reject(Error('Conexão encerrada'));
  if(ephemeral.has(message.t)){const pending=this.queue.find(e=>e.message.t===message.t);if(pending){if(message.t==='pose'){const poses=new Map([...(pending.message.p||[]),...(message.p||[])].map(p=>[p[0],p]));message={...message,p:[...poses.values()]};}pending.message=message;return pending.promise;}}
  if(this.queue.length>=this.limits.queue){const error=Error('Fila de sincronização excedida');this.abort(error);return Promise.reject(error);}
  let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});this.queue.push({message,resolve,reject,promise});void this.pump();return promise;
 }
 async pump(){
  if(this.sending||this.closed)return;this.sending=true;
  try{while(this.queue.length&&!this.closed){
   const entry=this.queue.shift();this.current=entry;
   try{
    const message={...entry.message},imgs={},hashes=new Map();
    for(const [id,data] of Object.entries(message.imgs||{})){
     if(!clean(id)||!validAsset(data))throw Error('Arquivo inválido ou acima do limite');
     const hash=await digest(data);hashes.set(id,hash);
     if(this.remoteAssets.get(id)!==hash){imgs[id]=data;this.stats.assets++;}else this.stats.reused++;
    }
    if(message.imgs)message.imgs=imgs;
    const text=JSON.stringify(message);
    if(text.length>this.limits.packet)throw Error('Snapshot acima do limite de transmissão');
    const hash=await digest(text),id=++this.serial,total=Math.ceil(text.length/this.limits.chunk);
    for(let index=0;index<total;index++){
     await this.acknowledge({kind:'chunk',id,index,total,length:text.length,hash,data:text.slice(index*this.limits.chunk,(index+1)*this.limits.chunk)});
    }
    for(const [key,hash] of hashes)this.remoteAssets.set(key,hash);
    this.stats.packets++;this.stats.bytes+=text.length;if(message.t==='full'||Object.keys(imgs).length)this.log(message.t==='full'?'snapshot-sent':'image-sent');entry.resolve();
   }catch(error){entry.reject(error);this.abort(error);break;}finally{this.current=null;}
  }}finally{this.sending=false;}
 }
 acknowledge(packet){return new Promise((resolve,reject)=>{
  let tries=0;const pending=this.pending={id:packet.id,index:packet.index,resolve:()=>{clearTimeout(pending.timer);if(this.pending===pending)this.pending=null;resolve();},reject:error=>{clearTimeout(pending.timer);if(this.pending===pending)this.pending=null;reject(error);}};
  const send=()=>{try{this.raw(packet);}catch(error){pending.reject(error);return;}pending.timer=setTimeout(()=>{if(++tries>this.limits.retries)pending.reject(Error('Tempo esgotado aguardando confirmação do quadro'));else send();},this.limits.ack);};send();
 });}
 handle(packet){
  if(this.closed||packet?.live!==2||packet.scope!==this.scope||packet.session!==this.session)return false;
  if(packet.kind==='ack'){if(this.pending?.id===packet.id&&this.pending.index===packet.index)this.pending.resolve();return true;}
  if(packet.kind==='nack'){this.abort(Error('Quadro recusou a sincronização'));return true;}
  this.inbound=this.inbound.then(()=>this.accept(packet)).catch(error=>this.abort(error));return true;
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
   if(this.closed)return;await this.receive(message);if(this.closed)return;
   for(const [key,value] of Object.entries(message.imgs||{}))this.known.set(key,await digest(value));
   this.received=id;this.assembly=null;if(message.t==='full'||Object.keys(message.imgs||{}).length)this.log(message.t==='full'?'snapshot-received':'image-received');
  }
  if(!this.closed)this.raw({kind:'ack',id,index});
 }
 abort(error){if(this.closed)return;this.log('sync-failed');try{this.raw({kind:'nack'});}catch{}this.close();this.fail(error);}
 close(){if(this.closed)return;this.closed=true;this.pending?.reject(Error('Conexão encerrada'));this.current?.reject(Error('Conexão encerrada'));for(const entry of this.queue)entry.reject(Error('Conexão encerrada'));this.queue=[];this.assembly=null;}
}

export class LivePeerSession{
 constructor({role,campaign,userId,tabId=crypto.randomUUID(),Peer,options=()=>({}),onReady=()=>{},onData=()=>{},onLost=()=>{},status=()=>{},changed=()=>{},now=Date.now,legacy=false}){
  if(!clean(campaign)||!clean(userId))throw Error('Campanha ou identidade indisponível');
  Object.assign(this,{role,campaign,userId,tabId,Peer,options,onReady,onData,onLost,status,changed,now,legacy});
  this.links=new Set();this.generation=0;this.known=new Map();this.events=[];this.retries=0;
 }
 log(event){this.events.push({at:new Date(this.now()).toISOString(),event});if(this.events.length>120)this.events.shift();}
 participants(){const p=new Map();for(const c of this.links)if(c.open){const key=c._identity||c.peer;if(!p.has(key))p.set(key,{name:c._name||'Conectando…',connections:0,legacy:!!c._legacy});p.get(key).connections++;}return [...p.values()];}
 start(code){this.stop();this.code=roomCode(code);if(!this.code)throw Error('Sala inválida');const generation=this.generation;this.log('room-open');
  const peer=this.peer=new this.Peer(this.role==='host'?'qimesa-'+this.code:undefined,this.options());
  const current=()=>this.generation===generation&&this.peer===peer&&!peer.destroyed;
  peer.on('open',()=>{if(!current())return;this.retries=0;this.log('peer-open');this.status(this.role==='host'?'Ao vivo. Compartilhe o link desta campanha.':'Conectando à mesa…');if(this.role==='client')this.dial();});
  peer.on('connection',connection=>{if(!current()||this.role!=='host'){connection.close();return;}this.attach(connection,generation);});
  peer.on('disconnected',()=>{if(current()){this.status('Reconectando ao servidor de salas…');this.retry();}});
  peer.on('error',error=>{if(!current())return;this.log('peer-error-'+String(error.type||'unknown').replace(/[^a-z-]/g,''));if(error.type==='unavailable-id'){this.status('Esta sala já está aberta em outra aba ou computador. Gere um link novo; a outra mesa foi preservada.');return;}this.status('Conexão indisponível · '+(error.type||'rede'));this.retry();});
  peer.on('close',()=>{if(!current())return;this.peer=null;this.log('peer-closed');this.retry();});
  this.beat=setInterval(()=>this.tick(),LIVE_LIMITS.heartbeat);return peer;
 }
 retry(){if(this.retryTimer||!this.code)return;const generation=this.generation;const delay=Math.min(1500*2**Math.min(this.retries++,4),15000);
  this.retryTimer=setTimeout(()=>{this.retryTimer=null;if(generation!==this.generation||!this.code)return;const p=this.peer;if(!p||p.destroyed){const code=this.code;this.start(code);}else if(p.disconnected){try{p.reconnect();}catch{this.retry();}}else if(this.role==='client')this.dial();},delay);
 }
 dial(){
  if(this.role!=='client'||!this.peer?.open||this.dialing||this.links.size)return;
  const connection=this.peer.connect('qimesa-'+this.code,{reliable:true,serialization:'json',metadata:{live:2,campaign:this.campaign,room:this.code,userId:this.userId,tabId:this.tabId,assets:Object.fromEntries(this.known)}});
  this.dialing=connection;this.attach(connection,this.generation);
 }
 attach(c,generation){
  const valid=()=>this.generation===generation&&!c._closed&&(this.links.has(c)||this.dialing===c||this.pending?.has(c));
  if((this.pending?.size||0)+this.links.size>=64){c.close();this.log('connection-limit');return;}
  (this.pending??=new Set()).add(c);c._lastSeen=this.now();
  c._openTimer=setTimeout(()=>{if(valid())this.drop(c,'connect-timeout');},20000);
  c.on('open',()=>{
   if(!valid())return c.close();
   const m=c.metadata;
   if(this.role==='host'){
    clearTimeout(c._openTimer);
    const modern=m?.live===2&&m.campaign===this.campaign&&m.room===this.code&&clean(m.userId)&&clean(m.tabId);
    if(!modern&&!this.legacy){this.drop(c,'scope-rejected');return;}
    if(m?.live===2&&!modern){this.drop(c,'scope-rejected');return;}
    c._identity=modern?m.userId:'legacy:'+c.peer;c._legacy=!modern;
    // Keep the active logical session; a second tab must not trigger takeover/retry ping-pong.
    if(modern&&[...this.links].some(old=>old._identity===c._identity)){
     c.send({live:'busy',campaign:this.campaign,room:this.code,tabId:m.tabId});
     c._openTimer=setTimeout(()=>this.drop(c,'duplicate-tab'),10000);this.log('duplicate-tab');return;
    }
    this.links.add(c);this.pending.delete(c);
    if(modern){c._session=crypto.randomUUID();this.wire(c,m.assets);c.send({live:'welcome',campaign:this.campaign,room:this.code,session:c._session});}
    this.log('connection-open');this.changed();this.onReady(c);
   }
  });
  c.on('data',message=>{
   if(!valid())return;c._lastSeen=this.now();
   if(message?.live==='busy'&&this.role==='client'&&this.dialing===c&&message.campaign===this.campaign&&message.room===this.code&&message.tabId===this.tabId){this.stop();this.status('Esta conta já está na mesa em outra aba. Feche a outra aba e use Reconectar para continuar aqui.');return;}
   if(message?.live==='welcome'&&this.role==='client'&&this.dialing===c){
    if(message.campaign!==this.campaign||message.room!==this.code||!clean(message.session)){this.drop(c,'scope-rejected');return;}
    c._session=message.session;c._identity='host';this.wire(c);this.links.add(c);this.pending.delete(c);this.dialing=null;clearTimeout(c._openTimer);this.log('connection-open');this.changed();this.onReady(c);return;
   }
   if(message?.live==='ping'){if(c._session===message.session)c.send({live:'pong',session:c._session});return;}
   if(message?.live==='pong')return;
   if(c._wire){c._wire.handle(message);return;}
   // Compatibility is explicit and restricted to old room links. No cross-campaign upgrade.
   if(this.role==='client'&&this.legacy&&message?.t==='full'&&!c._session){c._legacy=true;this.links.add(c);this.pending.delete(c);this.dialing=null;this.log('legacy-connected');this.changed();this.onReady(c);}
   if(!c._legacy)return;
   let length;try{length=JSON.stringify(message).length;}catch{return;}
   if(length>LIVE_LIMITS.packet){this.drop(c,'legacy-packet-too-large');return;}
   c._inbound=(c._inbound||Promise.resolve()).then(()=>valid()?this.onData(message,c):undefined).catch(()=>this.drop(c,'apply-failed'));
  });
  c.on('close',()=>{if(valid())this.drop(c,'connection-closed');});c.on('error',()=>{if(valid())this.drop(c,'connection-error');});
 }
 wire(c,remoteAssets){c._wire=new LiveWire({connection:c,scope:this.campaign+':'+this.code,session:c._session,known:this.known,remoteAssets,
  receive:async message=>{if(!this.links.has(c)||c._closed)return;await this.onData(message,c);},log:event=>this.log(event),fail:()=>this.drop(c,'sync-failed')});}
 send(c,message){if(!this.links.has(c)||!c.open)return Promise.resolve(false);if(c._wire)return c._wire.send(message);try{if(JSON.stringify(message).length>LIVE_LIMITS.packet)throw Error('Snapshot muito grande para cliente antigo');c.send(message);return Promise.resolve(true);}catch(error){this.drop(c,'send-failed');return Promise.reject(error);}}
 drop(c,reason){
  if(c._closed)return;const owned=this.links.has(c)||this.pending?.has(c)||this.dialing===c;c._closed=true;clearTimeout(c._openTimer);c._wire?.close();this.links.delete(c);this.pending?.delete(c);if(this.dialing===c)this.dialing=null;try{c.close();}catch{}
  if(!owned)return;this.log(reason);this.changed();if(this.role==='client'){this.onLost(reason);this.retry();}
 }
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
