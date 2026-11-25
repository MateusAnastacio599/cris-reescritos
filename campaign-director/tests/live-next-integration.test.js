import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
test('entrada, player remoto e transporte estão conectados nas três distribuições com caminhos corretos',()=>{
 for(const prefix of ['', 'campaign-director/integration-main/', 'campaign-director/dist/cris/']){
  for(const file of ['board-entry.js','board-live.js','quadro-cris-v7.js','board-polish.css'])assert.equal(read(prefix+'quadro/'+file),read('quadro/'+file));
  const html=read(prefix+'quadro/index.html');assert.ok(html.includes('prepareRoomEntry({identity,bridge:CRISBridge})'));assert.ok(html.includes('window.CRIS_CINEMATIC_READY='));assert.ok(read(prefix+'cris.js').includes("boardPrimaryAction.href = 'quadro/';"));
 }
 assert.equal(read('quadro/board-cinematic.js').replaceAll('../campaign-director/dist/','../../'),read('campaign-director/dist/cris/quadro/board-cinematic.js'));assert.ok(read('campaign-director/dist/cris/integration-bridge.js').includes("new URL('../',import.meta.url)"));assert.ok(existsSync(new URL('campaign-director/dist/cinematic-remote.js',root)));
});
test('jogador não monta receptor BroadcastChannel e segredo não é publicado no registro de anfitrião',()=>{
 const source=read('quadro/board-cinematic.js');assert.ok(source.includes('if(isMaster&&globalThis.BroadcastChannel)'));const bridge=read('integration-bridge.js');assert.ok(bridge.includes('liveRoom:{room,publicKey,expiresAt:'));assert.equal(bridge.includes('privateKey'),false);assert.equal(bridge.includes('service_role'),false);const sql=read('campaign-director/backend/foundation.sql');assert.match(sql,/create policy campaigns_edit[^\n]*can_access_campaign\(id,true\)/);
});
