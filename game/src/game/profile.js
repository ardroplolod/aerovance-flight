// The pilot's saved profile (localStorage): settings, selections and the career record (flights,
// hours, landings, crashes, experience, rank and each mission's best result).
const KEY = 'aerovance-profile-v1';

export const RANKS = [
  [0, 'CADET'],
  [2000, 'PILOT OFFICER'],
  [6000, 'FLYING OFFICER'],
  [12000, 'FLIGHT LIEUTENANT'],
  [22000, 'SQUADRON LEADER'],
  [36000, 'WING COMMANDER'],
  [56000, 'GROUP CAPTAIN'],
];

const DEFAULTS = {
  callsign: 'MAVERICK-7',
  settings: { quality: 'medium', volume: 0.8, sensitivity: 1, invert: false, camera: 'chase' },
  selection: { aircraft: 'fighter', mission: 'mountain', time: null, condition: null },
  career: { flights: 0, seconds: 0, landings: 0, perfect: 0, crashes: 0, xp: 0, distance: 0, best: {} },
};

export function loadProfile() {
  let data = {};
  try {
    data = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    data = {};
  }
  const p = {
    ...DEFAULTS,
    ...data,
    settings: { ...DEFAULTS.settings, ...data.settings },
    selection: { ...DEFAULTS.selection, ...data.selection },
    career: { ...DEFAULTS.career, ...data.career, best: { ...(data.career?.best ?? {}) } },
  };
  return p;
}

export function saveProfile(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage may be unavailable (private mode): the profile lasts this visit
  }
}

export function rankOf(xp) {
  let rank = RANKS[0][1];
  let next = null;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (xp >= RANKS[i][0]) {
      rank = RANKS[i][1];
      next = RANKS[i + 1] ?? null;
    }
  }
  return { rank, next };
}

/** Fold a finished flight into the career record. */
export function recordFlight(p, result) {
  const c = p.career;
  c.flights += 1;
  c.seconds += result.elapsed;
  c.distance += result.score.stats.distance;
  if (result.landing && result.success) c.landings += 1;
  if (result.landing?.rating === 'PERFECT') c.perfect += 1;
  if (!result.success && /crash|impact|ditch|struck|collapsed|wingtip|gear-up|structural/i.test(result.reason)) c.crashes += 1;
  const xp = result.success ? Math.round(result.score.total * 0.6 + result.mission.reward) : Math.round(result.score.total * 0.2);
  c.xp += xp;
  const prev = c.best[result.mission.id];
  if (result.success && (!prev || result.score.total > prev.score)) c.best[result.mission.id] = { score: result.score.total, rating: result.score.rating, aircraft: result.aircraftId };
  saveProfile(p);
  return xp;
}
