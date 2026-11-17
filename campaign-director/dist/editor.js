import {recolorRange,scriptColors,toggleBackground,toggleBackgroundAttribute} from './editor-colors.js';
import {parseBlocks,blocksToMarkdown,inlineHTML,editableToMarkdown,renderTable,isRichToggle,TOGGLE_CHILD_TYPES,escapeHTML as esc} from './markdown.js';
import {BLOCK_TYPES,newBlock,splitBlocks,EditorHistory} from './editor-model.js';
import {clipboardBlocks,readClipboardBlocks,writeTextBlocks} from './editor-clipboard.js';
import {formatTextFields,preservesMarkdownBlock} from './editor-inline-format.js';
import {icon} from './icons.js';
import {ColumnLayouts,EDITOR_SURFACE,editableColumnsHTML} from './editor-columns.js';
import {isColumnBlock,isColumnBlockType,newColumns} from './editor-columns-model.js';
import {isTextBlock,textRunMarkup,runField,readRunField,pointAt,runSelection,selectedTextBlocks,replaceTextBlocks,pasteTextBlocks,textUnits,intactTextRun} from './editor-text-runs.js';

const writingShortcuts=new Map([['#','h1'],['##','h2'],['###','h3'],['>','toggle']]);
const isCell=field=>field?.dataset.cellRow!==undefined;
const childIndex=field=>field?.dataset?.child===undefined?null:+field.dataset.child;
let nextSurface=0;
export class BlockEditor {
  constructor(element,options){
    this.el=element;this.options=options;this.blocks=options.blocks??parseBlocks(options.markdown);
    this.active=0;this.activeChild=null;this.columnEditor=null;
    this.surfaceId=++nextSurface;this.el.dataset.editorSurface=String(this.surfaceId);
    this.dragType='text/cris-block-'+this.surfaceId;
    this.openToggles=options.openToggles??new WeakSet();
    this.abort=new AbortController();
    if(!options.columnContext){
      this.history=new EditorHistory(this.blocks);
      this.columns=new ColumnLayouts(this);
      const selectionEditor=()=>this.columns.editorAt(getSelection()?.anchorNode)??this;
      document.addEventListener('selectionchange',()=>{
        const editor=selectionEditor();
        editor.captureSelection(true);editor.selectionToolbar();
      },{signal:this.abort.signal});
      window.addEventListener('scroll',()=>{if(document.getElementById('editorSelectionToolbar'))selectionEditor().selectionToolbar();},{capture:true,passive:true,signal:this.abort.signal});
    }
    this.render();
  }
  destroy(){this.columns?.destroy();this.abort.abort();this.hideToolbar();document.getElementById('blockPopover')?.remove();}
  serialize(){return blocksToMarkdown(this.blocks);}
  changed(typing=false,scope=null){
    if(this.options.columnContext){this.options.columnContext.changed(this,typing);return;}
    this.history.record(this.blocks,this.active,typing,Date.now(),this.activeChild,scope);
    this.options.onChange(this.serialize());
  }
  owns(node){
    const element=node?.nodeType===1?node:node?.parentElement;
    return element?.closest(EDITOR_SURFACE)===this.el;
  }
  ownField(selector){return [...this.el.querySelectorAll(selector)].find(field=>this.owns(field));}
  canUseType(type){return !this.options.columnContext||isColumnBlockType(type);}
  rememberBookmark(bookmark){
    if(this.options.columnContext)this.options.columnContext.remember(bookmark);
    else this.history.remember(bookmark);
  }
  syncField(field){
    const b=this.blocks[+field?.dataset.block];
    if(!b)return;
    const child=childIndex(field);
    if(child!==null){
      const current=b.blocks?.[child];
      if(current)current.text=field.childNodes.length===1&&field.firstChild.nodeName==='BR'?'':editableToMarkdown(field,{trim:false});
    }else if(isCell(field)){
      const r=+field.dataset.cellRow,c=+field.dataset.cellCol,text=editableToMarkdown(field);
      if(r===0)b.headers[c]=text;else if(b.rows[r-1])b.rows[r-1][c]=text;
    }else b.text=field.hasAttribute('data-run-field')?readRunField(field):editableToMarkdown(field);
  }
  syncDOM(){this.el.querySelectorAll('[contenteditable=true][data-block]:not([data-child])').forEach(field=>{if(this.owns(field))this.syncField(field);});}
  render(focus=null){
    this.columns?.destroy();this.columnEditor=null;
    this.hideToolbar();this.range=null;
    this.el.innerHTML=this.blocks.map((b,i)=>{
      if(b.type==='columns')return editableColumnsHTML(b,i);
      const tools=`<div class="block-tools" contenteditable="false"><button type="button" aria-label="Adicionar bloco" data-add="${i}">${icon('plus')}</button><button type="button" draggable="true" data-drag="${i}" data-block-menu="${i}" aria-label="Menu do bloco">${icon('grip')}</button></div>`;
      const shared=isTextBlock(b);
      const attributes=shared?'data-run-field':'contenteditable="true" role="textbox" aria-multiline="true"';
      const field=`<div class="block-content" ${attributes} aria-label="${BLOCK_TYPES[b.type]} ${i+1}" data-block="${i}" data-placeholder="Escreva ou digite / para inserir…" spellcheck="true" lang="pt-BR">${inlineHTML(b.text,this.options.pages,true)||(shared?'<br data-editor-empty>':'')}</div>`;
      let body=field;
      if(b.type==='toggle'){
        const open=this.openToggles.has(b);
        const rich=isRichToggle(b);
        const content=rich?b.blocks.map((child,j)=>`<div class="rich-toggle-row">
          <button type="button" class="rich-toggle-menu" data-child-menu="${j}" data-parent="${i}" aria-label="Menu do bloco interno ${j+1}">${icon('grip')}</button>
          <div class="block-content rich-toggle-field block-${child.type}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${BLOCK_TYPES[child.type]} interno ${j+1}" data-block="${i}" data-child="${j}" data-placeholder="Escreva aqui…" spellcheck="true" lang="pt-BR">${inlineHTML(child.text,this.options.pages,true)}</div>
        </div>`).join('')+`<button type="button" class="rich-toggle-add" data-add-child="${i}">${icon('plus')} Adicionar parágrafo</button>`:
          `<div class="block-content script-toggle-text" contenteditable="plaintext-only" role="textbox" aria-multiline="true" aria-label="Texto do recolhível" data-placeholder="Escreva aqui…" data-toggle-field="text" data-block="${i}">${esc(b.text)}</div>`;
        body=`<div class="script-toggle"${toggleBackgroundAttribute(b.background)}>
          <div class="script-toggle-heading">
            <button type="button" data-toggle-button="${i}" aria-label="${open?'Recolher':'Expandir'} bloco" aria-expanded="${open}" aria-controls="script-toggle-body-${this.surfaceId}-${i}">▸</button>
            <div class="script-toggle-title" contenteditable="plaintext-only" role="textbox" aria-label="Título do recolhível" data-placeholder="Recolhível" data-toggle-field="title" data-block="${i}">${esc(b.title)}</div>
          </div>
          <div class="script-toggle-content${rich?' rich-toggle-editor':''}" id="script-toggle-body-${this.surfaceId}-${i}" ${open?'':'hidden'}>${content}</div>
        </div>`;
      }
      if(b.type==='divider')body='<hr>';
      if(b.type==='todo')body=`<input type="checkbox" data-block-check="${i}" aria-label="Concluir tarefa" ${b.checked?'checked':''}>`+field;
      if(b.type==='numbered')body=`<span class="editor-number" contenteditable="false">${b.number||1}.</span>`+field;
      if(b.type==='clue')body=`<div class="editable-board-clue"><span aria-hidden="true">◇</span>${field}<button type="button" class="btn outline small" data-select-clue="${i}">${b.itemId?'Trocar pista':'Escolher pista'}</button><button type="button" class="icon-btn" data-preview-clue="${i}" aria-label="Revelar pista">${icon('eye')}</button></div>`;
      if(b.type==='cue')body=`<div class="editable-cue"><span>♫</span>${field}<select aria-label="Efeito da cue" data-trigger-select="${i}"><option value="">Escolher efeito</option>${this.options.triggers.map(t=>`<option value="${esc(t.id)}" ${t.id===b.triggerId?'selected':''}>${esc(t.name)}</option>`).join('')}</select><button type="button" class="icon-btn" data-preview-cue="${i}" aria-label="Testar cue">${icon('play')}</button></div>`;
      if(b.type==='table')body=renderTable(b,this.options.pages,true,i)+`<div class="table-controls" contenteditable="false"><button type="button" data-table-action="row" data-table="${i}">+ Linha</button><button type="button" data-table-action="column" data-table="${i}">+ Coluna</button><button type="button" data-table-action="remove-row" data-table="${i}">− Linha</button><button type="button" data-table-action="remove-column" data-table="${i}">− Coluna</button></div>`;
      return textRunMarkup(this.blocks,i,`<div class="editor-block block-${b.type}" data-block-row="${i}">${tools}${body}</div>`);
    }).join('')+(this.options.columnContext&&!this.blocks.length?
      '<button type="button" class="column-write" data-start-column>Escreva aqui…</button>':'')+`<button type="button" class="add-block-line" data-add="${this.blocks.length-1}">${icon('plus')} Adicionar bloco <span>/</span></button>`;
    let typedShortcut=null,verifyRun=false;
    this.el.onbeforeinput=e=>{
      verifyRun=!e.cancelable;
      if(e.cancelable&&this.protectedSelection()){e.preventDefault();return;}
      // Native typing inside a column still belongs to the scene history.
      if(this.options.columnContext&&!e.inputType?.startsWith('history'))this.rememberBookmark({});
      if(e.target.matches('.editor-text-run')&&this.editRunInput(e)){e.preventDefault();return;}
      if(childIndex(e.target)!==null&&e.cancelable&&!e.isComposing){
        if(e.inputType==='historyUndo'||e.inputType==='historyRedo'){e.preventDefault();this.undo(e.inputType==='historyUndo'?-1:1);return;}
        if(this.editChildBoundary(e.target,e.inputType)) {e.preventDefault();return;}
      }
      if(e.cancelable&&e.inputType==='deleteContentBackward'&&!e.isComposing&&this.removeEmptyToggle(e.target)){
        e.preventDefault();
        return;
      }
      if(!typedShortcut||e.target!==(typedShortcut.field.closest('.editor-text-run')??typedShortcut.field)||e.isComposing||e.inputType!=='insertText'||e.data!==' '||!e.cancelable)return;
      const {field,marker}=typedShortcut;
      const parts=this.selectionParts(),index=+field.dataset.block;
      if(!parts?.collapsed||parts.startField!==field||parts.before!==marker||parts.after||field.textContent!==marker||this.blocks[index]?.type!=='paragraph'||this.blocks[index].text!==marker)return;
      e.preventDefault();
      this.active=index;
      this.blocks[index]=newBlock(writingShortcuts.get(marker),this.options.triggers);
      this.changed();
      this.render({index,offset:0});
    };
    this.el.oninput=e=>{
      typedShortcut=null;
      const key=e.target.dataset.toggleField;
      if(key){
        this.active=+e.target.dataset.block;
        this.activeChild=null;
        const text=e.target.innerText;
        this.blocks[this.active][key]=key==='title'?text.replace(/\n+/g,' '):text;
        this.changed(true);return;
      }
      const run=e.target.matches('.editor-text-run')?e.target:null;
      const field=run?runField(getSelection()?.focusNode):e.target.closest('[data-block]');
      if(!run&&!field)return;
      const expectedRows=run?Number(run.dataset.runEnd)-Number(run.dataset.runStart)+1:0;
      if(run&&(!field||!run.contains(field)||run.children.length!==expectedRows||verifyRun&&!intactTextRun(run))){
        this.render({index:this.active});return;
      }
      this.syncField(field);
      if(field){
        this.active=+field.dataset.block;
        this.activeChild=childIndex(field);
        const block=this.blocks[this.active];
        if(this.activeChild===null&&e.inputType==='insertText'&&block?.type==='paragraph'&&writingShortcuts.has(block.text)&&field.textContent===block.text)typedShortcut={field,marker:block.text};
      }
      this.changed(!e.inputType?.startsWith('format'));
    };
    this.el.onfocusin=e=>{
      if(this.options.columnContext)this.options.columnContext.activate(this);else this.columnEditor=null;
      const inRun=e.target.matches('.editor-text-run');
      const caret=inRun?runField(getSelection()?.focusNode):null;
      const field=inRun?(e.target.contains(caret)?caret:e.target.querySelector('[data-run-field]')):e.target.closest('[data-block]');
      if(!field)return;
      this.active=+field.dataset.block;this.activeChild=childIndex(field);
      this.activeCell=isCell(field)?{row:+field.dataset.cellRow,col:+field.dataset.cellCol}:null;
      const block=this.blocks[this.active];
      this.options.onActive?.(block.type,!isRichToggle(block));
    };
    this.el.onclick=e=>{
      if(e.target.closest('[data-start-column]')){this.writeInColumn();return;}
      const childMenu=e.target.closest('[data-child-menu]');
      if(childMenu){this.active=+childMenu.dataset.parent;this.activeChild=+childMenu.dataset.childMenu;this.menu(childMenu,'child');return;}
      const addChild=e.target.closest('[data-add-child]');
      if(addChild){this.active=+addChild.dataset.addChild;const children=this.blocks[this.active].blocks;children.push(newBlock());this.finishChildEdit(children.length-1,0);return;}
      const toggle=e.target.closest('[data-toggle-button]');
      if(toggle){
        const index=+toggle.dataset.toggleButton;
        const block=this.blocks[index],open=!this.openToggles.has(block);
        this.active=index;this.activeChild=null;
        if(open)this.openToggles.add(block);else this.openToggles.delete(block);
        toggle.setAttribute('aria-expanded',String(open));
        toggle.setAttribute('aria-label',open?'Recolher bloco':'Expandir bloco');
        toggle.closest('.script-toggle').querySelector('.script-toggle-content').hidden=!open;
        return;
      }
      const add=e.target.closest('[data-add]');if(add){this.active=+add.dataset.add;this.activeChild=null;this.menu(add,'add');return;}
      const menu=e.target.closest('[data-block-menu]');if(menu){this.active=+menu.dataset.blockMenu;this.activeChild=null;this.menu(menu,'edit');return;}
      const chooseClue=e.target.closest('[data-select-clue]');if(chooseClue)this.options.onRequestClue?.(+chooseClue.dataset.selectClue);const showClue=e.target.closest('[data-preview-clue]');if(showClue)this.options.onClue?.(this.blocks[+showClue.dataset.previewClue]);
      const preview=e.target.closest('[data-preview-cue]');if(preview)this.options.onCue(this.blocks[+preview.dataset.previewCue].triggerId);
      const action=e.target.closest('[data-table-action]');if(action)this.tableAction(+action.dataset.table,action.dataset.tableAction);
    };
    this.el.onchange=e=>{const {blockCheck,triggerSelect}=e.target.dataset;if(blockCheck!==undefined){this.blocks[+blockCheck].checked=e.target.checked;this.changed();}if(triggerSelect!==undefined){this.blocks[+triggerSelect].triggerId=e.target.value;this.changed();}};
    this.el.onpaste=e=>{
      if(this.protectedSelection()){e.preventDefault();return;}
      if(e.target.matches('.editor-text-run')){
        e.preventDefault();
        const parts=this.currentRun();
        if(!parts||!e.clipboardData)return;
        const entries=readClipboardBlocks(e.clipboardData);
        if(!entries.length||this.options.columnContext&&!entries.every(isColumnBlock))return;
        this.rememberRun(parts);
        this.finishRun(pasteTextBlocks(this.blocks,parts,entries));
        return;
      }
      if(e.target.dataset.toggleField==='title'){
        e.preventDefault();
        document.execCommand('insertText',false,e.clipboardData.getData('text/plain').replace(/[\r\n]+/g,' '));
      }else this.paste(e);
    };this.el.onkeydown=e=>this.keydown(e);
    this.el.oncompositionstart=e=>{
      if(!e.target.matches('.editor-text-run'))return;
      const selection=getSelection(),field=runField(selection?.anchorNode);
      if(!selection?.rangeCount||selection.isCollapsed||!field||!e.target.contains(field))return;
      if(field!==runField(selection.focusNode))selection.collapse(selection.anchorNode,selection.anchorOffset);
    };
    this.el.oncopy=e=>this.copyRun(e,false);
    this.el.oncut=e=>this.copyRun(e,true);
    const column=this.options.columnContext;
    this.el.ondragstart=e=>{
      const handle=e.target.closest('[data-drag]');
      if(handle){
        if(column)column.dragStart(e,+handle.dataset.drag);
        else{e.dataTransfer.setData(this.dragType,handle.dataset.drag);e.dataTransfer.effectAllowed='move';}
      }else if(e.target.closest('.rich-toggle-editor,.editor-text-run')||this.protectedSelection())e.preventDefault();
    };
    this.el.ondragenter=e=>{if(column)column.dragOver(e);};
    this.el.ondragover=e=>{
      if(column){column.dragOver(e);return;}
      if(e.dataTransfer.types.includes(this.dragType))e.preventDefault();
    };
    this.el.ondrop=e=>{
      if(column?.drop(e))return;
      const row=e.target.closest('[data-block-row]'),from=e.dataTransfer.getData(this.dragType);
      if(!row||from===''||!this.blocks[+from]||!this.blocks[+row.dataset.blockRow]){
        if(e.target.closest('.rich-toggle-editor,.editor-text-run')||this.protectedSelection())e.preventDefault();
        return;
      }
      e.preventDefault();
      const target=+row.dataset.blockRow,[b]=this.blocks.splice(+from,1);
      this.blocks.splice(target,0,b);this.active=target;this.activeChild=null;this.changed();this.render({index:target});
    };
    for(const name of ['beforeinput','input','focusin','click','change','paste','keydown','compositionstart','copy','cut','dragstart','dragenter','dragover','drop']){
      const handler=this.el['on'+name];
      this.el['on'+name]=event=>{if(this.owns(event.target))handler(event);};
    }
    this.columns?.attach(BlockEditor);
    if(focus!==null)this.focus(typeof focus==='number'?{index:focus}:focus);
  }
  focus({index=this.active,offset=null,cell=null,child=null,toggleField}={}){
    this.active=Math.max(0,Math.min(index,this.blocks.length-1));this.activeChild=child;
    if(this.blocks[this.active]?.type==='columns'&&this.columns?.focus({layout:this.active,column:0,block:0}))return;
    let field=this.ownField(`[data-block="${this.active}"]${child!==null?`[data-child="${child}"]`:cell?`[data-cell-row="${cell.row}"][data-cell-col="${cell.col}"]`:toggleField?`[data-toggle-field="${toggleField}"]`:''}`);
    if(field?.hasAttribute('data-run-field')){
      field.closest('.editor-text-run').focus({preventScroll:true});
      const point=pointAt(field,offset??textUnits(field));
      getSelection().setBaseAndExtent(...point,...point);
      this.options.onActive?.(this.blocks[this.active].type,true);
      const bounds=field.getBoundingClientRect();
      const pane=this.el.closest('.document-card')?.getBoundingClientRect();
      if(bounds.bottom<Math.max(0,pane?.top??0)||bounds.top>Math.min(innerHeight,pane?.bottom??innerHeight))field.scrollIntoView({block:'nearest'});
      return;
    }
    if(field?.dataset.toggleField&&offset===null){field.focus();return;}
    if(!field){(this.ownField(`[data-block-menu="${this.active}"]`)??this.el.querySelector('.add-block-line'))?.focus();return;}field.focus();const selection=getSelection(),range=document.createRange();range.selectNodeContents(field);range.collapse(false);
    if(offset!==null){const walker=document.createTreeWalker(field,4);let node,left=offset;while(node=walker.nextNode()){if(left<=node.textContent.length){range.setStart(node,left);range.collapse(true);break;}left-=node.textContent.length;}if(offset===0){range.setStart(field,0);range.collapse(true);}}
    selection.removeAllRanges();selection.addRange(range);
  }
  moveFocus(index){
    const range=this.range,node=range?.startContainer;
    const element=node?.nodeType===1?node:node?.parentElement;
    const field=this.fieldFor(node)??element?.closest('[data-toggle-field]');
    if(!field||!this.owns(field)||+field.dataset.block!==index||!field.contains(range.endContainer))return {};
    const prefix=range.cloneRange();
    prefix.selectNodeContents(field);
    prefix.setEnd(range.endContainer,range.endOffset);
    return {offset:textUnits(prefix.cloneContents()),child:childIndex(field),
      cell:isCell(field)?{row:+field.dataset.cellRow,col:+field.dataset.cellCol}:null,toggleField:field.dataset.toggleField};
  }
  fieldFor(node){const el=node?.nodeType===1?node:node?.parentElement;const field=el?.closest('[contenteditable=true][data-block],[data-run-field]');return field&&this.owns(field)?field:null;}
  protectedSelection(range){
    if(range===undefined){const selection=getSelection();range=selection?.rangeCount?selection.getRangeAt(0):null;}
    if(!range||range.collapsed||!range.intersectsNode(this.el))return false;
    const field=node=>(node.nodeType===1?node:node.parentElement)?.closest('[data-block]');
    const start=field(range.startContainer),end=field(range.endContainer);
    if(start&&start===end&&this.owns(start))return false;
    const firstRun=start?.closest('.editor-text-run'),lastRun=end?.closest('.editor-text-run');
    return !firstRun||firstRun!==lastRun||!this.owns(firstRun);
  }
  currentRun(){
    const selection=getSelection();
    const parts=selection?.rangeCount?runSelection(selection.getRangeAt(0)):null;
    return parts&&this.owns(parts.first)?parts:null;
  }
  copyRun(event,cut){
    if(this.protectedSelection()){event.preventDefault();return;}
    const selection=getSelection();
    if(!selection?.rangeCount||selection.isCollapsed||!event.clipboardData)return;
    const range=selection.getRangeAt(0),parts=runSelection(range);
    if(!parts)return;
    const blocks=selectedTextBlocks(this.blocks,parts,range);
    if(!blocks.length)return;
    event.preventDefault();
    writeTextBlocks(event.clipboardData,blocks,this.options.pages,this.el.ownerDocument);
    if(cut){this.rememberRun(parts);this.finishRun(replaceTextBlocks(this.blocks,parts));}
  }
  rememberRun(parts){
    this.rememberBookmark({
      start:parts.start,end:parts.end,startOffset:parts.startOffset,endOffset:parts.endOffset,backward:parts.backward,
    });
  }
  finishRun(focus){
    this.active=focus.index;this.activeChild=null;
    const offset=focus.special?null:this.runLength(focus.prefix??'');
    this.changed();
    if(offset!==null)this.rememberBookmark({start:focus.index,end:focus.index,startOffset:offset,endOffset:offset});
    this.render({index:focus.index,offset});
  }
  runLength(markdown){
    const box=document.createElement('div');box.innerHTML=inlineHTML(markdown,this.options.pages,true);return textUnits(box);
  }
  editRunInput(event){
    const type=event.inputType;
    if(!event.cancelable)return false;
    if(type==='historyUndo'||type==='historyRedo'){this.undo(type==='historyUndo'?-1:1);return true;}
    const selection=getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):null;
    const first=runField(range?.startContainer),last=runField(range?.endContainer);
    if(!first||!last||first.closest('.editor-text-run')!==event.target||last.closest('.editor-text-run')!==event.target)return true;
    const structural=type==='insertParagraph'||type==='insertLineBreak'||first!==last||
      (range.collapsed&&(type==='deleteContentBackward'||type==='deleteContentForward'));
    if(!structural)return (event.getTargetRanges?.()??[]).some(target=>runField(target.startContainer)!==first||runField(target.endContainer)!==first);
    const parts=runSelection(range);
    const {start,end,before,after,collapsed}=parts;
    if(type==='insertParagraph'){
      this.rememberRun(parts);
      const insertion=splitBlocks(this.blocks,start,end,before,after);
      this.finishRun({index:insertion.index,prefix:''});
      return true;
    }
    if(type==='insertLineBreak'){
      this.rememberRun(parts);this.finishRun(replaceTextBlocks(this.blocks,parts,'\n'));return true;
    }
    if(!collapsed&&start!==end){
      if(type.startsWith('delete')||type==='insertText'&&typeof event.data==='string'){
        this.rememberRun(parts);this.finishRun(replaceTextBlocks(this.blocks,parts,type==='insertText'?event.data:''));return true;
      }
      return true;
    }
    if(collapsed&&type==='deleteContentBackward'&&!before){
      if(this.blocks[start].type!=='paragraph'){
        this.rememberRun(parts);
        this.blocks[start]={type:'paragraph',text:after};
        this.finishRun({index:start,prefix:''});
      }else if(isTextBlock(this.blocks[start-1])){
        const previous=this.blocks[start-1].text;
        this.rememberRun(parts);
        this.finishRun(replaceTextBlocks(this.blocks,{start:start-1,end:start,before:previous,after}));
      }
      return true;
    }
    if(collapsed&&type==='deleteContentForward'&&!after){
      if(isTextBlock(this.blocks[start+1])){
        this.rememberRun(parts);
        this.finishRun(replaceTextBlocks(this.blocks,{start,end:start+1,before,after:this.blocks[start+1].text}));
      }
      return true;
    }
    // Reject browser target ranges outside the active field (word deletion, drag, spellcheck).
    return (event.getTargetRanges?.()??[]).some(range=>runField(range.startContainer)!==parts.first||runField(range.endContainer)!==parts.first);
  }

  selectionParts(){
    const s=getSelection();if(!s.rangeCount)return null;const range=s.getRangeAt(0),start=this.fieldFor(range.startContainer),end=this.fieldFor(range.endContainer);if(!start||!end)return null;
    const before=range.cloneRange();before.selectNodeContents(start);before.setEnd(range.startContainer,range.startOffset);const after=range.cloneRange();after.selectNodeContents(end);after.setStart(range.endContainer,range.endOffset);
    const read=(r,field)=>{const box=document.createElement('div');box.append(r.cloneContents());return editableToMarkdown(box,{trim:childIndex(field)===null});};
    return {range,startField:start,endField:end,start:+start.dataset.block,end:+end.dataset.block,before:read(before,start),after:read(after,end),collapsed:range.collapsed};
  }
  finishChildEdit(child,offset=null){
    this.activeChild=child;
    this.changed();
    this.render({index:this.active,child,offset});
  }
  editChildBoundary(field,inputType){
    if(!['insertParagraph','deleteContentBackward','deleteContentForward'].includes(inputType))return false;
    const parts=this.selectionParts();
    if(!parts||parts.startField!==field||parts.endField!==field)return true;
    const index=+field.dataset.block,child=childIndex(field),children=this.blocks[index].blocks;
    const {before,after,collapsed}=parts;
    const empty=!field.textContent&&!field.querySelector('[data-markdown]')&&field.childNodes.length<=1;
    this.active=index;
    if(inputType==='insertParagraph'){
      this.finishChildEdit(splitBlocks(children,child,child,empty?'':before,empty?'':after).index,0);
      return true;
    }
    if(!collapsed)return false;
    if(inputType==='deleteContentBackward'&&(!before||empty)){
      if(!child)return true;
      const previous=children[child-1],offset=this.plainLength(previous.text);
      if(!empty&&previous.type!==children[child].type){this.focus({index,child:child-1});return true;}
      previous.text+=children[child].text;
      children.splice(child,1);
      this.finishChildEdit(child-1,offset);
      return true;
    }
    if(inputType==='deleteContentForward'&&(!after||empty))return true;
    return false;
  }
  removeEmptyToggle(field){
    if(field.dataset.toggleField!=='title')return false;
    const index=+field.dataset.block,block=this.blocks[index],selection=getSelection();
    if(block?.type!=='toggle'||isRichToggle(block)||block.title.trim()||block.text.trim()||field.textContent.trim()||
      !selection?.isCollapsed||!field.contains(selection.anchorNode))return false;
    this.blocks.splice(index,1);
    const previous=this.blocks.slice(0,index).findLastIndex(block=>block.type!=='divider');
    const next=this.blocks.findIndex((block,i)=>i>=index&&block.type!=='divider');
    if(previous<0&&next<0)this.blocks.splice(index,0,newBlock());
    this.active=previous>=0?previous:next>=0?next:index;
    this.changed();
    this.render({index:this.active,offset:previous>=0?null:0});
    return true;
  }
  keydown(e){
    if(e.isComposing)return;
    const run=e.target.matches('.editor-text-run')?e.target:null;
    const selection=getSelection();
    const field=run?[runField(selection?.focusNode),runField(selection?.anchorNode)].find(node=>run.contains(node))??
      run.querySelector('[data-run-field]'):e.target.closest('[data-block]');
    if(!field){
      const key=e.key.toLowerCase();
      if(e.target.closest('[data-columns-layout]')&&(e.ctrlKey||e.metaKey)&&['z','y'].includes(key)){
        e.preventDefault();this.undo(key==='y'||e.shiftKey?1:-1);
      }
      return;
    }
    if(['Enter','Backspace','Delete'].includes(e.key)&&this.protectedSelection()){e.preventDefault();return;}
    if(e.key==='Backspace'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&this.removeEmptyToggle(field)){
      e.preventDefault();
      return;
    }
    if(field.dataset.toggleField==='title'&&e.key==='Enter'){
      e.preventDefault();
      const toggle=field.closest('.script-toggle').querySelector('[data-toggle-button]');
      if(toggle.getAttribute('aria-expanded')==='false')toggle.click();
      const content=field.closest('.script-toggle').querySelector('.script-toggle-content');
      content.querySelector('[data-toggle-field=text],[data-child],[data-add-child]')?.focus();
      return;
    }
    const mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
    if(mod&&key==='z'){e.preventDefault();this.undo(e.shiftKey?1:-1);return;}if(mod&&key==='y'){e.preventDefault();this.undo(1);return;}
    if(!this.owns(field)||field.dataset.toggleField)return;
    const protectedRange=this.protectedSelection();
    this.active=+field.dataset.block;this.activeChild=childIndex(field);const b=this.blocks[this.active];
    if(mod&&['b','i','e'].includes(key)){e.preventDefault();this.captureSelection(true);this.format({b:'bold',i:'italic',e:'code'}[key]);return;}
    if(mod&&key==='k'){e.preventDefault();const parts=this.currentRun();if(!protectedRange&&(!parts||parts.start===parts.end)){this.captureSelection();this.options.onRequestLink();}return;}
    if(this.activeChild!==null){
      const operation={Enter:'insertParagraph',Backspace:'deleteContentBackward',Delete:'deleteContentForward'}[e.key];
      if(operation&&!mod&&!e.altKey&&!(e.shiftKey&&e.key==='Enter')&&this.editChildBoundary(field,operation))e.preventDefault();
      return;
    }
    if(mod&&e.altKey&&['1','2','3','0'].includes(key)){e.preventDefault();if(protectedRange)return;this.setType(key==='0'?'paragraph':'h'+key);return;}
    if(field.hasAttribute('data-run-field')){
      if(mod&&key==='a'){
        e.preventDefault();
        const fields=field.closest('.editor-text-run').querySelectorAll('[data-run-field]');
        getSelection().setBaseAndExtent(fields[0],0,fields[fields.length-1],fields[fields.length-1].childNodes.length);
        return;
      }
      if(this.currentRun()?.collapsed){
        if(e.key==='/'&&!field.textContent.trim()){e.preventDefault();this.menu(field,'convert');return;}
        if(e.key===' '){const shortcuts={'-':'list','*':'list','1.':'numbered','[]':'todo','[ ]':'todo','---':'divider'},type=shortcuts[field.textContent];if(type&&this.canUseType(type)){e.preventDefault();b.text='';this.setType(type);}}
      }
      return;
    }
    const parts=this.selectionParts();if(!parts)return;
    if((isCell(parts.startField)||isCell(parts.endField))&&parts.startField!==parts.endField&&['Enter','Backspace','Delete'].includes(e.key)){e.preventDefault();return;}
    if(isCell(field)){
      if(e.key==='Tab'||e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.syncField(field);const width=b.headers.length;let n=+field.dataset.cellRow*width+(+field.dataset.cellCol)+(e.key==='Tab'?(e.shiftKey?-1:1):width);n=Math.max(0,n);if(n>=(b.rows.length+1)*width)b.rows.push(b.headers.map(()=>''));this.changed();this.render({index:this.active,cell:{row:Math.floor(n/width),col:n%width},offset:0});}
      if(e.key==='Backspace'&&parts.collapsed&&!field.textContent)e.preventDefault();return;
    }
    if(parts.start!==parts.end&&['Enter','Backspace','Delete'].includes(e.key)&&this.blocks.slice(parts.start,parts.end+1).some(block=>block.type==='toggle')){e.preventDefault();return;}
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.syncDOM();const focus=splitBlocks(this.blocks,parts.start,parts.end,parts.before,parts.after);this.active=focus.index;this.changed();this.render(focus);return;}
    if(parts.collapsed&&(e.key==='Backspace'&&!parts.before||e.key==='Delete'&&!parts.after)){e.preventDefault();return;}
    if(e.key==='/'&&!field.textContent.trim()){e.preventDefault();this.menu(field,'convert');return;}
    if(e.key===' '&&parts.collapsed&&!parts.after){const shortcuts={'-':'list','*':'list','1.':'numbered','[]':'todo','[ ]':'todo','---':'divider'},type=shortcuts[field.textContent];if(type&&this.canUseType(type)){e.preventDefault();b.text='';this.setType(type);}}
  }
  plainLength(markdown){const box=document.createElement('div');box.innerHTML=inlineHTML(markdown,this.options.pages);return box.textContent.length;}
  add(index,type='paragraph'){if(!this.canUseType(type))return;const block=newBlock(type,this.options.triggers);this.blocks.splice(index,0,block);if(isRichToggle(block))this.openToggles.add(block);this.active=index;this.activeChild=null;this.changed();this.render({index,offset:0});if(type==='clue')this.options.onRequestClue?.(index);}
  setType(type){
    if(this.columnEditor){this.columnEditor.setType(type);return;}
    const prior=this.blocks[this.active];if(!prior||prior.type==='columns'||!BLOCK_TYPES[type]||isRichToggle(prior)||!this.canUseType(type))return;
    if(this.options.columnContext&&prior.type===type)return;
    if(type==='richToggle'){
      if(!TOGGLE_CHILD_TYPES.includes(prior.type))return;
      const block=newBlock(type);
      block.blocks[0]={type:prior.type,text:prior.text};
      this.blocks[this.active]=block;
      this.openToggles.add(block);
    }else if(type==='table'&&prior.type!=='table'){this.blocks[this.active]=newBlock(type);if(prior.text)this.blocks[this.active].rows[0][0]=prior.text;}
    else if(prior.type==='table'&&type!=='table')this.blocks[this.active]={...newBlock(type,this.options.triggers),text:[prior.headers,...prior.rows].map(r=>r.join(' · ')).join('\n')};
    else if(prior.type==='toggle'&&type!=='toggle')this.blocks[this.active]={...newBlock(type,this.options.triggers),text:[prior.title,prior.text].filter(Boolean).join('\n')};
    else if(this.options.columnContext)this.blocks[this.active]={...newBlock(type,this.options.triggers),text:prior.text};
    else this.blocks[this.active]={...newBlock(type,this.options.triggers),...prior,type};
    this.activeChild=null;this.changed();this.render({index:this.active,offset:0});if(type==='clue')this.options.onRequestClue?.(this.active);
  }
  undo(direction){
    if(this.options.columnContext){this.options.columnContext.undo(direction);return;}
    const entry=this.history.move(direction);if(!entry)return;
    const stayInChild=entry.child==null&&this.activeChild!==null&&isRichToggle(entry.blocks[this.active]);
    const index=stayInChild?this.active:entry.active;
    const children=entry.blocks[index]?.blocks;
    const child=children?.length&&(entry.child!=null||stayInChild)?Math.min(entry.child??this.activeChild,children.length-1):null;
    this.blocks=entry.blocks;
    if(child!==null)this.openToggles.add(this.blocks[index]);
    this.options.onChange(this.serialize());
    const bookmark=entry.bookmark,scope=bookmark?.scope??entry.scope;
    if(scope){
      this.render();
      if(this.columns.focus(scope,bookmark))return;
    }else if(!bookmark){this.render({index,child});return;}
    else this.render();
    this.restoreBookmark(bookmark,{index,child});
  }
  restoreBookmark(bookmark,fallback){
    this.focus(bookmark?.start!==undefined?{...fallback,index:bookmark.start,offset:bookmark.startOffset}:fallback);
    if(bookmark?.start!==undefined&&bookmark.start!==bookmark.end){
      const first=this.ownField(`[data-run-field][data-block="${bookmark.start}"]`);
      const last=this.ownField(`[data-run-field][data-block="${bookmark.end}"]`);
      if(first&&last&&first.closest('.editor-text-run')===last.closest('.editor-text-run')){
        this.selectTextRun(first,last,bookmark);
      }
    }
  }
  selectTextRun(first,last,parts){
    const start=pointAt(first,parts.startOffset),end=pointAt(last,parts.endOffset);
    getSelection().setBaseAndExtent(...(parts.backward?end:start),...(parts.backward?start:end));
  }
  formatRun(range,command,value,backward=this.rangeBackward){
    if(this.protectedSelection(range)||range.collapsed)return;
    const parts=runSelection(range);
    if(!parts||parts.start===parts.end)return;
    const run=parts.first.closest('.editor-text-run');
    const fields=[...run.querySelectorAll('[data-run-field]')].filter(field=>+field.dataset.block>=parts.start&&+field.dataset.block<=parts.end);
    if(fields.length!==parts.end-parts.start+1||!this.blocks.slice(parts.start,parts.end+1).every(isTextBlock))return;
    parts.backward=backward;
    const changes=formatTextFields(fields,parts,this.options.pages,command,value);
    if(!changes||!this.options.columnContext&&changes.some(({field,text})=>!preservesMarkdownBlock(this.blocks[+field.dataset.block],text))){
      const status=document.querySelector('#editorSelectionToolbar [role="status"]');
      if(status)status.textContent='A formatação deste trecho foi preservada.';
      return;
    }
    if(!changes.length)return;
    const status=document.querySelector('#editorSelectionToolbar [role="status"]');
    if(status)status.textContent='';
    this.active=parts.backward?parts.start:parts.end;
    this.activeChild=null;
    this.rememberRun(parts);
    for(const {field,text,html} of changes){
      this.blocks[+field.dataset.block].text=text;
      field.innerHTML=html;
    }
    run.focus({preventScroll:true});
    this.selectTextRun(parts.first,parts.last,parts);
    this.changed();
    this.rememberRun(parts);
    this.selectionToolbar();
  }
  captureSelection(local=false){
    const selection=getSelection();
    if(!local&&this.columnEditor){this.columnEditor.captureSelection(true);return;}
    if(!selection.rangeCount||!this.owns(selection.anchorNode))return;
    this.range=selection.getRangeAt(0).cloneRange();
    this.rangeBackward=selection.anchorNode===this.range.endContainer&&selection.anchorOffset===this.range.endOffset;
    const field=selection.isCollapsed?runField(selection.focusNode):null;
    if(field&&field.closest('.editor-text-run')===document.activeElement&&this.active!==+field.dataset.block){
      this.active=+field.dataset.block;this.activeChild=null;
      this.options.onActive?.(this.blocks[this.active].type,true);
    }
  }
  format(command){
    if(this.columnEditor){this.columnEditor.format(command);return;}
    if(this.range&&this.owns(this.range.startContainer)){
      const {startContainer,startOffset,endContainer,endOffset}=this.range;
      const start=[startContainer,startOffset],end=[endContainer,endOffset];
      getSelection().setBaseAndExtent(...(this.rangeBackward?end:start),...(this.rangeBackward?start:end));
    }
    const s=getSelection();if(!s.rangeCount||!this.el.contains(s.anchorNode))return;
    const range=s.getRangeAt(0),parts=runSelection(range);
    if(this.protectedSelection(range))return;
    if(parts&&parts.start!==parts.end){this.formatRun(range,command);return;}
    if(command==='code'){const range=s.getRangeAt(0);if(range.collapsed||this.fieldFor(range.startContainer)!==this.fieldFor(range.endContainer))return;const code=document.createElement('code');code.textContent=range.toString();range.deleteContents();range.insertNode(code);range.selectNodeContents(code);s.removeAllRanges();s.addRange(range);}else document.execCommand(command,false);
    const field=this.fieldFor(s.anchorNode);
    if(childIndex(field)!==null||field?.hasAttribute('data-run-field'))this.syncField(field);else this.syncDOM();
    this.changed();this.captureSelection();
  }
  setClueBlock(index,block){this.syncDOM();this.blocks[index]=block;this.active=index;this.activeChild=null;this.changed();this.render({index});}
  insertClueBlock(block){
    if(this.columnEditor){
      const index=this.active+1;
      this.blocks.splice(index,0,block);this.active=index;this.activeChild=null;
      this.changed();this.render({index});return;
    }
    this.syncDOM();if(this.range&&this.el.contains(this.range.startContainer)){const selection=getSelection(),range=this.range.cloneRange();range.collapse(false);selection.removeAllRanges();selection.addRange(range);}else this.focus({index:this.active});
    const parts=this.selectionParts();if(!parts||isCell(parts.startField)||this.blocks.slice(parts.start,parts.end+1).some(block=>block.type==='toggle')){const index=this.active+1;this.blocks.splice(index,0,block);this.active=index;}else{const insert=[];if(parts.before)insert.push({...this.blocks[parts.start],text:parts.before});insert.push(block);if(parts.after)insert.push({...this.blocks[parts.end],text:parts.after});this.blocks.splice(parts.start,parts.end-parts.start+1,...insert);this.active=parts.start+(parts.before?1:0);}
    this.activeChild=null;this.changed();this.render({index:this.active});
  }
  insertLink(page){
    if(this.columnEditor){this.columnEditor.insertLink(page);return;}
    if(this.range&&this.owns(this.range.startContainer)){const s=getSelection();s.removeAllRanges();s.addRange(this.range);}else this.focus({index:this.active});
    const selection=getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);
    const parts=runSelection(range);
    if(parts&&parts.start!==parts.end)return;
    const start=this.fieldFor(range.startContainer),end=this.fieldFor(range.endContainer);
    if(!start||!end||this.el.querySelector('[data-toggle-field]:focus')||this.protectedSelection(range))return;
    const token=document.createElement('span');token.className='wiki-token';token.contentEditable='false';token.dataset.markdown=`[[page:${page.id}|${page.title}]]`;token.textContent='↗ '+page.title;range.deleteContents();range.insertNode(token);range.setStartAfter(token);range.collapse(true);selection.removeAllRanges();selection.addRange(range);
    if(childIndex(start)!==null||start.hasAttribute('data-run-field'))this.syncField(start);else this.syncDOM();
    this.changed();this.captureSelection();
  }
  paste(e){
    const field=e.target.closest('[contenteditable=true][data-block]');if(!field)return;e.preventDefault();const text=e.clipboardData.getData('text/plain'),html=e.clipboardData.getData('text/html'),blocks=clipboardBlocks({html,text});
    const child=childIndex(field);
    if(child!==null){
      const parts=this.selectionParts();
      if(!parts||parts.startField!==field||parts.endField!==field||!blocks.length||!blocks.every(block=>TOGGLE_CHILD_TYPES.includes(block.type)))return;
      this.active=+field.dataset.block;
      const children=this.blocks[this.active].blocks;
      const {before,after}=parts;
      if(before||(blocks.length===1&&(after||blocks[0].type==='paragraph')))blocks[0].type=children[child].type;
      blocks[0].text=before+blocks[0].text;
      const last=blocks.at(-1),offset=this.plainLength(last.text);
      last.text+=after;
      children.splice(child,1,...blocks);
      this.finishChildEdit(child+blocks.length-1,offset);
      return;
    }
    if(isCell(field)){const b=this.blocks[+field.dataset.block];if(blocks.length===1&&blocks[0].type==='table'){const grid=[blocks[0].headers,...blocks[0].rows],r=+field.dataset.cellRow,c=+field.dataset.cellCol;while(b.headers.length<c+grid[0].length){b.headers.push('');b.rows.forEach(row=>row.push(''));}while(b.rows.length<r+grid.length-1)b.rows.push(b.headers.map(()=>''));grid.forEach((row,y)=>row.forEach((value,x)=>{if(r+y===0)b.headers[c+x]=value;else b.rows[r+y-1][c+x]=value;}));this.changed();this.render({index:+field.dataset.block,cell:{row:r,col:c}});}else{document.execCommand('insertHTML',false,inlineHTML(blocks.map(b=>b.text||'').join('\n'),this.options.pages,true));this.syncField(field);this.changed();}return;}
    const parts=this.selectionParts();if(!parts||isCell(parts.startField)||isCell(parts.endField)||parts.start!==parts.end&&this.blocks.slice(parts.start,parts.end+1).some(block=>block.type==='toggle'))return;
    if(blocks.length===1&&blocks[0].type==='paragraph'&&parts.start===parts.end){document.execCommand('insertHTML',false,inlineHTML(blocks[0].text,this.options.pages,true));this.syncField(field);this.changed();return;}
    const inserted=[];if(parts.before)inserted.push({...this.blocks[parts.start],text:parts.before});inserted.push(...blocks);if(parts.after)inserted.push({type:'paragraph',text:parts.after});this.blocks.splice(parts.start,parts.end-parts.start+1,...inserted);this.active=parts.start+inserted.length-1;this.changed();this.render({index:this.active});
  }
  tableAction(index,action){const b=this.blocks[index];this.active=index;const r=this.activeCell?.row??b.rows.length,c=this.activeCell?.col??b.headers.length-1;if(action==='row')b.rows.splice(Math.max(0,r),0,b.headers.map(()=>''));if(action==='column'){b.headers.splice(c+1,0,'');b.rows.forEach(row=>row.splice(c+1,0,''));b.align?.splice(c+1,0,'left');}if(action==='remove-row'&&b.rows.length)b.rows.splice(Math.max(0,r-1),1);if(action==='remove-column'&&b.headers.length>1){b.headers.splice(c,1);b.rows.forEach(row=>row.splice(c,1));b.align?.splice(c,1);}this.changed();this.render({index,cell:{row:Math.min(r,b.rows.length),col:Math.min(c,b.headers.length-1)},offset:0});}
  hideToolbar(){document.getElementById('editorSelectionToolbar')?.remove();}
  selectionToolbar(){
    const selection=getSelection();
    if(!selection.rangeCount||selection.isCollapsed||!this.el.contains(selection.anchorNode)||!this.el.isConnected||this.protectedSelection(selection.getRangeAt(0))){this.hideToolbar();return;}
    const range=selection.getRangeAt(0);
    const first=runField(range.startContainer),last=runField(range.endContainer);
    const multi=first&&last&&first!==last;
    const edge=range.cloneRange();
    edge.setStart(selection.focusNode,selection.focusOffset);edge.collapse(true);
    const rect=edge.getBoundingClientRect(),fallback=range.getBoundingClientRect();
    const target=rect.height?rect:fallback;
    const pane=this.el.closest('.document-card')?.getBoundingClientRect();
    if(!target.height||target.bottom<Math.max(0,pane?.top??0)||target.top>Math.min(innerHeight,pane?.bottom??innerHeight)){this.hideToolbar();return;}
    this.captureSelection();
    let bar=document.getElementById('editorSelectionToolbar');
    if(!bar){
      bar=document.createElement('div');
      bar.id='editorSelectionToolbar';
      bar.className='selection-toolbar';
      bar.setAttribute('role','toolbar');
      bar.setAttribute('aria-label','Formatar seleção');
      const choices=(channel,highlight)=>scriptColors.map(([color,label])=>{
        const name=highlight?(color==='none'?'Sem destaque':label+' suave'):label;
        return `<button type="button" data-channel="${channel}" data-color="${color}"><span aria-hidden="true" data-cris-ink="${highlight?'none':color}" data-cris-highlight="${highlight?color:'none'}">A</span>${name}</button>`;
      }).join('');
      bar.innerHTML='<button type="button" data-format="bold" title="Negrito (Ctrl+B)"><b>B</b></button><button type="button" data-format="italic" title="Itálico (Ctrl+I)"><em>I</em></button><button type="button" data-format="strikeThrough" title="Tachado"><s>S</s></button><button type="button" data-format="code" title="Código">&lt;/&gt;</button><button type="button" data-link title="Link interno">'+icon('link')+'</button>'+
        `<button type="button" data-open-colors aria-expanded="false" aria-controls="scriptColors">Cor</button><div id="scriptColors" class="script-color-menu" hidden><div role="group" aria-label="Cor do texto"><strong>Cor do texto</strong>${choices('crisInk',false)}</div><div role="group" aria-label="Destaque"><strong>Destaque</strong>${choices('crisHighlight',true)}</div></div><span class="selection-status" role="status"></span>`;
      bar.onpointerdown=e=>e.preventDefault();
      bar.onclick=e=>{
        const button=e.target.closest('button');
        if(!button)return;
        if(button.dataset.format)bar.editor.format(button.dataset.format);
        if(button.hasAttribute('data-link'))bar.editor.options.onRequestLink();
        if(button.hasAttribute('data-open-colors'))this.showColors(bar,bar.querySelector('.script-color-menu').hidden);
        if(button.dataset.channel){
          bar.editor.applyColor(button.dataset.channel,button.dataset.color);
          this.showColors(bar,false);
        }
      };
      bar.onkeydown=e=>{if(e.key==='Escape')this.showColors(bar,false);};
      document.body.append(bar);
    }
    bar.editor=this;
    for(const button of bar.querySelectorAll('[data-format="strikeThrough"],[data-format="code"],[data-link]'))button.hidden=!!multi;
    const colorButton=bar.querySelector('[data-open-colors]');
    colorButton.hidden=!multi&&!this.colorField(range);
    if(colorButton.hidden)this.showColors(bar,false);
    const width=bar.offsetWidth,height=bar.offsetHeight;
    bar.style.left=Math.max(8,Math.min(target.left,innerWidth-width-8))+'px';
    const above=target.top-height-6,below=target.bottom+6;
    bar.style.top=Math.max(8,Math.min(above>=8?above:below,innerHeight-height-8))+'px';
    if(!bar.querySelector('.script-color-menu').hidden)this.showColors(bar,true);
  }
  colorField(range){
    if(!range||range.collapsed)return null;
    const field=this.fieldFor(range.startContainer);
    if(!field||field!==this.fieldFor(range.endContainer))return null;
    const block=this.blocks[+field.dataset.block],child=childIndex(field);
    if(!TOGGLE_CHILD_TYPES.includes((child===null?block:block?.blocks?.[child])?.type))return null;
    const insideLink=node=>(node.nodeType===1?node:node.parentElement)?.closest('.wiki-token');
    if(insideLink(range.startContainer)||insideLink(range.endContainer))return null;
    return field;
  }
  showColors(bar,open){
    const menu=bar.querySelector('.script-color-menu');
    menu.hidden=!open;
    bar.querySelector('[data-open-colors]').setAttribute('aria-expanded',String(open));
    if(open){
      const rect=bar.getBoundingClientRect();
      const below=innerHeight-rect.bottom,above=rect.top;
      const placeAbove=above>below;
      menu.classList.toggle('above',placeAbove);
      menu.style.maxHeight=Math.max(0,(placeAbove?above:below)-12)+'px';
    }
  }
  applyColor(channel,color){
    const range=this.range;
    const parts=runSelection(range);
    if(parts&&parts.start!==parts.end){this.formatRun(range,channel,color);return;}
    const field=this.colorField(range);
    if(!field)return;
    recolorRange(field,range,channel,color);
    const selection=getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    this.active=+field.dataset.block;
    this.activeChild=childIndex(field);
    this.syncField(field);
    this.changed();
    this.captureSelection();
  }
  writeInColumn(){
    const last=this.blocks.at(-1);
    if(last?.type==='paragraph'&&!last.text)this.focus({index:this.blocks.length-1,offset:0});
    else this.add(this.blocks.length);
  }
  addColumns(index,count){
    const layout=newColumns(count);
    layout.columns[0].blocks.push(newBlock());
    this.blocks.splice(index,0,layout);this.active=index;this.activeChild=null;
    this.changed(false,{layout:index,column:0,block:0});this.render({index});
  }
  menu(anchor,mode){
    const index=this.active,block=this.blocks[index];
    const childMenu=mode==='child';
    const canTransform=mode!=='edit'||!isRichToggle(block);
    const availableTypes=Object.entries(BLOCK_TYPES).filter(([type])=>childMenu?TOGGLE_CHILD_TYPES.includes(type):
      this.canUseType(type)&&(type!=='richToggle'||mode==='add'||TOGGLE_CHILD_TYPES.includes(block?.type)));
    const colors=mode==='edit'&&block?.type==='toggle' ? `<div class="toggle-background-picker" role="group" aria-label="Fundo do Recolhível"><span>Fundo</span><div>${scriptColors.map(([color,name])=>{
      const label=color==='none'?'Sem fundo':name;
      return `<button type="button" data-toggle-color="${color}"${toggleBackgroundAttribute(color)} aria-label="${label}" title="${label}" aria-pressed="${color===(block.background??'none')}"></button>`;
    }).join('')}</div></div>` : '';
    document.getElementById('blockPopover')?.remove();const menu=document.createElement('div');menu.id='blockPopover';menu.className='block-popover searchable-block-menu';menu.setAttribute('role','dialog');menu.setAttribute('aria-label',canTransform?'Inserir ou transformar bloco':'Menu do Recolhível');
    menu.innerHTML=(canTransform?'<label class="block-menu-search">'+icon('search')+'<input type="search" placeholder="Buscar bloco…" aria-label="Buscar tipo de bloco"></label>':'')+colors+(canTransform?'<div class="block-menu-results"></div>':'')+(childMenu?'<hr><button type="button" class="danger-text" data-remove-child>Excluir bloco interno</button>':mode==='edit'?'<hr><button type="button" data-move="-1">↑ Mover para cima</button><button type="button" data-move="1">↓ Mover para baixo</button><button type="button" data-duplicate>Duplicar bloco</button><button type="button" class="danger-text" data-remove>Excluir bloco</button>':'');document.body.append(menu);
    if(mode==='edit'&&this.options.columnContext){
      menu.insertAdjacentHTML('beforeend',this.options.columnContext.destinations().map(column=>
        `<button type="button" data-move-column="${column}">Mover para coluna ${column+1}</button>`
      ).join(''));
    }
    menu.querySelector('.toggle-background-picker')?.addEventListener('click',event=>{
      const button=event.target.closest('[data-toggle-color]');
      if(!button)return;
      event.stopPropagation();
      const color=toggleBackground(button.dataset.toggleColor);
      if(block.background===color||this.blocks[index]!==block||!this.el.contains(anchor))return;
      const wrapper=anchor.closest('.block-toggle').querySelector('.script-toggle');
      if(color){block.background=color;wrapper.dataset.toggleBackground=color;}
      else{delete block.background;delete wrapper.dataset.toggleBackground;}
      menu.querySelector('[data-toggle-color][aria-pressed="true"]')?.setAttribute('aria-pressed','false');
      button.setAttribute('aria-pressed','true');
      this.active=index;
      this.changed();
    });
    const results=menu.querySelector('.block-menu-results'),search=menu.querySelector('input');
    if(search){const update=()=>{results.innerHTML=availableTypes.filter(([type,label])=>(label+' '+type).toLocaleLowerCase().includes(search.value.toLocaleLowerCase())).map(([type,label])=>`<button type="button" data-type="${type}"><b>${({paragraph:'T',h1:'H₁',h2:'H₂',h3:'H₃',quote:'❞',note:'✦',toggle:'▸',richToggle:'▸',list:'•',numbered:'1.',todo:'☑',table:'▦',cue:'♫',clue:'◇',divider:'—'})[type]}</b>${label}</button>`).join('');
      if(mode==='add'&&!this.options.columnContext&&'colunas'.includes(search.value.toLocaleLowerCase().trim())){
        const choice='<button type="button" data-column-layout-choice><b>▥</b>Colunas</button>';
        if(results.firstElementChild)results.firstElementChild.insertAdjacentHTML('afterend',choice);
        else results.insertAdjacentHTML('beforeend',choice);
      }
      if(!results.children.length)results.innerHTML='<p>Nenhum bloco encontrado.</p>';
    };update();search.oninput=update;}
    const rect=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-250))+'px';menu.style.top=Math.max(8,Math.min(rect.bottom+6,innerHeight-430))+'px';
    menu.onclick=e=>{const button=e.target.closest('button');if(!button)return;const type=button.dataset.type;
      if(button.hasAttribute('data-column-layout-choice')){
        results.innerHTML='<button type="button" data-layout-count="2">Duas colunas</button><button type="button" data-layout-count="3">Três colunas</button>';
        results.querySelector('button').focus();return;
      }
      if(button.dataset.layoutCount){this.addColumns(index+1,+button.dataset.layoutCount);menu.remove();return;}
      if(button.dataset.moveColumn!==undefined){this.options.columnContext.move(index,+button.dataset.moveColumn);menu.remove();return;}
      if(childMenu){
        const children=block.blocks,child=+anchor.dataset.childMenu;
        if(type&&TOGGLE_CHILD_TYPES.includes(type)){
          children[child].type=type;
          this.finishChildEdit(child);
        }else if(button.hasAttribute('data-remove-child')){
          children.splice(child,1);
          if(!children.length)children.push(newBlock());
          this.finishChildEdit(Math.min(child,children.length-1),0);
        }
        menu.remove();return;
      }
      if(type)mode==='add'?this.add(this.active+1,type):this.setType(type);if(button.dataset.move){const target=this.active+Number(button.dataset.move);if(target>=0&&target<this.blocks.length){[this.blocks[this.active],this.blocks[target]]=[this.blocks[target],this.blocks[this.active]];this.active=target;this.changed();this.render({index:target});}}if(button.hasAttribute('data-duplicate')){this.blocks.splice(this.active+1,0,structuredClone(this.blocks[this.active]));this.active++;this.changed();this.render({index:this.active});}if(button.hasAttribute('data-remove')){this.blocks.splice(this.active,1);if(!this.blocks.length&&!this.options.columnContext)this.blocks.push(newBlock());this.active=Math.max(0,this.active-1);this.changed();this.render({index:this.active});}menu.remove();};
    menu.onkeydown=e=>{
      const buttons=[...menu.querySelectorAll('button:not(:disabled)')];
      if(e.key==='Escape'){
        e.preventDefault();menu.remove();
        this.focus({index:this.active,child:this.activeChild});
      }
      if(buttons.length&&['ArrowDown','ArrowUp'].includes(e.key)){
        e.preventDefault();
        const current=buttons.indexOf(document.activeElement);
        const next=current<0?(e.key==='ArrowDown'?0:buttons.length-1):current+(e.key==='ArrowDown'?1:-1);
        buttons[(next+buttons.length)%buttons.length].focus();
      }
      if(e.key==='Enter'&&e.target===search){e.preventDefault();results.querySelector('button')?.click();}
    };
    const close=event=>{if(!menu.contains(event.target)){menu.remove();document.removeEventListener('pointerdown',close);}};document.addEventListener('pointerdown',close,{signal:this.abort.signal});(search??menu.querySelector('[aria-pressed=true]')).focus();
  }
}
