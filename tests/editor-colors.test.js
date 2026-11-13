import test from 'node:test';
import assert from 'node:assert/strict';
import {blocksToMarkdown, editableToMarkdown, inlineHTML, parseBlocks, renderReadBlocks} from '../dist/markdown.js';
import {exportWorkspace, importWorkspace, initialState} from '../dist/storage.js';

const text = '<!--cris:color:red:none-->**Pista**<!--/cris:color--> e <!--cris:color:none:yellow-->[[page:arquivo|Arquivo]]<!--/cris:color-->';
const pages = [{id:'arquivo', title:'Arquivo'}];

test('renders allowlisted colors alongside formatting and links', () => {
  const html = inlineHTML(text, pages, true);
  assert.match(html, /data-cris-ink="red"[^>]*><strong>Pista<\/strong><\/span>/);
  assert.match(html, /data-cris-highlight="yellow"[^>]*><span class="wiki-token"/);
  assert.match(renderReadBlocks(parseBlocks('# '+text), pages), /<h1>.*data-page-link="arquivo".*<\/h1>/);
  assert.match(inlineHTML('<!--cris:color:red:none-->aberto'), /^&lt;!--/);
  assert.match(inlineHTML('<!--cris:color:invalid:none--><img src=x><!--\/cris:color--><span style="color:red">x</span>'), /^&lt;!--.*&lt;img.*&lt;span/);
  assert.equal(inlineHTML('**Texto antigo**'), '<strong>Texto antigo</strong>');
});

test('serializes approved formatting from editable text', () => {
  const element = (tagName, childNodes, dataset) => ({nodeType:1,tagName,childNodes,dataset});
  const word = {nodeType:3,textContent:'Pista'};
  const span = element('SPAN', [element('STRONG', [word])], {crisInk:'red',crisHighlight:'yellow'});
  assert.equal(editableToMarkdown(element('DIV', [span])), '<!--cris:color:red:yellow-->**Pista**<!--/cris:color-->');
});

test('preserves colored title and paragraph through workspace backup', async () => {
  const workspace = initialState();
  const markdown = '# '+text+'\n\n'+text;
  workspace.campaigns[0].pages[0].scenes[0].markdown = markdown;
  const values = new Map();
  globalThis.localStorage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try {
    const backup = await exportWorkspace(workspace);
    const restored = await importWorkspace(await backup.text());
    assert.equal(blocksToMarkdown(parseBlocks(restored.campaigns[0].pages[0].scenes[0].markdown)), markdown);
  } finally {
    delete globalThis.localStorage;
  }
});
