import test from 'node:test';
import assert from 'node:assert/strict';
import {fitComposition,compositionSize} from '../dist/cinematic-composition.js';
function fixture(t,{width=844,height=390,contain=false}={}){
 let resize,disconnected=false;const before=globalThis.ResizeObserver;
 globalThis.ResizeObserver=class{constructor(callback){resize=callback;}observe(){}disconnect(){disconnected=true;}};
 t.after(()=>{if(before===undefined)delete globalThis.ResizeObserver;else globalThis.ResizeObserver=before;});
 const viewport={clientWidth:width,clientHeight:height,getBoundingClientRect(){throw Error('Visual bounds must never be used for layout fit');}},world={style:{}},composition={world,aspect:16/9},dispose=fitComposition(composition,viewport,{contain});
 return {world,composition,viewport,dispose,resize:(width,height)=>resize([{contentRect:{width,height}}]),disconnected:()=>disconnected,size:()=>({width:parseFloat(world.style.width),height:parseFloat(world.style.height)})};
}
test('rotated portrait uses its 844 × 390 local stage, never the 390 × 844 visual rectangle',t=>{const f=fixture(t);assert.deepEqual(f.size(),compositionSize(844,390,16/9));assert.equal(f.size().width,844);assert.ok(1-390/f.size().height<.18);f.dispose();assert.equal(f.disconnected(),true);});
test('all required mobile/desktop sizes preserve cover proportions in local axes',t=>{const f=fixture(t);for(const [physicalWidth,physicalHeight]of [[360,800],[390,844],[412,915],[800,360],[844,390],[915,412],[1920,1080],[1440,900],[1366,768]]){const rotated=physicalWidth<physicalHeight,w=rotated?physicalHeight:physicalWidth,h=rotated?physicalWidth:physicalHeight;f.resize(w,h);const actual=f.size(),expected=compositionSize(w,h,16/9);assert.deepEqual(actual,expected);assert.ok(actual.width>=w&&actual.height>=h);assert.ok(Math.abs(actual.width/actual.height-16/9)<1e-10);}});
test('ResizeObserver fractional content size changes only world dimensions, without touching camera/timeline/video',t=>{const f=fixture(t);const camera={style:{transform:'scale(1.2)'}},video={currentTime:7.5},clock={time:7.5};Object.assign(f.composition,{camera,video,clock});f.resize(843.75,389.5);assert.equal(f.size().width,843.75);assert.equal(camera.style.transform,'scale(1.2)');assert.equal(video.currentTime,7.5);assert.equal(clock.time,7.5);f.resize(844,390);assert.equal(f.size().width,844);});
test('contain editor keeps local coordinates even under scaled ancestors; zero-size notifications preserve last valid world',t=>{const f=fixture(t,{width:600,height:400,contain:true});assert.deepEqual(f.size(),{width:600,height:337.5});f.resize(0,0);assert.deepEqual(f.size(),{width:600,height:337.5});f.resize(400,300);assert.deepEqual(f.size(),{width:400,height:225});});
test('untransformed desktop cover remains identical to previous bounding-rectangle calculation',t=>{const f=fixture(t);for(const [w,h]of [[1920,1080],[1440,900],[1366,768]]){f.resize(w,h);assert.deepEqual(f.size(),compositionSize(w,h,16/9));}});
