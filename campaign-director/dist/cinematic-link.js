import {CINEMATIC_CHANNEL,CINEMATIC_LEASE,cinematicEnvelope,sameBoard,sameCinematicScene,
  sameCinematicSession,validBoard,validCinematicMessage} from './cinematic-protocol.js';

export class CinematicLink{
  constructor(){
    this.subscribers=new Set();
    this.requests=new Map();
    this.sequence=0;
    this.message='';
  }
  get running(){return !!(this.active||this.operation);}
  notify(message){
    this.message=message;
    for(const update of this.subscribers)update({message,active:this.running});
  }
  subscribe(update){
    this.subscribers.add(update);
    update({message:this.message,active:this.running});
    return ()=>this.subscribers.delete(update);
  }
  connect(){
    if(this.channel)return;
    if(!globalThis.BroadcastChannel)throw Error('Este navegador não oferece comunicação local entre abas.');
    this.senderId??=crypto.randomUUID();
    this.channel=new BroadcastChannel(CINEMATIC_CHANNEL);
    this.channel.onmessage=event=>{
      const reply=event.data,request=this.requests.get(reply?.requestId);
      if(reply?.senderId!==this.senderId)return;
      if(request&&validCinematicMessage(reply,request.scope)&&request.matches(reply))request.finish(null,reply);
      const active=this.active;
      if(!active||!validCinematicMessage(reply,active.scope)||!sameCinematicSession(active,reply))return;
      if(reply.type==='closed')this.reset('A janela do quadro foi fechada ou recarregada.');
      if(reply.type==='ended')this.reset({
        automatic:'Apresentação encerrada automaticamente.',
        manual:'Apresentação encerrada.',
        expired:'Apresentação encerrada por perda de comunicação.',
      }[reply.reason]);
      if(reply.type==='alive')active.lastSeen=Date.now();
    };
  }
  request(scope,fields,matches,timeout,errorMessage){
    return new Promise((resolve,reject)=>{
      const requestId=crypto.randomUUID();
      const finish=(error,result)=>{
        clearTimeout(timer);
        this.requests.delete(requestId);
        if(error)reject(error);else resolve(result);
      };
      const timer=setTimeout(()=>finish(Error(errorMessage)),timeout);
      this.requests.set(requestId,{scope,finish,matches});
      try{this.channel.postMessage(cinematicEnvelope(scope,{...fields,senderId:this.senderId,requestId}));}
      catch(error){finish(error);}
    });
  }
  send(active,type){
    const {scope,senderId,boardId,sessionId,scene}=active;
    this.channel?.postMessage(cinematicEnvelope(scope,{type,senderId,boardId,sessionId,scene,requestId:crypto.randomUUID(),sequence:++this.sequence}));
  }
  async present(scope,scene,item,image){
    if(!validBoard(scope))throw Error('Entre como mestre e vincule o Director à campanha do quadro em Conta e nuvem.');
    if(this.operation)throw Error('Aguarde o quadro responder ou encerre a tentativa.');
    if(this.active&&(!sameBoard(this.active.scope,scope)||!sameCinematicScene(this.active.scene,scene)))this.stop('Apresentação anterior encerrada.');
    this.connect();
    clearTimeout(this.stopTimer);
    clearInterval(this.heartbeat);
    const operation={scope,scene};
    this.operation=operation;
    this.notify('Procurando a janela do quadro…');
    try{
      const prior=this.active;
      const boardId=prior?.boardId??(await this.request(scope,{type:'discover'},reply=>reply.type==='ready',1800,
        'Quadro indisponível. Abra o quadro ao vivo da campanha e deixe a mesa pronta nesta conta e navegador.')).boardId;
      if(this.operation!==operation)return;
      const active=this.active={scope,senderId:this.senderId,boardId,sessionId:crypto.randomUUID(),scene,lastSeen:Date.now()};
      const reply=await this.request(scope,{type:'start',boardId,sessionId:active.sessionId,scene,item,image,sequence:++this.sequence},
        result=>result.type==='started'&&sameCinematicSession(active,result),6500,'O quadro não confirmou a abertura da imagem.');
      if(this.operation!==operation)return;
      if(!reply.ok)throw Error('O quadro não abriu a imagem. Confira o arquivo e se outra apresentação está ativa.');
      this.operation=null;
      active.started=true;
      active.lastSeen=Date.now();
      this.heartbeat=setInterval(()=>{
        if(Date.now()-active.lastSeen>CINEMATIC_LEASE){this.stop('O quadro deixou de responder. Abra-o novamente.');return;}
        this.send(active,'heartbeat');
      },4000);
      this.notify('Apresentação ativa no quadro deste navegador.');
    }catch(error){
      if(this.operation===operation)this.stop(error.message);
    }
  }
  reconcile(scope,scene){
    const current=this.operation??this.active;
    if(current&&(!sameBoard(scope,current.scope)||!sameCinematicScene(scene,current.scene)))this.stop('Apresentação encerrada ao sair da cena.');
  }
  stop(message){
    if(!this.running)return;
    const active=this.active;
    if(!message&&active?.started){
      if(active.stopping)return;
      active.stopping=true;
      clearInterval(this.heartbeat);
      this.send(active,'stop');
      this.notify('Encerrando apresentação…');
      this.stopTimer=setTimeout(()=>{
        if(this.active===active)this.reset('O quadro não confirmou o encerramento.');
      },2500);
      return;
    }
    if(active)this.send(active,'stop');
    this.reset(message??'Apresentação encerrada.');
  }
  reset(message){
    this.operation=null;
    this.active=null;
    clearTimeout(this.stopTimer);
    clearInterval(this.heartbeat);
    for(const request of this.requests.values())request.finish(Error('Apresentação encerrada.'));
    this.notify(message);
  }
  close(){
    this.stop('Apresentação encerrada.');
    this.channel?.close();
    this.channel=null;
  }
}
