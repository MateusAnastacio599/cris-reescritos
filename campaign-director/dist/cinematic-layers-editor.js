import {CINEMATIC_MAX_LAYERS,checkCinematicUpload} from './cinematic-model.js';
import {cinematicImages,imageKey,cinematicDimensions,loadCinematicMedia} from './cinematic-media.js';
import {loadComposition,fitComposition,positionCinematicLayer} from './cinematic-composition.js';
import {$,esc} from './ui.js';

const bounded=(value,min,max)=>Math.min(max,Math.max(min,value));
export class CinematicLayersEditor{
  constructor(root,{background,onChange,onError}){
    Object.assign(this,{root,background,onChange,onError});
    this.layers=[];this.files=new Map();this.revision=0;
    root.innerHTML=`<summary>Camadas</summary><p class="form-hint">O fundo ocupa a composição. Adicione até quatro PNG ou WebP, arraste para posicionar ou use X e Y. A escala é relativa à largura do fundo.</p>
      <div class="cinematic-composer"><div class="cinematic-composer-canvas" tabindex="0" role="group" aria-label="Posicionar camada. Use as setas ou os campos X e Y."></div>
      <div class="cinematic-layer-tools"><label class="field"><span>Camadas, do fundo para a frente</span><select data-layer-list size="4" aria-label="Selecionar camada"></select></label>
      <label class="field"><span>Adicionar camada (PNG ou WebP)</span><input type="file" data-layer-file accept="image/png,image/webp"></label>
      <div data-layer-fields hidden><label class="field"><span>Nome da camada</span><input data-layer-name maxlength="100" aria-label="Nome da camada"></label>
      <div class="cinematic-form-grid"><label class="field"><span>X (%)</span><input data-layer-x type="number" min="0" max="100" step="0.01"></label><label class="field"><span>Y (%)</span><input data-layer-y type="number" min="0" max="100" step="0.01"></label></div>
      <label class="field"><span>Escala (%)</span><input data-layer-scale type="number" min="10" max="200" step="0.01"></label>
      <label class="field"><span>Profundidade do parallax (0–2)</span><input data-layer-parallax type="number" min="0" max="2" step="0.01"></label>
      <label class="check-field"><input data-layer-visible type="checkbox"><span>Camada visível</span></label>
      <div class="cinematic-actions"><button type="button" data-layer-back>Para trás</button><button type="button" data-layer-front>Para frente</button><button type="button" data-layer-remove>Excluir camada</button></div></div></div></div>
      <p class="form-hint" data-composer-status role="status"></p>`;
    $('[data-layer-list]',root).onchange=event=>{this.selected=event.target.value;this.updateControls();};
    $('[data-layer-file]',root).onchange=()=>void this.add();
    for(const key of ['x','y','scale','parallax'])$('[data-layer-'+key+']',root).oninput=event=>{
      const layer=this.current();if(!layer||!event.target.validity.valid)return;
      layer[key]=Number(event.target.value)/(key==='parallax'?1:100);this.place();this.onChange();
    };
    $('[data-layer-name]',root).oninput=event=>{if(!this.current()||!event.target.value.trim())return;this.current().name=event.target.value.trim();this.list();this.onChange();};
    $('[data-layer-visible]',root).onchange=event=>{
      this.current().visible=event.target.checked;
      this.composition?.planes.find(value=>value.entry.id===this.selected)?.plane.toggleAttribute('hidden',!event.target.checked);
      this.list();this.onChange();
    };
    $('[data-layer-remove]',root).onclick=()=>{this.layers=this.layers.filter(layer=>layer.id!==this.selected);this.selected=this.layers[0]?.id;this.list();this.updateControls();this.onChange();void this.render();};
    for(const [selector,direction] of [['back',-1],['front',1]])$('[data-layer-'+selector+']',root).onclick=()=>{
      const from=this.layers.findIndex(layer=>layer.id===this.selected),to=from+direction;
      if(to<0||to>=this.layers.length)return;
      [this.layers[from],this.layers[to]]=[this.layers[to],this.layers[from]];
      this.list();this.updateControls();this.onChange();void this.render();
    };
    root.ontoggle=()=>{if(root.open)void this.render();};
    const canvas=$('.cinematic-composer-canvas',root);
    canvas.onpointerdown=event=>{
      const id=event.target.closest('[data-cinematic-layer]')?.dataset.cinematicLayer;
      if(!id||event.button!==0)return;
      event.preventDefault();this.selected=id;this.list();this.updateControls();canvas.focus();
      const layer=this.current(),bounds=this.composition.world.getBoundingClientRect();
      this.drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,startX:layer.x,startY:layer.y,width:bounds.width,height:bounds.height};
      canvas.setPointerCapture(event.pointerId);
    };
    canvas.onpointermove=event=>{
      const drag=this.drag;if(!drag||drag.pointer!==event.pointerId)return;
      this.current().x=bounded(drag.startX+(event.clientX-drag.x)/drag.width,0,1);
      this.current().y=bounded(drag.startY+(event.clientY-drag.y)/drag.height,0,1);
      this.place();this.updateControls();
    };
    const finish=()=>{if(this.drag){this.drag=null;this.onChange();}};
    canvas.onpointerup=finish;canvas.onpointercancel=finish;canvas.onlostpointercapture=finish;
    canvas.onkeydown=event=>{
      const layer=this.current(),step=event.shiftKey?.05:.01;
      if(!layer||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();
      layer.x=bounded(layer.x+({ArrowLeft:-step,ArrowRight:step}[event.key]??0),0,1);
      layer.y=bounded(layer.y+({ArrowUp:-step,ArrowDown:step}[event.key]??0),0,1);
      this.place();this.updateControls();this.onChange();
    };
  }
  current(){return this.layers.find(layer=>layer.id===this.selected);}
  value(){return structuredClone(this.layers);}
  reset(item){
    this.revision++;this.busy=false;this.loading?.abort();this.files.clear();this.disposeView();
    this.layers=structuredClone(item?.layers??[]);this.selected=this.layers[0]?.id;
    this.list();this.updateControls();if(this.root.open)void this.render();
  }
  list(){
    $('[data-layer-list]',this.root).innerHTML=this.layers.map(layer=>`<option value="${esc(layer.id)}" ${layer.id===this.selected?'selected':''}>${esc(layer.name)}${layer.visible?'':' · oculta'}</option>`).join('');
    $('[data-layer-file]',this.root).disabled=this.layers.length>=CINEMATIC_MAX_LAYERS||!!this.busy;
  }
  updateControls(){
    const layer=this.current(),fields=$('[data-layer-fields]',this.root);fields.hidden=!layer;if(!layer)return;
    $('[data-layer-name]',this.root).value=layer.name;
    for(const key of ['x','y','scale','parallax'])$('[data-layer-'+key+']',this.root).value=Number((layer[key]*(key==='parallax'?1:100)).toFixed(2));
    $('[data-layer-visible]',this.root).checked=layer.visible;
    const index=this.layers.indexOf(layer);
    $('[data-layer-back]',this.root).disabled=index===0;$('[data-layer-front]',this.root).disabled=index===this.layers.length-1;
    for(const node of this.root.querySelectorAll('[data-cinematic-layer]'))node.classList.toggle('is-selected',node.dataset.cinematicLayer===this.selected);
  }
  place(){
    const node=this.root.querySelector(`[data-cinematic-layer="${this.selected}"]`);if(node)positionCinematicLayer(node,this.current());
  }
  async add(){
    const file=$('[data-layer-file]',this.root).files[0];if(!file||this.busy||this.layers.length>=CINEMATIC_MAX_LAYERS)return;
    const revision=this.revision;this.busy=true;this.list();
    let added;
    try{
      if(!['image/png','image/webp'].includes(file.type))throw Error('Use PNG ou WebP para adicionar uma camada.');
      await checkCinematicUpload(file);
      const dimensions=await cinematicDimensions(file);if(dimensions.pixels>8000000)throw Error('Use uma camada de até 8 megapixels.');
      const id=await imageKey(file);if(revision!==this.revision)return;
      added={id:crypto.randomUUID(),name:file.name.slice(0,100),imageId:id,x:.5,y:.5,scale:.35,visible:true,parallax:1};
      this.files.set(id,file);this.layers.push(added);this.selected=added.id;
      await this.render(true);if(revision!==this.revision)return;
      this.list();this.updateControls();this.onChange();
    }catch(error){
      if(revision!==this.revision)return;
      if(added)this.layers=this.layers.filter(layer=>layer!==added);
      this.selected=this.layers[0]?.id;this.list();this.updateControls();this.onError(error.message);
    }finally{if(revision===this.revision){this.busy=false;$('[data-layer-file]',this.root).value='';this.list();this.onChange();}}
  }
  async assets(item,background){return loadCinematicMedia(item,cinematicImages,{background,files:this.files});}
  async render(throwErrors=false){
    this.loading?.abort();const controller=new AbortController();this.loading=controller;
    try{
      const background=await this.background();controller.signal.throwIfAborted();
      const id=await imageKey(background),item={name:'Composição',imageId:id,layers:this.value()};
      const asset=item.layers.length?await this.assets(item,background):{[id]:background};
      const composition=await loadComposition(asset,item,this.root.ownerDocument,{signal:controller.signal});
      if(controller.signal.aborted){composition.dispose();return;}
      this.loading=null;
      this.disposeView();this.composition=composition;
      const canvas=$('.cinematic-composer-canvas',this.root);canvas.style.aspectRatio=composition.aspect;canvas.replaceChildren(composition.world);
      this.removeFit=fitComposition(composition,canvas);this.updateControls();
      $('[data-composer-status]',this.root).textContent='Posições relativas ao fundo. A prévia animada usa o mesmo player da apresentação.';
    }catch(error){
      if(controller.signal.aborted)return;
      if(throwErrors)throw error;
      $('[data-composer-status]',this.root).textContent=error.message;
    }
  }
  disposeView(){this.removeFit?.();this.removeFit=null;this.composition?.dispose();this.composition=null;$('.cinematic-composer-canvas',this.root).replaceChildren();}
  close(){this.drag=null;this.revision++;this.loading?.abort();this.disposeView();this.root.ontoggle=null;}
}
