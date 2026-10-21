import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
for(const rel of ['integration-bridge.js','cris.js','quadro/board-session.js','quadro/board-clue-panel.js','quadro/quadro-cris-v7.js','quadro/quadro-alpha0298-cris-v6.js','quadro/quadro.js']){
 const file=join(root,'integration-main',rel);const r=spawnSync(process.execPath,['--input-type=module','--check'],{input:readFileSync(file,'utf8'),encoding:'utf8'});if(r.status!==0)throw Error(rel+': '+r.stderr);
}
for(const rel of ['index.html','cris.css','cris.js','integration-bridge.js','quadro/index.html','quadro/quadro-cris-v7.js','quadro/quadro-cris-v7.css'])if(!existsSync(join(root,'dist/cris',rel)))throw Error('Missing preview: '+rel);
for(const rel of ['index.html','quadro/index.html']){
 const html=readFileSync(join(root,'dist/cris',rel),'utf8');const base=resolve(root,'dist/cris',rel,'..');
 for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(/^(https?:|data:|javascript:)/.test(m[1])||m[1].includes('?'))continue;const target=resolve(base,m[1]);if(!existsSync(target))throw Error('Missing asset in '+rel+': '+m[1]);}
}
console.log('Integração CRIS: sintaxe dos motores e assets verificados.');
