import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';
import {UUID,payloadForAudience,allowedAppBase,validPushSubscription,noticeLink} from './notice-contract.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const ok=r=>{if(r.error)throw Error('Falha no armazenamento.');return r.data;};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return response({error:'Método inválido.'},405);
 try{
  const admin=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer /i,''),auth=await admin.auth.getUser(token);if(auth.error||!auth.data.user)return response({error:'Entre novamente para continuar.'},401);const user=auth.data.user;
  if(Number(req.headers.get('Content-Length')||0)>40000)return response({error:'Solicitação muito grande.'},413);
  const raw=await req.text();if(raw.length>40000)return response({error:'Solicitação muito grande.'},413);const body=JSON.parse(raw),action=body.action;
  if(action==='config'){const config=ok(await admin.from('cris_push_config').select('public_key').single());const devices=ok(await admin.from('cris_push_subscriptions').select('id').eq('user_id',user.id));return response({publicKey:config.public_key,devices:devices.length});}
  if(action==='subscribe'){const subscription=validPushSubscription(body.subscription),app_base=allowedAppBase(body.appBase);ok(await admin.from('cris_push_subscriptions').upsert({user_id:user.id,endpoint:subscription.endpoint,subscription,app_base,updated_at:new Date().toISOString()},{onConflict:'endpoint'}));return response({subscribed:true});}
  if(action==='unsubscribe'){ok(await admin.from('cris_push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',String(body.endpoint||'')));return response({subscribed:false});}
  if(action!=='publish')return response({error:'Ação inválida.'},400);
  if(!UUID.test(body.campaignId)||!UUID.test(body.noticeId))return response({error:'Ocorrência inválida.'},400);
  const campaign=ok(await admin.from('campaigns').select('id,owner_id').eq('id',body.campaignId).maybeSingle());
  const members=campaign?ok(await admin.from('campaign_members').select('user_id,role').eq('campaign_id',campaign.id)):[];
  if(!campaign||(campaign.owner_id!==user.id&&!members.some(m=>m.user_id===user.id&&m.role==='gm')))return response({error:'Somente o mestre desta campanha pode enviar.'},403);
  const existing=ok(await admin.from('operation_notices').select('*').eq('id',body.noticeId).maybeSingle());let notice=existing;
  if(existing&&(existing.created_by!==user.id||existing.campaign_id!==campaign.id||existing.audience!==body.audience))return response({error:'Identificador já utilizado.'},409);
  if(!notice){
   const since=new Date(Date.now()-60000).toISOString(),count=await admin.from('operation_notices').select('id',{count:'exact',head:true}).eq('created_by',user.id).gte('created_at',since);if(count.error)throw Error('Falha na verificação de envio.');if(count.count>=10)return response({error:'Aguarde um minuto antes de enviar novamente.'},429);
   const payload=payloadForAudience(body.payload,body.audience,campaign.id);
   const row={id:body.noticeId,campaign_id:campaign.id,created_by:user.id,audience:body.audience,payload};
   const inserted=await admin.from('operation_notices').insert(row).select('*').single();
   if(inserted.error?.code==='23505'){notice=ok(await admin.from('operation_notices').select('*').eq('id',body.noticeId).eq('created_by',user.id).eq('campaign_id',campaign.id).eq('audience',body.audience).single());}else notice=ok(inserted);
  }
  const recipients=notice.audience==='self'?[user.id]:[...new Set([campaign.owner_id,...members.map(m=>m.user_id)])];
  const devices=ok(await admin.from('cris_push_subscriptions').select('*').in('user_id',recipients));
  const config=devices.length?ok(await admin.from('cris_push_config').select('*').single()):null;
  let accepted=0,failed=0,skipped=0;
  // Device claims make retries idempotent. OS tags also coalesce delivery retries.
  for(let i=0;i<devices.length;i+=8)await Promise.all(devices.slice(i,i+8).map(async device=>{
   const id={notice_id:notice.id,subscription_id:device.id};await admin.from('notice_push_deliveries').upsert({...id,status:'pending'},{onConflict:'notice_id,subscription_id',ignoreDuplicates:true});
   const claim=await admin.from('notice_push_deliveries').update({status:'sending',updated_at:new Date().toISOString()}).eq('notice_id',notice.id).eq('subscription_id',device.id).or('status.in.(pending,failed),and(status.eq.sending,updated_at.lt.'+new Date(Date.now()-120000).toISOString()+')').select('notice_id').maybeSingle();if(claim.error){failed++;return;}if(!claim.data){skipped++;return;}
   try{
    const subscription=validPushSubscription(device.subscription),base=allowedAppBase(device.app_base);
    const message=JSON.stringify({id:notice.id,title:notice.payload.title,body:notice.payload.summary,url:noticeLink(base,notice.id),test:notice.audience==='self'});
    await webpush.sendNotification(subscription,message,{TTL:86400,urgency:'normal',timeout:10000,vapidDetails:{subject:'https://mateusanastacio599.github.io/cris-reescritos/',publicKey:config.public_key,privateKey:config.private_key}});
    ok(await admin.from('notice_push_deliveries').update({status:'sent',updated_at:new Date().toISOString()}).eq('notice_id',notice.id).eq('subscription_id',device.id));accepted++;
   }catch(error){failed++;if([404,410].includes(error.statusCode))await admin.from('cris_push_subscriptions').delete().eq('id',device.id);else await admin.from('notice_push_deliveries').update({status:'failed',updated_at:new Date().toISOString()}).eq('notice_id',notice.id).eq('subscription_id',device.id);}
  }));
  return response({id:notice.id,audience:notice.audience,recipients:recipients.length,devices:devices.length,pushAccepted:accepted,pushFailed:failed,alreadySent:skipped,inboxSaved:true});
 }catch(error){return response({error:['SyntaxError','TypeError'].includes(error?.name)?'Solicitação inválida.':error.message||'Falha ao enviar.'},400);}
});
