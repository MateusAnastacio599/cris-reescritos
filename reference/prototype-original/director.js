const $ = (q, root=document) => root.querySelector(q);
const $$ = (q, root=document) => [...root.querySelectorAll(q)];

const campaign = {
  id: 'reescritos',
  pages: [{
    id: 'sao-martinho',
    title: 'Casa São Martinho',
    scenes: [
      {
        id:'quarto', title:'O Quarto', label:'01 // O QUARTO',
        markdown:`# CASA SÃO MARTINHO — O QUARTO

*Íris...*

*Escuro… Primeiro vem o cheiro da terra molhada e da chuva batendo contra a janela, um rangido lento, quase rítmico, da madeira velha.*

*Você enxerga uma fagulha trêmula e amarela. Camas de ferro ocupam o quarto. Várias crianças dormem ali, encolhidas nos seus cobertores ásperos e pesados.*

*Você está sentada em uma das camas. Seus pés não alcançam o chão. Seu corpo parece estranhamente pequeno.*

*Ao seu lado uma garotinha segura uma vela com as duas mãos. Ela parece aliviada quando percebe seus olhos abertos.*

> — Maelle?

**Pausa. Pergunte: “O que você faz?”**

## JANELA

*A chuva escorre pelo vidro e distorce o pátio do orfanato. Do outro lado existe outra ala do prédio.*

*Uma das janelas está iluminada por um amarelo muito mais intenso que o restante do orfanato.*

*Você sabe exatamente qual sala é.*

*O escritório. Fim do corredor. À esquerda. E você não faz ideia de como sabe disso.*

[[cue:fechadura|SOM DA FECHADURA]]

> — Foi lá de novo?

[[note:A primeira badalada fica como trigger manual caso a cena trave ou Maelle insista demais buscando respostas.]]

[[cue:sino|PRIMEIRA BADALADA]]`,
        layers:[
          {id:'rain',name:'Chuva na janela',type:'LOOP',src:'assets/audio/rain-demo.wav',volume:.42},
          {id:'room',name:'Madeira antiga',type:'LOOP',src:'assets/audio/roomtone-demo.wav',volume:.11}
        ],
        triggers:[
          {id:'fechadura',name:'Fechadura',key:'3',src:'assets/audio/door-demo.wav'},
          {id:'sino',name:'Sino',key:'1',src:'assets/audio/bell-demo.wav'},
          {id:'trovao',name:'Trovão',key:'2',src:'assets/audio/thunder-demo.wav'}
        ],
        timeline:[{at:32,label:'Rangido distante',action:'oneshot',src:'assets/audio/door-demo.wav'}]
      },
      {
        id:'corredor', title:'O Corredor', label:'02 // O CORREDOR',
        markdown:`# O CORREDOR

*A luz da vela invade o lado de fora da porta. Um corredor estreito, comprido e antigo aparece diante de vocês, com portas dos dois lados e paredes tomadas pela umidade.*

> — Maelle, anda logo!

**Você vai com ela?**

## PEGADAS

*Pequenas marcas úmidas começam alguns metros depois do quarto. São pegadas pequenas e descalças. Elas seguem exatamente na direção do escritório.*

*Misturados à água existem poucos grãos escuros que refletem dourado quando a vela passa sobre eles.*

## DESENHOS

*Casas tortas, animais, famílias, o pátio da São Martinho. Um desenho chama sua atenção: várias crianças lado a lado e um sujeito mais velho atrás delas.*

**LÍVIA — MAELLE — LÉIA — ÍRIS — FELIPE — TIO GIAN**

## UM DESENHO CAÍDO

*Casa São Martinho durante a noite. Todas as janelas escuras, exceto uma pintada com amarelo forte.*

**O escritório.**

[[cue:sino|SEGUNDA BADALADA]]

## O ESCRITÓRIO

*No fim do corredor existe uma porta de madeira escura. Uma pequena fresta separa a porta do batente. Do outro lado, existe uma luz amarela.*

> — Você disse que, se abrisse, a gente tinha que entrar antes que fechasse de novo.

**Pergunte: “O que você faz?”**`,
        layers:[
          {id:'rain',name:'Chuva distante',type:'LOOP',src:'assets/audio/rain-demo.wav',volume:.30},
          {id:'room',name:'Corredor antigo',type:'LOOP',src:'assets/audio/roomtone-demo.wav',volume:.16}
        ],
        triggers:[
          {id:'sino',name:'Sino',key:'1',src:'assets/audio/bell-demo.wav'},
          {id:'trovao',name:'Trovão',key:'2',src:'assets/audio/thunder-demo.wav'},
          {id:'fechadura',name:'Porta / Fechadura',key:'3',src:'assets/audio/door-demo.wav'}
        ],
        timeline:[{at:25,label:'Riser sutil',action:'oneshot',src:'assets/audio/riser-demo.wav'}]
      },
      {
        id:'escritorio', title:'O Escritório', label:'03 // O ESCRITÓRIO',
        markdown:`# DENTRO DO ESCRITÓRIO

*Ao empurrar a porta, ela abre com um rangido baixo. A luz amarela vem de um pequeno abajur sobre a mesa. É forte demais para uma lâmpada tão pequena.*

*O escritório é simples. Uma mesa, armários, alguns livros empilhados e uma janela coberta pela chuva.*

> — Então era isso que você queria ver?

*Mas alguma coisa naquele lugar parece errada: você reconhece a mesa, a janela, até o lugar onde deveria existir uma cadeira. Você nunca esteve aqui. Mas sabe onde tudo fica.*

## A MENINA

*Íris… Você sente um arrepio estranho. Um frio percorrendo seu corpo. Do outro lado da sala, perto da janela, tem uma garotinha.*

*Ela está de costas para vocês, olhando a chuva. Tem praticamente a sua altura, o mesmo corpo pequeno, o mesmo vestido.*

*Ela vira lentamente o rosto na sua direção e sorri.*

> — Mi! Você finalmente voltou.

**Pausa. Deixe Maelle reagir.**

## A TERCEIRA BADALADA

*A garotinha na janela deixa de sorrir. Seus olhos se desviam lentamente para a parede atrás de vocês.*

*A luz amarela do abajur começa a oscilar.*

*Uma vez. Duas. Três…*

[[cue:terceira|TERCEIRA BADALADA // CUE COMPLETA]]

*O som da chuva desaparece. Não diminui. Desaparece.*

*Por um segundo você sabe exatamente o que existe atrás daquela parede. No segundo seguinte, não sabe mais.*

*A chuva sobe. Lívia grita seu nome. Você sente dedos apertando seu braço.*

*Distante, amarelo.*

*Você já esteve ali. Não… Você ainda vai estar.*

*Você ouve areia caindo. Lívia de joelhos, lutando para respirar.*

*Uma mão pequena contra a parede. Sangue entre os dedos. Uma curva. Outra.*

**Você conhece esse símbolo. Não, você ainda não deveria conhecer.**

*Sangue. Areia. Amarelo.*

*E por um único segundo você tem certeza absoluta de que fez alguma coisa terrível.*

---

**Íris. Você abre os olhos.**`,
        layers:[
          {id:'rain',name:'Chuva forte',type:'LOOP',src:'assets/audio/rain-demo.wav',volume:.48},
          {id:'room',name:'Escritório / Madeira',type:'LOOP',src:'assets/audio/roomtone-demo.wav',volume:.09}
        ],
        triggers:[
          {id:'sino',name:'Sino',key:'1',src:'assets/audio/bell-demo.wav'},
          {id:'trovao',name:'Trovão',key:'2',src:'assets/audio/thunder-demo.wav'},
          {id:'porta',name:'Porta',key:'3',src:'assets/audio/door-demo.wav'},
          {id:'terceira',name:'Terceira Badalada',key:'4',cue:true}
        ],
        timeline:[
          {at:22,label:'Riser tenso',action:'oneshot',src:'assets/audio/riser-demo.wav'},
          {at:35,label:'Chuva → 24%',action:'fade',layer:'rain',to:.24,duration:4}
        ]
      }
    ]
  }]
};

