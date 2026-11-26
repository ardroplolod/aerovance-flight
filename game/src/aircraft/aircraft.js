// An aircraft in the world: its spec, its 3D model and the systems the pilot manages: engine start
// and spool, fuel burn and endurance, landing gear and flap motors, wheel brakes and airbrake, and
// structural health (engine, each wing, tail, gear) that hard landings, over-G and overspeed wear down.
import * as THREE from 'three';
import { clamp, DEG, RAD, wrap360 } from '../core/math.js';
import { AIRCRAFT, derivePerformance } from './specs.js';
import { buildFighter } from './models/fighter.js';
import { buildAirliner } from './models/airliner.js';
import { buildLightPlane } from './models/lightplane.js';
import { stepFlight } from '../physics/flight.js';

const BUILDERS = { fighter: buildFighter, airliner: buildAirliner, light: buildLightPlane };
const PERF = {};
/** Performance figures derived from the flight model's coefficients, computed once per type. */
export function performanceOf(id) {
  PERF[id] ??= derivePerformance(AIRCRAFT[id]);
  return PERF[id];
}
export const FLAP_DETENTS = [0, 0.33, 0.66, 1];

export function buildModel(id) {
  return BUILDERS[id]();
}

export class Aircraft {
  constructor(id) {
    this.spec = AIRCRAFT[id];
    this.model = buildModel(id);
    this.perf = performanceOf(id);
    this.gearHeight = this.model.gearHeight;
    this.state = {
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      rates: new THREE.Vector3(),
      time: 0,
      fuel: this.spec.fuelCapacity * 0.8,
      throttle: 0,
      rpm: 0,
      rpmPower: 0,
      afterburner: false,
      engine: 'off',
      startTimer: 0,
      gearDown: true,
      gearPos: 1,
      flapIndex: 0,
      flaps: 0,
      airbrake: false,
      parkingBrake: false,
      brakes: false,
      onGround: true,
      surface: 'runway',
      health: { engine: 1, leftWing: 1, rightWing: 1, tail: 1, gear: 1 },
      alpha: 0,
      beta: 0,
      airspeed: 0,
      mach: 0,
      loadFactor: 1,
      thrust: 0,
      agl: 0,
      stalled: false,
      crashed: false,
      wheelRoll: 0,
      failure: null,
    };
    this.controls = { pitch: 0, roll: 0, yaw: 0 };
    this.warnings = new Set();
  }

  /** Place on the ground or in the air with a heading (deg), speed (m/s) and pitch (deg). */
  spawn({ position, heading, speed = 0, pitch = 0, onGround = true, engine = onGround ? 'off' : 'running', throttle = onGround ? 0 : 0.6, fuel = 0.8, gearDown = onGround, flaps = 0 }) {
    const s = this.state;
    s.pos.copy(position);
    s.quat.setFromEuler(new THREE.Euler(pitch * DEG, -heading * DEG, 0, 'YXZ'));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(s.quat);
    s.vel.copy(fwd).multiplyScalar(speed);
    s.rates.set(0, 0, 0);
    s.onGround = onGround;
    s.engine = engine;
    s.throttle = throttle;
    s.rpm = engine === 'running' ? 0.25 + 0.75 * throttle : 0;
    s.rpmPower = engine === 'running' ? throttle : 0;
    s.fuel = this.spec.fuelCapacity * fuel;
    s.gearDown = gearDown || !this.spec.retractGear;
    s.gearPos = s.gearDown ? 1 : 0;
    s.flapIndex = flaps;
    s.flaps = FLAP_DETENTS[flaps];
    s.parkingBrake = false;
    s.crashed = false;
    s.arrested = false;
    s.failure = null;
    this.syncModel(0);
  }

