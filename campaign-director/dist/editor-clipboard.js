import {parseBlocks} from './markdown.js';

/** Lê HTML inerte: apenas texto, formatação e estrutura entram no editor. */
export function clipboardBlocks({html='',text=''}){
  if(!html){if(text.includes('\t')){const rows=text.trimEnd().split(/\r?\n/).map(line=>line.split('\t'));if(rows[0].length>1)return [{type:'table',text:'',headers:rows[0],rows:rows.slice(1).map(r=>rows[0].map((_,i)=>r[i]||'')),align:rows[0].map(()=> 'left')}];}return parseBlocks(text);}
  const doc=new DOMParser().parseFromString(html,'text/html'),blocks=[];
  const skip=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','BUTTON','INPUT','IMG','META','LINK']);
  function inline(node){
    if(node.nodeType===3)return node.textContent.replace(/\u00a0/g,' ');if(node.nodeType!==1||skip.has(node.tagName))return '';
    if(node.tagName==='BR')return '\n';if(['UL','OL','TABLE'].includes(node.tagName))return '';
    let value=[...node.childNodes].map(inline).join('');if(['STRONG','B'].includes(node.tagName)||Number(node.style.fontWeight)>=600)value=`**${value}**`;if(['EM','I'].includes(node.tagName)||node.style.fontStyle==='italic')value=`*${value}*`;if(['S','STRIKE','DEL'].includes(node.tagName))value=`~~${value}~~`;if(node.tagName==='CODE')value='`'+value+'`';return value;
  }
  function walk(parent){
    let pending='';const flush=()=>{if(pending.trim()){blocks.push({type:'paragraph',text:pending.trim()});pending='';}};
    for(const node of parent.childNodes){
      if(node.nodeType===3){pending+=node.textContent;continue;}if(node.nodeType!==1||skip.has(node.tagName))continue;
      const tag=node.tagName;
      if(tag==='TABLE'){
        flush();const rows=[...node.rows].map(r=>[...r.cells].map(c=>inline(c).trim()));if(rows.length){const width=Math.max(...rows.map(r=>r.length)),headers=Array.from({length:width},(_,i)=>rows[0][i]||'');blocks.push({type:'table',text:'',headers,rows:rows.slice(1).map(r=>headers.map((_,i)=>r[i]||'')),align:headers.map(()=> 'left')});}continue;
      }
      if(['UL','OL'].includes(tag)){flush();let n=Number(node.start)||1;for(const li of node.children){if(li.tagName!=='LI')continue;blocks.push({type:tag==='OL'?'numbered':'list',text:inline(li).trim(),...(tag==='OL'?{number:n++}:{})});for(const nested of li.children)if(['UL','OL'].includes(nested.tagName))walk({childNodes:[nested]});}continue;}
      if(tag==='HR'){flush();blocks.push({type:'divider',text:''});continue;}
      if(['H1','H2','H3','H4','H5','H6','P','BLOCKQUOTE','PRE'].includes(tag)){flush();blocks.push({type:tag.startsWith('H')?'h'+Math.min(3,Number(tag[1])):tag==='BLOCKQUOTE'?'quote':'paragraph',text:inline(node).trim()});continue;}
      if(['DIV','SECTION','ARTICLE','MAIN','DETAILS','BODY'].includes(tag)){
        flush();if([...node.children].some(c=>['DIV','P','H1','H2','H3','UL','OL','TABLE','HR','BLOCKQUOTE','SECTION'].includes(c.tagName)))walk(node);else blocks.push({type:'paragraph',text:inline(node).trim()});continue;
      }
      pending+=inline(node);
    }flush();
  }
  walk(doc.body);return blocks.length?blocks:parseBlocks(text);
}
