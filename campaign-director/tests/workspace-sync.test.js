import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkspaceSync,contentStamp,syncDecision} from '../dist/workspace-sync.js';
import {initialState} from '../dist/storage.js';
const copy=s=>structuredClone(s);
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),map};};
function fixture(local=initialState(),payload=initialState()){
 const store=storage(),row={id:'workspace',owner_id:'owner',campaign_id:'campaign',revision:1,payload:copy(payload),media:{}},calls=[];let state=copy(local),hold;
 const factory=()=>({binding:null,list:async()=>[row],peek:async()=>copy(row),bind(r){this.binding={id:r.id,ownerId:r.owner_id,revision:r.revision};},load:async function(){calls.push('load');this.bind(row);return copy(row.payload);},save:async function(snapshot){calls.push(copy(snapshot));if(hold)await hold();if(this.binding.revision!==row.revision)throw Error('CONFLICT');row.payload=copy(snapshot);row.revision++;this.binding.revision=row.revision;}});
 const sync=new WorkspaceSync({state:()=>state,apply:s=>state=s,storage:store,workspace:factory,delay:100000});
 return {sync,store,row,calls,get state(){return state;},hold:fn=>hold=fn,clean:()=>sync.detach()};
}
test('primeira migração protege preparação local e exige escolha antes de substituir',async()=>{
 const local=initialState();local.campaigns[0].title='Minha preparação';const f=fixture(local);await f.sync.start('owner');assert.equal(f.sync.status,'review');assert.equal(f.state.campaigns[0].title,'Minha preparação');assert.equal(f.calls.length,0);assert.ok(f.store.getItem('cris:sync:v1:owner:draft'));await f.sync.resolve('local');assert.equal(f.row.payload.campaigns[0].title,'Minha preparação');assert.equal(f.row.revision,2);assert.equal(f.sync.status,'synced');assert.ok(f.store.getItem('cris:sync:v1:owner:previous-cloud'));f.clean();
});
test('novo notebook abre a sessão e mantém a navegação local sem publicar a semente',async()=>{
 const remote=initialState();remote.campaigns[0].title='Sessão pronta';const f=fixture(initialState(),remote);await f.sync.start('owner');assert.equal(f.state.campaigns[0].title,'Sessão pronta');assert.equal(f.sync.dirty,false);assert.deepEqual(f.calls,['load']);f.state.ui.view='library';f.sync.changed();assert.equal(f.sync.dirty,false);f.clean();
});
test('fingerprint ignora ordem de chaves JSONB e navegação, mas detecta áudio e roteiro',()=>{
 const a=initialState(),b=Object.fromEntries(Object.entries(copy(a)).reverse());b.ui.view='library';assert.equal(contentStamp(a),contentStamp(b));b.audioAssets[0].name='Outro nome';assert.notEqual(contentStamp(a),contentStamp(b));
});
test('edição offline preserva rascunho e envia automaticamente após reconexão',async()=>{
 const f=fixture();await f.sync.start('owner');const save=f.sync.workspace.save;f.sync.workspace.save=async()=>{throw Error('Network offline');};f.state.campaigns[0].title='Offline';await f.sync.flush();assert.equal(f.sync.status,'offline');assert.equal(f.row.revision,1);assert.equal(f.sync.dirty,true);assert.ok(f.store.getItem('cris:sync:v1:owner:draft'));f.sync.workspace.save=save;await f.sync.check();assert.equal(f.row.payload.campaigns[0].title,'Offline');assert.equal(f.sync.dirty,false);f.clean();
});
test('alteração concorrente exige revisão e não sobrescreve a outra máquina',async()=>{
 const f=fixture();await f.sync.start('owner');f.state.campaigns[0].title='PC';f.row.payload.campaigns[0].title='Notebook';f.row.revision++;await f.sync.flush();assert.equal(f.sync.status,'review');assert.equal(f.row.payload.campaigns[0].title,'Notebook');assert.equal(f.state.campaigns[0].title,'PC');f.clean();
});
test('edição durante upload só é confirmada quando sua própria versão foi enviada',async()=>{
 const f=fixture();await f.sync.start('owner');f.state.campaigns[0].title='Primeira';let release;f.hold(()=>new Promise(r=>release=r));const saving=f.sync.flush();f.state.campaigns[0].title='Segunda';release();await saving;assert.equal(f.row.payload.campaigns[0].title,'Primeira');assert.equal(f.sync.dirty,true);f.hold(null);await f.sync.flush();assert.equal(f.row.payload.campaigns[0].title,'Segunda');assert.equal(f.sync.dirty,false);f.clean();
});
test('troca de conta durante download não aplica conteúdo da conta anterior',async()=>{
 const f=fixture();let release;f.sync.makeWorkspace=()=>({list:async()=>new Promise(r=>release=r)});const loading=f.sync.start('owner');f.sync.detach();release([f.row]);await loading;assert.equal(f.sync.status,'signed-out');assert.equal(f.sync.owner,null);
});
test('decisão distingue alteração local pendente de divergência entre duas máquinas',()=>{
 const local=initialState(),remote={revision:5,payload:copy(local)},meta={revision:5,base:contentStamp(local)};local.campaigns[0].title='Mudou';assert.equal(syncDecision({local,remote,meta}),'local');remote.revision=6;assert.equal(syncDecision({local,remote,meta}),'review');
});
