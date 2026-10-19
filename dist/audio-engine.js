import { resolveAsset, clone } from './storage.js';

const clamp = (n,min=0,max=1) => Math.max(min,Math.min(max,Number(n)||0));
export const formatTime = seconds => {const s=Math.max(0,Math.floor(seconds||0));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};

/** Instância única, independente da página/editor. Não é desmontada na navegação. */
export class AudioEngine extends EventTarget {
  constructor(getState) {
    super();this.getState=getState;this.tracks=new Map();this.retiring=new Set();this.effects=new Set();
    this.delays=new Set();this.epoch=0;this.musicEpoch=0;this.active=null;this.running=false;this.elapsed=0;this.fired=new Set();
    this.music=null;this.playlist=null;this.yt=null;this.ytReady=false;this.ytPlaying=false;this.ytLevel=1;this.pendingCue=null;
    this.timer=setInterval(()=>this.tick(),200);
  }
  emit(type='change',detail={}) {this.dispatchEvent(new CustomEvent(type,{detail}));}
  error(message){this.emit('error',{message});}
  async init() {
    if(!this.context) {
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)throw new Error('Este navegador não oferece o motor de áudio necessário.');
      this.context=new Context();this.master=this.context.createGain();this.master.connect(this.context.destination);
      this.groups={};for(const key of ['ambience','sfx','music']){const gain=this.context.createGain();gain.connect(this.master);this.groups[key]=gain;}
      this.applyMixer();
    }
    if(this.context.state==='suspended')await this.context.resume();
  }
  applyMixer() {
    const settings=this.getState().settings;
    if(this.context){this.master.gain.setTargetAtTime(clamp(settings.master),this.context.currentTime,.025);for(const key of ['music','ambience','sfx'])this.groups[key].gain.setTargetAtTime(clamp(settings[key]),this.context.currentTime,.025);}
    this.applyYTVolume();this.emit();
  }
  setMix(key,value){if(!['master','music','ambience','sfx'].includes(key))return;this.getState().settings[key]=clamp(value);this.applyMixer();}
  asset(id,src) {const found=this.getState().audioAssets.find(a=>a.id===id||a.src===src);return found || (src?{id:src,name:'Efeito',provider:'local',src,kind:'sfx'}:null);}
  later(callback,seconds,epoch=this.epoch){const timer=setTimeout(()=>{this.delays.delete(timer);if(this.epoch===epoch)callback();},Math.max(0,seconds)*1000);this.delays.add(timer);return timer;}
  clearDelays(){for(const timer of this.delays)clearTimeout(timer);this.delays.clear();}
  ramp(track,to,seconds=0) {
    if(!track||track.disposed)return;
    const t=this.context.currentTime,gain=track.gain.gain;track.volume=clamp(to);
    if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(t);else{const value=gain.value;gain.cancelScheduledValues(t);gain.setValueAtTime(value,t);}
    gain.linearRampToValueAtTime(track.volume,t+Math.max(0,Number(seconds)||0));
  }
  dispose(track) {
    if(!track||track.disposed)return;track.disposed=true;track.audio.pause();track.audio.removeAttribute('src');track.audio.load();
    try{track.source.disconnect();track.gain.disconnect();}catch{}
    this.effects.delete(track);this.retiring.delete(track);
  }
  retire(track,seconds=this.getState().settings.crossfade) {
    if(!track||track.disposed)return;this.retiring.add(track);this.ramp(track,0,seconds);
    this.later(()=>this.dispose(track),seconds+.04);
  }
  async createTrack(asset,{loop=false,volume=1,group='sfx',fade=0,epoch=this.epoch}={}) {
    const resolved=await resolveAsset(asset);if(epoch!==this.epoch)return null;
    const audio=new Audio(resolved.url||resolved.src);audio.preload='auto';audio.loop=loop;
    const source=this.context.createMediaElementSource(audio),gain=this.context.createGain();gain.gain.value=fade?0:clamp(volume);
    source.connect(gain);gain.connect(this.groups[group]||this.groups.sfx);
    const track={audio,source,gain,assetId:asset.id,name:asset.name,volume:clamp(volume),group,loop,disposed:false};
    audio.onerror=()=>{if(!track.disposed){this.error(`Não foi possível reproduzir “${asset.name}”.`);this.dispose(track);this.emit();}};
    try{await audio.play();}catch(error){this.dispose(track);throw new Error(error.name==='NotAllowedError'?'Toque novamente em reproduzir para liberar o áudio no navegador.':`Não foi possível reproduzir “${asset.name}”.`);}
    if(epoch!==this.epoch){this.dispose(track);return null;}
    if(fade)this.ramp(track,volume,fade);return track;
  }
  async startScene(scene,location) {
    if(this.active?.key===location.key) {
      if(this.running){this.pause();return;}
      if(this.paused){await this.resume();return;}
    }
    const epoch=++this.epoch;this.musicEpoch++;this.clearDelays();this.pendingCue=null;
    // Retiring tracks no longer depend on callbacks from the old generation.
    for(const track of this.retiring)this.dispose(track);
    await this.init();if(epoch!==this.epoch)return;
    const previous=this.tracks;this.tracks=new Map();
    this.active={...location,scene:clone(scene)};this.elapsed=0;this.startedAt=performance.now();this.running=true;this.paused=false;this.fired.clear();
    const fade=this.getState().settings.crossfade;
    const results=await Promise.allSettled(scene.layers.map(async layer=>{
      const asset=this.asset(layer.assetId,layer.src);if(!asset)throw new Error(`Arquivo da camada “${layer.name}” não encontrado.`);
      const prior=previous.get(layer.id);
      if(prior&&prior.assetId===asset.id&&!prior.disposed){previous.delete(layer.id);prior.audio.play().catch(e=>this.error(e.message));this.ramp(prior,layer.volume,fade);this.tracks.set(layer.id,prior);return;}
      const track=await this.createTrack(asset,{loop:true,volume:layer.volume,group:layer.group||'ambience',fade,epoch});
      if(track&&epoch===this.epoch)this.tracks.set(layer.id,track);
    }));
    for(const track of previous.values())this.retire(track,fade);
    if(epoch!==this.epoch)return;
    for(const r of results)if(r.status==='rejected')this.error(r.reason.message);
    if(scene.musicAssetId)await this.playMusic(this.asset(scene.musicAssetId),{fromScene:true});
    this.updateMediaSession();this.emit();
  }
  currentTime(){return this.running?this.elapsed+(performance.now()-this.startedAt)/1000:this.elapsed;}
  tick(){
    if(this.running&&this.active){const time=this.currentTime();this.active.scene.timeline.forEach((event,index)=>{if(!this.fired.has(index)&&event.at<=time){this.fired.add(index);this.executeEvent(event);}});}
    this.emit('tick',{time:this.currentTime()});
  }
  executeEvent(event) {
    if(event.action==='oneshot')this.oneShot(this.asset(event.assetId,event.src),.65).catch(e=>this.error(e.message));
    if(event.action==='fade')this.ramp(this.tracks.get(event.layer),event.to,event.duration||2);
    if(event.action==='cue'){const cue=this.active?.scene.cues?.find(c=>c.id===event.cueId);if(cue)this.fireCue(cue);}
    this.emit();
  }
  async oneShot(asset,volume=.8) {
    if(!asset)throw new Error('Este efeito não está na biblioteca.');
    if(asset.provider==='youtube')throw new Error('Use um arquivo de áudio para efeitos; links do YouTube ficam no canal de música.');
    const epoch=this.epoch;await this.init();if(epoch!==this.epoch)return;
    const track=await this.createTrack(asset,{volume,epoch});if(!track)return;
    this.effects.add(track);track.audio.onended=()=>{this.dispose(track);this.emit();};this.emit();
  }
  fireCue(cue) {
    if(!cue)return;this.pendingCue=cue.name;
    for(const action of cue.actions){const execute=()=>{
      if(action.type==='play')this.oneShot(this.asset(action.assetId),action.volume??.8).catch(e=>this.error(e.message));
      if(action.type==='fade')this.ramp(this.tracks.get(action.layerId),action.to,action.duration??1);
      if(action.type==='stop'){const track=this.tracks.get(action.layerId);if(track){this.dispose(track);this.tracks.delete(action.layerId);}}
      this.emit();
    };if(action.delay>0)this.later(execute,action.delay);else execute();}
    this.emit('cue',{id:cue.id,name:cue.name});this.emit();
  }
  async fireTrigger(trigger,scene) {
    if(!trigger)throw new Error('Este botão não tem um efeito ou uma cue configurada.');
    if(trigger.cue){const cue=scene.cues?.find(c=>c.id===(trigger.cueId||trigger.id));if(!cue)throw new Error('Configure as ações desta cue.');this.fireCue(cue);}
    else await this.oneShot(this.asset(trigger.assetId,trigger.src),trigger.volume??(trigger.id==='sino'?1:.8));
    this.emit('cue',{id:trigger.id,name:trigger.name});
  }
  pause() {
    if(this.running){this.elapsed=this.currentTime();this.running=false;}this.paused=true;
    // Delayed cue actions are discarded on pause; timeline resumes from elapsed time.
    this.clearDelays();for(const t of this.retiring)this.dispose(t);
    for(const t of [...this.tracks.values(),...this.effects])t.audio.pause();
    if(this.music)this.music.audio.pause();if(this.ytReady)this.yt.pauseVideo();this.ytPlaying=false;this.emit();
  }
  async resume() {
    await this.init();const results=await Promise.allSettled([...this.tracks.values(),...this.effects,...(this.music?[this.music]:[])].filter(t=>!t.disposed).map(t=>t.audio.play()));
    for(const r of results)if(r.status==='rejected')this.error('Toque em reproduzir para liberar o áudio.');
    if(this.musicAsset?.provider==='youtube'&&this.ytReady){this.yt.playVideo();this.ytPlaying=true;}
    if(this.active){this.running=true;this.startedAt=performance.now();}this.paused=false;this.emit();
  }
  stop() {
    this.epoch++;this.musicEpoch++;this.clearDelays();this.active=null;this.running=false;this.paused=false;this.elapsed=0;this.fired.clear();this.pendingCue=null;
    for(const t of [...this.tracks.values(),...this.effects,...this.retiring])this.dispose(t);this.tracks.clear();this.effects.clear();this.retiring.clear();
    if(this.music)this.dispose(this.music);this.music=null;this.musicAsset=null;this.playlist=null;
    if(this.ytReady)this.yt.stopVideo();this.ytPlaying=false;this.emit('silence');this.emit();
  }
  silence(){this.stop();}
  setLayerVolume(id,volume){const t=this.tracks.get(id);if(t)this.ramp(t,volume,.08);this.emit();}
  async toggleLibraryLayer(asset) {
    const key=`library:${asset.id}`;const active=this.tracks.get(key);
    if(active){this.retire(active,.35);this.tracks.delete(key);this.emit();return;}
    const epoch=this.epoch;await this.init();if(epoch!==this.epoch)return;
    const t=await this.createTrack(asset,{loop:true,group:'ambience',volume:.65,fade:.5,epoch});if(t)this.tracks.set(key,t);this.emit();
  }
  async playMusic(asset,{fromScene=false,playlist=null,index=0}={}) {
    if(!asset)throw new Error('Escolha uma faixa na biblioteca.');
    const generation=++this.musicEpoch,epoch=this.epoch;await this.init();if(generation!==this.musicEpoch||epoch!==this.epoch)return;
    const fade=this.getState().settings.crossfade;
    if(asset.provider==='youtube') {
      await this.loadYouTube(asset,()=>generation===this.musicEpoch&&epoch===this.epoch);if(generation!==this.musicEpoch||epoch!==this.epoch)return;
      if(this.music){this.retire(this.music,fade);this.music=null;}
    } else {
      const track=await this.createTrack(asset,{group:'music',volume:1,fade,epoch});
      if(!track)return;if(generation!==this.musicEpoch){this.dispose(track);return;}
      if(this.music)this.retire(this.music,fade);this.music=track;
      if(this.ytReady)this.yt.stopVideo();this.ytPlaying=false;
      track.audio.onended=()=>{if(this.music===track){this.dispose(track);this.music=null;if(this.playlist)this.nextMusic();else{this.musicAsset=null;this.emit();}}};
    }
    this.musicAsset=asset;this.playlist=playlist?{id:playlist.id,index}:null;this.paused=false;this.updateMediaSession();this.emit();
  }
  async playPlaylist(playlist,index=0) {
    const list=playlist.assetIds.map(id=>this.asset(id)).filter(Boolean);if(!list.length)throw new Error('Adicione faixas a esta playlist.');
    const safeIndex=((index%list.length)+list.length)%list.length;await this.playMusic(list[safeIndex],{playlist,index:safeIndex});
  }
  nextMusic(offset=1) {
    if(this.musicAsset?.provider==='youtube'&&this.musicAsset.playlistId&&this.ytReady){offset<0?this.yt.previousVideo():this.yt.nextVideo();return;}
    const playlist=this.getState().playlists.find(p=>p.id===this.playlist?.id);if(playlist)this.playPlaylist(playlist,this.playlist.index+offset).catch(e=>this.error(e.message));
  }
  toggleTransport(){if(this.running||this.ytPlaying||this.music&&!this.music.audio.paused||[...this.tracks.values()].some(t=>!t.audio.paused))this.pause();else this.resume().catch(e=>this.error(e.message));}
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
  async loadYouTube(asset,isCurrent=()=>true) {
    await this.youtubeAPI();if(!isCurrent())return;
    document.getElementById('youtubePanel').hidden=false;
    if(!this.ytReady) {
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('O player do YouTube não respondeu. Tente abrir novamente.')),15000);
        this.yt=new window.YT.Player('youtubePlayer',{height:'200',width:'100%',host:'https://www.youtube.com',playerVars:{playsinline:1,controls:1,origin:location.origin},events:{
          onReady:()=>{clearTimeout(timeout);this.ytReady=true;resolve();},
          onError:event=>{const messages={2:'Link de vídeo inválido.',5:'O navegador não conseguiu abrir o player.',100:'Vídeo removido ou privado.',101:'O autor não permite a reprodução incorporada.',150:'O autor não permite a reprodução incorporada.',153:'O YouTube recusou a identificação deste site.'};this.error(messages[event.data]||'Este vídeo não pode ser reproduzido no player.');this.ytPlaying=false;this.emit();},
          onAutoplayBlocked:()=>{this.ytPlaying=false;this.error('Toque no botão do player do YouTube para iniciar o vídeo.');this.emit();},
          onStateChange:event=>{this.ytPlaying=event.data===1;if(event.data===0&&!this.musicAsset?.playlistId&&this.playlist)this.nextMusic();this.emit();}
        }});
      });
    }
    if(!isCurrent())return;
    this.ytLevel=1;this.applyYTVolume();
    if(asset.playlistId)this.yt.loadPlaylist({list:asset.playlistId,listType:'playlist',index:0,startSeconds:asset.start||0});
    else this.yt.loadVideoById({videoId:asset.videoId,startSeconds:asset.start||0});
    this.ytPlaying=true;
  }
  applyYTVolume(){if(this.ytReady){const s=this.getState().settings;this.yt.setVolume(Math.round(clamp(s.master)*clamp(s.music)*this.ytLevel*100));}}
  closeYouTube(){if(this.ytReady)this.yt.stopVideo();this.ytPlaying=false;if(this.musicAsset?.provider==='youtube'){this.musicAsset=null;this.playlist=null;}document.getElementById('youtubePanel').hidden=true;this.emit();}
  updateMediaSession(){if(!navigator.mediaSession)return;try{navigator.mediaSession.metadata=new MediaMetadata({title:this.musicAsset?.name||this.active?.scene.title||'CRIS Campaign Director',artist:this.active?.pageTitle||'Mesa do mestre'});navigator.mediaSession.setActionHandler('play',()=>this.resume());navigator.mediaSession.setActionHandler('pause',()=>this.pause());navigator.mediaSession.setActionHandler('stop',()=>this.stop());navigator.mediaSession.setActionHandler('nexttrack',()=>this.nextMusic());}catch{}}
}
