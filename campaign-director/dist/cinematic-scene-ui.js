import {cinematicItems,cinematicPrimary,remotePrewarmAllowed} from './cinematic-model.js?v=directorcinematic01';
// One compact scene action. The Studio remains under the existing Tools menu.
export function mountSceneCinematic(root,{scene,save,present,sequence}){
 const items=cinematicItems(scene);if(!items.length)return;
 const row=document.createElement('div');row.className='scene-cinematic';
 const action=document.createElement('button');action.type='button';action.className='btn outline';action.textContent='Apresentar Cinematic';action.id='presentSceneCinematic';
 const name=document.createElement(items.length>1?'select':'span');name.className='scene-cinematic-choice';
 if(items.length>1){name.setAttribute('aria-label','Cinematic principal da cena');const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Escolha a Cinematic principal';name.append(placeholder);for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;name.append(option);}name.value=cinematicPrimary(scene)?.id||'';name.onchange=()=>{const prior=scene.cinematic.primaryId;if(name.value)scene.cinematic.primaryId=name.value;else delete scene.cinematic.primaryId;if(save()===false){if(prior===undefined)delete scene.cinematic.primaryId;else scene.cinematic.primaryId=prior;}refresh();};}
 else name.textContent=items[0].name;
 const status=document.createElement('small');status.id='sceneCinematicReadiness';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const permission=document.createElement('details');permission.className='scene-cinematic-permission';const summary=document.createElement('summary');summary.textContent='Pré-carregamento';permission.append(summary);
 const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.setAttribute('aria-label','Autorizar preload remoto desta Cinematic');label.append(check,document.createTextNode(' Autorizar preload remoto desta Cinematic'));const help=document.createElement('small');help.textContent='Envia os arquivos aos jogadores antes de apresentar. Autorize somente conteúdo que eles já podem acessar. Editar a composição exige nova autorização.';permission.append(label,help);
 check.onchange=()=>{const item=cinematicPrimary(scene);if(!item)return;const prior=scene.cinematic.remotePrewarmIds;scene.cinematic.remotePrewarmIds=(scene.cinematic.remotePrewarmIds||[]).filter(id=>id!==item.id);if(check.checked)scene.cinematic.remotePrewarmIds.push(item.id);if(save()===false)scene.cinematic.remotePrewarmIds=prior;refresh();};
 action.onclick=async()=>{action.disabled=true;try{await present(cinematicPrimary(scene));}finally{refresh();}};
 function refresh(){const item=cinematicPrimary(scene);action.disabled=!item;check.disabled=!item;check.checked=remotePrewarmAllowed(scene,item);const view=sequence.view();status.textContent=item?view.status+(view.next?' · Próxima: '+view.next+' · '+view.nextStatus:''):'Defina a principal para preparar ou apresentar.';status.title=sequence.view().error;}
 row.append(action,name,status,permission);root.append(row);refresh();return {update:refresh};
}
