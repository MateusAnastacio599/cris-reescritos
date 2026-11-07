export function mountItemActions({toolbar, scope, activate, playTape, stopTape}) {
  const captionKey = 'cris:board:photo-captions:' + scope;
  let captions = new Map();
  try { captions = new Map(JSON.parse(localStorage.getItem(captionKey) || '[]')); } catch {}
  let selected;
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'cris-item-action';
  action.hidden = true;
  action.addEventListener('pointerdown', event => event.stopPropagation());
  toolbar.prepend(action);

  function decorate(item, node = document.getElementById('it-' + item.id)) {
    if (item.type !== 'img' || !node) return;
    node.querySelector('.cris-photo-caption')?.remove();
    const text = captions.get(item.id);
    if (!text) return;
    const caption = document.createElement('span');
    caption.className = 'cris-photo-caption';
    caption.textContent = text;
    node.append(caption);
  }

  function dialog(title) {
    const panel = document.createElement('dialog');
    panel.className = 'cris-board-dialog cris-item-dialog';
    panel.setAttribute('aria-label', title);
    const heading = document.createElement('h2');
    heading.textContent = title;
    const footer = document.createElement('footer');
    const button = (text, run) => {
      const control = document.createElement('button');
      control.type = 'button';
      control.textContent = text;
      control.onclick = run;
      footer.append(control);
      return control;
    };
    panel.addEventListener('keydown', event => {
      if (event.target.closest('button') && ['Space','Enter'].includes(event.code)) event.stopPropagation();
    });
    panel.onclose = () => { panel.remove(); if (!action.hidden) action.focus(); };
    panel.append(heading, footer);
    document.body.append(panel);
    return {panel, footer, button};
  }

  function inspectPhoto(item, image) {
    const {panel, footer, button} = dialog('Fotografia');
    const img = document.createElement('img');
    img.src = image;
    img.alt = 'Fotografia selecionada';
    const label = document.createElement('label');
    label.textContent = 'Legenda pessoal · só neste navegador';
    const field = document.createElement('textarea');
    field.maxLength = 180;
    field.rows = 2;
    field.value = captions.get(item.id) || '';
    label.append(field);
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    panel.insertBefore(img, footer);
    panel.insertBefore(label, footer);
    panel.insertBefore(status, footer);
    button('Fechar', () => panel.close());
    button('Salvar legenda', () => {
      const previous = captions.get(item.id);
      const text = field.value.trim();
      if (text) captions.set(item.id, text); else captions.delete(item.id);
      try {
        localStorage.setItem(captionKey, JSON.stringify([...captions]));
      } catch {
        if (previous) captions.set(item.id, previous); else captions.delete(item.id);
        status.textContent = 'O navegador não conseguiu guardar a legenda.';
        return;
      }
      decorate(item);
      panel.close();
    });
    panel.showModal();
  }

  function tapeControls(item) {
    const {panel, footer, button} = dialog('Gravador de fita');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    panel.insertBefore(status, footer);
    let request = 0;
    const play = async reversed => {
      const attempt = ++request;
      status.textContent = 'Preparando a fita…';
      try {
        const started = await playTape(item, reversed);
        if (attempt === request) status.textContent = started
          ? (reversed ? 'Reprodução ao contrário.' : 'Reprodução normal.')
          : 'Não foi possível reproduzir esta fita.';
      } catch {
        if (attempt === request) status.textContent = 'Não foi possível reproduzir esta fita.';
      }
    };
    button('Ouvir normal', () => play(false));
    if(item.opts?.invertido)button('Ouvir ao contrário', () => play(true));
    button('Parar', () => { request++; stopTape(item); status.textContent = 'Reprodução parada.'; });
    button('Fechar', () => panel.close());
    panel.showModal();
  }

  function select(item, {image, tape, usable} = {}) {
    selected = item && {item, image, tape, usable};
    const label = image ? 'Ver foto' : tape ? 'Gravador' : usable ? 'Usar' : '';
    if (action.textContent !== label) action.textContent = label;
    action.hidden = !label;
  }
  action.onclick = () => {
    if (!selected || action.hidden) return;
    const {item, image, tape, usable} = selected;
    if (image) inspectPhoto(item, image);
    else if (tape) tapeControls(item);
    else if (usable) void activate(item);
  };
  return {select, decorate};
}
