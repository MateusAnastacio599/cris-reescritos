import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planColumnRemoval} from '../dist/editor-column-removal.js';
import {withCinematic,checkCinematicImage,validateSceneCinematics} from '../dist/cinematic-model.js';
import {storeCinematicImage} from '../dist/cinematic-media.js';
import {initialState,exportWorkspace,importWorkspace,STORAGE_KEY} from '../dist/storage.js';
import {cinematicFrames} from '../dist/cinematic-frame.js';
import {CinematicLink} from '../dist/cinematic-link.js';
import {CINEMATIC_CHANNEL,CINEMATIC_LEASE,CinematicReceiver,cinematicEnvelope} from '../dist/cinematic-protocol.js';

const scope={userId:'master',boardCampaignId:'linked-case'};
const scene={campaignId:'director-camp',pageId:'page',sceneId:'scene'};
const img=new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X9d0AAAAASUVORK5CYII=','base64')],{type:'image/png'});
const item={id:'image-show',imageId:'image-'+'d'.repeat(64),name:'Corredor',motion:'pan',seconds:12,intensity:16};
const sceneOf=state=>state.campaigns[0].pages[0].scenes[0];
const repository=()=>{
  const entries=new Map();
  return {get:async id=>entries.get(id),putAll:async pairs=>{for(const [id,blob] of pairs)entries.set(id,blob);},entries};
};

test('unpack preserves source order, rich toggles, table data and cue IDs',()=>{
  const blocks=[{type:'toggle',title:'Íris',background:'purple',blocks:[{type:'h2',text:'Atrás da porta'}]},
    {type:'table',headers:['Pista'],rows:[['Chave']]},{type:'cue',triggerId:'passos',text:'Disparar'}];
  const layout={type:'columns',columns:[{blocks:blocks.slice(0,1)},{blocks:blocks.slice(1)}]};
  assert.deepEqual(planColumnRemoval(layout,'unpack').blocks,blocks);
  layout.columns[0].blocks.push({type:'paragraph',text:'# título literal'});
  const original=structuredClone(layout);
  assert.match(planColumnRemoval(layout,'unpack').error,/Markdown/);
  assert.deepEqual(layout,original);
});

test('filled layouts require explicit deletion confirmation and empty layouts can be removed',()=>{
  const layout={type:'columns',columns:[{blocks:[{type:'paragraph',text:''}]},{blocks:[]}]};
  assert.deepEqual(planColumnRemoval(layout,'delete'),{blocks:[]});
  assert.equal(planColumnRemoval(layout,'unpack').blocks.length,1);
  layout.columns[1].blocks.push({type:'table',headers:['Pista'],rows:[['Chave']]});
  assert.deepEqual(planColumnRemoval(layout,'delete'),{confirmation:true});
  assert.deepEqual(planColumnRemoval(layout,'delete',true),{blocks:[]});
  assert.equal(layout.columns[1].blocks.length,1);
});

test('scene edits preserve presentation IDs and reject unknown schema, directions and URLs',()=>{
  const first=withCinematic({},item),next=withCinematic({cinematic:first},{...item,name:'Porta entreaberta',motion:'zoomOut'});
  assert.equal(next.items.length,1);
  assert.equal(next.items[0].id,item.id);
  assert.equal(first.items[0].name,item.name);
  assert.throws(()=>withCinematic({}, {...item,imageId:'blob:temporary'}),/Confira/);
  assert.throws(()=>withCinematic({}, {...item,intensity:31}),/Confira/);
  assert.throws(()=>validateSceneCinematics({...first,version:2}),/inválida/);
  assert.throws(()=>validateSceneCinematics({...first,items:[item,item]}),/inválida/);
});

test('local image validation rejects wrong signatures and unsupported types',async()=>{
  assert.equal(await checkCinematicImage(img),img);
  await assert.rejects(checkCinematicImage(new Blob(['texto'],{type:'image/png'})),/formato/);
  await assert.rejects(checkCinematicImage(new Blob(['<svg/>'],{type:'image/svg+xml'})),/PNG/);
});

test('complete backup transfers image bytes and leaves scene markdown unchanged; failed import keeps existing state',async()=>{
  const origin=repository(),target=repository(),state=initialState(),original=sceneOf(state).markdown;
  const imageId=await storeCinematicImage(img,origin);
  assert.equal(await storeCinematicImage(img,origin),imageId);
  assert.equal(origin.entries.size,1);
  sceneOf(state).cinematic=withCinematic(sceneOf(state),{...item,imageId});
  sceneOf(state).cinematic=withCinematic(sceneOf(state),{
    ...item,id:'breath-show',imageId,motion:'breath',ending:'loop',hold:3,
  });
  const backup=await (await exportWorkspace(state,true,origin)).text();
  const raw=JSON.parse(backup),values=new Map();
  globalThis.localStorage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)??null};
  try{
    assert.ok(raw.cinematicMedia[imageId].base64);
    assert.equal(sceneOf(raw.state).markdown,original);
    assert.doesNotMatch(JSON.stringify(sceneOf(raw.state)),/base64|blob:/);
    const restored=await importWorkspace(backup,target);
    assert.deepEqual(sceneOf(restored).cinematic,sceneOf(state).cinematic);
    assert.deepEqual(await (await target.get(imageId)).arrayBuffer(),await img.arrayBuffer());
    const prior=values.get(STORAGE_KEY);
    raw.cinematicMedia[imageId].base64+='bad';
    await assert.rejects(importWorkspace(JSON.stringify(raw),target));
    assert.equal(values.get(STORAGE_KEY),prior);
    await assert.rejects(exportWorkspace(state,true,repository()),/Anexe o arquivo/);
    delete raw.cinematicMedia;
    await assert.rejects(importWorkspace(JSON.stringify(raw),repository()),/backup completo/);
    assert.equal(values.get(STORAGE_KEY),prior);
  }finally{delete globalThis.localStorage;}
});

