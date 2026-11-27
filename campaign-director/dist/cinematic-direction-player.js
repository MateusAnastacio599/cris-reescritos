import {NEW_FX} from './cinematic-fx.js?v=live01b4';
import {animateCameraPath} from './cinematic-camera-player.js?v=live01b4';
import {cameraTransform,defaultCamera} from './cinematic-direction-model.js?v=live01b4';

export function effectFrames(effect){
  const identity={transform:'translate(0%, 0%) scale(1, 1) rotate(0deg)'};
  if(effect.type==='breath')return [identity,{transform:`scale(${1+effect.amount}, ${1+effect.vertical})`},identity];
  if(effect.type==='sway')return [identity,{transform:`translate(${effect.x*100}%, ${effect.y*100}%)`},identity];
  if(effect.type==='opacity')return [{opacity:effect.from},{opacity:effect.to}];
  if(effect.type==='move')return [effect.from,effect.to].map(p=>({transform:`translate(${p.x*100}%, ${p.y*100}%) scale(${p.scale})`}));
  // Deterministic, bounded micro motion, no per-frame random source.
  const count=Math.max(4,Math.min(120,Math.round(effect.duration*effect.frequency*4)));
  return Array.from({length:count+1},(_,i)=>i===0||i===count?identity:{transform:`translate(${Math.sin(i*2.39)*effect.amount*100}%, ${Math.sin(i*3.71)*effect.amount*100}%)`});
}
export function animateLayerEffects(composition,currentTime){
  const animations=[];
  for(const {entry,effects} of composition.planes)for(const {node,effect} of effects??[]){
    if(!entry.visible||!effect.enabled||effect.window||Object.hasOwn(NEW_FX,effect.type))continue;
    const animation=node.animate(effectFrames(effect),{duration:effect.duration*1000,delay:effect.start*1000,fill:'both',iterations:effect.repeat?Infinity:1,direction:effect.repeat&&['move','opacity'].includes(effect.type)?'alternate':'normal',easing:effect.easing});
    animation.currentTime=currentTime;animations.push(animation);
  }
  return animations;
}
export function animateDirectionCamera(composition,item,timing,currentTime){
  const camera=item.camera??defaultCamera();
  const advanced=camera.path!==undefined||camera.instability!==undefined||camera.window!==undefined;
  const animations=advanced?animateCameraPath(composition,{...item,camera},timing,currentTime):[];
  if(!advanced){
  const animation=composition.camera.animate([{transform:cameraTransform(camera.from)},{transform:cameraTransform(camera.to)}],{...timing,easing:camera.easing,direction:timing.iterations===Infinity?'alternate':'normal'});
  animation.currentTime=currentTime;animations.push(animation);
  for(const {plane,entry} of composition.planes)if(entry.id!=='background'&&entry.parallax){const drift=plane.animate([{transform:'translate(0%, 0%)'},{transform:`translate(${(camera.to.x-camera.from.x)*entry.parallax*-3}%, ${(camera.to.y-camera.from.y)*entry.parallax*-3}%)`}],{...timing,easing:camera.easing,direction:timing.iterations===Infinity?'alternate':'normal'});drift.currentTime=currentTime;animations.push(drift);}
  }
  if(camera.instability===undefined&&camera.shake){
    const jitter=composition.jitter.animate(effectFrames({type:'shake',amount:Math.min(.015,camera.shake),duration:4,frequency:2}).map(frame=>({...frame,transform:frame.transform+` scale(${1+2*Math.min(.015,camera.shake)+.002})`})),{duration:4000,iterations:Infinity,easing:'ease-in-out'});
    jitter.currentTime=currentTime;animations.push(jitter);
  }
  return animations;
}
export function mountLighting(composition,lighting,document){
  if(!lighting?.enabled)return [];
  const make=(className,style,parent=composition.world)=>{const n=document.createElement('div');n.className=className;n.setAttribute('aria-hidden','true');Object.assign(n.style,style);parent.append(n);return n;};
  make('cinematic-light-ambient',{background:lighting.color,opacity:lighting.intensity});
  make('cinematic-light-darkness',{background:'#000',opacity:lighting.darkness});
  make('cinematic-light-vignette',{background:`radial-gradient(ellipse, transparent 30%, rgba(0,0,0,${lighting.vignette}) 100%)`});
  const pulses=[];
  for(const s of lighting.spots){
    if(!s.enabled)continue;
    const node=make('cinematic-light-spot',{left:s.x*100+'%',top:s.y*100+'%',width:s.radius*200+'%',aspectRatio:'1',background:`radial-gradient(circle,${s.color} ${Math.round((1-s.softness)*70)}%,transparent 70%)`,opacity:s.intensity},composition.camera);
    pulses.push({node,spot:s});
  }
  return pulses;
}
export function animateLighting(pulses,currentTime){
  return pulses.filter(({spot})=>spot.pulse&&!spot.window&&!spot.flicker&&!spot.kind).map(({node,spot})=>{
    const animation=node.animate([{opacity:spot.intensity},{opacity:Math.max(0,spot.intensity-spot.pulse)},{opacity:spot.intensity}],{duration:spot.seconds*1000,iterations:Infinity,easing:'ease-in-out'});
    animation.currentTime=currentTime;return animation;
  });
}
