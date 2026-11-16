import test from 'node:test';
import assert from 'node:assert/strict';
import {textRunMarkup,replaceTextBlocks,pasteTextBlocks} from '../dist/editor-text-runs.js';
import {readClipboardBlocks} from '../dist/editor-clipboard.js';
import {EditorHistory} from '../dist/editor-model.js';
import {blocksToMarkdown,parseBlocks} from '../dist/markdown.js';
import {initialState,exportWorkspace,importWorkspace} from '../dist/storage.js';

const build = () => [
  {type:'h1',text:'**Entrada** na mansão'},
  {type:'paragraph',text:'Primeira pista'},
  {type:'numbered',number:3,text:'**Terceiro** item'},
  {type:'table',text:'',headers:['Pista'],rows:[['Chave']],align:['left']},
  {type:'cue',triggerId:'steps',text:'Passos'},
  {type:'clue',campaignId:'camp',itemId:'id',action:'reveal',text:'Carta'},
  {type:'toggle',title:'Notas',text:'**literal**'},
  {type:'toggle',title:'Entrada',background:'purple',blocks:[{type:'h3',text:'Antes'},{type:'paragraph',text:'*Depois*'}]},
  {type:'paragraph',text:'Após os blocos especiais'},
];
const parts={start:0,end:2,before:'**Entrada** ',after:' item'};

test('only contiguous text shares an editing host',()=>{
  const blocks=build();
  const markup=blocks.map((_,index)=>textRunMarkup(blocks,index,`[${index}]`)).join('');
  assert.match(markup,/>\[0\]\[1\]\[2\]<\/div>\[3\]\[4\]\[5\]\[6\]\[7\]/);
  assert.equal((markup.match(/contenteditable="true"/g)??[]).length,2);
});

test('typing and deletion replace a range atomically and protect every special block',()=>{
  const blocks=build(),before=structuredClone(blocks);
  for(let end=3;end<blocks.length;end++)assert.equal(replaceTextBlocks(blocks,{...parts,end},'X'),null);
  assert.deepEqual(blocks,before);
  const focus=replaceTextBlocks(blocks,parts,'Nova');
  assert.deepEqual(focus,{index:0,prefix:'**Entrada** Nova'});
  assert.deepEqual(blocks,[{type:'h1',text:'**Entrada** Nova item'},...before.slice(3)]);
  const erased=build();
  replaceTextBlocks(erased,{...parts,before:''});
  assert.deepEqual(erased[0],{type:'numbered',number:3,text:' item'});
});

test('paste keeps structure, formatted endpoints, undo and redo bookmarks',()=>{
  const blocks=build(),initial=structuredClone(blocks),history=new EditorHistory(blocks);
  const bookmark={start:0,end:2,startOffset:8,endOffset:9};
  history.remember(bookmark);
  const pasted=[{type:'h2',text:'*Título*'},{type:'list',text:'**Item**'},{type:'paragraph',text:'Conclusão'}];
  const focus=pasteTextBlocks(blocks,parts,pasted);
  assert.deepEqual(focus,{index:3,prefix:'Conclusão',special:false});
  assert.deepEqual(blocks.slice(0,5),[
    {type:'h1',text:'**Entrada** '},...pasted,{type:'numbered',number:3,text:' item'},
  ]);
  assert.deepEqual(blocks.slice(5),initial.slice(3));
  history.record(blocks,focus.index);
  assert.deepEqual(history.move(-1).bookmark,bookmark);
  assert.deepEqual(history.move(1).blocks,blocks);
});

test('CRIS clipboard preserves formatted text blocks, rejects special blocks from the custom format',()=>{
  const structured=JSON.stringify(build().slice(0,3));
  assert.deepEqual(readClipboardBlocks({getData:type=>type.endsWith('+json')?structured:''}),build().slice(0,3));
  assert.deepEqual(readClipboardBlocks({getData:type=>type.endsWith('+json')?'[{"type":"toggle","text":"A"}]':type==='text/plain'?'Texto':''}),[{type:'paragraph',text:'Texto'}]);
});

test('structured edits survive serialization and workspace export without changing protected content',async()=>{
  const initial=build(),blocks=structuredClone(initial);
  replaceTextBlocks(blocks,parts,'**Teste**');
  const values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try{
    const workspace=initialState(),markdown=blocksToMarkdown(blocks);
    workspace.campaigns[0].pages[0].scenes[0].markdown=markdown;
    const backup=await exportWorkspace(workspace);
    const restored=await importWorkspace(await backup.text());
    const reopened=parseBlocks(restored.campaigns[0].pages[0].scenes[0].markdown);
    assert.deepEqual(reopened,blocks);
    assert.deepEqual(reopened.slice(1),initial.slice(3));
  }finally{delete globalThis.localStorage;}
});
