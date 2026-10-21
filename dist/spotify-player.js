import {SpotifyAuth,parseSpotify} from './spotify-auth.js';
import {VolumeEnvelope} from './volume-envelope.js';
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
let sdkPromise;
function loadSDK(){
  if(window.Spotify?.Player)return Promise.resolve();
  if(!sdkPromise)sdkPromise=new Promise((resolve,reject)=>{
    const previous=window.onSpotifyWebPlaybackSDKReady,script=document.createElement('script');script.src='https://sdk.scdn.co/spotify-player.js';script.async=true;
    const timer=setTimeout(()=>{sdkPromise=null;script.remove();reject(Error('O Spotify demorou para carregar. Confira a conexão e tente novamente.'));},20000);
    window.onSpotifyWebPlaybackSDKReady=()=>{clearTimeout(timer);previous?.();resolve();};
    script.onerror=()=>{clearTimeout(timer);sdkPromise=null;script.remove();reject(Error('O navegador bloqueou o player Spotify.'));};document.head.appendChild(script);
  });return sdkPromise;
}
/** Transporte oficial, separado do Web Audio e dos arquivos locais. */
export class SpotifyPlayer extends EventTarget{
  constructor({auth=new SpotifyAuth(),fetcher=(...args)=>fetch(...args),sdk=loadSDK,now=()=>performance.now()}={}){super();Object.assign(this,{auth,fetcher,sdk,now});this.operation=0;this.playing=false;this.acceptPlayback=false;this.queue=Promise.resolve();this.volume=1;this.level=1;this.repeatMode='off';this.positionAnchor=0;this.positionUpdatedAt=now();this.envelope=new VolumeEnvelope(()=>this.level,value=>{this.level=value;this.writeVolume();});}
  get audible(){return this.playing||this.acceptPlayback&&this.state?.paused!==true;}
  position(){const elapsed=this.playing&&!this.state?.loading?Math.max(0,this.now()-this.positionUpdatedAt):0,duration=Number(this.state?.duration||this.track?.duration_ms)||Infinity;return Math.min(duration,Math.max(0,this.positionAnchor+elapsed));}
  freezePosition(){this.positionAnchor=this.position();this.positionUpdatedAt=this.now();}
  tick(){if(!this.playing||!this.player?.getCurrentState||this.positionSyncing||this.now()<(this.nextPositionSync||0))return;this.nextPositionSync=this.now()+5000;this.positionSyncing=this.refreshState(this.operation).catch(()=>{}).finally(()=>{this.positionSyncing=null;});}
  cancelFade(){this.envelope.cancel();this.pendingFade=null;}
  async writeVolume(){
    this.volumeWanted=clamp(this.volume*this.level);
    if(this.volumeWriting)return this.volumeWriting;
    const player=this.player;if(!player)return;
    this.volumeWriting=(async()=>{
      while(this.volumeWanted!==undefined&&this.player===player){const value=this.volumeWanted;this.volumeWanted=undefined;await player.setVolume(value);}
    })().catch(()=>this.fail('Não foi possível ajustar o volume Spotify.')).finally(()=>{this.volumeWriting=null;if(this.volumeWanted!==undefined&&this.player===player)return this.writeVolume();});
    return this.volumeWriting;
  }
  beginFadeIn(seconds,operation,uri=null){this.pendingFade={seconds,operation,uri};this.fadeIfPlaying();}
  fadeIfPlaying(){
    const pending=this.pendingFade;if(!pending||pending.operation!==this.operation||!this.acceptPlayback||this.state?.paused!==false||pending.uri&&this.track?.uri!==pending.uri)return;
    this.pendingFade=null;this.envelope.fade(1,pending.seconds,()=>pending.operation===this.operation&&this.acceptPlayback);
  }
  emit(){this.dispatchEvent(new Event('change'));}
  fail(message){this.lastError=message;this.emit();}
  async api(path,{method='GET',body,retry=true}={}){
    if(!path.startsWith('/')||path.startsWith('//')||path.includes('://'))throw Error('Endereço da API Spotify inválido.');
    if(this.retryAt>Date.now())throw Error('O Spotify pediu uma pausa. Aguarde alguns segundos antes de tentar novamente.');
    const token=await this.auth.token(),r=await this.fetcher('https://api.spotify.com/v1'+path,{method,signal:globalThis.AbortSignal?.timeout?.(15000),headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}).catch(()=>{throw Error('O Spotify não respondeu. Confira a conexão e tente novamente.');});
    if(r.status===401&&retry){await this.auth.token(true);return this.api(path,{method,body,retry:false});}
    if(r.status===429){this.retryAt=Date.now()+Math.max(1,Number(r.headers.get('Retry-After'))||5)*1000;throw Error('Limite temporário do Spotify. Aguarde antes de tentar novamente.');}
    if(!r.ok){const playlistRead=method==='GET'&&path.startsWith('/playlists/');const message=playlistRead&&[403,404].includes(r.status)?'O Spotify não disponibilizou esta playlist para consulta pelo CRIS. Playlists editoriais podem ter acesso limitado pela API.':r.status===403?'O Spotify recusou o acesso. Confira Premium, permissões e Users Management do aplicativo no Dashboard.':r.status===404?(path.startsWith('/me/player')?(body?.context_uri?'O Spotify não conseguiu iniciar esta playlist. Confira se ela abre na sua conta e se o player CRIS está ativo. Algumas playlists têm acesso limitado à integração.':'O Spotify não encontrou o player ativo. Ative o player pela lateral e tente novamente.'):'O Spotify não encontrou este item na consulta. Confira o link e o acesso da sua conta.'):'O Spotify não concluiu a operação ('+r.status+').';const error=Error(message);error.status=r.status;throw error;}
    // Comandos podem confirmar sucesso sem JSON (inclusive com HTTP 200).
    if(method!=='GET'||r.status===204)return null;
    try{return await r.json();}catch{throw Error('O Spotify retornou uma resposta de dados inválida. Tente atualizar a lista.');}
  }
  async pages(path){const items=[],seen=new Set();let next=path;
    while(next){if(seen.has(next))throw Error('O Spotify repetiu uma página da lista.');seen.add(next);const page=await this.api(next);items.push(...(page.items||[]));
      if(page.next){const url=new URL(page.next);if(url.origin!=='https://api.spotify.com'||!url.pathname.startsWith('/v1/'))throw Error('Paginação Spotify inválida.');next=url.pathname.slice(3)+url.search;}else next=null;
    }return items;
  }
  playlists(){return this.pages('/me/playlists?limit=50');}
  async playlistTracks(id){if(!/^[a-zA-Z0-9]{22}$/.test(id))throw Error('Playlist inválida.');const items=await this.pages('/playlists/'+id+'/items?limit=50');return items.map(row=>row.item??row.track).filter(t=>t?.type==='track'&&!t.is_local&&t.is_playable!==false);}
  metadata(uri){const parsed=parseSpotify(uri);return this.api('/'+(parsed.type==='track'?'tracks':'playlists')+'/'+parsed.id);}
  activate(){if(this.player)this.player.activateElement().catch(()=>{});}
  async ensure(){
    if(!this.auth.connected)throw Error('Conecte sua conta pelo botão Spotify da lateral.');
    if(this.deviceId)return this.deviceId;
    if(this.initializing)return this.initializing;
    const generation=this.connectionGeneration||0;
    this.initializing=(async()=>{await this.sdk();if(generation!==(this.connectionGeneration||0))throw Error('Preparação do Spotify cancelada.');
      if(this.player){this.player.disconnect();this.player=null;}
      return new Promise((resolve,reject)=>{
        const player=new window.Spotify.Player({name:'CRIS Campaign Director',volume:this.volume,getOAuthToken:callback=>this.auth.token().then(callback).catch(error=>this.fail(error.message))});this.player=player;
        const timer=setTimeout(()=>{player.disconnect();if(this.player===player){this.player=null;this.initializing=null;}reject(Error('O player não ficou pronto. Confira Premium, bloqueador de conteúdo e permissões do navegador.'));},20000);
        this.cancelInit=()=>{clearTimeout(timer);reject(Error('Preparação do Spotify cancelada.'));};
        const failed=message=>{if(this.player!==player)return;this.fail(message);clearTimeout(timer);this.initializing=null;this.cancelInit=null;player.disconnect();this.player=null;this.deviceId=null;reject(Error(message));};
        player.addListener('ready',({device_id})=>{if(this.player!==player)return;clearTimeout(timer);this.cancelInit=null;this.deviceId=device_id;this.lastError=null;this.emit();resolve(device_id);});
        player.addListener('not_ready',()=>{if(this.player!==player)return;this.deviceId=null;this.initializing=null;this.freezePosition();this.playing=false;this.fail('O player Spotify ficou offline. Prepare novamente.');});
        player.addListener('initialization_error',()=>failed('Este navegador não conseguiu abrir o áudio protegido do Spotify.'));
        player.addListener('authentication_error',()=>failed('A conexão Spotify expirou. Desconecte e conecte novamente.'));
        player.addListener('account_error',()=>failed('O Spotify não confirmou uma assinatura Premium nesta conta.'));
        player.addListener('autoplay_failed',()=>this.fail('Clique novamente em reproduzir para liberar o áudio Spotify neste navegador.'));
        player.addListener('player_state_changed',state=>{if(this.player===player)this.receiveState(state);});
        player.connect().then(ok=>{if(!ok)failed('O Spotify não conseguiu conectar o player.');}).catch(()=>failed('Não foi possível preparar o Spotify.'));
      });
    })().catch(error=>{this.initializing=null;throw error;});return this.initializing;
  }
  enqueue(action){const pending=this.queue.catch(()=>{}).then(action);this.queue=pending;return pending;}
  async prepare(){this.activate();const device=await this.ensure();await this.enqueue(()=>this.api('/me/player',{method:'PUT',body:{device_ids:[device],play:false}}));return device;}
  receiveState(state){
    if(!state){this.freezePosition();this.playing=false;this.emit();return;}
    if(!this.acceptPlayback){if(!state.paused)this.player?.pause().catch(()=>{});return;}
    const previous=this.state;this.state=state;this.positionAnchor=Math.max(0,Number(state.position)||0);this.positionUpdatedAt=this.now();this.playing=!state.paused;this.lastError=null;
    if([0,1,2].includes(state.repeat_mode))this.repeatMode=['off','context','track'][state.repeat_mode];
    this.track=state.track_window?.current_track||null;this.playing=this.playing&&!this.pausing;this.fadeIfPlaying();this.emit();
    if(this.expectEnd&&previous&&!previous.paused&&previous.position>0&&state.paused&&state.position===0){this.expectEnd=false;this.dispatchEvent(new Event('ended'));}
  }
  async play(asset,options={},isCurrent=()=>true){
    const operation=++this.operation;this.cancelFade();this.pausing=false;this.activate();const parsed=parseSpotify(asset.spotifyUri);
    // ensure usa a geração atual; parar ou uma cue posterior invalida o preparo.
    const device=await this.ensure();if(operation!==this.operation||!isCurrent())return false;
    if(this.audible&&this.level>0){if(!await this.envelope.fade(0,options.fadeOut??0,()=>operation===this.operation&&isCurrent()))return false;}
    this.volume=clamp(options.outputVolume??this.volume);this.level=0;await this.writeVolume();if(operation!==this.operation||!isCurrent())return false;
    const body=parsed.type==='playlist'?{context_uri:parsed.uri,position_ms:Math.max(0,Math.floor((options.startSeconds||0)*1000)),...(options.selectedUri?{offset:{uri:parseSpotify(options.selectedUri).uri}}:!asset.shuffle?{offset:{position:options.index??options.youtubeIndex??0}}:Number.isInteger(asset.spotifyCount)&&asset.spotifyCount>0?{offset:{position:Math.floor(Math.random()*asset.spotifyCount)}}:{})}:{uris:[parsed.uri],position_ms:Math.max(0,Math.floor((options.startSeconds||0)*1000))};
    return this.enqueue(async()=>{
      if(operation!==this.operation||!isCurrent())return false;
      this.acceptPlayback=true;this.expectEnd=!!options.playlist;this.lastError=null;
      this.state=null;await this.api('/me/player/play?device_id='+encodeURIComponent(device),{method:'PUT',body});
      if(operation!==this.operation||!isCurrent())return false;
      this.currentAsset=asset;this.beginFadeIn(options.fadeIn??0,operation,parsed.type==='track'?parsed.uri:null);await this.refreshState(operation);this.emit();
      try{
        const mode=options.playlist||options.loop===false?'off':parsed.type==='playlist'?'context':'track';
        await this.api('/me/player/repeat?device_id='+encodeURIComponent(device)+'&state='+mode,{method:'PUT'});
        if(operation===this.operation&&isCurrent()){this.repeatMode=mode;this.emit();}
        if(operation===this.operation&&isCurrent())await this.api('/me/player/shuffle?device_id='+encodeURIComponent(device)+'&state='+(parsed.type==='playlist'&&asset.shuffle===true),{method:'PUT'});
      }catch(error){this.fail('Música iniciada, mas não foi possível ajustar repetição/aleatório: '+error.message);}
      return operation===this.operation&&isCurrent();
    });
  }
  setVolume(value){this.volume=clamp(value);return this.writeVolume();}
  async pause({fadeOut=0}={}){
    const operation=++this.operation;this.cancelFade();const audible=this.audible;this.freezePosition();this.pausing=true;this.playing=false;this.emit();
    if(audible&&this.level>0&&!await this.envelope.fade(0,fadeOut,()=>operation===this.operation))return false;
    if(operation!==this.operation)return false;
    this.acceptPlayback=false;this.level=0;await this.writeVolume();
    return this.enqueue(()=>{if(operation===this.operation)return this.player?.pause();});
  }
  async resume({fadeIn=0}={}){
    this.activate();const operation=++this.operation;this.cancelFade();this.pausing=false;await this.ensure();if(operation!==this.operation)return false;
    this.level=0;await this.writeVolume();return this.enqueue(async()=>{if(operation!==this.operation)return false;this.acceptPlayback=true;this.state=null;await this.player.resume();if(operation===this.operation){this.beginFadeIn(fadeIn,operation);await this.refreshState(operation);}});
  }
  async next(offset=1,{fadeIn=0,fadeOut=0}={}){
    const operation=++this.operation;this.cancelFade();this.pausing=false;this.activate();
    if(this.playing&&this.level>0&&!await this.envelope.fade(0,fadeOut,()=>operation===this.operation))return false;
    if(operation!==this.operation)return false;this.level=0;await this.writeVolume();
    return this.enqueue(async()=>{if(operation!==this.operation)return false;this.acceptPlayback=true;this.state=null;if(offset<0)await this.player?.previousTrack();else await this.player?.nextTrack();if(operation===this.operation){this.beginFadeIn(fadeIn,operation);await this.refreshState(operation);}});
  }
  async refreshState(operation){if(this.player?.getCurrentState){const state=await this.player.getCurrentState();if(operation===this.operation&&state)this.receiveState(state);}}
  async seek(position,{fadeIn=.7,fadeOut=.5}={}){
    if(!this.player||!this.deviceId)throw Error('Ative o player Spotify pela lateral.');
    const operation=++this.operation,wasPlaying=this.audible,duration=Number(this.state?.duration||this.track?.duration_ms)||Infinity;
    const target=Math.max(0,Math.min(duration-1,Math.floor(Number(position)||0)));this.cancelFade();this.pausing=false;this.activate();
    if(wasPlaying&&this.level>0&&!await this.envelope.fade(0,fadeOut,()=>operation===this.operation))return false;
    if(operation!==this.operation)return false;this.level=0;await this.writeVolume();
    return this.enqueue(async()=>{if(operation!==this.operation)return false;this.state=null;await this.player.seek(target);if(operation!==this.operation)return false;this.positionAnchor=target;this.positionUpdatedAt=this.now();if(wasPlaying)this.beginFadeIn(fadeIn,operation);await this.refreshState(operation);this.emit();return true;});
  }
  async privateSession(){const state=await this.api('/me/player');return this.deviceId&&state?.device?.id===this.deviceId&&typeof state.device.is_private_session==='boolean'?state.device.is_private_session:null;}
  setRepeatMode(mode){
    if(!['off','context','track'].includes(mode))return Promise.reject(Error('Modo de repetição inválido.'));
    if(!this.deviceId||!this.currentAsset)return Promise.resolve(false);const asset=this.currentAsset,operation=this.operation;
    return this.enqueue(async()=>{if(this.currentAsset!==asset||operation!==this.operation)return false;await this.api('/me/player/repeat?device_id='+encodeURIComponent(this.deviceId)+'&state='+mode,{method:'PUT'});if(this.currentAsset!==asset||operation!==this.operation)return false;this.repeatMode=mode;this.emit();return true;});
  }
  repeat(enabled){return this.setRepeatMode(enabled?(this.currentAsset&&parseSpotify(this.currentAsset.spotifyUri).type==='playlist'?'context':'track'):'off');}
  disconnect(){this.cancelFade();this.connectionGeneration=(this.connectionGeneration||0)+1;this.operation++;this.cancelInit?.();this.cancelInit=null;this.player?.disconnect();this.player=null;this.deviceId=null;this.initializing=null;this.acceptPlayback=false;this.playing=false;this.state=null;this.track=null;this.currentAsset=null;this.auth.disconnect();this.lastError=null;this.emit();}
}
