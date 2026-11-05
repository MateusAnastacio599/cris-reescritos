import {publishedBoard} from '../board-library.js?v=328';
import {BoardAssets} from '../board-assets.js?v=328';
import {archiveClient,checked,CaseArchive} from '../case-archive-data.js?v=328';

export const canPrepareItem=item=>!!item&&['img','note','cont','mark','tape','scr'].includes(item.type)&&item.kind!=='ativador';
const refs=new Set(['parent','box','inside','in','clipBy','clipRoot','lidOf','lidId','pair','tapeId','tape','disc','deck','apoiada','pesaEm','prato','lk','of','parede','rev','tgt','libera','item','a','b']);
const runtimeKeys=new Set(['_scr','_sum','_code','_pat','_dial']);
const forbidden=new Set(['gm','hand','by','crisOwner','crisEvidence','crisDocument','crisPart','crisClue','crisClueName','gmNotes','__proto__','constructor','prototype']);
const clean=value=>JSON.parse(JSON.stringify(value,(key,v)=>forbidden.has(key)||key.startsWith('_')&&!runtimeKeys.has(key)?undefined:v));
function mapRefs(value,ids,images,key=''){
 if(typeof value==='string'){
  if(['imgId','audioId','prevAudio'].includes(key))return images?.get(value)||value;
  return refs.has(key)?ids.get(value)||null:value;
 }
 if(Array.isArray(value))return value.map(v=>mapRefs(v,ids,images,key));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,mapRefs(v,ids,images,k)]));
 return value;
}
export function prepareEvidence(snapshot,id){
 const all=snapshot.state.items,selected=all.find(item=>item.id===id);
 if(!canPrepareItem(selected))throw Error('Selecione um objeto, imagem, nota, marca, fita ou raspadinha. Ativadores continuam reservados ao mestre.');
 const chosen=new Set([id]);let changed=true;
 while(changed){changed=false;
  for(const item of all){
   const child=['parent','box','inside','in','clipBy','lidOf','deck'].some(key=>chosen.has(item[key]));
   const paired=item.puzzle?.g&&all.some(other=>chosen.has(other.id)&&other.puzzle?.g===item.puzzle.g);
   if(canPrepareItem(item)&&(child||paired)&&!chosen.has(item.id)){chosen.add(item.id);changed=true;}
   if(chosen.has(item.id))for(const key of ['pair','clipRoot','lidId','tapeId','tape','disc','prato','lk','of','rev','tgt','libera']){
    const target=item[key]||item.opts?.[key];const linked=all.find(other=>other.id===target);
    if(canPrepareItem(linked)&&!chosen.has(target)){chosen.add(target);changed=true;}
   }
  }
 }
 if(chosen.size>32)throw Error('Esta preparação contém mais de 32 itens. Separe-a em evidências menores.');
 const ids=new Map([...chosen].map(id=>[id,id]));
 const items=all.filter(item=>chosen.has(item.id)).sort((a,b)=>Number(b.id===id)-Number(a.id===id)).map(item=>{
  const result=mapRefs(clean(item),ids);delete result.fixed;delete result.lockPos;return result;
 });
 const result=publishedBoard({state:{items,pins:[],strings:[]},imgs:snapshot.imgs});
 for(const item of items)if(item.prevAudio&&snapshot.imgs?.[item.prevAudio])result.imgs[item.prevAudio]=snapshot.imgs[item.prevAudio];return result;
}
export async function choosePreparation({bridge,snapshot,itemId,onSaved}){
 const prepared=prepareEvidence(snapshot,itemId),object=true;
 const client=await archiveClient(bridge),campaign=bridge.campaignId,api=new CaseArchive(client,campaign);
 const [attachments,documents]=await Promise.all([client.from('case_attachments').select('id,title,object_path,mime').eq('campaign_id',campaign).order('title'),client.from('case_documents').select('id,title').eq('campaign_id',campaign).order('title')]);
 const rows=checked(attachments),docs=checked(documents);
 const dialog=document.createElement('dialog');dialog.className='cris-board-dialog cris-preparation-dialog';
 const heading=document.createElement('h2');heading.textContent='Preparar evidência para o jogador';
 const info=document.createElement('p');info.textContent='Esta preparação contém '+prepared.state.items.length+(prepared.state.items.length===1?' item.':' itens.')+' Conteúdos guardados e objetos vinculados são incluídos. O jogador recebe uma cópia interativa pessoal quando escolher “Adicionar ao quadro”.';
 const label=document.createElement('label');label.textContent='Evidência do acervo';const select=document.createElement('select');
 const fresh=document.createElement('option');fresh.value='new';fresh.textContent='Criar nova evidência deste objeto';select.append(fresh);
 for(const row of rows){const option=document.createElement('option');option.value=row.id;option.textContent=row.title;select.append(option);}label.append(select);
 const fields=document.createElement('div');fields.className='cris-preparation-new';
 const nameLabel=document.createElement('label');nameLabel.textContent='Título da evidência';const name=document.createElement('input');name.maxLength=200;name.placeholder='Ex.: OBJ-001 // Bloco de notas';nameLabel.append(name);
 const docLabel=document.createElement('label');docLabel.textContent='Documento do acervo';const doc=document.createElement('select');for(const row of docs){const option=document.createElement('option');option.value=row.id;option.textContent=row.title;doc.append(option);}docLabel.append(doc);
 const descLabel=document.createElement('label');descLabel.textContent='Descrição para os agentes (opcional)';const description=document.createElement('textarea');description.rows=3;descLabel.append(description);
 const pubLabel=document.createElement('label');const publish=document.createElement('input');publish.type='checkbox';pubLabel.append(publish,document.createTextNode(' Publicar a evidência para os agentes'));
 const hint=document.createElement('small');hint.textContent='A investigação, o documento e o quadro também precisam estar publicados.';
 fields.append(nameLabel,docLabel,descLabel,pubLabel,hint);select.onchange=()=>{fields.hidden=select.value!=='new';};
 const status=document.createElement('p');status.setAttribute('role','status');
 const actions=document.createElement('div');actions.className='cris-board-choices';
 const cancel=document.createElement('button');cancel.textContent='Cancelar';cancel.onclick=()=>dialog.close();
 const save=document.createElement('button');save.textContent='Salvar preparação';save.disabled=!rows.length&&!docs.length;
 actions.append(cancel,save);dialog.append(heading,info,label,fields,status,actions);document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.showModal();
 select.value='new';fields.hidden=false;
 if(!docs.length)status.textContent='Cadastre um documento no acervo para criar uma evidência de objeto.';
 save.onclick=async()=>{save.disabled=true;try{
  if(select.value==='new'&&(!name.value.trim()||!doc.value))throw Error('Informe um título e escolha o documento da evidência.');
  const payload=await new BoardAssets(client,campaign).pack(prepared);
  let attachmentId=select.value;
  if(attachmentId==='new'){
   const row=await api.save('case_attachments',null,{document_id:doc.value,title:name.value.trim(),body:description.value.trim(),mime:object?'application/x-cris-object':undefined,published:false,position:0});attachmentId=row.id;
   const option=document.createElement('option');option.value=row.id;option.textContent=row.title;select.append(option);select.value=row.id;fields.hidden=true;
  }
  checked(await client.from('case_evidence_preparations').upsert({campaign_id:campaign,board_id:bridge.archiveId,attachment_id:attachmentId,payload,source_ids:payload.state.items.map(item=>item.id),updated_at:new Date().toISOString()},{onConflict:'board_id,attachment_id'}));
  await api.save('case_attachments',attachmentId,{...(!rows.find(row=>row.id===attachmentId)?.object_path&&object?{mime:'application/x-cris-object'}:{}),...(publish.checked?{published:true}:{})});
  await onSaved?.(payload.state.items.map(item=>item.id));
  status.textContent='Preparação salva e escondida do quadro publicado. Com a evidência, o documento e o quadro publicados, o jogador poderá adicioná-la pelo acervo.';save.textContent='Salvo';cancel.textContent='Fechar';
 }catch(error){status.textContent=error.message;save.disabled=false;}};
}

