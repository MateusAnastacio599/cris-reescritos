import {mountDirectorLights} from './cinematic-light-player.js?v=directorcinematic02';
import {CinematicVideoLayer} from './cinematic-video.js?v=directorcinematic02';
import {mountLighting} from './cinematic-direction-player.js?v=directorcinematic02';
import {validateCompositionMedia,matchesCinematicDimensions} from './cinematic-media.js?v=directorcinematic02';

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
  const anchor=layer.anchor??{x:.5,y:.5};
  element.style.transform=`translate(${-anchor.x*100}%, ${-anchor.y*100}%) rotate(${layer.rotation??0}deg)`;
  element.style.transformOrigin=`${anchor.x*100}% ${anchor.y*100}%`;
  element.style.opacity=layer.opacity??1;
}

export async function loadComposition(asset,item,document,{signal,video=false,warn=()=>{}}={}){
  const dimensions=await validateCompositionMedia(item,asset);
  if(signal?.aborted)throw new DOMException('Composição cancelada.','AbortError');
  const world=document.createElement('div');world.className='cinematic-world';
  const nodes=[],urls=new Map(),videos=[];
  const camera=document.createElement('div');camera.className='cinematic-camera';
  const jitter=document.createElement('div');jitter.className='cinematic-camera-jitter';jitter.append(camera);world.append(jitter);
  const dispose=()=>{
    signal?.removeEventListener('abort',dispose);
    for(const player of videos)player.dispose();
    for(const image of nodes)image.removeAttribute('src');
    for(const url of urls.values())URL.revokeObjectURL(url);
    urls.clear();
  };
  signal?.addEventListener('abort',dispose,{once:true});
  const planes=[];
  try{
    const entries=[{id:'background',name:item.name,imageId:item.imageId,visible:true,...(item.backgroundVideo?{video:item.backgroundVideo}:{})},...(item.layers??[])];
    for(const entry of entries){
      if(signal?.aborted)throw new DOMException('Composição cancelada.','AbortError');
      const effects=[];let visibility;
      const plane=document.createElement('div');plane.className='cinematic-plane';plane.dataset.plane=entry.id;
      const image=document.createElement('img');nodes.push(image);
      if(!urls.has(entry.imageId))urls.set(entry.imageId,URL.createObjectURL(asset[entry.imageId]));
      image.alt=entry.name;image.draggable=false;image.src=urls.get(entry.imageId);
      await image.decode();if(signal?.aborted)throw new DOMException('Composição cancelada.','AbortError');
      const size=dimensions.get(entry.imageId);
      if(!matchesCinematicDimensions(asset[entry.imageId],size,image.naturalWidth,image.naturalHeight))throw Error('As dimensões decodificadas da imagem não correspondem ao arquivo.');
      plane.hidden=!entry.visible;
      if(entry.id==='background'){image.className='cinematic-background';plane.append(image);}
      else{
        const position=document.createElement('div');position.className='cinematic-layer-position';
        position.dataset.cinematicLayer=entry.id;position.dataset.locked=String(!!entry.locked);positionCinematicLayer(position,entry);
        visibility=document.createElement('div');visibility.className='cinematic-layer-visibility';position.append(visibility);let parent=visibility;
        for(const effect of entry.effects??[]){const node=document.createElement('div');node.className='cinematic-layer-effect';node.style.transformOrigin=`${(effect.anchor?.x??entry.anchor?.x??.5)*100}% ${(effect.anchor?.y??entry.anchor?.y??.5)*100}%`;parent.append(node);parent=node;effects.push({node,effect});}
        parent.append(image);plane.append(position);
        if(video&&entry.video){const player=new CinematicVideoLayer({document,container:parent,fallback:image,blob:asset[entry.video.mediaId],config:entry.video,span:item.sceneDuration??(item.seconds+(item.hold??2)),metadata:dimensions.get(entry.video.mediaId),warn});videos.push(player);const started=performance.now();player.preparing=player.prepare().catch(()=>{if(!player.closed)player.fail();}).finally(()=>player.prepareMs=performance.now()-started);if(signal?.aborted)throw new DOMException('Composição cancelada.','AbortError');}
      }
      if(video&&entry.id==='background'&&entry.video){const player=new CinematicVideoLayer({document,container:plane,fallback:image,blob:asset[entry.video.mediaId],config:entry.video,span:item.sceneDuration??(item.seconds+(item.hold??2)),metadata:dimensions.get(entry.video.mediaId),warn});videos.push(player);const started=performance.now();player.preparing=player.prepare().catch(()=>{if(!player.closed)player.fail();}).finally(()=>player.prepareMs=performance.now()-started);}
      camera.append(plane);planes.push({plane,entry,effects,visibility});
    }
    const background=nodes[0];
    const composition={world,camera,jitter,planes,videos,aspect:background.naturalWidth/background.naturalHeight,ready:()=>Promise.all(videos.map(player=>player.preparing)),dispose};
    composition.pulses=mountLighting(composition,item.lighting,document);
    mountDirectorLights(composition,item.lighting,document);return composition;
  }catch(error){dispose();throw error;}
}

export function fitComposition(composition,viewport,{contain=false}={}){
  // Fit in the element's own layout coordinates. Its visual bounding rectangle
  // already includes presentation rotation (or editor/ancestor scale); feeding
  // that rectangle back into the world applies cover in the wrong axes.
  const fit=entries=>{
    const bounds=entries?.[0]?.contentRect??{width:viewport.clientWidth,height:viewport.clientHeight};
    if(!(bounds.width>0&&bounds.height>0))return;
    const size=contain?{width:Math.min(bounds.width,bounds.height*composition.aspect),height:Math.min(bounds.height,bounds.width/composition.aspect)}:compositionSize(bounds.width,bounds.height,composition.aspect);
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
