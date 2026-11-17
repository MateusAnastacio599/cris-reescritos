import test from 'node:test';
import assert from 'node:assert/strict';
import {newColumns,addColumn,removeColumn,moveColumnBlock,resizedWidths} from '../dist/editor-columns-model.js';
import {blocksToMarkdown,parseBlocks,renderReadBlocks} from '../dist/markdown.js';
import {EditorHistory} from '../dist/editor-model.js';
import {editableColumnsHTML} from '../dist/editor-columns.js';
import {initialState,exportWorkspace,importWorkspace} from '../dist/storage.js';

const rich={type:'toggle',title:'Segredo',background:'purple',blocks:[
  {type:'h2',text:'Título'},{type:'paragraph',text:'**Primeiro**'},{type:'paragraph',text:'Segundo'},
]};
const build=()=>({type:'columns',columns:[
  {width:35,background:'blue',blocks:[{type:'h2',text:'Mansão'},rich,{type:'paragraph',text:'# texto literal\n  quebra'}]},
  {width:65,blocks:[{type:'h3',text:'Notas'},{type:'note',text:'Anotação'}, {type:'numbered',number:3,text:'Item'},
    {type:'toggle',title:'V1',text:'<!-- tentativa -->'}, {type:'table',text:'',headers:['Pista'],rows:[['Chave']],align:['left']},
    {type:'cue',text:'Passos',triggerId:'steps'}]},
]});

test('versioned columns preserve block types, widths, color and content without migrating old blocks',()=>{
  const source=[{type:'paragraph',text:'Antes'},build(),{type:'paragraph',text:'Depois'}];
  const markdown=blocksToMarkdown(source);
  assert.equal((markdown.match(/<!--cris:columns:v1 /g)??[]).length,1);
  assert.equal((markdown.match(/-->/g)??[]).length,1);
  assert.deepEqual(parseBlocks(markdown),source);
  assert.equal(blocksToMarkdown(parseBlocks(markdown)),markdown);
  const html=renderReadBlocks(source);
  assert.match(html,/minmax\(0, 35fr\) minmax\(0, 65fr\)/);
  assert.match(html,/aria-label="Coluna 1" data-toggle-background="blue"/);
  assert.match(html,/data-toggle-background="purple"/);
  assert.match(html,/data-inline-cue="steps"/);
  assert.match(html,/<table/);
  const editable=editableColumnsHTML(build(),2);
  assert.match(editable,/data-column-editor="0".*data-column-divider="0".*data-column-editor="1"/s);
  assert.match(editable,/data-column-slider="0"/);
});

test('a malformed or disallowed column layout is preserved as recoverable text',()=>{
  const invalid=[['columns',build()],['clue',{type:'clue',text:'X'}],['todo',{type:'todo',text:'X',checked:true}]];
  const markers=invalid.map(([,block])=>{
    const document=build();document.columns[0].blocks.push(block);
    assert.throws(()=>blocksToMarkdown([document]),TypeError);
    return `<!--cris:columns:v1 ${JSON.stringify({columns:document.columns})}-->`;
  });
  const document=build();document.columns[0].width=83;
  markers.push(`<!--cris:columns:v1 ${JSON.stringify({columns:document.columns})}-->`);
  document.columns[0].width=35;document.columns[0].background='url(x)';
  markers.push(`<!--cris:columns:v1 ${JSON.stringify({columns:document.columns})}-->`, '<!--cris:columns:v1 ?-->');
  for(const marker of markers){
    assert.deepEqual(parseBlocks(marker),[{type:'paragraph',text:marker}]);
    assert.equal(blocksToMarkdown(parseBlocks(marker)),marker);
  }
  const valid=build();
  valid.columns[0].blocks[0].text='<img src=x onerror=alert(1)>';
  assert.match(renderReadBlocks(parseBlocks(blocksToMarkdown([valid]))),/&lt;img/);
  assert.doesNotMatch(renderReadBlocks([valid]),/<img\b/);
});

