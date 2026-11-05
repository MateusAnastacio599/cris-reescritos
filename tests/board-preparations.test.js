import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareEvidence,placePreparation,preparationLayout,preparationRuntime} from '../integration-main/quadro/board-preparations.js';
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

test('native objects preserve their contained props, locks, media references and player interactions',()=>{
 const source={state:{items:[
  {id:'case',type:'cont',kind:'maleta',opts:{etiqueta:'Teste'},open:false,x:100,y:100,w:300,w0:300,scale:1,rot:0,z:1},
  {id:'lock',type:'cont',kind:'cadeado',parent:'case',opts:{senha:'042',libera:'phone'},x:110,y:120,w:120,w0:120,scale:1,rot:0,z:2},
  {id:'phone',type:'cont',kind:'smartphone',box:'case',hid:true,opts:{senha:'1998',msgs:'Mensagem da campanha'},imgId:'gallery',x:100,y:100,w:170,w0:170,scale:1,rot:0,z:3},
  {id:'pad',type:'cont',kind:'bloco',box:'case',hid:true,opts:{txt:'Texto preparado'},x:100,y:100,w:220,w0:220,scale:1,rot:0,z:4},
  {id:'unrelated',type:'cont',kind:'cofre',gm:true,opts:{senha:'segredo'},x:800,y:900}
 ],pins:[],strings:[]},imgs:{gallery:'data:image/png;base64,YQ==',hidden:'data:image/png;base64,Yg=='}};
 const prepared=prepareEvidence(source,'case');
 assert.deepEqual(prepared.state.items.map(i=>i.id),['case','lock','phone','pad']);
 assert.deepEqual(Object.keys(prepared.imgs),['gallery']);
 const row={id:'player-pin',attachment:{document_id:'doc'},preparation:prepared,layout:{}};
 const placed=placePreparation(prepared,row,'player',{x:500,y:500});
 const lock=placed.state.items.find(i=>i.crisPart==='lock'),phone=placed.state.items.find(i=>i.crisPart==='phone'),pad=placed.state.items.find(i=>i.crisPart==='pad');
 assert.equal(lock.opts.libera,phone.id);assert.equal(lock.parent,placed.state.items[0].id);
 lock.solved=true;lock.combo=['0','4','2'];phone.solved=true;phone.ci=2;phone.hid=false;pad.rub='data:image/png;base64,Yw==';placed.state.items[0].open=true;
 row.layout={runtime:preparationRuntime(row,placed.state,placed.imgs)};
 assert.deepEqual(row.layout.runtime.images,{});
 const restored=placePreparation(prepared,row,'player',{x:-500,y:-500});
 assert.equal(restored.state.items[0].open,true);
 assert.equal(restored.state.items.find(i=>i.crisPart==='lock').solved,true);
 assert.equal(restored.state.items.find(i=>i.crisPart==='phone').ci,2);
 assert.equal(restored.state.items.find(i=>i.crisPart==='pad').rub,'data:image/png;base64,Yw==');
 assert.equal(restored.state.items[0].x,500);
 assert.equal(source.state.items[0].open,false);
});

test('case-sheet answers and spawned object outputs survive private reload',()=>{
 const prepared={state:{items:[{id:'sheet',type:'cont',kind:'fichacaso',opts:{perguntas:'Pergunta = Resposta'},x:0,y:0,w:300,w0:300,scale:1,rot:0,z:1}],pins:[],strings:[]},imgs:{}};
 const row={id:'p',attachment:{document_id:'doc'},preparation:prepared,layout:{}};
 const board=placePreparation(prepared,row,'player',{x:100,y:100});
 board.state.items[0].ans=['Resposta'];board.state.items[0].solved=true;
 board.state.items.push({id:'generated',type:'note',text:'Resultado do objeto',x:150,y:200,w:200,scale:1,rot:0,z:4,crisOwner:'player',crisEvidence:'p',crisPart:'spawn:generated',parent:board.state.items[0].id});
 row.layout={runtime:preparationRuntime(row,board.state,board.imgs)};
 const restored=placePreparation(prepared,row,'player',{x:0,y:0});
 assert.equal(restored.state.items.length,2);assert.equal(restored.state.items[0].solved,true);assert.deepEqual(restored.state.items[0].ans,['Resposta']);
 assert.equal(restored.state.items[1].parent,restored.state.items[0].id);assert.equal(restored.state.items[1].crisOwner,'player');
 assert.equal(restored.state.items[1].text,'Resultado do objeto');
});

test('recorder preparations retain cassette and both active/previous audio references',()=>{
 const snapshot={state:{items:[
  {id:'recorder',type:'cont',kind:'gravador',tapeId:'cassette',audioId:'tape-audio',prevAudio:'device-audio',opts:{label:'Gravador de teste'},x:0,y:0,w:320,w0:320,rot:0,scale:1,z:1},
  {id:'cassette',type:'cont',kind:'fita',inside:'recorder',audioId:'tape-audio',opts:{label:'Fita de teste'},x:0,y:0,w:170,w0:170,rot:0,scale:1,z:2},
  {id:'unrelated',type:'cont',kind:'radio',audioId:'private-audio'}
 ],pins:[],strings:[]},imgs:{'tape-audio':'data:audio/wav;base64,YQ==','device-audio':'data:audio/wav;base64,Yg==','private-audio':'data:audio/wav;base64,Yw=='}};
 const prepared=prepareEvidence(snapshot,'recorder');
 assert.deepEqual(prepared.state.items.map(item=>item.id),['recorder','cassette']);
 assert.deepEqual(Object.keys(prepared.imgs).sort(),['device-audio','tape-audio']);
 const placed=placePreparation(prepared,{id:'own-pin',attachment:{document_id:'doc'},layout:{}},'player',{x:100,y:100});
 assert.equal(placed.state.items[0].tapeId,placed.state.items[1].id);
 assert.equal(placed.state.items[1].inside,placed.state.items[0].id);
 assert.equal(placed.imgs[placed.state.items[0].prevAudio],snapshot.imgs['device-audio']);
 assert.equal(placed.imgs[placed.state.items[1].audioId],snapshot.imgs['tape-audio']);
});
