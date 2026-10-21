import {CloudWorkspace,preserveBeforeCloudLoad} from './cloud-workspace.js';
import {initialState,validateState,STORAGE_KEY} from './storage.js';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value;
export function contentStamp(state){const {ui,...content}=state;return JSON.stringify(canonical(content));}
export function isStarter(state){const pick=s=>{const campaigns=structuredClone(s.campaigns);for(const c of campaigns)for(const p of c.pages)for(const scene of p.scenes)for(const version of scene.textHistory||[])delete version.at;return {campaigns,audioAssets:s.audioAssets,playlists:s.playlists,ambiences:s.ambiences};};return contentStamp(pick(state))===contentStamp(pick(initialState()));}
export function syncDecision({local,remote,meta}){
  const localStamp=contentStamp(local),remoteStamp=contentStamp(remote.payload);
  if(localStamp===remoteStamp)return 'same';
  if(!meta)return isStarter(local)?'remote':'review';
  const dirty=localStamp!==meta.base;
  if(!dirty)return 'remote';
  return remote.revision===meta.revision?'local':'review';
}
/** Sincronização por conta; revisão otimista impede sobrescrever outro computador. */
export class WorkspaceSync extends EventTarget{
  constructor({state,apply,storage=globalThis.localStorage,workspace=()=>new CloudWorkspace(),canApply=()=>true,delay=1400}){super();Object.assign(this,{state,apply,storage,makeWorkspace:workspace,canApply,delay});this.generation=0;this.status='signed-out';this.message='Entre para acessar sua sessão';this.workspace=this.makeWorkspace();}
  key(owner=this.owner){return 'cris:sync:v1:'+owner;}
  meta(){try{return JSON.parse(this.storage.getItem(this.key()))||null;}catch{return null;}}
  setStatus(status,message){this.status=status;this.message=message;this.dispatchEvent(new Event('change'));}
  stash(name,state=this.state()){this.storage.setItem(this.key()+':'+name,JSON.stringify(state));}
  acknowledge(snapshot){const binding=this.workspace.binding;this.storage.setItem(this.key(),JSON.stringify({workspaceId:binding.id,revision:binding.revision,base:contentStamp(snapshot),savedAt:new Date().toISOString()}));}
  get dirty(){const meta=this.meta();return !!this.owner&&(!meta||contentStamp(this.state())!==meta.base);}
  async start(owner){
    const generation=++this.generation;clearTimeout(this.timer);this.owner=owner;this.flushing=null;const workspace=this.workspace=this.makeWorkspace();this.conflict=null;this.setStatus('loading','Abrindo a sessão da sua conta…');
    try{
      const previous=this.storage.getItem('cris:sync:last-owner');
      if(previous&&previous!==owner){this.storage.setItem('cris:sync:v1:'+previous+':draft',JSON.stringify(this.state()));const draft=this.storage.getItem(this.key()+':draft');this.apply(draft?validateState(JSON.parse(draft)):initialState());}
      this.storage.setItem('cris:sync:last-owner',owner);
      const rows=await workspace.list();if(generation!==this.generation)return;
      if(!rows.length){this.setStatus('error','Nenhuma sessão do mestre está vinculada a esta conta.');return;}
      const row=await workspace.peek(rows[0].id);if(generation!==this.generation)return;
      const remote={...row,payload:validateState(structuredClone(row.payload))},decision=syncDecision({local:this.state(),remote,meta:this.meta()});
      if(decision==='review'){this.conflict=remote;this.stash('draft');this.setStatus('review','Há duas versões da sessão. Escolha qual continuar.');return;}
      if(decision==='local'){workspace.bind(remote);this.setStatus('pending','Enviando alterações deste computador…');await this.flush();return;}
      await this.takeRemote(remote,generation);
    }catch(error){if(generation===this.generation)this.setStatus('offline','Sem sincronização: '+(error.message||'confira sua conexão')+'. O rascunho local foi mantido.');}
  }
  async takeRemote(row,generation=this.generation){
    const before=contentStamp(this.state()),workspace=this.workspace;
    const next=await workspace.load(row.id,text=>{if(generation===this.generation)this.setStatus('loading',text);});if(generation!==this.generation)return;
    if(contentStamp(this.state())!==before){this.conflict=row;this.stash('draft');this.setStatus('review','O roteiro foi editado durante o carregamento. Suas alterações foram preservadas.');return;}
    preserveBeforeCloudLoad(this.storage);next.ui=this.state().ui;this.apply(next);this.acknowledge(next);this.conflict=null;this.setStatus('synced','Salvo no Supabase · pronto em outros computadores');
  }
  changed(){
    if(!this.owner||['loading','review','signed-out','error'].includes(this.status))return;
    if(!this.dirty)return;
    if(!this.workspace.binding){this.stash('draft');this.setStatus('offline','Rascunho neste computador · reconectando à conta');return;}
    this.stash('draft');clearTimeout(this.timer);if(!this.flushing)this.setStatus('pending','Alterações neste computador · sincronizando…');
    this.timer=setTimeout(()=>this.flush(),this.delay);
  }
  async flush(){
    clearTimeout(this.timer);if(this.flushing)return this.flushing;if(!this.owner||this.conflict||!this.workspace.binding)return;
    const generation=this.generation,workspace=this.workspace,snapshot=structuredClone(this.state());if(!this.dirty)return;
    this.setStatus('saving','Salvando roteiro e arquivos na sua conta…');
    let running;running=(async()=>{
      try{
        await workspace.save(snapshot,text=>{if(generation===this.generation)this.setStatus('saving',text);});if(generation!==this.generation)return;
        this.acknowledge(snapshot);this.setStatus('synced','Salvo no Supabase · pronto em outros computadores');
      }catch(error){if(generation!==this.generation)return;this.stash('draft');
        if(/CONFLICT/i.test(error.message||'')){try{this.conflict=await workspace.peek(workspace.binding.id);}catch{this.setStatus('offline','Conflito detectado. Reconecte para comparar as versões.');return;}if(generation!==this.generation)return;this.setStatus('review','A sessão também mudou em outro computador. Escolha a versão antes de continuar.');}
        else this.setStatus('offline','Salvo neste computador · aguardando conexão. '+(error.message||''));
      }
    })().finally(()=>{if(this.flushing===running)this.flushing=null;if(generation===this.generation&&this.status==='synced'&&this.dirty)this.changed();});this.flushing=running;return running;
  }
  async resolve(choice){
    if(!this.conflict)return;const row=this.conflict;this.stash('draft');this.stash('previous-cloud',row.payload);
    if(choice==='remote'){await this.takeRemote(row);return;}
    this.workspace.bind(row);this.conflict=null;this.storage.setItem(this.key(),JSON.stringify({workspaceId:row.id,revision:row.revision,base:contentStamp(row.payload)}));
    this.setStatus('pending','Sincronizando a versão escolhida…');await this.flush();if(!this.dirty)this.setStatus('synced','Salvo no Supabase · pronto em outros computadores');
  }
  async check(){
    if(!this.owner||this.flushing||['loading','review','error'].includes(this.status))return;
    if(this.status==='offline'){if(this.workspace.binding&&this.dirty)await this.flush();else await this.start(this.owner);return;}
    if(this.dirty){this.changed();return;}
    try{const rows=await this.workspace.list(),row=rows.find(r=>r.id===this.workspace.binding?.id);if(row&&row.revision!==this.workspace.binding.revision){if(!this.canApply()){this.setStatus('updates','Há atualizações da sessão · serão abertas ao encerrar a reprodução');return;}this.setStatus('loading','Atualizando a sessão da sua conta…');await this.takeRemote(await this.workspace.peek(row.id));}}
    catch{this.setStatus('offline','A sessão permanece neste computador. Reconectaremos automaticamente.');}
  }
  detach(){clearTimeout(this.timer);this.generation++;if(this.owner)this.stash('draft');this.owner=null;this.conflict=null;this.workspace=this.makeWorkspace();this.setStatus('signed-out','Entre para acessar sua sessão');}
}
