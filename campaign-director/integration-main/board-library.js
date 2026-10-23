// Saved case boards use independent GM drafts and explicit player publications.
export const archiveIdFrom = search => {const id=new URLSearchParams(search).get('board');if(!id)return null;if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))throw Error('Código de quadro inválido.');return id;};
export function publishedBoard(snapshot){
 const source=snapshot?.state||{},all=source.items||[],blocked=new Set(all.filter(i=>i.gm||i.hand||i.kind==='ativador').map(i=>i.id));
 let changed=true;while(changed){changed=false;for(const i of all)if((['parent','in','box','inside'].some(k=>blocked.has(i[k])))&&!blocked.has(i.id)){blocked.add(i.id);changed=true;}}
 const items=all.filter(i=>!blocked.has(i.id)).map(i=>JSON.parse(JSON.stringify(i,(k,v)=>k.startsWith('_')&&!['_scr','_scan','_sum'].includes(k)||['crisClue','crisClueName','gmNotes'].includes(k)?undefined:v)));
 const ids=new Set(items.map(i=>i.id)),pins=(source.pins||[]).filter(p=>!p.item||ids.has(p.item)),pinIds=new Set(pins.map(p=>p.id));
 const state={items,pins,strings:(source.strings||[]).filter(s=>pinIds.has(s.a)&&pinIds.has(s.b))};
 for(const k of ['surface','light','lampOff','fx','cam','z'])if(source[k]!==undefined)state[k]=structuredClone(source[k]);
 const imgs={};for(const i of items)for(const key of ['imgId','audioId'])if(i[key]&&snapshot.imgs?.[i[key]])imgs[i[key]]=snapshot.imgs[i[key]];
 return {state,imgs};
}
const check=r=>{if(r.error)throw r.error;return r.data;};
export class BoardLibrary{
 constructor(client,campaign){this.client=client;this.campaign=campaign;this.revisions=new Map();}
 async list(master){return check(await this.client.from(master?'investigation_boards':'investigation_board_publications').select('id,title,description,updated_at').eq('campaign_id',this.campaign).order('updated_at',{ascending:false}));}
 async create(title,description='',payload={state:{items:[],pins:[],strings:[]},imgs:{}}){const row=check(await this.client.from('investigation_boards').insert({campaign_id:this.campaign,title:title.trim(),description:description.trim(),payload,revision:1}).select('id').single());return row.id;}
 async load(id,master){const row=check(await this.client.from(master?'investigation_boards':'investigation_board_publications').select('*').eq('campaign_id',this.campaign).eq('id',id).maybeSingle());if(!row)throw Error('Quadro indisponível ou ainda não liberado pelo mestre.');this.revisions.set(id,row.revision);return row;}
 async save(id,payload){const revision=this.revisions.get(id);if(!revision)throw Error('Reabra o quadro antes de salvar.');const row=check(await this.client.from('investigation_boards').update({payload,revision:revision+1,updated_at:new Date().toISOString()}).eq('id',id).eq('campaign_id',this.campaign).eq('revision',revision).select('revision').maybeSingle());if(!row)throw Error('Quadro alterado em outra aba. Reabra para comparar as cópias.');this.revisions.set(id,row.revision);return row.revision;}
 async publish(id){const row=check(await this.client.from('investigation_boards').select('*').eq('id',id).eq('campaign_id',this.campaign).single()),payload=publishedBoard(row.payload);const release={title:row.title,description:row.description,payload,revision:row.revision,updated_at:new Date().toISOString()},updated=check(await this.client.from('investigation_board_publications').update(release).eq('id',id).eq('campaign_id',this.campaign).select('id').maybeSingle());if(!updated)check(await this.client.from('investigation_board_publications').insert({id:row.id,campaign_id:this.campaign,...release}));return payload.state.items.length;}
 async unpublish(id){check(await this.client.from('investigation_board_publications').delete().eq('campaign_id',this.campaign).eq('id',id));}
 async rename(id,title,description){check(await this.client.from('investigation_boards').update({title:title.trim(),description:description.trim(),updated_at:new Date().toISOString()}).eq('campaign_id',this.campaign).eq('id',id));}
 async remove(id){check(await this.client.from('investigation_boards').delete().eq('campaign_id',this.campaign).eq('id',id));}
}
