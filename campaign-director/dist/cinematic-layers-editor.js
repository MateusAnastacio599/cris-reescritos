import {CINEMATIC_ASSETS,FOG_VIDEO_ASSET} from './cinematic-assets.js';
import {newEffect} from './cinematic-direction-model.js';
import {defaultWindow} from './cinematic-timing.js';
import {duplicateCinematicLayer} from './cinematic-layer-operations.js';
import {cameraPoints,cameraPoint} from './cinematic-camera-model.js';
import {CINEMATIC_MAX_LAYERS,checkCinematicUpload} from './cinematic-model.js';
import {cinematicImages,imageKey,cinematicDimensions,loadCinematicMedia} from './cinematic-media.js';
import {loadComposition,fitComposition,positionCinematicLayer} from './cinematic-composition.js';
import {ANCHORS,bounded,safeCameraPose} from './cinematic-direction-model.js';
import {checkCinematicVideo} from './cinematic-video.js';
import {$,esc} from './ui.js';

export class CinematicLayersEditor{
  constructor(root,{background,onChange,onError,onSelect=()=>{}}){
    Object.assign(this,{root,background,onChange,onError,onSelect});
    this.layers=[];this.files=new Map();this.revision=0;this.view={zoom:1,x:0,y:0};
    root.innerHTML=`<summary>Composição</summary><div class="cinematic-layout-controls"><button type="button" data-collapse-side="left" aria-expanded="true">Camadas</button><button type="button" data-collapse-side="right" aria-expanded="true">Propriedades</button><button type="button" data-studio-expand>Área ampliada</button></div><div class="cinematic-studio-mobile"><button type="button" data-pane="layers">Camadas</button><button type="button" data-pane="canvas">Canvas</button><button type="button" data-pane="properties">Propriedades</button></div>
      <div class="cinematic-composer"><aside class="cinematic-layer-list-panel"><h3>Camadas</h3><label class="field">Biblioteca de overlays<select data-cinematic-asset><option value="">Adicionar…</option>${[...CINEMATIC_ASSETS,FOG_VIDEO_ASSET].map(a=>`<option value="${a.id}">${a.name}</option>`).join('')}</select></label><p class="form-hint">Fundo → primeiro plano</p><select data-layer-list size="5" aria-label="Selecionar camada"></select><label class="field"><span>+ Imagem</span><input type="file" data-layer-file accept="image/png,image/jpeg,image/webp"></label><p class="form-hint">Até 12 camadas, respeitando orçamento de mídia e FX. Selecione uma camada PNG para anexar um WebM transparente.</p></aside>
      <section class="cinematic-canvas-panel"><div class="cinematic-view-tools"><button type="button" data-view-fit>Ajustar</button><button type="button" data-view-out aria-label="Afastar visualizador">−</button><output data-view-zoom>100%</output><button type="button" data-view-in aria-label="Aproximar visualizador">+</button><button type="button" data-view-frame>Enquadrar seleção</button></div><p class="form-hint">Zoom do visualizador não altera a câmera. Espaço + arraste move o visualizador.</p><div class="cinematic-composer-canvas" tabindex="0" role="group" aria-label="Composição. Setas movem a camada; Shift faz ajuste fino."></div><div class="cinematic-studio-preview cinematic-frame" hidden></div><div class="cinematic-transport"><button type="button" data-studio-play>Prévia</button><button type="button" data-studio-pause>Pausar</button><button type="button" data-studio-restart>Reiniciar</button><output data-studio-time>0 / 0 s</output><input aria-label="Posição da prévia" data-studio-seek type="range" min="0" max="12" step="any" value="0"><label><input type="checkbox" data-studio-loop>Repetir prévia</label><button type="button" data-studio-edit>Voltar à composição</button></div><p class="form-hint" data-composer-status role="status"></p></section>
      <aside class="cinematic-layer-tools"><div data-studio-properties></div></aside></div>`;
    this.root.open=true;this.root.dataset.pane='canvas';
    this.transformFields=document.createElement('div');this.transformFields.innerHTML=`<div data-layer-fields hidden><label class="field"><span>Nome</span><input data-layer-name maxlength="100"></label><h3>Transformação</h3><div class="cinematic-form-grid">${['x','y'].map(k=>`<label class="field"><span>${k.toUpperCase()} (%)</span><input data-layer-${k} type="number" min="0" max="100" step="any"></label>`).join('')}</div><label class="field">Escala (%)<input data-layer-scale type="number" min="0.1" max="300" step="any"></label><input type="range" data-layer-scale-log min="-3" max="0.477121" step="0.001" aria-label="Escala logarítmica"><label class="field">Rotação (graus)<input data-layer-rotation type="number" min="-180" max="180" step="0.1"></label><label class="field">Âncora<select data-layer-anchor>${Object.entries({center:'Centro',feet:'Pés',top:'Topo',left:'Esquerda',right:'Direita',custom:'Personalizada'}).map(([id,title])=>`<option value="${id}">${title}</option>`).join('')}</select></label><div class="cinematic-form-grid"><label class="field">Âncora X (%)<input data-anchor-x type="number" min="0" max="100" step="1"></label><label class="field">Âncora Y (%)<input data-anchor-y type="number" min="0" max="100" step="1"></label></div><h3>Profundidade e aparência</h3><label class="field">Parallax (0–2)<input data-layer-parallax type="number" min="0" max="2" step="any"></label><label class="field">Opacidade (0–1)<input data-layer-opacity type="number" min="0" max="1" step="any"></label><label class="check-field"><input data-layer-visible type="checkbox">Visível</label><label><input type="checkbox" data-layer-locked>Bloquear transformação</label><div class="cinematic-actions"><button type="button" data-layer-duplicate>Duplicar</button><button type="button" data-layer-solo>Solo temporário</button><button type="button" data-layer-back>Para trás</button><button type="button" data-layer-front>Para frente</button><button type="button" data-layer-remove>Excluir camada</button></div><details><summary>Mídia animada</summary><p class="form-hint">WebM VP9 com alpha, sem áudio. Até dois vídeos, 8 MB / 12 s cada. A imagem desta camada deve ser um PNG de fallback com a mesma proporção.</p><input type="file" data-video-file accept="video/webm"><div data-video-settings hidden><label><input type="checkbox" data-video-enabled>Ativo</label><label><input type="checkbox" data-video-loop>Repetir</label><label class="field">Velocidade<input data-video-rate type="number" min="0.25" max="2" step="0.05"></label><label class="field">Atraso (s)<input data-video-delay type="number" min="0" max="60" step="0.1"></label><label class="field">Ao terminar<select data-video-end><option value="freeze">Manter último quadro</option><option value="fallback">Mostrar PNG</option><option value="hide">Ocultar</option></select></label><button type="button" data-video-remove>Remover vídeo, manter PNG</button></div></details></div><p data-layer-empty class="form-hint">Selecione ou adicione uma camada.</p>`;
    $('[data-studio-properties]',root).append(this.transformFields);
    const $f=q=>$(q,this.transformFields);
    $('[data-layer-list]',root).onchange=e=>{this.selected=e.target.value;this.updateControls();this.onSelect();};
    $('[data-layer-file]',root).onchange=()=>void this.add();
    $('[data-cinematic-asset]',root).onchange=e=>void this.addAsset(e.target.value);
    for(const button of root.querySelectorAll('[data-collapse-side]'))button.onclick=()=>{const key=button.dataset.collapseSide+'Hidden',grid=$('.cinematic-composer',root);grid.dataset[key]=grid.dataset[key]==='true'?'false':'true';button.setAttribute('aria-expanded',String(grid.dataset[key]!=='true'));};
    $('[data-studio-expand]',root).onclick=e=>{root.dataset.expanded=root.dataset.expanded==='true'?'false':'true';e.currentTarget.setAttribute('aria-pressed',String(root.dataset.expanded==='true'));};

    for(const key of ['x','y','scale','parallax','rotation','opacity'])$f('[data-layer-'+key+']').oninput=e=>{
      const layer=this.current();if(!layer||!e.target.validity.valid)return;
      layer[key]=Number(e.target.value)/(['x','y','scale'].includes(key)?100:1);this.place();this.onChange();
    };
    $f('[data-layer-scale-log]').oninput=e=>{if(!this.current())return;this.current().scale=bounded(10**Number(e.target.value),.001,3);this.place();this.updateControls();this.onChange();};
    $f('[data-layer-anchor]').onchange=e=>{if(e.target.value!=='custom')this.setAnchor(ANCHORS[e.target.value]);};
    for(const k of ['x','y'])$f('[data-anchor-'+k+']').onchange=e=>{if(e.target.validity.valid)this.setAnchor({x:Number($f('[data-anchor-x]').value)/100,y:Number($f('[data-anchor-y]').value)/100});};
    $f('[data-layer-name]').oninput=e=>{if(!this.current()||!e.target.value.trim())return;this.current().name=e.target.value.trim();this.list();this.onChange();};
    $f('[data-layer-visible]').onchange=e=>{this.current().visible=e.target.checked;this.composition?.planes.find(p=>p.entry.id===this.selected)?.plane.toggleAttribute('hidden',!e.target.checked);this.list();this.onChange();};
    $f('[data-layer-locked]').onchange=e=>{this.current().locked=e.target.checked;this.updateControls();this.onChange();};
    $f('[data-layer-duplicate]').onclick=()=>{try{this.layers=duplicateCinematicLayer(this.layers,this.selected,!!this.backgroundVideo);this.selected=this.layers.at(-1).id;this.list();this.updateControls();this.onChange();void this.render();}catch(error){this.onError(error.message);}};
    $f('[data-layer-solo]').onclick=()=>{this.solo=this.solo===this.selected?null:this.selected;for(const p of this.composition?.planes??[])if(p.entry.id!=='background')p.plane.hidden=!p.entry.visible||!!this.solo&&p.entry.id!==this.solo;$f('[data-layer-solo]').textContent=this.solo?'Sair do solo':'Solo temporário';};
    $f('[data-layer-remove]').onclick=()=>{this.layers=this.layers.filter(l=>l.id!==this.selected);this.selected=this.layers[0]?.id;this.list();this.updateControls();this.onChange();this.onSelect();void this.render();};
    for(const [selector,direction] of [['back',-1],['front',1]])$f('[data-layer-'+selector+']').onclick=()=>{const from=this.layers.findIndex(l=>l.id===this.selected),to=from+direction;if(to<0||to>=this.layers.length)return;[this.layers[from],this.layers[to]]=[this.layers[to],this.layers[from]];this.list();this.updateControls();this.onChange();void this.render();};
    $f('[data-video-file]').onchange=()=>void this.addVideo();
    $f('[data-video-remove]').onclick=()=>{delete this.current().video;this.updateControls();this.onChange();};
    for(const k of ['enabled','loop','rate','delay','end'])$f('[data-video-'+k+']').onchange=e=>{if(!e.target.validity.valid)return;this.current().video[k]=e.target.type==='checkbox'?e.target.checked:['rate','delay'].includes(k)?Number(e.target.value):e.target.value;this.onChange();};
    const canvas=$('.cinematic-composer-canvas',root);this.canvas=canvas;
    for(const b of root.querySelectorAll('[data-pane]'))b.onclick=()=>root.dataset.pane=b.dataset.pane;
    $('[data-view-fit]',root).onclick=()=>{this.view={zoom:1,x:0,y:0};this.applyView();};
    for(const [id,factor] of [['in',1.5],['out',1/1.5]])$('[data-view-'+id+']',root).onclick=()=>{this.view.zoom=bounded(this.view.zoom*factor,.5,30);this.applyView();};
    $('[data-view-frame]',root).onclick=()=>{const l=this.current();if(!l)return;const image=this.composition?.planes.find(p=>p.entry.id===l.id)?.plane.querySelector('img'),aspect=image?image.naturalWidth/image.naturalHeight:1;this.view.zoom=bounded(Math.min(.45/l.scale,.65/(l.scale*(this.composition?.aspect??1)/aspect)),1,30);this.view.x=.5-l.x;this.view.y=.5-l.y;this.applyView();};
    canvas.onwheel=e=>{if(!e.ctrlKey)return;e.preventDefault();this.view.zoom=bounded(this.view.zoom*(e.deltaY<0?1.1:1/1.1),.25,40);this.applyView();};
    canvas.onpointerdown=e=>{
      if(e.button!==0||!this.composition)return;
      const bounds=this.composition.world.getBoundingClientRect();
      if(this.space){e.preventDefault();this.drag={kind:'view',pointer:e.pointerId,x:e.clientX,y:e.clientY,startX:this.view.x,startY:this.view.y,width:bounds.width,height:bounds.height};}
      else if(this.cameraEdit&&e.target.closest('[data-camera-handle],[data-camera-select]')){e.preventDefault();const key=e.target.closest('[data-camera-select]')?.dataset.cameraSelect;if(key){this.cameraEdit=key;this.onCameraSelect?.(key);}const pose=cameraPoint(this.camera,this.cameraEdit)?.pose;if(!pose)return;this.drag={kind:'camera',pointer:e.pointerId,bounds,x:e.clientX,y:e.clientY,startX:pose.x,startY:pose.y};}
      else{
        const id=e.target.closest('[data-cinematic-layer]')?.dataset.cinematicLayer;if(!id)return;
        e.preventDefault();this.selected=id;this.list();this.updateControls();this.onSelect();const l=this.current();if(l.locked)return;
        this.drag={kind:e.target.hasAttribute('data-layer-resize')?'scale':'position',pointer:e.pointerId,x:e.clientX,y:e.clientY,startX:l.x,startY:l.y,scale:l.scale,width:bounds.width,height:bounds.height};
      }
      canvas.focus();canvas.setPointerCapture(e.pointerId);
    };
    canvas.onpointermove=e=>{
      const d=this.drag;if(!d||d.pointer!==e.pointerId)return;
      if(d.kind==='view'){this.view.x=d.startX+(e.clientX-d.x)/d.width;this.view.y=d.startY+(e.clientY-d.y)/d.height;this.applyView();return;}
      if(d.kind==='camera'){const pose=this.camera&&cameraPoint(this.camera,this.cameraEdit)?.pose;if(pose){pose.x=bounded(d.startX+(e.clientX-d.x)/d.bounds.width,0,1);pose.y=bounded(d.startY+(e.clientY-d.y)/d.bounds.height,0,1);this.drawCamera();}return;}
      const l=this.current();if(d.kind==='scale')l.scale=bounded(d.scale+2*(e.clientX-d.x)/d.width,.001,3);
      else{l.x=bounded(d.startX+(e.clientX-d.x)/d.width,0,1);l.y=bounded(d.startY+(e.clientY-d.y)/d.height,0,1);}
      this.place();this.updateControls();
    };
    const finish=()=>{if(!this.drag)return;const kind=this.drag.kind;this.drag=null;if(kind==='camera')this.onCameraChange?.(this.camera);else if(kind!=='view')this.onChange();};
    canvas.onpointerup=finish;canvas.onpointercancel=finish;canvas.onlostpointercapture=finish;
    canvas.onkeyup=e=>{if(e.code==='Space')this.space=false;};canvas.onblur=()=>{this.space=false;};
    canvas.onkeydown=e=>{
      if(e.code==='Space'){e.preventDefault();this.space=true;return;}
      if(this.cameraEdit&&this.camera&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
        const pose=cameraPoint(this.camera,this.cameraEdit)?.pose,step=e.shiftKey?.0005:.005;if(!pose)return;e.preventDefault();
        pose.x=bounded(pose.x+({ArrowLeft:-step,ArrowRight:step}[e.key]??0),0,1);pose.y=bounded(pose.y+({ArrowUp:-step,ArrowDown:step}[e.key]??0),0,1);this.drawCamera();this.onCameraChange?.(this.camera);return;
      }
      const l=this.current(),step=e.shiftKey?.0005:.005;if(!l||l.locked||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
      l.x=bounded(l.x+({ArrowLeft:-step,ArrowRight:step}[e.key]??0),0,1);l.y=bounded(l.y+({ArrowUp:-step,ArrowDown:step}[e.key]??0),0,1);this.place();this.updateControls();this.onChange();
    };
  }
  current(){return this.layers.find(l=>l.id===this.selected);}
  value(){return structuredClone(this.layers);}
  setAnchor(anchor){if(this.current()?.locked)return;try{this.onAnchor?.(this.current(),anchor);this.place();this.updateControls();this.onChange();}catch(e){this.onError(e.message);this.updateControls();}}
  reset(item,{retainFiles=false}={}){this.revision++;this.busy=false;this.loading?.abort();if(!retainFiles)this.files.clear();this.disposeView();this.solo=null;this.backgroundVideo=item?.backgroundVideo;this.layers=structuredClone(item?.layers??[]);this.selected=this.layers.some(l=>l.id===this.selected)?this.selected:this.layers[0]?.id;this.camera=item?.camera;this.list();this.updateControls();void this.render();}
  list(){$('[data-layer-list]',this.root).innerHTML=this.layers.map(l=>`<option value="${esc(l.id)}" ${l.id===this.selected?'selected':''}>${esc(l.name)}${l.visible?'':' · oculta'}${l.locked?' · bloqueada':''}${l.video?' · WebM':''}</option>`).join('');$('[data-layer-file]',this.root).disabled=this.layers.length>=CINEMATIC_MAX_LAYERS||!!this.busy;}
  updateControls(){
    const layer=this.current(),f=this.transformFields;$('[data-layer-fields]',f).hidden=!layer;$('[data-layer-empty]',f).hidden=!!layer;if(!layer)return;
    $('[data-layer-name]',f).value=layer.name;
    for(const k of ['x','y','scale','parallax','rotation','opacity'])$('[data-layer-'+k+']',f).value=Number(((layer[k]??(k==='opacity'?1:0))*(['x','y','scale'].includes(k)?100:1)).toFixed(3));
    $('[data-layer-scale-log]',f).value=Math.log10(layer.scale);
    const a=layer.anchor??ANCHORS.center;$('[data-anchor-x]',f).value=a.x*100;$('[data-anchor-y]',f).value=a.y*100;$('[data-layer-anchor]',f).value=Object.keys(ANCHORS).find(k=>ANCHORS[k].x===a.x&&ANCHORS[k].y===a.y)??'custom';
    for(const k of ['x','y','scale','scale-log','rotation','parallax','opacity','anchor'])$('[data-layer-'+k+']',f).disabled=!!layer.locked;for(const k of ['x','y'])$('[data-anchor-'+k+']',f).disabled=!!layer.locked;$('[data-layer-locked]',f).checked=!!layer.locked;
    $('[data-layer-visible]',f).checked=layer.visible;const i=this.layers.indexOf(layer);$('[data-layer-back]',f).disabled=i===0;$('[data-layer-front]',f).disabled=i===this.layers.length-1;
    $('[data-video-settings]',f).hidden=!layer.video;
    if(layer.video)for(const k of ['enabled','loop','rate','delay','end']){const node=$('[data-video-'+k+']',f);if(node.type==='checkbox')node.checked=layer.video[k];else node.value=layer.video[k];}
    for(const node of this.root.querySelectorAll('[data-cinematic-layer]'))node.classList.toggle('is-selected',node.dataset.cinematicLayer===this.selected);
    this.placeHandles();
  }
  place(){const node=this.root.querySelector(`.cinematic-layer-position[data-cinematic-layer="${this.selected}"]`);if(node)positionCinematicLayer(node,this.current());this.placeHandles();}
  placeHandles(){
    if(!this.composition)return;
    for(const handle of this.canvas.querySelectorAll('.cinematic-layer-handle'))handle.remove();
    const l=this.current();if(!l||!l.visible||l.locked)return;
    const handle=document.createElement('button');handle.type='button';handle.className='cinematic-layer-handle';handle.dataset.cinematicLayer=l.id;handle.setAttribute('aria-label','Mover '+l.name);handle.style.left=l.x*100+'%';handle.style.top=l.y*100+'%';
    const resize=document.createElement('span');resize.dataset.layerResize='';resize.textContent='↔';resize.title='Arraste para alterar a escala';handle.append(resize);this.composition.world.append(handle);
  }
  applyView(){if(!this.composition)return;const v=this.view;this.composition.world.style.transform=`translate(-50%,-50%) scale(${v.zoom}) translate(${v.x*100}%,${v.y*100}%)`;$('[data-view-zoom]',this.root).textContent=Math.round(v.zoom*100)+'%';this.placeHandles();}
  drawCamera(){
    for(const node of this.canvas.querySelectorAll('.cinematic-camera-path,[data-camera-handle],[data-camera-select]'))node.remove();
    if(!this.cameraEdit||!this.composition||!this.camera)return;
    const points=cameraPoints(this.camera),document=this.root.ownerDocument,world=this.composition.world;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('cinematic-camera-path');svg.setAttribute('viewBox','0 0 1000 1000');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
    const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('points',points.map(p=>{const safe=safeCameraPose(p.pose);return `${safe.x*1000},${safe.y*1000}`;}).join(' '));svg.append(line);world.append(svg);
    for(const [i,point] of points.entries()){
      const pose=safeCameraPose(point.pose),marker=document.createElement('button');marker.type='button';marker.className='cinematic-camera-marker';marker.dataset.cameraSelect=point.id;marker.textContent=String.fromCharCode(65+i);marker.setAttribute('aria-label','Editar enquadramento '+marker.textContent);marker.setAttribute('aria-pressed',String(point.id===this.cameraEdit));marker.style.left=pose.x*100+'%';marker.style.top=pose.y*100+'%';
      marker.onclick=()=>{this.cameraEdit=point.id;this.onCameraSelect?.(point.id);};world.append(marker);
    }
    const selected=cameraPoint(this.camera,this.cameraEdit);if(!selected)return;
    const p=safeCameraPose(selected.pose),rect=document.createElement('div');rect.dataset.cameraHandle='';rect.className='cinematic-camera-handle';Object.assign(rect.style,{left:(p.x-.5/p.zoom)*100+'%',top:(p.y-.5/p.zoom)*100+'%',width:100/p.zoom+'%',height:100/p.zoom+'%'});rect.textContent='Enquadramento '+String.fromCharCode(65+points.findIndex(point=>point.id===selected.id));world.append(rect);
  }

  pool(id,file){const total=[...this.files].reduce((sum,[key,blob])=>sum+(key===id?0:blob.size),0)+file.size;if(total>64*1024*1024)throw Error('O rascunho atingiu 64 MB. Salve e reabra o Studio para liberar os arquivos do histórico.');this.files.set(id,file);}
  async add(){
    const file=$('[data-layer-file]',this.root).files[0];if(!file||this.busy||this.layers.length>=CINEMATIC_MAX_LAYERS)return;const revision=this.revision;this.busy=true;this.list();this.onChange();let added;
    try{await checkCinematicUpload(file);const size=await cinematicDimensions(file);if(size.pixels>8000000)throw Error('Use uma camada de até 8 megapixels.');const id=await imageKey(file);if(revision!==this.revision)return;this.pool(id,file);added={id:crypto.randomUUID(),name:file.name.slice(0,100),imageId:id,x:.5,y:.5,scale:.35,visible:true,parallax:1};this.layers.push(added);this.selected=added.id;await this.render(true);if(revision!==this.revision)return;this.list();this.updateControls();this.onSelect();this.onChange();}
    catch(e){if(revision!==this.revision)return;if(added)this.layers=this.layers.filter(l=>l!==added);this.list();this.updateControls();this.onError(e.message);}
    finally{if(revision===this.revision){this.busy=false;$('[data-layer-file]',this.root).value='';this.list();this.onChange();}}
  }
  async addAsset(id){
    const asset=[...CINEMATIC_ASSETS,FOG_VIDEO_ASSET].find(a=>a.id===id);if(!asset||this.busy||this.layers.length>=CINEMATIC_MAX_LAYERS)return;
    const revision=this.revision;this.busy=true;this.onChange();
    try{const response=await fetch(asset.url);if(!response.ok)throw Error('Overlay da biblioteca indisponível.');const file=new File([await response.arrayBuffer()],asset.id+'.png',{type:'image/png'});await checkCinematicUpload(file);const imageId=await imageKey(file);if(revision!==this.revision)return;this.pool(imageId,file);
      const layer={id:crypto.randomUUID(),name:asset.name,imageId,x:.5,y:.5,scale:1,parallax:0,visible:true,...asset.placement};
      if(asset.effect){const fx=newEffect(asset.effect);fx.amount=asset.amount;fx.window=defaultWindow(12);layer.effects=[fx];}if(asset.videoURL){if(this.layers.filter(l=>l.video).length+Number(!!this.backgroundVideo)>=2)throw Error('A composição permite até dois vídeos.');const movie=new Blob([await(await fetch(asset.videoURL)).arrayBuffer()],{type:'video/webm'}),mediaId=await imageKey(movie);if(revision!==this.revision)return;this.pool(mediaId,movie);layer.video={mediaId,enabled:true,loop:true,rate:1,delay:0,end:'freeze'};}this.layers.push(layer);this.selected=layer.id;this.list();this.updateControls();this.onSelect();this.onChange();await this.render();}
    catch(error){this.onError(error.message);}finally{if(revision===this.revision){this.busy=false;this.list();$('[data-cinematic-asset]',this.root).value='';this.onChange();}}
  }
  async addVideo(){
    const file=$('[data-video-file]',this.transformFields).files[0],layer=this.current();if(!file||!layer||this.busy)return;const revision=this.revision;this.busy=true;this.onChange();
    try{if(!layer.video&&this.layers.filter(l=>l.video).length+Number(!!this.backgroundVideo)>=2)throw Error('Use no máximo duas camadas de vídeo.');await checkCinematicVideo(file,{extension:true});const fallback=this.files.get(layer.imageId)??await cinematicImages.get(layer.imageId);if(fallback?.type!=='image/png')throw Error('Selecione uma camada PNG para ser o fallback.');const id=await imageKey(file);if(revision!==this.revision)return;this.pool(id,file);const prior=layer.video;layer.video={mediaId:id,enabled:true,loop:true,rate:1,delay:0,end:'freeze'};try{await this.render(true);}catch(error){if(prior)layer.video=prior;else delete layer.video;throw error;}if(revision!==this.revision)return;this.list();this.updateControls();this.onChange();}
    catch(e){if(revision===this.revision)this.onError(e.message);}finally{if(revision===this.revision){this.busy=false;$('[data-video-file]',this.transformFields).value='';this.onChange();}}
  }
  assets(item,background){return loadCinematicMedia(item,cinematicImages,{background,files:this.files});}
  async render(throwErrors=false){
    this.loading?.abort();const controller=new AbortController();this.loading=controller;
    try{const background=await this.background();controller.signal.throwIfAborted();const id=await imageKey(background),item={name:'Composição',imageId:id,layers:this.value(),...(this.lighting?{lighting:this.lighting}:{})};const asset=item.layers.length?await this.assets(item,background):{[id]:background};const composition=await loadComposition(asset,item,this.root.ownerDocument,{signal:controller.signal});if(controller.signal.aborted){composition.dispose();return;}this.loading=null;this.disposeView();this.composition=composition;this.canvas.style.aspectRatio=composition.aspect;this.canvas.replaceChildren(composition.world);this.removeFit=fitComposition(composition,this.canvas);this.updateControls();this.applyView();this.drawCamera();$('[data-composer-status]',this.root).textContent='Visualizador estático. Prévia reproduz câmera, efeitos, iluminação e vídeo.';}
    catch(e){if(controller.signal.aborted)return;if(throwErrors)throw e;$('[data-composer-status]',this.root).textContent=e.message;}
  }
  disposeView(){this.removeFit?.();this.removeFit=null;this.composition?.dispose();this.composition=null;this.canvas.replaceChildren();}
  close(){this.drag=null;this.revision++;this.loading?.abort();this.disposeView();this.files.clear();}
}
