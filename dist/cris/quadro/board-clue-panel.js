// Names are metadata on the existing item: IDs and clue cues stay stable.
export function setClueMetadata(item,{name,enabled}){
 item.crisClueName=String(name||'').trim().slice(0,100);item.crisClue=!!enabled;return item;
}
export function mountCluePanel({panel,item,onChange}){
 panel.querySelector('.cris-clue-config')?.remove();
 const box=document.createElement('section');box.className='cris-clue-config';
 box.innerHTML='<h3>Pista do roteiro</h3><label>Nome para identificar no roteiro<input type="text" maxlength="100" placeholder="Ex.: Desenho molhado · verso" aria-label="Nome da pista no roteiro"></label><label><input type="checkbox"> Mostrar na lista de pistas do roteiro</label><small>O nome não altera o conteúdo do documento. Use “Escondido dos jogadores” abaixo para preparar a revelação.</small><small>Código: <code></code></small><button type="button">Copiar código</button>';
 const name=box.querySelector('input[type=text]'),enabled=box.querySelector('input[type=checkbox]');
 name.value=item.crisClueName||'';enabled.checked=!!(item.crisClue??item.crisClueName);box.querySelector('code').textContent=item.id;
 const save=()=>{setClueMetadata(item,{name:name.value,enabled:enabled.checked});onChange();};
 name.oninput=()=>{if(name.value.trim())enabled.checked=true;save();};enabled.onchange=save;
 box.querySelector('button').onclick=async e=>{try{await navigator.clipboard.writeText(item.id);e.currentTarget.textContent='Código copiado';}catch{e.currentTarget.textContent='Selecione o código acima para copiar';}};
 box.addEventListener('keydown',e=>e.stopPropagation());panel.prepend(box);
}
