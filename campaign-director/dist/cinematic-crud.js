import {exportWorkspace,getMedia,putMedia} from './storage.js?v=directorcinematic02';
import {sha256} from './cloud-workspace.js?v=studioux01a';
import {cinematicImages} from './cinematic-media.js?v=directorcinematic02';
import {cinematicItems,validateSceneCinematics} from './cinematic-model.js?v=directorcinematic02';
// Commands are scene-scoped, like CinematicCues. Never remove blobs or rewrite prose.
export function cinematicUsage(scene,id){
 const found=[];
 const visit=(value,path,label)=>{if(!value||typeof value!=='object')return;label=value.name||label||path;if(value.type==='cinematic-start'&&value.cinematicId===id)found.push({action:value,path,label});for(const [key,child]of Object.entries(value))if(child&&typeof child==='object')visit(child,path+'.'+key,label);};
 for(const key of ['cues','triggers','timeline','onStart'])visit(scene[key],key);
 return found;
}
export function planCinematicDeletion(scene,id,{replacementId,primaryId}={}){
 if(!cinematicItems(scene).some(i=>i.id===id))throw Error('A apresentação não existe mais.');
 const next=structuredClone(scene),remaining=cinematicItems(next).filter(i=>i.id!==id),uses=cinematicUsage(next,id);
 if(uses.length){if(!remaining.some(i=>i.id===replacementId))throw Error('Há cues vinculadas. Escolha outra Cinematic para reassociar ou remova os vínculos no roteiro antes de excluir.');for(const use of uses)use.action.cinematicId=replacementId;}
 next.cinematic.items=remaining;
 next.cinematic.remotePrewarmIds=(next.cinematic.remotePrewarmIds||[]).filter(value=>value!==id);
 if(next.cinematic.primaryId===id){if(remaining.length>1&&!remaining.some(i=>i.id===primaryId))throw Error('Escolha a nova Cinematic principal.');if(remaining.length)next.cinematic.primaryId=primaryId||remaining[0].id;else delete next.cinematic.primaryId;}
 validateSceneCinematics(next.cinematic);return next;
}
// Complete recovery snapshot before changing a saved scene; failure aborts deletion.
export async function commitCinematicDeletion(scene,id,{save,backup,valid=()=>true,...choices}){
 const next=planCinematicDeletion(scene,id,choices),stamp=JSON.stringify(scene);await backup();if(!valid()||JSON.stringify(scene)!==stamp)throw Error('A cena mudou durante o backup. Revise antes de excluir.');
 const before=structuredClone(scene);for(const key of Object.keys(scene))delete scene[key];Object.assign(scene,next);
 try{if(!await save(scene))throw Error('Não foi possível salvar a exclusão.');}catch(error){for(const key of Object.keys(scene))delete scene[key];Object.assign(scene,before);throw error;}
 return next;
}

export async function createStudioRecovery(state,owner,{write=putMedia,read=getMedia,storage=localStorage,images=cinematicImages}={}){
 const blob=await exportWorkspace(state,true,images),hash=await sha256(blob),id='studio-recovery-'+crypto.randomUUID();await write(id,blob);const stored=await read(id);if(!stored||await sha256(stored)!==hash)throw Error('O backup da exclusão não pôde ser verificado.');const records=listStudioRecoveries(owner,storage);records.push({id,hash,at:new Date().toISOString()});storage.setItem('cris:studio-recovery:'+owner,JSON.stringify(records));
}
export function listStudioRecoveries(owner,storage=localStorage){const value=JSON.parse(storage.getItem('cris:studio-recovery:'+owner)||'null');return (Array.isArray(value)?value:value?[value]:[]).filter(r=>typeof r.id==='string'&&/^[a-f0-9]{64}$/.test(r.hash));}
export async function readStudioRecovery(owner,{read=getMedia,storage=localStorage,backupId}={}){const records=listStudioRecoveries(owner,storage),record=backupId?records.find(r=>r.id===backupId):records.at(-1);if(!record)throw Error('Nenhum backup de exclusão neste dispositivo.');const blob=await read(record.id);if(!blob||await sha256(blob)!==record.hash)throw Error('Backup de exclusão divergente.');return blob;}
export function reorderCinematic(scene,id,delta,save){const items=cinematicItems(scene),index=items.findIndex(i=>i.id===id),target=index+delta;if(index<0||target<0||target>=items.length)return false;const prior=scene.cinematic;const ordered=[...items];[ordered[index],ordered[target]]=[ordered[target],ordered[index]];scene.cinematic={...prior,items:ordered};try{if(!save(scene))throw Error('Não foi possível salvar a ordem.');}catch(error){scene.cinematic=prior;throw error;}return true;}
