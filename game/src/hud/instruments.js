// The six-pack, drawn live on a canvas from the aircraft state: airspeed (with flap, normal and
// caution arcs from the type's own speeds), artificial horizon, three-pointer altimeter, heading
// indicator, vertical speed and an engine gauge (RPM with fuel flow). The same canvas is the 2D
// instrument strip and the texture of the 3D cockpit panel.
import { clamp, DEG, MS_TO_FPM, MS_TO_KT, M_TO_FT } from '../core/math.js';

const TAU = Math.PI * 2;

function bezel(ctx, x, y, r, label) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r * 1.12);
  g.addColorStop(0, '#3a4048');
  g.addColorStop(1, '#0d1014');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#05070a';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    ctx.fillStyle = '#1b1f24';
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 1.04, y + Math.sin(a) * r * 1.04, r * 0.05, 0, TAU);
    ctx.fill();
  }
  if (label) {
    ctx.fillStyle = 'rgba(160,200,210,0.55)';
    ctx.font = `600 ${r * 0.13}px "Helvetica Neue", Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r * 0.62);
  }
}

function glass(ctx, x, y, r) {
  const g = ctx.createLinearGradient(x - r, y - r, x + r * 0.2, y + r * 0.4);
  g.addColorStop(0, 'rgba(255,255,255,0.13)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function needle(ctx, x, y, angle, len, width, color = '#f4f6f8') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(-width, len * 0.12);
  ctx.lineTo(0, -len);
  ctx.lineTo(width, len * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x, y, width * 1.4, 0, TAU);
  ctx.fill();
}

function ticks(ctx, x, y, r, from, to, count, major, labelFn, start = -Math.PI * 0.75, sweep = Math.PI * 1.5) {
  ctx.strokeStyle = '#e8eef2';
  ctx.fillStyle = '#e8eef2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${r * 0.16}px "Helvetica Neue", Arial`;
  for (let i = 0; i <= count; i += 1) {
    const a = start + (sweep * i) / count - Math.PI / 2;
    const big = i % major === 0;
    ctx.lineWidth = big ? r * 0.035 : r * 0.018;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * (big ? 0.78 : 0.85), y + Math.sin(a) * r * (big ? 0.78 : 0.85));
    ctx.lineTo(x + Math.cos(a) * r * 0.93, y + Math.sin(a) * r * 0.93);
    ctx.stroke();
    if (big && labelFn) ctx.fillText(labelFn(from + ((to - from) * i) / count), x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62);
  }
}

function arc(ctx, x, y, r, a0, a1, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, a0 - Math.PI / 2, a1 - Math.PI / 2);
  ctx.stroke();
}

function airspeed(ctx, x, y, r, ac) {
  bezel(ctx, x, y, r, 'KNOTS');
  const max = Math.ceil((ac.spec.vne * MS_TO_KT * 1.1) / 50) * 50;
  const ang = (kt) => -Math.PI * 0.8 + (clamp(kt, 0, max) / max) * Math.PI * 1.6;
  const stall = ac.perf.stallKt;
  const stallF = ac.perf.stallFlapsKt;
  arc(ctx, x, y, r * 0.95, ang(stallF), ang(ac.spec.gearSpeed * MS_TO_KT), '#f2f2f2', r * 0.06);
  arc(ctx, x, y, r * 0.88, ang(stall), ang(ac.spec.vne * MS_TO_KT * 0.85), '#2fd06a', r * 0.06);
  arc(ctx, x, y, r * 0.88, ang(ac.spec.vne * MS_TO_KT * 0.85), ang(ac.spec.vne * MS_TO_KT), '#f2c230', r * 0.06);
  arc(ctx, x, y, r * 0.88, ang(ac.spec.vne * MS_TO_KT), ang(ac.spec.vne * MS_TO_KT) + 0.04, '#ff3b30', r * 0.12);
  ticks(ctx, x, y, r, 0, max, 16, 2, (v) => Math.round(v), -Math.PI * 0.8, Math.PI * 1.6);
  const kt = ac.state.airspeed * MS_TO_KT;
  ctx.fillStyle = '#9fe9ff';
  ctx.font = `700 ${r * 0.2}px "SF Mono", Menlo, monospace`;
  ctx.fillText(String(Math.round(kt)).padStart(3, ' '), x, y + r * 0.35);
  needle(ctx, x, y, ang(kt), r * 0.85, r * 0.06);
  glass(ctx, x, y, r);
}

