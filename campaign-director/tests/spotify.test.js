import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {SpotifyAuth,parseSpotify,SPOTIFY_HOME,SPOTIFY_REDIRECT} from '../dist/spotify-auth.js';
import {SpotifyPlayer} from '../dist/spotify-player.js';
import {initialState,validateState} from '../dist/storage.js';

const ID='16GSp3rIcIIPrhoTlUxee3',URI='spotify:track:'+ID;
const storage=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const response=(data,status=200,headers={})=>({ok:status>=200&&status<300,status,headers:new Headers(headers),json:async()=>data});
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('Spotify aceita links oficiais localizados e rejeita hosts falsos e outros tipos',()=>{
  assert.equal(parseSpotify('https://open.spotify.com/intl-pt/track/'+ID+'?si=test').uri,URI);
  assert.equal(parseSpotify('spotify:playlist:'+ID).type,'playlist');
  for(const url of ['https://open.spotify.com.evil.test/track/'+ID,'javascript:alert(1)','https://open.spotify.com/album/'+ID,'https://open.spotify.com/track/abc'])assert.throws(()=>parseSpotify(url));
});
test('PKCE gera desafio S256, valida estado e usa o retorno registrado sem Client Secret',async()=>{
  const store=storage(),calls=[],auth=new SpotifyAuth({storage:store,cryptoProvider:webcrypto,now:()=>100,fetcher:async(url,options)=>{calls.push({url,options});return response({access_token:'access',refresh_token:'refresh',expires_in:3600});}});
  const url=new URL(await auth.begin(SPOTIFY_HOME));assert.equal(url.searchParams.get('redirect_uri'),SPOTIFY_REDIRECT);assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  const pending=JSON.parse([...store.map.values()][0]);assert.ok(pending.verifier.length>=43);
  const hash=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(pending.verifier))).toString('base64url');assert.equal(url.searchParams.get('code_challenge'),hash);
  await auth.complete(new URLSearchParams({state:pending.state,code:'test-code'}));assert.equal(auth.connected,true);assert.equal(calls.length,1);assert.equal(calls[0].options.body.has('client_secret'),false);assert.equal(calls[0].options.body.get('code_verifier'),pending.verifier);
  assert.equal([...store.map.keys()].some(k=>k.includes('pkce')),false);
});
test('estado incorreto, expirado ou cancelado não troca código por tokens',async()=>{
  for(const scenario of ['mismatch','expired','cancelled']){
    let now=100,calls=0;const store=storage(),auth=new SpotifyAuth({storage:store,cryptoProvider:webcrypto,now:()=>now,fetcher:async()=>{calls++;return response({});}});
    const url=new URL(await auth.begin(SPOTIFY_HOME));if(scenario==='expired')now=700000;
    const params=new URLSearchParams({state:scenario==='mismatch'?'bad':url.searchParams.get('state'),code:'test'});if(scenario==='cancelled')params.set('error','access_denied');
    await assert.rejects(()=>auth.complete(params));assert.equal(calls,0);assert.equal(auth.connected,false);
  }
});
test('conexão iniciada no preview é recusada antes de gerar autorização inválida',async()=>{
  const store=storage(),auth=new SpotifyAuth({storage:store});await assert.rejects(()=>auth.begin('https://example.chatgpt.site/'),/endereço original/);assert.equal(store.map.size,0);
});
test('renovação simultânea faz uma chamada e preserva refresh token não rotacionado',async()=>{
  const store=storage();let now=100,calls=0;const auth=new SpotifyAuth({storage:store,now:()=>now,fetcher:async()=>{calls++;await settle();return response({access_token:'new',expires_in:3600});}});
  store.setItem('cris:spotify:session:v1',JSON.stringify({access_token:'old',refresh_token:'refresh',expires_at:0}));
  assert.deepEqual(await Promise.all([auth.token(),auth.token()]),['new','new']);assert.equal(calls,1);assert.equal(auth.read().refresh_token,'refresh');
});
test('desconectar durante renovação não restaura tokens',async()=>{
  const store=storage();let release;const auth=new SpotifyAuth({storage:store,fetcher:()=>new Promise(resolve=>{release=resolve;})});
  store.setItem('cris:spotify:session:v1',JSON.stringify({access_token:'old',refresh_token:'refresh',expires_at:0}));
  const pending=auth.token();auth.disconnect();release(response({access_token:'new',refresh_token:'new-refresh',expires_in:3600}));await assert.rejects(pending,/encerrada/);assert.equal(auth.connected,false);
});
test('paginação aceita somente a API Spotify e nunca encaminha token a outro host',async()=>{
  const urls=[],player=new SpotifyPlayer({auth:{token:async()=> 'token'},fetcher:async url=>{urls.push(url);return response({items:[{id:'one'}],next:'https://evil.test/v1/me/playlists'});}});
  await assert.rejects(()=>player.playlists(),/Paginação/);assert.equal(urls.length,1);assert.ok(urls[0].startsWith('https://api.spotify.com/v1/'));
});
test('API 429 respeita cooldown sem repetição de comandos e 403 é explicado',async()=>{
  let calls=0;const player=new SpotifyPlayer({auth:{token:async()=> 'token'},fetcher:async()=>{calls++;return response({},429,{'Retry-After':'20'});}});
  await assert.rejects(()=>player.api('/me'),/Limite/);await assert.rejects(()=>player.api('/me'),/pausa/);assert.equal(calls,1);
  player.retryAt=0;player.fetcher=async()=>response({},403);await assert.rejects(()=>player.api('/me'),/Users Management/);
});
test('faixas usam endpoint atual e descartam episódios, itens nulos e arquivos locais',async()=>{
  const player=new SpotifyPlayer();let path;player.pages=async value=>{path=value;return [{item:{type:'track',uri:URI}},{track:{type:'track',uri:URI}},{item:null},{item:{type:'episode'}},{item:{type:'track',is_local:true}},{item:{type:'track',is_playable:false}}];};
  const list=await player.playlistTracks(ID);assert.equal(path,'/playlists/'+ID+'/items?limit=50');assert.equal(list.length,2);
});
function readyPlayer(){
  const player=new SpotifyPlayer({auth:{connected:true,token:async()=> 'token'}}),calls=[];player.deviceId='cris-device';
  player.player={activateElement:async()=>{calls.push('activate');},pause:async()=>{calls.push('pause');},resume:async()=>{calls.push('resume');},setVolume:async volume=>{calls.push(['volume',volume]);},disconnect:()=>calls.push('disconnect')};
  player.api=async(path,options)=>{calls.push({path,...options});};return {player,calls};
}
test('Spotify inicia faixa com posição e repetição sem criar áudio local',async()=>{
  const {player,calls}=readyPlayer();assert.equal(await player.play({spotifyUri:URI},{startSeconds:12,loop:true}),true);
  const play=calls.find(c=>c?.path?.includes('/play?'));assert.deepEqual(play.body,{uris:[URI],position_ms:12000});assert.ok(calls.some(c=>c?.path?.endsWith('state=track')));assert.ok(calls.some(c=>c?.path?.endsWith('state=false')));
});
test('cue posterior invalida o preparo da cue anterior',async()=>{
  const {player,calls}=readyPlayer();let release;player.ensure=()=>new Promise(resolve=>{release=resolve;});
  const first=player.play({spotifyUri:URI},{});await settle();await player.pause();release('cris-device');assert.equal(await first,false);assert.equal(calls.some(c=>c?.path?.includes('/play?')),false);
});
test('parar durante comando em voo termina em pausa e não ajusta repetição depois',async()=>{
  const {player,calls}=readyPlayer();let release;player.api=async path=>{calls.push(path);if(path.includes('/play?'))await new Promise(resolve=>{release=resolve;});};
  const first=player.play({spotifyUri:URI},{});await settle();const stopping=player.pause();release();assert.equal(await first,false);await stopping;assert.equal(calls.at(-1),'pause');assert.equal(calls.some(c=>typeof c==='string'&&c.includes('/repeat?')),false);
});
test('evento atrasado de reprodução após parar é pausado e não reativa o transporte',async()=>{
  const {player,calls}=readyPlayer();player.acceptPlayback=false;player.receiveState({paused:false,position:100,track_window:{current_track:{uri:URI}}});await settle();assert.equal(player.playing,false);assert.ok(calls.includes('pause'));
});
test('backup aceita Spotify somente no canal musical e não incorpora credenciais',()=>{
  const state=initialState();state.audioAssets.push({id:'spotify-test',name:'Teste',provider:'spotify',kind:'music',spotifyUri:URI});assert.doesNotThrow(()=>validateState(state));
  state.audioAssets.at(-1).kind='sfx';assert.throws(()=>validateState(state),/Spotify/);
  const callback=readFileSync(new URL('../dist/spotify-callback.js',import.meta.url),'utf8');assert.ok(callback.indexOf('history.replaceState')<callback.indexOf('await new SpotifyAuth().complete'));
  const authSource=readFileSync(new URL('../dist/spotify-auth.js',import.meta.url),'utf8');assert.equal(authSource.includes('localStorage'),false);assert.equal(authSource.includes('client_secret:'),false);
});

