import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './cloud-config.js';
let clientPromise;
export function getCloudClient(){return clientPromise ||= import('./vendor/supabase.js').then(({createClient})=>createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'cris-director:auth:v1'}})).catch(error=>{clientPromise=null;throw error;});}
export const normalizeLoginUsername=value=>String(value||'').trim().toLowerCase();
export function accountError(error){
  const messages={invalid_credentials:'Usuário ou senha incorretos.',unauthorized:'Entre novamente para continuar.',forbidden:'Apenas o mestre pode gerenciar as contas.',invalid_username:'Use de 3 a 32 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.',username_exists:'Este nome de usuário já está em uso.',weak_password:'Escolha uma senha com 8 a 128 caracteres.',rate_limited:'Muitas tentativas. Aguarde um minuto antes de tentar novamente.',unavailable:'O serviço de contas está indisponível. Tente novamente em instantes.',create_failed:'Não foi possível criar a conta. Tente novamente.',password_failed:'Não foi possível atualizar a senha.',not_found:'Conta não encontrada.'};
  if(messages[error?.code])return messages[error.code];
  if(error?.name==='AuthRetryableFetchError'||/fetch|network|load failed/i.test(error?.message||''))return 'Não foi possível conectar à nuvem. Seus dados locais continuam disponíveis. Confira a conexão e tente novamente.';
  return 'Não foi possível concluir esta ação. '+(error?.message||'Tente novamente.');
}
export class DirectorAccount extends EventTarget{
  constructor(clientProvider=getCloudClient){super();this.clientProvider=clientProvider;this.user=null;this.profile=null;}
  async call(action,values={}){
    const c=await this.clientProvider();const {data,error}=await c.functions.invoke('director-accounts',{body:{...values,action}});
    if(error){let code;try{code=(await error.context.json()).code;}catch{}const e=new Error('Falha no serviço de contas.');e.code=code||'unavailable';throw e;}
    if(data?.code){const e=new Error('Falha no serviço de contas.');e.code=data.code;throw e;}return data;
  }
  async init(){
    const c=await this.clientProvider();if(!this.subscription){const {data}=c.auth.onAuthStateChange((event,session)=>{if(this.user?.id!==session?.user?.id)this.profile=null;this.user=session?.user||null;setTimeout(()=>this.dispatchEvent(new Event('change')),0);});this.subscription=data.subscription;}
    const {data,error}=await c.auth.getSession();if(error)throw error;this.user=data.session?.user||null;if(this.user)this.profile=(await this.call('me')).account;return this.user;
  }
  async signIn(username,password){const c=await this.clientProvider();const data=await this.call('login',{username:normalizeLoginUsername(username),password});const {data:session,error}=await c.auth.setSession(data.session);if(error)throw error;this.user=session.user;this.profile=data.account;return session;}
  async listAccounts(){return (await this.call('list')).accounts;}
  async createAccount(username,password){return this.call('create',{username:normalizeLoginUsername(username),password});}
  async resetPassword(userId,password){return this.call('reset',{userId,password});}
  async changePassword(password){return this.call('password',{password});}
  async signOut(){const c=await this.clientProvider();const {error}=await c.auth.signOut({scope:'local'});if(error)throw error;this.user=null;this.profile=null;this.dispatchEvent(new Event('change'));}
  async checkConnection(){const c=await this.clientProvider();const {data,error}=await c.auth.getUser();if(error)throw error;if(!data.user)throw new Error('Entre na sua conta para continuar.');const result=await c.from('campaigns').select('id',{count:'exact',head:true});if(result.error)throw result.error;return {user:data.user,campaigns:result.count||0};}
}
