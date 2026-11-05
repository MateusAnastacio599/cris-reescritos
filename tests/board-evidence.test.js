import test from 'node:test';
import assert from 'node:assert/strict';
import {BoardEvidence} from '../integration-main/quadro/board-evidence.js';

test('archive pin preserves the original bytes and saves placement rather than image data', async () => {
  const original = new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'});
  const requests = [];
  const api = {
    original: async source => {
      assert.equal(source.object_path,'campaign/photo');
      return original;
    },
    client: {from: table => {
      assert.equal(table,'case_evidence_pins');
      const query = {
        eq: () => query,
        then: resolve => resolve({data:null,error:null})
      };
      return {
        update: fields => { requests.push(['update',fields]); return query; },
        delete: () => { requests.push(['delete']); return query; }
      };
    }}
  };
  const source = {id:'photo',document_id:'report',title:'FOT-001',mime:'image/png',object_path:'campaign/photo'};
  const evidence = new BoardEvidence(api,'board','player',[{id:'pin-id',attachment:source,layout:{}}]);
  const board = {state:{items:[],pins:[{id:'published-pin'}],strings:[]},imgs:{}};
  await evidence.insertInto(board,{x:400,y:400});
  const [item] = board.state.items;
  assert.equal(item.crisOwner,'player');
  assert.equal(item.crisDocument,'report');
  assert.deepEqual(await (await fetch(board.imgs[item.imgId])).arrayBuffer(),await original.arrayBuffer());
  await evidence.save(board.state);
  assert.equal(requests.length,0);
  item.x = 830;
  item.scale = 2;
  board.state.strings.push({id:'wire',a:'evidence-pin-pin-id',b:'published-pin',color:'#123456',slack:1.1});
  await evidence.save(board.state);
  assert.equal(requests[0][1].layout.pose.x,830);
  assert.equal(requests[0][1].layout.pose.scale,2);
  assert.equal(requests[0][1].layout.links[0].id,'wire');
  assert.equal(JSON.stringify(requests).includes('blob:'),false);
  board.state.items = [];
  await evidence.save(board.state);
  await evidence.save(board.state);
  assert.deepEqual(requests.map(([kind]) => kind),['update','delete']);
  evidence.release();
});