function attitude(ctx, x, y, r, ac) {
  bezel(ctx, x, y, r, '');
  const pitch = ac.pitchDeg();
  const bank = ac.bankDeg();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.93, 0, TAU);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-bank * DEG);
  const off = pitch * r * 0.035;
  ctx.fillStyle = '#2b78c9';
  ctx.fillRect(-r * 2, -r * 3 + off, r * 4, r * 3);
  ctx.fillStyle = '#7a4b25';
  ctx.fillRect(-r * 2, off, r * 4, r * 3);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = r * 0.025;
  ctx.beginPath();
  ctx.moveTo(-r * 2, off);
  ctx.lineTo(r * 2, off);
  ctx.stroke();
  ctx.font = `600 ${r * 0.11}px "Helvetica Neue", Arial`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  for (let p = -30; p <= 30; p += 5) {
    if (p === 0) continue;
    const yy = off - p * r * 0.035;
    const w = p % 10 === 0 ? r * 0.3 : r * 0.15;
    ctx.beginPath();
    ctx.moveTo(-w, yy);
    ctx.lineTo(w, yy);
    ctx.stroke();
    if (p % 10 === 0) ctx.fillText(Math.abs(p), w + r * 0.12, yy + r * 0.04);
  }
  ctx.restore();
  // bank scale
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#fff';
  for (const b of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const a = b * DEG - Math.PI / 2;
    ctx.lineWidth = b % 30 === 0 ? r * 0.04 : r * 0.02;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    ctx.lineTo(Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93);
    ctx.stroke();
  }
  ctx.rotate(-bank * DEG);
  ctx.fillStyle = '#ffb020';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.79);
  ctx.lineTo(-r * 0.06, -r * 0.68);
  ctx.lineTo(r * 0.06, -r * 0.68);
  ctx.fill();
  ctx.restore();
  // aircraft symbol
  ctx.strokeStyle = '#ffb020';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y);
  ctx.lineTo(x - r * 0.18, y);
  ctx.lineTo(x - r * 0.1, y + r * 0.08);
  ctx.moveTo(x + r * 0.5, y);
  ctx.lineTo(x + r * 0.18, y);
  ctx.lineTo(x + r * 0.1, y + r * 0.08);
  ctx.stroke();
  ctx.fillStyle = '#ffb020';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.04, 0, TAU);
  ctx.fill();
  glass(ctx, x, y, r);
}

function altimeter(ctx, x, y, r, ac) {
  bezel(ctx, x, y, r, 'ALT FT');
  ticks(ctx, x, y, r, 0, 10, 50, 5, (v) => (v < 10 ? Math.round(v) : ''), 0, TAU * (49 / 50));
  const ft = ac.state.pos.y * M_TO_FT;
  ctx.fillStyle = '#9fe9ff';
  ctx.font = `700 ${r * 0.17}px "SF Mono", Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(ft / 10) * 10).padStart(5, ' '), x, y + r * 0.3);
  needle(ctx, x, y, ((ft % 10000) / 10000) * TAU, r * 0.5, r * 0.07, '#cfd6dc');
  needle(ctx, x, y, ((ft % 1000) / 1000) * TAU, r * 0.85, r * 0.045);
  glass(ctx, x, y, r);
}

function heading(ctx, x, y, r, ac, bug) {
  bezel(ctx, x, y, r, '');
  const hdg = ac.headingDeg();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-hdg * DEG);
  ctx.strokeStyle = '#e8eef2';
  ctx.fillStyle = '#e8eef2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 5) {
    const a = d * DEG - Math.PI / 2;
    const big = d % 30 === 0;
    ctx.lineWidth = big ? r * 0.03 : r * 0.015;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * (d % 10 === 0 ? 0.78 : 0.85), Math.sin(a) * r * (d % 10 === 0 ? 0.78 : 0.85));
    ctx.lineTo(Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93);
    ctx.stroke();
    if (big) {
      ctx.save();
      ctx.rotate(d * DEG);
      ctx.font = `700 ${r * 0.16}px "Helvetica Neue", Arial`;
      ctx.fillStyle = d % 90 === 0 ? '#ffb020' : '#e8eef2';
      ctx.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] ?? String(d / 10), 0, -r * 0.62);
      ctx.restore();
    }
  }
  if (bug != null) {
    ctx.save();
    ctx.rotate(bug * DEG);
    ctx.fillStyle = '#35f2c2';
    ctx.fillRect(-r * 0.07, -r * 0.98, r * 0.14, r * 0.1);
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#ffb020';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.5);
  ctx.lineTo(x - r * 0.18, y + r * 0.35);
  ctx.lineTo(x, y + r * 0.22);
  ctx.lineTo(x + r * 0.18, y + r * 0.35);
  ctx.fill();
  ctx.fillStyle = '#9fe9ff';
  ctx.font = `700 ${r * 0.17}px "SF Mono", Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(hdg) % 360).padStart(3, '0'), x, y + r * 0.62);
  glass(ctx, x, y, r);
}

