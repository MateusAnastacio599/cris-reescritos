import test from 'node:test';
import assert from 'node:assert/strict';
import {cinematicFileStatus,mediaFileName} from '../dist/cinematic-file-card.js';
import {CloudCinematicMedia} from '../dist/cloud-cinematic-media.js';
import {asset} from './fixtures/cinematic-prewarm-harness.mjs';
const a=await asset(18000,'status'),id=a.item.imageId,blob=a.blob;
const cloud=(status='synced')=>({status,owner:'owner',binding:{ownerId:'owner',campaignId:'campaign',revision:4,media:{cinematics:{[id]:{bucket:'cris-images',path:`campaign/director-private/owner/${id}`,sha256:id.split('-').at(-1),type:blob.type,bytes:blob.size}}}}});
test('selection/validation and local availability never imply cloud confirmation',()=>{const s=cinematicFileStatus(id,blob,{local:false});assert.match(s.local,/validado.*não salvas/);assert.match(s.cloud,/pendente/);const local=cinematicFileStatus(id,blob,{local:true});assert.match(local.local,/Salvo localmente.*Pronto neste dispositivo/);assert.doesNotMatch(local.cloud,/Salvo na nuvem/);});
test('only a matching owner and confirmed revision/hash/type/size yield cloud saved',()=>{assert.match(cinematicFileStatus(id,blob,{cloud:cloud()}).cloud,/Salvo na nuvem.*4/);for(const mutate of [c=>c.owner='other',c=>c.binding.media.cinematics[id].path='other/path',c=>c.binding.media.cinematics[id].bytes++,c=>c.binding.media.cinematics[id].sha256='bad',c=>c.binding.media.cinematics[id].type='video/webm']){const c=cloud();mutate(c);assert.doesNotMatch(cinematicFileStatus(id,blob,{cloud:c}).cloud,/Salvo na nuvem/);}});
test('pending, uploading, failed and conflict statuses remain unconfirmed',()=>{for(const [status,label]of [['pending','pendente'],['saving','Sincronizando'],['offline','Falha'],['review','Conflito']])assert.match(cinematicFileStatus(id,blob,{cloud:{status}}).cloud,new RegExp(label));});
test('legacy blobs have no invented filename; known filenames are sanitized',()=>{assert.equal(mediaFileName(blob),'');assert.equal(mediaFileName({name:'C:\\private\\photo.png'}),'photo.png');assert.equal(mediaFileName({name:'a\n.png'}),'a.png');});
test('named file metadata roundtrips through the existing cloud manifest and isolated cache',async()=>{const file=new File([blob],'Teatro.png',{type:blob.type}),state={campaigns:[{pages:[{scenes:[{cinematic:{items:[a.item]}}]}]}]},binding={campaignId:'campaign',ownerId:'owner',media:{}},objects=new Map(),images={get:async()=>file},c={storage:{from:()=>({download:async path=>objects.has(path)?{data:objects.get(path)}:{error:{statusCode:404}},upload:async(path,b)=>{objects.set(path,b);return {};}})}};const service=new CloudCinematicMedia({images}),manifest=await service.save(c,state,binding,()=>{});assert.equal(manifest[id].name,'Teatro.png');const loaded=await new CloudCinematicMedia({images:{get:async()=>null}}).load(c,state,{campaign_id:'campaign',owner_id:'owner',media:{cinematics:manifest}},()=>{});assert.equal(loaded[0][1].name,'Teatro.png');assert.equal(loaded[0][0],id);});
test('empty association never probes IndexedDB with an absent key, even with a stale pooled blob',async()=>{
 const {StudioMediaCards}=await import('../dist/cinematic-file-card.js');let reads=0,error;
 const card={version:0,resolve:async()=>({id:null,blob}),input:{},view:{replaceChildren(){},textContent:''}};
 await StudioMediaCards.prototype.draw.call({images:{get:async()=>{reads++;throw Error('undefined key');}},cloud:()=>({}),report:e=>error=e},card);
 assert.equal(reads,0);assert.equal(error,undefined);assert.equal(card.input.hidden,false);assert.equal(card.view.textContent,'Nenhum arquivo associado.');
});
