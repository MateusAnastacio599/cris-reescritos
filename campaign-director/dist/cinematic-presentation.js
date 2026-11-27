// Coordinated presentation on every viewport; rotation is a hint, never permission. Playback remains in the existing CinematicFrame.
export const mobilePresentation=({width,height,coarse=false})=>Math.min(width,height)<=600&&(coarse||width<=600);
const abortError=()=>new DOMException('Apresentação cancelada.','AbortError');
export const CINEMATIC_PRESENTATION_BUILD='live01b5a';
export class CinematicPresentation{
 constructor({document=globalThis.document,screen=globalThis.screen,viewport=()=>({width:innerWidth,height:innerHeight,coarse:matchMedia('(pointer:coarse)').matches}),controls,status=()=>{},now=Date.now}={}){Object.assign(this,{document,screen,viewport,controls,status,now});}
 async begin({frame,signal,host=false}){
  const ticket=this.sequence=(this.sequence||0)+1;await this.release();if(ticket!==this.sequence)throw abortError();this.error?.remove();if(signal?.aborted)throw abortError();
  const d=this.document,root=d.createElement('section');root.className='cinematic-presentation cinematic-board-layer cinematic-staging'+(host?' cinematic-host':'');root.setAttribute('aria-label','Modo de apresentação');root.setAttribute('data-reduced-motion',String(!!frame.motion?.reduced));
  const gate=d.createElement('div');gate.className='cinematic-mobile-gate';gate.setAttribute('role','status');
  gate.innerHTML='<div class="cinematic-mobile-card"><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="23" y="13" width="22" height="38" rx="4" transform="rotate(-25 34 32)"/><path d="M12 29a22 22 0 0 1 31-18m-2-7 4 8-9 1M52 35a22 22 0 0 1-31 18m2 7-4-8 9-1"/></svg><h2>Vire o celular</h2><p>A apresentação vai começar.</p></div>';
  const count=d.createElement('output');count.className='cinematic-countdown';count.setAttribute('role','timer');count.setAttribute('aria-live','off');count.setAttribute('aria-label','Segundos até a apresentação');count.hidden=!host;gate.querySelector('.cinematic-mobile-card').append(count);
  root.append(gate);d.body.append(root);
  const record=this.current={root,gate,count,host,frame,signal,mount:frame.mount,fit:frame.fit,locked:false,playing:false};
  frame.mount=root;frame.fit='cover';if(this.controls)root.append(this.controls);
  record.resize=()=>{const v=this.viewport(),portrait=mobilePresentation(v)&&v.width<v.height;gate.querySelector('h2').textContent=host?'Avisando jogadores':portrait?'Vire o celular':'A cena vai começar';gate.querySelector('p').textContent=host?'A cena começa em instantes.':portrait?'Uma cena se aproxima. Assista na horizontal.':'Prepare-se para a próxima cena.';gate.setAttribute('data-rotation',String(!host&&portrait));};record.resize();d.defaultView?.addEventListener('resize',record.resize);gate.addEventListener('keydown',event=>event.stopPropagation());
  // Decode while connected, but keep the board usable until the common start.
  record.abort=()=>{clearInterval(record.countTimer);record.reject?.(abortError());};signal?.addEventListener('abort',record.abort,{once:true});this.status('preparing');return true;
 }
 ready(){}
 // This only renders the coordinator's deadline. It never schedules playback.
 countdown(delay){
  const r=this.current;if(!r||r.signal?.aborted)return;clearInterval(r.countTimer);
  const remaining=Math.max(0,Math.min(2000,delay));if(!remaining)return;
  r.deadline=this.now()+remaining;r.gate.hidden=false;r.root.classList.remove('cinematic-staging');r.root.classList.add('cinematic-preroll');
  this.document.body.classList.add('cris-cinematic-active','cris-cinematic-preparing');this.emit(r,'preroll');
  const tick=()=>{if(this.current!==r||r.signal?.aborted){clearInterval(r.countTimer);return;}const left=Math.max(0,r.deadline-this.now());r.count.textContent=(left/1000).toFixed(1);r.root.setAttribute('data-imminent',String(left<=500));if(!left){clearInterval(r.countTimer);if(r.host)r.gate.querySelector('h2').textContent='Iniciando';}};
  tick();r.countTimer=setInterval(tick,50);
 }
 async start(start,{signal}={}){
  const record=this.current;if(!record)return start();if(signal?.aborted)throw abortError();
  clearInterval(record.countTimer);record.count.hidden=true;record.root.classList.remove('cinematic-staging','cinematic-preroll');record.gate.hidden=true;this.emit(record,'starting');this.document.body.classList.add('cris-cinematic-active');this.document.body.classList.remove('cris-cinematic-preparing');
  try{const shown=await start();if(this.current!==record||signal?.aborted)throw abortError();record.playing=!!shown;if(shown)this.emit(record,'presenting');return shown;}
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
  const r=this.current;if(!r)return;this.current=null;clearInterval(r.countTimer);r.reject?.(abortError());r.signal?.removeEventListener('abort',r.abort);this.document.defaultView?.removeEventListener('resize',r.resize);
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
