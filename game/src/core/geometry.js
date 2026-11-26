// Geometry helpers: merging parts into one draw call, painting vertex colours, and canvas textures.
import * as THREE from 'three';

/** Merge non-indexed or indexed BufferGeometries (position, normal, uv, color) into one. */
export function mergeGeometries(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of parts) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const col = new Float32Array(count * 3);
  let o = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    else col.fill(1, o * 3, (o + n) * 3);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

/** Paint a whole geometry one colour (as a vertex colour attribute) and return it. */
export function tint(geometry, color) {
  const c = new THREE.Color(color);
  const n = geometry.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geometry;
}

/** Apply a transform to a geometry in place and return it, for building merged props. */
export function place(geometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    typeof s === 'number' ? new THREE.Vector3(s, s, s) : s,
  );
  geometry.applyMatrix4(m);
  return geometry;
}

/** A CanvasTexture painted by `draw(ctx, w, h)`. */
export function canvasTexture(w, h, draw, { repeat = null, srgb = true, anisotropy = 8 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

/** Fill a canvas with fine monochrome grain around a base brightness (used for asphalt, ground detail). */
export function grain(ctx, w, h, base, spread, rand = Math.random) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i += 1) {
    const v = Math.max(0, Math.min(255, base + (rand() - 0.5) * spread));
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function disposeTree(object) {
  object.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const key of ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'alphaMap']) if (m[key]) m[key].dispose();
        m.dispose();
      }
    }
  });
}
