import {planCueActions} from './cue-actions.js';
import {SpotifyPlayer} from './spotify-player.js';
import { resolveAsset, clone } from './storage.js';
import { VolumeEnvelope } from './volume-envelope.js';
import { AmbienceBus } from './ambience-engine.js';
import { musicMethods } from './music-methods.js';
import { removeSceneAudio } from './audio-assets.js';
import {EffectFades,fadeSeconds} from './audio-fades.js';

const clamp = (n,min=0,max=1) => Math.max(min,Math.min(max,Number(n)||0));
export const formatTime = seconds => {const s=Math.max(0,Math.floor(seconds||0));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};

/** Instância única, independente da página/editor. Não é desmontada na navegação. */
export class AudioEngine extends EventTarget {
  constructor(getState) {
    super();this.getState=getState;this.tracks=new Map();this.retiring=new Set();this.effects=new Set();
    this.delays=new Set();this.removedAssets=new Set();this.epoch=0;this.musicEpoch=0;this.active=null;this.running=false;this.elapsed=0;this.fired=new Set();
    this.music=null;this.musicAsset=null;this.playlist=null;this.yt=null;this.ytReady=false;this.ytPlaying=false;this.ytLevel=1;this.pendingCue=null;
    this.spotify=new SpotifyPlayer();this.spotify.addEventListener('change',()=>{if(this.spotify.lastError&&this.spotify.lastError!==this.spotifyError){this.spotifyError=this.spotify.lastError;this.error(this.spotify.lastError);}if(!this.spotify.lastError)this.spotifyError=null;this.emit();});this.spotify.addEventListener('ended',()=>{if(this.musicAsset?.provider==='spotify'&&this.playlist)this.nextMusic();});
    this.Envelope=VolumeEnvelope;this.ambiences=new AmbienceBus(this);this.musicTargetLevel=1;this.ytPendingFade=null;this.youtubeAsset=null;this.youtubeQueue=[];this.inspectEpoch=0;this.youtubeHardStopped=true;
    this.ytEnvelope=new VolumeEnvelope(()=>this.ytLevel,value=>{this.ytLevel=value;this.applyYTVolume();});
    this.timer=setInterval(()=>this.tick(),200);
  }
  emit(type='change',detail={}) {this.dispatchEvent(new CustomEvent(type,{detail}));}
  error(message){this.emit('error',{message});}
  async init() {
    if(!this.context) {
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)throw new Error('Este navegador não oferece o motor de áudio necessário.');
      this.context=new Context();this.master=this.context.createGain();
      if(this.context.createDynamicsCompressor){this.peakControl=this.context.createDynamicsCompressor();for(const [key,value] of Object.entries({threshold:-1,knee:1,ratio:20,attack:.003,release:.15}))this.peakControl[key].value=value;this.master.connect(this.peakControl);this.peakControl.connect(this.context.destination);}else this.master.connect(this.context.destination);
      this.groups={};for(const key of ['ambience','sfx','music']){const gain=this.context.createGain();gain.connect(this.master);this.groups[key]=gain;}
      this.applyMixer();
    }
    if(this.context.state==='suspended')await this.context.resume();
  }
  applyMixer() {
    const settings=this.getState().settings;
    if(this.context){this.master.gain.setTargetAtTime(clamp(settings.master),this.context.currentTime,.025);for(const key of ['music','ambience','sfx'])this.groups[key].gain.setTargetAtTime(clamp(settings[key]),this.context.currentTime,.025);}
    this.applyYTVolume();this.applySpotifyVolume();this.emit();
  }
  setMix(key,value){if(!['master','music','ambience','sfx'].includes(key))return;this.getState().settings[key]=clamp(value);this.applyMixer();}
  setAssetBoost(assetId,value){
    const asset=this.asset(assetId);if(!asset||['youtube','spotify'].includes(asset.provider))return 1;
    asset.boost=clamp(value,1,4);const tracks=new Set([...this.tracks.values(),...this.effects,...this.retiring,...this.ambiences.tracks.values(),...(this.music?[this.music]:[])]);
    for(const track of tracks)if(track.assetId===assetId&&!track.disposed&&track.boostGain){track.boost=asset.boost;track.boostGain.gain.setTargetAtTime(asset.boost,this.context.currentTime,.025);}
    this.emit();return asset.boost;
  }
  asset(id,src) {const found=this.getState().audioAssets.find(a=>a.id===id||Boolean(src)&&a.src===src);return found || (src?{id:src,name:'Efeito',provider:'local',src,kind:'sfx'}:null);}
  later(callback,seconds,epoch=this.epoch){const timer=setTimeout(()=>{this.delays.delete(timer);if(this.epoch===epoch)callback();},Math.max(0,seconds)*1000);this.delays.add(timer);return timer;}
  clearDelays(){for(const timer of this.delays)clearTimeout(timer);this.delays.clear();}
  ramp(track,to,seconds=0) {
    if(!track||track.disposed)return;
    const t=this.context.currentTime,gain=track.gain.gain;track.volume=clamp(to);
    if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(t);else{const value=gain.value;gain.cancelScheduledValues(t);gain.setValueAtTime(value,t);}
    gain.linearRampToValueAtTime(track.volume,t+Math.max(0,Number(seconds)||0));
  }
  dispose(track) {
    if(!track||track.disposed)return;track.disposed=true;track.effectFades?.dispose();track.audio.pause();track.audio.removeAttribute('src');track.audio.load();
    clearTimeout(track.retireTimer);
    try{track.source.disconnect();track.boostGain?.disconnect();track.envelopeGain?.disconnect();track.gain.disconnect();}catch{}
    this.effects.delete(track);this.retiring.delete(track);
  }
  retire(track,seconds=this.getState().settings.crossfade) {
    if(!track||track.disposed)return;if(!seconds){this.dispose(track);return;}this.retiring.add(track);this.ramp(track,0,seconds);
    clearTimeout(track.retireTimer);track.retireTimer=setTimeout(()=>this.dispose(track),(seconds+.04)*1000);
  }
  async createTrack(asset,{loop=false,volume=1,group='sfx',fade=0,epoch=this.epoch,startSeconds=0,preparedAudio=null,effectFades=null}={}) {
    if(this.removedAssets.has(asset.id))return null;
    const resolved=await resolveAsset(asset);if(epoch!==this.epoch||this.removedAssets.has(asset.id))return null;
    const cached=preparedAudio||(group==='music'&&this.preloadedMusic?.assetId===asset.id?this.preloadedMusic.audio:null);
    const audio=cached||new Audio(resolved.url||resolved.src);if(cached&&cached===this.preloadedMusic?.audio)this.preloadedMusic=null;audio.preload='auto';audio.loop=loop;
    if(startSeconds>0){try{audio.currentTime=startSeconds;}catch{}}
    const source=this.context.createMediaElementSource(audio),gain=this.context.createGain(),boostGain=this.context.createGain(),boost=clamp(asset.boost??1,1,4);gain.gain.value=fade?0:clamp(volume);boostGain.gain.value=boost;
    source.connect(boostGain);boostGain.connect(gain);
    const track={audio,source,gain,boostGain,boost,assetId:asset.id,name:asset.name,volume:clamp(volume),group,loop,disposed:false};
    if(effectFades&&(effectFades.fadeIn||effectFades.fadeOut)){
      track.envelopeGain=this.context.createGain();gain.connect(track.envelopeGain);track.envelopeGain.connect(this.groups[group]||this.groups.sfx);
      track.effectFades=new EffectFades(audio,this.context,track.envelopeGain.gain,effectFades.fadeIn,effectFades.fadeOut);
    }else gain.connect(this.groups[group]||this.groups.sfx);
    audio.onerror=()=>{if(!track.disposed){this.error(`Não foi possível reproduzir “${asset.name}”.`);this.dispose(track);this.emit();}};
    try{await audio.play();}catch(error){this.dispose(track);throw new Error(error.name==='NotAllowedError'?'Toque novamente em reproduzir para liberar o áudio no navegador.':`Não foi possível reproduzir “${asset.name}”.`);}
    if(epoch!==this.epoch||this.removedAssets.has(asset.id)){this.dispose(track);return null;}
    track.effectFades?.sync();if(fade)this.ramp(track,volume,fade);return track;
  }
  async startScene(scene,location) {
    if(this.active?.key===location.key) {
      if(this.running){this.pause();return;}
      if(this.paused){await this.resume();return;}
    }
    const wasPaused=this.paused;const epoch=++this.epoch;this.clearDelays();this.pendingCue=null;
    await this.init();if(epoch!==this.epoch)return;
    const previous=this.tracks;this.tracks=new Map();
    this.active={...location,scene:clone(scene)};this.elapsed=0;this.startedAt=performance.now();this.running=true;this.paused=false;this.fired.clear();
    const fade=this.getState().settings.crossfade;
    const results=await Promise.allSettled(scene.layers.map(async layer=>{
      const asset=this.asset(layer.assetId,layer.src);if(!asset)throw new Error(`Arquivo da camada “${layer.name}” não encontrado.`);
      const enter=fadeSeconds(layer.fadeIn??asset.fadeIn??fade),exit=fadeSeconds(layer.fadeOut??asset.fadeOut??fade);
      const prior=previous.get(layer.id);
      if(prior&&prior.assetId===asset.id&&!prior.disposed){previous.delete(layer.id);prior.audio.play().catch(e=>this.error(e.message));this.ramp(prior,layer.volume,enter);prior.fadeOut=exit;this.tracks.set(layer.id,prior);return;}
      const track=await this.createTrack(asset,{loop:true,volume:layer.volume,group:layer.group||'ambience',fade:enter,epoch});
      if(track&&epoch===this.epoch){track.fadeOut=exit;this.tracks.set(layer.id,track);}
    }));
    for(const track of previous.values())this.retire(track,track.fadeOut??fade);
    if(epoch!==this.epoch)return;
    for(const r of results)if(r.status==='rejected')this.error(r.reason.message);
    if(scene.ambienceId==='stop')this.ambiences.stop(scene.ambienceFade);
    else if(scene.ambienceId){const preset=this.getState().ambiences?.find(a=>a.id===scene.ambienceId);if(preset)await this.ambiences.apply(preset,{fade:scene.ambienceFade});}
    if(!scene.ambienceId&&wasPaused)await this.ambiences.resume();
    try{await this.applySceneMusic(scene,{resume:wasPaused});}catch(error){this.error(error.message);}
    this.updateMediaSession();this.emit();
  }
  currentTime(){return this.running?this.elapsed+(performance.now()-this.startedAt)/1000:this.elapsed;}
  tick(){
    if(this.running&&this.active){const time=this.currentTime();this.active.scene.timeline.forEach((event,index)=>{if(!this.fired.has(index)&&event.at<=time){this.fired.add(index);this.executeEvent(event);}});}
    this.tickMusic();this.ambiences.tick();
    this.emit('tick',{time:this.currentTime()});
  }
  executeEvent(event) {
    if(event.action==='oneshot')this.oneShot(this.asset(event.assetId,event.src),.65,{fadeIn:event.fadeIn,fadeOut:event.fadeOut}).catch(e=>this.error(e.message));
    if(event.action==='fade')this.ramp(this.tracks.get(event.layer),event.to,event.duration??2);
    if(event.action==='cue'){const cue=this.active?.scene.cues?.find(c=>c.id===event.cueId);if(cue)this.fireCue(cue);}
    this.emit();
  }
  async oneShot(asset,volume=.8,{group='sfx',owner=null,fadeIn,fadeOut}={}) {
    if(!asset)throw new Error('Este efeito não está na biblioteca.');
    if(['youtube','spotify'].includes(asset.provider))throw new Error('Use um arquivo de áudio para efeitos; links de streaming ficam no canal de música.');
    const epoch=this.epoch;await this.init();if(epoch!==this.epoch)return;
    const fades={fadeIn:fadeSeconds(fadeIn??asset.fadeIn),fadeOut:fadeSeconds(fadeOut??asset.fadeOut)};
    const track=await this.createTrack(asset,{volume,group,epoch,effectFades:fades});if(!track)return;
    track.fadeOut=fadeOut??asset.fadeOut;
    track.owner=owner;this.effects.add(track);track.audio.onended=()=>{const after=track.afterEnd;this.dispose(track);this.emit();after?.();};this.emit();return track;
  }
  fireCue(cue) {
    if(!cue)return;this.pendingCue=cue.name;
    for(const action of planCueActions(cue.actions)){const execute=()=>{
      if(action.assetId&&this.removedAssets.has(action.assetId)&&!action.playlistId)return;
      if(action.type==='play')this.oneShot(this.asset(action.assetId),action.volume??.8,{fadeIn:action.fadeIn,fadeOut:action.fadeOut}).catch(e=>this.error(e.message));
      if(action.type==='fade')this.ramp(this.tracks.get(action.layerId),action.to,action.duration??1);
      if(action.type==='stop'){const track=this.tracks.get(action.layerId);if(track){this.retire(track,action.duration??track.fadeOut??0);this.tracks.delete(action.layerId);}}
      if(action.type==='music-play'){const asset=this.asset(action.assetId),options={loop:action.loop,fadeIn:action.fadeIn,fadeOut:action.fadeOut,volume:action.volume??1,startSeconds:action.startSeconds||0,youtubeIndex:asset?.shuffle?undefined:action.youtubeIndex||0};const playlist=this.getState().playlists.find(p=>p.id===action.playlistId);(playlist?this.playPlaylist(playlist,playlist.shuffle?null:action.index||0,options):this.playMusic(asset,options)).catch(e=>this.error(e.message));}
      if(action.type==='music-stop')this.stopMusic(action.duration??2).catch(e=>this.error(e.message));
      if(action.type==='music-volume')this.fadeMusicTo(action.to,action.duration??2);
      if(action.type==='ambience'){const preset=this.getState().ambiences?.find(a=>a.id===action.ambienceId);this.ambiences.apply(preset,{fade:action.duration}).catch(e=>this.error(e.message));}
      if(action.type==='ambience-stop')this.ambiences.stop(action.duration);
      if(action.type==='mix')this.fadeMix(action.group||'master',action.to,action.duration??2);
      if(action.type==='message')this.emit('message',{message:action.message||cue.name});
      if(action.type==='navigate')this.emit('navigate',{pageId:action.pageId,sceneId:action.sceneId||null});
      this.emit();
    };if(action.delay>0)this.later(execute,action.delay);else execute();}
    this.emit('cue',{id:cue.id,name:cue.name});this.emit();
  }
  async fireTrigger(trigger,scene) {
    if(!trigger)throw new Error('Este botão não tem um efeito ou uma cue configurada.');
    if(trigger.cue){const cue=scene.cues?.find(c=>c.id===(trigger.cueId||trigger.id));if(!cue)throw new Error('Configure as ações desta cue.');this.fireCue(cue);}
    else await this.oneShot(this.asset(trigger.assetId,trigger.src),trigger.volume??(trigger.id==='sino'?1:.8),{fadeIn:trigger.fadeIn,fadeOut:trigger.fadeOut});
    this.emit('cue',{id:trigger.id,name:trigger.name});
  }
  pause() {
    this.musicEpoch++;this.spotify.pause({fadeOut:this.getState().settings.spotifyFadeOut}).catch(error=>this.error(error.message));this.ytEnvelope.cancel();this.ytPendingFade=null;this.ambiences.pause();
    if(this.running){this.elapsed=this.currentTime();this.running=false;}this.paused=true;
    // Delayed cue actions are discarded on pause; timeline resumes from elapsed time.
    this.clearDelays();for(const t of this.retiring)this.dispose(t);
    for(const t of [...this.tracks.values(),...this.effects])t.audio.pause();
    if(this.music)this.music.audio.pause();if(this.ytReady)this.yt.pauseVideo();this.ytPlaying=false;this.emit();
  }
  async resume() {
    await this.init();const results=await Promise.allSettled([...this.tracks.values(),...this.effects,...(this.music?[this.music]:[])].filter(t=>!t.disposed).map(t=>t.audio.play()));
    for(const r of results)if(r.status==='rejected')this.error('Toque em reproduzir para liberar o áudio.');
    await this.ambiences.resume();
    if(this.musicAsset?.provider==='spotify')await this.spotify.resume({fadeIn:this.getState().settings.spotifyFadeIn});
    if(this.musicAsset?.provider==='youtube'&&this.ytReady){this.youtubeHardStopped=false;this.ytPendingFade={duration:.35,level:this.musicTargetLevel,generation:this.musicEpoch};this.ytLevel=0;this.applyYTVolume();this.yt.playVideo();}
    if(this.active){this.running=true;this.startedAt=performance.now();}this.paused=false;this.emit();
  }
  stop() {
    this.spotify.pause().catch(error=>this.error(error.message));this.youtubePreviewOnly=false;this.ytRampInfo=null;this.youtubeHardStopped=true;this.ytEnvelope.cancel();for(const env of Object.values(this.mixEnvelopes||{}))env.cancel();this.ytPendingFade=null;this.inspectEpoch++;this.ambiences.stop(0);this.clearPreload();
    this.epoch++;this.musicEpoch++;this.clearDelays();this.removedAssets.clear();this.active=null;this.running=false;this.paused=false;this.elapsed=0;this.fired.clear();this.pendingCue=null;
    for(const t of [...this.tracks.values(),...this.effects,...this.retiring])this.dispose(t);this.tracks.clear();this.effects.clear();this.retiring.clear();
    if(this.music)this.dispose(this.music);this.music=null;this.musicAsset=null;this.playlist=null;this.musicOrder=null;
    if(this.ytReady)this.yt.stopVideo();this.ytPlaying=false;this.ytLastVideoId=null;this.ytEndFadeKey=null;this.musicAdvancePending=null;this.emit('silence');this.emit();
  }
  silence(){this.stop();}
  async removeAsset(assetId){
    this.removedAssets.add(assetId);
    if(this.musicAsset?.id===assetId)await this.stopMusic(0);
    if(this.youtubeAsset?.id===assetId){this.closeYouTube();this.youtubeAsset=null;this.youtubeQueue=[];}
    for(const [id,track] of this.tracks)if(track.assetId===assetId){this.dispose(track);this.tracks.delete(id);}
    for(const track of [...this.effects,...this.retiring])if(track.assetId===assetId)this.dispose(track);
    const bus=this.ambiences;
    for(const sequence of bus.sequences.values())sequence.removeAsset(assetId);
    for(const [id,track] of bus.tracks)if(track.assetId===assetId){this.dispose(track);bus.tracks.delete(id);}
    for(const [id,job] of bus.jobs)if(job.layer.assetId===assetId){clearTimeout(job.timer);bus.jobs.delete(id);}
    if(bus.active){bus.active.layers=bus.active.layers.filter(l=>l.assetId!==assetId);bus.active.pads=bus.active.pads.filter(id=>id!==assetId);if(bus.active.music?.assetId===assetId)delete bus.active.music;}
    bus.refreshSources();
    if(this.active){const scene=this.active.scene,fired=new Set(scene.timeline.filter((_,i)=>this.fired.has(i)));removeSceneAudio(scene,assetId,this.asset(assetId)?.src);this.fired=new Set(scene.timeline.flatMap((event,i)=>fired.has(event)?[i]:[]));}
    if(this.preloadedMusic?.assetId===assetId)this.clearPreload();
    this.emit();
  }
  setLayerVolume(id,volume){const t=this.tracks.get(id);if(t)this.ramp(t,volume,.08);this.emit();}
  async toggleLibraryLayer(asset) {
    const key=`library:${asset.id}`;const active=this.tracks.get(key);
    if(active){this.retire(active,asset.fadeOut??.35);this.tracks.delete(key);this.emit();return;}
    const epoch=this.epoch;await this.init();if(epoch!==this.epoch)return;
    const t=await this.createTrack(asset,{loop:true,group:'ambience',volume:.65,fade:asset.fadeIn??.5,epoch});if(t)this.tracks.set(key,t);this.emit();
  }
  toggleTransport(){this.spotify.activate();if(this.running||this.spotify.playing||this.ytPlaying||this.music&&!this.music.audio.paused||this.ambiences.isPlaying||[...this.tracks.values()].some(t=>!t.audio.paused))this.pause();else this.resume().catch(e=>this.error(e.message));}
  async youtubeAPI() {
    if(window.YT?.Player)return;
    if(!this.apiPromise)this.apiPromise=new Promise((resolve,reject)=>{
      const previous=window.onYouTubeIframeAPIReady;
      const timeout=setTimeout(()=>{this.apiPromise=null;reject(new Error('O YouTube não carregou. Confira sua conexão ou bloqueador de conteúdo.'));},12000);
      window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);previous?.();resolve();};
      let script=document.getElementById('youtube-api');if(!script){script=document.createElement('script');script.id='youtube-api';script.src='https://www.youtube.com/iframe_api';document.head.appendChild(script);}
      script.onerror=()=>{clearTimeout(timeout);script.remove();this.apiPromise=null;reject(new Error('Não foi possível conectar ao YouTube.'));};
    });
    return this.apiPromise;
  }
  applyYTVolume(){if(this.ytReady){const s=this.getState().settings;this.yt.setVolume(Math.round(clamp(s.master)*clamp(s.music)*this.ytLevel*100));}}
  updateMediaSession(){if(!navigator.mediaSession)return;try{navigator.mediaSession.metadata=new MediaMetadata({title:this.musicAsset?.name||this.active?.scene.title||'CRIS Campaign Director',artist:this.active?.pageTitle||'Mesa do mestre'});navigator.mediaSession.setActionHandler('play',()=>this.resume());navigator.mediaSession.setActionHandler('pause',()=>this.pause());navigator.mediaSession.setActionHandler('stop',()=>this.stop());navigator.mediaSession.setActionHandler('nexttrack',()=>this.nextMusic());}catch{}}
}

Object.assign(AudioEngine.prototype,musicMethods);
