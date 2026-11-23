// Bundled technical assets become ordinary hashed local media after insertion.
export const CINEMATIC_ASSETS=Object.freeze([
  ['fog','Névoa','drift',.025],['smoke','Fumaça','drift',.025],['dust','Poeira / partículas','drift',.015],['warm-beam','Feixe quente',null,0],['warm-flicker','Flicker quente','flicker',.15],['unstable-light','Luz instável','pulse',.02],['blood-floor','Sangue no chão',null,0],['shadow','Vinheta / sombra',null,0],
].map(([id,name,effect,amount])=>({id,name,effect,amount,url:new URL('./assets/cinematic/'+id+'.png',import.meta.url).href})));

export const FOG_VIDEO_ASSET={id:'fog-video',name:'Névoa animada (WebM)',url:new URL('./assets/cinematic/fog.png',import.meta.url).href,videoURL:new URL('./assets/cinematic/fog-loop.webm',import.meta.url).href};