function vsi(ctx, x, y, r, ac) {
  bezel(ctx, x, y, r, 'VS FPM');
  const max = ac.spec.id === 'light' ? 2000 : 6000;
  const ang = (v) => -Math.PI / 2 + (clamp(v, -max, max) / max) * Math.PI * 0.85;
  ticks(ctx, x, y, r, -max, max, 20, 5, (v) => (v === 0 ? '0' : Math.abs(v / 1000).toFixed(max > 2000 ? 0 : 1)), -Math.PI / 2 - Math.PI * 0.85, Math.PI * 1.7);
  const fpm = ac.state.vel.y * MS_TO_FPM;
  needle(ctx, x, y, ang(fpm), r * 0.85, r * 0.05);
  ctx.fillStyle = fpm < -1200 ? '#ff5a4a' : '#9fe9ff';
  ctx.font = `700 ${r * 0.16}px "SF Mono", Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`${fpm > 0 ? '+' : ''}${Math.round(fpm / 10) * 10}`, x + r * 0.32, y + r * 0.35);
  glass(ctx, x, y, r);
}

function engine(ctx, x, y, r, ac) {
  bezel(ctx, x, y, r, ac.spec.engineType === 'piston' ? 'RPM x100' : 'N1 %');
  const s = ac.state;
  const maxRpm = ac.spec.engineType === 'piston' ? 27 : 110;
  const val = ac.spec.engineType === 'piston' ? s.rpm * 26 : s.rpm * 104;
  const ang = (v) => -Math.PI * 0.75 + (clamp(v, 0, maxRpm) / maxRpm) * Math.PI * 1.5;
  arc(ctx, x, y, r * 0.88, ang(maxRpm * 0.2), ang(maxRpm * 0.88), '#2fd06a', r * 0.06);
  arc(ctx, x, y, r * 0.88, ang(maxRpm * 0.88), ang(maxRpm * 0.96), '#f2c230', r * 0.06);
  arc(ctx, x, y, r * 0.88, ang(maxRpm * 0.96), ang(maxRpm), '#ff3b30', r * 0.06);
  ticks(ctx, x, y, r, 0, maxRpm, 10, 2, (v) => Math.round(v));
  needle(ctx, x, y, ang(val), r * 0.82, r * 0.05);
  // fuel flow bar
  const ff = s.burnRate ?? 0;
  const ffMax = ac.spec.burnMax + (ac.spec.burnAfterburner ?? 0);
  ctx.fillStyle = '#151a1f';
  ctx.fillRect(x - r * 0.4, y + r * 0.72, r * 0.8, r * 0.1);
  ctx.fillStyle = s.afterburner ? '#ff8a3a' : '#35f2c2';
  ctx.fillRect(x - r * 0.4, y + r * 0.72, r * 0.8 * clamp(ff / ffMax, 0, 1), r * 0.1);
  ctx.fillStyle = s.engine === 'running' ? '#2fd06a' : s.engine === 'starting' ? '#f2c230' : '#ff3b30';
  ctx.beginPath();
  ctx.arc(x, y + r * 0.35, r * 0.06, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#9fe9ff';
  ctx.font = `700 ${r * 0.14}px "SF Mono", Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(val * (ac.spec.engineType === 'piston' ? 100 : 1))}`, x, y + r * 0.2);
  glass(ctx, x, y, r);
}

export const GAUGES = ['ASI', 'ATT', 'ALT', 'HDG', 'VSI', 'ENG'];

/** Draw all six gauges in a row into `ctx` (w by h), the radius fitted to the space. */
export function drawInstruments(ctx, w, h, ac, headingBug) {
  ctx.clearRect(0, 0, w, h);
  const n = 6;
  const cell = w / n;
  const r = Math.min(cell, h) * 0.42;
  const fns = [airspeed, attitude, altimeter, (c, x, y, rr, a) => heading(c, x, y, rr, a, headingBug), vsi, engine];
  for (let i = 0; i < n; i += 1) fns[i](ctx, cell * (i + 0.5), h / 2, r, ac);
}
