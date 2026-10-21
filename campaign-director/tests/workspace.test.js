import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudWorkspace,sha256,preserveBeforeCloudLoad} from '../dist/cloud-workspace.js';
import {initialState,STORAGE_KEY} from '../dist/storage.js';
import {readFileSync,existsSync} from 'node:fs';
function query(data){return {select(){return this;},eq(){return this;},order:async()=>({data}),single:async()=>({data})};}
async function fixture(){
 const state=initialState();state.audioAssets.push({id:'private-upload',provider:'upload',kind:'sfx',name:'Arquivo próprio'});const blob=new Blob(['verified audio'],{type:'audio/mpeg'}),hash=await sha256(blob);const row={id:'workspace',owner_id:'owner',campaign_id:'campaign',revision:1,payload:state,media:{'private-upload':{bucket:'cris-audio',path:'campaign/file',bytes:blob.size,sha256:hash}}},writes=[],rpcCalls=[];
 const c={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:()=>query(row),storage:{from:()=>({download:async()=>({data:blob}),upload:async()=>({})})},rpc:async(name,body)=>{rpcCalls.push([name,body]);return {data:2};}};
 const workspace=new CloudWorkspace({client:async()=>c,readMedia:async()=>undefined,writeMedia:async(...args)=>writes.push(args),release:()=>{}});return {state,blob,row,c,workspace,writes,rpcCalls};
}
test('abrir cópia verifica os arquivos antes de liberar estado e preserva IDs/cues',async()=>{
 const f=await fixture(),result=await f.workspace.load('workspace');assert.deepEqual(result,f.state);assert.equal(f.writes.length,1);assert.equal(f.workspace.binding.revision,1);assert.equal(f.rpcCalls.length,0);
});
test('download corrompido não altera IndexedDB nem vincula a cópia',async()=>{
 const f=await fixture();f.c.storage.from=()=>({download:async()=>({data:new Blob(['corrupt'])})});await assert.rejects(()=>f.workspace.load('workspace'),/verificação/);assert.equal(f.writes.length,0);assert.equal(f.workspace.binding,null);
});
test('arquivo já presente com hash idêntico não é baixado ou sobrescrito',async()=>{
 const f=await fixture();f.workspace.readMedia=async()=>f.blob;f.c.storage.from=()=>{throw Error('Should use cache');};await f.workspace.load('workspace');assert.equal(f.writes.length,0);
});
test('arquivo local divergente bloqueia abertura sem destruir o arquivo anterior',async()=>{
 const f=await fixture();f.workspace.readMedia=async()=>new Blob(['local changed']);await assert.rejects(()=>f.workspace.load('workspace'),/diferente/);assert.equal(f.writes.length,0);
});
test('salvamento exige vínculo e usuário correto antes de enviar conteúdo',async()=>{
 const f=await fixture();await assert.rejects(()=>f.workspace.save(f.state),/Abra primeiro/);await f.workspace.load('workspace');f.c.auth.getUser=async()=>({data:{user:{id:'other'}}});await assert.rejects(()=>f.workspace.save(f.state),/conta/);assert.equal(f.rpcCalls.length,0);
});
test('save usa versão esperada e só confirma nova revisão depois do banco',async()=>{
 const f=await fixture();await f.workspace.load('workspace');f.workspace.readMedia=async()=>f.blob;await f.workspace.save(f.state);assert.equal(f.rpcCalls[0][1].p_revision,1);assert.equal(f.workspace.binding.revision,2);
 f.c.rpc=async()=>({error:new Error('CONFLICT')});await assert.rejects(()=>f.workspace.save(f.state),/CONFLICT/);assert.equal(f.workspace.binding.revision,2);
});
test('novo áudio tem upload e leitura verificada antes de confirmar a versão',async()=>{
 const f=await fixture();await f.workspace.load('workspace');const fresh=new Blob(['new audio']);f.workspace.readMedia=async()=>fresh;let uploads=0;f.c.storage.from=()=>({upload:async()=>{uploads++;return {};},download:async()=>({data:fresh})});await f.workspace.save(f.state);assert.equal(uploads,1);assert.equal(f.rpcCalls[0][1].p_media['private-upload'].sha256,await sha256(fresh));
});
test('áudio ausente impede salvar uma versão incompleta',async()=>{
 const f=await fixture();await f.workspace.load('workspace');await assert.rejects(()=>f.workspace.save(f.state),/ausente/);assert.equal(f.rpcCalls.length,0);
});
test('cópia local anterior é preservada separadamente antes de abrir a nuvem',()=>{
 const map=new Map([[STORAGE_KEY,'original']]);preserveBeforeCloudLoad({getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)});assert.equal(map.get(STORAGE_KEY),'original');assert.equal(map.get(STORAGE_KEY+':before-cloud-load'),'original');
});
test('CRIS integrado usa módulos, identidade autenticada e não contém mapas de credenciais',()=>{
 const root=new URL('../integration-main/',import.meta.url),html=readFileSync(new URL('index.html',root),'utf8');assert.match(html,/type="module" src="cris.js"/);
 for(const path of ['cris.js','quadro/quadro-cris-v7.js','quadro/quadro-alpha0298-cris-v6.js','quadro/quadro.js']){const s=readFileSync(new URL(path,root),'utf8');assert.doesNotMatch(s,/const CREDENTIALS|const CRIS_AGENTS|MASTER_KEY\s*=/);}
 assert.match(readFileSync(new URL('cris.js',root),'utf8'),/CRISBridge.login/);assert.match(readFileSync(new URL('cris.js',root),'utf8'),/cris_ficha_v2:'\+uid/);
});
test('quadro conserva o motor ativo e filtra os binários de itens ocultos no envio inicial',()=>{
 const s=readFileSync(new URL('../integration-main/quadro/quadro-cris-v7.js',import.meta.url),'utf8');assert.match(s,/u.items.filter\(i=>!i.gm&&!i.hand&&i.kind!=="ativador"\).forEach/);assert.match(s,/window.CRIS_IDENTITY.isMaster/);assert.match(s,/await session.choose\(localSaved,cloudSaved\)/);
 const html=readFileSync(new URL('../integration-main/quadro/index.html',import.meta.url),'utf8');assert.match(html,/quadro-cris-v7.js/);assert.match(html,/mountBoardSession/);assert.match(readFileSync(new URL('../integration-main/quadro/board-session.js',import.meta.url),'utf8'),/Minha ficha/);assert.match(html,/requireIdentity/);
});
