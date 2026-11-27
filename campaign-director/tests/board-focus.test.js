import test from 'node:test';
import assert from 'node:assert/strict';
import {boardBounds,fitBoardCamera,fitCameraCall} from '../integration-main/quadro/board-live.js';
const views=[[360,800],[390,844],[844,390],[768,1024],[1440,900]];
const inside=(b,c,w,h)=>{assert.ok((b.left-c.x)*c.z>=-1e-5);assert.ok((b.right-c.x)*c.z<=w+1e-5);assert.ok((b.top-c.y)*c.z>=-1e-5);assert.ok((b.bottom-c.y)*c.z<=h+1e-5);};
test('U fit includes rotated large images, pins and spread boards across phone/tablet/desktop',()=>{
 const items=[{x:5000,y:-1200,w:3200,h:1800,scale:1,rot:37},{x:-6000,y:3000,w:250,h:200,scale:.8,rot:0}];const b=boardBounds(items,[{x:-7000,y:3400}]);
 for(const [width,height] of views){const cam=fitBoardCamera(b,{width,height});inside(b,cam,width,height);assert.ok(cam.z<.12,'spread content must not be cropped by the old zoom floor');}
});
test('empty and pin-only boards stay finite; aspect ratio is provided after image decode',()=>{
 assert.equal(boardBounds([]),null);assert.equal(fitBoardCamera(null,{width:390,height:844}),null);const b=boardBounds([{x:0,y:0,w:100}],[],()=>200);assert.deepEqual(b,{left:-50,top:-100,right:50,bottom:100});assert.ok(fitBoardCamera(boardBounds([],[{x:400,y:300}]),{width:390,height:844}));
});
test('accepted master reference preserves the whole requested region independently of viewport',()=>{
 const view={x:500,y:-100,w:1440,h:900,z:.8},b={left:500-900,right:500+900,top:-100-562.5,bottom:-100+562.5};for(const [width,height] of views)inside(b,fitCameraCall(view,{width,height}),width,height);assert.equal(fitCameraCall({...view,z:0},{width:390,height:844}),null);
});
test('native wheel zoom grows gradually from a fitted spread overview instead of jumping to the old floor',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../quadro/quadro-cris-v7.js',import.meta.url),'utf8'),start=source.indexOf('  function F(e2, t2, o2) {'),end=source.indexOf('  let z = 0;',start),u={cam:{x:0,y:0,z:.03}};
 const zoom=new Function('u','c','q','I',source.slice(start,end)+';return F;')(u,(v,min,max)=>Math.max(min,Math.min(max,v)),()=>{},()=>{});zoom(180,400,.033);assert.equal(u.cam.z,.033);assert.ok(Number.isFinite(u.cam.x));
});
