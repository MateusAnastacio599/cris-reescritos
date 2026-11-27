// A failed import, unavailable host, or stalled network must never trap the page behind a spinner.
const loading = document.getElementById('crisLoading');
const status = loading.querySelector('[role=status]');
const actions = loading.querySelector('.cris-loading-actions');
let timer;
let pending = true;
function stage(message) {
  if (pending) status.textContent = message;
}
function fail(message) {
  if (!pending) return;
  clearTimeout(timer);
  stage(message);
  actions.hidden = false;
}
function ready() {
  if (!pending) return;
  pending = false;
  clearTimeout(timer);
  document.body.classList.remove('cris-loading');
  for(const stamp of loading.querySelectorAll('.cris-loading-stamp'))stamp.remove();
}
function sync(message='Recebendo o quadro da mesa…'){
 pending=true;clearTimeout(timer);actions.hidden=true;document.body.classList.add('cris-loading');stage(message);
 timer=setTimeout(()=>fail('A mesa ainda está sendo recebida. Você pode aguardar ou tentar novamente.'),20000);
}
let lastStamp=0;
loading.addEventListener('pointerdown',event=>{
 if(event.target.closest('button,a')||performance.now()-lastStamp<120)return;lastStamp=performance.now();
 const stamps=loading.querySelectorAll('.cris-loading-stamp');if(stamps.length>=16)stamps[0].remove();
 const stamp=document.createElement('span');stamp.className='cris-loading-stamp';stamp.setAttribute('aria-hidden','true');stamp.textContent='C.R.I.S. · RECEBIDO';stamp.style.left=event.clientX+'px';stamp.style.top=event.clientY+'px';stamp.style.rotate=(Math.random()*24-12)+'deg';loading.append(stamp);
});
loading.querySelector('button').addEventListener('click', () => location.reload());
timer = setTimeout(() => fail('O quadro está demorando para responder. Confira a conexão ou tente novamente.'), 15000);
window.CRIS_BOARD_BOOT = {stage, fail, ready,sync};
