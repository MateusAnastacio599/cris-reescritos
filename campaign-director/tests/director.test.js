import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {originalCampaign} from '../dist/campaign-data.js';
import {updatedScenes,applySceneTextUpdate,SCENE_TEXT_REVISION} from '../dist/scene-updates.js';
import {initialState,loadState,saveState,validateState,exportWorkspace,makePage,STORAGE_KEY} from '../dist/storage.js';
import {parseBlocks,blocksToMarkdown,inlineHTML,parseYouTube,renderReadBlocks} from '../dist/markdown.js';
import {AudioEngine} from '../dist/audio-engine.js';
import {VolumeEnvelope} from '../dist/volume-envelope.js';
import {PlaylistOrder} from '../dist/playlist-order.js';
import {removeAudioAsset,removePlaylist} from '../dist/audio-assets.js';

const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
globalThis.window={};
const fakePanels=new Map();globalThis.document={getElementById:id=>{if(!fakePanels.has(id))fakePanels.set(id,{hidden:true,remove(){fakePanels.delete(id);},insertBefore(node){fakePanels.set(node.id,node);},querySelector(){return null;}});return fakePanels.get(id);},createElement:()=>({remove(){fakePanels.delete(this.id);}})};
globalThis.CustomEvent=class extends Event{constructor(type,opts){super(type);this.detail=opts?.detail;}};
class Param{constructor(){this.value=0;this.transitions=[];}setTargetAtTime(v){this.value=v;}cancelAndHoldAtTime(){}cancelScheduledValues(){}setValueAtTime(v){this.value=v;}linearRampToValueAtTime(v,t){this.value=v;this.transitions.push({value:v,time:t});}}
class Node{constructor(){this.gain=new Param();this.outputs=[];}connect(target){this.outputs.push(target);}disconnect(){this.disconnected=true;}}
class Context{constructor(){this.currentTime=0;this.state='running';this.destination={};}createGain(){return new Node();}createMediaElementSource(){return new Node();}createDynamicsCompressor(){const node=new Node();for(const key of ['threshold','knee','ratio','attack','release'])node[key]=new Param();return node;}async resume(){this.state='running';}}
const created=[];
class AudioMock extends EventTarget{
  constructor(src){super();this.src=src;this.paused=true;this.currentTime=0;created.push(this);}
  async play(){this.paused=false;this.dispatchEvent(new Event('playing'));}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  removeAttribute(name){delete this[name];}
  load(){}
}
window.AudioContext=Context;globalThis.Audio=AudioMock;
const engines=[];
function fixture(){const state=initialState();state.settings.crossfade=.02;state.settings.musicFadeIn=.02;state.settings.musicFadeOut=.02;const engine=new AudioEngine(()=>state);engines.push(engine);return {state,engine,scene:state.campaigns[0].pages[0].scenes[0],location:{key:'reescritos/sao-martinho/quarto',campaignId:'reescritos',pageId:'sao-martinho',sceneId:'quarto',campaignTitle:'Reescritos',pageTitle:'Casa São Martinho'}};}
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
test('atualização guarda também uma versão legada com texto apagado',()=>{localStorage.setItem('cris-director:sao-martinho:quarto:markdown','');const scene=initialState().campaigns[0].pages[0].scenes[0];assert.equal(scene.markdown,updatedScenes.quarto);assert.equal(scene.textHistory.at(-1).markdown,'');});
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

