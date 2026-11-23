// An isolated real-browser acceptance test. All persisted scene editing uses the Studio controls.
const $=(q,r=document)=>r.querySelector(q),assert=(v,m)=>{if(!v)throw Error(m);},sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=(n,v)=>$('#result').textContent+=n+' '+JSON.stringify(v)+'\n';
const wait=async(fn,ms=15000)=>{const end=performance.now()+ms;do{const value=fn();if(value)return value;await sleep(40);}while(performance.now()<end);throw Error('Tempo limite: '+fn);};
const mobile=location.search.includes('mobile'),reduced=location.search.includes('reduced'),mirror=location.search.includes('mirror');document.body.classList.toggle('mobile',mobile);
const query='?demoSession='+crypto.randomUUID()+(reduced?'&cinematicReduced':'');$('#director').src='campaign-director/dist/'+query;$('#board').src=(mirror?'campaign-director/dist/cris/quadro/':'quadro/')+query;
const dw=$('#director').contentWindow,bw=$('#board').contentWindow,dd=()=>dw.document,bd=()=>bw.document;
const status=()=>$('.cinematic-status',dd())?.textContent,layer=()=>$('.cinematic-board-layer',bd());
const edit=(q,v)=>{const n=$(q,dd());assert(n,'Campo ausente: '+q);n.value=v;n.dispatchEvent(new dw.Event('input',{bubbles:true}));n.dispatchEvent(new dw.Event('change',{bubbles:true}));};
const section=s=>$('[data-section='+s+']',dd()).click(),field=(s,v)=>edit('[data-camera-field="'+s+'"]',v),draft=(k,v)=>edit('[name='+k+']',v);
const file=async(q,path,type='image/png')=>{const transfer=new dw.DataTransfer();transfer.items.add(new dw.File([await(await fetch(path)).blob()],path.split('/').pop(),{type}));$(q,dd()).files=transfer.files;$(q,dd()).dispatchEvent(new dw.Event('change',{bubbles:true}));};
const open=()=>{$('.script-tools summary',dd()).click();$('#openSceneCinematic',dd()).click();};
const save=async()=>{$('#modalSubmit',dd()).click();await wait(()=>status()?.includes('salva nesta cena'));return $('[name=selected]',dd()).value;};
const show=async()=>{$('[data-preview]',dd()).click();await wait(()=>dw.demoStudioFrame?.item);await wait(()=>dw.demoStudioFrame.composition?.camera.getAnimations().length||reduced);};
const selectedPoint=()=>$('[data-camera-point][aria-pressed=true]',dd()).dataset.cameraPoint;
const pose=frame=>{
  const matrix=node=>{const m=new DOMMatrix(node.ownerDocument.defaultView.getComputedStyle(node).transform),bounds=frame.composition.world.getBoundingClientRect();return [m.a,m.b,m.c,m.d,m.e/bounds.width,m.f/bounds.height];};
  return {camera:matrix(frame.composition.camera),jitter:matrix(frame.composition.jitter),breath:frame.composition.planes.at(-1).effects[0]?.node.ownerDocument.defaultView.getComputedStyle(frame.composition.planes.at(-1).effects[0]?.node).transform,light:frame.composition.pulses[0]?.node.ownerDocument.defaultView.getComputedStyle(frame.composition.pulses[0].node).opacity};
};
const equal=(a,b,message)=>assert(a.every((n,i)=>Math.abs(n-b[i])<.00002),message+': '+JSON.stringify({a,b}));
$('#run').onclick=async()=>{
  $('#run').disabled=true;$('#result').textContent='';
  try{
    await wait(()=>dw.demoAudio&&bw.CRIS_BOARD_API);$('#masterOffline',bd())?.click();await wait(()=>!bd().body.classList.contains('cris-loading')&&!bd().querySelector('dialog:modal'));
    let prior='',streak=0;await wait(()=>{const next=JSON.stringify(bw.CRIS_BOARD_API.snapshot());streak=next===prior?streak+1:0;prior=next;return streak>=4;});const snapshot=prior;
    $('[data-scene=quarto]',dd()).click();$('#startScene',dd()).click();await wait(()=>dw.demoAudio().tracks.length===2);const audio=dw.demoAudio();
    open();draft('selected','');draft('title','Teatro · direção avançada');draft('seconds','12');draft('motion','living');draft('hold','0');draft('fadeIn','.1');draft('fadeOut','.1');await file('[name=image]','cinematic-theater/palco.png');await wait(()=>$('.cinematic-composer-canvas .cinematic-world',dd()));
    for(const [i,name] of ['plateia','ator-esquerda','ator-direita','iris'].entries()){
      await file('[data-layer-file]',name==='iris'?'cinematic-studio/iris.png':'cinematic-theater/'+name+'.png');await wait(()=>$('[data-layer-list]',dd()).options.length===i+1&&$('[data-layer-file]',dd()).disabled===(i===3));section('transform');edit('[data-layer-scale]',name==='iris'?'3.8':name==='plateia'?'110':'12');edit('[data-layer-x]',name==='ator-esquerda'?'32':name==='ator-direita'?'68':'50');edit('[data-layer-y]',name==='plateia'?'92':'60');edit('[data-layer-parallax]',name==='plateia'?'1.6':name==='iris'?'.5':'0');
      if(i===0){section('effects');edit('[data-new-effect]','sway');}
    }
    section('effects');$('[data-breath-profile]',dd()).click();section('lighting');edit('[data-light-profile]','theater');section('camera');$('[data-camera-field=enabled]',dd()).click();
    $('[data-camera-point=to]',dd()).click();field('pose.zoom','3');field('pose.x','60');field('pose.y','60');
    $('[data-camera-add]',dd()).click();const middle1=selectedPoint();field('pose.zoom','1.6');field('pose.y','55');$('[data-camera-advanced]',dd()).open=true;field('point.at','4');field('point.hold','.5');
    $('[data-camera-add]',dd()).click();const middle2=selectedPoint();field('pose.zoom','2.3');field('pose.x','55');field('pose.y','60');$('[data-camera-advanced]',dd()).open=true;field('point.at','8');field('point.hold','.6');field('point.easing','ease-out');
    assert(dd().querySelectorAll('[data-camera-point]').length===4,'Quatro enquadramentos necessários');edit('[data-instability-preset]','rising');
    // Every preset is editable and changes the real player; finish with rising tension.
    if(reduced){await show();assert(!dw.demoStudioFrame.composition.camera.getAnimations().length,'Reduced motion animou câmera');assert(!$('[data-motion-notice]',dd()).hidden,'Aviso ausente');$('[data-motion-notice] button',dd()).click();$('[data-studio-edit]',dd()).click();}
    const presetPoses={};
    for(const preset of ['subtle','handheld','impact','rising']){edit('[data-instability-preset]',preset);await show();dw.demoStudioFrame.pause();dw.demoStudioFrame.seek(preset==='impact'?2:5);await sleep(50);presetPoses[preset]=pose(dw.demoStudioFrame).jitter;$('[data-studio-edit]',dd()).click();}
    assert(new Set(Object.values(presetPoses).map(JSON.stringify)).size===4,'Presets devem produzir resultados diferentes');log('Presets',presetPoses);
    section('camera');$('[data-camera-advanced]',dd()).open=true;field('instability.start','1');field('instability.end','11');field('instability.rotation','.6');
    const id=await save();
    section('camera');$('[data-camera-advanced]',dd()).open=true;const frequency=$('[data-camera-field="instability.frequency"]',dd());frequency.value='40';frequency.dispatchEvent(new dw.Event('input',{bubbles:true}));assert($('[data-present]',dd()).disabled,'Valor inválido deve bloquear Apresentar');frequency.value='1.4';frequency.dispatchEvent(new dw.Event('input',{bubbles:true}));assert(!$('[data-present]',dd()).disabled,'Corrigir para o valor salvo deve liberar Apresentar mesmo sem blur');$('#closeDialog',dd()).click();open();section('camera');assert(dd().querySelectorAll('[data-camera-point]').length===4,'Trajetória não foi preservada');assert($('[data-camera-point="'+middle1+'"]',dd())&&$('[data-camera-point="'+middle2+'"]',dd()),'IDs dos pontos mudaram');
    // Per-scene history includes point movement and restores it without affecting surrounding data.
    $('[data-camera-point="'+middle1+'"]',dd()).click();const old=$('[data-camera-field="pose.x"]',dd()).value;field('pose.x','57');$('[data-undo]',dd()).click();assert($('[data-camera-field="pose.x"]',dd()).value===old,'Desfazer não restaurou pose');$('[data-redo]',dd()).click();assert(Number($('[data-camera-field="pose.x"]',dd()).value)===57,'Refazer não restaurou pose');$('[data-undo]',dd()).click();await save();
    await show();
    dw.demoStudioFrame.pause();dw.demoStudioFrame.seek(3.25);await sleep(50);const at=pose(dw.demoStudioFrame);await sleep(160);equal(at.camera,pose(dw.demoStudioFrame).camera,'Pausa da câmera');equal(at.jitter,pose(dw.demoStudioFrame).jitter,'Pausa da instabilidade');
    dw.demoStudioFrame.play();await sleep(170);const playing=pose(dw.demoStudioFrame);assert(JSON.stringify(playing.camera)!==JSON.stringify(at.camera),'Retomar não moveu câmera');dw.demoStudioFrame.pause();dw.demoStudioFrame.seek(3.25);await sleep(50);equal(at.camera,pose(dw.demoStudioFrame).camera,'Seek câmera');equal(at.jitter,pose(dw.demoStudioFrame).jitter,'Seek instabilidade');dw.demoStudioFrame.restart();await sleep(60);dw.demoStudioFrame.pause();assert(dw.demoStudioFrame.time()<.3,'Reinício não voltou ao começo');
    $('[data-present]',dd()).click();await wait(()=>bw.demoBoardFrame?.item&&layer());if(reduced){assert(!bw.demoBoardFrame.composition.camera.getAnimations().length,'Quadro reduzido animou');$('.cinematic-motion-notice button',layer()).click();}
    for(const t of [0,2.4,4.25,6.15,8.3,10.2]){dw.demoStudioFrame.pause();bw.demoBoardFrame.pause();dw.demoStudioFrame.seek(t);bw.demoBoardFrame.seek(t);await sleep(70);const a=pose(dw.demoStudioFrame),b=pose(bw.demoBoardFrame);equal(a.camera,b.camera,'Prévia/quadro: câmera');equal(a.jitter,b.jitter,'Prévia/quadro: instabilidade');assert(a.breath===b.breath,'Respiração divergente');log('Timestamp '+t,{camera:a.camera,jitter:a.jitter,light:a.light});}
    // Camera and local effect move independently at two sampled times.
    bw.demoBoardFrame.seek(5.3);await sleep(50);const first=pose(bw.demoBoardFrame);bw.demoBoardFrame.seek(6.2);await sleep(50);const next=pose(bw.demoBoardFrame);assert(first.breath!==next.breath,'Respiração local não animou');assert(first.light!==next.light,'Luz não pulsou');
    $('[data-stop]',dd()).click();await wait(()=>!layer());assert(!bd().querySelector('.cinematic-world'),'Resíduo após encerrar');assert(JSON.stringify(bw.CRIS_BOARD_API.snapshot())===snapshot,'Snapshot foi alterado');assert(dw.demoAudio().running&&dw.demoAudio().time>audio.time,'Áudio local foi interrompido');
    log('APROVADO',{width:dw.innerWidth,mobile,reduced,mirror,points:4,scene:id,snapshot:'idêntico',audio:'contínuo',synchronization:'tol. 0.00002 normalizada',history:true});
    $('#compat').hidden=false;$('#compat').onclick=async()=>{try{
      const frame=dw.demoStudioFrame,image=new dw.Blob([await(await fetch('cinematic-theater/palco.png')).arrayBuffer()],{type:'image/png'}),old={id:'old-demo',imageId:frame.item.imageId,name:'Imagem anterior à 01.4',motion:'living',seconds:12,intensity:22};
      await frame.show(image,old);frame.pause();frame.seek(1);assert(!frame.composition&&frame.element.querySelector(':scope > img'),'Imagem antiga não abriu no caminho legado');
      const cam={from:{x:.5,y:.5,zoom:1},to:{x:.5,y:.6,zoom:1.8},easing:'ease-in-out',shake:.01};await frame.show({[old.imageId]:image},{...old,camera:cam});frame.pause();frame.seek(1.1);await sleep(60);const a=pose(frame);frame.seek(2);frame.seek(1.1);await sleep(60);equal(a.jitter,pose(frame).jitter,'Shake legado após seek');
      assert(frame.composition.jitter.getAnimations()[0].effect.getTiming().duration===4000,'Shake antigo deve manter ciclo de quatro segundos');log('Compatibilidade',{antes014:'imagem única',durante014:'camera.shake de quatro segundos',seek:'idêntico'});
      $('[data-studio-edit]',dd()).click();$('[data-preview]',dd()).click();
    }catch(error){log('FALHOU',error.stack);}};
    $('#show').hidden=false;$('#show').onclick=async()=>{section('camera');$('[data-camera-point=to]',dd()).click();$('[data-present]',dd()).click();await wait(()=>bw.demoBoardFrame?.item);};
  }catch(e){log('FALHOU',e.stack);}finally{$('#run').disabled=false;}
};
