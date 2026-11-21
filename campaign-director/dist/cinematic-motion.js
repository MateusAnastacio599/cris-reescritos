// This permission belongs to this tab's session and only affects Cinematic.
export class CinematicMotionPreference{
  constructor({media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),storage}={}){
    this.media=media;
    try{this.storage=storage===undefined?globalThis.sessionStorage:storage;}catch{this.storage=null;}
    this.listeners=new Set();
    try{this.allowed=this.storage?.getItem('cris-cinematic-motion')==='allow';}catch{this.allowed=false;}
    this.changed=()=>{for(const listener of this.listeners)listener(this.reduced);};
    media?.addEventListener?.('change',this.changed);
  }
  get reduced(){return !!this.media?.matches&&!this.allowed;}
  allow(value){
    this.allowed=value;
    try{if(value)this.storage?.setItem('cris-cinematic-motion','allow');else this.storage?.removeItem('cris-cinematic-motion');}catch{}
    this.changed();
  }
  subscribe(listener){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
}
let preference;
export const cinematicMotion=()=>preference??=new CinematicMotionPreference();

export function mountMotionNotice(element,motion=cinematicMotion()){
  const render=()=>{
    element.hidden=!motion.media?.matches;
    element.replaceChildren();
    if(element.hidden)return;
    const text=element.ownerDocument.createElement('span');
    text.textContent=motion.reduced
      ?'Movimentos cinematográficos estão reduzidos nesta janela. A imagem permanece estática, com entrada e saída suaves.'
      :'Movimentos permitidos nesta ferramenta durante esta sessão da janela.';
    const button=element.ownerDocument.createElement('button');
    button.type='button';
    button.textContent=motion.reduced?'Permitir movimentos nesta ferramenta':'Respeitar movimento reduzido';
    button.onclick=()=>motion.allow(!motion.allowed);
    element.append(text,button);
  };
  render();
  return motion.subscribe(render);
}
