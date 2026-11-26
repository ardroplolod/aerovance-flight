// Ground colour ramps shared by the maps: blend named swatches by height, slope and noise.
import * as THREE from 'three';

const cache = new Map();
export function swatch(hex) {
  if (!cache.has(hex)) cache.set(hex, new THREE.Color(hex));
  return cache.get(hex);
}

/** Mix two swatches into `out` (t in 0..1). */
export function mixInto(out, a, b, t) {
  const ca = swatch(a);
  const cb = swatch(b);
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  out.setRGB(ca.r + (cb.r - ca.r) * k, ca.g + (cb.g - ca.g) * k, ca.b + (cb.b - ca.b) * k);
  return out;
}

/** Blend `out` toward a swatch by t. */
export function toward(out, hex, t) {
  const c = swatch(hex);
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  out.r += (c.r - out.r) * k;
  out.g += (c.g - out.g) * k;
  out.b += (c.b - out.b) * k;
  return out;
}

export const sstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Cheap hash for field patchworks. */
export function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
