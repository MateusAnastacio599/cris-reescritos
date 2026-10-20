export const normalizeUsername=value=>typeof value==='string'?value.trim().toLowerCase():'';
export const validUsername=value=>/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(value);
export const validPassword=value=>typeof value==='string'&&value.length>=8&&value.length<=128;
export async function handleAccount(body,{admin,auth,user,limit}){
  const action=body.action;
  if(action==='login'){
    const username=normalizeUsername(body.username);
    if(!validUsername(username)||typeof body.password!=='string'||body.password.length>128)return {status:401,body:{code:'invalid_credentials'}};
    if(!await limit(username))return {status:429,body:{code:'rate_limited'}};
    const {data:account,error:lookupError}=await admin.from('director_accounts').select('user_id,username,is_operator').eq('username',username).maybeSingle();
    if(lookupError)return {status:503,body:{code:'unavailable'}};
    let email='unknown-'+crypto.randomUUID()+'@accounts.cris.invalid';
    if(account){const {data,error}=await admin.auth.admin.getUserById(account.user_id);if(error)return {status:503,body:{code:'unavailable'}};email=data.user?.email||email;}
    const {data,error}=await auth.auth.signInWithPassword({email,password:body.password});
    if(error||!account||!data.session)return {status:401,body:{code:'invalid_credentials'}};
    return {status:200,body:{session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token},account:{username:account.username,is_operator:account.is_operator}}};
  }
  if(!user)return {status:401,body:{code:'unauthorized'}};
  const {data:caller,error}=await admin.from('director_accounts').select('user_id,username,is_operator').eq('user_id',user.id).maybeSingle();
  if(error)return {status:503,body:{code:'unavailable'}};
  if(!caller)return {status:403,body:{code:'forbidden'}};
  if(action==='me')return {status:200,body:{account:{username:caller.username,is_operator:caller.is_operator}}};
  if(action==='password'){
    if(!validPassword(body.password))return {status:400,body:{code:'weak_password'}};
    const {error}=await admin.auth.admin.updateUserById(user.id,{password:body.password});
    return error?{status:400,body:{code:'password_failed'}}:{status:200,body:{ok:true}};
  }
  if(!caller.is_operator)return {status:403,body:{code:'forbidden'}};
  if(action==='list'){
    const {data,error}=await admin.from('director_accounts').select('user_id,username,is_operator').order('username');
    return error?{status:503,body:{code:'unavailable'}}:{status:200,body:{accounts:data}};
  }
  if(action==='create'){
    const username=normalizeUsername(body.username);
    if(!validUsername(username))return {status:400,body:{code:'invalid_username'}};
    if(!validPassword(body.password))return {status:400,body:{code:'weak_password'}};
    const {data:existing,error:lookupError}=await admin.from('director_accounts').select('user_id').eq('username',username).maybeSingle();
    if(lookupError)return {status:503,body:{code:'unavailable'}};
    if(existing)return {status:409,body:{code:'username_exists'}};
    const {data,error}=await admin.auth.admin.createUser({email:crypto.randomUUID()+'@accounts.cris.invalid',password:body.password,email_confirm:true});
    if(error||!data.user)return {status:400,body:{code:'create_failed'}};
    const {error:insertError}=await admin.from('director_accounts').insert({user_id:data.user.id,username,is_operator:false});
    if(insertError){await admin.auth.admin.deleteUser(data.user.id);return {status:409,body:{code:'username_exists'}};}
    return {status:200,body:{ok:true,username}};
  }
  if(action==='reset'){
    if(!validPassword(body.password)||typeof body.userId!=='string')return {status:400,body:{code:'weak_password'}};
    const {data:target,error}=await admin.from('director_accounts').select('user_id,is_operator').eq('user_id',body.userId).maybeSingle();
    if(error||!target)return {status:404,body:{code:'not_found'}};
    if(target.is_operator&&target.user_id!==user.id)return {status:403,body:{code:'forbidden'}};
    const {error:updateError}=await admin.auth.admin.updateUserById(target.user_id,{password:body.password});
    return updateError?{status:400,body:{code:'password_failed'}}:{status:200,body:{ok:true}};
  }
  return {status:400,body:{code:'invalid_action'}};
}
