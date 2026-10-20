export const fadeSeconds=value=>Math.max(0,Math.min(30,Number(value)||0));

/** Envelope relativo ao tempo do arquivo, inclusive após pausa ou seek. */
export function effectFadePlan(duration,position,fadeIn=0,fadeOut=0){
  const known=Number.isFinite(duration)&&duration>0;
  let attack=fadeSeconds(fadeIn),release=known?fadeSeconds(fadeOut):0;
  if(known&&attack+release>duration){const scale=duration/(attack+release);attack*=scale;release*=scale;}
  const time=Math.max(0,Number(position)||0),end=known?duration:Infinity,start=end-release;
  const level=time>=end?0:attack&&time<attack?time/attack:release&&time>=start?(end-time)/release:1;
  const points=[];
  if(attack&&time<attack)points.push({at:attack,value:1});
  if(release){if(time<start)points.push({at:start,value:1});if(time<end)points.push({at:end,value:0});}
  return {level,points};
}

export class EffectFades {
  constructor(audio,context,param,fadeIn,fadeOut){
    this.audio=audio;this.context=context;this.param=param;this.fadeIn=fadeIn;this.fadeOut=fadeOut;this.listeners=[];
    const listen=(event,callback)=>{audio.addEventListener?.(event,callback);this.listeners.push([event,callback]);};
    for(const event of ['loadedmetadata','durationchange','timeupdate','ratechange'])listen(event,()=>this.sync());
    for(const event of ['pause','waiting','seeking'])listen(event,()=>{this.waiting=true;this.sync();});
    listen('playing',()=>{this.waiting=false;this.sync();});
    listen('seeked',()=>{this.waiting=audio.paused;this.sync();});
    this.sync();
  }
  sync(){
    if(this.closed)return;
    const {audio,context,param}=this,position=audio.currentTime||0,now=context.currentTime;
    const plan=effectFadePlan(audio.duration,position,this.fadeIn,this.fadeOut);
    param.cancelScheduledValues(now);param.setValueAtTime(plan.level,now);
    if(audio.paused||audio.ended||this.waiting)return;
    const rate=audio.playbackRate>0?audio.playbackRate:1;
    for(const point of plan.points)param.linearRampToValueAtTime(point.value,now+(point.at-position)/rate);
  }
  dispose(){this.closed=true;for(const [event,callback] of this.listeners)this.audio.removeEventListener?.(event,callback);this.listeners=[];this.param.cancelScheduledValues(this.context.currentTime);}
}
