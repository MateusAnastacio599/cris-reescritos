import {blocksToMarkdown,parseBlocks} from './markdown.js';

function normalize(value){
  if(Array.isArray(value))return value.map(normalize);
  if(value===null||typeof value!=='object')return value;
  const block=value.type==='table'?{text:'',align:value.headers.map(()=>'left'),...value}:value;
  return Object.fromEntries(Object.keys(block).sort().filter(key=>block[key]!==undefined)
    .map(key=>[key,normalize(block[key])]));
}

export function planColumnRemoval(layout,action,confirmed=false){
  if(layout?.type!=='columns')return {error:'O layout não está mais disponível.'};
  const blocks=layout.columns.flatMap(column=>column.blocks);
  if(action==='delete'){
    if(!confirmed&&blocks.some(block=>block.type!=='paragraph'||block.text!==''))return {confirmation:true};
    return {blocks:[]};
  }
  if(action!=='unpack')return {error:'Ação de colunas inválida.'};
  if(!blocks.length)return {blocks};
  try{
    if(JSON.stringify(normalize(blocks))===JSON.stringify(normalize(parseBlocks(blocksToMarkdown(blocks)))))return {blocks};
  }catch{/* A layout with malformed data is still available for recovery from the script. */}
  return {error:'Não foi possível desagrupar sem alterar o conteúdo. Há blocos que o Markdown interpretaria de outra forma fora das colunas. O layout foi preservado.'};
}