let page = campaign.pages[0];
let sceneIndex = 0;
let running = false;
let startedAt = 0;
let elapsedBefore = 0;
let timerRAF = null;
let scheduledTimers = [];
let timelineDone = new Set();
const audioLayers = new Map();
const oneShots = new Set();
let ytPlayer = null;
let ytReady = false;

function scene(){ return page.scenes[sceneIndex]; }
function storageKey(){ return `cris-director:${page.id}:${scene().id}:markdown`; }
function savedMarkdown(){ return localStorage.getItem(storageKey()) || scene().markdown; }

function escapeHtml(s){return s.replace(/[&<>]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[ch]));}
function inlineFormat(s){
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>');
}
function renderMarkdown(md){
  const lines = md.split(/\r?\n/); let html=''; let inList=false;
  const closeList=()=>{if(inList){html+='</ul>';inList=false;}};
  for(const raw of lines){
    const line=raw.trim();
    if(!line){closeList(); continue;}
    if(line==='---'){closeList();html+='<hr>';continue;}
    const cue=line.match(/^\[\[cue:([^|]+)\|(.+)\]\]$/);
    if(cue){closeList();html+=`<div class="inline-cue"><span>${inlineFormat(cue[2])}</span><button data-inline-cue="${cue[1]}">DISPARAR</button></div>`;continue;}
    const note=line.match(/^\[\[note:(.+)\]\]$/);
    if(note){closeList();html+=`<div class="master-note"><b>NOTA DO MESTRE //</b> ${inlineFormat(note[1])}</div>`;continue;}
    if(line.startsWith('### ')){closeList();html+=`<h3>${inlineFormat(line.slice(4))}</h3>`;continue;}
    if(line.startsWith('## ')){closeList();html+=`<h2>${inlineFormat(line.slice(3))}</h2>`;continue;}
    if(line.startsWith('# ')){closeList();html+=`<h1>${inlineFormat(line.slice(2))}</h1>`;continue;}
    if(line.startsWith('> ')){closeList();html+=`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`;continue;}
    if(/^[-*] /.test(line)){if(!inList){html+='<ul>';inList=true;}html+=`<li>${inlineFormat(line.slice(2))}</li>`;continue;}
    closeList(); html+=`<p>${inlineFormat(line)}</p>`;
  }
  closeList(); return html;
}

