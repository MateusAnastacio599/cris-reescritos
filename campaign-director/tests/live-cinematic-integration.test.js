import test from 'node:test';
import assert from 'node:assert/strict';
import {SimPeer} from './fixtures/live-peer-simulated.js';
import {LivePeerSession,LiveWire} from '../integration-main/quadro/board-live.js';
import {RemoteCinematics} from '../dist/cinematic-remote.js';
import {imageKey} from '../dist/cinematic-media.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<600;i++){if(fn())return;await pause(5);}assert.fail('integrated condition not reached');}
test('PeerSession → snapshot ACK → prova → manifesto → LiveWire → player → recibo; reconexão preserva sala',async()=>{
 let key;const bridge={registerLiveHost:async(r,jwk)=>key=jwk,liveHostKey:async()=>key},frames=[],received=[];
 const hostRemote=new RemoteCinematics({Wire:LiveWire,frame:{},bridge}),clientRemote=new RemoteCinematics({Wire:LiveWire,frame:{show:async(asset,item)=>{frames.push(item);return true;},clear:async()=>true,seek(){}},bridge});
 const room='INTEGRATION'+Math.floor(Math.random()*1e7),campaign='fixture-'+crypto.randomUUID();
 const h=new LivePeerSession({role:'host',campaign,userId:'master',Peer:SimPeer,onControl:(m,c)=>hostRemote.packet(m,c),onDrop:c=>hostRemote.disconnect(c),changed:()=>hostRemote.refresh(),onReady:c=>{hostRemote.bind(c,h);void h.send(c,{t:'full',s:JSON.stringify({items:[{id:'visible'}],pins:[],strings:[]})});}});
 const p=new LivePeerSession({role:'client',campaign,userId:'player',Peer:SimPeer,onControl:(m,c)=>clientRemote.packet(m,c),onDrop:c=>clientRemote.disconnect(c),onReady:c=>clientRemote.bind(c,p),onData:async m=>{if(m.t==='full'){await pause(20);received.push(JSON.parse(m.s));}}});
 try{
  await hostRemote.prepareHost(room);h.start(room);p.start(room);await until(()=>h.links.size===1&&[...h.links][0]._syncReady);assert.equal(received.length,1);
  const blob=new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')],{type:'image/png'}),item={id:'integrated',imageId:await imageKey(blob),name:'Integração',motion:'living',seconds:12,intensity:10,ending:'loop',fadeIn:0,fadeOut:0};
  await hostRemote.present(item,blob);await until(()=>frames.length===1&&[...hostRemote.peers.values()][0].status==='apresentando');assert.equal(clientRemote.diagnostics().events.some(e=>e.phase==='media-validated'),true);
  p.drop([...p.links][0],'test');p.dial();await until(()=>frames.length===2);assert.equal(p.code,room);assert.equal(h.participants().length,1);
  hostRemote.stop(true);await until(()=>[...hostRemote.peers.values()][0].status==='encerrado');assert.equal(clientRemote.pending,null);
 }finally{h.stop();p.stop();hostRemote.close();clientRemote.close();}
});
