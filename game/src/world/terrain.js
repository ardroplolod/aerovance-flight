// Heightfield terrain in two levels of detail: a fine inner mesh where the flying happens and a
// coarse outer ring out to the horizon (sunk a few metres so the two never fight). Each vertex is
// coloured by height and slope (sand, grass, forest, rock, snow) and a tiled grain map adds detail.
import * as THREE from 'three';
import { canvasTexture } from '../core/geometry.js';
import { createRandom } from '../core/random.js';

function detailTexture(seed) {
  const rand = createRandom(seed);
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const i = (y * w + x) * 4;
          const v = 205 + (rand.next() - 0.5) * 70 + Math.sin(x * 0.09) * 4 + Math.sin(y * 0.07 + x * 0.02) * 4;
          img.data[i] = v;
          img.data[i + 1] = v;
          img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      // soft blotches, so the tiling does not read as a grid
      for (let k = 0; k < 90; k += 1) {
        const x = rand.next() * w;
        const y = rand.next() * h;
        const r = 10 + rand.next() * 50;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const tone = rand.next() > 0.5 ? '255,255,255' : '120,120,120';
        g.addColorStop(0, `rgba(${tone},0.18)`);
        g.addColorStop(1, `rgba(${tone},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    },
    { anisotropy: 16 },
  );
}

function buildGrid(size, segments, heightFn, colorFn, centerX, centerZ, sink) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  const n = segments + 1;
  const heights = new Float32Array(n * n);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) + centerX;
    const z = pos.getZ(i) + centerZ;
    const h = heightFn(x, z);
    heights[i] = h;
    pos.setXYZ(i, x, h - sink, z);
  }
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const slope = 1 - normals.getY(i);
    colorFn(pos.getX(i), pos.getZ(i), heights[i], slope, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return { geometry, heights, n };
}

export function createTerrain(scene, { heightFn, colorFn, size = 24000, segments = 320, outerSize = 90000, outerSegments = 140, seed = 3 }) {
  const detail = detailTexture(seed);
  detail.wrapS = THREE.RepeatWrapping;
  detail.wrapT = THREE.RepeatWrapping;
  detail.repeat.set(size / 90, size / 90);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.95, metalness: 0 });
  const inner = buildGrid(size, segments, heightFn, colorFn, 0, 0, 0);
  const mesh = new THREE.Mesh(inner.geometry, material);
  mesh.receiveShadow = true;
  scene.add(mesh);

  const farDetail = detail.clone();
  farDetail.repeat.set(outerSize / 400, outerSize / 400);
  const farMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, map: farDetail, roughness: 1, metalness: 0 });
  const outer = buildGrid(outerSize, outerSegments, heightFn, colorFn, 0, 0, 6);
  const farMesh = new THREE.Mesh(outer.geometry, farMaterial);
  scene.add(farMesh);

  const half = size / 2;
  const step = size / segments;
  const { heights, n } = inner;
  /** Ground height under (x, z): bilinear on the fine grid, the analytic field beyond it. */
  function heightAt(x, z) {
    const gx = (x + half) / step;
    const gz = (z + half) / step;
    if (gx < 0 || gz < 0 || gx >= n - 1 || gz >= n - 1) return heightFn(x, z);
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const h00 = heights[iz * n + ix];
    const h10 = heights[iz * n + ix + 1];
    const h01 = heights[(iz + 1) * n + ix];
    const h11 = heights[(iz + 1) * n + ix + 1];
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
  }
  return { mesh, farMesh, heightAt, size };
}

/** Blend a height field toward a flat pad (a runway, an apron) with a smooth shoulder. */
export function flattenRect(h, x, z, rect) {
  const { cx, cz, heading, halfLength, halfWidth, elevation, shoulder } = rect;
  const s = Math.sin(heading);
  const c = Math.cos(heading);
  const dx = x - cx;
  const dz = z - cz;
  const along = dx * s - dz * c;
  const across = dx * c + dz * s;
  const ox = Math.max(0, Math.abs(along) - halfLength);
  const oz = Math.max(0, Math.abs(across) - halfWidth);
  const d = Math.sqrt(ox * ox + oz * oz);
  if (d >= shoulder) return h;
  const t = d / shoulder;
  const k = t * t * (3 - 2 * t);
  return elevation + (h - elevation) * k;
}
