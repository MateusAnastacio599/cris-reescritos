import {checkCinematicImage,cinematicEnding} from './cinematic-model.js';

const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const fadeBuffer=30;
export const CINEMATIC_FADE_MS=300;

export function cinematicFrames({motion,intensity},reducedMotion=false){
  const still={transform:'scale(1)'};
  if(reducedMotion||motion==='static'||!intensity)return [still,still];
  const strength=intensity/100;
  const zoom={transform:`scale(${1+strength})`};
  const move=(x,y,zoomFactor)=>({transform:`translate(${x*intensity}%, ${y*intensity}%) scale(${1+strength*zoomFactor})`});
  if(motion==='zoomIn'||motion==='reveal')return [still,zoom];
  if(motion==='zoomOut')return [zoom,still];
  if(motion==='living'){
    const start=move(-.10,.05,.33);
    return [start,move(.13,-.08,.84),start];
  }
  if(motion==='breath'){
    const rest=move(0,.06,.24);
    return [rest,move(0,-.12,.93),rest];
  }
  if(motion==='tension'){
    const center=move(0,0,.18);
    return [center,move(-.05,.03,.18),move(.045,-.04,.18),move(-.025,-.025,.18),center];
  }
  const shift=intensity*.45;
  return [-shift,shift].map(percent=>({transform:`translateX(${percent}%) ${zoom.transform}`}));
}

function atmosphere(motion,intensity){
  if(motion==='reveal')return [{opacity:.68},{opacity:0,offset:.68},{opacity:0}];
  if(motion==='breath'&&intensity){
    return [{opacity:.20},{opacity:.20+intensity*.012},{opacity:.20}];
  }
  return null;
}

export class CinematicFrame{
  constructor(element,{mount=null}={}){
    this.element=element;
    this.mount=mount;
    this.generation=0;
    this.animations=[];
    this.element.style.setProperty('--cinematic-fade',CINEMATIC_FADE_MS+'ms');
  }
  cancelTimers(){
    clearTimeout(this.automaticTimer);
    clearTimeout(this.fadeTimer);
    this.resolveFade?.(false);
    this.resolveFade=null;
  }
  async show(asset,item,onEnd){
    const generation=++this.generation;
    this.cancelTimers();
    await checkCinematicImage(asset);
    if(generation!==this.generation)return false;
    const url=URL.createObjectURL(asset),image=this.element.ownerDocument.createElement('img');
    image.alt=item.name;
    image.src=url;
    try{
      await image.decode();
      if(generation!==this.generation)return false;
      if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>40000000){
        throw Error('Use uma imagem com até 40 megapixels.');
      }
      this.animations.forEach(animation=>animation.cancel());
      this.animations=[];
      this.element.replaceChildren(image);
      if(this.mount&&!this.element.isConnected)this.mount.append(this.element);
      if(this.element.hidden){
        this.element.hidden=false;
        this.element.getBoundingClientRect();
      }
      this.element.classList.add('cinematic-visible');
      const duration=item.seconds*1000,{ending,hold}=cinematicEnding(item);
      if(!reduced()){
        const timing={duration,fill:'both',iterations:ending==='loop'?Infinity:1};
        const frames=cinematicFrames(item).map(frame=>({...frame,easing:'ease-in-out'}));
        this.animations.push(image.animate(frames,timing));
        const effect=atmosphere(item.motion,item.intensity);
        if(effect){
          const shade=this.element.ownerDocument.createElement('span');
          shade.className='cinematic-atmosphere'+(item.motion==='reveal'?' cinematic-shade':'');
          shade.setAttribute('aria-hidden','true');
          this.element.append(shade);
          this.animations.push(shade.animate(effect.map(frame=>({...frame,easing:'ease-in-out'})),timing));
        }
      }
      if(ending==='auto')this.automaticTimer=setTimeout(async()=>{
        if(generation===this.generation&&await this.clear())onEnd?.();
      },duration+hold*1000);
      return true;
    }finally{URL.revokeObjectURL(url);}
  }
  clear({immediate=false}={}){
    const generation=++this.generation;
    this.cancelTimers();
    this.element.classList.remove('cinematic-visible');
    return new Promise(resolve=>{
      const finish=()=>{
        if(generation!==this.generation){resolve(false);return;}
        this.resolveFade=null;
        this.animations.forEach(animation=>animation.cancel());
        this.animations=[];
        this.element.replaceChildren();
        this.element.hidden=true;
        if(this.mount)this.element.remove();
        resolve(true);
      };
      if(immediate||this.element.hidden||reduced())finish();
      else{
        this.resolveFade=resolve;
        this.fadeTimer=setTimeout(finish,CINEMATIC_FADE_MS+fadeBuffer);
      }
    });
  }
}
