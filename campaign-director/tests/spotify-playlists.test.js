import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupSpotifyItem,playlistReference,playlistEmbedURL,playlistReadError} from '../dist/spotify-playlists.js';
import {SpotifyPlayer} from '../dist/spotify-player.js';
import {initialState,validateState} from '../dist/storage.js';
const playlist='37i9dQZF1DX0ZO4kBlpsIH',uri='spotify:playlist:'+playlist,track='spotify:track:16GSp3rIcIIPrhoTlUxee3';
test('Café de Paris aceita o link com compartilhamento e oferece referência para consulta bloqueada',async()=>{
 for(const status of [403,404]){const error=Object.assign(Error('restricted'),{status}),p={metadata:async()=>{throw error;}};const result=await lookupSpotifyItem(p,'https://open.spotify.com/playlist/'+playlist+'?si=d19a441390ba4e38');assert.equal(result.limited,true);assert.equal(result.parsed.uri,uri);assert.equal(result.item,null);}
});
test('rede, expiração, rate limit e faixa inexistente não viram adição aparente de sucesso',async()=>{
 for(const status of [401,429,500,undefined])await assert.rejects(()=>lookupSpotifyItem({metadata:async()=>{throw Object.assign(Error('failure'),{status});}},uri),/failure/);
 await assert.rejects(()=>lookupSpotifyItem({metadata:async()=>{throw Object.assign(Error('missing'),{status:404});}},track),/missing/);
});
test('consulta disponível preserva nome, capa e URI reais em vez de acionar fallback',async()=>{
 const item={name:'Minha playlist',uri};const result=await lookupSpotifyItem({metadata:async()=>item},uri);assert.equal(result.item,item);assert.equal(result.limited,false);
});
test('referência exige nome e playlist válida; painel oficial só usa origem Spotify e ID validado',()=>{
 const item=playlistReference(uri,' Café de Paris ');assert.equal(item.name,'Café de Paris');assert.equal(item.metadataUnavailable,true);assert.equal(playlistEmbedURL(uri),'https://open.spotify.com/embed/playlist/'+playlist+'?utm_source=generator&theme=0');
 for(const value of ['javascript:alert(1)','https://evil.test/playlist/'+playlist,track])assert.throws(()=>playlistReference(value,'Teste'));
 assert.throws(()=>playlistReference(uri,''));assert.throws(()=>playlistReference(uri,'x'.repeat(121)));assert.throws(()=>playlistEmbedURL(track));
 const state=initialState();state.audioAssets.push({id:'link-only',provider:'spotify',kind:'music',spotifyUri:item.uri,name:item.name,metadataUnavailable:true});assert.doesNotThrow(()=>validateState(state));
});
test('404 de consulta não manda preparar o player; 404 de reprodução orienta ativar o player',async()=>{
 const p=new SpotifyPlayer({auth:{token:async()=> 'token'},fetcher:async()=>new Response('',{status:404})});await assert.rejects(()=>p.metadata(uri),e=>e.status===404&&/consulta/.test(e.message)&&!/player ativo/.test(e.message));await assert.rejects(()=>p.api('/me/player/play',{method:'PUT'}),e=>e.status===404&&/player ativo/.test(e.message));assert.match(playlistReadError({status:404}),/painel oficial/);
});
test('escolher faixa numa playlist aleatória mantém contexto, repetição e aleatório após a escolha',async()=>{
 const p=new SpotifyPlayer({auth:{connected:true,token:async()=> 'token'}}),calls=[];p.deviceId='device';p.player={activateElement:async()=>{},setVolume:async()=>{},pause:async()=>{}};p.api=async(path,options)=>{calls.push({path,...options});};await p.play({spotifyUri:uri,shuffle:true,spotifyCount:100},{selectedUri:track,fadeIn:0,fadeOut:0});const command=calls.find(c=>c.path.includes('/play?'));assert.equal(command.body.context_uri,uri);assert.deepEqual(command.body.offset,{uri:track});assert.ok(calls.some(c=>c.path.endsWith('state=context')));assert.ok(calls.some(c=>c.path.endsWith('state=true')));await p.pause();
});
