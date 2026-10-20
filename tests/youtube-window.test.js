import test from 'node:test';
import assert from 'node:assert/strict';
import {clampPlayerPosition} from '../dist/youtube-window.js';

test('janela arrastada permanece na tela, acima do mixer',()=>{
  const bounds={width:1440,height:900,playerWidth:232,playerHeight:260,dockTop:810};
  assert.deepEqual(clampPlayerPosition({x:1900,y:1500},bounds),{x:1200,y:542});
  assert.deepEqual(clampPlayerPosition({x:-50,y:-20},bounds),{x:8,y:8});
  assert.deepEqual(clampPlayerPosition({x:400,y:200},bounds),{x:400,y:200});
});
test('posição salva no PC se ajusta ao celular e ignora valores inválidos',()=>{
  const bounds={width:360,height:740,playerWidth:232,playerHeight:260,dockTop:620};
  assert.deepEqual(clampPlayerPosition({x:1200,y:542},bounds),{x:120,y:352});
  assert.deepEqual(clampPlayerPosition({x:'oops',y:null},bounds),{x:120,y:352});
  assert.deepEqual(clampPlayerPosition(null,bounds),{x:120,y:352});
});
