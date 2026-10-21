import test from 'node:test';
import assert from 'node:assert/strict';
import {BoardLink,clueCatalog} from '../dist/board-link.js';
import {attachClue} from '../dist/board-link-ui.js';
import {initialState,validateState} from '../dist/storage.js';
import {boardStamp,chooseBoardVersion,applyBoardCommands,BoardSession} from '../integration-main/quadro/board-session.js';
const campaign='39003a62-cb07-57fd-9d6a-da2b6f802421';
test('catálogo exclui inventário e binários e conserva IDs e visibilidade das pistas',()=>{
 const rows=clueCatalog([{id:'a',gm:true,type:'foto',name:'<b>Janela</b>',imgId:'secret',secret:'anotação'},{id:'b',hand:'box',name:'Guardado'},{id:'c',text:'Carta\nSegredo'}]);assert.deepEqual(rows,[{id:'a',title:'Janela',hidden:true,type:'foto'},{id:'c',title:'Carta',hidden:false,type:'item'}]);assert.equal(JSON.stringify(rows).includes('secret'),false);
});
test('vincular pista cria cue e bloco usando IDs estáveis, sem copiar dados ocultos no roteiro',()=>{
 const s=initialState(),scene=s.campaigns[0].pages[0].scenes[0],before=scene.markdown,trigger=attachClue(scene,{id:'clue',title:'Carta perdida'},campaign);assert.ok(scene.markdown.startsWith(before));assert.ok(scene.markdown.includes('[[cue:'+trigger.id));assert.equal(scene.cues.at(-1).actions[0].itemId,'clue');assert.doesNotThrow(()=>validateState(s));scene.cues.at(-1).actions[0].boardCampaignId='invalid';assert.throws(()=>validateState(s),/Pista/);
});
test('comando é enviado para a campanha vinculada e erros do servidor não viram sucesso',async()=>{
 let inserted;const client={from:table=>{assert.equal(table,'board_cue_commands');return {insert:row=>{inserted=row;return {select:()=>({single:async()=>({data:{id:'cmd'}})})};}};}};const link=new BoardLink({campaign:()=>campaign,client:async()=>client});assert.deepEqual(await link.send('clue'),{id:'cmd'});assert.deepEqual(inserted,{campaign_id:campaign,item_id:'clue',action:'reveal'});await assert.rejects(()=>link.send('clue','reveal','other'),/outra campanha/);await assert.rejects(()=>link.send('','reveal'),/inválido/);
});
test('confirmação de revelação só ocorre depois de salvar o snapshot, e repetição é idempotente',async()=>{
 const calls=[],api={visibility:async(id,visible)=>calls.push(['visibility',id,visible])};await applyBoardCommands({commands:[{id:'cmd',item_id:'clue',action:'reveal'}],api,flush:async()=>calls.push(['save']),ack:async(id,error)=>calls.push(['ack',id,error])});assert.deepEqual(calls,[['visibility','clue',true],['save'],['ack','cmd',null]]);
});
test('falha na nuvem mantém comando pendente; pista removida recebe erro definitivo',async()=>{
 let acked=false;await assert.rejects(()=>applyBoardCommands({commands:[{id:'cmd',item_id:'clue',action:'reveal'}],api:{visibility:async()=>{}},flush:async()=>{throw Error('offline');},ack:async()=>acked=true}),/offline/);assert.equal(acked,false);
 await assert.rejects(()=>applyBoardCommands({commands:[{id:'cmd',item_id:'missing',action:'reveal'}],api:{visibility:async()=>{throw Object.assign(Error('missing'),{code:'CLUE_MISSING'});}},flush:async()=>{},ack:async()=>acked=true}),/missing/);assert.equal(acked,true);
});
test('quadro escolhe cópia segura ao trocar de computador e pede revisão quando ambos mudaram',()=>{
 const local={state:{items:[{id:'a',gm:true}]},imgs:{}},remote=structuredClone(local),base=boardStamp(local);assert.equal(chooseBoardVersion(local,remote,base),'remote');local.state.items[0].gm=false;assert.equal(chooseBoardVersion(local,remote,base),'local');remote.state.items.push({id:'b'});assert.equal(chooseBoardVersion(local,remote,base),'review');assert.equal(chooseBoardVersion(null,remote,null),'remote');assert.equal(chooseBoardVersion(local,null,null),'local');
});
test('marca de versão é pequena e ignora ordem JSONB sem ignorar mudanças de imagem',()=>{
 const a={state:{items:[{id:'a',gm:true}]},imgs:{a:'x'.repeat(10000)}},b={imgs:{a:'x'.repeat(10000)},state:{items:[{gm:true,id:'a'}]}};assert.equal(boardStamp(a),boardStamp(b));assert.ok(boardStamp(a).length<60);b.imgs.a='y'.repeat(10000);assert.notEqual(boardStamp(a),boardStamp(b));
});
test('auto salvamento confirma somente snapshot enviado e continua edições durante upload',async()=>{
 let current={state:{items:[]},imgs:{}},release;const writes=[],storage={setItem(){}};const bridge={identity:{userId:'owner'},campaignId:campaign,saveBoard:async snapshot=>{writes.push(snapshot);if(writes.length===1)await new Promise(r=>release=r);}};const s=new BoardSession({bridge,storage});s.status=()=>{};s.api={snapshot:()=>structuredClone(current)};const saving=s.flush();current.state.items.push({id:'new'});release();await saving;assert.equal(writes.length,2);assert.equal(writes[0].state.items.length,0);assert.equal(writes[1].state.items.length,1);assert.equal(s.dirty,false);
});

test('snapshot é preservado no aparelho antes de confirmar a nuvem e não confirma se a cópia local falhar',async()=>{
 const calls=[],snapshot={state:{items:[]},imgs:{}},bridge={identity:{userId:'owner'},campaignId:campaign,saveBoard:async()=>calls.push('cloud')},s=new BoardSession({bridge,storage:{setItem:()=>calls.push('meta')}});s.status=()=>{};s.api={snapshot:()=>snapshot,persistLocal:async()=>calls.push('local')};await s.flush();assert.deepEqual(calls,['local','cloud','meta']);s.base=null;s.api.persistLocal=async()=>{throw Error('IndexedDB unavailable');};await assert.rejects(()=>s.flush(),/IndexedDB/);assert.equal(calls.filter(c=>c==='cloud').length,1);
});
