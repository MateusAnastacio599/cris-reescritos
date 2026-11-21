import test from 'node:test';
import assert from 'node:assert/strict';
import {CinematicMotionPreference} from '../dist/cinematic-motion.js';
import {CinematicCues,validateCinematicCue} from '../dist/cinematic-cues.js';
import {CINEMATIC_MOTIONS,cinematicFades,cinematicTotal,isCinematic,withCinematic} from '../dist/cinematic-model.js';
import {cinematicFrames} from '../dist/cinematic-frame.js';
import {initialState,validateState,exportWorkspace,importWorkspace} from '../dist/storage.js';
import {storeCinematicImage} from '../dist/cinematic-media.js';
import {AudioEngine} from '../dist/audio-engine.js';

const image=new Blob([Uint8Array.of(137,80,78,71,13,10,26,10)],{type:'image/png'});
const item={id:'living-scene',imageId:'image-'+'a'.repeat(64),name:'Uma memória',motion:'memory',seconds:3,intensity:20,hold:1,fadeIn:.2,fadeOut:.5};
const scope={userId:'master',boardCampaignId:'case'};
const location={campaignId:'reescritos',pageId:'sao-martinho',sceneId:'quarto'};
const sceneOf=state=>state.campaigns[0].pages[0].scenes.find(scene=>scene.id==='quarto');

test('motion opt-in is local, reversible, and follows changes to the system preference',()=>{
  const store=new Map(),events=new EventTarget();
  const media={matches:true,addEventListener:(...args)=>events.addEventListener(...args)};
  const storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
  const preference=new CinematicMotionPreference({media,storage});
  assert.equal(preference.reduced,true);
  let reduced;const remove=preference.subscribe(value=>{reduced=value;});
  preference.allow(true);
  assert.equal(preference.reduced,false);
  assert.equal(media.matches,true);
  assert.equal(new CinematicMotionPreference({media,storage}).reduced,false);
  preference.allow(false);
  assert.equal(reduced,true);
  media.matches=false;events.dispatchEvent(new Event('change'));
  assert.equal(reduced,false);
  remove();
});

test('ten presets, safe fades and total duration preserve old data defaults',()=>{
  assert.equal(Object.keys(CINEMATIC_MOTIONS).length,10);
  assert.deepEqual(cinematicFades({}),{fadeIn:.3,fadeOut:.3});
  assert.equal(cinematicTotal(item),4.5);
  for(const motion of Object.keys(CINEMATIC_MOTIONS))assert.ok(isCinematic({...item,motion}));
  for(const value of [-1,6,'1',null,NaN,Infinity])assert.equal(isCinematic({...item,fadeIn:value}),false);
  const frames=cinematicFrames(item);
  assert.deepEqual(frames[0],frames.at(-1));
  assert.notDeepEqual(frames[0],frames[1]);
  assert.deepEqual(cinematicFrames({...item,intensity:0}),[{transform:'scale(1)'},{transform:'scale(1)'}]);
});

function fixture(){
  const engine=new EventTarget(),state=initialState(),calls=[],errors=[];
  const scene=sceneOf(state);scene.cinematic={version:1,items:[item]};
  let current={...location};
  const link={present:async(...args)=>calls.push(['start',...args]),stop:(...args)=>calls.push(['stop',...args])};
  const images={get:async()=>image};
  const cues=new CinematicCues({engine,link,images,getState:()=>state,getLocation:()=>current,getScope:()=>scope,onError:message=>errors.push(message)});
  const cue={id:'sequence',name:'Revelar',actions:[]};scene.cues.push(cue);
  const context={};engine.dispatchEvent(new CustomEvent('cue-context',{detail:{cue,context}}));
  return {engine,state,cues,context:context.cinematic,calls,errors,images,navigate:()=>{current={...location,sceneId:'corredor'};cues.invalidate();}};
}

test('cue starts the saved image and stops using the same local link',async()=>{
  const f=fixture();
  await f.cues.execute({type:'cinematic-start',cinematicId:item.id,replace:false},f.context);
  assert.equal(f.calls[0][0],'start');
  assert.equal(f.calls[0][3],item);
  assert.deepEqual(f.calls[0][5],{replace:false});
  await f.cues.execute({type:'cinematic-stop',immediate:true},f.context);
  assert.deepEqual(f.calls[1],['stop',undefined,{immediate:true}]);
});

