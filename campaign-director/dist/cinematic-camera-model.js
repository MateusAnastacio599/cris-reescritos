import {validWindow} from './cinematic-timing.js?v=live01b4';
// Optional camera extensions; endpoints and legacy shake retain their original contract.
export const CAMERA_EASINGS=Object.freeze(['linear','ease','ease-in','ease-out','ease-in-out']);
export const CAMERA_MAX_POINTS=6;
export const CAMERA_GAP=.01;
const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
const record=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
export const cameraPoseValid=p=>record(p,['x','y','zoom'])&&finite(p.x,0,1)&&finite(p.y,0,1)&&finite(p.zoom,1,12);
export function validInstability(s){
  return !!record(s,['enabled','amount','horizontal','vertical','rotation','frequency','smoothness','irregularity','initial','final','start','end','fadeIn','fadeOut','seed','window'])&&(s.window===undefined||validWindow(s.window))&&
    typeof s.enabled==='boolean'&&['amount','smoothness','irregularity','initial','final','fadeIn','fadeOut'].every(k=>finite(s[k],0,1))&&
    finite(s.horizontal,0,.015)&&finite(s.vertical,0,.015)&&finite(s.rotation,0,1.2)&&finite(s.frequency,.1,4)&&
    finite(s.start,0,.99)&&finite(s.end,.01,1)&&s.end-s.start>=CAMERA_GAP-1e-9&&s.fadeIn+s.fadeOut<=1+1e-9&&Number.isInteger(s.seed)&&finite(s.seed,0,65535);
}
export function validCameraExtensions(camera){
  if(camera.window!==undefined&&!validWindow(camera.window))return false;
  if(camera.instability!==undefined&&!validInstability(camera.instability))return false;
  if(camera.path===undefined)return true;
  const path=camera.path;
  return Array.isArray(path)&&path.length<=CAMERA_MAX_POINTS&&new Set(path.map(p=>p?.id)).size===path.length&&path.every((p,i)=>
    record(p,['id','at','pose','hold','easing'])&&typeof p.id==='string'&&/^[-\w]{1,128}$/.test(p.id)&&!['from','to'].includes(p.id)&&
    cameraPoseValid(p.pose)&&CAMERA_EASINGS.includes(p.easing)&&finite(p.at,CAMERA_GAP,1-CAMERA_GAP)&&finite(p.hold,0,1)&&
    p.at-(path[i-1]?.at??0)>=CAMERA_GAP-1e-9&&(path[i+1]?.at??1)-p.at-p.hold>=CAMERA_GAP-1e-9);
}
export const INSTABILITY_PRESETS=Object.freeze({subtle:'Câmera sutil',handheld:'Câmera na mão',rising:'Tensão crescente',impact:'Impacto'});
export function instabilityPreset(name='subtle'){
  const common={enabled:true,amount:.55,horizontal:.002,vertical:.0015,rotation:.12,frequency:.45,smoothness:.8,irregularity:.45,initial:1,final:1,start:0,end:1,fadeIn:.12,fadeOut:.16,seed:37};
  if(name==='handheld')return {...common,horizontal:.006,vertical:.004,rotation:.35,frequency:.9,smoothness:.6,irregularity:.65};
  if(name==='rising')return {...common,horizontal:.009,vertical:.006,rotation:.55,frequency:1.4,initial:.08,final:1,fadeIn:.08,fadeOut:.15};
  if(name==='impact')return {...common,horizontal:.012,vertical:.009,rotation:.85,frequency:2.8,smoothness:.35,initial:1,final:0,start:.1,end:.34,fadeIn:.06,fadeOut:.55};
  return common;
}
export function cameraPoints(camera){return [{id:'from',at:0,hold:0,pose:camera.from,easing:camera.easing},...(camera.path??[]),{id:'to',at:1,hold:0,pose:camera.to,easing:camera.easing}];}
export const cameraPoint=(camera,id)=>cameraPoints(camera).find(p=>p.id===id);
export function addCameraPoint(camera){
  if((camera.path?.length??0)>=CAMERA_MAX_POINTS)throw Error('Use até seis enquadramentos intermediários.');
  const points=cameraPoints(camera),gaps=points.slice(0,-1).map((p,i)=>({from:p,to:points[i+1],gap:points[i+1].at-p.at-p.hold})).sort((a,b)=>b.gap-a.gap);
  const gap=gaps[0];if(gap.gap<CAMERA_GAP*2-1e-9)throw Error('Não há intervalo livre para outro enquadramento. Reduza uma permanência.');
  const at=gap.from.at+gap.from.hold+gap.gap/2;
  const p={id:crypto.randomUUID(),at,hold:0,pose:Object.fromEntries(['x','y','zoom'].map(k=>[k,(gap.from.pose[k]+gap.to.pose[k])/2])),easing:camera.easing};
  const copy=structuredClone(camera);copy.path=[...(copy.path??[]),p].sort((a,b)=>a.at-b.at);return {camera:copy,id:p.id};
}
export function updateCameraPoint(camera,id,change){
  const copy=structuredClone(camera),index=copy.path?.findIndex(p=>p.id===id);if(index===undefined||index<0)throw Error('Enquadramento não encontrado.');
  Object.assign(copy.path[index],change);copy.path.sort((a,b)=>a.at-b.at);if(!validCameraExtensions(copy))throw Error('Mantenha tempos distintos em ordem e espaço para a transição após a permanência.');return copy;
}
export function reorderCameraPoint(camera,id,direction){
  const copy=structuredClone(camera),path=copy.path??[],from=path.findIndex(p=>p.id===id),to=from+direction;if(from<0||to<0||to>=path.length)return copy;
  const times=path.map(p=>p.at);[path[from],path[to]]=[path[to],path[from]];
  path.forEach((p,i)=>{p.at=times[i];p.hold=Math.max(0,Math.min(p.hold,(times[i+1]??1)-p.at-CAMERA_GAP));});return copy;
}
export const CAMERA_MOVE_PRESETS={approach:'Aproximação central',reveal:'Revelar personagem',travel:'Travessia suave'};
export function cameraMovePreset(camera,name){
  const copy=structuredClone(camera);delete copy.path;copy.from={x:.5,y:.5,zoom:1};copy.to=name==='travel'?{x:.65,y:.5,zoom:1.8}:name==='reveal'?{x:.5,y:.6,zoom:2.5}:{x:.5,y:.5,zoom:1.6};copy.easing='ease-in-out';return copy;
}
