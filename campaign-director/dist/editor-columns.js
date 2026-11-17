import {scriptColors,toggleBackground,toggleBackgroundAttribute} from './editor-colors.js';
import {isColumnBlock,addColumn,removeColumn,columnBlockDestination,moveColumnBlock,columnTracks,resizedWidths,MIN_COLUMN_WIDTH} from './editor-columns-model.js';
import {planColumnRemoval} from './editor-column-removal.js';

export const EDITOR_SURFACE = '[data-editor-surface]';

export function editableColumnsHTML(layout,index) {
  const three=layout.columns.length===3;
  const dividers=layout.columns.slice(0,-1).map((_,i)=>
    `<div class="script-column-divider" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Ajustar colunas ${i+1} e ${i+2}" data-column-divider="${i}"></div>`
  );
  const options=layout.columns.map((column,i)=>{
    const target=i===0?2:i;
    return `<div class="script-column-options-row">
      <label>Coluna ${i+1}<select data-column-background="${i}" aria-label="Fundo da coluna ${i+1}">${scriptColors.map(([color,label])=>
        `<option value="${color}"${color===(column.background??'none')?' selected':''}>${color==='none'?'Sem fundo':label}</option>`
      ).join('')}</select></label>
      ${three?`<button type="button" data-remove-column="${i}">Transferir para coluna ${target} e remover</button>`:''}
    </div>`;
  });
  const groups=layout.columns.map((column,i)=>
    `<section class="script-column" aria-label="Coluna ${i+1}"${toggleBackgroundAttribute(column.background)}>
      <div class="script-column-editor" data-column-editor="${i}"></div>
    </section>`
  );
  return `<section class="editor-block script-columns script-columns-edit" data-block-row="${index}" data-columns-layout="${index}" aria-label="Layout de colunas">
    <details class="script-columns-options">
      <summary>Opções das colunas</summary>
      <div class="script-columns-menu">
        ${options.join('')}
        <div class="script-column-widths">${dividers.map((_,i)=>
          `<label>Colunas ${i+1} e ${i+2} <input type="range" step="1" data-column-slider="${i}"><output data-column-widths="${i}"></output></label>`
        ).join('')}</div>
        <div class="script-column-options-actions">
          ${three?'':'<button type="button" data-add-column>Adicionar terceira coluna</button>'}
          <button type="button" data-unpack-columns>Desagrupar colunas</button>
          ${three?'':'<button type="button" data-unpack-columns>Remover coluna e desagrupar</button>'}
          <button type="button" data-delete-columns>Excluir layout</button>
        </div>
        <span role="status" data-column-status></span>
      </div>
    </details>
    <div class="script-column-grid" data-count="${layout.columns.length}" style="--script-column-tracks:${columnTracks(layout.columns.map(column=>column.width),true)}">${layout.columns.map((_,i)=>groups[i]+(dividers[i]??'')).join('')}</div>
  </section>`;
}

