import {scriptColors,toggleBackground,toggleBackgroundAttribute} from './editor-colors.js';
import {addColumn,removeColumn,moveColumnBlock,columnTracks,resizedWidths,MIN_COLUMN_WIDTH} from './editor-columns-model.js';
import {blocksToMarkdown,parseBlocks} from './markdown.js';
import {runSelection} from './editor-text-runs.js';

export const EDITOR_SURFACE = '[data-editor-surface]';

export function editableColumnsHTML(layout,index) {
  const three=layout.columns.length===3;
  const dividers=layout.columns.slice(0,-1).map((_,i)=>
    `<div class="script-column-divider" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Ajustar colunas ${i+1} e ${i+2}" data-column-divider="${i}"></div>`
  );
  const groups=layout.columns.map((column,i)=>{
    const target=i===0?2:i;
    return `<section class="script-column" aria-label="Coluna ${i+1}"${toggleBackgroundAttribute(column.background)}>
      <div class="script-column-heading">
        <label>Coluna ${i+1}<select data-column-background="${i}" aria-label="Fundo da coluna ${i+1}">${scriptColors.map(([color,label])=>
          `<option value="${color}"${color===(column.background??'none')?' selected':''}>${color==='none'?'Sem fundo':label}</option>`
        ).join('')}</select></label>
        ${three?`<button type="button" data-remove-column="${i}">Transferir para coluna ${target} e remover</button>`:''}
      </div>
      <div class="script-column-editor" data-column-editor="${i}"></div>
    </section>`;
  });
  return `<section class="editor-block script-columns script-columns-edit" data-block-row="${index}" data-columns-layout="${index}" aria-label="Layout de colunas">
    <div class="script-columns-toolbar">
      <span>Colunas</span>
      ${three?'':'<button type="button" data-add-column>Adicionar terceira coluna</button>'}
      <button type="button" data-unpack-columns>Desagrupar colunas</button>
      <span role="status" data-column-status></span>
    </div>
    <details class="script-column-widths"><summary>Larguras</summary>${dividers.map((_,i)=>
      `<label>Colunas ${i+1} e ${i+2} <input type="range" step="1" data-column-slider="${i}"><output data-column-widths="${i}"></output></label>`
    ).join('')}</details>
    <div class="script-column-grid" data-count="${layout.columns.length}" style="--script-column-tracks:${columnTracks(layout.columns.map(column=>column.width),true)}">${layout.columns.map((_,i)=>groups[i]+(dividers[i]??'')).join('')}</div>
  </section>`;
}

