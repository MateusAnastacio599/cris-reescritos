export const scriptColors = [
  ['none', 'Padrão'], ['red', 'Vermelho'], ['yellow', 'Amarelo'],
  ['green', 'Verde'], ['blue', 'Azul'], ['purple', 'Roxo']
];

const palette = new Set(scriptColors.map(([color]) => color));

export function colorAttributes(ink, highlight) {
  return palette.has(ink) && palette.has(highlight) && (ink !== 'none' || highlight !== 'none')
    ? ` data-cris-ink="${ink}" data-cris-highlight="${highlight}"`
    : '';
}

export function protectColorMarkup(source, token) {
  const open = [], paired = new Set();
  const markers = [...source.matchAll(/<!--cris:color:([a-z]+):([a-z]+)-->|<!--\/cris:color-->/g)];
  for (const marker of markers) {
    if (marker[1]) {
      open.push(marker);
    } else if (open.length) {
      const start = open.pop();
      if (colorAttributes(start[1], start[2])) {
        paired.add(start);
        paired.add(marker);
      }
    }
  }
  let offset = 0, result = '';
  for (const marker of markers) {
    if (!paired.has(marker)) continue;
    result += source.slice(offset, marker.index);
    result += token(marker[1] ? '<span'+colorAttributes(marker[1], marker[2])+'>' : '</span>');
    offset = marker.index+marker[0].length;
  }
  return result+source.slice(offset);
}

export function serializeColor(node, text) {
  const {crisInk, crisHighlight} = node.dataset ?? {};
  return text && node.tagName === 'SPAN' && colorAttributes(crisInk, crisHighlight)
    ? `<!--cris:color:${crisInk}:${crisHighlight}-->${text}<!--/cris:color-->`
    : text;
}

export function recolorRange(field, range, channel, color) {
  const document = field.ownerDocument;
  const contents = document.createRange();
  contents.selectNodeContents(field);
  const fragment = (start, end) => {
    const part = contents.cloneRange();
    part.setStart(start.startContainer, start.startOffset);
    part.setEnd(end.endContainer, end.endOffset);
    // cloneContents omits ancestors shared by both endpoints.
    let copy = part.cloneContents();
    let ancestor = part.commonAncestorContainer;
    if (ancestor.nodeType !== 1) ancestor = ancestor.parentElement;
    while (ancestor !== field) {
      const wrapper = ancestor.cloneNode(false);
      wrapper.append(copy);
      copy = document.createDocumentFragment();
      copy.append(wrapper);
      ancestor = ancestor.parentElement;
    }
    for (const element of [...copy.querySelectorAll('span,b,strong,i,em,s,strike,del,code')].reverse()) {
      if (!element.textContent && !element.querySelector('br') && !element.dataset.markdown) element.remove();
    }
    return copy;
  };
  const start = range.cloneRange(), end = range.cloneRange();
  start.collapse(true);
  end.collapse(false);
  const before = fragment(contents, start);
  const selected = fragment(start, end);
  const after = fragment(end, contents);
  for (const span of selected.querySelectorAll('span[data-cris-ink][data-cris-highlight]')) {
    span.dataset[channel] = 'none';
    if (!colorAttributes(span.dataset.crisInk, span.dataset.crisHighlight)) span.replaceWith(...span.childNodes);
  }
  const wrapper = document.createElement('span');
  if (color !== 'none') {
    wrapper.dataset.crisInk = channel === 'crisInk' ? color : 'none';
    wrapper.dataset.crisHighlight = channel === 'crisHighlight' ? color : 'none';
  }
  wrapper.append(selected);
  field.replaceChildren(before, wrapper, after);
  range.selectNodeContents(wrapper);
}
