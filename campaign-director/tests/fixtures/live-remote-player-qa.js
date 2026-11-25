// Browser QA: actual RemoteCinematics + LiveWire + CinematicFrame; simulated connection.
// This page is explicitly NOT proof of WebRTC, independent accounts or physical devices.
import {RemoteCinematics} from './campaign-director/dist/cinematic-remote.js';
import {CinematicFrame} from './campaign-director/dist/cinematic-frame.js';
import {LiveWire} from './quadro/board-live.js';
import {imageKey} from './campaign-director/dist/cinematic-media.js';
import {defaultCamera,lightingProfile,newEffect} from './campaign-director/dist/cinematic-direction-model.js';
const report=document.querySelector('#state'),surface=document.querySelector('#frame');
const frame=new CinematicFrame(surface),messages=[];let publicKey;
const bridge={registerLiveHost:async(room,key)=>publicKey=key,liveHostKey:async()=>publicKey};
const host=new RemoteCinematics({Wire:LiveWire,frame:{},bridge,changed:states=>{report.textContent=JSON.stringify({transport:'SIMULADO · não homologa WebRTC',participants:states,mediaPackets:messages.filter(m=>m.lane==='cinematic'&&m.kind==='chunk').length},null,2);}});
const player=new RemoteCinematics({Wire:LiveWire,frame,bridge});
await host.prepareHost('QATESTROOM');
const masterConnection={open:true,_session:'qa-session',_name:'Jogador de teste',send:m=>{messages.push(m);setTimeout(()=>player.packet(structuredClone(m),playerConnection),4);}};
const playerConnection={open:true,_session:'qa-session',send:m=>setTimeout(()=>host.packet(structuredClone(m),masterConnection),4)};
host.bind(masterConnection,{role:'host',campaign:'qa',code:'QATESTROOM'});player.bind(playerConnection,{role:'client',campaign:'qa',code:'QATESTROOM'});
async function load(path,type){return new Blob([await(await fetch(path)).arrayBuffer()],{type});}
const background=await load('qa-media/palco.png','image/png'),iris=await load('qa-media/iris.png','image/png'),video=await load('qa-media/iris.webm','video/webm');
const bgId=await imageKey(background),irisId=await imageKey(iris),videoId=await imageKey(video);
const base={id:'qa-simple',name:'Teatro · apresentação simples',imageId:bgId,motion:'living',seconds:12,intensity:12,ending:'loop',hold:0,fadeIn:.2,fadeOut:.3};
const complex={...base,id:'qa-complex',name:'Teatro · câmera, luz e WebM',camera:defaultCamera(),lighting:lightingProfile('theater'),layers:[{id:'iris',name:'Íris',imageId:irisId,visible:true,x:.5,y:.6,scale:.35,parallax:1,anchor:{x:.5,y:1},effects:[newEffect('breath')],video:{mediaId:videoId,enabled:true,loop:true,rate:1,delay:0,end:'fallback',transparent:true}}]};
const act=fn=>async()=>{try{await fn();}catch(error){report.textContent=error.message;}};
document.querySelector('#simple').onclick=act(()=>host.present(base,background));
document.querySelector('#complex').onclick=act(()=>host.present(complex,{[bgId]:background,[irisId]:iris,[videoId]:video}));
document.querySelector('#stop').onclick=()=>host.stop();
document.querySelector('#reconnect').onclick=()=>{host.disconnect(masterConnection);player.disconnect(playerConnection);masterConnection._session=playerConnection._session=crypto.randomUUID();host.bind(masterConnection,{role:'host',campaign:'qa',code:'QATESTROOM'});player.bind(playerConnection,{role:'client',campaign:'qa',code:'QATESTROOM'});};
window.addEventListener('pagehide',()=>{host.close();player.close();frame.clear({immediate:true});});
