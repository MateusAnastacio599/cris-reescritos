import {openBoardSheet} from './board-sheet.js';
import {CRISBridge} from '../integration-bridge.js';
export const boardStamp=value=>{const text=JSON.stringify(value,function(key,value){return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value;});let a=2166136261,b=2246822519;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),3266489917);}return text.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);};
export function chooseBoardVersion(local,remote,base){if(!local)return 'remote';if(!remote)return 'local';if(boardStamp(local)===boardStamp(remote))return 'remote';if(base===boardStamp(local))return 'remote';if(base===boardStamp(remote))return 'local';return 'review';}
// Journal side effects before waiting for network confirmation. A retry must never
// reveal again after the master has manually hidden the same document.
export async function applyBoardCommands({commands,api,flush,ack,journal=new Map(),remember=()=>{},now=Date.now()}){
 for(const command of commands){
  const expired=command.created_at&&now-Date.parse(command.created_at)>300000;
  if(expired&&!journal.has(command.id)){await ack(command.id,'Comando expirado. Dispare novamente pelo roteiro.');continue;}
  if(!journal.has(command.id)){
   journal.set(command.id,null);try{remember();}catch(error){journal.delete(command.id);throw error;}
   try{await api.visibility(command.item_id,command.action==='reveal');}
   catch(error){if(error.code==='CLUE_MISSING'){journal.set(command.id,error.message.slice(0,500));remember();}else{journal.delete(command.id);remember();throw error;}}
  }
  const error=journal.get(command.id);if(!error)await flush();await ack(command.id,error);
 }
}

