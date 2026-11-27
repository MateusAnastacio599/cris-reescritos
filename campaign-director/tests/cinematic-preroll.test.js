import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitComposition} from '../dist/cinematic-composition.js';
import {RemoteCinematics,CINEMATIC_PREROLL_MS} from '../dist/cinematic-remote.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('cover fills portrait, landscape and desktop with uniform scale; resize keeps illumination attached',t=>{
 const previous=globalThis.ResizeObserver;let resize;globalThis.ResizeObserver=class{constructor(fn){resize=fn;}observe(){}disconnect(){}};t.after(()=>{if(previous)globalThis.ResizeObserver=previous;else delete globalThis.ResizeObserver;});
 let bounds;const world={style:{}},comp={world,aspect:16/9};bounds={width:390,height:844};const dispose=fitComposition(comp,{getBoundingClientRect:()=>bounds});
 for(const [width,height] of [[390,844],[844,390],[1440,900],[1865,951]]){bounds={width,height};resize();const w=parseFloat(world.style.width),h=parseFloat(world.style.height);assert.ok(w>=width-.01&&h>=height-.01);assert.ok(Math.abs(w/h-16/9)<.0001);}
 dispose();const css=read('../dist/cinematic.css');assert.match(css,/\.cinematic-frame \.cinematic-world\{overflow:hidden\}/);assert.match(css,/\.cinematic-presentation>\.cinematic-frame>img\{object-fit:cover\}/);assert.ok(!css.includes('width:min(100vw,calc(100dvh * 16 / 9))'));assert.ok(css.includes('.cinematic-presentation:not(.cinematic-staging) .cinematic-mobile-card{pointer-events:auto}'));assert.match(read('../../quadro/board-cinematic.js'),/fit:'cover'/);assert.match(read('../../quadro/board-cinematic.js'),/begin\(\{frame,signal,host:true\}\)/);
});
test('default pre-roll belongs to the common start, waits for readiness and stays within 2 seconds',()=>{
 assert.equal(CINEMATIC_PREROLL_MS,1800);let now=10000,countdown,localStarts=0;const remote=new RemoteCinematics({Wire:null,frame:{},bridge:{},now:()=>now});try{
  const run=remote.active={sid:'test',metrics:{},localReady:false,countdownLocal:delay=>countdown=delay,startLocal:async()=>{localStarts++;return true;},resolve(){}};remote.maybeStart();assert.equal(run.startAt,undefined);run.localReady=true;remote.maybeStart();assert.equal(run.startAt,11800);assert.equal(countdown,1800);assert.equal(run.phase,'avisando');assert.equal(localStarts,0);remote.maybeStart();assert.equal(run.startAt,11800);assert.equal(localStarts,0);remote.stop(true);assert.equal(remote.active,null);const connection={open:false};remote.peers.set(connection,{connection,live:{role:'host'},expected:'bounded',ready:true,rtt:5000});const bounded=remote.active={...run,sid:'bounded',startAt:null};remote.maybeStart();assert.equal(bounded.startAt-now,2000);assert.equal(countdown,2000);remote.stop(true);
 }finally{remote.close();}
});
