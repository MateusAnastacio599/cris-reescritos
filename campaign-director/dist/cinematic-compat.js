// Publication identity is separate from protocol capability. Compatible v4 peers
// may have different builds; diagnostics retain both without exposing user data.
export const CINEMATIC_BUILD='live01b5a';
const environments=new Set(['browser','standalone']);
export function cinematicEnvironment(env=globalThis){
 const ua=env.navigator?.userAgent||'',browser=ua.match(/(Firefox|Edg|Chrome|Version)\/(\d{1,3})/);
 return {mode:env.matchMedia?.('(display-mode: standalone)').matches||env.navigator?.standalone?'standalone':'browser',browser:browser?browser[1]+'/'+browser[2]:'unknown',secure:env.isSecureContext===true,crypto:!!env.crypto?.subtle,abort:typeof env.AbortController==='function',abortCheck:typeof env.AbortSignal?.prototype?.throwIfAborted==='function'};
}
export function safeEnvironment(value){
 if(!value||!environments.has(value.mode))return null;
 return {mode:value.mode,browser:/^(Firefox|Edg|Chrome|Version)\/\d{1,3}$/.test(value.browser)?value.browser:'unknown',...Object.fromEntries(['secure','crypto','abort','abortCheck'].map(k=>[k,value[k]===true]))};
}
export const safeBuild=value=>typeof value==='string'&&/^[a-z0-9.-]{1,40}$/.test(value)?value:'unknown';
export function cinematicFailure(code){
 return ({'legacy-client':'Atualize o CRIS do jogador e reabra a mesa. Seus dados serão mantidos.','crypto-unavailable':'Este cliente não oferece a verificação segura da mesa. Abra o CRIS em um navegador atualizado.','host-proof-invalid':'A identidade do mestre não foi confirmada. Reabra a mesa.','host-key-unavailable':'Não foi possível consultar a chave da mesa.','receiver-setup-failed':'O jogador não conseguiu preparar o modo de apresentação.','media-prepare-failed':'O jogador não conseguiu preparar a mídia.','player-start-failed':'Não foi possível iniciar no jogador. Apresente novamente após verificar o cliente.','media-transfer-failed':'A transferência da mídia falhou.','manifest-invalid':'O manifesto da apresentação foi rejeitado.'})[code]||'O jogador não confirmou a apresentação. Consulte o diagnóstico avançado.';
}

export const safeErrorType=error=>['Error','TypeError','NotAllowedError','NotSupportedError','DataError','SecurityError','OperationError','TimeoutError'].includes(error?.name)?error.name:'Error';
