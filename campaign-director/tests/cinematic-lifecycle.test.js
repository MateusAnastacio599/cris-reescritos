import test from 'node:test';
import assert from 'node:assert/strict';
import {CinematicFrame,cinematicFrames,CINEMATIC_FADE_MS} from '../dist/cinematic-frame.js';
import {canLoopCinematic,cinematicEnding,isCinematic,validateSceneCinematics} from '../dist/cinematic-model.js';
import {CinematicReceiver,CINEMATIC_CHANNEL,cinematicEnvelope} from '../dist/cinematic-protocol.js';
import {CinematicMotionPreference} from '../dist/cinematic-motion.js';
import {CinematicLink} from '../dist/cinematic-link.js';

const image=new Blob([Uint8Array.of(137,80,78,71,13,10,26,10)],{type:'image/png'});
const legacy={id:'garnier',imageId:'image-'+'a'.repeat(64),name:'Teatro Garnier',motion:'zoomIn',seconds:3,intensity:24};
const scope={userId:'master-test',boardCampaignId:'case-test'};
const scene={campaignId:'camp',pageId:'page',sceneId:'scene'};

test('legacy data retains its ID, image and motion, with automatic ending by default',()=>{
  const original={version:1,items:[legacy]};
  const before=structuredClone(original);
  validateSceneCinematics(original);
  assert.deepEqual(original,before);
  assert.deepEqual(cinematicEnding(legacy),{ending:'auto',hold:2});
  assert.equal(isCinematic({...legacy,ending:'loop'}),false);
  assert.equal(isCinematic({...legacy,motion:'reveal',ending:'loop'}),false);
  assert.equal(isCinematic({...legacy,motion:'breath',ending:'loop',hold:0}),true);
  assert.equal(isCinematic({...legacy,hold:21}),false);
});

test('cyclic presets close on the same pose, and reveal zooms in only once',()=>{
  for(const motion of ['living','breath','tension']){
    const frames=cinematicFrames({motion,intensity:26});
    assert.ok(canLoopCinematic(motion));
    assert.deepEqual(frames[0],frames.at(-1));
    assert.notDeepEqual(frames[0],frames[1]);
  }
  assert.deepEqual(cinematicFrames({motion:'reveal',intensity:20}),[{transform:'scale(1)'},{transform:'scale(1.2)'}]);
  assert.deepEqual(cinematicFrames({motion:'breath',intensity:20},true),[{transform:'scale(1)'},{transform:'scale(1)'}]);
});

function fakeLayer(){
  const calls=[],classes=new Set();
  const document={createElement:tag=>({tag,naturalWidth:100,naturalHeight:100,
    ownerDocument:document,replaceChildren(){},append(){},setAttribute(){},decode:async()=>{},animate(frames,timing){
      const animation={frames,timing,cancelled:false,cancel(){this.cancelled=true;}};
      calls.push(animation);return animation;
    }})};
  const layer={ownerDocument:document,style:{setProperty(){}},hidden:true,isConnected:false,children:[],
    classList:{add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value)},
    getBoundingClientRect(){},replaceChildren(...nodes){this.children=nodes;},append(node){this.children.push(node);},
    remove(){this.isConnected=false;}};
  const frame=new CinematicFrame(layer,{motion:new CinematicMotionPreference({media:globalThis.matchMedia(),storage:null}),mount:{append(node){node.isConnected=true;}}});
  return {frame,layer,calls};
}

test('reduced motion holds a static image for duration plus hold and still removes the overlay',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const previous=globalThis.matchMedia;
  globalThis.matchMedia=()=>({matches:true});
  t.after(()=>{if(previous)globalThis.matchMedia=previous;else delete globalThis.matchMedia;});
  const {frame,layer,calls}=fakeLayer();
  let ended=0;
  await frame.show(image,{...legacy,motion:'breath',hold:1},()=>ended++);
  assert.equal(calls.length,0);
  t.mock.timers.tick(3999);
  assert.equal(layer.isConnected,true);
  t.mock.timers.tick(1);
  assert.equal(layer.isConnected,true);
  t.mock.timers.tick(CINEMATIC_FADE_MS+30);
  await Promise.resolve();
  assert.equal(layer.isConnected,false);
  assert.equal(ended,1);
});

