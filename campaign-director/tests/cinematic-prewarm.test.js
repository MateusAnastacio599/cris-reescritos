import test from 'node:test';
import assert from 'node:assert/strict';
import {asset,harness,until,pause} from './fixtures/cinematic-prewarm-harness.mjs';
import {CINEMATIC_COMPOSITION_BYTES} from '../dist/cinematic-model.js';
const current=await asset(15000,'current'),future=await asset(350000,'future');
test('unauthorized future and client-forged warm offers never distribute bytes',async()=>{
 const f=await harness();try{assert.equal(await f.host.prewarm.set(future.item,future.blob),false);await pause(15);assert.equal(f.packets.some(p=>p.m.kind==='warm-offer'),false);const peer=f.host.peers.get(f.clients[0].a);await f.host.handle(peer,{kind:'warm-offer',sid:'forged',authorized:true});assert.equal(f.host.prewarm.target,null);assert.equal(f.clients[0].client.cache.size,0);}finally{f.close();}
});
test('prewarm shares Wire/hash/ACK, never prepares a player, and fully cached media is reused on coordinated play',async()=>{
 const f=await harness();try{await f.host.prewarm.set(future.item,future.blob,{authorized:true});await until(()=>f.host.prewarm.report().status==='ready');const c=f.clients[0];assert.equal(c.calls.prepare,0);assert.equal(c.calls.play,0);assert.equal(c.client.cache.get(future.item.imageId).size,future.blob.size);assert.equal(f.host.prewarm.states.get(f.host.peers.get(c.a)).wire.stats.maxInFlight,1);
 await f.host.present(future.item,future.blob);await until(()=>c.calls.play===1);assert.equal(f.host.peers.get(c.a).metrics.reusedBytes,future.blob.size);assert.equal(f.host.peers.get(c.a).metrics.bytes,0);assert.equal(c.calls.prepare,1);}finally{f.close();}
});
test('only one peer receives the future at a time; background loading does not remount or stop the current player',async()=>{
 const f=await harness({delays:[2,2]});try{const run=await f.host.present(current.item,current.blob);await run.begun;await until(()=>f.clients.every(c=>c.calls.play===1));await f.host.prewarm.set(future.item,future.blob,{authorized:true});await until(()=>f.host.prewarm.report().status==='ready');assert.ok(f.clients.every(c=>c.calls.prepare===1&&c.calls.play===1));const offers=f.packets.filter(p=>p.m.kind==='warm-offer'),ready=f.packets.filter(p=>p.m.kind==='warm-state'&&p.m.status==='ready');assert.equal(offers.length,2);assert.ok(offers[1].at>=ready[0].at);assert.equal(f.host.active,run);}finally{f.close();}
});
test('scene change/cancel during a partial preload leaves playback healthy and stop remains responsive',async()=>{
 const f=await harness({delays:[3]});try{await f.host.present(current.item,current.blob);await until(()=>f.clients[0].calls.play===1);await f.host.prewarm.set(future.item,future.blob,{authorized:true});await until(()=>f.packets.some(p=>p.m.kind==='chunk'&&p.m.data.includes('cinematic-prewarm-asset')));f.host.prewarm.cancel();await pause(30);assert.equal(f.host.peers.get(f.clients[0].a).status,'apresentando');const begin=Date.now();f.host.stop(true);await until(()=>!f.clients[0].client.pending);assert.ok(Date.now()-begin<250);assert.equal(f.clients[0].a.open,true);}finally{f.close();}
});
test('cache budget refuses speculative allocation before transfer while preserving current media',async()=>{
 const f=await harness();try{await f.host.present(current.item,current.blob);await until(()=>f.clients[0].calls.play===1);const client=f.clients[0].client;client.pending.assets=[{id:current.item.imageId,size:CINEMATIC_COMPOSITION_BYTES,type:'image/png'}];await f.host.prewarm.set(future.item,future.blob,{authorized:true});await until(()=>f.host.prewarm.report().status==='failed');assert.equal(f.host.prewarm.report().participants[0].code,'cache-budget');assert.equal(client.cache.has(current.item.imageId),true);assert.equal(client.cache.has(future.item.imageId),false);assert.equal(f.clients[0].calls.play,1);}finally{f.close();}
});
test('late joiner warms the authorized target, obsolete capability remains explicit and foreground still works',async()=>{
 const f=await harness();try{await f.host.prewarm.set(future.item,future.blob,{authorized:true});await until(()=>f.host.prewarm.report().status==='ready');const late=await f.add();f.host.prewarm.kick();await until(()=>late.client.cache.has(future.item.imageId));assert.equal(late.calls.play,0);f.host.prewarm.cancel();f.host.peers.get(late.a).connection._cinematicPrewarm=false;await f.host.prewarm.set(future.item,future.blob,{authorized:true});await until(()=>f.host.prewarm.report().status==='failed');assert.equal(f.host.prewarm.report().participants.find(p=>p.id===late.a._identity).status,'unsupported');await f.host.present(current.item,current.blob);await until(()=>late.calls.play===1);}finally{f.close();}
});

