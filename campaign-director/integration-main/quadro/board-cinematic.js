import {CinematicFrame} from '../campaign-director/dist/cinematic-frame.js';
import {CINEMATIC_CHANNEL,CinematicReceiver,validBoard} from '../campaign-director/dist/cinematic-protocol.js';
import {RemoteCinematics} from '../campaign-director/dist/cinematic-remote.js';

export function mountBoardCinematic({userId,boardCampaignId,isMaster,archiveId,ready}){
 const scope={userId,boardCampaignId};if(archiveId||!validBoard(scope))return;
 const element=document.createElement('div');element.className='cinematic-frame cinematic-board-layer';element.hidden=true;element.setAttribute('aria-label','Apresentação cinematográfica');
 let receiver,channel,timer;
 const frame=new CinematicFrame(element,{mount:document.body,onMotion:reduced=>receiver?.motionChanged(reduced)});
 const panel=document.createElement('aside');panel.className='cris-cinematic-participants';panel.setAttribute('aria-label','Cinematics dos participantes');panel.hidden=true;
 if(isMaster)document.body.append(panel);
 const remote=window.CRIS_REMOTE_CINEMATICS=new RemoteCinematics({Wire:window.CRIS_BOARD_LIVE.LiveWire,frame,bridge:window.CRISBridge,changed:participants=>{
  panel.replaceChildren();panel.hidden=!participants.length;
  const title=document.createElement('strong');title.textContent='Cinematic · participantes';panel.append(title);
  for(const participant of participants){const row=document.createElement('p');row.textContent=participant.name+' · '+participant.status+(participant.error?' — '+participant.error:'');panel.append(row);}
  if(receiver?.active)receiver.reply(receiver.active,{type:'remote-status',participants});
 }});
 // Only the authenticated local master mounts a local Director receiver. Players have
 // the same CinematicFrame, reached exclusively through the verified host connection.
 if(isMaster&&globalThis.BroadcastChannel){
  channel=new BroadcastChannel(CINEMATIC_CHANNEL);
  receiver=new CinematicReceiver({scope,boardId:crypto.randomUUID(),frame,ready,priority:()=>{const d=window.CRIS_LIVE_DIAGNOSTICS?.();return d?.role==='host'&&d.peerOpen?(d.connections?3:2):document.visibilityState==='visible'?1:0;},send:message=>channel.postMessage(message),onPresentation:event=>{
   if(event.type==='start')void remote.present(event.item,event.asset);else remote.stop(event.immediate);
  }});
  channel.onmessage=event=>void receiver.handle(event.data);timer=setInterval(()=>receiver.expire(),5000);
 }
 window.addEventListener('pagehide',()=>{receiver?.close();channel?.close();clearInterval(timer);remote.close();frame.clear({immediate:true});},{once:true});
 return remote;
}
