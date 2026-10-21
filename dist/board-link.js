import {getCloudClient} from './cloud-account.js';
export function clueCatalog(items=[]){return items.filter(i=>i&&typeof i.id==='string'&&!i.hand).map(i=>({id:i.id,title:String(i.name||i.title||i.label||i.text||i.type||'Pista').replace(/<[^>]*>/g,'').split('\n')[0].slice(0,100),hidden:!!i.gm,type:i.type||'item'}));}
export class BoardLink{
 constructor({campaign,client=getCloudClient}={}){this.campaign=campaign;this.client=client;this.items=[];}
 async refresh(){const campaign=this.campaign();if(!campaign)throw Error('Aguarde a sessão da conta terminar de sincronizar.');const c=await this.client(),r=await c.from('board_snapshots').select('payload->state->items').eq('campaign_id',campaign).maybeSingle();if(r.error)throw r.error;this.items=clueCatalog(r.data?.items||[]);return this.items;}
 async send(itemId,action='reveal',campaign=this.campaign()){
  if(!campaign||campaign!==this.campaign())throw Error('Esta pista pertence a outra campanha ou a conta ainda não está pronta.');if(!['reveal','hide'].includes(action)||typeof itemId!=='string'||!itemId.trim()||itemId.length>180)throw Error('Pista ou comando inválido.');
  const c=await this.client(),r=await c.from('board_cue_commands').insert({campaign_id:campaign,item_id:itemId,action}).select('id').single();if(r.error)throw r.error;try{if(globalThis.BroadcastChannel){const channel=new BroadcastChannel('cris-board-commands');channel.postMessage({campaignId:campaign});channel.close();}}catch{}return r.data;
 }
}
