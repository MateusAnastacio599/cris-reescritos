import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultOutput, limitedOutput, readOutput, saveOutput, setMediaOutput} from '../integration-main/media-output.js';

test('volume pessoal preserva mudo, limita amplificação e tolera armazenamento indisponível', () => {
  const values=new Map();
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  assert.equal(readOutput(storage),defaultOutput);
  assert.equal(saveOutput(3,storage),2);
  assert.equal(readOutput(storage),2);
  saveOutput(0,storage);
  assert.equal(readOutput(storage),0);
  assert.equal(readOutput({getItem(){throw Error('bloqueado');}}),defaultOutput);
  const element={};
  setMediaOutput(element,1.75);
  assert.deepEqual(element,{volume:1,muted:false});
  setMediaOutput(element,0);
  assert.deepEqual(element,{volume:0,muted:true});
});

test('efeitos e mídia reutilizam a proteção de picos do contexto', () => {
  const destination={};
  let created=0;
  const context={destination,createDynamicsCompressor(){created++;return {
    threshold:{},knee:{},ratio:{},attack:{},release:{},connect(target){assert.equal(target,destination);}
  };}};
  const limiter=limitedOutput(context);
  assert.equal(limitedOutput(context),limiter);
  assert.equal(limiter.threshold.value,-4);
  assert.equal(created,1);
});
