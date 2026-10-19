import {escapeHTML} from './markdown.js';
import {icon} from './icons.js';
import {watchSearchSelects} from './search-select.js';
export {configureAudioPickers} from './search-select.js';
let stopPickerWatch;
export {$, $$};
export const esc=escapeHTML;
function $(q,root=document){return root.querySelector(q);}
function $$(q,root=document){return [...root.querySelectorAll(q)];}
export function toast(message,error=false){const t=document.createElement('div');t.className='toast'+(error?' error':'');t.innerHTML=icon(error?'info':'check')+`<span>${esc(message)}</span>`;$('#toastRegion').append(t);setTimeout(()=>t.remove(),error?6500:3500);}
export function openForm({title,body,submit='Salvar',onSubmit,onReady,wide=false,footer=''}) {
  stopPickerWatch?.();
  const modal=$('#appDialog');if(modal.open)modal.close();modal.classList.toggle('wide',wide);
  $('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=body;$('#dialogError').hidden=true;
  $('#dialogFooter').innerHTML=footer||`<button type="button" class="btn subtle" data-modal-cancel>${onSubmit?'Cancelar':'Fechar'}</button>${onSubmit?`<button type="submit" class="btn primary" id="modalSubmit">${esc(submit)}</button>`:''}`;
  $('[data-modal-cancel]')?.addEventListener('click',()=>modal.close());$('#closeDialog').onclick=()=>modal.close();
  $('#modalForm').onsubmit=async e=>{
    e.preventDefault();if(!onSubmit)return;
    const button=$('#modalSubmit');if(button)button.disabled=true;
    try{const next=await onSubmit(new FormData(e.currentTarget),e.currentTarget);if(next!==false){modal.close();if(typeof next==='function')next();}}
    catch(error){$('#dialogError').textContent=error.message;$('#dialogError').hidden=false;}
    finally{if(button)button.disabled=false;}
  };
  modal.showModal();onReady?.($('#dialogBody'));stopPickerWatch=watchSearchSelects($('#dialogBody'));modal.onclose=()=>{if(!modal.open)stopPickerWatch?.();};
}
export function confirmAction(title,message,action,submit='Excluir') {openForm({title,body:`<p class="dialog-description">${esc(message)}</p>`,submit,onSubmit:action});}
export function field(label,name,value='',attrs=''){return `<label class="field"><span>${esc(label)}</span><input name="${esc(name)}" value="${esc(value)}" ${attrs}></label>`;}
export function option(value,label,selected=false){return `<option value="${esc(value)}" ${selected?'selected':''}>${esc(label)}</option>`;}
export function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function secondsInput(value){return Math.max(0,Number(value)||0);}
