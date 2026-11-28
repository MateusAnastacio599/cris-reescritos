// TUS keeps an interrupted large upload resumable without persisting credentials.
const CHUNK=6*1024*1024;
export async function uploadCloudMedia(client,file,blob,onProgress,{fetcher=globalThis.fetch,storage=globalThis.localStorage}={}){
 if(blob.size<=CHUNK||!client.supabaseUrl){const r=await client.storage.from(file.bucket).upload(file.path,blob,{upsert:false,contentType:blob.type});if(r.error&&!/already exists|duplicate/i.test(r.error.message||''))throw r.error;return;}
 const endpoint=new URL('/storage/v1/upload/resumable',client.supabaseUrl),key='cris:tus:'+endpoint.origin+':'+file.path;
 const {data,error}=await client.auth.getSession();if(error)throw error;if(!data.session?.access_token)throw Error('Entre novamente para enviar este arquivo.');
 const headers={'Tus-Resumable':'1.0.0',Authorization:'Bearer '+data.session.access_token};
 const request=async(url,options)=>{const r=await fetcher(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Object.assign(Error('Falha no envio de mídia ('+r.status+'). Tente sincronizar novamente.'),{status:r.status});return r;};
 const valid=url=>{const u=new URL(url,endpoint);if(u.origin!==endpoint.origin||!u.pathname.startsWith(endpoint.pathname+'/'))throw Error('Destino de upload inválido.');return u.href;};
 let url=storage?.getItem(key),offset=0;
 if(url){url=valid(url);try{const r=await request(url,{method:'HEAD'});offset=Number(r.headers.get('Upload-Offset'));}catch(error){if(![404,410].includes(error.status))throw error;storage?.removeItem(key);url=null;}}
 if(!url){const metadata={bucketName:file.bucket,objectName:file.path,contentType:blob.type,cacheControl:'31536000'};const r=await request(endpoint.href,{method:'POST',headers:{'Upload-Length':String(blob.size),'Upload-Metadata':Object.entries(metadata).map(([k,v])=>k+' '+btoa(v)).join(',')}});url=valid(r.headers.get('Location')||'');storage?.setItem(key,url);}
 if(!Number.isSafeInteger(offset)||offset<0||offset>blob.size)throw Error('Posição de upload inválida.');
 while(offset<blob.size){const end=Math.min(blob.size,offset+CHUNK),r=await request(url,{method:'PATCH',headers:{'Content-Type':'application/offset+octet-stream','Upload-Offset':String(offset)},body:blob.slice(offset,end)}),next=Number(r.headers.get('Upload-Offset'));if(next!==end)throw Error('Confirmação de upload divergente.');offset=next;onProgress(`Enviando Cinematic · ${offset}/${blob.size} bytes recebidos`);}
 storage?.removeItem(key);
}
