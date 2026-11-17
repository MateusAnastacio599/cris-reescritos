import test from 'node:test';
import assert from 'node:assert/strict';
import {scriptDisplay} from '../dist/script-display.js';
import {initialState,validateState,exportWorkspace,importWorkspace,STORAGE_KEY} from '../dist/storage.js';
import {blocksToMarkdown} from '../dist/markdown.js';

test('script display defaults to wide with a 100% scale for older workspaces',()=>{
  const state=initialState();
  delete state.ui.scriptWidth;
  delete state.ui.scriptFontSize;
  const original=state.ui.sceneId;
  validateState(state);
  assert.deepEqual(scriptDisplay(state.ui),{scriptWidth:'wide',scriptFontSize:100});
  assert.equal(state.ui.sceneId,original);
});

test('script display clamps and rounds percentages and rejects invalid preferences',()=>{
  assert.deepEqual(scriptDisplay({scriptWidth:'comfortable',scriptFontSize:113}),{scriptWidth:'comfortable',scriptFontSize:115});
  assert.equal(scriptDisplay({scriptFontSize:71}).scriptFontSize,85);
  assert.equal(scriptDisplay({scriptFontSize:152}).scriptFontSize,135);
  assert.deepEqual(scriptDisplay({scriptWidth:'broken',scriptFontSize:'110'}),{scriptWidth:'wide',scriptFontSize:100});
});

test('workspace export/import preserves script preferences separately from the scene Markdown',async()=>{
  const state=initialState(),scene=state.campaigns[0].pages[0].scenes[0];
  scene.markdown=blocksToMarkdown([
    {type:'h1',text:'A chegada'},
    {type:'columns',columns:[{width:50,background:'purple',blocks:[{type:'paragraph',text:'**Uma pista**'}]},{width:50,blocks:[]}]},
  ]);
  Object.assign(state.ui,scriptDisplay({scriptWidth:'comfortable',scriptFontSize:125}));
  const previous=globalThis.localStorage;
  const data=new Map();
  globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  try{
    const backup=await exportWorkspace(state);
    const restored=await importWorkspace(await backup.text());
    assert.deepEqual(scriptDisplay(restored.ui),{scriptWidth:'comfortable',scriptFontSize:125});
    assert.equal(restored.campaigns[0].pages[0].scenes[0].markdown,scene.markdown);
    assert.equal(JSON.parse(data.get(STORAGE_KEY)).campaigns[0].pages[0].scenes[0].markdown,scene.markdown);
  }finally{
    if(previous===undefined)delete globalThis.localStorage;
    else globalThis.localStorage=previous;
  }
});
