/** SoundPad independente: loops e efeitos ocasionais permanecem ao trocar o roteiro. */
export class AmbienceBus {
  constructor(engine){this.engine=engine;this.tracks=new Map();this.jobs=new Map();this.active=null;this.generation=0;this.paused=false;}
  get isPlaying(){return !this.paused&&(this.tracks.size>0||this.jobs.size>0);}
  cancelJobs(){for(const job of this.jobs.values())clearTimeout(job.timer);this.jobs.clear();}
  async apply(preset,{fade=this.engine.getState().settings.crossfade}={}){
    if(!preset)throw new Error('Escolha um ambiente salvo.');
    const generation=++this.generation;await this.engine.init();if(generation!==this.generation)return;
    this.cancelJobs();const old=this.tracks;this.tracks=new Map();
    const prior=this.active;this.active=structuredClone(preset);this.paused=false;
    if(prior)for(const effect of this.engine.effects)if(effect.owner?.presetId===prior.id)this.engine.retire(effect,fade);
    const results=await Promise.allSettled(this.active.layers.filter(l=>l.enabled!==false).map(async layer=>{
      const asset=this.engine.asset(layer.assetId);if(!asset||asset.provider==='youtube')throw new Error(`O áudio de “${layer.name}” precisa ser um arquivo da biblioteca.`);
      if(layer.mode==='random'){
        const job={layer,presetId:preset.id,generation,remaining:null};this.jobs.set(layer.id,job);this.schedule(job);return;
      }
      const before=old.get(layer.id);
      if(before&&before.assetId===asset.id&&!before.disposed){old.delete(layer.id);this.engine.ramp(before,layer.volume,fade);before.audio.play().catch(e=>this.engine.error(e.message));this.tracks.set(layer.id,before);return;}
      let track=await this.engine.createTrack(asset,{loop:true,volume:layer.volume,group:'ambience',fade,epoch:this.engine.epoch});
      if(!track&&generation===this.generation)track=await this.engine.createTrack(asset,{loop:true,volume:layer.volume,group:'ambience',fade,epoch:this.engine.epoch});
      if(track){if(generation!==this.generation)this.engine.dispose(track);else{track.name=layer.name;this.tracks.set(layer.id,track);}}
    }));
    for(const track of old.values())this.engine.retire(track,fade);
    if(generation!==this.generation)return;
    for(const result of results)if(result.status==='rejected')this.engine.error(result.reason.message);
    this.engine.emit();
  }
  schedule(job,remaining=null){
    if(job.generation!==this.generation||this.jobs.get(job.layer.id)!==job)return;
    const min=Math.max(.1,Number(job.layer.minInterval)||15),max=Math.max(min,Number(job.layer.maxInterval)||45);
    const seconds=remaining??(min+Math.random()*(max-min));job.remaining=seconds;
    if(this.paused)return;job.due=performance.now()+seconds*1000;
    job.timer=setTimeout(async()=>{
      if(job.generation!==this.generation||this.paused)return;
      job.timer=null;
      try{
        const effect=await this.engine.oneShot(this.engine.asset(job.layer.assetId),job.layer.volume,{group:'ambience',owner:{presetId:job.presetId,layerId:job.layer.id}});
        if(job.generation!==this.generation||this.jobs.get(job.layer.id)!==job){this.engine.dispose(effect);return;}
        if(effect){effect.afterEnd=()=>this.schedule(job);if(this.paused)effect.audio.pause();}else this.schedule(job);
      }catch(error){this.engine.error(error.message);if(job.generation===this.generation)this.schedule(job);}
    },Math.max(0,seconds)*1000);
  }
  setVolume(id,volume){const track=this.tracks.get(id);if(track)this.engine.ramp(track,volume,.1);const layer=this.active?.layers.find(l=>l.id===id);if(layer)layer.volume=volume;const job=this.jobs.get(id);if(job)job.layer.volume=volume;for(const effect of this.engine.effects)if(effect.owner?.presetId===this.active?.id&&effect.owner?.layerId===id)this.engine.ramp(effect,volume,.1);this.engine.emit();}
  async toggleLayer(id,enabled){
    if(!this.active)return;const layer=this.active.layers.find(l=>l.id===id);if(!layer)return;layer.enabled=enabled;
    if(!enabled){const job=this.jobs.get(id);if(job)clearTimeout(job.timer);this.jobs.delete(id);const track=this.tracks.get(id);if(track){this.engine.retire(track,.25);this.tracks.delete(id);}for(const effect of this.engine.effects)if(effect.owner?.layerId===id&&effect.owner?.presetId===this.active.id)this.engine.retire(effect,.25);this.engine.emit();}
    else await this.apply(this.active,{fade:.5});
  }
  pause(){this.paused=true;for(const track of this.tracks.values())track.audio.pause();for(const job of this.jobs.values())if(job.timer){job.remaining=Math.max(0,(job.due-performance.now())/1000);clearTimeout(job.timer);job.timer=null;}}
  async resume(){this.paused=false;await Promise.allSettled([...this.tracks.values()].map(t=>t.audio.play()));for(const job of this.jobs.values()){
    const playing=[...this.engine.effects].some(t=>t.owner?.presetId===this.active?.id&&t.owner?.layerId===job.layer.id&&!t.disposed);
    if(!playing&&!job.timer)this.schedule(job,job.remaining);
  }}
  stop(fade=0){
    this.generation++;this.cancelJobs();const presetId=this.active?.id;
    for(const track of this.tracks.values())fade?this.engine.retire(track,fade):this.engine.dispose(track);
    for(const effect of [...this.engine.effects])if(presetId&&effect.owner?.presetId===presetId)fade?this.engine.retire(effect,fade):this.engine.dispose(effect);
    this.tracks.clear();this.active=null;this.paused=false;this.engine.emit();
  }
}
