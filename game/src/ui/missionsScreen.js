// Mission select and Flight School: the list on the left, the briefing of the highlighted one on
// the right with its map, aircraft, conditions, objectives and best result.
import { h } from './dom.js';
import { MISSIONS, SCHOOL, findMission } from '../missions/missions.js';
import { AIRCRAFT } from '../aircraft/specs.js';
import { MAPS } from '../world/maps/index.js';
import { TIMES, CONDITIONS } from '../weather/weather.js';
import { formatTime } from '../core/math.js';

export function missionsScreen(app, school = false) {
  const list = school ? SCHOOL : MISSIONS;
  const p = app.profile;
  const current = list.find((m) => m.id === p.selection.mission) ?? list[0];
  const kv = (k, v) => h('div', { class: 'kv' }, [k, h('b', {}, v)]);
  const plan = app.previewPlan(current, current.allowed.includes(p.selection.aircraft) ? p.selection.aircraft : current.aircraft);
  return h('div', { class: 'page' }, [
    h('div', { class: 'page-head' }, [
      h('div', {}, [h('div', { class: 'crumb' }, school ? 'TRAINING' : 'OPERATIONS'), h('h1', {}, school ? 'FLIGHT SCHOOL' : 'FLIGHT MISSIONS')]),
      h('div', { class: 'right' }, school ? 'GUIDED LESSONS · HINTS ON SCREEN' : `${list.length} MISSIONS · 5 REGIONS`),
    ]),
    h('div', { class: 'two-col' }, [
      h('div', { class: 'mission-list' }, list.map((m) => {
        const best = p.career.best[m.id];
        return h('button', {
          class: `mission-row${m.id === current.id ? ' on' : ''}`,
          onmouseenter: () => app.audio.ui('hover'),
          onclick: () => {
            p.selection.mission = m.id;
            app.audio.ui();
            app.navigate(school ? 'school' : 'missions');
          },
        }, [
          h('span', { class: 'code' }, m.code),
          h('span', {}, [h('b', {}, m.title), h('small', {}, `${MAPS[m.map].name} · ${AIRCRAFT[m.aircraft].name}`), best ? h('span', { class: 'best' }, `BEST ${best.score} · ${best.rating}`) : null]),
          h('span', { class: `diff ${m.difficulty}` }, m.difficulty),
        ]);
      })),
      h('section', { class: 'panel card', style: { overflow: 'auto' } }, [
        h('header', {}, [h('span', { class: 'tag' }, 'BRIEFING'), h('span', {}, `M${current.code}`)]),
        h('h2', {}, current.title),
        h('p', {}, current.briefing),
        kv('Region', MAPS[current.map].name),
        kv('Recommended aircraft', AIRCRAFT[current.aircraft].name),
        kv('Allowed aircraft', current.allowed.map((a) => AIRCRAFT[a].name.split(' ')[1]).join(', ')),
        kv('Conditions', `${TIMES[current.time].label} · ${CONDITIONS[current.condition].label} · wind ${current.windDir}°`),
        kv('Start', plan.start.onGround ? 'On the runway, engine off' : `Airborne at ${Math.round(plan.start.position.y * 3.28)} ft`),
        kv('Destination', plan.destination ? `RWY ${plan.destination.name}` : '--'),
        kv('Time limit', formatTime(current.timeLimit)),
        kv('Difficulty', current.difficulty),
        kv('Reward', `${current.reward} XP`),
        ...plan.objectives.map((o, i) => kv(`${i + 1}.`, o.label)),
        ...(school ? plan.objectives.filter((o) => o.hint).map((o) => h('p', { class: 'hint' }, `▸ ${o.hint}`)) : []),
      ]),
    ]),
    h('div', { class: 'page-foot' }, [
      h('button', { class: 'btn ghost', onclick: () => app.navigate('menu') }, '◂ MAIN MENU'),
      h('div', { style: { display: 'flex', gap: '10px' } }, [
        h('button', { class: 'btn', onclick: () => app.navigate('deck') }, 'FLIGHT DECK'),
        h('button', { class: 'btn go', onclick: () => app.startFlight(current.id, current.allowed.includes(p.selection.aircraft) ? p.selection.aircraft : current.aircraft) }, 'FLY NOW  ▸'),
      ]),
    ]),
  ]);
}

export { findMission };
