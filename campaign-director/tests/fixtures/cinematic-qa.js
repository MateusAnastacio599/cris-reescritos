// Browser-only acceptance harness for the disposable cinematic-demo workspace.
const $=(selector,root=document)=>root.querySelector(selector);
const log=(name,value)=>$('#result').textContent+=name+' '+JSON.stringify(value)+'\n';
const assert=(value,message)=>{if(!value)throw Error(message);};
const wait=async(predicate,timeout=10000)=>{
  const limit=performance.now()+timeout;
  do{const value=predicate();if(value)return value;await new Promise(requestAnimationFrame);}while(performance.now()<limit);
  throw Error('Tempo limite: '+predicate.toString());
};
const mobile=location.search.includes('mobile'),reduced=location.search.includes('reduced');
document.body.classList.toggle('mobile',mobile);
const demoQuery='?demoSession='+crypto.randomUUID()+(reduced?'&cinematicReduced':'');
$('#director').src='campaign-director/dist/'+demoQuery;
$('#board').src='quadro/'+demoQuery;
const dw=$('#director').contentWindow,bw=$('#board').contentWindow;
const dd=()=>dw.document,bd=()=>bw.document;
const layer=()=>$('.cinematic-board-layer',bd());
const image=()=>layer()?.querySelector('img');
const style=(element,key)=>element.ownerDocument.defaultView.getComputedStyle(element)[key];
const snapshot=()=>JSON.stringify(bw.CRIS_BOARD_API.snapshot());
const status=()=>$('.cinematic-status',dd())?.textContent;
let selected;
const edit=(selector,value,root=dd())=>{
  const element=$(selector,root);element.value=value;
  element.dispatchEvent(new dw.Event('change',{bubbles:true}));
};
const draft=(name,value)=>edit('#dialogBody [name='+name+']',value);
const open=()=>{
  $('.script-tools summary',dd()).click();$('#openSceneCinematic',dd()).click();
  if(selected)draft('selected',selected);
};
const save=async()=>{
  $('#modalSubmit',dd()).click();await wait(()=>status()?.includes('salva nesta cena'));
  selected=$('[name=selected]',dd()).value;
};
const present=()=>{ $('[data-present]',dd()).click(); };
const stop=async()=>{
  $('[data-stop]',dd()).click();await wait(()=>!layer());await wait(()=>status()?.trim()==='Apresentação encerrada.');
};
const sample=async(element,time)=>{
  const animation=element.getAnimations()[0];await wait(()=>animation.currentTime>=time);
  const matrix=new DOMMatrix(style(element,'transform'));
  return {scale:matrix.a,x:matrix.e,y:matrix.f,filter:style(element,'filter')};
};
const close=()=>$('#closeDialog',dd()).click();
async function makeCue(name,actions){
  $('[data-config=triggers]',dd()).click();$('#addCue',dd()).click();
  edit('[name=name]',name);
  for(let i=0;i<actions.length;i++){
    if(i)$('#addCueAction',dd()).click();
    const row=()=>dd().querySelectorAll('.cue-action-row')[i],action=actions[i];
    edit('[data-action-type]',action.type,row());
    edit('[data-delay]',String(action.delay??0),row());
    if(action.type==='cinematic-start')edit('[data-a=cinematicId]',selected,row());
    if(action.type==='cinematic-stop')edit('[data-a=stopMode]',action.immediate?'immediate':'fade',row());
  }
  $('#modalSubmit',dd()).click();
  await wait(()=>!$('#cueActions',dd()));
  close();
  await wait(()=>[...dd().querySelectorAll('[data-trigger]')].find(button=>button.textContent.includes(name)));
  return {click:()=>[...dd().querySelectorAll('[data-trigger]')].find(button=>button.textContent.includes(name)).click()};
}
$('#run').onclick=async()=>{
  const run=$('#run');run.disabled=true;$('#result').textContent='';selected=null;
  try{
    await wait(()=>dw.demoAudio&&bw.CRIS_BOARD_API&&dd().body.dataset.demoReady==='true');
    $('#masterOffline',bd())?.click();
    await wait(()=>!bd().querySelector('dialog:modal')&&!bd().body.classList.contains('cris-loading'));
    const board=snapshot();$('#captureSnapshot',bd())?.click();
    dd().querySelector('[data-scene=quarto]').click();$('#startScene',dd()).click();
    await wait(()=>dw.demoAudio().running&&dw.demoAudio().tracks.length===2);
    const audio=dw.demoAudio();
    open();draft('selected','');draft('title','Teatro Garnier · Quadro vivo');
    draft('motion','breath');draft('seconds','3');draft('hold','0');draft('intensity','26');draft('fadeIn','.2');draft('fadeOut','.4');draft('ending','loop');
    const transfer=new dw.DataTransfer();
    transfer.items.add(new dw.File([await(await fetch('teatro-garnier.jpg')).blob()],'teatro.jpg',{type:'image/jpeg'}));
    $('[name=image]',dd()).files=transfer.files;
    $('[name=image]',dd()).dispatchEvent(new dw.Event('change',{bubbles:true}));
    assert($('[data-present]',dd()).disabled,'Rascunho precisa bloquear Apresentar.');
    $('[data-preview]',dd()).click();
    const preview=await wait(()=>$('.cinematic-preview-area img',dd()));
    if(reduced){
      assert(preview.getAnimations().length===0,'Prévia reduzida deve ser estática.');
      assert(!$('[data-motion-notice]',dd()).hidden,'Aviso de acessibilidade ausente.');
      $('[data-motion-notice] button',dd()).click();
      await wait(()=>preview.getAnimations().length>0);
    }
    const previewMid=await sample(preview,1500);
    await save();present();
    const live=await wait(()=>image());
    if(reduced){
      assert(live.getAnimations().length===0,'Quadro reduzido deve ser estático.');
      await wait(()=>status()?.includes('Movimentos reduzidos no quadro'));
      const notice=$('.cinematic-motion-notice',layer());
      assert(notice.textContent.includes('reduzidos nesta janela'),'Aviso do quadro ausente.');
      $('button',notice).click();await wait(()=>live.getAnimations().length>0);
      await wait(()=>!status()?.includes('Movimentos reduzidos no quadro'));
      log('Acessibilidade','aviso nas duas janelas, fallback estático e liberação explícita com confirmação no Director');
    }
    const early=await sample(live,200),middle=await sample(live,1500),before=await sample(live,2940),after=await sample(live,3080);
    assert(middle.scale-early.scale>.10,'Movimento deve ser perceptível.');
    assert(Math.abs(previewMid.scale-middle.scale)<.04,'Prévia e quadro precisam concordar.');
    assert(Math.abs(before.scale-after.scale)<.02,'Loop deve fechar sem salto.');
    log('Respiração',{early,middle,before,after});await stop();
    for(const motion of ['memory','apparition']){
      draft('motion',motion);draft('ending','auto');await save();present();
      const active=await wait(()=>image());
      const first=await sample(active,200),last=await sample(active,2100);
      assert(first.filter!==last.filter||Math.abs(first.scale-last.scale)>.02,'Efeito não mudou visualmente.');
      await wait(()=>!layer());await wait(()=>status()?.includes('automaticamente'));
      log(motion,{first,last,ending:status()});
    }
    draft('motion','breath');draft('ending','loop');await save();close();
    const cue=await makeCue('Cinematic · sequência de teste',[{type:'cinematic-start',delay:.3},{type:'cinematic-stop',delay:2,immediate:true}]);
    cue.click();assert(!layer(),'Atraso deve ser respeitado.');
    await wait(()=>image());const original=image();
    await wait(()=>!layer());log('Cue composta','início atrasado e encerramento imediato pelo mesmo fluxo do roteiro');
    const startCue=await makeCue('Cinematic · iniciar',[{type:'cinematic-start'}]);
    const stopCue=await makeCue('Cinematic · encerrar',[{type:'cinematic-stop'}]);
    startCue.click();await wait(()=>image());const old=image();
    startCue.click();await wait(()=>image()!==old);
    await wait(()=>Number(style(layer(),'opacity'))>.98);
    stopCue.click();const fade=await wait(()=>layer()&&!layer().classList.contains('cinematic-visible')&&layer());
    await wait(()=>Number(style(fade,'opacity'))<.9&&Number(style(fade,'opacity'))>0);
    await wait(()=>!layer());log('Cue e reapresentação','substituição e encerramento com fade confirmados');
    assert(snapshot()===board,'Snapshot do quadro mudou.');
    const running=dw.demoAudio();
    assert(running.key===audio.key&&running.running&&running.time>audio.time&&running.master===audio.master&&JSON.stringify([...running.tracks].sort())===JSON.stringify([...audio.tracks].sort()),'Áudio local foi alterado.');
    log('Integridade',{snapshot:'idêntico',audio:running});
    startCue.click();await wait(()=>image());
    dd().querySelector('[data-scene=corredor]').click();await wait(()=>!layer());
    dd().querySelector('[data-scene=quarto]').click();open();
    present();await wait(()=>image());
    const reloaded=new Promise(resolve=>$('#board').addEventListener('load',resolve,{once:true}));bw.location.reload();await reloaded;
    await wait(()=>status()?.includes('fechada ou recarregada'));await wait(()=>!layer());
    log('Cena e recarga','camada removida e estado do Director atualizado');
    log('APROVADO',{director:dw.innerWidth,quadro:bw.innerWidth,reduced});
    $('#show').hidden=false;$('#recover').hidden=false;$('#show').onclick=async()=>{
      close();dd().querySelector('[data-scene=quarto]').click();open();
      await wait(()=>!bd().body.classList.contains('cris-loading')&&!bd().querySelector('dialog:modal'));
      present();await wait(()=>image());
    };
  }catch(error){log('FALHOU',error.message);}
  finally{run.disabled=false;}
};

