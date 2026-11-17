import test from 'node:test';
import assert from 'node:assert/strict';
import {preservesMarkdownBlock} from '../dist/editor-inline-format.js';

test('multi-block formatting rejects a change that would expose a literal Markdown block marker',()=>{
  const paragraph={type:'paragraph',text:'**# título literal**'};
  for(const text of ['# título literal','[[cue:steps|Passos]]','texto\n---','A | B\n--- | ---']){
    assert.equal(preservesMarkdownBlock(paragraph,text),false);
  }
  assert.equal(preservesMarkdownBlock(paragraph,'*# título literal*'),true);
});

test('headings, lists and internal links keep their original structure in Markdown',()=>{
  assert.equal(preservesMarkdownBlock({type:'h2'},'**Uma cena**\nAo anoitecer'),true);
  assert.equal(preservesMarkdownBlock({type:'numbered',number:7},'*O relatório*'),true);
  assert.equal(preservesMarkdownBlock({type:'paragraph'},'**Leia** [[page:map|Mapa]]'),true);
});
