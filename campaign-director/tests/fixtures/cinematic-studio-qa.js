// Isolated user-triggered Chrome acceptance fixture, no campaign credentials or live data.
const $=(q,r=document)=>r.querySelector(q),assert=(v,m)=>{if(!v)throw Error(m);};
const log=(n,v)=>$('#result').textContent+=n+' '+JSON.stringify(v)+'\n';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(fn,timeout=15000)=>{const end=performance.now()+timeout;do{const v=fn();if(v)return v;await sleep(40);}while(performance.now()<end);throw Error('Tempo limite: '+fn.toString());};
const mobile=location.search.includes('mobile'),reduced=location.search.includes('reduced'),mirror=location.search.includes('mirror');document.body.classList.toggle('mobile',mobile);
const query='?demoSession='+crypto.randomUUID()+(reduced?'&cinematicReduced':'');$('#director').src='campaign-director/dist/'+query;$('#board').src=(mirror?'campaign-director/dist/cris/quadro/':'quadro/')+query;
const dw=$('#director').contentWindow,bw=$('#board').contentWindow,dd=()=>dw.document,bd=()=>bw.document,layer=()=>$('.cinematic-board-layer',bd()),status=()=>$('.cinematic-status',dd())?.textContent;
const edit=(selector,value)=>{const node=$(selector,dd());assert(node,'Campo ausente: '+selector);node.value=value;node.dispatchEvent(new dw.Event('input',{bubbles:true}));node.dispatchEvent(new dw.Event('change',{bubbles:true}));};
const draft=(name,v)=>edit('[name='+name+']',v);
const inputFile=async(selector,path,type)=>{const transfer=new dw.DataTransfer();transfer.items.add(new dw.File([await(await fetch(path)).blob()],path.split('/').pop(),{type}));const input=$(selector,dd());input.files=transfer.files;input.dispatchEvent(new dw.Event('change',{bubbles:true}));};
const section=name=>$('[data-section='+name+']',dd()).click();
const planeFrames=root=>[...root.querySelectorAll('.cinematic-layer-position')].map(n=>({id:n.dataset.cinematicLayer,rect:{x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,w:n.getBoundingClientRect().width},local:dw.getComputedStyle(n.querySelector('.cinematic-layer-effect')??n).transform}));
const open=()=>{$('.script-tools summary',dd()).click();$('#openSceneCinematic',dd()).click();};
const close=()=>$('#closeDialog',dd()).click();
const save=async()=>{$('#modalSubmit',dd()).click();await wait(()=>status()?.includes('salva nesta cena'));return $('[name=selected]',dd()).value;};
const selectLayer=name=>{const o=[...$('[data-layer-list]',dd()).options].find(o=>o.textContent.includes(name));edit('[data-layer-list]',o.value);section('transform');return o.value;};
async function cue(name,type,id){$('[data-config=triggers]',dd()).click();$('#addCue',dd()).click();edit('[name=name]',name);edit('[data-action-type]',type);if(id)edit('[data-a=cinematicId]',id);$('#modalSubmit',dd()).click();await wait(()=>!$('#cueActions',dd()));close();return ()=>[...dd().querySelectorAll('[data-trigger]')].find(n=>n.textContent.includes(name)).click();}
$('#run').onclick=async()=>{
  $('#run').disabled=true;$('#result').textContent='';
  try{
    await wait(()=>dw.demoAudio&&bw.CRIS_BOARD_API&&dd().body.dataset.demoReady==='true');$('#masterOffline',bd())?.click();await wait(()=>!bd().body.classList.contains('cris-loading')&&!bd().querySelector('dialog:modal'));
    const snapshot=JSON.stringify(bw.CRIS_BOARD_API.snapshot());$('[data-scene=quarto]',dd()).click();$('#startScene',dd()).click();await wait(()=>dw.demoAudio().tracks.length===2);const audio=dw.demoAudio();
    open();draft('selected','');draft('title','Teatro · Iris');draft('motion','living');draft('seconds','12');draft('intensity','20');draft('hold','0');draft('fadeIn','.1');draft('fadeOut','.1');
    await inputFile('[name=image]','cinematic-theater/palco.png','image/png');await wait(()=>$('.cinematic-composer-canvas .cinematic-world',dd()));
    for(const [index,name] of ['plateia','ator-esquerda','ator-direita','iris'].entries()){
      const path=name==='iris'?'cinematic-studio/iris.png':'cinematic-theater/'+name+'.png';await inputFile('[data-layer-file]',path,'image/png');await wait(()=>$('[data-layer-list]',dd()).options.length===index+1&&$('[data-layer-file]',dd()).disabled===(index===3));
      section('transform');edit('[data-layer-scale]',name==='iris'?'3.8':name==='plateia'?'110':'12');edit('[data-layer-x]',name==='ator-esquerda'?'32':name==='ator-direita'?'68':'50');edit('[data-layer-y]',name==='plateia'?'92':'60');edit('[data-layer-parallax]',name==='plateia'?'1.6':'0');
    }
    const iris=selectLayer('iris');edit('[data-layer-anchor]','feet');section('effects');$('[data-breath-profile]',dd()).click();
    section('transform');await inputFile('[data-video-file]','cinematic-studio/iris.webm','video/webm');await wait(()=>!$('[data-video-settings]',dd()).hidden);log('Camadas',{iris,escala:Number($('[data-layer-scale]',dd()).value),webm:'VP9 + PNG',atores:'sem efeitos próprios'});
    section('camera');$('[data-camera-field=enabled]',dd()).click();$('[data-camera-point=to]',dd()).click();edit('[data-camera-field="pose.zoom"]','2.2');edit('[data-camera-field="pose.x"]','50');edit('[data-camera-field="pose.y"]','60');
    section('lighting');edit('[data-light-profile]','theater');section('presentation');const id=await save();
    assert(!$('[data-present]',dd()).disabled,'Versão salva deve permitir Apresentar');
    $('[data-preview]',dd()).click();const preview=await wait(()=>$('.cinematic-studio-preview .cinematic-world',dd()));
    if(reduced){assert(!preview.querySelector('.cinematic-camera').getAnimations().length,'Movimento reduzido deve ser estático');assert(!$('[data-motion-notice]',dd()).hidden,'Aviso deve aparecer');$('[data-motion-notice] button',dd()).click();}
    await wait(()=>preview.querySelector('.cinematic-camera').getAnimations().length);
    const early=dw.getComputedStyle(preview.querySelector('.cinematic-camera')).transform;await sleep(850);const later=dw.getComputedStyle(preview.querySelector('.cinematic-camera')).transform;assert(early!==later,'Câmera precisa mover realmente');
    await wait(()=>preview.querySelector('video')&&!preview.querySelector('video').hidden||preview.closest('.cinematic-frame').querySelector('.cinematic-media-notice'));
    const video=preview.querySelector('video');let alpha='fallback';
    if(video&&!video.hidden){const c=dd().createElement('canvas');c.width=256;c.height=512;const ctx=c.getContext('2d');ctx.drawImage(video,0,0,256,512);const transparent=ctx.getImageData(1,1,1,1).data[3],opaque=ctx.getImageData(128,180,1,1).data[3];assert(transparent<32&&opaque>200,'Transparência deve ser decodificada de verdade');alpha={transparent,opaque,time:video.currentTime};}
    $('[data-studio-pause]',dd()).click();const at=dw.getComputedStyle(preview.querySelector('.cinematic-camera')).transform,vt=video?.currentTime;await sleep(350);assert(at===dw.getComputedStyle(preview.querySelector('.cinematic-camera')).transform,'Pausa precisa congelar câmera');if(video&&!video.hidden)assert(Math.abs(video.currentTime-vt)<.08,'Pausa precisa congelar WebM');
    edit('[data-studio-seek]','1');await sleep(150);$('[data-studio-restart]',dd()).click();await sleep(120);assert(Number($('[data-studio-seek]',dd()).value)<.6,'Reinício precisa retornar ao começo');log('Player',{early,later,alpha,pausa:'câmera e vídeo',busca:'1 s',reinicio:'0 s'});
    $('[data-studio-edit]',dd()).click();$('[data-present]',dd()).click();await wait(()=>layer()?.querySelector('.cinematic-camera'));if(reduced){assert(!layer().querySelector('.cinematic-camera').getAnimations().length,'Quadro deve respeitar movimento reduzido');$('.cinematic-motion-notice button',layer()).click();}
    const before=bw.getComputedStyle(layer().querySelector('.cinematic-camera')).transform;await sleep(1000);assert(before!==bw.getComputedStyle(layer().querySelector('.cinematic-camera')).transform,'Câmera precisa mover no quadro');log('Quadro',{camera:'movimento real',camadas:planeFrames(layer())});$('[data-stop]',dd()).click();await wait(()=>!layer());
    section('presentation');draft('seconds','3');await save();close();const start=await cue('Cinematic · iniciar','cinematic-start',id),stop=await cue('Cinematic · encerrar','cinematic-stop');start();await wait(()=>layer());stop();await wait(()=>!layer());start();await wait(()=>layer());await wait(()=>!layer());
    const afterSnapshot=JSON.stringify(bw.CRIS_BOARD_API.snapshot());if(afterSnapshot!==snapshot)log('Diferença snapshot',{before:JSON.parse(snapshot),after:JSON.parse(afterSnapshot)});assert(afterSnapshot===snapshot,'Snapshot não pode mudar');const running=dw.demoAudio();assert(running.running&&running.key===audio.key&&running.time>audio.time,'Áudio não pode reiniciar ou parar');
    log('Integridade',{snapshot:'idêntico',audio:running,cues:'iniciar, encerrar, reiniciar e autoencerrar'});open();section('presentation');draft('seconds','12');await save();
    $('#show').hidden=false;$('#show').onclick=()=>{$('[data-present]',dd()).click();};
    $('#reload').hidden=false;$('#reload').onclick=async()=>{try{$('[data-present]',dd()).click();await wait(()=>layer());bw.location.reload();await wait(()=>bd().readyState==='complete'&&bw.CRIS_BOARD_API);await wait(()=>!layer());log('Recarga',{ressuscitou:false});}catch(e){log('FALHOU',e.message);}};
    $('#fallback').hidden=false;$('#fallback').onclick=async()=>{const original=dw.HTMLMediaElement.prototype.play;dw.HTMLMediaElement.prototype.play=function(){return this.tagName==='VIDEO'?Promise.reject(Error('Reprodução bloqueada para teste')):original.call(this);};try{$('[data-preview]',dd()).click();await wait(()=>$('.cinematic-studio-preview .cinematic-media-notice',dd()));const image=$('.cinematic-studio-preview .cinematic-layer-position.is-selected img',dd())??[...dd().querySelectorAll('.cinematic-studio-preview .cinematic-layer-position img')].at(-1);assert(dw.getComputedStyle(image).visibility==='visible','Fallback PNG precisa continuar visível');log('Fallback',{bloqueioSimulado:true,pngVisivel:true});}catch(e){log('FALHOU',e.message);}finally{dw.HTMLMediaElement.prototype.play=original;}};
    log('APROVADO',{desktop:dw.innerWidth,mobile,reduced,mirror,alpha});
  }catch(error){log('FALHOU',error.stack);}
  finally{$('#run').disabled=false;}
};
