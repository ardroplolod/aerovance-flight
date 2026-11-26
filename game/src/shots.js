// Screenshot staging behind ?shot=. Each scene is the real game: the real menu over the intro
// scene, a real flight session placed at a moment of the mission and flown forward by the flight
// model for a couple of seconds, the real hangar. Nothing is drawn that the game does not draw.
import * as THREE from 'three';
import { bearingTo } from './nav/navigation.js';

const frames = (n) => new Promise((resolve) => {
  let i = 0;
  const tick = () => (++i >= n ? resolve() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
});

/** Fly the session forward with the controls held neutral (the throttle where it was set). */
function advance(ctx, seconds) {
  const session = ctx.getSession();
  for (let t = 0; t < seconds; t += 1 / 60) session.update(1 / 60);
}

/** Put the aircraft at `pos` heading at `target` at `speed`, gear and flaps as given. */
function place(session, pos, target, speed, { gear = false, flaps = 0, throttle = 0.6, climb = 0 } = {}) {
  const ac = session.aircraft;
  const heading = bearingTo(pos, target);
  const dist = Math.hypot(target.x - pos.x, target.z - pos.z);
  const pitch = (Math.atan2(target.y - pos.y, dist) * 180) / Math.PI + climb;
  ac.spawn({ position: pos, heading, speed, pitch, onGround: false, engine: 'running', throttle, gearDown: gear, flaps, fuel: 0.72 });
  ac.state.vel.copy(target.clone().sub(pos).normalize().multiplyScalar(speed));
}

export async function stageShot(name, ctx) {
  const { app, engine, intro, params, input } = ctx;
  document.body.classList.add('shot');
  document.getElementById('fader').style.transition = 'none';
  document.getElementById('loading').style.transition = 'none';
  if (name === 'menu') {
    intro.toMenu();
    app.navigate('menu');
    intro.seek(Number(params.get('t') ?? 10));
    ctx.setScreen('menu');
    for (let i = 0; i < 3; i += 1) {
      intro.update(1 / 60);
      ctx.menuEnv.update(1 / 60, engine.camera, 1, ctx.menuWeather.state.wind, intro.pilot.root.position);
      engine.render();
    }
    await frames(3);
  } else if (name === 'flight') {
    app.profile.selection.time = null;
    app.profile.selection.condition = null;
    await app.startFlight('mountain', 'fighter');
    const session = ctx.getSession();
    const rings = session.runner.objectives[0];
    const k = Number(params.get('ring') ?? 4);
    rings.progress = k;
    const ring = rings.rings[k];
    const prev = rings.rings[k - 1];
    const from = prev.pos.clone().lerp(ring.pos, 0.42).add(new THREE.Vector3(0, 6, 0));
    place(session, from, ring.pos.clone().add(new THREE.Vector3(0, 4, 0)), 165, { throttle: 0.62 });
    input.setThrottle(0.62);
    session.rig.setMode('chase');
    session.aircraft.controls.roll = Number(params.get('roll') ?? 0.25);
    advance(ctx, 0.6);
    await frames(4);
  } else if (name === 'cockpit') {
    app.profile.selection.time = params.get('time');
    app.profile.selection.condition = null;
    await app.startFlight('mountain', 'fighter');
    const session = ctx.getSession();
    session.runner.skipTo('land');
    const r = session.runner.current().runway;
    const km = Number(params.get('km') ?? 4.5);
    const from = r.pointAt(-km * 1000, 0, 0);
    from.y = r.elevation + (300 + km * 1000) * Math.tan((3 * Math.PI) / 180) + 2.4 + 25;
    place(session, from, r.touchdown.clone().setY(r.elevation + 2.4), session.aircraft.spec.approachSpeed * 1.05, { gear: true, flaps: 2, throttle: 0.42 });
    input.setThrottle(0.42);
    session.rig.setMode(params.get('cam') ?? 'cockpit');
    advance(ctx, 0.8);
    await frames(4);
  } else if (name === 'hangar') {
    app.hangarAircraft = params.get('ac') ?? 'fighter';
    app.navigate('hangar');
    const hangar = ctx.getHangar();
    hangar.setView(params.get('view') ?? 'overview');
    hangar.snap();
    hangar.update(0, { x: 0, y: 0, wheel: 0 });
    engine.render();
    await frames(3);
  } else if (name === 'intro') {
    intro.seek(Number(params.get('t') ?? 8));
    intro.update(1 / 60);
    ctx.menuEnv.update(1 / 60, engine.camera, 1, ctx.menuWeather.state.wind, intro.pilot.root.position);
    await frames(3);
  } else if (name === 'deck') {
    intro.toMenu();
    intro.seek(6);
    app.navigate('deck');
    ctx.setScreen('deck');
    await frames(3);
  }
  if (params.get('hud') === '0') {
    document.querySelector('.hud')?.classList.add('hidden');
    document.getElementById('hud-canvas').style.display = 'none';
  }
  if (params.get('toast') !== '1') document.querySelector('.hud-toast')?.classList.remove('show');
  engine.render();
}
