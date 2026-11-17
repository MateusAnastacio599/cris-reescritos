import {toggleBackground,toggleBackgroundAttribute} from './editor-colors.js';

export const MIN_COLUMN_WIDTH = 20;
const allowed = new Set(['paragraph','h1','h2','h3','list','numbered','quote','note','toggle','table','cue','divider']);
export const isColumnBlock = block => allowed.has(block?.type);
export const isColumnBlockType = type => allowed.has(type === 'richToggle' ? 'toggle' : type);

function equalWidths(count) {
  return Array.from({length:count},(_,index)=>Math.floor((index+1)*100/count)-Math.floor(index*100/count));
}

export function newColumns(count) {
  if(count!==2&&count!==3)throw new RangeError('O layout deve ter duas ou três colunas.');
  return {type:'columns',columns:equalWidths(count).map(width=>({width,blocks:[]}))};
}

export function validColumns(columns, validBlock) {
  return Array.isArray(columns)&&(columns.length===2||columns.length===3)&&
    columns.every(column=>column&&Number.isInteger(column.width)&&column.width>=MIN_COLUMN_WIDTH&&
      (column.background==null||Boolean(toggleBackground(column.background)))&&
      Object.keys(column).every(key=>['width','background','blocks'].includes(key))&&
      Array.isArray(column.blocks)&&column.blocks.every(validBlock))&&
    columns.reduce((total,column)=>total+column.width,0)===100;
}

export function resizedWidths(columns,index,requested) {
  const left=columns[index],right=columns[index+1];
  if(!left||!right||!Number.isFinite(requested))return null;
  const total=left.width+right.width;
  const width=Math.max(MIN_COLUMN_WIDTH,Math.min(total-MIN_COLUMN_WIDTH,Math.round(requested)));
  return columns.map((column,i)=>i===index?width:i===index+1?total-width:column.width);
}

export function addColumn(columns) {
  if(columns.length!==2)return false;
  const donor=columns[0].width>=columns[1].width?columns[0]:columns[1];
  const width=Math.floor(donor.width/2);
  donor.width-=width;
  columns.push({width,blocks:[]});
  return true;
}

export function removeColumn(columns,index) {
  if(columns.length!==3||!columns[index])return null;
  const destination=index===0?1:index-1;
  const source=columns[index],target=columns[destination];
  const block=index===0?0:target.blocks.length;
  if(index===0)target.blocks.unshift(...source.blocks);
  else target.blocks.push(...source.blocks);
  target.width+=source.width;
  columns.splice(index,1);
  return {column:index===0?0:destination,block};
}

export function columnBlockDestination(columns,from,index,to,slot=columns[to]?.blocks.length) {
  const source=columns[from]?.blocks,target=columns[to]?.blocks;
  if(!source||!target||!Number.isInteger(index)||!isColumnBlock(source[index])||
    !Number.isInteger(slot)||slot<0||slot>target.length)return null;
  const destination=from===to&&slot>index?slot-1:slot;
  return from===to&&destination===index?null:destination;
}

export function moveColumnBlock(columns,from,index,to,slot) {
  const destination=columnBlockDestination(columns,from,index,to,slot);
  if(destination===null)return null;
  const [block]=columns[from].blocks.splice(index,1);
  columns[to].blocks.splice(destination,0,block);
  return destination;
}

export function columnTracks(widths, editable=false) {
  return widths.map(width=>`minmax(0, ${width}fr)`).join(editable?' 12px ':' ');
}

export function readColumnsHTML(columns,renderBlocks) {
  return `<section class="script-columns" aria-label="Colunas do roteiro"><div class="script-column-grid" data-count="${columns.length}" style="--script-column-tracks:${columnTracks(columns.map(column=>column.width))}">${columns.map((column,i)=>
    `<section class="script-column" aria-label="Coluna ${i+1}"${toggleBackgroundAttribute(column.background)}>${renderBlocks(column.blocks)}</section>`
  ).join('')}</div></section>`;
}
