import {validLightExtensions,validLightEvent} from './cinematic-light-model.js?v=directorcinematic02';
import {validWindow} from './cinematic-timing.js?v=directorcinematic02';
import {NEW_FX,validExtendedFX,validFXWindow} from './cinematic-fx.js?v=directorcinematic02';
import {CAMERA_EASINGS,cameraPoseValid,validCameraExtensions} from './cinematic-camera-model.js?v=directorcinematic02';
// Optional, additive direction metadata. Old presentations are never migrated on read.
export const STUDIO_VERSION=1;
export const EFFECT_TYPES={breath:'Respiração',sway:'Balanço',shake:'Instabilidade',opacity:'Opacidade',move:'Movimento',...NEW_FX};
export const EASINGS=['linear','ease','ease-in','ease-out','ease-in-out'];
export const ANCHORS={center:{x:.5,y:.5},feet:{x:.5,y:1},top:{x:.5,y:0},left:{x:0,y:.5},right:{x:1,y:.5}};
export const bounded=(v,min,max)=>Math.min(max,Math.max(min,v));
const number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
const object=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
export const validPoint=p=>object(p,['x','y'])&&number(p.x,0,1)&&number(p.y,0,1);
export const validPose=cameraPoseValid;
export const defaultCamera=()=>({from:{x:.5,y:.5,zoom:1},to:{x:.5,y:.5,zoom:1.25},easing:'ease-in-out',shake:0});
export const validCamera=c=>object(c,['from','to','easing','shake','path','instability','window'])&&validPose(c.from)&&validPose(c.to)&&EASINGS.includes(c.easing)&&number(c.shake,0,.02)&&validCameraExtensions(c);
const movePoint=p=>object(p,['x','y','scale'])&&number(p.x,-.5,.5)&&number(p.y,-.5,.5)&&number(p.scale,.1,3);
export function validEffect(e){
  const keys=['id','type','enabled','start','duration','repeat','easing','amount','vertical','x','y','frequency','from','to','window','anchor','opacity'];
  if(!object(e,keys)||!validFXWindow(e)||typeof e.id!=='string'||!/^[-\w]{1,128}$/.test(e.id)||!Object.hasOwn(EFFECT_TYPES,e.type)||typeof e.enabled!=='boolean'||typeof e.repeat!=='boolean'||!number(e.start,0,60)||!number(e.duration,.2,60)||!EASINGS.includes(e.easing))return false;
  if(Object.hasOwn(NEW_FX,e.type))return Object.keys(e).every(k=>['id','type','enabled','start','duration','repeat','easing','amount','frequency','opacity','window','anchor'].includes(k))&&validExtendedFX(e);
  const allowed={breath:['amount','vertical'],sway:['x','y'],shake:['amount','frequency'],opacity:['from','to'],move:['from','to']}[e.type];
  if(Object.keys(e).some(k=>!['id','type','enabled','start','duration','repeat','easing','window','anchor',...allowed].includes(k)))return false;
  if(e.type==='breath')return number(e.amount,0,.12)&&number(e.vertical,0,.12);
  if(e.type==='sway')return number(e.x,-.1,.1)&&number(e.y,-.1,.1);
  if(e.type==='shake')return number(e.amount,0,.015)&&number(e.frequency,.2,8);
  if(e.type==='opacity')return number(e.from,0,1)&&number(e.to,0,1);
  return movePoint(e.from)&&movePoint(e.to);
}
export function newEffect(type){
  const options={breath:{amount:.012,vertical:.025},sway:{x:.01,y:0},shake:{amount:.002,frequency:2},opacity:{from:0,to:1},move:{from:{x:0,y:0,scale:1},to:{x:.03,y:0,scale:1}},...Object.fromEntries(Object.keys(NEW_FX).map(type=>[type,{amount:type==='flicker'?.15:type==='reveal'?1:.025,frequency:.5,opacity:type==='reveal'?.1:.8}]))};
  return {id:crypto.randomUUID(),type,enabled:true,start:0,duration:type==='opacity'?2:5,repeat:!['opacity','reveal'].includes(type),easing:'ease-in-out',...options[type]};
}
export const validVideo=v=>object(v,['mediaId','enabled','loop','rate','delay','end','window','transparent'])&&typeof v.mediaId==='string'&&/^video-[a-f0-9]{64}$/.test(v.mediaId)&&(v.window===undefined||validWindow(v.window))&&(v.transparent===undefined||typeof v.transparent==='boolean')&&typeof v.enabled==='boolean'&&typeof v.loop==='boolean'&&number(v.rate,.25,2)&&number(v.delay,0,60)&&['freeze','fallback','hide'].includes(v.end);
export function validLayerDirection(l){
  return (l.locked===undefined||typeof l.locked==='boolean')&&(l.window===undefined||validWindow(l.window))&&(l.anchor===undefined||validPoint(l.anchor))&&(l.rotation===undefined||number(l.rotation,-180,180))&&(l.opacity===undefined||number(l.opacity,0,1))&&
    (l.effects===undefined||Array.isArray(l.effects)&&l.effects.length<=8&&l.effects.every(validEffect)&&new Set(l.effects.map(e=>e.id)).size===l.effects.length)&&
    (l.video===undefined||validVideo(l.video));
}
const color=c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c);
export const validLighting=l=>object(l,['enabled','color','intensity','darkness','vignette','spots','window','flicker','events'])&&validLightExtensions(l)&&(l.events===undefined||Array.isArray(l.events)&&l.events.length<=8&&l.events.every(validLightEvent)&&new Set(l.events.map(e=>e.id)).size===l.events.length)&&typeof l.enabled==='boolean'&&color(l.color)&&number(l.intensity,0,.8)&&number(l.darkness,0,.85)&&number(l.vignette,0,.9)&&Array.isArray(l.spots)&&l.spots.length<=4&&l.spots.every(s=>
  object(s,['id','enabled','x','y','color','intensity','radius','softness','pulse','seconds','kind','rotation','window','flicker'])&&validLightExtensions(s)&&typeof s.id==='string'&&/^[-\w]{1,128}$/.test(s.id)&&typeof s.enabled==='boolean'&&number(s.x,0,1)&&number(s.y,0,1)&&color(s.color)&&number(s.intensity,0,.8)&&number(s.radius,.05,.8)&&number(s.softness,.1,1)&&number(s.pulse,0,.2)&&number(s.seconds,2,20))&&new Set(l.spots.map(s=>s.id)).size===l.spots.length;
