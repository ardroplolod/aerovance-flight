// The horizontal heading strip: a smoothly scrolling tape with cardinal letters, 5 degree ticks,
// the current heading box, the target bearing bug and the wind arrow.
import { angleDiff, wrap360 } from '../core/math.js';

export function drawCompass(ctx, w, h, heading, targetBearing, windFrom, track) {
  ctx.clearRect(0, 0, w, h);
  const span = 90;
  const pxPer = w / span;
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.12, 'rgba(0,0,0,1)');
  grad.addColorStop(0.88, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = 'rgba(6,16,24,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#cfe9f2';
  ctx.fillStyle = '#cfe9f2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const start = Math.floor((heading - span / 2) / 5) * 5;
  for (let d = start; d <= heading + span / 2; d += 5) {
    const x = w / 2 + (d - heading) * pxPer;
    const deg = wrap360(d);
    const major = deg % 10 === 0;
    ctx.globalAlpha = 1 - Math.min(1, Math.abs(x - w / 2) / (w / 2)) * 0.8;
    ctx.lineWidth = major ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(x, h - 4);
    ctx.lineTo(x, h - (major ? 14 : 8));
    ctx.stroke();
    if (deg % 30 === 0) {
      const card = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg];
      ctx.font = card ? '700 15px "Helvetica Neue", Arial' : '600 12px "SF Mono", Menlo, monospace';
      ctx.fillStyle = card ? '#ffc24a' : '#cfe9f2';
      ctx.fillText(card ?? String(deg / 10).padStart(2, '0'), x, h - 20);
    } else if (deg % 45 === 0) {
      ctx.font = '600 11px "Helvetica Neue", Arial';
      ctx.fillStyle = '#8fb6c4';
      ctx.fillText({ 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' }[deg], x, h - 20);
    }
  }
  ctx.globalAlpha = 1;
  if (track != null) {
    const x = w / 2 + angleDiff(heading, track) * pxPer;
    ctx.strokeStyle = '#5dffa8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, h - 6, 3.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (targetBearing != null) {
    const diff = angleDiff(heading, targetBearing);
    const x = Math.max(8, Math.min(w - 8, w / 2 + diff * pxPer));
    ctx.fillStyle = '#4fe3ff';
    ctx.beginPath();
    ctx.moveTo(x, h - 2);
    ctx.lineTo(x - 7, h - 12);
    ctx.lineTo(x - 7, h - 16);
    ctx.lineTo(x + 7, h - 16);
    ctx.lineTo(x + 7, h - 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
