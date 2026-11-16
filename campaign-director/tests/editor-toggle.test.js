import test from 'node:test';
import assert from 'node:assert/strict';
import {newBlock} from '../dist/editor-model.js';
import {parseBlocks,blocksToMarkdown,renderReadBlocks} from '../dist/markdown.js';
import {initialState,exportWorkspace,importWorkspace} from '../dist/storage.js';

const toggle = {...newBlock('toggle'), title:'Cena — <b>Segredo</b>', text:'Primeiro parágrafo.\n\n# Texto literal | -->\n<!--cris:toggle:v1 {}-->'};

test('toggle round-trips as plain text alongside legacy blocks', () => {
  const ordinary = parseBlocks('# Cena\n\n- Pista\n\nTexto <!--cris:toggle:v1 {}-->\n\n<!--cris:toggle:v1 {}-->');
  const blocks = [...ordinary, toggle, newBlock('toggle')];
  assert.deepEqual(parseBlocks(blocksToMarkdown(blocks)), blocks);
  assert.ok(ordinary.every(block => block.type !== 'toggle'));
  const html = renderReadBlocks([toggle]);
  assert.equal((html.match(/<details /g) ?? []).length, 1);
  assert.ok(html.includes('<summary>Cena — &lt;b&gt;Segredo&lt;/b&gt;</summary>'));
  assert.ok(html.includes('</p><p># Texto literal'));
});

test('toggle backgrounds extend the v1 marker and render on the whole disclosure', () => {
  const legacy = '<!--cris:toggle:v1 {"title":"Segredo","text":"Primeira linha"}-->';
  const [block] = parseBlocks(legacy);
  assert.equal(blocksToMarkdown([block]), legacy);
  assert.doesNotMatch(renderReadBlocks([block]), /data-toggle-background/);

  for (const background of ['red', 'yellow', 'green', 'blue', 'purple']) {
    const colored = {...block, background};
    const markdown = blocksToMarkdown([colored]);
    assert.ok(markdown.startsWith('<!--cris:toggle:v1 '));
    assert.deepEqual(parseBlocks(markdown), [colored]);
    assert.match(renderReadBlocks([colored]), new RegExp(`^<details class="script-toggle" data-toggle-background="${background}"><summary>Segredo`));
  }
});

test('unset or invalid backgrounds cannot introduce attributes or change legacy text', () => {
  for (const background of ['none', '" onclick="bad()', 'Purple', {color:'red'}]) {
    const input = {...toggle, background};
    const markdown = `<!--cris:toggle:v1 ${JSON.stringify({title:'Segredo',text:'Texto',background})}-->`;
    assert.deepEqual(parseBlocks(markdown), [{type:'toggle',title:'Segredo',text:'Texto'}]);
    assert.equal(blocksToMarkdown([input]), blocksToMarkdown([toggle]));
    assert.doesNotMatch(renderReadBlocks([input]), /data-toggle-background|onclick/);
  }
});

test('workspace backup preserves the title, paragraphs and background of a toggle', async () => {
  const values = new Map();
  globalThis.localStorage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try {
    const workspace = initialState();
    const colored = {...toggle, background:'purple'};
    workspace.campaigns[0].pages[0].scenes[0].markdown = blocksToMarkdown([colored]);
    const backup = await exportWorkspace(workspace);
    const restored = await importWorkspace(await backup.text());
    assert.deepEqual(parseBlocks(restored.campaigns[0].pages[0].scenes[0].markdown), [colored]);
  } finally {
    delete globalThis.localStorage;
  }
});
