const key = 'cris:audio:output';
export const defaultOutput = 1.45;
const bounded = (value, max) => Math.max(0, Math.min(max, value));
export function readOutput(storage) {
  try {
    const value = (storage ?? globalThis.localStorage)?.getItem(key);
    if (value != null && Number.isFinite(Number(value))) return bounded(Number(value), 2);
  } catch {}
  return defaultOutput;
}
export function saveOutput(value, storage) {
  const level = Number.isFinite(value) ? bounded(value, 2) : defaultOutput;
  try { (storage ?? globalThis.localStorage)?.setItem(key, String(level)); } catch {}
  return level;
}

const outputs = new WeakMap();
const mediaRoutes = new WeakMap();
export function limitedOutput(context) {
  if (outputs.has(context)) return outputs.get(context);
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 3;
  limiter.ratio.value = 14;
  limiter.attack.value = .003;
  limiter.release.value = .16;
  limiter.connect(context.destination);
  outputs.set(context, limiter);
  return limiter;
}

export function setMediaOutput(media, level) {
  const route = mediaRoutes.get(media);
  const gain = bounded(level, 2);
  if (route) route.gain.setTargetAtTime(gain, route.context.currentTime, .018);
  else media.volume = bounded(gain, 1);
  media.muted = gain === 0;
}

let pageContext;
export function playCrisMedia(media, level = readOutput(), context) {
  const src = media.currentSrc || media.src;
  if (src && !mediaRoutes.has(media)) {
    try {
      const url = new URL(src, location.href);
      if (url.origin === location.origin || ['data:', 'blob:'].includes(url.protocol)) {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        context ||= pageContext ||= new AudioContext();
        const gain = context.createGain();
        context.createMediaElementSource(media).connect(gain);
        gain.connect(limitedOutput(context));
        mediaRoutes.set(media, {context, gain:gain.gain});
      }
    } catch { /* Media element volume is the fallback on unsupported devices. */ }
  }
  const audioContext = mediaRoutes.get(media)?.context;
  if (audioContext && audioContext.state !== 'running') audioContext.resume().catch(() => {});
  setMediaOutput(media, level);
  return media.play();
}
