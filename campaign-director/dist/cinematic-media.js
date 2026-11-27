import {checkCinematicVideo} from './cinematic-video.js?v=live01b5a';
import {CINEMATIC_MAX_BYTES,CINEMATIC_TYPES,checkCinematicImage,cinematicReferences,cinematicItems,cinematicMediaIds,isCinematicPayload,isCinematicBlob,CINEMATIC_COMPOSITION_PIXELS} from './cinematic-model.js?v=live01b5a';

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

const hashes=new WeakMap();
export const cinematicHashMetrics={calls:0,bytes:0,ms:0,reused:0};
export async function imageKey(image){
  if(!(image instanceof Blob))throw Error('Mídia inválida.');
  if(hashes.has(image)){cinematicHashMetrics.reused++;return hashes.get(image);}
  const promise=(async()=>{const begin=performance.now();
    if(image.type==='video/webm')await checkCinematicVideo(image,{allowOpaque:true});else await checkCinematicImage(image);
    const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',await image.arrayBuffer()));
    cinematicHashMetrics.calls++;cinematicHashMetrics.bytes+=image.size;cinematicHashMetrics.ms+=performance.now()-begin;
    return (image.type==='video/webm'?'video-':'image-')+[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  })();hashes.set(image,promise);try{return await promise;}catch(error){hashes.delete(image);throw error;}
}

export async function storeCinematicImage(image,images=cinematicImages){
  const id=await imageKey(image);
  if(!await images.get(id))await images.putAll([[id,image]]);
  return id;
}

export async function exportCinematicImages(state,images){
  const media={},entries=new Map();
  for(const [id,name] of cinematicReferences(state)){
    const image=await images.get(id);
    if(!image)throw Error(`Imagem de “${name}” indisponível. Anexe o arquivo novamente antes de exportar um backup completo.`);
    if(await imageKey(image)!==id)throw Error(`A imagem de “${name}” precisa ser anexada novamente.`);
    entries.set(id,image);
    const bytes=new Uint8Array(await image.arrayBuffer());
    const segments=[];
    // The chunk size is divisible by three, so only the final segment has base64 padding.
    for(let i=0;i<bytes.length;i+=24576)segments.push(btoa(String.fromCharCode(...bytes.subarray(i,i+24576))));
    media[id]={type:image.type,base64:segments.join('')};
  }
  await validateWorkspaceCompositions(state,entries);
  return media;
}

export async function readCinematicBackup(state,media,images){
  const entries=[];
  for(const [id,name] of cinematicReferences(state)){
    const data=media&&Object.hasOwn(media,id)?media[id]:null;
    if(!data){
      const existing=await images.get(id);
      if(existing&&await imageKey(existing)===id){entries.push([id,existing]);continue;}
      throw Error(`O backup não contém a imagem de “${name}”. Use um backup completo com as imagens.`);
    }
    if(![...CINEMATIC_TYPES,'video/webm'].includes(data.type)||typeof data.base64!=='string'||data.base64.length>Math.ceil(CINEMATIC_MAX_BYTES/3)*4){
      throw Error(`Imagem inválida no backup de “${name}”.`);
    }
    const image=new Blob([Uint8Array.from(atob(data.base64),char=>char.charCodeAt(0))],{type:data.type});
    if(await imageKey(image)!==id)throw Error(`Os dados da imagem de “${name}” não conferem com o backup.`);
    entries.push([id,image]);
  }
  await validateWorkspaceCompositions(state,new Map(entries),true);
  return entries;
}

// Read dimensions before decoding. This bounds allocations for layered images.
export async function cinematicDimensions(image){
  await checkCinematicImage(image);
  const bytes=new Uint8Array(await image.arrayBuffer()),view=new DataView(bytes.buffer);
  let width,height;
  if(image.type==='image/png'&&bytes.length>=33&&String.fromCharCode(...bytes.slice(12,16))==='IHDR'){
    width=view.getUint32(16);height=view.getUint32(20);
    let offset=8;
    while(offset+12<=bytes.length){
      const length=view.getUint32(offset),type=String.fromCharCode(...bytes.slice(offset+4,offset+8));
      if(type==='acTL')throw Error('Use imagens estáticas nas composições. PNG animado não é compatível.');
      if(offset+length+12>bytes.length)throw Error('Arquivo PNG incompleto.');
      offset+=length+12;
    }
  }
  if(image.type==='image/jpeg'){
    let offset=2;
    while(offset+4<bytes.length){
      if(bytes[offset++]!==255)break;
      while(bytes[offset]===255)offset++;
      if(offset>=bytes.length)break;
      const marker=bytes[offset++];
      if(offset+2>bytes.length)break;
      if([0xd8,0xd9,0xda].includes(marker))break;
      const length=view.getUint16(offset);
      if(length<2||offset+length>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=7){
        height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;
      }
      offset+=length;
    }
  }
  if(image.type==='image/webp'&&bytes.length>=25){
    const type=String.fromCharCode(...bytes.slice(12,16));
    if(type==='VP8X'&&bytes.length>=30){
      if(bytes[20]&2)throw Error('Use WebP estático nas composições.');
      width=1+bytes[24]+bytes[25]*256+bytes[26]*65536;
      height=1+bytes[27]+bytes[28]*256+bytes[29]*65536;
    }
    if(type==='VP8 '&&bytes.length>=30&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a){width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
    if(type==='VP8L'&&bytes[20]===0x2f){
      const bits=view.getUint32(21,true);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;
    }
  }
  if(!width||!height||width>8192||height>8192)throw Error('Imagem inválida ou grande demais. Use dimensões de até 8192 px por lado.');
  return {width,height,pixels:width*height};
}

export async function validateCompositionMedia(item,asset,{decode=false}={}){
  const valid=(item.layers?.length||item.backgroundVideo)?isCinematicPayload(asset,item):asset&&Object.keys(asset).length===1&&isCinematicBlob(asset[item.imageId]);
  if(!valid)throw Error('Composição incompleta ou acima de 24 MB. Confira o fundo e todas as camadas.');
  const dimensions=new Map();
  for(const id of cinematicMediaIds(item)){
    if(await imageKey(asset[id])!==id)throw Error('Os dados de uma imagem da composição não correspondem ao hash salvo.');
    dimensions.set(id,await (id.startsWith('video-')?checkCinematicVideo(asset[id],{allowOpaque:true}):cinematicDimensions(asset[id])));
  }
  let pixels=dimensions.get(item.imageId).pixels;
  if(item.backgroundVideo){const v=dimensions.get(item.backgroundVideo.mediaId),bg=dimensions.get(item.imageId);pixels+=v.pixels*3;if(item.backgroundVideo.transparent!==false&&!v.alpha)throw Error('Este fundo foi configurado como transparente, mas o WebM não possui alpha.');if(Math.abs(v.width/v.height-bg.width/bg.height)>.01)throw Error('O fundo de fallback deve ter a mesma proporção do vídeo.');}
  for(const layer of item.layers??[]){
    if(layer.video&&asset[layer.imageId].type!=='image/png')throw Error('Uma camada WebM exige fallback PNG.');
    if(layer.video){if(layer.video.transparent!==false&&!dimensions.get(layer.video.mediaId).alpha)throw Error('O WebM desta camada não possui alpha.');const video=dimensions.get(layer.video.mediaId),fallback=dimensions.get(layer.imageId);pixels+=video.pixels*3;
      if(Math.abs(video.width/video.height-fallback.width/fallback.height)>.01)throw Error('O PNG de fallback deve ter a mesma proporção do vídeo.');}
    const cost=dimensions.get(layer.imageId).pixels;
    if(cost>8000000)throw Error('Cada camada adicional deve ter até 8 megapixels.');
    pixels+=cost;
  }
  if(pixels>CINEMATIC_COMPOSITION_PIXELS)throw Error('A composição deve ter até 24 megapixels somando o fundo e as camadas.');
  if(decode&&typeof globalThis.createImageBitmap==='function')for(const [id,size] of dimensions){
    if(id.startsWith('video-'))continue;
    const bitmap=await createImageBitmap(asset[id]).catch(()=>{throw Error('Uma imagem da composição está corrompida. Reanexe o arquivo original.');});
    const matches=matchesCinematicDimensions(asset[id],size,bitmap.width,bitmap.height);bitmap.close();
    if(!matches)throw Error('Dimensões inconsistentes na imagem da composição.');
  }
  return dimensions;
}

async function validateWorkspaceCompositions(state,entries,decode=false){
  for(const campaign of state.campaigns)for(const page of campaign.pages)for(const scene of page.scenes){
    for(const item of cinematicItems(scene))if(item.layers?.length||item.backgroundVideo){
      await validateCompositionMedia(item,Object.fromEntries(cinematicMediaIds(item).map(id=>[id,entries.get(id)])),{decode});
    }
  }
}

export async function loadCinematicMedia(item,images=cinematicImages,{background,files=new Map()}={}){
  if(!item.layers?.length&&!item.backgroundVideo){
    const image=background??await images.get(item.imageId);
    if(!image)throw Error('Imagem da Cinematic indisponível neste navegador. Anexe novamente ou importe o backup completo.');
    return image;
  }
  const entries=[];
  for(const id of cinematicMediaIds(item)){
    const image=id===item.imageId&&background?background:files.get(id)??await images.get(id);
    if(!image)throw Error(`Arquivo ausente na composição “${item.name}”. Reanexe o fundo ou a camada e salve antes de apresentar.`);
    entries.push([id,image]);
  }
  const asset=Object.fromEntries(entries);
  await validateCompositionMedia(item,asset);
  return asset;
}

export function matchesCinematicDimensions(image,size,width,height){
  return width===size.width&&height===size.height||image.type==='image/jpeg'&&width===size.height&&height===size.width;
}
