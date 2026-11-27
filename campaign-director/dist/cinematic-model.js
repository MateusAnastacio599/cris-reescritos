import {sceneSpan} from './cinematic-timing.js?v=live01b4';
import {validCamera,validLighting,validLayerDirection} from './cinematic-direction-model.js?v=live01b4';
export const CINEMATIC_VERSION=1;
export const CINEMATIC_MAX_ITEMS=12;
export const CINEMATIC_MAX_LAYERS=12;
export const CINEMATIC_COMPOSITION_BYTES=24*1024*1024;
export const CINEMATIC_COMPOSITION_PIXELS=24000000;
export const cinematicImageIds=item=>[...new Set([item.imageId,...(item.layers??[]).map(layer=>layer.imageId)])];
export const cinematicMediaIds=item=>[...new Set([...cinematicImageIds(item),...(item.layers??[]).filter(l=>l.video).map(l=>l.video.mediaId),...(item.backgroundVideo?[item.backgroundVideo.mediaId]:[])])];
export const isCinematicVideoBlob=blob=>blob instanceof Blob&&blob.type==='video/webm'&&blob.size>0&&blob.size<=8*1024*1024;
export const CINEMATIC_MAX_BYTES=12*1024*1024;
export const CINEMATIC_MOTIONS=Object.freeze({
  static:'Estático', zoomIn:'Aproximação', zoomOut:'Afastamento', pan:'Panorâmica',
  living:'Ambiente vivo', breath:'Respiração', reveal:'Revelação', tension:'Tensão', memory:'Memória', apparition:'Aparição', custom:'Câmera controlável',
});
export const CINEMATIC_LIMITS=Object.freeze({seconds:[3,60],intensity:[0,30],hold:[0,20],fadeIn:[0,5],fadeOut:[0,5]});
export const CINEMATIC_DEFAULTS=Object.freeze({motion:'living',seconds:12,intensity:22,ending:'auto',hold:2,fadeIn:.3,fadeOut:.3});
export const canLoopCinematic=motion=>['living','breath','tension','memory','custom'].includes(motion);
export const cinematicEnding=item=>({ending:item.ending??'auto',hold:item.hold??CINEMATIC_DEFAULTS.hold});
export const cinematicFades=item=>({fadeIn:item.fadeIn??CINEMATIC_DEFAULTS.fadeIn,fadeOut:item.fadeOut??CINEMATIC_DEFAULTS.fadeOut});
export const cinematicTotal=item=>sceneSpan(item)+cinematicFades(item).fadeOut;
export const CINEMATIC_TYPES=Object.freeze(['image/png','image/jpeg','image/webp']);
export const isCinematicImageId=value=>typeof value==='string'&&/^image-[a-f0-9]{64}$/.test(value);
export const isCinematicKey=value=>typeof value==='string'&&/^[\w-]{1,128}$/.test(value);
const integerBetween=(value,[min,max])=>Number.isInteger(value)&&value>=min&&value<=max;
export const cinematicItems=scene=>scene.cinematic?.items??[];

