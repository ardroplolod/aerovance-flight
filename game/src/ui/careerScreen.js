// Career (the pilot's logbook and records), Settings, and the in-flight pause menu.
import { h } from './dom.js';
import { MISSIONS, SCHOOL } from '../missions/missions.js';
import { rankOf } from '../game/profile.js';
import { AIRCRAFT } from '../aircraft/specs.js';

export function careerScreen(app) {
  const c = app.profile.career;
  const { rank, next } = rankOf(c.xp);
  const kv = (k, v) => h('div', { class: 'kv' }, [k, h('b', {}, v)]);
  const hours = c.seconds / 3600;
  return h('div', { class: 'page' }, [
    h('div', { class: 'page-head' }, [h('div', {}, [h('div', { class: 'crumb' }, 'LOGBOOK'), h('h1', {}, 'CAREER')]), h('div', { class: 'right' }, `PILOT ${app.profile.callsign}`)]),
    h('div', { class: 'grid3' }, [
      h('section', { class: 'panel card' }, [
        h('header', {}, [h('span', { class: 'tag' }, 'RANK')]),
        h('h2', {}, rank),
        kv('Experience', `${c.xp.toLocaleString('en-US')} XP`),
        kv('Next rank', next ? `${next[1]} at ${next[0].toLocaleString('en-US')} XP` : 'Highest rank'),
        h('div', { class: 'stat' }, [h('span', { class: 'stat-label' }, 'PROGRESS'), h('div', { class: 'stat-track' }, h('i', { style: { width: `${next ? Math.min(100, (c.xp / next[0]) * 100) : 100}%` } })), h('b', {}, '')]),
      ]),
      h('section', { class: 'panel card' }, [
        h('header', {}, [h('span', { class: 'tag' }, 'LOGBOOK')]),
        kv('Flights', String(c.flights)),
        kv('Flight time', `${Math.floor(hours)} h ${Math.round((hours % 1) * 60)} min`),
        kv('Distance', `${(c.distance / 1852).toFixed(0)} NM`),
        kv('Landings', String(c.landings)),
        kv('Perfect landings', String(c.perfect)),
        kv('Crashes', String(c.crashes)),
      ]),
      h('section', { class: 'panel card' }, [
        h('header', {}, [h('span', { class: 'tag' }, 'MISSION RECORDS')]),
        ...[...MISSIONS, ...SCHOOL].map((m) => {
          const b = c.best[m.id];
          return kv(`${m.code} ${m.title}`, b ? `${b.score} · ${b.rating} · ${AIRCRAFT[b.aircraft].name.split(' ')[1]}` : '—');
        }),
      ]),
    ]),
    h('div', { class: 'page-foot' }, [h('button', { class: 'btn ghost', onclick: () => app.navigate('menu') }, '◂ MAIN MENU'), h('span')]),
  ]);
}

export function settingsScreen(app) {
  const s = app.profile.settings;
  const row = (label, control) => h('div', { class: 'settings-row' }, [label, control]);
  const range = (key, min, max, step, apply) => h('input', {
    type: 'range',
    min,
    max,
    step,
    value: s[key],
    oninput: (e) => {
      s[key] = Number(e.target.value);
      apply?.(s[key]);
      app.save();
    },
  });
  const chips = (key, options, apply) => h('div', { class: 'selector', style: { padding: 0 } }, options.map(([v, label]) => h('button', {
    class: `chip${s[key] === v ? ' on' : ''}`,
    onclick: () => {
      s[key] = v;
      apply?.(v);
      app.save();
      app.audio.ui();
      app.navigate('settings');
    },
  }, label)));
  return h('div', { class: 'page' }, [
    h('div', { class: 'page-head' }, [h('div', {}, [h('div', { class: 'crumb' }, 'SYSTEM'), h('h1', {}, 'SETTINGS')]), h('div', { class: 'right' }, 'SAVED AUTOMATICALLY')]),
    h('section', { class: 'panel card', style: { width: '640px', alignSelf: 'start' } }, [
      h('header', {}, [h('span', { class: 'tag' }, 'GRAPHICS · AUDIO · CONTROLS')]),
      row('RENDER QUALITY', chips('quality', [['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH']], (v) => app.engine.setQuality(v))),
      row('MASTER VOLUME', range('volume', 0, 1, 0.05, (v) => app.audio.setVolume(v))),
      row('MOUSE YOKE SENSITIVITY', range('sensitivity', 0.4, 2, 0.1, () => app.applySettings())),
      row('INVERT PITCH', chips('invert', [[false, 'NORMAL'], [true, 'INVERTED']], () => app.applySettings())),
      row('DEFAULT CAMERA', chips('camera', [['chase', 'CHASE'], ['cockpit', 'COCKPIT']])),
      h('p', { class: 'hint' }, 'Resolution also adapts automatically when the frame rate drops below 40 fps.'),
    ]),
    h('div', { class: 'page-foot' }, [h('button', { class: 'btn ghost', onclick: () => app.navigate('menu') }, '◂ MAIN MENU'), h('span')]),
  ]);
}

export function pauseMenu(app) {
  return h('div', { class: 'pause' }, [
    h('section', { class: 'panel interactive' }, [
      h('header', {}, [h('span', { class: 'tag' }, 'PAUSED')]),
      h('button', { class: 'btn go', onclick: () => app.resume() }, 'RESUME'),
      h('button', { class: 'btn', onclick: () => app.retry() }, 'RESTART MISSION'),
      h('button', { class: 'btn', onclick: () => app.abortFlight() }, 'END FLIGHT · DEBRIEF'),
      h('button', { class: 'btn ghost', onclick: () => app.navigate('deck') }, 'RETURN TO FLIGHT DECK'),
    ]),
  ]);
}