test('hidden layers are omitted from the authorized future manifest and transferred media',async()=>{
 const secret=await asset(20000,'secret');const item={...future.item,layers:[{id:'hidden',name:'Private',imageId:secret.item.imageId,x:.5,y:.5,scale:.5,parallax:1,visible:false}]};const f=await harness();try{await f.host.prewarm.set(item,{[future.item.imageId]:future.blob,[secret.item.imageId]:secret.blob},{authorized:true});await until(()=>f.host.prewarm.report().status==='ready');assert.equal(f.packets.some(p=>JSON.stringify(p.m).includes(secret.item.imageId)),false);assert.equal(f.clients[0].client.cache.has(secret.item.imageId),false);}finally{f.close();}
});
test('channel congestion pauses speculative chunks but permits immediate presentation stop',async()=>{
 const f=await harness();try{await f.host.present(current.item,current.blob);await until(()=>f.clients[0].calls.play===1);f.clients[0].a.dataChannel={bufferedAmount:100000};await f.host.prewarm.set(future.item,future.blob,{authorized:true});await pause(35);assert.equal(f.packets.some(p=>p.m.kind==='chunk'&&p.m.data.includes('cinematic-prewarm-asset')),false);f.host.stop(true);await until(()=>!f.clients[0].client.pending);f.clients[0].a.dataChannel.bufferedAmount=0;await until(()=>f.host.prewarm.report().status==='ready');}finally{f.close();}
});
test('editing or replacing a target cancels old work and new media validates by hash without reviving a prior player',async()=>{
 const changed=await asset(18000,'changed');const f=await harness({delays:[2]});try{await f.host.prewarm.set(future.item,future.blob,{authorized:true});await pause(15);await f.host.prewarm.set({...changed.item,id:future.item.id},changed.blob,{authorized:true});await until(()=>f.host.prewarm.report().status==='ready');assert.ok(f.clients[0].client.cache.has(changed.item.imageId));assert.equal(f.clients[0].calls.play,0);assert.equal(f.host.prewarm.target.item.imageId,changed.item.imageId);}finally{f.close();}
});
test('partial files are never cached as valid; cancellation and close release assemblies, timers and media',async()=>{
 const f=await harness({delays:[3]});try{await f.host.prewarm.set(future.item,future.blob,{authorized:true});await until(()=>f.clients[0].client.prewarm.client?.assembly?.bytes>0);assert.equal(f.clients[0].client.cache.has(future.item.imageId),false);f.host.prewarm.cancel();await until(()=>!f.clients[0].client.prewarm.client);assert.equal(f.clients[0].calls.play,0);f.clients[0].client.close();assert.equal(f.clients[0].client.cache.size,0);}finally{f.close();}
});

