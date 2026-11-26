// Task Force Meridian: open ocean, a carrier steaming into the wind with two escorts, and a far
// rocky island on the horizon for orientation.
import { createNoise2D } from '../noise.js';
import { carrierRunwaySpec, createCarrier, createDestroyer } from '../ships.js';
import { mixInto, sstep, toward } from './palette.js';

const noise = createNoise2D(404);

function height(x, z) {
  let h = -180 + noise.fbm(x / 8000, z / 8000, 3) * 40;
  const dx = x - 9500;
  const dz = z + 9000;
  const d = Math.sqrt(dx * dx + dz * dz) / (2400 * (1 + noise.fbm(dx / 1200, dz / 1200, 3) * 0.3));
  if (d < 1.4) h = Math.max(h, (1 - d) * 60 + Math.pow(Math.max(0, 1 - d - 0.3), 1.5) * 900 + noise.ridged(dx / 600, dz / 600, 4) * 80 * Math.max(0, 1 - d));
  return h;
}

function color(x, z, h, slope, c) {
  if (h < 1) return mixInto(c, '#215e72', '#d8cfb0', sstep(-8, 1, h));
  mixInto(c, '#55612f', '#6c6656', sstep(40, 300, h));
  toward(c, '#4f4a44', sstep(0.35, 0.6, slope));
  return c;
}

export const carrierGroup = {
  name: 'Task Force Meridian',
  description: 'Blue water carrier operations',
  seed: 404,
  size: 30000,
  segments: 200,
  waterLevel: 0,
  minimapRange: 600,
  cloudBase: 1300,
  height,
  color,
  runways: [],
  previewRunways: () => [carrierRunwaySpec(0, 0)],
  build({ scene }) {
    const carrier = createCarrier(scene, { x: 0, z: 0 });
    createDestroyer(scene, { x: 900, z: -1400, heading: 0 });
    createDestroyer(scene, { x: -1100, z: 1200, heading: 0 });
    return {
      carrier,
      decks: [carrier.deck],
      extraRunways: [carrier.runway],
      surfaceAt: () => 'water',
    };
  },
};
