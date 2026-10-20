/** Envelope cancelável: nenhum callback antigo pode religar uma transição parada. */
export class VolumeEnvelope {
  constructor(read,write){this.read=read;this.write=write;this.timer=null;this.pending=null;}
  cancel(){clearTimeout(this.timer);this.timer=null;if(this.pending){this.pending(false);this.pending=null;}}
  fade(to,seconds=0,isCurrent=()=>true){
    this.cancel();const from=this.read(),target=Math.max(0,Math.min(1,Number(to)||0)),duration=Math.max(0,Number(seconds)||0)*1000,start=performance.now();
    return new Promise(resolve=>{this.pending=resolve;const tick=()=>{
      if(!isCurrent()){this.cancel();return;}
      const t=duration?Math.min(1,(performance.now()-start)/duration):1;
      // Smoothstep evita uma mudança perceptível de velocidade no começo/fim.
      const eased=t*t*(3-2*t);this.write(from+(target-from)*eased);
      if(t<1)this.timer=setTimeout(tick,35);else{this.pending=null;this.timer=null;resolve(true);}
    };tick();});
  }
}
