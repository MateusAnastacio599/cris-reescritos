import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveWire} from '../integration-main/quadro/board-live.js';
import {RemoteCinematics,publicCinematic,createHostProof,verifyHostProof,hostChallenge,validateManifest} from '../dist/cinematic-remote.js';
import {imageKey} from '../dist/cinematic-media.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const until=async fn=>{for(let i=0;i<200;i++){if(fn())return;await pause(5);}assert.fail('condition not reached');};
const png=new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')],{type:'image/png'});
const imageId=await imageKey(png);
const item={id:'test',imageId,name:'Teatro',motion:'living',seconds:12,intensity:10,ending:'loop',hold:0,fadeIn:0,fadeOut:0};
async function fixture({delay=0,drop=()=>false}={}){
 let publicKey;const packets=[],frames=[],states=[];
 const frame={async show(asset,value,end){frames.push({asset,item:value,end});return true;},async clear(){return true;},seek(time){this.time=time;}};
 const bridge={registerLiveHost:async(room,key)=>publicKey=key,liveHostKey:async()=>publicKey};
 const host=new RemoteCinematics({Wire:LiveWire,frame:{},bridge,lead:150,changed:s=>states.push(s)}),client=new RemoteCinematics({Wire:LiveWire,frame,bridge});
 await host.prepareHost('ROOMONE');
 const a={open:true,_session:'network-session',_name:'Jogador',send:m=>{packets.push(m);if(!drop(m,'host'))setTimeout(()=>client.packet(structuredClone(m),b),delay);}},b={open:true,_session:'network-session',send:m=>{packets.push(m);if(!drop(m,'client'))setTimeout(()=>host.packet(structuredClone(m),a),delay);}};
 host.bind(a,{role:'host',campaign:'case',code:'ROOMONE'});client.bind(b,{role:'client',campaign:'case',code:'ROOMONE'});
 await until(()=>host.peers.get(a).verified&&client.peers.get(b).verified);
 return {host,client,a,b,frames,states,packets,frame,close(){host.close();client.close();a.open=b.open=false;}};
}
test('prova de anfitrião vincula nonce, campanha, sala e sessão sem transmitir token ou chave privada',async()=>{
 let publicKey;const sign=await createHostProof(async(room,key)=>publicKey=key,'ROOMONE');const text=hostChallenge('nonce','case','ROOMONE','session'),signature=await sign(text);
 assert.equal(await verifyHostProof(publicKey,text,signature),true);assert.equal(await verifyHostProof(publicKey,hostChallenge('different','case','ROOMONE','session'),signature),false);assert.equal(await verifyHostProof({...publicKey,d:'secret'},text,signature),false);assert.equal('d' in publicKey,false);
});
test('cinematic simples usa fragmentos/hash/ACK reais do LiveWire e player existente; encerramento confirmado',async()=>{
 const f=await fixture();try{await f.host.present(item,png);await until(()=>f.frames.length===1&&f.host.peers.get(f.a).status==='apresentando');assert.equal(f.frames[0].item.name,'Teatro');assert.equal(await imageKey(f.frames[0].asset),imageId);assert.ok(f.packets.some(p=>p.lane==='cinematic'&&p.kind==='chunk'));f.host.stop();await until(()=>f.host.peers.get(f.a).status==='encerrado');assert.equal(f.client.pending,null);}finally{f.close();}
});
test('manifesto elimina camadas ocultas e não envia sua mídia; composição de câmera usa o mesmo player',async()=>{
 const f=await fixture();try{const secret='image-'+'a'.repeat(64),complex={...item,layers:[{id:'visible',name:'Íris',imageId,x:.5,y:.5,scale:.5,parallax:1,visible:true},{id:'hidden',name:'Segredo',imageId:secret,x:.5,y:.5,scale:.5,parallax:1,visible:false}]};
 assert.equal(publicCinematic(complex).layers.length,1);await f.host.present(complex,{[imageId]:png,[secret]:new Blob(['private'])});await until(()=>f.frames.length===1);assert.equal(f.frames[0].item.layers.length,1);assert.equal(secret in f.frames[0].asset,false);assert.equal(f.packets.some(p=>JSON.stringify(p).includes(secret)),false);
 }finally{f.close();}
});
test('mídia já validada é reutilizada; substituir apresentação não revive a anterior',async()=>{
 const f=await fixture();try{await f.host.present(item,png);await until(()=>f.frames.length===1);const prior=f.client.pending,firstChunks=f.packets.filter(p=>p.lane==='cinematic'&&p.kind==='chunk').length;
 await f.host.present({...item,id:'new',name:'Outra'},png);await until(()=>f.frames.length===2);assert.equal(f.packets.filter(p=>p.lane==='cinematic'&&p.kind==='chunk').length,firstChunks);assert.equal(f.client.pending.item.name,'Outra');f.frames[0].end();await pause(20);assert.equal(f.client.pending.item.name,'Outra');await f.client.handle(f.client.peers.get(f.b),{...prior,kind:'prepare'});assert.equal(f.frames.length,2);
 }finally{f.close();}
});
test('jogador não consegue iniciar/encerrar Cinematic no mestre ou enviar mídia arbitrária',async()=>{
 const f=await fixture();try{const peer=f.host.peers.get(f.a);await f.host.handle(peer,{kind:'prepare',sid:'forged',revision:100,item});await f.host.handle(peer,{kind:'stop',revision:101});assert.equal(f.host.active,null);await assert.rejects(f.host.receiveAsset(peer,{t:'cinematic-asset',sid:'forged',id:imageId}),/Mídia/);assert.equal(f.frames.length,0);}finally{f.close();}
});
test('escopo/sessão incorretos e anfitrião sem prova não exibem nada',async()=>{
 const f=await fixture();try{const peer=f.client.peers.get(f.b);peer.verified=false;await f.client.handle(peer,{kind:'prepare',sid:'forged',revision:99,item});assert.equal(f.frames.length,0);const envelope={cinematic:1,kind:'prepare',campaign:'other',room:'ROOMONE',session:'network-session'};assert.equal(f.client.packet(envelope,f.b),true);assert.equal(f.frames.length,0);}finally{f.close();}
});
test('interromper durante recebimento cancela a apresentação sem encerrar conexão do quadro',async()=>{
 const f=await fixture({delay:10});try{await f.host.present(item,png);f.host.stop(true);await pause(100);assert.equal(f.frames.length,0);assert.equal(f.a.open,true);assert.equal(f.b.open,true);assert.equal(f.client.pending,null);}finally{f.close();}
});
test('fim automático, desconexão e encerramento não revivem apresentação ao reconectar',async()=>{
 const f=await fixture();try{await f.host.present(item,png);await until(()=>f.frames.length===1);f.frames[0].end();await until(()=>f.client.pending===null);f.host.stop();f.host.disconnect(f.a);f.client.disconnect(f.b);assert.equal(f.client.pending,null);assert.equal(f.host.active,null);assert.equal(f.host.peers.size,0);}finally{f.close();}
});
test('mídia corrompida ou não solicitada não entra no cache',async()=>{
 const f=await fixture({drop:m=>m.kind==='play'});try{await f.host.present(item,png);await until(()=>!!f.client.pending&&f.client.cache.size===1);const p=f.client.peers.get(f.b),sid=f.client.pending.sid;const before=f.client.cache.get(imageId);await assert.rejects(f.client.receiveAsset(p,{t:'cinematic-asset',sid,id:imageId,type:'image/png',base64:'A'.repeat(4*Math.ceil(png.size/3))}));assert.equal(f.client.cache.get(imageId),before);await assert.rejects(f.client.receiveAsset(p,{t:'cinematic-asset',sid,id:'image-'+'f'.repeat(64),type:'image/png',base64:'AAAA'}));}finally{f.close();}
});
test('manifesto limita tamanho, número de arquivos e referências visíveis',()=>{
 const m={sid:'run',revision:1,item,assets:[{id:imageId,type:'image/png',size:png.size}],startedAt:Date.now()};assert.equal(validateManifest(m),true);assert.equal(validateManifest({...m,assets:[...m.assets,...m.assets]}),false);assert.equal(validateManifest({...m,assets:[{...m.assets[0],size:13*1024*1024}]}),false);
});
test('reconexão durante apresentação recebe somente a sessão ativa; depois do stop não há replay',async()=>{
 const f=await fixture();try{await f.host.present(item,png);await until(()=>f.frames.length===1);f.host.disconnect(f.a);f.client.disconnect(f.b);f.a._session=f.b._session='new-network-session';f.host.bind(f.a,{role:'host',campaign:'case',code:'ROOMONE'});f.client.bind(f.b,{role:'client',campaign:'case',code:'ROOMONE'});await until(()=>f.frames.length===2);assert.equal(f.client.pending.item.id,item.id);f.host.stop(true);await until(()=>!f.client.pending);f.host.disconnect(f.a);f.client.disconnect(f.b);f.a._session=f.b._session='third-network-session';f.host.bind(f.a,{role:'host',campaign:'case',code:'ROOMONE'});f.client.bind(f.b,{role:'client',campaign:'case',code:'ROOMONE'});await until(()=>f.host.peers.get(f.a).verified);await pause(20);assert.equal(f.frames.length,2);}finally{f.close();}
});
test('preparação antiga pendente e fim automático antigo não encerram a nova',async()=>{
 const f=await fixture();try{await f.host.present({...item,id:'first'},png);await until(()=>f.frames.length===1);const stale={...f.host.active,kind:'prepare'};await f.host.present({...item,id:'second'},png);await until(()=>f.frames.length===2);await f.client.handle(f.client.peers.get(f.b),stale);f.frames[0].end();assert.equal(f.client.pending.item.id,'second');}finally{f.close();}
});
test('falha de validação do anfitrião não oferece mídia nem equivale a sucesso global',async()=>{
 const f=await fixture();try{f.host.sign=null;const peer=f.host.peers.get(f.a);peer.verified=false;await f.host.handle(peer,{kind:'challenge',nonce:'fresh-nonce',campaign:'case',room:'ROOMONE',session:'network-session'});await f.host.present(item,png);assert.equal(peer.status,'falhou');assert.equal(f.packets.some(p=>p.kind==='prepare'),false);}finally{f.close();}
});
test('falha real do player é confirmada como falhou sem desconectar o quadro',async()=>{
 const f=await fixture();try{f.frame.show=async()=>{throw Error('decode failed');};await f.host.present(item,png);await until(()=>f.host.peers.get(f.a).status==='falhou');assert.equal(f.host.peers.get(f.a).run,null);assert.equal(f.a.open,true);assert.equal(f.client.pending,null);}finally{f.close();}
});
test('encerrar sem confirmação do jogador permanece encerrando, não sucesso global',async()=>{
 const f=await fixture({drop:(m,side)=>side==='client'&&m.kind==='state'&&m.status==='encerrado'});try{await f.host.present(item,png);await until(()=>f.host.peers.get(f.a).status==='apresentando');f.host.stop(true);assert.equal(f.host.peers.get(f.a).status,'encerrando');await pause(30);assert.equal(f.host.peers.get(f.a).status,'encerrando');}finally{f.close();}
});
test('WebM transparente, fallback, câmera, efeitos e luz chegam intactos como composição atual',async()=>{
 const {readFileSync}=await import('node:fs'),{defaultCamera,newEffect,lightingProfile}=await import('../dist/cinematic-direction-model.js');
 const fallback=new Blob([readFileSync(new URL('./fixtures/cinematic-studio/iris.png',import.meta.url))],{type:'image/png'}),video=new Blob([readFileSync(new URL('./fixtures/cinematic-studio/iris.webm',import.meta.url))],{type:'video/webm'}),fallbackId=await imageKey(fallback),videoId=await imageKey(video);
 const complex={...item,camera:defaultCamera(),lighting:lightingProfile(),layers:[{id:'iris',name:'Íris',imageId:fallbackId,visible:true,x:.5,y:.6,scale:.35,parallax:1,anchor:{x:.5,y:1},effects:[newEffect('breath')],video:{mediaId:videoId,enabled:true,loop:true,rate:1,delay:0,end:'fallback',transparent:true}}]};
 const f=await fixture();try{await f.host.present(complex,{[imageId]:png,[fallbackId]:fallback,[videoId]:video});await until(()=>f.frames.length===1);assert.deepEqual(f.frames[0].item,complex);assert.equal(await imageKey(f.frames[0].asset[videoId]),videoId);assert.equal(f.frames[0].asset[videoId].type,'video/webm');}finally{f.close();}
});
test('prova capturada não autentica outra campanha, sala ou conexão',async()=>{
 let publicKey;const sign=await createHostProof(async(room,key)=>publicKey=key,'ROOMONE'),text=hostChallenge('nonce','case','ROOMONE','one'),signature=await sign(text);
 for(const target of [hostChallenge('nonce','other','ROOMONE','one'),hostChallenge('nonce','case','ROOMTWO','one'),hostChallenge('nonce','case','ROOMONE','two')])assert.equal(await verifyHostProof(publicKey,target,signature),false);
});
test('descoberta local prefere quadro compartilhado ativo quando outra janela responde primeiro',async()=>{
 const {CinematicLink}=await import('../dist/cinematic-link.js'),{CINEMATIC_CHANNEL,CinematicReceiver}=await import('../dist/cinematic-protocol.js');
 const scope={userId:crypto.randomUUID(),boardCampaignId:crypto.randomUUID()},channels=[],receivers=[];
 for(const [name,priority] of [['old',0],['shared',3]]){const channel=new BroadcastChannel(CINEMATIC_CHANNEL);channels.push(channel);const r=new CinematicReceiver({scope,boardId:name,priority:()=>priority,frame:{clear:async()=>true},send:m=>channel.postMessage(m)});channel.onmessage=e=>void r.handle(e.data);receivers.push(r);}
 const link=new CinematicLink();link.connect();try{const selected=await link.request(scope,{type:'discover'},reply=>reply.type==='ready',1800,'Sem quadro',{collect:true});assert.equal(selected.boardId,'shared');assert.equal(selected.priority,3);}finally{link.close();for(const r of receivers)r.close();for(const channel of channels)channel.close();}
});
test('Cinematic aguarda snapshot confirmado e refresh oferece a sessão atual uma única vez',async()=>{
 const f=await fixture();try{f.a._syncReady=false;await f.host.present(item,png);await pause(30);assert.equal(f.packets.some(p=>p.kind==='prepare'),false);assert.equal(f.host.peers.get(f.a).status,'preparando');f.a._syncReady=true;f.host.refresh();f.host.refresh();await until(()=>f.frames.length===1);assert.equal(f.packets.filter(p=>p.kind==='prepare').length,1);assert.equal(f.host.peers.get(f.a).offered,f.host.active.sid);}finally{f.close();}
});
test('falha ao ler chave no jogador chega ao diagnóstico do mestre sem fingir apresentação',async()=>{
 const f=await fixture();try{f.host.disconnect(f.a);f.client.disconnect(f.b);f.client.bridge={liveHostKey:async()=>{throw Error('permission denied token=secret');}};f.a._session=f.b._session='fresh';f.host.bind(f.a,{role:'host',campaign:'case',code:'ROOMONE'});f.client.bind(f.b,{role:'client',campaign:'case',code:'ROOMONE'});await until(()=>f.host.peers.get(f.a).status==='falhou');assert.equal(f.host.peers.get(f.a).code,'host-key-unavailable');assert.equal(JSON.stringify(f.host.diagnostics()).includes('secret'),false);assert.equal(f.frames.length,0);}finally{f.close();}
});
test('player que recusa show sem lançar erro reporta falhou, não fica carregando indefinidamente',async()=>{
 const f=await fixture();try{f.frame.show=async()=>false;await f.host.present(item,png);await until(()=>f.host.peers.get(f.a).status==='falhou');assert.equal(f.client.pending,null);}finally{f.close();}
});
test('primeiro play frio não expira enquanto a mídia chega; reprodução inicia do zero',async()=>{
 const f=await fixture({drop:m=>m.kind==='play'});try{
  await f.host.present({...item,ending:'auto',seconds:4,hold:0},png);await until(()=>!!f.client.pending&&f.client.cache.size===1);
  const pending=f.client.pending;f.client.now=()=>pending.startedAt+30000;
  await f.client.playClient(pending);assert.equal(f.frames.length,1);assert.equal(f.frame.time,0);
 }finally{f.close();}
});
test('host waits for receiver/media readiness instead of issuing play after only transfer ACK',async()=>{
 const f=await fixture();let release;const ready=new Promise(resolve=>release=resolve);f.frame.prepare=async()=>{await ready;return true;};
 try{await f.host.present(item,png);await until(()=>f.client.cache.size===1);await pause(20);assert.equal(f.packets.some(p=>p.kind==='play'),false);assert.equal(f.host.peers.get(f.a).status,'carregando');release();await until(()=>f.frames.length===1);assert.ok(f.packets.findIndex(p=>p.kind==='ready')<f.packets.findIndex(p=>p.kind==='play'));}finally{release();f.close();}
});
test('local ending does not cancel a cold remote preparation; completion waits for the participant',async()=>{
 const f=await fixture();let release;const ready=new Promise(resolve=>release=resolve);f.frame.prepare=async()=>{await ready;return true;};
 try{await f.host.present(item,png);await until(()=>f.client.cache.size===1);let complete=false;const wait=f.host.waitForCompletion().then(()=>complete=true);await pause(20);assert.equal(complete,false);release();await until(()=>f.frames.length===1);await pause(10);assert.equal(complete,false);f.frames[0].end();await wait;assert.equal(complete,true);}finally{release();f.close();}
});
test('stop during preparation invalidates readiness and does not start the cancelled presentation',async()=>{
 const f=await fixture();let release;const ready=new Promise(resolve=>release=resolve);f.frame.prepare=async()=>{await ready;return true;};
 try{await f.host.present(item,png);await until(()=>f.client.cache.size===1);f.host.stop(true);await until(()=>!f.client.pending);release();await pause(20);assert.equal(f.frames.length,0);assert.equal(f.packets.some(p=>p.kind==='ready'),false);}finally{release();f.close();}
});
test('natural remote completion followed by local stop keeps confirmed ended status',async()=>{
 const f=await fixture();try{await f.host.present(item,png);await until(()=>f.host.peers.get(f.a).status==='apresentando');f.frames[0].end();await until(()=>f.host.peers.get(f.a).status==='encerrado');const stops=f.packets.filter(p=>p.kind==='stop').length;f.host.stop();assert.equal(f.host.peers.get(f.a).status,'encerrado');assert.equal(f.packets.filter(p=>p.kind==='stop').length,stops);}finally{f.close();}
});
test('stop received during fullscreen cleanup invalidates the waiting prepare command',async()=>{
 const f=await fixture();let release;try{
  await f.host.present(item,png);await until(()=>f.frames.length===1);const peer=f.client.peers.get(f.b),old=f.client.pending;
  const cleanup=new Promise(resolve=>release=resolve);f.client.presentation={end:()=>cleanup};
  const prepare=f.client.handle(peer,{...old,kind:'prepare',sid:'replacement-waiting',revision:old.revision+1});
  const stop=f.client.handle(peer,{kind:'stop',revision:old.revision+2,immediate:true});release();await Promise.all([prepare,stop]);assert.equal(f.client.pending,null);assert.equal(f.frames.length,1);
 }finally{release?.();f.client.presentation=null;f.close();}
});
async function additional(f,{decode=0,delay=0,skew=0,id='second'}={}){
 const starts=[],frame={prepare:async()=>{await pause(decode);return true;},startPrepared:async()=>{starts.push(Date.now());return true;},seek(t){this.position=t;},clear:async()=>true};
 const client=new RemoteCinematics({Wire:LiveWire,bridge:f.client.bridge,frame,now:()=>Date.now()+skew});
 const a={open:true,_identity:id,_session:id,send:m=>setTimeout(()=>client.packet(structuredClone(m),b),delay)},b={open:true,_session:id,send:m=>setTimeout(()=>f.host.packet(structuredClone(m),a),delay)};
 f.host.bind(a,{role:'host',campaign:'case',code:'ROOMONE'});client.bind(b,{role:'client',campaign:'case',code:'ROOMONE'});await until(()=>f.host.peers.get(a).verified);return {client,a,b,frame,starts,close(){client.close();f.host.disconnect(a);}};
}
test('all participants and local player wait for the slowest ready; common start compensates clock skew',async()=>{
 const f=await fixture(),g=await additional(f,{decode:80,delay:8,skew:300});let masterStart=0;try{
  const run=await f.host.present(item,png,{prepareLocal:async()=>{await pause(20);return true;},startLocal:async()=>{masterStart=Date.now();return true;}});await pause(50);assert.equal(masterStart,0);assert.equal(f.frames.length,0);await run.begun;await until(()=>g.starts.length===1&&f.frames.length===1);assert.ok(Math.abs(g.starts[0]-masterStart)<70);assert.ok(g.frame.position<.1);assert.equal(run.phase,'apresentando');
 }finally{g.close();f.close();}
});
test('a timed-out participant cannot block indefinitely; explicit proceed admits the ready and catches up the late',async()=>{
 const f=await fixture(),g=await additional(f,{decode:200});f.host.prepareTimeout=30;try{
  const run=await f.host.present(item,png);await until(()=>run.canProceed);assert.equal(run.startAt,undefined);assert.equal(f.host.proceed(),true);await run.begun;await until(()=>g.starts.length===1);assert.ok(g.frame.position>=0);assert.equal(f.host.proceed(),false);
 }finally{g.close();f.close();}
});
test('a late joiner uses the active timeline and does not restart existing players',async()=>{
 const f=await fixture();let g;try{const run=await f.host.present(item,png);await run.begun;await until(()=>f.frames.length===1);await pause(100);g=await additional(f,{decode:20,skew:-450});await until(()=>g.starts.length===1);assert.ok(g.frame.position>=.1);assert.equal(f.frames.length,1);assert.equal(f.host.active,run);}finally{g?.close();f.close();}
});
test('cancel before the scheduled common start prevents both players from starting',async()=>{
 const f=await fixture();let starts=0;try{const run=await f.host.present(item,png,{startLocal:async()=>{starts++;return true;}});await until(()=>!!run.startAt);f.host.stop(true);assert.equal(await run.begun,false);await pause(300);assert.equal(starts,0);assert.equal(f.frames.length,0);}finally{f.close();}
});
test('replacement during local prepare invalidates the old scheduled start',async()=>{
 const f=await fixture();let release,first=0,second=0;const prepare=new Promise(r=>release=r);try{const old=await f.host.present(item,png,{prepareLocal:()=>prepare,startLocal:async()=>{first++;return true;}});const next=await f.host.present({...item,id:'next'},png,{startLocal:async()=>{second++;return true;}});release(true);assert.equal(await old.begun,false);await next.begun;assert.equal(first,0);assert.equal(second,1);await until(()=>f.frames.length===1);assert.equal(f.frames[0].item.id,'next');}finally{release(true);f.close();}
});
test('content cache keeps reusable hashes across different presentations within the byte budget',async()=>{
 const f=await fixture();try{await f.host.present(item,png);await until(()=>f.frames.length===1);const first=f.packets.filter(p=>p.lane==='cinematic'&&p.kind==='chunk').length;const other=new Blob([await png.arrayBuffer(),Uint8Array.of(0)],{type:'image/png'}),id=await imageKey(other);await f.host.present({...item,imageId:id},other);await until(()=>f.frames.length===2);const second=f.packets.filter(p=>p.lane==='cinematic'&&p.kind==='chunk').length;assert.ok(second>first);await f.host.present(item,png);await until(()=>f.frames.length===3);assert.equal(f.packets.filter(p=>p.lane==='cinematic'&&p.kind==='chunk').length,second);assert.ok([...f.client.cache.values()].reduce((n,b)=>n+b.size,0)<=24*1024*1024);}finally{f.close();}
});
test('play promise latency is included when aligning the receiver timeline',async()=>{
 const f=await fixture();try{f.frame.startPrepared=async()=>{await pause(80);return true;};const run=await f.host.present(item,png);await run.begun;await until(()=>f.host.peers.get(f.a).status==='apresentando');assert.ok(f.frame.time>=.07,'seek must include the time spent awaiting play()');}finally{f.close();}
});

