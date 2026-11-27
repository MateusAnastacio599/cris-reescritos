import {validWindow} from './cinematic-timing.js?v=live01b4';
const n=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
export const validFlicker=f=>!!f&&Object.keys(f).every(k=>['amount','frequency','seed'].includes(k))&&n(f.amount,0,.3)&&n(f.frequency,.1,2)&&Number.isInteger(f.seed)&&n(f.seed,0,65535);
export function validLightExtensions(l){return (l.window===undefined||validWindow(l.window))&&(l.flicker===undefined||validFlicker(l.flicker))&&(l.kind===undefined||['spot','beam','global'].includes(l.kind))&&(l.rotation===undefined||n(l.rotation,-180,180));}
export function validLightEvent(e){return !!e&&Object.keys(e).every(k=>['id','type','start','duration','count','gap','amount','color'].includes(k))&&typeof e.id==='string'&&/^[-\w]{1,128}$/.test(e.id)&&['blackout','flash'].includes(e.type)&&n(e.start,0,179)&&n(e.duration,.2,.5)&&Number.isInteger(e.count)&&n(e.count,1,3)&&n(e.gap,.6,10)&&n(e.amount,0,e.type==='flash'?.25:1)&&/^#[a-f\d]{6}$/i.test(e.color);}
export function lightEvent(type='blackout'){return {id:crypto.randomUUID(),type,start:6,duration:.3,count:3,gap:1,amount:type==='flash'?.15:.9,color:'#ffe3a0'};}
