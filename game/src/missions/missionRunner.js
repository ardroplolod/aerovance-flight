// Runs a mission: steps through its objectives in order, tests rings and waypoints against the
// aircraft's path, holds altitude and heading checks for their dwell time, enforces constraints
// (minimum height above ground), fires scripted events (an engine failure), and at the end adds
// up the score from objectives, time, landing quality, fuel and airframe condition.
import { angleDiff, clamp, M_TO_FT } from '../core/math.js';
import { bearingTo, distance2D } from '../nav/navigation.js';
import { createRings } from './rings.js';
import { ratingFor } from '../landing/landingEvaluator.js';

export function createMissionRunner(mission, env, aircraft, plan) {
  const objectives = plan.objectives.map((o) => ({ ...o, status: 'pending', progress: 0, holdTime: 0 }));
  const constraints = (plan.constraints ?? []).map((c) => ({ ...c, violation: 0, ok: true }));
  const events = (mission.events ?? plan.events ?? []).map((e) => ({ ...e, fired: false }));
  let index = 0;
  let elapsed = 0;
  let done = null;
  const prev = aircraft.state.pos.clone();
  const ringSets = new Map();
  const stats = { maxAlt: 0, maxSpeed: 0, checkpoints: 0, totalCheckpoints: 0, distance: 0, maxG: 1 };
  const feed = [];
  for (const o of objectives) {
    if (o.type === 'rings') {
      ringSets.set(o, createRings(env.scene, o.rings));
      stats.totalCheckpoints += o.rings.length;
    }
    if (o.type === 'waypoint') stats.totalCheckpoints += 1;
  }
  if (objectives[0]) objectives[0].status = 'active';

  const notify = (text, kind = 'ok') => feed.push({ text, kind, time: elapsed });

  function complete(o) {
    o.status = 'done';
    o.completedAt = elapsed;
    notify(`OBJECTIVE COMPLETE: ${o.label}`, 'objective');
    index += 1;
    if (objectives[index]) objectives[index].status = 'active';
    else finish(true, 'All objectives complete');
  }

  function finish(success, reason, landing = null) {
    if (done) return;
    done = { success, reason, landing, elapsed };
  }

  /** The current navigation target for the HUD and the map. */
  function target() {
    const o = objectives[index];
    if (!o) return null;
    if (o.type === 'rings') {
      const r = o.rings[o.progress];
      return r ? { kind: 'ring', pos: r.pos, label: `RING ${o.progress + 1}/${o.rings.length}`, radius: r.radius } : null;
    }
    if (o.type === 'waypoint') return { kind: 'waypoint', pos: o.pos, label: o.name, radius: o.radius };
    if (o.type === 'land' || o.type === 'gate') return { kind: 'runway', pos: plan.destination.touchdown, label: `RWY ${plan.destination.name}`, runway: plan.destination };
    return plan.destination ? { kind: 'runway', pos: plan.destination.touchdown, label: `RWY ${plan.destination.name}`, runway: plan.destination } : null;
  }

  return {
    mission,
    objectives,
    constraints,
    stats,
    feed,
    ringSets,
    get elapsed() {
      return elapsed;
    },
    get done() {
      return done;
    },
    get index() {
      return index;
    },
    target,
    current: () => objectives[index],
    /** Mark objectives complete up to the first of `type` (used to stage screenshots). */
    skipTo(type) {
      while (objectives[index] && objectives[index].type !== type) {
        const o = objectives[index];
        o.status = 'done';
        if (o.rings) o.progress = o.rings.length;
        stats.checkpoints += o.rings ? o.rings.length : o.type === 'waypoint' ? 1 : 0;
        index += 1;
      }
      if (objectives[index]) objectives[index].status = 'active';
    },
    notify,
    finish,
    /** Per-step update. `flight` carries events from the flight model and landing judgements. */
    update(dt, time) {
      if (done) return;
      elapsed += dt;
      const s = aircraft.state;
      const cur = s.pos;
      stats.maxAlt = Math.max(stats.maxAlt, cur.y);
      stats.maxSpeed = Math.max(stats.maxSpeed, s.airspeed);
      stats.maxG = Math.max(stats.maxG, s.loadFactor);
      stats.distance += prev.distanceTo(cur);
      for (const e of events) {
        if (!e.fired && elapsed >= e.at) {
          e.fired = true;
          if (e.action === 'failEngine') {
            aircraft.failEngine('ENGINE FAILURE');
            notify('ENGINE FAILURE: GLIDE TO THE RUNWAY', 'warn');
          }
        }
      }
      const o = objectives[index];
      if (o) {
        if (o.type === 'engine' && s.engine === 'running') complete(o);
        else if (o.type === 'takeoff' && !s.onGround && s.agl > 15) complete(o);
        else if (o.type === 'altitude') {
          o.holdTime = cur.y >= o.minM ? o.holdTime + dt : 0;
          o.progress = clamp(cur.y / o.minM, 0, 1);
          if (o.holdTime >= (o.hold ?? 0)) complete(o);
        } else if (o.type === 'heading') {
          o.holdTime = Math.abs(angleDiff(aircraft.headingDeg(), o.target)) <= o.tol && Math.abs(aircraft.bankDeg()) < 12 ? o.holdTime + dt : 0;
          if (o.holdTime >= o.hold) complete(o);
        } else if (o.type === 'rings') {
          const set = ringSets.get(o);
          if (set.test(o.progress, prev, cur)) {
            o.progress += 1;
            stats.checkpoints += 1;
            notify(`CHECKPOINT ${o.progress}/${o.rings.length}`, 'checkpoint');
            if (o.progress >= o.rings.length) complete(o);
          }
        } else if (o.type === 'waypoint') {
          if (distance2D(cur, o.pos) < o.radius && Math.abs(cur.y - o.pos.y) < 450) {
            stats.checkpoints += 1;
            notify(`FIX ${o.name} CROSSED`, 'checkpoint');
            complete(o);
          }
        } else if (o.type === 'survive') {
          o.holdTime += s.engine !== 'running' ? dt : 0;
          if (o.holdTime >= o.seconds) complete(o);
        } else if (o.type === 'gate') {
          const r = plan.destination;
          const local = r.toLocal(cur);
          if (local.along > -3000) {
            if (s.gearDown && s.flaps > 0.3) complete(o);
            else {
              o.status = 'failed';
              notify('NOT STABILISED BY 3 KM', 'warn');
              index += 1;
              if (objectives[index]) objectives[index].status = 'active';
            }
          }
        }
      }
      for (const set of ringSets.values()) {
        const obj = objectives.find((x) => ringSets.get(x) === set);
        set.highlight(obj.status === 'done' ? obj.rings.length : obj.status === 'active' ? obj.progress : -1, time);
        set.group.visible = obj.status !== 'pending' || objectives.indexOf(obj) === index + 1;
      }
      for (const c of constraints) {
        if (c.type === 'minAgl') {
          const landingPhase = objectives[index]?.type === 'land' || objectives[index]?.type === 'gate' || index >= objectives.length;
          c.ok = s.onGround || landingPhase || s.agl >= c.m;
          if (!c.ok) c.violation += dt;
        }
      }
      if (mission.timeLimit && elapsed > mission.timeLimit) finish(false, 'Time limit exceeded');
      prev.copy(cur);
    },
    /** Called by the session once a landing objective's rollout is judged. */
    landed(result) {
      const o = objectives[index];
      if (o && o.type === 'land') {
        o.landing = result;
        complete(o);
      }
    },
    /** Final score and rating breakdown for the results screen. */
    score() {
      const s = aircraft.state;
      const h = s.health;
      const condition = (h.engine + h.leftWing + h.rightWing + h.tail + h.gear) / 5;
      const doneCount = objectives.filter((o) => o.status === 'done').length;
      const landingObj = objectives.find((o) => o.landing);
      const landing = landingObj?.landing ?? null;
      const objectivePts = doneCount * 400;
      const checkpointPts = stats.checkpoints * 150;
      const timeBonus = done?.success && mission.timeLimit ? Math.round(clamp(1 - elapsed / mission.timeLimit, 0, 1) * 1500) : 0;
      const landingPts = landing ? landing.percent * 20 : 0;
      const fuelPts = Math.round((s.fuel / aircraft.spec.fuelCapacity) * 300);
      const conditionPts = Math.round(condition * 500);
      const penalty = Math.round(constraints.reduce((a, c) => a + c.violation * 25, 0));
      const total = done?.success ? Math.max(0, objectivePts + checkpointPts + timeBonus + landingPts + fuelPts + conditionPts - penalty) : Math.round((objectivePts + checkpointPts) * 0.3);
      const max = objectives.length * 400 + stats.totalCheckpoints * 150 + 1500 + (landingObj || objectives.some((o) => o.type === 'land') ? 2000 : 0) + 800;
      const percent = clamp((total / max) * 100 * 1.25, 0, 100);
      return {
        total,
        percent,
        rating: done?.success ? ratingFor(landing ? Math.min(percent, landing.percent + 12) : percent) : 'NEEDS IMPROVEMENT',
        parts: { objectivePts, checkpointPts, timeBonus, landingPts, fuelPts, conditionPts, penalty },
        condition,
        landing,
        doneCount,
        stats: { ...stats, maxAltFt: stats.maxAlt * M_TO_FT },
      };
    },
    bearingToTarget() {
      const t = target();
      return t ? bearingTo(aircraft.state.pos, t.pos) : null;
    },
    dispose() {
      for (const set of ringSets.values()) set.dispose();
    },
  };
}