test('a new show invalidates an old fade; loop stays until manual clearing',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const previous=globalThis.matchMedia;
  globalThis.matchMedia=()=>({matches:false});
  t.after(()=>{if(previous)globalThis.matchMedia=previous;else delete globalThis.matchMedia;});
  const {frame,layer,calls}=fakeLayer();
  let oldEnd=0;
  await frame.show(image,{...legacy,hold:0},()=>oldEnd++);
  t.mock.timers.tick(3000);
  assert.equal(layer.classList.contains('cinematic-visible'),false);
  await frame.show(image,{...legacy,motion:'breath',ending:'loop'});
  t.mock.timers.tick(10000);
  await Promise.resolve();
  assert.equal(layer.isConnected,true);
  assert.equal(oldEnd,0);
  assert.equal(calls[0].cancelled,true);
  assert.equal(calls[1].timing.iterations,Infinity);
  assert.equal(calls[2].timing.iterations,Infinity);
  const clearing=frame.clear();
  t.mock.timers.tick(CINEMATIC_FADE_MS);
  assert.equal(layer.isConnected,true);
  t.mock.timers.tick(30);
  assert.equal(await clearing,true);
  assert.equal(layer.isConnected,false);
  assert.ok(calls.every(animation=>animation.cancelled));
});

test('the active playback alone can end the Director session; manual stop waits for board confirmation',async()=>{
  const channel=new BroadcastChannel(CINEMATIC_CHANNEL),link=new CinematicLink();
  let finishClear;
  const pending=[],frame={
    show:async(_asset,_item,onEnd)=>{pending.push(onEnd);return true;},
    clear:({immediate}={})=>immediate?true:new Promise(resolve=>{finishClear=resolve;}),
  };
  const receiver=new CinematicReceiver({scope,boardId:'board-test',frame,send:message=>channel.postMessage(message)});
  channel.onmessage=event=>void receiver.handle(event.data);
  const until=async fn=>{
    for(let i=0;i<30&&!fn();i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.ok(fn());
  };
  try{
    await link.present(scope,scene,legacy,image);
    const old={...link.active};
    await link.present(scope,scene,legacy,image);
    assert.notEqual(link.active.sessionId,old.sessionId);
    pending[0]();
    channel.postMessage(cinematicEnvelope(scope,{...old,requestId:'old-ack',type:'ended',reason:'automatic'}));
    await new Promise(resolve=>setTimeout(resolve,15));
    assert.equal(link.running,true);
    pending[1]();
    await until(()=>!link.running);
    assert.match(link.message,/automaticamente/);

    await link.present(scope,scene,legacy,image);
    link.stop();
    assert.equal(link.running,true);
    assert.match(link.message,/Encerrando/);
    await until(()=>finishClear);
    finishClear(true);
    await until(()=>!link.running);
    assert.match(link.message,/encerrada/);
  }finally{link.close();receiver.close();channel.close();}
});

test('failed replacement also stops the earlier looping image',async t=>{
  // Node's channel groups retain closed ports briefly. Isolate this case.
  const NativeChannel=globalThis.BroadcastChannel;
  globalThis.BroadcastChannel=class extends NativeChannel{constructor(name){super(name+'-replacement');}};
  t.after(()=>{globalThis.BroadcastChannel=NativeChannel;});
  const channel=new BroadcastChannel(CINEMATIC_CHANNEL),link=new CinematicLink(),shown=[];
  let ready=true,clears=0;
  const receiver=new CinematicReceiver({scope,boardId:'replace-board',ready:()=>ready,
    frame:{show:async()=>{shown.push(true);return true;},clear:()=>{clears++;return true;}},send:message=>channel.postMessage(message)});
  channel.onmessage=event=>void receiver.handle(event.data);
  try{
    assert.equal(await link.present(scope,scene,legacy,image),true,link.message);
    ready=false;
    await link.present(scope,scene,legacy,image);
    for(let i=0;i<30&&receiver.active;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(link.running,false);
    assert.equal(receiver.active,null);
    assert.equal(shown.length,1);
    assert.ok(clears>0);
  }finally{link.close();receiver.close();channel.close();}
});

test('an immediate stop can supersede a fade already in progress and acknowledges only once',async()=>{
  const replies=[],active={senderId:'director',boardId:'board',sessionId:'session',scene,requestId:'request',started:true};
  let finishFade;
  const receiver=new CinematicReceiver({scope,boardId:'board',frame:{
    clear:({immediate})=>{if(immediate){finishFade(false);return true;}return new Promise(resolve=>{finishFade=resolve;});},
  },send:reply=>replies.push(reply)});
  receiver.active=active;
  const fading=receiver.finish(active,'manual');
  await receiver.handle(cinematicEnvelope(scope,{...active,type:'stop',sequence:2,immediate:true}));
  await fading;
  assert.equal(replies.filter(reply=>reply.type==='ended').length,1);
  assert.equal(receiver.ending,null);
});
