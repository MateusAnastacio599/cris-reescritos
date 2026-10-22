import test from 'node:test';
import assert from 'node:assert/strict';

class FakeElement {
  constructor(documentRef, { id = '', classes = [] } = {}) {
    this.ownerDocument = documentRef;
    this.id = id;
    this.classes = new Set(classes);
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.contentEditable = 'false';
    this.parentElement = null;
    this.classList = {
      contains: (name) => this.classes.has(name),
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
    };
  }
  get isContentEditable() { return this.contentEditable === 'true'; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  focus() { this.ownerDocument.activeElement = this; }
  blur() {
    if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body;
    this.contentEditable = 'false';
  }
  contains(other) {
    for (let node = other; node; node = node.parentElement) if (node === this) return true;
    return false;
  }
  matches(selector) {
    return selector === '.note[contenteditable="true"]' &&
      this.classes.has('note') && this.isContentEditable;
  }
  closest(selector) {
    if (selector === '#items .it .note') {
      if (!this.classes.has('note')) return null;
      const item = this.parentElement;
      return item?.classes.has('it') && item.parentElement?.id === 'items' ? this : null;
    }
    if (selector === '.it') {
      for (let node = this; node; node = node.parentElement) if (node.classes?.has('it')) return node;
      return null;
    }
    if (selector === '.note[contenteditable="true"]') return this.matches(selector) ? this : null;
    return null;
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement(this);
    this.body.classList.add('tool-select');
    this.view = new FakeElement(this, { id: 'view' });
    this.activeElement = this.body;
    this.handlers = new Map();
  }
  getElementById(id) { return id === 'view' ? this.view : null; }
  addEventListener(type, handler) {
    const handlers = this.handlers.get(type) ?? [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }
  fire(type, event) {
    for (const handler of this.handlers.get(type) ?? []) handler(event);
  }
  makeNote(id = 'note-1') {
    const items = new FakeElement(this, { id: 'items' });
    const item = new FakeElement(this, { classes: ['it'] });
    item.dataset.id = id;
    item.parentElement = items;
    const note = new FakeElement(this, { classes: ['note'] });
    note.parentElement = item;
    return note;
  }
  makeBackground() { return new FakeElement(this, { id: 'background' }); }
}

globalThis.Element = FakeElement;
globalThis.window = { matchMedia: () => ({ matches: true }) };
const { installMobileBoardUX } = await import('../../quadro/mobile-board-ux.js');

function tap(documentRef, target, x = 20, y = 20) {
  documentRef.fire('pointerdown', {
    target, pointerType: 'touch', clientX: x, clientY: y,
    preventDefault() {},
  });
}

test('two taps on the same post-it enter editing and focus the text', () => {
  const documentRef = new FakeDocument();
  installMobileBoardUX(documentRef);
  const note = documentRef.makeNote();
  tap(documentRef, note);
  assert.equal(note.isContentEditable, false);
  tap(documentRef, note, 22, 21);
  assert.equal(note.isContentEditable, true);
  assert.equal(documentRef.activeElement, note);
  assert.equal(note.attributes.spellcheck, 'true');
});

test('tapping outside a post-it ends editing', () => {
  const documentRef = new FakeDocument();
  installMobileBoardUX(documentRef);
  const note = documentRef.makeNote();
  tap(documentRef, note);
  tap(documentRef, note);
  assert.equal(note.isContentEditable, true);
  tap(documentRef, documentRef.makeBackground());
  assert.equal(note.isContentEditable, false);
  assert.equal(documentRef.activeElement, documentRef.body);
});

test('Escape ends editing', () => {
  const documentRef = new FakeDocument();
  installMobileBoardUX(documentRef);
  const note = documentRef.makeNote();
  tap(documentRef, note);
  tap(documentRef, note);
  let prevented = false;
  documentRef.fire('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(note.isContentEditable, false);
  assert.equal(prevented, true);
});

test('touches while another tool is active do not enter editing', () => {
  const documentRef = new FakeDocument();
  documentRef.body.classList.remove('tool-select');
  documentRef.body.classList.add('tool-pin');
  installMobileBoardUX(documentRef);
  const note = documentRef.makeNote();
  tap(documentRef, note);
  tap(documentRef, note);
  assert.equal(note.isContentEditable, false);
});
