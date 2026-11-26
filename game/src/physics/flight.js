// The flight model. Forces: thrust along the nose, lift perpendicular to the relative wind from a
// lift curve with a real stall, drag (parasite, induced, transonic, gear, flaps, airbrake), side
// force from sideslip, gravity and ground effect. Moments: the stick commands body rates whose
// authority scales with dynamic pressure, plus weathervane stability in pitch and yaw, so the nose
// follows the flight path, turns come from banking, and a slow aircraft feels mushy and stalls.
// On the ground the gear carries the weight: rolling friction, brakes, nose-wheel steering,
// rotation limited by the tail, touchdown impact recorded for the landing evaluator.
import * as THREE from 'three';
import { airDensity, clamp, DEG, G, speedOfSound } from '../core/math.js';
import { cleanDragCoefficient, thrustAvailable } from '../aircraft/specs.js';

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _air = new THREE.Vector3();
const _force = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _axis = new THREE.Vector3();

/** Lift coefficient at an angle of attack (radians), with flaps, through and past the stall. */
export function liftCoefficient(spec, alpha, flaps) {
  const stall = spec.stallAlpha * DEG;
  const clMax = spec.clMax + spec.flapCl * flaps;
  const a = Math.abs(alpha);
  const sign = Math.sign(alpha) || 1;
  if (a <= stall) return clamp(spec.cl0 + spec.clAlpha * alpha + spec.flapCl * flaps * 0.8, -clMax, clMax);
  // past the stall the lift collapses toward a flat plate's
  const post = Math.max(0, 1 - (a - stall) / (8 * DEG));
  return sign * (clMax * (0.55 + 0.45 * post) * (a < stall + 8 * DEG ? 1 : 0.6) * 0.85 + Math.sin(2 * a) * 0.25 * (1 - post));
}

/**
 * Advance the aircraft one step. `env` supplies groundAt(x, z) -> { height, surface, water } and wind.
 * Returns events that happened in this step (touchdown, crash, liftoff, stall onset).
 */
