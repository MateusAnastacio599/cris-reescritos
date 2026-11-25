// Isolated fake-account fixture; real board engine and production PeerJS path.
// NEVER deploy this fixture. No campaign/account Storage or Supabase writes.
import {readFileSync,writeFileSync,cpSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dest=resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Informe um diretório NOVO.');
const base=spawnSync(process.execPath,[new URL('./cinematic-demo.mjs',import.meta.url).pathname,dest],{encoding:'utf8'});if(base.status)throw Error(base.stderr);
const web=join(dest,'public'),file=join(web,'quadro/index.html');let html=readFileSync(file,'utf8');
html=html.replace("const identity={userId:demoScope.userId,name:'Mestre · Demonstração',isMaster:true};",`const params=new URLSearchParams(location.search),player=params.has('sala'),user=params.get('user')||(player?'player-one':'master');
        const testCase=params.get('case')||'case';
        if(!/^[a-zA-Z0-9_-]{1,80}$/.test(testCase))throw Error('Identificador de fixture inválido.');
        demoScope.boardCampaignId='live-fixture-'+testCase;
        const identity={userId:'live-fixture-'+user,name:player?'Matias Valen Azevedo':'Mestre · LIVE-01',isMaster:!player};`);
html=html.replace('loadBoard:async()=>structuredClone(snapshot)',`loadBoard:async()=>structuredClone(snapshot)`);
html=html.replace("        const capture=document.createElement('button');",`        const capture=document.createElement('button');`);
html=html.replace('</body>',`<aside style="position:fixed;bottom:8px;right:8px;z-index:100001;background:#171923;color:#eee;padding:10px;border:1px solid #888;max-width:360px;font:12px system-ui"><strong>LIVE-01 · contas fictícias · não publicar</strong><p id="qaStatus">Aguardando motor…</p><button id="qaImage">Adicionar PNG (fluxo nativo)</button> <button id="qaDrop">Simular queda</button><button id="qaRestart">Reabrir compartilhamento</button><pre id="qaReport" style="max-height:180px;overflow:auto;white-space:pre-wrap"></pre></aside><script type="module" src="../live-board-qa.js"></script></body>`);
writeFileSync(file,html);
const engine=join(web,'quadro/quadro-cris-v7.js');let js=readFileSync(engine,'utf8');
if(!js.includes('  let crisLive,crisApply;'))throw Error('Gancho do teste não encontrado; não gerar fixture incompleta.');
js=js.replace('  let crisLive,crisApply;',`  window.LIVE_QA={snapshot:()=>({state:structuredClone(u),imgs:{...p}}),drop:()=>{for(const c of [...Os.links])c.close();},restart:()=>{br();yr(false);},share:()=>yr(false)};
  let crisLive,crisApply;`);
writeFileSync(engine,js);
cpSync(new URL('./live-board-qa.js',import.meta.url),join(web,'live-board-qa.js'));
writeFileSync(join(web,'index.html'),`<!doctype html><meta charset="utf-8"><title>LIVE-01 · clientes independentes</title><h1>LIVE-01A · validação PeerJS</h1><p>Abra mestre e jogadores em sessões de navegador SEPARADAS. Não há iframe nem BroadcastChannel de teste.</p><a href="quadro/">Mestre</a><p>Depois de compartilhar, copie o link e acrescente user=one, user=two ou user=three aos jogadores em contextos isolados.</p>`);
console.log(dest);

cpSync(new URL('./live-rtc-probe.js',import.meta.url),join(web,'rtc-probe.js'));
writeFileSync(join(web,'rtc-probe.html'),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LIVE-01A.1 · Diagnóstico independente</title><style>body{background:#16151c;color:#eee;font:16px system-ui;margin:24px}button{padding:12px;margin:6px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Diagnóstico WebRTC e isolamento</h1><p>Fixture local, contas fictícias. Este teste não transmite dados de campanha.</p><button id="isolation">Medir isolamento de armazenamento</button><label><input id="stun" type="checkbox">Incluir STUN público do Google (sem TURN)</label><button id="rtc">Testar negociação nativa WebRTC</button><pre id="result"></pre><script type="module" src="rtc-probe.js"></script></html>`);
