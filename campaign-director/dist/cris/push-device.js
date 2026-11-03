// Native push registration. Keep failures distinct from saving a device in CRIS.
export function pushFailure(error,stage='push'){
 const name=error?.name||'',message=String(error?.message||'');
 if(name==='NotAllowedError'||name==='PermissionDeniedError')return 'As notificações não foram autorizadas. Permita os avisos nas configurações deste site e nas configurações do navegador no aparelho.';
 if(stage==='save')return 'O navegador preparou as notificações, mas o CRIS não conseguiu salvar este aparelho. Confira sua conexão e tente novamente. Sua inscrição será reaproveitada.';
 if(stage==='config')return 'Não foi possível consultar o canal de notificações do CRIS. Confira sua conexão e tente novamente.';
 if(stage==='key')return 'A configuração do canal de notificações está inválida. Informe ao mestre o código CRIS-PUSH-KEY.';
 if(stage==='worker')return 'O serviço de notificações da página não ficou pronto. Reabra o CRIS com conexão à internet e tente novamente. Código: CRIS-PUSH-WORKER.';
 if(name==='AbortError'||/push service|registration failed/i.test(message))return 'O navegador não conseguiu conectar ao serviço de notificações. Tente novamente ou consulte as orientações. Código: CRIS-PUSH-SERVICE. Os avisos continuam no sino do CRIS.';
 if(name==='InvalidStateError')return 'Já existe uma configuração de notificações diferente neste navegador. Informe ao mestre o código CRIS-PUSH-STATE. Sua caixa de entrada continua disponível.';
 if(name==='NotSupportedError')return 'Este navegador não oferece o recebimento de notificações neste aparelho. Abra o link em um navegador compatível. No iPhone, adicione o CRIS à Tela de Início e abra pelo ícone.';
 return 'Não foi possível ativar as notificações neste aparelho. Confira a conexão e as permissões do navegador e tente novamente. Os avisos continuam disponíveis no sino do CRIS.';
}
export function decodePushKey(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{87}=?$/.test(value))throw Error('Invalid push key');
 const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/')),key=Uint8Array.from(raw,c=>c.charCodeAt(0));
 if(key.length!==65||key[0]!==4)throw Error('Invalid push key');return key;
}
export function waitForActive(registration,timeout=15000){
 if(registration.active?.state==='activated')return Promise.resolve(registration);
 return new Promise((resolve,reject)=>{
  const worker=registration.installing||registration.waiting||registration.active;
  if(!worker){reject(Error('Missing service worker'));return;}
  const clean=()=>{clearTimeout(timer);worker.removeEventListener('statechange',check);};
  const check=()=>{if(worker.state==='activated'){clean();resolve(registration);}else if(worker.state==='redundant'){clean();reject(Error('Redundant service worker'));}};
  const timer=setTimeout(()=>{clean();reject(Error('Service worker activation timeout'));},timeout);
  worker.addEventListener('statechange',check);check();
 });
}
export async function activatePushDevice({root,userId,call,storage=globalThis.localStorage,environment=globalThis,onStage=()=>{}}){
 let stage='permission';const update=value=>{stage=value;onStage(value);};
 try{
  const {navigator,Notification,PushManager}=environment;
  if(!environment.isSecureContext||!Notification||!PushManager||!navigator?.serviceWorker)throw Object.assign(Error(),{name:'NotSupportedError'});
  const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
  if(permission!=='granted')throw Object.assign(Error(),{name:'NotAllowedError'});
  if(navigator.onLine===false){update('config');throw Error('Offline');}
  update('config');const config=await call('config');
  update('key');const key=decodePushKey(config.publicKey);
  update('worker');const registration=await navigator.serviceWorker.register(new URL('sw.js',root),{scope:root.pathname});await waitForActive(registration);
  update('push');let subscription=await registration.pushManager.getSubscription();
  if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  update('save');await call('subscribe',{subscription:subscription.toJSON(),appBase:root.href});
  storage.setItem('cris:push-owner:'+root.href,userId);return 'Notificações ativadas neste aparelho.';
 }catch(error){const failure=Error(pushFailure(error,stage));failure.stage=stage;throw failure;}
}
