// Room preferences are scoped to the signed-in account; they never grant campaign access.
const key=value=>typeof value==='string'&&/^[\w-]{1,128}$/.test(value);
export function parseRoomInvite(input,{campaignId,origin=globalThis.location?.origin}={}){
 const text=String(input||'').trim();let room,campaign=campaignId,explicitCampaign=false;
 if(/^https?:\/\//i.test(text)){
  const url=new URL(text);if(url.origin!==origin||!url.pathname.endsWith('/quadro/'))throw Error('Use um link de mesa deste CRIS.');
  explicitCampaign=url.searchParams.has('campanha');room=url.searchParams.get('sala');campaign=url.searchParams.get('campanha')||campaign;
 }else room=text.replace(/[\s-]/g,'');
 if(!/^[a-zA-Z0-9]{6,32}$/.test(room||'')||!key(campaign))throw Error('Informe o código da sala ou o link completo enviado pelo mestre.');
 return {room:room.toUpperCase(),campaignId:campaign,...(explicitCampaign?{explicitCampaign:true}:{})};
}
export class RoomBinding{
 constructor({storage,userId,campaignId,origin}){Object.assign(this,{storage,userId,campaignId,origin});this.key='cris:live:binding:'+userId;}
 read(){try{const value=JSON.parse(this.storage.getItem(this.key));return {...parseRoomInvite(value.room,{campaignId:value.campaignId,origin:this.origin}),explicitCampaign:true};}catch{return null;}}
 save(value){const valid=parseRoomInvite(value.room,{campaignId:value.campaignId,origin:this.origin});this.storage.setItem(this.key,JSON.stringify(valid));return valid;}
 invite(search){const params=new URLSearchParams(search);if(!params.has('sala'))return null;return {...parseRoomInvite(params.get('sala'),{campaignId:params.get('campanha')||this.campaignId,origin:this.origin}),explicitCampaign:params.has('campanha')};}
}
export async function prepareRoomEntry({identity,bridge,storage=localStorage,location=globalThis.location}){
 if(bridge.archiveId)return null;
 const binding=new RoomBinding({storage,userId:identity.userId,campaignId:bridge.campaignId,origin:location.origin});
 let current,error;try{current=binding.invite(location.search)||(!identity.isMaster?binding.read():null);
 if(current){current.explicitInvite=new URLSearchParams(location.search).has('sala');const campaign=await bridge.resolveLiveCampaign?.(current);if(campaign)current={...current,campaignId:campaign.id,title:campaign.title};if(bridge.selectCampaign)await bridge.selectCampaign(current.campaignId);}}catch(cause){error=cause.message;current=null;}
 const accept=async input=>{
  let value=parseRoomInvite(input,{campaignId:current?.campaignId||bridge.campaignId,origin:location.origin});
  const campaign=await bridge.resolveLiveCampaign?.(value);if(campaign)value={...value,campaignId:campaign.id,title:campaign.title};
  binding.save(value);return value;
 };
 const navigate=value=>{
  const url=new URL(location.href);url.searchParams.set('sala',value.room);url.searchParams.set('campanha',value.campaignId);url.searchParams.delete('board');
  // In-app navigation works in standalone PWA; nobody needs an address bar.
  try{sessionStorage.setItem('cris:live:joinNext:'+identity.userId,JSON.stringify(value));}catch{}
  location.assign(url.href);
 };
 const change=()=>{
  if(document.querySelector('#crisRoomDialog'))return;
  const dialog=document.createElement('dialog');dialog.id='crisRoomDialog';dialog.className='cris-board-dialog';
  dialog.innerHTML='<form><h2>Entrar em outra mesa</h2><p>Cole o link do mestre ou informe o código da sala.</p><label>Link ou código<input name="room" aria-label="Link ou código da mesa" required autocomplete="off" maxlength="2048"></label><p role="status"></p><div class="cris-board-choices"><button type="submit">Entrar nesta mesa</button><button type="button" data-cancel>Cancelar</button></div></form>';
  dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
  dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const button=dialog.querySelector('[type=submit]');button.disabled=true;try{navigate(await accept(dialog.querySelector('input').value));}catch(error){dialog.querySelector('[role=status]').textContent=error.message;button.disabled=false;}};
  document.body.append(dialog);dialog.showModal();dialog.querySelector('input').focus();
 };
 let campaignTitle=current?.title;try{campaignTitle||=(await bridge.currentCampaign?.())?.title;}catch{}
 return {binding,current,error,accept,navigate,change,campaignTitle};
}
