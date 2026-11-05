import {publishedBoard} from '../board-library.js?v=328';
import {BoardAssets} from '../board-assets.js?v=328';
import {archiveClient,checked} from '../case-archive-data.js?v=328';

// A preparation contains only the chosen image/note (or its torn-paper group).
// The master's full draft, hidden siblings and script metadata never leave it.
export function prepareEvidence(snapshot,id){
 const selected=snapshot.state.items.find(item=>item.id===id);
 if(!selected||!['img','note'].includes(selected.type))throw Error('Selecione uma imagem, nota ou pedaço de papel.');
 const chosen=snapshot.state.items.filter(item=>item.id===id||selected.puzzle?.g&&item.puzzle?.g===selected.puzzle.g);
 if(chosen.length>32||chosen.some(item=>!['img','note'].includes(item.type)))throw Error('Preparação inválida. Use até 32 pedaços de papel.');
 // First item is the stable target used by the archive's "localizar" link.
 chosen.sort((a,b)=>Number(b.id===id)-Number(a.id===id));
 const ids=new Set(chosen.map(item=>item.id));
 const items=chosen.map(raw=>{const item=structuredClone(raw);for(const key of ['gm','hand','by','crisOwner','crisEvidence','crisDocument','crisPart','fixed','lockPos'])delete item[key];if(!ids.has(item.parent))item.parent=null;return item;});
 const result=publishedBoard({state:{items,pins:[],strings:[]},imgs:snapshot.imgs});
 return result;
}
export async function choosePreparation({bridge,snapshot,itemId,onSaved}){
 const client=await archiveClient(bridge),campaign=bridge.campaignId;
 const rows=checked(await client.from('case_attachments').select('id,title').eq('campaign_id',campaign).order('title'));
 const dialog=document.createElement('dialog');dialog.className='cris-board-dialog cris-preparation-dialog';
 const heading=document.createElement('h2');heading.textContent='Preparar evidência para o jogador';
 const info=document.createElement('p');info.textContent='Vincule este item (e todos os pedaços do mesmo papel) a uma evidência. O jogador recebe sua própria cópia quando escolher “Adicionar ao quadro”. O original do acervo permanece intacto.';
 const label=document.createElement('label');label.textContent='Evidência do acervo';const select=document.createElement('select');
 for(const row of rows){const option=document.createElement('option');option.value=row.id;option.textContent=row.title;select.append(option);}label.append(select);
 const status=document.createElement('p');status.setAttribute('role','status');
 const actions=document.createElement('div');actions.className='cris-board-choices';
 const cancel=document.createElement('button');cancel.textContent='Cancelar';cancel.onclick=()=>dialog.close();
 const save=document.createElement('button');save.textContent='Salvar preparação';save.disabled=!rows.length;
 actions.append(cancel,save);dialog.append(heading,info,label,status,actions);document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.showModal();
 if(!rows.length)status.textContent='Cadastre uma evidência no acervo primeiro.';
 save.onclick=async()=>{save.disabled=true;try{
  const payload=await new BoardAssets(client,campaign).pack(prepareEvidence(snapshot,itemId));
  checked(await client.from('case_evidence_preparations').upsert({campaign_id:campaign,board_id:bridge.archiveId,attachment_id:select.value,payload,source_ids:payload.state.items.map(item=>item.id),updated_at:new Date().toISOString()},{onConflict:'board_id,attachment_id'}));
  await onSaved?.(payload.state.items.map(item=>item.id));
  status.textContent='Preparação salva e escondida do quadro publicado. Ela será entregue quando o jogador adicionar a evidência.';save.textContent='Salvo';
 }catch(error){status.textContent=error.message;save.disabled=false;}};
}

export function placePreparation(template,row,user,center){
 const result=structuredClone(template),items=result.state.items;
 const ids=new Map(items.map((item,index)=>[item.id,'evidence-'+row.id+(index?'-part-'+index:'')]));
 const images=new Map(Object.keys(result.imgs).map(id=>[id,'evidence-'+row.id+'-asset-'+id]));
 const first=items[0],dx=center.x-first.x,dy=center.y-first.y;
 for(const item of items){
  const part=item.id,saved=row.layout.parts?.[part];
  Object.assign(item,{id:ids.get(part),crisPart:part,crisOwner:user,crisEvidence:row.id,crisDocument:row.attachment.document_id});
  item.x+=dx;item.y+=dy;item.parent=ids.get(item.parent)||null;
  if(item.puzzle)item.puzzle.g='evidence-'+row.id+'-puzzle';
  for(const key of ['imgId','audioId'])if(images.has(item[key]))item[key]=images.get(item[key]);
  if(saved){for(const key of ['x','y','w','rot','scale','z'])if(Number.isFinite(saved[key]))item[key]=saved[key];item.flipped=!!saved.flipped;item.parent=ids.get(saved.parent)||null;}
 }
 result.state.items=items.filter(item=>row.layout.parts?.[item.crisPart]!==false);
 result.state.pins=[];result.state.strings=[];
 result.imgs=Object.fromEntries(Object.entries(result.imgs).map(([id,ref])=>[images.get(id),ref]));
 return result;
}
export function preparationLayout(row,state){
 const group=state.items.filter(item=>item.crisEvidence===row.id&&item.crisPart);
 if(!group.length)return null;
 const ids=new Map(group.map(item=>[item.id,item.crisPart]));
 const parts={...row.layout.parts};
 for(const part of row.preparation.state.items){
  const item=group.find(item=>item.crisPart===part.id);
  parts[part.id]=item?{...Object.fromEntries(['x','y','w','rot','scale','z'].map(key=>[key,item[key]])),flipped:!!item.flipped,parent:ids.get(item.parent)||null}:false;
 }
 return parts;
}
