import {escapeHTML as esc} from './markdown.js';
import {icon} from './icons.js';
import {normalizeSearch} from './audio-search.js';

let catalog=()=>({}),current=null;
export function configureAudioPickers(getState){catalog=getState;}
export function optionDetails(option,state={}){
  const id=option.value.replace(/^(asset|playlist):/,''),asset=state.audioAssets?.find(a=>a.id===id),playlist=state.playlists?.find(p=>p.id===id);
  const group=asset?(asset.provider==='youtube'?'YouTube':'Arquivos'):playlist?'Playlists':option.parentElement?.tagName==='OPTGROUP'?option.parentElement.label:'';
  const detail=asset?[({music:'Música',ambience:'Ambiência',sfx:'Efeito'})[asset.kind],asset.tags,asset.filename].filter(Boolean).join(' · '):playlist?playlist.assetIds.length+' faixas':'';
  return {value:option.value,label:option.textContent,group,detail,disabled:option.disabled,terms:normalizeSearch(option.textContent+' '+detail+' '+group)};
}
function enhance(select){
  if(select.dataset.searchEnhanced||select.multiple)return;
  const key=select.name||select.dataset.a||select.id,media=/assetId|source|playlistId|target|ambientSource|ambienceId|cueId/i.test(key);
  if(!media&&select.options.length<9&&!select.querySelector('optgroup'))return;
  select.dataset.searchEnhanced='true';const wrapper=document.createElement('div');wrapper.className='search-picker';select.before(wrapper);wrapper.append(select);select.classList.add('search-picker-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  const trigger=document.createElement('button');trigger.type='button';trigger.className='search-picker-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');wrapper.append(trigger);
  const panel=document.createElement('div');panel.className='search-picker-panel';panel.hidden=true;panel.innerHTML='<div class="search-picker-search">'+icon('search')+'<input type="search" placeholder="Buscar por nome ou tag…" aria-label="Buscar opções" autocomplete="off"></div><div class="search-picker-tabs"></div><div class="search-picker-options" role="listbox"></div>';wrapper.append(panel);
  const input=panel.querySelector('input'),tabs=panel.querySelector('.search-picker-tabs'),list=panel.querySelector('[role=listbox]');let group='',items=[];
  const sync=()=>{items=[...select.options].map(o=>optionDetails(o,catalog()));trigger.innerHTML='<span>'+esc(select.selectedOptions[0]?.textContent||'Escolher…')+'</span>'+icon('down');trigger.disabled=select.disabled;trigger.setAttribute('aria-label',select.getAttribute('aria-label')||select.closest('.field')?.querySelector('span')?.textContent||'Escolher opção');};
  const render=()=>{
    const groups=[...new Set(items.map(i=>i.group).filter(Boolean))];tabs.innerHTML=groups.length>1?['',...groups].map(g=>`<button type="button" class="${g===group?'active':''}" data-picker-group="${esc(g)}">${esc(g||'Todos')}</button>`).join(''):'';
    const query=normalizeSearch(input.value).split(/\s+/).filter(Boolean),matches=items.filter(i=>(!group||i.group===group)&&query.every(word=>i.terms.includes(word)));
    list.innerHTML=matches.slice(0,150).map(item=>`<button type="button" role="option" aria-selected="${item.value===select.value}" data-picker-value="${esc(item.value)}" ${item.disabled?'disabled':''}><span><strong>${esc(item.label||'Nenhum')}</strong>${item.detail?`<small>${esc(item.detail)}</small>`:''}</span>${item.value===select.value?icon('check'):''}</button>`).join('')||'<p class="empty-small">Nenhuma opção encontrada.</p>';
    if(matches.length>150)list.insertAdjacentHTML('beforeend','<p class="picker-count">'+matches.length+' resultados. Digite mais para refinar a busca.</p>');
  };
  const close=(focus=false)=>{panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(current?.wrapper===wrapper)current=null;if(focus)trigger.focus();};
  const open=()=>{current?.close();sync();input.value='';group='';render();panel.hidden=false;trigger.setAttribute('aria-expanded','true');current={wrapper,close};input.focus();};
  trigger.onclick=e=>{e.preventDefault();panel.hidden?open():close();};input.oninput=render;
  panel.onclick=e=>{const filter=e.target.closest('[data-picker-group]');if(filter){e.preventDefault();group=filter.dataset.pickerGroup;render();return;}const option=e.target.closest('[data-picker-value]');if(!option)return;e.preventDefault();select.value=option.dataset.pickerValue;close(true);sync();select.dispatchEvent(new Event('change',{bubbles:true}));};
  panel.onkeydown=e=>{const buttons=[...list.querySelectorAll('button:not(:disabled)')],at=buttons.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}if(e.key==='ArrowDown'){e.preventDefault();buttons[Math.min(buttons.length-1,at+1)]?.focus();}if(e.key==='ArrowUp'){e.preventDefault();if(at<=0)input.focus();else buttons[at-1].focus();}if(e.key==='Enter'&&e.target===input){e.preventDefault();buttons[0]?.click();}};
  select.addEventListener('change',sync);select.addEventListener('invalid',e=>{e.preventDefault();open();});new MutationObserver(()=>{sync();if(!panel.hidden)render();}).observe(select,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','selected']});sync();
}
export function watchSearchSelects(root){
  const scan=()=>root.querySelectorAll('select').forEach(enhance);scan();const observer=new MutationObserver(scan);observer.observe(root,{childList:true,subtree:true});
  const outside=e=>{if(current&&!current.wrapper.contains(e.target))current.close();};document.addEventListener('pointerdown',outside);
  return ()=>{observer.disconnect();document.removeEventListener('pointerdown',outside);if(current&&root.contains(current.wrapper))current.close();};
}