function render(){
  const s=scene();
  $('#sceneTitle').textContent=s.title;
  $('#dockScene').textContent=`${page.title} // ${s.title}`;
  $('#sceneCounter').textContent=`${String(sceneIndex+1).padStart(2,'0')} / ${String(page.scenes.length).padStart(2,'0')}`;
  $('#markdownView').innerHTML=renderMarkdown(savedMarkdown());
  $('#sceneTabs').innerHTML=page.scenes.map((x,i)=>`<button class="scene-tab ${i===sceneIndex?'active':''}" data-scene="${i}">${x.label}</button>`).join('');
  $$('.scene-tab').forEach(b=>b.onclick=()=>switchScene(+b.dataset.scene));
  $$('[data-inline-cue]').forEach(b=>b.onclick=()=>fireTrigger(b.dataset.inlineCue));
  renderLayers(); renderTimeline(); renderTriggers(); renderDock();
  $('#editorSceneName').textContent=s.title;
  $('#markdownEditor').value=savedMarkdown();
  resetTimerVisual();
}

function switchScene(i){
  if(i<0||i>=page.scenes.length)return;
  stopScene(true); sceneIndex=i; timelineDone.clear(); render();
}

function ensureLayer(def){
  let a=audioLayers.get(def.id);
  if(!a){ a=new Audio(def.src); a.loop=true; a.preload='auto'; audioLayers.set(def.id,a); }
  a.volume=def.volume; return a;
}
function startLayers(){
  scene().layers.forEach(def=>{const a=ensureLayer(def);a.volume=def.volume;a.play().catch(()=>{});});
}
function stopLayers(fade=false){
  for(const a of audioLayers.values()){
    if(fade) fadeAudio(a,0,.55,()=>{a.pause();a.currentTime=0;});
    else {a.pause();a.currentTime=0;}
  }
  if(ytPlayer&&ytReady){try{ytPlayer.pauseVideo();}catch(e){}}
}
function fadeAudio(a,to,duration=1,done){
  const from=a.volume, start=performance.now(), ms=duration*1000;
  const tick=now=>{const t=Math.min(1,(now-start)/ms);a.volume=Math.max(0,Math.min(1,from+(to-from)*t));if(t<1)requestAnimationFrame(tick);else if(done)done();};requestAnimationFrame(tick);
}
function playOne(src,volume=.8){const a=new Audio(src);a.volume=volume;oneShots.add(a);a.onended=()=>oneShots.delete(a);a.play().catch(()=>{});return a;}

