// Automatic mobile presentation; rotation is a hint, never permission. Playback remains in the existing CinematicFrame.
export const mobilePresentation=({width,height,coarse=false})=>Math.min(width,height)<=600&&(coarse||width<=600);
const abortError=()=>new DOMException('Apresentação cancelada.','AbortError');
export const CINEMATIC_PRESENTATION_BUILD='live01b4';
export class CinematicPresentation{
 constructor({document=globalThis.document,screen=globalThis.screen,viewport=()=>({width:innerWidth,height:innerHeight,coarse:matchMedia('(pointer:coarse)').matches}),controls,status=()=>{}}={}){Object.assign(this,{document,screen,viewport,controls,status});}
 async begin({frame,signal}){
  const ticket=this.sequence=(this.sequence||0)+1;await this.release();if(ticket!==this.sequence)throw abortError();this.error?.remove();if(signal?.aborted)throw abortError();if(!mobilePresentation(this.viewport()))return false;
  const d=this.document,root=d.createElement('section');root.className='cinematic-presentation cinematic-board-layer cinematic-staging';root.setAttribute('aria-label','Modo de apresentação');
  const gate=d.createElement('div');gate.className='cinematic-mobile-gate';gate.setAttribute('role','status');
  gate.innerHTML='<div class="cinematic-mobile-card"><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="23" y="13" width="22" height="38" rx="4" transform="rotate(-25 34 32)"/><path d="M12 29a22 22 0 0 1 31-18m-2-7 4 8-9 1M52 35a22 22 0 0 1-31 18m2 7-4-8 9-1"/></svg><h2>Vire o celular</h2><p>A apresentação vai começar.</p></div>';
  root.append(gate);d.body.append(root);
  const record=this.current={root,gate,frame,signal,mount:frame.mount,fit:frame.fit,locked:false,playing:false};
  frame.mount=root;frame.fit='contain';if(this.controls)root.append(this.controls);
  record.resize=()=>{const v=this.viewport();gate.querySelector('h2').textContent=v.width>v.height?'A apresentação vai começar':'Vire o celular';};record.resize();d.defaultView?.addEventListener('resize',record.resize);gate.addEventListener('keydown',event=>event.stopPropagation());
  // Decode while connected, but keep the board usable until the common start.
  record.abort=()=>{record.reject?.(abortError());};signal?.addEventListener('abort',record.abort,{once:true});this.status('mobile-preparing');return true;
 }
 ready(){}
 countdown(delay){const r=this.current;if(!r)return;r.noticeTimer=setTimeout(()=>{if(this.current!==r)return;r.root.classList.remove('cinematic-staging');this.document.body.classList.add('cris-cinematic-active','cris-cinematic-preparing');},Math.max(0,delay-900));}
 async start(start,{signal}={}){
  const record=this.current;if(!record)return start();if(signal?.aborted)throw abortError();
  record.root.classList.remove('cinematic-staging');record.gate.hidden=true;this.document.body.classList.add('cris-cinematic-active');this.document.body.classList.remove('cris-cinematic-preparing');
  try{const shown=await start();if(this.current!==record||signal?.aborted)throw abortError();record.playing=!!shown;return shown;}
  catch(error){
   if(error?.name!=='NotAllowedError')throw error;
   this.emit(record,'autoplay-blocked');record.gate.hidden=false;record.gate.querySelector('h2').textContent='Toque para reproduzir';record.gate.querySelector('p').textContent='O navegador bloqueou o início automático.';
   const button=this.document.createElement('button');button.type='button';button.textContent='Reproduzir apresentação';record.gate.querySelector('.cinematic-mobile-card').append(button);
   return new Promise((resolve,reject)=>{record.reject=reject;button.onclick=()=>{if(this.current!==record||signal?.aborted)return;button.disabled=true;record.gate.hidden=true;Promise.resolve(start()).then(resolve,reject);};});
  }
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
  const r=this.current;if(!r)return;this.current=null;clearTimeout(r.noticeTimer);r.reject?.(abortError());r.signal?.removeEventListener('abort',r.abort);this.document.defaultView?.removeEventListener('resize',r.resize);
  if(r.locked||r.lockRequested)try{this.screen.orientation.unlock?.();}catch{}
  if(this.document.fullscreenElement===r.root)try{await this.document.exitFullscreen?.();}catch{}
  if(this.current){r.root.remove();return;}r.frame.mount=r.mount;r.frame.fit=r.fit;if(this.controls)this.document.body.append(this.controls);r.root.remove();
  this.document.body.classList.remove('cris-cinematic-preparing','cris-cinematic-active','cris-cinematic-controls-open');
 }
 failure({message,update=false}={}){
  this.error?.remove();const note=this.document.createElement('aside');note.className='cinematic-start-error';note.setAttribute('role','alert');
  const text=this.document.createElement('span');text.textContent=message||'Não foi possível iniciar a apresentação. Peça ao mestre para apresentar novamente.';
  if(update){const refresh=this.document.createElement('button');refresh.type='button';refresh.textContent='Atualizar CRIS';refresh.onclick=()=>this.document.defaultView?.location.reload();note.append(refresh);}
  const close=this.document.createElement('button');close.textContent='Fechar';close.type='button';close.onclick=()=>note.remove();note.append(text,close);this.document.body.append(note);this.error=note;
 }
 close(){this.error?.remove();return this.end();}
}
