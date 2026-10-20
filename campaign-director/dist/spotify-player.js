import {SpotifyAuth,parseSpotify} from './spotify-auth.js';
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
  constructor({auth=new SpotifyAuth(),fetcher=(...args)=>fetch(...args),sdk=loadSDK}={}){super();Object.assign(this,{auth,fetcher,sdk});this.operation=0;this.playing=false;this.acceptPlayback=false;this.queue=Promise.resolve();this.volume=1;}
  emit(){this.dispatchEvent(new Event('change'));}
  fail(message){this.lastError=message;this.emit();}
  async api(path,{method='GET',body,retry=true}={}){
    if(!path.startsWith('/')||path.startsWith('//')||path.includes('://'))throw Error('Endereço da API Spotify inválido.');
    if(this.retryAt>Date.now())throw Error('O Spotify pediu uma pausa. Aguarde alguns segundos antes de tentar novamente.');
    const token=await this.auth.token(),r=await this.fetcher('https://api.spotify.com/v1'+path,{method,signal:globalThis.AbortSignal?.timeout?.(15000),headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}).catch(()=>{throw Error('O Spotify não respondeu. Confira a conexão e tente novamente.');});
    if(r.status===401&&retry){await this.auth.token(true);return this.api(path,{method,body,retry:false});}
    if(r.status===429){this.retryAt=Date.now()+Math.max(1,Number(r.headers.get('Retry-After'))||5)*1000;throw Error('Limite temporário do Spotify. Aguarde antes de tentar novamente.');}
    if(!r.ok){if(r.status===403)throw Error('O Spotify recusou o acesso. Confira Premium, permissões e Users Management do aplicativo no Dashboard.');if(r.status===404)throw Error('O Spotify não encontrou este item ou player. Prepare o player e confira o link.');throw Error('O Spotify não concluiu a operação ('+r.status+').');}
    return r.status===204?null:r.json();
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
    if(!this.auth.connected)throw Error('Conecte sua conta em Biblioteca → Spotify.');
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
        player.addListener('not_ready',()=>{if(this.player!==player)return;this.deviceId=null;this.initializing=null;this.playing=false;this.fail('O player Spotify ficou offline. Prepare novamente.');});
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
    if(!state){this.playing=false;this.emit();return;}
    if(!this.acceptPlayback){if(!state.paused)this.player?.pause().catch(()=>{});return;}
    const previous=this.state;this.state=state;this.playing=!state.paused;this.lastError=null;
    this.track=state.track_window?.current_track||null;this.emit();
    if(this.expectEnd&&previous&&!previous.paused&&previous.position>0&&state.paused&&state.position===0){this.expectEnd=false;this.dispatchEvent(new Event('ended'));}
  }
  async play(asset,options={},isCurrent=()=>true){
    const operation=++this.operation;this.activate();const parsed=parseSpotify(asset.spotifyUri);
    // ensure usa a geração atual; parar ou uma cue posterior invalida o preparo.
    const device=await this.ensure();if(operation!==this.operation||!isCurrent())return false;
    const body=parsed.type==='playlist'?{context_uri:parsed.uri,position_ms:Math.max(0,Math.floor((options.startSeconds||0)*1000)),...(!asset.shuffle?{offset:{position:options.index??options.youtubeIndex??0}}:Number.isInteger(asset.spotifyCount)&&asset.spotifyCount>0?{offset:{position:Math.floor(Math.random()*asset.spotifyCount)}}:{})}:{uris:[parsed.uri],position_ms:Math.max(0,Math.floor((options.startSeconds||0)*1000))};
    return this.enqueue(async()=>{
      if(operation!==this.operation||!isCurrent())return false;
      this.acceptPlayback=true;this.expectEnd=!!options.playlist;this.lastError=null;
      await this.api('/me/player/play?device_id='+encodeURIComponent(device),{method:'PUT',body});
      if(operation!==this.operation||!isCurrent())return false;
      this.currentAsset=asset;this.emit();
      try{
        await this.api('/me/player/repeat?device_id='+encodeURIComponent(device)+'&state='+(options.playlist||options.loop===false?'off':parsed.type==='playlist'?'context':'track'),{method:'PUT'});
        if(operation===this.operation&&isCurrent())await this.api('/me/player/shuffle?device_id='+encodeURIComponent(device)+'&state='+(parsed.type==='playlist'&&asset.shuffle===true),{method:'PUT'});
      }catch(error){this.fail('Música iniciada, mas não foi possível ajustar repetição/aleatório: '+error.message);}
      return operation===this.operation&&isCurrent();
    });
  }
  setVolume(value){this.volume=clamp(value);if(this.player)return this.player.setVolume(this.volume).catch(()=>this.fail('Não foi possível ajustar o volume Spotify.'));}
  async pause(){this.operation++;this.acceptPlayback=false;this.playing=false;this.emit();return this.enqueue(()=>this.player?.pause());}
  async resume(){this.activate();const operation=++this.operation;await this.ensure();return this.enqueue(async()=>{if(operation!==this.operation)return;this.acceptPlayback=true;await this.player.resume();});}
  next(offset=1){return this.enqueue(()=>offset<0?this.player?.previousTrack():this.player?.nextTrack());}
  repeat(enabled){if(!this.deviceId||!this.currentAsset)return Promise.resolve();const asset=this.currentAsset;return this.enqueue(()=>{if(this.currentAsset!==asset)return;return this.api('/me/player/repeat?device_id='+encodeURIComponent(this.deviceId)+'&state='+(enabled?(parseSpotify(asset.spotifyUri).type==='playlist'?'context':'track'):'off'),{method:'PUT'});});}
  disconnect(){this.connectionGeneration=(this.connectionGeneration||0)+1;this.operation++;this.cancelInit?.();this.cancelInit=null;this.player?.disconnect();this.player=null;this.deviceId=null;this.initializing=null;this.acceptPlayback=false;this.playing=false;this.state=null;this.track=null;this.currentAsset=null;this.auth.disconnect();this.lastError=null;this.emit();}
}
