export const SHEET_DICE=['d4','d6','d8','d10','d12'];
export const SHEET_SKILLS=[['acrobacia','Acrobacia','fisico'],['atletismo','Atletismo','fisico'],['crime','Crime','fisico'],['disciplina','Disciplina','emocao'],['enganacao','Enganação','emocao'],['furtividade','Furtividade','fisico'],['intimidar','Intimidar','emocao'],['intuicao','Intuição','emocao'],['luta','Luta','fisico'],['maquinas','Máquinas','mente'],['medicina','Medicina','mente'],['ocultismo','Ocultismo','mente'],['percepcao','Percepção','mente'],['persuasao','Persuasão','emocao'],['pesquisar','Pesquisar','mente'],['pontaria','Pontaria','fisico'],['sobrevivencia','Sobrevivência','mente'],['tecnologia','Tecnologia','mente'],['vigor','Vigor','fisico']];
export const SHEET_APTITUDES=[['artes','Artes'],['atualidades','Atualidades'],['burocracia','Burocracia'],['exatas','Exatas'],['humanas','Humanas'],['tatica','Tática']];
export const ITEM_TYPES=['equipamento','ferramenta','consumivel','tecnologia','documento','especial','outro'];
// Starting items already offered by the CRIS creator. No invented combat bonuses.
export const STARTER_ITEMS=[{name:'Lanterna tática',type:'ferramenta',quantity:1,equipped:true,details:'Fonte de luz portátil.'},{name:'Celular criptografado',type:'tecnologia',quantity:1,equipped:true,details:'Comunicação e acesso a registros digitais.'},{name:'Kit de primeiros socorros',type:'consumivel',quantity:1,equipped:false,details:'Materiais básicos para cuidados emergenciais.'}];
export const emptySheet=()=>({name:'',player:'',type:'agente',profile:'executor',occupation:'',level:1,nex:0,portrait:'',concept:'',appearance:'',history:'',notes:'',attributes:{fisico:'d6',mente:'d6',emocao:'d6'},resources:{pvCurrent:0,pvMax:0,pdCurrent:0,pdMax:0},skills:Object.fromEntries(SHEET_SKILLS.map(([k,,a])=>[k,{die:'d4',atributo:a}])),aptidoes:Object.fromEntries(SHEET_APTITUDES.map(([k,label])=>[k,{label,die:'d4'}])),abilities:[],inventory:[]});
export function updateSheet(source,values){
 const next=structuredClone(source),text=k=>String(values[k]??'');
 const number=(k,min,max)=>{const n=Number(values[k]);if(!Number.isFinite(n)||!Number.isInteger(n)||n<min||n>max)throw Error('Valor inválido em '+k+'.');return n;};
 for(const k of ['name','player','occupation','concept','appearance','history','notes'])next[k]=text(k);
 if(!next.name.trim())throw Error('Informe o nome do personagem.');
 next.level=number('level',1,10);next.nex=number('nex',0,100);
 if(!['agente','sobrevivente'].includes(values.type)||!['executor','analista','vigilante'].includes(values.profile))throw Error('Tipo ou perfil inválido.');next.type=values.type;next.profile=values.profile;
 next.resources={...source.resources};for(const k of ['pvCurrent','pvMax','pdCurrent','pdMax'])next.resources[k]=number(k,0,9999);
 const die=k=>{const value=text(k);if(!SHEET_DICE.includes(value))throw Error('Dado inválido.');return value;};
 next.attributes={...source.attributes};for(const k of ['fisico','mente','emocao'])next.attributes[k]=die('attribute.'+k);
 next.skills={...source.skills};for(const [k,,a] of SHEET_SKILLS)next.skills[k]={...source.skills?.[k],die:die('skill.'+k),atributo:source.skills?.[k]?.atributo||a};
 next.aptidoes={...source.aptidoes};for(const [k,label] of SHEET_APTITUDES)next.aptidoes[k]={...source.aptidoes?.[k],label,die:die('aptitude.'+k)};
 for(const group of ['inventory','abilities'])next[group]=(source[group]||[]).map((item,i)=>{const out={...item};for(const k of group==='inventory'?['name','type','details']:['name','origin','cost','description'])out[k]=text(group+'.'+i+'.'+k);if(group==='inventory'){out.quantity=number(group+'.'+i+'.quantity',1,9999);out.equipped=values[group+'.'+i+'.equipped']==='on';if(!ITEM_TYPES.includes(out.type))throw Error('Tipo de item inválido.');}return out;});
 return next;
}
