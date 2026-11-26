// Mission and flight-school definitions. Each mission names its map, aircraft, weather and
// briefing; its `setup(env)` turns map geometry (runways, the valley's course, islands) into a
// concrete start position and an ordered list of objectives with real coordinates.
import * as THREE from 'three';
import { DEG } from '../core/math.js';
import { bearingTo } from '../nav/navigation.js';

const FT = 0.3048;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Rings along a polyline of points; each faces the direction of travel. */
function ringsAlong(points, radius = 70) {
  return points.map((p, i) => {
    const prev = points[i - 1] ?? p.clone().sub(points[i + 1].clone().sub(p));
    return { pos: p, dir: p.clone().sub(prev).normalize(), radius };
  });
}

/** A start on a final approach to `runway`, `km` out, on the 3 degree path (+ extra height). */
function onFinal(runway, km, extraFt = 0, gearHeight = 2) {
  const along = -km * 1000;
  const p = runway.pointAt(along, 0, 0);
  p.y = runway.elevation + (300 - along) * Math.tan(3 * DEG) + extraFt * FT + gearHeight;
  return p;
}

function runwayStart(runway, along = 60) {
  return { onGround: true, position: runway.pointAt(along, 0, 0), heading: runway.headingDeg };
}

export const MISSIONS = [
  {
    id: 'first-takeoff',
    code: '01',
    title: 'FIRST TAKEOFF',
    map: 'airbase',
    aircraft: 'light',
    allowed: ['light', 'fighter', 'airliner'],
    difficulty: 'EASY',
    time: 'morning',
    condition: 'clear',
    windDir: 270,
    timeLimit: 900,
    reward: 1200,
    briefing: 'Start-up, line-up and departure from Ironwood runway 27. Climb out, thread the three departure gates, then bring her home and stop on the runway.',
    setup(env) {
      const r = env.runways[0];
      const e = r.elevation;
      const pts = [r.pointAt(r.length + 1800, 0, 300), r.pointAt(r.length + 4200, 600, 420), r.pointAt(r.length + 5200, 2600, 450)];
      return {
        start: runwayStart(r, 40),
        objectives: [
          { type: 'engine', label: 'Start the engine (I)' },
          { type: 'takeoff', label: 'Take off from runway 27' },
          { type: 'altitude', minM: e + 250, label: `Climb above ${Math.round(((e + 250) / FT) / 100) * 100} ft`, hold: 2 },
          { type: 'rings', label: 'Fly the 3 departure gates', rings: ringsAlong(pts, 80) },
          { type: 'land', runway: r, label: 'Land on runway 27 and stop' },
        ],
        constraints: [],
        destination: r,
      };
    },
  },
  {
    id: 'navigation',
    code: '02',
    title: 'NAVIGATION CHALLENGE',
    map: 'airport',
    aircraft: 'light',
    allowed: ['light', 'fighter', 'airliner'],
    difficulty: 'MEDIUM',
    time: 'noon',
    condition: 'cloudy',
    windDir: 200,
    timeLimit: 1200,
    reward: 1800,
    briefing: 'A VFR tour of Port Meridian: four reporting points over the city, the hills and the bay, each to be crossed within 600 m, then a landing on runway 08.',
    setup(env) {
      const r = env.runways[0];
      const wps = [
        { name: 'CITY', pos: v3(5600, 650, -3600) },
        { name: 'RIDGE', pos: v3(1200, 1100, -8200) },
        { name: 'WEST', pos: v3(-7000, 700, -2500) },
        { name: 'BAY', pos: v3(-3500, 450, 6500) },
      ];
      return {
        start: { onGround: false, position: v3(9500, 900, 1800), heading: 320, speed: 55 },
        objectives: [
          ...wps.map((w) => ({ type: 'waypoint', pos: w.pos, radius: 600, name: w.name, label: `Cross ${w.name} reporting point` })),
          { type: 'land', runway: r, label: `Land on runway ${r.name}` },
        ],
        constraints: [{ type: 'minAgl', m: 120, label: 'Stay above 400 ft AGL en route' }],
        destination: r,
      };
    },
  },
  {
    id: 'mountain',
    code: '03',
    title: 'MOUNTAIN APPROACH',
    map: 'valley',
    aircraft: 'fighter',
    allowed: ['fighter', 'light', 'airliner'],
    difficulty: 'HARD',
    time: 'morning',
    condition: 'clear',
    windDir: 330,
    timeLimit: 900,
    reward: 2600,
    briefing: 'Low-level through Highland Valley. Pass all 10 navigation rings along the river, keep at least 300 ft above the ground, then land on the valley strip.',
    setup(env) {
      const r = env.runways[0];
      const center = env.def.center;
      const pts = [];
      for (let i = 0; i < 10; i += 1) {
        const z = 13600 - i * 900;
        const x = center(z);
        const g = env.terrain.heightAt(x, z);
        pts.push(v3(x, Math.max(g, 304) + 170 + (i % 3) * 30, z));
      }
      const start = pts[0].clone().add(v3(0, 120, 1800));
      start.x = center(start.z);
      return {
        start: { onGround: false, position: start, heading: bearingTo(start, pts[0]), speed: 150, throttle: 0.55 },
        objectives: [
          { type: 'rings', label: 'Pass through 10 navigation rings', rings: ringsAlong(pts, 75) },
          { type: 'land', runway: r, label: `Land on runway ${r.name}` },
        ],
        constraints: [{ type: 'minAgl', m: 90, label: 'Maintain safe altitude (300 ft AGL)' }],
        destination: r,
      };
    },
  },
  {
    id: 'checkpoints',
    code: '04',
    title: 'ISLAND CHECKPOINT RUN',
    map: 'tropics',
    aircraft: 'fighter',
    allowed: ['fighter', 'light', 'airliner'],
    difficulty: 'MEDIUM',
    time: 'sunset',
    condition: 'clear',
    windDir: 90,
    timeLimit: 600,
    reward: 2200,
    briefing: 'A timed gate race around the Coral Archipelago: 12 checkpoints over reef, jungle and past the volcano. Every second counts toward your score. Land at Coral Field to finish.',
    setup(env) {
      const r = env.runways[0];
      const route = [
        [3500, 220, 5200], [6500, 300, 2600], [9800, 420, -1400], [10200, 650, -5600], [7200, 900, -8600], [3600, 500, -7600],
        [400, 320, -4400], [-3800, 260, -3200], [-7200, 300, -5600], [-7400, 240, -1000], [-4600, 200, 2600], [-1200, 180, 4800],
      ].map(([x, y, z]) => v3(x, Math.max(y, env.terrain.heightAt(x, z) + 150), z));
      return {
        start: { onGround: false, position: v3(1500, 300, 8200), heading: 30, speed: 160, throttle: 0.6 },
        objectives: [
          { type: 'rings', label: 'Pass all 12 checkpoints', rings: ringsAlong(route, 80), timed: true },
          { type: 'land', runway: r, label: `Land at Coral Field runway ${r.name}` },
        ],
        constraints: [],
        destination: r,
      };
    },
  },
  {
    id: 'precision',
    code: '05',
    title: 'PRECISION LANDING',
    map: 'airport',
    aircraft: 'airliner',
    allowed: ['airliner', 'fighter', 'light'],
    difficulty: 'MEDIUM',
    time: 'sunset',
    condition: 'clear',
    windDir: 60,
    timeLimit: 600,
    reward: 2000,
    briefing: 'Established on a 10 km final for runway 08 at Port Meridian. Fly the glide path, cross the threshold at approach speed, touch down in the touchdown zone on the centreline and stop.',
    setup(env, aircraft) {
      const r = env.runways[0];
      return {
        start: { onGround: false, position: onFinal(r, 10, 200, aircraft.gearHeight), heading: r.headingDeg, speed: aircraft.spec.approachSpeed * 1.15, gear: true, flaps: 2, throttle: 0.45 },
        objectives: [
          { type: 'gate', label: 'Gear down, flaps set by 3 km' },
          { type: 'land', runway: r, label: `Touch down in the TDZ of runway ${r.name}` },
        ],
        constraints: [],
        destination: r,
      };
    },
  },
  {
    id: 'carrier',
    code: '06',
    title: 'CARRIER TRAP',
    map: 'carrier',
    aircraft: 'fighter',
    allowed: ['fighter'],
    difficulty: 'EXPERT',
    time: 'morning',
    condition: 'cloudy',
    windDir: 351,
    timeLimit: 480,
    reward: 3500,
    briefing: 'Recover aboard the carrier. Fly the ball on the angled deck (heading 351), hook down with the gear, and catch one of the four arresting wires. Miss them and you will roll off the deck.',
    setup(env, aircraft) {
      const r = env.runways[0];
      return {
        start: { onGround: false, position: onFinal(r, 5, 150, aircraft.gearHeight), heading: r.headingDeg, speed: 78, gear: true, flaps: 3, throttle: 0.55 },
        objectives: [{ type: 'land', runway: r, deck: true, label: 'Trap aboard: catch a wire' }],
        constraints: [],
        destination: r,
      };
    },
  },
  {
    id: 'emergency',
    code: '07',
    title: 'EMERGENCY LANDING',
    map: 'tropics',
    aircraft: 'light',
    allowed: ['light', 'fighter', 'airliner'],
    difficulty: 'HARD',
    time: 'noon',
    condition: 'cloudy',
    windDir: 82,
    timeLimit: 600,
    reward: 2800,
    briefing: 'Cruising back to Coral Field when the engine quits. Pitch for best glide, manage your energy and make the runway: there is nowhere else to land.',
    setup(env, aircraft) {
      const r = env.runways[0];
      const p = r.pointAt(-6500, 1800, 0);
      p.y = r.elevation + (aircraft.spec.id === 'light' ? 800 : 1400);
      return {
        start: { onGround: false, position: p, heading: r.headingDeg - 15, speed: aircraft.spec.approachSpeed * 1.5, throttle: 0.6 },
        objectives: [
          { type: 'survive', label: 'Engine failure: establish best glide', seconds: 25 },
          { type: 'land', runway: r, label: `Dead-stick landing on runway ${r.name}` },
        ],
        events: [{ at: 8, action: 'failEngine' }],
        constraints: [],
        destination: r,
      };
    },
  },
  {
    id: 'long-haul',
    code: '08',
    title: 'LONG DISTANCE FLIGHT',
    map: 'airbase',
    aircraft: 'airliner',
    allowed: ['airliner', 'fighter', 'light'],
    difficulty: 'HARD',
    time: 'sunset',
    condition: 'clear',
    windDir: 250,
    timeLimit: 2400,
    reward: 3200,
    fuel: 0.4,
    briefing: 'A circuit of the whole region on limited fuel: depart Ironwood, climb to cruise, cross four navigation fixes over the ranges and return to land. Watch the fuel endurance readout.',
    setup(env) {
      const r = env.runways[0];
      const wps = [
        { name: 'NORTH', pos: v3(-2000, 2600, -10500) },
        { name: 'PEAKS', pos: v3(9500, 3000, -6000) },
        { name: 'EAST', pos: v3(10000, 2600, 7000) },
        { name: 'SOUTH', pos: v3(-6000, 1800, 9500) },
      ];
      return {
        start: runwayStart(r, 40),
        objectives: [
          { type: 'engine', label: 'Start the engines (I)' },
          { type: 'takeoff', label: 'Depart runway 27' },
          ...wps.map((w) => ({ type: 'waypoint', pos: w.pos, radius: 900, name: w.name, label: `Cross fix ${w.name}` })),
          { type: 'land', runway: r, label: 'Return and land at Ironwood' },
        ],
        constraints: [],
        destination: r,
      };
    },
  },
];

