// Shared by the saved-board projection, engine and regression tests.
export const NEUTRAL_BOARD_FX=Object.freeze({estilo:'cartoon',fumaca:false,nevoa:0,brasas:false,poeira:false,liq:false,faiscas:0,hw:false,cinzas:false});
export const sceneEffects=fx=>({...NEUTRAL_BOARD_FX,...(fx&&typeof fx==='object'&&!Array.isArray(fx)?fx:{})});
export const ownsBoardItem=(item,identity,peer)=>!!item&&!!identity&&(identity.isMaster||!!identity.userId&&item.crisOwner===identity.userId||!!peer&&item.by===peer);
export function nearestPin(pins,point,position,zoom=1,radius=26){let best=null,dist=radius;for(const p of pins){const pos=position(p),d=Math.hypot(pos.x-point.x,pos.y-point.y)*zoom;if(d<dist){best=p;dist=d;}}return best;}
