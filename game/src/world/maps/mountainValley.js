// Highland Valley: a glacial valley between 2,400 m ridges with conifer slopes, snowfields, a river
// winding down the floor and a short mountain airstrip beside it.
import * as THREE from 'three';
import { createNoise2D } from '../noise.js';
import { flattenRect } from '../terrain.js';
import { createForest } from '../vegetation.js';
import { createHangar, createTower, createWindsock, createApron, createVehicle } from '../structures.js';
import { mixInto, sstep, toward } from './palette.js';

const noise = createNoise2D(101);
const WATER = 304;
export const valleyCenter = (z) => 900 * Math.sin(z / 7000 + 0.3) + 220 * Math.sin(z / 2300 + 1.1);

function rawHeight(x, z) {
  const d = Math.abs(x - valleyCenter(z));
  const floor = 332 + noise.fbm(x / 2200, z / 2200, 3) * 22;
  const ridge = noise.ridged(x / 5200 + 3, z / 5200 - 2, 6);
  const mountains = 380 + ridge * 2600 + noise.fbm(x / 900, z / 900, 4) * 90;
  const t = sstep(700, 3600, d + noise.fbm(x / 1800, z / 1800, 2) * 450);
  let h = floor * (1 - t) + mountains * t;
  if (d < 90) h = Math.min(h, 297 + (h - 297) * sstep(28, 90, d));
  return h;
}

// runway beside the river, aligned with the valley's chord so the straight-in final stays on the floor
const south = { x: valleyCenter(5200), z: 5200 };
const north = { x: valleyCenter(-2600), z: -2600 };
const headingRad = Math.atan2(north.x - south.x, -(north.z - south.z));
const perp = { x: Math.cos(headingRad), z: Math.sin(headingRad) };
const RWY = { cx: valleyCenter(0) + perp.x * 300, cz: perp.z * 300, headingDeg: (headingRad * 180) / Math.PI, length: 2400, width: 40 };
RWY.elevation = Math.round(rawHeight(RWY.cx, RWY.cz) + 2);
const RECT = { cx: RWY.cx, cz: RWY.cz, heading: headingRad, halfLength: RWY.length / 2 + 120, halfWidth: 140, elevation: RWY.elevation, shoulder: 260 };

function height(x, z) {
  return flattenRect(rawHeight(x, z), x, z, RECT);
}

function color(x, z, h, slope, c) {
  const n = noise.noise(x / 300, z / 300);
  const m = noise.fbm(x / 1400, z / 1400, 3);
  mixInto(c, '#6a8a3c', '#3d6a2c', 0.5 + n * 0.5);
  toward(c, '#9a9a52', sstep(0.15, 0.45, m) * 0.55);
  toward(c, '#2f5a2a', sstep(-0.1, -0.4, m) * 0.6);
  toward(c, '#24452a', sstep(380, 520, h) * (1 - sstep(1500, 1800, h)));
  toward(c, '#6d6a62', sstep(1500, 1900, h) + sstep(0.32, 0.55, slope));
  toward(c, '#8a857c', sstep(0.55, 0.8, slope));
  toward(c, '#f4f6f8', sstep(1950, 2250, h + n * 120) * (1 - sstep(0.55, 0.75, slope)));
  toward(c, '#9c9273', sstep(318, 300, h));
  return c;
}

export const mountainValley = {
  name: 'Highland Valley',
  description: 'Glacial valley, 2,400 m ridges, river airstrip',
  seed: 101,
  size: 32000,
  segments: 420,
  waterLevel: WATER,
  minimapBase: WATER,
  minimapRange: 2200,
  cloudBase: 2600,
  height,
  color,
  runways: [RWY],
  center: valleyCenter,
  build({ scene, terrain, runways }) {
    const rwy = runways[0];
    const onPad = (x, z) => {
      const l = rwy.toLocal(new THREE.Vector3(x, 0, z));
      return l.along > -300 && l.along < rwy.length + 300 && Math.abs(l.across) < 170;
    };
    createForest(scene, terrain, {
      kinds: ['conifer'],
      count: 9000,
      radius: 12000,
      seed: 5,
      accept: (x, z, h) => h > WATER + 25 && h < 1700 && !onPad(x, z),
      cluster: (x, z) => 0.35 + noise.fbm(x / 1500, z / 1500, 3) * 1.2,
    });
    createForest(scene, terrain, {
      kinds: ['broadleaf'],
      count: 1800,
      radius: 9000,
      seed: 9,
      accept: (x, z, h) => h > WATER + 8 && h < 420 && !onPad(x, z),
      cluster: (x, z) => 0.2 + noise.fbm(x / 600, z / 600, 2),
    });
    const apron = rwy.pointAt(rwy.length * 0.55, -110, 0);
    createApron(scene, { x: apron.x, z: apron.z, y: rwy.elevation, width: 160, depth: 90, rotation: -rwy.headingDeg * (Math.PI / 180) + Math.PI / 2 });
    const hangarPos = rwy.pointAt(rwy.length * 0.55, -150, 0);
    createHangar(scene, { x: hangarPos.x, z: hangarPos.z, y: rwy.elevation, rotation: -rwy.headingDeg * (Math.PI / 180) + Math.PI / 2, width: 40, depth: 34, height: 12, color: '#6f7a70' });
    const towerPos = rwy.pointAt(rwy.length * 0.4, -130, 0);
    createTower(scene, { x: towerPos.x, z: towerPos.z, y: rwy.elevation, height: 18 });
    const fuel = rwy.pointAt(rwy.length * 0.62, -95, 0);
    createVehicle(scene, { x: fuel.x, z: fuel.z, y: rwy.elevation, kind: 'fuel', rotation: 0.7 });
    const sockPos = rwy.pointAt(200, 50, 0);
    const sock = createWindsock(scene, { x: sockPos.x, z: sockPos.z, y: rwy.elevation });
    return {
      update: (dt, time, wind) => sock.update(time, wind),
      surfaceAt: (x, z) => (terrain.heightAt(x, z) > 1500 ? 'rock' : 'grass'),
    };
  },
};
