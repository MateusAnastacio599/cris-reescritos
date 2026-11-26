// Synchronize only the live-board surface; path differences are explicit and testable.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const files=['quadro/quadro-cris-v7.js','quadro/board-live.js','quadro/board-entry.js','quadro/board-cinematic.js','quadro/board-room-ui.js','quadro/board-room.css','quadro/board-polish.css','quadro/index.html','integration-bridge.js'];
for(const file of files){const original=readFileSync(resolve(root,file),'utf8');for(const target of ['campaign-director/integration-main/','campaign-director/dist/cris/']){
 let content=original;if(target.endsWith('dist/cris/')){
  if(file==='quadro/board-cinematic.js')content=content.replaceAll('../campaign-director/dist/','../../');
  if(file==='quadro/index.html')content=content.replace('../campaign-director/dist/cinematic.css','../../cinematic.css');
  if(file==='integration-bridge.js')content=content.replace("new URL('./campaign-director/dist/',import.meta.url)","new URL('../',import.meta.url)");
 }
 const path=resolve(root,target,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,content);
}}
console.log('Superfície LIVE sincronizada: fonte principal → integração e distribuição.');
