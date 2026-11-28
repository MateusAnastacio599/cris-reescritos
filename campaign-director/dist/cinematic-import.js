import {cinematicImages,imageKey,cinematicDimensions} from './cinematic-media.js?v=cloudreliability01';
// Recompress only new PNG imports. Keep every ancillary/color/alpha chunk and
// the exact filtered pixel stream; never resize, transcode a fallback or touch WebM.
const jobs=new WeakMap(),RAW_LIMIT=16*1024*1024;
function crc(bytes){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;}
async function boundedStream(stream,limit){const reader=stream.getReader(),parts=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('optimization-budget');}parts.push(value);}return new Blob(parts);}finally{reader.releaseLock();}}
export function optimizeCinematicPNG(file){
 if(jobs.has(file))return jobs.get(file);
 const job=(async()=>{
  const original={blob:file,savedBytes:0,reason:'original'};
  if(file.type!=='image/png'||file.size<128*1024||!globalThis.CompressionStream||!globalThis.DecompressionStream)return original;
  try{
   const dimensions=await cinematicDimensions(file);if(dimensions.width*dimensions.height>4*1024*1024)return {...original,reason:'pixel-budget'};
   const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer),chunks=[],idat=[];let first=-1;
   for(let at=8;at<bytes.length;){const length=view.getUint32(at),type=String.fromCharCode(...bytes.subarray(at+4,at+8)),end=at+12+length;if(end>bytes.length)throw Error('png');const chunk=bytes.subarray(at,end);if(type==='IDAT'){if(first<0)first=chunks.length;idat.push(bytes.subarray(at+8,end-4));chunks.push(null);}else chunks.push(chunk);at=end;}
   if(first<0)return original;
   const raw=await boundedStream(new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate')),RAW_LIMIT);
   const compressed=await boundedStream(raw.stream().pipeThrough(new CompressionStream('deflate')),file.size);
   const payload=new Uint8Array(await compressed.arrayBuffer()),chunk=new Uint8Array(payload.length+12),data=new DataView(chunk.buffer);data.setUint32(0,payload.length);chunk.set([73,68,65,84],4);chunk.set(payload,8);data.setUint32(chunk.length-4,crc(chunk.subarray(4,chunk.length-4)));chunks[first]=chunk;
   const blob=new Blob([bytes.subarray(0,8),...chunks.filter(Boolean)],{type:'image/png'}),savedBytes=file.size-blob.size;
   if(savedBytes<32768||savedBytes/file.size<.1)return {...original,reason:'no-benefit'};
   await imageKey(blob);return {blob,savedBytes,originalBytes:file.size,reason:'lossless-png'};
  }catch{return {...original,reason:'preserved'};}
 })();jobs.set(file,job);return job;
}
export async function prepareCinematicImport(file,{images=cinematicImages}={}){
 const result=await optimizeCinematicPNG(file);
 if(result.savedBytes){const id=await imageKey(file);if(!await images.get(id))await images.putAll([[id,file]]);}
 return result;
}
