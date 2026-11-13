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

test('workspace backup preserves title and paragraphs of a toggle', async () => {
  const values = new Map();
  globalThis.localStorage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try {
    const workspace = initialState();
    workspace.campaigns[0].pages[0].scenes[0].markdown = blocksToMarkdown([toggle]);
    const backup = await exportWorkspace(workspace);
    const restored = await importWorkspace(await backup.text());
    assert.deepEqual(parseBlocks(restored.campaigns[0].pages[0].scenes[0].markdown), [toggle]);
  } finally {
    delete globalThis.localStorage;
  }
});
