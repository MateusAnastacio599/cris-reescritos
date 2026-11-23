import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCinematic,withCinematic,duplicateCinematic,cinematicImageIds,isCinematicPayload,checkCinematicUpload,checkCinematicImage} from '../dist/cinematic-model.js';
import {imageKey,cinematicDimensions,loadCinematicMedia,validateCompositionMedia,storeCinematicImage,matchesCinematicDimensions} from '../dist/cinematic-media.js';
import {compositionSize,parallaxFrames,loadComposition} from '../dist/cinematic-composition.js';
import {cinematicFrames} from '../dist/cinematic-frame.js';
import {initialState,exportWorkspace,importWorkspace,STORAGE_KEY} from '../dist/storage.js';
import {validCinematicMessage,cinematicEnvelope} from '../dist/cinematic-protocol.js';

const png=name=>new Blob([readFileSync(new URL('./fixtures/cinematic-theater/'+name+'.png',import.meta.url))],{type:'image/png'});
const background=png('palco'),figure=png('central');
const backgroundId=await imageKey(background),figureId=await imageKey(figure);
const layer={id:'central',name:'Personagem central',imageId:figureId,x:.5,y:.6,scale:.25,parallax:1.2,visible:true};
const item={id:'theater',name:'Teatro',imageId:backgroundId,motion:'living',seconds:3,intensity:26,layers:[layer]};
const asset={[backgroundId]:background,[figureId]:figure};
const repository=()=>{
  const entries=new Map(Object.entries(asset));let writes=0;
  return {entries,get:async id=>entries.get(id),putAll:async pairs=>{writes++;for(const [id,image] of pairs)entries.set(id,image);},get writes(){return writes;}};
};
const sceneOf=state=>state.campaigns[0].pages[0].scenes[0];

test('optional layers preserve legacy metadata and validate normalized coordinates, IDs and resource count',()=>{
  assert.equal(isCinematic(item),true);
  const legacy={...item};delete legacy.layers;const before=structuredClone(legacy);
  assert.equal(isCinematic(legacy),true);assert.deepEqual(legacy,before);
  for(const change of [{x:-.1},{y:1.1},{scale:0},{scale:3},{parallax:Infinity},{visible:'yes'},{id:'background'},{imageId:'https://example.test/a.png'}]){
    assert.equal(isCinematic({...item,layers:[{...layer,...change}]}),false);
  }
  assert.equal(isCinematic({...item,layers:[layer,layer]}),false);
  assert.equal(isCinematic({...item,layers:Array.from({length:5},(_,i)=>({...layer,id:'layer-'+i}))}),false);
});

test('duplicate gets stable independent IDs while sharing bytes and leaving original cues unchanged',()=>{
  const scene={cinematic:{version:1,items:[item]},cues:[{actions:[{type:'cinematic-start',cinematicId:item.id}]}]};
  const before=structuredClone(scene),copy=duplicateCinematic(scene,item.id);
  assert.notEqual(copy.id,item.id);assert.notEqual(copy.layers[0].id,layer.id);
  assert.deepEqual(cinematicImageIds(copy),cinematicImageIds(item));
  copy.layers[0].x=.1;assert.deepEqual(scene,before);
  const updated=withCinematic(scene,copy);assert.equal(updated.items.length,2);
});

test('all media, including hidden layers, are resolved by hash before presentation',async()=>{
  const repo=repository();
  assert.equal(isCinematicPayload(asset,item),true);
  const hidden={...item,layers:[{...layer,visible:false}]};
  assert.deepEqual(await loadCinematicMedia(hidden,repo),asset);
  repo.entries.delete(figureId);
  await assert.rejects(loadCinematicMedia(hidden,repo),/Arquivo ausente/);
  assert.equal(isCinematicPayload({[backgroundId]:background},item),false);
  assert.equal(isCinematicPayload({...asset,external:'https://example.test/a'},item),false);
});

