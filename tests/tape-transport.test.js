import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('integration-main/quadro/quadro-cris-v7.js','utf8');
const stop=source.slice(source.indexOf('  function crisStopTape('),source.indexOf('  async function ws('));
const play=source.slice(source.indexOf('  async function As('),source.indexOf('  let ks = null;',source.indexOf('  async function As(')));
test('native tape pauses, resumes at saved offset, rewinds and stops',async()=>{
 const item={id:'tape',audioId:'audio',opts:{invertido:true}},starts=[];
 const context={currentTime:10,createBufferSource(){return{connect(){return this;},disconnect(){},start(...args){starts.push(args)},stop(){}}},createGain(){return{gain:{value:0},connect(){return this},disconnect(){}}}};
 const scope={Bt:()=>context,Js:()=>{},ja:new Map(),crisTapeRequests:new WeakMap(),crisTapeGains:new Set(),Fa:()=>{},Nt:()=>{},St:()=>{},p:{audio:'test'},ws:async()=>({fwd:{duration:30},rev:{duration:30}}),K:()=>item,boardMediaVolume:()=>1,crisOutput:{limitedOutput:()=>({})}};
 vm.createContext(scope);vm.runInContext(stop+play,scope);
 await scope.As(item,true);assert.deepEqual(starts.at(-1),[0,0]);assert.equal(item._gv,true);
 context.currentTime=17;await scope.As(item,true);assert.equal(item._gv,false);assert.equal(item._gpos,7);
 context.currentTime=20;await scope.As(item,true);assert.deepEqual(starts.at(-1),[0,7]);assert.equal(item._gv,true);
 await scope.As(item,true,true);assert.deepEqual(starts.at(-1),[0,0]);
 scope.crisStopTape(item);assert.equal(item._gv,false);assert.equal(item._gpos,0);
 await scope.As(item,false);assert.equal(item._gvRev,false);assert.deepEqual(starts.at(-1),[0,0]);
});
