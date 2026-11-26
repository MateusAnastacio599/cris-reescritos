import {CinematicFrame} from '../campaign-director/dist/cinematic-frame.js?v=live01b2';
import {CINEMATIC_CHANNEL,CinematicReceiver,validBoard} from '../campaign-director/dist/cinematic-protocol.js?v=live01b2';
import {CinematicPresentation} from '../campaign-director/dist/cinematic-presentation.js?v=live01b2';
import {RemoteCinematics} from '../campaign-director/dist/cinematic-remote.js?v=live01b2';

export function mountBoardCinematic({userId,boardCampaignId,isMaster,archiveId,ready}){
 const scope={userId,boardCampaignId};if(archiveId||!validBoard(scope))return;
 const element=document.createElement('div');element.className='cinematic-frame cinematic-board-layer';element.hidden=true;element.setAttribute('aria-label','Apresentação cinematográfica');
 let receiver,channel,timer;
 const frame=new CinematicFrame(element,{mount:document.body,onMotion:reduced=>receiver?.motionChanged(reduced)});
 const controls=document.createElement('button');controls.type='button';controls.className='cris-cinematic-controls';controls.textContent='Mesa';controls.hidden=true;controls.setAttribute('aria-label','Controles da mesa durante apresentação');document.body.append(controls);
 controls.onclick=()=>{document.body.classList.toggle('cris-cinematic-controls-open');if(isMaster)window.CRIS_ROOM_CONTROLS?.show();else document.querySelector('.cris-menu-toggle')?.click();};
 const observer=new MutationObserver(()=>{const active=!element.hidden;document.body.classList.toggle('cris-cinematic-active',active);controls.hidden=!active;if(!active)document.body.classList.remove('cris-cinematic-controls-open');});observer.observe(element,{attributes:true,attributeFilter:['hidden']});
 const presentation=new CinematicPresentation({controls,status:phase=>{const current=remote.pending?.peer;if(current)remote.trace(current,phase);}});
 const remote=window.CRIS_REMOTE_CINEMATICS=new RemoteCinematics({Wire:window.CRIS_BOARD_LIVE.LiveWire,frame,bridge:window.CRISBridge,presentation,changed:participants=>{
  window.CRIS_ROOM_CONTROLS?.remote(participants);
  if(isMaster)window.CRIS_ROOM_CONTROLS?.notice(remote.hostError||'');
  if(receiver?.active)receiver.reply(receiver.active,{type:'remote-status',participants});
 }});
 document.addEventListener('cris-cinematic-status',()=>window.CRIS_ROOM_CONTROLS?.notice('O módulo de apresentação não carregou. Atualize o CRIS antes de apresentar.'));
 // Local Director commands are accepted only by the authenticated master.
 if(isMaster&&globalThis.BroadcastChannel){
  channel=new BroadcastChannel(CINEMATIC_CHANNEL);
  receiver=new CinematicReceiver({onAutoEnd:()=>remote.waitForCompletion(),scope,boardId:crypto.randomUUID(),frame,ready,priority:()=>{const d=window.CRIS_LIVE_DIAGNOSTICS?.();return d?.role==='host'&&d.peerOpen?(d.connections?3:2):document.visibilityState==='visible'?1:0;},send:message=>channel.postMessage(message),onPresentation:event=>{
   if(event.type==='start')void remote.present(event.item,event.asset);else remote.stop(event.immediate);
  }});
  channel.onmessage=event=>void receiver.handle(event.data);timer=setInterval(()=>receiver.expire(),5000);
 }
 window.addEventListener('pagehide',()=>{receiver?.close();channel?.close();clearInterval(timer);observer.disconnect();controls.remove();remote.close();frame.clear({immediate:true});},{once:true});
 return remote;
}
