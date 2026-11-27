import {CINEMATIC_MAX_LAYERS} from './cinematic-model.js?v=live01b4';
export function duplicateCinematicLayer(layers,id,backgroundVideo=false){
  if(layers.length>=CINEMATIC_MAX_LAYERS)throw Error('A composição já tem 12 camadas.');
  const source=layers.find(l=>l.id===id);if(!source)throw Error('Selecione uma camada.');
  if(source.video&&layers.filter(l=>l.video).length+Number(backgroundVideo)>=2)throw Error('O orçamento permite até dois vídeos, incluindo o fundo.');
  if(layers.reduce((n,l)=>n+(l.effects?.length??0),0)+(source.effects?.length??0)>32)throw Error('O orçamento permite até 32 efeitos.');
  const copy={...structuredClone(source),id:crypto.randomUUID(),name:(source.name+' (cópia)').slice(0,100),locked:false};if(copy.effects)for(const fx of copy.effects)fx.id=crypto.randomUUID();return [...layers,copy];
}
