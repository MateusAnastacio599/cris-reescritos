import test from 'node:test';
import assert from 'node:assert/strict';
import {BlockEditor} from '../dist/editor.js';
import {EditorHistory, newBlock} from '../dist/editor-model.js';
import {blocksToMarkdown, parseBlocks, renderReadBlocks} from '../dist/markdown.js';
import {initialState, exportWorkspace, importWorkspace} from '../dist/storage.js';

const legacy = {type:'toggle', title:'Anterior', text:'# exemplo\n\n**Texto literal**', background:'blue'};
const rich = {type:'toggle', title:'Entrada na Mansão', background:'purple', blocks:[
  {type:'h1', text:'O corredor'},
  {type:'paragraph', text:'O chão está **frio**.'},
  {type:'paragraph', text:'*Há passos no andar de cima.*'},
  {type:'paragraph', text:'# exemplo\n<!--cris:color:purple:yellow-->A última porta.<!--/cris:color-->'},
]};
const v2 = value => `<!--cris:toggle:v2 ${JSON.stringify(value)}-->`;

function editingScene(){
  const cue={type:'cue',text:'Passos',triggerId:'steps'};
  const table={type:'table',headers:['Local'],rows:[['Corredor']],align:['left'],text:''};
  const source=[{type:'paragraph',text:'Antes'},rich,{type:'paragraph',text:'Depois'},cue,table,legacy];
  const blocks=structuredClone(source);
  const editor=Object.assign(Object.create(BlockEditor.prototype),{
    blocks,active:1,activeChild:0,history:new EditorHistory(blocks),openToggles:new WeakSet(),
    options:{onChange:markdown=>{editor.saved=markdown;}},render:focus=>{editor.focused=focus;},plainLength:text=>text.length,
  });
  const field=child=>({dataset:{block:'1',child:String(child)},querySelector:()=>null,textContent:'texto',childNodes:[]});
  const select=(target,before,after)=>{editor.selectionParts=()=>({startField:target,endField:target,before,after,collapsed:true});};
  const paste=(target,text)=>editor.paste({target:{closest:()=>target},preventDefault(){},clipboardData:{getData:type=>type==='text/plain'?text:''}});
  return {editor,field,select,paste,source};
}

test('v1 and v2 keep separate versions, literal text, optional backgrounds and child order', () => {
  const blocks = [legacy, rich, {type:'toggle', title:'', blocks:[]},
    {type:'toggle', title:'Separadores', blocks:[{type:'paragraph',text:'A\u2028B\u2029C'}]}];
  const markdown = blocksToMarkdown(blocks);
  assert.match(markdown, /^<!--cris:toggle:v1 /);
  assert.equal((markdown.match(/<!--cris:toggle:v2 /g)??[]).length, 3);
  assert.deepEqual(parseBlocks(markdown), blocks);
  assert.equal(blocksToMarkdown(parseBlocks(markdown)), markdown);
});

test('rich reading renders headings, inline formatting and literal paragraph markers in order', () => {
  const html = renderReadBlocks(parseBlocks(blocksToMarkdown([legacy, rich])));
  assert.ok(html.includes('<p># exemplo</p><p>**Texto literal**</p>'));
  assert.match(html, /data-toggle-background="purple"><summary>Entrada na Mansão<\/summary>/);
  assert.ok(html.includes('<h1>O corredor</h1><p>O chão está <strong>frio</strong>.</p><p><em>Há passos no andar de cima.</em></p>'));
  assert.ok(html.includes('<p># exemplo<br><span data-cris-ink="purple" data-cris-highlight="yellow">A última porta.</span></p>'));
  assert.match(renderReadBlocks([{...rich,blocks:[{type:'h2',text:'Segundo'},{type:'h3',text:'Terceiro'}]}]), /<h2>Segundo<\/h2><h3>Terceiro<\/h3>/);
});

test('unsupported or malformed payloads are retained as a single literal marker', () => {
  const invalid = ['<!--cris:toggle:v2 {"title":-->', v2(null), v2({title:'Sem blocos'}),
    v2({title:'Inválido',blocks:[{type:'paragraph',text:'Válido'}, {type:'cue',text:'Incompatível'}]}),
    v2({title:'Inválido',blocks:[{type:'toggle',title:'Interno',blocks:[]}]}),
    v2({title:'Inválido',blocks:[{type:'paragraph',text:10}]}),
    v2({title:'Futuro',blocks:[{type:'paragraph',text:'A',meta:true}]}),
    v2({title:'Futuro',blocks:[],metadata:{keep:true}})];
  for(const marker of invalid){
    const blocks = parseBlocks(`Antes\n${marker}\nDepois`);
    assert.deepEqual(blocks.map(block=>block.text), ['Antes',marker,'Depois']);
    assert.ok(blocks.every(block=>block.type==='paragraph'));
    assert.equal(blocksToMarkdown(blocks), `Antes\n\n${marker}\n\nDepois`);
  }
  assert.throws(()=>blocksToMarkdown([{...rich,blocks:[{type:'table',text:'A'}]}]), TypeError);
});