export const LIGHT_PROFILES={candle:'Vela',theater:'Foco de teatro',unstable:'Amarelo instável',dark:'Sala escura',window:'Janela fria'};
export function lightingProfile(type='theater'){
  const cool=type==='window',dark=type==='dark';
  return {enabled:true,color:cool?'#96b9ed':'#ffcc72',intensity:.08,darkness:dark?.6:.24,vignette:.35,spots:dark?[]:[{id:crypto.randomUUID(),enabled:true,x:.5,y:.45,color:cool?'#b3d3ff':'#ffe094',intensity:.42,radius:type==='candle'?.15:.27,softness:.85,pulse:type==='unstable'?.13:.05,seconds:type==='candle'?3:6}]};
}
// The anchor names a point in the image. Move it without moving the visible image.
export function changeLayerAnchor(layer,next,backgroundAspect,mediaAspect){
  const old=layer.anchor??ANCHORS.center,angle=(layer.rotation??0)*Math.PI/180;
  const dx=(next.x-old.x)*layer.scale,dy=(next.y-old.y)*layer.scale/mediaAspect;
  const x=layer.x+dx*Math.cos(angle)-dy*Math.sin(angle),y=layer.y+(dx*Math.sin(angle)+dy*Math.cos(angle))*backgroundAspect;
  if(!number(x,0,1)||!number(y,0,1))throw Error('A âncora ficaria fora da composição. Reposicione a camada antes de alterar a âncora.');
  return {...layer,x,y,anchor:{...next}};
}
export function safeCameraPose(p){
  const half=.5/p.zoom;
  return {...p,x:bounded(p.x,half,1-half),y:bounded(p.y,half,1-half)};
}
export function cameraTransform(p){
  const pose=safeCameraPose(p);
  return `translate(${(0.5-pose.x)*pose.zoom*100}%, ${(0.5-pose.y)*pose.zoom*100}%) scale(${pose.zoom})`;
}
