// Shared by the saved-board projection, engine and regression tests.
export const NEUTRAL_BOARD_FX=Object.freeze({estilo:'cartoon',fumaca:false,nevoa:0,brasas:false,poeira:false,liq:false,faiscas:0,hw:false,cinzas:false});
export const sceneEffects=fx=>({...NEUTRAL_BOARD_FX,...(fx&&typeof fx==='object'&&!Array.isArray(fx)?fx:{})});
export const ownsBoardItem=(item,identity,peer)=>!!item&&!!identity&&(identity.isMaster||!!identity.userId&&item.crisOwner===identity.userId||!!peer&&item.by===peer);
export function nearestPin(pins,point,position,zoom=1,radius=26){let best=null,dist=radius;for(const p of pins){const pos=position(p),d=Math.hypot(pos.x-point.x,pos.y-point.y)*zoom;if(d<dist){best=p;dist=d;}}return best;}

// Local contributions are separate from the master's publication. Never retain
// stale copies of published text or media when a new version arrives.
export function personalBoardLayer(base,current,userId){
 const source=base.state||{},state=current.state||{},ids=key=>new Set((source[key]||[]).map(x=>x.id));
 const items=(state.items||[]).filter(x=>!ids('items').has(x.id)&&x.crisOwner===userId);
 const pins=(state.pins||[]).filter(x=>!ids('pins').has(x.id)&&x.crisOwner===userId);
 const strings=(state.strings||[]).filter(x=>!ids('strings').has(x.id)&&x.crisOwner===userId);
 const poses={};for(const item of state.items||[])if(ids('items').has(item.id))poses[item.id]=Object.fromEntries(['x','y','rot','scale','z'].map(k=>[k,item[k]]));
 const interactions={};for(const item of state.items||[]){const original=(source.items||[]).find(x=>x.id===item.id);if(original)interactions[item.id]=interactionPatch(original,item);}
 const imgs={};for(const item of items)for(const key of ['imgId','audioId'])if(current.imgs?.[item[key]])imgs[item[key]]=current.imgs[item[key]];
 return structuredClone({version:1,items,pins,strings,poses,interactions,cam:state.cam,viewport:current.viewport,imgs});
}
export function mergePersonalBoard(base,layer,userId){
 const result=structuredClone(base),state=result.state;state.fx=sceneEffects();state.amb='';state.lampOff=false;
 if(!layer||layer.version!==1)return result;
 const ids=new Set((state.items||[]).map(x=>x.id));
 state.items=(state.items||[]).map(item=>({...applyInteractionPatch(item,layer.interactions?.[item.id]),...layer.poses?.[item.id]}));
 state.items.push(...(layer.items||[]).filter(x=>x.crisOwner===userId&&!ids.has(x.id)));
 const all=new Set(state.items.map(x=>x.id)),pinIds=new Set((state.pins||[]).map(x=>x.id));
 state.pins=[...(state.pins||[]),...(layer.pins||[]).filter(x=>x.crisOwner===userId&&!pinIds.has(x.id)&&(!x.item||all.has(x.item)))];
 const pins=new Set(state.pins.map(x=>x.id)),strings=new Set((state.strings||[]).map(x=>x.id));
 state.strings=[...(state.strings||[]),...(layer.strings||[]).filter(x=>x.crisOwner===userId&&!strings.has(x.id)&&pins.has(x.a)&&pins.has(x.b))];
 if(layer.cam)state.cam=layer.cam;
 state.z=Math.max(state.z||1,...state.items.map(x=>(x.z||0)+1));
 result.imgs={...result.imgs,...layer.imgs};return result;
}

// Preserve personal interaction deltas only while the master's value is unchanged.
// Runtime audio/canvas handles and identity/source/GM settings are never stored.
const protectedKeys=new Set(['id','type','kind','crisOwner','crisEvidence','crisPart','crisDocument','by','gm','imgId','audioId','x','y','rot','scale','z','seed','filter','opts']);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function interactionPatch(base,current){
 const patch={fields:{},opts:{}};
 for(const key of new Set([...Object.keys(base),...Object.keys(current)])){
  if(key.startsWith('_')||key.startsWith('cris')||protectedKeys.has(key))continue;
  if(!same(base[key],current[key]))patch.fields[key]={before:base[key],after:current[key]};
 }
 // Only the existing handwritten photo caption is editable in the player's inspector.
 if(base.type==='img'&&!same(base.opts?.legenda,current.opts?.legenda))patch.opts.legenda={before:base.opts?.legenda,after:current.opts?.legenda};
 return patch;
}
export function applyInteractionPatch(item,patch){
 if(!patch)return item;
 for(const [key,change]of Object.entries(patch.fields||{}))if(!key.startsWith('_')&&!key.startsWith('cris')&&!protectedKeys.has(key)&&same(item[key],change.before)){if(change.after===undefined)delete item[key];else item[key]=change.after;}
 for(const [key,change]of Object.entries(patch.opts||{}))if(key==='legenda'&&item.type==='img'&&same(item.opts?.[key],change.before)){item.opts={...item.opts};if(change.after===undefined)delete item.opts[key];else item.opts[key]=change.after;}
 return item;
}