$('#recover').onclick=async()=>{
  const button=$('#recover');button.disabled=true;
  try{
    await wait(()=>image());
    const directorReload=new Promise(resolve=>$('#director').addEventListener('load',resolve,{once:true}));
    dw.location.reload();await directorReload;
    await wait(()=>dw.document.body.dataset.demoReady==='true'&&!layer());
    log('Recarga do Director','camada anterior encerrada');
    const boardFrame=$('#board'),originalURL=boardFrame.src;
    const blank=new Promise(resolve=>boardFrame.addEventListener('load',resolve,{once:true}));
    boardFrame.src='about:blank';await blank;
    const cue=[...dd().querySelectorAll('[data-trigger]')].find(button=>button.textContent.includes('Cinematic · iniciar'));
    cue.click();
    await wait(()=>$('#toastRegion',dd()).textContent.includes('Quadro indisponível'));
    log('Quadro indisponível','cue informa erro visível ao mestre');
    const restored=new Promise(resolve=>boardFrame.addEventListener('load',resolve,{once:true}));
    boardFrame.src=originalURL;await restored;
    await wait(()=>bw.CRIS_BOARD_API&&!bd().body.classList.contains('cris-loading')&&!bd().querySelector('dialog:modal'));
    open();present();await wait(()=>image());
    log('RECUPERAÇÃO APROVADA','apresentação nova após restauração da janela');
  }catch(error){log('FALHOU',error.message);}
  finally{button.disabled=false;}
};
