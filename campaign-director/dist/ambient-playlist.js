import {PlaylistOrder} from './playlist-order.js';
import {resolveAsset} from './storage.js';

/** Playlists locais têm uma fila por camada; não ocupam o canal musical da mesa. */
export function ambientPlaylistSource(engine,layer){
  const playlist=engine.getState().playlists.find(p=>p.id===layer.playlistId);
  if(!playlist)throw new Error(`A playlist de “${layer.name}” não está na biblioteca.`);
  const assets=[...new Set(playlist.assetIds)].map(id=>engine.asset(id)).filter(a=>a&&!engine.removedAssets.has(a.id));
  if(assets.some(a=>a.provider==='youtube'))throw new Error(`Use a trilha musical do ambiente para a playlist “${playlist.name}” do YouTube.`);
  if(!assets.length)throw new Error(`Adicione arquivos à playlist “${playlist.name}”.`);
  return {playlist,assets,shuffle:layer.shuffle??playlist.shuffle===true};
}
export function nextAmbientAsset(engine,holder,{peek=false}={}){
  const {assets,shuffle}=ambientPlaylistSource(engine,holder.layer),ids=assets.map(a=>a.id);
  if(!holder.order?.matches(ids,shuffle))holder.order=new PlaylistOrder(ids,{shuffle,currentId:holder.order?.current});
  const id=peek?holder.order.peek():holder.order.next();return assets.find(a=>a.id===id);
}

export class AmbientPlaylist {
  constructor(bus,layer,generation){this.bus=bus;this.engine=bus.engine;this.layer=layer;this.generation=generation;this.track=null;this.closed=false;this.loading=null;this.preloadEpoch=0;}
  get valid(){return !this.closed&&this.bus.generation===this.generation&&this.bus.sequences.get(this.layer.id)===this;}
  get fade(){return Math.max(0,Math.min(30,this.layer.crossfade??this.engine.getState().settings.crossfade));}
  clearPreload(){this.preloadEpoch++;if(this.preloaded){this.preloaded.audio.pause();this.preloaded.audio.removeAttribute('src');this.preloaded.audio.load();this.preloaded=null;}}
  async preload(){
    this.clearPreload();const epoch=this.preloadEpoch;
    try{const asset=nextAmbientAsset(this.engine,this,{peek:true}),value=await resolveAsset(asset);if(!this.valid||epoch!==this.preloadEpoch||this.engine.removedAssets.has(asset.id))return;const audio=new Audio(value.url||value.src);audio.preload='auto';audio.load();this.preloaded={assetId:asset.id,audio};}catch{}
  }
  advance(fade=this.fade){
    if(!this.valid)return Promise.resolve();if(this.loading)return this.loading;
    const pending=this.startNext(fade).catch(error=>{if(this.valid){this.stop(0);this.bus.sequences.delete(this.layer.id);this.engine.error(error.message);this.engine.emit();}}).finally(()=>{if(this.loading===pending){this.loading=null;this.engine.emit();}});
    this.loading=pending;return pending;
  }
  async startNext(fade){
    const asset=nextAmbientAsset(this.engine,this),prepared=this.preloaded?.assetId===asset.id?this.preloaded.audio:null;
    if(prepared)this.preloaded=null;
    let track=await this.engine.createTrack(asset,{group:'ambience',volume:this.layer.volume,fade,preparedAudio:prepared});
    // Uma transição de cena não deve cancelar um ambiente independente.
    if(!track&&this.valid&&!this.engine.removedAssets.has(asset.id))track=await this.engine.createTrack(asset,{group:'ambience',volume:this.layer.volume,fade});
    if(!track)return;if(!this.valid){this.engine.dispose(track);return;}
    const prior=this.track;this.track=track;track.name=this.layer.name;track.assetName=asset.name;track.owner={presetId:this.bus.active.id,layerId:this.layer.id,playlistId:this.layer.playlistId};
    track.fadeOut=this.layer.fadeOut??this.bus.active.fadeOut??this.engine.getState().settings.crossfade;
    this.bus.tracks.set(this.layer.id,track);if(prior)this.engine.retire(prior,fade);if(this.bus.paused)track.audio.pause();
    track.audio.onended=()=>{if(!this.valid||this.track!==track)return;this.engine.dispose(track);this.track=null;this.bus.tracks.delete(this.layer.id);if(!this.bus.paused)this.advance();this.engine.emit();};
    const onError=track.audio.onerror;track.audio.onerror=()=>{onError?.();if(this.valid){this.stop(0);this.bus.sequences.delete(this.layer.id);this.engine.emit();}};
    this.preload();this.engine.emit();
  }
  tick(){
    if(!this.valid||this.bus.paused||this.loading||!this.track||this.track.audio.paused||this.track.disposed)return;
    const audio=this.track.audio,remaining=audio.duration-audio.currentTime,fade=Math.min(this.fade,(audio.duration||0)/2);
    if(Number.isFinite(remaining)&&remaining>0&&fade>0&&remaining<=fade)this.advance(Math.min(fade,remaining));
  }
  async resume(){if(!this.valid)return;if(this.track&&!this.track.disposed)await this.track.audio.play();else await this.advance(.25);}
  removeAsset(assetId){
    if(this.preloaded?.assetId===assetId)this.clearPreload();
    if(this.track?.assetId===assetId){const old=this.track;this.engine.dispose(old);if(this.bus.tracks.get(this.layer.id)===old)this.bus.tracks.delete(this.layer.id);this.track=null;if(!this.bus.paused)this.advance(0);}
  }
  stop(fade=0,{override=false}={}){
    this.closed=true;this.clearPreload();const track=this.track;this.track=null;
    if(this.bus.tracks.get(this.layer.id)===track)this.bus.tracks.delete(this.layer.id);
    const out=track=>fade===0||override?fade:track.fadeOut??fade;
    if(track)this.engine.retire(track,out(track));
    for(const old of [...this.engine.retiring])if(old.owner?.presetId===this.bus.active?.id&&old.owner?.layerId===this.layer.id)this.engine.retire(old,out(old));
  }
}
