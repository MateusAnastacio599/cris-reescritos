import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {connectionView} from '../../quadro/board-room-ui.js';
import {RemoteCinematics} from '../dist/cinematic-remote.js';
import {LiveWire} from '../integration-main/quadro/board-live.js';
test('sinalização aberta não equivale a jogador conectado; snapshot confirmado prevalece sobre mensagem antiga',()=>{
 assert.equal(connectionView({peerOpen:true}).state,'connecting');
 assert.equal(connectionView({links:[{open:true,_syncReady:false}]}).state,'loading');
 assert.equal(connectionView({links:[{open:true,_syncReady:true}],error:'sync-failed',everReady:true}).state,'synced');
 assert.equal(connectionView({everReady:true}).state,'reconnecting');
 assert.equal(connectionView({links:[{open:true,_syncReady:true,peerConnection:{iceConnectionState:'failed'}}],everReady:true}).state,'reconnecting');
 assert.equal(connectionView({role:'host',peerOpen:true}).state,'waiting');
 assert.equal(connectionView({links:[{open:true,_legacy:true}]}).state,'loading');
 assert.equal(connectionView({error:'scope-rejected'}).state,'failed');
 assert.equal(connectionView({stopped:true,peerOpen:true}).state,'idle');
});
test('registro de chave recusado produz causa consultável sem tokens/detalhes do servidor',async()=>{
 const remote=new RemoteCinematics({Wire:LiveWire,frame:{},bridge:{registerLiveHost:async()=>{throw Object.assign(Error('sensitive token=secret'),{code:'42501'});}}});
 try{assert.equal(await remote.prepareHost('ROOM1234'),false);assert.equal(remote.diagnostics().hostFailure.code,'42501');assert.match(remote.hostError,/acesso/);assert.equal(JSON.stringify(remote.diagnostics()).includes('secret'),false);}finally{remote.close();}
});
test('composição de sala foi centralizada e cópias incluem módulo e CSS novos',()=>{
 const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8'),engine=read('quadro/quadro-cris-v7.js');
 assert.equal(engine.includes('e2.id = "shChoose"'),false);assert.equal(engine.includes('const Hb = vr'),false);assert.equal(engine.includes('const Ax2 ='),false);assert.equal(engine.includes('id=\'vwBar\''),false);
 for(const file of ['board-room-ui.js','board-room.css'])for(const prefix of ['campaign-director/integration-main/','campaign-director/dist/cris/'])assert.equal(read(prefix+'quadro/'+file),read('quadro/'+file));
 assert.equal(read('quadro/board-polish.css').includes('2147483647'),false);assert.equal(read('campaign-director/dist/cinematic.css').includes('2147483646'),false);assert.match(read('quadro/board-room-ui.js'),/callbacks\.kick\?\.\(p.id\)/);
});
test('queda de conexão não cria overlay nem afirma que o mestre saiu; abertura do mestre tem camada efetiva',()=>{
 const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8'),engine=read('quadro/quadro-cris-v7.js'),css=read('quadro/board-room.css');
 const ac=engine.slice(engine.indexOf('  function ac('),engine.indexOf('  function nc('));assert.equal(ac.includes('createElement'),false);assert.equal(ac.includes('O mestre saiu'),false);assert.ok(css.includes('#masterLaunch{position:fixed;inset:0;z-index:110;'));assert.equal(engine.includes('const Eq = Ar'),false);
});
