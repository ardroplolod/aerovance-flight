// Navigation: bearings and distances to the active target, and a full ILS-style approach solution
// for a runway (localizer and glide-slope deviation from a 3 degree path, distance to threshold,
// the descent rate the path needs at the current ground speed, and a speed target for the type).
import { angleDiff, clamp, DEG, RAD, wrap360 } from '../core/math.js';

export const GLIDE_SLOPE = 3;

export function bearingTo(from, to) {
  return wrap360(Math.atan2(to.x - from.x, -(to.z - from.z)) * RAD);
}

export function distance2D(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/** Where the aircraft sits relative to a runway's approach path. */
export function approachSolution(aircraft, runway) {
  const s = aircraft.state;
  const local = runway.toLocal(s.pos);
  // aim at the touchdown point 300 m beyond the threshold
  const toTouchdown = 300 - local.along;
  const dist = Math.hypot(toTouchdown, local.across);
  const gpHeight = Math.max(0, toTouchdown) * Math.tan(GLIDE_SLOPE * DEG);
  const height = local.height - aircraft.gearHeight;
  const glideAngle = toTouchdown > 1 ? Math.atan2(height, toTouchdown) * RAD : 0;
  const locDeg = toTouchdown > 1 ? Math.atan2(local.across, toTouchdown) * RAD : 0;
  const gs = aircraft.groundSpeed();
  const requiredVs = -gs * Math.tan(GLIDE_SLOPE * DEG);
  const headingError = angleDiff(runway.headingDeg, aircraft.headingDeg());
  return {
    runway,
    along: local.along,
    across: local.across,
    height,
    distance: dist,
    distanceToThreshold: Math.hypot(-local.along, local.across),
    glideAngle,
    // positive = above the path / right of the centreline, in "dots" (0.35 deg glide, 1 deg loc per dot)
    glideDots: clamp((glideAngle - GLIDE_SLOPE) / 0.35, -2.5, 2.5),
    locDots: clamp(locDeg / 1.0, -2.5, 2.5),
    gpHeight,
    requiredVs,
    headingError,
    onFinal: local.along > -14000 && local.along < runway.length && Math.abs(locDeg) < 12 && Math.abs(headingError) < 50,
    targetSpeed: aircraft.spec.approachSpeed,
    // a rough heading to fly to intercept the centreline
    interceptHeading: wrap360(runway.headingDeg + clamp(locDeg * -3, -35, 35)),
  };
}

/** The nearest runway to a point (any surface flagged as a runway or deck). */
export function nearestRunway(runways, pos) {
  let best = null;
  let bestD = Infinity;
  for (const r of runways) {
    const d = r.center.distanceTo(pos);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}