export const SCHOOL = [
  {
    id: 'school-basics',
    code: 'S1',
    title: 'LESSON 1: AIRWORK',
    map: 'airbase',
    aircraft: 'light',
    allowed: ['light', 'fighter', 'airliner'],
    difficulty: 'TRAINING',
    time: 'morning',
    condition: 'clear',
    windDir: 270,
    timeLimit: 900,
    reward: 400,
    school: true,
    briefing: 'Learn the stick and throttle in the air: hold altitude, turn to headings with bank, and use the throttle to keep speed. Hints appear for every step.',
    setup(env) {
      const e = env.runways[0].elevation;
      return {
        start: { onGround: false, position: v3(-4000, e + 600, 800), heading: 270, speed: 52, throttle: 0.65 },
        objectives: [
          { type: 'heading', target: 360, tol: 8, hold: 3, label: 'Turn right to heading 360', hint: 'Roll right with D (or drag the mouse right), then pull gently with S to hold the nose up in the turn. Roll level as the compass nears 360.' },
          { type: 'heading', target: 90, tol: 8, hold: 3, label: 'Turn right to heading 090', hint: 'Use 20 to 30 degrees of bank. The heading bug on the compass shows the target.' },
          { type: 'altitude', minM: e + 760, label: 'Climb 500 ft', hold: 3, hint: 'Throttle up with Shift (or the mouse wheel) and raise the nose a few degrees. Watch the vertical speed indicator.' },
          { type: 'heading', target: 270, tol: 8, hold: 3, label: 'Turn left to heading 270', hint: 'Roll left with A. Keep the flight path marker on the horizon line to hold altitude.' },
        ],
        constraints: [],
        destination: env.runways[0],
      };
    },
  },
  {
    id: 'school-takeoff',
    code: 'S2',
    title: 'LESSON 2: TAKEOFF',
    map: 'airbase',
    aircraft: 'light',
    allowed: ['light', 'fighter', 'airliner'],
    difficulty: 'TRAINING',
    time: 'morning',
    condition: 'clear',
    windDir: 270,
    timeLimit: 600,
    reward: 400,
    school: true,
    briefing: 'Engine start, takeoff roll, rotation at the right speed and the initial climb.',
    setup(env) {
      const r = env.runways[0];
      return {
        start: runwayStart(r, 40),
        objectives: [
          { type: 'engine', label: 'Start the engine', hint: 'Press I to engage the starter. The RPM gauge rises and the ENGINE light turns green.' },
          { type: 'takeoff', label: 'Take off', hint: 'Full throttle (hold Shift or press 0). Keep straight with Q/E. At the rotate speed on the speed tape, pull back gently with S.' },
          { type: 'altitude', minM: r.elevation + 150, label: 'Climb to 500 ft above the field', hint: 'Hold about 8 to 10 degrees nose up. Raise flaps with V if they are down.' },
        ],
        constraints: [],
        destination: r,
      };
    },
  },
  {
    id: 'school-landing',
    code: 'S3',
    title: 'LESSON 3: LANDING',
    map: 'airbase',
    aircraft: 'light',
    allowed: ['light', 'fighter', 'airliner'],
    difficulty: 'TRAINING',
    time: 'morning',
    condition: 'clear',
    windDir: 270,
    timeLimit: 600,
    reward: 500,
    school: true,
    briefing: 'A stabilised straight-in approach from 6 km: glide path, speed, flare and braking.',
    setup(env, aircraft) {
      const r = env.runways[0];
      return {
        start: { onGround: false, position: onFinal(r, 6, 0, aircraft.gearHeight), heading: r.headingDeg, speed: aircraft.spec.approachSpeed * 1.1, gear: true, flaps: 2, throttle: 0.35 },
        objectives: [
          { type: 'gate', label: 'Stabilised by 3 km', hint: 'Keep the two PAPI lights white and two red, and the glide-slope diamond centred. Throttle controls the descent, the stick controls the speed.' },
          { type: 'land', runway: r, label: 'Land and stop', hint: 'Over the threshold, reduce the throttle to idle and raise the nose slightly to flare. Hold X to brake after touchdown.' },
        ],
        constraints: [],
        destination: r,
      };
    },
  },
];

export const ALL_MISSIONS = [...MISSIONS, ...SCHOOL];
export const findMission = (id) => ALL_MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