test('WebM is validated and cached without a second player/decoder; presentation later reuses every hash',async()=>{
 const {readFileSync}=await import('node:fs'),{imageKey}=await import('../dist/cinematic-media.js');const video=new Blob([readFileSync(new URL('./fixtures/cinematic-studio/iris.webm',import.meta.url))],{type:'video/webm'}),image=new Blob([readFileSync(new URL('./fixtures/cinematic-studio/iris.png',import.meta.url))],{type:'image/png'}),videoId=await imageKey(video),fallbackId=await imageKey(image);
 const item={...future.item,layers:[{id:'figure',name:'Figure',imageId:fallbackId,x:.5,y:.5,scale:.4,visible:true,parallax:1,video:{mediaId:videoId,enabled:true,loop:true,rate:1,delay:0,end:'fallback',transparent:true}}]},media={[item.imageId]:future.blob,[videoId]:video,[fallbackId]:image};const f=await harness();try{await f.host.prewarm.set(item,media,{authorized:true});await until(()=>f.host.prewarm.report().status==='ready');assert.equal(f.clients[0].calls.prepare,0);await f.host.present(item,media);await until(()=>f.clients[0].calls.play===1);assert.equal(f.host.peers.get(f.clients[0].a).metrics.bytes,0);assert.equal(f.clients[0].calls.prepare,1);}finally{f.close();}
});

test('local Director protocol reaches the existing remote cache and a fresh Director can replace its predecessor',async()=>{
 const {CinematicLink}=await import('../dist/cinematic-link.js'),{CinematicReceiver,CINEMATIC_CHANNEL}=await import('../dist/cinematic-protocol.js');const f=await harness(),scope={userId:crypto.randomUUID(),boardCampaignId:'board'},scene={campaignId:'c',pageId:'p',sceneId:'s'},channel=new BroadcastChannel(CINEMATIC_CHANNEL);let receiver;
 const links=[];try{
 receiver=new CinematicReceiver({scope,boardId:'board',frame:{clear:async()=>true},send:m=>channel.postMessage(m),onPrewarm:m=>f.host.prewarm.set(m.item,m.image,{authorized:m.authorized}),onWarmCancel:()=>f.host.prewarm.cancel(),onWarmPing:()=>f.host.prewarm.touch()});channel.onmessage=e=>void receiver.handle(e.data);f.host.warmChanged=report=>{if(receiver.warm)receiver.reply(receiver.warm,{type:'warm-status',status:report.status,participants:report.participants});};
 for(let i=0;i<2;i++){const link=new CinematicLink();links.push(link);assert.equal(await link.prewarm(scope,scene,future.item,future.blob),true);await until(()=>link.prewarmState?.status==='ready');assert.equal(f.clients[0].calls.play,0);link.cancelPrewarm();await until(()=>!f.host.prewarm.target);link.close();await pause(5);}
 }finally{for(const link of links)link.close();receiver?.close();channel.close();f.close();}
});


test('remote video buffering throttles warm traffic; orphan leases expire without ending the active player',async()=>{
 const f=await harness({delays:[2]});try{
  await f.host.present(current.item,current.blob);await until(()=>[...f.host.peers.values()].every(p=>p.status==='apresentando'));
  const c=f.clients[0],peer=f.host.peers.get(c.a),clears=c.calls.clear;c.frame.composition={videos:[{video:{readyState:2,paused:false}}]};
  await f.host.prewarm.set(future.item,future.blob,{authorized:true});await until(()=>f.packets.some(p=>p.m.kind==='warm-flow'));
  await until(()=>f.host.prewarm.states.get(peer)?.busyUntil>Date.now());const before=f.host.prewarm.states.get(peer).bytes;await pause(80);assert.ok(f.host.prewarm.states.get(peer).bytes-before<=96*1024,'only the already in-flight slice may finish while buffering');
  c.frame.composition.videos[0].video.readyState=4;f.host.prewarm.states.get(peer).busyUntil=0;await until(()=>f.host.prewarm.report().status==='ready');assert.equal(c.calls.play,1);
  f.host.prewarm.target.expires=0;f.host.prewarm.tick();await until(()=>!c.client.prewarm.client);assert.equal(f.host.prewarm.report().participants.length,0);assert.equal(c.calls.clear,clears);assert.equal(c.calls.play,1);assert.ok(c.client.cache.has(current.item.imageId));
 }finally{f.close();}
});
