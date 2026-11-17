import {checkCinematicImage} from './cinematic-model.js';

export function cinematicFrames({motion,intensity},reducedMotion=false){
  const still={transform:'scale(1)'};
  if(reducedMotion||motion==='static'||!intensity)return [still,still];
  const zoom={transform:`scale(${1+intensity/100})`};
  if(motion==='zoomIn')return [still,zoom];
  if(motion==='zoomOut')return [zoom,still];
  const shift=intensity*.45;
  return [-shift,shift].map(percent=>({transform:`translateX(${percent}%) ${zoom.transform}`}));
}

export class CinematicFrame{
  constructor(element){this.element=element;this.generation=0;}
  async show(asset,item){
    const generation=++this.generation;
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
      this.animation?.cancel();
      this.element.replaceChildren(image);
      if(this.element.hidden){
        this.element.hidden=false;
        // Commit the initial opacity once so the first image fades in.
        this.element.getBoundingClientRect();
      }
      this.element.classList.add('cinematic-visible');
      this.animation=image.animate(cinematicFrames(item,matchMedia('(prefers-reduced-motion: reduce)').matches),{
        duration:item.seconds*1000,easing:'ease-in-out',fill:'both',
      });
      return true;
    }finally{URL.revokeObjectURL(url);}
  }
  clear({immediate=false}={}){
    const generation=++this.generation;
    this.element.classList.remove('cinematic-visible');
    const finish=()=>{
      if(generation!==this.generation)return;
      this.animation?.cancel();
      this.element.replaceChildren();
      this.element.hidden=true;
    };
    if(immediate||this.element.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)finish();
    else setTimeout(finish,240);
  }
}
