// The navigation map: a heading-up moving map around the aircraft over the terrain picture, with
// runways, rings and waypoints (next one highlighted), the destination, a route line, range rings
// and the aircraft symbol. The wheel-free zoom steps with N.
import { DEG } from '../core/math.js';

export const MAP_RANGES = [3000, 6000, 12000, 24000];

export function drawMinimap(ctx, w, h, { env, aircraft, runner, rangeIndex = 1, headingUp = true }) {
  const range = MAP_RANGES[rangeIndex];
  const s = aircraft.state;
  const hdg = aircraft.headingDeg();
  const scale = (w / 2) / range;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#06121a';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  if (headingUp) ctx.rotate(-hdg * DEG);
  // terrain picture: world (x, z) -> map (x, z)
  const size = env.size;
  ctx.globalAlpha = 0.85;
  ctx.drawImage(env.minimap, (-size / 2 - s.pos.x) * scale, (-size / 2 - s.pos.z) * scale, size * scale, size * scale);
  ctx.globalAlpha = 1;
  const P = (p) => [(p.x - s.pos.x) * scale, (p.z - s.pos.z) * scale];
  // range rings
  ctx.strokeStyle = 'rgba(120,200,220,0.18)';
  ctx.lineWidth = 1;
  for (const f of [0.5, 1]) {
    ctx.beginPath();
    ctx.arc(0, 0, (w / 2) * f, 0, Math.PI * 2);
    ctx.stroke();
  }
  // runways
  for (const r of env.runways) {
    const a = P(r.threshold);
    const b = P(r.end);
    ctx.strokeStyle = '#e8eef2';
    ctx.lineWidth = Math.max(3, r.width * scale);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    // extended centreline
    const ext = P(r.pointAt(-9000, 0, 0));
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(ext[0], ext[1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // mission points and route
  if (runner) {
    const route = [];
    runner.objectives.forEach((o) => {
      if (o.type === 'rings') {
        o.rings.forEach((r, i) => {
          const done = o.status === 'done' || i < o.progress;
          const active = o.status === 'active' && i === o.progress;
          const [x, y] = P(r.pos);
          if (!done) route.push([x, y]);
          ctx.strokeStyle = done ? 'rgba(80,120,130,0.6)' : active ? '#35f2c2' : '#ffc24a';
          ctx.lineWidth = active ? 2.5 : 1.5;
          ctx.beginPath();
          ctx.arc(x, y, active ? 6 : 4, 0, Math.PI * 2);
          ctx.stroke();
        });
      } else if (o.type === 'waypoint') {
        const [x, y] = P(o.pos);
        if (o.status !== 'done') route.push([x, y]);
        ctx.fillStyle = o.status === 'done' ? 'rgba(80,120,130,0.7)' : o.status === 'active' ? '#4fe3ff' : '#ffc24a';
        ctx.beginPath();
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x + 6, y);
        ctx.lineTo(x, y + 7);
        ctx.lineTo(x - 6, y);
        ctx.fill();
        ctx.save();
        ctx.translate(x, y);
        if (headingUp) ctx.rotate(hdg * DEG);
        ctx.font = '600 10px "Helvetica Neue", Arial';
        ctx.textAlign = 'center';
        ctx.fillText(o.name, 0, -11);
        ctx.restore();
      } else if (o.type === 'land' && o.status !== 'done') {
        route.push(P(o.runway.touchdown));
      }
    });
    const t = runner.target();
    if (route.length) {
      ctx.strokeStyle = 'rgba(79,227,255,0.6)';
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (const [x, y] of route) ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (t && t.kind === 'runway') {
      const [x, y] = P(t.pos);
      ctx.strokeStyle = '#4fe3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  // aircraft symbol (fixed, pointing up in heading-up mode)
  ctx.save();
  ctx.translate(w / 2, h / 2);
  if (!headingUp) ctx.rotate(hdg * DEG);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(7, 7);
  ctx.lineTo(0, 3);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // frame and north marker
  ctx.strokeStyle = 'rgba(120,200,220,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
  const na = (headingUp ? -hdg : 0) * DEG - Math.PI / 2;
  ctx.fillStyle = '#ffc24a';
  ctx.font = '700 12px "Helvetica Neue", Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', w / 2 + Math.cos(na) * (w / 2 - 12), h / 2 + Math.sin(na) * (h / 2 - 12));
  return range;
}
