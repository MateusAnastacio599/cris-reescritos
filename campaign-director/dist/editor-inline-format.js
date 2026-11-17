import {colorAttributes,scriptColors} from './editor-colors.js';
import {blocksToMarkdown,editableToMarkdown,inlineHTML,parseBlocks} from './markdown.js';

const inlineTags={A:null,B:'bold',STRONG:'bold',I:'italic',EM:'italic',S:'strike',STRIKE:'strike',DEL:'strike',CODE:'code',SPAN:null};
const markTags={bold:'strong',italic:'em',strike:'s',code:'code'};
const palette=new Set(scriptColors.map(([color])=>color));

// An internal link and a line break each occupy one unit, just as in the editor's caret model.
function segments(node,marks={},output=[]){
  for(const child of node.childNodes){
    if(child.nodeType===3){
      if(child.data)output.push({kind:'text',value:child.data,marks});
    }else if(child.dataset?.markdown){
      output.push({kind:'link',value:child.dataset.markdown,marks,node:child});
    }else if(child.nodeName==='BR'){
      if(!child.hasAttribute('data-editor-empty'))output.push({kind:'break',value:'\n',marks});
    }else if(Object.hasOwn(inlineTags,child.nodeName)){
      if(child.nodeName==='A'||child.nodeName==='SPAN'&&!colorAttributes(child.dataset.crisInk,child.dataset.crisHighlight))return null;
      const tag=inlineTags[child.nodeName],next={...marks};
      if(tag)next[tag]=true;
      for(const channel of ['crisInk','crisHighlight']){
        const value=child.dataset[channel];
        if(palette.has(value)&&value!=='none')next[channel]=value;
      }
      if(!segments(child,next,output))return null;
    }else return null;
  }
  return output;
}

function partition(items,start,end){
  let offset=0;
  return items.flatMap(item=>{
    const size=item.kind==='text'?item.value.length:1;
    const from=Math.max(0,Math.min(size,start-offset)),to=Math.max(from,Math.min(size,end-offset));
    offset+=size;
    if(item.kind!=='text')return [{...item,selected:from===0&&to===1}];
    return [[0,from,false],[from,to,true],[to,size,false]].filter(([a,b])=>a<b).map(([a,b,selected])=>({...item,value:item.value.slice(a,b),selected}));
  });
}

function wrappers(marks){
  const styles=Object.keys(markTags).filter(key=>key!=='code'&&marks[key]);
  const ink=marks.crisInk??'none',highlight=marks.crisHighlight??'none';
  if(colorAttributes(ink,highlight))styles.push(ink+':'+highlight);
  if(marks.code)styles.push('code');
  return styles;
}

function fragment(document,items){
  const root=document.createElement('div'),stack=[];
  for(const item of items){
    const keys=wrappers(item.marks);
    let common=0;
    while(common<stack.length&&stack[common].key===keys[common])common++;
    stack.length=common;
    let parent=stack.at(-1)?.element??root;
    for(const key of keys.slice(common)){
      const element=document.createElement(markTags[key]??'span');
      if(!markTags[key])[element.dataset.crisInk,element.dataset.crisHighlight]=key.split(':');
      parent.append(element);
      stack.push({key,element});
      parent=element;
    }
    parent.append(item.kind==='link'?item.node.cloneNode(true):item.kind==='break'?document.createElement('br'):item.value);
  }
  return root;
}

function signature(items){
  return items.map(({kind,value,marks})=>[kind,value,wrappers(marks)]).reduce((result,item)=>{
    const previous=result.at(-1);
    if(item[0]==='text'&&previous?.[0]==='text'&&String(previous[2])===String(item[2]))previous[1]+=item[1];
    else result.push(item);
    return result;
  },[]);
}

// Removing emphasis can expose a paragraph's literal Markdown block marker.
export function preservesMarkdownBlock(block,text){
  const [reopened,...extra]=parseBlocks(blocksToMarkdown([{...block,text}]));
  return !extra.length&&reopened.type===block.type&&reopened.text===text&&reopened.number===block.number;
}

// Build every edit off-document. Commit only if the existing format can round-trip the complete selection.
export function formatTextFields(fields,parts,pages,command,value){
  if(!['bold','italic','crisInk','crisHighlight'].includes(command))return null;
  const emphasis=command==='bold'||command==='italic';
  if(!emphasis&&!palette.has(value))return null;
  const partitioned=fields.map((field,i)=>{
    const items=segments(field);
    return items&&partition(items,i===0?parts.startOffset:0,i===fields.length-1?parts.endOffset:Infinity);
  });
  if(partitioned.some(items=>!items))return null;
  const selected=partitioned.flat().filter(item=>item.selected&&item.kind!=='break');
  if(!selected.length)return null;
  const setting=emphasis?!selected.every(({marks})=>marks[command]):value!=='none'&&value;
  const changes=[];
  for(const [index,items] of partitioned.entries()){
    if(!items.some(item=>item.selected))continue;
    const next=items.map(item=>{
      if(!item.selected)return item;
      const marks={...item.marks};
      if(setting)marks[command]=setting;
      else delete marks[command];
      return {...item,marks};
    });
    if(JSON.stringify(signature(items))===JSON.stringify(signature(next)))continue;
    const field=fields[index],box=fragment(field.ownerDocument,next);
    const text=editableToMarkdown(box,{trim:false});
    const html=inlineHTML(text,pages,true);
    box.innerHTML=html;
    const recovered=segments(box);
    if(!recovered||JSON.stringify(signature(next))!==JSON.stringify(signature(recovered)))return null;
    changes.push({field,text,html});
  }
  return changes;
}
