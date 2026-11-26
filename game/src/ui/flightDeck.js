// The flight deck dashboard before launch: aircraft status, flight information and mission
// information panels, with selectors for aircraft, time of day and weather, and the launch button.
import { h } from './dom.js';
import { AIRCRAFT } from '../aircraft/specs.js';
import { performanceOf } from '../aircraft/aircraft.js';
import { MAPS } from '../world/maps/index.js';
import { findMission } from '../missions/missions.js';
import { TIMES, CONDITIONS } from '../weather/weather.js';
import { formatTime } from '../core/math.js';

/** Great-circle-free estimate: sum of legs between the mission's points, for distance and time. */
export function routeEstimate(mission, plan, perf) {
  let prev = plan.start.position.clone();
  let dist = 0;
  for (const o of plan.objectives) {
    const pts = o.type === 'rings' ? o.rings.map((r) => r.pos) : o.type === 'waypoint' ? [o.pos] : o.type === 'land' ? [o.runway.touchdown] : [];
    for (const p of pts) {
      dist += prev.distanceTo(p);
      prev = p.clone();
    }
  }
  const speed = Math.max(40, perf.cruiseKt * 0.514 * (mission.map === 'valley' ? 0.75 : 0.85));
  return { km: dist / 1000, seconds: dist / speed };
}

export function flightDeck(app) {
  const p = app.profile;
  const sel = p.selection;
  const mission = findMission(sel.mission);
  if (!mission.allowed.includes(sel.aircraft)) sel.aircraft = mission.aircraft;
  const spec = AIRCRAFT[sel.aircraft];
  const perf = performanceOf(sel.aircraft);
  const time = sel.time ?? mission.time;
  const cond = sel.condition ?? mission.condition;
  const c = CONDITIONS[cond];
  const plan = app.previewPlan(mission, sel.aircraft);
  const est = routeEstimate(mission, plan, perf);
  const map = MAPS[mission.map];
  const fuelPct = Math.round((mission.fuel ?? 0.85) * 100);
  const enduranceMin = Math.round((perf.enduranceMin * (mission.fuel ?? 0.85)));
  const ready = est.seconds / 60 < enduranceMin;
  const kv = (k, v, cls) => h('div', { class: 'kv' }, [k, h('b', { class: cls }, v)]);
  const chips = (items, current, onPick) => h('div', { class: 'selector' }, items.map(([id, label, disabled]) => h('button', {
    class: `chip${id === current ? ' on' : ''}`,
    disabled: disabled || null,
    onclick: () => {
      app.audio.ui();
      onPick(id);
      app.navigate('deck');
    },
  }, label)));

  return h('div', { class: 'page' }, [
    h('div', { class: 'page-head' }, [
      h('div', {}, [h('div', { class: 'crumb' }, 'PRE-FLIGHT'), h('h1', {}, 'FLIGHT DECK')]),
      h('div', { class: 'right' }, [`PILOT ${p.callsign}`, h('br'), `${map.name.toUpperCase()}`]),
    ]),
    h('div', { class: 'grid3' }, [
      h('section', { class: 'panel card' }, [
        h('header', {}, [h('span', { class: 'tag' }, 'AIRCRAFT STATUS'), h('span', {}, spec.className.toUpperCase())]),
        h('h2', {}, spec.name),
        chips(Object.values(AIRCRAFT).map((a) => [a.id, a.name.split(' ')[1].toUpperCase(), !mission.allowed.includes(a.id)]), sel.aircraft, (id) => (sel.aircraft = id)),
        kv('Aircraft model', spec.model),
        kv('Aircraft class', spec.className),
        kv('Fuel level', `${fuelPct}% · ${Math.round(spec.fuelCapacity * (mission.fuel ?? 0.85))} kg`),
        kv('Engine condition', '100% · NOMINAL', 'good'),
        kv('Airframe condition', '100% · NOMINAL', 'good'),
        kv('Landing gear', spec.retractGear ? 'RETRACTABLE · CHECKED' : 'FIXED · CHECKED', 'good'),
        kv('Endurance at cruise', `${enduranceMin} min`),
        h('div', { class: 'readiness' }, ready ? 'FLIGHT READY' : 'CHECK FUEL'),
      ]),
      h('section', { class: 'panel card' }, [
        h('header', {}, [h('span', { class: 'tag' }, 'FLIGHT INFORMATION'), h('span', {}, map.description.toUpperCase())]),
        h('h2', {}, map.name),
        kv('Current location', plan.start.onGround ? `${map.name} · RWY ${plan.destination.name}` : `Airborne · ${Math.round(plan.start.position.y * 3.28)} ft`),
        kv('Destination', plan.destination ? `RWY ${plan.destination.name}${plan.destination.deck ? ' (DECK)' : ''}` : '--'),
        kv('Weather', `${TIMES[time].label} · ${c.label}`),
        kv('Wind', `${String(mission.windDir).padStart(3, '0')}° / ${Math.round(c.wind * 1.94)} kt, gusts ${Math.round((c.wind + c.gust) * 1.94)}`),
        kv('Visibility', `${Math.min(50, 1.73 / (c.fog * 1000)).toFixed(0)} km`),
        kv('Flight distance', `${est.km.toFixed(1)} km · ${(est.km / 1.852).toFixed(1)} NM`),
        kv('Estimated duration', formatTime(est.seconds)),
        h('div', { class: 'hint', style: { padding: '8px 14px 0' } }, 'TIME OF DAY'),
        chips(Object.entries(TIMES).map(([id, t]) => [id, t.label.toUpperCase()]), time, (id) => (sel.time = id)),
        h('div', { class: 'hint', style: { padding: '6px 14px 0' } }, 'CONDITIONS'),
        chips(Object.entries(CONDITIONS).map(([id, t]) => [id, t.label.toUpperCase()]), cond, (id) => (sel.condition = id)),
      ]),
      h('section', { class: 'panel card' }, [
        h('header', {}, [h('span', { class: 'tag' }, 'MISSION INFORMATION'), h('span', { class: `diff ${mission.difficulty}` }, mission.difficulty)]),
        h('h2', {}, `M${mission.code} · ${mission.title}`),
        h('p', {}, mission.briefing),
        ...plan.objectives.map((o, i) => kv(`Objective ${i + 1}`, o.label)),
        kv('Target runway', plan.destination ? `RWY ${plan.destination.name} · ${Math.round(plan.destination.length)} m` : '--'),
        kv('Required aircraft', mission.allowed.length === 3 ? 'ANY (recommended ' + AIRCRAFT[mission.aircraft].name + ')' : AIRCRAFT[mission.aircraft].name),
        kv('Time limit', formatTime(mission.timeLimit)),
        kv('Reward', `${mission.reward} XP`),
        kv('Best score', p.career.best[mission.id] ? `${p.career.best[mission.id].score} · ${p.career.best[mission.id].rating}` : '--', 'warn'),
      ]),
    ]),
    h('div', { class: 'page-foot' }, [
      h('div', { style: { display: 'flex', gap: '10px' } }, [
        h('button', { class: 'btn ghost', onclick: () => app.navigate('menu') }, '◂ MAIN MENU'),
        h('button', { class: 'btn', onclick: () => app.navigate('missions') }, 'CHANGE MISSION'),
        h('button', { class: 'btn', onclick: () => app.navigate('hangar') }, 'HANGAR'),
      ]),
      h('button', { class: 'btn go', onclick: () => app.startFlight(mission.id, sel.aircraft) }, 'START FLIGHT  ▸'),
    ]),
  ]);
}
