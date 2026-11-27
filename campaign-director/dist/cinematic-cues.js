import {loadCinematicMedia} from './cinematic-media.js?v=directorcinematic02';
import {cinematicItems,isCinematicKey} from './cinematic-model.js?v=directorcinematic02';
import {sameBoard,sameCinematicScene} from './cinematic-protocol.js?v=directorcinematic02';

// Reuse the ordinary cue/trigger/block model; no second script command type.
export function sceneCinematicCue(scene,item,id=()=>crypto.randomUUID()){
  if(!cinematicItems(scene).some(c=>c.id===item?.id))throw Error('Escolha uma Cinematic salva nesta cena.');
  scene.cues??=[];scene.triggers??=[];
  let cue=scene.cues.find(c=>c.actions.length===1&&c.actions[0].type==='cinematic-start'&&c.actions[0].cinematicId===item.id&&!c.actions[0].delay&&c.actions[0].replace!==false);
  if(!cue){cue={id:id(),name:'Apresentar '+item.name,actions:[{type:'cinematic-start',cinematicId:item.id,replace:true,delay:0}]};scene.cues.push(cue);}
  let trigger=scene.triggers.find(t=>t.cue&&t.cueId===cue.id);
  if(!trigger){trigger={id:id(),name:cue.name,cue:true,cueId:cue.id,key:''};scene.triggers.push(trigger);}
  return {type:'cue',text:cue.name,triggerId:trigger.id};
}

export function validateCinematicCue(action){
  if(action.type==='cinematic-start'&&(!isCinematicKey(action.cinematicId)||action.replace!==undefined&&typeof action.replace!=='boolean')){
    throw Error('Escolha uma Cinematic salva na cena e uma opção válida de substituição.');
  }
  if(action.type==='cinematic-stop'&&action.immediate!==undefined&&typeof action.immediate!=='boolean'){
    throw Error('Escolha como encerrar a Cinematic.');
  }
}

// Cue scheduling remains owned by the existing cue runner. The captured revision
// prevents delayed commands and image loads from surviving navigation or a stop.
export class CinematicCues{
  constructor({engine,link,getScope,getLocation,getState,images,onError,mediaFor}){
    Object.assign(this,{engine,link,getScope,getLocation,getState,images,onError,mediaFor});
    this.revision=0;
    this.command=0;
    engine.addEventListener('cue-context',event=>{
      const {cue,context}=event.detail,state=getState();
      let source;
      for(const campaign of state.campaigns)for(const page of campaign.pages)for(const scene of page.scenes){
        if(scene.cues?.some(value=>value===cue))source={campaignId:campaign.id,pageId:page.id,sceneId:scene.id};
      }
      // Timeline cues originate in the engine's scene snapshot.
      source??=engine.active;
      context.cinematic={scope:{...getScope()},scene:source&&{campaignId:source.campaignId,pageId:source.pageId,sceneId:source.sceneId},revision:this.revision};
    });
    engine.addEventListener('cinematic-action',event=>{
      void this.execute(event.detail.action,event.detail.context.cinematic).catch(error=>onError(error.message));
    });
  }
  invalidate(){this.revision++;this.command++;}
  async execute(action,context){
    const valid=()=>context&&context.revision===this.revision&&sameBoard(context.scope,this.getScope())&&sameCinematicScene(context.scene,this.getLocation());
    if(!valid())return false;
    validateCinematicCue(action);
    const command=++this.command;
    if(action.type==='cinematic-stop'){
      this.link.stop(undefined,{immediate:action.immediate===true});
      return true;
    }
    const state=this.getState(),location=context.scene;
    const scene=state.campaigns.find(value=>value.id===location.campaignId)?.pages.find(value=>value.id===location.pageId)?.scenes.find(value=>value.id===location.sceneId);
    const item=cinematicItems(scene??{}).find(value=>value.id===action.cinematicId);
    if(!item)throw Error('A Cinematic desta cue não está disponível na cena atual. Edite a cue e escolha uma apresentação salva.');
    let image;
    try{image=await (this.mediaFor?this.mediaFor(item,location):loadCinematicMedia(item,this.images));}
    catch(error){if(!valid()||command!==this.command)return false;throw error;}
    if(!valid()||command!==this.command)return false;
    if(!image)throw Error('Imagem da Cinematic indisponível neste navegador. Anexe novamente ou importe o backup completo.');
    const started=await this.link.present(context.scope,context.scene,item,image,{replace:action.replace!==false});
    if(started===undefined)throw Error(this.link.message||'O quadro não confirmou a apresentação desta cue.');
    return started;
  }
}
