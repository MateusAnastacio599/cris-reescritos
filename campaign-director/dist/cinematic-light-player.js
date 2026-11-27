import {sceneSpan,windowEnvelope,timedFrames,temporalAnimation} from './cinematic-timing.js?v=directorcinematic02';
export function lightIntensity(light,time,span,reduced=false){
  let value=light.intensity??1;
  if(!reduced){
    if(light.pulse)value-=light.pulse*(1-Math.cos(time/(light.seconds??6)*Math.PI*2))/2;
    if(light.flicker){const f=light.flicker,w=(Math.sin(time*f.frequency*6.283+f.seed)+.3*Math.sin(time*f.frequency*9.17+f.seed*.7)+1.3)/2.6;value*=1-f.amount*w;}
  }
  return Math.max(0,value)*windowEnvelope(light.window,time,span);
}
export function eventIntensity(event,time){
  let value=0;
  for(let i=0;i<event.count;i++){const elapsed=time-event.start-i*event.gap;if(elapsed>=0&&elapsed<=event.duration){const ramp=Math.min(.08,event.duration/3),a=Math.min(1,elapsed/ramp,(event.duration-elapsed)/ramp);value=Math.max(value,Math.max(0,a)*event.amount);}}
  return value;
}
export function animateDirectorLights(composition,item,currentTime,reduced=false){
  const animations=[],span=sceneSpan(item),loop=item.ending==='loop';
  for(const {node,light,global} of composition.directionLights??[]){
    if(global){animations.push(temporalAnimation(node,timedFrames(span,t=>({opacity:lightIntensity({intensity:1,window:light.window,flicker:light.flicker},t,span,reduced)})),span,currentTime,loop));}
    else animations.push(temporalAnimation(node,timedFrames(span,t=>({opacity:lightIntensity(light,t,span,reduced)})),span,currentTime,loop));
  }
  if(!reduced)for(const {node,event} of composition.lightEvents??[])animations.push(temporalAnimation(node,timedFrames(span,t=>({opacity:eventIntensity(event,t)})),span,currentTime,loop));
  return animations;
}
export function mountDirectorLights(composition,lighting,document){
  composition.directionLights=[];composition.lightEvents=[];
  if(!lighting?.enabled)return;
  // Existing lights remain on the old path unless optional temporal/advanced fields are present.
  if(lighting.window||lighting.flicker){const wrapper=document.createElement('div');wrapper.className='cinematic-light-base';for(const n of [...composition.world.children].filter(n=>n.className?.match?.(/^cinematic-light-(ambient|darkness|vignette)$/)))wrapper.append(n);composition.world.append(wrapper);composition.directionLights.push({node:wrapper,light:lighting,global:true});}
  for(const {node,spot} of composition.pulses??[]){
    if(spot.kind==='beam'){node.classList.add('cinematic-light-beam');Object.assign(node.style,{background:`linear-gradient(${spot.color},transparent)`,clipPath:'polygon(50% 0,0 100%,100% 100%)',transform:`translate(-50%,0) rotate(${spot.rotation??0}deg)`,transformOrigin:'50% 0',filter:`blur(${spot.softness*12}px)`});}
    if(spot.kind==='global'){node.classList.add('cinematic-light-global');Object.assign(node.style,{inset:'0',width:'100%',height:'100%',transform:'none',background:spot.color});}
    if(spot.window||spot.flicker||spot.kind)composition.directionLights.push({node,light:spot});
  }
  for(const event of lighting.events??[]){const node=document.createElement('div');node.className='cinematic-light-event';node.style.background=event.type==='blackout'?'#000':event.color;node.style.opacity='0';if(event.type==='flash')node.style.mixBlendMode='screen';composition.world.append(node);composition.lightEvents.push({node,event});}
}
