import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist');
const manifest=JSON.parse(readFileSync(join(root,'.openai/hosting.json'),'utf8'));
if(!manifest.project_id||manifest.static?.directory!=='dist')throw new Error('Manifesto de publicação inválido.');
for(const file of readdirSync(dist).filter(f=>f.endsWith('.js'))){
  const path=join(dist,file),source=readFileSync(path,'utf8');
  const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(check.status!==0)throw new Error(check.stderr);
  for(const match of source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g))if(!existsSync(resolve(dirname(path),match[1])))throw new Error(`Import ausente em ${file}: ${match[1]}`);
}
const html=readFileSync(join(dist,'index.html'),'utf8');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length)throw new Error('IDs duplicados no shell.');
if(!html.includes('type="module" src="app.js"'))throw new Error('Entrada da aplicação ausente.');
if(html.includes('codex-preview'))throw new Error('Metadado temporário de preview encontrado.');
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!/^(https?:|data:)/.test(match[1])&&!existsSync(join(dist,match[1])))throw new Error(`Arquivo ausente: ${match[1]}`);
for(const name of readdirSync(join(dist,'assets/audio'))){const data=readFileSync(join(dist,'assets/audio',name));if(data.length<44||data.toString('ascii',0,4)!=='RIFF')throw new Error(`Áudio inválido: ${name}`);}
for(const name of readdirSync(dist).filter(name=>name.endsWith('.css'))){
  const input=readFileSync(join(dist,name),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'');
  const stack=[],pairs={')':'(',']':'[','}':'{'};
  for(const ch of input){if('({['.includes(ch))stack.push(ch);else if(')}]'.includes(ch)&&stack.pop()!==pairs[ch])throw new Error(`Delimitadores CSS inválidos: ${name}`);}
  if(stack.length)throw new Error(`Delimitadores CSS não fechados: ${name}`);
}
console.log('Verificação aprovada: módulos, imports, shell, CSS, manifesto e arquivos de áudio.');
