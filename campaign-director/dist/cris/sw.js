// Notification delivery only. No page or asset caching: deployed CSS stays fresh.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 const valid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(data.id||'');
 const root=new URL(self.registration.scope),url=new URL(valid?'?notice='+data.id:'',root);
 // Keep navigation within this installation. Never trust an arbitrary payload URL.
 event.waitUntil(self.registration.showNotification(String(data.title||'CRIS · Central de Operações').slice(0,120),{body:String(data.body||'Um comunicado está disponível na sua caixa de entrada.').slice(0,300),icon:new URL('assets/notification-icon-192.png',root).href,badge:new URL('assets/notification-badge.png',root).href,tag:valid?'cris-notice:'+data.id:'cris-message',data:{url:url.href},renotify:false}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const root=new URL(self.registration.scope);let url=root.href;
 try{const candidate=new URL(event.notification.data?.url||root.href);if(candidate.origin===root.origin&&candidate.pathname===root.pathname)url=candidate.href;}catch{}
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){const current=new URL(client.url);if(current.origin===root.origin&&current.pathname===root.pathname){await client.navigate(url);return client.focus();}}return self.clients.openWindow(url);})());
});
