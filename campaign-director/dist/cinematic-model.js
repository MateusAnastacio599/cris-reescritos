export const CINEMATIC_VERSION=1;
export const CINEMATIC_MAX_ITEMS=12;
export const CINEMATIC_MAX_BYTES=12*1024*1024;
export const CINEMATIC_MOTIONS=Object.freeze({
  static:'Estático', zoomIn:'Aproximação', zoomOut:'Afastamento', pan:'Panorâmica',
  living:'Ambiente vivo', breath:'Respiração', reveal:'Revelação', tension:'Tensão', memory:'Memória', apparition:'Aparição',
});
export const CINEMATIC_LIMITS=Object.freeze({seconds:[3,60],intensity:[0,30],hold:[0,20],fadeIn:[0,5],fadeOut:[0,5]});
export const CINEMATIC_DEFAULTS=Object.freeze({motion:'living',seconds:12,intensity:22,ending:'auto',hold:2,fadeIn:.3,fadeOut:.3});
export const canLoopCinematic=motion=>['living','breath','tension','memory'].includes(motion);
export const cinematicEnding=item=>({ending:item.ending??'auto',hold:item.hold??CINEMATIC_DEFAULTS.hold});
export const cinematicFades=item=>({fadeIn:item.fadeIn??CINEMATIC_DEFAULTS.fadeIn,fadeOut:item.fadeOut??CINEMATIC_DEFAULTS.fadeOut});
export const cinematicTotal=item=>item.seconds+cinematicEnding(item).hold+cinematicFades(item).fadeOut;
export const CINEMATIC_TYPES=Object.freeze(['image/png','image/jpeg','image/webp']);
export const isCinematicImageId=value=>typeof value==='string'&&/^image-[a-f0-9]{64}$/.test(value);
export const isCinematicKey=value=>typeof value==='string'&&/^[\w-]{1,128}$/.test(value);
const integerBetween=(value,[min,max])=>Number.isInteger(value)&&value>=min&&value<=max;
export const cinematicItems=scene=>scene.cinematic?.items??[];

export function isCinematic(item){
  return !!item&&typeof item==='object'&&Object.keys(item).every(key=>['id','imageId','name','motion','seconds','intensity','ending','hold','fadeIn','fadeOut'].includes(key))&&
    isCinematicKey(item.id)&&isCinematicImageId(item.imageId)&&
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
    for(const item of cinematicItems(scene))refs.set(item.imageId,item.name);
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
