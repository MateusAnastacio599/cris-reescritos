import { originalCampaign } from './campaign-data.js';
import {applySceneTextUpdate} from './scene-updates.js';

export const STORAGE_KEY = 'cris-campaign-director:v3';
export const uid = (prefix = 'id') => `${prefix}-${crypto.randomUUID()}`;
export const clone = value => structuredClone(value);
const seedFiles = [
  ['rain','Chuva na janela','ambience','Chuva · Exterior','rain-demo.wav'],
  ['room','Madeira antiga','ambience','Interior · Suspense','roomtone-demo.wav'],
  ['bell','Sino','sfx','Badalada · Igreja','bell-demo.wav'],
  ['thunder','Trovão','sfx','Tempestade · Impacto','thunder-demo.wav'],
  ['door','Porta / Fechadura','sfx','Madeira · Interior','door-demo.wav'],
  ['riser','Riser de tensão','sfx','Tensão · Transição','riser-demo.wav']
];

export function makeScene(title = 'Nova cena') {
  return {id:uid('scene'),title,markdown:'',layers:[],triggers:[],timeline:[],cues:[]};
}
export function makePage(title = 'Nova página', folder = 'Sessão 01') {
  return {id:uid('page'),title,folder,tags:[],icon:'file',scenes:[makeScene('Anotações')]};
}
export function defaultAmbiences(){return [{id:'ambience-sao-martinho',name:'Casa São Martinho · Noite de chuva',description:'Chuva na janela e madeira antiga. Adicione trovões ocasionais ou outros arquivos para compor sua versão.',layers:[{id:'amb-rain',assetId:'asset-rain',name:'Chuva na janela',mode:'loop',volume:.42,enabled:true},{id:'amb-room',assetId:'asset-room',name:'Madeira antiga',mode:'loop',volume:.11,enabled:true}],pads:['asset-bell','asset-thunder','asset-door','asset-riser']}];}
export const CUE_ACTIONS=['board-reveal','board-hide','play','fade','stop','music-play','music-stop','music-volume','ambience','ambience-stop','mix','message','navigate'];
export function initialState() {
  const campaign = clone(originalCampaign);
  campaign.title = 'Reescritos'; campaign.description = 'Paris, 2026 · Ordem Paranormal';
  campaign.pages[0].folder = 'Sessão 01';
  campaign.pages[0].tags = ['Prólogo','Memória de Íris','Só para o mestre'];
  for (const scene of campaign.pages[0].scenes) {
    // Mantém a chave de edição do protótipo quando estiver na mesma origem.
    let text=null;try{text=localStorage.getItem(`cris-director:sao-martinho:${scene.id}:markdown`);}catch{}
    if (text !== null) scene.markdown = text;
    scene.layers.forEach(layer => {layer.assetId = layer.id === 'rain' ? 'asset-rain' : 'asset-room'; layer.group='ambience';});
    scene.cues = scene.id === 'escritorio' ? [{id:'terceira',name:'Terceira Badalada',actions:[
      {type:'fade',layerId:'rain',to:0,duration:1.5,delay:0},
      {type:'play',assetId:'asset-bell',volume:1,delay:0},
      {type:'play',assetId:'asset-riser',volume:.55,delay:.8},
      {type:'fade',layerId:'room',to:.035,duration:2,delay:0}
    ]}] : [];
  }
  const state={
    schemaVersion:3,campaigns:[campaign],
    audioAssets:seedFiles.map(([id,name,kind,tags,file])=>({id:`asset-${id}`,name,kind,tags,provider:'local',src:`assets/audio/${file}`,builtin:true})),
    playlists:[{id:'playlist-sao-martinho',name:'Casa São Martinho',assetIds:['asset-rain','asset-room','asset-bell','asset-thunder','asset-door','asset-riser']}],
    ambiences:defaultAmbiences(),settings:initialDefaults(),
    ui:{campaignId:campaign.id,pageId:campaign.pages[0].id,sceneId:'quarto',view:'document',sessionMode:false}
  };applySceneTextUpdate(state);return state;
}
export function validateState(s) {
  if (!s || s.schemaVersion !== 3 || !Array.isArray(s.campaigns) || !s.campaigns.length || !Array.isArray(s.audioAssets) || !Array.isArray(s.playlists)) throw new Error('Este arquivo não é um backup CRIS Director V3.');
  const ids = new Set();
  const fades=value=>{if(['fadeIn','fadeOut'].some(key=>value[key]!==undefined&&(!Number.isFinite(value[key])||value[key]<0||value[key]>30)))throw new Error('Fade de áudio inválido: use de 0 a 30 segundos.');};
  const musicLoop=value=>{if(value?.loop!==undefined&&typeof value.loop!=='boolean')throw new Error('Repetição da música inválida.');};
  const identity = o => {if (!o || typeof o.id !== 'string' || !o.id || ids.has(o.id)) throw new Error('O backup contém identificadores inválidos ou duplicados.'); ids.add(o.id);};
  for (const c of s.campaigns) {
    identity(c); if(typeof c.title !== 'string'||!Array.isArray(c.pages)||!c.pages.length) throw new Error('Campanha inválida no backup.');
    for (const p of c.pages) {
      identity(p); if(typeof p.title !== 'string'||!Array.isArray(p.scenes)||!p.scenes.length) throw new Error('Página inválida no backup.');
      // IDs de cenas do protótipo podem coincidir entre campanhas importadas antigas.
      const sceneIds = new Set();
      for (const x of p.scenes) {
        if(typeof x.id!=='string'||sceneIds.has(x.id)||typeof x.title!=='string'||typeof x.markdown!=='string'||!Array.isArray(x.layers)||!Array.isArray(x.triggers)||!Array.isArray(x.timeline)) throw new Error('Cena inválida no backup.');
        sceneIds.add(x.id);
        x.layers.forEach(fades);x.triggers.forEach(fades);x.timeline.forEach(fades);
        musicLoop(x.music);
        for(const l of x.layers) if(typeof l.id!=='string'||typeof l.name!=='string'||!Number.isFinite(l.volume)||l.volume<0||l.volume>1) throw new Error('Camada de áudio inválida.');
        for(const t of x.timeline) if(!Number.isFinite(t.at)||t.at<0||!['oneshot','fade','cue'].includes(t.action)) throw new Error('Evento de timeline inválido.');
        if(x.cues!==undefined&&!Array.isArray(x.cues)) throw new Error('Lista de cues inválida.');
        if(x.textHistory!==undefined&&(!Array.isArray(x.textHistory)||x.textHistory.some(v=>!v||typeof v.markdown!=='string'||typeof v.at!=='string'||typeof v.title!=='string')))throw new Error('Histórico do roteiro inválido.');
        for(const cue of x.cues||[]) {
          if(typeof cue.id!=='string'||typeof cue.name!=='string'||!Array.isArray(cue.actions)) throw new Error('Cue inválida.');
          for(const a of cue.actions) if(!CUE_ACTIONS.includes(a.type)||!Number.isFinite(a.delay)||a.delay<0) throw new Error('Ação de cue inválida.');
          for(const a of cue.actions)if(['board-reveal','board-hide'].includes(a.type)&&(typeof a.itemId!=='string'||!a.itemId.trim()||a.itemId.length>180||!/^[-a-f0-9]{36}$/i.test(a.boardCampaignId||'')))throw Error('Pista do quadro inválida na cue.');
          cue.actions.forEach(fades);
          cue.actions.forEach(musicLoop);
        }
      }
    }
  }
  for(const a of s.audioAssets) {
    identity(a);
    fades(a);
    if(typeof a.name!=='string'||!['local','upload','youtube','spotify'].includes(a.provider)||!['music','ambience','sfx'].includes(a.kind)) throw new Error('Item de áudio inválido.');
    if(a.provider==='spotify'&&(a.kind!=='music'||!/^spotify:(track|playlist):[a-zA-Z0-9]{22}$/.test(a.spotifyUri||'')))throw new Error('Link Spotify inválido.');
    if(a.provider==='local'&&!/^assets\/audio\/[a-zA-Z0-9_.-]+$/.test(a.src||'')) throw new Error('Caminho de áudio inválido.');
    if(a.youtubeTracks!==undefined&&(!Array.isArray(a.youtubeTracks)||a.youtubeTracks.some(t=>!t||!/^[\w-]{11}$/.test(t.videoId||'')||typeof t.title!=='string'||t.alias!==undefined&&typeof t.alias!=='string')))throw new Error('Lista de vídeos inválida.');
    if(a.provider==='youtube'&&!/^[\w-]{11}$/.test(a.videoId||'')&&!/^[\w-]{10,}$/.test(a.playlistId||'')) throw new Error('Link do YouTube inválido.');
    if(a.shuffle!==undefined&&typeof a.shuffle!=='boolean')throw new Error('Modo de reprodução inválido.');
    if(a.boost!==undefined&&(!Number.isFinite(a.boost)||a.boost<1||a.boost>4))throw new Error('Amplificação de áudio inválida.');
  }
  for(const p of s.playlists) {identity(p);if(typeof p.name!=='string'||!Array.isArray(p.assetIds)||p.assetIds.some(id=>typeof id!=='string')||p.shuffle!==undefined&&typeof p.shuffle!=='boolean') throw new Error('Playlist inválida.');}
  if(s.ambiences===undefined)s.ambiences=defaultAmbiences();
  if(!Array.isArray(s.ambiences))throw new Error('Lista de ambientes inválida.');
  for(const a of s.ambiences){
    fades(a);
    musicLoop(a.music);
    identity(a);if(typeof a.name!=='string'||!Array.isArray(a.layers)||!Array.isArray(a.pads))throw new Error('Ambiente inválido.');
    const layerIds=new Set();for(const l of a.layers){
      fades(l);
      const file=typeof l.assetId==='string'&&!!l.assetId,playlist=typeof l.playlistId==='string'&&!!l.playlistId;
      if(typeof l.id!=='string'||layerIds.has(l.id)||file===playlist||!['loop','random'].includes(l.mode)||!Number.isFinite(l.volume)||l.volume<0||l.volume>1||l.shuffle!==undefined&&typeof l.shuffle!=='boolean'||l.crossfade!==undefined&&(!Number.isFinite(l.crossfade)||l.crossfade<0||l.crossfade>30))throw new Error('Camada de ambiente inválida.');
      layerIds.add(l.id);if(l.mode==='random'&&(!Number.isFinite(l.minInterval)||!Number.isFinite(l.maxInterval)||l.minInterval<.1||l.maxInterval<l.minInterval))throw new Error('Intervalo de ambiente inválido.');
    }
    if(a.music!==undefined){const m=a.music,file=typeof m?.assetId==='string'&&!!m.assetId,playlist=typeof m?.playlistId==='string'&&!!m.playlistId;if(!m||file===playlist||m.volume!==undefined&&(!Number.isFinite(m.volume)||m.volume<0||m.volume>1)||['fadeIn','fadeOut'].some(key=>m[key]!==undefined&&(!Number.isFinite(m[key])||m[key]<0||m[key]>30)))throw new Error('Trilha musical do ambiente inválida.');}
  }
  s.settings = {...initialDefaults(),...s.settings};
  for(const key of ['master','music','ambience','sfx','spotifyVolume']) s.settings[key] = Math.max(0,Math.min(1,Number(s.settings[key])||0));
  s.settings.crossfade = Math.max(0,Math.min(12,Number(s.settings.crossfade)||0));
  for(const key of ['musicFadeIn','musicFadeOut','spotifyFadeIn','spotifyFadeOut','effectFadeIn','effectFadeOut','ambientFadeIn','ambientFadeOut','stopFade'])s.settings[key]=Math.max(0,Math.min(30,Number(s.settings[key])||0));
  s.settings.autoAdvance=s.settings.autoAdvance!==false;
  s.settings.youtubeCompact=s.settings.youtubeCompact!==false;
  s.ui = s.ui || {}; return s;
}
function initialDefaults(){return {master:.8,music:.7,ambience:.85,sfx:.85,crossfade:1.8,musicFadeIn:2.5,musicFadeOut:2.5,spotifyVolume:1,spotifyFadeIn:.7,spotifyFadeOut:.5,effectFadeIn:.06,effectFadeOut:.25,ambientFadeIn:.2,ambientFadeOut:.45,stopFade:.8,autoAdvance:true,youtubeCompact:true};}
export function loadState() {
  try {const raw=localStorage.getItem(STORAGE_KEY);if(raw){const state=validateState(JSON.parse(raw));if(applySceneTextUpdate(state)){localStorage.setItem(STORAGE_KEY+':before-scene-update',raw);saveState(state);}return state;}} catch(error){console.warn('CRIS: dados salvos precisam de recuperação.',error);throw error;}
  return initialState();
}
export function saveState(state) {localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}

