export const BLOCK_TYPES={paragraph:'Texto',h1:'Título 1',h2:'Título 2',h3:'Título 3',list:'Lista com marcadores',numbered:'Lista numerada',todo:'Lista de tarefas',table:'Tabela',quote:'Citação',note:'Nota do mestre',clue:'Pista do quadro',cue:'Cue de áudio',divider:'Divisória'};
export function newBlock(type='paragraph',triggers=[]){
  if(type==='table')return {type,text:'',headers:['Perícia','DT','Informação'],rows:[['','',''],['','','']],align:['left','left','left']};
  return {type,text:'',...(type==='todo'?{checked:false}:{}),...(type==='numbered'?{number:1}:{}),...(type==='clue'?{itemId:'',campaignId:'',action:'reveal'}:{}),...(type==='cue'?{triggerId:triggers[0]?.id||''}:{})};
}
export function splitBlocks(blocks,start,end,before,after){
  const prior=blocks[start];if(['list','numbered','todo'].includes(prior.type)&&!before&&!after&&start===end){blocks[start]={type:'paragraph',text:''};return {index:start,offset:0};}
  const first={...prior,text:before},type=['list','numbered','todo','quote'].includes(prior.type)?prior.type:'paragraph',next={...newBlock(type),text:after};if(type==='numbered')next.number=(prior.number||1)+1;
  blocks.splice(start,end-start+1,first,next);return {index:start+1,offset:0};
}
export class EditorHistory {
  constructor(blocks){this.entries=[{blocks:structuredClone(blocks),active:0}];this.position=0;this.lastInput=0;this.lastBlock=-1;}
  record(blocks,active,typing=false,at=Date.now()){
    if(JSON.stringify(this.entries[this.position].blocks)===JSON.stringify(blocks))return;
    const coalesce=typing&&this.lastInput&&at-this.lastInput<600&&active===this.lastBlock&&this.position===this.entries.length-1;
    const entry={blocks:structuredClone(blocks),active};this.entries=this.entries.slice(0,this.position+1);
    if(coalesce)this.entries[this.position]=entry;else{this.entries.push(entry);this.position++;}
    if(this.entries.length>150){this.entries.shift();this.position--;}
    this.lastInput=typing?at:0;this.lastBlock=active;
  }
  move(offset){const next=this.position+offset;if(next<0||next>=this.entries.length)return null;this.position=next;this.lastInput=0;return structuredClone(this.entries[next]);}
}
