import {resolveAsset} from './storage.js';
import {PlaylistOrder} from './playlist-order.js';
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,Number(n)||0));

/** Métodos da direção musical; um único player oficial de YouTube por shell. */
export const musicMethods={
  musicOptions(options={}){const s=this.getState().settings;return {...options,loop:options.loop!==false,fadeIn:clamp(options.fadeIn??s.musicFadeIn??s.crossfade,0,30),fadeOut:clamp(options.fadeOut??s.musicFadeOut??s.crossfade,0,30),volume:clamp(options.volume??1)};},
  async applySceneMusic(scene,{resume=false}={}){
    const music=scene.music||(scene.musicAssetId?{mode:'play',assetId:scene.musicAssetId}:{mode:'keep'});
    if(music.mode==='stop')return this.stopMusic(music.fadeOut??this.getState().settings.musicFadeOut);
    if(music.mode!=='play'){
      if(resume){if(this.musicAsset?.provider==='spotify')await this.spotify.resume({fadeIn:this.getState().settings.spotifyFadeIn});if(this.music&&!this.music.disposed)await this.music.audio.play();if(this.musicAsset?.provider==='youtube'&&this.ytReady){this.youtubeHardStopped=false;this.ytPendingFade={duration:.35,level:this.musicTargetLevel,generation:this.musicEpoch};this.ytLevel=0;this.applyYTVolume();this.yt.playVideo();}}
      return;
    }
    const playlist=this.getState().playlists.find(p=>p.id===music.playlistId);
    if(playlist)return this.playPlaylist(playlist,playlist.shuffle?null:music.index||0,music);
    const asset=this.asset(music.assetId);return this.playMusic(asset,asset?.shuffle?{...music,youtubeIndex:undefined}:music);
  },
  async playMusic(asset,options={}){
    if(!asset)throw new Error('Escolha uma faixa na biblioteca.');
    if(asset.provider==='spotify')this.spotify.activate();
    const opts=this.musicOptions(options),generation=++this.musicEpoch,isCurrent=()=>generation===this.musicEpoch&&!this.removedAssets.has(asset.id)&&(opts.ambienceMusicToken===undefined||this.ambiences.active?.id===opts.ambienceOwnerId&&this.ambiences.musicToken===opts.ambienceMusicToken);
    if(asset.provider==='spotify'){opts.fadeIn=options.fadeIn??this.getState().settings.spotifyFadeIn;opts.fadeOut=options.fadeOut??this.getState().settings.spotifyFadeOut;}
    this.ytTransitionEpoch=generation;this.ytEnded=false;this.ytEndFadeKey=null;this.ytLastPosition=null;this.ytRampInfo=null;this.ytEnvelope.cancel();this.musicAdvancePending=this.music;if(asset.provider!=='spotify')await this.init();if(!isCurrent())return;
    if(asset.provider!=='spotify'&&(this.spotify.acceptPlayback||this.musicAsset?.provider==='spotify')){await this.spotify.pause({fadeOut:options.fadeOut??this.getState().settings.spotifyFadeOut});if(!isCurrent())return;}
    if(asset.provider==='spotify'){
      await this.spotify.ensure();if(!isCurrent())return;
      if(this.music){this.dispose(this.music);this.music=null;}for(const track of [...this.retiring])if(track.group==='music')this.dispose(track);
      if(this.yt){this.youtubeHardStopped=true;this.releaseYouTubePlayer();const panel=document.getElementById('youtubePanel');if(panel)panel.hidden=true;}
      this.musicTargetLevel=opts.volume;const s=this.getState().settings;opts.outputVolume=clamp(s.master)*clamp(s.music)*clamp(s.spotifyVolume??1)*opts.volume;if(!this.spotify.playing)await this.spotify.setVolume(opts.outputVolume);if(!isCurrent())return;
      if(!await this.spotify.play(asset,opts,isCurrent)||!isCurrent())return;
    }else if(asset.provider==='youtube'){
      const wasPlaying=this.ytPlaying;
      if(wasPlaying){const faded=await this.ytEnvelope.fade(0,opts.fadeOut,isCurrent);if(!faded||!isCurrent())return;}
      if(!isCurrent())return;
      if(!await this.loadYouTube(asset,isCurrent,{...opts,generation})||!isCurrent())return;
      // A faixa local só sai quando o novo vídeo realmente começar a tocar.
      if(this.music&&this.ytPendingFade)this.ytPendingFade.retireMusic=this.music;
    }else{
      const track=await this.createTrack(asset,{group:'music',loop:opts.loop&&!opts.playlist,volume:opts.volume,fade:opts.fadeIn,epoch:this.epoch,startSeconds:opts.startSeconds??asset.start??0});
      if(!track)return;if(!isCurrent()){this.dispose(track);return;}
      if(this.music)this.retire(this.music,opts.fadeOut);this.music=track;
      if(this.ytReady&&this.ytPlaying){this.ytEnvelope.fade(0,opts.fadeOut,isCurrent).then(done=>{if(done&&isCurrent()){this.yt.stopVideo();this.ytPlaying=false;this.emit();}});}
      track.audio.onended=()=>{if(this.music!==track)return;this.dispose(track);this.music=null;if(this.musicAsset?.id===asset.id){if(this.playlist)this.nextMusic();else{this.musicAsset=null;this.emit();}}};
    }
    this.musicAsset=asset;this.musicTargetLevel=opts.volume;this.musicFadeOptions=opts;
    this.playlist=opts.playlist?{id:opts.playlist.id,index:opts.index||0}:null;if(!this.playlist)this.musicOrder=null;this.paused=false;this.musicAdvancePending=null;this.ytTransitionEpoch=null;this.preloadNextMusic();this.updateMediaSession();this.emit();
  },
  playlistItems(playlist){return [...new Set(playlist.assetIds)].map(id=>this.asset(id)).filter(a=>a&&!this.removedAssets.has(a.id));},
  playlistOrder(playlist){
    const ids=this.playlistItems(playlist).map(a=>a.id);
    if(!this.musicOrder?.matches(ids,playlist.shuffle===true))this.musicOrder=new PlaylistOrder(ids,{shuffle:playlist.shuffle===true,currentId:this.musicAsset?.id});
    return this.musicOrder;
  },
  async playPlaylist(playlist,index=null,options={}){
    const list=this.playlistItems(playlist);if(!list.length)throw new Error('Adicione faixas a esta playlist.');
    const selected=index==null?null:list[((index%list.length)+list.length)%list.length].id;
    this.musicOrder=new PlaylistOrder(list.map(a=>a.id),{shuffle:playlist.shuffle===true,currentId:selected});
    const id=selected||this.musicOrder.next(),safeIndex=list.findIndex(a=>a.id===id);
    return this.playMusic(list[safeIndex],{...options,playlist,index:safeIndex});
  },
  refreshPlaylist(playlist){
    if(this.playlist?.id===playlist.id){this.playlist.index=this.playlistItems(playlist).findIndex(a=>a.id===this.musicAsset?.id);this.playlistOrder(playlist);this.preloadNextMusic();this.emit();}
  },
  nextMusic(offset=1){
    if(this.musicAsset?.provider==='spotify'&&!this.playlist)return this.spotify.next(offset,{fadeIn:this.getState().settings.spotifyFadeIn,fadeOut:this.getState().settings.spotifyFadeOut}).catch(error=>this.error(error.message));
    if(this.musicAsset?.provider==='youtube'&&this.musicAsset.playlistId&&this.ytReady){const queue=this.yt.getPlaylist?.()||[];const current=this.yt.getPlaylistIndex?.()||0;const index=queue.length?((current+offset)%queue.length+queue.length)%queue.length:Math.max(0,current+offset);return this.playMusic(this.musicAsset,{...this.musicFadeOptions,youtubeIndex:index,youtubeVideoId:queue[index]}).catch(e=>this.error(e.message));}
    const playlist=this.getState().playlists.find(p=>p.id===this.playlist?.id);if(playlist){const list=this.playlistItems(playlist),order=this.playlistOrder(playlist),id=offset<0?order.previous():order.next(),index=list.findIndex(a=>a.id===id);if(index<0)return this.stopMusic(0);return this.playMusic(list[index],{...this.musicFadeOptions,playlist,index}).catch(e=>this.error(e.message));}
  },
  async stopMusic(seconds=this.getState().settings.musicFadeOut??2){
    const generation=++this.musicEpoch;this.ytTransitionEpoch=generation;this.ytEnded=false;this.ytEndFadeKey=null;this.ytLastPosition=null;this.ytPendingFade=null;this.ytRampInfo=null;this.ytEnvelope.cancel();this.clearPreload();
    if(this.spotify.acceptPlayback||this.musicAsset?.provider==='spotify'){await this.spotify.pause({fadeOut:seconds});if(generation!==this.musicEpoch)return;}
    if(this.music){this.retire(this.music,seconds);this.music=null;}
    if(this.ytReady){const complete=await this.ytEnvelope.fade(0,seconds,()=>generation===this.musicEpoch);if(!complete)return;this.yt.stopVideo();this.ytPlaying=false;}
    if(generation===this.musicEpoch){this.youtubeHardStopped=true;this.musicAsset=null;this.playlist=null;this.musicOrder=null;this.musicAdvancePending=null;this.ytTransitionEpoch=null;this.emit();}
  },
  setMusicLoop(enabled){if(!this.musicAsset)return;this.musicFadeOptions??=this.musicOptions();this.musicFadeOptions.loop=enabled===true;if(this.musicAsset.provider==='spotify')this.spotify.repeat(!this.playlist&&enabled===true).catch(error=>this.error(error.message));if(this.music&&!this.playlist)this.music.audio.loop=enabled===true;this.emit();},
  startYouTubeFade(level,duration,generation=this.musicEpoch){
    const ramp={level,duration:duration||0,startedAt:performance.now()};this.ytRampInfo=ramp;
    this.ytEnvelope.fade(level,duration,()=>generation===this.musicEpoch&&!!this.youtubeAsset&&!this.youtubeHardStopped).then(done=>{if(done&&this.ytRampInfo===ramp)this.ytRampInfo=null;});
  },
  recoverYouTubeEndFade(){
    if(!this.ytEndFadeKey&&!this.ytEnded)return;
    this.ytEndFadeKey=null;this.ytEnded=false;this.ytRampInfo=null;this.ytEnvelope.cancel();
    if(this.ytPlaying&&!this.ytPendingFade&&this.ytTransitionEpoch!==this.musicEpoch)this.startYouTubeFade(this.musicTargetLevel,.2);
  },
  applySpotifyVolume(){const s=this.getState().settings;return this.spotify?.setVolume(clamp(s.master)*clamp(s.music)*clamp(s.spotifyVolume??1)*this.musicTargetLevel);},
  fadeMusicTo(volume,seconds=2){this.musicTargetLevel=clamp(volume);if(this.musicAsset?.provider==='spotify')this.applySpotifyVolume();if(this.ytPendingFade)this.ytPendingFade.level=this.musicTargetLevel;if(this.musicFadeOptions)this.musicFadeOptions.volume=this.musicTargetLevel;if(this.music)this.ramp(this.music,this.musicTargetLevel,seconds);if(this.ytReady&&!this.ytPendingFade&&this.musicAsset?.provider==='youtube')this.ytEnvelope.fade(this.musicTargetLevel,seconds,()=>!!this.musicAsset);this.emit();},
  fadeMix(group,to,seconds=2){
    if(!['master','music','ambience','sfx'].includes(group))return;
    this.mixEnvelopes??={};if(!this.mixEnvelopes[group])this.mixEnvelopes[group]=new this.Envelope(()=>this.getState().settings[group],v=>this.setMix(group,v));
    this.mixEnvelopes[group].fade(to,seconds).then(()=>this.emit('settings'));this.emit('settings');
  },
  clearPreload(){this.preloadEpoch=(this.preloadEpoch||0)+1;if(this.preloadedMusic){this.preloadedMusic.audio.pause();this.preloadedMusic.audio.removeAttribute('src');this.preloadedMusic.audio.load();this.preloadedMusic=null;}},
  async preloadNextMusic(){
    this.clearPreload();const generation=this.preloadEpoch;const playlist=this.getState().playlists.find(p=>p.id===this.playlist?.id);if(!playlist)return;
    const asset=this.asset(this.playlistOrder(playlist).peek());if(!asset||['youtube','spotify'].includes(asset.provider))return;
    try{const value=await resolveAsset(asset);if(generation!==this.preloadEpoch||this.removedAssets.has(asset.id))return;const audio=new Audio(value.url||value.src);audio.preload='auto';audio.load();this.preloadedMusic={assetId:asset.id,audio};}catch{}
  },
  tickMusic(){
    if(this.paused)return;const opts=this.musicFadeOptions||this.musicOptions();
    if(this.music&&this.playlist&&this.getState().settings.autoAdvance!==false&&!this.music.audio.paused&&!this.music.disposed){
      const remaining=this.music.audio.duration-this.music.audio.currentTime;
      if(Number.isFinite(remaining)&&remaining>0&&remaining<=Math.max(opts.fadeIn,opts.fadeOut)&&this.musicAdvancePending!==this.music){this.musicAdvancePending=this.music;this.nextMusic();}
    }
    if(this.ytReady&&this.ytPlaying&&this.musicAsset?.provider==='youtube'&&!this.ytPendingFade&&this.ytTransitionEpoch!==this.musicEpoch){
      const position=this.yt.getCurrentTime?.()||0,remaining=(this.yt.getDuration?.()||0)-position,id=this.yt.getVideoData?.()?.video_id,prior=this.ytLastPosition;
      if(this.ytEndFadeKey&&(this.ytEndFadeKey!==id||remaining>opts.fadeOut+.25||prior?.id===id&&position<prior.time-.5))this.recoverYouTubeEndFade();
      this.ytLastPosition={id,time:position};
      if(id&&remaining>0&&remaining<=opts.fadeOut&&this.ytEndFadeKey!==id){const generation=this.musicEpoch;this.ytEndFadeKey=id;this.ytRampInfo=null;this.ytEnvelope.fade(0,remaining,()=>generation===this.musicEpoch&&this.ytPlaying&&this.ytEndFadeKey===id&&this.yt.getVideoData?.()?.video_id===id);}
    }
  },
  async ensureYouTube(isCurrent=()=>true){
    const windowGeneration=this.youtubeWindowGeneration||0;
    await this.youtubeAPI();if(!isCurrent()||windowGeneration!==(this.youtubeWindowGeneration||0))return false;
    const panel=document.getElementById('youtubePanel');if(panel)panel.hidden=false;
    if(!this.ytReady){
      if(!this.playerPromise)this.playerPromise=new Promise((resolve,reject)=>{
        const playerGeneration=this.youtubeWindowGeneration||0,current=()=>playerGeneration===(this.youtubeWindowGeneration||0);
        this.cancelPlayerInit=()=>resolve(false);
        this.playerInitTimeout=setTimeout(()=>{reject(new Error('O player do YouTube não respondeu. Tente novamente.'));this.releaseYouTubePlayer();},15000);
        this.yt=new window.YT.Player('youtubePlayer',{height:'200',width:'100%',host:'https://www.youtube.com',playerVars:{playsinline:1,controls:1,origin:location.origin},events:{
          onReady:()=>{if(!current())return;clearTimeout(this.playerInitTimeout);this.cancelPlayerInit=null;this.ytReady=true;resolve(true);},
          onError:event=>{if(!current())return;const messages={2:'Link de vídeo inválido.',5:'O navegador não conseguiu abrir o player.',100:'Vídeo removido ou privado.',101:'O autor não permite incorporação.',150:'O autor não permite incorporação.',153:'O YouTube recusou a identificação deste site.'};this.error(messages[event.data]||'Este vídeo não pode ser reproduzido no player.');this.ytEnvelope.cancel();this.ytPendingFade=null;this.ytPlaying=false;this.emit();},
          onAutoplayBlocked:()=>{if(!current())return;this.ytPlaying=false;this.error('Toque no play do vídeo para liberar a reprodução. O fade começa quando ele tocar.');this.emit();},
          onStateChange:event=>{if(current())this.handleYouTubeState(event.data);}
        }});
      });
      if(!await this.playerPromise)return false;
    }
    return isCurrent()&&windowGeneration===(this.youtubeWindowGeneration||0);
  },
  async loadYouTube(asset,isCurrent=()=>true,options={}){
    if(!await this.ensureYouTube(isCurrent)||!isCurrent())return false;
    this.youtubePreviewOnly=false;this.youtubeHardStopped=false;this.youtubeAsset=asset;this.currentYouTubeTitle=null;this.ytEnvelope.cancel();this.ytLevel=0;this.applyYTVolume();
    this.ytPendingFade={duration:options.fadeIn??this.getState().settings.musicFadeIn??2.5,fadeOut:options.fadeOut??2.5,level:options.volume??1,generation:options.generation??this.musicEpoch};
    let index=Math.max(0,options.youtubeIndex??asset.youtubeIndex??0);const startSeconds=options.startSeconds??asset.start??0;
    this.ytRequestedVideoId=null;this.ytRandomStartPending=false;
    if(asset.playlistId){
      const loaded=this.ytLoadedPlaylist===asset.playlistId&&this.yt.getPlaylist?.()?.length,ids=loaded?this.yt.getPlaylist():[];
      let videoId=options.youtubeVideoId||(options.youtubeIndex!=null?asset.youtubeTracks?.[index]?.videoId:null);
      if(asset.shuffle&&options.youtubeIndex==null&&!videoId){if(ids.length)videoId=ids[Math.floor(Math.random()*ids.length)];else this.ytRandomStartPending=true;}
      if(loaded&&this.yt.playVideoAt){if(videoId&&ids.includes(videoId))index=ids.indexOf(videoId);this.yt.playVideoAt(index);}
      else{this.ytRequestedVideoId=videoId;this.ytShuffleApplied=null;this.yt.loadPlaylist({list:asset.playlistId,listType:'playlist',index,startSeconds});}
      this.ytLoadedPlaylist=asset.playlistId;
    }else{this.ytLoadedPlaylist=null;this.ytShuffleApplied=null;this.yt.loadVideoById({videoId:asset.videoId,startSeconds});}
    this.ytPlaying=false;return true;
  },
  setYouTubeShuffle(asset,enabled){asset.shuffle=enabled===true;if(this.youtubeAsset?.id===asset.id){this.syncYouTubeShuffle();this.readYouTubeQueue();this.emit();}},
  syncYouTubeShuffle(){
    const asset=this.youtubeAsset;if(!asset?.playlistId||this.ytLoadedPlaylist!==asset.playlistId||!this.ytReady||!this.yt.getPlaylist?.()?.length)return;
    const key=asset.playlistId+':'+(asset.shuffle===true);
    if(this.ytShuffleApplied===key)return;
    this.yt.setShuffle?.(asset.shuffle===true);this.yt.setLoop?.(true);this.ytShuffleApplied=key;
  },
  handleYouTubeState(code){
    if(code===1&&this.youtubeHardStopped){if(this.ytReady)this.yt.stopVideo();this.ytPlaying=false;this.emit();return;}
    const wasPlaying=this.ytPlaying;this.ytPlaying=code===1;
    if([2,3].includes(code)&&this.ytRampInfo&&this.ytEnvelope.pending){
      const ramp=this.ytRampInfo;this.ytEnvelope.cancel();this.ytPendingFade={duration:Math.max(.1,ramp.duration-(performance.now()-ramp.startedAt)/1000),level:ramp.level,generation:this.musicEpoch};this.ytRampInfo=null;
    }
    if(code===1){
      if(this.youtubeAsset?.playlistId){
        const ids=this.yt.getPlaylist?.()||[];
        if(this.ytRandomStartPending&&ids.length){this.ytRequestedVideoId=ids[Math.floor(Math.random()*ids.length)];this.ytRandomStartPending=false;}
        const requested=this.ytRequestedVideoId;this.ytRequestedVideoId=null;
        if(requested&&ids.includes(requested)&&this.yt.getVideoData?.()?.video_id!==requested){this.ytPlaying=false;this.ytLevel=0;this.applyYTVolume();this.yt.playVideoAt(ids.indexOf(requested));return;}
        this.syncYouTubeShuffle();
      }
      if(this.youtubePreviewOnly&&this.youtubeAsset){this.youtubePreviewOnly=false;this.musicEpoch++;this.musicAsset=this.youtubeAsset;this.playlist=null;this.musicTargetLevel=1;this.musicFadeOptions=this.musicOptions();this.ytPendingFade={duration:this.musicFadeOptions.fadeIn,fadeOut:this.musicFadeOptions.fadeOut,level:1,generation:this.musicEpoch,retireMusic:this.music};}
      const data=this.yt.getVideoData?.()||{},id=data.video_id;if(data.title)this.currentYouTubeTitle=data.title;
      const remaining=(this.yt.getDuration?.()||0)-(this.yt.getCurrentTime?.()||0);
      if(this.ytEnded||this.ytEndFadeKey&&(id!==this.ytEndFadeKey||remaining>(this.musicFadeOptions?.fadeOut??0)+.25))this.recoverYouTubeEndFade();
      if(id&&id!==this.ytLastVideoId&&!this.ytPendingFade){this.ytEnvelope.cancel();this.ytLevel=0;this.applyYTVolume();this.ytPendingFade={duration:this.musicFadeOptions?.fadeIn??this.getState().settings.musicFadeIn,level:this.musicTargetLevel,generation:this.musicEpoch};}
      if(id)this.ytLastVideoId=id;
      const pending=this.ytPendingFade;
      if(pending&&pending.generation===this.musicEpoch){this.ytPendingFade=null;this.ytEndFadeKey=null;this.ytEnded=false;if(pending.retireMusic){this.retire(pending.retireMusic,pending.fadeOut);if(this.music===pending.retireMusic)this.music=null;}this.startYouTubeFade(pending.level,pending.duration,pending.generation);}
      this.readYouTubeQueue();this.emit('youtubetrack',{assetId:this.youtubeAsset?.id,videoId:id,title:data.title||'',index:this.yt.getPlaylistIndex?.()??0});
    }
    if(code===5){this.queueRevision=(this.queueRevision||0)+1;this.syncYouTubeShuffle();this.readYouTubeQueue();}
    if(code===0&&this.musicAsset?.provider==='youtube'&&!this.youtubeHardStopped&&this.ytTransitionEpoch!==this.musicEpoch&&!this.ytPendingFade){
      this.ytEnded=true;this.ytRampInfo=null;this.ytEnvelope.cancel();
      if(!this.musicAsset.playlistId){
        if(this.playlist)this.nextMusic();
        else if(wasPlaying&&this.musicFadeOptions?.loop!==false&&!this.ytRestartPending){
          const pending=this.playMusic(this.musicAsset,{...this.musicFadeOptions}).catch(error=>this.error(error.message)).finally(()=>{if(this.ytRestartPending===pending)this.ytRestartPending=null;});this.ytRestartPending=pending;
        }
      }
    }
    this.emit();
  },
  readYouTubeQueue(){
    const asset=this.youtubeAsset;if(!asset?.playlistId)return [];
    const ids=(this.yt.getPlaylist?.()||[]).filter(id=>/^[\w-]{11}$/.test(id));if(!ids.length)return [];
    const previous=asset.youtubeTracks||[],data=this.yt.getVideoData?.()||{};
    const items=ids.map((id,index)=>({videoId:id,alias:previous.find(t=>t.videoId===id)?.alias||'',title:data.video_id===id&&data.title?data.title:previous.find(t=>t.videoId===id)?.title||`Faixa ${String(index+1).padStart(2,'0')}`}));
    this.youtubeQueue=items;this.emit('youtubequeue',{assetId:asset.id,items,index:this.yt.getPlaylistIndex?.()??0});return items;
  },
  async inspectYouTubePlaylist(asset){
    if(!asset?.playlistId)throw new Error('Este link não contém uma playlist.');
    const request=++this.inspectEpoch,isCurrent=()=>request===this.inspectEpoch;
    if(!await this.ensureYouTube(isCurrent)||!isCurrent())return [];
    if(this.youtubeAsset?.id===asset.id&&this.ytLoadedPlaylist===asset.playlistId){const current=this.readYouTubeQueue();if(current.length)return current;}
    if(this.ytPlaying)await this.stopMusic(this.getState().settings.musicFadeOut);
    if(!isCurrent())return [];
    this.youtubePreviewOnly=true;this.youtubeHardStopped=false;this.youtubeAsset=asset;this.ytLoadedPlaylist=asset.playlistId;this.ytShuffleApplied=null;this.ytRequestedVideoId=null;this.ytRandomStartPending=false;this.ytPendingFade=null;this.ytLevel=0;this.applyYTVolume();const revision=this.queueRevision||0;this.yt.cuePlaylist({list:asset.playlistId,listType:'playlist',index:0});
    for(let i=0;i<40&&isCurrent();i++){const items=(this.queueRevision||0)>revision?this.readYouTubeQueue():[];if(items.length)return items;await new Promise(resolve=>setTimeout(resolve,200));}
    if(!isCurrent())return [];throw new Error('O player ainda não disponibilizou a lista. Confira se a playlist é pública e tente “Atualizar lista”.');
  },
  releaseYouTubePlayer(){
    // Invalidar callbacks antes de destruir o iframe; reabrir cria somente um novo player.
    this.youtubeWindowGeneration=(this.youtubeWindowGeneration||0)+1;
    clearTimeout(this.playerInitTimeout);this.cancelPlayerInit?.();this.cancelPlayerInit=null;
    const player=this.yt;this.yt=null;this.ytReady=false;this.playerPromise=null;this.ytPlaying=false;
    try{player?.destroy?.();}catch{}
    this.ytLoadedPlaylist=null;this.ytShuffleApplied=null;this.ytLastVideoId=null;this.youtubeAsset=null;this.youtubeQueue=[];this.currentYouTubeTitle=null;
    const panel=document.getElementById('youtubePanel');
    if(panel){
      const remaining=document.getElementById('youtubePlayer');remaining?.remove();
      const placeholder=document.createElement('div');placeholder.id='youtubePlayer';panel.insertBefore(placeholder,panel.querySelector('.youtube-hint'));
    }
  },
  closeYouTube(){this.youtubePreviewOnly=false;this.youtubeHardStopped=true;this.inspectEpoch++;if(this.musicAsset?.provider==='youtube'){this.musicEpoch++;this.musicAsset=null;this.playlist=null;this.musicOrder=null;}this.ytEnvelope.cancel();this.ytPendingFade=null;this.ytRampInfo=null;this.releaseYouTubePlayer();const panel=document.getElementById('youtubePanel');if(panel)panel.hidden=true;this.updateMediaSession();this.emit();},
};
