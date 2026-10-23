import test from 'node:test';
import assert from 'node:assert/strict';
import { getStablePeerId, isOwnedBy } from '../../quadro/player-identity.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test('reuses the same peer id for the same account in the same tab', () => {
  const storage = new MemoryStorage();
  let calls = 0;
  const random = () => { calls += 1; return 0.314159; };
  const first = getStablePeerId('user-1', { storage, random });
  const second = getStablePeerId('user-1', { storage, random });
  assert.equal(first, second);
  assert.equal(calls, 1);
});

test('keeps different account identities separate', () => {
  const storage = new MemoryStorage();
  const one = getStablePeerId('user-1', { storage, random: () => 0.1 });
  const two = getStablePeerId('user-2', { storage, random: () => 0.2 });
  assert.notEqual(one, two);
});

test('falls back to a temporary id when session storage is unavailable', () => {
  const blockedStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  assert.equal(getStablePeerId('user-1', {
    storage: blockedStorage,
    random: () => 0.5,
  }), 'i');
});

test('only the author token is recognized as the owner of a board element', () => {
  const pin = { id: 'pin-1', by: 'pabc123' };
  assert.equal(isOwnedBy(pin, 'pabc123'), true);
  assert.equal(isOwnedBy(pin, 'pother'), false);
  assert.equal(isOwnedBy({ id: 'old-pin' }, 'pabc123'), false);
  assert.equal(isOwnedBy(null, 'pabc123'), false);
});
