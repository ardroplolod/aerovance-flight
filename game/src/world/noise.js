// Seeded 2D gradient noise with fractal sums: the shape of every mountain, island and field.
import { createRandom } from '../core/random.js';

export function createNoise2D(seed) {
  const rand = createRandom(seed);
  const perm = new Uint16Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand.next() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];
  const gx = new Float32Array(256);
  const gy = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const a = rand.next() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const dot = (h, dx, dy) => gx[h] * dx + gy[h] * dy;
    const h00 = perm[X + perm[Y]];
    const h10 = perm[X + 1 + perm[Y]];
    const h01 = perm[X + perm[Y + 1]];
    const h11 = perm[X + 1 + perm[Y + 1]];
    const u = fade(xf);
    const v = fade(yf);
    const a = dot(h00, xf, yf) + u * (dot(h10, xf - 1, yf) - dot(h00, xf, yf));
    const b = dot(h01, xf, yf - 1) + u * (dot(h11, xf - 1, yf - 1) - dot(h01, xf, yf - 1));
    return (a + v * (b - a)) * 1.414;
  }
  function fbm(x, y, octaves = 5, lacunarity = 2, gain = 0.5) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i += 1) {
      sum += noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
  function ridged(x, y, octaves = 5) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let prev = 1;
    for (let i = 0; i < octaves; i += 1) {
      let n = 1 - Math.abs(noise(x * freq, y * freq));
      n *= n;
      sum += n * amp * prev;
      prev = n;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum;
  }
  return { noise, fbm, ridged };
}