export function placePreparation(template,row,user,center){
 const result=structuredClone(template),runtime=row.layout.runtime;
 let items=result.state.items;
 if(runtime?.version===2){
  items=items.map(item=>{const patch=runtime.patches?.[item.id];if(patch===false)return null;const next={...item,...patch?.set};for(const key of patch?.unset||[])delete next[key];return next;}).filter(Boolean);
  items.push(...(runtime.created||[]).filter(canPrepareItem).map(clean));
  Object.assign(result.imgs,runtime.images||{});
 }else items=items.filter(item=>row.layout.parts?.[item.id]!==false);
 const originalIds=template.state.items.map(item=>item.id);
 const ids=new Map([...originalIds,...items.map(item=>item.id)].filter((id,i,list)=>list.indexOf(id)===i).map((id,index)=>[id,'evidence-'+row.id+(index?'-part-'+index:'')]));
 const images=new Map(Object.keys(result.imgs).map(id=>[id,'evidence-'+row.id+'-asset-'+id]));
 const first=template.state.items[0],dx=center.x-first.x,dy=center.y-first.y;
 result.state.items=items.map(raw=>{
  const part=raw.id,saved=row.layout.parts?.[part];const item=mapRefs(raw,ids,images);
  Object.assign(item,{id:ids.get(part),crisPart:part,crisOwner:user,crisEvidence:row.id,crisDocument:row.attachment.document_id});
  // A resumed runtime already stores world positions. New copies start near the viewport.
  if(!runtime?.patches?.[part]&&!runtime?.created?.some(created=>created.id===part)){item.x+=dx;item.y+=dy;}
  if(item.puzzle)item.puzzle.g='evidence-'+row.id+'-puzzle-'+raw.puzzle.g;
  if(!runtime&&saved){for(const key of ['x','y','w','rot','scale','z'])if(Number.isFinite(saved[key]))item[key]=saved[key];item.flipped=!!saved.flipped;item.parent=ids.get(saved.parent)||null;}
  return item;
 });
 result.state.pins=(runtime?.pins||[]).map(pin=>({...pin,item:ids.get(pin.item)||null,crisOwner:user}));result.state.strings=[];
 result.imgs=Object.fromEntries(Object.entries(result.imgs).map(([id,ref])=>[images.get(id),ref]));return result;
}
export function preparationLayout(row,state){
 const group=state.items.filter(item=>item.crisEvidence===row.id&&item.crisPart);if(!group.length)return null;
 const ids=new Map(group.map(item=>[item.id,item.crisPart]));const parts={...row.layout.parts};
 for(const part of row.preparation.state.items){const item=group.find(item=>item.crisPart===part.id);
  parts[part.id]=item?{...Object.fromEntries(['x','y','w','rot','scale','z'].map(key=>[key,item[key]])),flipped:!!item.flipped,parent:ids.get(item.parent)||null}:false;
 }return parts;
}
export function preparationRuntime(row,state,imgs={}){
 const group=state.items.filter(item=>item.crisEvidence===row.id&&item.crisPart);
 const ids=new Map(group.map(item=>[item.id,item.crisPart]));
 const prefix='evidence-'+row.id+'-asset-';
 const imageIds=new Map(Object.keys(imgs).map(id=>[id,id.startsWith(prefix)?id.slice(prefix.length):id]));
 const canonical=item=>{
  const result=mapRefs(clean(item),ids,imageIds);result.id=ids.get(item.id);
  if(result.puzzle?.g)result.puzzle.g=result.puzzle.g.replace('evidence-'+row.id+'-puzzle-','');
  return result;
 };
 const patches={},created=[],images={};
 for(const part of row.preparation.state.items){
  const current=group.find(item=>item.crisPart===part.id);
  if(!current){patches[part.id]=false;continue;}
  const value=canonical(current),original=clean(part),set={},unset=[];
  for(const [key,v] of Object.entries(value))if(JSON.stringify(v)!==JSON.stringify(original[key]))set[key]=v;
  for(const key of Object.keys(original))if(!(key in value))unset.push(key);
  // Positions are always explicit so viewport changes never reposition a resumed object.
  set.x=current.x;set.y=current.y;patches[part.id]={set,unset};
 }
 for(const item of group){
  if(!row.preparation.state.items.some(part=>part.id===item.crisPart))created.push(canonical(item));
  for(const key of ['imgId','audioId','prevAudio']){
   const id=item[key],canonicalId=imageIds.get(id)||id;
   if(id&&imgs[id]&&!Object.hasOwn(row.preparation.imgs||{},canonicalId))images[canonicalId]=imgs[id];
  }
 }
 const ownIds=new Set(group.map(item=>item.id));
 const pins=state.pins.filter(pin=>ownIds.has(pin.item)&&pin.id!=='evidence-pin-'+row.id).map(pin=>mapRefs(clean(pin),ids));
 return {version:2,patches,created,images,pins};
}
