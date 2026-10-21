import {esc,toast} from './ui.js';
import {icon} from './icons.js';
import {parseSpotify} from './spotify-auth.js';
import {playlistReadError} from './spotify-playlists.js';

export function playlistChoices(state){return [
 ...(state.playlists||[]).map(source=>({key:'local:'+source.id,type:'local',name:source.name,source})),
 ...(state.audioAssets||[]).filter(a=>a.provider==='spotify'&&a.spotifyUri?.startsWith('spotify:playlist:')).map(source=>({key:'spotify:'+source.id,type:'spotify',name:source.name,source}))
];}
export function currentPlaylist(choices,engine,scene,selection='auto'){
 const preferred=selection==='auto'?null:choices.find(p=>p.key===selection);if(preferred)return preferred;
 return choices.find(p=>p.type==='local'&&p.source.id===engine.playlist?.id)
  ||choices.find(p=>p.type==='spotify'&&p.source.id===engine.musicAsset?.id)
  ||choices.find(p=>p.type==='local'&&p.source.id===scene?.music?.playlistId)
  ||choices.find(p=>p.type==='spotify'&&p.source.id===(scene?.music?.assetId||scene?.musicAssetId))||null;
}
export class DirectorPlaylist{
 constructor({state,engine,scene,openSpotify}){Object.assign(this,{state,engine,scene,openSpotify});this.view='scene';this.selection='auto';this.cache=new Map();this.generation=0;this.limit=50;this.term='';}
 mount(root){
  this.root=root;this.context=null;this.generation++;
  root.querySelectorAll('[data-director-tab]').forEach(b=>{b.onclick=()=>this.show(b.dataset.directorTab);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const view=e.key==='Home'?'scene':e.key==='End'?'tracks':this.view==='scene'?'tracks':'scene';this.show(view);root.querySelector(`[data-director-tab="${view}"]`).focus();};});
  this.show(this.view);this.root.scrollTop=0;
 }
 show(view){this.view=view;this.root.scrollTop=0;for(const b of this.root.querySelectorAll('[data-director-tab]')){const active=b.dataset.directorTab===view;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
  this.root.querySelector('#directorScenePane').hidden=view!=='scene';this.root.querySelector('#directorTrackPane').hidden=view!=='tracks';if(view==='tracks')this.load();
 }
 async load(force=false){
  if(this.authGeneration!==this.engine.spotify.auth.generation){this.cache.clear();this.authGeneration=this.engine.spotify.auth.generation;}
  const root=this.root,pane=root.querySelector('#directorTrackPane'),choices=playlistChoices(this.state()),entry=currentPlaylist(choices,this.engine,this.scene(),this.selection),generation=++this.generation;
  this.context=entry?.key||null;this.entry=entry;this.tracks=[];
  pane.innerHTML=`<label class="track-library-label">Playlist<select aria-label="Playlist da mesa"><option value="auto">Atual / preparada na cena</option>${choices.map(p=>`<option value="${esc(p.key)}" ${p.key===this.selection?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div class="track-list-heading"><strong>${esc(entry?.name||'Trilha da mesa')}</strong><button type="button" class="icon-btn" data-refresh title="Atualizar faixas" aria-label="Atualizar faixas">↻</button></div><label class="track-search" hidden>${icon('search')}<input type="search" aria-label="Buscar na trilha" placeholder="Música ou artista…" value="${esc(this.term)}"></label><p class="track-list-status" role="status"></p><div class="session-track-list"></div><div class="track-list-options"></div>`;
  pane.querySelector('select').onchange=e=>{this.selection=e.target.value;this.term='';this.limit=50;this.root.scrollTop=0;this.load();};pane.querySelector('[data-refresh]').onclick=()=>this.load(true);
  const status=pane.querySelector('[role=status]'),list=pane.querySelector('.session-track-list'),search=pane.querySelector('input');search.oninput=()=>{this.term=search.value;this.limit=50;this.renderTracks();};
  if(!entry){status.textContent='Escolha uma playlist acima ou prepare uma na cena. A reprodução continua ao trocar de página.';return;}
  try{
   if(entry.type==='local')this.tracks=entry.source.assetIds.map(id=>this.state().audioAssets.find(a=>a.id===id)).filter(Boolean);
   else{
    const parsed=parseSpotify(entry.source.spotifyUri);pane.querySelector('.track-list-options').innerHTML=`<a href="${parsed.url}" target="_blank" rel="noopener">Abrir playlist no Spotify ↗</a><button type="button" data-details>Mais opções</button>`;pane.querySelector('[data-details]').onclick=()=>this.openSpotify(entry.source);
    if(!this.engine.spotify.auth.connected){status.textContent='Conecte o Spotify pela lateral para consultar as músicas.';return;}
    status.textContent='Consultando músicas…';let tracks=!force&&this.cache.get(parsed.uri);if(!tracks){tracks=await this.engine.spotify.playlistTracks(parsed.id);this.cache.set(parsed.uri,tracks);}if(generation!==this.generation||this.root!==root||!root.isConnected)return;this.tracks=tracks;
   }
   if(generation!==this.generation||this.root!==root||!root.isConnected)return;status.textContent=this.tracks.length?`${this.tracks.length} músicas · escolher uma faixa usa os fades do CRIS.`:'Esta playlist ainda não disponibilizou músicas para consulta.';search.parentElement.hidden=!this.tracks.length;this.renderTracks();
  }catch(error){if(generation===this.generation&&this.root===root&&root.isConnected){status.textContent=playlistReadError(error);list.replaceChildren();}}
 }
 update(){if(!this.root?.isConnected||this.view!=='tracks')return;const entry=currentPlaylist(playlistChoices(this.state()),this.engine,this.scene(),this.selection);if(entry?.key!==this.context)this.load();else this.highlight();}
 renderTracks(){
  const pane=this.root.querySelector('#directorTrackPane'),list=pane.querySelector('.session-track-list');if(!list)return;
  const term=this.term.toLocaleLowerCase(),filtered=this.tracks.map((track,index)=>({track,index})).filter(({track})=>(track.name+' '+(Array.isArray(track.artists)?track.artists.map(a=>a.name).join(' '):track.artists||'')).toLocaleLowerCase().includes(term));
  list.innerHTML=filtered.slice(0,this.limit).map(({track,index})=>`<button type="button" class="session-track" data-track="${index}" aria-label="Tocar ${esc(track.name)}"><span class="track-number">${String(index+1).padStart(2,'0')}</span><span class="track-description"><strong>${esc(track.name)}</strong><small>${esc(Array.isArray(track.artists)?track.artists.map(a=>a.name).join(', '):track.artists||'Biblioteca da mesa')}</small></span><span class="track-play" aria-hidden="true">${icon('play')}</span></button>`).join('')+(filtered.length>this.limit?'<button type="button" class="btn outline full" data-more>Mostrar mais</button>':'')+(!filtered.length&&this.tracks.length?'<p class="empty-small">Nenhuma música encontrada.</p>':'');
  list.querySelectorAll('[data-track]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const index=+b.dataset.track;if(this.entry.type==='local')await this.engine.playPlaylist(this.entry.source,index);else{this.engine.spotify.activate();await this.engine.playMusic(this.entry.source,{selectedUri:this.tracks[index].uri});}}catch(error){toast(error.message,true);}finally{b.disabled=false;this.highlight();}});
  list.querySelector('[data-more]')?.addEventListener('click',()=>{this.limit+=50;this.renderTracks();});this.highlight();
 }
 highlight(){for(const b of this.root.querySelectorAll('[data-track]')){const track=this.tracks[+b.dataset.track],active=this.entry?.type==='spotify'?track?.uri===this.engine.spotify.track?.uri:track?.id===this.engine.musicAsset?.id;b.classList.toggle('current',active);if(active)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');}}
}
