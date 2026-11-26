// Ironwood Air Base: a 3 km runway on farmland plains with distant ranges, a taxiway and apron,
// arched hangars, a control tower, a rotating radar, fuel farm, support trucks and parked jets.
// It is also the stage of the cinematic intro.
import { createNoise2D } from '../noise.js';
import { flattenRect } from '../terrain.js';
import { createForest } from '../vegetation.js';
import { createApron, createFuelTanks, createHangar, createLightPoles, createRadar, createTower, createVehicle, createWindsock } from '../structures.js';
import { createTaxiway } from '../runway.js';
import { buildModel } from '../../aircraft/aircraft.js';
import { hash2, mixInto, sstep, toward } from './palette.js';

const noise = createNoise2D(303);
const ELEV = 140;
const RWY = { cx: 0, cz: 0, headingDeg: 270, length: 3000, width: 45, elevation: ELEV };
const BASE = { cx: 0, cz: 260, heading: Math.PI / 2, halfLength: 1900, halfWidth: 520, elevation: ELEV, shoulder: 600 };

function rawHeight(x, z) {
  const r = Math.hypot(x, z);
  const plains = ELEV - 10 + noise.fbm(x / 3000, z / 3000, 4) * 70 + noise.fbm(x / 600, z / 600, 2) * 6;
  const ranges = sstep(6500, 12000, r + noise.fbm(x / 2500, z / 2500, 2) * 2500) * noise.ridged(x / 4200, z / 4200, 6) * 2300;
  return plains + ranges;
}
const height = (x, z) => flattenRect(rawHeight(x, z), x, z, BASE);

function color(x, z, h, slope, c) {
  // patchwork farmland: fields in rotated 380 m cells, each with its own crop colour
  const a = 0.35;
  const u = (x * Math.cos(a) - z * Math.sin(a)) / 380;
  const v = (x * Math.sin(a) + z * Math.cos(a)) / 260;
  const f = hash2(Math.floor(u), Math.floor(v));
  const crops = ['#6c8a3a', '#8a9a45', '#a59b5a', '#5d7d36', '#7f8f3e', '#b7a865'];
  mixInto(c, crops[Math.floor(f * crops.length)], '#4f6e2e', noise.noise(x / 200, z / 200) * 0.3 + 0.2);
  const edge = Math.min(Math.abs(u - Math.round(u)), Math.abs(v - Math.round(v)));
  toward(c, '#3f5a28', sstep(0.04, 0.0, edge) * 0.7);
  toward(c, '#7b8a52', sstep(1500, 900, Math.abs(x)) * sstep(900, 500, Math.abs(z - 250)));
  toward(c, '#2f4d2a', sstep(260, 450, h) * (1 - sstep(1400, 1700, h)));
  toward(c, '#6f6c64', sstep(1300, 1800, h) + sstep(0.35, 0.6, slope));
  toward(c, '#f1f3f5', sstep(1900, 2200, h) * (1 - sstep(0.6, 0.8, slope)));
  return c;
}

export const militaryAirbase = {
  name: 'Ironwood Air Base',
  description: 'Military airfield on farmland plains',
  seed: 303,
  size: 26000,
  segments: 340,
  minimapBase: 100,
  minimapRange: 1800,
  cloudBase: 2000,
  height,
  color,
  runways: [RWY],
  elevation: ELEV,
  build({ scene, terrain, runways }) {
    const rwy = runways[0];
    // taxiway parallel to the runway and two links
    createTaxiway(scene, { x: -1500, z: 190 }, { x: 1500, z: 190 }, ELEV);
    for (const x of [-1450, 0, 1450]) createTaxiway(scene, { x, z: 22 }, { x, z: 190 }, ELEV, 20);
    createApron(scene, { x: 0, z: 330, y: ELEV, width: 900, depth: 230 });
    const hangars = [];
    for (let i = 0; i < 4; i += 1) hangars.push(createHangar(scene, { x: -330 + i * 140, z: 480, y: ELEV, rotation: Math.PI, width: 70, depth: 60, height: 20, color: i % 2 ? '#7d8890' : '#6f7b83' }));
    const tower = createTower(scene, { x: 330, z: 380, y: ELEV, height: 36 });
    const radar = createRadar(scene, { x: 520, z: 520, y: ELEV });
    createFuelTanks(scene, { x: -620, z: 520, y: ELEV });
    createLightPoles(scene, [-420, -210, 0, 210, 420].map((x) => ({ x, z: 222 })), ELEV);
    const sock = createWindsock(scene, { x: 1300, z: -60, y: ELEV });
    createVehicle(scene, { x: 40, z: 300, y: ELEV, kind: 'fuel', rotation: 0.6 });
    createVehicle(scene, { x: -150, z: 360, y: ELEV, kind: 'tug', rotation: -0.3 });
    createVehicle(scene, { x: 260, z: 450, y: ELEV, kind: 'fire', rotation: Math.PI });
    // parked jets on the apron, noses to the taxiway
    const parked = [];
    for (const [x, z] of [[-260, 340], [-160, 340], [160, 340], [260, 340]]) {
      const m = buildModel('fighter');
      m.group.position.set(x, ELEV + m.gearHeight, z);
      m.update({ aileron: 0, elevator: 0, rudder: 0, flaps: 0, gear: 1, power: 0, afterburner: 0, rpm: 0, time: 0, wheelRoll: 0 });
      scene.add(m.group);
      parked.push(m);
    }
    createForest(scene, terrain, {
      kinds: ['broadleaf', 'conifer'],
      count: 5000,
      radius: 12000,
      seed: 31,
      accept: (x, z, h) => !(Math.abs(x) < 2100 && z > -400 && z < 900) && h < 1500,
      cluster: (x, z) => noise.fbm(x / 900, z / 900, 3) * 1.6 - 0.1,
    });
    const time0 = { t: 0 };
    return {
      hangars,
      tower,
      parked,
      apronY: ELEV,
      update(dt, time, wind) {
        time0.t = time;
        radar.update(dt);
        sock.update(time, wind);
        tower.beacon.visible = time % 1.5 < 0.75;
      },
      surfaceAt: (x, z) => (Math.abs(x) < 1000 && z > 150 && z < 450 ? 'runway' : 'grass'),
    };
  },
};

