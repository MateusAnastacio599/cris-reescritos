import {$,esc,openForm,field,toast} from './ui.js';
import {icon} from './icons.js';
import {DirectorAccount,accountError} from './cloud-account.js';
import {WorkspaceSync} from './workspace-sync.js';
import {crisHome} from './hub-links.js';

export class CloudUI{
  constructor({state,persist,blocked=()=>false,backups,restore,canApply=()=>true}){
    Object.assign(this,{state,persist,blocked,backups,restore});this.account=new DirectorAccount();
    this.sync=new WorkspaceSync({state,apply:restore,canApply:()=>!blocked()&&canApply()});
    $('#openCloud').onclick=()=>this.open();$('#returnCris').href=crisHome();
    this.account.addEventListener('change',()=>{this.updateBadge();if(this.initialized)this.identityChanged();});
    this.sync.addEventListener('change',()=>{this.renderStatus();if(this.sync.status==='review'&&this.lastReview!==this.sync.conflict){this.lastReview=this.sync.conflict;this.dashboard();}});
    this.updateBadge();this.account.init().then(()=>{this.initialized=true;document.body.classList.remove('account-pending');this.identityChanged();}).catch(error=>{this.initialized=true;document.body.classList.remove('account-pending');this.renderStatus();if(!this.account.user)this.authForm();else toast(accountError(error),true);});
    window.addEventListener('online',()=>this.sync.check());window.addEventListener('focus',()=>this.sync.check());
    this.poll=setInterval(()=>{if(!document.hidden)this.sync.check();},30000);
    window.addEventListener('beforeunload',event=>{if(this.sync.owner&&this.sync.dirty&&!this.sync.conflict){this.persist();event.preventDefault();event.returnValue='';}});
  }
  identityChanged(){
    const user=this.account.user;document.body.classList.toggle('requires-account',!user);this.updateBadge();
    if(!user){if(this.sync.owner)this.sync.detach();this.authForm();return;}
    if(!this.account.profile){this.account.init().then(()=>this.identityChanged()).catch(error=>toast(accountError(error),true));return;}
    if(!this.account.profile.is_operator){this.sync.detach();location.replace(crisHome());return;}
    if(this.sync.owner!==user.id&&!this.blocked())this.sync.start(user.id);
  }
  renderStatus(){
    const label=$('#saveStatus');if(!label)return;const status=this.sync.status;label.dataset.sync=status;
    label.className='save-status'+(['saving','loading','pending'].includes(status)?' saving':['offline','error','review'].includes(status)?' failed':'');$('span',label).textContent=this.sync.message;
    document.body.classList.toggle('sync-loading',status==='loading');this.updateBadge();
  }
  updateBadge(){const profile=this.account.profile;$('#openCloud').innerHTML=icon('shield')+`<span>${esc(profile?.username||'Minha conta')}<small>${this.account.user?(profile?.is_operator?'Mestre · sessão vinculada':'Conta de agente'):'Entrar no CRIS'}</small></span>`;}
  async open(){try{await this.account.init();if(this.account.user)this.dashboard();else this.authForm();}catch(error){toast(accountError(error),true);}}
  authForm(){
    openForm({title:'Entrar no CRIS',body:`<section class="account-intro"><span class="account-symbol">C·</span><h3>Sua mesa, em qualquer computador.</h3><p>Entre com o mesmo usuário do CRIS para acessar os roteiros e áudios do mestre.</p></section>${field('Usuário','username','','type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="32" placeholder="Seu usuário"')}${field('Senha','password','','type="password" autocomplete="current-password" required maxlength="128" placeholder="Sua senha"')}<p class="form-hint">Sua sessão permanece conectada neste navegador. Esqueceu a senha? Peça uma nova ao mestre.</p><a class="account-home" href="${crisHome()}">Ir para a central CRIS →</a>`,submit:'Entrar e abrir minha sessão',onSubmit:async data=>{try{await this.account.signIn(String(data.get('username')),String(data.get('password')));this.identityChanged();return ()=>this.dashboard();}catch(error){throw Error(accountError(error));}}});
  }
  passwordForm(){openForm({title:'Trocar minha senha',body:field('Nova senha','password','','type="password" required minlength="8" maxlength="128" autocomplete="new-password"')+field('Confirmar nova senha','confirmPassword','','type="password" required minlength="8" maxlength="128" autocomplete="new-password"'),submit:'Salvar senha',onSubmit:async data=>{if(data.get('password')!==data.get('confirmPassword'))throw new Error('As senhas não coincidem.');try{await this.account.changePassword(String(data.get('password')));return ()=>{toast('Senha atualizada.');this.dashboard();};}catch(error){throw new Error(accountError(error));}}});}
  async manageAccounts(){
    try{
      const accounts=await this.account.listAccounts();
      openForm({title:'Contas dos amigos',body:`<p class="dialog-description">Crie um usuário e uma senha para cada pessoa. Informe as credenciais diretamente ao amigo. O acesso às campanhas será definido separadamente.</p><button class="btn primary full" type="button" id="newFriend">Criar usuário</button><div class="cloud-account-list">${accounts.map(a=>`<div><span><strong>${esc(a.username)}</strong><small>${a.is_operator?'Mestre administrador':'Conta de amigo'}</small></span><button class="btn outline" type="button" data-reset-user="${esc(a.user_id)}">Nova senha</button></div>`).join('')}</div>`,onReady:root=>{$('#newFriend',root).onclick=()=>this.friendForm();root.querySelectorAll('[data-reset-user]').forEach(b=>b.onclick=()=>this.friendForm(accounts.find(a=>a.user_id===b.dataset.resetUser)));}});
    }catch(error){toast(accountError(error),true);}
  }
  friendForm(account){
    openForm({title:account?`Nova senha · ${account.username}`:'Criar usuário',body:(account?'':field('Usuário','username','','type="text" autocomplete="off" autocapitalize="none" spellcheck="false" pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}" required minlength="3" maxlength="32"'))+field('Senha','password','','type="password" autocomplete="new-password" required minlength="8" maxlength="128"')+field('Confirmar senha','confirmPassword','','type="password" autocomplete="new-password" required minlength="8" maxlength="128"')+'<p class="dialog-description">A senha não fica visível na lista de contas. Guarde-a para informar ao seu amigo.</p>',submit:account?'Definir senha':'Criar conta',onSubmit:async data=>{if(data.get('password')!==data.get('confirmPassword'))throw new Error('As senhas não coincidem.');try{if(account)await this.account.resetPassword(account.user_id,String(data.get('password')));else await this.account.createAccount(String(data.get('username')),String(data.get('password')));return ()=>{toast(account?'Senha atualizada.':'Usuário criado.');this.manageAccounts();};}catch(error){throw new Error(accountError(error));}}});
  }
  dashboard(){
    const profile=this.account.profile;if(!this.account.user){this.authForm();return;}
    const sync=this.sync,remote=sync.conflict;const summary=s=>{const pages=s.campaigns?.flatMap(c=>c.pages)||[];return `${pages.length} páginas · ${pages.reduce((n,p)=>n+p.scenes.length,0)} cenas · ${s.audioAssets?.length||0} áudios`;};
    openForm({title:'Minha conta',wide:!!remote,submit:'Concluir',body:`<section class="account-panel"><header class="account-heading"><span class="account-avatar">${esc((profile?.username||'C')[0].toUpperCase())}</span><div><span class="cloud-tag">${profile?.is_operator?'ESPAÇO DO MESTRE':'CONTA DE AGENTE'}</span><h3>${esc(profile?.username||'Sua conta')}</h3><p>Uma conta para o CRIS e para o Director.</p></div></header><div class="account-sync-card" data-sync="${sync.status}">${icon('cloud')}<div><strong>${esc(sync.message)}</strong><p>Roteiros, cenas, playlists e arquivos enviados acompanham sua conta. Spotify é autorizado uma vez em cada navegador.</p></div></div>${remote?`<section class="sync-review"><h3>Qual versão você quer continuar?</h3><p>Encontramos um rascunho anterior neste computador. As duas versões serão preservadas para recuperação. Se este é o PC em que você preparou a mesa, escolha a versão deste computador.</p><div class="sync-review-options"><article><h4>Neste computador</h4><p>${esc(summary(this.state()))}</p><button type="button" class="btn primary full" id="useLocalSession">Continuar esta versão</button></article><article><h4>Na sua conta</h4><p>${esc(summary(remote.payload))}</p><small>${remote.updated_at?'Salva em '+esc(new Date(remote.updated_at).toLocaleString('pt-BR')):''}</small><button type="button" class="btn outline full" id="useCloudSession">Usar versão da conta</button></article></div></section>`:''}<a class="btn primary full" href="${crisHome()}" target="_blank" rel="noopener">${icon('arrow')} Abrir CRIS · fichas e quadro</a><div class="account-actions">${profile?.is_operator?'<button type="button" class="btn outline" id="manageFriends">Contas dos amigos</button>':''}<button type="button" class="btn outline" id="changeOwnPassword">Trocar senha</button><button type="button" class="btn subtle" id="cloudLogout">Sair da conta</button></div><details class="account-advanced"><summary>Recuperação e opções avançadas</summary><p>Backups são cópias extras para recuperar versões antigas ou trabalhar sem conexão. Não fazem parte da troca normal de computador.</p><button type="button" class="btn outline" id="cloudBackups">Exportar ou recuperar backup</button><button type="button" class="btn subtle" id="retrySync">Tentar sincronizar agora</button></details><p id="cloudActionError" class="form-error" role="alert" hidden></p></section>`,onReady:root=>{
      const run=async callback=>{const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await callback();this.dashboard();}catch(error){const el=$('#cloudActionError',root);el.textContent=accountError(error);el.hidden=false;buttons.forEach(b=>b.disabled=false);}};
      $('#useLocalSession',root)?.addEventListener('click',()=>run(()=>sync.resolve('local')));$('#useCloudSession',root)?.addEventListener('click',()=>run(()=>sync.resolve('remote')));
      $('#manageFriends',root)?.addEventListener('click',()=>this.manageAccounts());$('#changeOwnPassword',root).onclick=()=>this.passwordForm();$('#cloudBackups',root).onclick=()=>this.backups();$('#retrySync',root).onclick=()=>run(()=>sync.start(this.account.user.id));
      $('#cloudLogout',root).onclick=()=>run(async()=>{await sync.flush();sync.detach();await this.account.signOut();});
    }});
  }
}