test('preparação simultânea reutiliza um SDK player e desconectar ignora ready atrasado',async()=>{
  const original=globalThis.window,instances=[];globalThis.window={Spotify:{Player:class{
    constructor(){this.listeners={};instances.push(this);}
    addListener(name,callback){this.listeners[name]=callback;}
    async connect(){return true;}
    disconnect(){this.disconnected=true;}
  }}};
  const player=new SpotifyPlayer({auth:{connected:true,disconnect(){}},sdk:async()=>{}});
  try{
    const first=player.ensure(),second=player.ensure();await settle();assert.equal(instances.length,1);
    instances[0].listeners.ready({device_id:'cris-device'});assert.equal(await first,'cris-device');assert.equal(await second,'cris-device');
    player.disconnect();instances[0].listeners.ready({device_id:'stale-device'});assert.equal(player.deviceId,null);assert.equal(instances[0].disconnected,true);
  }finally{player.disconnect();globalThis.window=original;}
});
test('desconectar enquanto SDK carrega não cria player depois',async()=>{
  let release;const player=new SpotifyPlayer({auth:{connected:true,disconnect(){}},sdk:()=>new Promise(resolve=>{release=resolve;})});
  const preparing=player.ensure();player.disconnect();release();await assert.rejects(preparing,/cancelada/);assert.equal(player.player,null);
});
