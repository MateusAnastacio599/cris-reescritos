// Identificador público. PKCE dispensa Client Secret no navegador.
export const SPOTIFY_CLIENT_ID='f904a667dfbd43e3b8f1a609dff91c5b';
export const SPOTIFY_HOME='https://mateusanastacio599.github.io/cris-reescritos/campaign-director/dist/';
export const SPOTIFY_REDIRECT=SPOTIFY_HOME+'spotify-callback.html';
const TOKEN_KEY='cris:spotify:session:v1',PENDING_KEY='cris:spotify:pkce:v1';
const SCOPES='streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative';
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function parseSpotify(value){
  const text=String(value||'').trim();let match=text.match(/^spotify:(track|playlist):([a-zA-Z0-9]{22})$/);
  if(!match){let url;try{url=new URL(text);}catch{throw Error('Cole um link de faixa ou playlist do Spotify.');}
    if(url.protocol!=='https:'||url.hostname!=='open.spotify.com')throw Error('Use um link de open.spotify.com.');
    match=url.pathname.match(/^\/(?:intl-[\w-]+\/)?(track|playlist)\/([a-zA-Z0-9]{22})\/?$/);
  }
  if(!match)throw Error('Use uma faixa ou playlist do Spotify; álbuns e podcasts ainda não são aceitos.');
  return {type:match[1],id:match[2],uri:`spotify:${match[1]}:${match[2]}`,url:`https://open.spotify.com/${match[1]}/${match[2]}`};
}
export class SpotifyAuth{
  constructor({storage=globalThis.sessionStorage,fetcher=(...args)=>fetch(...args),now=()=>Date.now(),cryptoProvider=globalThis.crypto}={}){Object.assign(this,{storage,fetcher,now,cryptoProvider});this.generation=0;}
  read(){try{const value=JSON.parse(this.storage.getItem(TOKEN_KEY));return value?.access_token&&value?.refresh_token?value:null;}catch{return null;}}
  get connected(){return !!this.read();}
  async begin(currentURL=globalThis.location.href){
    if(new URL(currentURL).origin!==new URL(SPOTIFY_HOME).origin)throw Error('Para conectar o Spotify, abra o Director no endereço original do CRIS.');
    const verifier=encode(this.cryptoProvider.getRandomValues(new Uint8Array(64))),state=encode(this.cryptoProvider.getRandomValues(new Uint8Array(32)));
    const challenge=encode(new Uint8Array(await this.cryptoProvider.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
    this.storage.setItem(PENDING_KEY,JSON.stringify({verifier,state,createdAt:this.now()}));
    const params=new URLSearchParams({client_id:SPOTIFY_CLIENT_ID,response_type:'code',redirect_uri:SPOTIFY_REDIRECT,scope:SCOPES,state,code_challenge_method:'S256',code_challenge:challenge});
    return 'https://accounts.spotify.com/authorize?'+params;
  }
  async complete(params){
    let pending;try{pending=JSON.parse(this.storage.getItem(PENDING_KEY));}catch{}
    this.storage.removeItem(PENDING_KEY);
    if(!pending||typeof pending.verifier!=='string'||typeof pending.state!=='string'||!Number.isFinite(pending.createdAt)||!params.get('state')||params.get('state')!==pending.state||this.now()-pending.createdAt>600000||this.now()<pending.createdAt)throw Error('A autorização expirou ou não pertence a esta aba. Volte ao CRIS e conecte novamente.');
    if(params.get('error'))throw Error('A conexão foi cancelada no Spotify. Você pode tentar novamente.');
    if(!params.get('code'))throw Error('O Spotify não retornou o código de autorização.');
    return this.exchange({grant_type:'authorization_code',code:params.get('code'),redirect_uri:SPOTIFY_REDIRECT,code_verifier:pending.verifier});
  }
  async exchange(fields){
    const generation=this.generation,r=await this.fetcher('https://accounts.spotify.com/api/token',{method:'POST',signal:globalThis.AbortSignal?.timeout?.(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:SPOTIFY_CLIENT_ID,...fields})}).catch(()=>{throw Error('O Spotify não respondeu à autorização. Confira a conexão e tente novamente.');});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw Error('Não foi possível autorizar o Spotify. Confira o Redirect URI cadastrado e conecte novamente.');
    if(generation!==this.generation)throw Error('A conexão Spotify foi encerrada.');
    const refresh=data.refresh_token||fields.refresh_token;
    if(typeof data.access_token!=='string'||typeof refresh!=='string'||!Number.isFinite(data.expires_in))throw Error('Resposta de autorização inválida.');
    const token={access_token:data.access_token,refresh_token:refresh,expires_at:this.now()+data.expires_in*1000};this.storage.setItem(TOKEN_KEY,JSON.stringify(token));return token.access_token;
  }
  async token(force=false){
    const token=this.read();if(!token)throw Error('Conecte sua conta em Biblioteca → Spotify.');
    if(!force&&token.expires_at>this.now()+60000)return token.access_token;
    if(!this.refreshing)this.refreshing=this.exchange({grant_type:'refresh_token',refresh_token:token.refresh_token}).finally(()=>{this.refreshing=null;});
    return this.refreshing;
  }
  disconnect(){this.generation++;this.storage.removeItem(TOKEN_KEY);this.storage.removeItem(PENDING_KEY);}
}
