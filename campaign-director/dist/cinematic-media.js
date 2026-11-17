import {CINEMATIC_MAX_BYTES,CINEMATIC_TYPES,checkCinematicImage,cinematicReferences} from './cinematic-model.js';

let pending;
function database(){
  pending??=new Promise((resolve,reject)=>{
    const request=indexedDB.open('cris-director-cinematic-media',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('images');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(Error('Não foi possível abrir o armazenamento local de imagens.'));
  }).catch(error=>{pending=null;throw error;});
  return pending;
}

export const cinematicImages={
  async get(id){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const request=db.transaction('images').objectStore('images').get(id);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(Error('Não foi possível ler a imagem local.'));
    });
  },
  async putAll(entries){
    if(!entries.length)return;
    const db=await database();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('images','readwrite');
      transaction.oncomplete=resolve;
      transaction.onabort=()=>reject(Error('Não foi possível guardar as imagens. Confira o espaço disponível.'));
      const store=transaction.objectStore('images');
      for(const [id,image] of entries)store.put(image,id);
    });
  },
};

async function imageKey(image){
  await checkCinematicImage(image);
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',await image.arrayBuffer()));
  return 'image-'+[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function storeCinematicImage(image,images=cinematicImages){
  const id=await imageKey(image);
  await images.putAll([[id,image]]);
  return id;
}

export async function exportCinematicImages(state,images){
  const media={};
  for(const [id,name] of cinematicReferences(state)){
    const image=await images.get(id);
    if(!image)throw Error(`Imagem de “${name}” indisponível. Anexe o arquivo novamente antes de exportar um backup completo.`);
    if(await imageKey(image)!==id)throw Error(`A imagem de “${name}” precisa ser anexada novamente.`);
    const bytes=new Uint8Array(await image.arrayBuffer());
    const segments=[];
    // The chunk size is divisible by three, so only the final segment has base64 padding.
    for(let i=0;i<bytes.length;i+=24576)segments.push(btoa(String.fromCharCode(...bytes.subarray(i,i+24576))));
    media[id]={type:image.type,base64:segments.join('')};
  }
  return media;
}

export async function readCinematicBackup(state,media,images){
  const entries=[];
  for(const [id,name] of cinematicReferences(state)){
    const data=media&&Object.hasOwn(media,id)?media[id]:null;
    if(!data){
      const existing=await images.get(id);
      if(existing&&await imageKey(existing)===id)continue;
      throw Error(`O backup não contém a imagem de “${name}”. Use um backup completo com as imagens.`);
    }
    if(!CINEMATIC_TYPES.includes(data.type)||typeof data.base64!=='string'||data.base64.length>Math.ceil(CINEMATIC_MAX_BYTES/3)*4){
      throw Error(`Imagem inválida no backup de “${name}”.`);
    }
    const image=new Blob([Uint8Array.from(atob(data.base64),char=>char.charCodeAt(0))],{type:data.type});
    if(await imageKey(image)!==id)throw Error(`Os dados da imagem de “${name}” não conferem com o backup.`);
    entries.push([id,image]);
  }
  return entries;
}
