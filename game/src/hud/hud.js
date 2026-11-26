// The flight HUD layout: mission control (top left), heading strip (top centre), aircraft
// condition (top right), flight controls (bottom left), the six-pack (bottom centre), the
// navigation map (bottom right), and the centre symbology canvas. Every value is read from the
// live aircraft, mission runner and navigation solution each frame.
import { clamp, formatTime, M_TO_FT, MS_TO_KT } from '../core/math.js';
import { FLAP_DETENTS } from '../aircraft/aircraft.js';
import { drawCompass } from './compass.js';
import { drawInstruments } from './instruments.js';
import { drawMinimap } from './minimap.js';
import { drawFlightSymbology } from './flightSymbology.js';
import { h } from '../ui/dom.js';

function bar(label) {
  const fill = h('i');
  const value = h('b');
  const row = h('div', { class: 'cond-row' }, [h('span', {}, label), h('div', { class: 'cond-bar' }, fill), value]);
  return {
    row,
    set(v, text) {
      const pct = clamp(v, 0, 1) * 100;
      fill.style.width = `${pct}%`;
      fill.className = pct > 60 ? 'ok' : pct > 30 ? 'warn' : 'bad';
      value.textContent = text ?? `${Math.round(pct)}%`;
    },
  };
}

export function createHud(root, hudCanvas, callbacks) {
  const missionTitle = h('div', { class: 'mc-title' });
  const missionTimer = h('div', { class: 'mc-timer' });
  const objectiveList = h('ul', { class: 'mc-objectives' });
  const progress = h('div', { class: 'mc-progress' }, h('i'));
  const missionInfo = h('div', { class: 'mc-info' });
  const mission = h('section', { class: 'panel hud-mission' }, [h('header', {}, [h('span', { class: 'tag' }, 'MISSION CONTROL'), missionTimer]), missionTitle, objectiveList, progress, missionInfo]);

  const compassCanvas = h('canvas', { width: 560, height: 46 });
  const hdgBox = h('div', { class: 'hdg-box' });
  const tgtBox = h('div', { class: 'hdg-target' });
  const compass = h('section', { class: 'hud-compass' }, [compassCanvas, hdgBox, tgtBox]);

  const bars = { fuel: bar('FUEL'), engine: bar('ENGINE'), leftWing: bar('L WING'), rightWing: bar('R WING'), tail: bar('TAIL'), gear: bar('GEAR') };
  const endurance = h('div', { class: 'cond-endurance' });
  const silhouette = h('div', { class: 'cond-sil' });
  const condition = h('section', { class: 'panel hud-condition' }, [h('header', {}, [h('span', { class: 'tag' }, 'AIRCRAFT CONDITION'), endurance]), silhouette, ...Object.values(bars).map((b) => b.row)]);

  const throttleFill = h('i');
  const throttleVal = h('b');
  const rpmVal = h('b');
  const btn = (label, action) => {
    const el = h('button', { class: 'ctl-btn', onclick: () => callbacks.action(action) }, [h('em'), h('span', {}, label), h('small')]);
    return el;
  };
  const gearBtn = btn('GEAR', 'gear');
  const flapsBtn = btn('FLAPS', 'flapsDown');
  const brakeBtn = btn('BRAKE', 'parkingBrake');
  const engineBtn = btn('ENGINE', 'engine');
  const controls = h('section', { class: 'panel hud-controls' }, [
    h('header', {}, [h('span', { class: 'tag' }, 'FLIGHT CONTROL'), h('span', { class: 'cam-label' })]),
    h('div', { class: 'ctl-grid' }, [
      h('div', { class: 'throttle' }, [h('div', { class: 'throttle-track' }, throttleFill), h('label', {}, 'THR'), throttleVal]),
      h('div', { class: 'ctl-buttons' }, [engineBtn, gearBtn, flapsBtn, brakeBtn]),
      h('div', { class: 'rpm' }, [h('label', {}, 'RPM'), rpmVal]),
    ]),
  ]);
  const camLabel = controls.querySelector('.cam-label');

  const instCanvas = h('canvas', { width: 1080, height: 180 });
  const instruments = h('section', { class: 'panel hud-instruments' }, instCanvas);

  const mapCanvas = h('canvas', { width: 220, height: 220 });
  const mapRange = h('span', { class: 'map-range' });
  const map = h('section', { class: 'panel hud-map' }, [h('header', {}, [h('span', { class: 'tag' }, 'NAVIGATION'), mapRange]), mapCanvas]);

  const toast = h('div', { class: 'hud-toast' });
  const help = h('div', { class: 'hud-help hidden' }, [
    h('h3', {}, 'CONTROLS'),
    h('div', { class: 'keys' }, [
      ['W / S or drag', 'Pitch down / up'], ['A / D or drag', 'Roll'], ['Q / E', 'Rudder / steer'], ['Shift / Ctrl, wheel', 'Throttle'], ['0 / `', 'Full / idle'],
      ['Tab', 'Afterburner'], ['I', 'Engine start'], ['G', 'Gear'], ['F / V', 'Flaps down / up'], ['X', 'Wheel brakes'], ['B', 'Parking brake'],
      ['Z', 'Airbrake'], ['C, 1-5', 'Cameras'], ['Right drag', 'Look around'], ['N', 'Map range'], ['P / Esc', 'Pause'], ['M', 'Mute'], ['H', 'This help'],
    ].map(([k, v]) => h('div', {}, [h('kbd', {}, k), h('span', {}, v)]))),
  ]);
  const layer = h('div', { class: 'hud hidden' }, [mission, compass, condition, controls, instruments, map, toast, help]);
  root.appendChild(layer);

  const hctx = hudCanvas.getContext('2d');
  const cctx = compassCanvas.getContext('2d');
  const ictx = instCanvas.getContext('2d');
  const mctx = mapCanvas.getContext('2d');
  let toastTimer = 0;
  let lastObjectiveKey = '';

  function resize() {
    hudCanvas.width = window.innerWidth;
    hudCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function renderObjectives(runner) {
    const key = runner.objectives.map((o) => `${o.status}${o.progress}`).join('|') + runner.constraints.map((c) => c.ok).join('');
    if (key === lastObjectiveKey) return;
    lastObjectiveKey = key;
    objectiveList.replaceChildren(
      ...runner.objectives.map((o) => {
        const extra = o.type === 'rings' ? ` (${o.progress}/${o.rings.length})` : '';
        return h('li', { class: o.status }, [h('i'), h('span', {}, o.label + extra)]);
      }),
      ...runner.constraints.map((c) => h('li', { class: c.ok ? 'constraint' : 'constraint bad' }, [h('i'), h('span', {}, c.label)])),
    );
  }

  return {
    instCanvas,
    show(on) {
      layer.classList.toggle('hidden', !on);
      hudCanvas.style.display = on ? 'block' : 'none';
    },
    toggleHelp() {
      help.classList.toggle('hidden');
    },
    message(text, kind = 'ok', seconds = 2.5) {
      toast.textContent = text;
      toast.className = `hud-toast show ${kind}`;
      toastTimer = seconds;
    },
    /** Draw and fill everything for this frame. */
    update(dt, d) {
      const { aircraft: ac, runner, env, camera } = d;
      const s = ac.state;
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toast.classList.remove('show');
      }
      layer.classList.toggle('cockpit', d.cockpit);
      // mission control
      const m = runner.mission;
      missionTitle.textContent = `MISSION ${m.code}: ${m.title}`;
      missionTimer.textContent = m.timeLimit ? `${formatTime(runner.elapsed)} / ${formatTime(m.timeLimit)}` : formatTime(runner.elapsed);
      missionTimer.classList.toggle('late', m.timeLimit && runner.elapsed > m.timeLimit * 0.85);
      renderObjectives(runner);
      const done = runner.objectives.filter((o) => o.status === 'done').length;
      progress.firstChild.style.width = `${(done / runner.objectives.length) * 100}%`;
      const t = d.target;
      const dist = t ? ac.state.pos.distanceTo(t.pos) : 0;
      missionInfo.textContent = `${t ? `${t.label} · ${(dist / 1852).toFixed(1)} NM · ` : ''}DEST RWY ${d.destination ? d.destination.name : '--'} · ${done}/${runner.objectives.length} DONE`;

      // compass
      const hdg = ac.headingDeg();
      const track = ac.groundSpeed() > 5 ? (Math.atan2(s.vel.x, -s.vel.z) * 180) / Math.PI : null;
      drawCompass(cctx, compassCanvas.width, compassCanvas.height, hdg, d.targetBearing, d.windFrom, track);
      hdgBox.textContent = String(Math.round(hdg) % 360).padStart(3, '0');
      tgtBox.textContent = d.targetBearing != null ? `TGT ${String(Math.round(d.targetBearing) % 360).padStart(3, '0')}°  ·  WIND ${String(Math.round(d.windFrom)).padStart(3, '0')}/${Math.round(d.windKt)}KT` : `WIND ${Math.round(d.windFrom)}/${Math.round(d.windKt)}KT`;

      // condition
      const fuelPct = s.fuel / ac.spec.fuelCapacity;
      bars.fuel.set(fuelPct, `${Math.round(fuelPct * 100)}%`);
      bars.engine.set(s.engine === 'failed' ? 0 : s.health.engine, s.engine === 'failed' ? 'FAIL' : undefined);
      bars.leftWing.set(s.health.leftWing);
      bars.rightWing.set(s.health.rightWing);
      bars.tail.set(s.health.tail);
      bars.gear.set(s.health.gear, ac.spec.retractGear ? (s.gearPos > 0.99 ? 'DOWN' : s.gearPos < 0.01 ? 'UP' : 'TRANSIT') : 'FIXED');
      const endu = ac.endurance();
      endurance.textContent = Number.isFinite(endu) ? `ENDURANCE ${Math.floor(endu / 60)}:${String(Math.floor(endu % 60)).padStart(2, '0')}` : s.engine === 'running' ? 'ENDURANCE --' : 'ENGINE OFF';
      endurance.classList.toggle('late', Number.isFinite(endu) && endu < 5);
      silhouette.style.setProperty('--lw', s.health.leftWing);
      silhouette.style.setProperty('--rw', s.health.rightWing);
      silhouette.style.setProperty('--tl', s.health.tail);
      silhouette.style.setProperty('--en', s.health.engine);
      silhouette.className = `cond-sil sil-${ac.spec.id}`;

      // controls
      throttleFill.style.height = `${s.throttle * 100}%`;
      throttleFill.classList.toggle('ab', s.afterburner);
      throttleVal.textContent = s.afterburner ? 'A/B' : `${Math.round(s.throttle * 100)}%`;
      rpmVal.textContent = `${Math.round(s.rpm * 100)}%`;
      const setBtn = (el, state, sub) => {
        el.className = `ctl-btn ${state}`;
        el.querySelector('small').textContent = sub;
      };
      setBtn(engineBtn, s.engine === 'running' ? 'on' : s.engine === 'starting' ? 'transit' : 'off', s.engine.toUpperCase());
      setBtn(gearBtn, s.gearPos > 0.99 ? 'on' : s.gearPos < 0.01 ? 'off' : 'transit', ac.spec.retractGear ? (s.gearPos > 0.99 ? 'DOWN' : s.gearPos < 0.01 ? 'UP' : 'MOVING') : 'FIXED');
      setBtn(flapsBtn, s.flaps > 0.01 ? (Math.abs(s.flaps - FLAP_DETENTS[s.flapIndex]) > 0.01 ? 'transit' : 'on') : 'off', `${Math.round(s.flaps * 100)}%`);
      setBtn(brakeBtn, s.parkingBrake ? 'on' : s.brakes ? 'transit' : 'off', s.parkingBrake ? 'PARK' : s.brakes ? 'ON' : 'OFF');
      camLabel.textContent = `CAM ${d.cameraLabel}`;

      // instruments and map
      if (!d.cockpit) drawInstruments(ictx, instCanvas.width, instCanvas.height, ac, d.targetBearing);
      const range = drawMinimap(mctx, mapCanvas.width, mapCanvas.height, { env, aircraft: ac, runner, rangeIndex: d.mapRange });
      mapRange.textContent = `${Math.round(range / 1852)} NM`;

      drawFlightSymbology(hctx, hudCanvas.width, hudCanvas.height, { aircraft: ac, camera, target: t, approach: d.approach, warnings: d.warnings, cockpit: d.cockpit, papi: d.papi });
    },
    speedKt: (ac) => ac.state.airspeed * MS_TO_KT,
    altFt: (ac) => ac.state.pos.y * M_TO_FT,
  };
}
