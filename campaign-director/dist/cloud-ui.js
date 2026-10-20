import {$,esc,openForm,field,toast} from './ui.js';
import {icon} from './icons.js';
import {DirectorAccount,accountError} from './cloud-account.js';
import {inspectLocalWorkspace,formatBytes} from './cloud-preflight.js';

export class CloudUI{
  constructor({state,persist,blocked=()=>false,backups}){
    Object.assign(this,{state,persist,blocked,backups});this.account=new DirectorAccount();this.report=null;this.reportAccount=null;
    $('#openCloud').onclick=()=>this.open();this.account.addEventListener('change',()=>{this.updateBadge();if(this.reportAccount!==this.account.user?.id)this.report=null;if(this.account.recovering)this.passwordForm();});
    this.updateBadge();
    this.startup=location.hash.includes('access_token=')||new URLSearchParams(location.search).has('code');
    this.account.init().then(()=>{this.updateBadge();if(this.startup&&!this.account.recovering)this.open();}).catch(()=>this.updateBadge());
  }
  updateBadge(){$('#openCloud').innerHTML=icon('shield')+`<span>Conta e nuvem<small>${this.account.user?'Conta conectada · dados locais':'Modo local · conectar conta'}</small></span>`;}
  redirectURL(){return new URL('./',location.href).href;}
  notice(message){openForm({title:'Conta e nuvem',body:`<p class="dialog-description">${esc(message)}</p><button type="button" class="btn primary full" id="cloudReturn">Voltar para entrar</button>`,onReady:root=>{$('#cloudReturn',root).onclick=()=>this.open();}});}
  async open(){
    try{await this.account.init();if(this.account.recovering){this.passwordForm();return;}if(this.account.user)this.dashboard();else this.authForm();}
    catch(error){openForm({title:'Conta e nuvem',body:`<p class="form-error">${esc(accountError(error))}</p><p class="dialog-description">Você pode fechar esta janela e continuar mestrando normalmente.</p><button class="btn outline full" type="button" id="retryCloud">Tentar novamente</button>`,onReady:root=>{$('#retryCloud',root).onclick=()=>this.open();}});}
  }
  authForm(mode='login'){
    const signup=mode==='signup',reset=mode==='reset';
    openForm({title:reset?'Recuperar acesso':signup?'Criar conta':'Entrar na sua conta',body:`<p class="dialog-description">Conecte sua conta para preparar o salvamento na nuvem. Seus roteiros e áudios continuam neste navegador.</p><div class="cloud-auth-tabs"><button class="btn ${!signup&&!reset?'primary':'outline'}" type="button" data-auth="login">Entrar</button><button class="btn ${signup?'primary':'outline'}" type="button" data-auth="signup">Criar conta</button></div>${field('E-mail','email','','type="email" autocomplete="email" required maxlength="254"')}${reset?'':field('Senha','password','',`type="password" autocomplete="${signup?'new-password':'current-password'}" required ${signup?'minlength="8"':''} maxlength="128"`)}${signup?field('Confirmar senha','confirmPassword','','type="password" autocomplete="new-password" required minlength="8" maxlength="128"'):''}${!signup&&!reset?'<button type="button" class="btn subtle" id="cloudForgot">Esqueci minha senha</button>':''}<p class="cloud-local-note">${icon('info')} Entrar não importa nem substitui seus dados automaticamente.</p>`,submit:reset?'Enviar recuperação':signup?'Criar conta':'Entrar',onReady:root=>{root.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>this.authForm(b.dataset.auth));$('#cloudForgot',root)?.addEventListener('click',()=>this.authForm('reset'));},onSubmit:async data=>{
      try{
        const email=String(data.get('email')||''),password=String(data.get('password')||'');
        if(reset){await this.account.requestReset(email,this.redirectURL());return ()=>this.notice('Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha.');}
        if(signup){if(password!==data.get('confirmPassword'))throw new Error('As senhas não coincidem.');const result=await this.account.signUp(email,password,this.redirectURL());this.updateBadge();if(!result.session)return ()=>this.notice('Confira seu e-mail e confirme o cadastro. Depois volte ao Director e entre com sua senha.');}
        else await this.account.signIn(email,password);
        this.updateBadge();return ()=>this.dashboard();
      }catch(error){throw new Error(accountError(error));}
    }});
  }
  passwordForm(){openForm({title:'Criar nova senha',body:field('Nova senha','password','','type="password" required minlength="8" maxlength="128" autocomplete="new-password"')+field('Confirmar nova senha','confirmPassword','','type="password" required minlength="8" maxlength="128" autocomplete="new-password"'),submit:'Salvar senha',onSubmit:async data=>{if(data.get('password')!==data.get('confirmPassword'))throw new Error('As senhas não coincidem.');try{await this.account.changePassword(String(data.get('password')));return ()=>{toast('Senha atualizada.');this.dashboard();};}catch(error){throw new Error(accountError(error));}}});}
  dashboard(){
    const report=this.report,identity=this.account.user;if(!identity){this.authForm();return;}
    openForm({title:'Conta e nuvem',body:`<div class="cloud-account-card"><span class="cloud-tag">CONTA CONECTADA</span><strong>${esc(identity.email||'Sua conta')}</strong><p>Seus dados continuam salvos neste navegador. A importação para a nuvem será uma etapa separada.</p></div><section class="cloud-section"><h3>1. Conferir os dados deste navegador</h3><p class="dialog-description">Vamos contar suas campanhas e verificar se todos os áudios adicionados estão disponíveis. Esta conferência não envia arquivos.</p><button type="button" class="btn primary full" id="inspectCloud">${report?'Conferir novamente':'Conferir meus dados'}</button><div id="cloudReport" aria-live="polite">${report?this.renderReport(report):''}</div></section><section class="cloud-section"><h3>2. Importar para a nuvem</h3><p class="dialog-description">Próxima etapa: enviar uma cópia dos roteiros e arquivos, com verificação e retomada. O envio ainda não está habilitado nesta versão.</p></section><div class="cloud-secondary"><button type="button" class="btn outline" id="cloudBackups">Backup e dados</button><button type="button" class="btn subtle" id="cloudLogout">Sair desta conta</button></div><p id="cloudActionError" class="form-error" role="alert" hidden></p>`,onReady:root=>{
      $('#inspectCloud',root).onclick=async()=>{const button=$('#inspectCloud',root),target=$('#cloudReport',root),accountId=this.account.user?.id;button.disabled=true;button.textContent='Conferindo…';try{
        if(this.blocked())throw new Error('Recupere os dados preservados antes de preparar a importação.');
        if(!this.persist())throw new Error('Não foi possível salvar as alterações locais. Faça um backup antes de continuar.');
        const snapshot=structuredClone(this.state());await this.account.checkConnection();const result=await inspectLocalWorkspace(snapshot);
        if(accountId!==this.account.user?.id)throw new Error('A conta mudou durante a conferência. Tente novamente.');
        this.report=result;this.reportAccount=accountId;target.innerHTML=this.renderReport(result);
      }catch(error){target.innerHTML=`<p class="form-error">${esc(accountError(error))}</p>`;}finally{button.disabled=false;button.textContent='Conferir novamente';}};
      $('#cloudBackups',root).onclick=()=>this.backups();$('#cloudLogout',root).onclick=async()=>{const b=$('#cloudLogout',root);b.disabled=true;try{await this.account.signOut();this.report=null;this.updateBadge();this.authForm();}catch(error){const el=$('#cloudActionError',root);el.textContent=accountError(error);el.hidden=false;b.disabled=false;}};
    }});
  }
  renderReport(r){return `<div class="cloud-report"><span class="cloud-tag ${r.ready?'':'warning'}">${r.ready?'CONFERÊNCIA CONCLUÍDA':'ARQUIVOS AUSENTES'}</span><div class="cloud-counts">${[[r.campaigns,'Campanhas'],[r.pages,'Páginas'],[r.scenes,'Cenas'],[r.cues,'Cues'],[r.playlists,'Playlists'],[r.ambiences,'Ambientes']].map(([n,label])=>`<div><strong>${n}</strong><span>${label}</span></div>`).join('')}</div><p>${r.files.length} arquivo(s) de áudio · ${formatBytes(r.bytes)}<br>${r.youtube} referência(s) do YouTube</p>${r.missing.length?`<p class="form-error">Readicione estes arquivos neste navegador antes de importar:</p><ul>${r.missing.map(a=>`<li>${esc(a.name)}</li>`).join('')}</ul>`:'<p>Os áudios adicionados estão disponíveis neste navegador.</p>'}<small>Conferido em ${esc(new Date(r.checkedAt).toLocaleString('pt-BR'))}. Se editar depois, confira novamente. Nenhum dado foi enviado.</small></div>`;}
}
