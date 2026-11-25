import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoomInvite,RoomBinding,prepareRoomEntry} from '../../quadro/board-entry.js';
const origin='https://cris.example',storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
test('convite carrega sala e campanha; código formatado é aceito sem editar URL',()=>{
 assert.deepEqual(parseRoomInvite(origin+'/quadro/?sala=abcdefgh1234&campanha=other',{origin,campaignId:'case'}),{room:'ABCDEFGH1234',campaignId:'other',explicitCampaign:true});
 assert.deepEqual(parseRoomInvite('ABC DEFGH-1234',{origin,campaignId:'case'}),{room:'ABCDEFGH1234',campaignId:'case'});
 assert.equal(parseRoomInvite('CASO26107',{origin,campaignId:'case'}).room,'CASO26107');
});
test('recusa links de outro site, caminho arbitrário, injeção e códigos inválidos',()=>{
 for(const value of ['https://evil.example/quadro/?sala=ROOMROOM','javascript:alert(1)',origin+'/other/?sala=ROOMROOM','ABC','<script>','A'.repeat(33)])assert.throws(()=>parseRoomInvite(value,{origin,campaignId:'case'}));
});
test('vínculo sobrevive reentrada e troca somente na conta correta; cache inválido não prende usuário',()=>{
 const store=storage(),a=new RoomBinding({storage:store,userId:'one',campaignId:'case',origin}),b=new RoomBinding({storage:store,userId:'two',campaignId:'case',origin});
 assert.equal(a.read(),null);a.save({room:'ROOMONE',campaignId:'case'});assert.equal(a.read().room,'ROOMONE');assert.equal(b.read(),null);a.save({room:'ROOMTWO',campaignId:'other'});assert.equal(a.read().campaignId,'other');store.setItem(a.key,'broken');assert.equal(a.read(),null);
});
test('convite é revalidado no backend antes de selecionar campanha e persistir preferência',async()=>{
 const store=storage(),calls=[],bridge={campaignId:'case',resolveLiveCampaign:async v=>{calls.push(v);return {id:'other',title:'Outra campanha'};},selectCampaign:async id=>calls.push(id)};
 const entry=await prepareRoomEntry({identity:{userId:'one',isMaster:false},bridge,storage:store,location:{origin,search:'?sala=ROOMONE&campanha=other'}});
 assert.equal(entry.current.title,'Outra campanha');assert.equal(entry.binding.read(),null);await entry.accept(origin+'/quadro/?sala=ROOMONE&campanha=other');assert.equal(entry.binding.read().campaignId,'other');assert.equal(calls[1],'other');
});
test('campanha removida ou convite inválido retorna ao formulário sem selecionar outra silenciosamente',async()=>{
 const entry=await prepareRoomEntry({identity:{userId:'one',isMaster:false},bridge:{campaignId:'case',resolveLiveCampaign:async()=>{throw Error('Sem acesso');},selectCampaign:async()=>assert.fail()},storage:storage(),location:{origin,search:'?sala=ROOMONE&campanha=other'}});
 assert.equal(entry.current,null);assert.equal(entry.error,'Sem acesso');await assert.rejects(entry.accept('ROOMONE'),/Sem acesso/);
});
test('preferência restaurada identifica explicitamente campanha, mesmo com código legado repetido',()=>{
 const store=storage(),binding=new RoomBinding({storage:store,userId:'one',campaignId:'case',origin});binding.save({room:'CASO26107',campaignId:'other'});assert.equal(binding.read().explicitCampaign,true);assert.equal(binding.read().campaignId,'other');
});
