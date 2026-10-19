import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {originalCampaign} from '../dist/campaign-data.js';
import {initialState,loadState,saveState,validateState,exportWorkspace,makePage,STORAGE_KEY} from '../dist/storage.js';
import {parseBlocks,blocksToMarkdown,inlineHTML,parseYouTube,renderReadBlocks} from '../dist/markdown.js';
import {AudioEngine} from '../dist/audio-engine.js';

const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
globalThis.window={};
globalThis.CustomEvent=class extends Event{constructor(type,opts){super(type);this.detail=opts?.detail;}};
class Param{constructor(){this.value=0;this.transitions=[];}setTargetAtTime(v){this.value=v;}cancelAndHoldAtTime(){}cancelScheduledValues(){}setValueAtTime(v){this.value=v;}linearRampToValueAtTime(v,t){this.value=v;this.transitions.push({value:v,time:t});}}
class Node{constructor(){this.gain=new Param();}connect(){}disconnect(){}}
class Context{constructor(){this.currentTime=0;this.state='running';this.destination={};}createGain(){return new Node();}createMediaElementSource(){return new Node();}async resume(){this.state='running';}}
const created=[];
class AudioMock{
  constructor(src){this.src=src;this.paused=true;this.currentTime=0;created.push(this);}
  async play(){this.paused=false;}
  pause(){this.paused=true;}
  removeAttribute(name){delete this[name];}
  load(){}
}
window.AudioContext=Context;globalThis.Audio=AudioMock;
const engines=[];
function fixture(){const state=initialState();state.settings.crossfade=.02;const engine=new AudioEngine(()=>state);engines.push(engine);return {state,engine,scene:state.campaigns[0].pages[0].scenes[0],location:{key:'reescritos/sao-martinho/quarto',campaignId:'reescritos',pageId:'sao-martinho',sceneId:'quarto',campaignTitle:'Reescritos',pageTitle:'Casa São Martinho'}};}
afterEach(()=>{for(const e of engines){e.stop();clearInterval(e.timer);}engines.length=0;created.length=0;memory.clear();});

