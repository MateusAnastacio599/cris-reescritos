import {$,esc,openForm,field,toast} from './ui.js';
import {icon} from './icons.js';
import {DirectorAccount,accountError} from './cloud-account.js';
import {inspectLocalWorkspace,formatBytes} from './cloud-preflight.js';

export class CloudUI{
  constructor({state,persist,blocked=()=>false,backups}){
    Object.assign(this,{state,persist,blocked,backups});this.account=new DirectorAccount();this.report=null;this.reportAccount=null;
    $('#openCloud').onclick=()=>this.open();this.account.addEventListener('change',()=>{this.updateBadge();if(this.reportAccount!==this.account.user?.id)this.report=null;});
    this.updateBadge();
    this.account.init().then(()=>this.updateBadge()).catch(()=>this.updateBadge());
  }
  updateBadge(){$('#openCloud').innerHTML=icon('shield')+`<span>Conta e nuvem<small>${this.account.user?'Conta conectada · dados locais':'Modo local · conectar conta'}</small></span>`;}
  async open(){
    try{await this.account.init();if(this.account.user)this.dashboard();else this.authForm();}
    catch(error){openForm({title:'Conta e nuvem',body:`<p class="form-error">${esc(accountError(error))}</p><p class="dialog-description">Você pode fechar esta janela e continuar mestrando normalmente.</p><button class="btn outline full" type="button" id="retryCloud">Tentar novamente</button>`,onReady:root=>{$('#retryCloud',root).onclick=()=>this.open();}});}
  }
  authForm(){
    openForm({title:'Entrar na sua conta',body:`<p class="dialog-description">Use o usuário e a senha fornecidos pelo mestre.</p>${field('Usuário','username','','type="text" autocomplete="username" autocapitalize="none" spellcheck="false" pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}" required minlength="3" maxlength="32"')}${field('Senha','password','','type="password" autocomplete="current-password" required maxlength="128"')}<p class="cloud-local-note">${icon('info')} Entrar não importa nem substitui os dados deste navegador. Esqueceu a senha? Peça uma nova ao mestre.</p>`,submit:'Entrar',onSubmit:async data=>{try{await this.account.signIn(String(data.get('username')),String(data.get('password')));this.updateBadge();return ()=>this.dashboard();}catch(error){throw new Error(accountError(error));}}});
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
    const report=this.report,identity=this.account.user;if(!identity){this.authForm();return;}
    openForm({title:'Conta e nuvem',body:`<div class="cloud-account-card"><span class="cloud-tag">CONTA CONECTADA</span><strong>${esc(this.account.profile?.username||'Sua conta')}</strong><p>Seus dados continuam salvos neste navegador. A importação para a nuvem será uma etapa separada.</p></div><section class="cloud-section"><h3>1. Conferir os dados deste navegador</h3><p class="dialog-description">Vamos contar suas campanhas e verificar se todos os áudios adicionados estão disponíveis. Esta conferência não envia arquivos.</p><button type="button" class="btn primary full" id="inspectCloud">${report?'Conferir novamente':'Conferir meus dados'}</button><div id="cloudReport" aria-live="polite">${report?this.renderReport(report):''}</div></section><section class="cloud-section"><h3>2. Importar para a nuvem</h3><p class="dialog-description">Próxima etapa: enviar uma cópia dos roteiros e arquivos, com verificação e retomada. O envio ainda não está habilitado nesta versão.</p></section><div class="cloud-secondary">${this.account.profile?.is_operator?'<button type="button" class="btn outline" id="manageFriends">Contas dos amigos</button>':''}<button type="button" class="btn outline" id="changeOwnPassword">Trocar senha</button><button type="button" class="btn outline" id="cloudBackups">Backup e dados</button><button type="button" class="btn subtle" id="cloudLogout">Sair desta conta</button></div><p id="cloudActionError" class="form-error" role="alert" hidden></p>`,onReady:root=>{
      $('#inspectCloud',root).onclick=async()=>{const button=$('#inspectCloud',root),target=$('#cloudReport',root),accountId=this.account.user?.id;button.disabled=true;button.textContent='Conferindo…';try{
        if(this.blocked())throw new Error('Recupere os dados preservados antes de preparar a importação.');
        if(!this.persist())throw new Error('Não foi possível salvar as alterações locais. Faça um backup antes de continuar.');
        const snapshot=structuredClone(this.state());await this.account.checkConnection();const result=await inspectLocalWorkspace(snapshot);
        if(accountId!==this.account.user?.id)throw new Error('A conta mudou durante a conferência. Tente novamente.');
        this.report=result;this.reportAccount=accountId;target.innerHTML=this.renderReport(result);
      }catch(error){target.innerHTML=`<p class="form-error">${esc(accountError(error))}</p>`;}finally{button.disabled=false;button.textContent='Conferir novamente';}};
      $('#manageFriends',root)?.addEventListener('click',()=>this.manageAccounts());$('#changeOwnPassword',root).onclick=()=>this.passwordForm();$('#cloudBackups',root).onclick=()=>this.backups();$('#cloudLogout',root).onclick=async()=>{const b=$('#cloudLogout',root);b.disabled=true;try{await this.account.signOut();this.report=null;this.updateBadge();this.authForm();}catch(error){const el=$('#cloudActionError',root);el.textContent=accountError(error);el.hidden=false;b.disabled=false;}};
    }});
  }
  renderReport(r){return `<div class="cloud-report"><span class="cloud-tag ${r.ready?'':'warning'}">${r.ready?'CONFERÊNCIA CONCLUÍDA':'ARQUIVOS AUSENTES'}</span><div class="cloud-counts">${[[r.campaigns,'Campanhas'],[r.pages,'Páginas'],[r.scenes,'Cenas'],[r.cues,'Cues'],[r.playlists,'Playlists'],[r.ambiences,'Ambientes']].map(([n,label])=>`<div><strong>${n}</strong><span>${label}</span></div>`).join('')}</div><p>${r.files.length} arquivo(s) de áudio · ${formatBytes(r.bytes)}<br>${r.youtube} referência(s) do YouTube</p>${r.missing.length?`<p class="form-error">Readicione estes arquivos neste navegador antes de importar:</p><ul>${r.missing.map(a=>`<li>${esc(a.name)}</li>`).join('')}</ul>`:'<p>Os áudios adicionados estão disponíveis neste navegador.</p>'}<small>Conferido em ${esc(new Date(r.checkedAt).toLocaleString('pt-BR'))}. Se editar depois, confira novamente. Nenhum dado foi enviado.</small></div>`;}
}
