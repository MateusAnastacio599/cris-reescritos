// Disposable UI acceptance scenario. All editing goes through the real controls.
const $=(selector,root=document)=>root.querySelector(selector);
const log=(name,data)=>$('#result').textContent+=name+' '+JSON.stringify(data)+'\n';
const assert=(value,message)=>{if(!value)throw Error(message);};
const wait=async(predicate,timeout=12000)=>{
  const deadline=performance.now()+timeout;
  do{const value=predicate();if(value)return value;await new Promise(requestAnimationFrame);}while(performance.now()<deadline);
  throw Error('Tempo limite: '+predicate.toString());
};
const mobile=location.search.includes('mobile'),reduced=location.search.includes('reduced'),mirror=location.search.includes('mirror');
document.body.classList.toggle('mobile',mobile);
const query='?demoSession='+crypto.randomUUID()+(reduced?'&cinematicReduced':'');
$('#director').src='campaign-director/dist/'+query;$('#board').src=(mirror?'campaign-director/dist/cris/quadro/':'quadro/')+query;
const dw=$('#director').contentWindow,bw=$('#board').contentWindow;
const dd=()=>dw.document,bd=()=>bw.document;
const layer=()=>$('.cinematic-board-layer',bd());
const status=()=>$('.cinematic-status',dd())?.textContent;
const edit=(selector,value,root=dd())=>{const node=$(selector,root);node.value=value;node.dispatchEvent(new dw.Event('input',{bubbles:true}));node.dispatchEvent(new dw.Event('change',{bubbles:true}));};
const draft=(name,value)=>edit('#dialogBody [name='+name+']',value);
const inputFile=async(selector,name)=>{
  const node=$(selector,dd()),transfer=new dw.DataTransfer();
  transfer.items.add(new dw.File([await(await fetch('cinematic-theater/'+name+'.png')).blob()],name+'.png',{type:'image/png'}));
  node.files=transfer.files;node.dispatchEvent(new dw.Event('change',{bubbles:true}));
};
let selected;
const open=()=>{ $('.script-tools summary',dd()).click();$('#openSceneCinematic',dd()).click();if(selected)draft('selected',selected); };
const close=()=>$('#closeDialog',dd()).click();
const save=async()=>{ $('#modalSubmit',dd()).click();await wait(()=>status()?.includes('salva nesta cena'));selected=$('[name=selected]',dd()).value; };
const present=()=> $('[data-present]',dd()).click();
const stop=async()=>{ $('[data-stop]',dd()).click();await wait(()=>!layer()); };
const list=()=> $('[data-layer-list]',dd());
const options=()=>[...list().options];
const selectName=text=>{const option=options().find(option=>option.textContent.includes(text));edit('[data-layer-list]',option.value);return option.value;};
const sample=async(root,time)=>{
  const planes=[...root.querySelectorAll('.cinematic-plane')],animation=planes[0].getAnimations()[0];
  await wait(()=>animation.currentTime>=time);
  return planes.map(plane=>{const matrix=new DOMMatrix(plane.ownerDocument.defaultView.getComputedStyle(plane).transform);return {id:plane.dataset.plane,x:matrix.e,y:matrix.f,scale:matrix.a};});
};
async function createCue(name,id,delay=0){
  $('[data-config=triggers]',dd()).click();$('#addCue',dd()).click();edit('[name=name]',name);
  edit('[data-action-type]','cinematic-start');edit('[data-a=cinematicId]',id);edit('[data-delay]',String(delay));
  $('#modalSubmit',dd()).click();await wait(()=>!$('#cueActions',dd()));close();
  return ()=>[...dd().querySelectorAll('[data-trigger]')].find(node=>node.textContent.includes(name)).click();
}
$('#run').onclick=async()=>{
  $('#run').disabled=true;$('#result').textContent='';
  try{
    await wait(()=>dw.demoAudio&&bw.CRIS_BOARD_API&&dd().body.dataset.demoReady==='true');
    $('#masterOffline',bd())?.click();await wait(()=>!bd().body.classList.contains('cris-loading')&&!bd().querySelector('dialog:modal'));
    const snapshot=JSON.stringify(bw.CRIS_BOARD_API.snapshot());
    $('[data-scene=quarto]',dd()).click();$('#startScene',dd()).click();await wait(()=>dw.demoAudio().tracks.length===2);
    const audio=dw.demoAudio();
    open();draft('selected','');draft('title','Teatro · ensaio');draft('motion','breath');draft('seconds','3');draft('intensity','28');draft('hold','0');draft('fadeIn','.1');draft('fadeOut','.2');draft('ending','loop');
    await inputFile('[name=image]','palco');
    $('.cinematic-layers-editor summary',dd()).click();
    for(const [index,name] of ['plateia','ator-esquerda','ator-direita','central'].entries()){
      await inputFile('[data-layer-file]',name);
      await wait(()=>options().length===index+1&&!$('[data-layer-file]',dd()).disabled||index===3&&options().length===4);
      await wait(()=>!$('[data-composer-status]',dd()).textContent.includes('ausente')&&$('.cinematic-composer-canvas .cinematic-world',dd()));
      edit('[data-layer-scale]',name==='plateia'?'125':'23');
      edit('[data-layer-x]',name==='ator-esquerda'?'25':name==='ator-direita'?'75':'50');
      edit('[data-layer-y]',name==='plateia'?'91':'59');
      edit('[data-layer-parallax]',name==='plateia'?'1.8':name==='central'?'1.1':'.6');
    }
    await wait(()=>$('.cinematic-composer-canvas',dd()).querySelectorAll('.cinematic-plane').length===5);
    const central=selectName('central');
    const canvas=$('.cinematic-composer-canvas',dd()),node=canvas.querySelector('[data-cinematic-layer="'+central+'"]');
    canvas.dispatchEvent(new dw.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    assert(Number($('[data-layer-x]',dd()).value)===51,'Posição por teclado não foi aplicada.');
    edit('[data-layer-x]','50');
    const originalOrder=options().map(option=>option.value);
    $('[data-layer-back]',dd()).click();await wait(()=>options().map(option=>option.value).join()!==originalOrder.join());
    $('[data-layer-front]',dd()).click();
    $('[data-layer-visible]',dd()).click();
    assert(canvas.querySelector('[data-plane="'+central+'"]').hidden,'Ocultar precisa retirar a camada da composição.');
    $('[data-layer-visible]',dd()).click();
    log('Preparação',{camadas:options().length,posicao:'teclado e campos normalizados',ordem:'preservada',visibilidade:'alternada'});
    await save();const source=selected;
    assert(!$('[data-duplicate]',dd()).disabled,'Duplicar deve estar disponível após salvar.');
    $('[data-duplicate]',dd()).click();await wait(()=>status()?.includes('Cópia salva'));
    const copy=$('[name=selected]',dd()).value;assert(copy!==source,'Duplicar precisa gerar ID próprio.');
    draft('title','Teatro · após a intervenção');
    if(!$('.cinematic-layers-editor',dd()).open)$('.cinematic-layers-editor summary',dd()).click();selectName('ator-direita');$('[data-layer-remove]',dd()).click();
    await wait(()=>options().length===3);await save();selected=source;draft('selected',source);
    assert(options().length===4,'A exclusão na cópia não deve modificar a apresentação original.');
    if(reduced){
      $('[data-preview]',dd()).click();await wait(()=>$('.cinematic-preview-area .cinematic-world',dd()));
      assert([...$('.cinematic-preview-area',dd()).querySelectorAll('.cinematic-plane')].every(plane=>plane.getAnimations().length===0),'Todas as camadas devem estar estáticas.');
      $('[data-motion-notice] button',dd()).click();
    }else $('[data-preview]',dd()).click();
    const preview=await wait(()=>$('.cinematic-preview-area .cinematic-world',dd()));
    await wait(()=>preview.querySelector('.cinematic-plane').getAnimations().length);
    const previewMid=await sample(preview,1500);
    present();await wait(()=>layer()?.querySelectorAll('.cinematic-plane').length===5);
    if(reduced){
      assert([...layer().querySelectorAll('.cinematic-plane')].every(plane=>plane.getAnimations().length===0),'O quadro reduzido deve preservar toda a composição estática.');
      $('.cinematic-motion-notice button',layer()).click();
    }
    const early=await sample(layer(),200),middle=await sample(layer(),1500);
    assert(Math.abs(middle[1].y-early[1].y)>Math.abs(middle[0].y-early[0].y)*2,'Primeiro plano precisa se deslocar mais que o fundo.');
    assert(Math.abs(previewMid[0].scale-middle[0].scale)<.01,'Prévia e quadro divergem.');
    log('Parallax',{early,middle});await stop();
    close();
    const startOriginal=await createCue('Teatro · original',source),startCopy=await createCue('Teatro · variação',copy);
    startOriginal();await wait(()=>layer()?.querySelectorAll('.cinematic-plane').length===5);
    const previous=layer().querySelector('.cinematic-world');startCopy();
    await wait(()=>layer()?.querySelectorAll('.cinematic-plane').length===4&&layer().querySelector('.cinematic-world')!==previous);
    startOriginal();await wait(()=>layer()?.querySelectorAll('.cinematic-plane').length===5);
    open();await stop();draft('ending','auto');await save();present();
    await wait(()=>layer());await wait(()=>!layer());await wait(()=>status()?.includes('automaticamente'));
    assert(JSON.stringify(bw.CRIS_BOARD_API.snapshot())===snapshot,'Snapshot do quadro foi alterado.');
    const running=dw.demoAudio();assert(running.running&&running.key===audio.key&&running.time>audio.time&&running.master===audio.master,'Áudio local foi alterado.');
    log('Integridade',{snapshot:'idêntico',audio:running,duplicacao:'IDs independentes com imagens compartilhadas',cues:'troca rápida entre 4 e 3 camadas'});
    draft('selected','');draft('title','Teatro · imagem única compatível');draft('seconds','3');draft('hold','0');draft('motion','static');
    await inputFile('[name=image]','palco');await save();present();
    await wait(()=>layer()?.querySelector(':scope > img'));
    assert(!layer().querySelector('.cinematic-world'),'A apresentação antiga deve usar o caminho de imagem única.');
    await wait(()=>!layer());
    log('Compatibilidade','imagem única v1 apresentada e encerrada normalmente');
    selected=source;draft('selected',source);draft('ending','loop');await save();
    log('APROVADO',{director:dw.innerWidth,quadro:bw.innerWidth,reduced,mirror});
    $('#show').hidden=false;$('#show').onclick=()=>present();
  }catch(error){log('FALHOU',error.message);}
  finally{$('#run').disabled=false;}
};
