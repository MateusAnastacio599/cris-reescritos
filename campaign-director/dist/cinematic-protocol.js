import {isCinematic,isCinematicBlob,isCinematicKey} from './cinematic-model.js';

export const CINEMATIC_CHANNEL='cris-cinematic-local-v1';
export const CINEMATIC_LEASE=75000;
const requestLifetime=15000;
const scopeKeys=['campaignId','pageId','sceneId'];
export const sameCinematicScene=(a,b)=>!!a&&!!b&&scopeKeys.every(key=>a[key]===b[key]);
export const sameBoard=(a,b)=>!!a&&!!b&&a.userId===b.userId&&a.boardCampaignId===b.boardCampaignId;
export const validBoard=scope=>isCinematicKey(scope?.userId)&&isCinematicKey(scope?.boardCampaignId);
const validScene=scene=>scopeKeys.every(key=>isCinematicKey(scene?.[key]));

export function validCinematicMessage(message,scope,now=Date.now()){
  if(!validBoard(scope)||!sameBoard(message,scope)||message.version!==1||
    !isCinematicKey(message.senderId)||!isCinematicKey(message.requestId)||
    !Number.isFinite(message.at)||Math.abs(now-message.at)>requestLifetime)return false;
  if(message.type==='discover')return true;
  if(!isCinematicKey(message.boardId))return false;
  if(message.type==='ready')return true;
  if(!isCinematicKey(message.sessionId)||!validScene(message.scene))return false;
  if(['started','closed','alive'].includes(message.type))return message.type!=='started'||typeof message.ok==='boolean';
  if(!Number.isSafeInteger(message.sequence)||message.sequence<1)return false;
  if(['stop','heartbeat'].includes(message.type))return true;
  return ['start','update'].includes(message.type)&&isCinematic(message.item)&&isCinematicBlob(message.image);
}

export function cinematicEnvelope(scope,fields,at=Date.now()){
  return {...scope,...fields,version:1,at};
}

export const sameCinematicSession=(a,b)=>!!a&&!!b&&a.senderId===b.senderId&&
  a.boardId===b.boardId&&a.sessionId===b.sessionId&&sameCinematicScene(a.scene,b.scene);

export class CinematicReceiver{
  constructor({scope,boardId,frame,send,ready=()=>true,now=Date.now}){
    Object.assign(this,{scope,boardId,frame,send,ready,now});
    this.watermarks=new Map();
  }
  reply(message,fields){
    const {senderId,requestId,sessionId,scene}=message;
    this.send(cinematicEnvelope(this.scope,{senderId,requestId,sessionId,scene,boardId:this.boardId,...fields},this.now()));
  }
  async handle(message){
    const now=this.now();
    if(!this.ready()||!validCinematicMessage(message,this.scope,now))return;
    if(message.type==='discover'){this.reply(message,{type:'ready'});return;}
    if(message.boardId!==this.boardId||!['start','update','stop','heartbeat'].includes(message.type))return;
    for(const [id,entry] of this.watermarks){
      if(now-entry.at>CINEMATIC_LEASE+requestLifetime)this.watermarks.delete(id);
    }
    if(message.sequence<=(this.watermarks.get(message.senderId)?.sequence??0))return;
    this.watermarks.set(message.senderId,{at:now,sequence:message.sequence});
    const matches=sameCinematicSession(this.active,message);
    if(message.type==='stop'){if(matches)this.clear();return;}
    if(message.type==='heartbeat'){
      if(matches){this.active.expires=now+CINEMATIC_LEASE;this.reply(message,{type:'alive'});}
      return;
    }
    if(message.type==='update'&&!matches||message.type==='start'&&this.active&&!matches){
      this.reply(message,{type:'started',ok:false});
      return;
    }
    const active={senderId:message.senderId,boardId:message.boardId,sessionId:message.sessionId,
      scene:message.scene,requestId:message.requestId,expires:now+CINEMATIC_LEASE};
    this.active=active;
    try{
      const shown=await this.frame.show(message.image,message.item);
      if(this.active===active&&shown)this.reply(message,{type:'started',ok:true});
    }catch{
      if(this.active===active){
        this.clear();
        this.reply(message,{type:'started',ok:false});
      }
    }
  }
  expire(){if(this.active&&this.now()>=this.active.expires)this.clear();}
  clear(immediate=false){this.active=null;this.frame.clear({immediate});}
  close(){
    if(this.active)this.reply(this.active,{type:'closed'});
    this.clear(true);
  }
}
