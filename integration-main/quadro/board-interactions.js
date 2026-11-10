// Player permissions for the existing native inspector; no substitute dialogs.
export const PLAYER_FIELDS=Object.freeze({cifra:['shift'],telegrafo:['vel'],cronometro:['minutos'],ampulheta:['minutos'],caneta:['tampa'],cigarro:['aceso'],luapapel:['fase']});
export const PLAYER_BUTTONS=Object.freeze({
 gravador:['rew','ej'],musica:['tirarRolo'],tv:['off'],bloco:['lim'],saco:['all'],baralho:['div','emb','rec'],tvvhs:['ej','rw'],discman:['ej'],
 caldeirao:['esv','tdevolve','tlimpa'],ampola:['tdevolve','tlimpa'],pocao:['tdevolve','tlimpa'],xicara:['tdevolve','tlimpa'],ectoplasma:['tdevolve','tlimpa'],
 taro:['emb','rec','tres'],cranio:['ouvir'],ossinhos:['rec'],radioemerg:['off'],calendario:['lim'],espelhovamp:['eclear'],balanca_anubis:['vazio']
});
const commonIds=new Set(['pFront','pBack','pAttach','pDetach','cOpen','cClose','sBrush']);
const personalIds=new Set(['pText','pStyle','pFont','pSize','pColor','pFita','pStroke','pRedraw','pTape','pSize2','pRopeC','pRopeS']);
export function playerControlAllowed(item,control,own=false){
 if(!item)return false;
 const {id='',co,cb,o,pt}=control;
 if(pt!==undefined)return pt==='item';
 if(co!==undefined)return !!PLAYER_FIELDS[item.kind]?.includes(co);
 if(cb!==undefined)return !!PLAYER_BUTTONS[item.kind]?.includes(cb);
 if(o!==undefined)return item.type==='img'&&o==='legenda'&&!item.flipped;
 if(id==='pDel')return own;
 if(commonIds.has(id))return true;
 return own&&!item.crisEvidence&&personalIds.has(id);
}
export function restrictNativeInspector(panel,item,own){
 if(!panel||!item)return;
 panel.classList.add('cris-player-inspector');
 const pane=panel.querySelector('.pp-pane[data-p=item]');
 // Preserve original nodes and their event handlers, including photo captions
 // which the native inspector groups in the appearance tab.
 for(const el of panel.querySelectorAll('.pp-pane:not([data-p=item]) input,.pp-pane:not([data-p=item]) textarea,.pp-pane:not([data-p=item]) select,.pp-pane:not([data-p=item]) button')){
  if(pane&&playerControlAllowed(item,{id:el.id,co:el.dataset.co,cb:el.dataset.cb,o:el.dataset.o},own))pane.append(el.closest('.row,label.chk')||el);
 }
 panel.querySelectorAll('.pp-pane[data-p=gm],.pp-pane[data-p=fx],.pp-tabs [data-pt]:not([data-pt=item]),.qolrow,.cris-clue-config,.cris-evidence-config,.clist,.filters').forEach(el=>el.remove());
 if(pane)pane.hidden=false;
 panel.querySelector('[data-pt=item]')?.classList.add('on');
 for(const el of panel.querySelectorAll('input,textarea,select,button,[contenteditable]')){
  if(el.matches('.pp-x,.pp-head .pp-b:not([id])'))continue;
  if(playerControlAllowed(item,{id:el.id,co:el.dataset.co,cb:el.dataset.cb,o:el.dataset.o,pt:el.dataset.pt},own))continue;
  (el.closest('.row,label.chk')||el).remove();
 }
 for(const el of [...panel.querySelectorAll('.row,.row2,.pp-duo,.btns,.att,.fixrow,.psec,.lbl,.hint')].reverse()){
  if(el.matches('.pp-hint')||el.closest('.pp-head')||(el.matches('.lbl')&&el.closest('.row')?.querySelector('input,textarea,select')))continue;
  if(!el.querySelector('input,textarea,select,button,[contenteditable]'))el.remove();
 }
}
