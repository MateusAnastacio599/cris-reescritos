import {editableToMarkdown} from './markdown.js';

const textTypes = new Set(['paragraph', 'h1', 'h2', 'h3', 'list', 'numbered', 'quote', 'note']);
export const isTextBlock = block => textTypes.has(block?.type);

export function textRunMarkup(blocks, index, row) {
  if (!isTextBlock(blocks[index])) return row;
  let start = '';
  if (!isTextBlock(blocks[index - 1])) {
    let end = index;
    while (isTextBlock(blocks[end + 1])) end++;
    start = `<div class="editor-text-run" data-run-start="${index}" data-run-end="${end}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Trecho do roteiro" spellcheck="true" lang="pt-BR">`;
  }
  return start + row + (isTextBlock(blocks[index + 1]) ? '' : '</div>');
}

export function intactTextRun(run) {
  const start=+run.dataset.runStart,end=+run.dataset.runEnd;
  if(run.children.length!==end-start+1)return false;
  return Array.from(run.children).every((row,index)=>
    row.matches(`[data-block-row="${start+index}"]`)&&row.querySelectorAll('[data-run-field]').length===1&&
    row.querySelector(`[data-run-field][data-block="${start+index}"]`));
}

export function runField(node) {
  const element = node?.nodeType === 1 ? node : node?.parentElement;
  return element?.closest('[data-run-field]') ?? null;
}

export function readRunField(field) {
  if (field.childNodes.length === 1 && field.firstChild.nodeName === 'BR') return '';
  return readFragment(field.querySelector('br[data-editor-empty]') ? field.cloneNode(true) : field);
}

// Each link is one unit. A saved caret never points inside its label.
export function textUnits(node) {
  if (node.nodeType === 3) return node.length;
  if (node.dataset?.markdown) return 1;
  if (node.nodeName === 'BR') return node.hasAttribute('data-editor-empty') ? 0 : 1;
  return [...node.childNodes].reduce((count, child) => count + textUnits(child), 0);
}

export function pointAt(field, offset) {
  function walk(parent) {
    for (const [index, child] of [...parent.childNodes].entries()) {
      const length = textUnits(child);
      if (offset === 0) return [parent, index];
      if (offset <= length) {
        if (child.nodeType === 3) return [child, offset];
        if (child.dataset?.markdown || child.nodeName === 'BR') return [parent, index + 1];
        return walk(child);
      }
      offset -= length;
    }
    return [parent, parent.childNodes.length];
  }
  return walk(field);
}

function fragment(field, node, offset, prefix) {
  const range = field.ownerDocument.createRange();
  range.selectNodeContents(field);
  // Treat a wiki link as an atomic token, even if a browser exposes a point inside it.
  const element = node.nodeType === 1 ? node : node.parentElement;
  const link = element?.closest('[data-markdown]');
  if (link) {
    if (prefix) range.setEndBefore(link);
    else range.setStartAfter(link);
  } else if (prefix) range.setEnd(node, offset);
  else range.setStart(node, offset);
  const box = field.ownerDocument.createElement('div');
  box.append(range.cloneContents());
  return box;
}

function readFragment(box) {
  box.querySelectorAll('br[data-editor-empty]').forEach(marker => marker.remove());
  return editableToMarkdown(box, {trim: false});
}

export function runSelection(range) {
  if (!range) return null;
  const first = runField(range.startContainer), last = runField(range.endContainer);
  if (!first || !last || first.closest('.editor-text-run') !== last.closest('.editor-text-run')) return null;
  const leading = fragment(first, range.startContainer, range.startOffset, true);
  const trailing = fragment(last, range.endContainer, range.endOffset, false);
  return {
    start: +first.dataset.block, end: +last.dataset.block, first, last,
    before: readFragment(leading), after: readFragment(trailing),
    startOffset: textUnits(leading), endOffset: textUnits(last) - textUnits(trailing),
    collapsed: range.collapsed,
  };
}

// The DOM is used for the two partial selections only. No DOM deletion can remove a block.
export function selectedTextBlocks(blocks, parts, range) {
  const chosen = blocks.slice(parts.start, parts.end + 1).map(block => ({...block}));
  if (!chosen.length || !chosen.every(isTextBlock)) return [];
  if (chosen.length === 1) {
    const document=parts.first.ownerDocument,box=document.createElement('div');
    let contents=range.cloneContents();
    let ancestor=range.commonAncestorContainer;
    if(ancestor.nodeType!==1)ancestor=ancestor.parentElement;
    for(;ancestor&&ancestor!==parts.first;ancestor=ancestor.parentElement){
      const wrapper=ancestor.cloneNode(false);
      wrapper.append(contents);
      contents=wrapper;
    }
    box.append(contents);
    chosen[0].text = readFragment(box);
  } else {
    chosen[0].text = readFragment(fragment(parts.first, range.startContainer, range.startOffset, false));
    chosen.at(-1).text = readFragment(fragment(parts.last, range.endContainer, range.endOffset, true));
  }
  return chosen;
}

export function replaceTextBlocks(blocks, parts, text = '') {
  const {start, end, before, after} = parts;
  if (start > end || !blocks[start] || !blocks[end] || !blocks.slice(start, end + 1).every(isTextBlock)) return null;
  const keep = start !== end && !before && !text && after ? end : start;
  blocks.splice(start, end - start + 1, {...blocks[keep], text:before + text + after});
  return {index:start, prefix:before + text};
}

export function pasteTextBlocks(blocks, parts, pasted) {
  if (!pasted.length || parts.start > parts.end || !blocks[parts.start] || !blocks[parts.end] || !blocks.slice(parts.start, parts.end + 1).every(isTextBlock)) return null;
  if (pasted.length === 1 && pasted[0].type === 'paragraph') return replaceTextBlocks(blocks, parts, pasted[0].text);
  const {start, end, before, after} = parts;
  const entries = pasted.map(block => ({...block}));
  if (before) entries.unshift({...blocks[start], text:before});
  const index = start + entries.length - 1, last = entries.at(-1);
  const prefix = typeof last.text === 'string' ? last.text : '';
  if (after) entries.push({...blocks[end], text:after});
  blocks.splice(start, end - start + 1, ...entries);
  return {index, prefix, special:!isTextBlock(last)};
}
