// Landing evaluation. It watches the approach (bank and pitch steadiness, speed and path keeping
// over the last kilometres), records the touchdown (sink rate, speed, where on the runway, offset
// from the centreline, heading alignment, attitude), measures the roll-out to a stop, and grades
// each part out of 100. Crashes and hard landings are judged here too.
import { angleDiff, clamp, MS_TO_FPM, MS_TO_KT, M_TO_FT } from '../core/math.js';
import { approachSolution } from '../nav/navigation.js';

const lin = (v, good, bad) => clamp(100 * (1 - (Math.abs(v) - good) / (bad - good)), 0, 100);

export function ratingFor(percent) {
  if (percent >= 95) return 'PERFECT';
  if (percent >= 82) return 'EXCELLENT';
  if (percent >= 62) return 'GOOD';
  return 'NEEDS IMPROVEMENT';
}

export function createLandingEvaluator(aircraft) {
  const samples = [];
  let touchdown = null;
  let stopped = null;
  let bounce = 0;

  return {
    get touchdown() {
      return touchdown;
    },
    get result() {
      return stopped;
    },
    /** Sample the approach while inside 8 km and below 900 m above the runway. */
    track(runway) {
      if (touchdown || !runway) return;
      const a = approachSolution(aircraft, runway);
      if (a.along > -8000 && a.along < 400 && a.height < 900 && a.height > 3) {
        samples.push({ bank: aircraft.bankDeg(), gs: a.glideDots, loc: a.locDots, speed: aircraft.state.airspeed });
        if (samples.length > 1200) samples.shift();
      }
    },
    /**
     * Judge a touchdown event. Returns { outcome: 'crash' | 'hard' | 'ok' | 'offrunway', reason }.
     * `runway` is the runway (or deck) the aircraft is landing on, if any.
     */
    onTouchdown(ev, runway, isDeck = false) {
      const spec = aircraft.spec;
      const vsFpm = ev.verticalSpeed * MS_TO_FPM;
      const crashVs = spec.id === 'fighter' ? -1400 : spec.id === 'airliner' ? -900 : -1000;
      if (touchdown) {
        bounce += 1;
        if (vsFpm < crashVs) return { outcome: 'crash', reason: 'Structural failure after a bounce' };
        return { outcome: 'ok' };
      }
      if (ev.surface === 'water') return { outcome: 'crash', reason: 'Ditched in the water' };
      if (!ev.gearDown) return { outcome: 'crash', reason: 'Gear-up landing' };
      if (vsFpm < crashVs) return { outcome: 'crash', reason: `Impact at ${Math.round(-vsFpm)} ft/min` };
      if (Math.abs(ev.bank) > 22) return { outcome: 'crash', reason: 'Wingtip struck the ground' };
      if (ev.pitch < -6) return { outcome: 'crash', reason: 'Nose-first impact' };
      const onRunway = runway && (isDeck ? ev.surface === 'deck' : runway.contains(ev.position, 2));
      if (!onRunway && ev.groundSpeed > 40 && ev.surface !== 'runway' && ev.surface !== 'deck') return { outcome: 'crash', reason: 'Hit terrain off the runway' };
      const local = runway ? runway.toLocal(ev.position) : { along: 0, across: 0 };
      touchdown = {
        vsFpm,
        speedKt: ev.groundSpeed * MS_TO_KT,
        airspeedKt: aircraft.state.airspeed * MS_TO_KT,
        along: local.along,
        across: local.across,
        alignError: runway ? angleDiff(runway.headingDeg, ev.heading) : 0,
        bank: ev.bank,
        pitch: ev.pitch,
        onRunway: !!onRunway,
        runwayName: runway?.name ?? '--',
        isDeck,
        start: ev.position.clone(),
      };
      const hard = vsFpm < crashVs * 0.55;
      if (hard) aircraft.state.health.gear = Math.max(0, aircraft.state.health.gear - 0.45);
      if (vsFpm < crashVs * 0.35) aircraft.state.health.gear = Math.max(0, aircraft.state.health.gear - 0.1);
      return { outcome: onRunway ? (hard ? 'hard' : 'ok') : 'offrunway' };
    },
    /** Once the aircraft has stopped after touching down: the full graded result. */
    onStopped(arrested = false) {
      if (!touchdown || stopped) return stopped;
      const spec = aircraft.spec;
      const t = touchdown;
      const rollout = t.start.distanceTo(aircraft.state.pos);
      const stability = samples.length > 10 ? (() => {
        const n = samples.length;
        const mean = (k) => samples.reduce((a, s) => a + s[k], 0) / n;
        const sd = (k) => Math.sqrt(samples.reduce((a, s) => a + (s[k] - mean(k)) ** 2, 0) / n);
        return clamp(100 - sd('bank') * 6 - sd('gs') * 18 - sd('loc') * 14, 0, 100);
      })() : 60;
      const ideal = spec.approachSpeed * MS_TO_KT;
      const scores = {
        sink: lin(Math.max(0, -t.vsFpm - 60), 90, spec.id === 'fighter' ? 900 : 650),
        speed: lin(t.airspeedKt - ideal * 0.95, 6, 40),
        position: t.isDeck ? (arrested ? 100 : 35) : lin(t.along - 300, 120, 900),
        centreline: lin(t.across, 2, t.isDeck ? 10 : 18),
        alignment: lin(t.alignError, 1.5, 12),
        braking: t.isDeck ? (arrested ? 100 : 40) : lin(rollout - (spec.id === 'airliner' ? 1100 : spec.id === 'fighter' ? 900 : 260), 0, 1600),
        stability: stability - bounce * 15,
      };
      for (const k of Object.keys(scores)) scores[k] = Math.round(clamp(scores[k], 0, 100));
      const weights = { sink: 0.24, speed: 0.14, position: 0.16, centreline: 0.14, alignment: 0.1, braking: 0.08, stability: 0.14 };
      const total = Object.entries(weights).reduce((a, [k, w]) => a + scores[k] * w, 0) * (t.onRunway ? 1 : 0.5);
      stopped = {
        ...t,
        rollout,
        rolloutFt: rollout * M_TO_FT,
        bounces: bounce,
        arrested,
        scores,
        percent: Math.round(total),
        rating: ratingFor(total),
      };
      return stopped;
    },
  };
}