test('migração da V3 adiciona ambientes sem sobrescrever roteiros existentes',()=>{
  const old=initialState();delete old.ambiences;delete old.settings.musicFadeIn;delete old.settings.musicFadeOut;
  old.campaigns[0].pages[0].scenes[0].markdown='Minha versão personalizada';
  const migrated=validateState(old);assert.equal(migrated.ambiences.length,1);assert.equal(migrated.settings.musicFadeIn,2.5);assert.equal(migrated.campaigns[0].pages[0].scenes[0].markdown,'Minha versão personalizada');
});
test('resolver por ID não confunde uploads e YouTube sem src',()=>{
  const {state,engine}=fixture();state.audioAssets.push({id:'yt-first',provider:'youtube',name:'YouTube'},{id:'upload-second',provider:'upload',name:'Arquivo'});
  assert.equal(engine.asset('upload-second').id,'upload-second');assert.equal(engine.asset('missing'),null);
});
test('envelope cancelado resolve sem modificar o volume mais tarde',async()=>{
  let level=0;const envelope=new VolumeEnvelope(()=>level,v=>{level=v;});const fade=envelope.fade(1,.1);envelope.cancel();assert.equal(await fade,false);const stopped=level;await new Promise(r=>setTimeout(r,45));assert.equal(level,stopped);await envelope.fade(.7,0);assert.equal(level,.7);
});
test('cena escolhe música, volume, timestamp e fade próprios',async()=>{
  const {engine,scene,location}=fixture();scene.music={mode:'play',assetId:'asset-bell',volume:.31,fadeIn:.12,fadeOut:.23,startSeconds:8};await engine.startScene(scene,location);
  assert.equal(engine.musicAsset.id,'asset-bell');assert.equal(engine.music.volume,.31);assert.equal(engine.music.audio.currentTime,8);assert.equal(engine.musicFadeOptions.fadeIn,.12);assert.equal(engine.musicFadeOptions.fadeOut,.23);
});
test('cena que mantém a música preserva a mesma faixa em execução',async()=>{
  const {engine,scene,location}=fixture();await engine.playMusic(engine.asset('asset-bell'));const music=engine.music;
  scene.music={mode:'keep'};await engine.startScene(scene,location);assert.strictEqual(engine.music,music);assert.equal(music.audio.paused,false);
});
test('cena pode iniciar a partir da segunda faixa de uma playlist',async()=>{
  const {state,engine,scene,location}=fixture();state.playlists.push({id:'scene-list',name:'Músicas da cena',assetIds:['asset-bell','asset-door']});scene.music={mode:'play',playlistId:'scene-list',index:1,fadeIn:0};await engine.startScene(scene,location);assert.equal(engine.musicAsset.id,'asset-door');assert.equal(engine.playlist.index,1);
});
test('encerrar música pela cena preserva um ambiente independente',async()=>{
  const {state,engine,scene,location}=fixture();await engine.ambiences.apply(state.ambiences[0],{fade:0});await engine.playMusic(engine.asset('asset-bell'));scene.music={mode:'stop',fadeOut:0};await engine.startScene(scene,location);assert.equal(engine.music,null);assert.equal(engine.musicAsset,null);assert.equal(engine.ambiences.tracks.size,2);
});
test('ambiente em execução permanece ao iniciar outra cena',async()=>{
  const {state,engine,scene,location}=fixture();await engine.ambiences.apply(state.ambiences[0],{fade:0});const rain=engine.ambiences.tracks.get('amb-rain');await engine.startScene(scene,location);assert.strictEqual(engine.ambiences.tracks.get('amb-rain'),rain);assert.equal(rain.audio.paused,false);
});
test('parar um ambiente inativo preserva os efeitos manuais',async()=>{
  const {engine}=fixture();const shot=await engine.oneShot(engine.asset('asset-bell'));engine.ambiences.stop(0);assert.equal(shot.disposed,false);assert.ok(engine.effects.has(shot));
});
test('efeitos ocasionais respeitam pausa e são cancelados pelo silêncio total',async()=>{
  const {engine}=fixture();let count=0;engine.oneShot=async()=>{count++;return {audio:{pause(){}},disposed:false};};
  const preset={id:'random-preset',name:'Temporal',layers:[{id:'thunder',assetId:'asset-thunder',name:'Trovão',mode:'random',minInterval:.1,maxInterval:.1,volume:.4,enabled:true}],pads:[]};
  await engine.ambiences.apply(preset,{fade:0});engine.pause();await new Promise(r=>setTimeout(r,130));assert.equal(count,0);await engine.resume();await new Promise(r=>setTimeout(r,125));assert.equal(count,1);engine.stop();assert.equal(engine.ambiences.jobs.size,0);assert.equal(engine.ambiences.active,null);
});
function fakeYouTube(engine){
  let data={video_id:'dQw4w9WgXcQ',title:'Faixa atual'},ids=['dQw4w9WgXcQ','abcdefghijk'];const calls=[];
  engine.youtubeAPI=async()=>{};engine.ytReady=true;
  engine.yt={setVolume:v=>calls.push(['volume',v]),stopVideo:()=>calls.push(['stop']),getVideoData:()=>data,getPlaylist:()=>ids,getPlaylistIndex:()=>0,getDuration:()=>100,getCurrentTime:()=>20,
    loadVideoById:value=>{calls.push(['loadVideo',value]);data={video_id:value.videoId,title:'Nova faixa'};},loadPlaylist:value=>{calls.push(['loadPlaylist',value]);},playVideoAt:i=>calls.push(['playAt',i]),
    cuePlaylist:value=>{calls.push(['cuePlaylist',value]);engine.handleYouTubeState(5);},setShuffle:value=>{calls.push(['shuffle',value]);},setLoop:value=>calls.push(['loop',value]),pauseVideo(){},playVideo(){},seekTo(){}};
  return {calls,setData:value=>{data=value;},setIDs:value=>{ids=value;}};
}
test('YouTube sai em fade, carrega mudo e só faz fade in quando realmente toca',async()=>{
  const {engine}=fixture(),fake=fakeYouTube(engine);engine.youtubeHardStopped=false;engine.ytPlaying=true;engine.ytLevel=.8;engine.musicAsset={id:'old',provider:'youtube',videoId:'dQw4w9WgXcQ'};
  const asset={id:'next-yt',name:'Nova faixa',provider:'youtube',videoId:'abcdefghijk'};
  await engine.playMusic(asset,{fadeIn:.04,fadeOut:.03});const load=fake.calls.findIndex(c=>c[0]==='loadVideo');assert.ok(load>0);assert.equal(fake.calls[load-1][0],'volume');assert.equal(fake.calls[load-1][1],0);assert.equal(engine.ytLevel,0);assert.equal(engine.ytPlaying,false);assert.ok(engine.ytPendingFade);
  engine.handleYouTubeState(1);await new Promise(r=>setTimeout(r,100));assert.equal(engine.ytLevel,1);assert.equal(engine.ytPlaying,true);assert.equal(engine.ytPendingFade,null);
});
test('evento atrasado do player não quebra Silêncio total',async()=>{
  const {engine}=fixture(),fake=fakeYouTube(engine);await engine.playMusic({id:'yt',name:'YT',provider:'youtube',videoId:'dQw4w9WgXcQ'});engine.stop();engine.handleYouTubeState(1);assert.equal(engine.ytPlaying,false);assert.equal(engine.musicAsset,null);assert.ok(fake.calls.filter(c=>c[0]==='stop').length>=2);
});
test('lista do YouTube preserva a ordem, os aliases e os títulos conhecidos',()=>{
  const {engine}=fixture(),fake=fakeYouTube(engine);engine.youtubeAsset={id:'source',playlistId:'PLabcdefghijk',youtubeTracks:[{videoId:'abcdefghijk',title:'Título já conhecido',alias:'Música do combate'}]};
  const items=engine.readYouTubeQueue();assert.equal(items.length,2);assert.equal(items[0].videoId,'dQw4w9WgXcQ');assert.equal(items[0].title,'Faixa atual');assert.equal(items[1].alias,'Música do combate');assert.equal(items[1].title,'Título já conhecido');
});
test('listar playlist usa cuePlaylist sem iniciar um vídeo e preserva a música local',async()=>{
  const {engine}=fixture();await engine.playMusic(engine.asset('asset-bell'));const music=engine.music;const fake=fakeYouTube(engine);const result=await engine.inspectYouTubePlaylist({id:'yt-list',name:'Minha playlist',provider:'youtube',playlistId:'PLabcdefghijk'});assert.equal(result.length,2);assert.ok(fake.calls.some(c=>c[0]==='cuePlaylist'));assert.ok(!fake.calls.some(c=>c[0]==='loadPlaylist'||c[0]==='loadVideo'));assert.strictEqual(engine.music,music);
});
test('playlist local faz a próxima faixa entrar antes do final da atual',async()=>{
  const {state,engine}=fixture();state.playlists=[{id:'auto',name:'Auto',assetIds:['asset-bell','asset-door']}];await engine.playPlaylist(state.playlists[0]);const previous=engine.music;previous.audio.duration=100;previous.audio.currentTime=99.99;engine.tickMusic();await new Promise(r=>setImmediate(r));assert.equal(engine.musicAsset.id,'asset-door');assert.ok(engine.retiring.has(previous));assert.equal(previous.disposed,false);
});
test('cue pode dirigir música, mixer, lembretes e navegação',async()=>{
  const {engine}=fixture();const actions=[];engine.playMusic=async(asset,opts)=>{actions.push(['music',asset.id,opts.volume]);};engine.fadeMix=(...args)=>actions.push(['mix',...args]);engine.addEventListener('message',e=>actions.push(['message',e.detail.message]));engine.addEventListener('navigate',e=>actions.push(['navigate',e.detail.pageId]));
  engine.fireCue({id:'cue-wide',name:'Mudança',actions:[{type:'music-play',assetId:'asset-bell',volume:.4,delay:0},{type:'mix',group:'sfx',to:.2,duration:1,delay:0},{type:'message',message:'Olhar para os jogadores',delay:0},{type:'navigate',pageId:'sao-martinho',sceneId:'quarto',delay:0}]});assert.deepEqual(actions,[['music','asset-bell',.4],['mix','sfx',.2,1],['message','Olhar para os jogadores'],['navigate','sao-martinho']]);
});
test('backup aceita as novas cues e mantém ambientes completos',async()=>{
  const state=initialState();state.campaigns[0].pages[0].scenes[0].cues=[{id:'music-cue',name:'Tensão',actions:[{type:'music-play',assetId:'asset-riser',volume:.5,delay:0},{type:'message',message:'Pausa dramática',delay:2}]}];const json=JSON.parse(await (await exportWorkspace(state)).text());const validated=validateState(json.state);assert.equal(validated.ambiences[0].layers.length,2);assert.equal(validated.campaigns[0].pages[0].scenes[0].cues[0].actions[1].type,'message');
});
test('uma cue de volume durante o carregamento do YouTube preserva a entrada muda',async()=>{
  const {engine}=fixture();fakeYouTube(engine);await engine.playMusic({id:'yt',name:'YT',provider:'youtube',videoId:'dQw4w9WgXcQ'},{fadeIn:.02});engine.fadeMusicTo(.3,.02);assert.equal(engine.ytLevel,0);assert.equal(engine.ytPendingFade.level,.3);engine.handleYouTubeState(1);await new Promise(r=>setTimeout(r,70));assert.equal(engine.ytLevel,.3);
});
test('música ausente gera aviso sem interromper as camadas válidas da cena',async()=>{
  const {engine,scene,location}=fixture();let warning;engine.addEventListener('error',e=>warning=e.detail.message);scene.music={mode:'play',assetId:'deleted-audio'};await engine.startScene(scene,location);assert.equal(engine.running,true);assert.equal(engine.tracks.size,2);assert.ok(warning.includes('Escolha uma faixa'));
});
test('buffering congela a entrada em fade e retoma suavemente quando o vídeo toca',async()=>{
  const {engine}=fixture();fakeYouTube(engine);await engine.playMusic({id:'yt-buffer',name:'YT',provider:'youtube',videoId:'dQw4w9WgXcQ'},{fadeIn:.15});engine.handleYouTubeState(1);await new Promise(r=>setTimeout(r,42));engine.handleYouTubeState(3);const frozen=engine.ytLevel;assert.ok(frozen<1);await new Promise(r=>setTimeout(r,85));assert.equal(engine.ytLevel,frozen);engine.handleYouTubeState(1);await new Promise(r=>setTimeout(r,180));assert.equal(engine.ytLevel,1);
});
test('play manual no player de uma playlist inspecionada ativa a direção musical',async()=>{
  const {engine}=fixture();fakeYouTube(engine);const asset={id:'preview-list',name:'Playlist',provider:'youtube',playlistId:'PLabcdefghijk'};await engine.inspectYouTubePlaylist(asset);assert.equal(engine.musicAsset,null);engine.handleYouTubeState(1);assert.equal(engine.musicAsset.id,'preview-list');assert.equal(engine.youtubePreviewOnly,false);assert.equal(engine.ytPlaying,true);
});
test('transicionar de uma cena pausada retoma música e ambiente configurados para continuar',async()=>{
  const {state,engine,scene,location}=fixture();await engine.ambiences.apply(state.ambiences[0],{fade:0});await engine.playMusic(engine.asset('asset-bell'));await engine.startScene(scene,location);engine.pause();const next=state.campaigns[0].pages[0].scenes[1];await engine.startScene(next,{...location,key:'reescritos/sao-martinho/corredor',sceneId:'corredor'});assert.equal(engine.music.audio.paused,false);assert.equal(engine.ambiences.paused,false);assert.equal(engine.ambiences.tracks.get('amb-rain').audio.paused,false);
});

