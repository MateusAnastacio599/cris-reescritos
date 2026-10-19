import {uid,putMedia,deleteMedia,releaseAsset} from './storage.js';
import {parseYouTube} from './markdown.js';
import {icon} from './icons.js';
import {$,$$,esc,openForm,field,option,confirmAction,toast} from './ui.js';
import {formatTime} from './audio-engine.js';
import {YouTubeLibrary} from './youtube-library.js';
import {openMusicSettings} from './music-ui.js';

const labels={music:'Música',ambience:'Ambiência',sfx:'Efeito'};
const glyph=a=>a.provider==='youtube'?'youtube':({ambience:'rain',sfx:'bolt',music:'music'})[a.kind];
export class LibraryUI {
  constructor(ctx){this.ctx=ctx;this.filter='all';this.search='';this.playlistId=null;this.youtube=new YouTubeLibrary(ctx);}
  render(root) {
    this.root=root;const state=this.ctx.state(),playlist=state.playlists.find(p=>p.id===this.playlistId);
    root.innerHTML=`<div class="library-heading"><div><div class="eyebrow">A ATMOSFERA TAMBÉM CONTA A HISTÓRIA</div><h1>Biblioteca de áudio <span class="count-badge">${state.audioAssets.length}</span></h1><p>Organize os sons que dão vida ao seu universo.</p></div><div class="heading-actions"><button class="btn outline" id="musicTransitionSettings">${icon('sliders')} Transições</button><button class="btn outline" id="addYoutube">${icon('youtube')} YouTube</button><button class="btn primary" id="uploadAudio">${icon('upload')} Enviar áudios</button></div></div><div class="library-layout"><aside class="playlist-sidebar"><span class="section-eyebrow">SUA BIBLIOTECA</span><button class="playlist-nav ${!playlist?'active':''}" data-library-all>${icon('headphones')} Todos os áudios <span>${state.audioAssets.length}</span></button><div class="section-heading"><span class="section-eyebrow">PLAYLISTS</span><button class="icon-btn" id="addPlaylist" aria-label="Criar playlist">${icon('plus')}</button></div>${state.playlists.map(p=>`<button class="playlist-nav ${p.id===this.playlistId?'active':''}" data-playlist="${esc(p.id)}">${icon('list')}<span>${esc(p.name)}</span><small>${p.assetIds.length}</small></button>`).join('')}<div class="library-info">${icon('shield')}<p>Arquivos e playlists são salvos neste navegador. Use o backup para levar a mesa a outro aparelho.</p></div></aside><section class="audio-browser"><div class="audio-browser-top"><div><h2>${esc(playlist?.name||'Todos os áudios')}</h2><span>${playlist?'Playlist da sua mesa':'Arquivos, ambientes e links do YouTube'}</span></div>${playlist?`<div class="heading-actions"><button class="icon-btn" id="editPlaylist" title="Editar playlist" aria-label="Editar playlist">${icon('edit')}</button><button class="btn primary small" id="playPlaylist">${icon('play')} Reproduzir</button></div>`:''}</div><div class="library-filters"><div class="tab-pills" id="libraryFilters">${[['all','Todos'],['music','Músicas'],['ambience','Ambiências'],['sfx','Efeitos'],['youtube','YouTube']].map(([v,l])=>`<button class="${this.filter===v?'active':''}" data-audio-filter="${v}">${l}</button>`).join('')}</div><label class="search-field">${icon('search')}<input type="search" id="audioSearch" placeholder="Buscar áudio ou tag…" aria-label="Buscar na biblioteca" value="${esc(this.search)}"></label></div><section id="youtubeInspector" class="youtube-inspector" hidden></section><div class="audio-table"><div class="audio-table-head"><span></span><span>TÍTULO / TAGS</span><span>TIPO</span><span>AÇÕES</span></div><div id="audioRows"></div></div><div class="library-footnote"><i></i> Os seis sons de demonstração do protótipo original estão preservados.</div></section></div>`;
    this.renderRows();this.youtube.mount(root);$('#musicTransitionSettings',root).onclick=()=>openMusicSettings(this.ctx);
    $('#addYoutube',root).onclick=()=>this.addYouTube();$('#uploadAudio',root).onclick=()=>this.upload();$('#addPlaylist',root).onclick=()=>this.editPlaylist();
    $('[data-library-all]',root).onclick=()=>{this.playlistId=null;this.render(root);};
    $$('[data-playlist]',root).forEach(b=>b.onclick=()=>{this.playlistId=b.dataset.playlist;this.filter='all';this.render(root);});
    $$('[data-audio-filter]',root).forEach(b=>b.onclick=()=>{this.filter=b.dataset.audioFilter;$$('[data-audio-filter]',root).forEach(x=>x.classList.toggle('active',x===b));this.renderRows();});
    $('#audioSearch',root).oninput=e=>{this.search=e.target.value;this.renderRows();};
    $('#editPlaylist',root)?.addEventListener('click',()=>this.editPlaylist(playlist));$('#playPlaylist',root)?.addEventListener('click',()=>this.ctx.engine.playPlaylist(playlist).catch(e=>toast(e.message,true)));
  }
  renderRows() {
    if(!this.root?.isConnected)return;const state=this.ctx.state(),playlist=state.playlists.find(p=>p.id===this.playlistId),engine=this.ctx.engine;
    const source=playlist?playlist.assetIds.map(id=>state.audioAssets.find(a=>a.id===id)).filter(Boolean):state.audioAssets;
    const assets=source.filter(a=>(this.filter==='all'||this.filter==='youtube'&&a.provider==='youtube'||this.filter===a.kind)&&(!this.search||`${a.name} ${a.tags||''}`.toLocaleLowerCase().includes(this.search.toLocaleLowerCase())));
    $('#audioRows',this.root).innerHTML=assets.length?assets.map(a=>{
      const active=engine.musicAsset?.id===a.id||engine.tracks.has('library:'+a.id);
      return `<div class="audio-row ${active?'playing':''}"><button class="asset-play ${a.provider==='youtube'?'youtube':''}" data-play-asset="${esc(a.id)}" aria-label="Reproduzir ${esc(a.name)}">${icon(active?'pause':glyph(a))}</button><div class="asset-title"><strong>${esc(a.name)} ${a.builtin?'<span class="demo-badge">DEMO</span>':''}</strong><small>${esc(a.tags||'Sem tags')}<span> · ${a.provider==='youtube'?'YouTube'+(a.playlistId?' · Playlist':''):a.provider==='upload'?'Arquivo enviado':'Áudio original'}${a.duration?' · '+formatTime(a.duration):''}</span></small></div><span class="kind-pill kind-${a.kind}">${labels[a.kind]}</span><div class="asset-actions"><button class="icon-btn" ${a.provider==='youtube'&&a.playlistId?'data-inspect-youtube':'data-play-asset'}="${esc(a.id)}" title="${a.playlistId?'Ver faixas da playlist':'Reproduzir'}" aria-label="${a.playlistId?'Ver faixas de':'Reproduzir'} ${esc(a.name)}">${icon(a.playlistId?'list':'play')}</button><button class="icon-btn" data-edit-asset="${esc(a.id)}" title="Editar áudio" aria-label="Editar ${esc(a.name)}">${icon('more')}</button></div></div>`;
    }).join(''):`<div class="empty-state">${icon('headphones')}<h3>Nenhum áudio por aqui</h3><p>${this.search?'Tente outro nome ou tag.':playlist?'Adicione faixas usando o botão de editar playlist.':'Envie um arquivo ou adicione um link do YouTube.'}</p></div>`;
    $$('[data-play-asset]',this.root).forEach(b=>b.onclick=async()=>{const asset=state.audioAssets.find(a=>a.id===b.dataset.playAsset);try{
      if(asset.provider==='youtube'||asset.kind==='music'){if(engine.musicAsset?.id===asset.id)engine.toggleTransport();else if(playlist)await engine.playPlaylist(playlist,source.findIndex(a=>a.id===asset.id));else await engine.playMusic(asset);}
      else if(asset.kind==='ambience')await engine.toggleLibraryLayer(asset);else await engine.oneShot(asset);
      this.renderRows();
    }catch(error){toast(error.message,true);}});
    $$('[data-inspect-youtube]',this.root).forEach(b=>b.onclick=()=>this.youtube.open(state.audioAssets.find(a=>a.id===b.dataset.inspectYoutube)));
    $$('[data-edit-asset]',this.root).forEach(b=>b.onclick=()=>this.editAsset(state.audioAssets.find(a=>a.id===b.dataset.editAsset)));
  }
  upload() {
    openForm({title:'Enviar áudios',submit:'Adicionar à biblioteca',body:'<p class="dialog-description">Músicas, ambiências ou efeitos da sua mesa. Você pode selecionar vários arquivos.</p><label class="file-drop"><span>♫</span><strong>Escolher arquivos de áudio</strong><small>MP3, WAV, OGG, M4A, FLAC ou WebM · até 100 MB por arquivo</small><input type="file" name="audioFiles" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.webm,.aac,.opus" multiple required></label><div class="form-grid"><label class="field"><span>Tipo</span><select name="kind">'+Object.entries(labels).map(([v,l])=>option(v,l,v==='music')).join('')+'</select></label>'+field('Tags (opcional)','tags','','placeholder="Suspense, combate, chuva…" maxlength="200"')+'</div>',onSubmit:async form=>{
      const files=form.getAll('audioFiles').filter(f=>f.size);if(!files.length)throw new Error('Selecione um arquivo de áudio.');
      if(files.some(f=>f.size>100*1024*1024))throw new Error('Cada arquivo deve ter até 100 MB.');
      if(files.some(f=>!f.type.startsWith('audio/')&&!/\.(mp3|wav|ogg|m4a|flac|webm|aac|opus)$/i.test(f.name)))throw new Error('Selecione somente arquivos de áudio.');
      const assets=[];try{for(const file of files){const id=uid('asset');await putMedia(id,file);assets.push({id,name:file.name.replace(/\.[^.]+$/,''),filename:file.name,kind:form.get('kind'),tags:String(form.get('tags')).trim(),provider:'upload',size:file.size});}}catch(error){if(assets.length){this.ctx.state().audioAssets.push(...assets);this.ctx.commit();}throw error;}
      this.ctx.state().audioAssets.push(...assets);this.ctx.commit();toast(`${assets.length} áudio${assets.length>1?'s':''} adicionado${assets.length>1?'s':''}.`);return ()=>this.render(this.root);
    }});
  }
  addYouTube() {
    openForm({title:'Adicionar do YouTube',submit:'Adicionar à biblioteca',body:'<p class="dialog-description">Cole um link de vídeo ou playlist. O player oficial permanece visível e continua ativo durante a navegação.</p>'+field('Link do YouTube','url','','type="url" required placeholder="https://www.youtube.com/watch?v=…"')+field('Nome na biblioteca','name','','required maxlength="120" placeholder="Trilha de investigação"')+'<div class="form-grid">'+field('Iniciar em (segundos)','start','','type="number" min="0" step="1" placeholder="Usar o tempo do link"')+field('Tags (opcional)','tags','','maxlength="200" placeholder="Investigação, tensão…"')+'</div><p class="form-hint">Vídeos privados ou com incorporação bloqueada podem não tocar. No celular, o primeiro play pode exigir um toque no vídeo.</p>',onSubmit:form=>{
      const parsed=parseYouTube(String(form.get('url')));const name=String(form.get('name')).trim();if(!name)throw new Error('Informe um nome.');
      const asset={id:uid('asset'),name,provider:'youtube',kind:'music',tags:String(form.get('tags')).trim(),url:String(form.get('url')),...parsed,start:form.get('start')===''?parsed.start:Number(form.get('start'))};
      this.ctx.state().audioAssets.push(asset);this.ctx.commit();toast('Link adicionado à biblioteca.');return ()=>this.render(this.root);
    }});
  }
  editAsset(asset) {
    openForm({title:'Editar áudio',body:field('Nome','name',asset.name,'required maxlength="120"')+'<div class="form-grid"><label class="field"><span>Tipo</span><select name="kind" '+(asset.provider==='youtube'?'disabled':'')+'>'+Object.entries(labels).map(([v,l])=>option(v,l,v===asset.kind)).join('')+'</select></label>'+field('Tags','tags',asset.tags||'','maxlength="200"')+'</div>'+(asset.provider==='youtube'?field('URL do YouTube','url',asset.url,'type="url" required')+field('Início (segundos)','start',asset.start||0,'type="number" min="0"'):'')+`<p class="form-hint">${asset.builtin?'Áudio de demonstração preservado do protótipo original.':'Mudanças de nome e tags não interrompem a reprodução.'}</p>${asset.builtin?'':'<button type="button" class="btn danger full" id="deleteAsset">Excluir da biblioteca</button>'}`,onReady:root=>$('#deleteAsset',root)?.addEventListener('click',()=>confirmAction('Excluir áudio?',`“${asset.name}” será removido da biblioteca e das playlists. Referências em cenas precisarão de outro arquivo.`,async()=>{
      const engine=this.ctx.engine;if(engine.musicAsset?.id===asset.id||[...engine.tracks.values()].some(t=>t.assetId===asset.id))engine.stop();
      this.ctx.state().audioAssets=this.ctx.state().audioAssets.filter(a=>a.id!==asset.id);this.ctx.state().playlists.forEach(p=>p.assetIds=p.assetIds.filter(id=>id!==asset.id));
      if(asset.provider==='upload'){await deleteMedia(asset.id);releaseAsset(asset.id);}this.ctx.commit();return ()=>this.render(this.root);
    })),onSubmit:form=>{
      const name=String(form.get('name')).trim();if(!name)throw new Error('Informe um nome.');
      if(asset.provider==='youtube'){Object.assign(asset,parseYouTube(String(form.get('url'))));asset.url=String(form.get('url'));asset.start=Number(form.get('start'));}
      asset.name=name;asset.tags=String(form.get('tags')).trim();asset.kind=asset.provider==='youtube'?'music':form.get('kind');this.ctx.commit();return ()=>this.render(this.root);
    }});
  }
  editPlaylist(playlist=null) {
    let ids=[...(playlist?.assetIds||[])];const state=this.ctx.state();
    const renderList=root=>{
      $('#playlistTracks',root).innerHTML=ids.map((id,i)=>{const a=state.audioAssets.find(a=>a.id===id);if(!a)return '';return `<div class="playlist-edit-row"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(a.name)}</strong><button type="button" class="icon-btn" data-track-up="${i}" aria-label="Mover para cima">↑</button><button type="button" class="icon-btn" data-track-down="${i}" aria-label="Mover para baixo">↓</button><button type="button" class="icon-btn" data-track-remove="${i}" aria-label="Remover faixa">×</button></div>`;}).join('')||'<p class="empty-small">Adicione faixas abaixo.</p>';
      $('#playlistAddSelect',root).innerHTML='<option value="">Escolher uma faixa…</option>'+state.audioAssets.filter(a=>!ids.includes(a.id)).map(a=>option(a.id,a.name)).join('');
      $$('[data-track-up]',root).forEach(b=>b.onclick=()=>{const i=+b.dataset.trackUp;if(i>0)[ids[i-1],ids[i]]=[ids[i],ids[i-1]];renderList(root);});
      $$('[data-track-down]',root).forEach(b=>b.onclick=()=>{const i=+b.dataset.trackDown;if(i<ids.length-1)[ids[i+1],ids[i]]=[ids[i],ids[i+1]];renderList(root);});
      $$('[data-track-remove]',root).forEach(b=>b.onclick=()=>{ids.splice(+b.dataset.trackRemove,1);renderList(root);});
    };
    openForm({title:playlist?'Editar playlist':'Criar playlist',body:field('Nome da playlist','name',playlist?.name||'','required maxlength="100"')+'<span class="section-eyebrow">ORDEM DE REPRODUÇÃO</span><div id="playlistTracks"></div><div class="inline-add"><select id="playlistAddSelect" aria-label="Faixa para adicionar"></select><button type="button" class="btn outline" id="playlistAddTrack">Adicionar</button></div><p class="form-hint">As faixas tocam em sequência. Ambiências e efeitos usados aqui se comportam como faixas da playlist.</p>'+(playlist?'<button type="button" class="btn danger full" id="deletePlaylist">Excluir playlist</button>':''),onReady:root=>{
      renderList(root);$('#playlistAddTrack',root).onclick=()=>{const id=$('#playlistAddSelect',root).value;if(id&&!ids.includes(id)){ids.push(id);renderList(root);}};
      $('#deletePlaylist',root)?.addEventListener('click',()=>confirmAction('Excluir playlist?',`A playlist “${playlist.name}” será excluída. Os áudios continuam na biblioteca.`,()=>{state.playlists=state.playlists.filter(p=>p.id!==playlist.id);this.playlistId=null;this.ctx.commit();return ()=>this.render(this.root);}));
    },onSubmit:form=>{
      const name=String(form.get('name')).trim();if(!name)throw new Error('Informe um nome.');if(playlist){playlist.name=name;playlist.assetIds=ids;}else{const p={id:uid('playlist'),name,assetIds:ids};state.playlists.push(p);this.playlistId=p.id;}this.ctx.commit();return ()=>this.render(this.root);
    }});
  }
}
