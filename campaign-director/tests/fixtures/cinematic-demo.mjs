// Builds an isolated snapshot for manual Chrome testing. Both app engines run;
// only identity and persistence adapters are replaced with demo data.
import {cpSync,mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

if(!process.argv[2])throw Error('Informe um diretório novo para a demonstração.');
const destination=resolve(process.argv[2]),repo=resolve(import.meta.dirname,'../../..');
mkdirSync(destination);
const web=join(destination,'public'),scope={userId:'cinematic-demo-master',boardCampaignId:'cinematic-demo-'+randomUUID()};
const storageKey='cris-cinematic-demo-'+randomUUID(),encodedKey='('+JSON.stringify(storageKey)+"+(new URLSearchParams(location.search).get('demoSession')||''))";
mkdirSync(web);
for(const directory of ['quadro','campaign-director/dist']){
  cpSync(join(repo,directory),join(web,directory),{recursive:true});
}
for(const file of readdirSync(repo).filter(name=>name.endsWith('.js')))cpSync(join(repo,file),join(web,file));
const director=join(web,'campaign-director/dist/app.js'),board=join(web,'quadro/index.html');
const simulateMotion=`if(location.search.includes('cinematicReduced')){
  sessionStorage.removeItem('cris-cinematic-motion');
  const original=window.matchMedia.bind(window);
  const media=Object.assign(new EventTarget(),{matches:true});
  window.matchMedia=query=>query.includes('prefers-reduced-motion')?media:original(query);
}`;
let app=readFileSync(director,'utf8').replace('let state,recoveryError;',simulateMotion+'\nlet state,recoveryError;');
app=app.replace('state=loadState();',`state=JSON.parse(localStorage.getItem(${encodedKey}))??initialState();`)
  .replaceAll('saveState(state)',`localStorage.setItem(${encodedKey},JSON.stringify(state))`);
const cloud=app.indexOf('cloudUI=new CloudUI(');
if(cloud<0)throw Error('Não foi possível identificar a inicialização do Director.');
app=app.slice(0,cloud)+`
const demoScope=${JSON.stringify(scope)};
if(new URLSearchParams(location.search).get('demoSession'))demoScope.boardCampaignId='cinematic-demo-'+new URLSearchParams(location.search).get('demoSession');
const account=Object.assign(new EventTarget(),{user:{id:demoScope.userId},profile:{is_operator:true}});
const sync=Object.assign(new EventTarget(),{workspace:{binding:{campaignId:demoScope.boardCampaignId}},changed(){}});
cloudUI={account,sync,renderStatus(){}};
document.body.classList.remove('account-pending','requires-account');
document.body.dataset.demoReady='true';
window.demoAudio=()=>({key:engine.active?.key,running:engine.running,paused:engine.paused,
  time:engine.currentTime(),tracks:[...engine.tracks.keys()],master:state.settings.master});
setInterval(()=>document.body.dataset.demoAudio=JSON.stringify(window.demoAudio()),300);
`+app.slice(app.indexOf('\n',cloud));
writeFileSync(director,app);
let boardHTML=readFileSync(board,'utf8');
const source=boardHTML.indexOf("        import {CRISBridge}");
const end=boardHTML.indexOf('\n',source);
if(source<0)throw Error('Não foi possível identificar a inicialização do quadro.');
boardHTML=boardHTML.slice(0,source)+`
        ${simulateMotion}
        const demoScope=${JSON.stringify(scope)};
if(new URLSearchParams(location.search).get('demoSession'))demoScope.boardCampaignId='cinematic-demo-'+new URLSearchParams(location.search).get('demoSession');
        const identity={userId:demoScope.userId,name:'Mestre · Demonstração',isMaster:true};
        const note=(id,text,x,y,rot)=>({id,type:'note',style:'postit',text,font:'Hand',size:32,color:'#1d2a55',x,y,w:220,h:172,rot,scale:1,z:1,seed:1,parent:null});
        const snapshot={state:{v:3,cam:{x:-42,y:-54,z:.79},
          items:[note('convite','Convite de 7 de outubro',260,260,-5),note('teatro','A porta do teatro',630,410,5)],
          pins:[{id:'a',item:'convite',lx:0,ly:-68,color:'#c3161c'},{id:'b',item:'teatro',lx:0,ly:-68,color:'#c3161c'}],
          strings:[{id:'linha',a:'a',b:'b',color:'#b3121c',slack:1.1}]},imgs:{}};
        const CRISBridge={identity,campaignId:demoScope.boardCampaignId,directorURL:new URL('../campaign-director/dist/',location.href).href,
          requireIdentity:async()=>identity,loadBoard:async()=>structuredClone(snapshot)};
        let saved;
        const capture=document.createElement('button');
        capture.textContent='Fixar snapshot de teste';
        capture.style.cssText='position:fixed;top:58px;right:16px;z-index:10000;padding:8px;background:#f1d296;color:#21190f';
        document.body.append(capture);
        capture.onclick=()=>{
          saved=JSON.stringify(window.CRIS_BOARD_API.snapshot());
          document.body.dataset.demoSnapshot='igual';
          capture.remove();
        };
        const watch=new MutationObserver(()=>{
          if(!saved||!window.CRIS_BOARD_API||document.body.classList.contains('cris-loading'))return;
          const now=JSON.stringify(window.CRIS_BOARD_API.snapshot());
          if(saved)document.body.dataset.demoSnapshot=saved===now?'igual':'alterado';
        });
        watch.observe(document.body,{childList:true,attributes:true,attributeFilter:['hidden','class'],subtree:true});
`+boardHTML.slice(end);
boardHTML=boardHTML.replace("        import {mountBoardSession} from './board-session.js?v=337';\n",'')
  .replace('await mountBoardSession(identity);','');
writeFileSync(board,boardHTML);
cpSync(join(repo,'lume/assets/teatro-garnier.jpg'),join(web,'teatro-garnier.jpg'));
writeFileSync(join(web,'index.html'),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>CRIS · Cinematic 01</title>
<style>body{margin:12px;background:#111017;color:#eee;font:15px system-ui}a{color:#d1b2f3;margin-right:15px}main{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}iframe{width:390px;max-width:100%;height:calc(100dvh - 65px);border:1px solid #715e82}</style>
<nav><a href="campaign-director/dist/" target="director-demo">Director</a><a href="quadro/" target="board-demo">Quadro</a><a href="?mobile">Duas telas de 390 px</a><a href="teatro-garnier.jpg" download>Imagem de teste</a></nav>
<main></main><script>if(location.search){document.querySelector('main').innerHTML='<iframe id="director" title="Director" src="campaign-director/dist/"></iframe><iframe id="board" title="Quadro" src="quadro/"></iframe>';}</script>`);
mkdirSync(join(destination,'.openai'));
writeFileSync(join(destination,'.openai/hosting.json'),'{"static":{"directory":"public"}}\n');
console.log(`Demonstração pronta em ${web}`);

cpSync(new URL('./cinematic-qa.js',import.meta.url),join(web,'cinematic-qa.js'));
writeFileSync(join(web,'qa.html'),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>CINEMATIC-01.2 · Validação local</title>
<style>body{margin:12px;background:#111017;color:#eee;font:14px system-ui}nav{display:flex;gap:14px;align-items:center}a{color:#e0c4ff}main{display:flex;gap:10px}iframe{flex:none;width:950px;height:1000px;border:1px solid #715e82}main{zoom:.67}body.mobile main{zoom:1}body.mobile iframe{width:390px;height:750px}pre{white-space:pre-wrap;max-height:125px;overflow:auto}button{padding:8px}</style>
<nav><button id="run">Validar Quadro vivo e cues</button><button id="show" hidden>Demonstrar Respiração</button><button id="recover" hidden>Validar recarga e quadro indisponível</button><a href="qa.html">Desktop</a><a href="?mobile">390 px</a><a href="?reduced">Movimento reduzido</a></nav><pre id="result"></pre><main><iframe id="director" title="Director"></iframe><iframe id="board" title="Quadro"></iframe></main><script type="module" src="cinematic-qa.js"></script>`);

cpSync(new URL('./cinematic-theater',import.meta.url),join(web,'cinematic-theater'),{recursive:true});
cpSync(new URL('./cinematic-layers-qa.js',import.meta.url),join(web,'cinematic-layers-qa.js'));
writeFileSync(join(web,'campaign-director/dist/cris/quadro/index.html'),boardHTML.replaceAll('../campaign-director/dist/','../../'));
writeFileSync(join(web,'layers.html'),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>CINEMATIC-01.3 · Teatro em camadas</title>
<style>body{margin:12px;background:#111017;color:#eee;font:14px system-ui}nav{display:flex;gap:14px;align-items:center;flex-wrap:wrap}a{color:#e0c4ff}main{display:flex;gap:10px;zoom:.67}iframe{flex:none;width:950px;height:1000px;border:1px solid #715e82}body.mobile main{zoom:1}body.mobile iframe{width:390px;height:750px}pre{white-space:pre-wrap;max-height:120px;overflow:auto}button{padding:8px}</style>
<nav><button id="run">Validar teatro em camadas</button><button id="show" hidden>Apresentar composição</button><a href="layers.html">Desktop</a><a href="?mobile">390 px</a><a href="?reduced&mirror">Movimento reduzido e quadro integrado</a></nav><pre id="result"></pre><main><iframe id="director" title="Director"></iframe><iframe id="board" title="Quadro"></iframe></main><script type="module" src="cinematic-layers-qa.js"></script>`);

cpSync(new URL('./cinematic-studio',import.meta.url),join(web,'cinematic-studio'),{recursive:true});
cpSync(new URL('./cinematic-studio-qa.js',import.meta.url),join(web,'cinematic-studio-qa.js'));
writeFileSync(join(web,'studio.html'),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>CINEMATIC-01.4 · Studio de Direção</title><style>body{margin:12px;background:#111017;color:#eee;font:14px system-ui}nav{display:flex;gap:12px;align-items:center;flex-wrap:wrap}a{color:#e0c4ff}main{display:flex;gap:10px;zoom:.55}iframe{flex:none;width:1440px;height:1040px;border:1px solid #715e82}body.mobile main{zoom:1}body.mobile iframe{width:390px;height:820px}pre{white-space:pre-wrap;max-height:135px;overflow:auto}button{padding:8px}</style><nav><button id="run">Validar Studio de Direção</button><button id="show" hidden>Apresentar Teatro</button><button id="reload" hidden>Validar recarga do quadro</button><button id="fallback" hidden>Validar fallback PNG</button><a href="studio.html">Desktop</a><a href="?mobile">390 px</a><a href="?reduced&mirror">Movimento reduzido + quadro integrado</a></nav><pre id="result"></pre><main><iframe id="director" title="Director"></iframe><iframe id="board" title="Quadro"></iframe></main><script type="module" src="cinematic-studio-qa.js"></script>`);

// Read-only acceptance handles are injected only in this disposable, fictitious app.
const framePath=join(web,'campaign-director/dist/cinematic-frame.js');
writeFileSync(framePath,readFileSync(framePath,'utf8').replace('    this.element=element;',"    this.element=element;\n    if(element.classList.contains('cinematic-studio-preview'))window.demoStudioFrame=this;\n    if(element.classList.contains('cinematic-board-layer'))window.demoBoardFrame=this;"));
cpSync(new URL('./cinematic-camera-qa.js',import.meta.url),join(web,'cinematic-camera-qa.js'));
writeFileSync(join(web,'camera.html'),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>CINEMATIC-01.5A · Direção de câmera</title><style>body{margin:12px;background:#111017;color:#eee;font:14px system-ui}nav{display:flex;gap:10px;align-items:center;flex-wrap:wrap}button{padding:8px}a{color:#e0c4ff}main{display:flex;gap:12px;zoom:.55}iframe{width:1440px;height:1040px;flex:none;border:1px solid #715e82}body.mobile main{zoom:1}body.mobile iframe{width:390px;height:820px}pre{white-space:pre-wrap;max-height:135px;overflow:auto}</style><nav><button id="run">Validar câmera avançada</button><button id="show" hidden>Demonstrar trajetória</button><button id="compat" hidden>Validar apresentações antigas</button><a href="camera.html">Desktop</a><a href="?mobile">390 px</a><a href="?reduced&mirror">Movimento reduzido / integrado</a></nav><pre id="result"></pre><main><iframe id="director" title="Director"></iframe><iframe id="board" title="Quadro"></iframe></main><script type="module" src="cinematic-camera-qa.js"></script>`);