test('aleatório toca cada faixa uma vez por rodada e evita repetição na virada',()=>{
  const ids=['a','b','c','d','e'],order=new PlaylistOrder(ids,{shuffle:true,random:()=>.42});
  const rounds=Array.from({length:8},()=>Array.from({length:ids.length},()=>order.next()));
  for(const round of rounds)assert.deepEqual([...round].sort(),ids);
  for(let i=1;i<rounds.length;i++)assert.notEqual(rounds[i-1].at(-1),rounds[i][0]);
});
test('prévia não consome sorteio e Anterior/Próxima percorrem o histórico',()=>{
  const order=new PlaylistOrder(['a','b','c','d'],{shuffle:true,random:()=>.8});
  const first=order.next(),next=order.peek();for(let i=0;i<10;i++)assert.equal(order.peek(),next);
  assert.equal(order.next(),next);const upcoming=order.peek();assert.equal(order.previous(),first);assert.equal(order.next(),next);assert.equal(order.next(),upcoming);
});
test('seleção manual entra primeiro e sai do restante da rodada aleatória',async()=>{
  const {engine,state}=fixture(),playlist={id:'shuffle-selection',name:'Investigação',shuffle:true,assetIds:['asset-bell','asset-door','asset-riser','asset-thunder']};state.playlists=[playlist];
  await engine.playPlaylist(playlist,2,{fadeIn:0,fadeOut:0});assert.equal(engine.musicAsset.id,'asset-riser');
  const heard=[engine.musicAsset.id];for(let i=0;i<3;i++){await engine.nextMusic();heard.push(engine.musicAsset.id);}
  assert.equal(new Set(heard).size,4);const last=heard.at(-1);await engine.nextMusic();assert.notEqual(engine.musicAsset.id,last);
});
test('aleatório usa o mesmo próximo áudio no pré-carregamento e no crossfade',async()=>{
  const {engine,state}=fixture(),playlist={id:'shuffle-fade',name:'Tensão',shuffle:true,assetIds:['asset-bell','asset-door','asset-riser']};state.playlists=[playlist];
  await engine.playPlaylist(playlist);await new Promise(r=>setImmediate(r));const next=engine.musicOrder.peek(),preloaded=engine.preloadedMusic;
  assert.equal(preloaded.assetId,next);await engine.preloadNextMusic();assert.equal(engine.preloadedMusic.assetId,next);
  const first=engine.music,prepared=engine.preloadedMusic.audio;first.audio.duration=100;first.audio.currentTime=99.99;engine.tickMusic();await new Promise(r=>setImmediate(r));
  assert.equal(engine.musicAsset.id,next);assert.strictEqual(engine.music.audio,prepared);assert.ok(engine.retiring.has(first));
});
test('alternar aleatório preserva a faixa em execução e permite voltar à ordem definida',async()=>{
  const {engine,state}=fixture(),playlist={id:'toggle-shuffle',name:'Trilhas',shuffle:false,assetIds:['asset-bell','asset-door','asset-riser']};state.playlists=[playlist];
  await engine.playPlaylist(playlist,1,{fadeIn:0,fadeOut:0});const current=engine.music;playlist.shuffle=true;engine.refreshPlaylist(playlist);
  assert.strictEqual(engine.music,current);assert.notEqual(engine.musicOrder.peek(),'asset-door');playlist.shuffle=false;engine.refreshPlaylist(playlist);await engine.nextMusic();assert.equal(engine.musicAsset.id,'asset-riser');
});
test('lista de uma faixa repete com segurança e lista vazia avisa sem iniciar áudio',async()=>{
  const order=new PlaylistOrder(['a'],{shuffle:true});for(let i=0;i<5;i++)assert.equal(order.next(),'a');
  const {engine}=fixture();await assert.rejects(engine.playPlaylist({id:'empty',shuffle:true,assetIds:['missing']}),/Adicione faixas/);
});
test('backup preserva aleatório e ainda aceita playlists antigas sem a opção',async()=>{
  const state=initialState();state.playlists.push({id:'random-backup',name:'Investigação',assetIds:['asset-bell'],shuffle:true});
  state.audioAssets.push({id:'native-shuffle',name:'YouTube',kind:'music',provider:'youtube',playlistId:'PLabcdefghijk',shuffle:true});
  const restored=validateState(JSON.parse(await (await exportWorkspace(state)).text()).state);assert.equal(restored.playlists.at(-1).shuffle,true);assert.equal(restored.audioAssets.at(-1).shuffle,true);assert.equal(restored.playlists[0].shuffle,undefined);
});
test('cena e cue respeitam o modo aleatório ao escolher a primeira faixa',async()=>{
  const {engine,state,scene,location}=fixture(),playlist={id:'scene-random',name:'Investigar',shuffle:true,assetIds:['asset-bell','asset-door','asset-riser']};state.playlists=[playlist];
  const starts=[];engine.playPlaylist=async(p,index)=>starts.push([p.id,index]);scene.music={mode:'play',playlistId:playlist.id,index:2};await engine.startScene(scene,location);
  engine.fireCue({id:'random-cue',name:'Nova trilha',actions:[{type:'music-play',playlistId:playlist.id,index:1,delay:0}]});assert.deepEqual(starts,[[playlist.id,null],[playlist.id,null]]);
});
test('excluir um áudio limpa as referências e permite retirar demonstrações sem alterar o roteiro',()=>{
  const state=initialState(),scene=state.campaigns[0].pages[0].scenes[0],text=scene.markdown;
  state.audioAssets.push({id:'custom',provider:'upload',kind:'music',name:'Música da investigação'});state.playlists[0].assetIds.push('custom');
  scene.layers.push({id:'custom-layer',name:'Ambiente',assetId:'custom',volume:.5});scene.triggers.push({id:'custom-trigger',assetId:'custom'});scene.timeline.push({at:20,label:'Trilha',action:'oneshot',assetId:'custom'});scene.music={mode:'play',assetId:'custom'};
  scene.cues.push({id:'custom-cue',name:'Cue',actions:[{type:'music-play',assetId:'custom',delay:0},{type:'message',message:'Continue',delay:0}]});
  state.ambiences[0].layers.push({id:'custom-ambient',assetId:'custom',name:'Fundo',mode:'loop',volume:.3});state.ambiences[0].pads.push('custom');
  assert.equal(removeAudioAsset(state,'custom'),true);assert.equal(JSON.stringify(state).includes('"custom"'),false);assert.equal(scene.markdown,text);assert.equal(scene.cues.at(-1).actions[0].type,'message');assert.equal(scene.music.mode,'keep');
  assert.equal(state.audioAssets.length,6);assert.equal(removeAudioAsset(state,'asset-rain'),true);assert.equal(state.audioAssets.length,5);assert.ok(!scene.layers.some(l=>l.assetId==='asset-rain'));validateState(state);
});
test('excluir a música em execução mantém chuva, cena e outros efeitos tocando',async()=>{
  const {engine,state,scene,location}=fixture(),asset={id:'custom-playing',name:'Trilha',kind:'music',provider:'local',src:'assets/audio/bell-demo.wav'};state.audioAssets.push(asset);
  await engine.startScene(scene,location);await engine.ambiences.apply(state.ambiences[0],{fade:0});const rain=engine.tracks.get('rain'),ambientRain=engine.ambiences.tracks.get('amb-rain'),shot=await engine.oneShot(engine.asset('asset-door'));
  await engine.playMusic(asset,{fadeIn:0});const music=engine.music;await engine.removeAsset(asset.id);removeAudioAsset(state,asset.id);
  assert.equal(music.disposed,true);assert.equal(engine.musicAsset,null);assert.equal(rain.audio.paused,false);assert.equal(ambientRain.audio.paused,false);assert.equal(shot.disposed,false);assert.equal(engine.running,true);
});
test('excluir efeito cancela só suas camadas, intervalos e ações atrasadas',async()=>{
  const {engine,state}=fixture(),asset={id:'custom-effect',name:'Porta extra',kind:'sfx',provider:'local',src:'assets/audio/door-demo.wav'};state.audioAssets.push(asset);
  await engine.ambiences.apply({id:'custom-pad',name:'Casa',layers:[{id:'custom-loop',assetId:asset.id,name:'Loop',mode:'loop',volume:.3},{id:'custom-random',assetId:asset.id,name:'Porta',mode:'random',volume:.4,minInterval:10,maxInterval:10}],pads:[asset.id]},{fade:0});
  const loop=engine.ambiences.tracks.get('custom-loop'),shot=await engine.oneShot(asset),other=await engine.oneShot(engine.asset('asset-bell'));let played=0;engine.oneShot=async()=>{played++;};
  engine.fireCue({id:'delayed-custom',name:'Depois',actions:[{type:'play',assetId:asset.id,delay:.03},{type:'play',assetId:'asset-door',delay:.03}]});
  await engine.removeAsset(asset.id);removeAudioAsset(state,asset.id);await new Promise(r=>setTimeout(r,60));
  assert.equal(loop.disposed,true);assert.equal(shot.disposed,true);assert.equal(other.disposed,false);assert.equal(engine.ambiences.jobs.size,0);assert.equal(engine.ambiences.tracks.size,0);assert.equal(played,1);
});
test('exclusão em cena ativa mantém os eventos já disparados na timeline',async()=>{
  const {engine,state,scene,location}=fixture();state.audioAssets.push({id:'remove-timeline',name:'Extra',kind:'sfx',provider:'local',src:'assets/audio/bell-demo.wav'});
  scene.timeline=[{at:0,label:'Excluir',action:'oneshot',assetId:'remove-timeline'},{at:0,label:'Continuar',action:'oneshot',assetId:'asset-bell'},{at:50,label:'Futuro',action:'oneshot',assetId:'asset-door'}];
  let count=0;engine.oneShot=async()=>{count++;};await engine.startScene(scene,location);engine.tick();assert.equal(count,2);await engine.removeAsset('remove-timeline');engine.tick();assert.equal(count,2);assert.equal(engine.fired.has(0),true);assert.equal(engine.fired.has(1),false);
});
test('exclusão de uma próxima faixa retira o áudio do sorteio e do pré-carregamento',async()=>{
  const {engine,state}=fixture(),asset={id:'delete-next',name:'Extra',kind:'music',provider:'local',src:'assets/audio/bell-demo.wav'};state.audioAssets.push(asset);const playlist={id:'delete-from-queue',name:'Fila',shuffle:true,assetIds:['asset-door',asset.id]};state.playlists=[playlist];
  await engine.playPlaylist(playlist,0,{fadeIn:0,fadeOut:0});await new Promise(r=>setImmediate(r));assert.equal(engine.preloadedMusic.assetId,asset.id);
  await engine.removeAsset(asset.id);removeAudioAsset(state,asset.id);engine.refreshPlaylist(playlist);await engine.nextMusic();assert.equal(engine.musicAsset.id,'asset-door');assert.ok(!engine.musicOrder.ids.includes(asset.id));
});
test('YouTube aplica aleatório uma vez e conserva o modo ao trocar de faixa',async()=>{
  const {engine}=fixture(),fake=fakeYouTube(engine),asset={id:'native-list',name:'YT investigação',kind:'music',provider:'youtube',playlistId:'PLabcdefghijk',shuffle:true};
  await engine.playMusic(asset,{youtubeVideoId:'dQw4w9WgXcQ',fadeIn:0,fadeOut:0});engine.handleYouTubeState(1);engine.handleYouTubeState(1);
  assert.deepEqual(fake.calls.filter(c=>c[0]==='shuffle'),[['shuffle',true]]);assert.ok(fake.calls.some(c=>c[0]==='loop'&&c[1]===true));
  await engine.nextMusic();assert.deepEqual(fake.calls.filter(c=>c[0]==='playAt').at(-1),['playAt',1]);assert.equal(fake.calls.filter(c=>c[0]==='shuffle').length,1);
  engine.setYouTubeShuffle(asset,false);assert.deepEqual(fake.calls.filter(c=>c[0]==='shuffle').at(-1),['shuffle',false]);
});
test('capa do YouTube escolhe o ID certo mesmo se a lista do player mudar de ordem',async()=>{
  const {engine}=fixture(),fake=fakeYouTube(engine),asset={id:'native-card',name:'YT',kind:'music',provider:'youtube',playlistId:'PLabcdefghijk',shuffle:true,youtubeTracks:[{videoId:'dQw4w9WgXcQ',title:'A'},{videoId:'abcdefghijk',title:'B'}]};
  engine.ytLoadedPlaylist=asset.playlistId;fake.setIDs(['abcdefghijk','dQw4w9WgXcQ']);await engine.playMusic(asset,{youtubeIndex:0,youtubeVideoId:'dQw4w9WgXcQ',fadeOut:0});assert.deepEqual(fake.calls.filter(c=>c[0]==='playAt').at(-1),['playAt',1]);
});
test('playlist YouTube recém-carregada resolve seleção por ID antes do fade',async()=>{
  const {engine}=fixture(),fake=fakeYouTube(engine),asset={id:'native-new',name:'YT',kind:'music',provider:'youtube',playlistId:'PLabcdefghijk',shuffle:true};
  await engine.playMusic(asset,{youtubeVideoId:'abcdefghijk',fadeIn:0,fadeOut:0});engine.handleYouTubeState(1);assert.deepEqual(fake.calls.filter(c=>c[0]==='playAt').at(-1),['playAt',1]);assert.equal(engine.ytLevel,0);assert.ok(engine.ytPendingFade);
  fake.setData({video_id:'abcdefghijk',title:'Escolhida'});engine.handleYouTubeState(1);assert.equal(engine.ytLevel,1);assert.equal(engine.ytPendingFade,null);assert.ok(fake.calls.some(c=>c[0]==='shuffle'&&c[1]));
});
test('restaurar um áudio excluído funciona após interromper a sessão para importar backup',async()=>{
  const {engine,state}=fixture(),asset={id:'restored-audio',name:'Restaurado',kind:'music',provider:'local',src:'assets/audio/bell-demo.wav'};state.audioAssets.push(asset);
  await engine.removeAsset(asset.id);removeAudioAsset(state,asset.id);engine.stop();state.audioAssets.push(asset);await engine.playMusic(asset,{fadeIn:0});assert.equal(engine.musicAsset.id,asset.id);assert.equal(engine.music.audio.paused,false);
});