export class ColumnLayouts {
  constructor(editor) {
    this.editor=editor;
    this.layouts=new Map();
    this.surfaces=new WeakMap();
    this.drag=null;
  }
  destroy() {
    this.clearDrop();
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
            dragStart:(event,block)=>this.startDrag(event,index,column,block),
            dragOver:event=>this.overDrag(event,index,column),
            drop:event=>this.drop(event,index,column),
          },
        });
        const section=surface.closest('.script-column');
        section.addEventListener('click',event=>{
          if((event.target===section||event.target===surface)&&getSelection()?.isCollapsed!==false)editor.writeInColumn();
        });
        this.surfaces.set(surface,editor);
        return editor;
      });
      this.layouts.set(index,editors);
      const options=container.querySelector('.script-columns-options');
      options.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&options.open){
          options.open=false;
          options.querySelector('summary').focus();
        }
      });
      container.addEventListener('dragend',()=>this.clearDrop());
      container.addEventListener('dragleave',event=>{
        if(this.drag?.marker?.contains(event.target)&&!this.drag.marker.contains(event.relatedTarget))this.clearMarker();
      });
      this.resizeControls(container,index,layout.columns,editors);
      container.querySelector('[data-add-column]')?.addEventListener('click',()=>{
        this.remember(index,1);
        if(addColumn(layout.columns)){
          layout.columns[2].blocks.push({type:'paragraph',text:''});
          this.commit({layout:index,column:2,block:0,offset:0});
        }
      });
      container.querySelectorAll('[data-remove-column]').forEach(button=>button.addEventListener('click',()=>{
        this.remember(index,+button.dataset.removeColumn);
        const address=removeColumn(layout.columns,+button.dataset.removeColumn);
        if(address)this.commit({layout:index,...address});
      }));
      const changeLayout=action=>{
        if(root.blocks[index]!==layout)return;
        let plan=planColumnRemoval(layout,action);
        if(plan.confirmation){
          if(!window.confirm('Excluir este layout? Os blocos internos de todas as colunas também serão apagados.'))return;
          plan=planColumnRemoval(layout,action,true);
        }
        if(plan.error){container.querySelector('[data-column-status]').textContent=plan.error;return;}
        const activeColumn=Math.max(0,editors.indexOf(root.columnEditor));
        const activeBlock=editors[activeColumn].active;
        const offset=layout.columns.slice(0,activeColumn).reduce((total,column)=>total+column.blocks.length,0)+activeBlock;
        this.remember(index,activeColumn);
        root.blocks.splice(index,1,...plan.blocks);
        if(!root.blocks.length)root.blocks.push({type:'paragraph',text:''});
        root.active=Math.min(index+Math.min(offset,Math.max(0,plan.blocks.length-1)),root.blocks.length-1);
        root.activeChild=null;
        root.changed();root.render({index:root.active});
      };
      container.querySelectorAll('[data-unpack-columns]').forEach(button=>button.addEventListener('click',()=>changeLayout('unpack')));
      container.querySelector('[data-delete-columns]').addEventListener('click',()=>changeLayout('delete'));
      container.querySelectorAll('[data-column-background]').forEach(select=>select.addEventListener('change',()=>{
        const column=+select.dataset.columnBackground,track=layout.columns[column];
        const color=toggleBackground(select.value);
        if(color===track.background)return;
        this.remember(index,column);
        const section=editors[column].el.closest('.script-column');
        if(color){track.background=color;section.dataset.toggleBackground=color;}
        else{delete track.background;delete section.dataset.toggleBackground;}
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
    this.editor.history.remember({scope:{layout,column,block:editor?.active??0,child:editor?.activeChild??null,cell:editor?.activeCell??null},...bookmark});
  }
  startDrag(event,layout,column,block) {
    this.clearDrop();
    const value=this.editor.blocks[layout]?.columns[column]?.blocks[block];
    if(!isColumnBlock(value)||!event.dataTransfer){event.preventDefault();return;}
    // Identity checks at drop time prevent a stale drag from moving a different block.
    const type=this.editor.dragType+'-column';
    this.drag={layout,column,block,value,type,marker:null};
    event.dataTransfer.setData(type,String(block));
    event.dataTransfer.effectAllowed='move';
  }
  clearMarker() {
    if(this.drag?.marker){
      delete this.drag.marker.dataset.columnDrop;
      this.drag.marker=null;
    }
  }
  clearDrop() {
    this.clearMarker();
    this.drag=null;
  }
  dropTarget(event,layout,column) {
    const drag=this.drag,columns=this.editor.blocks[layout]?.columns;
    if(!drag||drag.layout!==layout||!event.dataTransfer?.types.includes(drag.type)||
      columns?.[drag.column]?.blocks[drag.block]!==drag.value)return null;
    const row=event.target.closest('[data-block-row]');
    const surface=this.layouts.get(layout)?.[column]?.el;
    const ownRow=row?.closest(EDITOR_SURFACE)===surface?row:null;
    const bottom=surface?.querySelector('.add-block-line');
    if(!ownRow&&!bottom?.contains(event.target)&&event.target!==surface)return null;
    const bounds=ownRow?.getBoundingClientRect();
    const after=!!bounds&&event.clientY>bounds.top+bounds.height/2;
    const slot=ownRow?+ownRow.dataset.blockRow+Number(after):columns[column].blocks.length;
    if(columnBlockDestination(columns,drag.column,drag.block,column,slot)===null)return null;
    return {marker:ownRow??bottom,edge:after?'after':'before',slot};
  }
  overDrag(event,layout,column) {
    const target=this.dropTarget(event,layout,column);
    this.clearMarker();
    if(!target)return;
    event.preventDefault();
    event.dataTransfer.dropEffect='move';
    this.drag.marker=target.marker;
    target.marker.dataset.columnDrop=target.edge;
  }
  drop(event,layout,column) {
    // Even a refused internal drop must never fall through to native DOM insertion.
    if(!event.dataTransfer?.types.includes(this.editor.dragType+'-column'))return false;
    event.preventDefault();
    const target=this.dropTarget(event,layout,column),drag=this.drag;
    this.clearDrop();
    if(target&&event.dataTransfer.getData(drag.type)===String(drag.block)){
      this.move(layout,drag.column,drag.block,column,target.slot);
    }
    return true;
  }
  move(layout,column,block,destination,slot) {
    const columns=this.editor.blocks[layout]?.columns;
    if(!columns||columnBlockDestination(columns,column,block,destination,slot)===null)return;
    const source=this.layouts.get(layout)?.[column];
    const focus=source?.moveFocus(block)??{};
    this.remember(layout,column,{start:block,end:block,startOffset:focus.offset,
      scope:{layout,column,block,child:focus.child,cell:focus.cell,toggleField:focus.toggleField}});
    const index=moveColumnBlock(columns,column,block,destination,slot);
    this.commit({layout,column:destination,block:index,...focus});
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
    if(!editor.blocks.length){editor.el.querySelector('[data-start-column]')?.focus({preventScroll:true});return true;}
    const index=bookmark?.start??scope.block;
    if(scope.child!=null||scope.toggleField==='text'){
      const toggle=editor.blocks[index];
      if(toggle?.type==='toggle'&&!editor.openToggles.has(toggle)){
        editor.openToggles.add(toggle);
        editor.render();
      }
    }
    editor.restoreBookmark(bookmark,{index,child:scope.child??null,cell:scope.cell??null,offset:scope.offset??null,toggleField:scope.toggleField});
    return true;
  }
}
