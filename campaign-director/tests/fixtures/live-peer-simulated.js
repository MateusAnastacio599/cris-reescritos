// QA ONLY: BroadcastChannel emulates PeerJS DataConnections, never WebRTC.
class Emitter{constructor(){this.listeners=new Map();}on(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);return this;}emit(type,...args){for(const fn of this.listeners.get(type)||[])fn(...args);}}
class SimConnection extends Emitter{
 constructor(owner,peer,id,metadata){super();Object.assign(this,{owner,peer,id,metadata,open:false,dataChannel:{readyState:'connecting',bufferedAmount:0}});}
 send(data){if(!this.open)throw Error('closed');this.owner.channel.postMessage({kind:'data',target:this.peer,id:this.id,data});}
 close(){if(!this.open)return;this.open=false;this.dataChannel.readyState='closed';this.owner.channel.postMessage({kind:'close',target:this.peer,id:this.id});this.emit('close');}
}
export class SimPeer extends Emitter{
 static online=true;
 constructor(id){super();this.id=id||crypto.randomUUID();this.connections=new Map();this.open=false;this.destroyed=false;this.channel=new BroadcastChannel('cris-qa-peer-simulation-v1');this.channel.onmessage=({data:m})=>{if(m.target!==this.id||this.destroyed||!SimPeer.online)return;
  if(m.kind==='connect'){const c=new SimConnection(this,m.from,m.id,m.metadata);this.connections.set(m.id,c);this.emit('connection',c);c.open=true;c.dataChannel.readyState='open';this.channel.postMessage({kind:'accepted',target:m.from,id:m.id});c.emit('open');}
  const c=this.connections.get(m.id);if(!c)return;if(m.kind==='accepted'){c.open=true;c.dataChannel.readyState='open';c.emit('open');}if(m.kind==='data'&&c.open)c.emit('data',m.data);if(m.kind==='close'&&c.open){c.open=false;c.dataChannel.readyState='closed';c.emit('close');}
 };setTimeout(()=>{if(!this.destroyed){this.open=true;this.emit('open',this.id);}},20);}
 connect(peer,{metadata}){const c=new SimConnection(this,peer,crypto.randomUUID(),metadata);this.connections.set(c.id,c);this.channel.postMessage({kind:'connect',target:peer,from:this.id,id:c.id,metadata});return c;}
 destroy(){for(const c of this.connections.values())c.close();this.destroyed=true;this.open=false;this.channel.close();this.emit('close');}
 reconnect(){this.open=true;this.disconnected=false;this.emit('open',this.id);}
}
