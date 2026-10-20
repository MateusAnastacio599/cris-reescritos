import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../dist/storage.js';
import {inspectLocalWorkspace,formatBytes} from '../dist/cloud-preflight.js';
import {DirectorAccount,accountError} from '../dist/cloud-account.js';

test('conferência preserva configurações, IDs e texto, sem gravar ou enviar arquivos',async()=>{
  const state=initialState();state.audioAssets.push({id:'upload-1',name:'Chuva própria',provider:'upload',kind:'ambience',fadeIn:3,fadeOut:4,boost:2});
  const before=JSON.stringify(state),reads=[];
  const report=await inspectLocalWorkspace(state,{readMedia:async id=>{reads.push(id);return new Blob(['testaudio'],{type:'audio/mpeg'});},now:()=> '2026-10-20T12:00:00.000Z'});
  assert.equal(JSON.stringify(state),before);assert.deepEqual(reads,['upload-1']);assert.equal(report.ready,true);assert.equal(report.bytes,9);assert.equal(report.files[0].type,'audio/mpeg');assert.equal(report.campaigns,state.campaigns.length);assert.equal(report.scenes,state.campaigns.flatMap(c=>c.pages).flatMap(p=>p.scenes).length);
});
test('arquivo ausente ou vazio impede o estado pronto e informa o nome correto',async()=>{
  const state=initialState();state.audioAssets.push({id:'missing',name:'Sino personalizado',provider:'upload',kind:'sfx'},{id:'empty',name:'Vazio',provider:'upload',kind:'music'});
  const r=await inspectLocalWorkspace(state,{readMedia:async id=>id==='empty'?new Blob([]):undefined});
  assert.equal(r.ready,false);assert.deepEqual(r.missing.map(f=>f.name),['Sino personalizado','Vazio']);assert.equal(r.bytes,0);
});
test('YouTube é contado por referência e nunca busca arquivos no IndexedDB',async()=>{
  const state=initialState();state.audioAssets.push({id:'yt',name:'Trilha',provider:'youtube',videoId:'abcdefghijk',kind:'music'});
  const r=await inspectLocalWorkspace(state,{readMedia:()=>{throw new Error('YouTube cannot read a blob');}});assert.equal(r.youtube,1);assert.equal(r.ready,true);
});
test('falha do IndexedDB ou estrutura inválida não produz conferência de sucesso',async()=>{
  const state=initialState();state.audioAssets.push({id:'upload',name:'Teste',provider:'upload',kind:'sfx'});
  await assert.rejects(()=>inspectLocalWorkspace(state,{readMedia:async()=>{throw new Error('IndexedDB unavailable');}}),/IndexedDB/);
  await assert.rejects(()=>inspectLocalWorkspace({campaigns:[]}),/./);
});
test('conferência usa uma cópia consistente mesmo se o texto muda durante a leitura',async()=>{
  const state=initialState();state.audioAssets.push({id:'first',name:'Primeiro',provider:'upload',kind:'sfx'});
  const r=await inspectLocalWorkspace(state,{readMedia:async()=>{state.audioAssets.push({id:'second',name:'Segundo',provider:'upload',kind:'sfx'});return new Blob(['x']);}});assert.equal(r.files.length,1);assert.equal(state.audioAssets.length,8);
});
function fixture(){
  const user={id:'owner'},calls=[];let callback;
  const client={auth:{onAuthStateChange:cb=>{callback=cb;return {data:{subscription:{unsubscribe(){}}}};},getSession:async()=>({data:{session:null}}),setSession:async args=>{calls.push(['setSession',args]);return {data:{user,session:{user}}};},signOut:async args=>{calls.push(['signout',args]);return {};},getUser:async()=>({data:{user}})},functions:{invoke:async(name,{body})=>{calls.push(['function',body.action]);return {data:{session:{access_token:'token',refresh_token:'refresh'},account:{username:'mateus',is_operator:true}}};}},from:()=>{calls.push(['database']);return {select:async()=>({count:2})};}};
  return {user,calls,client,emit:(event,session)=>callback(event,session)};
}
test('entrar e sair não importam dados nem acessam tabelas; logout é só desta sessão',async()=>{
  const f=fixture(),account=new DirectorAccount(async()=>f.client);await account.init();await account.signIn(' gm@example.test ','password');assert.equal(account.user.id,'owner');assert.equal(f.calls.some(c=>c[0]==='database'),false);
  await account.signOut();assert.equal(account.user,null);assert.deepEqual(f.calls.at(-1),['signout',{scope:'local'}]);
});
test('gerenciamento de contas usa endpoint autenticado, sem cadastro público',async()=>{
 const f=fixture(),a=new DirectorAccount(async()=>f.client);await a.createAccount('amigo','password123');assert.deepEqual(f.calls,[['function','create']]);assert.equal(a.user,null);assert.equal(typeof a.signUp,'undefined');
});
test('conferência remota valida usuário com Auth antes de consultar campanhas',async()=>{
  const f=fixture(),a=new DirectorAccount(async()=>f.client);const result=await a.checkConnection();assert.equal(result.campaigns,2);
  f.calls.length=0;f.client.auth.getUser=async()=>({data:{user:null},error:new Error('Session revoked')});await assert.rejects(()=>a.checkConnection(),/Session revoked/);assert.equal(f.calls.length,0);
});
test('falha de autenticação não troca a conta atual nem parece sucesso',async()=>{
  const f=fixture(),a=new DirectorAccount(async()=>f.client);f.client.functions.invoke=async()=>({error:{context:{json:async()=>({code:'invalid_credentials'})}}});await assert.rejects(()=>a.signIn('mateus','bad'),e=>e.code==='invalid_credentials');assert.equal(a.user,null);
});
test('eventos da sessão não fazem consultas assíncronas dentro do callback Auth',async()=>{
  const f=fixture(),a=new DirectorAccount(async()=>f.client);await a.init();let notified=false;a.addEventListener('change',()=>{notified=true;});f.emit('TOKEN_REFRESHED',{user:f.user});assert.equal(notified,false);await new Promise(resolve=>setTimeout(resolve,5));assert.equal(notified,true);assert.equal(f.calls.length,0);
});
test('erros de conta e tamanho de arquivos são legíveis',()=>{
  assert.match(accountError({code:'invalid_credentials'}),/Usuário/);assert.match(accountError({code:'forbidden'}),/mestre/);assert.match(accountError({message:'Failed to fetch'}),/dados locais/);assert.equal(formatBytes(1024),'1 KB');assert.equal(formatBytes(1024**2),'1 MB');
});