function startScene(){
  if(running){pauseScene();return;}
  running=true; startedAt=performance.now()-elapsedBefore*1000;
  startLayers(); scheduleTimeline();
  $('#sceneStatus').textContent='EM EXECUÇÃO'; $('#startScene').classList.add('running'); $('#startScene b').textContent='PAUSAR CENA'; $('#dockPlay').textContent='Ⅱ'; $('.pulse').classList.add('on');
  timerTick();
}
function pauseScene(){
  if(!running)return; running=false; elapsedBefore=(performance.now()-startedAt)/1000; cancelScheduled();
  for(const a of audioLayers.values()) a.pause(); if(ytPlayer&&ytReady){try{ytPlayer.pauseVideo();}catch(e){}}
  $('#sceneStatus').textContent='PAUSADA'; $('#startScene').classList.remove('running'); $('#startScene b').textContent='CONTINUAR CENA'; $('#dockPlay').textContent='▶'; $('.pulse').classList.remove('on');
  cancelAnimationFrame(timerRAF);
}
function stopScene(quiet=false){
  running=false; elapsedBefore=0; cancelScheduled(); cancelAnimationFrame(timerRAF); stopLayers(true); oneShots.forEach(a=>{a.pause();});oneShots.clear();
  if(!quiet){$('#sceneStatus').textContent='PARADA';}
  $('#startScene').classList.remove('running'); $('#startScene b').textContent='INICIAR CENA'; $('#dockPlay').textContent='▶'; $('.pulse').classList.remove('on'); resetTimerVisual();
}
function resetTimerVisual(){if(!running)$('#sceneTimer').textContent='00:00';}
function timerTick(){if(!running)return;const sec=(performance.now()-startedAt)/1000;$('#sceneTimer').textContent=formatTime(sec);renderTimelineProgress(sec);timerRAF=requestAnimationFrame(timerTick);}
function formatTime(sec){sec=Math.max(0,Math.floor(sec));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;}
function cancelScheduled(){scheduledTimers.forEach(clearTimeout);scheduledTimers=[];}
function scheduleTimeline(){
  cancelScheduled(); const current=(performance.now()-startedAt)/1000;
  scene().timeline.forEach((ev,i)=>{if(timelineDone.has(i)||ev.at<=current)return;scheduledTimers.push(setTimeout(()=>executeEvent(ev,i),Math.max(0,(ev.at-current)*1000)));});
}
function executeEvent(ev,i){timelineDone.add(i);if(ev.action==='oneshot')playOne(ev.src,.65);if(ev.action==='fade'){const def=scene().layers.find(x=>x.id===ev.layer);const a=def&&ensureLayer(def);if(a)fadeAudio(a,ev.to,ev.duration||2);}renderTimeline();}

function fireTrigger(id){
  const trig=scene().triggers.find(t=>t.id===id) || {id};
  if(id==='terceira') return thirdBellCue();
  if(trig.src) playOne(trig.src,id==='sino'?1:.8);
  flashTrigger(id);
}
function thirdBellCue(){
  const rain=audioLayers.get('rain'); if(rain)fadeAudio(rain,0,1.5,()=>rain.pause());
  playOne('assets/audio/bell-demo.wav',1);
  setTimeout(()=>playOne('assets/audio/riser-demo.wav',.55),800);
  const room=audioLayers.get('room'); if(room)fadeAudio(room,.035,2);
  $('#timelineState').textContent='CUE // TERCEIRA BADALADA'; flashTrigger('terceira');
}
function flashTrigger(id){const el=$(`[data-trigger="${id}"]`);if(!el)return;el.animate([{boxShadow:'0 0 0 rgba(167,102,255,0)'},{boxShadow:'0 0 22px rgba(167,102,255,.8)'},{boxShadow:'0 0 0 rgba(167,102,255,0)'}],{duration:500});}
function silence(){
  stopLayers(true); oneShots.forEach(a=>fadeAudio(a,0,.25,()=>a.pause()));
  $('#timelineState').textContent='SILÊNCIO';
}

