// QA-only cold decoder delay, around the actual board/player/transport integration.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const dest=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Informe um diretório novo.');
const run=spawnSync(process.execPath,[new URL('./live-room-recovery-demo.mjs',import.meta.url).pathname,dest],{encoding:'utf8'});if(run.status)throw Error(run.stderr);
const web=join(dest,'public'),file=join(web,'quadro/index.html');let html=readFileSync(file,'utf8');
html=html.replace('let saved;',`if(player&&params.has('mobileCold')){
 const {CinematicFrame}=await import('../campaign-director/dist/cinematic-frame.js?v=live01b2');const prepare=CinematicFrame.prototype.prepare;
 CinematicFrame.prototype.prepare=async function(...args){if(!this.qaCold){this.qaCold=true;await new Promise(resolve=>setTimeout(resolve,6500));}return prepare.apply(this,args);};
 }let saved;`);writeFileSync(file,html);
let qa=readFileSync(join(web,'live-board-qa.js'),'utf8');
qa+=`\nconst short=document.createElement('button');short.id='qaShort';short.textContent='Apresentar curta (4 s)';document.querySelector('#qaTools').append(short);short.onclick=async()=>{const image=new Blob([await(await fetch('../qa-media/palco.png')).arrayBuffer()],{type:'image/png'});await qaLink.present({userId:window.CRIS_IDENTITY.userId,boardCampaignId:window.CRISBridge.campaignId},{campaignId:'qa',pageId:'theater',sceneId:'test'},{id:'qa-cold',name:'Primeira apresentação',imageId:await imageKey(image),motion:'living',seconds:4,intensity:12,ending:'auto',hold:0,fadeIn:.1,fadeOut:.2},image);};\n`;
writeFileSync(join(web,'live-board-qa.js'),qa);
const harness=join(web,'room-qa.html');let page=readFileSync(harness,'utf8');
page=page.replace('<option>390</option>', '<option>390</option><option>844</option>');
page=page.replace('<label>Vista', '<label>Altura <select id="height"><option>844</option><option>390</option><option>800</option><option>900</option></select></label><label>Vista');
page=page.replace('<button data-action="qaCinematic">', '<button data-action="qaShort">Curta · primeiro play</button><button data-action="qaCinematic">');
page=page.replace('<iframe id="playerBoard"', '<iframe allow="fullscreen" allowfullscreen id="playerBoard"');
page=page.replace("'&visual=1'+transport", "'&visual=1'+transport+(params.has('cold')?'&mobileCold=1':'')");
page=page.replace("document.querySelector('#width').onchange=", "document.querySelector('#height').onchange=e=>{player.style.height=e.target.value+'px';master.style.height=e.target.value+'px';};\ndocument.querySelector('#width').onchange=");
page=page.replace("Não homologa WebRTC nem RLS.'", "Não homologa WebRTC nem RLS. '+(params.has('cold')?'Primeiro decode do jogador atrasado 6,5 s; cena local dura 4 s.':'')");
writeFileSync(harness,page);console.log(dest);
