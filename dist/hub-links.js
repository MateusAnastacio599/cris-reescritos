export const crisHome=()=>location.pathname.includes('/campaign-director/dist/')?new URL('../../',import.meta.url).href:new URL('cris/',import.meta.url).href;
