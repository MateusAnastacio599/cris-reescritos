import {safeSpotifyImage} from './spotify-ui.js';
import {parseSpotify} from './spotify-auth.js';
import {setupYouTubeWindow} from './youtube-window.js';
import {loadState,saveState,initialState,makePage,makeScene,uid,clone,exportWorkspace,importWorkspace,STORAGE_KEY} from './storage.js';
import {AudioEngine,formatTime} from './audio-engine.js';
import {parseBlocks,renderReadBlocks,blocksToMarkdown} from './markdown.js';
import {BlockEditor} from './editor.js';
import {LibraryUI} from './library-ui.js';
import {AmbienceUI} from './ambience-ui.js';
import {musicSummary,openSceneMusic} from './music-ui.js';
import {openSceneConfig} from './scene-config.js';
import {CloudUI} from './cloud-ui.js';
import {icon} from './icons.js';
import {$,$$,esc,openForm,confirmAction,field,option,toast,downloadBlob,configureAudioPickers} from './ui.js';

let state,recoveryError;
try{state=loadState();}catch(error){recoveryError=error;state=initialState();}
configureAudioPickers(()=>state);
let editing=false,editor=null,saveTimer,saveFlashTimer;
const collapsed=new Set();
const engine=new AudioEngine(()=>state);
const configContext={state:()=>state,scene:()=>scene(),engine,location:locationForScene,commit:()=>commit(true)};
const library=new LibraryUI({state:()=>state,engine,commit:()=>commit(true),save:()=>autosave()});
const ambienceUI=new AmbienceUI({state:()=>state,engine,commit:()=>commit(true),save:()=>autosave()});

