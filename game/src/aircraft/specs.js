// The three flyable aircraft. Every number here feeds the flight model directly; the performance
// figures the hangar shows (max speed, cruise, ceiling, stall, endurance) are *computed* from these
// same coefficients by `derivePerformance`, never typed in by hand.
import { airDensity, G, MS_TO_KT, M_TO_FT, speedOfSound } from '../core/math.js';

export const AIRCRAFT = {
  fighter: {
    id: 'fighter',
    name: 'AV-9 Kestrel',
    model: 'Twin-engine multirole jet',
    className: 'Fighter Jet',
    engineType: 'jet',
    emptyMass: 11800,
    fuelCapacity: 4800,
    wingArea: 50,
    span: 12.6,
    thrust: 128000,
    afterburnerThrust: 196000,
    cl0: 0.04,
    clAlpha: 3.6,
    clMax: 1.45,
    stallAlpha: 24,
    flapCl: 0.3,
    cd0: 0.021,
    inducedK: 0.13,
    gearCd: 0.018,
    flapCd: 0.035,
    brakeCd: 0.06,
    rollRate: 210,
    pitchRate: 32,
    yawRate: 14,
    response: 6,
    authoritySpeed: 70,
    burnIdle: 0.12,
    burnMax: 1.6,
    burnAfterburner: 5.0,
    spool: 1.3,
    maxG: 9,
    vne: 470,
    gearSpeed: 140,
    approachSpeed: 72,
    rotateSpeed: 75,
    tailStrike: 13,
    hook: true,
    retractGear: true,
  },
  airliner: {
    id: 'airliner',
    name: 'AV-500 Stratos',
    model: 'Twin-turbofan narrow-body',
    className: 'Commercial Aircraft',
    engineType: 'turbofan',
    emptyMass: 52000,
    fuelCapacity: 16000,
    wingArea: 124,
    span: 34.5,
    thrust: 236000,
    cl0: 0.18,
    clAlpha: 5.2,
    clMax: 1.5,
    stallAlpha: 15,
    flapCl: 0.95,
    cd0: 0.022,
    inducedK: 0.042,
    gearCd: 0.016,
    flapCd: 0.05,
    brakeCd: 0.05,
    rollRate: 32,
    pitchRate: 7,
    yawRate: 4,
    response: 1.8,
    authoritySpeed: 75,
    burnIdle: 0.15,
    burnMax: 1.25,
    spool: 2.6,
    maxG: 2.5,
    vne: 290,
    gearSpeed: 135,
    approachSpeed: 72,
    rotateSpeed: 77,
    tailStrike: 10,
    retractGear: true,
  },
  light: {
    id: 'light',
    name: 'AV-2 Skylark',
    model: 'Four-seat piston trainer',
    className: 'General Aviation',
    engineType: 'piston',
    emptyMass: 780,
    fuelCapacity: 145,
    wingArea: 16.2,
    span: 12,
    thrust: 2900,
    power: 125000,
    propEfficiency: 0.8,
    cl0: 0.3,
    clAlpha: 4.9,
    clMax: 1.55,
    stallAlpha: 16,
    flapCl: 0.6,
    cd0: 0.031,
    inducedK: 0.055,
    gearCd: 0,
    flapCd: 0.04,
    brakeCd: 0.03,
    rollRate: 75,
    pitchRate: 22,
    yawRate: 16,
    response: 4,
    authoritySpeed: 30,
    burnIdle: 0.0015,
    burnMax: 0.0105,
    spool: 0.5,
    maxG: 3.8,
    vne: 82,
    gearSpeed: 999,
    approachSpeed: 34,
    rotateSpeed: 28,
    tailStrike: 14,
    retractGear: false,
  },
};

/** Thrust available (N) for a spec at throttle (0..1), air density and true airspeed. */
export function thrustAvailable(spec, throttle, rho, speed, afterburner = false) {
  const lapse = Math.pow(rho / 1.225, spec.engineType === 'piston' ? 1.7 : spec.engineType === 'turbofan' ? 1.2 : 1.0);
  if (spec.engineType === 'piston') {
    const propLimited = (spec.power * spec.propEfficiency) / Math.max(speed, 12);
    return Math.min(spec.thrust, propLimited) * throttle * lapse;
  }
  const ram = 1 + Math.min(speed, 400) / 2000;
  const base = spec.thrust * throttle * lapse * ram;
  return afterburner && spec.afterburnerThrust ? spec.afterburnerThrust * lapse * ram : base;
}

