// The hangar overlay: aircraft tabs, detail-view buttons, and the specification sheet with
// comparison bars (the amber tick marks the other aircraft's best in each rating).
import { h, statBar } from './dom.js';
import { AIRCRAFT } from '../aircraft/specs.js';
import { performanceOf } from '../aircraft/aircraft.js';
import { HANGAR_VIEWS } from '../scenes/hangar.js';

const BLURB = {
  fighter: 'Twin afterburning engines, fly-by-wire rate control and a 9 G airframe. Fast, agile and thirsty: the afterburner burns fuel four times faster.',
  airliner: 'A 34 m wing with high-lift flaps, two high-bypass turbofans and slow, stable handling. Heavy and steady on the approach; plan descents early.',
  light: 'A forgiving high-wing trainer with a 125 kW piston engine, fixed gear and a low stall speed. Short landings and long endurance.',
};

export function hangarScreen(app) {
  const sel = app.profile.selection;
  const id = app.hangarAircraft ?? sel.aircraft;
  const spec = AIRCRAFT[id];
  const perf = performanceOf(id);
  const others = Object.keys(AIRCRAFT).filter((k) => k !== id).map(performanceOf);
  const best = (key) => Math.max(...others.map((o) => o.ratings[key]));
  const kv = (k, v) => h('div', { class: 'kv' }, [k, h('b', {}, v)]);
  return h('div', { class: 'page clear' }, [
    h('div', { class: 'page-head' }, [
      h('div', {}, [h('div', { class: 'crumb' }, 'BAY 03'), h('h1', {}, 'AIRCRAFT HANGAR')]),
      h('div', { class: 'right' }, ['DRAG TO ORBIT · WHEEL TO ZOOM', h('br'), 'SELECT A DETAIL VIEW']),
    ]),
    h('div', {}, [
      h('div', { class: 'hangar-left' }, [
        ...Object.values(AIRCRAFT).map((a) => h('button', {
          class: `ac-tab${a.id === id ? ' on' : ''}`,
          onclick: () => {
            app.audio.ui();
            app.showHangarAircraft(a.id);
          },
        }, [h('span', {}, a.className.toUpperCase()), h('b', {}, a.name)])),
        h('div', { class: 'views' }, HANGAR_VIEWS.map(([v, label]) => h('button', { class: 'chip', onclick: () => (app.audio.ui(), app.hangarView(v)) }, label))),
      ]),
      h('section', { class: 'panel card hangar-side' }, [
        h('header', {}, [h('span', { class: 'tag' }, 'SPECIFICATIONS'), h('span', {}, spec.className.toUpperCase())]),
        h('h2', {}, spec.name),
        h('p', {}, BLURB[id]),
        kv('Maximum speed', `${perf.maxSpeedKt} kt`),
        kv('Cruise speed', `${perf.cruiseKt} kt`),
        kv('Service ceiling', `${perf.ceilingFt.toLocaleString('en-US')} ft`),
        kv('Stall (clean / flaps)', `${perf.stallKt} / ${perf.stallFlapsKt} kt`),
        kv('Fuel capacity', `${spec.fuelCapacity.toLocaleString('en-US')} kg`),
        kv('Engine power', spec.engineType === 'piston' ? `${Math.round(spec.power / 1000)} kW piston` : `${perf.thrustKn} kN${spec.afterburnerThrust ? ' (A/B)' : ''}`),
        kv('Wing area / span', `${spec.wingArea} m² / ${spec.span} m`),
        kv('Roll rate', `${spec.rollRate}°/s`),
        kv('G limit', `${spec.maxG} G`),
        h('div', { class: 'hint', style: { padding: '10px 14px 4px' } }, 'FLIGHT CHARACTERISTICS (vs. best other type ▏)'),
        statBar('SPEED', perf.ratings.speed, best('speed')),
        statBar('ENGINE POWER', perf.ratings.power, best('power')),
        statBar('HANDLING', perf.ratings.handling, best('handling')),
        statBar('STABILITY', perf.ratings.stability, best('stability')),
        statBar('LANDING PERF.', perf.ratings.landing, best('landing')),
        statBar('ENDURANCE', perf.ratings.endurance, best('endurance')),
        h('div', { class: 'hint', style: { padding: '8px 14px 0' } }, 'Figures are computed from the same coefficients the flight model flies.'),
      ]),
    ]),
    h('div', { class: 'page-foot' }, [
      h('button', { class: 'btn ghost', onclick: () => app.navigate('menu') }, '◂ MAIN MENU'),
      h('button', {
        class: 'btn go',
        onclick: () => {
          sel.aircraft = id;
          app.save();
          app.audio.ui('confirm');
          app.navigate('deck');
        },
      }, sel.aircraft === id ? 'SELECTED · TO FLIGHT DECK ▸' : 'SELECT AIRCRAFT  ▸'),
    ]),
  ]);
}
