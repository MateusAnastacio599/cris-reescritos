import {validateCompositionMedia,matchesCinematicDimensions} from './cinematic-media.js';

export function compositionSize(width,height,aspect){
  const w=Math.max(width,height*aspect);
  return {width:w,height:w/aspect};
}

// Transform whole planes. A foreground image retains its original proportions.
export function parallaxFrames(frames,factor,cover=false){
  return frames.map(({filter,...frame})=>{
    let x=0,y=0,zoom=1;
    const translate=frame.transform.match(/translate\(([-\d.]+)%, ([-\d.]+)%\)/);
    const horizontal=frame.transform.match(/translateX\(([-\d.]+)%\)/);
    const scale=frame.transform.match(/scale\(([-\d.]+)\)/);
    if(translate){x=Number(translate[1])*factor;y=Number(translate[2])*factor;}
    if(horizontal)x=Number(horizontal[1])*factor;
    if(scale)zoom=1+(Number(scale[1])-1)*factor;
    if(cover)zoom=Math.max(zoom,1+Math.max(Math.abs(x),Math.abs(y))*.02+.006);
    return {...frame,transform:`translate(${x}%, ${y}%) scale(${zoom})`};
  });
}

export function positionCinematicLayer(element,layer){
  element.style.left=layer.x*100+'%';
  element.style.top=layer.y*100+'%';
  element.style.width=layer.scale*100+'%';
}

export async function loadComposition(asset,item,document,{signal}={}){
  const dimensions=await validateCompositionMedia(item,asset);
  signal?.throwIfAborted();
  const world=document.createElement('div');world.className='cinematic-world';
  const nodes=[],urls=new Map();
  const dispose=()=>{
    signal?.removeEventListener('abort',dispose);
    for(const image of nodes)image.removeAttribute('src');
    for(const url of urls.values())URL.revokeObjectURL(url);
    urls.clear();
  };
  signal?.addEventListener('abort',dispose,{once:true});
  const planes=[];
  try{
    const entries=[{id:'background',name:item.name,imageId:item.imageId,visible:true},...item.layers];
    for(const entry of entries){
      signal?.throwIfAborted();
      const plane=document.createElement('div');plane.className='cinematic-plane';plane.dataset.plane=entry.id;
      const image=document.createElement('img');nodes.push(image);
      if(!urls.has(entry.imageId))urls.set(entry.imageId,URL.createObjectURL(asset[entry.imageId]));
      image.alt=entry.name;image.draggable=false;image.src=urls.get(entry.imageId);
      await image.decode();signal?.throwIfAborted();
      const size=dimensions.get(entry.imageId);
      if(!matchesCinematicDimensions(asset[entry.imageId],size,image.naturalWidth,image.naturalHeight))throw Error('As dimensões decodificadas da imagem não correspondem ao arquivo.');
      plane.hidden=!entry.visible;
      if(entry.id==='background'){image.className='cinematic-background';plane.append(image);}
      else{
        const position=document.createElement('div');position.className='cinematic-layer-position';
        position.dataset.cinematicLayer=entry.id;positionCinematicLayer(position,entry);position.append(image);plane.append(position);
      }
      world.append(plane);planes.push({plane,entry});
    }
    const background=nodes[0];
    return {world,planes,aspect:background.naturalWidth/background.naturalHeight,dispose};
  }catch(error){dispose();throw error;}
}

export function fitComposition(composition,viewport){
  const fit=()=>{
    const bounds=viewport.getBoundingClientRect(),size=compositionSize(bounds.width,bounds.height,composition.aspect);
    composition.world.style.width=size.width+'px';composition.world.style.height=size.height+'px';
  };
  fit();
  const observer=new ResizeObserver(fit);observer.observe(viewport);
  return ()=>observer.disconnect();
}

export function animateComposition(composition,item,frames,timing,currentTime){
  const animations=[];
  for(const {plane,entry} of composition.planes){
    if(plane.hidden)continue;
    const factor=entry.id==='background'?.35:entry.parallax;
    const animation=plane.animate(parallaxFrames(frames,factor,entry.id==='background'),timing);
    animation.currentTime=currentTime;animations.push(animation);
  }
  if(frames.some(frame=>frame.filter)){
    const animation=composition.world.animate(frames.map(frame=>({filter:frame.filter??'none',easing:frame.easing})),timing);
    animation.currentTime=currentTime;animations.push(animation);
  }
  return animations;
}
