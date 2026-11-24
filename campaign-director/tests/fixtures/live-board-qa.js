const $=s=>document.querySelector(s),status=$('#qaStatus'),report=$('#qaReport');
let serial=0;
const contextKey='live-fixture-context-id';if(!localStorage.getItem(contextKey))localStorage.setItem(contextKey,crypto.randomUUID());
const contextId=localStorage.getItem(contextKey);
$('#qaImage').onclick=async()=>{
 const c=document.createElement('canvas');c.width=900;c.height=700;const ctx=c.getContext('2d');
 const pixels=ctx.createImageData(900,700);for(let i=0;i<pixels.data.length;i+=4){pixels.data[i]=(i*13+serial*17)%256;pixels.data[i+1]=(i*7)%256;pixels.data[i+2]=Math.floor(Math.random()*255);pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);ctx.fillStyle='#fff';ctx.font='bold 64px sans-serif';ctx.fillText('Imagem LIVE '+(++serial),100,200);
 const blob=await new Promise(r=>c.toBlob(r,'image/png'));const data=new DataTransfer();data.items.add(new File([blob],'live-'+serial+'.png',{type:'image/png'}));const input=$('#fileIn');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));
};
$('#qaDrop').onclick=()=>window.LIVE_QA?.drop();$('#qaRestart').onclick=()=>window.LIVE_QA?.restart();
setInterval(()=>{
 const d=window.CRIS_LIVE_DIAGNOSTICS?.(),s=window.LIVE_QA?.snapshot();
 const items=s?.state.items||[];
 status.textContent=d?(d.ready?'Pronto':'Aguardando snapshot')+' · '+d.connections+' conexões':'Use Jogar junto → Compartilhar esta mesa';
 report.textContent=JSON.stringify({room:$('#shLink')?.value||new URLSearchParams(location.search).get('sala'),contextId,peerOpen:d?.peerOpen,pending:d?.pending,ice:d?.ice,participants:d?.participants,items:items.map(i=>({id:i.id,type:i.type,imgId:i.imgId,x:Math.round(i.x),y:Math.round(i.y)})),pins:s?.state.pins?.length,strings:s?.state.strings?.length,media:items.filter(i=>i.imgId&&s.imgs[i.imgId]).length,stats:d?.stats,events:d?.events.slice(-8)},null,2);
},500);
