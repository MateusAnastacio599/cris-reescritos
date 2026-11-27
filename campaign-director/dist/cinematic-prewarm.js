import {cinematicMediaIds,CINEMATIC_COMPOSITION_BYTES} from './cinematic-model.js?v=directorcinematic01';
import {validateCompositionMedia,imageKey} from './cinematic-media.js?v=directorcinematic01';
const key=v=>typeof v==='string'&&/^[\w-]{1,128}$/.test(v);
const bytes64=bytes=>btoa(String.fromCharCode(...bytes));
const blob64=(text,type)=>new Blob([Uint8Array.from(atob(text),c=>c.charCodeAt(0))],{type});
const SLICE=96*1024;
const cancelled=()=>new DOMException('Preload cancelado.','AbortError');
const wait=(ms,signal)=>new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(cancelled());},timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});
// One speculative target and one sending peer. Assets use the SAME LiveWire,
// lane, hash/ACK and DataConnection as presentations. No decoded player here.
export class CinematicPrewarm{
 constructor(owner,{project,validate,pace=8}={}){Object.assign(this,{owner,project,validate,pace});this.serial=0;this.states=new Map();this.timer=setInterval(()=>this.tick(),5000);}
 report(){const peers=this.target?[...this.owner.peers.values()].filter(p=>p.live.role==='host'&&!p.closed):[];return {sid:this.target?.sid||null,status:!peers.length?'local':peers.every(p=>this.states.get(p)?.status==='ready')?'ready':peers.some(p=>['failed','unsupported'].includes(this.states.get(p)?.status))?'failed':'preparing',cacheBytes:[...this.owner.cache.values()].reduce((n,b)=>n+b.size,0),budget:CINEMATIC_COMPOSITION_BYTES,participants:peers.map(p=>({id:p.connection._identity||p.connection.peer,name:String(p.connection._name||'Jogador').slice(0,80),status:this.states.get(p)?.status||'waiting',bytes:this.states.get(p)?.bytes||0,reusedBytes:this.states.get(p)?.reusedBytes||0,code:this.states.get(p)?.code||null}))};}
 changed(){if(!this.owner.closed)this.owner.notify();this.owner.warmChanged?.(this.report());}
 touch(){if(this.target)this.target.expires=this.owner.now()+45000;}
 async set(item,asset,{authorized=false}={}){
  this.cancel();const generation=this.serial;if(!authorized||!this.owner.sign)return false;
  const projected=this.project(item),source=asset instanceof Blob?{[item.imageId]:asset}:asset,media=Object.fromEntries(cinematicMediaIds(projected).map(id=>[id,source[id]]));
  await validateCompositionMedia(projected,media);if(JSON.stringify({item:projected,assets:Object.entries(media).map(([id,b])=>({id,type:b.type,size:b.size}))}).length>30000)throw Error('Composição acima do limite de instruções.');if(this.closed||generation!==this.serial)return false;
  this.target={sid:crypto.randomUUID(),revision:generation+1,item:projected,media,assets:Object.entries(media).map(([id,b])=>({id,type:b.type,size:b.size})),startedAt:this.owner.now(),expires:this.owner.now()+45000};this.changed();this.kick();return true;
 }
 cancel(){this.serial++;this.target=null;for(const [peer,entry]of this.states){entry.controller?.abort();entry.wire?.close();entry.finish?.();clearTimeout(entry.timeout);if(!peer.closed)this.owner.control(peer,'warm-cancel',{sid:entry.sid});}this.states.clear();this.changed();}
 interrupt(){for(const [peer,e]of this.states)if(!['ready','unsupported','failed'].includes(e.status)){e.controller.abort();e.wire?.close();e.finish?.();clearTimeout(e.timeout);this.owner.control(peer,'warm-cancel',{sid:e.sid});this.states.delete(peer);}this.changed();}
 eligible(peer){const o=this.owner;return !peer.closed&&peer.verified&&peer.connection.open&&peer.connection._syncReady!==false&&!peer.ending&&(!o.active||o.active.phase==='apresentando'&&peer.status==='apresentando');}
 kick(){if(this.pumping||this.closed||!this.target)return;this.pumping=true;queueMicrotask(async()=>{try{
  for(const peer of this.owner.peers.values()){
   const target=this.target;if(!target||this.closed)break;if(peer.live.role!=='host'||this.states.has(peer)||!this.eligible(peer))continue;
   if(peer.connection._cinematicPrewarm!==true){this.states.set(peer,{sid:target.sid,status:'unsupported',code:'update-client'});this.changed();continue;}
   await this.offer(peer,target);
  }
 }finally{this.pumping=false;if(this.target&&[...this.owner.peers.values()].some(p=>p.live.role==='host'&&!this.states.has(p)&&this.eligible(p)))this.kick();}});}
 async offer(peer,target){
  const entry={sid:target.sid,status:'preparing',controller:new AbortController(),bytes:0};this.states.set(peer,entry);
  // During playback reuse its wire. With no active presentation, make an idle
  // wire that will be superseded by the normal prepare command on real play.
  if(!peer.wire||peer.wire.closed)this.owner.makeWire(peer,crypto.randomUUID());peer.backgroundWire=peer.wire;
  entry.wire=peer.wire;entry.wireSid=peer.wireSid;
  const complete=new Promise(resolve=>entry.finish=resolve);entry.timeout=setTimeout(()=>{if(this.states.get(peer)===entry){entry.controller.abort();entry.status='failed';entry.code='preload-timeout';entry.finish();this.changed();}},180000);
  this.owner.control(peer,'warm-offer',{...target,media:undefined,expires:undefined,wireSid:entry.wireSid,activeSid:this.owner.active?.sid||null,authorized:true});this.changed();await complete;clearTimeout(entry.timeout);
 }
 async beforeChunk(peer){
  const entry=this.states.get(peer);if(!entry||entry.wire!==peer.wire)throw cancelled();
  await wait(this.pace,entry.controller.signal);
  while(entry.busyUntil>this.owner.now()||!this.eligible(peer)||(peer.connection.dataChannel?.bufferedAmount||0)>48*1024||(peer.connection.bufferSize||0)>0||this.owner.frame.composition?.videos?.some(v=>v.video?.readyState<3&&!v.video?.paused))await wait(50,entry.controller.signal);
 }
 background(peer,wire=peer.wire){return peer.backgroundWire===wire;}
 failed(peer,code='preload-transfer-failed'){const entry=this.states.get(peer);if(entry){entry.status='failed';entry.code=code;entry.controller?.abort();entry.wire?.close();entry.finish?.();}if(this.client?.peer===peer){this.owner.control(peer,'warm-state',{sid:this.client.sid,status:'failed',code});this.client=null;}this.changed();}
 async send(peer,entry,ids){
  const target=this.target,wire=entry.wire,window=wire.sendWindow;wire.sendWindow=1;
  try{
   const begin=this.owner.now();entry.reusedBytes=target.assets.filter(a=>!ids.includes(a.id)).reduce((n,a)=>n+a.size,0);
   for(const id of ids){if(this.states.get(peer)!==entry||target!==this.target)throw cancelled();await this.beforeChunk(peer);const blob=target.media[id],parts=[];
    for(let offset=0;offset<blob.size;offset+=SLICE){
     await this.beforeChunk(peer);const slice=blob.slice(offset,offset+SLICE),bytes=new Uint8Array(await slice.arrayBuffer());
     for(let i=0;i<bytes.length;i+=24576)parts.push(bytes64(bytes.subarray(i,i+24576)));
     await wire.send({t:'cinematic-prewarm-asset',sid:target.sid,id,type:blob.type,offset,base64:parts.join('')});parts.length=0;entry.bytes+=slice.size;
    }
   }
   if(entry.controller.signal.aborted||target!==this.target)return;entry.transferMs=this.owner.now()-begin;this.owner.control(peer,'warm-complete',{sid:target.sid});
  }catch(error){if(error?.name!=='AbortError'&&this.states.get(peer)===entry)this.failed(peer);}
  finally{wire.sendWindow=window;}
 }
 async handle(peer,m){
  if(!m.kind?.startsWith('warm-'))return false;
  const o=this.owner;if(!peer.verified||peer.closed)return true;
  if(peer.live.role==='host'){
   const e=this.states.get(peer);if(!e||e.sid!==m.sid)return true;
   if(m.kind==='warm-flow'){e.busyUntil=m.busy===true?o.now()+750:0;return true;}
   if(m.kind==='warm-need'&&!e.sending&&Array.isArray(m.ids)&&new Set(m.ids).size===m.ids.length&&m.ids.every(id=>this.target?.assets.some(a=>a.id===id))){e.sending=true;void this.send(peer,e,m.ids);}
   if(m.kind==='warm-state'&&['ready','failed'].includes(m.status)){e.status=m.status;e.code=/^[a-z-]{1,64}$/.test(m.code||'')?m.code:null;e.finish?.();this.changed();}
   return true;
  }
  if(m.kind==='warm-cancel'){if(this.client?.sid===m.sid){peer.wire?.close();this.client=null;this.expireCache();}return true;}
  if(m.kind==='warm-lease'){if(this.client?.sid===m.sid)this.client.expires=o.now()+45000;return true;}
  if(m.kind==='warm-offer'){
   if(!key(m.sid)||!key(m.wireSid)||!this.validate(m)||m.authorized!==true)return true;
   if(o.pending&&(!o.pending.playing||o.pending.sid!==m.activeSid)){o.control(peer,'warm-state',{sid:m.sid,status:'failed',code:'foreground-busy'});return true;}
   // Reserve the complete candidate plus the current presentation inside 24 MiB.
   const pinned=new Map((o.pending?.assets||[]).map(a=>[a.id,a.size]));for(const a of m.assets)pinned.set(a.id,a.size);
   if([...pinned.values()].reduce((n,s)=>n+s,0)>CINEMATIC_COMPOSITION_BYTES){o.control(peer,'warm-state',{sid:m.sid,status:'failed',code:'cache-budget'});return true;}
   let reserved=[...pinned.values()].reduce((n,s)=>n+s,0)+[...o.cache].filter(([id])=>!pinned.has(id)).reduce((n,[,b])=>n+b.size,0);for(const [id,b]of o.cache)if(!pinned.has(id)&&(reserved>CINEMATIC_COMPOSITION_BYTES||o.cache.size>64)){o.cache.delete(id);reserved-=b.size;}
   if(!peer.wire||peer.wire.closed||peer.wireSid!==m.wireSid)o.makeWire(peer,m.wireSid);peer.backgroundWire=peer.wire;
   this.client={...m,peer,expires:o.now()+45000};clearTimeout(o.cacheTimer);
   const ids=m.assets.filter(a=>{const b=o.cache.get(a.id);return !b||b.size!==a.size||b.type!==a.type;}).map(a=>a.id);o.control(peer,'warm-need',{sid:m.sid,ids});return true;
  }
  if(m.kind==='warm-complete'&&this.client?.sid===m.sid){
   const c=this.client;try{await validateCompositionMedia(c.item,Object.fromEntries(c.assets.map(a=>[a.id,o.cache.get(a.id)])));if(this.client!==c)return true;c.ready=true;o.control(peer,'warm-state',{sid:c.sid,status:'ready'});}catch{this.failed(peer,'preload-integrity');}return true;
  }
  return true;
 }
 async receive(peer,message){
  const c=this.client,a=c?.assets.find(a=>a.id===message.id);if(!c||c.peer!==peer||c.sid!==message.sid||!a||a.type!==message.type||!Number.isInteger(message.offset)||message.offset<0||message.offset>=a.size||typeof message.base64!=='string'||message.base64.length!==4*Math.ceil(Math.min(SLICE,a.size-message.offset)/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(message.base64))throw Error('Preload não solicitado.');
  if(this.owner.frame.composition?.videos?.some(v=>v.video?.readyState<3&&!v.video?.paused))this.owner.control(peer,'warm-flow',{sid:c.sid,busy:true});
  const part=blob64(message.base64,a.type),assembly=c.assembly??={id:a.id,bytes:0,parts:[]};if(assembly.id!==a.id||assembly.bytes!==message.offset)throw Error('Preload fora de ordem.');assembly.parts.push(part);assembly.bytes+=part.size;
  if(assembly.bytes===a.size){const blob=new Blob(assembly.parts,{type:a.type});if(await imageKey(blob)!==a.id)throw Error('Integridade do preload inválida.');if(this.client!==c)return;
   if([...this.owner.cache].filter(([id])=>id!==a.id).reduce((n,[,b])=>n+b.size,blob.size)>CINEMATIC_COMPOSITION_BYTES)throw Error('Cache excedido.');this.owner.cache.set(a.id,blob);c.assembly=null;}

 }
 promote(){this.client=null;clearTimeout(this.owner.cacheTimer);}
 expireCache(){clearTimeout(this.owner.cacheTimer);this.owner.cacheTimer=setTimeout(()=>{if(!this.client&&!this.owner.pending)this.owner.cache.clear();},30000);}
 tick(){if(this.target){if(this.owner.now()>this.target.expires)this.cancel();else for(const [p,e]of this.states)this.owner.control(p,'warm-lease',{sid:e.sid});}if(this.client&&this.owner.now()>this.client.expires){this.client=null;this.expireCache();}this.kick();}
 disconnect(peer){const e=this.states.get(peer);e?.controller?.abort();e?.finish?.();clearTimeout(e?.timeout);this.states.delete(peer);if(this.client?.peer===peer){this.client=null;this.expireCache();}this.changed();}
 close(){this.closed=true;this.cancel();clearInterval(this.timer);this.client=null;}
}
