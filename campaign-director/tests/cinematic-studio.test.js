import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCinematic,isCinematicLayer,withCinematic,duplicateCinematic,cinematicMediaIds,isCinematicPayload} from '../dist/cinematic-model.js';
import {imageKey,validateCompositionMedia,exportCinematicImages,readCinematicBackup,loadCinematicMedia} from '../dist/cinematic-media.js';
import {defaultCamera,safeCameraPose,cameraTransform,ANCHORS,changeLayerAnchor,newEffect,validEffect,lightingProfile,validLighting} from '../dist/cinematic-direction-model.js';
import {effectFrames,animateLayerEffects} from '../dist/cinematic-direction-player.js';
import {checkCinematicVideo,videoPosition,CinematicVideoLayer} from '../dist/cinematic-video.js';
import {StudioHistory} from '../dist/cinematic-studio-history.js';
import {cinematicFrames} from '../dist/cinematic-frame.js';
import {validCinematicMessage,cinematicEnvelope} from '../dist/cinematic-protocol.js';
const file=(name,type)=>new Blob([readFileSync(new URL('./fixtures/'+name,import.meta.url))],{type});
const background=file('cinematic-theater/palco.png','image/png'),fallback=file('cinematic-studio/iris.png','image/png'),video=file('cinematic-studio/iris.webm','video/webm');
const bg=await imageKey(background),png=await imageKey(fallback),webm=await imageKey(video);
const layer={id:'iris',name:'Iris',imageId:png,x:.5,y:.6,scale:.038,parallax:.7,visible:true,anchor:{...ANCHORS.feet},effects:[newEffect('breath')],video:{mediaId:webm,enabled:true,loop:true,rate:1,delay:0,end:'freeze'}};
const item={id:'theater',name:'Teatro · ensaio',imageId:bg,motion:'living',seconds:12,intensity:22,layers:[layer],camera:defaultCamera(),lighting:lightingProfile('theater')};
const media={[bg]:background,[png]:fallback,[webm]:video};
const repo={get:async id=>media[id]};
const state={campaigns:[{pages:[{scenes:[{cinematic:{version:1,items:[item]}}]}]}]};

