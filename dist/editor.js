import { parseBlocks, blocksToMarkdown, inlineHTML, editableToMarkdown, escapeHTML as esc } from './markdown.js';
import { icon } from './icons.js';
const types={paragraph:'Texto',h1:'Título 1',h2:'Título 2',h3:'Título 3',quote:'Citação',note:'Nota do mestre',list:'Lista',todo:'Tarefa',cue:'Cue de áudio',divider:'Divisória'};

export class BlockEditor {
  constructor(element,options){this.el=element;this.options=options;this.blocks=parseBlocks(options.markdown);this.active=0;this.render();}
  serialize(){return blocksToMarkdown(this.blocks);}
  changed(){this.options.onChange(this.serialize());}
  render(focusIndex=null) {
    this.el.innerHTML=this.blocks.map((b,i)=>{
      const tools=`<div class="block-tools"><button type="button" aria-label="Adicionar bloco após este" data-add="${i}">${icon('plus')}</button><button type="button" draggable="true" data-drag="${i}" data-block-menu="${i}" aria-label="Mover ou configurar bloco">${icon('grip')}</button></div>`;
      let body='';
      if(b.type==='divider')body='<hr>';
      else if(b.type==='cue')body=`<div class="editable-cue"><span>♫</span><div class="block-content" contenteditable="true" role="textbox" aria-label="${types[b.type]} bloco ${i+1}" data-block="${i}" data-placeholder="Nome da cue">${inlineHTML(b.text,this.options.pages,true)}</div><select aria-label="Efeito da cue" data-trigger-select="${i}"><option value="">Escolher efeito</option>${this.options.triggers.map(t=>`<option value="${esc(t.id)}" ${t.id===b.triggerId?'selected':''}>${esc(t.name)}</option>`).join('')}</select><button type="button" class="icon-btn" data-preview-cue="${i}" aria-label="Testar cue">${icon('play')}</button></div>`;
      else body=`${b.type==='todo'?`<input type="checkbox" data-block-check="${i}" aria-label="Concluir tarefa" ${b.checked?'checked':''}>`:''}<div class="block-content" contenteditable="true" role="textbox" aria-label="${types[b.type]} bloco ${i+1}" data-block="${i}" data-placeholder="Escreva ou use / para inserir um bloco…" spellcheck="true">${inlineHTML(b.text,this.options.pages,true)}</div>`;
      return `<div class="editor-block block-${esc(b.type)}" data-block-row="${i}">${tools}${body}</div>`;
    }).join('')+`<button type="button" class="add-block-line" data-add="${this.blocks.length-1}">${icon('plus')} Adicionar bloco <span>/</span></button>`;
    this.el.oninput=e=>{const i=e.target.dataset.block;if(i!==undefined){this.blocks[i].text=editableToMarkdown(e.target);this.active=+i;this.changed();}};
    this.el.onfocusin=e=>{if(e.target.dataset.block!==undefined){this.active=+e.target.dataset.block;this.options.onActive?.(this.blocks[this.active].type);}};
    this.el.onclick=e=>{
      const add=e.target.closest('[data-add]');if(add){this.active=Number(add.dataset.add);this.menu(add,'add');return;}
      const menu=e.target.closest('[data-block-menu]');if(menu){this.active=+menu.dataset.blockMenu;this.menu(menu,'edit');return;}
      const preview=e.target.closest('[data-preview-cue]');if(preview)this.options.onCue(this.blocks[preview.dataset.previewCue].triggerId);
    };
    this.el.onchange=e=>{const check=e.target.dataset.blockCheck,trigger=e.target.dataset.triggerSelect;if(check!==undefined){this.blocks[check].checked=e.target.checked;this.changed();}if(trigger!==undefined){this.blocks[trigger].triggerId=e.target.value;this.changed();}};
    this.el.onpaste=e=>{if(!e.target.closest('[contenteditable]'))return;e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));};
    this.el.onkeydown=e=>{
      const i=e.target.dataset.block;if(i===undefined)return;
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.add(Number(i)+1,['list','todo'].includes(this.blocks[i].type)?this.blocks[i].type:'paragraph');}
      if(e.key==='Backspace'&&!e.target.textContent&&this.blocks.length>1){e.preventDefault();this.blocks.splice(+i,1);this.changed();this.render(Math.max(0,+i-1));}
      if(e.key==='/'&&!e.target.textContent.trim()){e.preventDefault();this.active=+i;this.menu(e.target,'convert');}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();this.captureSelection();this.options.onRequestLink();}
    };
    this.el.ondragstart=e=>{const handle=e.target.closest('[data-drag]');if(!handle)return;e.dataTransfer.setData('text/cris-block',handle.dataset.drag);e.dataTransfer.effectAllowed='move';};
    this.el.ondragover=e=>{if([...e.dataTransfer.types].includes('text/cris-block'))e.preventDefault();};
    this.el.ondrop=e=>{const row=e.target.closest('[data-block-row]'),from=e.dataTransfer.getData('text/cris-block');if(!row||!from)return;e.preventDefault();const target=+row.dataset.blockRow;const [b]=this.blocks.splice(+from,1);this.blocks.splice(target,0,b);this.changed();this.render(target);};
    if(focusIndex!==null){this.active=focusIndex;const field=this.el.querySelector(`[data-block="${focusIndex}"]`);field?.focus();if(field){const selection=getSelection(),range=document.createRange();range.selectNodeContents(field);range.collapse(false);selection.removeAllRanges();selection.addRange(range);}}
  }
  add(index,type='paragraph') {this.blocks.splice(index,0,{type,text:'',...(type==='cue'?{triggerId:this.options.triggers[0]?.id||''}:{})});this.changed();this.render(index);}
  setType(type){if(!this.blocks[this.active])return;this.blocks[this.active].type=type;if(type==='cue'&&!this.blocks[this.active].triggerId)this.blocks[this.active].triggerId=this.options.triggers[0]?.id||'';this.changed();this.render(this.active);}
  captureSelection(){const s=getSelection();if(s.rangeCount&&this.el.contains(s.anchorNode))this.range=s.getRangeAt(0).cloneRange();}
  format(command){if(this.range){const s=getSelection();s.removeAllRanges();s.addRange(this.range);}document.execCommand(command);this.captureSelection();const field=this.el.querySelector(`[data-block="${this.active}"]`);if(field){this.blocks[this.active].text=editableToMarkdown(field);this.changed();}}
  insertLink(page){
    const field=this.el.querySelector(`[data-block="${this.active}"]`);if(!field)return;field.focus();const selection=getSelection();if(this.range&&this.el.contains(this.range.startContainer)){selection.removeAllRanges();selection.addRange(this.range);}
    const token=document.createElement('span');token.className='wiki-token';token.contentEditable='false';token.dataset.markdown=`[[page:${page.id}|${page.title}]]`;token.textContent='↗ '+page.title;
    if(selection.rangeCount){const range=selection.getRangeAt(0);range.deleteContents();range.insertNode(token);range.setStartAfter(token);range.collapse(true);selection.removeAllRanges();selection.addRange(range);}else field.append(token);
    this.blocks[this.active].text=editableToMarkdown(field);this.changed();
  }
  menu(anchor,mode) {
    document.getElementById('blockPopover')?.remove();const menu=document.createElement('div');menu.id='blockPopover';menu.className='block-popover';menu.setAttribute('role','menu');
    menu.innerHTML=`<span class="popover-label">${mode==='edit'?'TRANSFORMAR BLOCO':'INSERIR BLOCO'}</span>`+Object.entries(types).map(([type,label])=>`<button type="button" role="menuitem" data-type="${type}"><b>${({paragraph:'T',h1:'H₁',h2:'H₂',h3:'H₃',quote:'❞',note:'✦',list:'☷',todo:'☑',cue:'♫',divider:'—'})[type]}</b>${label}</button>`).join('')+(mode==='edit'?'<hr><button type="button" data-move="-1">↑ Mover para cima</button><button type="button" data-move="1">↓ Mover para baixo</button><button type="button" class="danger-text" data-remove>Excluir bloco</button>':'');
    document.body.append(menu);const rect=anchor.getBoundingClientRect();menu.style.left=Math.min(rect.left,innerWidth-230)+'px';menu.style.top=Math.max(8,Math.min(rect.bottom+6,innerHeight-460))+'px';
    menu.onclick=e=>{
      const type=e.target.closest('[data-type]');if(type){const i=this.active;mode==='add'?this.add(i+1,type.dataset.type):this.setType(type.dataset.type);}
      const move=e.target.closest('[data-move]');if(move){const target=this.active+Number(move.dataset.move);if(target>=0&&target<this.blocks.length){[this.blocks[this.active],this.blocks[target]]=[this.blocks[target],this.blocks[this.active]];this.changed();this.render(target);}}
      if(e.target.closest('[data-remove]')){this.blocks.splice(this.active,1);if(!this.blocks.length)this.blocks=[{type:'paragraph',text:''}];this.changed();this.render(Math.max(0,this.active-1));}
      menu.remove();
    };
    setTimeout(()=>document.addEventListener('pointerdown',function close(e){if(!menu.contains(e.target)){menu.remove();document.removeEventListener('pointerdown',close);}}),0);
  }
}