function campaign(){return state.campaigns.find(c=>c.id===state.ui.campaignId)||state.campaigns[0];}
function page(){return campaign().pages.find(p=>p.id===state.ui.pageId)||campaign().pages[0];}
function scene(){return page().scenes.find(s=>s.id===state.ui.sceneId)||page().scenes[0];}
function locationForScene(){return {key:`${campaign().id}/${page().id}/${scene().id}`,campaignId:campaign().id,pageId:page().id,sceneId:scene().id,pageTitle:page().title,campaignTitle:campaign().title};}
function normalizeSelection(){const c=campaign(),p=page(),s=scene();state.ui.campaignId=c.id;state.ui.pageId=p.id;state.ui.sceneId=s.id;}
function persist() {
  if(recoveryError){$('#saveStatus').className='save-status failed';$('#saveStatus span').textContent='Dados preservados · recuperação pendente';return false;}
  clearTimeout(saveTimer);
  try{saveState(state);const label=$('#saveStatus');label.className='save-status';$('span',label).textContent='Todas as alterações salvas';return true;}
  catch(error){$('#saveStatus').className='save-status failed';$('#saveStatus span').textContent='Falha ao salvar · faça um backup';toast('Não foi possível salvar. Exporte um backup antes de fechar esta página.',true);return false;}
}
function autosave(){
  $('#saveStatus').className='save-status saving';$('#saveStatus span').textContent='Salvando alterações…';clearTimeout(saveTimer);saveTimer=setTimeout(persist,350);
}
function commit(render=false){normalizeSelection();persist();if(render)renderApp();}
function navigate({campaignId,pageId,sceneId,view='document'}={}){
  persist();if(campaignId)state.ui.campaignId=campaignId;if(pageId)state.ui.pageId=pageId;if(sceneId)state.ui.sceneId=sceneId;
  state.ui.view=view;normalizeSelection();editing=false;editor=null;document.body.classList.remove('sidebar-open');commit(true);window.scrollTo({top:0,behavior:'instant'});
}
function renderApp(){
  editor?.destroy();editor=null;
  normalizeSelection();document.body.classList.toggle('session-mode',!!state.ui.sessionMode);
  $('#sessionMode').innerHTML=icon('eye')+`<span>${state.ui.sessionMode?'Sair da sessão':'Modo sessão'}</span>`;
  $('#campaignSwitch').innerHTML=state.campaigns.map(c=>option(c.id,c.title,c.id===campaign().id)).join('');
  renderTree();$('#openLibrary').classList.toggle('active',state.ui.view==='library');$('#openAmbiences').classList.toggle('active',state.ui.view==='ambiences');
  $('#breadcrumbs').innerHTML=icon(state.ui.view==='library'?'headphones':state.ui.view==='ambiences'?'rain':'book')+`<span>${esc(campaign().title)}</span><b>/</b><span>${esc(state.ui.view==='library'?'Biblioteca de áudio':state.ui.view==='ambiences'?'Ambientes':page().title)}</span>`;
  if(state.ui.view==='library'){editor=null;library.render($('#workspace'));}
  else if(state.ui.view==='ambiences'){editor=null;ambienceUI.render($('#workspace'));}
  else renderDocument();
  updateAudioUI();
}
function renderTree(){
  const groups=[...new Set(campaign().pages.map(p=>p.folder||'Páginas'))];
  $('#pageTree').innerHTML=groups.map(folder=>`<div class="tree-folder"><button class="folder-toggle ${collapsed.has(folder)?'collapsed':''}" data-folder="${esc(folder)}">${icon('down')}<span>${esc(folder)}</span><small>${campaign().pages.filter(p=>(p.folder||'Páginas')===folder).length}</small></button>${collapsed.has(folder)?'':campaign().pages.filter(p=>(p.folder||'Páginas')===folder).map(p=>`<button class="page-item ${p.id===page().id&&state.ui.view==='document'?'active':''}" data-page="${esc(p.id)}">${icon(p.icon||'file')}<span>${esc(p.title)}</span>${p.id===page().id&&state.ui.view==='document'?'<i></i>':''}</button>`).join('')}</div>`).join('');
  $$('[data-folder]').forEach(b=>b.onclick=()=>{collapsed.has(b.dataset.folder)?collapsed.delete(b.dataset.folder):collapsed.add(b.dataset.folder);renderTree();});
  $$('[data-page]').forEach(b=>b.onclick=()=>navigate({pageId:b.dataset.page,sceneId:campaign().pages.find(p=>p.id===b.dataset.page).scenes[0].id}));
}
function renderDocument(){
  editor?.destroy();editor=null;
  const p=page(),s=scene(),index=p.scenes.indexOf(s),words=s.markdown.replace(/\[\[.*?\]\]/g,'').split(/\s+/).filter(Boolean).length;
  const backlinks=campaign().pages.filter(other=>other!==p&&other.scenes.some(x=>x.markdown.includes(`[[page:${p.id}`)||x.markdown.toLocaleLowerCase().includes(`[[${p.title.toLocaleLowerCase()}]]`)));
  $('#workspace').innerHTML=`<section class="page-header"><div class="page-eyebrow"><span class="folder-label">${icon('folder')}${esc(p.folder||'Páginas')}</span><span class="page-kind">${icon('shield')} SÓ PARA O MESTRE</span></div><div class="page-title-row"><div><h1>${esc(p.title)}</h1><div class="page-tags">${(p.tags||[]).map((tag,i)=>`<span class="${i===0?'accent':''}">${esc(tag)}</span>`).join('')}<span class="scene-count">${p.scenes.length} cena${p.scenes.length>1?'s':''}</span></div></div><div class="page-actions"><button class="icon-btn" id="pageOptions" title="Opções da página e cena" aria-label="Opções da página e cena">${icon('more')}</button><button class="btn ${editing?'outline':'primary'}" id="toggleEdit">${icon(editing?'check':'edit')}<span>${editing?'Concluir edição':'Editar página'}</span></button></div></div></section><div class="scene-navigation"><div class="scene-tabs" role="tablist" aria-label="Cenas">${p.scenes.map((x,i)=>`<button role="tab" aria-selected="${x.id===s.id}" class="scene-tab ${x.id===s.id?'active':''}" data-scene="${esc(x.id)}"><small>${String(i+1).padStart(2,'0')}</small>${esc(x.title)}${x.id===s.id?'<i></i>':''}</button>`).join('')}<button class="new-scene" id="newScene" aria-label="Adicionar cena" title="Adicionar cena">${icon('plus')}</button></div><div class="scene-position">CENA <b>${String(index+1).padStart(2,'0')}</b><span>/ ${String(p.scenes.length).padStart(2,'0')}</span></div></div><div class="mobile-panel-switch" role="group" aria-label="Painel da cena"><button type="button" class="active" data-mobile-pane="document">${icon('file')} Roteiro</button><button type="button" data-mobile-pane="director">${icon('sliders')} Direção da cena</button></div><div class="stage-layout"><section class="document-card"><div class="document-top"><div class="doc-mode">${icon(editing?'edit':'file')}<span>${editing?'EDITOR VISUAL':'ROTEIRO DO MESTRE'}</span></div><div class="document-meta"><span>${Math.max(1,Math.ceil(words/200))} min de leitura</span><button class="icon-btn" id="markdownSource" title="Editar Markdown" aria-label="Editar código Markdown">${icon('code')}</button></div></div>${editing?`<div class="editor-toolbar"><select id="blockType" aria-label="Tipo do bloco">${[['paragraph','Texto'],['h1','Título 1'],['h2','Título 2'],['h3','Título 3'],['quote','Citação'],['note','Nota'],['list','Lista'],['numbered','Numerada'],['todo','Tarefa'],['table','Tabela'],['cue','Cue'],['divider','Divisória']].map(([v,l])=>option(v,l)).join('')}</select><span></span><button type="button" id="formatBold" title="Negrito" aria-label="Negrito"><b>B</b></button><button type="button" id="formatItalic" title="Itálico" aria-label="Itálico"><em>I</em></button><button type="button" id="insertPageLink" title="Link para página" aria-label="Inserir link interno">${icon('link')}</button><button type="button" id="editorUndo" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">↶</button><button type="button" id="editorRedo" title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer">↷</button><div class="editor-autosave">${icon('check')} Salvamento automático</div></div>`:''}<article class="document-body ${editing?'is-editing':''}" id="documentBody">${editing?'':renderReadBlocks(parseBlocks(s.markdown),campaign().pages)}</article><div class="document-end"><span>FIM DA CENA</span><i></i>${index<p.scenes.length-1?`<button class="next-scene-link" id="nextSceneLink">${esc(p.scenes[index+1].title)} ${icon('arrow')}</button>`:`<span class="end-label">${icon('check')} Roteiro da página concluído</span>`}</div>${backlinks.length?`<div class="backlinks"><span class="section-eyebrow">${icon('link')} MENCIONADO EM</span>${backlinks.map(x=>`<button data-page-link="${esc(x.id)}">${icon('file')}${esc(x.title)}</button>`).join('')}</div>`:''}</section><aside class="director-panel" id="directorPanel" aria-label="Direção da cena"></aside></div>`;
  $$('[data-scene]').forEach(b=>b.onclick=()=>navigate({sceneId:b.dataset.scene}));
  $('#newScene').onclick=()=>createScene();$('#pageOptions').onclick=()=>pageOptions();$('#toggleEdit').onclick=()=>{editing=!editing;persist();renderDocument();updateAudioUI();};
  $('#markdownSource').onclick=()=>openMarkdown();$('#nextSceneLink')?.addEventListener('click',()=>navigate({sceneId:p.scenes[index+1].id}));
  $$('[data-mobile-pane]').forEach(button=>button.onclick=()=>{const director=button.dataset.mobilePane==='director';$('.stage-layout').classList.toggle('mobile-director-view',director);$$('[data-mobile-pane]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});});
  renderDirector();
  if(editing){
    editor=new BlockEditor($('#documentBody'),{markdown:s.markdown,pages:campaign().pages,triggers:s.triggers,onChange:md=>{s.markdown=md;autosave();},onCue:fireTrigger,onRequestLink:insertPageLink,onActive:type=>{$('#blockType').value=type;}});
    $('#blockType').onchange=e=>editor.setType(e.target.value);$('#editorUndo').onclick=()=>editor.undo(-1);$('#editorRedo').onclick=()=>editor.undo(1);
    for(const [id,command] of [['formatBold','bold'],['formatItalic','italic']]){const b=$('#'+id);b.onpointerdown=e=>{editor.captureSelection();e.preventDefault();};b.onclick=()=>editor.format(command);}
    $('#insertPageLink').onpointerdown=()=>editor.captureSelection();$('#insertPageLink').onclick=insertPageLink;
  }else editor=null;
  $('#documentBody').onclick=editing?$('#documentBody').onclick:documentClick;
  $$('.backlinks [data-page-link]').forEach(b=>b.onclick=()=>navigate({pageId:b.dataset.pageLink}));
  $$('[data-todo]').forEach(el=>el.onchange=()=>{const blocks=parseBlocks(s.markdown);blocks[Number(el.dataset.todo)].checked=el.checked;s.markdown=blocksToMarkdown(blocks);autosave();});
}
function documentClick(e){
  const cue=e.target.closest('[data-inline-cue]');if(cue){fireTrigger(cue.dataset.inlineCue);return;}
  const link=e.target.closest('[data-page-link]');if(link){if(link.dataset.pageLink)navigate({pageId:link.dataset.pageLink});else createPage(link.dataset.linkTitle);}
}
function renderDirector(){
  const s=scene();const localAssets=state.audioAssets;
  $('#directorPanel').innerHTML=`<div class="director-heading"><div><span class="status-dot"></span> DIREÇÃO DA CENA</div><button class="icon-btn" id="configureScene" title="Configurar direção sonora" aria-label="Configurar direção sonora">${icon('sliders')}</button></div><div class="scene-control-card"><div class="scene-control-info"><span id="selectedSceneState">PRONTA PARA COMEÇAR</span><strong id="sceneTimer">00:00</strong></div><button class="scene-launch" id="startScene">${icon('play')}<span>Iniciar cena</span><kbd>ESPAÇO</kbd></button><div class="crossfade-control">${icon('sliders')}<label for="crossfadeInput">Crossfade</label><select id="crossfadeInput" aria-label="Duração do crossfade">${[0,.5,1,1.8,3,5,8].map(n=>option(n,n+'s',n===state.settings.crossfade)).join('')}</select></div></div><section class="scene-music-summary"><div>${icon('music')}<span><small>MÚSICA AO INICIAR</small><strong>${esc(musicSummary(s,state))}</strong></span><button class="icon-btn" id="sceneMusicSettings" aria-label="Configurar música e fades da cena" title="Música e fades da cena">${icon('sliders')}</button></div>${s.ambienceId&&s.ambienceId!=='stop'?`<small>Ambiente: ${esc(state.ambiences.find(a=>a.id===s.ambienceId)?.name||'Indisponível')}</small>`:''}</section><section class="director-section"><div class="director-section-head"><h3>${icon('sliders')} Mixer de camadas <span>${s.layers.length}</span></h3><button class="icon-btn" data-config="layers" title="Editar camadas" aria-label="Editar camadas">${icon('plus')}</button></div><div class="layer-list">${s.layers.map(l=>`<div class="layer-row"><div class="layer-name"><span class="layer-icon">${icon(l.group==='music'?'music':'rain')}</span><div><strong>${esc(l.name)}</strong><small>LOOP · ${esc(({ambience:'AMBIÊNCIA',music:'MÚSICA',sfx:'EFEITO'})[l.group]||'AMBIÊNCIA')}</small></div><span class="layer-value" data-layer-value="${esc(l.id)}">${Math.round(l.volume*100)}%</span></div><input data-layer-volume="${esc(l.id)}" aria-label="Volume ${esc(l.name)}" type="range" min="0" max="100" value="${Math.round(l.volume*100)}"></div>`).join('')||'<button class="empty-layer" data-config="layers">+ Adicionar uma ambiência</button>'}</div></section><section class="director-section"><div class="director-section-head"><h3>${icon('bolt')} Efeitos e cues</h3><button class="icon-btn" data-config="triggers" title="Editar gatilhos e cues" aria-label="Editar gatilhos e cues">${icon('plus')}</button></div><div class="trigger-grid">${s.triggers.map(t=>`<button class="trigger-button ${t.cue?'composed':''}" data-trigger="${esc(t.id)}"><span class="trigger-icon">${icon(t.cue?'bolt':/sino/i.test(t.name)?'bell':/trov/i.test(t.name)?'cloud':'volume')}</span>${t.key?`<kbd>${esc(t.key)}</kbd>`:''}<strong>${esc(t.name)}</strong><small>${t.cue?'CUE COMPOSTA':'EFEITO SONORO'}</small></button>`).join('')||'<button class="empty-layer" data-config="triggers">+ Adicionar um gatilho</button>'}</div></section><section class="director-section"><div class="director-section-head"><h3>${icon('clock')} Timeline</h3><button class="icon-btn" data-config="timeline" title="Editar timeline" aria-label="Editar timeline">${icon('plus')}</button></div><div id="timelineRows">${s.timeline.map((t,i)=>`<div class="timeline-row" data-timeline="${i}"><span class="timeline-dot"></span><time>${formatTime(t.at)}</time><div><strong>${esc(t.label)}</strong><small>${esc(({oneshot:'Efeito automático',fade:'Transição de volume',cue:'Cue automática'})[t.action]||t.action)}</small></div><span class="timeline-check">${icon('check')}</span></div>`).join('')||'<span class="empty-small">Sem eventos automáticos nesta cena.</span>'}</div><div class="timeline-next" id="timelineNext">Os eventos começam com a cena.</div></section><button class="silence-button" id="silenceButton">${icon('stop')}<span>Silêncio total</span><kbd>S</kbd></button><p class="director-footnote">${icon('info')} Navegue à vontade. O áudio continua.</p>`;
  $('#startScene').onclick=playSelected;$('#sceneMusicSettings').onclick=()=>openSceneMusic(configContext);$('#configureScene').onclick=()=>openSceneConfig(configContext);
  $$('[data-config]').forEach(b=>b.onclick=()=>openSceneConfig(configContext,b.dataset.config));
  $$('[data-trigger]').forEach(b=>b.onclick=()=>fireTrigger(b.dataset.trigger));$('#silenceButton').onclick=()=>{engine.silence();toast('Silêncio total. Eventos e ações pendentes cancelados.');};
  $('#crossfadeInput').onchange=e=>{state.settings.crossfade=Number(e.target.value);autosave();};
  $$('[data-layer-volume]').forEach(input=>input.oninput=()=>{const l=s.layers.find(l=>l.id===input.dataset.layerVolume);l.volume=Number(input.value)/100;$(`[data-layer-value="${CSS.escape(l.id)}"]`).textContent=input.value+'%';if(engine.active?.key===locationForScene().key)engine.setLayerVolume(l.id,l.volume);autosave();});
}
async function playSelected(){try{await engine.startScene(scene(),locationForScene());}catch(error){toast(error.message,true);}}
async function fireTrigger(id){try{await engine.fireTrigger(scene().triggers.find(t=>t.id===id),scene());}catch(error){toast(error.message,true);}}
function playing(){return engine.spotify.playing||engine.running||engine.ytPlaying||engine.ambiences.isPlaying||engine.music&&!engine.music.audio.paused||[...engine.tracks.values()].some(t=>!t.audio.paused&&!t.disposed)||[...engine.effects].some(t=>!t.audio.paused&&!t.disposed);}
function updateAudioUI(){
  const active=!!playing(),location=locationForScene(),selectedActive=engine.active?.key===location.key;
  $('#dockPlay').innerHTML=icon(active?'pause':'play');$('#dockPlay').setAttribute('aria-label',active?'Pausar áudio':'Reproduzir áudio');
  const spotifyTrack=engine.musicAsset?.provider==='spotify'?(engine.spotify.track||{}):null,spotifyCover=safeSpotifyImage(spotifyTrack?.album?.images?.[0]?.url||engine.musicAsset?.cover);
  $('#dockArtwork').classList.toggle('spotify-cover',!!spotifyTrack);
  $('#dockArtwork').innerHTML=spotifyTrack&&spotifyCover?`<a class="spotify-track-link" href="${esc(parseSpotify(engine.musicAsset.spotifyUri).url)}" target="_blank" rel="noopener" aria-label="Abrir faixa no Spotify"><img src="${esc(spotifyCover)}" alt="Capa do álbum"></a>`:active?'<div class="equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i></div>':icon('headphones');$('#dockArtwork').classList.toggle('playing',active);
  $('#dockContext').textContent=engine.musicAsset?'TOCANDO NA SUA MESA':engine.active?'CENA ATIVA · '+engine.active.campaignTitle.toLocaleUpperCase():'A MESA ESTÁ PRONTA';
  if(spotifyTrack)$('#dockContext').innerHTML='<span class="spotify-source-link"><img src="assets/spotify-icon.png" alt=""> Spotify</span>';
  $('#dockTitle').textContent=spotifyTrack?.name||(engine.musicAsset?.provider==='youtube'?engine.currentYouTubeTitle:null)||engine.musicAsset?.name||engine.active?.scene.title||engine.ambiences.active?.name||'Dê vida à sua próxima cena';
  $('#dockSubtitle').textContent=spotifyTrack?'Spotify · '+((spotifyTrack.artists||[]).map(a=>a.name).join(', ')||engine.musicAsset.artists||'Premium'):engine.active?.pageTitle||engine.musicAsset&&'Biblioteca de áudio'||'Áudio permanece ativo durante a navegação';
  $('#spotifyVolumeControl').hidden=!spotifyTrack;$('#spotifyVolume').value=Math.round((state.settings.spotifyVolume??1)*100);$('#spotifyVolumeValue').textContent=$('#spotifyVolume').value+'%';$('#audioDock').classList.toggle('has-spotify',!!spotifyTrack);document.body.classList.toggle('spotify-dock-active',!!spotifyTrack);
  $('#masterVolume').value=state.settings.master*100;$('#audioReady').innerHTML=`<i class="${active?'playing':''}"></i> ${active?'Áudio em execução':engine.paused?'Áudio pausado':'Motor de áudio pronto'}`;
  $('#dockPrevious').disabled=engine.musicAsset?.provider!=='spotify'&&!engine.playlist&&!engine.musicAsset?.playlistId;$('#dockNext').disabled=$('#dockPrevious').disabled;
  if($('#startScene')){$('#startScene').innerHTML=icon(selectedActive&&engine.running?'pause':'play')+`<span>${selectedActive&&engine.running?'Pausar cena':selectedActive&&engine.paused?'Continuar cena':engine.running?'Transicionar para cena':'Iniciar cena'}</span><kbd>ESPAÇO</kbd>`;$('#startScene').classList.toggle('running',selectedActive&&engine.running);$('#selectedSceneState').textContent=selectedActive?(engine.running?'CENA EM EXECUÇÃO':engine.paused?'CENA PAUSADA':'PRONTA PARA COMEÇAR'):engine.running?'OUTRA CENA ESTÁ TOCANDO':'PRONTA PARA COMEÇAR';}
  if(selectedActive)for(const [id,track] of engine.tracks){const input=$(`[data-layer-volume="${CSS.escape(id)}"]`);if(input){input.value=Math.round(track.volume*100);$(`[data-layer-value="${CSS.escape(id)}"]`).textContent=Math.round(track.volume*100)+'%';}}
  ambienceUI.update();
  updateTick();
  if($('#mixerLiveRows'))renderMixerRows();
}
function updateTick(){
  const time=engine.currentTime();$('#dockTime').textContent=formatTime(engine.musicAsset?.provider==='spotify'?(engine.spotify.state?.position||0)/1000:time);
  if(!$('#sceneTimer'))return;const same=engine.active?.key===locationForScene().key;
  $('#sceneTimer').textContent=formatTime(same?time:0);
  $$('[data-timeline]').forEach(row=>row.classList.toggle('done',same&&engine.fired.has(Number(row.dataset.timeline))));
  const next=engine.active?.scene.timeline.find((t,i)=>!engine.fired.has(i)&&t.at>time);
  $('#timelineNext').textContent=same&&engine.running?(next?`Próximo evento em ${Math.ceil(next.at-time)}s`:'Todos os eventos foram executados.'):same&&engine.paused?'Timeline pausada.':'Os eventos começam com a cena.';
}
function openMixer(){
  openForm({title:'Mixer persistente',body:'<p class="dialog-description">Controle o áudio de toda a mesa. Estes canais continuam ativos ao trocar de página ou campanha.</p><div class="global-mixer">'+[['master','volume','Geral'],['music','music','Música / YouTube'],['ambience','rain','Ambiências'],['sfx','bolt','Efeitos sonoros']].map(([key,glyph,label])=>`<label class="global-mix-row"><span>${icon(glyph)}${label}</span><output data-mix-value="${key}">${Math.round(state.settings[key]*100)}%</output><input type="range" data-mix="${key}" min="0" max="100" aria-label="${label}" value="${Math.round(state.settings[key]*100)}"></label>`).join('')+'</div><div class="section-heading"><h3>Reproduzindo agora</h3><span class="persistent-tag">PERSISTENTE</span></div><div id="mixerLiveRows"></div><button type="button" id="mixerSilence" class="btn danger full">'+icon('stop')+' Silêncio total</button>',onReady:root=>{
    $$('[data-mix]',root).forEach(input=>input.oninput=()=>{engine.setMix(input.dataset.mix,Number(input.value)/100);$(`[data-mix-value="${input.dataset.mix}"]`,root).textContent=input.value+'%';autosave();});
    $('#mixerSilence',root).onclick=()=>engine.silence();renderMixerRows();
  }});
}
function renderCurrentMusicMix(root){
  let panel=$('#currentMusicMix',root.parentElement);
  if(!engine.musicAsset){panel?.remove();return;}
  if(!panel){panel=document.createElement('section');panel.id='currentMusicMix';panel.className='current-music-mix';panel.innerHTML=`<span class="section-eyebrow">FAIXA ATUAL</span><strong id="currentMusicName"></strong><label class="global-mix-row"><span>Volume da faixa</span><output id="currentMusicValue"></output><input type="range" id="currentMusicVolume" min="0" max="100" aria-label="Volume da faixa atual"></label><label class="check-field" id="currentMusicLoopField"><input type="checkbox" id="currentMusicLoop"><span>Repetir esta música</span></label><p class="form-hint">O volume final também depende dos canais Música e Geral acima. Estes ajustes valem para a reprodução atual.</p>`;root.before(panel);$('#currentMusicVolume',panel).oninput=e=>{const value=Number(e.target.value);$('#currentMusicValue',panel).textContent=value+'%';engine.fadeMusicTo(value/100,.08);};$('#currentMusicLoop',panel).onchange=e=>engine.setMusicLoop(e.target.checked);}
  $('#currentMusicName',panel).textContent=(engine.musicAsset.provider==='youtube'&&engine.currentYouTubeTitle)||engine.musicAsset.name;
  const level=Math.round(engine.musicTargetLevel*100),input=$('#currentMusicVolume',panel);if(document.activeElement!==input)input.value=level;$('#currentMusicValue',panel).textContent=level+'%';
  $('#currentMusicLoopField',panel).hidden=!!engine.playlist||!!engine.musicAsset.playlistId;$('#currentMusicLoop',panel).checked=engine.musicFadeOptions?.loop!==false;
}
function renderMixerRows(){const root=$('#mixerLiveRows');if(!root)return;renderCurrentMusicMix(root);root.innerHTML=[...engine.tracks.entries(),...[...engine.ambiences.tracks].map(([id,t])=>['amb:'+id,t])].map(([id,t])=>`<div class="live-mix-row"><span class="status-dot"></span><strong>${esc(t.name)}</strong><small>${Math.round(t.volume*100)}%</small><button type="button" class="icon-btn" data-stop-track="${esc(id)}" aria-label="Parar camada">${icon('stop')}</button></div>`).join('')+(engine.ambiences.jobs.size?`<div class="live-mix-row">${icon('bolt')}<strong>${esc(engine.ambiences.active?.name||'Ambiente')}</strong><small>${engine.ambiences.jobs.size} ocasionais</small></div>`:'')+(engine.musicAsset?`<div class="live-mix-row">${icon('music')}<strong>${esc(engine.musicAsset.name)}</strong><small>Música</small></div>`:'')||'<p class="empty-small">Inicie uma cena ou reproduza um item da biblioteca.</p>';$$('[data-stop-track]',root).forEach(b=>b.onclick=()=>{const id=b.dataset.stopTrack;const map=id.startsWith('amb:')?engine.ambiences.tracks:engine.tracks;const key=id.startsWith('amb:')?id.slice(4):id;if(id.startsWith('amb:'))engine.ambiences.toggleLayer(key,false).catch(e=>toast(e.message,true));else{engine.dispose(map.get(key));map.delete(key);engine.emit();}});}
function insertPageLink(){if(!editor)return;editor.captureSelection();openForm({title:'Link para uma página',body:'<p class="dialog-description">Crie uma conexão no seu roteiro. Na leitura, o link abre a página sem interromper o áudio.</p><label class="field"><span>Página de destino</span><select name="pageId">'+campaign().pages.map(p=>option(p.id,p.title)).join('')+'</select></label>',submit:'Inserir link',onSubmit:form=>{const target=campaign().pages.find(p=>p.id===form.get('pageId'));return ()=>editor?.insertLink(target);}});}
function openMarkdown(){const s=scene();openForm({title:'Editar Markdown',wide:true,body:'<p class="dialog-description">Os modos visual e Markdown editam o mesmo roteiro. Links: [[Nome da página]]. Cues: [[cue:id|Nome do botão]].</p><label class="field"><span>Conteúdo da cena</span><textarea name="markdown" class="source-editor" spellcheck="false">'+esc(s.markdown)+'</textarea></label>',onSubmit:form=>{s.markdown=String(form.get('markdown'));commit(true);}});}
function createPage(prefill=''){
  openForm({title:'Nova página',body:field('Título','title',prefill,'required maxlength="120" placeholder="Um lugar, personagem, sessão…"')+field('Pasta','folder',page()?.folder||'Sessão 01','required maxlength="80" list="folderOptions"')+`<datalist id="folderOptions">${[...new Set(campaign().pages.map(p=>p.folder).concat(['Personagens','Investigação','Locais','Banco do mestre']))].filter(Boolean).map(f=>option(f,f)).join('')}</datalist>`,submit:'Criar página',onSubmit:form=>{const title=String(form.get('title')).trim();if(!title)throw new Error('Dê um título à página.');const p=makePage(title,String(form.get('folder')).trim()||'Páginas');campaign().pages.push(p);collapsed.delete(p.folder);return ()=>navigate({pageId:p.id,sceneId:p.scenes[0].id});}});
}
function createScene(){openForm({title:'Nova cena',body:field('Nome da cena','title','','required maxlength="120" placeholder="Ex.: A porta no fim do corredor"'),submit:'Criar cena',onSubmit:form=>{const title=String(form.get('title')).trim();if(!title)throw new Error('Dê um nome à cena.');const s=makeScene(title);page().scenes.push(s);return ()=>{navigate({sceneId:s.id});editing=true;renderDocument();updateAudioUI();};}});}
function editPage(){const p=page();openForm({title:'Configurar página',body:field('Título','title',p.title,'required maxlength="120"')+field('Pasta','folder',p.folder||'Páginas','required maxlength="80"')+field('Tags (separadas por vírgula)','tags',(p.tags||[]).join(', '),'maxlength="250"')+'<label class="field"><span>Ícone</span><select name="icon">'+[['file','Página'],['book','Livro'],['folder','Pasta'],['eye','Investigação'],['shield','Personagem'],['music','Música'],['bell','Evento']].map(([v,l])=>option(v,l,v===(p.icon||'file'))).join('')+'</select></label>',onSubmit:form=>{const title=String(form.get('title')).trim();if(!title)throw new Error('Informe o título.');p.title=title;p.folder=String(form.get('folder')).trim()||'Páginas';p.tags=String(form.get('tags')).split(',').map(x=>x.trim()).filter(Boolean);p.icon=form.get('icon');commit(true);}});}
function pageOptions(){
  const p=page(),s=scene();openForm({title:'Página e cena',body:`<div class="option-list"><button type="button" id="editPageMeta">${icon('edit')} Configurar página <small>${esc(p.title)}</small></button><button type="button" id="renameScene">${icon('file')} Renomear cena <small>${esc(s.title)}</small></button>${s.textHistory?.length?`<button type="button" id="sceneTextHistory">${icon('file')} Versões anteriores do roteiro <small>${s.textHistory.length} versões</small></button>`:''}<button type="button" id="duplicateScene">${icon('copy')} Duplicar cena e direção sonora</button><button type="button" id="deleteScene" class="danger-text">${icon('trash')} Excluir cena atual</button><button type="button" id="deletePage" class="danger-text">${icon('trash')} Excluir página e cenas</button></div>`,onReady:root=>{
    $('#editPageMeta',root).onclick=editPage;$('#sceneTextHistory',root)?.addEventListener('click',()=>openSceneHistory(s));
    $('#renameScene',root).onclick=()=>openForm({title:'Renomear cena',body:field('Nome','title',s.title,'required maxlength="120"'),onSubmit:form=>{const title=String(form.get('title')).trim();if(!title)throw new Error('Informe um nome.');s.title=title;delete s.label;commit(true);}});
    $('#duplicateScene',root).onclick=()=>{const duplicate=clone(s);duplicate.id=uid('scene');duplicate.title+=' (cópia)';delete duplicate.label;p.scenes.splice(p.scenes.indexOf(s)+1,0,duplicate);$('#appDialog').close();navigate({sceneId:duplicate.id});};
    $('#deleteScene',root).onclick=()=>{if(p.scenes.length===1){toast('A página precisa de uma cena. Crie outra antes de excluir esta.',true);return;}confirmAction('Excluir cena?',`O roteiro e a direção de “${s.title}” serão excluídos.`,()=>{if(engine.active?.key===locationForScene().key)engine.stop();p.scenes=p.scenes.filter(x=>x!==s);return ()=>navigate({sceneId:p.scenes[0].id});});};
    $('#deletePage',root).onclick=()=>{if(campaign().pages.length===1){toast('A campanha precisa de uma página. Crie outra antes de excluir esta.',true);return;}confirmAction('Excluir página?',`“${p.title}” e suas ${p.scenes.length} cenas serão excluídas. Exporte um backup se quiser guardar uma cópia.`,()=>{if(engine.active?.pageId===p.id)engine.stop();campaign().pages=campaign().pages.filter(x=>x!==p);return ()=>navigate({pageId:campaign().pages[0].id,sceneId:campaign().pages[0].scenes[0].id});});};
  }});
}
function openSceneHistory(target){
  const history=target.textHistory||[];
  openForm({
    title:`Versões do roteiro · ${target.title}`,
    body:'<p class="dialog-description">As versões guardam o texto. A direção sonora e sua biblioteca continuam independentes.</p><div class="option-list">'+history.map((version,i)=>`<button type="button" data-text-version="${i}">${icon('file')} ${esc(version.title||'Versão anterior')}<small>${esc(new Date(version.at).toLocaleString('pt-BR'))}</small></button>`).join('')+'</div>',
    onReady:root=>{
      $$('[data-text-version]',root).forEach(button=>{
        button.onclick=()=>{
          const version=history[Number(button.dataset.textVersion)];
          openForm({title:version.title||'Versão anterior',wide:true,body:'<article class="document-body history-preview">'+renderReadBlocks(parseBlocks(version.markdown),campaign().pages)+'</article>',submit:'Restaurar este texto',onSubmit:()=>{
            target.textHistory.push({title:'Antes de restaurar uma versão',at:new Date().toISOString(),markdown:target.markdown});
            target.markdown=version.markdown;editing=false;commit(true);toast('Texto restaurado. A configuração de áudio foi mantida.');
          }});
        };
      });
    }
  });
}

function manageCampaigns(){
  openForm({title:'Suas campanhas',body:`<p class="dialog-description">Cada campanha tem suas páginas e cenas. A biblioteca de áudio é compartilhada pelo seu espaço.</p><div class="campaign-list">${state.campaigns.map(c=>`<div class="config-row"><span class="campaign-avatar">${esc(c.title[0].toUpperCase())}</span><div><strong>${esc(c.title)}</strong><small>${c.pages.length} páginas · ${c.pages.reduce((n,p)=>n+p.scenes.length,0)} cenas</small></div><button class="icon-btn" type="button" data-rename-campaign="${esc(c.id)}" aria-label="Editar campanha">${icon('edit')}</button><button class="icon-btn" type="button" data-delete-campaign="${esc(c.id)}" aria-label="Excluir campanha">${icon('trash')}</button></div>`).join('')}</div><button type="button" class="btn outline full" id="createCampaign">${icon('plus')} Nova campanha</button>`,onReady:root=>{
    $('#createCampaign',root).onclick=()=>campaignForm();$$('[data-rename-campaign]',root).forEach(b=>b.onclick=()=>campaignForm(state.campaigns.find(c=>c.id===b.dataset.renameCampaign)));
    $$('[data-delete-campaign]',root).forEach(b=>b.onclick=()=>{const c=state.campaigns.find(c=>c.id===b.dataset.deleteCampaign);if(state.campaigns.length===1){toast('Crie outra campanha antes de excluir a última.',true);return;}confirmAction('Excluir campanha?',`“${c.title}” e todas as páginas e cenas serão excluídas deste navegador.`,()=>{if(engine.active?.campaignId===c.id)engine.stop();state.campaigns=state.campaigns.filter(x=>x!==c);return ()=>navigate({campaignId:state.campaigns[0].id,pageId:state.campaigns[0].pages[0].id,sceneId:state.campaigns[0].pages[0].scenes[0].id});});});
  }});
}
function campaignForm(c=null){openForm({title:c?'Editar campanha':'Nova campanha',body:field('Nome da campanha','title',c?.title||'','required maxlength="120"')+field('Descrição (opcional)','description',c?.description||'','maxlength="240"'),submit:c?'Salvar':'Criar campanha',onSubmit:form=>{const title=String(form.get('title')).trim();if(!title)throw new Error('Informe um nome.');if(c){c.title=title;c.description=String(form.get('description')).trim();commit(true);}else{const p=makePage('Visão geral','Campanha');const value={id:uid('campaign'),title,description:String(form.get('description')).trim(),pages:[p]};state.campaigns.push(value);return ()=>navigate({campaignId:value.id,pageId:p.id,sceneId:p.scenes[0].id});}}});}
function openSearch(){
  openForm({title:'Encontrar na campanha',body:'<label class="search-field large">'+icon('search')+'<input id="globalSearch" type="search" placeholder="Página, cena ou trecho do roteiro…" autocomplete="off" aria-label="Buscar páginas e cenas"></label><div id="searchResults" class="search-results"></div>',onReady:root=>{
    const search=()=>{const term=$('#globalSearch',root).value.toLocaleLowerCase().trim();const results=campaign().pages.flatMap(p=>p.scenes.map(s=>({p,s}))).filter(({p,s})=>!term||`${p.title} ${s.title} ${s.markdown}`.toLocaleLowerCase().includes(term)).slice(0,30);$('#searchResults',root).innerHTML=results.map(({p,s})=>`<button type="button" data-search-page="${esc(p.id)}" data-search-scene="${esc(s.id)}">${icon('file')}<span><strong>${esc(s.title)}</strong><small>${esc(p.title)} / ${esc(p.folder||'Páginas')}</small></span>${icon('arrow')}</button>`).join('')||'<p class="empty-small">Nenhum resultado encontrado nesta campanha.</p>';$$('[data-search-page]',root).forEach(b=>b.onclick=()=>{$('#appDialog').close();navigate({pageId:b.dataset.searchPage,sceneId:b.dataset.searchScene});});};$('#globalSearch',root).oninput=search;search();$('#globalSearch',root).focus();
  }});
}
function openBackups(){
  openForm({title:'Backup da sua mesa',body:`<div class="backup-notice">${icon('shield')}<div><strong>Salvo neste navegador</strong><p>As edições e os arquivos enviados ficam neste aparelho. Para usar em outro celular ou computador, exporte um backup e importe lá.</p></div></div><div class="backup-summary"><span><strong>${state.campaigns.length}</strong> campanhas</span><span><strong>${state.campaigns.reduce((n,c)=>n+c.pages.length,0)}</strong> páginas</span><span><strong>${state.audioAssets.length}</strong> áudios</span></div><button type="button" class="btn primary full" id="exportBackup">${icon('download')} Exportar backup completo</button><p class="form-hint">Inclui campanhas, textos, configurações, playlists e arquivos de áudio enviados. Os seis áudios originais já acompanham o site.</p><hr><label class="field"><span>Restaurar backup (.json)</span><input type="file" id="backupInput" accept="application/json,.json"></label><p class="form-hint">A restauração substitui o espaço atual após sua confirmação.</p><button type="button" class="btn outline full" id="restoreBackup" disabled>${icon('upload')} Restaurar backup</button>`,onReady:root=>{
    $('#exportBackup',root).onclick=async e=>{e.currentTarget.disabled=true;try{persist();const blob=await exportWorkspace(state);downloadBlob(blob,`CRIS-Director-backup-${new Date().toISOString().slice(0,10)}.json`);toast('Backup completo preparado.');}catch(error){toast(error.message,true);}finally{if($('#exportBackup'))$('#exportBackup').disabled=false;}};
    $('#backupInput',root).onchange=()=>{$('#restoreBackup',root).disabled=!$('#backupInput',root).files.length;};
    $('#restoreBackup',root).onclick=async()=>{const file=$('#backupInput',root).files[0];if(!file)return;if(file.size>400*1024*1024){toast('Este backup é grande demais para ser restaurado neste navegador.',true);return;}const text=await file.text();confirmAction('Restaurar este backup?',`O conteúdo atual será substituído pelo arquivo “${file.name}”. Se precisar, exporte o espaço atual antes de continuar.`,async()=>{const restored=await importWorkspace(text);engine.stop();state=restored;editing=false;recoveryError=null;commit(true);toast('Backup restaurado.');},'Restaurar');};
  }});
}
function showHelp(){openForm({title:'Bem-vindo à sua mesa',body:`<div class="help-intro">${icon('book')}<p>O Campaign Director é independente do CRIS principal. Comece pela Casa São Martinho: as três cenas foram atualizadas e os sons de demonstração podem ser removidos na biblioteca.</p></div><div class="help-list"><p><b>Escreva.</b> Use “Editar página” para criar blocos, mudar títulos e inserir links. Digite / em um bloco vazio para escolher um tipo.</p><p><b>Prepare.</b> Nos botões + da direção, configure camadas, efeitos, cues e a timeline. Crie páginas e campanhas pela navegação.</p><p><b>Conduza.</b> Inicie uma cena e navegue à vontade. O áudio só troca de cena quando você clica em iniciar ou transicionar. No celular, toque no play para liberar o áudio.</p><p><b>Guarde.</b> Use “Backup e dados” para transportar suas alterações e áudios entre aparelhos. A reprodução em segundo plano depende do navegador e do sistema.</p></div><div class="keyboard-help"><span><kbd>Espaço</kbd> Iniciar / pausar cena</span><span><kbd>1–9</kbd> Disparar gatilhos</span><span><kbd>S</kbd> Silêncio total</span><span><kbd>Ctrl / ⌘ K</kbd> Buscar na campanha</span></div><p class="form-hint">YouTube usa o player oficial. A disponibilidade do vídeo e a permissão de reprodução são definidas pelo YouTube e pelo navegador. Use Transições na biblioteca para os fades padrão e Música na direção para ajustar cada cena. O crossfade simultâneo é aplicado aos arquivos locais. No YouTube, a entrada aguarda o vídeo começar; a rede e os anúncios ainda podem gerar intervalo.</p>`});}

// App Shell permanece montado. Só o conteúdo do workspace é substituído.
$('#manageCampaigns').innerHTML=icon('more');$('#newPage').innerHTML=icon('plus');$('#menuToggle').innerHTML=icon('menu');$('#helpButton').innerHTML=icon('info');
$('#newPageBottom').innerHTML=icon('plus')+' Nova página';$('#openSearch').innerHTML=icon('search')+'<span>Encontrar na campanha</span><kbd>⌘ K</kbd>';
$('#openAmbiences').innerHTML=icon('rain')+'<span>Ambientes</span><span class="nav-new">✦</span>';
$('#openLibrary').innerHTML=icon('headphones')+'<span>Biblioteca de áudio</span><span class="nav-new">♫</span>';
$('#openBackups').innerHTML=icon('download')+'<span>Backup e dados</span>';
$('#dockPrevious').innerHTML=icon('previous');$('#dockNext').innerHTML=icon('skip');$('#dockStop').innerHTML=icon('stop');$('#volumeIcon').innerHTML=icon('volume');$('#openMixer').innerHTML=icon('sliders')+'<span>Mixer</span>';
$('#homeBrand').onclick=e=>{e.preventDefault();navigate();};$('#campaignSwitch').onchange=e=>{const c=state.campaigns.find(c=>c.id===e.target.value);navigate({campaignId:c.id,pageId:c.pages[0].id,sceneId:c.pages[0].scenes[0].id});};
$('#newPage').onclick=()=>createPage();$('#newPageBottom').onclick=()=>createPage();$('#manageCampaigns').onclick=manageCampaigns;$('#openSearch').onclick=openSearch;$('#openLibrary').onclick=()=>navigate({view:'library'});$('#openAmbiences').onclick=()=>navigate({view:'ambiences'});$('#openBackups').onclick=openBackups;$('#helpButton').onclick=showHelp;
$('#menuToggle').onclick=()=>document.body.classList.toggle('sidebar-open');$('#sidebarScrim').onclick=()=>document.body.classList.remove('sidebar-open');
$('#sessionMode').onclick=()=>{persist();state.ui.sessionMode=!state.ui.sessionMode;editing=false;commit(true);};
$('#dockPlay').onclick=()=>{if(engine.active||engine.musicAsset||engine.tracks.size||engine.ambiences.active)engine.toggleTransport();else playSelected();};$('#dockPrevious').onclick=()=>engine.nextMusic(-1);$('#dockNext').onclick=()=>engine.nextMusic(1);$('#dockStop').onclick=()=>engine.stop();$('#openMixer').onclick=openMixer;$('#closeYoutube').onclick=()=>engine.closeYouTube();
setupYouTubeWindow({panel:$('#youtubePanel'),dock:$('#audioDock'),moveButton:$('#moveYoutube'),sizeButton:$('#sizeYoutube'),getCompact:()=>state.settings.youtubeCompact!==false,setCompact:value=>{state.settings.youtubeCompact=value;autosave();}});
$('#spotifyVolume').oninput=e=>{state.settings.spotifyVolume=Number(e.target.value)/100;engine.applySpotifyVolume();$('#spotifyVolumeValue').textContent=e.target.value+'%';autosave();};
$('#spotifyFadeSettings').onclick=()=>library.spotify.open();
$('#masterVolume').oninput=e=>{engine.setMix('master',Number(e.target.value)/100);autosave();};
engine.addEventListener('change',()=>{updateAudioUI();if(state.ui.view==='library')library.renderRows();});engine.addEventListener('tick',updateTick);engine.addEventListener('error',e=>toast(e.detail.message,true));
engine.addEventListener('message',e=>toast(e.detail.message));
engine.addEventListener('navigate',e=>{const p=campaign().pages.find(p=>p.id===e.detail.pageId);if(p)navigate({pageId:p.id,sceneId:e.detail.sceneId||p.scenes[0].id});else toast('A página desta cue não está na campanha atual.',true);});
engine.addEventListener('settings',autosave);
engine.addEventListener('youtubequeue',e=>{const asset=state.audioAssets.find(a=>a.id===e.detail.assetId);if(!asset)return;const items=e.detail.items;if(JSON.stringify(asset.youtubeTracks)!==JSON.stringify(items)){asset.youtubeTracks=items;asset.youtubeTracksAt=new Date().toISOString();autosave();}if(state.ui.view==='library'&&library.youtube.assetId===asset.id)library.youtube.render();});
engine.addEventListener('youtubetrack',e=>{const asset=state.audioAssets.find(a=>a.id===e.detail.assetId);if(asset&&e.detail.title){asset.metadataTitle=e.detail.title;if(!asset.playlistId&&/^Faixa \d+$/i.test(asset.name))asset.name=e.detail.title;autosave();}if(state.ui.view==='library')library.renderRows();});
engine.addEventListener('cue',e=>{const button=$(`[data-trigger="${CSS.escape(e.detail.id)}"]`);button?.classList.remove('fired');requestAnimationFrame(()=>{button?.classList.add('fired');setTimeout(()=>button?.classList.remove('fired'),700);});});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){$('#blockPopover')?.remove();document.body.classList.remove('sidebar-open');}
  if($('#appDialog').open)return;
  const target=document.activeElement,typing=target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName);
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!typing){e.preventDefault();openSearch();return;}if(typing)return;
  if(e.code==='Space'&&target?.tagName!=='BUTTON'){e.preventDefault();playSelected();}
  if(e.key.toLowerCase()==='s'){e.preventDefault();engine.silence();}
  const trigger=scene().triggers.find(t=>t.key===e.key);if(trigger)fireTrigger(trigger.id);
});
window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist();});
window.addEventListener('error',e=>{console.error('CRIS runtime error:',e.error);});
normalizeSelection();renderApp();
if(recoveryError)openForm({title:'Recuperar seus dados',body:'<p class="dialog-description">Os dados salvos neste navegador não puderam ser lidos. Eles foram preservados. Você pode baixar o conteúdo para recuperação ou restaurar um backup válido.</p><button type="button" class="btn outline full" id="downloadRecovery">Baixar os dados preservados</button><button type="button" class="btn primary full" id="recoveryImport">Importar um backup</button>',onReady:root=>{$('#downloadRecovery',root).onclick=()=>downloadBlob(new Blob([localStorage.getItem(STORAGE_KEY)||''],{type:'application/json'}),'CRIS-dados-recuperacao.json');$('#recoveryImport',root).onclick=openBackups;}});
else persist();
new CloudUI({state:()=>state,persist,blocked:()=>!!recoveryError,backups:openBackups,restore:next=>{engine.stop();state=next;editing=false;commit(true);}});

if(new URLSearchParams(location.search).get('spotify')==='connected'){history.replaceState(null,'',location.pathname);toast('Spotify conectado. Abra Biblioteca → Spotify → Preparar player.');}
