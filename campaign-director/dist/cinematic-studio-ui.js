import {$,esc} from './ui.js';
import {icon} from './icons.js';
import {windowRange,sceneSpan} from './cinematic-timing.js?v=directorcinematic01';
import {EFFECT_TYPES,validEffect} from './cinematic-direction-model.js?v=directorcinematic01';
const lockIcon='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0v4"/></svg>';

export const ownsStudio=(root,instance)=>root?.dataset.studioInstance===instance;
export function releaseStudio(root,dialog,instance){if(!ownsStudio(root,instance))return false;root.classList.remove('cinematic-studio');delete root.dataset.studioInstance;dialog.classList.remove('cinematic-studio-dialog');return true;}

export function numericInvalid(root){return [...root.querySelectorAll('input[type=number]')].some(n=>!n.disabled&&!n.validity.valid);}
export function editEffect(effect,path,value){const copy=structuredClone(effect),keys=path.split('.');let target=copy;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)]=value;if(!validEffect(copy))throw Error('Confira os limites do efeito. O último valor válido foi preservado.');return copy;}
const focusKeys=['name','data-property','data-camera-field','data-direction-value','data-window-field','data-window-mode','data-window-enable','data-layer-name','data-layer-x','data-layer-y','data-layer-scale','data-layer-rotation','data-layer-opacity','data-anchor-x','data-anchor-y','data-section'];
export function captureContext(root){
  const active=root.ownerDocument.activeElement,key=focusKeys.find(k=>active?.hasAttribute?.(k));
  return {focus:key?{key,value:active.getAttribute(key),start:active.selectionStart,end:active.selectionEnd}:null,scroll:root.scrollTop,pane:root.querySelector('[data-property-body]')?.scrollTop,open:[...root.querySelectorAll('details')].map(n=>({label:n.dataset.windowLabel??n.dataset.studioDetail??n.querySelector('summary')?.textContent,open:n.open}))};
}
export function restoreContext(root,state,{focus=true}={}){
  if(!state)return;for(const d of root.querySelectorAll('details')){const old=state.open.find(o=>o.label===(d.dataset.windowLabel??d.dataset.studioDetail??d.querySelector('summary')?.textContent));if(old)d.open=old.open;}
  root.scrollTop=state.scroll;if(root.querySelector('[data-property-body]'))root.querySelector('[data-property-body]').scrollTop=state.pane??0;
  const f=state.focus;if(!focus||!f)return;const node=[...root.querySelectorAll('['+f.key+']')].find(n=>n.getAttribute(f.key)===f.value);
  if(node&&!node.disabled){node.focus({preventScroll:true});if(typeof f.start==='number')try{node.setSelectionRange(f.start,f.end);}catch{}}
}
export function temporalTracks(item){
  const tracks=[],add=(label,target,kind,inspectLabel=label)=>{if(target)tracks.push({label,kind,inspectLabel,window:target.window});};
  add('Movimento da câmera',item.camera,'camera');add('Instabilidade global',item.camera?.instability,'camera');add('Iluminação ambiente',item.lighting,'light');
  for(const [i,s] of (item.lighting?.spots??[]).entries())add('Luz '+(i+1),s,'light');add('Fundo vivo (vídeo)',item.backgroundVideo,'media');
  for(const l of item.layers??[]){add('Visibilidade · '+l.name,l,'visibility');for(const fx of l.effects??[])add(l.name+' · '+(EFFECT_TYPES[fx.type]??fx.type),fx,'effect',l.name+' · '+fx.type);if(l.video)add(l.name+' · vídeo',l.video,'media');}
  return tracks;
}
export function renderTemporalDock(root,item,{seek,inspect}){
  const span=sceneSpan(item);root.innerHTML=temporalTracks(item).map(t=>{const r=windowRange(t.window,span),label=`${t.label}: ${r.start.toFixed(1)}–${r.end.toFixed(1)} s`;
    return `<div class="studio-track" data-kind="${t.kind}"><button type="button" data-inspect="${esc(t.inspectLabel)}" title="Editar intervalo">${esc(t.label)}</button><button type="button" data-time="${r.start}" aria-label="Prévia em ${r.start} segundos: ${esc(t.label)}" title="${esc(label)}"><span style="left:${r.start/span*100}%;width:${Math.max(0,r.end-r.start)/span*100}%"></span><i></i></button><small>${r.start.toFixed(1)}–${r.end.toFixed(1)} s</small></div>`;}).join('')||'<p class="studio-empty">Adicione uma camada ou ative a câmera para visualizar seus intervalos.</p>';
  for(const n of root.querySelectorAll('[data-time]'))n.onclick=()=>seek(Number(n.dataset.time));for(const n of root.querySelectorAll('[data-inspect]'))n.onclick=()=>inspect(n.dataset.inspect);
}
export function layerRows(root,composer){
  const old=captureContext(root),focus=root.ownerDocument.activeElement,action=focus?.dataset.rowAction,id=focus?.closest('[data-layer-row]')?.dataset.layerRow;
  root.innerHTML=composer.layers.map((l,i)=>`<div class="studio-layer-row" data-layer-row="${l.id}" data-selected="${l.id===composer.selected}" data-hidden="${!l.visible}"><button type="button" data-layer-select="${l.id}" title="${esc(l.name)}" aria-pressed="${l.id===composer.selected}"><span class="studio-layer-number">${String(i+1).padStart(2,'0')}</span><span><strong>${esc(l.name)}</strong><small>${l.video?'WebM + imagem':l.effects?.length?'Imagem · '+l.effects.length+' FX':'Imagem'}${composer.solo===l.id?' · SOLO':''}</small></span></button><button type="button" data-row-action="visible" aria-label="${l.visible?'Ocultar':'Mostrar'} ${esc(l.name)}" aria-pressed="${l.visible}" title="${l.visible?'Ocultar':'Mostrar'}">${icon('eye')}</button><button type="button" data-row-action="lock" aria-label="${l.locked?'Desbloquear':'Bloquear'} ${esc(l.name)}" aria-pressed="${!!l.locked}" title="${l.locked?'Desbloquear':'Bloquear'}">${lockIcon}</button></div>`).join('')||'<p class="studio-empty">Seu fundo está pronto?<br>Adicione uma imagem ou um overlay para compor a cena.</p>';
  for(const n of root.querySelectorAll('[data-layer-select]')){n.onclick=()=>{if(composer.beforeSelect?.()===false)return;composer.selected=n.dataset.layerSelect;composer.list();composer.updateControls();composer.onSelect();if(root.ownerDocument.defaultView.matchMedia('(max-width:900px)').matches){composer.root.dataset.pane='properties';composer.root.querySelector('[data-property-body] input:not([disabled]),[data-property-body] select')?.focus({preventScroll:true});}else root.querySelector('[data-layer-select="'+composer.selected+'"]')?.focus({preventScroll:true});};n.onkeydown=e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const buttons=[...root.querySelectorAll('[data-layer-select]')],at=buttons.indexOf(n),next=buttons[Math.max(0,Math.min(buttons.length-1,at+(e.key==='ArrowDown'?1:-1)))];next.click();root.querySelector('[data-layer-select="'+next.dataset.layerSelect+'"]').focus();};}
  for(const n of root.querySelectorAll('[data-row-action]'))n.onclick=()=>{const row=n.closest('[data-layer-row]'),l=composer.layers.find(l=>l.id===row.dataset.layerRow);if(n.dataset.rowAction==='lock')l.locked=!l.locked;else l.visible=!l.visible;composer.applyVisibility();composer.list();composer.updateControls();composer.onChange();};
  restoreContext(root,old,{focus:false});if(id&&action)root.querySelector('[data-layer-row="'+id+'"] [data-row-action="'+action+'"]')?.focus({preventScroll:true});
}
export function confirmStudio(root,message,action){
  const holder=$('[data-studio-confirm]',root);holder.hidden=false;holder.innerHTML=`<p>${esc(message)}</p><button type="button" data-studio-confirm-no>Voltar</button><button type="button" class="studio-danger" data-studio-confirm-yes>Confirmar</button>`;
  const focus=root.ownerDocument.activeElement;const close=()=>{holder.hidden=true;holder.replaceChildren();focus?.isConnected&&focus.focus({preventScroll:true});};
  $('[data-studio-confirm-no]',holder).onclick=close;$('[data-studio-confirm-yes]',holder).onclick=()=>{close();action();};$('[data-studio-confirm-no]',holder).focus();
}
export function arrangeStudio(root,dialog){
  const heading=document.createElement('div');heading.className='studio-heading';heading.innerHTML='<div class="studio-identity"></div><div class="studio-primary"></div>';
  const title=$('[name=title]',root).closest('label'),selected=$('[name=selected]',root).closest('label');heading.firstElementChild.append(selected,title);
  const actions=$('.cinematic-actions',root);heading.lastElementChild.append(actions);root.prepend(heading);
  for(const [attr,label,sign] of [['undo','Desfazer','↶'],['redo','Refazer','↷']]){const b=$('[data-'+attr+']',root);b.textContent=sign;b.setAttribute('aria-label',label);b.title=label+' (Ctrl+'+(attr==='undo'?'Z':'Y')+')';}
  const more=document.createElement('details');more.className='studio-more';more.innerHTML='<summary aria-label="Opções da apresentação" title="Opções da apresentação">•••</summary><div></div>';more.lastElementChild.append($('[data-duplicate]',root));actions.append(more);for(const p of root.querySelectorAll(':scope > p.form-hint:not(.cinematic-draft)'))more.lastElementChild.append(p);
  actions.append($('#modalSubmit',dialog));$('#modalSubmit',dialog).textContent='Salvar';
  const confirm=document.createElement('div');confirm.dataset.studioConfirm='';confirm.className='studio-confirm';confirm.hidden=true;confirm.setAttribute('role','alert');heading.after(confirm);
  $('.cinematic-draft',root).classList.add('studio-save-state');heading.append($('.cinematic-draft',root));
  const stage=document.createElement('div');stage.className='cinematic-stage';const canvas=$('.cinematic-composer-canvas',root);canvas.before(stage);stage.append(canvas,$('.cinematic-studio-preview',root));
  const footer=document.createElement('div');footer.className='studio-direction-dock';footer.append($('.cinematic-transport',root));footer.insertAdjacentHTML('beforeend','<details class="studio-timeline"><summary>Intervalos da cena <span data-track-duration></span></summary><div data-studio-tracks></div></details>');
  // Moving live controls, rather than copying markup, keeps their existing actions.
  $('.cinematic-layers-editor',root).append(footer);
  root.querySelector('[data-studio-time]').setAttribute('aria-live','off');
}
