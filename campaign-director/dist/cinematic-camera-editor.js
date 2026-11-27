import {$,esc,option} from './ui.js';
import {defaultCamera,validCamera} from './cinematic-direction-model.js?v=directorcinematic01';
import {cameraPoints,cameraPoint,addCameraPoint,updateCameraPoint,reorderCameraPoint,instabilityPreset,INSTABILITY_PRESETS,CAMERA_MOVE_PRESETS,cameraMovePreset,CAMERA_EASINGS} from './cinematic-camera-model.js?v=directorcinematic01';
const number=(label,name,value,min,max,step='any')=>`<label class="field"><span>${label}</span><input data-camera-field="${name}" type="number" required value="${Number(value.toFixed(6))}" min="${min}" max="${max}" step="${step}"></label>`;
const checkbox=(label,name,value)=>`<label class="check-field"><input data-camera-field="${name}" type="checkbox" ${value?'checked':''}>${label}</label>`;
export class CinematicCameraEditor{
  constructor(){this.selected='from';this.advanced=false;}
  mount(root,{state,composer,change,seconds,preview}){
    delete root.dataset.cameraInvalid;
    Object.assign(this,{root,state,composer,change,seconds,preview});const camera=state.camera??defaultCamera(),points=cameraPoints(camera);if(!points.some(p=>p.id===this.selected))this.selected='from';
    const point=cameraPoint(camera,this.selected),s=camera.instability??(camera.shake?{...instabilityPreset(),amount:Math.min(1,camera.shake/.015),horizontal:.015,vertical:.015,rotation:0,frequency:2}:instabilityPreset());
    const index=points.findIndex(p=>p.id===point.id),label=i=>i===0?'Inicial':i===points.length-1?'Final':'Enquadramento '+String.fromCharCode(65+i);
    root.innerHTML=`${checkbox('Ativar câmera personalizada','enabled',!!state.camera)}<p class="form-hint">O visualizador não altera a câmera. Centros são limitados para evitar bordas vazias; em zoom 1 o plano permanece central. A trajetória leva ${seconds} s; tempos e permanências acompanham a duração.</p>
      <label class="field">Preset de movimento<select data-camera-preset><option value="">Personalizado</option>${Object.entries(CAMERA_MOVE_PRESETS).map(([id,text])=>option(id,text)).join('')}</select></label>
      <div class="cinematic-camera-point-list" role="group" aria-label="Enquadramentos">${points.map((p,i)=>`<button type="button" data-camera-point="${esc(p.id)}" aria-pressed="${p.id===point.id}">${label(i)} · ${(p.at*seconds).toFixed(2)} s</button>`).join('')}</div>
      <div class="cinematic-actions"><button type="button" data-camera-add ${(camera.path?.length??0)>=6?'disabled':''}>+ Enquadramento</button><button type="button" data-camera-focus ${composer.current()?'':'disabled'}>Focar camada</button><button type="button" data-camera-preview>Prévia</button></div>
      <h3>${label(index)}</h3><div class="cinematic-form-grid">${number('Centro X (%)','pose.x',point.pose.x*100,0,100)}${number('Centro Y (%)','pose.y',point.pose.y*100,0,100)}${number('Zoom','pose.zoom',point.pose.zoom,1,12)}</div>
      ${point.id!=='from'&&point.id!=='to'?`<div class="cinematic-actions"><button type="button" data-camera-move="-1" ${index===1?'disabled':''}>Antes</button><button type="button" data-camera-move="1" ${index===points.length-2?'disabled':''}>Depois</button><button type="button" data-camera-remove>Excluir enquadramento</button></div>`:''}
      <h3>Instabilidade da câmera</h3><p class="form-hint">Global; independente do tremor das camadas. Overscan discreto protege as bordas.</p>
      ${checkbox('Instabilidade ativada','instability.enabled',camera.instability?.enabled??!!camera.shake)}
      <label class="field">Estilo<select data-instability-preset><option value="">${camera.instability?'Personalizado':camera.shake?'Legado preservado':'Escolher…'}</option>${Object.entries(INSTABILITY_PRESETS).map(([id,text])=>option(id,text)).join('')}</select></label>
      ${number('Intensidade geral (%)','instability.amount',camera.instability?s.amount*100:camera.shake?Math.min(100,camera.shake/.015*100):s.amount*100,0,100,1)}
      <details data-camera-advanced ${this.advanced?'open':''}><summary>Ajustes avançados</summary>
      <h3>Tempo e transição do enquadramento</h3>${!['from','to'].includes(point.id)?number('Chegada (s)','point.at',point.at*seconds,.01*seconds,.99*seconds)+number('Permanência aqui (s)','point.hold',point.hold*seconds,0,seconds):'<p class="form-hint">Início e fim seguem a duração da apresentação.</p>'}
      <label class="field">Curva até o próximo enquadramento<select data-camera-field="point.easing" ${point.id==='to'?'disabled':''}>${CAMERA_EASINGS.map(e=>option(e,e,point.easing===e)).join('')}</select></label>
      <h3>Instabilidade avançada</h3><p class="form-hint">Eixos em % da composição; rotação em graus. Início/fim e fades são relativos à duração configurada. Fades nulos ainda recebem proteção mínima de 30 ms.</p>
      <div class="cinematic-form-grid">${number('Horizontal (%)','instability.horizontal',s.horizontal*100,0,1.5)}${number('Vertical (%)','instability.vertical',s.vertical*100,0,1.5)}${number('Rotação (graus)','instability.rotation',s.rotation,0,1.2)}${number('Frequência (Hz)','instability.frequency',s.frequency,.1,4)}${number('Suavidade (%)','instability.smoothness',s.smoothness*100,0,100)}${number('Irregularidade (%)','instability.irregularity',s.irregularity*100,0,100)}${number('Intensidade inicial (%)','instability.initial',s.initial*100,0,100)}${number('Intensidade final (%)','instability.final',s.final*100,0,100)}${number('Início (s)','instability.start',s.start*seconds,0,.99*seconds)}${number('Fim (s)','instability.end',s.end*seconds,.01*seconds,seconds)}${number('Entrada (% do intervalo)','instability.fadeIn',s.fadeIn*100,0,100)}${number('Saída (% do intervalo)','instability.fadeOut',s.fadeOut*100,0,100)}</div>
      <p class="form-hint">Reordenar troca os enquadramentos entre os instantes existentes e limita a permanência ao espaço disponível. Focar copia a posição; excluir a camada depois não remove o enquadramento. Repetir faz o caminho de volta. Até seis pontos intermediários.</p></details><p data-camera-error class="form-error" role="status"></p>`;
    this.composer.cameraEdit=state.camera?this.selected:null;this.composer.camera=state.camera;this.composer.drawCamera();
    const commit=(next,{render=true}={})=>{
      if(next&&!validCamera(next)){this.error('Confira os limites: início antes do fim; entrada + saída até 100%; tempos únicos e permanência com espaço para transição.');return false;}
      delete root.dataset.cameraInvalid;$('[data-camera-error]',root).textContent='';
      if(next)state.camera=next;else delete state.camera;
      composer.camera=next;composer.cameraEdit=next?this.selected:null;change(state);composer.drawCamera();if(render)this.mount(root,{state,composer,change,seconds,preview});return true;
    };
    this.commit=commit;
    $('[data-camera-advanced]',root).ontoggle=e=>this.advanced=e.currentTarget.open;
    for(const button of root.querySelectorAll('[data-camera-point]'))button.onclick=()=>{this.selected=button.dataset.cameraPoint;if(!state.camera){commit(defaultCamera());return;}this.mount(root,{state,composer,change,seconds,preview});};
    $('[data-camera-add]',root).onclick=()=>{try{const result=addCameraPoint(state.camera??defaultCamera());this.selected=result.id;commit(result.camera);}catch(error){this.error(error.message);}};
    $('[data-camera-preview]',root).onclick=preview;
    $('[data-camera-focus]',root).onclick=()=>{const layer=composer.current();if(!layer)return;const next=structuredClone(state.camera??defaultCamera());Object.assign(cameraPoint(next,this.selected).pose,{x:layer.x,y:layer.y});commit(next);};
    $('[data-camera-preset]',root).onchange=e=>{if(e.target.value){this.selected='from';commit(cameraMovePreset(state.camera??defaultCamera(),e.target.value));}};
    $('[data-instability-preset]',root).onchange=e=>{if(e.target.value)commit({...structuredClone(state.camera??defaultCamera()),instability:instabilityPreset(e.target.value)});};
    $('[data-camera-remove]',root)?.addEventListener('click',()=>{const next=structuredClone(state.camera);next.path=next.path.filter(p=>p.id!==this.selected);this.selected='from';commit(next);});
    for(const b of root.querySelectorAll('[data-camera-move]'))b.onclick=()=>commit(reorderCameraPoint(state.camera,this.selected,Number(b.dataset.cameraMove)));
    for(const node of root.querySelectorAll('[data-camera-field]')){
      const apply=(render=true)=>{
      if(!node.validity.valid){this.error('Use um valor dentro dos limites indicados antes de salvar ou apresentar.');return;}const path=node.dataset.cameraField.split('.'),value=node.type==='checkbox'?node.checked:node.type==='number'?Number(node.value):node.value;
      const next=structuredClone(state.camera??defaultCamera());
      try{
        if(path[0]==='enabled'){commit(value?next:null,{render});return;}
        if(path[0]==='pose'){cameraPoint(next,this.selected).pose[path[1]]=value/(path[1]==='zoom'?1:100);}
        if(path[0]==='point'){
          if(this.selected==='from')next.easing=value;
          else if(this.selected!=='to'){commit(updateCameraPoint(next,this.selected,{[path[1]]:path[1]==='easing'?value:value/seconds}),{render});return;}
        }
        if(path[0]==='instability'){
          next.instability??=structuredClone(s);
          const percentage=['amount','horizontal','vertical','smoothness','irregularity','initial','final','fadeIn','fadeOut'].includes(path[1]);
          next.instability[path[1]]=typeof value==='number'?value/(percentage?100:['start','end'].includes(path[1])?seconds:1):value;
        }
        commit(next,{render});
      }catch(error){this.error(error.message);}
      };
      node.onchange=()=>apply(node.type!=='number');if(node.type==='number')node.oninput=()=>apply(false);
    }
    composer.onCameraSelect=id=>{this.selected=id;this.mount(root,{state,composer,change,seconds,preview});};
  }
  error(message){this.root.dataset.cameraInvalid='true';$('[data-camera-error]',this.root).textContent=message;this.change(this.state);}
}
