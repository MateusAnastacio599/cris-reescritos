import {getCloudClient} from './cloud-account.js';
import {validateState,getMedia,putMedia,releaseAsset,STORAGE_KEY} from './storage.js';
export const sha256=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
export class CloudWorkspace{
 constructor({client=getCloudClient,readMedia=getMedia,writeMedia=putMedia,release=releaseAsset}={}){Object.assign(this,{client,readMedia,writeMedia,release});this.binding=null;this.busy=false;}
 async list(){const c=await this.client();const r=await c.from('director_workspaces').select('id,campaign_id,revision,updated_at').order('updated_at',{ascending:false});if(r.error)throw r.error;return r.data||[];}
 async load(id,onProgress=()=>{}){
  if(this.busy)throw Error('Outra operação da nuvem está em andamento.');this.busy=true;
  try{
   const c=await this.client(),r=await c.from('director_workspaces').select('*').eq('id',id).single();if(r.error)throw r.error;
   const row=r.data,state=validateState(structuredClone(row.payload)),pending=[];
   for(const asset of state.audioAssets.filter(a=>a.provider==='upload')){
    onProgress('Conferindo '+asset.name);const file=row.media[asset.id];if(!file)throw Error('A nuvem não contém o arquivo de '+asset.name);
    const cached=await this.readMedia(asset.id);if(cached){if(await sha256(cached)!==file.sha256)throw Error('O arquivo local de '+asset.name+' é diferente. Preserve seu backup antes de abrir esta versão.');continue;}
    const download=await c.storage.from(file.bucket).download(file.path);if(download.error)throw download.error;
    if(download.data.size!==file.bytes||await sha256(download.data)!==file.sha256)throw Error('Falha na verificação do áudio '+asset.name);pending.push([asset.id,download.data]);
   }
   for(const [assetId,blob] of pending){await this.writeMedia(assetId,blob);this.release(assetId);}
   this.binding={id:row.id,revision:row.revision,campaignId:row.campaign_id,media:row.media,ownerId:row.owner_id};return state;
  }finally{this.busy=false;}
 }
 async save(state,onProgress=()=>{}){
  if(this.busy)throw Error('Outra operação da nuvem está em andamento.');if(!this.binding)throw Error('Abra primeiro a cópia da nuvem para vincular este navegador.');this.busy=true;
  try{
   const snapshot=validateState(structuredClone(state)),c=await this.client(),{data,error}=await c.auth.getUser();if(error)throw error;
   if(data.user?.id!==this.binding.ownerId)throw Error('Entre na conta que abriu esta cópia.');const media={};
   for(const a of snapshot.audioAssets.filter(a=>a.provider==='upload')){
    onProgress('Conferindo '+a.name);const blob=await this.readMedia(a.id);if(!blob)throw Error('O arquivo de '+a.name+' está ausente neste navegador.');
    const hash=await sha256(blob),old=this.binding.media[a.id];if(old&&old.sha256===hash){media[a.id]=old;continue;}
    const safe=a.id.replace(/[^a-zA-Z0-9_-]/g,'_');const path=this.binding.campaignId+'/'+safe+'/'+hash+'.bin';const upload=await c.storage.from('cris-audio').upload(path,blob,{upsert:true,contentType:blob.type||'application/octet-stream'});if(upload.error)throw upload.error;
    const check=await c.storage.from('cris-audio').download(path);if(check.error)throw check.error;if(check.data.size!==blob.size||await sha256(check.data)!==hash)throw Error('Falha na verificação do envio de '+a.name);
    media[a.id]={bucket:'cris-audio',path,bytes:blob.size,sha256:hash,type:blob.type||'application/octet-stream'};
   }
   const r=await c.rpc('save_director_workspace',{p_id:this.binding.id,p_revision:this.binding.revision,p_payload:snapshot,p_media:media});if(r.error)throw r.error;this.binding.revision=r.data;this.binding.media=media;return r.data;
  }finally{this.busy=false;}
 }
 clear(){this.binding=null;}
}
export function preserveBeforeCloudLoad(storage=localStorage){const raw=storage.getItem(STORAGE_KEY);if(raw)storage.setItem(STORAGE_KEY+':before-cloud-load',raw);}