test('o conteúdo original das três cenas foi preservado integralmente',()=>{
  const source=readFileSync(new URL('../reference/prototype-original/director.js',import.meta.url),'utf8');
  const match=source.slice(0,source.indexOf('\n\nlet page = campaign.pages[0]'));
  const original=vm.runInNewContext(match+'; campaign;');
  assert.equal(originalCampaign.pages[0].scenes.length,3);
  original.pages[0].scenes.forEach((s,i)=>{assert.equal(originalCampaign.pages[0].scenes[i].markdown,s.markdown);assert.deepEqual(JSON.parse(JSON.stringify(originalCampaign.pages[0].scenes[i].timeline)),JSON.parse(JSON.stringify(s.timeline)));});
});
test('todos os arquivos de áudio são idênticos aos seis originais',()=>{
  const state=initialState();assert.equal(state.audioAssets.length,6);
  for(const a of state.audioAssets){const actual=readFileSync(new URL('../dist/'+a.src,import.meta.url));const hashes=JSON.parse(readFileSync(new URL('../reference/prototype-original/audio-sha256.json',import.meta.url),'utf8'));assert.equal(createHash('sha256').update(actual).digest('hex'),hashes[a.src]);assert.equal(actual.toString('ascii',0,4),'RIFF');}
});
test('edições vazias e navegação sobrevivem ao salvamento',()=>{
  const state=initialState();state.campaigns[0].pages[0].scenes[0].markdown='';const p=makePage('Investigação');state.campaigns[0].pages.push(p);state.ui.pageId=p.id;saveState(state);const loaded=loadState();assert.equal(loaded.campaigns[0].pages[0].scenes[0].markdown,'');assert.equal(loaded.ui.pageId,p.id);assert.equal(loaded.campaigns[0].pages.length,2);
});
test('migra edição antiga, incluindo texto apagado',()=>{localStorage.setItem('cris-director:sao-martinho:quarto:markdown','');assert.equal(initialState().campaigns[0].pages[0].scenes[0].markdown,'');});
test('backup preserva as três cenas, as cues e as playlists',async()=>{const state=initialState();const exported=JSON.parse(await (await exportWorkspace(state)).text());assert.equal(exported.application,'CRIS Campaign Director');assert.deepEqual(validateState(exported.state),state);assert.equal(exported.state.campaigns[0].pages[0].scenes[2].cues[0].actions.length,4);});
test('backups inválidos são rejeitados antes de alterar o armazenamento',()=>{
  const state=initialState();saveState(state);const before=localStorage.getItem(STORAGE_KEY);state.campaigns[0].pages[0].scenes=[];assert.throws(()=>validateState(state),/Página inválida/);assert.equal(localStorage.getItem(STORAGE_KEY),before);
  const external=initialState();external.audioAssets[0].src='https://external.invalid/track.mp3';assert.throws(()=>validateState(external),/Caminho/);
});
test('blocos mantêm notas, cues, títulos e ênfase na conversão',()=>{
  for(const scene of originalCampaign.pages[0].scenes){const blocks=parseBlocks(scene.markdown),roundtrip=parseBlocks(blocksToMarkdown(blocks));assert.deepEqual(roundtrip,blocks);}
  const task=parseBlocks('- [x] Confirmar pista\n\n[[page:arquivo|Arquivo]]');assert.equal(task[0].type,'todo');assert.equal(task[0].checked,true);assert.ok(blocksToMarkdown(task).includes('- [x]'));
});
test('links internos resolvem páginas e o renderer escapa HTML',()=>{
  const pages=[{id:'p-1',title:'Mansão Noir'}];const html=inlineHTML('Consulte [[Mansão Noir]] e [[page:p-1|o arquivo]]. <img src=x onerror=alert(1)>',pages);
  assert.equal((html.match(/data-page-link="p-1"/g)||[]).length,2);assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
  const cue=renderReadBlocks([{type:'cue',triggerId:'" onclick="bad',text:'Teste'}],pages);assert.ok(cue.includes('&quot;'));assert.ok(!cue.includes('data-inline-cue="" onclick'));
});
test('links YouTube suportam timestamp, shorts e playlist, com validação do domínio',()=>{
  assert.deepEqual(parseYouTube('https://youtu.be/dQw4w9WgXcQ?t=1m30s'),{videoId:'dQw4w9WgXcQ',playlistId:null,start:90});assert.equal(parseYouTube('https://www.youtube.com/shorts/dQw4w9WgXcQ').videoId,'dQw4w9WgXcQ');assert.equal(parseYouTube('https://www.youtube.com/playlist?list=PLabcdefghijklm').playlistId,'PLabcdefghijklm');assert.throws(()=>parseYouTube('https://youtube.com.evil.invalid/watch?v=dQw4w9WgXcQ'));assert.throws(()=>parseYouTube('javascript:alert(1)'));assert.throws(()=>parseYouTube('https://youtube.com/watch?v=bad'));
});
test('navegar e editar outra página não desmonta nem pausa as camadas',async()=>{
  const {state,engine,scene,location}=fixture();await engine.startScene(scene,location);assert.equal(engine.tracks.size,2);const rain=engine.tracks.get('rain');state.campaigns[0].pages.push(makePage('Outra página'));state.ui.pageId=state.campaigns[0].pages[1].id;state.campaigns[0].pages[1].scenes[0].markdown='Novo texto';saveState(state);assert.strictEqual(engine.tracks.get('rain'),rain);assert.equal(rain.audio.paused,false);assert.equal(engine.running,true);assert.equal(engine.active.pageId,'sao-martinho');
});
test('a troca de cena faz fade sem recriar loops da mesma origem',async()=>{
  const {state,engine,scene,location}=fixture();await engine.startScene(scene,location);const rain=engine.tracks.get('rain');const corridor=state.campaigns[0].pages[0].scenes[1];await engine.startScene(corridor,{...location,key:'reescritos/sao-martinho/corredor',sceneId:'corredor'});assert.strictEqual(engine.tracks.get('rain'),rain);assert.equal(rain.volume,.30);assert.equal(rain.audio.paused,false);assert.ok(rain.gain.gain.transitions.length>=2);
});
test('timeline toca cada evento uma vez e pausa preserva o tempo',async()=>{
  const {engine,scene,location}=fixture();let count=0;scene.timeline=[{at:0,label:'Imediato',action:'oneshot',assetId:'asset-bell'},{at:5,label:'Próximo',action:'oneshot',assetId:'asset-door'}];engine.oneShot=async()=>{count++;};await engine.startScene(scene,location);engine.tick();engine.tick();assert.equal(count,1);engine.startedAt-=2100;engine.pause();const position=engine.currentTime();assert.ok(position>=2);engine.tick();assert.equal(count,1);await engine.resume();assert.ok(engine.currentTime()>=position);engine.startedAt-=4000;engine.tick();engine.tick();assert.equal(count,2);
});
test('Silêncio total cancela também o riser atrasado de uma cue',async()=>{
  const {engine}=fixture();let count=0;engine.oneShot=async()=>{count++;};engine.fireCue({id:'test',name:'Cue',actions:[{type:'play',assetId:'asset-bell',volume:1,delay:0},{type:'play',assetId:'asset-riser',volume:.5,delay:.04}]});assert.equal(count,1);engine.silence();await new Promise(r=>setTimeout(r,65));assert.equal(count,1);assert.equal(engine.delays.size,0);assert.equal(engine.active,null);
});
test('parar e iniciar novamente recria as camadas da cena',async()=>{
  const {engine,scene,location}=fixture();await engine.startScene(scene,location);engine.stop();assert.equal(engine.tracks.size,0);assert.equal(engine.active,null);await engine.startScene(scene,location);assert.equal(engine.tracks.size,2);assert.equal(engine.running,true);for(const t of engine.tracks.values())assert.equal(t.audio.paused,false);
});
test('mixer controla grupos e a multiplicação de volumes do YouTube',async()=>{
  const {engine,state}=fixture();await engine.init();let youtubeVolume;engine.yt={setVolume:v=>youtubeVolume=v,stopVideo(){}};engine.ytReady=true;engine.setMix('master',.5);engine.setMix('music',.4);assert.equal(engine.master.gain.value,.5);assert.equal(engine.groups.music.gain.value,.4);assert.equal(youtubeVolume,20);assert.equal(state.settings.music,.4);
});
test('resposta tardia do YouTube não reinicia o áudio depois de Silêncio total',async()=>{
  const {engine}=fixture();let resolveAPI,loads=0;engine.youtubeAPI=()=>new Promise(r=>{resolveAPI=r;});engine.ytReady=true;engine.yt={stopVideo(){},setVolume(){},loadVideoById(){loads++;}};const promise=engine.playMusic({id:'yt',name:'Teste',provider:'youtube',videoId:'dQw4w9WgXcQ'});await new Promise(r=>setImmediate(r));engine.stop();resolveAPI();await promise;assert.equal(loads,0);assert.equal(engine.musicAsset,null);
});
test('playlist avança e faz crossfade entre arquivos locais',async()=>{
  const {engine,state}=fixture();state.playlists=[{id:'p',name:'Teste',assetIds:['asset-bell','asset-door']}];await engine.playPlaylist(state.playlists[0]);const first=engine.music;assert.equal(engine.musicAsset.id,'asset-bell');await engine.playPlaylist(state.playlists[0],1);assert.notStrictEqual(engine.music,first);assert.equal(engine.musicAsset.id,'asset-door');assert.ok(engine.retiring.has(first));assert.equal(engine.music.group,'music');
});
