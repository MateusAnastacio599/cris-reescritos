import {sceneSpan,windowRange,timedFrames,temporalAnimation} from './cinematic-timing.js?v=live01b5a';
import {cameraPoints} from './cinematic-camera-model.js?v=live01b5a';
import {cameraTransform} from './cinematic-direction-model.js?v=live01b5a';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const smooth=n=>{n=clamp(n,0,1);return n*n*(3-2*n);};
const smoother=n=>n*n*n*(n*(n*6-15)+10);
const hash=(n,seed)=>{const v=Math.sin(n*127.1+seed*311.7)*43758.5453123;return (v-Math.floor(v))*2-1;};
function noise(t,seed,softness){const i=Math.floor(t),fraction=t-i,mix=smooth(fraction)*(1-softness)+smoother(fraction)*softness;return hash(i,seed)*(1-mix)+hash(i+1,seed)*mix;}
export function instabilityAt(config,time,seconds){
  const zero={x:0,y:0,rotation:0};if(!config?.enabled||!config.amount)return zero;
  const start=config.start*seconds,end=config.end*seconds;if(time<=start||time>=end)return zero;
  const elapsed=time-start,length=end-start,u=elapsed/length;
  // A tiny guard still softens the edge when the explicit fade is zero.
  const fadeIn=Math.max(.03,config.fadeIn*length),fadeOut=Math.max(.03,config.fadeOut*length);
  const envelope=smooth(elapsed/fadeIn)*smooth((end-time)/fadeOut)*(config.initial+(config.final-config.initial)*smooth(u))*config.amount;
  const phase=elapsed*config.frequency*(1-.3*config.smoothness);
  const wave=(offset,seed)=>Math.sin(phase*Math.PI*2+offset)*(1-config.irregularity)+noise(phase*.83+offset,seed,config.smoothness)*config.irregularity;
  return {x:wave(.29,config.seed)*config.horizontal*envelope,y:wave(2.17,config.seed+17)*config.vertical*envelope,rotation:wave(4.31,config.seed+43)*config.rotation*envelope};
}
// Inverse-transform bounds cover the entire world rectangle, even at portrait aspects.
export function instabilityOverscan(config,aspect){
  if(!config?.enabled)return 1;
  const amount=config.amount*Math.max(config.initial,config.final),angle=config.rotation*amount*Math.PI/180;
  const x=config.horizontal*amount,y=config.vertical*amount,s=Math.sin(angle),c=Math.cos(angle);
  return Math.max(1,c+s/aspect+2*(x*c+y*s/aspect),c+aspect*s+2*(y*c+aspect*x*s))+((x||y||angle)?.002:0);
}
export function advancedInstabilityFrames(config,seconds,aspect){
  const count=Math.max(30,Math.min(1800,Math.ceil(seconds*30))),scale=instabilityOverscan(config,aspect);
  return Array.from({length:count+1},(_,i)=>{const pose=instabilityAt(config,i/count*seconds,seconds);return {offset:i/count,transform:`translate(${pose.x*100}%, ${pose.y*100}%) rotate(${pose.rotation}deg) scale(${scale})`};});
}
export function cameraPathFrames(camera,transform=point=>cameraTransform(point.pose)){
  const frames=[];
  for(const point of cameraPoints(camera)){
    frames.push({offset:point.at,transform:transform(point),easing:point.hold?'linear':point.easing});
    if(point.hold)frames.push({offset:point.at+point.hold,transform:transform(point),easing:point.easing});
  }
  return frames;
}
export function remapCameraFrames(frames,window,span){
  if(!window)return frames;
  const {start,end}=windowRange(window,span);if(end<=start)return [{...frames[0],offset:0},{...frames[0],offset:1}];
  const mapped=frames.map(f=>({...f,offset:(start+(end-start)*f.offset)/span}));
  if(start>0)mapped.unshift({...mapped[0],offset:0,easing:'linear'});
  if(end<span)mapped.push({...mapped.at(-1),offset:1,easing:'linear'});return mapped;
}
export function animateCameraPath(composition,item,timing,currentTime){
  const camera=item.camera,animations=[];
  const start=(node,frames,options)=>{const animation=node.animate(frames,options);animation.currentTime=currentTime;animations.push(animation);};
  const span=sceneSpan(item),options={...timing,duration:camera.window?span*1000:timing.duration,easing:'linear',direction:timing.iterations===Infinity?'alternate':'normal'};
  start(composition.camera,remapCameraFrames(cameraPathFrames(camera),camera.window,span),options);
  for(const {plane,entry} of composition.planes)if(entry.id!=='background'&&entry.parallax){
    start(plane,remapCameraFrames(cameraPathFrames(camera,p=>`translate(${(p.pose.x-camera.from.x)*entry.parallax*-3}%, ${(p.pose.y-camera.from.y)*entry.parallax*-3}%)`),camera.window,span),options);
  }
  if(camera.instability?.enabled){
    const s=camera.instability;
    if(s.window){const {start:begin,end}=windowRange(s.window,span),scale=instabilityOverscan(s,composition.aspect);const frames=timedFrames(span,t=>{const p=t>=begin&&t<=end?instabilityAt({...s,fadeIn:s.window.fadeIn/(end-begin),fadeOut:s.window.fadeOut/(end-begin)},t-begin,end-begin):{x:0,y:0,rotation:0};return {transform:`translate(${p.x*100}%, ${p.y*100}%) rotate(${p.rotation}deg) scale(${scale})`};});animations.push(temporalAnimation(composition.jitter,frames,span,currentTime,item.ending==='loop'));}
    else start(composition.jitter,advancedInstabilityFrames(s,item.seconds,composition.aspect),{...options,duration:timing.duration});
  }
  return animations;
}