test('move, resize, add and remove preserve every child in reading order',()=>{
  const {columns}=structuredClone(build());
  const [left,right]=columns;
  assert.deepEqual(newColumns(3).columns.map(column=>column.width),[33,33,34]);
  assert.equal(addColumn(columns),true);
  assert.equal(addColumn(columns),false);
  assert.equal(columns.reduce((sum,c)=>sum+c.width,0),100);
  assert.ok(columns.every(column=>column.width>=20));
  assert.deepEqual(resizedWidths(columns,0,-800),[20,48,32]);
  assert.deepEqual(resizedWidths(columns,1,999),[35,45,20]);
  assert.equal(moveColumnBlock(columns,0,1,2),0);
  assert.deepEqual(columns[2].blocks,[rich]);
  assert.deepEqual(removeColumn(columns,0),{column:0,block:0});
  assert.deepEqual(columns[0].blocks,[...left.blocks,...build().columns[1].blocks]);
  assert.equal(columns[0].blocks,right.blocks);
  assert.deepEqual(columns[1].blocks,[rich]);
  assert.equal(removeColumn(columns,0),null);
  assert.equal(moveColumnBlock(columns,0,500,1),null);
});

test('typing in separate columns has independent history and a complete backup round-trip',async()=>{
  const layout=structuredClone(build()),blocks=[layout],history=new EditorHistory(blocks);
  layout.columns[0].blocks[0].text='Editado A';
  history.record(blocks,0,true,100,null,{layout:0,column:0,block:0});
  layout.columns[1].blocks[0].text='Editado B';
  history.record(blocks,0,true,200,null,{layout:0,column:1,block:0});
  const previous=history.move(-1);
  assert.equal(previous.scope.column,0);
  assert.equal(previous.blocks[0].columns[1].blocks[0].text,'Notas');
  assert.deepEqual(history.move(1).blocks,blocks);
  const values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try{
    const workspace=initialState();
    workspace.campaigns[0].pages[0].scenes[0].markdown=blocksToMarkdown(blocks);
    const backup=await exportWorkspace(workspace);
    const restored=await importWorkspace(await backup.text());
    assert.deepEqual(parseBlocks(restored.campaigns[0].pages[0].scenes[0].markdown),blocks);
  }finally{delete globalThis.localStorage;}
});

test('a column drop inserts at the specified slot and reorders without duplication',()=>{
  const {columns}=structuredClone(build());
  const [left,right]=columns;
  const block=left.blocks[1];
  assert.equal(moveColumnBlock(columns,0,1,1,1),1);
  assert.equal(right.blocks[1],block);
  assert.equal(moveColumnBlock(columns,1,1,1,4),3);
  assert.equal(right.blocks[3],block);
  assert.equal(right.blocks.filter(value=>value===block).length,1);
  assert.deepEqual(parseBlocks(blocksToMarkdown([{type:'columns',columns}]))[0].columns,columns);
});

test('an invalid column slot, no-op and incompatible block leave the model untouched',()=>{
  const {columns}=structuredClone(build());
  columns[0].blocks.push({type:'clue',text:'Restrito'});
  const before=structuredClone(columns);
  for(const args of [[0,0,0,1],[0,0,1,-1],[0,0,1,999],[0,0,1,0.5],[0,0,2,0],[0,3,1,0]]){
    assert.equal(moveColumnBlock(columns,...args),null);
    assert.deepEqual(columns,before);
  }
});

test('column actions share a closed disclosure while the writing surfaces remain visible',()=>{
  const layout=newColumns(3);
  layout.columns[0].background='purple';
  const html=editableColumnsHTML(layout,0);
  assert.match(html,/<details class="script-columns-options">/);
  assert.match(html,/<details[^>]*>.*data-column-background="0".*data-remove-column="0".*data-column-slider="0".*data-unpack-columns.*<\/details>\s*<div class="script-column-grid"/s);
  assert.match(html,/<section class="script-column" aria-label="Coluna 1" data-toggle-background="purple">/);
  assert.equal(layout.columns.every(column=>column.blocks.length===0),true);
});