test('dimensions, true formats, integrity and aggregate allocation are checked before decoding',async()=>{
  assert.deepEqual(await cinematicDimensions(figure),{width:200,height:400,pixels:80000});
  assert.equal((await validateCompositionMedia(item,asset)).size,2);
  const bytes=new Uint8Array(await background.arrayBuffer());new DataView(bytes.buffer).setUint32(16,9000);
  await assert.rejects(cinematicDimensions(new Blob([bytes],{type:'image/png'})),/8192/);
  await assert.rejects(validateCompositionMedia(item,{...asset,[figureId]:background}),/hash/);
  await assert.rejects(cinematicDimensions(new Blob([Uint8Array.of(255,216,255,255,255,255,255,255)],{type:'image/jpeg'})),/Imagem inválida/);
  const wrong=new Blob([await figure.arrayBuffer()],{type:'image/jpeg'});
  await assert.rejects(cinematicDimensions(wrong),/formato/);
  const large=new Blob([new Uint8Array(13*1024*1024)],{type:'image/png'});
  assert.equal(isCinematicPayload({...asset,[figureId]:large},item),false);
});

test('parallax has distinct synchronized planes and background overscan covers every sampled pose',()=>{
  for(const motion of ['static','zoomIn','zoomOut','pan','living','breath','reveal','tension','memory','apparition']){
    const frames=cinematicFrames({...item,motion}),back=parallaxFrames(frames,.35,true),near=parallaxFrames(frames,1.8);
    if(motion!=='static')assert.notDeepEqual(back,near);
    for(const frame of back){
      const [x,y,zoom]=frame.transform.match(/-?[\d.]+/g).map(Number);
      assert.ok((zoom-1)*50>=Math.max(Math.abs(x),Math.abs(y)));
    }
  }
  assert.deepEqual(compositionSize(390,750,16/9),{width:750*16/9,height:750});
  assert.deepEqual(compositionSize(950,500,16/9),{width:950,height:950/(16/9)});
});

test('wire payload requires the complete local composition and the existing account/scene/session checks',()=>{
  const scope={userId:'master',boardCampaignId:'case'},fields={type:'start',senderId:'director',requestId:'request',boardId:'board',sessionId:'session',scene:{campaignId:'c',pageId:'p',sceneId:'s'},sequence:1,item,image:asset};
  const message=cinematicEnvelope(scope,fields);
  assert.equal(validCinematicMessage(message,scope),true);
  assert.equal(validCinematicMessage({...message,image:background},scope),false);
  assert.equal(validCinematicMessage({...message,boardCampaignId:'other'},scope),false);
  assert.equal(validCinematicMessage({...message,at:0},scope),false);
});

test('complete backup restores shared layered media and rejects partial corruption before any write',async()=>{
  const state=initialState(),scene=sceneOf(state),source=repository(),target=repository();
  scene.cinematic=withCinematic(scene,item);scene.cinematic=withCinematic(scene,duplicateCinematic(scene,item.id));
  const before=scene.markdown,text=await (await exportWorkspace(state,true,source)).text(),raw=JSON.parse(text);
  assert.equal(Object.keys(raw.cinematicMedia).length,2);
  const values=new Map(),prior=globalThis.localStorage;
  globalThis.localStorage={setItem:(key,value)=>values.set(key,value),getItem:key=>values.get(key)??null};
  try{
    const restored=await importWorkspace(text,target);
    assert.deepEqual(sceneOf(restored).cinematic,scene.cinematic);assert.equal(sceneOf(restored).markdown,before);
    const saved=values.get(STORAGE_KEY),writes=target.writes;
    raw.cinematicMedia[figureId].base64+='broken';
    await assert.rejects(importWorkspace(JSON.stringify(raw),target));
    assert.equal(target.writes,writes);assert.equal(values.get(STORAGE_KEY),saved);
    const missing=repository();missing.entries.delete(figureId);delete raw.cinematicMedia[figureId];
    await assert.rejects(importWorkspace(JSON.stringify(raw),missing),/não contém/);
  }finally{if(prior)globalThis.localStorage=prior;else delete globalThis.localStorage;}
});

