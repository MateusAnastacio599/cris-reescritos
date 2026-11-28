import {prepareCinematicImport} from './cinematic-import.js?v=directorux03';
import {ownsStudio,releaseStudio,numericInvalid,captureContext,restoreContext,arrangeStudio,renderTemporalDock,confirmStudio} from './cinematic-studio-ui.js?v=directorcinematic02';
import {sceneSpan} from './cinematic-timing.js?v=directorcinematic02';
const DIRECTION_KEYS=['camera','lighting','sceneDuration','backgroundVideo'];
import {StudioProperties} from './cinematic-studio-properties.js?v=directorcinematic02';
import {StudioHistory} from './cinematic-studio-history.js?v=directorcinematic02';
import {CinematicLayersEditor} from './cinematic-layers-editor.js?v=directorux03';
import {cinematicItems,CINEMATIC_MAX_ITEMS,CINEMATIC_MOTIONS,CINEMATIC_TYPES,CINEMATIC_DEFAULTS,canLoopCinematic,cinematicEnding,cinematicFades,cinematicTotal,checkCinematicImage,checkCinematicUpload,withCinematic,duplicateCinematic} from './cinematic-model.js?v=directorcinematic02';
import {cinematicImages,imageKey,loadCinematicMedia,validateCompositionMedia} from './cinematic-media.js?v=directorcinematic02';
import {mountMotionNotice} from './cinematic-motion.js?v=directorcinematic02';
import {CinematicFrame} from './cinematic-frame.js?v=directorcinematic02';
import {$,esc,field,openForm,option} from './ui.js';

