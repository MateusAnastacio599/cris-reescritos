import {sceneSpan} from './cinematic-timing.js';
import {animateTimedFX} from './cinematic-fx.js';
import {animateDirectorLights} from './cinematic-light-player.js';
import {cameraTransform} from './cinematic-direction-model.js';
import {animateDirectionCamera,animateLayerEffects,animateLighting} from './cinematic-direction-player.js';
import {loadComposition,fitComposition,animateComposition} from './cinematic-composition.js';
import {checkCinematicImage,cinematicEnding,cinematicFades} from './cinematic-model.js';
import {cinematicMotion,mountMotionNotice} from './cinematic-motion.js';
const fadeBuffer=30;
export const CINEMATIC_FADE_MS=300;

export function cinematicFrames({motion,intensity},reducedMotion=false){
  const still={transform:'scale(1)'};
  if(reducedMotion||motion==='static'||!intensity)return [still,still];
  const strength=intensity/100;
  const zoom={transform:`scale(${1+strength})`};
  const move=(x,y,zoomFactor)=>({transform:`translate(${x*intensity}%, ${y*intensity}%) scale(${1+strength*zoomFactor})`});
  if(motion==='zoomIn'||motion==='reveal'||motion==='apparition')return [still,zoom];
  if(motion==='zoomOut')return [zoom,still];
  if(motion==='living'){
    const start=move(0,0,.33);
    return [start,move(0,0,.84),start];
  }
  if(motion==='breath'){
    const rest=move(0,.06,.24);
    return [rest,move(0,-.12,.93),rest];
  }
  if(motion==='memory'){
    const rest=move(-.04,.03,.30);
    return [{...rest,filter:'sepia(.16) brightness(1.04) blur(.2px)'},
      {...move(.04,-.03,.70),filter:'sepia(.22) brightness(1.10) blur(.7px)'},
      {...rest,filter:'sepia(.16) brightness(1.04) blur(.2px)'}];
  }
  if(motion==='tension'){
    const center=move(0,0,.18);
    return [center,move(-.05,.03,.18),move(.045,-.04,.18),move(-.025,-.025,.18),center];
  }
  const shift=intensity*.45;
  return [-shift,shift].map(percent=>({transform:`translateX(${percent}%) ${zoom.transform}`}));
}

function atmosphere(motion,intensity){
  if(motion==='apparition')return [{opacity:.82},{opacity:.12,offset:.65},{opacity:0}];
  if(motion==='memory'&&intensity)return [{opacity:.16},{opacity:.28},{opacity:.16}];
  if(motion==='reveal')return [{opacity:.68},{opacity:0,offset:.68},{opacity:0}];
  if(motion==='breath'&&intensity){
    return [{opacity:.20},{opacity:.20+intensity*.012},{opacity:.20}];
  }
  return null;
}

