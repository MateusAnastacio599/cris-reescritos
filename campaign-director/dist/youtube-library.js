import {uid} from './storage.js';
import {icon} from './icons.js';
import {$,$$,esc,openForm,field,toast} from './ui.js';

/** Lista oficial do player: IDs e capas sem chave; títulos completam ao tocar. */
export class YouTubeLibrary {
  constructor(ctx){this.ctx=ctx;this.assetId=null;this.loading=false;this.message='';}
  asset(){return this.ctx.state().audioAssets.find(a=>a.id===this.assetId);}
  mount(root){this.root=root;this.render();}
  async open(asset){
    this.assetId=asset.id;this.loading=true;this.message='Carregando a lista pelo player do YouTube…';this.render();
    try{const items=await this.ctx.engine.inspectYouTubePlaylist(asset);if(this.assetId!==asset.id)return;this.message=items.length?`${items.length} faixas disponibilizadas pelo player.`:'Carregamento cancelado.';}
    catch(e){if(this.assetId===asset.id){this.message=e.message;toast(e.message,true);}}
    finally{if(this.assetId===asset.id){this.loading=false;this.render();}}
  }
  render(){
    const host=this.root?.querySelector('#youtubeInspector');if(!host)return;const asset=this.asset();host.hidden=!asset;if(!asset)return;
    const queue=asset.youtubeTracks||[],engine=this.ctx.engine,currentId=engine.musicAsset?.provider==='youtube'?engine.yt?.getVideoData?.()?.video_id:null;
    host.innerHTML=`<header class="youtube-queue-head"><div><span class="section-eyebrow">${icon('youtube')} PLAYLIST DO YOUTUBE</span><h3>${esc(asset.name)}</h3></div><button class="icon-btn" id="closeYouTubeList" aria-label="Fechar lista de faixas">${icon('close')}</button></header><div class="youtube-queue-tools"><button class="btn outline small shuffle-toggle" id="shuffleYouTubePlaylist" aria-pressed="${asset.shuffle===true}" title="Alternar a ordem desta playlist">${icon('shuffle')} Aleatório</button><button class="btn outline small" id="refreshYouTubeList" ${this.loading?'disabled':''}>${this.loading?'Carregando…':'Atualizar lista'}</button><button class="btn outline small" id="importYouTubeTracks" ${queue.length?'':'disabled'}>${icon('plus')} Trazer faixas para a biblioteca</button><span>${esc(this.message||`${queue.length} faixas`)}</span></div><p class="youtube-list-note">O player fornece a lista e as capas sem precisar de uma chave. Os títulos são completados conforme cada vídeo toca; você também pode definir nomes de referência. Faixas privadas ou indisponíveis podem não aparecer.</p><div class="youtube-track-grid">${queue.map((item,index)=>`<article class="youtube-track-card ${item.videoId===currentId?'current':''}"><button class="youtube-track-cover" data-youtube-index="${index}" aria-label="Reproduzir faixa ${index+1}: ${esc(item.alias||item.title)}"><img src="https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg" width="128" height="72" alt="Capa de ${esc(item.alias||item.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></button><div><small>FAIXA ${String(index+1).padStart(2,'0')} · YOUTUBE</small><strong>${esc(item.alias||item.title)}</strong><div class="youtube-track-actions"><button class="btn subtle small" data-youtube-index="${index}">${icon('play')} Tocar</button><button class="icon-btn" data-youtube-alias="${index}" title="Nome de referência" aria-label="Editar nome da faixa ${index+1}">${icon('edit')}</button><button class="icon-btn" data-youtube-save="${index}" title="Usar esta faixa nas cenas" aria-label="Adicionar faixa ${index+1} à biblioteca">${icon('plus')}</button></div></div></article>`).join('')||'<div class="empty-state"><h3>'+esc(this.loading?'Aguardando a playlist…':'A lista ainda não está disponível')+'</h3><p>Use “Atualizar lista” e confira o player visível do YouTube.</p></div>'}</div>`;
    $('#shuffleYouTubePlaylist',host).onclick=()=>{engine.setYouTubeShuffle(asset,!asset.shuffle);this.ctx.save?.();this.render();toast(asset.shuffle?'Modo aleatório ativado no YouTube.':'Ordem original do YouTube ativada.');};
    $('#closeYouTubeList',host).onclick=()=>{this.assetId=null;this.render();};$('#refreshYouTubeList',host).onclick=()=>this.open(asset);
    $('#importYouTubeTracks',host).onclick=()=>{const ids=queue.map(item=>this.saveTrack(asset,item,false));const state=this.ctx.state();let playlist=state.playlists.find(p=>p.sourceYouTubeAssetId===asset.id);if(playlist)playlist.assetIds=ids;else state.playlists.push({id:uid('playlist'),name:asset.name+' · Faixas',assetIds:ids,sourceYouTubeAssetId:asset.id,shuffle:asset.shuffle===true});this.ctx.commit();toast(`${ids.length} faixas disponíveis para playlists, cenas e cues.`);};
    $$('[data-youtube-index]',host).forEach(b=>b.onclick=()=>engine.playMusic(asset,{youtubeIndex:Number(b.dataset.youtubeIndex),youtubeVideoId:queue[Number(b.dataset.youtubeIndex)].videoId}).catch(e=>toast(e.message,true)));
    $$('[data-youtube-save]',host).forEach(b=>b.onclick=()=>{this.saveTrack(asset,queue[Number(b.dataset.youtubeSave)]);});
    $$('[data-youtube-alias]',host).forEach(b=>b.onclick=()=>{const item=queue[Number(b.dataset.youtubeAlias)];openForm({title:'Nome de referência da faixa',body:field('Nome para usar na sua mesa','name',item.alias||item.title,'required maxlength="160"'),onSubmit:form=>{const name=String(form.get('name')).trim();if(!name)throw new Error('Informe um nome.');item.alias=name;this.ctx.save?.();return ()=>this.render();}});});
  }
  saveTrack(source,item,notify=true){
    const state=this.ctx.state();let found=state.audioAssets.find(a=>a.provider==='youtube'&&a.videoId===item.videoId&&!a.playlistId);
    if(!found){found={id:uid('asset'),name:item.alias||item.title,provider:'youtube',kind:'music',videoId:item.videoId,playlistId:null,start:0,tags:source.name,url:`https://www.youtube.com/watch?v=${item.videoId}`,sourceYouTubePlaylistId:source.playlistId};state.audioAssets.push(found);}
    if(notify){this.ctx.commit();toast('Faixa disponível na biblioteca e na configuração de cenas.');}return found.id;
  }
}
