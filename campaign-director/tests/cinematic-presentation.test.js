import test from 'node:test';
import assert from 'node:assert/strict';
import {CinematicPresentation,mobilePresentation} from '../dist/cinematic-presentation.js';
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture({fullscreen='supported',lock='supported',existing=false}={}){
 const calls={play:0,full:0,exit:0,lock:0,unlock:0},phases=[];let view={width:390,height:844,coarse:false};
 class Node extends EventTarget{
  constructor(tag){super();this.tag=tag;this.children=[];this.hidden=false;this.disabled=false;const classes=new Set();this.classList={add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x)),contains:v=>classes.has(v)};if(tag==='section'&&fullscreen!=='unsupported')this.requestFullscreen=()=>{calls.full++;if(fullscreen==='denied')return Promise.reject(Error('denied'));if(typeof fullscreen==='function')return fullscreen(this,d);d.fullscreenElement=this;return Promise.resolve();};}
  append(...nodes){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);}}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
  setAttribute(){}focus(){this.focused=true;}
  set innerHTML(value){this.html=value;this.nodes=new Map(['h2','p','[data-watch]','[data-inline]'].map(key=>[key,new Node('child')]));for(const n of this.nodes.values())n.disabled=true;}
  querySelector(key){return this.nodes.get(key);}
 }
 const d={body:new Node('body'),defaultView:new EventTarget(),fullscreenElement:existing?new Node('foreign'):null,createElement:tag=>new Node(tag),exitFullscreen:async()=>{calls.exit++;d.fullscreenElement=null;}};
 const screen={orientation:{lock:async()=>{calls.lock++;if(lock==='denied')throw Error('not supported');},unlock:()=>calls.unlock++}};if(lock==='unsupported')delete screen.orientation.lock;
 const controls=new Node('button');d.body.append(controls);const frame={mount:d.body,fit:'cover'};
 const presentation=new CinematicPresentation({document:d,screen,controls,viewport:()=>view,status:s=>phases.push(s)}),abort=new AbortController();
 return {d,screen,frame,presentation,controls,abort,calls,phases,begin:()=>presentation.begin({frame,signal:abort.signal}),start:()=>presentation.start(()=>{calls.play++;return true;},{signal:abort.signal}),resize:v=>{view=v;d.defaultView.dispatchEvent(new Event('resize'));}};
}
test('mobile detection preserves regular desktop and supports portrait/landscape phones',()=>{
 assert.equal(mobilePresentation({width:1440,height:900}),false);assert.equal(mobilePresentation({width:390,height:844}),true);assert.equal(mobilePresentation({width:844,height:390,coarse:true}),true);assert.equal(mobilePresentation({width:1200,height:400,coarse:false}),false);
});
test('first mobile play waits for the gesture; fullscreen/landscape are owned and restored',async()=>{
 const f=fixture();try{assert.equal(await f.begin(),true);const r=f.presentation.current;assert.equal(f.frame.fit,'contain');assert.equal(f.frame.mount,r.root);f.presentation.ready();const started=f.start();assert.equal(f.calls.play,0);r.gate.querySelector('[data-watch]').onclick();assert.equal(await started,true);await flush();assert.equal(f.calls.play,1);assert.equal(f.calls.full,1);assert.equal(f.calls.lock,1);assert.equal(r.gate.hidden,true);await f.presentation.end();assert.equal(f.calls.exit,1);assert.equal(f.calls.unlock,1);assert.equal(f.frame.mount,f.d.body);assert.equal(f.frame.fit,'cover');assert.equal(f.controls.parent,f.d.body);assert.equal(f.d.body.classList.contains('cris-cinematic-active'),false);}finally{await f.presentation.close();}
});
test('missing fullscreen and rejected orientation never prevent first playback',async()=>{
 for(const options of [{fullscreen:'unsupported'},{fullscreen:'denied'},{lock:'denied'},{lock:'unsupported'}]){
  const f=fixture(options);try{await f.begin();const started=f.start();f.presentation.current.gate.querySelector('[data-watch]').onclick();assert.equal(await started,true);await flush();assert.equal(f.calls.play,1);assert.equal(f.presentation.current.locked,false);}finally{await f.presentation.close();}
 }
});
test('continue inline deliberately avoids fullscreen and rotation requests',async()=>{
 const f=fixture();try{await f.begin();const started=f.start();f.presentation.current.gate.querySelector('[data-inline]').onclick();assert.equal(await started,true);assert.equal(f.calls.play,1);assert.equal(f.calls.full,0);assert.equal(f.calls.lock,0);}finally{await f.presentation.close();}
});
test('stop before gesture rejects the pending gate and restores UI without playing',async()=>{
 const f=fixture();await f.begin();const r=f.presentation.current,pending=assert.rejects(f.start(),{name:'AbortError'});f.abort.abort();await f.presentation.end();await pending;r.gate.querySelector('[data-watch]').onclick();assert.equal(f.calls.play,0);assert.equal(f.frame.mount,f.d.body);assert.equal(f.controls.parent,f.d.body);
});
test('late fullscreen result after stop is released and does not resurrect playback',async()=>{
 let finish;const f=fixture({fullscreen:(root,d)=>new Promise(resolve=>finish=()=>{d.fullscreenElement=root;resolve();})});
 await f.begin();const started=f.start();f.presentation.current.gate.querySelector('[data-watch]').onclick();assert.equal(await started,true);f.abort.abort();await f.presentation.end();finish();await flush();assert.equal(f.calls.play,1);assert.equal(f.calls.exit,1);assert.equal(f.calls.lock,0);assert.equal(f.presentation.current,null);
});
test('existing fullscreen is preserved and portrait hint updates when rotated',async()=>{
 const f=fixture({existing:true}),before=f.d.fullscreenElement;try{await f.begin();const r=f.presentation.current;assert.match(r.gate.querySelector('h2').textContent,/Vire/);f.resize({width:844,height:390,coarse:true});assert.match(r.gate.querySelector('h2').textContent,/Pronto/);const started=f.start();r.gate.querySelector('[data-watch]').onclick();await started;await f.presentation.end();assert.equal(f.d.fullscreenElement,before);assert.equal(f.calls.exit,0);assert.equal(f.calls.lock,0);}finally{await f.presentation.close();}
});
test('replacement waits for fullscreen cleanup and does not restore an obsolete mount',async()=>{
 const f=fixture();await f.begin();const started=f.start();f.presentation.current.gate.querySelector('[data-watch]').onclick();await started;await flush();let exit;f.d.exitFullscreen=()=>new Promise(resolve=>exit=()=>{f.d.fullscreenElement=null;resolve();});
 const cleanup=f.presentation.end(),second=f.begin();await flush();assert.equal(f.presentation.current,null);exit();await cleanup;await second;assert.equal(f.frame.mount,f.presentation.current.root);await f.presentation.end();assert.equal(f.frame.mount,f.d.body);
});
