const view=document.querySelector('#view'),report=document.querySelector('#report'),size=document.querySelector('#size'),scene=document.querySelector('#scene');let token=0;
const ready=new Promise(resolve=>{if(view.contentDocument?.readyState==='complete')resolve();else view.addEventListener('load',resolve,{once:true});});
async function request(action){await ready;return new Promise((resolve,reject)=>{const id=++token,timer=setTimeout(()=>{removeEventListener('message',handle);reject(Error('Tempo limite do teste'));},20000),handle=e=>{if(e.origin!==location.origin||e.source!==view.contentWindow||e.data.token!==id)return;clearTimeout(timer);removeEventListener('message',handle);resolve(e.data.fitReport);};addEventListener('message',handle);view.contentWindow.postMessage({action,mode:scene.value,token:id},location.origin);});}
const resize=async()=>{const [w,h]=size.value.split('x');view.style.width=w+'px';view.style.height=h+'px';await new Promise(r=>setTimeout(r,120));};
const display=data=>{report.textContent=JSON.stringify(data,null,2);};
document.querySelector('#load').onclick=async()=>{report.textContent='Preparando…';await resize();display(await request('load'));};
size.onchange=resize;
document.querySelector('#rotate').onclick=async()=>{const before=await request('measure');size.value=size.value.split('x').reverse().join('x');await resize();display({before,after:await request('measure')});};
document.querySelector('#measure').onclick=async()=>display(await request('measure'));
document.querySelector('#stop').onclick=async()=>{report.textContent='Encerrando…';display(await request('stop'));};
document.querySelector('#matrix').onclick=async()=>{report.textContent='Executando…';const result=[];for(const dim of [...size.options].map(o=>o.value)){size.value=dim;await resize();const data=await request('load');result.push({size:dim,...data});}display(result);};

document.querySelector('#focus').onclick=()=>{document.querySelector('header').hidden=true;view.style.top='0';if(view.clientWidth>1000){view.style.transform='scale(.6)';view.style.transformOrigin='top left';}};
document.querySelector('#continuity').onclick=async()=>{report.textContent='Medindo continuidade…';await request('play');const before=await request('measure');size.value=size.value.split('x').reverse().join('x');await resize();display({before,after:await request('measure')});};
