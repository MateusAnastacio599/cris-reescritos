import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAccount,normalizeUsername,validUsername,validPassword} from '../backend/functions/director-accounts/core.js';
function env(operator=false){
 const rows=[{user_id:'owner',username:'mateus',is_operator:true},{user_id:'friend',username:'amigo',is_operator:false}],changes=[];
 const admin={from:()=>({select(){return this;},eq(key,value){this.key=key;this.value=value;return this;},async maybeSingle(){return {data:rows.find(r=>r[this.key]===this.value)||null};},async order(){return {data:rows};},async insert(value){changes.push(['insert',value]);return {};}}),auth:{admin:{getUserById:async id=>({data:{user:{id,email:id+'@accounts.cris.invalid'}}}),createUser:async data=>{changes.push(['create',data]);return {data:{user:{id:'new-user'}}};},updateUserById:async(id,data)=>{changes.push(['password',id,data]);return {};},deleteUser:async id=>{changes.push(['delete',id]);return {};}}}};
 const auth={auth:{signInWithPassword:async()=>({data:{session:{access_token:'access',refresh_token:'refresh',user:{email:'PRIVATE'},other:'private'}}})}};
 return {admin,auth,user:{id:operator?'owner':'friend'},limit:async()=>true,changes,rows};
}
test('normalização e limites de usuário/senha seguem o contrato do servidor',()=>{
 assert.equal(normalizeUsername(' Mateus '),'mateus');for(const n of ['abc','iris.1','maelle_2','a-b'])assert.equal(validUsername(n),true);for(const n of ['ab','a@b.com','íris','admin role','a'.repeat(33),'../x'])assert.equal(validUsername(n),false);assert.equal(validPassword('12345678'),true);assert.equal(validPassword('123'),false);
});
test('sem autenticação não pode listar, criar, redefinir ou trocar senha',async()=>{
 for(const action of ['me','list','create','reset','password']){const e=env(true);e.user=null;const r=await handleAccount({action,username:'test',password:'password123'},e);assert.equal(r.status,401);assert.equal(e.changes.length,0);}
});
test('jogador não pode criar contas nem redefinir senhas de outras pessoas',async()=>{
 for(const action of ['create','reset','list']){const e=env();const r=await handleAccount({action,username:'attacker',password:'password123',userId:'owner',is_operator:true},e);assert.equal(r.status,403);assert.equal(e.changes.length,0);}
});
test('mestre cria amigo confirmado, sem mandar e-mail e sem aceitar escalada no corpo',async()=>{
 const e=env(true),r=await handleAccount({action:'create',username:' IRIS ',password:'password123',is_operator:true},e);assert.equal(r.status,200);assert.equal(e.changes[0][1].email_confirm,true);assert.match(e.changes[0][1].email,/@accounts.cris.invalid$/);assert.equal(e.changes[1][1].is_operator,false);assert.equal(e.changes[1][1].username,'iris');assert.equal(JSON.stringify(r.body).includes('password123'),false);
});
test('nome duplicado e senha curta não criam usuários no Auth',async()=>{
 const e=env(true);assert.equal((await handleAccount({action:'create',username:'mateus',password:'password123'},e)).status,409);assert.equal((await handleAccount({action:'create',username:'iris',password:'short'},e)).status,400);assert.equal(e.changes.length,0);
});
test('falha ao registrar username limpa a conta recém-criada e não retorna sucesso',async()=>{
 const e=env(true),from=e.admin.from;e.admin.from=()=>{const q=from();q.insert=async()=>({error:new Error('unique conflict')});return q;};const r=await handleAccount({action:'create',username:'iris',password:'password123'},e);assert.equal(r.status,409);assert.deepEqual(e.changes.at(-1),['delete','new-user']);
});
test('login recebe tokens sem expor e-mails internos ou dados de outras contas',async()=>{
 const e=env(),r=await handleAccount({action:'login',username:'MATEUS',password:'password123'},e);assert.equal(r.status,200);assert.deepEqual(Object.keys(r.body.session).sort(),['access_token','refresh_token']);assert.equal(JSON.stringify(r.body).includes('PRIVATE'),false);assert.equal(r.body.account.username,'mateus');
});
test('usuário inexistente e senha errada retornam a mesma falha',async()=>{
 const e=env();const unknown=await handleAccount({action:'login',username:'unknown',password:'password123'},e);e.auth.auth.signInWithPassword=async()=>({error:new Error('wrong password')});const bad=await handleAccount({action:'login',username:'mateus',password:'password123'},e);assert.equal(unknown.status,401);assert.deepEqual(unknown.body,bad.body);
});
test('limite de tentativas é aplicado antes de procurar credenciais',async()=>{
 const e=env();e.limit=async()=>false;e.admin.from=()=>{throw new Error('Should not query');};assert.equal((await handleAccount({action:'login',username:'mateus',password:'password123'},e)).status,429);
});
test('trocar minha senha ignora um userId de outra pessoa no corpo',async()=>{
 const e=env();assert.equal((await handleAccount({action:'password',userId:'owner',password:'password123'},e)).status,200);assert.equal(e.changes[0][1],'friend');
});
test('mestre pode redefinir a senha de amigo, sem revelar a anterior',async()=>{
 const e=env(true),r=await handleAccount({action:'reset',userId:'friend',password:'new-password123'},e);assert.equal(r.status,200);assert.equal(e.changes[0][1],'friend');assert.deepEqual(r.body,{ok:true});
});
