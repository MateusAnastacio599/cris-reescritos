// Video decoding is deliberately isolated from camera, protocol and Audio Engine.
export const VIDEO_LIMITS=Object.freeze({bytes:8*1024*1024,seconds:12,side:1280,pixels:1280*720,fps:30,count:2});
const containers=new Set([0x18538067,0x1549a966,0x1654ae6b,0xae,0xe0]);
function vint(bytes,start,id=false){
  const first=bytes[start];if(!first)throw Error('Cabeçalho WebM inválido.');
  let length=1,mask=128;while(!(first&mask)){length++;mask>>=1;}
  if(length>(id?4:8)||start+length>bytes.length)throw Error('WebM incompleto.');
  let value=id?first:first&(mask-1);for(let i=1;i<length;i++)value=value*256+bytes[start+i];
  const unknown=!id&&value===2**(7*length)-1;
  return {value,length,unknown};
}
export async function checkCinematicVideo(blob,{extension=false}={}){
  if(!(blob instanceof Blob)||blob.type!=='video/webm'||!blob.size||blob.size>VIDEO_LIMITS.bytes)throw Error('Use WebM VP9 transparente de até 8 MB, 12 s e 1280 × 720 px.');
  if(extension&&typeof blob.name==='string'&&!/\.webm$/i.test(blob.name))throw Error('O arquivo de vídeo deve ter extensão .webm.');
  const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);
  if(bytes[0]!==0x1a||bytes[1]!==0x45||bytes[2]!==0xdf||bytes[3]!==0xa3)throw Error('O conteúdo não é WebM.');
  const data={timecode:1000000,tracks:[]};
  const text=(a,b)=>new TextDecoder().decode(bytes.subarray(a,b));
  const uint=(a,b)=>{let v=0;for(let i=a;i<b;i++)v=v*256+bytes[i];return v;};
  let elements=0;
  function scan(start,end,target=data,depth=0){
    if(depth>6)throw Error('Estrutura WebM inválida.');
    for(let at=start;at<end;){
      if(++elements>10000)throw Error('WebM excessivamente complexo.');
      const tag=vint(bytes,at,true);at+=tag.length;const size=vint(bytes,at);at+=size.length;
      const stop=size.unknown?end:at+size.value;
      if(!Number.isSafeInteger(stop)||stop>end)throw Error('WebM incompleto.');
      const id=tag.value;
      if(id===0x4282)data.doc=text(at,stop);
      if(id===0x2ad7b1)data.timecode=uint(at,stop);
      if(id===0x4489){if(stop-at!==4&&stop-at!==8)throw Error('Duração WebM inválida.');data.duration=stop-at===4?view.getFloat32(at):view.getFloat64(at);}
      if(id===0x83)target.type=uint(at,stop);
      if(id===0x86)target.codec=text(at,stop);
      if(id===0xb0)target.width=uint(at,stop);
      if(id===0xba)target.height=uint(at,stop);
      if(id===0x53c0)target.alpha=uint(at,stop);
      if(id===0x23e383)target.frame=uint(at,stop);
      if(id===0xae){const track={};data.tracks.push(track);scan(at,stop,track,depth+1);}
      else if(id===0x1a45dfa3||containers.has(id))scan(at,stop,target,depth+1);
      at=stop;
    }
  }
  scan(0,bytes.length);
  const video=data.tracks.find(t=>t.type===1),seconds=data.duration*data.timecode/1e9;
  if(data.doc!=='webm'||data.tracks.length!==1||!video||video.codec!=='V_VP9'||video.alpha!==1)throw Error('Use uma única faixa VP9 com transparência (AlphaMode), sem áudio.');
  if(!Number.isFinite(seconds)||seconds<=0||seconds>VIDEO_LIMITS.seconds||!video.width||!video.height||video.width>VIDEO_LIMITS.side||video.height>VIDEO_LIMITS.side||video.width*video.height>VIDEO_LIMITS.pixels||!video.frame||1e9/video.frame>VIDEO_LIMITS.fps+.01)throw Error('Vídeo fora dos limites: até 12 s, 30 fps e 921.600 pixels, com no máximo 1280 px por lado.');
  return {width:video.width,height:video.height,pixels:video.width*video.height,seconds,fps:1e9/video.frame};
}
function onceMedia(video,event,action,timeout=3500,signal){
  return new Promise((resolve,reject)=>{
    const finish=error=>{clearTimeout(timer);signal?.removeEventListener('abort',aborted);video.removeEventListener(event,ok);video.removeEventListener('error',bad);error?reject(error):resolve();};
    const ok=()=>finish(),bad=()=>finish(Error('O navegador não conseguiu decodificar o WebM.'));
    const aborted=()=>finish(Error('Carregamento de vídeo cancelado.'));
    const timer=setTimeout(bad,timeout);signal?.addEventListener('abort',aborted,{once:true});video.addEventListener(event,ok,{once:true});video.addEventListener('error',bad,{once:true});
    try{action();}catch(error){finish(error);}
  });
}
const probes=new WeakMap();
export function supportsTransparentVideo(document){
  if(probes.has(document))return probes.get(document);
  const probe=(async()=>{
    const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
    try{
      await onceMedia(video,'loadeddata',()=>{video.src=new URL('./assets/cinematic-alpha-probe.webm',import.meta.url).href;video.load();});
      const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
      const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(video,0,0,32,32);
      return context.getImageData(1,1,1,1).data[3]<32&&context.getImageData(16,16,1,1).data[3]>200;
    }catch{return false;}finally{video.pause();video.removeAttribute('src');video.load();}
  })();probes.set(document,probe);return probe;
}
export function videoPosition(video,time,duration){
  const elapsed=Math.max(0,time-video.delay)*video.rate;
  return video.loop?elapsed%duration:Math.min(elapsed,Math.max(0,duration-.04));
}
export class CinematicVideoLayer{
  constructor({document,container,fallback,blob,config,metadata,warn=()=>{}}){
    Object.assign(this,{document,container,fallback,blob,config,metadata,warn});this.revision=0;this.closed=false;
  }
  async prepare(){
    const revision=++this.revision;this.controller=new AbortController();
    if(!this.config.enabled)return;
    if(!await supportsTransparentVideo(this.document)){if(!this.closed)this.warn('WebM transparente indisponível neste navegador: usando PNG estático.');return;}
    if(this.closed||revision!==this.revision)return;
    const video=this.document.createElement('video');this.video=video;video.muted=true;video.playsInline=true;video.preload='auto';video.className='cinematic-video';video.hidden=true;
    this.url=URL.createObjectURL(this.blob);this.container.append(video);
    try{
      await onceMedia(video,'loadeddata',()=>{video.src=this.url;video.load();},3500,this.controller.signal);
      if(this.closed||revision!==this.revision)return;
      if(!video.videoWidth||video.videoWidth>VIDEO_LIMITS.side||video.videoHeight>VIDEO_LIMITS.side||video.videoWidth*video.videoHeight>VIDEO_LIMITS.pixels||this.metadata&&(video.videoWidth!==this.metadata.width||video.videoHeight!==this.metadata.height)||!Number.isFinite(video.duration)||video.duration>VIDEO_LIMITS.seconds+.1)throw Error('Duração decodificada do vídeo inválida.');
      this.ready=true;
    }catch{if(!this.closed)this.fail();}
  }
  fail(){this.ready=false;this.fallback.style.visibility='visible';if(this.video){this.video.hidden=true;this.video.pause();}this.warn('Falha ao reproduzir WebM: usando PNG estático.');}
  sync(time,playing,reduced,force=false){
    const v=this.video,c=this.config;if(!v||!this.ready||this.closed)return;
    const finished=!c.loop&&(time-c.delay)*c.rate>=v.duration;
    const use=!reduced&&c.enabled&&time>=c.delay&&!(finished&&c.end!=='freeze');
    this.wantPlaying=playing&&use&&!finished;
    v.hidden=!use;this.fallback.style.visibility=use||(finished&&c.end==='hide'&&!reduced)?'hidden':'visible';
    if(!use){v.pause();return;}
    const target=videoPosition(c,time,v.duration);
    if(force||Math.abs(v.currentTime-target)>.15&&!v.seeking)try{v.currentTime=target;}catch{this.fail();return;}
    v.playbackRate=c.rate;v.loop=c.loop;
    if(playing&&!finished){
      if(v.paused&&!this.starting){
        this.starting=true;const revision=this.revision;
        Promise.resolve(v.play()).then(()=>{if(this.closed||revision!==this.revision||!this.wantPlaying)v.pause();},()=>{if(!this.closed)this.fail();}).finally(()=>{this.starting=false;});
      }
    }else v.pause();
  }
  dispose(){this.closed=true;this.revision++;this.controller?.abort();if(this.video){this.video.pause();this.video.removeAttribute('src');this.video.load();this.video.remove();}if(this.url)URL.revokeObjectURL(this.url);this.video=null;}
}
