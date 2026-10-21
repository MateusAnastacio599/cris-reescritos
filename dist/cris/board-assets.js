// Keep binary assets in private Storage. Snapshot revisions contain only metadata.
// Legacy inline snapshots are read unchanged and migrate on the next successful save.
export class BoardAssets {
 constructor(client,campaign){this.client=client;this.campaign=campaign;this.cache=new Map();}
 valid(ref){return ref?.bucket==='cris-images'&&typeof ref.path==='string'&&ref.path.startsWith(this.campaign+'/board/')&&!ref.path.includes('..');}
 async pack(snapshot){
  const result=structuredClone(snapshot);result.imgs={};
  for(const [id,data] of Object.entries(snapshot.imgs||{})){
   if(this.valid(data)){result.imgs[id]=data;continue;}
   if(typeof data!=='string'||!data.startsWith('data:'))throw Error('Arquivo do quadro inválido: '+id);
   const cached=this.cache.get(id);if(cached?.data===data){result.imgs[id]=cached.ref;continue;}
   const blob=await (await fetch(data)).blob(),bytes=await blob.arrayBuffer();
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
   const ref={bucket:'cris-images',path:this.campaign+'/board/'+hash,mime:blob.type||'application/octet-stream'};
   const uploaded=await this.client.storage.from(ref.bucket).upload(ref.path,blob,{contentType:ref.mime,upsert:false,cacheControl:'31536000'});
   if(uploaded.error&&String(uploaded.error.statusCode)!=='409'&&uploaded.error.error!=='Duplicate')throw uploaded.error;
   this.cache.set(id,{data,ref});result.imgs[id]=ref;
  }
  return result;
 }
 async unpack(snapshot){
  if(!snapshot)return snapshot;const result=structuredClone(snapshot);
  for(const [id,ref] of Object.entries(snapshot.imgs||{})){
   if(typeof ref==='string')continue;
   if(!this.valid(ref))throw Error('Referência de arquivo do quadro inválida.');
   const cached=this.cache.get(id);if(cached?.ref.path===ref.path){result.imgs[id]=cached.data;continue;}
   const downloaded=await this.client.storage.from(ref.bucket).download(ref.path);if(downloaded.error)throw downloaded.error;
   const bytes=new Uint8Array(await downloaded.data.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   const data='data:'+(ref.mime||downloaded.data.type||'application/octet-stream')+';base64,'+btoa(binary);result.imgs[id]=data;this.cache.set(id,{data,ref});
  }
  return result;
 }
}
