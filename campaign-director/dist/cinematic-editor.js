import {cinematicItems,CINEMATIC_MAX_ITEMS,CINEMATIC_MOTIONS,CINEMATIC_TYPES,CINEMATIC_DEFAULTS,canLoopCinematic,cinematicEnding,checkCinematicImage,withCinematic} from './cinematic-model.js';
import {cinematicImages,storeCinematicImage} from './cinematic-media.js';
import {CinematicFrame} from './cinematic-frame.js';
import {$,esc,field,openForm,option} from './ui.js';

export function openCinematic({scene,save,present,stop,subscribe}){
  const dialog=$('#appDialog'),initial=cinematicItems(scene)[0];
  let root,frame,unsubscribe,closed=false,selectionVersion=0,presenting=false;
  const item=()=>cinematicItems(scene).find(entry=>entry.id===$('[name=selected]',root).value);
  const status=message=>{if(!closed)$('[role=status]',root).textContent=message;};
  const imageFor=async()=>{
    const file=$('[name=image]',root).files[0];
    const image=file??(item()&&await cinematicImages.get(item().imageId));
    if(!image)throw Error('Imagem indisponível neste navegador. Anexe o arquivo novamente.');
    return checkCinematicImage(image);
  };
  const values=()=>({
    id:item()?.id??crypto.randomUUID(),
    name:$('[name=title]',root).value.trim(),motion:$('[name=motion]',root).value,
    seconds:Number($('[name=seconds]',root).value),intensity:Number($('[name=intensity]',root).value),
    ending:$('[name=ending]',root).value,hold:Number($('[name=hold]',root).value),
  });
  const dirty=()=>{
    const saved=item();
    if(!saved||$('[name=image]',root).files.length)return true;
    const draft=values(),settings={...saved,...cinematicEnding(saved)};
    return ['name','motion','seconds','intensity','ending','hold'].some(key=>draft[key]!==settings[key]);
  };
  const syncDraft=()=>{
    const motion=$('[name=motion]',root).value,ending=$('[name=ending]',root);
    const loop=canLoopCinematic(motion);
    ending.querySelector('[value=loop]').disabled=!loop;
    if(!loop)ending.value='auto';
    const hold=$('[name=hold]',root);
    hold.disabled=ending.value==='loop';
    hold.closest('label').hidden=hold.disabled;
    const changed=dirty();
    $('[data-present]',root).disabled=changed;
    $('[data-cinematic-draft]',root).textContent=changed
      ?'Alterações não salvas. Use Prévia para testar ou Salvar para liberar Apresentar.'
      :'Ajustes salvos. Apresentar envia esta versão ao quadro.';
  };
  const fill=()=>{
    selectionVersion++;
    const selected=item();
    $('[name=title]',root).value=selected?.name??'';
    const config=selected?{...selected,...cinematicEnding(selected)}:CINEMATIC_DEFAULTS;
    for(const key of ['motion','seconds','intensity','ending','hold'])$('[name='+key+']',root).value=config[key];
    $('[name=image]',root).value='';
    syncDraft();
    frame.clear({immediate:true});
    status(selected?'':'Anexe uma imagem para preparar a apresentação.');
  };
  const run=async(action)=>{
    const version=selectionVersion;
    try{await action(()=>!closed&&version===selectionVersion);}
    catch(error){if(!closed&&version===selectionVersion)status(error.message);}
  };
  openForm({
    title:'Apresentação cinematográfica',
    wide:true,
    body:`<p class="form-hint">${esc(scene.title)} · Imagens locais a este navegador. Use backup completo para transportá-las.</p>
      <label class="field"><span>Apresentação</span><select name="selected">${option('','Nova apresentação',!initial)}${cinematicItems(scene).map(entry=>option(entry.id,entry.name,entry===initial)).join('')}</select></label>
      ${field('Nome','title','','required maxlength="100"')}
      ${field('Imagem (PNG, JPEG ou WebP, até 12 MB)','image','',`type="file" accept="${CINEMATIC_TYPES.join(',')}"`)}
      <label class="field"><span>Estilo cinematográfico</span><select name="motion">${Object.entries(CINEMATIC_MOTIONS).map(([id,label])=>option(id,label)).join('')}</select></label>
      <div class="cinematic-form-grid">${field('Duração (segundos)','seconds','12','type="number" min="3" max="60" required')}${field('Intensidade (0–30%)','intensity','12','type="number" min="0" max="30" required')}</div>
      <div class="cinematic-form-grid">
        <label class="field"><span>Ao terminar</span><select name="ending"><option value="auto">Encerrar automaticamente</option><option value="loop">Repetir até encerrar</option></select></label>
        ${field('Permanência (segundos)','hold','2','type="number" min="0" max="20" required')}
      </div>
      <p class="form-hint">A prévia testa o rascunho. Salvar guarda os ajustes. Apresentar exibe a versão salva.</p>
      <p class="form-hint cinematic-draft" data-cinematic-draft aria-live="polite"></p>
      <div class="cinematic-actions"><button class="btn outline" type="button" data-preview>Prévia</button>
      <button class="btn primary" type="button" data-present>Apresentar</button>
      <button class="btn outline" type="button" data-stop>Encerrar apresentação</button></div>
      <p role="status" class="cinematic-status"></p>
      <div class="cinematic-preview-area"><div class="cinematic-frame" hidden></div></div>`,
    async onSubmit(){
      const version=selectionVersion,selected=item(),draft=values(),image=await imageFor();
      if(!selected&&cinematicItems(scene).length>=CINEMATIC_MAX_ITEMS)throw Error('Esta cena já tem 12 apresentações.');
      const bitmap=await createImageBitmap(image).catch(()=>{throw Error('Não foi possível abrir a imagem. Escolha outro arquivo.');});
      const pixels=bitmap.width*bitmap.height;bitmap.close();
      if(!pixels||pixels>40000000)throw Error('Use uma imagem com até 40 megapixels.');
      if(closed||version!==selectionVersion)return false;
      draft.imageId=await storeCinematicImage(image);
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
      root=body;frame=new CinematicFrame($('.cinematic-frame',root));
      $('[name=selected]',root).onchange=fill;
      const refresh=event=>{
        if(event.target.name==='selected')return;
        selectionVersion++;
        syncDraft();
      };
      root.addEventListener('input',refresh);
      root.addEventListener('change',refresh);
      $('[data-preview]',root).onclick=()=>run(async current=>{
        const draft=values();
        if(['seconds','intensity','hold'].some(key=>!$('[name='+key+']',root).reportValidity()))return;
        const image=await imageFor();
        if(!current())return;
        const shown=await frame.show(image,{...draft,name:draft.name||'Prévia'},()=>{
          if(current()&&!presenting)status('Prévia concluída.');
        });
        if(shown&&current()&&!presenting)status('Prévia da apresentação.');
      });
      $('[data-present]',root).onclick=()=>run(async current=>{
        if(dirty())return;
        const selected=item(),image=await cinematicImages.get(selected.imageId);
        if(!image)throw Error('Imagem indisponível neste navegador. Anexe novamente e salve.');
        if(current()&&!dirty())await present(selected,image);
      });
      $('[data-stop]',root).onclick=()=>stop();
      fill();
      unsubscribe=subscribe(({message,active})=>{presenting=active;if(message)status(message);$('[data-stop]',root).disabled=!active;});
      dialog.addEventListener('close',()=>{
        closed=true;selectionVersion++;unsubscribe();frame.clear({immediate:true});
      },{once:true});
    },
  });
}
