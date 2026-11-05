// The saved draft id is the real-send id: retries can never create a second team notice.
export class NoticeDrafts {
 constructor(client,campaign,user){this.client=client;this.campaign=campaign;this.user=user;}
 query(){return this.client.from('operation_notice_drafts').select('*').eq('campaign_id',this.campaign).eq('created_by',this.user);}
 async list(){const r=await this.query().order('updated_at',{ascending:false});if(r.error)throw r.error;return r.data;}
 async save({id,payload,updated_at,last_error=''}){
  const fields={payload,last_error,updated_at:new Date().toISOString()};
  const r=id?await this.client.from('operation_notice_drafts').update(fields).eq('id',id).eq('campaign_id',this.campaign).eq('created_by',this.user).eq('updated_at',updated_at).select().maybeSingle():await this.client.from('operation_notice_drafts').insert({...fields,campaign_id:this.campaign,created_by:this.user}).select().single();
  if(r.error)throw r.error;if(!r.data)throw Error('Este rascunho foi alterado em outro aparelho ou já enviado. Reabra a lista antes de editar.');return r.data;
 }
 async remove(id){const r=await this.client.from('operation_notice_drafts').delete().eq('id',id).eq('campaign_id',this.campaign).eq('created_by',this.user);if(r.error)throw r.error;}
}
