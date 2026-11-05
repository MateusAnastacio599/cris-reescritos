import {checked} from '../case-archive-data.js?v=328';
const table='case_evidence_progress_assets';
const binary=/^data:(?:image\/(?:png|jpeg|webp|gif)|audio\/[\w.+-]+);base64,/i;
export class EvidenceProgress{
 constructor(client){this.client=client;this.cache=new Map();}
 async pack(value,pin){
  const visit=async input=>{
   if(typeof input==='string'){
    if(input.startsWith('blob:'))throw Error('Uma referência temporária não pode ser salva como progresso.');
    if(!binary.test(input))return input;
    if(new TextEncoder().encode(input).length>4194304)throw Error('A marcação ficou muito grande. Divida a evidência em itens menores.');
    if(this.cache.has(pin+input))return this.cache.get(pin+input);
    const bytes=await(await(await fetch(input)).blob()).arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
    const ref={crisProgressAsset:{pin_id:pin,hash}};
    const saved=await this.client.from(table).insert({pin_id:pin,hash,payload:input});
    if(saved.error&&saved.error.code!=='23505')throw saved.error;
    this.cache.set(pin+input,ref);return ref;
   }
   if(Array.isArray(input))return Promise.all(input.map(visit));
   if(input&&typeof input==='object'){const out={};for(const [key,v] of Object.entries(input))out[key]=await visit(v);return out;}
   return input;
  };
  const packed=await visit(value);
  if(new TextEncoder().encode(JSON.stringify(packed)).length>63000)throw Error('O progresso desta evidência ficou muito grande. Divida a preparação em evidências menores.');
  return packed;
 }
 async unpack(value,pin){
  const visit=async input=>{
   if(!input||typeof input!=='object')return input;
   if(input.crisProgressAsset){
    const ref=input.crisProgressAsset;
    if(ref.pin_id!==pin||!/^[a-f0-9]{64}$/.test(ref.hash))throw Error('Arquivo de progresso inválido.');
    const key=pin+ref.hash;if(this.cache.has(key))return this.cache.get(key);
    const result=checked(await this.client.from(table).select('payload').eq('pin_id',pin).eq('hash',ref.hash).single());
    if(!result||!binary.test(result.payload))throw Error('Marcação pessoal indisponível. Confira a conexão.');
    this.cache.set(key,result.payload);this.cache.set(pin+result.payload,input);return result.payload;
   }
   if(Array.isArray(input))return Promise.all(input.map(visit));
   const out={};for(const [key,v] of Object.entries(input))out[key]=await visit(v);return out;
  };return visit(value);
 }
}
