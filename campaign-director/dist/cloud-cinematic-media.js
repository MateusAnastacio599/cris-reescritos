import {cinematicReferences} from './cinematic-model.js?v=directorcinematic02';
import {cinematicImages,imageKey,cinematicDimensions,validateWorkspaceCompositions} from './cinematic-media.js?v=cloudreliability01';
import {checkCinematicVideo} from './cinematic-video.js?v=directorcinematic02';
import {uploadCloudMedia} from './cloud-media-upload.js?v=cloudreliability01';
const hashPattern=/^(image|video)-([a-f0-9]{64})$/;
export class CloudCinematicMedia{
 constructor({images=cinematicImages}={}){this.images=images;}
 async collect(state){const entries=new Map();for(const [id,name]of cinematicReferences(state)){const blob=await this.images.get(id);if(!blob||await imageKey(blob)!==id)throw Error('Arquivo Cinematic ausente ou divergente: '+name);entries.set(id,blob);}await validateWorkspaceCompositions(state,entries);return entries;}
 descriptor(id,blob,binding){const match=id.match(hashPattern);if(!match)throw Error('Hash de mídia inválido');return {bucket:'cris-images',path:`${binding.campaignId}/director-private/${binding.ownerId}/${id}`,bytes:blob.size,sha256:match[2],type:blob.type};}
 async save(c,state,binding,onProgress){
  const entries=await this.collect(state),manifest={};let completed=0;const total=[...entries.values()].reduce((n,b)=>n+b.size,0);
  for(const [id,blob]of entries){const file=this.descriptor(id,blob,binding),bucket=c.storage.from(file.bucket);onProgress(`Conferindo Cinematics · ${completed}/${total} bytes`);
   const old=binding.media?.cinematics?.[id];
   if(old&&JSON.stringify(this.descriptor(id,blob,binding))===JSON.stringify(Object.fromEntries(Object.keys(file).map(k=>[k,old[k]])))&&bucket.info){const info=await bucket.info(file.path);if(!info.error&&info.data.size===file.bytes&&info.data.contentType===file.type){manifest[id]=old;completed+=blob.size;onProgress(`Salvo na nuvem · Cinematics ${completed}/${total} bytes confirmados`);continue;}}
   let check=await bucket.download(file.path);
   if(check.error){const status=Number(check.error.statusCode||check.error.status);if(status!==404&&!(status===400&&/not.found|not_found|missing/i.test(check.error.message||check.error.error||'')))throw check.error;
    await uploadCloudMedia(c,file,blob,onProgress);check=await bucket.download(file.path);
   }
   if(check.error)throw check.error;if(check.data.size!==file.bytes||check.data.type!==file.type||await imageKey(check.data)!==id)throw Error('Falha de integridade no envio da Cinematic');
   const dimensions=blob.type==='video/webm'?await checkCinematicVideo(blob,{allowOpaque:true}):await cinematicDimensions(blob);manifest[id]={...file,...dimensions};completed+=blob.size;onProgress(`Salvo na nuvem · Cinematics ${completed}/${total} bytes confirmados`);
  }return manifest;
 }
 async load(c,state,row,onProgress){
  const staged=new Map(),missing=new Set();let done=0;const refs=cinematicReferences(state);
  for(const [id,name]of refs){const descriptor=row.media?.cinematics?.[id];if(descriptor){const match=id.match(hashPattern);if(!match||descriptor.bucket!=='cris-images'||descriptor.path!==`${row.campaign_id}/director-private/${row.owner_id}/${id}`||descriptor.sha256!==match[2])throw Error('Referência de mídia inválida: '+name);}
   const cached=await this.images.get(id);if(cached){if(await imageKey(cached)!==id||(descriptor&&(cached.size!==descriptor.bytes||cached.type!==descriptor.type)))throw Error('Arquivo local divergente; preserve seu backup: '+name);staged.set(id,cached);continue;}
   missing.add(id);const file=row.media?.cinematics?.[id],match=id.match(hashPattern);if(!file||!match||file.bucket!=='cris-images'||file.path!==`${row.campaign_id}/director-private/${row.owner_id}/${id}`||file.sha256!==match[2])throw Error('Arquivo ausente na nuvem: '+name);
   onProgress(`Baixando para este dispositivo · ${++done}/${refs.size} · ${name}`);const r=await c.storage.from(file.bucket).download(file.path);if(r.error)throw r.error;
   if(r.data.size!==file.bytes||r.data.type!==file.type||await imageKey(r.data)!==id)throw Error('Falha de integridade ao baixar '+name);staged.set(id,r.data);
  }
  await validateWorkspaceCompositions(state,staged);return [...staged].filter(([id])=>missing.has(id));
 }
}
