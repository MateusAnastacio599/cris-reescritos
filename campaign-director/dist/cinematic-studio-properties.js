import {renderBackgroundMedia} from './cinematic-background-editor.js';
import {renderWindows,renderLights} from './cinematic-direction-editor.js';
import {sceneSpan} from './cinematic-timing.js';
import {CinematicCameraEditor} from './cinematic-camera-editor.js';
import {$,esc,option} from './ui.js';
import {ANCHORS,changeLayerAnchor,newEffect,EFFECT_TYPES,EASINGS,lightingProfile,LIGHT_PROFILES} from './cinematic-direction-model.js';
const input=(label,path,value,min,max,step=.01)=>`<label class="field"><span>${label}</span><input data-property="${path}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;
const toggle=(label,path,value)=>`<label class="check-field"><input data-property="${path}" type="checkbox" ${value?'checked':''}>${label}</label>`;
export class StudioProperties{
  constructor(root,{composer,read,change}){Object.assign(this,{root,composer,read,change});this.cameraEditor=new CinematicCameraEditor();}
  render(){
    const {root,composer}=this,layer=composer.current(),state=this.read();
    const presentation=this.presentation;
    root.innerHTML=`<nav class="cinematic-property-tabs" aria-label="Propriedades"><button type="button" data-section="transform">Camada</button><button type="button" data-section="camera">Câmera</button><button type="button" data-section="effects">Efeitos</button><button type="button" data-section="lighting">Luz</button><button type="button" data-section="media">Fundo vivo</button><button type="button" data-section="direction">Direção</button><button type="button" data-section="presentation">Apresentação</button></nav><div data-property-body></div><div data-property-parking hidden></div>`;
    const parking=$('[data-property-parking]',root);parking.append(composer.transformFields);if(presentation)parking.append(presentation);
    for(const btn of root.querySelectorAll('[data-section]')){btn.setAttribute('aria-pressed',String((this.section??'transform')===btn.dataset.section));btn.onclick=()=>{this.section=btn.dataset.section;this.render();};}
    const body=$('[data-property-body]',root),section=this.section??'transform';
    if(section!=='camera'){composer.cameraEdit=null;composer.drawCamera();}
    if(section==='transform'){
      body.append(composer.transformFields);composer.updateControls();return;
    }
    if(section==='presentation'){body.append(this.presentation);return;}
    if(section==='camera'){
      this.cameraEditor.mount(body,{state,composer,change:this.change,seconds:Number($('[name=seconds]',this.presentation).value)||12,preview:()=>this.preview?.()});return;
    }
    if(section==='effects'){
      body.innerHTML=layer?`<p class="form-hint">${esc(layer.name)} · Efeitos independentes da câmera.</p><div data-effects>${(layer.effects??[]).map((e,i)=>this.effectHTML(e,i)).join('')}</div><label class="field">+ Efeito<select data-new-effect><option value="">Escolher…</option>${Object.entries(EFFECT_TYPES).map(([id,label])=>option(id,label)).join('')}</select></label><button type="button" data-breath-profile>Perfil: respiração pelos pés</button>`:'Selecione uma camada para configurar efeitos.';
      if(layer){
        for(const select of body.querySelectorAll('[data-effect-anchor]'))select.onchange=()=>{const fx=layer.effects[Number(select.dataset.effectAnchor)];if(select.value==='inherit')delete fx.anchor;else fx.anchor={...ANCHORS[select.value]};this.changedLayer();};
        $('[data-new-effect]',body).onchange=e=>{if(!e.target.value||(layer.effects?.length??0)>=8)return;if(composer.layers.reduce((n,l)=>n+(l.effects?.length??0),0)>=32){composer.onError('A composição permite até 32 efeitos.');return;}layer.effects??=[];layer.effects.push(newEffect(e.target.value));this.changedLayer();};
        $('[data-breath-profile]',body).onclick=()=>{try{this.anchor(layer,ANCHORS.feet);layer.effects??=[];if(layer.effects.length<8&&composer.layers.reduce((n,l)=>n+(l.effects?.length??0),0)<32)layer.effects.push(newEffect('breath'));this.changedLayer();}catch(error){composer.onError(error.message);}};
        for(const b of body.querySelectorAll('[data-remove-effect]'))b.onclick=()=>{layer.effects.splice(Number(b.dataset.removeEffect),1);this.changedLayer();};
      }
    }
    if(section==='media'){renderBackgroundMedia(body,{state,composer,change:this.change});return;}
    if(section==='lighting'){renderLights(body,{state,change:this.change});return;}
    if(section==='direction'){const seconds=Number($('[name=seconds]',this.presentation).value)||12,hold=Number($('[name=hold]',this.presentation).value)||0;renderWindows(body,{state,composer,change:this.change,span:sceneSpan({...state,seconds,hold}),legacySpan:seconds+hold});return;}
    for(const node of body.querySelectorAll('[data-property]'))node.onchange=()=>{
      if(!node.validity.valid)return;
      const path=node.dataset.property.split('.'),value=node.type==='checkbox'?node.checked:node.type==='number'?Number(node.value):node.value;
      if(path[0]==='effect'){
        let target=layer.effects[Number(path[1])];for(const k of path.slice(2,-1))target=target[k];target[path.at(-1)]=value;this.changedLayer(false);return;
      }
      state.lighting??=lightingProfile();let target=state;for(const k of path.slice(0,-1))target=target[k];target[path.at(-1)]=value;
      this.change(state);if(path[1]==='enabled')this.render();
    };
  }
  effectHTML(e,i){
    const prefix=`effect.${i}.`;
    const attrs={breath:[['amount','Amplitude',0,.12],['vertical','Expansão vertical',0,.12]],sway:[['x','Horizontal',-.1,.1],['y','Vertical',-.1,.1]],shake:[['amount','Amplitude',0,.015],['frequency','Frequência (Hz)',.2,8]],opacity:[['from','De',0,1],['to','Até',0,1]],move:[],flicker:[['amount','Intensidade',0,.35],['frequency','Frequência (Hz)',.1,2],['opacity','Opacidade mínima',.1,1]],pulse:[['amount','Intensidade',0,.12],['opacity','Opacidade mínima',.1,1]],drift:[['amount','Intensidade',0,.12],['frequency','Velocidade',.1,2],['opacity','Opacidade',.1,1]],reveal:[['amount','Opacidade final',0,1],['opacity','Opacidade inicial',.1,1]]}[e.type];
    return `<details open><summary>${esc(EFFECT_TYPES[e.type])}</summary><p class="form-hint">Janela e fades: aba Direção.</p><label class="field">Âncora do efeito<select data-effect-anchor="${i}">${option('inherit','Herdar da camada',!e.anchor)}${Object.entries(ANCHORS).map(([key,a])=>option(key,({center:'Centro',feet:'Pés',top:'Topo',left:'Esquerda',right:'Direita'})[key],e.anchor?.x===a.x&&e.anchor?.y===a.y)).join('')}</select></label>${toggle('Ativo',prefix+'enabled',e.enabled)}${input('Atraso (s)',prefix+'start',e.start,0,60)}${input('Duração / período (s)',prefix+'duration',e.duration,.2,60,.1)}${toggle('Repetir com continuidade',prefix+'repeat',e.repeat)}${attrs.map(([k,label,min,max])=>input(label,prefix+k,e[k],min,max,.001)).join('')}${e.type==='move'?['from','to'].map(p=>`<p>${p==='from'?'De':'Até'} (posição relativa à imagem)</p>${['x','y','scale'].map(k=>input(k,prefix+p+'.'+k,e[p][k],k==='scale'?.1:-.5,k==='scale'?3:.5)).join('')}`).join(''):''}<label class="field">Suavização<select data-property="${prefix}easing">${EASINGS.map(v=>option(v,v,e.easing===v)).join('')}</select></label><button type="button" data-remove-effect="${i}">Excluir efeito</button></details>`;
  }
  anchor(layer,value){const plane=this.composer.composition?.planes.find(p=>p.entry.id===layer.id);const image=plane?.plane.querySelector('img');if(!image)throw Error('Aguarde a imagem carregar.');Object.assign(layer,changeLayerAnchor(layer,value,this.composer.composition.aspect,image.naturalWidth/image.naturalHeight));}
  changedLayer(render=true){this.composer.place();this.composer.onChange();if(render)this.render();}
}