export function isCinematicLayer(layer){
  return !!layer&&typeof layer==='object'&&Object.keys(layer).every(key=>['id','name','imageId','x','y','scale','visible','parallax','anchor','rotation','opacity','effects','video','window','locked'].includes(key))&&
    isCinematicKey(layer.id)&&layer.id!=='background'&&isCinematicImageId(layer.imageId)&&typeof layer.name==='string'&&layer.name.length>0&&layer.name.length<=100&&
    typeof layer.visible==='boolean'&&['x','y','scale','parallax'].every(key=>Number.isFinite(layer[key]))&&
    layer.x>=0&&layer.x<=1&&layer.y>=0&&layer.y<=1&&layer.scale>=.001&&layer.scale<=3&&validLayerDirection(layer)&&layer.parallax>=0&&layer.parallax<=2;
}
export function isCinematic(item){
  return !!item&&typeof item==='object'&&Object.keys(item).every(key=>['id','imageId','name','motion','seconds','intensity','ending','hold','fadeIn','fadeOut','layers','camera','lighting','sceneDuration','backgroundVideo'].includes(key))&&
    (item.layers===undefined||Array.isArray(item.layers)&&item.layers.length<=CINEMATIC_MAX_LAYERS&&item.layers.every(isCinematicLayer)&&new Set(item.layers.map(layer=>layer.id)).size===item.layers.length)&&
    (item.sceneDuration===undefined||Number.isFinite(item.sceneDuration)&&item.sceneDuration>=3&&item.sceneDuration<=180)&&(item.backgroundVideo===undefined||validLayerDirection({video:item.backgroundVideo}))&&
    (item.layers??[]).reduce((sum,l)=>sum+(l.effects?.length??0),0)<=32&&
    (item.camera===undefined||validCamera(item.camera))&&(item.lighting===undefined||validLighting(item.lighting))&&
    (item.layers??[]).filter(l=>l.video).length+(item.backgroundVideo?1:0)<=2&&isCinematicKey(item.id)&&isCinematicImageId(item.imageId)&&
    typeof item.name==='string'&&!!item.name.trim()&&item.name.length<=100&&
    typeof item.motion==='string'&&Object.hasOwn(CINEMATIC_MOTIONS,item.motion)&&integerBetween(item.seconds,CINEMATIC_LIMITS.seconds)&&integerBetween(item.intensity,CINEMATIC_LIMITS.intensity)&&
    (item.ending===undefined||item.ending==='auto'||item.ending==='loop'&&canLoopCinematic(item.motion))&&
    (item.hold===undefined||integerBetween(item.hold,CINEMATIC_LIMITS.hold))&&
    ['fadeIn','fadeOut'].every(key=>item[key]===undefined||Number.isFinite(item[key])&&item[key]>=0&&item[key]<=5);
}
export function validateSceneCinematics(value){
  if(value===undefined)return;
  if(!value||Object.keys(value).some(key=>key!=='version'&&key!=='items')||value.version!==CINEMATIC_VERSION||!Array.isArray(value.items)||
    value.items.length>CINEMATIC_MAX_ITEMS||!value.items.every(isCinematic)||new Set(value.items.map(item=>item.id)).size!==value.items.length){
    throw Error('Configuração cinematográfica inválida na cena.');
  }
}
export function withCinematic(scene,item){
  if(!isCinematic(item))throw Error('Confira o nome, a imagem e os limites do movimento.');
  const items=cinematicItems(scene);
  const existing=items.some(entry=>entry.id===item.id);
  const result={version:CINEMATIC_VERSION,items:existing?items.map(entry=>entry.id===item.id?item:entry):[...items,item]};
  validateSceneCinematics(result);
  return result;
}
export function cinematicReferences(state){
  const refs=new Map();
  for(const campaign of state.campaigns)for(const page of campaign.pages)for(const scene of page.scenes){
    for(const item of cinematicItems(scene)){
      refs.set(item.imageId,item.name);if(item.backgroundVideo)refs.set(item.backgroundVideo.mediaId,item.name+' / fundo vivo');
      for(const layer of item.layers??[]){refs.set(layer.imageId,item.name+' / '+layer.name);if(layer.video)refs.set(layer.video.mediaId,item.name+' / '+layer.name+' (vídeo)');}
    }
  }
  return refs;
}
export const isCinematicBlob=image=>image instanceof Blob&&CINEMATIC_TYPES.includes(image.type)&&
  image.size>0&&image.size<=CINEMATIC_MAX_BYTES;

export async function checkCinematicImage(image){
  if(!isCinematicBlob(image))throw Error('Use uma imagem PNG, JPEG ou WebP de até 12 MB.');
  const head=new Uint8Array(await image.slice(0,12).arrayBuffer());
  const matches=(offset,signature)=>signature.every((value,i)=>head[offset+i]===value);
  const valid={
    'image/png':matches(0,[137,80,78,71,13,10,26,10]),
    'image/jpeg':matches(0,[255,216,255]),
    'image/webp':matches(0,[82,73,70,70])&&matches(8,[87,69,66,80]),
  };
  if(!valid[image.type])throw Error('O conteúdo da imagem não corresponde ao formato informado.');
  return image;
}

export function duplicateCinematic(scene,id){
  const original=cinematicItems(scene).find(item=>item.id===id);
  if(!original)throw Error('Escolha uma apresentação salva para duplicar.');
  const copy={...structuredClone(original),id:crypto.randomUUID(),name:(original.name+' (cópia)').slice(0,100)};
  if(copy.layers)copy.layers=copy.layers.map(layer=>({...layer,id:crypto.randomUUID()}));
  return copy;
}
export function isCinematicPayload(asset,item){
  if(!item.layers?.length&&!item.backgroundVideo)return isCinematicBlob(asset);
  if(!asset||typeof asset!=='object'||asset instanceof Blob)return false;
  const ids=cinematicMediaIds(item),keys=Object.keys(asset);
  return keys.length===ids.length&&keys.every(id=>ids.includes(id)&&(id.startsWith('video-')?isCinematicVideoBlob(asset[id]):isCinematicBlob(asset[id])))&&
    keys.reduce((sum,id)=>sum+asset[id].size,0)<=CINEMATIC_COMPOSITION_BYTES;
}

export async function checkCinematicUpload(image){
  await checkCinematicImage(image);
  if(typeof image.name==='string'&&!({
    'image/png':/\.png$/i,'image/jpeg':/\.jpe?g$/i,'image/webp':/\.webp$/i,
  }[image.type]?.test(image.name)))throw Error('A extensão do arquivo deve corresponder ao formato PNG, JPEG ou WebP.');
  return image;
}