test('motion frames support static, zoom both ways, pan with overscan and reduced motion',()=>{
  const still={transform:'scale(1)'},zoom={transform:'scale(1.2)'};
  assert.deepEqual(cinematicFrames({motion:'zoomIn',intensity:20}),[still,zoom]);
  assert.deepEqual(cinematicFrames({motion:'zoomOut',intensity:20}),[zoom,still]);
  assert.deepEqual(cinematicFrames({motion:'static',intensity:20}),[still,still]);
  assert.deepEqual(cinematicFrames({motion:'pan',intensity:20},true),[still,still]);
  assert.deepEqual(cinematicFrames({motion:'pan',intensity:20}).map(frame=>frame.transform),
    ['translateX(-9%) scale(1.2)','translateX(9%) scale(1.2)']);
});

test('receiver rejects old, malformed, other-campaign, other-scene and untargeted updates',async()=>{
  let time=100000,seen=0;
  const replies=[],frame={show:async()=>{seen++;return true;},clear:()=>{}};
  const receiver=new CinematicReceiver({scope,boardId:'board',frame,send:r=>replies.push(r),now:()=>time});
  const message=cinematicEnvelope(scope,{type:'start',boardId:'board',senderId:'director',requestId:'req',
    sessionId:'session',scene,sequence:1,item,image:img},time);
  for(const changes of [{boardCampaignId:'other'},{boardId:'other'},{userId:'other'},
    {image:'blob:invalid'},{at:1},{item:{...item,motion:{toString:0}}}]){
    await receiver.handle({...message,...changes});
  }
  assert.equal(seen,0);
  await receiver.handle(message);
  await receiver.handle({...message,type:'update',sequence:2,scene:{...scene,sceneId:'elsewhere'}});
  assert.equal(seen,1);
  await receiver.handle({...message,type:'stop',sequence:3});
  await receiver.handle({...message,type:'start',sequence:2});
  assert.equal(receiver.active,null);
  assert.equal(seen,1);
  await receiver.handle({...message,sequence:5,sessionId:'next'});
  time+=CINEMATIC_LEASE;
  receiver.expire();
  assert.equal(receiver.active,null);
});

test('stop during image decoding prevents a late presentation acknowledgement',async()=>{
  let finish;
  const replies=[],frame={show:()=>new Promise(resolve=>{finish=resolve;}),clear:()=>{}};
  const receiver=new CinematicReceiver({scope,boardId:'board',frame,send:r=>replies.push(r)});
  const message=cinematicEnvelope(scope,{type:'start',boardId:'board',senderId:'director',requestId:'req',
    sessionId:'session',scene,sequence:1,item,image:img});
  const opening=receiver.handle(message);
  await receiver.handle({...message,type:'stop',sequence:2});
  finish(true);
  await opening;
  assert.deepEqual(replies,[]);
  assert.equal(receiver.active,null);
});

test('Director and receiver discover, update and stop through BroadcastChannel, without writing a board snapshot',async()=>{
  const channel=new BroadcastChannel(CINEMATIC_CHANNEL),link=new CinematicLink();
  const snapshot={state:{items:[{id:'proof',x:38,y:19}],pins:[{id:'a'},{id:'b'}],strings:[{a:'a',b:'b'}],cam:{x:7,y:9,z:1}},imgs:{proof:'data'}};
  const original=structuredClone(snapshot);
  let visible=null;
  const frame={show:async(_,presentation)=>{visible=presentation.motion;return true;},clear:()=>{visible=null;}};
  const receiver=new CinematicReceiver({scope,boardId:'board-old',frame,send:reply=>channel.postMessage(reply)});
  channel.onmessage=e=>void receiver.handle(e.data);
  try{
    await link.present(scope,scene,item,img);
    assert.equal(visible,'pan');
    await link.present(scope,scene,{...item,motion:'zoomIn'},img);
    assert.equal(visible,'zoomIn');
    const stopped=new Promise(resolve=>channel.addEventListener('message',event=>{if(event.data.type==='stop')resolve();},{once:true}));
    link.reconcile(scope,{...scene,sceneId:'next'});
    await stopped;
    assert.equal(visible,null);
    await link.present(scope,scene,item,img);
    const cleared=new Promise(resolve=>{const unsubscribe=link.subscribe(({active})=>{if(!active){unsubscribe();resolve();}});});
    receiver.close();
    await cleared;
    assert.equal(link.running,false);
    assert.deepEqual(snapshot,original);
  }finally{link.close();channel.close();}
});

test('cinematic preview, protocol, board overlay and UI do not instantiate or control the Audio Engine',()=>{
  for(const module of ['cinematic-editor.js','cinematic-link.js','cinematic-frame.js','cinematic-protocol.js','../../quadro/board-cinematic.js']){
    const source=readFileSync(new URL('../dist/'+module,import.meta.url),'utf8');
    assert.doesNotMatch(source,/AudioEngine|startScene|stopAll|boardSnapshot|saveBoard|\.snapshot\(/);
  }
});
test('hash cache reuses only the identical immutable Blob; altered bytes still fail identity checks',async()=>{
 const {imageKey,cinematicHashMetrics}=await import('../dist/cinematic-media.js');const blob=new Blob([Uint8Array.of(137,80,78,71,13,10,26,10)],{type:'image/png'}),before=cinematicHashMetrics.calls;
 const id=await imageKey(blob);assert.equal(await imageKey(blob),id);assert.equal(cinematicHashMetrics.calls-before,1);const changed=new Blob([await blob.arrayBuffer(),Uint8Array.of(1)],{type:'image/png'});assert.notEqual(await imageKey(changed),id);
});
