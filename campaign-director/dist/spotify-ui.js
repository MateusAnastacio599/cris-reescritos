import {SPOTIFY_HOME,parseSpotify} from './spotify-auth.js';
import {$,$$,esc,openForm,field,confirmAction,toast} from './ui.js';
import {uid} from './storage.js';
import {removeAudioAsset} from './audio-assets.js';
const spotifyURL=uri=>{try{return parseSpotify(uri).url;}catch{return 'https://open.spotify.com/';}};
export const safeSpotifyImage=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['i.scdn.co','mosaic.scdn.co','image-cdn-ak.spotifycdn.com','image-cdn-fa.spotifycdn.com'].includes(u.hostname)?u.href:'';}catch{return '';}};
const cover=item=>safeSpotifyImage(item.album?.images?.[0]?.url||item.images?.[0]?.url);
export class SpotifyUI{
  constructor(ctx){this.ctx=ctx;this.player=ctx.engine.spotify;this.playlists=[];this.player.addEventListener('change',()=>this.updateStatus());}
  updateStatus(){const status=$('#spotifyStatus');if(!status)return;status.textContent=this.player.lastError||(this.player.deviceId?'Player pronto. Escolha uma música ou playlist.':this.player.auth.connected?'Conta conectada nesta aba. Prepare o player antes da sessão.':'Conecte sua conta Premium para acessar suas playlists.');}
  open(){const connected=this.player.auth.connected,canonical=location.origin===new URL(SPOTIFY_HOME).origin;
    openForm({title:'Spotify · sua trilha',submit:'Fechar',wide:true,body:`<section class="spotify-account"><img src="assets/spotify-icon.png" alt="Spotify" width="32" height="32"><div><strong>Spotify Premium</strong><p id="spotifyStatus" role="status"></p></div></section><div class="spotify-tools">${!canonical?`<a class="btn primary" href="${SPOTIFY_HOME}">Abrir CRIS para conectar Spotify</a>`:connected?'<button type="button" class="btn primary" id="spotifyPrepare">Preparar player</button><button type="button" class="btn outline" id="spotifyLoadPlaylists">Minhas playlists</button><button type="button" class="btn outline" id="spotifyAddLink">Adicionar link</button><button type="button" class="btn subtle" id="spotifyDisconnect">Desconectar</button>':'<button type="button" class="btn primary" id="spotifyConnect">Conectar Spotify</button>'}</div><p class="form-hint">A conexão fica nesta aba. A música usa o player oficial Spotify; volume até 100%, sem amplificação e sem crossfade nesta versão. Os controles de reprodução ficam na barra inferior do CRIS.</p><div id="spotifyLists" class="spotify-lists"></div><p class="form-hint">Você autoriza leitura de playlists e controle da reprodução. O CRIS não altera suas playlists no Spotify. <a href="spotify-privacy.html" target="_blank" rel="noopener">Como usamos os dados</a> · <a href="https://www.spotify.com/account/apps/" target="_blank" rel="noopener">Gerenciar acesso no Spotify</a></p>`,onReady:root=>{
      this.updateStatus();
      $('#spotifyConnect',root)?.addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{location.assign(await this.player.auth.begin());}catch(error){button.disabled=false;toast(error.message,true);}});
      $('#spotifyPrepare',root)?.addEventListener('click',event=>this.busy(event.currentTarget,async()=>{this.player.activate();await this.player.prepare();toast('Player pronto. Agora escolha sua música.');}));
      $('#spotifyLoadPlaylists',root)?.addEventListener('click',event=>this.busy(event.currentTarget,()=>this.loadPlaylists(root)));
      $('#spotifyAddLink',root)?.addEventListener('click',()=>this.addLink());
      $('#spotifyDisconnect',root)?.addEventListener('click',()=>confirmAction('Desconectar Spotify?', 'A conexão e os itens Spotify serão removidos desta biblioteca local. Suas playlists no Spotify continuam intactas. Cópias da nuvem e backups anteriores precisam ser atualizados ou excluídos separadamente.',async()=>{
        if(this.ctx.engine.musicAsset?.provider==='spotify')await this.ctx.engine.stopMusic(0);
        this.player.disconnect();for(const asset of [...this.ctx.state().audioAssets].filter(a=>a.provider==='spotify'))removeAudioAsset(this.ctx.state(),asset.id);
        this.playlists=[];this.ctx.commit();toast('Spotify desconectado nesta aba.');
      },'Desconectar'));
    },onSubmit:()=>{this.playlists=[];}});
  }
  async busy(button,callback){button.disabled=true;try{await callback();}catch(error){toast(error.message,true);}finally{if(button.isConnected)button.disabled=false;this.updateStatus();}}
  addItem(item,type){
    const parsed=parseSpotify(item.uri||`spotify:${type}:${item.id}`),state=this.ctx.state();let asset=state.audioAssets.find(a=>a.provider==='spotify'&&a.spotifyUri===parsed.uri);
    const values={name:item.name||'Spotify',kind:'music',provider:'spotify',spotifyUri:parsed.uri,url:parsed.url,tags:'Spotify',cover:cover(item),artists:(item.artists||[]).map(a=>a.name).join(', '),duration:item.duration_ms?item.duration_ms/1000:undefined,shuffle:parsed.type==='playlist',spotifyCount:Number.isInteger(item.items?.total??item.tracks?.total)?(item.items?.total??item.tracks?.total):undefined};
    if(asset)Object.assign(asset,values);else{asset={id:uid('asset'),...values};state.audioAssets.push(asset);}this.ctx.commit();return asset;
  }
  async loadPlaylists(root){
    const lists=$('#spotifyLists',root);lists.textContent='Buscando suas playlists…';
    try{this.playlists=(await this.player.playlists()).filter(p=>p?.id&&p?.name);if(!root.isConnected)return;
      lists.innerHTML='<h3>Suas playlists no Spotify</h3><p class="form-hint">Adicione a playlist inteira à biblioteca ou abra as faixas para escolher músicas individuais para cues.</p>'+this.playlists.map((p,index)=>`<article class="spotify-item">${cover(p)?`<img src="${esc(cover(p))}" alt="" loading="lazy">`:''}<div><a href="${esc(spotifyURL(p.uri||'spotify:playlist:'+p.id))}" target="_blank" rel="noopener">${esc(p.name)}</a><small>Spotify · ${esc(p.owner?.display_name||'Playlist')}</small></div><button type="button" class="btn outline small" data-spotify-import="${index}">Adicionar</button><button type="button" class="btn subtle small" data-spotify-tracks="${index}">Ver faixas</button></article>`).join('')||'<p>Nenhuma playlist foi disponibilizada pelo Spotify para esta conta.</p>';
      $$('[data-spotify-import]',root).forEach(button=>button.onclick=()=>{this.addItem(this.playlists[+button.dataset.spotifyImport],'playlist');toast('Playlist adicionada à biblioteca.');});
      $$('[data-spotify-tracks]',root).forEach(button=>button.onclick=()=>this.busy(button,()=>this.showTracks(this.playlists[+button.dataset.spotifyTracks],root)));
    }catch(error){if(lists.isConnected)lists.textContent='Não foi possível carregar as playlists. '+error.message;throw error;}
  }
  async showTracks(playlist,root){
    const tracks=await this.player.playlistTracks(playlist.id);if(!root.isConnected)return;
    if(!tracks.length)throw Error('O Spotify não disponibilizou faixas desta playlist. Para listas de terceiros, adicione a playlist inteira ou uma faixa pelo link.');
    let limit=50;const render=()=>{
      const list=$('#spotifyLists',root);list.innerHTML=`<button type="button" class="btn subtle" id="spotifyBack">← Minhas playlists</button><h3>${esc(playlist.name)}</h3><p class="form-hint">${tracks.length} faixas disponíveis · adicione à biblioteca para usar em cenas e cues.</p>`+tracks.slice(0,limit).map((t,i)=>`<article class="spotify-item">${cover(t)?`<img src="${esc(cover(t))}" alt="" loading="lazy">`:''}<div><a href="${esc(spotifyURL(t.uri))}" target="_blank" rel="noopener">${esc(t.name)}</a><small>Spotify · ${esc((t.artists||[]).map(a=>a.name).join(', '))}</small></div><button type="button" class="btn outline small" data-spotify-track-add="${i}">Adicionar</button><button type="button" class="btn primary small" data-spotify-track-play="${i}">Ouvir</button></article>`).join('')+(limit<tracks.length?'<button type="button" class="btn outline" id="spotifyMore">Mostrar mais</button>':'');
      $('#spotifyBack',root).onclick=()=>this.loadPlaylists(root).catch(error=>toast(error.message,true));$('#spotifyMore',root)?.addEventListener('click',()=>{limit+=50;render();});
      $$('[data-spotify-track-add]',root).forEach(button=>button.onclick=()=>{this.addItem(tracks[+button.dataset.spotifyTrackAdd],'track');toast('Música adicionada à biblioteca.');});
      $$('[data-spotify-track-play]',root).forEach(button=>button.onclick=()=>{this.player.activate();this.busy(button,()=>this.ctx.engine.playMusic(this.addItem(tracks[+button.dataset.spotifyTrackPlay],'track'),{fadeIn:0,fadeOut:0}));});
    };render();
  }
  addLink(){openForm({title:'Adicionar do Spotify',submit:'Adicionar à biblioteca',body:field('Link de música ou playlist','url','','type="url" required placeholder="https://open.spotify.com/track/…"')+'<p class="form-hint">Nome e capa serão consultados na sua conta. Para uma playlist de terceiros, a lista completa de faixas pode não estar disponível.</p>',onSubmit:async form=>{const parsed=parseSpotify(form.get('url')),item=await this.player.metadata(parsed.uri);this.addItem(item,parsed.type);toast('Spotify adicionado à biblioteca.');}});}
}
