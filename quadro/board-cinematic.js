import {CinematicFrame} from '../campaign-director/dist/cinematic-frame.js';
import {CINEMATIC_CHANNEL,CinematicReceiver,validBoard} from '../campaign-director/dist/cinematic-protocol.js';

export function mountBoardCinematic({userId,boardCampaignId,isMaster,archiveId,ready}){
  const scope={userId,boardCampaignId};
  if(!isMaster||archiveId||!validBoard(scope)||!globalThis.BroadcastChannel)return;
  const frame=document.createElement('div');
  frame.className='cinematic-frame cinematic-board-layer';
  frame.hidden=true;
  frame.setAttribute('aria-label','Apresentação cinematográfica');
  let channel,receiver,timer;
  const connect=()=>{
    if(channel)return;
    channel=new BroadcastChannel(CINEMATIC_CHANNEL);
    receiver=new CinematicReceiver({scope,boardId:crypto.randomUUID(),frame:new CinematicFrame(frame,{mount:document.body,onMotion:reduced=>receiver?.motionChanged(reduced)}),ready,
      send:message=>channel?.postMessage(message)});
    channel.onmessage=event=>void receiver.handle(event.data);
    timer=setInterval(()=>receiver.expire(),5000);
  };
  connect();
  window.addEventListener('pagehide',()=>{
    if(!channel)return;
    receiver.close();
    channel.close();
    channel=null;
    clearInterval(timer);
  });
  window.addEventListener('pageshow',event=>{if(event.persisted)connect();});
}