test('v4 peers retain publication and sanitized browser/PWA diagnostics',async()=>{
 const f=await fixture();try{f.a._cinematicVersion=4;f.a._cinematicBuild='live01b4';await f.host.present(item,png);await until(()=>f.host.peers.get(f.a).status==='apresentando');const d=f.host.diagnostics();assert.equal(d.build,'live01b4');assert.equal(d.peers[0].version,4);assert.equal(d.peers[0].build,'live01b4');assert.equal(d.peers[0].environment.mode,'browser');assert.equal(d.peers[0].verified,true);assert.ok(d.peers[0].metrics.bytes>0);}finally{f.close();}
});
test('old capability is actionable and never receives a manifest or media',async()=>{
 const f=await fixture();try{f.host.disconnect(f.a);f.a._cinematicVersion=3;f.host.bind(f.a,{role:'host',campaign:'case',code:'ROOMONE'});const before=f.packets.length;await f.host.present(item,png);await pause(20);const peer=f.host.peers.get(f.a);assert.equal(peer.code,'legacy-client');assert.match(peer.error,/Atualize/);assert.equal(f.packets.slice(before).some(p=>p.kind==='prepare'||p.lane==='cinematic'),false);assert.equal(f.host.diagnostics().peers[0].version,3);}finally{f.close();}
});
test('failed preparation preserves stage/code; a new attempt succeeds and stale failure cannot overwrite it',async()=>{
 const f=await fixture();try{f.frame.prepare=async()=>{throw new TypeError('private URL token=secret');};await f.host.present(item,png);await until(()=>f.host.peers.get(f.a).status==='falhou');const old=f.host.active.sid,peer=f.host.peers.get(f.a);assert.equal(peer.code,'media-prepare-failed');assert.equal(peer.failurePhase,'receiver-preparing');assert.equal(peer.errorType,'TypeError');assert.equal(JSON.stringify(f.host.diagnostics()).includes('secret'),false);f.frame.prepare=async()=>true;await f.host.present({...item,id:'second'},png);await until(()=>peer.status==='apresentando');await f.host.handle(peer,{kind:'failure',sid:old,code:'player-start-failed',phase:'player-loading'});assert.equal(peer.status,'apresentando');assert.equal(peer.code,null);assert.equal(peer.failurePhase,null);}finally{f.close();}
});
test('rejected start reports its phase instead of a generic load failure',async()=>{
 const f=await fixture();try{f.frame.show=async()=>{throw new DOMException('decoder','NotSupportedError');};await f.host.present(item,png);await until(()=>f.host.peers.get(f.a).status==='falhou');assert.equal(f.host.peers.get(f.a).code,'player-start-failed');assert.equal(f.host.peers.get(f.a).failurePhase,'player-loading');assert.equal(f.host.peers.get(f.a).errorType,'NotSupportedError');}finally{f.close();}
});