export class ColumnLayouts {
  constructor(editor) {
    this.editor=editor;
    this.layouts=new Map();
    this.surfaces=new WeakMap();
  }
  destroy() {
    for(const editors of this.layouts.values())for(const column of editors)column.destroy();
    this.layouts.clear();
  }
  editorAt(node) {
    const element=node?.nodeType===1?node:node?.parentElement;
    return this.surfaces.get(element?.closest(EDITOR_SURFACE));
  }
  attach(Editor) {
    const root=this.editor;
    for(const container of root.el.querySelectorAll('[data-columns-layout]')){
      const index=+container.dataset.columnsLayout,layout=root.blocks[index];
      const editors=[...container.querySelectorAll('[data-column-editor]')].map((surface,column)=>{
        const track=layout.columns[column];
        const activate=editor=>{root.active=index;root.activeChild=null;root.columnEditor=editor;};
        const editor=new Editor(surface,{
          ...root.options,blocks:track.blocks,openToggles:root.openToggles,
          columnContext:{
            activate,
            changed:(editor,typing)=>{
              activate(editor);
              root.changed(typing,{layout:index,column,block:editor.active,child:editor.activeChild,cell:editor.activeCell});
            },
            remember:bookmark=>this.remember(index,column,bookmark),
            undo:direction=>root.undo(direction),
            destinations:()=>layout.columns.map((_,i)=>i).filter(i=>i!==column),
            move:(from,to)=>this.move(index,column,from,to),
          },
        });
        this.surfaces.set(surface,editor);
        return editor;
      });
      this.layouts.set(index,editors);
      this.resizeControls(container,index,layout.columns,editors);
      container.querySelector('[data-add-column]')?.addEventListener('click',()=>{
        this.remember(index,1);
        if(addColumn(layout.columns))this.commit({layout:index,column:2,block:0});
      });
      container.querySelectorAll('[data-remove-column]').forEach(button=>button.addEventListener('click',()=>{
        this.remember(index,+button.dataset.removeColumn);
        const address=removeColumn(layout.columns,+button.dataset.removeColumn);
        if(address)this.commit({layout:index,...address});
      }));
      container.querySelector('[data-unpack-columns]').addEventListener('click',()=>{
        const blocks=layout.columns.flatMap(column=>column.blocks);
        const payload=blocksToMarkdown(blocks);
        const preserved=blocks.length===0||sameBlockContent(blocks,parseBlocks(payload));
        if(!preserved){
          container.querySelector('[data-column-status]').textContent='Este layout contém blocos que perderiam a estrutura ao desagrupar.';
          return;
        }
        this.remember(index,0);
        root.blocks.splice(index,1,...blocks);
        if(!root.blocks.length)root.blocks.push({type:'paragraph',text:''});
        root.active=Math.min(index,root.blocks.length-1);root.activeChild=null;
        root.changed();root.render({index:root.active});
      });
      container.querySelectorAll('[data-column-background]').forEach(select=>select.addEventListener('change',()=>{
        const column=+select.dataset.columnBackground,track=layout.columns[column];
        const color=toggleBackground(select.value);
        if(color===track.background)return;
        this.remember(index,column);
        if(color){track.background=color;select.closest('.script-column').dataset.toggleBackground=color;}
        else{delete track.background;delete select.closest('.script-column').dataset.toggleBackground;}
        root.active=index;root.activeChild=null;
        root.changed(false,{layout:index,column,block:editors[column].active});
      }));
    }
  }
  resizeControls(container,index,columns,editors) {
    const root=this.editor,grid=container.querySelector('.script-column-grid');
    const handles=[...grid.querySelectorAll('[data-column-divider]')];
    const sliders=[...container.querySelectorAll('[data-column-slider]')];
    const outputs=[...container.querySelectorAll('[data-column-widths]')];
    const widths=()=>columns.map(column=>column.width);
    const show=values=>{
      grid.style.setProperty('--script-column-tracks',columnTracks(values,true));
      handles.forEach((handle,i)=>{
        const left=values[i],right=values[i+1],max=left+right-MIN_COLUMN_WIDTH;
        handle.setAttribute('aria-valuemin',String(MIN_COLUMN_WIDTH));
        handle.setAttribute('aria-valuemax',String(max));
        handle.setAttribute('aria-valuenow',String(left));
        handle.setAttribute('aria-valuetext',`${left}% e ${right}%`);
        sliders[i].min=String(MIN_COLUMN_WIDTH);sliders[i].max=String(max);sliders[i].value=String(left);
        outputs[i].textContent=`${left}% / ${right}%`;
      });
    };
    const commit=(values,column)=>{
      if(values.every((value,i)=>value===columns[i].width))return;
      const previous=editors.indexOf(root.columnEditor);
      const active=previous>=0?previous:column,editor=editors[active];
      this.remember(index,active);
      columns.forEach((track,i)=>{track.width=values[i];});
      root.active=index;root.activeChild=null;
      root.changed(false,{layout:index,column:active,block:editor.active,child:editor.activeChild,cell:editor.activeCell});
    };
    show(widths());
    handles.forEach((handle,i)=>{
      let drag=null;
      handle.onpointerdown=event=>{
        if(event.button!==0||drag)return;
        const space=grid.clientWidth-handles.length*12;
        if(space<=0)return;
        event.preventDefault();
        drag={id:event.pointerId,start:event.clientX,width:columns[i].width,space,values:widths()};
        handle.setPointerCapture(event.pointerId);
      };
      handle.onpointermove=event=>{
        if(drag?.id!==event.pointerId)return;
        drag.values=resizedWidths(columns,i,drag.width+(event.clientX-drag.start)*100/drag.space);
        show(drag.values);
      };
      handle.onpointerup=event=>{
        if(drag?.id!==event.pointerId)return;
        commit(drag.values,i);drag=null;
      };
      handle.onpointercancel=handle.onlostpointercapture=()=>{if(drag){drag=null;show(widths());}};
      handle.onkeydown=event=>{
        const step=event.shiftKey?5:1;
        const requested={ArrowLeft:columns[i].width-step,ArrowRight:columns[i].width+step,Home:0,End:100}[event.key];
        if(requested===undefined)return;
        event.preventDefault();
        const values=resizedWidths(columns,i,requested);
        show(values);commit(values,i);
      };
      sliders[i].oninput=()=>show(resizedWidths(columns,i,Number(sliders[i].value)));
      sliders[i].onchange=()=>commit(resizedWidths(columns,i,Number(sliders[i].value)),i);
    });
  }
  remember(layout,column,bookmark={}) {
    const editor=this.layouts.get(layout)?.[column];
    this.editor.history.remember({...bookmark,scope:{layout,column,block:editor?.active??0,child:editor?.activeChild??null,cell:editor?.activeCell??null}});
  }
  move(layout,column,block,destination) {
    const columns=this.editor.blocks[layout]?.columns;
    if(!columns)return;
    const source=this.layouts.get(layout)?.[column],parts=source?.range&&runSelection(source.range);
    const offset=parts?.start===block&&parts.end===block?parts.endOffset:undefined;
    this.remember(layout,column,{start:block,end:block,startOffset:offset});
    const index=moveColumnBlock(columns,column,block,destination);
    if(index!==null)this.commit({layout,column:destination,block:index,offset});
  }
  commit(scope) {
    const root=this.editor;
    root.active=scope.layout;root.activeChild=null;
    root.changed(false,scope);
    root.render();
    this.focus(scope);
  }
  focus(scope,bookmark) {
    const editor=this.layouts.get(scope.layout)?.[scope.column];
    if(!editor)return false;
    editor.options.columnContext.activate(editor);
    if(!editor.blocks.length){editor.el.querySelector('.add-block-line')?.focus();return true;}
    const index=bookmark?.start??scope.block;
    if(scope.child!=null){
      const toggle=editor.blocks[index];
      if(toggle?.blocks&&!editor.openToggles.has(toggle)){
        editor.openToggles.add(toggle);
        editor.render();
      }
    }
    editor.restoreBookmark(bookmark,{index,child:scope.child??null,cell:scope.cell??null,offset:scope.offset??null});
    return true;
  }
}

// Property order and optional empty table metadata are irrelevant to the scene's content.
function sameBlockContent(left,right){
  const normalize=block=>Object.fromEntries(Object.entries(block.type==='table'?{text:'',align:block.headers.map(()=>'left'),...block}:block)
    .filter(([,value])=>value!==undefined).sort(([a],[b])=>a.localeCompare(b)));
  return JSON.stringify(left.map(normalize))===JSON.stringify(right.map(normalize));
}
