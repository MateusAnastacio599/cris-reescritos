import {CinematicFrame,CINEMATIC_FRAME_BUILD} from '../../cinematic-frame.js?v=mobilefit01';
import {CINEMATIC_PROTOCOL_BUILD,CINEMATIC_CHANNEL,CinematicReceiver,validBoard} from '../../cinematic-protocol.js?v=directorcinematic02';
import {CinematicPresentation,CINEMATIC_PRESENTATION_BUILD} from '../../cinematic-presentation.js?v=directorcinematic02';
import {RemoteCinematics,CINEMATIC_REMOTE_BUILD} from '../../cinematic-remote.js?v=directorcinematic02';
import {RemoteCinematicCache} from '../../cinematic-media-cache.js?v=directorcinematic02';

export function mountBoardCinematic({userId,boardCampaignId,isMaster,archiveId,ready}){
 if([CINEMATIC_PROTOCOL_BUILD,CINEMATIC_FRAME_BUILD,CINEMATIC_PRESENTATION_BUILD,CINEMATIC_REMOTE_BUILD,window.CRIS_BOARD_LIVE?.LIVE_BUILD].some(build=>build!=='directorcinematic02'))throw Error('Cinematic modules need an update');
 const scope={userId,boardCampaignId};if(archiveId||!validBoard(scope))return;
 const element=document.createElement('div');element.className='cinematic-frame cinematic-board-layer';element.hidden=true;element.setAttribute('aria-label','Apresentação cinematográfica');
 let receiver,channel,timer;
 const frame=new CinematicFrame(element,{mount:document.body,fit:'cover',onMotion:reduced=>receiver?.motionChanged(reduced)});
 const controls=document.createElement('button');controls.type='button';controls.className='cris-cinematic-controls';controls.textContent='Mesa';controls.hidden=true;controls.setAttribute('aria-label','Controles da mesa durante apresentação');document.body.append(controls);
 controls.onclick=()=>{document.body.classList.toggle('cris-cinematic-controls-open');if(isMaster)window.CRIS_ROOM_CONTROLS?.show();else document.querySelector('.cris-menu-toggle')?.click();};
 const observer=new MutationObserver(()=>{const active=!element.hidden&&!!frame.playing;document.body.classList.toggle('cris-cinematic-active',active);controls.hidden=!active;if(!active)document.body.classList.remove('cris-cinematic-controls-open');});observer.observe(element,{attributes:true,attributeFilter:['hidden','class']});
 const presentation=new CinematicPresentation({controls,status:phase=>{const current=remote.pending?.peer;if(current){remote.trace(current,phase);if(phase==='autoplay-blocked'){remote.state(current,'bloqueado');remote.control(current,'state',{sid:remote.pending.sid,status:'bloqueado'});}}}});
 const remote=window.CRIS_REMOTE_CINEMATICS=new RemoteCinematics({Wire:window.CRIS_BOARD_LIVE.LiveWire,frame,bridge:window.CRISBridge,presentation,mediaCache:!isMaster&&globalThis.indexedDB?new RemoteCinematicCache(JSON.stringify([userId,boardCampaignId])):null,changed:participants=>{
  const update=participants.find(p=>p.code==='legacy-client');if(!isMaster&&update&&!presentation.updateNotice){presentation.updateNotice=true;presentation.failure({message:update.error,update:true});}
  window.CRIS_ROOM_CONTROLS?.remote(participants);window.CRIS_ROOM_CONTROLS?.coordination?.(remote.active);
  if(isMaster)window.CRIS_ROOM_CONTROLS?.notice(remote.hostError||'');
  if(receiver?.active)receiver.reply(receiver.active,{type:'remote-status',participants,coordination:remote.active?.phase});
 }});
 document.addEventListener('cris-cinematic-status',()=>window.CRIS_ROOM_CONTROLS?.notice('O módulo de apresentação não carregou. Atualize o CRIS antes de apresentar.'));
 // Local Director commands are accepted only by the authenticated master.
 if(isMaster&&globalThis.BroadcastChannel){
  channel=new BroadcastChannel(CINEMATIC_CHANNEL);
  remote.warmChanged=report=>{if(receiver?.warm)receiver.reply(receiver.warm,{type:'warm-status',status:report.status,participants:report.participants});window.CRIS_ROOM_CONTROLS?.coordination?.();};
  receiver=new CinematicReceiver({onPrewarm:message=>remote.prewarm.set(message.item,message.image,{authorized:message.authorized}),onWarmCancel:()=>remote.prewarm.cancel(),onWarmPing:()=>remote.prewarm.touch(),coordinate:async({item,asset,prepare,start,signal})=>{remote.trace(null,'director-start-request');const run=await remote.present(item,asset,{prepareLocal:async()=>{await presentation.begin({frame,signal,host:true});const prepared=await prepare();if(!signal.aborted&&remote.active)Object.assign(remote.active.metrics,frame.metrics||{});return prepared;},countdownLocal:delay=>presentation.countdown(delay),startLocal:offset=>presentation.start(()=>start(offset),{signal})});return await run?.begun;},onAutoEnd:()=>remote.waitForCompletion(),scope,boardId:crypto.randomUUID(),frame,ready,priority:()=>{const d=window.CRIS_LIVE_DIAGNOSTICS?.();return d?.role==='host'&&d.peerOpen?(d.connections?3:2):document.visibilityState==='visible'?1:0;},send:message=>channel.postMessage(message),onPresentation:event=>{
   if(event.type==='stop'){remote.trace(null,'director-stop-'+(event.reason||'manual'));remote.stop(event.immediate);void presentation.end();}
  }});
  channel.onmessage=event=>void receiver.handle(event.data);timer=setInterval(()=>receiver.expire(),5000);
 }
 window.addEventListener('pagehide',()=>{receiver?.close();channel?.close();clearInterval(timer);observer.disconnect();controls.remove();remote.close();frame.clear({immediate:true});},{once:true});
 return remote;
}