test('superseded loads release decoded URLs and cannot construct a later composition',async()=>{
  const controller=new AbortController();let count=0;
  const document={createElement:()=>{count++;return {className:'',dataset:{}};}};
  const loading=loadComposition(asset,item,document,{signal:controller.signal});controller.abort();
  await assert.rejects(loading,{name:'AbortError'});assert.equal(count,0);
});

test('both board distributions share the same player and protocol',()=>{
  const root=new URL('../../',import.meta.url);
  const original=readFileSync(new URL('quadro/board-cinematic.js',root),'utf8');
  const mirror=readFileSync(new URL('campaign-director/dist/cris/quadro/board-cinematic.js',root),'utf8');
  assert.equal(original.replaceAll('../campaign-director/dist/','../../'),mirror);
});


test('legacy filenames stay readable while new uploads require a matching extension',async()=>{
  const legacy=new Blob([await figure.arrayBuffer()],{type:'image/png'});
  Object.defineProperty(legacy,'name',{value:'arquivo-antigo'});
  assert.equal(await checkCinematicImage(legacy),legacy);
  await assert.rejects(checkCinematicUpload(legacy),/extensão/);
});

test('composition budgets count repeated visible allocations and cap aggregate transfer bytes',async()=>{
  const bytes=new Uint8Array(await figure.arrayBuffer()),view=new DataView(bytes.buffer);
  view.setUint32(16,4000);view.setUint32(20,2000);
  const large=new Blob([bytes],{type:'image/png'}),id=await imageKey(large);
  const many={...item,layers:Array.from({length:3},(_,i)=>({...layer,id:'large-'+i,imageId:id}))};
  await assert.rejects(validateCompositionMedia(many,{[backgroundId]:background,[id]:large}),/somando/);
  const fat=new Blob([new Uint8Array(9*1024*1024)],{type:'image/png'});
  const ids=['a','b','c'].map(value=>'image-'+value.repeat(64));
  const heavy={...item,imageId:ids[0],layers:[{...layer,imageId:ids[1]},{...layer,id:'another',imageId:ids[2]}]};
  assert.equal(isCinematicPayload(Object.fromEntries(ids.map(id=>[id,fat])),heavy),false);
});

test('browser decode failure rejects a restore before changing either media or saved workspace',async()=>{
  const state=initialState(),source=repository(),target=repository();sceneOf(state).cinematic=withCinematic(sceneOf(state),item);
  const text=await (await exportWorkspace(state,true,source)).text();
  const previous=globalThis.createImageBitmap,storage=globalThis.localStorage;
  let writes=0;globalThis.localStorage={setItem:()=>{writes++;},getItem:()=>null};
  globalThis.createImageBitmap=async()=>{throw Error('decode failed');};
  try{
    await assert.rejects(importWorkspace(text,target),/corrompida/);
    assert.equal(writes,0);assert.equal(target.writes,0);
  }finally{
    if(previous)globalThis.createImageBitmap=previous;else delete globalThis.createImageBitmap;
    if(storage)globalThis.localStorage=storage;else delete globalThis.localStorage;
  }
});

test('storing an already present image preserves the single hash entry',async()=>{
  const repo=repository();assert.equal(await storeCinematicImage(figure,repo),figureId);
  assert.equal(repo.entries.size,2);assert.equal(repo.writes,0);
});


test('JPEG backgrounds and transparent lossless WebP report their original dimensions',async()=>{
  assert.equal(matchesCinematicDimensions({type:'image/jpeg'},{width:960,height:540},540,960),true);
  assert.equal(matchesCinematicDimensions({type:'image/png'},{width:960,height:540},540,960),false);
  for(const [name,type,width,height] of [['palco.jpg','image/jpeg',960,540],['central.webp','image/webp',200,400]]){
    const image=new Blob([readFileSync(new URL('./fixtures/cinematic-theater/'+name,import.meta.url))],{type});
    assert.deepEqual(await cinematicDimensions(image),{width,height,pixels:width*height});
  }
});
