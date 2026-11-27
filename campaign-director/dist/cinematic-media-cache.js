import {cinematicMediaDatabase,imageKey} from './cinematic-media.js?v=directorcinematic02';
import {CINEMATIC_COMPOSITION_BYTES} from './cinematic-model.js?v=directorcinematic02';
export const REMOTE_CACHE_TTL=15*60*1000;
// Reentry cache in the existing cinematic media database. Account/campaign scoped,
// hash verified, bounded globally, never a second library or permission source.
export function retainedMedia(entries,now,budget=CINEMATIC_COMPOSITION_BYTES){
 const live=entries.filter(e=>e.expires>now&&e.blob instanceof Blob).sort((a,b)=>b.used-a.used);let bytes=0,count=0;
 return live.filter(e=>{if(count>=64||bytes+e.blob.size>budget)return false;count++;bytes+=e.blob.size;return true;});
}
export class RemoteCinematicCache{
 constructor(scope,{database=cinematicMediaDatabase,now=Date.now}={}){Object.assign(this,{scope,database,now});this.available=true;this.restoredBytes=0;}
 key(id){return JSON.stringify([this.scope,id]);}
 async load(assets){
  const found=new Map();try{const db=await this.database(),tx=db.transaction('remote-cache'),store=tx.objectStore('remote-cache');
   const rows=await Promise.all(assets.map(a=>new Promise((resolve,reject)=>{const r=store.get(this.key(a.id));r.onsuccess=()=>resolve([a,r.result]);r.onerror=()=>reject(r.error);})));
   for(const [a,row]of rows)if(row?.expires>this.now()&&row.blob?.size===a.size&&row.blob.type===a.type&&await imageKey(row.blob)===a.id){found.set(a.id,row.blob);this.restoredBytes+=row.blob.size;}
  }catch{this.available=false;}return found;
 }
 async save(id,blob){
  if(!(blob instanceof Blob)||blob.size>CINEMATIC_COMPOSITION_BYTES)return;
  try{const db=await this.database();await new Promise((resolve,reject)=>{
   const tx=db.transaction('remote-cache','readwrite'),s=tx.objectStore('remote-cache'),r=s.getAll();tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);
   r.onsuccess=()=>{const now=this.now(),entry={key:this.key(id),blob,used:now,expires:now+REMOTE_CACHE_TTL},rows=r.result.filter(e=>e.key!==entry.key),keep=retainedMedia([entry,...rows],now),keys=new Set(keep.map(e=>e.key));for(const e of rows)if(!keys.has(e.key))s.delete(e.key);if(keys.has(entry.key))s.put(entry,entry.key);};
  });}catch{this.available=false;}
 }
}
