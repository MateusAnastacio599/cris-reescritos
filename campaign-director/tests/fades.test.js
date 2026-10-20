import test from 'node:test';
import assert from 'node:assert/strict';
import {effectFadePlan,EffectFades} from '../dist/audio-fades.js';
import {fadeFields,readFades} from '../dist/fade-ui.js';

test('efeito faz entrada e saída no tempo do arquivo, com trecho central estável',()=>{
  assert.deepEqual(effectFadePlan(10,0,2,3),{level:0,points:[{at:2,value:1},{at:7,value:1},{at:10,value:0}]});
  assert.equal(effectFadePlan(10,1,2,3).level,.5);
  assert.equal(effectFadePlan(10,4,2,3).level,1);
  assert.equal(effectFadePlan(10,8.5,2,3).level,.5);
  assert.deepEqual(effectFadePlan(10,10,2,3),{level:0,points:[]});
});
test('efeitos curtos ajustam fades longos sem salto no ponto de encontro',()=>{
  const midpoint=effectFadePlan(1,1/3,2,4);
  assert.equal(midpoint.level,1);assert.equal(midpoint.points.at(-1).at,1);
  assert.ok(Math.abs(effectFadePlan(1,.5,2,4).level-.75)<1e-10);
  assert.ok(effectFadePlan(1,.32,2,4).level<1);
  assert.ok(effectFadePlan(1,.34,2,4).level<1);
});
test('zero desliga fades e duração desconhecida agenda somente a entrada',()=>{
  assert.deepEqual(effectFadePlan(10,0,0,0),{level:1,points:[]});
  assert.deepEqual(effectFadePlan(NaN,1,2,3),{level:.5,points:[{at:2,value:1}]});
});
test('agendamento congela na pausa e refaz a saída após buffering, seek e velocidade',()=>{
  const audio=new EventTarget();Object.assign(audio,{duration:10,currentTime:8,paused:false,playbackRate:1});
  const context={currentTime:20},calls=[];
  const param={cancelScheduledValues:t=>calls.push(['cancel',t]),setValueAtTime:(v,t)=>calls.push(['set',v,t]),linearRampToValueAtTime:(v,t)=>calls.push(['ramp',v,t])};
  const envelope=new EffectFades(audio,context,param,2,4);
  assert.deepEqual(calls.at(-2),['set',.5,20]);assert.deepEqual(calls.at(-1),['ramp',0,22]);
  audio.paused=true;audio.dispatchEvent(new Event('pause'));assert.deepEqual(calls.at(-1),['set',.5,20]);
  context.currentTime=40;audio.paused=false;audio.playbackRate=2;audio.dispatchEvent(new Event('playing'));assert.deepEqual(calls.at(-1),['ramp',0,41]);
  audio.dispatchEvent(new Event('waiting'));assert.deepEqual(calls.at(-1),['set',.5,40]);
  audio.currentTime=1;audio.dispatchEvent(new Event('seeking'));assert.deepEqual(calls.at(-1),['set',.5,40]);
  audio.dispatchEvent(new Event('seeked'));assert.deepEqual(calls.at(-3),['ramp',1,40.5]);
  envelope.dispose();const count=calls.length;audio.dispatchEvent(new Event('playing'));audio.dispatchEvent(new Event('timeupdate'));assert.equal(calls.length,count);
});
test('campos opcionais diferenciam herança de fade zero e aceitam novos itens',()=>{
  const form=new Map([['fadeIn',''],['fadeOut','0']]);assert.deepEqual(readFades(form),{fadeIn:undefined,fadeOut:0});
  form.set('fadeIn','2.5');assert.equal(readFades(form).fadeIn,2.5);
  assert.ok(fadeFields(null).includes('name="fadeIn" value=""'));
});
