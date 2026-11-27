import {CINEMATIC_CHANNEL,CINEMATIC_LEASE,cinematicEnvelope,sameBoard,sameCinematicScene,
  sameCinematicSession,validBoard,validCinematicMessage} from './cinematic-protocol.js?v=directorcinematic01';

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
    for(const update of this.subscribers)update({message,active:this.running,name:this.active?.name,motionReduced:this.active?.motionReduced});
  }
  subscribe(update){
    this.subscribers.add(update);
    update({message:this.message,active:this.running,name:this.active?.name,motionReduced:this.active?.motionReduced});
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
      if(request&&validCinematicMessage(reply,request.scope)){if(request.consider)request.consider(reply);else if(request.matches(reply))request.finish(null,reply);}
      if(this.warm&&reply.type==='warm-status'&&validCinematicMessage(reply,this.warm.scope)&&sameCinematicSession(this.warm,reply)){this.prewarmState={...reply,itemKey:this.warm.itemKey};this.notify(this.message);}
      const active=this.active;
      if(!active||!validCinematicMessage(reply,active.scope)||!sameCinematicSession(active,reply))return;
      if(reply.type==='closed')this.reset('A janela do quadro foi fechada ou recarregada.');
      if(reply.type==='ended')this.reset({
        automatic:'Apresentação encerrada automaticamente.',
        manual:'Apresentação encerrada.',
        expired:'Apresentação encerrada por perda de comunicação.',
      }[reply.reason]);
      if(reply.type==='started'){if(!reply.ok){if(!request)this.stop('Não foi possível iniciar a apresentação.');return;}active.phase='apresentando';active.motionReduced=reply.motionReduced;this.notify(this.activeMessage());}
      if(reply.type==='local-ended'){active.localEnded=true;this.notify(this.activeMessage());}
      if(reply.type==='remote-status'){active.remote=reply.participants;active.coordination=reply.coordination;this.notify(this.activeMessage());}
      if(reply.type==='motion'){active.motionReduced=reply.motionReduced;this.notify(this.activeMessage());}
      if(reply.type==='alive')active.lastSeen=Date.now();
    };
  }
  request(scope,fields,matches,timeout,errorMessage,{collect=false,background=false}={}){
    return new Promise((resolve,reject)=>{
      const requestId=crypto.randomUUID();let choiceTimer;const choices=[];
      const finish=(error,result)=>{
        clearTimeout(timer);clearTimeout(choiceTimer);
        this.requests.delete(requestId);
        if(error)reject(error);else resolve(result);
      };
      const timer=setTimeout(()=>finish(Error(errorMessage)),timeout);
      this.requests.set(requestId,{scope,finish,background,matches,consider:collect?reply=>{if(!matches(reply)||choices.length>=64)return;choices.push(reply);choiceTimer??=setTimeout(()=>finish(null,choices.sort((a,b)=>(b.priority||0)-(a.priority||0))[0]),120);}:null});
      try{this.channel.postMessage(cinematicEnvelope(scope,{...fields,senderId:this.senderId,requestId}));}
      catch(error){finish(error);}
    });
  }
  activeMessage(){
    return (this.active.coordination==='avisando'?'Avisando jogadores. A cena vai começar…':this.active.coordination==='iniciando'?'Iniciando apresentação…':this.active.phase==='preparando'?'Preparando a apresentação com os participantes…':this.active.localEnded?'Apresentação local concluída; aguardando os participantes.':`Apresentação “${this.active.name}” ativa no quadro deste navegador.`)+(this.active.motionReduced
      ?' Movimentos reduzidos no quadro. Use Permitir movimentos nesta ferramenta na janela do quadro para ativá-los.':'')+(this.active.remote?.length?' Remotos: '+this.active.remote.map(p=>p.name+' · '+(p.label||p.status)+(p.error?' · '+p.error:'')).join('; '):'');
  }
  send(active,type,fields={}){
    const {scope,senderId,boardId,sessionId,scene}=active;
    this.channel?.postMessage(cinematicEnvelope(scope,{...fields,type,senderId,boardId,sessionId,scene,requestId:crypto.randomUUID(),sequence:++this.sequence}));
  }
  async present(scope,scene,item,image,{replace=true}={}){
    if(this.running&&!replace){this.notify('Apresentação atual mantida. A cue está configurada para não substituir.');return false;}
    if(this.operation&&replace)this.stop('Substituindo apresentação anterior.');
    if(!validBoard(scope))throw Error('Entre como mestre e vincule o Director à campanha do quadro em Conta e nuvem.');
    if(this.operation)throw Error('Aguarde o quadro responder ou encerre a tentativa.');
    if(this.active&&(!sameBoard(this.active.scope,scope)||!sameCinematicScene(this.active.scene,scene)))this.stop('Apresentação anterior encerrada.');
    this.connect();
    clearTimeout(this.stopTimer);
    clearInterval(this.heartbeat);
    const operation={scope,scene,previous:this.active};
    this.operation=operation;
    this.notify('Procurando a janela do quadro…');
    try{
      const prior=this.active;
      const boardId=prior?.boardId??(await this.request(scope,{type:'discover'},reply=>reply.type==='ready',1800,
        'Quadro indisponível. Abra o quadro ao vivo da campanha e deixe a mesa pronta nesta conta e navegador.',{collect:true})).boardId;
      if(this.operation!==operation)return;
      const active=this.active={scope,senderId:this.senderId,boardId,sessionId:crypto.randomUUID(),scene,itemKey:JSON.stringify(item),name:item.name,fadeOut:item.fadeOut??.3,lastSeen:Date.now()};
      const reply=await this.request(scope,{type:'start',boardId,sessionId:active.sessionId,scene,item,image,sequence:++this.sequence},
        result=>['accepted','started'].includes(result.type)&&sameCinematicSession(active,result),6500,'O quadro não confirmou a abertura da imagem.');
      if(this.operation!==operation)return;
      if(reply.type==='started'&&!reply.ok)throw Error('O quadro não abriu a imagem. Confira o arquivo e se outra apresentação está ativa.');
      this.operation=null;
      active.started=true;active.phase=reply.type==='accepted'?'preparando':'apresentando';
      active.motionReduced=reply.motionReduced;
      active.lastSeen=Date.now();
      this.heartbeat=setInterval(()=>{
        if(Date.now()-active.lastSeen>CINEMATIC_LEASE){this.stop('O quadro deixou de responder. Abra-o novamente.');return;}
        this.send(active,'heartbeat');
      },4000);
      this.notify(this.activeMessage());
      return true;
    }catch(error){
      if(this.operation===operation){
        if(operation.previous)this.send(operation.previous,'stop');
        this.stop(error.message);
      }
    }
  }
  reconcile(scope,scene){
    const current=this.operation??this.active;
    if(current&&(!sameBoard(scope,current.scope)||!sameCinematicScene(scene,current.scene)))this.stop('Apresentação encerrada ao sair da cena.');
  }
  stop(message,{immediate=false}={}){
    if(!this.running)return;
    const active=this.active;
    if(!message&&active?.started){
      if(active.stopping&&!immediate)return;
      clearTimeout(this.stopTimer);
      active.stopping=true;
      clearInterval(this.heartbeat);
      this.send(active,'stop',{immediate});
      this.notify('Encerrando apresentação…');
      this.stopTimer=setTimeout(()=>{
        if(this.active===active)this.reset('O quadro não confirmou o encerramento.');
      },(immediate?0:active.fadeOut*1000)+2500);
      return;
    }
    if(active)this.send(active,'stop',{immediate});
    this.reset(message??'Apresentação encerrada.');
  }
  reset(message){
    this.operation=null;
    this.active=null;
    clearTimeout(this.stopTimer);
    clearInterval(this.heartbeat);
    for(const request of this.requests.values())if(!request.background)request.finish(Error('Apresentação encerrada.'));
    this.notify(message);
  }
  async prewarm(scope,scene,item,image){
    this.cancelPrewarm();if(!validBoard(scope))return false;this.connect();const ticket=++this.warmTicket;
    const boardId=(await this.request(scope,{type:'discover'},reply=>reply.type==='ready'&&reply.prewarm===1,1800,'Abra o quadro ao vivo atualizado para preparar os jogadores.',{collect:true,background:true})).boardId;
    if(this.warmTicket!==ticket)return false;
    const warm=this.warm={scope,scene,senderId:this.senderId,boardId,sessionId:crypto.randomUUID(),itemKey:JSON.stringify(item)};
    this.prewarmState={itemKey:warm.itemKey,status:'preparing',participants:[]};this.notify(this.message);
    this.send(warm,'prewarm',{item,image,authorized:true});this.warmTimer=setInterval(()=>this.send(warm,'warm-ping'),15000);return true;
  }
  cancelPrewarm(){
    this.warmTicket=(this.warmTicket||0)+1;clearInterval(this.warmTimer);if(this.warm)this.send(this.warm,'warm-cancel');this.warm=null;this.prewarmState=null;
    for(const request of this.requests.values())if(request.background)request.finish(new DOMException('Preload cancelado.','AbortError'));
  }
  close(){
    this.cancelPrewarm();
    this.stop('Apresentação encerrada.');
    this.channel?.close();
    this.channel=null;
  }
}