function ambiencePlaylistFixture(){
  const f=fixture(),playlist={id:'voices-playlist',name:'Conversas',shuffle:true,assetIds:['asset-bell','asset-door','asset-thunder','asset-riser']};f.state.playlists.push(playlist);
  const preset={id:'cafe-test',name:'Café',layers:[{id:'voices',name:'Pessoas conversando',playlistId:playlist.id,mode:'loop',shuffle:true,crossfade:.02,volume:.3,enabled:true}],pads:[]};
  return {...f,playlist,preset};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('ambiente reproduz uma rodada inteira de sua playlist sem repetir',async()=>{
  const {engine,preset,playlist}=ambiencePlaylistFixture();await engine.ambiences.apply(preset,{fade:0});const bus=engine.ambiences,heard=[];
  for(let i=0;i<playlist.assetIds.length;i++){const track=bus.tracks.get('voices');heard.push(track.assetId);assert.equal(track.audio.loop,false);assert.equal(track.group,'ambience');assert.equal(track.volume,.3);track.audio.onended();await settle();}
  assert.equal(new Set(heard).size,4);assert.notEqual(bus.tracks.get('voices').assetId,heard.at(-1));assert.equal(engine.musicAsset,null);
});
test('duas playlists do ambiente têm filas e volumes independentes da música',async()=>{
  const {engine,preset}=ambiencePlaylistFixture();preset.layers.push({...preset.layers[0],id:'crowd-other',name:'Outra conversa',volume:.15});await engine.playMusic(engine.asset('asset-rain'),{fadeIn:0});const music=engine.music;
  await engine.ambiences.apply(preset,{fade:0});const bus=engine.ambiences,other=bus.tracks.get('crowd-other');assert.equal(bus.sequences.size,2);assert.notStrictEqual(bus.sequences.get('voices').order,bus.sequences.get('crowd-other').order);
  await bus.sequences.get('voices').advance(0);assert.strictEqual(bus.tracks.get('crowd-other'),other);bus.setVolume('voices',.7);assert.equal(bus.tracks.get('voices').volume,.7);assert.equal(other.volume,.15);assert.strictEqual(engine.music,music);assert.equal(music.audio.paused,false);
});
test('crossfade do ambiente usa a mesma faixa preparada e preserva o preload musical',async()=>{
  const {engine,state,preset}=ambiencePlaylistFixture();await engine.playPlaylist(state.playlists[0],0,{fadeIn:0,fadeOut:0});await settle();const musicPreload=engine.preloadedMusic;
  await engine.ambiences.apply(preset,{fade:0});await settle();const bus=engine.ambiences,sequence=bus.sequences.get('voices'),prepared=sequence.preloaded,prior=sequence.track;
  assert.equal(prepared.assetId,sequence.order.peek());prior.audio.duration=100;prior.audio.currentTime=99.99;bus.tick();await settle();
  assert.equal(sequence.track.assetId,prepared.assetId);assert.strictEqual(sequence.track.audio,prepared.audio);assert.ok(engine.retiring.has(prior));assert.strictEqual(engine.preloadedMusic,musicPreload);
});
test('playlist sequencial da camada respeita sua ordem mesmo com shuffle na biblioteca',async()=>{
  const {engine,preset,playlist}=ambiencePlaylistFixture();preset.layers[0].shuffle=false;await engine.ambiences.apply(preset,{fade:0});const sequence=engine.ambiences.sequences.get('voices');assert.equal(sequence.track.assetId,playlist.assetIds[0]);await sequence.advance(0);assert.equal(sequence.track.assetId,playlist.assetIds[1]);
});
test('reaplicar ambiente e trocar de cena preservam a faixa e a rodada da camada',async()=>{
  const {engine,preset,scene,location}=ambiencePlaylistFixture();await engine.ambiences.apply(preset,{fade:0});const sequence=engine.ambiences.sequences.get('voices'),track=sequence.track,order=sequence.order;
  await engine.ambiences.apply({...preset,description:'Outra descrição'},{fade:0});assert.strictEqual(engine.ambiences.sequences.get('voices'),sequence);assert.strictEqual(sequence.track,track);assert.strictEqual(sequence.order,order);
  scene.ambienceId=preset.id;engine.getState().ambiences.push(preset);await engine.startScene(scene,location);assert.strictEqual(engine.ambiences.tracks.get('voices'),track);assert.equal(track.audio.paused,false);
});
test('pausa retém a faixa e silêncio total impede o callback antigo de avançar',async()=>{
  const {engine,preset}=ambiencePlaylistFixture();await engine.ambiences.apply(preset,{fade:0});const bus=engine.ambiences,sequence=bus.sequences.get('voices'),track=sequence.track;
  engine.pause();assert.equal(track.audio.paused,true);await engine.resume();assert.strictEqual(sequence.track,track);assert.equal(track.audio.paused,false);const ended=track.audio.onended;
  engine.stop();ended();await settle();assert.equal(bus.sequences.size,0);assert.equal(bus.tracks.size,0);assert.equal(track.disposed,true);
});
test('desativar uma playlist cancela sua fila sem parar outra camada',async()=>{
  const {engine,preset}=ambiencePlaylistFixture();preset.layers.push({id:'rain-local',assetId:'asset-rain',name:'Chuva',mode:'loop',volume:.2});await engine.ambiences.apply(preset,{fade:0});const bus=engine.ambiences,sequence=bus.sequences.get('voices'),rain=bus.tracks.get('rain-local');
  await bus.toggleLayer('voices',false);assert.equal(sequence.closed,true);assert.equal(bus.sequences.has('voices'),false);assert.strictEqual(bus.tracks.get('rain-local'),rain);assert.equal(rain.audio.paused,false);
});
test('playlist ocasional espera o término antes de sortear outro áudio',async()=>{
  const {engine,preset}=ambiencePlaylistFixture();preset.layers[0].mode='random';preset.layers[0].minInterval=10;preset.layers[0].maxInterval=10;await engine.ambiences.apply(preset,{fade:0});const bus=engine.ambiences,heard=[];
  for(let i=0;i<4;i++){const job=bus.jobs.get('voices');bus.schedule(job,0);await new Promise(r=>setTimeout(r,5));assert.equal(engine.effects.size,1);assert.equal(job.timer,null);const effect=[...engine.effects][0];heard.push(effect.assetId);effect.audio.onended();assert.ok(job.timer);assert.equal(engine.effects.size,0);}
  assert.equal(new Set(heard).size,4);assert.equal(bus.tracks.size,0);
});
test('trilha vinculada inicia com as conversas e só ela é encerrada junto do lugar',async()=>{
  const {engine,state,preset}=ambiencePlaylistFixture();const musicList={id:'jazz-list',name:'Jazz',shuffle:true,assetIds:['asset-rain','asset-room']};state.playlists.push(musicList);preset.music={mode:'play',playlistId:musicList.id,volume:.45,fadeIn:0,fadeOut:0};
  await engine.ambiences.apply(preset,{fade:0});assert.equal(engine.playlist.id,musicList.id);assert.equal(engine.music.volume,.45);assert.equal(engine.ambiences.ownsMusic,true);assert.equal(engine.ambiences.sequences.size,1);
  await engine.nextMusic();assert.equal(engine.ambiences.ownsMusic,true);engine.ambiences.stop(0);await settle();assert.equal(engine.musicAsset,null);
  await engine.ambiences.apply(preset,{fade:0});await engine.playMusic(engine.asset('asset-bell'),{fadeIn:0});const independent=engine.music;engine.ambiences.stop(0);await settle();assert.strictEqual(engine.music,independent);assert.equal(independent.audio.paused,false);
});
test('alterar volume e reaplicar o ambiente não reinicia sua trilha musical',async()=>{
  const {engine,preset}=ambiencePlaylistFixture();preset.music={mode:'play',assetId:'asset-bell',volume:.4,fadeIn:0};await engine.ambiences.apply(preset,{fade:0});const music=engine.music;
  engine.ambiences.setMusicVolume(.2);preset.music.volume=.2;await engine.ambiences.apply(preset,{fade:0});assert.strictEqual(engine.music,music);assert.equal(music.volume,.2);
});
test('cena inicia a trilha do lugar e uma escolha musical da própria cena tem prioridade',async()=>{
  const {engine,state,preset,scene,location}=ambiencePlaylistFixture();state.ambiences.push(preset);preset.music={mode:'play',assetId:'asset-bell',volume:.3,fadeIn:0};scene.ambienceId=preset.id;
  await engine.startScene(scene,location);assert.equal(engine.musicAsset.id,'asset-bell');assert.equal(engine.ambiences.ownsMusic,true);
  engine.stop();scene.music={mode:'play',assetId:'asset-door',fadeIn:0};await engine.startScene(scene,location);assert.equal(engine.musicAsset.id,'asset-door');assert.equal(engine.ambiences.ownsMusic,false);engine.ambiences.stop(0);assert.equal(engine.musicAsset.id,'asset-door');
});
test('encerrar ambiente sem trilha mantém a música independente mesmo quando não havia ambiente',async()=>{
  const {engine}=fixture();await engine.playMusic(engine.asset('asset-bell'),{fadeIn:0});const music=engine.music;engine.ambiences.stop(0);assert.strictEqual(engine.music,music);assert.equal(music.audio.paused,false);
});
test('trilha do YouTube cancelada durante carregamento não toca após encerrar o ambiente',async()=>{
  const {engine}=fixture(),fake=fakeYouTube(engine);let releaseAPI;engine.youtubeAPI=()=>new Promise(resolve=>{releaseAPI=resolve;});const preset={id:'loading-jazz',name:'Café',layers:[],pads:[],music:{mode:'play',assetId:'youtube-jazz',fadeIn:0}};engine.getState().audioAssets.push({id:'youtube-jazz',provider:'youtube',kind:'music',name:'Jazz',videoId:'dQw4w9WgXcQ'});
  const applying=engine.ambiences.apply(preset,{fade:0});await settle();assert.ok(releaseAPI);engine.ambiences.stop(0);releaseAPI();await applying;assert.equal(engine.musicAsset,null);assert.ok(!fake.calls.some(c=>c[0]==='loadVideo'));
});
test('playlist do YouTube é aceita na trilha e não vira uma camada local incompleta',async()=>{
  const {engine,state,preset,playlist}=ambiencePlaylistFixture();const fake=fakeYouTube(engine),yt={id:'cafe-youtube',name:'Jazz YT',kind:'music',provider:'youtube',playlistId:'PLabcdefghijk'};state.audioAssets.push(yt);playlist.assetIds.push(yt.id);let warning;engine.addEventListener('error',e=>warning=e.detail.message);
  await engine.ambiences.apply(preset,{fade:0});assert.equal(engine.ambiences.sequences.size,0);assert.match(warning,/trilha musical/);preset.layers=[];preset.music={mode:'play',assetId:yt.id,fadeIn:0};await engine.ambiences.apply(preset,{fade:0});assert.equal(engine.musicAsset.id,yt.id);assert.ok(fake.calls.some(c=>c[0]==='loadPlaylist'));assert.equal(engine.ambiences.ownsMusic,true);
});
test('backup aceita playlists e trilha no ambiente sem alterar os ambientes antigos',async()=>{
  const {state,preset}=ambiencePlaylistFixture();preset.music={mode:'play',assetId:'asset-bell',volume:.4,fadeIn:1,fadeOut:2};state.ambiences.push(preset);const data=JSON.parse(await (await exportWorkspace(state)).text());const restored=validateState(data.state);assert.equal(restored.ambiences.at(-1).layers[0].playlistId,'voices-playlist');assert.equal(restored.ambiences.at(-1).music.volume,.4);assert.equal(restored.ambiences[0].layers[0].assetId,'asset-rain');
  const invalid=structuredClone(state);invalid.ambiences.at(-1).layers[0].assetId='asset-bell';assert.throws(()=>validateState(invalid),/Camada/);
});
test('excluir a faixa de uma playlist de ambiente avança só aquela camada',async()=>{
  const {engine,state,preset}=ambiencePlaylistFixture();const extra={id:'voices-custom',name:'Conversa',kind:'ambience',provider:'local',src:'assets/audio/bell-demo.wav'};state.audioAssets.push(extra);const playlist=state.playlists.find(p=>p.id==='voices-playlist');playlist.assetIds=[extra.id,'asset-door'];preset.layers[0].shuffle=false;preset.layers.push({id:'rain-other',name:'Chuva',assetId:'asset-rain',mode:'loop',volume:.2});
  await engine.ambiences.apply(preset,{fade:0});const bus=engine.ambiences,rain=bus.tracks.get('rain-other');assert.equal(bus.tracks.get('voices').assetId,extra.id);await engine.removeAsset(extra.id);removeAudioAsset(state,extra.id);await settle();assert.equal(bus.tracks.get('voices').assetId,'asset-door');assert.strictEqual(bus.tracks.get('rain-other'),rain);assert.equal(rain.audio.paused,false);
});
test('editar camadas após escolher música manual preserva a escolha do mestre',async()=>{
  const {engine,preset}=ambiencePlaylistFixture();preset.music={mode:'play',assetId:'asset-bell',fadeIn:0};await engine.ambiences.apply(preset,{fade:0});await engine.playMusic(engine.asset('asset-door'),{fadeIn:0});const manual=engine.music;
  preset.layers[0].volume=.6;await engine.ambiences.apply(preset,{fade:0});assert.strictEqual(engine.music,manual);assert.equal(engine.ambiences.ownsMusic,false);assert.equal(manual.audio.paused,false);
});
test('excluir playlist remove seus vínculos e encerra só a fila correspondente',async()=>{
  const {engine,state,preset,playlist}=ambiencePlaylistFixture();state.ambiences.push(preset);preset.layers.push({id:'rain-stays',assetId:'asset-rain',name:'Chuva',mode:'loop',volume:.2});await engine.ambiences.apply(preset,{fade:0});const bus=engine.ambiences,sequence=bus.sequences.get('voices'),rain=bus.tracks.get('rain-stays');
  removePlaylist(state,playlist.id);bus.removePlaylist(playlist.id);assert.equal(sequence.closed,true);assert.equal(bus.sequences.size,0);assert.strictEqual(bus.tracks.get('rain-stays'),rain);assert.equal(rain.audio.paused,false);assert.ok(!preset.layers.some(l=>l.playlistId===playlist.id));assert.equal(state.audioAssets.length,6);validateState(state);
});

test('amplificação usa ganho próprio e não altera o volume, o fade ou o arquivo',async()=>{
  const {engine,state}=fixture(),asset=state.audioAssets.find(a=>a.id==='asset-bell'),src=asset.src;asset.boost=3;await engine.playMusic(asset,{volume:.4,fadeIn:.3});const track=engine.music;
  assert.equal(track.boostGain.gain.value,3);assert.equal(track.volume,.4);assert.strictEqual(track.source.outputs[0],track.boostGain);assert.strictEqual(track.boostGain.outputs[0],track.gain);assert.equal(track.gain.gain.transitions.at(-1).value,.4);assert.equal(asset.src,src);
  engine.ramp(track,.1,2);assert.equal(track.boostGain.gain.value,3);assert.equal(track.volume,.1);assert.equal(engine.master.gain.value,state.settings.master);assert.ok(engine.peakControl);assert.equal(engine.peakControl.ratio.value,20);assert.strictEqual(engine.master.outputs[0],engine.peakControl);
});
test('alterar amplificação aplica a todas as instâncias do arquivo sem reiniciar sons',async()=>{
  const {engine,state}=fixture(),asset=engine.asset('asset-bell');await engine.playMusic(asset,{fadeIn:0});const music=engine.music,first=await engine.oneShot(asset),second=await engine.oneShot(asset),other=await engine.oneShot(engine.asset('asset-door'));engine.retire(first,2);
  engine.setAssetBoost(asset.id,2.5);assert.equal(state.audioAssets.find(a=>a.id===asset.id).boost,2.5);for(const track of [music,first,second]){assert.equal(track.boostGain.gain.value,2.5);assert.equal(track.audio.paused,false);}assert.equal(other.boostGain.gain.value,1);assert.strictEqual(engine.music,music);assert.equal(engine.setAssetBoost(asset.id,99),4);assert.equal(engine.setAssetBoost(asset.id,-2),1);
});
test('playlists de ambiente recebem a amplificação sem perder a fila',async()=>{
  const {engine,preset}=ambiencePlaylistFixture();await engine.ambiences.apply(preset,{fade:0});const sequence=engine.ambiences.sequences.get('voices'),track=sequence.track,order=sequence.order;engine.setAssetBoost(track.assetId,4);assert.equal(track.boostGain.gain.value,4);assert.strictEqual(sequence.track,track);assert.strictEqual(sequence.order,order);
});
test('YouTube permanece no controle oficial sem receber ganho Web Audio',async()=>{
  const {engine,state}=fixture(),fake=fakeYouTube(engine),asset={id:'youtube-gain',name:'YT',kind:'music',provider:'youtube',videoId:'dQw4w9WgXcQ'};state.audioAssets.push(asset);await engine.playMusic(asset,{fadeIn:0});assert.equal(engine.setAssetBoost(asset.id,4),1);assert.equal(asset.boost,undefined);engine.ytLevel=1;engine.applyYTVolume();assert.ok(fake.calls.filter(c=>c[0]==='volume').every(c=>c[1]<=100));
});
test('backup e carregamento mantêm amplificação e rejeitam valores fora da faixa',async()=>{
  const state=initialState();state.audioAssets[0].boost=3.5;saveState(state);assert.equal(loadState().audioAssets[0].boost,3.5);const data=JSON.parse(await (await exportWorkspace(state)).text());assert.equal(validateState(data.state).audioAssets[0].boost,3.5);data.state.audioAssets[0].boost=4.1;assert.throws(()=>validateState(data.state),/Amplificação/);
});
test('atualização aplica os três textos uma vez preservando toda a biblioteca e direção',()=>{
  const state=initialState();delete state.sceneTextRevision;for(const scene of state.campaigns[0].pages[0].scenes){scene.markdown='Minha versão '+scene.id;delete scene.textHistory;scene.music={mode:'play',playlistId:'user-list'};}
  state.audioAssets.push({id:'user-upload',name:'Chuva enviada',kind:'ambience',provider:'upload',filename:'chuva.mp3',boost:2});state.playlists.push({id:'user-list',name:'Minhas conversas',assetIds:['user-upload'],shuffle:true});state.ambiences.push({id:'user-ambience',name:'Café',layers:[{id:'user-layer',name:'Conversas',playlistId:'user-list',mode:'loop',volume:.3}],pads:[]});
  const assets=structuredClone(state.audioAssets),playlists=structuredClone(state.playlists),ambiences=structuredClone(state.ambiences),sounds=state.campaigns[0].pages[0].scenes.map(s=>({layers:s.layers,triggers:s.triggers,timeline:s.timeline,cues:s.cues,music:s.music}));saveState(state);const before=localStorage.getItem(STORAGE_KEY),loaded=loadState();
  assert.deepEqual(loaded.audioAssets,assets);assert.deepEqual(loaded.playlists,playlists);assert.deepEqual(loaded.ambiences,ambiences);assert.equal(localStorage.getItem(STORAGE_KEY+':before-scene-update'),before);
  loaded.campaigns[0].pages[0].scenes.forEach((scene,i)=>{assert.equal(scene.markdown,updatedScenes[scene.id]);assert.equal(scene.textHistory[0].markdown,'Minha versão '+scene.id);assert.deepEqual({layers:scene.layers,triggers:scene.triggers,timeline:scene.timeline,cues:scene.cues,music:scene.music},sounds[i]);});loaded.campaigns[0].pages[0].scenes[0].markdown='Editei depois da atualização';saveState(loaded);assert.equal(loadState().campaigns[0].pages[0].scenes[0].markdown,'Editei depois da atualização');
});
test('limpar demonstrações remove referências antigas por src e mantém áudios enviados',()=>{
  const state=initialState(),scene=state.campaigns[0].pages[0].scenes[0],text=scene.markdown;state.audioAssets.push({id:'meu-upload',name:'Minha chuva',kind:'ambience',provider:'upload',filename:'chuva.wav'});scene.layers.push({id:'minha-chuva',assetId:'meu-upload',volume:.5,name:'Minha chuva'});state.playlists.push({id:'minha-playlist',name:'Minha lista',assetIds:['meu-upload'],shuffle:true});
  for(const asset of [...state.audioAssets].filter(a=>a.builtin))removeAudioAsset(state,asset.id);assert.deepEqual(state.audioAssets.map(a=>a.id),['meu-upload']);assert.equal(scene.markdown,text);assert.ok(scene.layers.some(l=>l.assetId==='meu-upload'));assert.ok(!scene.triggers.some(t=>t.src?.endsWith('bell-demo.wav')));assert.deepEqual(state.playlists.at(-1).assetIds,['meu-upload']);validateState(state);
});

test('efeito herda fades do arquivo com ganho independente do mixer e da amplificação',async()=>{
  const {engine}=fixture(),asset=engine.asset('asset-bell');Object.assign(asset,{fadeIn:2,fadeOut:3,boost:2.5});
  const shot=await engine.oneShot(asset,.4);assert.ok(shot.effectFades);assert.equal(shot.effectFades.fadeIn,2);assert.equal(shot.effectFades.fadeOut,3);
  assert.strictEqual(shot.gain.outputs[0],shot.envelopeGain);assert.equal(shot.boostGain.gain.value,2.5);assert.equal(shot.volume,.4);
  shot.audio.duration=10;shot.audio.currentTime=8.5;shot.audio.pause();assert.equal(shot.envelopeGain.gain.value,.5);
  engine.ramp(shot,.2,.1);assert.equal(shot.envelopeGain.gain.value,.5);assert.equal(shot.boostGain.gain.value,2.5);
  engine.context.currentTime=20;await engine.resume();assert.equal(shot.envelopeGain.gain.transitions.at(-1).time,21.5);
  const immediate=await engine.oneShot(asset,.4,{fadeIn:0,fadeOut:0});assert.equal(immediate.effectFades,undefined);assert.equal(immediate.gain.gain.value,.4);
  const envelope=shot.effectFades;engine.silence();assert.equal(shot.disposed,true);assert.equal(envelope.closed,true);assert.equal(shot.envelopeGain.disconnected,true);
});
test('gatilhos, timeline e cues transmitem seus próprios fades de efeitos',async()=>{
  const {engine,scene}=fixture(),heard=[];engine.oneShot=async(asset,volume,options)=>heard.push({id:asset.id,options});
  await engine.fireTrigger({id:'custom',assetId:'asset-bell',fadeIn:1,fadeOut:2},scene);
  engine.executeEvent({action:'oneshot',assetId:'asset-door',fadeIn:3,fadeOut:4});
  engine.fireCue({id:'fade-cue',name:'Fade',actions:[{type:'play',assetId:'asset-thunder',fadeIn:0,fadeOut:5,delay:0}]});
  assert.deepEqual(heard,[{id:'asset-bell',options:{fadeIn:1,fadeOut:2}},{id:'asset-door',options:{fadeIn:3,fadeOut:4}},{id:'asset-thunder',options:{fadeIn:0,fadeOut:5}}]);
});
test('camada da cena usa fades próprios e cue pode encerrar com duração explícita',async()=>{
  const {engine,scene,location}=fixture();scene.layers=[{id:'rain',name:'Chuva',assetId:'asset-rain',volume:.4,fadeIn:3,fadeOut:4}];
  await engine.startScene(scene,location);const rain=engine.tracks.get('rain');assert.equal(rain.gain.gain.transitions.at(-1).time,3);
  await engine.startScene({...scene,layers:[]},{...location,key:'scene-two'});assert.ok(engine.retiring.has(rain));assert.equal(rain.gain.gain.transitions.at(-1).time,4);
  await engine.startScene(scene,location);const next=engine.tracks.get('rain');engine.fireCue({id:'stop-loop',name:'Fim',actions:[{type:'stop',layerId:'rain',duration:.7,delay:0}]});
  assert.ok(engine.retiring.has(next));assert.equal(next.gain.gain.transitions.at(-1).time,.7);assert.equal(engine.tracks.has('rain'),false);
});
test('ambiente e camada têm fades independentes ao iniciar e encerrar',async()=>{
  const {engine,state}=fixture(),preset=state.ambiences[0];preset.fadeIn=3;preset.fadeOut=4;Object.assign(preset.layers[0],{fadeIn:.5,fadeOut:.8});
  await engine.ambiences.apply(preset);const rain=engine.ambiences.tracks.get('amb-rain'),room=engine.ambiences.tracks.get('amb-room');
  assert.equal(rain.gain.gain.transitions.at(-1).time,.5);assert.equal(room.gain.gain.transitions.at(-1).time,3);
  engine.ambiences.stop();assert.equal(rain.gain.gain.transitions.at(-1).time,.8);assert.equal(room.gain.gain.transitions.at(-1).time,4);
  await engine.ambiences.apply(preset);const again=engine.ambiences.tracks.get('amb-rain');engine.ambiences.stop(.2);assert.equal(again.gain.gain.transitions.at(-1).time,.2);
});
test('fade da cena prevalece sobre padrão do ambiente e desativar camada usa sua saída',async()=>{
  const {engine,state,scene,location}=fixture(),preset=state.ambiences[0];preset.fadeIn=3;preset.fadeOut=4;Object.assign(preset.layers[0],{fadeIn:.5,fadeOut:.8});
  scene.ambienceId=preset.id;scene.ambienceFade=1.2;await engine.startScene(scene,location);const rain=engine.ambiences.tracks.get('amb-rain'),room=engine.ambiences.tracks.get('amb-room');
  assert.equal(rain.gain.gain.transitions.at(-1).time,1.2);await engine.ambiences.toggleLayer('amb-rain',false);assert.equal(rain.gain.gain.transitions.at(-1).time,.8);assert.equal(room.disposed,false);
  engine.silence();assert.equal(rain.disposed,true);assert.equal(room.disposed,true);
});
test('playlist conserva crossfade entre faixas e usa fade de entrada e saída da camada',async()=>{
  const {engine,preset}=ambiencePlaylistFixture();preset.fadeOut=0;Object.assign(preset.layers[0],{fadeIn:2,fadeOut:3});await engine.ambiences.apply(preset);
  const sequence=engine.ambiences.sequences.get('voices'),first=sequence.track;assert.equal(first.gain.gain.transitions.at(-1).time,2);
  await sequence.advance();const second=sequence.track;assert.equal(second.gain.gain.transitions.at(-1).time,.02);assert.equal(first.gain.gain.transitions.at(-1).time,.02);
  engine.ambiences.stop();assert.equal(second.gain.gain.transitions.at(-1).time,3);assert.equal(sequence.closed,true);
  await engine.ambiences.apply(preset);const again=engine.ambiences.tracks.get('voices');engine.ambiences.stop(0);assert.equal(again.disposed,true);
});
test('sons ocasionais usam os fades da camada e agendam a próxima faixa apenas no fim',async()=>{
  const {engine,preset}=ambiencePlaylistFixture();Object.assign(preset.layers[0],{mode:'random',minInterval:.1,maxInterval:.1,fadeIn:.4,fadeOut:.6});
  await engine.ambiences.apply(preset);const job=engine.ambiences.jobs.get('voices');clearTimeout(job.timer);engine.ambiences.schedule(job,0);await new Promise(resolve=>setTimeout(resolve,15));
  const shot=[...engine.effects][0];assert.ok(shot);assert.equal(shot.effectFades.fadeIn,.4);assert.equal(shot.effectFades.fadeOut,.6);assert.equal(job.timer,null);
  shot.audio.onended();assert.ok(job.timer);assert.equal(shot.effectFades.closed,true);
});
test('backup preserva fades e aceita dados antigos, mas rejeita tempos inválidos',async()=>{
  const state=initialState(),scene=state.campaigns[0].pages[0].scenes[0];state.audioAssets[0].fadeIn=1.5;scene.triggers[0].fadeOut=2;scene.layers[0].fadeIn=3;state.ambiences[0].layers[0].fadeOut=4;
  saveState(state);assert.equal(loadState().audioAssets[0].fadeIn,1.5);const data=JSON.parse(await (await exportWorkspace(state)).text());assert.deepEqual(validateState(data.state),state);validateState(initialState());
  for(const value of [-1,31,'2',null,NaN]){const invalid=structuredClone(state);invalid.ambiences[0].layers[0].fadeOut=value;assert.throws(()=>validateState(invalid),/Fade de áudio inválido/);}
});

test('música individual inicia em loop por padrão e pode desligar repetição sem reiniciar',async()=>{
  const {engine}=fixture();engine.fireCue({id:'song-loop',name:'Corredor',actions:[{type:'music-play',assetId:'asset-bell',volume:.4,fadeIn:0,delay:0}]});await settle();
  const track=engine.music;assert.equal(track.audio.loop,true);assert.equal(engine.musicFadeOptions.loop,true);assert.equal(track.volume,.4);
  engine.setMusicLoop(false);assert.strictEqual(engine.music,track);assert.equal(track.audio.loop,false);engine.setMusicLoop(true);assert.equal(track.audio.loop,true);
  await engine.playMusic(engine.asset('asset-door'),{loop:false,fadeIn:0});assert.equal(engine.music.audio.loop,false);
});
test('playlist continua para a próxima música em vez de repetir sua primeira faixa',async()=>{
  const {engine,state}=fixture(),playlist={id:'loop-queue',name:'Fila',assetIds:['asset-bell','asset-door']};state.playlists.push(playlist);await engine.playPlaylist(playlist,0,{loop:true});
  const first=engine.music;assert.equal(first.audio.loop,false);first.audio.onended();await settle();assert.equal(engine.musicAsset.id,'asset-door');assert.equal(engine.music.audio.loop,false);
});
test('YouTube repete o mesmo vídeo com volume e fades preservados em cada rodada',async()=>{
  const {engine}=fixture(),fake=fakeYouTube(engine),asset={id:'single-loop',name:'12:00 AM',provider:'youtube',videoId:'dQw4w9WgXcQ'};
  await engine.playMusic(asset,{fadeIn:0,fadeOut:.1,volume:.4});engine.handleYouTubeState(1);assert.equal(engine.ytLevel,.4);
  for(let i=0;i<2;i++){
    engine.handleYouTubeState(0);engine.handleYouTubeState(0);await settle();assert.ok(engine.ytPendingFade);assert.equal(engine.ytPendingFade.level,.4);
    engine.handleYouTubeState(1);assert.equal(engine.ytLevel,.4);assert.equal(engine.musicFadeOptions.fadeOut,.1);
  }
  assert.equal(fake.calls.filter(c=>c[0]==='loadVideo').length,3);
});
test('replay manual do mesmo vídeo recupera o volume depois do fade final',async()=>{
  const {engine,state}=fixture(),fake=fakeYouTube(engine);let position=0;engine.yt.getCurrentTime=()=>position;
  await engine.playMusic({id:'manual-replay',name:'12:00 AM',provider:'youtube',videoId:'dQw4w9WgXcQ'},{fadeIn:0,fadeOut:.1,volume:.4,loop:false});engine.handleYouTubeState(1);
  position=99.96;engine.tickMusic();await new Promise(r=>setTimeout(r,80));assert.equal(engine.ytLevel,0);
  engine.handleYouTubeState(0);await settle();assert.equal(fake.calls.filter(c=>c[0]==='loadVideo').length,1);
  position=0;engine.handleYouTubeState(1);await new Promise(r=>setTimeout(r,250));assert.equal(engine.ytLevel,.4);assert.equal(engine.ytEndFadeKey,null);
  engine.fadeMusicTo(.9,0);assert.equal(engine.musicTargetLevel,.9);assert.equal(engine.ytLevel,.9);assert.equal(fake.calls.filter(c=>c[0]==='volume').at(-1)[1],Math.round(state.settings.master*state.settings.music*.9*100));
});
test('voltar o vídeo antes de terminar cancela o fade antigo sem exigir evento PLAYING',async()=>{
  const {engine}=fixture();fakeYouTube(engine);let position=0;engine.yt.getCurrentTime=()=>position;
  await engine.playMusic({id:'seek-replay',name:'Faixa',provider:'youtube',videoId:'dQw4w9WgXcQ'},{fadeIn:0,fadeOut:.1,volume:.6});engine.handleYouTubeState(1);
  position=99.96;engine.tickMusic();await new Promise(r=>setTimeout(r,80));assert.equal(engine.ytLevel,0);
  position=0;engine.tickMusic();await new Promise(r=>setTimeout(r,250));assert.equal(engine.ytLevel,.6);assert.equal(engine.ytEndFadeKey,null);
});
test('recuperar replay preserva volume zero intencional e mixer independente',async()=>{
  const {engine,state}=fixture();fakeYouTube(engine);await engine.playMusic({id:'quiet-loop',name:'Faixa',provider:'youtube',videoId:'dQw4w9WgXcQ'},{fadeIn:0,volume:0,loop:false});engine.handleYouTubeState(1);
  engine.ytEnded=true;engine.ytEndFadeKey='dQw4w9WgXcQ';engine.handleYouTubeState(1);await new Promise(r=>setTimeout(r,250));assert.equal(engine.ytLevel,0);assert.equal(state.settings.music,.7);
});
test('fim atrasado não reinicia uma música enquanto ela está sendo encerrada',async()=>{
  const {engine}=fixture(),fake=fakeYouTube(engine);await engine.playMusic({id:'stop-loop',name:'Faixa',provider:'youtube',videoId:'dQw4w9WgXcQ'},{fadeIn:0});engine.handleYouTubeState(1);
  const stopping=engine.stopMusic(.04);engine.handleYouTubeState(0);await stopping;assert.equal(engine.musicAsset,null);assert.equal(fake.calls.filter(c=>c[0]==='loadVideo').length,1);
});
test('Silêncio total cancela também um reinício automático aguardando o YouTube',async()=>{
  const {engine}=fixture(),fake=fakeYouTube(engine);await engine.playMusic({id:'cancel-loop',name:'Faixa',provider:'youtube',videoId:'dQw4w9WgXcQ'},{fadeIn:0});engine.handleYouTubeState(1);
  let release;engine.youtubeAPI=()=>new Promise(resolve=>{release=resolve;});engine.handleYouTubeState(0);await settle();engine.silence();release();await settle();assert.equal(engine.musicAsset,null);assert.equal(fake.calls.filter(c=>c[0]==='loadVideo').length,1);assert.equal(engine.ytPlaying,false);
});
test('backup guarda repetição por cue, cena e ambiente sem alterar configurações antigas',async()=>{
  const state=initialState(),scene=state.campaigns[0].pages[0].scenes[0];scene.music={mode:'play',assetId:'asset-bell',loop:false};scene.cues=[{id:'loop-off',name:'Uma vez',actions:[{type:'music-play',assetId:'asset-door',loop:false,delay:0}]}];state.ambiences[0].music={assetId:'asset-bell',volume:.4,loop:true};
  const data=JSON.parse(await (await exportWorkspace(state)).text());assert.deepEqual(validateState(data.state),state);validateState(initialState());data.state.campaigns[0].pages[0].scenes[0].cues[0].actions[0].loop='false';assert.throws(()=>validateState(data.state),/Repetição/);
});


test('fechar destrói o iframe e reabrir ignora eventos do player anterior',async()=>{
  const {engine}=fixture();const originalYT=window.YT,originalLocation=globalThis.location,players=[];
  globalThis.location={origin:'https://example.test'};engine.youtubeAPI=async()=>{};
  window.YT={Player:class{constructor(id,options){this.events=options.events;this.destroyed=false;players.push(this);}destroy(){this.destroyed=true;}}};
  try{
    const opening=engine.ensureYouTube();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(players.length,1);engine.closeYouTube();assert.equal(await opening,false);
    assert.equal(players[0].destroyed,true);assert.equal(engine.yt,null);assert.equal(engine.playerPromise,null);
    players[0].events.onReady();assert.equal(engine.ytReady,false);
    const reopening=engine.ensureYouTube();await new Promise(resolve=>setImmediate(resolve));
    players[1].events.onReady();assert.equal(await reopening,true);assert.equal(engine.yt,players[1]);
    engine.ytPlaying=true;players[0].events.onStateChange({data:2});assert.equal(engine.ytPlaying,true);
    engine.closeYouTube();assert.equal(players[1].destroyed,true);assert.equal(engine.ytReady,false);
  }finally{engine.closeYouTube();window.YT=originalYT;globalThis.location=originalLocation;}
});
test('fechar durante o carregamento da API não ressuscita a música',async()=>{
  const {engine}=fixture();let release;engine.youtubeAPI=()=>new Promise(resolve=>{release=resolve;});
  const playing=engine.playMusic({id:'pending-yt',provider:'youtube',videoId:'abcdefghijk'});
  await new Promise(resolve=>setImmediate(resolve));engine.closeYouTube();release();await playing;
  assert.equal(engine.musicAsset,null);assert.equal(engine.ytReady,false);assert.equal(document.getElementById('youtubePanel').hidden,true);
});
