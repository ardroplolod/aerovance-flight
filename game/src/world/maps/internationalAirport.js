// Port Meridian International: twin parallel runways on a coastal plain, a glass terminal with jet
// bridges and parked airliners, a control tower, taxiways and a city skyline along the bay.
import { createNoise2D } from '../noise.js';
import { flattenRect } from '../terrain.js';
import { createForest } from '../vegetation.js';
import { createApron, createCity, createLightPoles, createTerminal, createTower, createVehicle, createWindsock } from '../structures.js';
import { createTaxiway } from '../runway.js';
import { buildModel } from '../../aircraft/aircraft.js';
import { createBoats } from '../ships.js';
import { mixInto, sstep, toward, hash2 } from './palette.js';

const noise = createNoise2D(505);
const ELEV = 12;
const HDG = 80;
const h = (HDG * Math.PI) / 180;
const fwd = { x: Math.sin(h), z: -Math.cos(h) };
const right = { x: Math.cos(h), z: Math.sin(h) };
const RWY_L = { cx: -right.x * 450, cz: -right.z * 450, headingDeg: HDG, length: 3600, width: 50, elevation: ELEV };
const RWY_R = { cx: right.x * 450, cz: right.z * 450, headingDeg: HDG, length: 3200, width: 45, elevation: ELEV };
const PAD = { cx: 0, cz: 0, heading: h, halfLength: 2300, halfWidth: 800, elevation: ELEV, shoulder: 700 };

function rawHeight(x, z) {
  const coast = z - 5200 + noise.fbm(x / 3000, z / 3000, 3) * 1400;
  let base = ELEV - 2 + noise.fbm(x / 2500, z / 2500, 4) * 18;
  base += sstep(-4000, -10000, z) * noise.ridged(x / 3600, z / 3600, 5) * 1400;
  if (coast > 0) base = Math.min(base, ELEV - 2 - coast * 0.05);
  return base;
}
const height = (x, z) => flattenRect(rawHeight(x, z), x, z, PAD);

function color(x, z, hh, slope, c) {
  if (hh < 1) return mixInto(c, '#2a6d80', '#cfc3a0', sstep(-10, 1, hh));
  const f = hash2(Math.floor(x / 420), Math.floor(z / 300));
  mixInto(c, f > 0.5 ? '#6d8a45' : '#86934f', '#56733a', noise.noise(x / 180, z / 180) * 0.4 + 0.3);
  toward(c, '#d9cfaa', sstep(4, 1, hh));
  toward(c, '#7d8466', sstep(2600, 1800, Math.hypot(x - 5600, z + 3600)));
  toward(c, '#2e4d2b', sstep(200, 420, hh));
  toward(c, '#6b675f', sstep(800, 1200, hh) + sstep(0.38, 0.6, slope));
  return c;
}

export const internationalAirport = {
  name: 'Port Meridian International',
  description: 'Twin runways, terminal, coastal city',
  seed: 505,
  size: 28000,
  segments: 340,
  waterLevel: 0,
  minimapRange: 600,
  cloudBase: 1900,
  height,
  color,
  runways: [RWY_L, RWY_R],
  build({ scene, terrain, runways }) {
    const rot = -h + Math.PI / 2;
    const at = (along, across) => ({ x: fwd.x * along + right.x * across, z: fwd.z * along + right.z * across });
    const t1 = at(-1700, -380);
    const t2 = at(1700, -380);
    createTaxiway(scene, t1, t2, ELEV, 24);
    const t3 = at(-1500, 380);
    const t4 = at(1500, 380);
    createTaxiway(scene, t3, t4, ELEV, 24);
    for (const a of [-1600, -500, 500, 1600]) createTaxiway(scene, at(a, -420), at(a, 420), ELEV, 22);
    const term = at(0, 0);
    createApron(scene, { x: term.x, z: term.z, y: ELEV, width: 1700, depth: 300, rotation: rot });
    createTerminal(scene, { x: term.x - right.x * 40, z: term.z - right.z * 40, y: ELEV, rotation: -h, length: 700 });
    const tw = at(500, 200);
    const tower = createTower(scene, { x: tw.x, z: tw.z, y: ELEV, height: 62 });
    createLightPoles(scene, [-600, -300, 0, 300, 600].map((a) => at(a, 120)), ELEV);
    for (const [a, side] of [[-260, 1], [-60, 1], [140, 1], [-200, -1], [60, -1]]) {
      const m = buildModel('airliner');
      const p = at(a, side * 75 - 40);
      m.group.position.set(p.x, ELEV + m.gearHeight, p.z);
      m.group.rotation.y = rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI;
      m.update({ aileron: 0, elevator: 0, rudder: 0, flaps: 0, gear: 1, power: 0, afterburner: 0, rpm: 0, time: 0, wheelRoll: 0 });
      scene.add(m.group);
    }
    for (let i = 0; i < 6; i += 1) {
      const p = at(-500 + i * 170, 90 - (i % 2) * 140);
      createVehicle(scene, { x: p.x, z: p.z, y: ELEV, kind: i % 3 === 0 ? 'fuel' : 'tug', rotation: rot + i });
    }
    const sp = at(-1600, 520);
    const sock = createWindsock(scene, { x: sp.x, z: sp.z, y: ELEV });
    const inPad = (x, z) => {
      const along = x * fwd.x + z * fwd.z;
      const across = x * right.x + z * right.z;
      return Math.abs(along) < 2500 && Math.abs(across) < 900;
    };
    createCity(scene, terrain, { cx: 5600, cz: -3600, radius: 2600, count: 320, seed: 7, avoid: (x, z) => terrain.heightAt(x, z) < 2 || inPad(x, z) });
    createCity(scene, terrain, { cx: -5200, cz: 3000, radius: 1500, count: 120, seed: 8, avoid: (x, z) => terrain.heightAt(x, z) < 2 || inPad(x, z) });
    createForest(scene, terrain, {
      kinds: ['broadleaf'],
      count: 4500,
      radius: 12000,
      seed: 41,
      accept: (x, z, hh) => hh > 2 && hh < 900 && !inPad(x, z) && Math.hypot(x - 5600, z + 3600) > 2700,
      cluster: (x, z) => noise.fbm(x / 800, z / 800, 3) * 1.5,
    });
    const boats = createBoats(scene, { seed: 9, count: 10, radius: 11000, avoid: (x, z) => terrain.heightAt(x, z) > -6 });
    return {
      tower,
      update(dt, time, wind) {
        sock.update(time, wind);
        boats.update(dt, time);
        tower.beacon.visible = time % 1.5 < 0.75;
      },
    };
  },
};