test('rich HTML is escaped and only allowlisted background tokens become attributes', () => {
  const payload={title:'<script>alert(1)</script>', background:'" onclick="bad()', blocks:[
    {type:'paragraph',text:'<img src=x onerror=alert(1)> -->'},
    {type:'h1',text:'<svg onload=alert(1)>'},
  ]};
  const blocks=parseBlocks(v2(payload));
  const markdown=blocksToMarkdown(blocks);
  const html=renderReadBlocks(blocks);
  assert.deepEqual(parseBlocks(markdown), blocks);
  assert.equal((markdown.match(/-->/g)??[]).length, 1);
  assert.doesNotMatch(html, /data-toggle-background|<(script|img|svg)\b/);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; --&gt;'));
});

test('scene edits and history keep v2 data and cannot flatten it through the block type control', () => {
  const blocks = parseBlocks(blocksToMarkdown([{type:'paragraph',text:'Antes'},rich]));
  const history = new EditorHistory(blocks);
  blocks[0].text='Alterado';
  history.record(blocks,0);
  assert.equal(history.move(-1).blocks[0].text,'Antes');
  assert.deepEqual(history.move(1).blocks[1],rich);
  BlockEditor.prototype.setType.call({active:1,blocks}, 'paragraph');
  assert.deepEqual(parseBlocks(blocksToMarkdown(blocks)), [{type:'paragraph',text:'Alterado'},rich]);
});

test('creating a rich toggle produces v2 without migrating the existing v1 command', () => {
  const blocks=[newBlock('toggle'),newBlock('richToggle')];
  const markdown=blocksToMarkdown(blocks);
  assert.match(markdown,/^<!--cris:toggle:v1 .*\n\n<!--cris:toggle:v2 /);
  assert.deepEqual(parseBlocks(markdown),blocks);
});

test('child input, Enter, Backspace and history save only the addressed content', () => {
  const {editor,field,select,source}=editingScene();
  const target=field(1);
  target.childNodes=[{nodeType:3,textContent:'Primeira metade e segunda'}];
  target.firstChild=target.childNodes[0];
  editor.syncField(target);
  editor.activeChild=1;
  editor.changed(true);
  select(target,'Primeira metade',' e segunda');
  assert.ok(editor.editChildBoundary(target,'insertParagraph'));
  assert.deepEqual(parseBlocks(editor.saved)[1].blocks.slice(1,3),[
    {type:'paragraph',text:'Primeira metade'},{type:'paragraph',text:' e segunda'},
  ]);
  const next=field(2);
  select(next,'',' e segunda');
  assert.ok(editor.editChildBoundary(next,'deleteContentBackward'));
  const saved=parseBlocks(editor.saved);
  assert.deepEqual(saved.map((block,i)=>i===1?source[i]:block),source);
  assert.deepEqual(saved[1],{...rich,blocks:rich.blocks.map((block,i)=>i===1?{...block,text:'Primeira metade e segunda'}:block)});
  editor.undo(-1);
  assert.equal(parseBlocks(editor.saved)[1].blocks.length,5);
  editor.undo(1);
  assert.deepEqual(parseBlocks(editor.saved),saved);
});

test('paste keeps headings on plain text replacement and rejects special blocks without partial changes', () => {
  const {editor,field,select,paste,source}=editingScene();
  const title=field(0);
  select(title,'','');
  paste(title,'Título reescrito');
  assert.deepEqual(parseBlocks(editor.saved)[1].blocks[0],{type:'h1',text:'Título reescrito'});
  const paragraph=field(1);
  select(paragraph,'Prefácio ',' fim');
  paste(paragraph,'**Primeiro**\n\n## Segundo');
  const saved=parseBlocks(editor.saved);
  assert.deepEqual(saved[1].blocks.slice(1,3),[{type:'paragraph',text:'Prefácio **Primeiro**'},{type:'h2',text:'Segundo fim'}]);
  assert.deepEqual(saved.slice(2),source.slice(2));
  paste(paragraph,'A\n\n[[cue:steps|Passos]]');
  assert.deepEqual(editor.blocks,saved);
});

test('history separates rapid edits in different children of the same toggle', () => {
  const blocks=structuredClone([rich]);
  const history=new EditorHistory(blocks);
  blocks[0].blocks[0].text='Título editado';
  history.record(blocks,0,true,100,0);
  blocks[0].blocks[1].text='Texto editado';
  history.record(blocks,0,true,200,1);
  const state=history.move(-1);
  assert.equal(state.child,0);
  assert.equal(state.blocks[0].blocks[0].text,'Título editado');
  assert.deepEqual(state.blocks[0].blocks[1],rich.blocks[1]);
});

test('workspace backup restores both formats and all rich Markdown in the same scene', async () => {
  const values = new Map();
  globalThis.localStorage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try {
    const workspace=initialState();
    const {editor,field,select,paste}=editingScene();
    const title=field(0);
    select(title,'','');
    paste(title,'Título reescrito para o backup');
    const markdown=editor.saved;
    workspace.campaigns[0].pages[0].scenes[0].markdown=markdown;
    const backup=await exportWorkspace(workspace);
    const restored=await importWorkspace(await backup.text());
    const saved=restored.campaigns[0].pages[0].scenes[0].markdown;
    assert.equal(saved,markdown);
    assert.deepEqual(parseBlocks(saved),editor.blocks);
  } finally {
    delete globalThis.localStorage;
  }
});
