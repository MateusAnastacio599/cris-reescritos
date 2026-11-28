import {cinematicImages,imageKey} from './cinematic-media.js?v=directorcinematic02';
export const mediaFileName=blob=>typeof blob?.name==='string'?blob.name.split(/[\\/]/).at(-1).replace(/[\x00-\x1f]/g,'').slice(0,200):'';
export function cinematicFileStatus(id,blob,{local=false,cloud={}}={}){
 const file=cloud.binding?.media?.cinematics?.[id],owner=cloud.owner&&cloud.owner===cloud.binding?.ownerId;
 const confirmed=owner&&file&&file.bucket==='cris-images'&&file.path===`${cloud.binding.campaignId}/director-private/${cloud.owner}/${id}`&&file.sha256===id?.split('-').at(-1)&&file.bytes===blob?.size&&file.type===blob?.type;
 return {local:local?'Salvo localmente · Pronto neste dispositivo':'Arquivo validado · Alterações não salvas',cloud:confirmed?'Salvo na nuvem · revisão '+cloud.binding.revision:cloud.status==='saving'?'Sincronizando sessão · arquivo sem confirmação':['offline','error'].includes(cloud.status)?'Falha de sincronização da sessão · arquivo sem confirmação':cloud.status==='review'?'Conflito de versões · arquivo sem confirmação':'Sincronização pendente · arquivo sem confirmação'};
}
export class StudioMediaCards{
 constructor({images=cinematicImages,cloud=()=>({}),report=()=>{}}={}){Object.assign(this,{images,cloud,report});this.cards=new Set();this.timer=setInterval(()=>this.refresh(),1000);}
 mount(input,{resolve,remove}){
  const view=document.createElement('section');view.className='studio-file-card';view.setAttribute('aria-label','Arquivo anexado');input.before(view);
  const card={input,view,resolve,remove,version:0};this.cards.add(card);const handler=input.onchange;
  input.onchange=async e=>{card.busy=true;card.signature=null;view.textContent='Arquivo selecionado · Validando…';try{await handler?.(e);}finally{card.busy=false;card.checked=null;void this.draw(card);}};
  void this.draw(card);return card;
 }
 refresh(){for(const card of this.cards){if(!card.view.isConnected){this.dispose(card);continue;}if(!card.busy)void this.draw(card);}}
 async draw(card){
  const version=++card.version;
  try{
   const {id,blob:provided}=await card.resolve();if(card.id!==id)card.blob=null;card.id=id;const blob=id?(provided||card.blob||await this.images.get(id)):null;card.blob=blob;if(version!==card.version||card.busy)return;
   const key=id+':'+(blob?.size||0);if(card.checked!==key){card.checked=key;card.local=false;card.valid=false;if(blob){card.valid=await imageKey(blob)===id;const saved=await this.images.get(id);card.local=!!saved&&await imageKey(saved)===id;}}
   if(version!==card.version||card.busy)return;
   const signature=JSON.stringify([id,card.valid,card.local,this.cloud().status,this.cloud().binding?.revision,mediaFileName(blob),this.cloud().owner]);if(card.signature===signature)return;card.signature=signature;
   if(card.url)URL.revokeObjectURL(card.url);card.url=null;card.view.replaceChildren();card.input.hidden=!!id;
   if(!id){card.view.textContent='Nenhum arquivo associado.';return;}
   const knownName=mediaFileName(blob)||(this.cloud().owner===this.cloud().binding?.ownerId?mediaFileName({name:this.cloud().binding?.media?.cinematics?.[id]?.name}):'');
   const name=document.createElement('strong');name.textContent=knownName||'Arquivo sem nome original · '+id.slice(0,20);card.view.append(name);
   if(blob){const meta=document.createElement('small');meta.textContent=blob.type+' · '+(blob.size/1024).toFixed(1)+' KiB';card.view.append(meta);}
   if(card.valid&&blob.type.startsWith('image/')){const img=document.createElement('img');card.url=URL.createObjectURL(blob);img.src=card.url;img.alt='Miniatura do arquivo';card.view.append(img);}
   const state=document.createElement('small');state.setAttribute('role','status');state.textContent=!blob?'Arquivo indisponível neste dispositivo':!card.valid?'Erro real · integridade do arquivo inválida':Object.values(cinematicFileStatus(id,blob,{local:card.local,cloud:this.cloud()})).join(' · ');card.view.append(state);
   for(const [label,action]of [['Substituir',()=>card.input.click()],['Remover',card.remove]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',label);b.onclick=e=>{e.preventDefault();e.stopPropagation();action();};card.view.append(b);}
  }catch(error){if(version===card.version){card.view.textContent='Arquivo indisponível · '+error.message;this.report(error.message);}}
 }
 invalidate(){for(const card of this.cards){card.checked=null;card.signature=null;card.blob=null;}this.refresh();}
 dispose(card){card.version++;card.blob=null;if(card.url)URL.revokeObjectURL(card.url);this.cards.delete(card);}
 close(){clearInterval(this.timer);for(const card of this.cards)this.dispose(card);}
}
