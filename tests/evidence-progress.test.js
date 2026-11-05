import test from 'node:test';
import assert from 'node:assert/strict';
import {EvidenceProgress} from '../integration-main/quadro/evidence-progress.js';

test('large rubbing state uses private immutable assets, preserving original bytes and compact layout',async()=>{
 const stored=new Map(),writes=[];
 const client={from:table=>{assert.equal(table,'case_evidence_progress_assets');const filters={};const query={
  insert:async value=>{stored.set(value.pin_id+value.hash,value);writes.push(value);return {error:null};},
  select:()=>query,eq:(key,value)=>{filters[key]=value;return query;},single:async()=>({data:stored.get(filters.pin_id+filters.hash),error:null})
 };return query;}};
 const data='data:image/png;base64,'+Buffer.alloc(100000,77).toString('base64');
 const progress=new EvidenceProgress(client);
 const packed=await progress.pack({runtime:{rub:data}},'pin');
 assert.ok(JSON.stringify(packed).length<500);assert.equal(writes.length,1);
 assert.equal(writes[0].payload,data);
 assert.equal(JSON.stringify(packed).includes('base64'),false);
 const restored=await new EvidenceProgress(client).unpack(packed,'pin');assert.equal(restored.runtime.rub,data);
 await progress.pack({runtime:{rub:data}},'pin');assert.equal(writes.length,1);
 await progress.pack({runtime:{rub:data}},'other-pin');assert.equal(writes.length,2);
 await assert.rejects(new EvidenceProgress(client).unpack(packed,'other-pin'),/inválido/);
 await assert.rejects(progress.pack({image:'blob:temporary'},'pin'),/temporária/);
});