export function stepFlight(ac, input, env, dt) {
  const { spec, state } = ac;
  const events = [];
  _fwd.set(0, 0, -1).applyQuaternion(state.quat);
  _up.set(0, 1, 0).applyQuaternion(state.quat);
  _right.set(1, 0, 0).applyQuaternion(state.quat);

  const wind = env.wind;
  _air.copy(state.vel).sub(wind);
  if (env.turbulence > 0 && !state.onGround) {
    const t = state.time;
    _air.x += Math.sin(t * 1.7 + state.pos.z * 0.01) * env.turbulence;
    _air.y += Math.sin(t * 2.3 + state.pos.x * 0.013) * env.turbulence * 0.8;
    _air.z += Math.cos(t * 1.9) * env.turbulence;
  }
  const speed = _air.length();
  const altitude = state.pos.y;
  const rho = airDensity(altitude);
  const qbar = 0.5 * rho * speed * speed;
  const vf = _air.dot(_fwd);
  const alpha = speed > 1 ? Math.atan2(-_air.dot(_up), Math.max(vf, 0.1)) : 0;
  const beta = speed > 1 ? Math.atan2(_air.dot(_right), Math.max(vf, 0.1)) : 0;
  const mach = speed / speedOfSound(altitude);
  const mass = spec.emptyMass + state.fuel;

  // ground effect: more lift, less induced drag within a span of the ground
  const ground = env.groundAt(state.pos.x, state.pos.z);
  const agl = altitude - ground.height - ac.gearHeight * state.gearPos;
  const ge = agl < spec.span ? 1 + 0.25 * (1 - Math.max(agl, 0) / spec.span) : 1;

  const cl = liftCoefficient(spec, alpha, state.flaps) * ge * (0.4 + 0.3 * (state.health.leftWing + state.health.rightWing));
  let cd = cleanDragCoefficient(spec, cl / ge, mach);
  cd += spec.gearCd * state.gearPos + spec.flapCd * state.flaps + spec.brakeCd * (state.airbrake ? 1 : 0);
  cd += (2 - state.health.leftWing - state.health.rightWing) * 0.02;
  if (Math.abs(alpha) > spec.stallAlpha * DEG) cd += 0.25 * Math.sin(Math.abs(alpha));

  _force.set(0, -mass * G, 0);
  if (speed > 0.5) {
    const airDir = _tmp.copy(_air).divideScalar(speed);
    const liftDir = new THREE.Vector3().crossVectors(_right, airDir).normalize();
    _force.addScaledVector(liftDir, qbar * spec.wingArea * cl);
    _force.addScaledVector(airDir, -qbar * spec.wingArea * cd);
    _force.addScaledVector(_right, -qbar * spec.wingArea * 0.9 * beta);
  }
  const engineOn = state.engine === 'running';
  const thrust = engineOn ? thrustAvailable(spec, state.rpmPower, rho, speed, state.afterburner) * (0.25 + 0.75 * state.health.engine) : 0;
  state.thrust = thrust;
  _force.addScaledVector(_fwd, thrust);
  state.lift = qbar * spec.wingArea * cl;
  state.loadFactor = state.lift / (mass * G);

  // --- rotation: rate command with authority from dynamic pressure, plus aerodynamic stability
  const authority = clamp(speed / spec.authoritySpeed, 0, 1) ** 1.5 * clamp(rho / 1.225 + 0.35, 0, 1);
  const stalled = Math.abs(alpha) > spec.stallAlpha * DEG;
  const tail = state.health.tail;
  const wingAsym = (state.health.leftWing - state.health.rightWing) * 0.6;
  const target = {
    pitch: input.pitch * spec.pitchRate * DEG * authority * (0.35 + 0.65 * tail),
    roll: (input.roll * spec.rollRate * DEG * (stalled ? 0.35 : 1) + wingAsym) * authority,
    yaw: input.yaw * spec.yawRate * DEG * authority * (0.35 + 0.65 * tail),
  };
  // weathervane stability: the nose eases back into the relative wind
  const stabK = authority * spec.response * 0.35;
  // trim: with the stick centred the nose settles at the angle of attack that gives 1 G
  const clNeeded = qbar > 1 ? (mass * G) / (qbar * spec.wingArea) : spec.clMax;
  const alphaTrim = Math.min(Math.max((clNeeded - spec.cl0 - spec.flapCl * state.flaps * 0.8) / spec.clAlpha, -4 * DEG), (spec.stallAlpha - 4) * DEG);
  target.pitch += -(alpha - alphaTrim) * stabK * (Math.abs(input.pitch) < 0.05 ? 1.6 : 0.2);
  target.yaw += beta * stabK * 2.2;
  // a stalled wing drops the nose
  if (stalled && !state.onGround) target.pitch -= 0.35 * Math.sign(alpha);
  const k = 1 - Math.exp(-spec.response * dt * (0.4 + 0.6 * authority) * 2);
  state.rates.x += (target.pitch - state.rates.x) * k;
  state.rates.z += (-target.roll - state.rates.z) * k;
  state.rates.y += (-target.yaw - state.rates.y) * k;

  // --- ground handling
  const gearDown = state.gearPos > 0.98 && state.health.gear > 0.05;
  const contactHeight = gearDown ? ac.gearHeight : 1.0;
  const floor = ground.height + contactHeight;
  const wasOnGround = state.onGround;
  if (state.pos.y <= floor + 0.02 && state.vel.y <= 0.5) {
    if (!wasOnGround) {
      const touchdown = {
        verticalSpeed: state.vel.y,
        groundSpeed: Math.hypot(state.vel.x, state.vel.z),
        pitch: ac.pitchDeg(),
        bank: ac.bankDeg(),
        surface: ground.surface,
        gearDown,
        position: state.pos.clone(),
        heading: ac.headingDeg(),
      };
      events.push({ type: 'touchdown', ...touchdown });
    }
    state.onGround = true;
    state.surface = ground.surface;
    state.pos.y = floor;
    if (state.vel.y < 0) state.vel.y = 0;
    // project velocity onto the heading: tyres kill most sideways slip
    const hx = _fwd.x;
    const hz = _fwd.z;
    const hl = Math.hypot(hx, hz) || 1;
    const fx = hx / hl;
    const fz = hz / hl;
    let along = state.vel.x * fx + state.vel.z * fz;
    let side = state.vel.x * fz - state.vel.z * fx;
    side *= Math.exp(-(gearDown ? 6 : 1.5) * dt);
    const rolling = gearDown ? (ground.surface === 'grass' ? 0.06 : 0.015) : 0.5;
    const braking = gearDown && (input.brakes || state.parkingBrake) ? (ground.surface === 'grass' ? 0.3 : 0.55) : 0;
    const decel = (rolling + braking) * G * dt;
    along = Math.abs(along) <= decel ? 0 : along - Math.sign(along) * decel;
    // a carrier wire, once caught, holds until the aircraft stops
    if (ground.arrest && gearDown && spec.hook && !state.arrested && along > 20) {
      state.arrested = true;
      events.push({ type: 'arrested' });
    }
    if (state.arrested && along > 0) along = Math.max(0, along - (along > 8 ? 30 : 12) * dt);
    state.vel.x = fx * along + fz * side;
    state.vel.z = fz * along - fx * side;
    // nose-wheel steering and attitude limits on the ground
    const gs = Math.abs(along);
    state.rates.y = -input.yaw * 0.55 * clamp(1 - gs / 90, 0.15, 1) * clamp(gs / 3, 0, 1) - input.roll * 0.12 * clamp(gs / 3, 0, 1);
    state.rates.z = 0;
    const pitch = ac.pitchDeg();
    if (pitch <= 0.2 && state.rates.x < 0) state.rates.x = 0;
    if (pitch >= spec.tailStrike && state.rates.x > 0) {
      state.rates.x = 0;
      if (gs > 20) state.tailScrape = true;
    }
    if (speed < spec.rotateSpeed * 0.7 && pitch > 0.5) state.rates.x = Math.min(state.rates.x, -0.08);
    ac.levelOnGround(dt);
  } else if (wasOnGround && state.pos.y > floor + 0.5) {
    state.onGround = false;
    events.push({ type: 'liftoff', speed });
  }

  // --- integrate
  if (state.onGround) _force.y = Math.max(_force.y, 0);
  state.vel.addScaledVector(_force, dt / mass);
  if (state.onGround && state.vel.y < 0) state.vel.y = 0;
  state.pos.addScaledVector(state.vel, dt);
  const w = state.rates;
  const angle = w.length() * dt;
  if (angle > 0) {
    _axis.copy(w).normalize();
    _q.setFromAxisAngle(_axis, angle);
    state.quat.multiply(_q).normalize();
  }

  state.alpha = alpha;
  state.beta = beta;
  state.airspeed = speed;
  state.mach = mach;
  state.agl = altitude - ground.height - contactHeight;
  if (stalled && !state.onGround && !state.stalled) events.push({ type: 'stall' });
  state.stalled = stalled && !state.onGround;
  state.overWater = ground.water;
  return events;
}
