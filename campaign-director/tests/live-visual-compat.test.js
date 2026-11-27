import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {CINEMATIC_BUILD,cinematicEnvironment,safeEnvironment,safeBuild} from '../dist/cinematic-compat.js';
import {CINEMATIC_FRAME_BUILD} from '../dist/cinematic-frame.js';
import {CINEMATIC_REMOTE_BUILD} from '../dist/cinematic-remote.js';
import {CINEMATIC_PRESENTATION_BUILD} from '../dist/cinematic-presentation.js';
import {CINEMATIC_PROTOCOL_BUILD} from '../dist/cinematic-protocol.js';
import {LIVE_BUILD} from '../../quadro/board-live.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('published module graph and both copies use one release, retaining v4 capability',()=>{
 for(const build of [CINEMATIC_PROTOCOL_BUILD,CINEMATIC_FRAME_BUILD,CINEMATIC_REMOTE_BUILD,CINEMATIC_PRESENTATION_BUILD,LIVE_BUILD])assert.equal(build,CINEMATIC_BUILD);
 for(const file of readdirSync(new URL('../dist/',import.meta.url)).filter(x=>x.endsWith('.js'))){const s=read('../dist/'+file);for(const match of s.matchAll(/from\s*['"]\.\/cinematic-[\w-]+\.js([^'"]*)/g))assert.equal(match[1],'?v='+CINEMATIC_BUILD,file);}
 for(const dir of ['../../quadro/','../integration-main/quadro/','../dist/cris/quadro/']){
  for(const name of ['Halloween2026-1.css','board-room-ui.js','board-room.css','board-live.js'])assert.equal(read(dir+name),read('../../quadro/'+name));
  const html=read(dir+'index.html');assert.ok(html.includes('board-room.css?v='+CINEMATIC_BUILD));assert.ok(html.includes('Halloween2026-1.css?v='+CINEMATIC_BUILD));assert.ok(html.includes('cinematic.css?v='+CINEMATIC_BUILD));assert.ok(!html.includes('live01b3'));
 }
 assert.match(read('../../quadro/board-live.js'),/cinematic:4,cinematicBuild:LIVE_BUILD/);
 assert.match(read('../dist/index.html'),/app.js\?v=directorcinematic02/);
 assert.match(read('../dist/cinematic.css'),/cinematic-studio.css\?v=directorcinematic02/);
 // No new service worker asset cache or data purge is needed to update modules.
 assert.doesNotMatch(read('../../sw.js'),/caches\.|addEventListener\(['"]fetch/);
});
test('environment diagnostics distinguish standalone and browser without exposing the user agent',()=>{
 const env={navigator:{userAgent:'Mozilla secret Chrome/100.2 Device=private'},matchMedia:()=>({matches:false}),isSecureContext:true,crypto:{subtle:{}},AbortController(){},AbortSignal:{prototype:{}}};
 const browser=cinematicEnvironment(env);assert.equal(browser.mode,'browser');assert.equal(browser.browser,'Chrome/100');assert.equal(browser.abortCheck,false);env.matchMedia=()=>({matches:true});const pwa=cinematicEnvironment(env);assert.equal(pwa.mode,'standalone');assert.equal(safeEnvironment({...pwa,token:'secret'}).token,undefined);assert.equal(safeEnvironment({mode:'invalid'}),null);assert.equal(safeBuild('token=secret'),'unknown');assert.equal(JSON.stringify(browser).includes('private'),false);
});
test('lighting clips camera overscan to its composition and legacy action CSS excludes the modern palette',()=>{
 const css=read('../dist/cinematic.css');assert.match(css,/\.cinematic-frame \.cinematic-world\{overflow:hidden\}/);assert.match(css,/cinematic-light-darkness/);assert.match(css,/cinematic-light-vignette/);
 assert.match(read('../../quadro/Halloween2026-1.css'),/#vwJoin:not\(\.cris-room-entry\) \.card > button:not\(\[data-c\]\)/);
 assert.match(read('../../quadro/board-room-ui.js'),/b.dataset.c=color/);
});

test('eight cursor choices retain their individual values, selection and persisted callback on reopening',async t=>{
 const previous={document:globalThis.document,window:globalThis.window};t.after(()=>{for(const [k,v] of Object.entries(previous))if(v===undefined)delete globalThis[k];else globalThis[k]=v;});
 class Node{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.props={};const set=new Set();this.classList={add:(...xs)=>xs.forEach(x=>set.add(x)),toggle:(x,on)=>on?set.add(x):set.delete(x),contains:x=>set.has(x)};this.style={setProperty:(k,v)=>this.props[k]=v};}append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attrs[k]=v;}}
 const body=new Node('body');globalThis.document={body,querySelector:()=>null,createElement:tag=>new Node(tag)};globalThis.window={};
 const {mountRoomUI}=await import('../../quadro/board-room-ui.js');let saved='#e8b04a',calls=0;const entry={binding:{read:()=>null}},callbacks={color:()=>saved,setColor:c=>{saved=c;calls++;}};
 const find=(node,id)=>node.id===id?node:node.children.map(n=>find(n,id)).find(Boolean);
 const first=mountRoomUI({role:'client',entry,callbacks}).showEntry(),colors=find(first,'vwCores');assert.equal(colors.children.length,8);assert.equal(new Set(colors.children.map(b=>b.props['--c'])).size,8);
 colors.children[6].onclick();assert.equal(calls,1);assert.equal(saved,'#3fd6b0');assert.equal(colors.children.filter(b=>b.attrs['aria-pressed']==='true').length,1);assert.equal(colors.children[6].classList.contains('on'),true);
 const second=mountRoomUI({role:'client',entry,callbacks}).showEntry();assert.equal(find(second,'vwCores').children[6].attrs['aria-pressed'],'true');
});
