// One composition for existing room controls. No networking or campaign writes here.
export const connectionView=({role='client',links=[],pending=0,peerOpen=false,error=null,everReady=false,stopped=false}={})=>{
 const usable=links.filter(c=>c.open&&!c._closed&&!['disconnected','failed','closed'].includes(c.peerConnection?.iceConnectionState));
 const online=usable.filter(c=>c._syncReady&&!['disconnected','failed','closed'].includes(c.peerConnection?.iceConnectionState));
 if(stopped)return {state:'idle',text:'Mesa fechada'};
 if(online.length)return {state:'synced',text:role==='host'?`${online.length} ${online.length===1?'jogador sincronizado':'jogadores sincronizados'}`:'Sincronizado'};
 if(usable.length)return {state:'loading',text:'Conectado · carregando quadro'};
 if(error&&['unavailable-id','scope-rejected','duplicate-tab','module-unavailable'].includes(error))return {state:'failed',text:'A conexão precisa de atenção'};
 if(role==='host'&&peerOpen&&!pending)return {state:'waiting',text:'Mesa aberta · aguardando jogadores'};
 return {state:everReady?'reconnecting':'connecting',text:everReady?'Reconectando':'Conectando à mesa'};
};
const $=s=>document.querySelector(s);
const element=(tag,text,className)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;};
export function mountRoomUI({role,entry,name,room,title,callbacks={}}){
 let panel,join,status,detail,participants,lastView,notice='',remote=[];
 const menu=$('#crisBoardMenu');
 const copy=async(value,label)=>{if(!value)return;try{await navigator.clipboard.writeText(value);callbacks.toast?.(label+' copiado');}catch{const field=element('input');field.value=value;panel.append(field);field.select();document.execCommand('copy');field.remove();callbacks.toast?.(label+' copiado');}};
 const button=(id,text,fn)=>{const b=element('button',text,'b');b.type='button';b.id=id;b.onclick=fn;return b;};
 const section=element('section',null,'cris-room-info');
 const campaign=element('strong',title||'Mesa da campanha'),code=element('small',room?'Sala '+room:'Escolha a mesa do mestre');section.append(campaign,code);if(role==='host')code.hidden=true;
 status=role==='client'&&$('#boardSyncStatus')||element('p',role==='host'?'Mesa fechada':'Escolha uma mesa','cris-room-status');status.classList.add('cris-room-status');status.setAttribute('role','status');section.append(status);
 detail=element('p','','cris-room-detail');section.append(detail);
 const openEntry=()=>{if(join?.isConnected){$('#vwRoom').focus();return;}entry.change();};
 if(role==='client'){
  section.append(button('vwRetry','Reconectar',()=>callbacks.connect?.()),button('vwChange','Trocar mesa',openEntry));
  menu?.prepend(section);
  const indicator=element('span',null,'cris-room-dot');indicator.setAttribute('aria-hidden','true');$('.cris-menu-toggle')?.append(indicator);
 }else{
  panel=element('section',null,'panel cris-room-panel');panel.id='sharePanel';panel.setAttribute('aria-label','Mesa compartilhada');
  const heading=element('header',null,'cris-room-heading');heading.append(element('h2','Mesa compartilhada'),button('shX','×',()=>panel.classList.remove('show')));heading.lastChild.setAttribute('aria-label','Fechar mesa compartilhada');
  panel.append(heading,section);
  const invite=element('div',null,'cris-room-invite');invite.append(element('small','Código da mesa'));
  const row=element('div',null,'cris-room-code-row'),codeButton=button('shCodeCp','Copiar código',()=>copy(callbacks.room?.(),'Código'));
  const codeText=element('output','—');codeText.id='shCodeB';row.append(codeText,codeButton);invite.append(row,button('shCopy','Copiar convite',()=>copy(callbacks.invite?.(),'Convite')));panel.append(invite);
  participants=element('div',null,'cris-room-participants');participants.id='shN';participants.setAttribute('aria-label','Participantes');panel.append(participants);
  panel.append(button('shCam','Chamar todos para minha visão',()=>callbacks.call?.()));
  const actions=element('div',null,'cris-room-actions');actions.append(button('shOpen','Abrir mesa',()=>callbacks.open?.()),button('shStop','Encerrar mesa',()=>callbacks.stop?.()));panel.append(actions);
  const advanced=element('details',null,'cris-room-advanced');advanced.append(element('summary','Configurações da mesa'));
  const limit=element('label','Limite de jogadores'),select=element('select');select.id='shMax';for(const n of [0,1,2,3,4,5,6,8,10,12]){const option=element('option',n?String(n):'Sem limite');option.value=n;select.append(option);}select.value=String(callbacks.limit?.()||0);select.onchange=()=>callbacks.setLimit?.(+select.value);limit.append(select);advanced.append(limit);
  advanced.append(button('shObsB','Copiar link do OBS',()=>copy(callbacks.obs?.(),'Link do OBS')),button('shNew','Gerar outro código',()=>callbacks.open?.(true)),button('shLegacy','Usar código antigo · CASO26107',()=>callbacks.legacy?.()),button('shJoin','Entrar em outra mesa',openEntry));
  const diagnostics=element('details');diagnostics.append(element('summary','Diagnóstico avançado'));const pre=element('pre');pre.id='shDiagnostics';diagnostics.append(pre);diagnostics.ontoggle=()=>{if(diagnostics.open)pre.textContent=JSON.stringify(callbacks.diagnostics?.(),null,2);};advanced.append(diagnostics);panel.append(advanced);document.body.append(panel);
 }
 function renderParticipants(){
  if(!participants)return;participants.replaceChildren(element('h3','Participantes'));
  const peers=callbacks.participants?.()||[];
  if(!peers.length)participants.append(element('p','Nenhum jogador na mesa','cris-room-empty'));
  peers.forEach(p=>{
   const row=element('div',null,'cris-room-person'),info=element('div');info.append(element('strong',p.name||'Jogador'),element('small',p.legacy?'Conectado · cliente antigo':p.online?'Sincronizado':p.reconnecting?'Reconectando':'Carregando quadro'));
   const presentation=remote.find(r=>r.id===p.id);if(presentation&&presentation.status!=='conectado')info.append(element('small',presentation.label||presentation.status),...(presentation.error?[element('small',presentation.error,'cris-room-error')]:[]));
   row.append(info,button('', 'Remover',()=>callbacks.kick?.(p.id)));row.lastChild.setAttribute('aria-label','Remover '+(p.name||'jogador'));participants.append(row);
  });
  if(window.CRIS_REMOTE_CINEMATICS?.active?.canProceed)participants.append(button('cinematicProceed','Prosseguir com os prontos',()=>window.CRIS_REMOTE_CINEMATICS.proceed()));
  if(notice)participants.append(element('p',notice,'cris-room-error'));
 }
 function render(view,message=''){
  lastView=view;status.textContent=view.text;status.dataset.state=view.state;detail.textContent=message;detail.hidden=!message;
  const toggle=$('.cris-menu-toggle');if(role==='client'&&toggle){toggle.dataset.roomState=view.state;toggle.title=(title||'Mesa')+' · '+view.text;}
  $('#vwRetry')?.toggleAttribute('hidden',!['failed','reconnecting'].includes(view.state));
  if(panel){const current=callbacks.room?.();$('#shCodeB').textContent=current||'—';$('#shCodeCp').disabled=$('#shCopy').disabled=!current;$('#shStop').disabled=view.state==='idle';$('#shCam').disabled=view.state!=='synced';$('#shOpen').hidden=view.state!=='idle'&&view.state!=='failed';renderParticipants();}
 }
 function showEntry(error=''){
  if(join?.isConnected)return;join=element('div',null,'cris-room-entry');join.id='vwJoin';
  const card=element('form',null,'card');card.append(element('small','CRIS · quadro investigativo','cris-room-eyebrow'),element('h1','Entrar na mesa'),element('p',title||'Use o convite enviado pelo mestre.','cris-room-campaign'));
  const label=element('label','Link ou código da mesa'),input=element('input');input.id='vwRoom';input.name='room';input.maxLength=2048;input.autocomplete='off';input.setAttribute('aria-label','Link ou código da mesa');label.append(input);card.append(label);
  if(entry.current?.explicitInvite)input.value=entry.current.room;
  const go=button('vwGo','Entrar na mesa',()=>card.requestSubmit());go.type='submit';go.onclick=null;card.append(go);
  const remembered=entry.current||entry.binding?.read();if(remembered){const b=button('vwLast','Voltar à última mesa · '+remembered.room,()=>{input.value=remembered.room;card.requestSubmit();});b.className='cris-room-last';card.append(b);}
  const details=element('details');details.append(element('summary','Nome e cor do cursor'));const who=element('input');who.id='vwName';who.maxLength=40;who.value=name;who.setAttribute('aria-label','Seu nome ou personagem');details.append(who);const colors=element('div');colors.id='vwCores';for(const color of ['#e8b04a','#4ac2e8','#e84a7f','#7fe84a','#b04ae8','#e8734a','#3fd6b0','#f2f2f2']){const b=button('', '',()=>{callbacks.setColor?.(color);for(const c of colors.children)c.classList.toggle('on',c===b);});b.style.setProperty('--c',color);b.setAttribute('aria-label','Cor do cursor '+color);b.classList.toggle('on',callbacks.color?.()===color);colors.append(b);}details.append(colors);card.append(details);
  const st=element('p',error||entry.error||'','st');st.id='vwSt';st.setAttribute('role','status');card.append(st);card.onsubmit=async event=>{event.preventDefault();go.disabled=true;try{await callbacks.join(input.value,who.value);join.remove();}catch(error){st.textContent=error.message;go.disabled=false;}};
  join.append(card);document.body.append(join);return join;
 }
 return {panel,showEntry,render,navigationHelp(){if(role!=='client'||!matchMedia('(pointer:coarse),(max-width:600px)').matches)return;try{const key='cris:board:gestures:v1';if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'shown');}catch{}callbacks.toast?.('Arraste o fundo para mover. Use dois dedos para aproximar ou afastar. Toque nos objetos para interagir.');},coordination(){renderParticipants();},show(){panel?.classList.add('show');},remote(value){remote=value;renderParticipants();},notice(value){notice=value;renderParticipants();},get view(){return lastView;}};
}
