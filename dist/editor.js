import {parseBlocks,blocksToMarkdown,inlineHTML,editableToMarkdown,renderTable,escapeHTML as esc} from './markdown.js';
import {BLOCK_TYPES,newBlock,splitBlocks,EditorHistory} from './editor-model.js';
import {clipboardBlocks} from './editor-clipboard.js';
import {icon} from './icons.js';

const isCell=field=>field?.dataset.cellRow!==undefined;
export class BlockEditor {
  constructor(element,options){this.el=element;this.options=options;this.blocks=parseBlocks(options.markdown);this.active=0;this.history=new EditorHistory(this.blocks);this.abort=new AbortController();document.addEventListener('selectionchange',()=>this.selectionToolbar(),{signal:this.abort.signal});this.render();}
  destroy(){this.abort.abort();this.hideToolbar();document.getElementById('blockPopover')?.remove();}
  serialize(){return blocksToMarkdown(this.blocks);}
  changed(typing=false){this.history.record(this.blocks,this.active,typing);this.options.onChange(this.serialize());}
  syncField(field){if(!field?.dataset||field.dataset.block===undefined)return;const b=this.blocks[+field.dataset.block];if(!b)return;const text=editableToMarkdown(field);if(isCell(field)){const r=+field.dataset.cellRow,c=+field.dataset.cellCol;if(r===0)b.headers[c]=text;else if(b.rows[r-1])b.rows[r-1][c]=text;}else b.text=text;}
  syncDOM(){this.el.querySelectorAll('[contenteditable=true][data-block]').forEach(field=>this.syncField(field));}
  render(focus=null){
    this.hideToolbar();this.range=null;
    this.el.innerHTML=this.blocks.map((b,i)=>{
      const tools=`<div class="block-tools" contenteditable="false"><button type="button" aria-label="Adicionar bloco" data-add="${i}">${icon('plus')}</button><button type="button" draggable="true" data-drag="${i}" data-block-menu="${i}" aria-label="Menu do bloco">${icon('grip')}</button></div>`;
      const field=`<div class="block-content" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${BLOCK_TYPES[b.type]} ${i+1}" data-block="${i}" data-placeholder="Escreva ou digite / para inserir…" spellcheck="true" lang="pt-BR">${inlineHTML(b.text,this.options.pages,true)}</div>`;
      let body=field;
      if(b.type==='divider')body='<hr>';
      if(b.type==='todo')body=`<input type="checkbox" data-block-check="${i}" aria-label="Concluir tarefa" ${b.checked?'checked':''}>`+field;
      if(b.type==='numbered')body=`<span class="editor-number" contenteditable="false">${b.number||1}.</span>`+field;
      if(b.type==='cue')body=`<div class="editable-cue"><span>♫</span>${field}<select aria-label="Efeito da cue" data-trigger-select="${i}"><option value="">Escolher efeito</option>${this.options.triggers.map(t=>`<option value="${esc(t.id)}" ${t.id===b.triggerId?'selected':''}>${esc(t.name)}</option>`).join('')}</select><button type="button" class="icon-btn" data-preview-cue="${i}" aria-label="Testar cue">${icon('play')}</button></div>`;
      if(b.type==='table')body=renderTable(b,this.options.pages,true,i)+`<div class="table-controls" contenteditable="false"><button type="button" data-table-action="row" data-table="${i}">+ Linha</button><button type="button" data-table-action="column" data-table="${i}">+ Coluna</button><button type="button" data-table-action="remove-row" data-table="${i}">− Linha</button><button type="button" data-table-action="remove-column" data-table="${i}">− Coluna</button></div>`;
      return `<div class="editor-block block-${b.type}" data-block-row="${i}">${tools}${body}</div>`;
    }).join('')+`<button type="button" class="add-block-line" data-add="${this.blocks.length-1}">${icon('plus')} Adicionar bloco <span>/</span></button>`;
    this.el.oninput=e=>{const field=e.target.closest('[data-block]');this.syncField(field);if(field)this.active=+field.dataset.block;this.changed(true);};
    this.el.onfocusin=e=>{const field=e.target.closest('[data-block]');if(!field)return;this.active=+field.dataset.block;this.activeCell=isCell(field)?{row:+field.dataset.cellRow,col:+field.dataset.cellCol}:null;this.options.onActive?.(this.blocks[this.active].type);};
    this.el.onclick=e=>{
      const add=e.target.closest('[data-add]');if(add){this.active=+add.dataset.add;this.menu(add,'add');return;}
      const menu=e.target.closest('[data-block-menu]');if(menu){this.active=+menu.dataset.blockMenu;this.menu(menu,'edit');return;}
      const preview=e.target.closest('[data-preview-cue]');if(preview)this.options.onCue(this.blocks[+preview.dataset.previewCue].triggerId);
      const action=e.target.closest('[data-table-action]');if(action)this.tableAction(+action.dataset.table,action.dataset.tableAction);
    };
    this.el.onchange=e=>{const {blockCheck,triggerSelect}=e.target.dataset;if(blockCheck!==undefined){this.blocks[+blockCheck].checked=e.target.checked;this.changed();}if(triggerSelect!==undefined){this.blocks[+triggerSelect].triggerId=e.target.value;this.changed();}};
    this.el.onpaste=e=>this.paste(e);this.el.onkeydown=e=>this.keydown(e);
    this.el.ondragstart=e=>{const handle=e.target.closest('[data-drag]');if(handle){e.dataTransfer.setData('text/cris-block',handle.dataset.drag);e.dataTransfer.effectAllowed='move';}};
    this.el.ondragover=e=>{if([...e.dataTransfer.types].includes('text/cris-block'))e.preventDefault();};
    this.el.ondrop=e=>{const row=e.target.closest('[data-block-row]'),from=e.dataTransfer.getData('text/cris-block');if(!row||from==='')return;e.preventDefault();const target=+row.dataset.blockRow,[b]=this.blocks.splice(+from,1);this.blocks.splice(target,0,b);this.active=target;this.changed();this.render({index:target});};
    if(focus!==null)this.focus(typeof focus==='number'?{index:focus}:focus);
  }
  focus({index=this.active,offset=null,cell=null}={}){
    this.active=Math.max(0,Math.min(index,this.blocks.length-1));let field=this.el.querySelector(`[data-block="${this.active}"]${cell?`[data-cell-row="${cell.row}"][data-cell-col="${cell.col}"]`:''}`);
    if(!field&&this.blocks[this.active]?.type==='divider'){this.add(this.active+1);return;}if(!field)return;field.focus();const selection=getSelection(),range=document.createRange();range.selectNodeContents(field);range.collapse(false);
    if(offset!==null){const walker=document.createTreeWalker(field,4);let node,left=offset;while(node=walker.nextNode()){if(left<=node.textContent.length){range.setStart(node,left);range.collapse(true);break;}left-=node.textContent.length;}if(offset===0){range.setStart(field,0);range.collapse(true);}}
    selection.removeAllRanges();selection.addRange(range);
  }
  fieldFor(node){const el=node?.nodeType===1?node:node?.parentElement;const field=el?.closest('[contenteditable=true][data-block]');return field&&this.el.contains(field)?field:null;}
  selectionParts(){
    const s=getSelection();if(!s.rangeCount)return null;const range=s.getRangeAt(0),start=this.fieldFor(range.startContainer),end=this.fieldFor(range.endContainer);if(!start||!end)return null;
    const before=range.cloneRange();before.selectNodeContents(start);before.setEnd(range.startContainer,range.startOffset);const after=range.cloneRange();after.selectNodeContents(end);after.setStart(range.endContainer,range.endOffset);
    const read=r=>{const box=document.createElement('div');box.append(r.cloneContents());return editableToMarkdown(box);};
    return {range,startField:start,endField:end,start:+start.dataset.block,end:+end.dataset.block,before:read(before),after:read(after),collapsed:range.collapsed};
  }
  keydown(e){
    if(e.isComposing)return;const field=e.target.closest('[data-block]');if(!field)return;this.active=+field.dataset.block;const b=this.blocks[this.active],mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
    if(mod&&key==='z'){e.preventDefault();this.undo(e.shiftKey?1:-1);return;}if(mod&&key==='y'){e.preventDefault();this.undo(1);return;}
    if(mod&&['b','i','e'].includes(key)){e.preventDefault();this.captureSelection();this.format({b:'bold',i:'italic',e:'code'}[key]);return;}
    if(mod&&key==='k'){e.preventDefault();this.captureSelection();this.options.onRequestLink();return;}
    if(mod&&e.altKey&&['1','2','3','0'].includes(key)){e.preventDefault();this.setType(key==='0'?'paragraph':'h'+key);return;}
    const parts=this.selectionParts();if(!parts)return;
    if((isCell(parts.startField)||isCell(parts.endField))&&parts.startField!==parts.endField&&['Enter','Backspace','Delete'].includes(e.key)){e.preventDefault();return;}
    if(isCell(field)){
      if(e.key==='Tab'||e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.syncField(field);const width=b.headers.length;let n=+field.dataset.cellRow*width+(+field.dataset.cellCol)+(e.key==='Tab'?(e.shiftKey?-1:1):width);n=Math.max(0,n);if(n>=(b.rows.length+1)*width)b.rows.push(b.headers.map(()=>''));this.changed();this.render({index:this.active,cell:{row:Math.floor(n/width),col:n%width},offset:0});}
      if(e.key==='Backspace'&&parts.collapsed&&!field.textContent)e.preventDefault();return;
    }
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.syncDOM();const focus=splitBlocks(this.blocks,parts.start,parts.end,parts.before,parts.after);this.active=focus.index;this.changed();this.render(focus);return;}
    if(e.key==='Backspace'||e.key==='Delete'){
      if(!parts.collapsed&&parts.start!==parts.end){e.preventDefault();this.blocks.splice(parts.start,parts.end-parts.start+1,{...this.blocks[parts.start],text:parts.before+parts.after});this.active=parts.start;this.changed();this.render({index:this.active,offset:this.plainLength(parts.before)});return;}
      if(parts.collapsed&&e.key==='Backspace'&&!parts.before){
        if(b.type!=='paragraph'){e.preventDefault();this.setType('paragraph');return;}
        const previous=this.blocks[this.active-1];if(previous?.type==='table'){e.preventDefault();this.focus({index:this.active-1,cell:{row:previous.rows.length,col:previous.headers.length-1}});return;}if(previous?.type==='divider'){e.preventDefault();this.blocks.splice(this.active-1,1);this.active--;this.changed();this.render({index:this.active,offset:0});return;}if(previous&&!['table','divider'].includes(previous.type)){e.preventDefault();const offset=this.plainLength(previous.text);previous.text+=b.text;this.blocks.splice(this.active,1);this.active--;this.changed();this.render({index:this.active,offset});return;}
      }
      if(parts.collapsed&&e.key==='Delete'&&!parts.after){const next=this.blocks[this.active+1];if(next&&!['table','divider'].includes(next.type)){e.preventDefault();const offset=this.plainLength(b.text);b.text+=next.text;this.blocks.splice(this.active+1,1);this.changed();this.render({index:this.active,offset});return;}}
    }
    if(e.key==='/'&&!field.textContent.trim()){e.preventDefault();this.menu(field,'convert');return;}
    if(e.key===' '&&parts.collapsed&&!parts.after){const shortcuts={'#':'h1','##':'h2','###':'h3','-':'list','*':'list','1.':'numbered','[]':'todo','[ ]':'todo','>':'quote','---':'divider'},type=shortcuts[field.textContent];if(type){e.preventDefault();b.text='';this.setType(type);}}
  }
  plainLength(markdown){const box=document.createElement('div');box.innerHTML=inlineHTML(markdown,this.options.pages);return box.textContent.length;}
  add(index,type='paragraph'){this.blocks.splice(index,0,newBlock(type,this.options.triggers));this.active=index;this.changed();this.render({index,offset:0});}
  setType(type){const prior=this.blocks[this.active];if(!prior||!BLOCK_TYPES[type])return;if(type==='table'&&prior.type!=='table'){this.blocks[this.active]=newBlock(type);if(prior.text)this.blocks[this.active].rows[0][0]=prior.text;}else if(prior.type==='table'&&type!=='table')this.blocks[this.active]={...newBlock(type,this.options.triggers),text:[prior.headers,...prior.rows].map(r=>r.join(' · ')).join('\n')};else this.blocks[this.active]={...newBlock(type,this.options.triggers),...prior,type};this.changed();this.render({index:this.active,offset:0});}
  undo(direction){const entry=this.history.move(direction);if(!entry)return;this.blocks=entry.blocks;this.active=entry.active;this.options.onChange(this.serialize());this.render({index:this.active});}
  captureSelection(){const s=getSelection();if(s.rangeCount&&this.el.contains(s.anchorNode))this.range=s.getRangeAt(0).cloneRange();}
  format(command){
    if(this.range&&this.el.contains(this.range.startContainer)){const s=getSelection();s.removeAllRanges();s.addRange(this.range);}
    const s=getSelection();if(!s.rangeCount||!this.el.contains(s.anchorNode))return;
    if(command==='code'){const range=s.getRangeAt(0);if(range.collapsed||this.fieldFor(range.startContainer)!==this.fieldFor(range.endContainer))return;const code=document.createElement('code');code.textContent=range.toString();range.deleteContents();range.insertNode(code);range.selectNodeContents(code);s.removeAllRanges();s.addRange(range);}else document.execCommand(command,false);
    this.syncDOM();this.changed();this.captureSelection();
  }
  insertLink(page){
    if(this.range&&this.el.contains(this.range.startContainer)){const s=getSelection();s.removeAllRanges();s.addRange(this.range);}else this.focus({index:this.active});
    const selection=getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0),token=document.createElement('span');token.className='wiki-token';token.contentEditable='false';token.dataset.markdown=`[[page:${page.id}|${page.title}]]`;token.textContent='↗ '+page.title;range.deleteContents();range.insertNode(token);range.setStartAfter(token);range.collapse(true);selection.removeAllRanges();selection.addRange(range);this.syncDOM();this.changed();this.captureSelection();
  }
  paste(e){
    const field=e.target.closest('[contenteditable=true][data-block]');if(!field)return;e.preventDefault();const text=e.clipboardData.getData('text/plain'),html=e.clipboardData.getData('text/html'),blocks=clipboardBlocks({html,text});
    if(isCell(field)){const b=this.blocks[+field.dataset.block];if(blocks.length===1&&blocks[0].type==='table'){const grid=[blocks[0].headers,...blocks[0].rows],r=+field.dataset.cellRow,c=+field.dataset.cellCol;while(b.headers.length<c+grid[0].length){b.headers.push('');b.rows.forEach(row=>row.push(''));}while(b.rows.length<r+grid.length-1)b.rows.push(b.headers.map(()=>''));grid.forEach((row,y)=>row.forEach((value,x)=>{if(r+y===0)b.headers[c+x]=value;else b.rows[r+y-1][c+x]=value;}));this.changed();this.render({index:+field.dataset.block,cell:{row:r,col:c}});}else{document.execCommand('insertHTML',false,inlineHTML(blocks.map(b=>b.text||'').join('\n'),this.options.pages,true));this.syncField(field);this.changed();}return;}
    const parts=this.selectionParts();if(!parts||isCell(parts.startField)||isCell(parts.endField))return;
    if(blocks.length===1&&blocks[0].type==='paragraph'&&parts.start===parts.end){document.execCommand('insertHTML',false,inlineHTML(blocks[0].text,this.options.pages,true));this.syncField(field);this.changed();return;}
    const inserted=[];if(parts.before)inserted.push({...this.blocks[parts.start],text:parts.before});inserted.push(...blocks);if(parts.after)inserted.push({type:'paragraph',text:parts.after});this.blocks.splice(parts.start,parts.end-parts.start+1,...inserted);this.active=parts.start+inserted.length-1;this.changed();this.render({index:this.active});
  }
  tableAction(index,action){const b=this.blocks[index];this.active=index;const r=this.activeCell?.row??b.rows.length,c=this.activeCell?.col??b.headers.length-1;if(action==='row')b.rows.splice(Math.max(0,r),0,b.headers.map(()=>''));if(action==='column'){b.headers.splice(c+1,0,'');b.rows.forEach(row=>row.splice(c+1,0,''));b.align?.splice(c+1,0,'left');}if(action==='remove-row'&&b.rows.length)b.rows.splice(Math.max(0,r-1),1);if(action==='remove-column'&&b.headers.length>1){b.headers.splice(c,1);b.rows.forEach(row=>row.splice(c,1));b.align?.splice(c,1);}this.changed();this.render({index,cell:{row:Math.min(r,b.rows.length),col:Math.min(c,b.headers.length-1)},offset:0});}
  hideToolbar(){document.getElementById('editorSelectionToolbar')?.remove();}
  selectionToolbar(){
    const s=getSelection();if(!s.rangeCount||s.isCollapsed||!this.el.contains(s.anchorNode)||!this.el.isConnected){this.hideToolbar();return;}this.captureSelection();const rect=s.getRangeAt(0).getBoundingClientRect();if(!rect.width&&!rect.height)return;let bar=document.getElementById('editorSelectionToolbar');if(!bar){bar=document.createElement('div');bar.id='editorSelectionToolbar';bar.className='selection-toolbar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Formatar seleção');bar.innerHTML='<button type="button" data-format="bold" title="Negrito (Ctrl+B)"><b>B</b></button><button type="button" data-format="italic" title="Itálico (Ctrl+I)"><em>I</em></button><button type="button" data-format="strikeThrough" title="Tachado"><s>S</s></button><button type="button" data-format="code" title="Código">&lt;/&gt;</button><button type="button" data-link title="Link interno">'+icon('link')+'</button>';bar.onpointerdown=e=>e.preventDefault();bar.onclick=e=>{const button=e.target.closest('button');if(button?.dataset.format)this.format(button.dataset.format);if(button?.hasAttribute('data-link'))this.options.onRequestLink();};document.body.append(bar);}bar.style.left=Math.max(8,Math.min(rect.left,innerWidth-245))+'px';bar.style.top=Math.max(8,rect.top-45)+'px';
  }
  menu(anchor,mode){
    document.getElementById('blockPopover')?.remove();const menu=document.createElement('div');menu.id='blockPopover';menu.className='block-popover searchable-block-menu';menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Inserir ou transformar bloco');menu.innerHTML='<label class="block-menu-search">'+icon('search')+'<input type="search" placeholder="Buscar bloco…" aria-label="Buscar tipo de bloco"></label><div class="block-menu-results"></div>'+(mode==='edit'?'<hr><button type="button" data-move="-1">↑ Mover para cima</button><button type="button" data-move="1">↓ Mover para baixo</button><button type="button" data-duplicate>Duplicar bloco</button><button type="button" class="danger-text" data-remove>Excluir bloco</button>':'');document.body.append(menu);
    const results=menu.querySelector('.block-menu-results'),search=menu.querySelector('input');const update=()=>{results.innerHTML=Object.entries(BLOCK_TYPES).filter(([type,label])=>(label+' '+type).toLocaleLowerCase().includes(search.value.toLocaleLowerCase())).map(([type,label])=>`<button type="button" data-type="${type}"><b>${({paragraph:'T',h1:'H₁',h2:'H₂',h3:'H₃',quote:'❞',note:'✦',list:'•',numbered:'1.',todo:'☑',table:'▦',cue:'♫',divider:'—'})[type]}</b>${label}</button>`).join('')||'<p>Nenhum bloco encontrado.</p>';};update();search.oninput=update;
    const rect=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-250))+'px';menu.style.top=Math.max(8,Math.min(rect.bottom+6,innerHeight-430))+'px';
    menu.onclick=e=>{const button=e.target.closest('button');if(!button)return;const type=button.dataset.type;if(type)mode==='add'?this.add(this.active+1,type):this.setType(type);if(button.dataset.move){const target=this.active+Number(button.dataset.move);if(target>=0&&target<this.blocks.length){[this.blocks[this.active],this.blocks[target]]=[this.blocks[target],this.blocks[this.active]];this.active=target;this.changed();this.render({index:target});}}if(button.hasAttribute('data-duplicate')){this.blocks.splice(this.active+1,0,structuredClone(this.blocks[this.active]));this.active++;this.changed();this.render({index:this.active});}if(button.hasAttribute('data-remove')){this.blocks.splice(this.active,1);if(!this.blocks.length)this.blocks=[newBlock()];this.active=Math.max(0,this.active-1);this.changed();this.render({index:this.active});}menu.remove();};
    menu.onkeydown=e=>{const buttons=[...results.querySelectorAll('button')];if(e.key==='Escape'){e.preventDefault();menu.remove();this.focus({index:this.active});}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:buttons.length-1)+buttons.length)%buttons.length]?.focus();}if(e.key==='Enter'&&e.target===search){e.preventDefault();buttons[0]?.click();}};
    const close=event=>{if(!menu.contains(event.target)){menu.remove();document.removeEventListener('pointerdown',close);}};document.addEventListener('pointerdown',close,{signal:this.abort.signal});search.focus();
  }
}
