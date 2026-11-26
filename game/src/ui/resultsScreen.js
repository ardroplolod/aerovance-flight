// The post-flight debrief: outcome, final score and rating, flight statistics, landing grades and
// aircraft condition, with RETRY, NEXT MISSION and RETURN TO FLIGHT DECK.
import { h, statBar } from './dom.js';
import { formatTime, MS_TO_KT, M_TO_FT } from '../core/math.js';
import { AIRCRAFT } from '../aircraft/specs.js';

export function resultsScreen(app, r) {
  const s = r.score;
  const kv = (k, v) => h('div', { class: 'kv' }, [k, h('b', {}, v)]);
  const L = r.landing;
  const health = r.health;
  const condPct = Math.round(s.condition * 100);
  const ratingClass = s.rating.split(' ')[0];
  return h('div', { class: 'results' }, [
    h('section', { class: 'panel results-card interactive' }, [
      h('header', {}, [h('span', { class: 'tag' }, 'FLIGHT DEBRIEF'), h('span', {}, `${AIRCRAFT[r.aircraftId].name.toUpperCase()}`)]),
      h('div', { class: 'results-top' }, [
        h('div', {}, [
          h('div', { class: 'sub' }, `MISSION ${r.mission.code}`),
          h('h1', {}, r.mission.title),
          h('div', { class: `outcome ${r.success ? 'ok' : 'fail'}` }, r.success ? 'MISSION COMPLETE' : `MISSION FAILED · ${r.reason.toUpperCase()}`),
          r.xp != null ? h('div', { class: 'hint', style: { marginTop: '6px' } }, `+${r.xp} XP`) : null,
        ]),
        h('div', { class: 'rating' }, [h('div', { class: 'hint' }, 'FINAL SCORE'), h('div', { class: 'score' }, String(s.total)), h('div', { class: `label ${ratingClass}` }, s.rating)]),
      ]),
      h('div', { class: 'results-grid' }, [
        h('div', {}, [
          kv('Flight duration', formatTime(r.elapsed)),
          kv('Maximum altitude', `${Math.round(s.stats.maxAltFt).toLocaleString('en-US')} ft`),
          kv('Maximum speed', `${Math.round(s.stats.maxSpeed * MS_TO_KT)} kt`),
          kv('Peak load factor', `${s.stats.maxG.toFixed(1)} G`),
          kv('Checkpoints completed', `${s.stats.checkpoints} / ${s.stats.totalCheckpoints}`),
          kv('Objectives completed', `${s.doneCount} / ${r.mission ? app.lastObjectiveCount ?? '-' : '-'}`),
          kv('Distance flown', `${(s.stats.distance / 1852).toFixed(1)} NM`),
          kv('Fuel remaining', `${Math.round(r.fuelPct * 100)}%`),
          kv('Aircraft condition', `${condPct}% (eng ${Math.round(health.engine * 100)} · wings ${Math.round(health.leftWing * 100)}/${Math.round(health.rightWing * 100)} · tail ${Math.round(health.tail * 100)} · gear ${Math.round(health.gear * 100)})`),
          kv('Score breakdown', `obj ${s.parts.objectivePts} · cp ${s.parts.checkpointPts} · time ${s.parts.timeBonus} · land ${s.parts.landingPts} · fuel ${s.parts.fuelPts} · cond ${s.parts.conditionPts}${s.parts.penalty ? ` · -${s.parts.penalty}` : ''}`),
        ]),
        h('div', {}, L ? [
          kv('Landing quality', `${L.percent}% · ${L.rating}`),
          kv('Touchdown', `${Math.round(-L.vsFpm)} fpm · ${Math.round(L.airspeedKt)} kt · ${Math.round(L.along * M_TO_FT)} ft past threshold`),
          statBar('VERTICAL IMPACT', L.scores.sink),
          statBar('LANDING SPEED', L.scores.speed),
          statBar('TOUCHDOWN POINT', L.scores.position),
          statBar('CENTRELINE', L.scores.centreline),
          statBar('ALIGNMENT', L.scores.alignment),
          statBar('BRAKING DIST.', L.scores.braking),
          statBar('STABILITY', L.scores.stability),
          kv('Roll-out', `${Math.round(L.rolloutFt).toLocaleString('en-US')} ft${L.arrested ? ' · ARRESTED' : ''}${L.bounces ? ` · ${L.bounces} bounce` : ''}`),
        ] : [h('p', { class: 'hint', style: { padding: '14px' } }, 'No completed landing on this flight.')]),
      ]),
      h('div', { class: 'results-actions' }, [
        h('button', { class: 'btn', onclick: () => app.retry() }, 'RETRY'),
        h('button', { class: 'btn', onclick: () => app.nextMission() }, 'NEXT MISSION'),
        h('button', { class: 'btn go', onclick: () => app.navigate('deck') }, 'RETURN TO FLIGHT DECK'),
      ]),
    ]),
  ]);
}