export class CinematicFrame{
  constructor(element,{mount=null,motion=cinematicMotion(),onMotion=()=>{},onWarning=()=>{}}={}){
    this.element=element;
    this.mount=mount;
    this.motion=motion;
    this.onMotion=onMotion;this.onWarning=onWarning;this.warnings=new Set();
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
    this.warnings.clear();
    this.loading?.abort();
    const loading=new AbortController();this.loading=loading;
    if(item.layers?.length||item.backgroundVideo||item.camera||item.lighting||item.motion==='custom'){
      const resources=asset instanceof Blob?{[item.imageId]:asset}:asset;
      const composition=await loadComposition(resources,item,this.element.ownerDocument,{signal:loading.signal,video:true,warn:message=>{if(generation!==this.generation)return;this.warnings.add(message);this.onWarning(message);if(this.item)this.showWarnings();}});
      if(generation!==this.generation){composition.dispose();return false;}
      this.loading=null;
      this.install(composition.world,item,onEnd,generation,composition);
      return true;
    }
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
      this.loading=null;
      this.install(image,item,onEnd,generation);
      return true;
    }finally{URL.revokeObjectURL(url);}
  }
  install(image,item,onEnd,generation,composition=null){
    this.stopEffects();
    this.disposeComposition();
    this.element.replaceChildren(image);
    this.composition=composition;
    this.item=item;
    this.image=image;
    this.fadeOut=cinematicFades(item).fadeOut*1000;
    if(this.mount&&!this.element.isConnected)this.mount.append(this.element);
    this.element.classList.remove('cinematic-visible');
    this.element.style.setProperty('--cinematic-fade','0ms');
    this.element.hidden=false;
    this.element.getBoundingClientRect();
    this.element.style.setProperty('--cinematic-fade',cinematicFades(item).fadeIn*1000+'ms');
    this.element.classList.add('cinematic-visible');
    if(composition)this.removeFit=fitComposition(composition,this.element);
    this.position=0;this.playing=true;this.onEnd=onEnd;this.startedAt=performance.now();
    this.startEffects();
    this.unsubscribeMotion=this.motion.subscribe(()=>this.startEffects());
    this.scheduleEnd(generation);
    if(composition?.videos.length)this.videoTimer=setInterval(()=>this.syncVideos(),80);
  }
  time(){return this.item?Math.max(0,(this.position??0)+(this.playing?(performance.now()-this.startedAt)/1000:0)):0;}
  scheduleEnd(generation=this.generation){
    clearTimeout(this.automaticTimer);
    if(!this.item||!this.playing||cinematicEnding(this.item).ending!=='auto')return;
    const remaining=Math.max(0,sceneSpan(this.item)-this.time());
    this.automaticTimer=setTimeout(async()=>{
      const callback=this.onEnd;
      if(generation===this.generation&&await this.clear())callback?.();
    },remaining*1000);
  }
  syncVideos(force=false){const time=this.time();for(const video of this.composition?.videos??[])video.sync(video.config.window&&this.item?.ending==='loop'?time%sceneSpan(this.item):time,this.playing,this.motionReduced,force);}
  pause(){
    if(!this.item||!this.playing)return;
    this.position=this.time();this.playing=false;clearTimeout(this.automaticTimer);
    for(const animation of this.animations){animation.pause();animation.currentTime=this.position*1000;}this.syncVideos(true);
  }
  play(){
    if(!this.item||this.playing)return;
    this.startedAt=performance.now();this.playing=true;
    for(const animation of this.animations)animation.play();this.scheduleEnd();this.syncVideos();
  }
  seek(seconds){
    if(!this.item)return;
    this.position=Math.min(sceneSpan(this.item),Math.max(0,seconds));this.startedAt=performance.now();
    for(const animation of this.animations)animation.currentTime=this.position*1000;
    this.scheduleEnd();this.syncVideos(true);
  }
  restart(){this.seek(0);this.play();}

  disposeComposition(){
    clearInterval(this.videoTimer);this.videoTimer=null;
    this.removeFit?.();this.removeFit=null;
    this.composition?.dispose();this.composition=null;
  }
  stopEffects(){
    this.unsubscribeMotion?.();
    this.unsubscribeMotion=null;
    this.removeNotice?.();
    this.removeNotice=null;
    this.animations.forEach(animation=>animation.cancel());
    this.animations=[];
  }
  startEffects(){
    this.animations.forEach(animation=>animation.cancel());
    this.animations=[];
    this.removeNotice?.();
    this.removeNotice=null;
    const {item,image}=this;
    this.element.replaceChildren(image);
    this.motionReduced=this.motion.reduced;
    if(this.composition?.camera)this.composition.camera.style.transform=this.motionReduced&&item.camera?cameraTransform(item.camera.from):'';
    if(!this.motionReduced){
      const timing={duration:item.seconds*1000,fill:'both',iterations:cinematicEnding(item).ending==='loop'?Infinity:1};
      const frames=cinematicFrames(item).map(frame=>({...frame,easing:'ease-in-out'}));
      if(item.motion==='apparition'&&item.intensity){
        frames[0].filter='brightness(.75) blur(1.5px)';
        frames.at(-1).filter='brightness(1) blur(0px)';
      }
      const currentTime=timing.iterations===Infinity?this.time()*1000:Math.min(this.time()*1000,timing.duration);
      if(this.composition){
        if(item.camera||item.motion==='custom'){
          this.animations.push(...animateDirectionCamera(this.composition,item,timing,this.time()*1000));

        }else this.animations.push(...animateComposition(this.composition,item,frames,timing,this.time()*1000));
        this.animations.push(...animateLayerEffects(this.composition,this.time()*1000),...animateLighting(this.composition.pulses,this.time()*1000));
      }
      else{
        const camera=image.animate(frames,timing);camera.currentTime=currentTime;this.animations.push(camera);
      }
      const effect=atmosphere(item.motion,item.intensity);
      if(effect){
        const shade=this.element.ownerDocument.createElement('span');
        shade.className='cinematic-atmosphere'+(['reveal','apparition'].includes(item.motion)?' cinematic-shade':'');
        shade.setAttribute('aria-hidden','true');
        this.element.append(shade);
        const light=shade.animate(effect.map(frame=>({...frame,easing:'ease-in-out'})),timing);
        light.currentTime=currentTime;
        this.animations.push(light);
      }
    }
    if(this.composition)this.animations.push(...animateTimedFX(this.composition,item,this.time()*1000,{reduced:this.motionReduced}),...animateDirectorLights(this.composition,item,this.time()*1000,this.motionReduced));
    if(!this.playing)for(const animation of this.animations)animation.pause();
    this.syncVideos();
    if(this.mount&&this.motion.media?.matches){
      const notice=this.element.ownerDocument.createElement('aside');
      notice.className='cinematic-motion-notice';
      notice.setAttribute('role','status');
      this.element.append(notice);
      this.removeNotice=mountMotionNotice(notice,this.motion);
    }
    this.showWarnings();
    this.onMotion(this.motionReduced);
  }
  showWarnings(){
    this.warningNode?.remove();this.warningNode=null;
    if(!this.warnings.size||!this.item)return;
    const node=this.element.ownerDocument.createElement('aside');node.className='cinematic-media-notice';node.setAttribute('role','status');node.textContent=[...this.warnings].join(' ');this.element.append(node);this.warningNode=node;
  }
  clear({immediate=false,fadeOut=this.fadeOut??CINEMATIC_FADE_MS}={}){
    const generation=++this.generation;
    this.cancelTimers();
    this.loading?.abort();this.loading=null;
    this.unsubscribeMotion?.();
    this.unsubscribeMotion=null;
    this.pause();
    this.element.style.setProperty('--cinematic-fade',fadeOut+'ms');
    this.element.classList.remove('cinematic-visible');
    return new Promise(resolve=>{
      const finish=()=>{
        if(generation!==this.generation){resolve(false);return;}
        this.resolveFade=null;
        this.stopEffects();
        this.disposeComposition();
        this.item=null;this.playing=false;clearInterval(this.videoTimer);
        this.image=null;
        this.element.replaceChildren();
        this.element.hidden=true;
        if(this.mount)this.element.remove();
        resolve(true);
      };
      if(immediate||this.element.hidden||!fadeOut)finish();
      else{
        this.resolveFade=resolve;
        this.fadeTimer=setTimeout(finish,fadeOut+fadeBuffer);
      }
    });
  }
}
