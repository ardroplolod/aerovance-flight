// Small numeric helpers and the aviation unit conversions every system shares.
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const MS_TO_KT = 1.943844;
export const M_TO_FT = 3.28084;
export const MS_TO_FPM = 196.8504;
export const G = 9.80665;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a, b, v) => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential approach of `current` toward `target`. */
export const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));
export const wrap360 = (deg) => ((deg % 360) + 360) % 360;
/** Signed smallest difference b - a in degrees, in [-180, 180). */
export const angleDiff = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;

/** ISA air density (kg/m^3) at an altitude in metres. */
export function airDensity(altitude) {
  const h = clamp(altitude, -500, 20000);
  const t = 288.15 - 0.0065 * Math.min(h, 11000);
  const rho = 1.225 * Math.pow(t / 288.15, 4.256);
  return h > 11000 ? rho * Math.exp(-(h - 11000) / 6341.6) : rho;
}
/** Speed of sound (m/s) at an altitude, for the Mach readout. */
export const speedOfSound = (altitude) => Math.sqrt(1.4 * 287.05 * (288.15 - 0.0065 * clamp(altitude, 0, 11000)));

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
