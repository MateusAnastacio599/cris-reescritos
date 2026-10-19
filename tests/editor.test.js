import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBlocks,blocksToMarkdown,inlineHTML,renderReadBlocks,editableToMarkdown} from '../dist/markdown.js';
import {updatedScenes,applySceneTextUpdate,SCENE_TEXT_REVISION} from '../dist/scene-updates.js';
import {splitBlocks,newBlock,EditorHistory} from '../dist/editor-model.js';
import {clipboardBlocks} from '../dist/editor-clipboard.js';
import {filterAudioAssets} from '../dist/audio-search.js';
import {optionDetails} from '../dist/search-select.js';

const roundtrip=blocks=>parseBlocks(blocksToMarkdown(blocks));
test('os três roteiros atualizados mantêm toda a estrutura ao editar e salvar',()=>{
  for(const text of Object.values(updatedScenes)){const blocks=parseBlocks(text);assert.deepEqual(roundtrip(blocks),blocks);}
  const quarto=parseBlocks(updatedScenes.quarto),corredor=parseBlocks(updatedScenes.corredor);assert.equal(quarto.filter(b=>b.type==='table').length,2);assert.equal(corredor.filter(b=>b.type==='table').length,1);assert.equal(corredor.find(b=>b.type==='table').rows[2][1],'10');assert.ok(updatedScenes.escritorio.endsWith('Íris. Você abre os olhos.'));
});
test('tabelas guardam pipes escapados, links internos, alinhamento e quebras de linha',()=>{
  const table={type:'table',text:'',headers:['Perícia','DT','Informação'],rows:[['Percepção','6','Uma pista | outra\n[[page:arquivo|Ver arquivo]]']],align:['left','center','right']};assert.deepEqual(roundtrip([table]),[table]);const html=renderReadBlocks([table],[{id:'arquivo',title:'Arquivo'}]);assert.ok(html.includes('<table'));assert.ok(html.includes('data-page-link="arquivo"'));assert.ok(html.includes('text-align:center'));assert.ok(html.includes('<br>'));
});
test('tabela reduzida a uma coluna continua editável depois de recarregar',()=>{
  const table={type:'table',text:'',headers:['Pistas'],rows:[['Chuva'],['Areia']],align:['left']};assert.deepEqual(roundtrip([table]),[table]);
});
test('negrito com itálico gera marcação bem aninhada e não executa HTML',()=>{
  assert.equal(inlineHTML('***SOM DA FECHADURA***'),'<strong><em>SOM DA FECHADURA</em></strong>');assert.equal(inlineHTML('`**literal**`'),'<code>**literal**</code>');const html=inlineHTML('**<script>alert(1)</script>**');assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
test('Shift+Enter, listas e blocos vazios sobrevivem à serialização',()=>{
  const blocks=[{type:'h2',text:'Uma linha\nOutra linha'},{type:'paragraph',text:''},{type:'paragraph',text:'Sangue.\nAreia.\nAmarelo.'},{type:'list',text:'Primeira\nContinuação'},{type:'todo',text:'',checked:false},{type:'cue',text:'',triggerId:'bell'}];assert.deepEqual(roundtrip(blocks),blocks);assert.ok(renderReadBlocks(blocks).includes('Sangue.<br>Areia.<br>Amarelo.'));
});
test('Enter divide no cursor, preserva o texto seguinte e sai de uma lista vazia',()=>{
  const blocks=[{type:'h1',text:'**Antes depois**'}];const focus=splitBlocks(blocks,0,0,'**Antes**','**depois**');assert.deepEqual(blocks,[{type:'h1',text:'**Antes**'},{type:'paragraph',text:'**depois**'}]);assert.equal(focus.index,1);
  const list=[{type:'list',text:''}];splitBlocks(list,0,0,'','');assert.deepEqual(list,[{type:'paragraph',text:''}]);
});
test('Enter sobre seleção entre blocos retém os dois lados e a numeração',()=>{
  const blocks=[{type:'numbered',number:3,text:'Primeira'},{type:'paragraph',text:'Selecionada'},{type:'paragraph',text:'Última'}];splitBlocks(blocks,0,2,'Prime','tima');assert.equal(blocks.length,2);assert.equal(blocks[0].text,'Prime');assert.equal(blocks[1].text,'tima');assert.equal(blocks[1].number,4);
});
test('desfazer e refazer restauram estrutura, tabelas e texto sem compartilhar referências',()=>{
  const blocks=[{type:'paragraph',text:''}],history=new EditorHistory(blocks);blocks[0].text='a';history.record(blocks,0,true,1000);blocks[0].text='abc';history.record(blocks,0,true,1100);blocks.push(newBlock('table'));history.record(blocks,1,false,1200);
  assert.equal(history.move(-1).blocks.length,1);assert.equal(history.move(-1).blocks[0].text,'');assert.equal(history.move(1).blocks[0].text,'abc');const restored=history.move(1);assert.equal(restored.blocks[1].type,'table');restored.blocks[1].headers[0]='Alterada';assert.equal(history.entries.at(-1).blocks[1].headers[0],'Perícia');
});
test('colagem de planilha vira tabela, colagem Markdown mantém títulos e listas',()=>{
  const table=clipboardBlocks({text:'Perícia\tDT\tInformação\nPercepção\t8\tAreia dourada'})[0];assert.equal(table.type,'table');assert.equal(table.rows[0][2],'Areia dourada');assert.deepEqual(clipboardBlocks({text:'# Título\n\n- Uma pista\n- Outra pista'}).map(b=>b.type),['h1','list','list']);
});
test('conversão do DOM mantém formatação e quebras sem depender de HTML externo',()=>{
  const txt=text=>({nodeType:3,textContent:text}),el=(tag,...children)=>({nodeType:1,tagName:tag,childNodes:children,dataset:{}});const fake={childNodes:[el('STRONG',el('EM',txt('Narrar'))),el('BR'),txt('Outra linha')]};assert.equal(editableToMarkdown(fake),'***Narrar***\nOutra linha');
});
test('busca encontra áudios por palavras, tags, arquivo e tipo sem depender de acentos',()=>{
  const assets=[{id:'1',name:'Chuva na janela',kind:'ambience',provider:'upload',tags:'Casa São Martinho',filename:'rain.wav'},{id:'2',name:'Jazz Paris',kind:'music',provider:'youtube',tags:'Café'},{id:'3',name:'Fechadura',kind:'sfx',provider:'upload',tags:'Porta'}];assert.deepEqual(filterAudioAssets(assets,'sao chuva').map(a=>a.id),['1']);assert.deepEqual(filterAudioAssets(assets,'cafe','music').map(a=>a.id),['2']);assert.deepEqual(filterAudioAssets(assets,'rain').map(a=>a.id),['1']);assert.deepEqual(filterAudioAssets(assets,'','sfx').map(a=>a.id),['3']);assert.equal(filterAudioAssets(assets,'jazz','files').length,0);
});
test('busca dos seletores usa metadados do áudio e identifica playlists',()=>{
  const state={audioAssets:[{id:'audio',name:'Chuva',kind:'ambience',provider:'upload',tags:'Casa',filename:'rain.wav'}],playlists:[{id:'list',name:'Conversas',assetIds:['audio']}]};const item=optionDetails({value:'asset:audio',textContent:'Chuva',disabled:false},state);assert.equal(item.group,'Arquivos');assert.ok(item.terms.includes('rain.wav'));assert.equal(optionDetails({value:'playlist:list',textContent:'Conversas'},state).detail,'1 faixas');
});
test('atualização dos roteiros é única e deixa intactas cenas e campanhas fora do alvo',()=>{
  const scene={id:'quarto',markdown:'Texto anterior',layers:[{assetId:'meu-audio'}],music:{playlistId:'minha-lista'}},other={id:'outra-cena',markdown:'Texto meu'};const state={campaigns:[{id:'reescritos',pages:[{id:'sao-martinho',scenes:[scene,other]}]},{id:'minha-campanha',pages:[]}],audioAssets:[{id:'meu-audio'}]};assert.equal(applySceneTextUpdate(state),true);assert.equal(scene.markdown,updatedScenes.quarto);assert.equal(scene.textHistory[0].markdown,'Texto anterior');assert.equal(scene.layers[0].assetId,'meu-audio');assert.equal(scene.music.playlistId,'minha-lista');assert.equal(other.markdown,'Texto meu');scene.markdown='Editei depois';assert.equal(applySceneTextUpdate(state),false);assert.equal(scene.markdown,'Editei depois');assert.equal(state.sceneTextRevision,SCENE_TEXT_REVISION);
});
test('colagem HTML conserva títulos, ênfase, listas e tabelas e ignora elementos ativos',()=>{
  const previous=globalThis.DOMParser,txt=text=>({nodeType:3,textContent:text}),el=(tag,...children)=>({nodeType:1,tagName:tag,childNodes:children,children:children.filter(c=>c.nodeType===1),style:{}});
  const table=el('TABLE');table.rows=[{cells:[el('TH',txt('Perícia')),el('TH',txt('DT'))]},{cells:[el('TD',txt('Percepção')),el('TD',txt('8'))]}];const body=el('BODY',el('H1',txt('CASA SÃO MARTINHO')),el('P',el('STRONG',txt('Pausa.')),txt(' '),el('EM',txt('O que você faz?'))),el('UL',el('LI',txt('Areia dourada'))),table,el('SCRIPT',txt('malicioso()')),el('IFRAME'));
  globalThis.DOMParser=class{parseFromString(_html,type){assert.equal(type,'text/html');return {body};}};
  try{const blocks=clipboardBlocks({html:'<html>colar do Notion</html>'});assert.deepEqual(blocks.map(b=>b.type),['h1','paragraph','list','table']);assert.equal(blocks[1].text,'**Pausa.** *O que você faz?*');assert.equal(blocks[3].rows[0][1],'8');assert.ok(!blocksToMarkdown(blocks).includes('malicioso'));}finally{if(previous===undefined)delete globalThis.DOMParser;else globalThis.DOMParser=previous;}
});
