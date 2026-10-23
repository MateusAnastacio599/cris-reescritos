// A player keeps the same author token across reloads in this tab, but separate tabs stay distinct.
export function getStablePeerId(userId, {
  storage = globalThis.sessionStorage,
  random = Math.random,
} = {}) {
  const key = 'cris:board:peer:' + (userId || 'guest');
  const createId = () => random().toString(36).slice(2, 8) || 'peer' + Date.now().toString(36);

  try {
    let id = storage.getItem(key);
    if (!id) {
      id = createId();
      storage.setItem(key, id);
    }
    return id;
  } catch {
    // Storage can be blocked in strict privacy modes; the board still works for this session.
    return createId();
  }
}

export function isOwnedBy(entity, ownerId) {
  return Boolean(entity && ownerId && entity.by === ownerId);
}
