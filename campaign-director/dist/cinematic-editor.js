import {StudioProperties} from './cinematic-studio-properties.js';
import {StudioHistory} from './cinematic-studio-history.js';
import {CinematicLayersEditor} from './cinematic-layers-editor.js';
import {cinematicItems,CINEMATIC_MAX_ITEMS,CINEMATIC_MOTIONS,CINEMATIC_TYPES,CINEMATIC_DEFAULTS,canLoopCinematic,cinematicEnding,cinematicFades,cinematicTotal,checkCinematicImage,checkCinematicUpload,withCinematic,duplicateCinematic} from './cinematic-model.js';
import {cinematicImages,imageKey,loadCinematicMedia,validateCompositionMedia} from './cinematic-media.js';
import {mountMotionNotice} from './cinematic-motion.js';
import {CinematicFrame} from './cinematic-frame.js';
import {$,esc,field,openForm,option} from './ui.js';

export function openCinematic({scene,save,present,stop,subscribe}){
  const dialog=$('#appDialog'),initial=cinematicItems(scene)[0];
  const history=new StudioHistory();
  let direction={},draftId,backgroundId=null,restoring=false,properties,clockTimer;
  let root,frame,composer,unsubscribe,removeNotice,closed=false,selectionVersion=0,presenting=false;
  const item=()=>cinematicItems(scene).find(entry=>entry.id===$('[name=selected]',root).value);
  const status=message=>{if(!closed)$('.cinematic-status',root).textContent=message;};
  const imageFor=async()=>{
    const file=$('[name=image]',root).files[0];
    const image=(backgroundId&&composer.files.get(backgroundId))??file??(item()&&await cinematicImages.get(item().imageId));
    if(!image)throw Error('Imagem indisponível neste navegador. Anexe o arquivo novamente.');
    return file?checkCinematicUpload(file):checkCinematicImage(image);
  };
  const values=()=>({
    id:item()?.id??draftId,
    name:$('[name=title]',root).value.trim(),motion:$('[name=motion]',root).value,
    seconds:Number($('[name=seconds]',root).value),intensity:Number($('[name=intensity]',root).value),
    ending:$('[name=ending]',root).value,hold:Number($('[name=hold]',root).value),
    fadeIn:Number($('[name=fadeIn]',root).value),fadeOut:Number($('[name=fadeOut]',root).value),
    ...(composer?.layers.length?{layers:composer.value()}:{}),...structuredClone(direction),
  });
  const dirty=()=>{
    const saved=item();
    if(!saved||backgroundId||$('[name=image]',root).files.length||composer?.busy)return true;
    if(JSON.stringify(composer?.value()??[])!==JSON.stringify(saved.layers??[]))return true;
    if(JSON.stringify(direction)!==JSON.stringify(Object.fromEntries(['camera','lighting'].filter(k=>saved[k]!==undefined).map(k=>[k,saved[k]]))))return true;
    const draft=values(),settings={...saved,...cinematicEnding(saved),...cinematicFades(saved)};
    return ['name','motion','seconds','intensity','ending','hold','fadeIn','fadeOut'].some(key=>draft[key]!==settings[key]);
  };
  const syncDraft=()=>{
    const motion=$('[name=motion]',root).value,ending=$('[name=ending]',root);
    const loop=canLoopCinematic(motion);
    ending.querySelector('[value=loop]').disabled=!loop;
    if(!loop)ending.value='auto';
    const hold=$('[name=hold]',root);
    hold.disabled=ending.value==='loop';
    hold.closest('label').hidden=hold.disabled;
    const draft=values();
    $('[data-duration]',root).textContent=ending.value==='loop'
      ?'Repete até encerrar. A saída respeita o fade configurado.'
      :`Duração total: ${cinematicTotal(draft).toLocaleString('pt-BR')} s. A entrada acontece durante o movimento, seguida da permanência e da saída.`;
    $('[data-undo]',root).disabled=history.index<=0;$('[data-redo]',root).disabled=history.index>=history.entries.length-1;
    const changed=dirty();
    $('[data-present]',root).disabled=changed;
    $('[data-duplicate]',root).disabled=changed||cinematicItems(scene).length>=CINEMATIC_MAX_ITEMS;
    $('[data-cinematic-draft]',root).textContent=changed
      ?'Alterações não salvas. Use Prévia para testar ou Salvar para liberar Apresentar.'
      :'Ajustes salvos. Apresentar envia esta versão ao quadro.';
  };
  const fill=()=>{
    selectionVersion++;
    draftId=crypto.randomUUID();backgroundId=null;direction={};
    const selected=item();
    for(const key of ['camera','lighting'])if(selected?.[key])direction[key]=structuredClone(selected[key]);
    $('[name=title]',root).value=selected?.name??'';
    const config=selected?{...selected,...cinematicEnding(selected),...cinematicFades(selected)}:CINEMATIC_DEFAULTS;
    for(const key of ['motion','seconds','intensity','ending','hold','fadeIn','fadeOut'])$('[name='+key+']',root).value=config[key];
    $('[name=image]',root).value='';
    composer.lighting=direction.lighting;composer?.reset(selected);
    properties.render();history.reset(snapshot());syncDraft();
    frame.clear({immediate:true});
    status(selected?'':'Anexe uma imagem para preparar a apresentação.');
  };
  const snapshot=()=>({draft:values(),backgroundId});
  let previewRefresh;
  const record=()=>{selectionVersion++;if(!restoring)history.record(snapshot());syncDraft();if(frame?.item){clearTimeout(previewRefresh);previewRefresh=setTimeout(()=>{if(!closed&&frame.item)$('[data-preview]',root).click();},450);}};
  const restore=state=>{
    if(!state)return;restoring=true;direction={};for(const k of ['camera','lighting'])if(state.draft[k])direction[k]=structuredClone(state.draft[k]);
    backgroundId=state.backgroundId;draftId=state.draft.id;for(const k of ['title','motion','seconds','intensity','ending','hold','fadeIn','fadeOut'])$('[name='+k+']',root).value=state.draft[k==='title'?'name':k];
    $('[name=image]',root).value='';composer.lighting=direction.lighting;composer.reset(state.draft,{retainFiles:true});properties.render();restoring=false;selectionVersion++;syncDraft();void frame.clear({immediate:true});
  };
  const run=async(action)=>{
    const version=selectionVersion;
    try{await action(()=>!closed&&version===selectionVersion);}
    catch(error){if(!closed&&version===selectionVersion)status(error.message);}
  };
  openForm({
    title:'Studio de Direção · Cinemática',
    wide:true,
    body:`<p class="form-hint">${esc(scene.title)} · Imagens locais a este navegador. Use backup completo para transportá-las.</p>
      <label class="field"><span>Apresentação</span><select name="selected">${option('','Nova apresentação',!initial)}${cinematicItems(scene).map(entry=>option(entry.id,entry.name,entry===initial)).join('')}</select></label>
      ${field('Nome','title','','required maxlength="100"')}
      ${field('Imagem (PNG, JPEG ou WebP, até 12 MB)','image','',`type="file" accept="${CINEMATIC_TYPES.join(',')}"`)}

      <label class="field"><span>Estilo cinematográfico</span><select name="motion">${Object.entries(CINEMATIC_MOTIONS).map(([id,label])=>option(id,label)).join('')}</select></label>
      <div class="cinematic-form-grid">${field('Duração do movimento (s)','seconds','12','type="number" min="3" max="60" required')}${field('Intensidade (0–30%)','intensity','12','type="number" min="0" max="30" required')}</div>
      <div class="cinematic-form-grid">
        <label class="field"><span>Ao terminar</span><select name="ending"><option value="auto">Encerrar automaticamente</option><option value="loop">Repetir até encerrar</option></select></label>
        ${field('Permanência (segundos)','hold','2','type="number" min="0" max="20" required')}
      </div>
      <div class="cinematic-form-grid">${field('Fade de entrada (s)','fadeIn','.3','type="number" min="0" max="5" step="0.1" required')}${field('Fade de saída (s)','fadeOut','.3','type="number" min="0" max="5" step="0.1" required')}</div>
      <p class="form-hint" data-duration></p>
      <div class="cinematic-motion-notice" data-motion-notice role="status" hidden></div>
      <p class="form-hint">A prévia testa o rascunho. Salvar guarda os ajustes. Apresentar exibe a versão salva.</p>
      <p class="form-hint cinematic-draft" data-cinematic-draft aria-live="polite"></p>
      <div class="cinematic-actions"><button class="btn outline" type="button" data-undo>Desfazer</button><button class="btn outline" type="button" data-redo>Refazer</button><button class="btn outline" type="button" data-preview>Prévia</button>
      <button class="btn primary" type="button" data-present>Apresentar</button>
      <button class="btn outline" type="button" data-duplicate>Duplicar apresentação salva</button>
      <button class="btn outline" type="button" data-stop>Encerrar apresentação</button></div>
      <p role="status" class="cinematic-status"></p>
      <details class="cinematic-layers-editor" open></details>`,
    async onSubmit(){
      const version=selectionVersion,selected=item(),draft=values(),image=await imageFor();
      if(!selected&&cinematicItems(scene).length>=CINEMATIC_MAX_ITEMS)throw Error('Esta cena já tem 12 apresentações.');
      if(composer.busy)throw Error('Aguarde o carregamento da camada antes de salvar.');
      draft.imageId=await imageKey(image);
      const media=await composer.assets(draft,image);
      if(draft.layers?.length)await validateCompositionMedia(draft,media,{decode:true});
      else{
        const bitmap=await createImageBitmap(image).catch(()=>{throw Error('Não foi possível abrir a imagem. Escolha outro arquivo.');});
        const pixels=bitmap.width*bitmap.height;bitmap.close();
        if(!pixels||pixels>40000000)throw Error('Use uma imagem com até 40 megapixels.');
      }
      if(closed||version!==selectionVersion)return false;
      const entries=draft.layers?.length?Object.entries(media):[[draft.imageId,image]];
      await cinematicImages.putAll(entries);
      if(closed||version!==selectionVersion)return false;
      const prior=scene.cinematic;
      scene.cinematic=withCinematic(scene,draft);
      if(!save(scene)){
        if(prior===undefined)delete scene.cinematic;else scene.cinematic=prior;
        throw Error('A apresentação não pôde ser salva nesta cena.');
      }
      $('[name=selected]',root).innerHTML=option('','Nova apresentação')+cinematicItems(scene).map(entry=>option(entry.id,entry.name,entry.id===draft.id)).join('');
      fill();
      status('Apresentação salva nesta cena.');
      return false;
    },
    onReady(body){
      root=body;root.classList.add('cinematic-studio');dialog.classList.add('cinematic-studio-dialog');
      const settings=document.createElement('div');settings.className='cinematic-studio-settings';
      for(const selector of ['[name=selected]','[name=title]','[name=image]','[name=motion]'])settings.append($(selector,root).closest('label'));
      for(const node of [...root.querySelectorAll('.cinematic-form-grid,[data-duration]')])settings.append(node);
      composer=new CinematicLayersEditor($('.cinematic-layers-editor',root),{background:imageFor,onChange:record,onError:status,onSelect:()=>properties?.render()});
      properties=new StudioProperties($('[data-studio-properties]',root),{composer,read:()=>structuredClone(direction),change:value=>{direction=value;composer.lighting=direction.lighting;record();void composer.render();}});
      properties.presentation=settings;properties.section='presentation';composer.onAnchor=(layer,anchor)=>properties.anchor(layer,anchor);composer.onCameraChange=camera=>{direction.camera=camera;record();properties.render();};
      properties.render();
      frame=new CinematicFrame($('.cinematic-frame',root),{onWarning:status});removeNotice=mountMotionNotice($('[data-motion-notice]',root));
      $('[name=selected]',root).onchange=fill;
      const refresh=async event=>{
        if(closed||event.target.name==='selected'||!event.target.name)return;
        if(event.target.name==='image'){
          if(event.type!=='change')return;const file=event.target.files[0];if(!file)return;const version=++selectionVersion;
          try{await checkCinematicUpload(file);const id=await imageKey(file);if(closed||version!==selectionVersion)return;composer.pool(id,file);backgroundId=id;record();void composer.render();}catch(error){status(error.message);}return;
        }
        record();
      };
      root.addEventListener('input',refresh);
      root.addEventListener('change',refresh);
      $('[data-preview]',root).onclick=()=>run(async current=>{
        const draft=values();
        if(['seconds','intensity','hold','fadeIn','fadeOut'].some(key=>!$('[name='+key+']',root).reportValidity()))return;
        const image=await imageFor();
        if(!current())return;
        draft.imageId=await imageKey(image);
        const media=await composer.assets(draft,image);if(!current())return;
        const time=frame.item?frame.time():0,playing=frame.item?frame.playing:true;
        const shown=await frame.show(media,{...draft,name:draft.name||'Prévia'},()=>{
          if(current()&&!presenting)status('Prévia concluída.');
        });
        if(shown&&current()){$('.cinematic-layers-editor',root).dataset.pane='canvas';if(time)frame.seek(Math.min(time,draft.seconds));if(!playing)frame.pause();if(!presenting)status('Prévia da apresentação.');}
      });
      $('[data-studio-play]',root).onclick=()=>frame.item?frame.play():$('[data-preview]',root).click();
      $('[data-studio-pause]',root).onclick=()=>frame.pause();$('[data-studio-restart]',root).onclick=()=>frame.item?frame.restart():$('[data-preview]',root).click();
      $('[data-studio-seek]',root).oninput=event=>frame.seek(Number(event.target.value));$('[data-studio-edit]',root).onclick=()=>void frame.clear({immediate:true});
      $('[data-undo]',root).onclick=()=>restore(history.undo());$('[data-redo]',root).onclick=()=>restore(history.redo());
      const keyboard=event=>{if(!(event.ctrlKey||event.metaKey)||event.altKey)return;const key=event.key.toLowerCase();if(key==='z'||key==='y'){event.preventDefault();restore(event.shiftKey||key==='y'?history.redo():history.undo());}};root.addEventListener('keydown',keyboard);
      clockTimer=setInterval(()=>{
        if(closed)return;const total=frame.item?frame.item.seconds+cinematicEnding(frame.item).hold:values().seconds,time=frame.time();
        $('[data-studio-time]',root).textContent=`${time.toFixed(1)} / ${total} s`;$('[data-studio-seek]',root).max=total;$('[data-studio-seek]',root).value=time;
        if(frame.item&&$('[data-studio-loop]',root).checked&&time>=total-.15)frame.restart();
      },100);
      $('[data-present]',root).onclick=()=>run(async current=>{
        if(dirty())return;
        const selected=item(),image=await loadCinematicMedia(selected);
        if(!image)throw Error('Imagem indisponível neste navegador. Anexe novamente e salve.');
        if(current()&&!dirty())await present(selected,image);
      });
      $('[data-duplicate]',root).onclick=()=>run(async()=>{
        if(dirty())return;
        const copy=duplicateCinematic(scene,item().id),prior=scene.cinematic;
        scene.cinematic=withCinematic(scene,copy);
        if(!save(scene)){scene.cinematic=prior;throw Error('Não foi possível salvar a cópia.');}
        $('[name=selected]',root).innerHTML=option('','Nova apresentação')+cinematicItems(scene).map(entry=>option(entry.id,entry.name,entry.id===copy.id)).join('');
        fill();status('Cópia salva. As imagens são compartilhadas com a apresentação original.');
      });
      $('[data-stop]',root).onclick=()=>stop();
      fill();
      unsubscribe=subscribe(({message,active})=>{presenting=active;if(message)status(message);$('[data-stop]',root).disabled=!active;});
      const cleanup=()=>{
        if(dialog.open&&frame.element.isConnected)return;
        closed=true;selectionVersion++;clearInterval(clockTimer);clearTimeout(previewRefresh);root.removeEventListener('keydown',keyboard);root.classList.remove('cinematic-studio');dialog.classList.remove('cinematic-studio-dialog');
        root.removeEventListener('input',refresh);root.removeEventListener('change',refresh);
        dialog.removeEventListener('close',cleanup);
        unsubscribe();removeNotice();composer.close();frame.clear({immediate:true});
      };
      dialog.addEventListener('close',cleanup);
    },
  });
}
