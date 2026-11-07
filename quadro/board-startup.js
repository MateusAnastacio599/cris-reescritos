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
}
loading.querySelector('button').addEventListener('click', () => location.reload());
timer = setTimeout(() => fail('O quadro está demorando para responder. Confira a conexão ou tente novamente.'), 15000);
window.CRIS_BOARD_BOOT = {stage, fail, ready};
