const clone = value => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));
const list = value => Array.isArray(value) ? value : [];

export function mergePlayerArchive(published, local, ownerId) {
  const result = clone(published || { state: { items: [], pins: [], strings: [] }, imgs: {} });
  result.state ||= { items: [], pins: [], strings: [] };
  result.imgs ||= {};
  const state = result.state;
  state.items = list(state.items);
  state.pins = list(state.pins);
  state.strings = list(state.strings);

  if (!ownerId || !local?.state) return result;
  const localState = local.state;
  const itemById = new Map(state.items.map(item => [item.id, item]));
  const ownedItems = [];

  for (const source of list(localState.items)) {
    if (source?.by !== ownerId) continue;
    const current = itemById.get(source.id);
    // Never replace a published/master-owned clue with a local object sharing its ID.
    if (current && current.by !== ownerId) continue;
    const item = clone(source);
    if (item.parent && !itemById.has(item.parent)) item.parent = null;
    for (const relation of ['in', 'box', 'inside']) {
      if (item[relation] && !itemById.has(item[relation])) delete item[relation];
    }
    if (current) {
      state.items[state.items.findIndex(candidate => candidate.id === item.id)] = item;
    } else {
      state.items.push(item);
    }
    itemById.set(item.id, item);
    ownedItems.push(item);
  }

  const pinById = new Map(state.pins.map(pin => [pin.id, pin]));
  for (const source of list(localState.pins)) {
    if (source?.by !== ownerId) continue;
    const current = pinById.get(source.id);
    if (current && current.by !== ownerId) continue;
    // Don't resurrect a pin attached to a clue that the latest publication removed.
    if (source.item && !itemById.has(source.item)) continue;
    const pin = clone(source);
    if (current) {
      state.pins[state.pins.findIndex(candidate => candidate.id === pin.id)] = pin;
    } else {
      state.pins.push(pin);
    }
    pinById.set(pin.id, pin);
  }

  const stringById = new Map(state.strings.map(string => [string.id, string]));
  for (const source of list(localState.strings)) {
    if (source?.by !== ownerId || !pinById.has(source.a) || !pinById.has(source.b)) continue;
    const current = stringById.get(source.id);
    if (current && current.by !== ownerId) continue;
    const connection = clone(source);
    if (current) {
      state.strings[state.strings.findIndex(candidate => candidate.id === connection.id)] = connection;
    } else {
      state.strings.push(connection);
    }
    stringById.set(connection.id, connection);
  }

  // Preserve only assets referenced by this player's own annotations, not stale/private
  // assets that may be present in an older local snapshot.
  for (const item of ownedItems) {
    for (const key of ['imgId', 'audioId']) {
      const id = item[key];
      if (id && local.imgs?.[id]) result.imgs[id] = local.imgs[id];
    }
  }

  // Camera and personal drawing preferences are local; world lighting and scene FX remain
  // authoritative to the published board and can never be inherited from the viewer.
  if (localState.cam) state.cam = clone(localState.cam);
  for (const key of ['ui', 'pinColor', 'pinSize', 'ropeColor', 'markColor', 'sound', 'vol', 'tapeStyle']) {
    if (localState[key] !== undefined) state[key] = clone(localState[key]);
  }
  state.z = Math.max(Number(state.z) || 0, Number(localState.z) || 0);
  return result;
}
