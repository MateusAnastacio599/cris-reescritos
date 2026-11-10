import {limitedOutput, readOutput} from './media-output.js?v=338';
// A short radio/terminal signal. Audio is unlocked only after a user gesture.
export class NoticeAttention {
 constructor({userId,storage=globalThis.localStorage,locks=globalThis.navigator?.locks,defaultEnabled=!globalThis.matchMedia?.('(pointer:coarse)').matches,contextFactory}={}){
  this.storage=storage;this.locks=locks;this.defaultEnabled=defaultEnabled;this.key='cris:notice:sound:'+userId;this.heardKey='cris:notice:heard:'+userId;this.contextFactory=contextFactory||(()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null;});
 }
 get enabled(){try{const value=this.storage?.getItem(this.key);return value==null?this.defaultEnabled:value==='on';}catch{return this.defaultEnabled;}}
 setEnabled(value){this.defaultEnabled=!!value;try{this.storage?.setItem(this.key,value?'on':'off');}catch{}}
 get ready(){return this.context?.state==='running';}
 async unlock(){if(!this.enabled)return false;try{this.context ||= this.contextFactory();if(!this.context)return false;if(!this.ready)await this.context.resume();return this.ready;}catch{return false;}}
 async test(){this.setEnabled(true);if(!await this.unlock())throw Error('Toque novamente em Ouvir sinal para liberar o áudio neste navegador.');this.signal();}
 async playNotice(id){if(!this.enabled||!this.ready)return false;const run=()=>{let seen=[];try{seen=JSON.parse(this.storage?.getItem(this.heardKey)||'[]');}catch{}if(!Array.isArray(seen))seen=[];if(seen.includes(id))return false;this.signal();try{this.storage?.setItem(this.heardKey,JSON.stringify([...seen,id].slice(-100)));}catch{}return true;};return this.locks?this.locks.request(this.heardKey,run):run();}
 signal(){const c=this.context;if(!c||!this.ready)return;const now=c.currentTime+.015,bus=c.createGain();bus.gain.value=.52*readOutput(this.storage);bus.connect(limitedOutput(c));
  const tone=(frequency,start,length,volume,type='triangle')=>{const osc=c.createOscillator(),gain=c.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,now+start);gain.gain.setValueAtTime(0,now+start);gain.gain.linearRampToValueAtTime(volume,now+start+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+start+length);osc.connect(gain);gain.connect(bus);osc.start(now+start);osc.stop(now+start+length+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};return osc;};
  tone(440,0,.12,.32);tone(415.3,.16,.12,.3);const last=tone(329.63,.34,.46,.25);tone(146.83,.02,.55,.08,'sine');
  const noise=c.createBuffer(1,Math.ceil(c.sampleRate*.13),c.sampleRate),data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.035*(1-i/data.length);const source=c.createBufferSource(),filter=c.createBiquadFilter();source.buffer=noise;filter.type='bandpass';filter.frequency.value=1800;source.connect(filter);filter.connect(bus);source.start(now);source.onended=()=>{source.disconnect();filter.disconnect();};const cleanup=last.onended;last.onended=()=>{cleanup();bus.disconnect();};
 }
 dispose(){this.context?.close().catch(()=>{});}
}