test('direction metadata remains optional and never mutates legacy presentations',()=>{
  const old={id:'old',name:'Imagem antiga',imageId:bg,motion:'living',seconds:12,intensity:22};const before=structuredClone(old);assert.ok(isCinematic(old));assert.deepEqual(old,before);assert.ok(isCinematic(item));
  const malformed=[{camera:{...item.camera,url:'https://x'}},{lighting:{...item.lighting,color:'url(x)'}},{layers:[{...layer,anchor:{x:2,y:.5}}]}];for(const change of malformed)assert.equal(isCinematic({...item,...change}),false);
});
test('scale supports .1% through 300% and retains original normalized meaning',()=>{for(const scale of [.001,.03,.038,.1,1,3])assert.ok(isCinematicLayer({...layer,scale}));for(const scale of [0,.0009,3.01,NaN,Infinity])assert.equal(isCinematicLayer({...layer,scale}),false);});
test('anchor change preserves the visual top-left at arbitrary aspect and rotation',()=>{
  const l={...layer,anchor:ANCHORS.center,rotation:20},next=changeLayerAnchor(l,ANCHORS.feet,16/9,.5);const angle=20*Math.PI/180,dx=0,dy=.5*l.scale/.5;
  assert.ok(Math.abs(next.x-l.x-(dx*Math.cos(angle)-dy*Math.sin(angle)))<1e-12);assert.ok(Math.abs(next.y-l.y-(dx*Math.sin(angle)+dy*Math.cos(angle))*16/9)<1e-12);assert.equal(next.scale,.038);
  assert.throws(()=>changeLayerAnchor({...l,y:.99},ANCHORS.feet,16/9,.5),/fora/);
});
test('safe camera framing clamps centers at every zoom and living does not drift sideways',()=>{
  for(const zoom of [1,1.5,3,12]){const p=safeCameraPose({x:0,y:1,zoom});assert.equal(p.x,.5/zoom);assert.equal(p.y,1-.5/zoom);assert.match(cameraTransform(p),/scale/);}
  for(const frame of cinematicFrames({motion:'living',intensity:22}))assert.match(frame.transform,/translate\(0%, 0%\)/);
});
test('effect types validate their own fields and reject unsafe excess values',()=>{
  for(const type of ['breath','sway','shake','opacity','move']){const e=newEffect(type);assert.ok(validEffect(e));assert.equal(validEffect({...e,html:'<script>'}),false);assert.equal(validEffect({...e,duration:0}),false);assert.equal(validEffect({...e,easing:'url(x)'}),false);assert.equal(validEffect({...e,repeat:1}),false);}
  assert.equal(validEffect({...newEffect('shake'),frequency:100}),false);
});
test('breathing and sway close loops, while alternate move and opacity avoid abrupt resets',()=>{
  for(const type of ['breath','sway','shake']){const frames=effectFrames(newEffect(type));assert.deepEqual(frames[0],frames.at(-1));}
  const records=[],effects=['move','opacity'].map(type=>({effect:{...newEffect(type),repeat:true},node:{animate:(frames,timing)=>{const a={frames,timing};records.push(a);return a;}}}));
  const animations=animateLayerEffects({planes:[{entry:{visible:true},effects}]},2400);assert.equal(animations.length,2);for(const a of records){assert.equal(a.timing.direction,'alternate');assert.equal(a.currentTime,2400);}
});
test('lighting profiles have at most two bounded slow lights, all metadata reversible',()=>{
  for(const key of ['candle','theater','unstable','dark','window']){const l=lightingProfile(key);assert.ok(validLighting(l));assert.equal(validLighting({...l,darkness:1}),false);assert.equal(validLighting({...l,spots:[...l.spots,...l.spots,...l.spots]}),l.spots.length===0);}
});
test('original transparent WebM fixture has verified VP9 alpha, dimensions, duration and no audio',async()=>{
  const size=await checkCinematicVideo(video);assert.equal(size.width,256);assert.equal(size.height,512);assert.equal(size.seconds,2);assert.ok(size.fps<13);assert.match(webm,/^video-[a-f0-9]{64}$/);
  const fake=new Blob(['webm'],{type:'video/webm'});await assert.rejects(checkCinematicVideo(fake),/não é WebM/);
  await assert.rejects(checkCinematicVideo(new Blob([new Uint8Array(8*1024*1024+1)],{type:'video/webm'})),/8 MB/);
  await assert.rejects(checkCinematicVideo(new Blob([await video.arrayBuffer()],{type:'audio/webm'})),/WebM/);
});
test('video metadata rejects unsupported paths, rates, modes, and more than two video layers',()=>{
  for(const change of [{rate:0},{rate:3},{delay:-1},{end:'javascript:'},{mediaId:'https://x'}, {enabled:1}])assert.equal(isCinematic({...item,layers:[{...layer,video:{...layer.video,...change}}]}),false);
  assert.equal(isCinematic({...item,layers:[layer,{...layer,id:'b'},{...layer,id:'c'}]}),false);
});
test('composition includes both hashed video and required PNG, verifies all hashes and decode budget',async()=>{
  assert.ok(isCinematicPayload(media,item));assert.deepEqual(cinematicMediaIds(item),[bg,png,webm]);assert.equal((await validateCompositionMedia(item,media)).get(webm).seconds,2);
  assert.equal(isCinematicPayload({[bg]:background,[png]:fallback},item),false);await assert.rejects(validateCompositionMedia(item,{...media,[webm]:file('cinematic-studio/alpha-probe.webm','video/webm')}),/hash/);
  assert.deepEqual(await loadCinematicMedia(item,repo),media);await assert.rejects(loadCinematicMedia(item,{get:async id=>id===webm?null:media[id]}),/Arquivo ausente/);
});
test('complete backup roundtrip retains camera, effects, lights, video, IDs and shared file bytes',async()=>{
  const before=structuredClone(state),backup=await exportCinematicImages(state,repo);assert.equal(Object.keys(backup).length,3);const entries=await readCinematicBackup(state,backup,{get:async()=>null});assert.deepEqual(new Map(entries).keys().toArray().sort(),Object.keys(media).sort());assert.deepEqual(state,before);
  for(const [id,blob] of entries)assert.equal(await imageKey(blob),id);
  const scene=state.campaigns[0].pages[0].scenes[0],copy=duplicateCinematic(scene,item.id);assert.notEqual(copy.id,item.id);assert.equal(copy.layers[0].video.mediaId,webm);assert.deepEqual(copy.camera,item.camera);assert.equal(withCinematic(scene,copy).items.length,2);
});
test('partial invalid backups reject before modifying any repository',async()=>{
  const backup=await exportCinematicImages(state,repo);delete backup[webm];let writes=0;await assert.rejects(readCinematicBackup(state,backup,{get:async()=>null,putAll:()=>writes++}),/backup/);assert.equal(writes,0);
});
test('studio history records coherent structural changes and restores exact presentation state',()=>{
  const h=new StudioHistory(3);h.record(item);const moved=structuredClone(item);moved.layers[0].scale=.031;h.record(moved);h.record(moved);assert.equal(h.entries.length,2);assert.deepEqual(h.undo(),item);assert.deepEqual(h.redo(),moved);h.undo();h.record({...item,name:'Variação'});assert.equal(h.redo(),null);assert.deepEqual(h.undo(),item);
});
test('video position uses the shared clock, delay, rate, repeat and safe end frame',()=>{const v={...layer.video,delay:1,rate:2};assert.equal(videoPosition(v,0,2),0);assert.equal(videoPosition(v,1.5,2),1);assert.equal(videoPosition(v,2.5,2),1);assert.equal(videoPosition({...v,loop:false},20,2),1.96);});
test('stale play promises cannot resurrect video after pause or disposal',async()=>{
  let finish,paused=0;const player=new CinematicVideoLayer({document:{},container:{},fallback:{style:{}},config:layer.video});
  player.video={duration:2,currentTime:0,paused:true,pause:()=>paused++,play:()=>new Promise(resolve=>{finish=resolve;}),removeAttribute(){},load(){},remove(){}};player.ready=true;
  player.sync(.2,true,false);player.sync(.3,false,false);finish();await Promise.resolve();assert.ok(paused>=2);player.dispose();assert.equal(player.video,null);
});
test('same local protocol preserves scope validation with advanced metadata and binary video',()=>{
  const scope={userId:'master-test',boardCampaignId:'case-test'};const m=cinematicEnvelope(scope,{type:'start',senderId:'director',boardId:'board',sessionId:'session',scene:{campaignId:'camp',pageId:'page',sceneId:'scene'},requestId:'req',sequence:1,item,image:media});assert.ok(validCinematicMessage(m,scope));assert.equal(validCinematicMessage(m,{...scope,userId:'other'}),false);
});

