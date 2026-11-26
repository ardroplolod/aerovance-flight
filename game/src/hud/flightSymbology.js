// The head-up display drawn over the 3D view: pitch ladder and bank scale, flight path marker,
// speed and altitude tapes with their bugs, the target marker (or an edge arrow when the target is
// off screen), a synthetic runway outline with localizer / glide-slope deviation, approach cues,
// and the master warnings. Everything is projected through the real camera each frame.
import * as THREE from 'three';
import { clamp, DEG, MS_TO_FPM, MS_TO_KT, M_TO_FT } from '../core/math.js';

const GREEN = '#5dffa8';
const DIM = 'rgba(93,255,168,0.55)';
const CYAN = '#4fe3ff';
const AMBER = '#ffc24a';
const RED = '#ff4d4d';
const v = new THREE.Vector3();

function project(camera, p, w, h) {
  v.copy(p).project(camera);
  const behind = v.z > 1;
  return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, behind, onScreen: !behind && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 };
}

function text(ctx, str, x, y, { size = 13, color = GREEN, align = 'center', weight = 600, baseline = 'middle' } = {}) {
  ctx.font = `${weight} ${size}px "SF Mono", Menlo, Consolas, monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
}

function tape(ctx, x, y, height, value, step, labelStep, side, fmt, bugs) {
  const pxPer = height / (step * 10);
  ctx.save();
  ctx.beginPath();
  ctx.rect(side < 0 ? x - 70 : x, y - height / 2, 70, height);
  ctx.clip();
  ctx.fillStyle = 'rgba(4,14,12,0.32)';
  ctx.fillRect(side < 0 ? x - 70 : x, y - height / 2, 70, height);
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 1.5;
  const first = Math.floor((value - step * 6) / step) * step;
  for (let s = first; s <= value + step * 6; s += step) {
    const yy = y - (s - value) * pxPer;
    const major = Math.round(s / step) % (labelStep / step) === 0;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + side * (major ? 14 : 8), yy);
    ctx.stroke();
    if (major) text(ctx, fmt(s), x + side * 20, yy, { size: 12, align: side < 0 ? 'right' : 'left', color: DIM });
  }
  for (const b of bugs) {
    const yy = clamp(y - (b.value - value) * pxPer, y - height / 2 + 6, y + height / 2 - 6);
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + side * 10, yy - 6);
    ctx.lineTo(x + side * 10, yy + 6);
    ctx.fill();
    if (b.band) {
      ctx.fillRect(side < 0 ? x - 4 : x, y - (b.band[1] - value) * pxPer, 4, (b.band[1] - b.band[0]) * pxPer);
    }
  }
  ctx.restore();
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y - height / 2);
  ctx.lineTo(x, y + height / 2);
  ctx.stroke();
}

function readout(ctx, x, y, str, side, color = GREEN) {
  const w = 76;
  ctx.fillStyle = 'rgba(2,10,8,0.82)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const x0 = side < 0 ? x - w - 10 : x + 10;
  ctx.moveTo(x, y);
  ctx.lineTo(x0 + (side < 0 ? w : 0), y - 14);
  ctx.lineTo(x0 + (side < 0 ? 0 : w), y - 14);
  ctx.lineTo(x0 + (side < 0 ? 0 : w), y + 14);
  ctx.lineTo(x0 + (side < 0 ? w : 0), y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  text(ctx, str, x0 + w / 2, y + 1, { size: 17, color, weight: 700 });
}

/** Draw the HUD. `d` is the per-frame bundle the session assembles. */
export function drawFlightSymbology(ctx, w, h, d) {
  const { aircraft: ac, camera, target, approach, warnings, cockpit } = d;
  const s = ac.state;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.shadowColor = 'rgba(40,255,160,0.45)';
  ctx.shadowBlur = 6;
  const cx = w / 2;
  const cy = h * 0.44;
  const pxPerDeg = h / camera.fov;
  const pitch = ac.pitchDeg();
  const bank = ac.bankDeg();

  // pitch ladder (only around the centre, rotated with bank)
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 260, cy - 210, 520, 380);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-bank * DEG);
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 1.6;
  for (let p = -90; p <= 90; p += 5) {
    const yy = (pitch - p) * pxPerDeg * (cockpit ? 1 : 0.7);
    if (Math.abs(yy) > 260) continue;
    const half = p === 0 ? 240 : p % 10 === 0 ? 70 : 38;
    if (p < 0) ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(-half, yy);
    ctx.lineTo(-24, yy);
    ctx.moveTo(24, yy);
    ctx.lineTo(half, yy);
    if (p !== 0) {
      ctx.moveTo(-half, yy);
      ctx.lineTo(-half, yy + (p > 0 ? 8 : -8));
      ctx.moveTo(half, yy);
      ctx.lineTo(half, yy + (p > 0 ? 8 : -8));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (p !== 0 && p % 10 === 0) {
      text(ctx, String(p), -half - 16, yy, { size: 11, color: DIM });
      text(ctx, String(p), half + 16, yy, { size: 11, color: DIM });
    }
  }
  ctx.restore();

  // bank scale
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = DIM;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 200, (-90 - 60) * DEG, (-90 + 60) * DEG);
  ctx.stroke();
  for (const b of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const a = (b - 90) * DEG;
    const l = b % 30 === 0 ? 12 : 7;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 200, Math.sin(a) * 200);
    ctx.lineTo(Math.cos(a) * (200 + l), Math.sin(a) * (200 + l));
    ctx.stroke();
  }
  ctx.rotate(-bank * DEG);
  ctx.fillStyle = Math.abs(bank) > 45 ? AMBER : GREEN;
  ctx.beginPath();
  ctx.moveTo(0, -196);
  ctx.lineTo(-7, -184);
  ctx.lineTo(7, -184);
  ctx.fill();
  ctx.restore();

  // boresight (waterline)
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx - 10, cy);
  ctx.lineTo(cx - 5, cy + 7);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + 5, cy + 7);
  ctx.lineTo(cx + 10, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.stroke();

  // flight path marker: where the aircraft is actually going
  if (s.vel.lengthSq() > 4) {
    const fp = project(camera, s.pos.clone().addScaledVector(s.vel.clone().normalize(), 2000), w, h);
    if (!fp.behind) {
      const fx = clamp(fp.x, 40, w - 40);
      const fy = clamp(fp.y, 40, h - 40);
      ctx.strokeStyle = s.stalled ? RED : GREEN;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx, fy, 9, 0, Math.PI * 2);
      ctx.moveTo(fx - 22, fy);
      ctx.lineTo(fx - 9, fy);
      ctx.moveTo(fx + 9, fy);
      ctx.lineTo(fx + 22, fy);
      ctx.moveTo(fx, fy - 9);
      ctx.lineTo(fx, fy - 18);
      ctx.stroke();
    }
  }

  // speed tape (left) and altitude tape (right)
  const kt = s.airspeed * MS_TO_KT;
  const ft = s.pos.y * M_TO_FT;
  const tapeH = Math.min(320, h * 0.42);
  const lx = cx - Math.min(300, w * 0.22);
  const rx = cx + Math.min(300, w * 0.22);
  const speedBugs = [];
  if (approach && approach.onFinal) speedBugs.push({ value: approach.targetSpeed * MS_TO_KT, color: CYAN, band: [approach.targetSpeed * MS_TO_KT - 5, approach.targetSpeed * MS_TO_KT + 5] });
  if (s.onGround) speedBugs.push({ value: ac.spec.rotateSpeed * MS_TO_KT, color: AMBER });
  speedBugs.push({ value: ac.perf.stallKt * (s.flaps > 0.3 ? ac.perf.stallFlapsKt / ac.perf.stallKt : 1), color: RED });
  tape(ctx, lx, cy, tapeH, kt, 10, 50, -1, (x) => String(Math.round(x)), speedBugs);
  const spdColor = s.stalled ? RED : kt > ac.spec.vne * MS_TO_KT ? RED : GREEN;
  readout(ctx, lx, cy, String(Math.round(kt)), -1, spdColor);
  text(ctx, 'IAS KT', lx - 40, cy - tapeH / 2 - 14, { size: 11, color: DIM });
  text(ctx, `GS ${Math.round(ac.groundSpeed() * MS_TO_KT)}`, lx - 40, cy + tapeH / 2 + 14, { size: 12 });
  text(ctx, `M ${s.mach.toFixed(2)}`, lx - 40, cy + tapeH / 2 + 30, { size: 12, color: DIM });
  text(ctx, `G ${s.loadFactor.toFixed(1)}`, lx - 40, cy + tapeH / 2 + 46, { size: 12, color: s.loadFactor > ac.spec.maxG * 0.85 ? AMBER : DIM });

  const altBugs = [];
  if (target && target.pos && target.kind !== 'runway') altBugs.push({ value: target.pos.y * M_TO_FT, color: CYAN });
  if (approach && approach.onFinal) altBugs.push({ value: (approach.runway.elevation + approach.gpHeight + ac.gearHeight) * M_TO_FT, color: CYAN });
  tape(ctx, rx, cy, tapeH, ft, 100, 500, 1, (x) => String(Math.round(x)), altBugs);
  readout(ctx, rx, cy, String(Math.round(ft / 10) * 10), 1, s.agl * M_TO_FT < 300 && !s.onGround && s.vel.y < -3 ? AMBER : GREEN);
  text(ctx, 'ALT FT', rx + 40, cy - tapeH / 2 - 14, { size: 11, color: DIM });
  const fpm = s.vel.y * MS_TO_FPM;
  text(ctx, `VS ${fpm >= 0 ? '+' : ''}${Math.round(fpm / 10) * 10}`, rx + 40, cy + tapeH / 2 + 14, { size: 12, color: fpm < -2000 ? AMBER : GREEN });
  text(ctx, `RA ${Math.max(0, Math.round(s.agl * M_TO_FT))}`, rx + 40, cy + tapeH / 2 + 30, { size: 12, color: DIM });
  if (altBugs[0]) text(ctx, `TGT ${Math.round(altBugs[0].value / 10) * 10}`, rx + 40, cy + tapeH / 2 + 46, { size: 12, color: CYAN });
  // vertical speed caret beside the altitude tape
  const vsy = clamp(cy - (fpm / 4000) * (tapeH / 2), cy - tapeH / 2, cy + tapeH / 2);
  ctx.fillStyle = CYAN;
  ctx.beginPath();
  ctx.moveTo(rx + 74, vsy);
  ctx.lineTo(rx + 84, vsy - 5);
  ctx.lineTo(rx + 84, vsy + 5);
  ctx.fill();

  // target marker / off-screen arrow
  if (target && target.pos) {
    const tp = project(camera, target.pos, w, h);
    const dist = ac.state.pos.distanceTo(target.pos);
    const label = `${target.label}  ${dist > 1852 ? `${(dist / 1852).toFixed(1)} NM` : `${Math.round(dist * M_TO_FT)} FT`}`;
    if (tp.onScreen) {
      const size = target.kind === 'ring' ? clamp((target.radius / Math.max(dist, 1)) * (h / (camera.fov * DEG)), 14, 140) : 16;
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(79,227,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(tp.x, tp.y - size);
      ctx.lineTo(tp.x + size, tp.y);
      ctx.lineTo(tp.x, tp.y + size);
      ctx.lineTo(tp.x - size, tp.y);
      ctx.closePath();
      ctx.stroke();
      text(ctx, label, tp.x, tp.y - size - 12, { size: 12, color: CYAN });
    } else {
      let dx = tp.x - cx;
      let dy = tp.y - cy;
      if (tp.behind) {
        dx = -dx;
        dy = -dy;
      }
      const a = Math.atan2(dy, dx);
      const rr = Math.min(w, h) * 0.34;
      const ax = cx + Math.cos(a) * rr;
      const ay = cy + Math.sin(a) * rr;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.fillStyle = CYAN;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-8, 10);
      ctx.fill();
      ctx.restore();
      text(ctx, label, ax, ay + 22, { size: 12, color: CYAN });
    }
  }

  // approach: synthetic runway, ILS deviation and landing cues
  if (approach && approach.distanceToThreshold < 15000 && !s.onGround) {
    const r = approach.runway;
    const corners = [r.pointAt(0, -r.width / 2, 0), r.pointAt(0, r.width / 2, 0), r.pointAt(r.length, r.width / 2, 0), r.pointAt(r.length, -r.width / 2, 0)].map((p) => project(camera, p, w, h));
    if (corners.every((c) => !c.behind)) {
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      const td = project(camera, r.touchdown, w, h);
      ctx.beginPath();
      ctx.arc(td.x, td.y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (approach.onFinal) {
      // glide-slope scale (right of centre) and localizer scale (below)
      const gx = cx + 150;
      for (let i = -2; i <= 2; i += 1) {
        ctx.strokeStyle = DIM;
        ctx.beginPath();
        ctx.arc(gx, cy + i * 22, i === 0 ? 1 : 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      const gsY = cy + clamp(approach.glideDots, -2.4, 2.4) * 22;
      ctx.fillStyle = Math.abs(approach.glideDots) < 0.7 ? GREEN : AMBER;
      ctx.beginPath();
      ctx.moveTo(gx, gsY - 8);
      ctx.lineTo(gx + 7, gsY);
      ctx.lineTo(gx, gsY + 8);
      ctx.lineTo(gx - 7, gsY);
      ctx.fill();
      text(ctx, 'GS', gx, cy - 62, { size: 11, color: DIM });
      const ly = cy + 120;
      for (let i = -2; i <= 2; i += 1) {
        ctx.strokeStyle = DIM;
        ctx.beginPath();
        ctx.arc(cx + i * 26, ly, i === 0 ? 1 : 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      const lx2 = cx - clamp(approach.locDots, -2.4, 2.4) * 26;
      ctx.fillStyle = Math.abs(approach.locDots) < 0.7 ? GREEN : AMBER;
      ctx.beginPath();
      ctx.moveTo(lx2 - 8, ly);
      ctx.lineTo(lx2, ly - 7);
      ctx.lineTo(lx2 + 8, ly);
      ctx.lineTo(lx2, ly + 7);
      ctx.fill();
      text(ctx, 'LOC', cx - 78, ly, { size: 11, color: DIM });
      // PAPI readout and guidance
      const white = d.papi ?? 0;
      for (let i = 0; i < 4; i += 1) {
        ctx.fillStyle = i < white ? '#ffffff' : '#ff3b30';
        ctx.beginPath();
        ctx.arc(cx - 27 + i * 18, ly + 30, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      const spd = kt - approach.targetSpeed * MS_TO_KT;
      const hints = [];
      hints.push(spd > 10 ? 'FAST' : spd < -8 ? 'SLOW' : 'SPEED OK');
      hints.push(approach.glideDots > 0.8 ? 'HIGH' : approach.glideDots < -0.8 ? 'LOW' : 'ON PATH');
      if (!s.gearDown && approach.distanceToThreshold < 8000) hints.push('GEAR');
      text(ctx, hints.join('  ·  '), cx, ly + 52, { size: 13, color: hints.some((x) => ['FAST', 'SLOW', 'HIGH', 'LOW', 'GEAR'].includes(x)) ? AMBER : GREEN });
      text(ctx, `RWY ${r.name}  ${(approach.distanceToThreshold / 1852).toFixed(1)} NM  REQ VS ${Math.round(approach.requiredVs * MS_TO_FPM / 10) * 10}`, cx, ly + 70, { size: 12, color: CYAN });
    }
  }

  // master warnings
  if (warnings.length) {
    const wtext = warnings[0];
    const blink = (performance.now() / 350) % 2 < 1.3;
    if (blink) {
      ctx.shadowColor = 'rgba(255,60,60,0.7)';
      const tw = 22 + wtext.length * 12;
      ctx.strokeStyle = RED;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - tw / 2, cy - 150, tw, 30);
      text(ctx, wtext, cx, cy - 134, { size: 18, color: RED, weight: 800 });
    }
    if (warnings[1]) text(ctx, warnings.slice(1, 3).join('  '), cx, cy - 104, { size: 13, color: AMBER });
  }
  ctx.restore();
}
