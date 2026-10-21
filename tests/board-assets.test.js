import test from 'node:test';
import assert from 'node:assert/strict';
import {BoardAssets} from '../integration-main/board-assets.js';
const campaign='campaign';
function setup(){const files=new Map();let uploads=0;const client={storage:{from(bucket){assert.equal(bucket,'cris-images');return {async upload(path,blob){uploads++;files.set(path,blob);return {};},async download(path){return {data:files.get(path)};}};}}};return {assets:new BoardAssets(client,campaign),client,files,uploads:()=>uploads};}
test('imagens grandes saem do JSON; edições seguintes reutilizam arquivo privado e recarga restaura bytes',async()=>{
 const f=setup(),data='data:image/png;base64,'+btoa('A'.repeat(150000)),snapshot={state:{items:[{id:'a',imgId:'img'}]},imgs:{img:data}};
 const packed=await f.assets.pack(snapshot);assert.ok(JSON.stringify(packed).length<500);assert.equal(snapshot.imgs.img,data);assert.equal(f.uploads(),1);assert.ok(packed.imgs.img.path.startsWith('campaign/board/'));
 snapshot.state.items.push({id:'b'});await f.assets.pack(snapshot);assert.equal(f.uploads(),1);
 const other=new BoardAssets(f.client,campaign),loaded=await other.unpack(packed);assert.deepEqual(loaded,{state:{items:[{id:'a',imgId:'img'}]},imgs:{img:data}});await other.pack(loaded);assert.equal(f.uploads(),1);
});
test('snapshots antigos abrem sem migração destrutiva; falha de upload impede publicar referência quebrada',async()=>{
 const f=setup(),legacy={state:{items:[]},imgs:{img:'data:text/plain;base64,QQ=='}};assert.deepEqual(await f.assets.unpack(legacy),legacy);
 f.client.storage.from=()=>({upload:async()=>({error:Error('offline')})});await assert.rejects(()=>f.assets.pack(legacy),/offline/);
 await assert.rejects(()=>f.assets.unpack({imgs:{img:{bucket:'cris-images',path:'outra/board/segredo'}}}),/inválida/);
});
test('arquivo existente é reutilizável; erro de permissão nunca é ignorado',async()=>{
 const data={state:{},imgs:{i:'data:text/plain;base64,QQ=='}};let error={statusCode:'409'};const assets=new BoardAssets({storage:{from:()=>({upload:async()=>({error})})}},campaign);assert.ok((await assets.pack(data)).imgs.i.path);
 error={statusCode:'403',message:'denied'};await assert.rejects(()=>new BoardAssets(assets.client,campaign).pack(data),e=>e.message==='denied');
});
