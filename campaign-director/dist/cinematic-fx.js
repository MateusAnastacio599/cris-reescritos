import {sceneSpan,validWindow,windowRange,windowEnvelope,timedFrames,temporalAnimation} from './cinematic-timing.js?v=directorcinematic01';
export const NEW_FX={flicker:'Flicker suave',pulse:'Pulso',drift:'Deslocamento sutil',reveal:'Aparecer'};
// CSS timing curves sampled in model time, so seeking and the board stay identical.
function eased(name,u){
  if(name==='linear'||u===0||u===1)return u;
  const [x1,y1,x2,y2]=({ease:[.25,.1,.25,1],'ease-in':[.42,0,1,1],'ease-out':[0,0,.58,1],'ease-in-out':[.42,0,.58,1]})[name]??[0,0,1,1];
  const cubic=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;let lo=0,hi=1;
  for(let i=0;i<20;i++){const t=(lo+hi)/2;if(cubic(t,x1,x2)<u)lo=t;else hi=t;}
  return cubic((lo+hi)/2,y1,y2);
}
export function validExtendedFX(e){return Object.hasOwn(NEW_FX,e.type)&&Number.isFinite(e.amount)&&e.amount>=0&&e.amount<=(e.type==='flicker'?.35:e.type==='reveal'?1:.12)&&Number.isFinite(e.frequency)&&e.frequency>=.1&&e.frequency<=2&&Number.isFinite(e.opacity)&&e.opacity>=.1&&e.opacity<=1;}
export function effectAt(e,time,span){
  const range=windowRange(e.window,span),elapsed=time-range.start-e.start,windowWeight=windowEnvelope(e.window,time,span);
  const active=elapsed>=0&&time<range.end,phase=e.repeat?Math.max(0,elapsed)%e.duration:Math.min(e.duration,Math.max(0,elapsed));
  const reverse=e.repeat&&['move','opacity'].includes(e.type)&&Math.floor(Math.max(0,elapsed)/e.duration)%2;
  const u=eased(e.easing,reverse?1-phase/e.duration:phase/e.duration);
  const fade=e.window?windowWeight:1,weight=active?fade:0,cycle=Math.sin(u*Math.PI*2),breath=(1-Math.cos(u*Math.PI*2))/2;
  let x=0,y=0,sx=1,sy=1,opacity=1;
  if(e.type==='breath'){sx+=breath*e.amount*weight;sy+=breath*e.vertical*weight;}
  if(e.type==='sway'){x=cycle*e.x*weight;y=cycle*e.y*weight;}
  const waveTime=e.repeat?Math.max(0,elapsed):Math.min(e.duration,Math.max(0,elapsed));
  if(e.type==='shake'){x=Math.sin(waveTime*e.frequency*6.283)*e.amount*weight;y=Math.sin(waveTime*e.frequency*5.13+1)*e.amount*weight;}
  if(e.type==='drift'){x=Math.sin(waveTime*e.frequency*2)*e.amount*weight;y=Math.sin(waveTime*e.frequency*1.37)*e.amount*.3*weight;opacity=1-(1-e.opacity)*weight;}
  if(e.type==='pulse'){sx+=breath*e.amount*weight;sy=sx;opacity=1-breath*(1-e.opacity)*weight;}
  if(e.type==='flicker'){const signal=(Math.sin(waveTime*e.frequency*6.283)+.35*Math.sin(waveTime*e.frequency*10.37)+1.35)/2.7;opacity=1-(1-(1-signal*e.amount)*e.opacity)*weight;}
  if(e.type==='reveal'){const floor=Math.min(e.opacity,e.amount);opacity=(elapsed<0?0:e.repeat?floor+(e.amount-floor)*breath:floor+(e.amount-floor)*u)*windowWeight;}
  if(e.type==='opacity')opacity=1-((1-(e.from+(e.to-e.from)*u))*weight);
  if(e.type==='move'){x=(e.from.x+(e.to.x-e.from.x)*u)*weight;y=(e.from.y+(e.to.y-e.from.y)*u)*weight;sx=sy=1+(e.from.scale+(e.to.scale-e.from.scale)*u-1)*weight;}
  return {transform:`translate(${x*100}%, ${y*100}%) scale(${sx}, ${sy})`,opacity};
}
export function animateTimedFX(composition,item,time,{reduced=false}={}){
  const animations=[],span=sceneSpan(item),loop=item.ending==='loop';
  for(const {entry,effects,visibility} of composition.planes??[]){
    if(entry.visible===false)continue;
    if(entry.window&&visibility)animations.push(temporalAnimation(visibility,timedFrames(span,t=>({opacity:windowEnvelope(entry.window,t,span)})),span,time,loop));
    for(const {node,effect} of effects??[])if(!reduced&&effect.enabled&&(effect.window||Object.hasOwn(NEW_FX,effect.type))){
      if(effect.anchor)node.style.transformOrigin=`${effect.anchor.x*100}% ${effect.anchor.y*100}%`;
      const frames=timedFrames(span,t=>effectAt(effect,t,span));
      // Ping-pong the directed interval on indefinite scene loops, avoiding a reset jump.
      const animation=temporalAnimation(node,frames,span,time,loop);if(loop)animation.effect?.updateTiming({direction:'alternate'});animations.push(animation);
    }
  }
  return animations;
}
export const validFXWindow=e=>(e.window===undefined||validWindow(e.window))&&(e.anchor===undefined||e.anchor&&Object.keys(e.anchor).every(k=>['x','y'].includes(k))&&['x','y'].every(k=>Number.isFinite(e.anchor[k])&&e.anchor[k]>=0&&e.anchor[k]<=1));
