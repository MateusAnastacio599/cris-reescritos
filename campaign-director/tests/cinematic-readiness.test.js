import test from 'node:test';
import assert from 'node:assert/strict';
import {RemoteCinematicCache,retainedMedia,REMOTE_CACHE_TTL} from '../dist/cinematic-media-cache.js';
import {sceneCinematicCue} from '../dist/cinematic-cues.js';
import {watchCameraIntent} from '../integration-main/quadro/board-live.js';
import {asset,harness,until} from './fixtures/cinematic-prewarm-harness.mjs';
const media=await asset(19000,'reentry');
function database(){const rows=new Map();return {rows,open:async()=>({transaction(){const tx={},store={get:key=>request(()=>rows.get(key)),getAll:()=>request(()=>[...rows.values()]),put:(value,key)=>rows.set(key,value),delete:key=>rows.delete(key)};function request(read){const r={};queueMicrotask(()=>{r.result=read();r.onsuccess?.();setTimeout(()=>tx.oncomplete?.(),0);});return r;}tx.objectStore=()=>store;return tx;}})};}
test('reentry cache scopes bytes by account/campaign, validates SHA and expires without touching the library',async()=>{
 const db=database();let now=100;const options={database:db.open,now:()=>now},cache=new RemoteCinematicCache('alice/campaign',options),assets=[{id:media.item.imageId,type:media.blob.type,size:media.blob.size}];
 await cache.save(media.item.imageId,media.blob);assert.equal((await cache.load(assets)).size,1);assert.equal((await new RemoteCinematicCache('bob/campaign',options).load(assets)).size,0);
 const row=[...db.rows.values()][0];row.blob=new Blob([new Uint8Array(media.blob.size)],{type:'image/png'});assert.equal((await cache.load(assets)).size,0);row.blob=media.blob;now+=REMOTE_CACHE_TTL+1;assert.equal((await cache.load(assets)).size,0);
});
test('temporary disk budget evicts old or expired media across scopes, preserving the newest candidate',()=>{
 const row=(key,size,used,expires=100)=>({key,blob:new Blob([new Uint8Array(size)]),used,expires});assert.deepEqual(retainedMedia([row('old',9,1),row('current',6,3),row('next',4,2),row('expired',2,5,0)],10,10).map(r=>r.key),['current','next']);
});
test('unavailable disk cache fails open to the normal verified transfer',async()=>{
 const cache=new RemoteCinematicCache('scope',{database:async()=>{throw Error('quota');}});assert.equal((await cache.load([])).size,0);await cache.save(media.item.imageId,media.blob);assert.equal(cache.available,false);
});
test('closing and reopening a player reuses hash-verified persisted media without retransmission or replay',async()=>{
 const db=database(),f=await harness();try{const c=f.clients[0];c.client.mediaCache=new RemoteCinematicCache('same-account/campaign',{database:db.open});await f.host.present(media.item,media.blob);await until(()=>c.calls.play===1);f.host.stop(true);c.client.close();f.host.disconnect(c.a);
 const reopened=await f.add(1,c.a._identity);reopened.client.mediaCache=new RemoteCinematicCache('same-account/campaign',{database:db.open});assert.equal(reopened.calls.play,0);await f.host.present(media.item,media.blob);await until(()=>reopened.calls.play===1);const metrics=f.host.peers.get(reopened.a).metrics;assert.equal(metrics.bytes,0);assert.equal(metrics.reusedBytes,media.blob.size);assert.equal(reopened.client.mediaCache.restoredBytes,media.blob.size);
 }finally{f.close();}
});
test('script cinematic insertion reuses ordinary cues/triggers and never grants prewarm authorization',()=>{
 const scene={cinematic:{version:1,items:[media.item]},cues:[],triggers:[]};let id=0;const first=sceneCinematicCue(scene,media.item,()=>String(++id)),second=sceneCinematicCue(scene,media.item,()=>String(++id));assert.equal(first.type,'cue');assert.equal(first.triggerId,second.triggerId);assert.equal(scene.cues.length,1);assert.equal(scene.triggers.length,1);assert.deepEqual(scene.cues[0].actions,[{type:'cinematic-start',cinematicId:media.item.id,replace:true,delay:0}]);assert.equal(scene.cinematic.remotePrewarmIds,undefined);assert.throws(()=>sceneCinematicCue(scene,{id:'missing'}));
});
test('camera intent ignores taps and loading gestures but detects a deliberate drag or wheel after readiness',()=>{
 const element=new EventTarget();let ready=false,moves=0;const close=watchCameraIntent(element,()=>moves++,()=>ready),send=(type,x=0,y=0)=>{const e=new Event(type);Object.assign(e,{pointerId:1,clientX:x,clientY:y});element.dispatchEvent(e);};send('pointerdown');send('pointerup');send('pointerdown');send('pointermove',40);assert.equal(moves,0);ready=true;send('pointerdown');send('pointermove',3);send('pointerup');assert.equal(moves,0);send('pointerdown');send('pointermove',12);assert.equal(moves,1);send('wheel');assert.equal(moves,2);close();send('wheel');assert.equal(moves,2);
});

test('focus probes detect a reopened receiver without canceling healthy prewarm or replaying',async()=>{
 const {CinematicLink}=await import('../dist/cinematic-link.js'),{CINEMATIC_CHANNEL,cinematicEnvelope}=await import('../dist/cinematic-protocol.js'),scope={userId:crypto.randomUUID(),boardCampaignId:'board'},scene={campaignId:'campaign',pageId:'page',sceneId:'scene'},channel=new BroadcastChannel(CINEMATIC_CHANNEL),link=new CinematicLink();let boardId='first',warmCalls=0;
 channel.onmessage=({data:m})=>{if(m.userId!==scope.userId)return;if(m.type==='discover')channel.postMessage(cinematicEnvelope(scope,{...m,type:'ready',boardId,prewarm:1}));if(m.type==='prewarm')warmCalls++;};
 try{await link.prewarm(scope,scene,media.item,media.blob);await until(()=>warmCalls===1);const warm=link.warm;assert.equal(await link.prewarmReceiverChanged(),false);assert.equal(link.warm,warm);boardId='second';assert.equal(await link.prewarmReceiverChanged(),true);assert.equal(warmCalls,1);assert.equal(link.active,undefined);}finally{link.close();channel.close();}
});