function chooseDialog(){return new Promise(resolve=>{const d=document.createElement('dialog');d.className='cris-board-dialog';d.innerHTML='<h2>Qual quadro você quer continuar?</h2><p>Há uma cópia deste computador e outra na sua conta. A cópia local será preservada para recuperação antes de abrir a conta.</p><div class="cris-board-choices"><button type="button" data-choice="local">Continuar quadro deste computador</button><button type="button" data-choice="remote">Abrir quadro da conta</button></div>';d.addEventListener('cancel',e=>e.preventDefault());d.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{d.close();d.remove();resolve(b.dataset.choice);});document.body.append(d);d.showModal();});}
export class BoardSession{
 constructor({bridge=CRISBridge,storage=localStorage,client}={}){Object.assign(this,{bridge,storage,client});this.base=null;this.error=null;this.timer=null;this.flushing=null;this.polling=false;this.journal=new Map();}
 get key(){return 'cris:board:sync:'+this.bridge.identity.userId+':'+this.bridge.campaignId;}
 status(message,error=false){const e=document.querySelector('#boardSyncStatus');if(e){e.textContent=message;e.dataset.error=String(error);}const toggle=document.querySelector('.cris-menu-toggle');if(toggle){toggle.dataset.error=String(error);toggle.title=message;}}
 async choose(local,remote){this.base=remote?boardStamp(remote):null;const stored=this.storage.getItem(this.key);let choice=chooseBoardVersion(local,remote,stored);if(choice==='review')choice=await chooseDialog();return choice==='remote'?remote:local;}
 ready(api){this.api=api;try{this.journal=new Map(JSON.parse(this.storage.getItem(this.key+':commands')||'[]'));}catch{}if(globalThis.BroadcastChannel){this.channel=new BroadcastChannel('cris-board-commands');this.channel.onmessage=e=>{if(e.data?.campaignId!==this.bridge.campaignId)return;if(e.data.type==='flush'){this.channel.postMessage({type:'flushing',campaignId:this.bridge.campaignId,requestId:e.data.requestId});this.flush().then(()=>this.channel.postMessage({type:'flushed',campaignId:this.bridge.campaignId,requestId:e.data.requestId})).catch(error=>this.channel.postMessage({type:'flushed',campaignId:this.bridge.campaignId,requestId:e.data.requestId,error:error.message}));}else if(!e.data.type)this.poll();};window.addEventListener('pagehide',()=>{this.channel?.close();clearInterval(this.interval);},{once:true});}this.status('Quadro vinculado à sua conta');window.addEventListener('cris-board-change',()=>this.changed());window.addEventListener('online',()=>this.changed());window.addEventListener('beforeunload',e=>{if(this.dirty){e.preventDefault();e.returnValue='';}});this.interval=setInterval(()=>this.poll(),2500);this.changed();this.poll();}
 get dirty(){return this.api&&boardStamp(this.api.snapshot())!==this.base;}
 changed(){if(!this.api)return;clearTimeout(this.timer);this.status('Salvo neste computador · sincronizando…');this.timer=setTimeout(()=>this.flush().catch(()=>{}),1200);}
 async flush(){if(this.flushing)return this.flushing;clearTimeout(this.timer);if(!this.api||!this.dirty)return;
  this.flushing=(async()=>{try{if(this.error){const remote=await this.bridge.loadBoard();if(remote&&boardStamp(remote)!==this.base&&boardStamp(remote)!==boardStamp(this.api.snapshot()))throw Error('Quadro atualizado em outro computador. Reabra para comparar as cópias.');this.error=null;}while(this.dirty){const snapshot=this.api.snapshot();this.status('Salvando quadro na sua conta…');if(this.api.persistLocal)await this.api.persistLocal(snapshot);await this.bridge.saveBoard(snapshot);this.base=boardStamp(snapshot);this.storage.setItem(this.key,this.base);}this.status('Quadro salvo na conta');}catch(error){this.status('Falha ao sincronizar · '+(error.message||'confira a conexão'),true);throw error;}})().finally(()=>this.flushing=null);return this.flushing;
 }
 async poll(){if(!this.api||this.polling)return;this.polling=true;const run=async()=>{try{try{for(const [id,error] of JSON.parse(this.storage.getItem(this.key+':commands')||'[]'))if(!this.journal.has(id))this.journal.set(id,error);}catch{}const c=await this.client(),r=await c.from('board_cue_commands').select('id,item_id,action,created_at').eq('campaign_id',this.bridge.campaignId).is('applied_at',null).order('created_at').order('id').limit(30);if(r.error)throw r.error;
   await applyBoardCommands({commands:r.data||[],api:this.api,journal:this.journal,remember:()=>{this.storage.setItem(this.key+':commands',JSON.stringify([...this.journal].slice(-500)));},flush:()=>this.flush(),ack:async(id,error)=>{const a=await c.from('board_cue_commands').update({applied_at:new Date().toISOString(),error}).eq('id',id);if(a.error)throw a.error;}});
  }catch(error){this.status('Conexão do quadro: '+(error.message||'aguardando rede'),true);}};try{if(globalThis.navigator?.locks)await navigator.locks.request(this.key+':commands',{ifAvailable:true},lock=>lock?run():undefined);else await run();}finally{this.polling=false;}
 }
}
export async function mountBoardSession(identity,{bridge=CRISBridge,client}={}){
 if(!client){const {getCloudClient}=await import(new URL('cloud-account.js',bridge.directorURL));client=getCloudClient;}const session=new BoardSession({bridge,client});window.CRIS_BOARD_SESSION=session;
 const toolbar=document.createElement('nav');toolbar.className='cris-board-toolbar';toolbar.setAttribute('aria-label','Campanha e ficha');toolbar.innerHTML=`<button type="button" class="cris-menu-toggle" aria-label="Menu do quadro" aria-expanded="false" aria-controls="crisBoardMenu">☰ <span>CRIS</span></button><div id="crisBoardMenu" class="cris-board-menu" hidden><div class="cris-board-who"><strong></strong><small id="boardSyncStatus">${identity.isMaster?'Abrindo quadro da conta…':'Quadro da campanha · aguardando mesa'}</small></div><button type="button" id="openOwnSheet">Minha ficha</button>${identity.isMaster?'<button type="button" id="boardSaveNow">Sincronizar</button><a id="boardDirectorLink" target="crisDirector" rel="noopener">Roteiro e SoundPad ↗</a>':''}<a href="../">Voltar ao CRIS</a></div>`;toolbar.querySelector('strong').textContent=identity.name;document.body.append(toolbar);
 if(identity.isMaster){toolbar.querySelector('#boardDirectorLink').href=bridge.directorURL;toolbar.querySelector('#boardSaveNow').onclick=()=>session.flush().catch(()=>{});}
 const toggle=toolbar.querySelector('.cris-menu-toggle'),menu=toolbar.querySelector('#crisBoardMenu');
 const setOpen=open=>{menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));};toggle.onclick=()=>setOpen(menu.hidden);
 document.addEventListener('pointerdown',e=>{if(!toolbar.contains(e.target))setOpen(false);});toolbar.onkeydown=e=>{if(e.key==='Escape'){setOpen(false);toggle.focus();}};
 const showSheet=()=>{setOpen(false);openBoardSheet({bridge,identity});};
 toolbar.querySelector('#openOwnSheet').onclick=showSheet;

 return session;
}
