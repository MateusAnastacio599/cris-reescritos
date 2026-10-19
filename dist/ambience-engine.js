import {AmbientPlaylist,ambientPlaylistSource,nextAmbientAsset} from './ambient-playlist.js';
import {fadeSeconds} from './audio-fades.js';

/** SoundPad independente: cada playlist tem a própria fila, ganho e transição. */
export class AmbienceBus {
  constructor(engine){this.engine=engine;this.tracks=new Map();this.jobs=new Map();this.sequences=new Map();this.active=null;this.generation=0;this.paused=false;this.musicConfigKey=null;this.musicToken=0;}
  get ownsMusic(){return !!this.active&&!!this.engine.musicAsset&&this.engine.musicFadeOptions?.ambienceOwnerId===this.active.id;}
  get isPlaying(){return !this.paused&&(this.tracks.size>0||this.jobs.size>0||this.sequences.size>0||this.ownsMusic);}
  cancelJobs(){for(const job of this.jobs.values())clearTimeout(job.timer);this.jobs.clear();}
  async apply(preset,{fade}={}){
    if(!preset)throw new Error('Escolha um ambiente salvo.');
    const generation=++this.generation;await this.engine.init();if(generation!==this.generation)return;
    this.cancelJobs();const old=this.tracks,oldSequences=this.sequences;this.tracks=new Map();this.sequences=new Map();
    const prior=this.active,ownedMusic=this.ownsMusic,music=preset.music,key=music?.assetId||music?.playlistId?JSON.stringify(music):null;
    const enter=fadeSeconds(fade??preset.fadeIn??this.engine.getState().settings.crossfade),exit=fadeSeconds(fade??prior?.fadeOut??this.engine.getState().settings.crossfade);
    const keepMusic=prior?.id===preset.id&&this.musicConfigKey===key;if(!keepMusic)this.musicToken++;
    this.active=structuredClone(preset);this.paused=false;
    if(prior)for(const effect of this.engine.effects)if(effect.owner?.presetId===prior.id)this.engine.retire(effect,fade??effect.fadeOut??exit);
    const results=await Promise.allSettled(this.active.layers.filter(l=>l.enabled!==false).map(async layer=>{
      const asset=layer.playlistId?ambientPlaylistSource(this.engine,layer).assets[0]:this.engine.asset(layer.assetId);if(!asset||asset.provider==='youtube')throw new Error(`O áudio de “${layer.name}” precisa ser um arquivo da biblioteca.`);
      const layerIn=fadeSeconds(fade??layer.fadeIn??(!layer.playlistId?asset.fadeIn:undefined)??enter),layerOut=fadeSeconds(layer.fadeOut??(!layer.playlistId?asset.fadeOut:undefined)??preset.fadeOut??this.engine.getState().settings.crossfade);
      if(layer.mode==='random'){
        const job={layer,presetId:preset.id,generation,remaining:null};this.jobs.set(layer.id,job);this.schedule(job);return;
      }
      if(layer.playlistId){
        const before=oldSequences.get(layer.id);
        if(before&&before.layer.playlistId===layer.playlistId){before.layer=layer;before.generation=generation;oldSequences.delete(layer.id);this.sequences.set(layer.id,before);if(before.track){old.delete(layer.id);this.tracks.set(layer.id,before.track);before.track.fadeOut=layerOut;this.engine.ramp(before.track,layer.volume,enter);}await before.resume();return;}
        const sequence=new AmbientPlaylist(this,layer,generation);this.sequences.set(layer.id,sequence);await sequence.advance(layerIn);return;
      }
      const before=old.get(layer.id);
      if(before&&before.assetId===asset.id&&!before.disposed){old.delete(layer.id);this.engine.ramp(before,layer.volume,enter);before.fadeOut=layerOut;before.audio.play().catch(e=>this.engine.error(e.message));this.tracks.set(layer.id,before);return;}
      let track=await this.engine.createTrack(asset,{loop:true,volume:layer.volume,group:'ambience',fade:layerIn,epoch:this.engine.epoch});
      if(!track&&generation===this.generation)track=await this.engine.createTrack(asset,{loop:true,volume:layer.volume,group:'ambience',fade:layerIn,epoch:this.engine.epoch});
      if(track){if(generation!==this.generation)this.engine.dispose(track);else{track.name=layer.name;track.fadeOut=layerOut;track.owner={presetId:preset.id,layerId:layer.id};this.tracks.set(layer.id,track);}}
    }));
    for(const [id,sequence] of oldSequences){const track=sequence.track;sequence.stop(fade??track?.fadeOut??exit,{override:fade!==undefined});if(old.get(id)===track)old.delete(id);}
    for(const track of old.values())this.engine.retire(track,fade??track.fadeOut??exit);
    if(generation!==this.generation)return;
    for(const result of results)if(result.status==='rejected')this.engine.error(result.reason.message);
    if(key){
      if(!keepMusic)try{await this.engine.applySceneMusic({music:{...music,mode:'play',ambienceOwnerId:preset.id,ambienceMusicToken:this.musicToken}});}catch(error){this.engine.error(error.message);}
    }else if(ownedMusic)await this.engine.stopMusic(exit);
    if(generation!==this.generation)return;this.musicConfigKey=key;
    this.engine.emit();
  }
  schedule(job,remaining=null){
    if(job.generation!==this.generation||this.jobs.get(job.layer.id)!==job)return;
    clearTimeout(job.timer);job.timer=null;
    const min=Math.max(.1,Number(job.layer.minInterval)||15),max=Math.max(min,Number(job.layer.maxInterval)||45);
    const seconds=remaining??(min+Math.random()*(max-min));job.remaining=seconds;
    if(this.paused)return;job.due=performance.now()+seconds*1000;
    job.timer=setTimeout(async()=>{
      if(job.generation!==this.generation||this.paused||this.jobs.get(job.layer.id)!==job)return;
      job.timer=null;
      try{
        const asset=job.layer.playlistId?nextAmbientAsset(this.engine,job):this.engine.asset(job.layer.assetId);
        const effect=await this.engine.oneShot(asset,job.layer.volume,{group:'ambience',owner:{presetId:job.presetId,layerId:job.layer.id},fadeIn:job.layer.fadeIn,fadeOut:job.layer.fadeOut});
        if(job.generation!==this.generation||this.jobs.get(job.layer.id)!==job){this.engine.dispose(effect);return;}
        if(effect){effect.afterEnd=()=>this.schedule(job);if(this.paused)effect.audio.pause();}else this.schedule(job);
      }catch(error){this.engine.error(error.message);if(this.jobs.get(job.layer.id)===job)this.jobs.delete(job.layer.id);this.engine.emit();}
    },Math.max(0,seconds)*1000);
  }
  setVolume(id,volume){const track=this.tracks.get(id);if(track)this.engine.ramp(track,volume,.1);const layer=this.active?.layers.find(l=>l.id===id);if(layer)layer.volume=volume;const job=this.jobs.get(id);if(job)job.layer.volume=volume;const sequence=this.sequences.get(id);if(sequence)sequence.layer.volume=volume;for(const effect of this.engine.effects)if(effect.owner?.presetId===this.active?.id&&effect.owner?.layerId===id)this.engine.ramp(effect,volume,.1);this.engine.emit();}
  setMusicVolume(volume){if(!this.active?.music)return;this.active.music.volume=volume;this.musicConfigKey=JSON.stringify(this.active.music);if(this.ownsMusic)this.engine.fadeMusicTo(volume,.1);this.engine.emit();}
  async toggleLayer(id,enabled){
    if(!this.active)return;const layer=this.active.layers.find(l=>l.id===id);if(!layer)return;layer.enabled=enabled;
    if(!enabled){const fade=fadeSeconds(layer.fadeOut??this.engine.asset(layer.assetId)?.fadeOut??this.active.fadeOut??.25),sequence=this.sequences.get(id);if(sequence){sequence.stop(fade);this.sequences.delete(id);}const job=this.jobs.get(id);if(job)clearTimeout(job.timer);this.jobs.delete(id);const track=this.tracks.get(id);if(track){this.engine.retire(track,fade);this.tracks.delete(id);}for(const effect of this.engine.effects)if(effect.owner?.layerId===id&&effect.owner?.presetId===this.active.id)this.engine.retire(effect,effect.fadeOut??fade);this.engine.emit();}
    else await this.apply(this.active);
  }
  pause(){this.paused=true;for(const track of this.tracks.values())track.audio.pause();for(const job of this.jobs.values())if(job.timer){job.remaining=Math.max(0,(job.due-performance.now())/1000);clearTimeout(job.timer);job.timer=null;}}
  async resume(){this.paused=false;await Promise.allSettled([...this.tracks.entries()].filter(([id])=>!this.sequences.has(id)).map(([,t])=>t.audio.play()).concat([...this.sequences.values()].map(s=>s.resume())));for(const job of this.jobs.values()){
    const playing=[...this.engine.effects].some(t=>t.owner?.presetId===this.active?.id&&t.owner?.layerId===job.layer.id&&!t.disposed);
    if(!playing&&!job.timer)this.schedule(job,job.remaining);
  }}
  tick(){for(const sequence of this.sequences.values())sequence.tick();}
  refreshSources(){for(const sequence of this.sequences.values()){try{ambientPlaylistSource(this.engine,sequence.layer);}catch(error){sequence.stop(0);this.sequences.delete(sequence.layer.id);this.engine.error(error.message);}}for(const job of this.jobs.values())if(job.layer.playlistId&&!job.timer){const playing=[...this.engine.effects].some(t=>t.owner?.presetId===job.presetId&&t.owner?.layerId===job.layer.id&&!t.disposed);if(!playing)this.schedule(job,job.remaining);}}
  removePlaylist(playlistId){
    for(const [id,sequence] of this.sequences)if(sequence.layer.playlistId===playlistId){sequence.stop(.25);this.sequences.delete(id);}
    for(const [id,job] of this.jobs)if(job.layer.playlistId===playlistId){clearTimeout(job.timer);this.jobs.delete(id);for(const effect of this.engine.effects)if(effect.owner?.presetId===job.presetId&&effect.owner?.layerId===id)this.engine.retire(effect,.25);}
    if(this.active){this.active.layers=this.active.layers.filter(l=>l.playlistId!==playlistId);if(this.active.music?.playlistId===playlistId){this.musicToken++;if(this.ownsMusic)this.engine.stopMusic(.25);delete this.active.music;}}
    this.engine.emit();
  }
  stop(fade){
    const override=fade!==undefined;fade=fadeSeconds(fade??this.active?.fadeOut??this.engine.getState().settings.crossfade);const out=track=>override?fade:track.fadeOut??fade;
    const ownsMusic=this.ownsMusic;this.generation++;this.musicToken++;this.cancelJobs();const presetId=this.active?.id;
    for(const sequence of this.sequences.values())sequence.stop(override?fade:sequence.track?.fadeOut??fade,{override});this.sequences.clear();
    for(const track of this.tracks.values())this.engine.retire(track,out(track));
    for(const effect of [...this.engine.effects])if(presetId&&effect.owner?.presetId===presetId)this.engine.retire(effect,out(effect));
    for(const track of [...this.engine.retiring])if(presetId&&track.owner?.presetId===presetId)this.engine.retire(track,out(track));
    if(ownsMusic)this.engine.stopMusic(fade);this.tracks.clear();this.active=null;this.musicConfigKey=null;this.paused=false;this.engine.emit();
  }
}