test('player pause, precise seek, resume and restart retain a single main clock',async()=>{
  const {CinematicFrame}=await import('../dist/cinematic-frame.js');
  const animations=[],doc={createElement:()=>({naturalWidth:100,naturalHeight:100,decode:async()=>{},animate:(frames,timing)=>{const a={frames,timing,currentTime:0,pause(){this.paused=true;},play(){this.paused=false;},cancel(){this.cancelled=true;}};animations.push(a);return a;}})};
  const element={ownerDocument:doc,style:{setProperty(){}},classList:{add(){},remove(){}},hidden:true,replaceChildren(){},getBoundingClientRect(){}};
  const frame=new CinematicFrame(element,{motion:{reduced:false,subscribe:()=>()=>{}}});
  await frame.show(background,{id:'clock',name:'Relógio',imageId:bg,motion:'zoomIn',seconds:12,intensity:22,ending:'auto',hold:0});
  frame.pause();const at=frame.time();await new Promise(r=>setTimeout(r,5));assert.equal(frame.time(),at);assert.ok(animations.every(a=>a.paused));
  frame.seek(4.25);assert.equal(frame.time(),4.25);assert.ok(animations.every(a=>a.currentTime===4250));frame.play();assert.ok(frame.playing);frame.restart();assert.ok(frame.time()<.05);await frame.clear({immediate:true});assert.equal(frame.time(),0);assert.ok(animations.every(a=>a.cancelled));
});
test('disabled or failed video retains the fallback and never creates an audio source',async()=>{
  let allocations=0;const p=new CinematicVideoLayer({document:{createElement(){allocations++;}},fallback:{style:{}},container:{},config:{...layer.video,enabled:false}});await p.prepare();assert.equal(allocations,0);
  let warned='';p.warn=m=>warned=m;p.video={pause(){},hidden:false};p.ready=true;p.fail();assert.equal(p.ready,false);assert.equal(p.video.hidden,true);assert.equal(p.fallback.style.visibility,'visible');assert.match(warned,/PNG/);
});
test('alpha decoding failure chooses PNG rather than claiming support from MIME',async()=>{
  const {supportsTransparentVideo}=await import('../dist/cinematic-video.js');let allocations=0,handlers={};
  const document={createElement:()=>{allocations++;return {addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener(){},pause(){},removeAttribute(){},load(){if(handlers.error)queueMicrotask(()=>handlers.error());}};}};
  assert.equal(await supportsTransparentVideo(document),false);assert.equal(await supportsTransparentVideo(document),false);assert.equal(allocations,1);
  const p=new CinematicVideoLayer({document,container:{},fallback:{style:{}},blob:video,config:layer.video});await p.prepare();assert.equal(p.video,undefined);p.dispose();
});
test('real workspace export/import restores direction metadata and video without changing Markdown or unrelated settings',async()=>{
  const {initialState,exportWorkspace,importWorkspace,STORAGE_KEY}=await import('../dist/storage.js');
  const workspace=initialState(),scene=workspace.campaigns[0].pages[0].scenes[0];scene.cinematic=withCinematic(scene,item);
  const before=scene.markdown,settings=structuredClone(workspace.settings),text=await(await exportWorkspace(workspace,true,repo)).text();
  const values=new Map(),bytes=new Map(),prior=globalThis.localStorage;let writes=0;
  globalThis.localStorage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)??null};
  const target={get:async id=>bytes.get(id),putAll:async entries=>{writes++;for(const [id,blob] of entries)bytes.set(id,blob);}};
  try{
    const restored=await importWorkspace(text,target),restoredScene=restored.campaigns[0].pages[0].scenes[0];assert.deepEqual(restoredScene.cinematic,scene.cinematic);assert.equal(restoredScene.markdown,before);assert.deepEqual(restored.settings,settings);assert.equal(await imageKey(bytes.get(webm)),webm);
    const saved=values.get(STORAGE_KEY),count=writes,corrupt=JSON.parse(text);corrupt.cinematicMedia[webm].base64='AAAA';await assert.rejects(importWorkspace(JSON.stringify(corrupt),target));assert.equal(writes,count);assert.equal(values.get(STORAGE_KEY),saved);
  }finally{if(prior===undefined)delete globalThis.localStorage;else globalThis.localStorage=prior;}
});
