import {readFileSync} from 'node:fs';
import {LiveWire} from '../../integration-main/quadro/board-live.js';
import {RemoteCinematics} from '../../dist/cinematic-remote.js';
import {imageKey} from '../../dist/cinematic-media.js';
export const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export const until=async(predicate,timeout=4000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(predicate())return;await pause(4);}throw Error('Prewarm condition not reached');};
const png=readFileSync(new URL('./cinematic-theater/palco.png',import.meta.url));
export async function asset(size=png.length,tag='warm'){
 const blob=new Blob([png,new Uint8Array(Math.max(0,size-png.length)),tag],{type:'image/png'}),id=await imageKey(blob);
 return {blob,item:{id:tag,imageId:id,name:tag,motion:'living',seconds:12,intensity:10,ending:'loop',hold:0,fadeIn:0,fadeOut:0}};
}
export async function harness({delays=[1],lead=30,decode=0}={}){
 let key;const packets=[],clients=[],bridge={registerLiveHost:async(room,value)=>key=value,liveHostKey:async()=>key};
 const host=new RemoteCinematics({Wire:LiveWire,frame:{},bridge,lead});host.prewarm.pace=1;await host.prepareHost('WARMROOM');
 async function add(delay=1,id='player-'+clients.length){
  const calls={prepare:0,play:0,clear:0,starts:[]},frame={prepare:async()=>{calls.prepare++;await pause(decode);return true;},startPrepared:async()=>{calls.play++;calls.starts.push(Date.now());return true;},clear:async()=>{calls.clear++;return true;},seek(position){calls.position=position;}};
  const client=new RemoteCinematics({Wire:LiveWire,frame,bridge});
  const a={open:true,_identity:id,_name:id,_session:'session-'+id,_syncReady:true,_cinematicVersion:4,_cinematicPrewarm:true,send:m=>{packets.push({at:Date.now(),to:id,m});setTimeout(()=>client.packet(structuredClone(m),b),delay);}},b={open:true,_session:'session-'+id,_syncReady:true,_cinematicVersion:4,_cinematicPrewarm:true,send:m=>{packets.push({at:Date.now(),from:id,m});setTimeout(()=>host.packet(structuredClone(m),a),delay);}};
  host.bind(a,{role:'host',campaign:'campaign',code:'WARMROOM'});client.bind(b,{role:'client',campaign:'campaign',code:'WARMROOM'});const entry={client,a,b,calls,frame};clients.push(entry);await until(()=>host.peers.get(a).verified);return entry;
 }
 for(const delay of delays)await add(delay);
 return {host,clients,packets,add,close(){host.close();for(const c of clients){c.client.close();c.a.open=c.b.open=false;}}};
}
