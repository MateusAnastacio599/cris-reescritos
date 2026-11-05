import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareEvidence,placePreparation,preparationLayout} from '../integration-main/quadro/board-preparations.js';
import {BoardEvidence} from '../integration-main/quadro/board-evidence.js';
import {personalBoardLayer,mergePersonalBoard} from '../integration-main/quadro/board-rules.js';

const snapshot=()=>({state:{items:[
 {id:'a',type:'img',imgId:'front',x:10,y:20,w:300,scale:1,rot:0,z:2,gm:true,backText:'Mensagem no verso',gmNotes:'Segredo do mestre',crisClueName:'Roteiro',puzzle:{g:'paper',ox:0,oy:0}},
 {id:'b',type:'img',imgId:'piece',x:100,y:60,w:100,scale:1,rot:0,z:3,parent:null,gm:true,puzzle:{g:'paper',ox:50,oy:0}},
 {id:'unrelated',type:'img',imgId:'secret',x:500,y:500,gm:true}
],pins:[],strings:[]},imgs:{front:'data:image/png;base64,YQ==',piece:'data:image/png;base64,Yg==',secret:'data:image/png;base64,Yw=='}});

test('preparation includes its torn group and backside, excluding other secrets and script metadata',()=>{
 const source=snapshot(),prepared=prepareEvidence(source,'a');
 assert.deepEqual(prepared.state.items.map(i=>i.id),['a','b']);
 assert.equal(prepared.state.items[0].backText,'Mensagem no verso');
 assert.equal(prepared.state.items[0].gmNotes,undefined);
 assert.equal(prepared.state.items[0].crisClueName,undefined);
 assert.equal(prepared.state.items[0].gm,undefined);
 assert.deepEqual(Object.keys(prepared.imgs),['front','piece']);
 assert.equal(source.state.items[0].gm,true);
});

test('torn copies have private identities; positions, joined parents and flipped side survive reload',()=>{
 const template=prepareEvidence(snapshot(),'a');
 const row={id:'personal',attachment:{document_id:'doc'},preparation:template,layout:{}};
 const first=placePreparation(template,row,'agent-a',{x:400,y:400});
 first.state.items[0].x=700;first.state.items[0].flipped=true;
 first.state.items[1].parent=first.state.items[0].id;
 const parts=preparationLayout(row,first.state);
 row.layout={parts};
 const restored=placePreparation(template,row,'agent-a',{x:0,y:0});
 assert.equal(restored.state.items[0].x,700);
 assert.equal(restored.state.items[0].flipped,true);
 assert.equal(restored.state.items[1].parent,restored.state.items[0].id);
 assert.equal(restored.state.items[0].crisOwner,'agent-a');
 assert.equal(restored.state.items[0].puzzle.g,restored.state.items[1].puzzle.g);
 const other=placePreparation(template,{...row,id:'other',layout:{}},'agent-b',{x:10,y:10});
 assert.notEqual(other.state.items[0].id,restored.state.items[0].id);
 assert.notEqual(other.state.items[0].puzzle.g,restored.state.items[0].puzzle.g);
 assert.equal(JSON.stringify(row.layout).includes('data:'),false);
});

test('prepared evidence is persisted as geometry and deletions without copying original bytes',async()=>{
 const template=prepareEvidence(snapshot(),'a');
 const row={id:'personal',attachment:{id:'attachment',document_id:'doc'},preparation:template,layout:{}};
 const writes=[];
 const query={eq:()=>query,then:resolve=>resolve({error:null})};
 const api={client:{from:()=>({update:fields=>{writes.push(fields);return query;},delete:()=>{writes.push('delete');return query;}})}};
 const manager=new BoardEvidence(api,'board','user',[row]);manager.assets={unpack:async x=>x};
 const state={state:{items:[],pins:[],strings:[]},imgs:{}};
 await manager.insertInto(state,{x:100,y:100});
 state.state.items[1].rot=14;state.state.items[0].flipped=true;
 await manager.save(state.state);
 assert.equal(writes[0].layout.parts.b.rot,14);assert.equal(writes[0].layout.parts.a.flipped,true);
 state.state.items.splice(0,1);
 await manager.save(state.state);assert.equal(writes[1].layout.parts.a,false);
 state.state.items=[];await manager.save(state.state);assert.equal(writes[2],'delete');
});

test('withdrawing a master item removes its pins and threads while preserving personal annotations',()=>{
 const original={state:{items:[{id:'gm',x:1}],pins:[{id:'gm-pin',item:'gm'}],strings:[]},imgs:{}};
 const current={state:{items:[{id:'gm',x:500},{id:'note',crisOwner:'me',text:'Minha anotação'}],pins:[{id:'gm-pin',item:'gm'},{id:'mine',item:'note',crisOwner:'me'}],strings:[{id:'link',a:'mine',b:'gm-pin',crisOwner:'me'}]},imgs:{}};
 const layer=personalBoardLayer(original,current,'me');
 const fresh={state:{items:[],pins:[],strings:[]},imgs:{}};
 const merged=mergePersonalBoard(fresh,layer,'me');
 assert.deepEqual(merged.state.items.map(i=>i.id),['note']);
 assert.deepEqual(merged.state.pins.map(i=>i.id),['mine']);assert.deepEqual(merged.state.strings,[]);
});
