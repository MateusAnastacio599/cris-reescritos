import test from 'node:test';
import assert from 'node:assert/strict';
import {playerControlAllowed} from '../integration-main/quadro/board-interactions.js';
import {personalBoardLayer,mergePersonalBoard} from '../integration-main/quadro/board-rules.js';
test('native gameplay transport is allowed while master setup stays denied',()=>{
 const item={type:'cont',kind:'gravador'};
 assert.equal(playerControlAllowed(item,{cb:'rew'}),true);
 for(const control of [{co:'invertido'},{cb:'aud'},{cb:'mic'},{id:'cForce'},{pt:'gm'}])assert.equal(playerControlAllowed(item,control),false);
 assert.equal(playerControlAllowed({type:'img'},{o:'legenda'}),true);
 assert.equal(playerControlAllowed({type:'img',flipped:true},{o:'legenda'}),false);
 assert.equal(playerControlAllowed(item,{id:'pDel'}),false);
 assert.equal(playerControlAllowed(item,{id:'pDel'},true),true);
});
test('native caption survives serialization without replacing changed publication',()=>{
 const base={state:{items:[{id:'photo',type:'img',opts:{legenda:'original'},x:1,y:2}],pins:[],strings:[]},imgs:{}};
 const current=structuredClone(base);current.state.items[0].opts.legenda='anotação';
 const layer=JSON.parse(JSON.stringify(personalBoardLayer(base,current,'player')));
 assert.equal(mergePersonalBoard(base,layer,'player').state.items[0].opts.legenda,'anotação');
 const revised=structuredClone(base);revised.state.items[0].opts.legenda='corrigida pelo mestre';
 assert.equal(mergePersonalBoard(revised,layer,'player').state.items[0].opts.legenda,'corrigida pelo mestre');
 revised.state.items=[];assert.equal(mergePersonalBoard(revised,layer,'player').state.items.length,0);
});