function renderLayers(){
  $('#layerList').innerHTML=scene().layers.map(l=>`<div class="layer-row"><div class="layer-info"><strong>${l.name}</strong><small>${l.type} // ${l.id.toUpperCase()}</small></div><div class="volume-wrap"><input data-volume="${l.id}" type="range" min="0" max="100" value="${Math.round(l.volume*100)}"><span>${Math.round(l.volume*100)}%</span></div></div>`).join('');
  $$('[data-volume]').forEach(r=>r.oninput=()=>{const def=scene().layers.find(x=>x.id===r.dataset.volume);def.volume=+r.value/100;const a=audioLayers.get(def.id);if(a)a.volume=def.volume;r.nextElementSibling.textContent=`${r.value}%`;renderDock();});
}
function renderTimeline(){
  const list=scene().timeline; $('#timelineList').innerHTML=list.length?list.map((e,i)=>`<div class="timeline-item ${timelineDone.has(i)?'done':''}" data-event="${i}"><time>${formatTime(e.at)}</time><span>${e.label}</span><b>${e.action.toUpperCase()}</b></div>`).join(''):'<div class="timeline-item"><span>SEM AUTOMAÇÕES</span></div>';
  if(!running)$('#timelineState').textContent='AGUARDANDO';
}
function renderTimelineProgress(sec){
  const next=scene().timeline.find((e,i)=>!timelineDone.has(i)&&e.at>sec); $('#timelineState').textContent=next?`PRÓXIMO EM ${Math.max(0,Math.ceil(next.at-sec))}s`:'SEM EVENTOS';
}
function renderTriggers(){
  $('#triggerGrid').innerHTML=scene().triggers.map(t=>`<button class="trigger-btn" data-trigger="${t.id}"><strong>${t.name}</strong><small>${t.key?`TECLA ${t.key}`:'MANUAL'}</small></button>`).join('');
  $$('[data-trigger]').forEach(b=>b.onclick=()=>fireTrigger(b.dataset.trigger));
}
function renderDock(){
  $('#dockMeters').innerHTML=scene().layers.map(l=>`<div class="meter"><label><span>${l.name.toUpperCase()}</span><span>${Math.round(l.volume*100)}%</span></label><div class="meter-bar"><i style="width:${Math.round(l.volume*100)}%"></i></div></div>`).join('');
}

function extractYouTubeId(url){
  try{const u=new URL(url);if(u.hostname.includes('youtu.be'))return u.pathname.slice(1);if(u.searchParams.get('v'))return u.searchParams.get('v');const m=u.pathname.match(/\/embed\/([^/?]+)/);return m&&m[1];}catch(e){return null;}
}
function loadYouTube(url,start=0,volume=30){
  const id=extractYouTubeId(url); if(!id)return;
  if(!window.YT){const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';document.head.appendChild(s);window.onYouTubeIframeAPIReady=()=>createYT(id,start,volume);}else createYT(id,start,volume);
}
function createYT(id,start,volume){
  $('#youtubeHost').innerHTML='<div id="youtubePlayer"></div>'; ytReady=false;
  ytPlayer=new YT.Player('youtubePlayer',{height:'180',width:'100%',videoId:id,playerVars:{start,playsinline:1,controls:1},events:{onReady:e=>{ytReady=true;e.target.setVolume(volume);}}});
}

$('#startScene').onclick=startScene; $('#dockPlay').onclick=startScene; $('#stopAllMini').onclick=()=>stopScene();
$('#silenceBtn').onclick=silence; $('#dockSilence').onclick=silence; $('#dockBell').onclick=()=>fireTrigger('sino');
$('#prevScene').onclick=()=>switchScene(sceneIndex-1); $('#nextScene').onclick=()=>switchScene(sceneIndex+1);
$('#sessionModeBtn').onclick=()=>{document.body.classList.toggle('session-mode');$('#sessionModeBtn').textContent=document.body.classList.contains('session-mode')?'SAIR DO MODO SESSÃO':'MODO SESSÃO';};

const modal=$('#editorModal');
$('#editBtn').onclick=()=>{ $('#markdownEditor').value=savedMarkdown(); modal.showModal(); };
$('#saveEdit').onclick=e=>{e.preventDefault();localStorage.setItem(storageKey(),$('#markdownEditor').value);const url=$('#youtubeUrl').value.trim();if(url)loadYouTube(url,+$('#youtubeStart').value||0,+$('#youtubeVolume').value||30);modal.close();render();};

document.addEventListener('keydown',e=>{
  if(modal.open)return;
  const tag=document.activeElement?.tagName;if(['INPUT','TEXTAREA'].includes(tag))return;
  if(e.code==='Space'){e.preventDefault();startScene();}
  if(e.key==='s'||e.key==='S'){e.preventDefault();silence();}
  const trig=scene().triggers.find(t=>t.key===e.key);if(trig)fireTrigger(trig.id);
});

render();