export function openCinematic({scene,save,present,stop,subscribe}){
  const dialog=$('#appDialog'),initial=cinematicItems(scene)[0],instance=crypto.randomUUID();
  const owns=()=>ownsStudio(root,instance);
  const history=new StudioHistory();
  let direction={},draftId,backgroundId=null,restoring=false,properties,clockTimer;
  let root,frame,composer,unsubscribe,removeNotice,closed=false,selectionVersion=0,presenting=false,lastSelected=initial?.id??'';
  const item=()=>cinematicItems(scene).find(entry=>entry.id===$('[name=selected]',root).value);
  const status=message=>{if(!closed&&owns())$('.cinematic-status',root).textContent=message;};
  const imageFor=async()=>{
    const file=$('[name=image]',root).files[0];
    const image=(backgroundId&&(composer.files.get(backgroundId)??await cinematicImages.get(backgroundId)))??file??(item()&&await cinematicImages.get(item().imageId));
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
    if(numericInvalid(root)||root.querySelector('[data-camera-invalid=true],[data-direction-invalid=true],[data-properties-invalid=true]'))return true;
    if(!saved||backgroundId&&backgroundId!==saved.imageId||$('[name=image]',root).files.length||composer?.busy)return true;
    if(JSON.stringify(composer?.value()??[])!==JSON.stringify(saved.layers??[]))return true;
    if(JSON.stringify(direction)!==JSON.stringify(Object.fromEntries(DIRECTION_KEYS.filter(k=>saved[k]!==undefined).map(k=>[k,saved[k]]))))return true;
    const draft=values(),settings={...saved,...cinematicEnding(saved),...cinematicFades(saved)};
    return ['name','motion','seconds','intensity','ending','hold','fadeIn','fadeOut'].some(key=>draft[key]!==settings[key]);
  };
  const syncDraft=()=>{if(closed||!owns())return;
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
      :`Duração total: ${cinematicTotal(draft).toLocaleString('pt-BR')} s. A cena permanece ativa até ${sceneSpan(draft).toLocaleString('pt-BR')} s; depois acontece o fade de saída.`;
    $('[data-undo]',root).disabled=history.index<=0;$('[data-redo]',root).disabled=history.index>=history.entries.length-1;
    const changed=dirty();
    const invalid=numericInvalid(root)||!!root.querySelector('[data-camera-invalid=true],[data-direction-invalid=true],[data-properties-invalid=true]');
    $('[data-present]',root).disabled=changed||composer?.busy;$('#modalSubmit',dialog).disabled=invalid||!!composer?.busy||saving;
    root.dataset.playback=frame?.item?(frame.playing?'playing':'paused'):'editing';
    $('[data-duplicate]',root).disabled=changed||cinematicItems(scene).length>=CINEMATIC_MAX_ITEMS;
    $('[data-cinematic-draft]',root).textContent=invalid?'Confira os parâmetros indicados antes de salvar ou apresentar.':composer?.busy?'Carregando mídia…':changed
      ?'Alterações não salvas. Use Prévia para testar ou Salvar para liberar Apresentar.'
      :'Ajustes salvos. Apresentar envia esta versão ao quadro.';
  };
  let saving=false;
  const fill=({preserveHistory=false}={})=>{
    const context=captureContext(properties.root);
    selectionVersion++;
    draftId=crypto.randomUUID();backgroundId=null;direction={};
    const selected=item();
    for(const key of DIRECTION_KEYS)if(selected?.[key])direction[key]=structuredClone(selected[key]);
    $('[name=title]',root).value=selected?.name??'';
    const config=selected?{...selected,...cinematicEnding(selected),...cinematicFades(selected)}:CINEMATIC_DEFAULTS;
    for(const key of ['motion','seconds','intensity','ending','hold','fadeIn','fadeOut'])$('[name='+key+']',root).value=config[key];
    $('[name=image]',root).value='';
    composer.lighting=direction.lighting;composer.backgroundVideo=direction.backgroundVideo;composer?.reset(selected,{retainFiles:preserveHistory});lastSelected=selected?.id??'';
    if(!preserveHistory){properties.contexts.clear();properties.renderedKey=null;}properties.render();if(!preserveHistory)history.reset(snapshot());syncDraft();
    if(!preserveHistory)frame.clear({immediate:true});else restoreContext(properties.root,context);refreshTracks();
    status(selected?'':'Anexe uma imagem para preparar a apresentação.');
  };
  const snapshot=()=>({draft:values(),backgroundId:backgroundId??item()?.imageId??null});
  const refreshTracks=()=>{if(!root.querySelector('[data-studio-tracks]'))return;const draft=values();$('[data-track-duration]',root).textContent=sceneSpan(draft)+' s';renderTemporalDock($('[data-studio-tracks]',root),draft,{seek:async time=>{if(!frame.item)await $('[data-preview]',root).onclick();frame.pause();frame.seek(time);},inspect:label=>{properties.section='direction';properties.render();for(const details of root.querySelectorAll('.cinematic-window-list>details'))if(details.querySelector('summary').textContent.startsWith(label)){details.open=true;details.scrollIntoView({block:'nearest'});break;}}});};
  let previewRefresh;
  const record=()=>{if(closed||!owns())return;selectionVersion++;if(!restoring)history.record(snapshot());syncDraft();refreshTracks();if(frame?.item&&!numericInvalid(root)){clearTimeout(previewRefresh);previewRefresh=setTimeout(async()=>{if(!closed&&owns()&&frame.item)await $('[data-preview]',root).onclick({refresh:true});},450);}};
  const restore=state=>{
    if(!state)return;const context=captureContext(properties.root);restoring=true;direction={};for(const k of DIRECTION_KEYS)if(state.draft[k])direction[k]=structuredClone(state.draft[k]);
    backgroundId=state.backgroundId;draftId=state.draft.id;for(const k of ['title','motion','seconds','intensity','ending','hold','fadeIn','fadeOut'])$('[name='+k+']',root).value=state.draft[k==='title'?'name':k];
    $('[name=image]',root).value='';composer.lighting=direction.lighting;composer.backgroundVideo=direction.backgroundVideo;composer.reset(state.draft,{retainFiles:true});properties.render();restoring=false;selectionVersion++;syncDraft();refreshTracks();restoreContext(properties.root,context);void frame.clear({immediate:true});
  };
  const run=async(action)=>{
    const version=selectionVersion;
    try{await action(()=>!closed&&owns()&&version===selectionVersion);}
    catch(error){if(!closed&&owns()&&version===selectionVersion)status(error.message);}
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
      <section class="cinematic-layers-editor"></section>`,
    async onSubmit(){
      if(numericInvalid(root)||root.querySelector('[data-camera-invalid=true],[data-direction-invalid=true],[data-properties-invalid=true]'))throw Error('Corrija os ajustes inválidos da câmera ou da direção antes de salvar.');
      saving=true;syncDraft();try{
      const version=selectionVersion,selected=item(),draft=values(),image=await imageFor();
      if(!selected&&cinematicItems(scene).length>=CINEMATIC_MAX_ITEMS)throw Error('Esta cena já tem 12 apresentações.');
      if(composer.busy)throw Error('Aguarde o carregamento da camada antes de salvar.');
      draft.imageId=await imageKey(image);
      const media=await composer.assets(draft,image);
      if(draft.layers?.length||draft.backgroundVideo)await validateCompositionMedia(draft,media,{decode:true});
      else{
        const bitmap=await createImageBitmap(image).catch(()=>{throw Error('Não foi possível abrir a imagem. Escolha outro arquivo.');});
        const pixels=bitmap.width*bitmap.height;bitmap.close();
        if(!pixels||pixels>40000000)throw Error('Use uma imagem com até 40 megapixels.');
      }
      if(closed||!owns()||version!==selectionVersion)return false;
      const entries=(draft.layers?.length||draft.backgroundVideo)?Object.entries(media):[[draft.imageId,image]];
      await cinematicImages.putAll(entries);
      if(closed||!owns()||version!==selectionVersion)return false;
      const prior=scene.cinematic;
      scene.cinematic=withCinematic(scene,draft);
      if(!save(scene)){
        if(prior===undefined)delete scene.cinematic;else scene.cinematic=prior;
        throw Error('A apresentação não pôde ser salva nesta cena.');
      }
      $('[name=selected]',root).innerHTML=option('','Nova apresentação')+cinematicItems(scene).map(entry=>option(entry.id,entry.name,entry.id===draft.id)).join('');
      fill({preserveHistory:true});
      status('Apresentação salva nesta cena.');
      return false;
      }finally{saving=false;syncDraft();}
    },
    onReady(body){
      root=body;root.dataset.studioInstance=instance;root.classList.add('cinematic-studio');dialog.classList.add('cinematic-studio-dialog');
      const settings=document.createElement('div');settings.className='cinematic-studio-settings';
      for(const selector of ['[name=selected]','[name=title]','[name=image]','[name=motion]'])settings.append($(selector,root).closest('label'));
      for(const node of [...root.querySelectorAll('.cinematic-form-grid,[data-duration]')])settings.append(node);
      composer=new CinematicLayersEditor($('.cinematic-layers-editor',root),{background:imageFor,onChange:record,onError:status,onSelect:()=>{if(properties){if(!['effects','transform'].includes(properties.section))properties.section='transform';properties.render();}}});
      properties=new StudioProperties($('[data-studio-properties]',root),{composer,read:()=>structuredClone(direction),change:value=>{const lightingChanged=JSON.stringify(direction.lighting)!==JSON.stringify(value.lighting);direction=value;composer.lighting=direction.lighting;composer.backgroundVideo=direction.backgroundVideo;composer.camera=direction.camera;record();if(lightingChanged)void composer.render();}});
      composer.useBackground=async file=>{file=(await prepareCinematicImport(file)).blob;const id=await imageKey(file);composer.pool(id,file);backgroundId=id;$('[name=image]',root).value='';record();void composer.render();};
      properties.preview=()=>$('[data-preview]',root).click();properties.presentation=settings;properties.section='presentation';composer.onAnchor=(layer,anchor)=>properties.anchor(layer,anchor);composer.onCameraChange=camera=>{direction.camera=camera;record();properties.render();};
      properties.render();
      arrangeStudio(root,dialog);
      frame=new CinematicFrame($('.cinematic-frame',root),{onWarning:status,fit:'contain'});removeNotice=mountMotionNotice($('[data-motion-notice]',root));
      const requestClose=()=>{if(dirty())confirmStudio(root,'Fechar sem salvar as alterações desta apresentação?',()=>dialog.close());else dialog.close();};
      $('#closeDialog',dialog).onclick=requestClose;dialog.addEventListener('cancel',cancelClose);function cancelClose(e){e.preventDefault();requestClose();}
      $('[name=selected]',root).onchange=e=>{const next=e.target.value;e.target.value=lastSelected;if(dirty())confirmStudio(root,'Trocar de apresentação e descartar as alterações não salvas?',()=>{e.target.value=next;fill();});else{e.target.value=next;fill();}};
      composer.beforeSelect=()=>{if(numericInvalid(properties.root)||properties.root.querySelector('[data-camera-invalid=true],[data-direction-invalid=true],[data-properties-invalid=true]')){status('Corrija o parâmetro indicado antes de mudar de contexto.');properties.root.querySelector('input:invalid')?.focus();return false;}return true;};
      composer.onSolo=()=>{if(frame.item)$('[data-preview]',root).onclick({refresh:true});};
      const refresh=async event=>{
        if(closed||event.target.name==='selected'||!event.target.name)return;
        if(event.target.name==='image'){
          if(event.type!=='change')return;const file=event.target.files[0];if(!file)return;const version=++selectionVersion;
          try{await checkCinematicUpload(file);const optimized=await prepareCinematicImport(file),image=optimized.blob,id=await imageKey(image);if(closed||!owns()||version!==selectionVersion)return;composer.pool(id,image);backgroundId=id;record();void composer.render();if(optimized.savedBytes)status('PNG otimizado sem perda · '+Math.round(optimized.savedBytes/1024)+' KiB a menos.');}catch(error){status(error.message);}return;
        }
        record();
      };
      root.addEventListener('input',refresh);
      root.addEventListener('change',refresh);
      $('[data-preview]',root).onclick=event=>run(async current=>{
        const automatic=!!event?.refresh;
        const draft=values();
        if(numericInvalid(root)||root.querySelector('[data-camera-invalid=true],[data-direction-invalid=true],[data-properties-invalid=true]')){status('Corrija os parâmetros indicados antes de iniciar a prévia.');return;}
        status('Carregando prévia…');
        if(['seconds','intensity','hold','fadeIn','fadeOut'].some(key=>!$('[name='+key+']',root).reportValidity()))return;
        const image=await imageFor();
        if(!current())return;
        draft.imageId=await imageKey(image);
        const media=await composer.assets(draft,image);if(!current())return;
        if(composer.solo)draft.layers=draft.layers.map(l=>({...l,visible:l.id===composer.solo&&l.visible}));
        const time=frame.item?frame.time():0,playing=frame.item?frame.playing:true;
        const shown=await frame.show(media,{...draft,name:draft.name||'Prévia'},()=>{
          if(current()&&!presenting)status('Prévia concluída.');
        });
        if(shown&&current()){if(!automatic)$('.cinematic-layers-editor',root).dataset.pane='canvas';if(time)frame.seek(Math.min(time,sceneSpan(draft)));if(!playing)frame.pause();if(!presenting)status('Prévia da apresentação.');}
      });
      $('[data-studio-play]',root).onclick=()=>frame.item?frame.play():$('[data-preview]',root).click();
      $('[data-studio-pause]',root).onclick=()=>frame.pause();$('[data-studio-restart]',root).onclick=()=>frame.item?frame.restart():$('[data-preview]',root).click();
      $('[data-studio-seek]',root).oninput=event=>frame.seek(Number(event.target.value));$('[data-studio-edit]',root).onclick=()=>void frame.clear({immediate:true});
      $('[data-undo]',root).onclick=()=>restore(history.undo());$('[data-redo]',root).onclick=()=>restore(history.redo());
      const keyboard=event=>{if(!(event.ctrlKey||event.metaKey)||event.altKey)return;const key=event.key.toLowerCase();if(key==='s'){event.preventDefault();event.stopPropagation();if(!$('#modalSubmit',dialog).disabled)$('#modalForm',dialog).requestSubmit();return;}if(key==='z'||key==='y'){event.preventDefault();restore(event.shiftKey||key==='y'?history.redo():history.undo());}};root.addEventListener('keydown',keyboard);
      clockTimer=setInterval(()=>{
        if(closed||!owns())return;$('[data-studio-pause]',root).disabled=!frame.item||!frame.playing;$('[data-studio-restart]',root).disabled=!frame.item;$('[data-studio-edit]',root).disabled=!frame.item;$('[data-studio-play]',root).setAttribute('aria-pressed',String(!!frame.item&&frame.playing));const total=frame.item?sceneSpan(frame.item):sceneSpan(values()),time=frame.time();
        $('[data-studio-time]',root).textContent=`${time.toFixed(1)} / ${total} s · ${frame.item?(frame.playing?'Reproduzindo':'Pausada'):'Composição'}`;root.dataset.playback=frame.item?(frame.playing?'playing':'paused'):'editing';$('.studio-direction-dock',root).style.setProperty('--playhead',Math.min(100,time/total*100)+'%');$('[data-studio-seek]',root).max=total;$('[data-studio-seek]',root).value=time;
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
      unsubscribe=subscribe(({message,active})=>{if(!owns())return;presenting=active;if(message)status(message);$('[data-stop]',root).disabled=!active;$('[data-stop]',root).hidden=!active;});
      const cleanup=()=>{
        if(dialog.open&&frame.element.isConnected)return;
        closed=true;selectionVersion++;dialog.removeEventListener('cancel',cancelClose);clearInterval(clockTimer);clearTimeout(previewRefresh);root.removeEventListener('keydown',keyboard);releaseStudio(root,dialog,instance);
        root.removeEventListener('input',refresh);root.removeEventListener('change',refresh);
        dialog.removeEventListener('close',cleanup);
        unsubscribe();removeNotice();composer.close();frame.clear({immediate:true});
      };
      dialog.addEventListener('close',cleanup);
    },
  });
}
