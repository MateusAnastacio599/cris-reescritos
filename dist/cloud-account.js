import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './cloud-config.js';

let clientPromise;
export function getCloudClient(){
  return clientPromise ||= import('./vendor/supabase.js').then(({createClient})=>createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'cris-director:auth:v1'}})).catch(error=>{clientPromise=null;throw error;});
}
export function accountError(error){
  const messages={invalid_credentials:'E-mail ou senha incorretos.',email_not_confirmed:'Confirme seu e-mail antes de entrar.',user_already_exists:'Esta conta já existe. Entre com sua senha.',weak_password:'Escolha uma senha mais forte, com pelo menos 8 caracteres.',over_email_send_rate_limit:'Aguarde um pouco antes de pedir outro e-mail.',email_address_not_authorized:'O envio de e-mails ainda precisa ser configurado neste projeto Supabase. Avise o mestre.',signup_disabled:'O cadastro está desativado no projeto. Avise o mestre.',email_provider_disabled:'O login por e-mail está desativado no projeto. Avise o mestre.'};
  if(messages[error?.code])return messages[error.code];
  if(error?.name==='AuthRetryableFetchError'||/fetch|network|load failed/i.test(error?.message||''))return 'Não foi possível conectar à nuvem. Seus dados locais continuam disponíveis. Confira a conexão e tente novamente.';
  return 'Não foi possível concluir esta ação. '+(error?.message||'Tente novamente.');
}
export class DirectorAccount extends EventTarget{
  constructor(clientProvider=getCloudClient){super();this.clientProvider=clientProvider;this.user=null;this.recovering=false;}
  async init(){
    const client=await this.clientProvider();
    if(!this.subscription){const {data}=client.auth.onAuthStateChange((event,session)=>{this.user=session?.user||null;if(event==='PASSWORD_RECOVERY')this.recovering=true;setTimeout(()=>this.dispatchEvent(new Event('change')),0);});this.subscription=data.subscription;}
    const {data,error}=await client.auth.getSession();if(error)throw error;this.user=data.session?.user||null;return this.user;
  }
  async signIn(email,password){const c=await this.clientProvider();const {data,error}=await c.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;this.user=data.user;return data;}
  async signUp(email,password,redirectTo){const c=await this.clientProvider();const {data,error}=await c.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirectTo}});if(error)throw error;this.user=data.session?.user||null;return data;}
  async requestReset(email,redirectTo){const c=await this.clientProvider();const {error}=await c.auth.resetPasswordForEmail(email.trim(),{redirectTo});if(error)throw error;}
  async changePassword(password){const c=await this.clientProvider();const {error}=await c.auth.updateUser({password});if(error)throw error;this.recovering=false;}
  async signOut(){const c=await this.clientProvider();const {error}=await c.auth.signOut({scope:'local'});if(error)throw error;this.user=null;this.recovering=false;this.dispatchEvent(new Event('change'));}
  async checkConnection(){const c=await this.clientProvider();const {data,error}=await c.auth.getUser();if(error)throw error;if(!data.user)throw new Error('Entre na sua conta para continuar.');const result=await c.from('campaigns').select('id',{count:'exact',head:true});if(result.error)throw result.error;return {user:data.user,campaigns:result.count||0};}
}