let dbPromise;
function database() {
  if(!dbPromise) dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open('cris-director-media',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('blobs');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>{dbPromise=null;reject(new Error('Não foi possível abrir o armazenamento de áudio.'));};
  });
  return dbPromise;
}
export async function putMedia(id,blob) {const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('blobs','readwrite');tx.objectStore('blobs').put(blob,id);tx.oncomplete=resolve;tx.onerror=()=>reject(new Error('Não foi possível salvar o áudio. Verifique o espaço disponível.'));});}
export async function getMedia(id) {const db=await database();return new Promise((resolve,reject)=>{const q=db.transaction('blobs').objectStore('blobs').get(id);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
export async function deleteMedia(id) {const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('blobs','readwrite');tx.objectStore('blobs').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
const objectURLs = new Map();
export async function resolveAsset(asset) {
  if(!asset)throw new Error('Áudio não encontrado na biblioteca.');
  if(['youtube','spotify'].includes(asset.provider))throw new Error('Links de streaming usam o canal de música.');
  if(asset.provider!=='upload')return {...asset,url:asset.src};
  if(!objectURLs.has(asset.id)) {
    const blob=await getMedia(asset.id);if(!blob)throw new Error(`O arquivo de “${asset.name}” não está neste navegador. Importe o backup com áudios.`);
    objectURLs.set(asset.id,URL.createObjectURL(blob));
  }
  return {...asset,url:objectURLs.get(asset.id)};
}
export function releaseAsset(id) {if(objectURLs.has(id)){URL.revokeObjectURL(objectURLs.get(id));objectURLs.delete(id);}}
export async function exportWorkspace(state,includeMedia=true) {
  const data={application:'CRIS Campaign Director',exportedAt:new Date().toISOString(),state:clone(state),media:{}};
  if(includeMedia)for(const asset of state.audioAssets.filter(a=>a.provider==='upload')) {
    const blob=await getMedia(asset.id);if(!blob)throw new Error(`O áudio “${asset.name}” está ausente. Reimporte o arquivo antes de criar um backup completo.`);
    data.media[asset.id]=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
  }
  return new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
}
export async function importWorkspace(text) {
  const data=JSON.parse(text);const validated=validateState(data.state);
  const blobs=[];
  for(const a of validated.audioAssets.filter(a=>a.provider==='upload')) {
    const value=data.media?.[a.id];if(typeof value!=='string'||!/^data:[^,]*;base64,/.test(value)) throw new Error(`O backup não contém o arquivo de “${a.name}”. Exporte com os áudios incluídos.`);
    const head=value.indexOf(',');const bytes=Uint8Array.from(atob(value.slice(head+1)),c=>c.charCodeAt(0));
    blobs.push([a.id,new Blob([bytes],{type:value.slice(5,head).split(';')[0]})]);
  }
  // Valida tudo antes de alterar o estado; arquivos existentes ficam preservados.
  localStorage.setItem(STORAGE_KEY+':before-import',localStorage.getItem(STORAGE_KEY)||'');
  for(const [id,blob] of blobs){await putMedia(id,blob);releaseAsset(id);}
  saveState(validated);return validated;
}
