// A peer token identifies this tab on the live board; a separate owner token persists
// across tabs/reloads so a player can still manage annotations they created earlier.
export function getStablePeerId(userId, {
  storage = (() => { try { return globalThis.sessionStorage; } catch { return null; } })(),
  random = Math.random,
} = {}) {
  const key = 'cris:board:peer:' + (userId || 'guest');
  const createId = () => random().toString(36).slice(2, 8) || 'peer' + Date.now().toString(36);

  try {
    if (!storage) throw new Error('Session storage unavailable');
    let id = storage.getItem(key);
    if (!id) {
      id = createId();
      storage.setItem(key, id);
    }
    return id;
  } catch {
    return createId();
  }
}

export function getStableBoardOwnerId(userId, {
  storage = (() => { try { return globalThis.localStorage; } catch { return null; } })(),
  random = Math.random,
} = {}) {
  const key = 'cris:board:owner:' + (userId || 'guest');
  const createId = () => 'owner-' + (random().toString(36).slice(2, 12) || Date.now().toString(36));

  try {
    if (!storage) throw new Error('Persistent storage unavailable');
    let id = storage.getItem(key);
    if (!id) {
      id = createId();
      storage.setItem(key, id);
    }
    return id;
  } catch {
    // If persistent storage is blocked, board annotations still work for this page session.
    return createId();
  }
}

export function isOwnedBy(entity, ownerId) {
  return Boolean(entity && ownerId && entity.by === ownerId);
}