test('navigation and later stop invalidate pending asynchronous image loads',async()=>{
  for(const stop of [false,true]){
    const f=fixture();let resolve;
    f.images.get=()=>new Promise(done=>{resolve=done;});
    const loading=f.cues.execute({type:'cinematic-start',cinematicId:item.id},f.context);
    if(stop)await f.cues.execute({type:'cinematic-stop'},f.context);else f.navigate();
    resolve(image);assert.equal(await loading,false);
    assert.equal(f.calls.some(call=>call[0]==='start'),false);
    assert.equal(await f.cues.execute({type:'cinematic-start',cinematicId:'missing'}, {...f.context,revision:-1}),false);
  }
});

test('missing or malformed cinematic actions fail without touching audio or an unrelated presentation',async()=>{
  const f=fixture();
  for(const action of [{type:'cinematic-start',cinematicId:'bad/id'},{type:'cinematic-start',cinematicId:item.id,replace:'yes'},{type:'cinematic-stop',immediate:1}])assert.throws(()=>validateCinematicCue(action));
  await assert.rejects(f.cues.execute({type:'cinematic-start',cinematicId:'deleted'},f.context),/não está disponível/);
  f.images.get=async()=>null;
  await assert.rejects(f.cues.execute({type:'cinematic-start',cinematicId:item.id},f.context),/Imagem/);
  assert.deepEqual(f.calls,[]);
});

test('new metadata and both cinematic cue actions survive a complete backup alongside legacy items',async()=>{
  const state=initialState(),scene=sceneOf(state),entries=new Map();
  const images={get:async key=>entries.get(key),putAll:async pairs=>pairs.forEach(([key,value])=>entries.set(key,value))};
  const imageId=await storeCinematicImage(image,images);
  scene.cinematic=withCinematic(scene,{...item,imageId});
  scene.cinematic=withCinematic(scene,{id:'old',imageId,name:'Antiga',motion:'pan',seconds:12,intensity:12});
  scene.cues.push({id:'live',name:'Cena viva',actions:[{type:'cinematic-start',cinematicId:item.id,replace:true,delay:.2},{type:'cinematic-stop',immediate:false,delay:5}]});
  validateState(state);
  const backup=await (await exportWorkspace(state,true,images)).text(),before=scene.markdown;
  const prior=globalThis.localStorage;
  globalThis.localStorage={setItem(){},getItem(){return null;}};
  try{
    const restored=await importWorkspace(backup,images);
    assert.deepEqual(sceneOf(restored).cinematic,scene.cinematic);
    assert.deepEqual(sceneOf(restored).cues,scene.cues);
    assert.equal(sceneOf(restored).markdown,before);
  }finally{if(prior)globalThis.localStorage=prior;else delete globalThis.localStorage;}
});

test('the existing runner schedules cinematic commands and cancels them on audio pause/stop',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const state=initialState(),engine=new AudioEngine(()=>state),received=[];
  try{
    const cue={id:'schedule',name:'Sequência',actions:[{type:'cinematic-start',cinematicId:item.id,delay:0},{type:'cinematic-stop',delay:1}]};
    engine.addEventListener('cue-context',e=>{e.detail.context.marker='captured';});
    engine.addEventListener('cinematic-action',e=>received.push(e.detail));
    engine.fireCue(cue);
    assert.equal(received.length,1);
    assert.equal(received[0].context.marker,'captured');
    t.mock.timers.tick(1000);
    assert.equal(received[1].action.type,'cinematic-stop');
    engine.fireCue({...cue,actions:[{type:'cinematic-start',cinematicId:item.id,delay:1}]});
    engine.clearDelays();t.mock.timers.tick(1000);
    assert.equal(received.length,2);
    assert.equal(engine.tracks.size,0);
  }finally{clearInterval(engine.timer);engine.clearDelays();}
});

test('cue reports a board that failed to open instead of silently losing its failure',async()=>{
  const f=fixture();
  f.cues.link.present=async()=>undefined;
  f.cues.link.message='Quadro indisponível.';
  await assert.rejects(f.cues.execute({type:'cinematic-start',cinematicId:item.id},f.context),/Quadro indisponível/);
});
