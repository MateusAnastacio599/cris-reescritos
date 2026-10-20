const POSITION_KEY='cris-director:youtube-window:v1';

/** Mantém a janela inteira acima do dock, inclusive depois de girar o celular. */
export function clampPlayerPosition(position,{width,height,playerWidth,playerHeight,dockTop=height}){
  const margin=8,maxX=Math.max(margin,width-playerWidth-margin),maxY=Math.max(margin,Math.min(height,dockTop)-playerHeight-margin);
  const coordinate=(value,fallback)=>Number.isFinite(value)?value:fallback;
  return {x:Math.max(margin,Math.min(maxX,coordinate(position?.x,maxX))),y:Math.max(margin,Math.min(maxY,coordinate(position?.y,maxY)))};
}

export function setupYouTubeWindow({panel,dock,moveButton,sizeButton,getCompact,setCompact,storage=localStorage}){
  const handle=panel.querySelector('.youtube-drag-handle');let position=null,drag=null;
  try{position=JSON.parse(storage.getItem(POSITION_KEY));}catch{}
  const bounds=()=>({width:window.innerWidth,height:window.innerHeight,playerWidth:panel.offsetWidth,playerHeight:panel.offsetHeight,dockTop:dock.getBoundingClientRect().top});
  const persist=()=>{try{storage.setItem(POSITION_KEY,JSON.stringify(position));}catch{}};
  const place=(value=position)=>{
    if(panel.hidden)return;
    position=clampPlayerPosition(value,bounds());
    panel.style.left=`${position.x}px`;panel.style.top=`${position.y}px`;panel.style.right='auto';panel.style.bottom='auto';
  };
  panel.classList.toggle('compact',getCompact());
  const updateSizeLabel=()=>{sizeButton.setAttribute('aria-label',panel.classList.contains('compact')?'Ampliar vídeo':'Compactar vídeo');sizeButton.title=sizeButton.getAttribute('aria-label');};
  updateSizeLabel();
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||drag)return;
    const rect=panel.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
    handle.setPointerCapture(event.pointerId);panel.classList.add('dragging');event.preventDefault();
  });
  handle.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId)place({x:drag.left+event.clientX-drag.x,y:drag.top+event.clientY-drag.y});});
  const finish=event=>{if(drag?.id!==event.pointerId)return;drag=null;panel.classList.remove('dragging');persist();};
  handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
  handle.addEventListener('keydown',event=>{
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta)return;
    event.preventDefault();event.stopPropagation();const rect=panel.getBoundingClientRect(),step=event.shiftKey?40:12;
    place({x:rect.left+delta[0]*step,y:rect.top+delta[1]*step});persist();
  });
  moveButton.onclick=()=>{const rect=panel.getBoundingClientRect();place({x:rect.left<window.innerWidth/2?window.innerWidth:8,y:rect.top});persist();};
  sizeButton.onclick=()=>{const compact=panel.classList.toggle('compact');setCompact(compact);updateSizeLabel();place();persist();};
  window.addEventListener('resize',()=>place());window.visualViewport?.addEventListener('resize',()=>place());
  // Observar somente geometria/visibilidade; nunca recriar o iframe ao mover.
  new MutationObserver(()=>place()).observe(panel,{attributes:true,attributeFilter:['hidden']});
  new ResizeObserver(()=>place()).observe(dock);
  place();
}
