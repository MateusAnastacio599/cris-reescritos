import {cinematicItems,cinematicPrimary,remotePrewarmAllowed} from './cinematic-model.js?v=directorcinematic02';
import {loadCinematicMedia,validateCompositionMedia} from './cinematic-media.js?v=directorcinematic02';
import {validBoard,sameCinematicScene} from './cinematic-protocol.js?v=directorcinematic02';
// Same grouping order used by quick-page navigation and the sidebar. No sorting
// by title/ID and no traversal of audio alternates or arbitrary cinematic items.
export function scriptScenes(campaign){
 const groups=new Map();for(const page of campaign?.pages||[]){const folder=page.folder||'Páginas';if(!groups.has(folder))groups.set(folder,[]);groups.get(folder).push(page);}
 return [...groups.values()].flatMap(pages=>pages.flatMap(page=>page.scenes.map(scene=>({campaignId:campaign.id,pageId:page.id,sceneId:scene.id,scene}))));
}
export function sequenceTarget(state,location,playing=false){
 const campaign=state.campaigns.find(c=>c.id===location?.campaignId),entries=scriptScenes(campaign),index=entries.findIndex(e=>sameCinematicScene(e,location));
 if(index<0)return null;
 const candidates=playing?entries.slice(index+1):[entries[index]];
 for(const entry of candidates)if(cinematicItems(entry.scene).length){const item=cinematicPrimary(entry.scene);return item?{...entry,item,authorized:remotePrewarmAllowed(entry.scene,item)}:null;}
 return null;
}
const keyOf=item=>JSON.stringify(item);
export class CinematicSequence{
 constructor({getState,getLocation,getScope,link,images,changed=()=>{}}){Object.assign(this,{getState,getLocation,getScope,link,images,changed});this.slots=new Map();this.revision=0;this.unsubscribe=link.subscribe(()=>{if(link.active?.phase==='apresentando')this.lastPlayed=link.active.scene;void this.refresh();});}
 slotStatus(item){const slot=item&&this.slots.get(keyOf(item)),warm=this.link.prewarmState;if(!slot)return 'Não preparada';if(!slot.media)return 'Preparando';if(warm?.itemKey!==keyOf(item)||warm.status==='local')return 'Pronta localmente';return warm.status==='ready'?'Pronta para apresentação':warm.status==='failed'?'Pronta localmente · preload remoto falhou':'Preparando jogadores';}
 view(){const location=this.getLocation(),scene=sequenceTarget(this.getState(),location),future=this.target&&!sameCinematicScene(this.target,location);return {status:this.link.active?.phase==='apresentando'?'Apresentando':this.failure&&!future?'Falha':this.slotStatus(scene?.item),error:this.failure||'',next:future?this.target.scene.title:'',nextStatus:future?this.failure?'Falha':this.slotStatus(this.target.item):'',remote:this.link.prewarmState?.participants||[]};}
 notify(){this.changed(this.view());}
 async mediaFor(item){
  const key=keyOf(item),cached=this.slots.get(key);if(cached)return cached.promise;
  // At most the active presentation and one target. A manual alternate supersedes
  // the speculative target; there is no decoded player in this cache.
  const activeKey=this.link.active?.itemKey;for(const k of this.slots.keys())if(k!==activeKey)this.slots.delete(k);
  const slot={item,key};this.slots.set(key,slot);slot.promise=new Promise((resolve,reject)=>Object.assign(slot,{resolve,reject}));
  if(this.loading){this.waiting?.reject(new DOMException('Preload substituído.','AbortError'));this.waiting=slot;}else void this.load(slot);return slot.promise;
 }
 async load(slot){
  this.loading=slot;
  try{const media=await loadCinematicMedia(slot.item,this.images),map=media instanceof Blob?{[slot.item.imageId]:media}:media;if(this.closed||this.slots.get(slot.key)!==slot)throw new DOMException('Preload substituído.','AbortError');await validateCompositionMedia(slot.item,map);if(this.closed||this.slots.get(slot.key)!==slot)throw new DOMException('Preload substituído.','AbortError');slot.media=media;slot.resolve(media);this.notify();}
  catch(error){if(this.slots.get(slot.key)===slot)this.slots.delete(slot.key);slot.reject(error);}
  finally{this.loading=null;const next=this.waiting;this.waiting=null;if(next){if(this.closed||this.slots.get(next.key)!==next)next.reject(new DOMException('Preload substituído.','AbortError'));else void this.load(next);}}

 }
 async refresh({retry=false}={}){
  if(this.closed)return;const scope=this.getScope(),location=this.getLocation();
  if(!sameCinematicScene(location,this.lastPlayed))this.lastPlayed=null;
  const playing=sameCinematicScene(location,this.lastPlayed)&&(!this.link.active||this.link.active.phase==='apresentando'),target=validBoard(scope)&&location?sequenceTarget(this.getState(),location,playing):null;
  const key=target?JSON.stringify([scope,target.campaignId,target.pageId,target.sceneId,target.item,target.authorized]):null;
  if(key===this.key&&!retry){this.notify();return;}this.key=key;const revision=++this.revision;this.target=target;this.failure='';this.link.cancelPrewarm();
  const activeKey=this.link.active?.itemKey,targetKey=target&&keyOf(target.item);for(const k of this.slots.keys())if(k!==activeKey&&k!==targetKey)this.slots.delete(k);
  if(!target){this.notify();return;}
  try{const media=await this.mediaFor(target.item);if(this.closed||revision!==this.revision)return;
   this.notify();if(target.authorized)await this.link.prewarm(scope,{campaignId:target.campaignId,pageId:target.pageId,sceneId:target.sceneId},target.item,media);
  }catch(error){if(revision===this.revision){this.failure=error.message;this.notify();}}
 }
 cacheBytes(){const media=new Map();for(const slot of this.slots.values())if(slot.media)for(const [id,blob]of Object.entries(slot.media instanceof Blob?{[slot.item.imageId]:slot.media}:slot.media))media.set(id,blob);return [...media.values()].reduce((n,b)=>n+b.size,0);}
 close(){this.closed=true;this.revision++;this.unsubscribe?.();this.link.cancelPrewarm();this.slots.clear();this.waiting?.reject(new DOMException('Preload cancelado.','AbortError'));this.waiting=null;}
}
