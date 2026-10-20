// CRIS bridge: identity and private persistence come from Supabase, not local credentials.
const directorBase=new URL('../',import.meta.url);
let accountPromise,sdk,identity=null,campaignId=null,sheetRevision=0,boardRevision=0,sheetQueue=Promise.resolve(),boardQueue=Promise.resolve();
async function account(){return accountPromise ||= import(new URL('cloud-account.js',directorBase)).then(module=>{sdk=module;return new module.DirectorAccount();});}
async function client(){await account();return sdk.getCloudClient();}
async function resolveIdentity(){
 const a=await account();if(!a.user)return null;const c=await client();
 const p=await c.from('agent_profiles').select('display_name,clearance').eq('user_id',a.user.id).maybeSingle();if(p.error)throw p.error;
 const result=await c.from('campaigns').select('id').order('created_at').limit(1).maybeSingle();if(result.error)throw result.error;campaignId=result.data?.id||null;
 identity={userId:a.user.id,username:a.profile?.username,name:p.data?.display_name||a.profile?.username||'AGENTE',clearance:p.data?.clearance||'NÍVEL DE ACESSO: 04',role:a.profile?.is_operator?'master':'agent',isMaster:!!a.profile?.is_operator};return identity;
}
function queued(kind,fn){const current=kind==='sheet'?sheetQueue:boardQueue;const next=current.catch(()=>{}).then(fn);if(kind==='sheet')sheetQueue=next;else boardQueue=next;return next;}
export const CRISBridge={
 get identity(){return identity;},get campaignId(){return campaignId;},get directorURL(){return directorBase.href;},
 async restore(){const a=await account();await a.init();return resolveIdentity();},
 async login(username,password){try{const a=await account();await a.signIn(username,password);return await resolveIdentity();}catch(e){const err=new Error(sdk?.accountError(e)||'Falha ao entrar. Tente novamente.');throw err;}},
 async logout(){await Promise.allSettled([sheetQueue,boardQueue]);const a=await account();await a.signOut();identity=null;},
 async requireIdentity(){const id=await this.restore();if(!id){localStorage.setItem('cris_quadro_retorno',location.href);location.replace(new URL('./',import.meta.url).href);return null;}return id;},
 async loadSheet(){if(!identity||!campaignId)throw Error('Entre numa campanha para acessar a ficha.');const c=await client();const r=await c.from('character_sheets').select('payload,revision').eq('user_id',identity.userId).maybeSingle();if(r.error)throw r.error;sheetRevision=r.data?.revision||0;return r.data?.payload||null;},
 saveSheet(value){const payload=structuredClone(value),user=identity?.userId;return queued('sheet',async()=>{if(!user||identity?.userId!==user||!campaignId)throw Error('Sessão alterada; entre novamente.');const c=await client();let r;if(!sheetRevision)r=await c.from('character_sheets').insert({user_id:user,campaign_id:campaignId,payload,revision:1}).select('revision').single();else r=await c.from('character_sheets').update({payload,revision:sheetRevision+1}).eq('user_id',user).eq('revision',sheetRevision).select('revision').maybeSingle();if(r.error)throw r.error;if(!r.data)throw Error('A ficha mudou em outra aba. Recarregue antes de salvar.');sheetRevision=r.data.revision;return sheetRevision;});},
 deleteSheet(){return queued('sheet',async()=>{if(!identity)return;const c=await client();const r=await c.from('character_sheets').delete().eq('user_id',identity.userId).eq('revision',sheetRevision).select('user_id');if(r.error)throw r.error;if(sheetRevision&&!r.data?.length)throw Error('A ficha mudou em outra aba. Recarregue.');sheetRevision=0;});},
 async loadBoard(){if(!identity?.isMaster||!campaignId)return null;const c=await client();const r=await c.from('board_snapshots').select('payload,revision').eq('campaign_id',campaignId).maybeSingle();if(r.error)throw r.error;boardRevision=r.data?.revision||0;return r.data?.payload||null;},
 saveBoard(value){const payload=structuredClone(value);return queued('board',async()=>{if(!identity?.isMaster||!campaignId)return;const c=await client();let r;if(!boardRevision)r=await c.from('board_snapshots').insert({campaign_id:campaignId,payload,revision:1}).select('revision').single();else r=await c.from('board_snapshots').update({payload,revision:boardRevision+1,updated_at:new Date().toISOString()}).eq('campaign_id',campaignId).eq('revision',boardRevision).select('revision').maybeSingle();if(r.error)throw r.error;if(!r.data)throw Error('Quadro atualizado em outra aba. Recarregue antes de salvar.');boardRevision=r.data.revision;return boardRevision;});}
};
