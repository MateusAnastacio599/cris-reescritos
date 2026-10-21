import {getCloudClient} from './cloud-account.js';
const itemKinds={img:'Imagem',note:'Nota',mark:'Marcação',cont:'Objeto',scr:'Raspadinha',tape:'Fita',pin:'Alfinete'};
const objectKinds={envelope:'Envelope',livro:'Livro',mapa:'Mapa',caixa:'Caixa',madeira:'Caixote',maleta:'Maleta',cadeado:'Cadeado',vela:'Vela',ativador:'Ativador',paredetijolos:'Parede de tijolos',papiro:'Papiro',ficha:'Ficha',nota:'Nota'};
export function clueCatalog(items=[]){return items.filter(i=>i&&typeof i.id==='string'&&!i.hand&&i.kind!=='ativador').map(i=>({id:i.id,title:String(i.crisClueName||i.name||i.title||i.label||i.opts?.legenda||i.opts?.titulo||i.text||objectKinds[i.kind]||itemKinds[i.type]||i.kind||i.type||'Pista').replace(/<[^>]*>/g,'').split('\n')[0].slice(0,100),hidden:!!i.gm,type:itemKinds[i.type]||i.type||'item',named:!!i.crisClue}));}
export class BoardLink{
 constructor({campaign,client=getCloudClient}={}){this.campaign=campaign;this.client=client;this.items=[];}
 async refresh(){this.items=[];const campaign=this.campaign();if(!campaign)throw Error('Aguarde a sessão da conta terminar de sincronizar.');const c=await this.client(),r=await c.from('board_snapshots').select('payload->state->items').eq('campaign_id',campaign).maybeSingle();if(r.error)throw r.error;this.items=clueCatalog(r.data?.items||[]);return this.items;}
 async send(itemId,action='reveal',campaign=this.campaign()){
  if(!campaign||campaign!==this.campaign())throw Error('Esta pista pertence a outra campanha ou a conta ainda não está pronta.');if(!['reveal','hide'].includes(action)||typeof itemId!=='string'||!itemId.trim()||itemId.length>180)throw Error('Pista ou comando inválido.');
  const c=await this.client(),r=await c.from('board_cue_commands').insert({campaign_id:campaign,item_id:itemId,action}).select('id').single();if(r.error)throw r.error;try{if(globalThis.BroadcastChannel){const channel=new BroadcastChannel('cris-board-commands');channel.postMessage({campaignId:campaign});channel.close();}}catch{}return r.data;
 }
}
