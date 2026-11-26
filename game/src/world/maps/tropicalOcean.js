// Coral Archipelago: a turquoise sea with a chain of jungle islands, a volcanic peak, white beaches,
// palm groves, anchored boats, a lighthouse and a coastal runway on the main island.
import * as THREE from 'three';
import { createNoise2D } from '../noise.js';
import { flattenRect } from '../terrain.js';
import { createForest } from '../vegetation.js';
import { createHangar, createTower, createWindsock, createApron, createVehicle } from '../structures.js';
import { createBoats, createLighthouse } from '../ships.js';
import { mixInto, sstep, toward } from './palette.js';

const noise = createNoise2D(202);
const ISLANDS = [
  { x: 0, z: 0, r: 3600, peak: 520 },
  { x: 7200, z: -5200, r: 2300, peak: 1150 },
  { x: -6400, z: -3800, r: 1500, peak: 260 },
  { x: -4200, z: 5600, r: 1200, peak: 180 },
  { x: 5200, z: 5200, r: 900, peak: 120 },
  { x: -9000, z: -9500, r: 1900, peak: 420 },
  { x: 10500, z: 4200, r: 1300, peak: 300 },
];

function rawHeight(x, z) {
  let h = -55 + noise.fbm(x / 6000, z / 6000, 3) * 25;
  for (const is of ISLANDS) {
    const dx = x - is.x;
    const dz = z - is.z;
    const warp = 1 + noise.fbm(dx / 1400 + is.x, dz / 1400, 3) * 0.35;
    const d = Math.sqrt(dx * dx + dz * dz) / (is.r * warp);
    if (d > 1.6) continue;
    const s = 1 - d;
    const land = s > 0 ? 4 + 32 * s + Math.pow(Math.max(0, s - 0.45), 1.6) * is.peak * 2.2 + noise.ridged(dx / 700, dz / 700, 4) * 60 * s : -6 + s * 30;
    h = Math.max(h, land);
  }
  return h;
}

const RWY = { cx: -200, cz: 2200, headingDeg: 82, length: 2200, width: 42 };
RWY.elevation = 14;
const RECT = { cx: RWY.cx, cz: RWY.cz, heading: (RWY.headingDeg * Math.PI) / 180, halfLength: RWY.length / 2 + 100, halfWidth: 150, elevation: RWY.elevation, shoulder: 300 };
const height = (x, z) => flattenRect(rawHeight(x, z), x, z, RECT);

function color(x, z, h, slope, c) {
  const n = noise.noise(x / 250, z / 250);
  if (h < 1.5) return mixInto(c, '#3fa7a4', '#e9dcb4', sstep(-6, 1.5, h));
  mixInto(c, '#4e8a2c', '#2f6b2a', 0.5 + n * 0.5);
  toward(c, '#efe2bd', sstep(7, 3, h));
  toward(c, '#1f4f24', sstep(40, 120, h) * (1 - sstep(500, 800, h)));
  toward(c, '#5a5048', sstep(650, 950, h) + sstep(0.4, 0.7, slope));
  toward(c, '#3a3633', sstep(1050, 1200, h));
  return c;
}

export const tropicalOcean = {
  name: 'Coral Archipelago',
  description: 'Jungle islands, volcano, reef lagoons',
  seed: 202,
  size: 30000,
  segments: 360,
  waterLevel: 0,
  minimapRange: 900,
  cloudBase: 1500,
  height,
  color,
  runways: [RWY],
  islands: ISLANDS,
  build({ scene, terrain, runways }) {
    const rwy = runways[0];
    const onPad = (x, z) => {
      const l = rwy.toLocal(new THREE.Vector3(x, 0, z));
      return l.along > -200 && l.along < rwy.length + 200 && Math.abs(l.across) < 160;
    };
    createForest(scene, terrain, {
      kinds: ['palm'],
      count: 5000,
      radius: 13000,
      seed: 12,
      accept: (x, z, h) => h > 2.5 && h < 90 && !onPad(x, z),
      cluster: (x, z) => 0.3 + noise.fbm(x / 500, z / 500, 2) * 1.4,
    });
    createForest(scene, terrain, {
      kinds: ['broadleaf'],
      count: 6000,
      radius: 13000,
      seed: 13,
      accept: (x, z, h) => h > 30 && h < 700 && !onPad(x, z),
    });
    const rot = -RECT.heading + Math.PI / 2;
    const ap = rwy.pointAt(rwy.length * 0.5, 120, 0);
    createApron(scene, { x: ap.x, z: ap.z, y: rwy.elevation, width: 200, depth: 90, rotation: rot });
    const hp = rwy.pointAt(rwy.length * 0.45, 165, 0);
    createHangar(scene, { x: hp.x, z: hp.z, y: rwy.elevation, rotation: rot + Math.PI, width: 44, depth: 36, height: 13, color: '#c9c3b2' });
    const tp = rwy.pointAt(rwy.length * 0.62, 150, 0);
    createTower(scene, { x: tp.x, z: tp.z, y: rwy.elevation, height: 22 });
    const vp = rwy.pointAt(rwy.length * 0.55, 100, 0);
    createVehicle(scene, { x: vp.x, z: vp.z, y: rwy.elevation, kind: 'fire', rotation: rot });
    const sp = rwy.pointAt(150, -40, 0);
    const sock = createWindsock(scene, { x: sp.x, z: sp.z, y: rwy.elevation });
    const boats = createBoats(scene, { seed: 4, count: 14, radius: 9000, avoid: (x, z) => terrain.heightAt(x, z) > -8 });
    const lighthouse = createLighthouse(scene, { x: -3500, z: 1500, y: Math.max(0, terrain.heightAt(-3500, 1500)) });
    return {
      update: (dt, time, wind) => {
        sock.update(time, wind);
        boats.update(dt, time);
        lighthouse.update(time);
      },
      surfaceAt: (x, z) => (terrain.heightAt(x, z) < 5 ? 'sand' : 'grass'),
    };
  },
};
