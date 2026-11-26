// The main menu over the live airbase scene, and the intro's letterbox overlay with SKIP INTRO.
import { h } from './dom.js';
import { AIRCRAFT } from '../aircraft/specs.js';
import { findMission } from '../missions/missions.js';
import { rankOf } from '../game/profile.js';

export function introOverlay(app) {
  return h('div', { class: 'screen letterbox' }, [
    h('div', { class: 'intro-caption' }, ['IRONWOOD AIR BASE · 18:42 LOCAL', h('b', {}, 'AEROVANCE')]),
    h('button', { class: 'skip', onclick: () => app.skipIntro() }, 'SKIP INTRO  ▸'),
  ]);
}

export function mainMenu(app) {
  const p = app.profile;
  const { rank } = rankOf(p.career.xp);
  const items = [
    ['ENTER FLIGHT DECK', 'Brief, configure and launch', 'deck', true],
    ['AIRCRAFT HANGAR', 'Inspect and select aircraft', 'hangar'],
    ['FLIGHT MISSIONS', '8 missions across 5 regions', 'missions'],
    ['FLIGHT SCHOOL', 'Guided lessons with hints', 'school'],
    ['CAREER', 'Logbook, rank and records', 'career'],
    ['SETTINGS', 'Graphics, audio, controls', 'settings'],
  ];
  const list = h('div', { class: 'menu-list' }, items.map(([label, sub, target, primary], i) => h('button', {
    class: `menu-item${primary ? ' primary' : ''}`,
    onmouseenter: () => app.audio.ui('hover'),
    onclick: () => {
      app.audio.ui('confirm');
      app.navigate(target);
    },
  }, [h('span', { class: 'num' }, String(i + 1).padStart(2, '0')), h('span', {}, [label, h('small', {}, sub)])])));
  const ac = AIRCRAFT[p.selection.aircraft];
  const m = findMission(p.selection.mission);
  return h('div', { class: 'screen' }, [
    h('div', { class: 'vignette' }),
    h('div', { class: 'menu-left' }, [
      h('div', { class: 'logo' }, 'AEROVANCE'),
      h('div', { class: 'logo-sub' }, 'ADVANCED FLIGHT EXPERIENCE'),
      h('div', { class: 'logo-rule' }),
      list,
    ]),
    h('section', { class: 'panel menu-card' }, [
      h('header', {}, [h('span', { class: 'tag' }, 'PILOT'), h('span', {}, p.callsign)]),
      h('div', { class: 'row' }, ['RANK', h('b', {}, rank)]),
      h('div', { class: 'row' }, ['AIRCRAFT', h('b', {}, ac.name)]),
      h('div', { class: 'row' }, ['NEXT SORTIE', h('b', {}, `M${m.code} ${m.title}`)]),
      h('div', { class: 'row' }, ['FLIGHTS LOGGED', h('b', {}, String(p.career.flights))]),
    ]),
    h('div', { class: 'menu-footer' }, 'IRONWOOD AIR BASE · RWY 27 ACTIVE · WIND 270/04 · v1.0'),
  ]);
}