/** Clean-wing drag coefficient: parasite + induced + a transonic wave-drag rise past Mach 0.85. */
export function cleanDragCoefficient(spec, cl, mach) {
  const wave = mach > 0.85 ? Math.min(0.045, (mach - 0.85) * 0.18) - (mach > 1.2 ? (mach - 1.2) * 0.02 : 0) : 0;
  return spec.cd0 + spec.inducedK * cl * cl + Math.max(0, wave);
}

/** Level-flight drag (N) at a speed, mass and altitude, gear and flaps up. */
function levelDrag(spec, mass, alt, v) {
  const rho = airDensity(alt);
  const q = 0.5 * rho * v * v;
  const cl = (mass * G) / (q * spec.wingArea);
  return q * spec.wingArea * cleanDragCoefficient(spec, cl, v / speedOfSound(alt));
}

/** Highest speed (m/s) where thrust still meets drag, by stepping up from the stall. */
function maxLevelSpeed(spec, mass, alt, throttle, afterburner) {
  const rho = airDensity(alt);
  let best = 0;
  for (let v = 20; v < 800; v += 1) {
    const cl = (mass * G) / (0.5 * rho * v * v * spec.wingArea);
    if (cl > spec.clMax) continue;
    if (thrustAvailable(spec, throttle, rho, v, afterburner) >= levelDrag(spec, mass, alt, v)) best = v;
  }
  return best;
}

/** Performance computed from the model's own coefficients (half fuel), for the hangar and flight deck. */
export function derivePerformance(spec) {
  const mass = spec.emptyMass + spec.fuelCapacity * 0.5;
  const rho0 = airDensity(0);
  const cruiseAlt = spec.engineType === 'piston' ? 2400 : spec.id === 'airliner' ? 10000 : 9000;
  const maxSpeed = Math.max(maxLevelSpeed(spec, mass, cruiseAlt, 1, true), maxLevelSpeed(spec, mass, 0, 1, true));
  const cruise = maxLevelSpeed(spec, mass, cruiseAlt, 0.72, false);
  // service ceiling: the highest altitude still giving 0.5 m/s (100 ft/min) of climb at the best speed
  let ceiling = 0;
  for (let h = 0; h < 20000; h += 100) {
    const rho = airDensity(h);
    let climb = 0;
    for (let v = 20; v < 600; v += 4) {
      const cl = (mass * G) / (0.5 * rho * v * v * spec.wingArea);
      if (cl > spec.clMax) continue;
      climb = Math.max(climb, ((thrustAvailable(spec, 1, rho, v, !!spec.afterburnerThrust) - levelDrag(spec, mass, h, v)) * v) / (mass * G));
    }
    if (climb >= 0.5) ceiling = h;
  }
  const stall = Math.sqrt((2 * mass * G) / (rho0 * spec.wingArea * spec.clMax));
  const stallFlaps = Math.sqrt((2 * mass * G) / (rho0 * spec.wingArea * (spec.clMax + spec.flapCl)));
  const burn = spec.burnIdle + (spec.burnMax - spec.burnIdle) * Math.pow(0.72, 1.2);
  const endurance = spec.fuelCapacity / burn;
  const powerToWeight = (spec.afterburnerThrust ?? (spec.engineType === 'piston' ? spec.thrust : spec.thrust)) / (mass * G);
  return {
    maxSpeedKt: Math.round(Math.min(maxSpeed, spec.vne) * MS_TO_KT),
    cruiseKt: Math.round(cruise * MS_TO_KT),
    ceilingFt: Math.round((ceiling * M_TO_FT) / 100) * 100,
    stallKt: Math.round(stall * MS_TO_KT),
    stallFlapsKt: Math.round(stallFlaps * MS_TO_KT),
    enduranceMin: Math.round(endurance / 60),
    fuelKg: spec.fuelCapacity,
    thrustKn: Math.round((spec.afterburnerThrust ?? spec.thrust) / 1000),
    powerToWeight,
    // 0..100 ratings, each from one coefficient so the bars compare like with like
    ratings: {
      speed: Math.min(100, Math.round((Math.min(maxSpeed, spec.vne) / 470) * 100)),
      power: Math.min(100, Math.round(powerToWeight * 80)),
      handling: Math.min(100, Math.round((spec.rollRate / 210) * 70 + (spec.pitchRate / 32) * 30)),
      stability: Math.min(100, Math.round(100 - (spec.rollRate / 210) * 55 - spec.response * 4)),
      landing: Math.min(100, Math.round(100 - stallFlaps * 0.9)),
      endurance: Math.min(100, Math.round((endurance / 3600 / 4) * 100)),
    },
  };
}
