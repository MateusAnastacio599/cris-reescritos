// Scene time is shared by camera, light, FX and media. No independent timers.
export const sceneSpan=item=>item.sceneDuration??(item.seconds+(item.hold??2));
export const validWindow=w=>!!w&&typeof w==='object'&&!Array.isArray(w)&&Object.keys(w).every(k=>['mode','start','end','fadeIn','fadeOut'].includes(k))&&['scene','range'].includes(w.mode)&&
  ['start','end','fadeIn','fadeOut'].every(k=>Number.isFinite(w[k]))&&w.start>=0&&w.end>w.start&&w.end<=180&&w.fadeIn>=0&&w.fadeOut>=0&&w.fadeIn+w.fadeOut<=w.end-w.start;
export const defaultWindow=span=>({mode:'scene',start:0,end:span,fadeIn:0,fadeOut:0});
const smooth=n=>{n=Math.max(0,Math.min(1,n));return n*n*(3-2*n);};
export function windowRange(window,span){return window?.mode==='range'?{start:window.start,end:Math.min(span,window.end)}:{start:0,end:span};}
export function windowEnvelope(window,time,span){
  const {start,end}=windowRange(window,span);if(end<=start||time<start||time>end||(time===end&&(window?.mode==='range'||window?.fadeOut>0)))return 0;
  return (window?.fadeIn?smooth((time-start)/window.fadeIn):1)*(window?.fadeOut?smooth((end-time)/window.fadeOut):1);
}
export function timedFrames(span,sample){const count=Math.max(2,Math.min(1800,Math.ceil(span*20)));return Array.from({length:count+1},(_,i)=>({offset:i/count,...sample(i/count*span)}));}
export function temporalAnimation(node,frames,span,time,loop=false){const animation=node.animate(frames,{duration:span*1000,fill:'both',easing:'linear',iterations:loop?Infinity:1});animation.currentTime=time;return animation;}
