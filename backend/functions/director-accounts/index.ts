import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {handleAccount} from './core.js';
const origin='https://cris-campaign-director-v3.mateusfernando599.chatgpt.site';
const url=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const digest=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('');
Deno.serve(async(req:Request)=>{
  const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
  const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
  if(req.headers.has('origin')&&req.headers.get('origin')!==origin)return respond(403,{code:'forbidden_origin'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return respond(405,{code:'method_not_allowed'});
  try{
    let size=0;const parts:Uint8Array[]=[];const reader=req.body?.getReader();
    if(!reader)return respond(400,{code:'invalid_body'});
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return respond(413,{code:'body_too_large'});}parts.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
    const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))return respond(400,{code:'invalid_body'});
    // Admin secrets never leave this server. Every non-login operation verifies a real access token.
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    let user=null;
    if(body.action!=='login'){
      const match=/^Bearer (.+)$/i.exec(req.headers.get('authorization')||'');
      if(!match)return respond(401,{code:'unauthorized'});
      const {data,error}=await admin.auth.getUser(match[1]);if(error||!data.user)return respond(401,{code:'unauthorized'});user=data.user;
    }
    const result=await handleAccount(body,{admin,auth,user,limit:async(username:string)=>{
      const ip=(req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'unknown').split(',')[0].trim();
      const {data,error}=await admin.rpc('director_consume_login',{p_ip:await digest(ip),p_user:await digest(username)});return !error&&data===true;
    }});
    return respond(result.status,result.body);
  }catch{return respond(400,{code:'request_failed'});}
});