  headingDeg() {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.state.quat);
    return wrap360(Math.atan2(f.x, -f.z) * RAD);
  }
  pitchDeg() {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.state.quat);
    return Math.asin(clamp(f.y, -1, 1)) * RAD;
  }
  bankDeg() {
    const r = new THREE.Vector3(1, 0, 0).applyQuaternion(this.state.quat);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(this.state.quat);
    return Math.atan2(-r.y, u.y) * RAD;
  }
  groundSpeed() {
    return Math.hypot(this.state.vel.x, this.state.vel.z);
  }
  /** Ease roll to wings-level while rolling on the ground. */
  levelOnGround(dt) {
    const e = new THREE.Euler().setFromQuaternion(this.state.quat, 'YXZ');
    e.z *= Math.exp(-8 * dt);
    if (e.x < 0) e.x *= Math.exp(-6 * dt);
    this.state.quat.setFromEuler(e);
  }

  toggleGear() {
    if (!this.spec.retractGear) return 'FIXED GEAR';
    if (this.state.onGround && this.state.gearDown) return 'WEIGHT ON WHEELS';
    this.state.gearDown = !this.state.gearDown;
    return this.state.gearDown ? 'GEAR DOWN' : 'GEAR UP';
  }
  setFlaps(delta) {
    this.state.flapIndex = clamp(this.state.flapIndex + delta, 0, FLAP_DETENTS.length - 1);
    return `FLAPS ${Math.round(FLAP_DETENTS[this.state.flapIndex] * 100)}%`;
  }
  startEngine() {
    const s = this.state;
    if (s.engine === 'running' || s.engine === 'starting') return s.engine === 'running' ? 'ENGINE RUNNING' : 'STARTING';
    if (s.fuel <= 0) return 'NO FUEL';
    if (s.engine === 'failed') return 'ENGINE FAILED';
    s.engine = 'starting';
    s.startTimer = 0;
    return 'ENGINE START';
  }
  shutdownEngine() {
    if (this.state.engine === 'running') this.state.engine = 'off';
  }

  /** One simulation step: systems, flight model, damage. Returns the flight model's events. */
  update(input, env, dt) {
    const s = this.state;
    const spec = this.spec;
    s.time += dt;
    // control smoothing so key presses feel like a stick, not a switch
    const rate = 5;
    for (const axis of ['pitch', 'roll', 'yaw']) {
      const target = input[axis];
      const k = 1 - Math.exp(-rate * dt * (Math.abs(target) > Math.abs(this.controls[axis]) ? 1 : 1.6));
      this.controls[axis] += (target - this.controls[axis]) * k;
    }
    s.throttle = clamp(input.throttle, 0, 1);
    s.afterburner = !!spec.afterburnerThrust && input.afterburner && s.throttle > 0.95 && s.engine === 'running';
    s.brakes = input.brakes;
    s.airbrake = input.airbrake;

    // engine
    if (s.engine === 'starting') {
      s.startTimer += dt;
      s.rpm = Math.min(0.25, s.startTimer / 16);
      if (s.startTimer > 4) s.engine = 'running';
    }
    if (s.fuel <= 0 && s.engine === 'running') {
      s.engine = 'off';
      s.failure = 'FUEL EXHAUSTED';
    }
    if (s.engine === 'running') {
      const target = 0.25 + 0.75 * s.throttle;
      s.rpm += (target - s.rpm) * (1 - Math.exp(-dt / (spec.spool * (target > s.rpm ? 1 : 0.7))));
      s.rpmPower = clamp((s.rpm - 0.25) / 0.75, 0, 1);
      const burn = spec.burnIdle + (spec.burnMax - spec.burnIdle) * Math.pow(s.rpmPower, 1.2) + (s.afterburner ? spec.burnAfterburner : 0);
      const leak = (2 - s.health.leftWing - s.health.rightWing) > 0.8 ? spec.burnMax * 0.3 : 0;
      s.burnRate = burn + leak;
      s.fuel = Math.max(0, s.fuel - s.burnRate * dt);
    } else if (s.engine !== 'starting') {
      s.rpm = Math.max(0, s.rpm - dt * 0.12);
      s.rpmPower = 0;
      s.burnRate = 0;
    }

    // gear and flap motors take real time
    const gearTarget = s.gearDown ? 1 : 0;
    s.gearPos += clamp(gearTarget - s.gearPos, -dt / 4, dt / 4);
    const flapTarget = FLAP_DETENTS[s.flapIndex];
    s.flaps += clamp(flapTarget - s.flaps, -dt / 3, dt / 3);

    const events = s.crashed ? [] : stepFlight(this, this.controls, env, dt);
    this.applyStress(dt, events);
    s.wheelRoll = s.onGround ? this.groundSpeed() * dt : 0;
    return events;
  }

  /** Structural wear from G, overspeed and gear limits. */
  applyStress(dt, events) {
    const s = this.state;
    const spec = this.spec;
    const h = s.health;
    if (!s.onGround && Math.abs(s.loadFactor) > spec.maxG) {
      const over = (Math.abs(s.loadFactor) - spec.maxG) * dt * 0.12;
      h.leftWing = Math.max(0, h.leftWing - over);
      h.rightWing = Math.max(0, h.rightWing - over * 0.9);
      h.tail = Math.max(0, h.tail - over * 0.5);
    }
    if (s.airspeed > spec.vne) {
      const over = ((s.airspeed - spec.vne) / spec.vne) * dt * 0.5;
      h.tail = Math.max(0, h.tail - over);
      h.engine = Math.max(0, h.engine - over * 0.5);
    }
    if (s.gearPos > 0.1 && s.airspeed > spec.gearSpeed * 1.15 && !s.onGround) h.gear = Math.max(0, h.gear - dt * 0.05);
    if (s.tailScrape) {
      h.tail = Math.max(0, h.tail - 0.15);
      s.tailScrape = false;
      events.push({ type: 'tailstrike' });
    }
    if (h.engine <= 0.05 && s.engine === 'running') {
      s.engine = 'failed';
      s.failure = 'ENGINE FAILURE';
    }
  }

  /** Fail the engine on purpose (emergency missions). */
  failEngine(reason = 'ENGINE FAILURE') {
    this.state.engine = 'failed';
    this.state.failure = reason;
  }

  /** Copy the simulated state onto the 3D model and animate its moving parts. */
  syncModel(time) {
    const s = this.state;
    this.model.group.position.copy(s.pos);
    this.model.group.quaternion.copy(s.quat);
    this.model.update({
      aileron: this.controls.roll,
      elevator: this.controls.pitch,
      rudder: this.controls.yaw,
      flaps: s.flaps,
      gear: s.gearPos,
      power: s.engine === 'running' ? 0.15 + s.rpmPower * 0.85 : 0,
      afterburner: s.afterburner ? 1 : 0,
      rpm: s.rpm,
      time,
      wheelRoll: s.wheelRoll,
    });
  }

  /** Minutes of fuel left at the current burn. */
  endurance() {
    const s = this.state;
    return s.burnRate > 0 ? s.fuel / s.burnRate / 60 : Infinity;
  }
}
