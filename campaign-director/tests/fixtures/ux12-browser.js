import {formatTextFields} from '../../dist/editor-inline-format.js';
import {pointAt,runField} from '../../dist/editor-text-runs.js';

const fixture=window.fixture,script=document.querySelector('#script');
const check=(condition,message)=>{if(!condition)throw Error(message);};
const equal=(left,right,message)=>check(JSON.stringify(left)===JSON.stringify(right),message);
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const keyboard=(field,key,mod=false)=>field.dispatchEvent(new KeyboardEvent('keydown',{key,ctrlKey:mod,bubbles:true,cancelable:true}));
const input=(field,inputType,data)=>field.dispatchEvent(new InputEvent('beforeinput',{inputType,data,bubbles:true,cancelable:true}));
const fields=scope=>[...scope.querySelectorAll(':scope > .editor-text-run [data-run-field]')];
const column=(layout,index)=>script.querySelector(`[data-columns-layout="${layout}"] [data-column-editor="${index}"]`);
function select(first,from,last,to,backward=false){
  const start=pointAt(first,from),end=pointAt(last,to);
  const run=first.closest('.editor-text-run');
  run.focus({preventScroll:true});
  getSelection().setBaseAndExtent(...(backward?end:start),...(backward?start:end));
  return run;
}
function drag(from,to,y){
  const dataTransfer=new DataTransfer();
  from.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer}));
  const over=new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer,clientY:y});
  to.dispatchEvent(over);
  const marker=to.getAttribute('data-column-drop');
  to.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer,clientY:y}));
  return {accepted:over.defaultPrevented,marker};
}
export async function verifyEditor(){
  document.querySelector('#reset').click();
  document.querySelector('#edit').click();
  const baseline=fixture.saved();
  const invalid=document.createElement('div');
  invalid.innerHTML='<u>seleção incompatível</u>';
  check(formatTextFields([invalid,invalid],{startOffset:1,endOffset:5},[],'italic')===null,
    'Preservar marcações que não têm representação no Markdown do CRIS');
  check(invalid.innerHTML==='<u>seleção incompatível</u>','Uma formatação recusada preserva o DOM');
  let [heading,a,b]=fields(script),run=select(heading,11,b,8,true);
  const original=getSelection().toString();
  keyboard(run,'b',true);
  check(fixture.editor.blocks[0].text.includes('**')&&fixture.editor.blocks[1].text.startsWith('**')&&fixture.editor.blocks[2].text.startsWith('**'), 'Negrito parcial em três blocos');
  equal(getSelection().toString(),original,'Restaurar a seleção após formatar');
  check(runField(getSelection().anchorNode)===b,'Restaurar seleção invertida');
  const bold=fixture.saved();
  keyboard(run,'z',true);
  equal(fixture.saved(),baseline,'Um único Ctrl+Z');
  check(+runField(getSelection().anchorNode).dataset.block===2,'Ctrl+Z restaura a direção da seleção');
  run=document.activeElement;
  keyboard(run,'y',true);
  equal(fixture.saved(),bold,'Ctrl+Y refaz a formatação');
  [heading,a,b]=fields(script);
  select(a,0,b,8);
  fixture.editor.captureSelection();
  fixture.editor.format('italic');
  check(a.querySelector('em')&&b.querySelector('em'),'Aplicar itálico sem perder negrito');
  await nextFrame();
  check(document.querySelector('[data-open-colors]'), 'Barra na seleção: '+getSelection().toString()+' · '+JSON.stringify(getSelection().getRangeAt(0).getBoundingClientRect())+' · '+innerHeight);
  document.querySelector('[data-open-colors]').click();
  document.querySelector('[data-channel="crisInk"][data-color="red"]').click();
  check(a.querySelector('[data-cris-ink=red]')&&b.querySelector('[data-cris-ink=red]'),'Cor em ambos os parágrafos');
  await nextFrame();
  check(document.querySelector('[data-open-colors]'), 'Barra na seleção: '+getSelection().toString()+' · '+JSON.stringify(getSelection().getRangeAt(0).getBoundingClientRect())+' · '+innerHeight);
  document.querySelector('[data-open-colors]').click();
  document.querySelector('[data-channel="crisHighlight"][data-color="yellow"]').click();
  check(a.querySelector('[data-cris-ink=red][data-cris-highlight=yellow]')&&b.querySelector('.wiki-token'),'Cor, destaque e link coexistem');
  const multi=fixture.saved();

  let [left,leftPara,leftOther]=fields(column(5,0)),[right]=fields(column(5,1));
  run=select(left,1,right,3);
  keyboard(run,'b',true);
  check(!input(run,'deleteContentBackward')&&!input(run,'insertText','X'),'Bloquear exclusão e escrita entre colunas');
  equal(fixture.saved(),multi,'Nenhuma alteração entre colunas');
  run=select(left,1,leftOther,3);
  keyboard(run,'a',true);
  check(+runField(getSelection().focusNode).dataset.block===2,'Ctrl+A fica no trecho textual');
  keyboard(run,'i',true);
  check(left.querySelector('em')&&leftPara.querySelector('em')&&leftOther.querySelector('em'),'Formatação dentro da coluna');

  // Structural key handling uses the same scene history in a column.
  [left,leftPara,leftOther]=fields(column(5,0));
  run=select(leftOther,4,leftOther,4);
  const beforeEnter=fixture.saved();
  check(!input(run,'insertParagraph'),'Enter divide o parágrafo pelo modelo');
  equal(fixture.editor.blocks[5].columns[0].blocks[2].text,'*Há c*','Enter preserva formatação antes do cursor');
  equal(fixture.editor.blocks[5].columns[0].blocks[3].type,'paragraph','Enter cria um parágrafo na mesma coluna');
  check(!input(document.activeElement,'deleteContentBackward'),'Backspace une os parágrafos');
  fixture.editor.undo(-1);fixture.editor.undo(-1);
  equal(fixture.saved(),beforeEnter,'Desfazer divisão e união');
  [left,leftPara,leftOther]=fields(column(5,0));
  run=select(leftOther,4,leftOther,4);
  check(!input(run,'insertLineBreak'),'Shift+Enter preserva a estrutura de blocos');
  check(fixture.editor.blocks[5].columns[0].blocks[2].text.includes('\n'),'Quebra inserida no parágrafo');
  fixture.editor.undo(-1);
  [left,leftPara,leftOther]=fields(column(5,0));
  run=select(leftOther,leftOther.textContent.length,leftOther,leftOther.textContent.length);
  check(!input(run,'deleteContentForward'),'Delete junto ao Recolhível é bloqueado');
  equal(fixture.saved(),beforeEnter,'Recolhível mantém a estrutura após Delete');

  const external=JSON.stringify(fixture.editor.blocks.filter(block=>block.type!=='columns'));
  const first=column(5,0),second=column(5,1),toggle=first.querySelector('[data-toggle-button="3"]');
  toggle.click();
  const child=first.querySelector('[data-child="1"]');
  child.focus();getSelection().collapse(child.firstChild,0);fixture.editor.captureSelection();
  const protectedBlocks=JSON.stringify(fixture.editor.blocks[5].columns[1].blocks.slice(-2));
  const rich=fixture.editor.blocks[5].columns[0].blocks[3];
  const beforeMove=fixture.saved();
  const destination=second.querySelector('[data-block-row="0"]');
  const rejected=drag(first.querySelector('[data-drag="3"]'),column(8,0).querySelector('[data-block-row]'),0);
  check(!rejected.accepted&&fixture.saved()===beforeMove,'Bloquear movimento entre layouts');
  const moved=drag(first.querySelector('[data-drag="3"]'),destination,destination.getBoundingClientRect().top);
  check(moved.accepted&&moved.marker==='before','Indicar posição antes do bloco e aceitar a transferência');
  equal(fixture.editor.blocks[5].columns[1].blocks[0],rich,'Recolhível rico mantém todos os filhos');
  check(document.activeElement.dataset.child==='1','Restaurar foco dentro do Recolhível movido');
  const afterMove=fixture.saved();fixture.editor.undo(-1);
  equal(fixture.saved(),beforeMove,'Desfazer arraste como uma operação');fixture.editor.undo(1);
  equal(fixture.saved(),afterMove,'Refazer arraste como uma operação');
  const target=column(5,1).querySelector('[data-block-row="3"]');
  const bounds=target.getBoundingClientRect();
  const reorder=drag(column(5,1).querySelector('[data-drag="1"]'),target,bounds.bottom);
  check(reorder.accepted&&reorder.marker==='after','Reordenar após um bloco na mesma coluna');
  equal(JSON.stringify(fixture.editor.blocks[5].columns[1].blocks.slice(-2)),protectedBlocks,'Tabela e cue preservadas');
  equal(JSON.stringify(fixture.editor.blocks.filter(block=>block.type!=='columns')),external,'Blocos externos preservados');

  const empty=column(8,2).querySelector('.add-block-line');
  const insert=drag(column(8,0).querySelector('[data-drag="0"]'),empty,0);
  check(insert.accepted&&fixture.editor.blocks[8].columns[2].blocks[0].text==='Entrada','Mover para coluna vazia');
  column(5,1).querySelector('[data-preview-cue]').click();
  equal(script.dataset.cue,'steps','Cue acessível após edição');
  const saved=fixture.saved();
  const store=localStorage.getItem('cris-campaign-director:v3');
  equal(await fixture.backup(),saved,'Exportar e importar workspace');
  equal(localStorage.getItem('cris-campaign-director:v3'),store,'O teste de importação preserva o armazenamento da aplicação');
  document.querySelector('#read').click();document.querySelector('#edit').click();
  equal(fixture.editor.serialize(),saved,'Reabrir o roteiro com Markdown completo');
  if(innerWidth<=390){
    const grid=script.querySelector('.script-column-grid');
    check(getComputedStyle(grid).gridTemplateColumns.split(' ').length===1,'Colunas empilham a 390 px');
    check(document.documentElement.scrollWidth===document.documentElement.clientWidth,'Sem rolagem horizontal da página');
  }
}
