import {$} from './ui.js';
import {checkCinematicVideo} from './cinematic-video.js?v=directorcinematic01';
import {imageKey} from './cinematic-media.js?v=directorcinematic01';
export function renderBackgroundMedia(root,{state,composer,change}){
  const v=state.backgroundVideo;
  root.innerHTML=`<h3>Fundo vivo</h3><p class="form-hint">A imagem de fundo continua sendo o fallback. Anexe WebM VP9 com ou sem alpha, sem áudio, até 8 MB / 12 s. Fundo e camadas compartilham o limite de dois vídeos. Janelas ficam em Direção.</p><div class="cinematic-actions"><button type="button" data-use-theater>Usar teatro corrigido (imagem)</button><button type="button" data-use-theater-video>Usar teatro vivo de demonstração</button></div><p class="form-hint">Essas ações substituem o fundo do rascunho. Salvar continua explícito.</p><input type="file" data-background-video accept="video/webm">${v?`<p>Vídeo local anexado.</p><label><input type="checkbox" data-background-enabled ${v.enabled?'checked':''}>Ativo</label><label><input type="checkbox" data-background-loop ${v.loop?'checked':''}>Repetir</label><label class="field">Velocidade<input type="number" data-background-rate min=".25" max="2" step=".05" value="${v.rate}"></label><label class="field">Atraso (s)<input type="number" data-background-delay min="0" max="60" value="${v.delay}" step="any"></label><button type="button" data-background-remove>Remover vídeo e manter imagem</button>`:''}<p data-bg-status role="status"></p>`;
  const importDemo=async animated=>{
    if(composer.busy)return;composer.busy=true;composer.onChange();const revision=composer.revision;try{const image=new File([await(await fetch(new URL('./assets/cinematic/theater-corrected.png',import.meta.url))).arrayBuffer()],'teatro-corrigido.png',{type:'image/png'});if(!root.isConnected||revision!==composer.revision)return;await composer.useBackground(image);
      if(animated){const movie=new Blob([await(await fetch(new URL('./assets/cinematic/theater-living.webm',import.meta.url))).arrayBuffer()],{type:'video/webm'}),mediaId=await imageKey(movie);if(revision!==composer.revision||!root.isConnected)return;if(composer.layers.filter(l=>l.video).length>=2)throw Error('A composição já tem dois vídeos.');composer.pool(mediaId,movie);state.backgroundVideo={mediaId,enabled:true,loop:true,rate:1,delay:0,end:'freeze',transparent:false};}
      else delete state.backgroundVideo;change(state);renderBackgroundMedia(root,{state,composer,change});
    }catch(error){if(root.isConnected)$('[data-bg-status]',root).textContent=error.message;}finally{if(revision===composer.revision){composer.busy=false;composer.onChange();}}
  };
  $('[data-use-theater]',root).onclick=()=>void importDemo(false);$('[data-use-theater-video]',root).onclick=()=>void importDemo(true);
  $('[data-background-video]',root).onchange=async e=>{
    const file=e.target.files[0];if(!file||composer.busy)return;const revision=composer.revision;composer.busy=true;composer.onChange();
    try{if(!v&&composer.layers.filter(l=>l.video).length>=2)throw Error('Já existem duas camadas de vídeo.');const metadata=await checkCinematicVideo(file,{extension:true,allowOpaque:true}),id=await imageKey(file);if(revision!==composer.revision||!root.isConnected)return;composer.pool(id,file);state.backgroundVideo={mediaId:id,enabled:true,loop:true,rate:1,delay:0,end:'freeze',transparent:metadata.alpha};composer.busy=false;change(state);renderBackgroundMedia(root,{state,composer,change});}
    catch(error){$('[data-bg-status]',root).textContent=error.message;}finally{if(revision===composer.revision){composer.busy=false;composer.onChange();}}
  };
  if(!v)return;
  $('[data-background-remove]',root).onclick=()=>{delete state.backgroundVideo;change(state);renderBackgroundMedia(root,{state,composer,change});};
  for(const key of ['enabled','loop','rate','delay'])$('[data-background-'+key+']',root).onchange=e=>{if(!e.target.validity.valid)return;v[key]=e.target.type==='checkbox'?e.target.checked:Number(e.target.value);change(state);};
}
