// Mobile presentation gate. Playback remains in the existing CinematicFrame.
export const mobilePresentation=({width,height,coarse=false})=>Math.min(width,height)<=600&&(coarse||width<=600);
const abortError=()=>new DOMException('Apresentação cancelada.','AbortError');
export class CinematicPresentation{
 constructor({document=globalThis.document,screen=globalThis.screen,viewport=()=>({width:innerWidth,height:innerHeight,coarse:matchMedia('(pointer:coarse)').matches}),controls,status=()=>{}}={}){Object.assign(this,{document,screen,viewport,controls,status});}
 async begin({frame,signal}){
  const ticket=this.sequence=(this.sequence||0)+1;await this.release();if(ticket!==this.sequence)throw abortError();this.error?.remove();signal?.throwIfAborted();if(!mobilePresentation(this.viewport()))return false;
  const d=this.document,root=d.createElement('section');root.className='cinematic-presentation cinematic-board-layer';root.setAttribute('aria-label','Modo de apresentação');
  const gate=d.createElement('div');gate.className='cinematic-mobile-gate';gate.setAttribute('role','status');
  gate.innerHTML='<div class="cinematic-mobile-card"><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="23" y="13" width="22" height="38" rx="4" transform="rotate(-25 34 32)"/><path d="M12 29a22 22 0 0 1 31-18m-2-7 4 8-9 1M52 35a22 22 0 0 1-31 18m2 7-4-8 9-1"/></svg><h2>Vire o celular para melhor visualização</h2><p>Preparando a apresentação…</p><button type="button" data-watch disabled>Assistir Cinematic</button><button type="button" data-inline disabled>Continuar sem tela cheia</button></div>';
  root.append(gate);d.body.append(root);
  const record=this.current={root,gate,frame,signal,mount:frame.mount,fit:frame.fit,locked:false,playing:false};
  frame.mount=root;frame.fit='contain';if(this.controls)root.append(this.controls);
  record.resize=()=>{const v=this.viewport();gate.querySelector('h2').textContent=v.width>v.height?'Pronto para a apresentação':'Vire o celular para melhor visualização';};record.resize();d.defaultView?.addEventListener('resize',record.resize);gate.addEventListener('keydown',event=>event.stopPropagation());
  d.body.classList.add('cris-cinematic-active','cris-cinematic-preparing');
  record.abort=()=>{record.reject?.(abortError());};signal?.addEventListener('abort',record.abort,{once:true});this.status('mobile-preparing');return true;
 }
 ready(){if(this.current)this.current.gate.querySelector('p').textContent='Tudo pronto. Toque para assistir.';}
 start(start,{signal}={}){
  const record=this.current;if(!record)return start();
  if(signal?.aborted)return Promise.reject(abortError());
  this.status('awaiting-gesture');return new Promise((resolve,reject)=>{
   record.reject=reject;const watch=record.gate.querySelector('[data-watch]'),inline=record.gate.querySelector('[data-inline]');watch.disabled=inline.disabled=false;watch.focus?.({preventScroll:true});
   const begin=fullscreen=>{
    if(record.starting||this.current!==record||signal?.aborted)return;record.starting=true;watch.disabled=inline.disabled=true;
    this.document.body.classList.remove('cris-cinematic-preparing');record.gate.hidden=true;
    // Invoke playback within the gesture, before awaiting fullscreen/orientation.
    // All WebM layers are muted, inline, decoded and paused by frame.prepare().
    let playback;try{playback=start();}catch(error){reject(error);return;}
    if(fullscreen)void this.requestMode(record);
    Promise.resolve(playback).then(shown=>{if(this.current!==record||signal?.aborted){reject(abortError());return;}record.playing=!!shown;resolve(shown);},reject);
   };
   watch.onclick=()=>begin(true);inline.onclick=()=>begin(false);
  });
 }
 emit(record,phase){if(this.current===record)this.status(phase);}
 async requestMode(record){
  const {root}=record,d=this.document;if(d.fullscreenElement)return;
  this.emit(record,'requesting-fullscreen');
  if(typeof root.requestFullscreen!=='function'){this.emit(record,'fullscreen-unsupported');return;}
  try{
   await root.requestFullscreen({navigationUI:'hide'});
   if(this.current!==record||record.signal?.aborted){if(d.fullscreenElement===root)await d.exitFullscreen?.();return;}
   record.fullscreen=d.fullscreenElement===root;this.emit(record,record.fullscreen?'fullscreen-entered':'fullscreen-unavailable');
   if(!record.fullscreen||typeof this.screen?.orientation?.lock!=='function')return;
   this.emit(record,'requesting-landscape');
   record.lockRequested=true;try{await this.screen.orientation.lock('landscape');if(this.current!==record||record.signal?.aborted){if(!this.current?.locked)this.screen.orientation.unlock?.();return;}record.locked=true;this.emit(record,'landscape-locked');}catch{this.emit(record,'landscape-unavailable');}
  }catch{this.emit(record,'fullscreen-unavailable');}
 }
 end(){this.sequence=(this.sequence||0)+1;return this.release();}
 release(){if(this.cleanup)return this.cleanup;return this.cleanup=this.finish().finally(()=>{this.cleanup=null;});}
 async finish(){
  const r=this.current;if(!r)return;this.current=null;r.reject?.(abortError());r.signal?.removeEventListener('abort',r.abort);this.document.defaultView?.removeEventListener('resize',r.resize);
  if(r.locked||r.lockRequested)try{this.screen.orientation.unlock?.();}catch{}
  if(this.document.fullscreenElement===r.root)try{await this.document.exitFullscreen?.();}catch{}
  if(this.current){r.root.remove();return;}r.frame.mount=r.mount;r.frame.fit=r.fit;if(this.controls)this.document.body.append(this.controls);r.root.remove();
  this.document.body.classList.remove('cris-cinematic-preparing','cris-cinematic-active','cris-cinematic-controls-open');
 }
 failure(){
  this.error?.remove();const note=this.document.createElement('aside');note.className='cinematic-start-error';note.setAttribute('role','alert');
  const text=this.document.createElement('span');text.textContent='Não foi possível iniciar a apresentação. Peça ao mestre para apresentar novamente.';
  const close=this.document.createElement('button');close.textContent='Fechar';close.type='button';close.onclick=()=>note.remove();note.append(text,close);this.document.body.append(note);this.error=note;
 }
 close(){this.error?.remove();return this.end();}
}
