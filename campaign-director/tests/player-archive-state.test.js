import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePlayerArchive } from '../../quadro/player-archive-state.js';

const OWNER = 'owner-player-one';

test('merges only a player’s own saved annotations into the latest published board', () => {
  const published = {
    state: {
      items: [{ id: 'master-clue', type: 'img', by: 'host', text: 'master version' }],
      pins: [{ id: 'master-pin', item: 'master-clue', by: 'host' }],
      strings: [],
      fx: { fumaca: false, nevoa: 0, brasas: false, liq: false },
      light: { color: '#f9d9a0', int: 40 },
      cam: { x: 0, y: 0, z: 1 },
    },
    imgs: { 'master-image': 'published-image' },
  };
  const local = {
    state: {
      items: [
        { id: 'master-clue', type: 'img', by: 'host', text: 'stale local version' },
        { id: 'player-note', type: 'note', by: OWNER, text: 'Minha observação' },
        { id: 'other-player-note', type: 'note', by: 'owner-other', text: 'Outra pessoa' },
      ],
      pins: [
        { id: 'player-pin', item: 'master-clue', by: OWNER },
        { id: 'free-player-pin', item: null, by: OWNER },
        { id: 'pin-for-deleted-clue', item: 'clue-removed-by-master', by: OWNER },
        { id: 'other-player-pin', item: null, by: 'owner-other' },
      ],
      strings: [
        { id: 'player-link', a: 'player-pin', b: 'free-player-pin', by: OWNER },
        { id: 'invalid-link', a: 'player-pin', b: 'pin-for-deleted-clue', by: OWNER },
        { id: 'other-player-link', a: 'player-pin', b: 'free-player-pin', by: 'owner-other' },
      ],
      fx: { fumaca: true, nevoa: 2, brasas: true, liq: true },
      light: { color: '#ffffff', int: 100 },
      cam: { x: 42, y: 19, z: 1.5 },
      pinColor: '#1b61aa',
    },
    imgs: {
      'master-image': 'stale-image',
      'player-note-image': 'player-image',
      'unreferenced-secret': 'secret',
    },
  };

  const merged = mergePlayerArchive(published, local, OWNER);
  assert.equal(merged.state.items.find(item => item.id === 'master-clue').text, 'master version');
  assert.ok(merged.state.items.some(item => item.id === 'player-note'));
  assert.equal(merged.state.items.some(item => item.id === 'other-player-note'), false);
  assert.deepEqual(merged.state.pins.map(pin => pin.id).sort(), ['free-player-pin', 'master-pin', 'player-pin']);
  assert.deepEqual(merged.state.strings.map(link => link.id), ['player-link']);
  assert.deepEqual(merged.state.fx, published.state.fx, 'effects stay controlled by published board');
  assert.deepEqual(merged.state.light, published.state.light, 'local lighting must not override the scene');
  assert.deepEqual(merged.state.cam, local.state.cam, 'camera position remains personal');
  assert.equal(merged.state.pinColor, '#1b61aa');
  assert.deepEqual(merged.imgs, {
    'master-image': 'published-image',
    'player-note-image': 'player-image',
  });
});

test('removed local annotations stay removed and the merge never mutates either source', () => {
  const published = { state: { items: [], pins: [], strings: [], fx: { fumaca: false } }, imgs: {} };
  const local = {
    state: {
      items: [],
      pins: [],
      strings: [],
      fx: { fumaca: true },
    },
    imgs: { stale: 'stale' },
  };
  const publishedCopy = structuredClone(published);
  const localCopy = structuredClone(local);
  const merged = mergePlayerArchive(published, local, OWNER);
  assert.deepEqual(merged.state.items, []);
  assert.deepEqual(merged.state.pins, []);
  assert.deepEqual(merged.state.strings, []);
  assert.deepEqual(merged.state.fx, { fumaca: false });
  assert.deepEqual(merged.imgs, {});
  assert.deepEqual(published, publishedCopy);
  assert.deepEqual(local, localCopy);
});

test('without an owner token the published archive is read as-is', () => {
  const published = { state: { items: [{ id: 'clue' }], pins: [], strings: [], fx: { fumaca: false } }, imgs: {} };
  const local = { state: { items: [{ id: 'mine', by: OWNER }], pins: [], strings: [], fx: { fumaca: true } }, imgs: {} };
  const merged = mergePlayerArchive(published, local, null);
  assert.deepEqual(merged, published);
  assert.notEqual(merged, published);
});
