// AEROVANCE boot and the one loop. The app moves between the cinematic intro, the menu pages
// (over the live airbase scene), the hangar scene, a flight session and its debrief. A single
// requestAnimationFrame loop updates whichever is active and renders it.
//
// ?shot=menu|flight|cockpit|hangar|deck stages that screen deterministically for a screenshot
// and sets window.__shotReady once it has rendered.
import { createEngine } from './core/engine.js';
import { createInput } from './core/input.js';
import { createAudio } from './audio/audio.js';
import { buildEnvironment, previewEnvironment } from './world/environment.js';
import { createWeather } from './weather/weather.js';
import { createIntro } from './scenes/intro.js';
import { createHangarScene } from './scenes/hangar.js';
import { createHud } from './hud/hud.js';
import { createFlightSession } from './game/flightSession.js';
import { loadProfile, recordFlight, saveProfile } from './game/profile.js';
import { ALL_MISSIONS, findMission, MISSIONS } from './missions/missions.js';
import { AIRCRAFT } from './aircraft/specs.js';
import { introOverlay, mainMenu } from './ui/mainMenu.js';
import { flightDeck } from './ui/flightDeck.js';
import { hangarScreen } from './ui/hangarScreen.js';
import { missionsScreen } from './ui/missionsScreen.js';
import { resultsScreen } from './ui/resultsScreen.js';
import { careerScreen, pauseMenu, settingsScreen } from './ui/careerScreen.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const uiRoot = document.getElementById('ui-root');
const loading = document.getElementById('loading');
const loadingBar = document.getElementById('loading-bar');
const fader = document.getElementById('fader');
const status = document.getElementById('status');

const profile = loadProfile();
const engine = createEngine(document.getElementById('viewport'));
engine.setQuality(profile.settings.quality);
const input = createInput(document.getElementById('viewport'));
const audio = createAudio();
audio.setVolume(profile.settings.volume);
const hud = createHud(uiRoot, document.getElementById('hud-canvas'), { action: (a) => session?.action(a) });

let screen = 'boot';
let screenEl = null;
let menuEnv = null;
let menuWeather = null;
let intro = null;
let hangar = null;
let session = null;
let lastResult = null;
let lastFlight = null;
let pauseEl = null;
const previewCache = new Map();

const wait = () => new Promise((r) => setTimeout(r, 0));
function progress(p, msg) {
  loadingBar.style.width = `${Math.round(p * 100)}%`;
  let m = loading.querySelector('.msg');
  if (!m) {
    m = document.createElement('div');
    m.className = 'msg';
    loading.appendChild(m);
  }
  m.textContent = msg;
}

function setOverlay(el) {
  screenEl?.remove();
  screenEl = el;
  if (el) uiRoot.appendChild(el);
}

const app = window.__app = {
  profile,
  audio,
  engine,
  input,
  hangarAircraft: null,
  get session() {
    return session;
  },
  save: () => saveProfile(profile),
  applySettings() {
    input.setOptions({ sensitivity: profile.settings.sensitivity, invert: profile.settings.invert });
  },
  previewPlan(mission, aircraftId) {
    const key = `${mission.id}:${aircraftId}`;
    if (!previewCache.has(key)) {
      const env = previewEnvironment(mission.map);
      const ac = { gearHeight: { fighter: 2.4, airliner: 4.6, light: 1.55 }[aircraftId], spec: AIRCRAFT[aircraftId] };
      previewCache.set(key, mission.setup(env, ac));
    }
    return previewCache.get(key);
  },
  navigate(target) {
    if (session && target !== 'flight') endSession();
    pauseEl?.remove();
    pauseEl = null;
    screen = target;
    input.setOrbitWithLeft(target === 'hangar');
    hud.show(false);
    if (target === 'hangar') {
      hangar ??= createHangarScene(engine);
      if (!hangar.model || hangar.model.kind !== (app.hangarAircraft ?? profile.selection.aircraft)) hangar.setAircraft(app.hangarAircraft ?? profile.selection.aircraft);
      engine.setScene(hangar.scene);
      setOverlay(hangarScreen(app));
    } else {
      app.hangarAircraft = null;
      if (menuEnv) engine.setScene(menuEnv.scene);
      const build = { menu: mainMenu, deck: flightDeck, missions: (a) => missionsScreen(a, false), school: (a) => missionsScreen(a, true), career: careerScreen, settings: settingsScreen }[target];
      if (target === 'school' && !profile.selection.mission.startsWith('school')) profile.selection.mission = 'school-basics';
      if (target === 'missions' && profile.selection.mission.startsWith('school')) profile.selection.mission = 'first-takeoff';
      setOverlay(build ? build(app) : null);
    }
    app.save();
    status.textContent = `Screen: ${target}`;
  },
  showHangarAircraft(id) {
    app.hangarAircraft = id;
    hangar.setAircraft(id);
    setOverlay(hangarScreen(app));
  },
  hangarView(v) {
    hangar.setView(v);
  },
  skipIntro() {
    intro.toMenu();
    app.navigate('menu');
  },
  async startFlight(missionId, aircraftId) {
    audio.unlock();
    audio.ui('confirm');
    const mission = findMission(missionId);
    profile.selection.mission = missionId;
    profile.selection.aircraft = aircraftId;
    app.save();
    fader.classList.add('on');
    await new Promise((r) => setTimeout(r, 650));
    if (session) endSession();
    setOverlay(null);
    pauseEl?.remove();
    pauseEl = null;
    loading.classList.remove('done');
    loading.style.display = 'flex';
    progress(0.3, `LOADING ${mission.title}`);
    await wait();
    lastFlight = { missionId, aircraftId };
    session = createFlightSession({
      engine,
      input,
      audio,
      hud,
      mission,
      aircraftId,
      weather: { time: profile.selection.time ?? mission.time, condition: profile.selection.condition ?? mission.condition },
      cameraMode: profile.settings.camera,
      onEnd: (r) => {
        r.xp = recordFlight(profile, r);
        lastResult = r;
        app.lastObjectiveCount = session?.runner.objectives.length;
        screen = 'results';
        hud.show(false);
        input.setOrbitWithLeft(false);
        setOverlay(resultsScreen(app, r));
      },
    });
    app.lastObjectiveCount = session.runner.objectives.length;
    progress(1, 'READY');
    input.setOrbitWithLeft(false);
    screen = 'flight';
    hud.show(true);
    loading.classList.add('done');
    setTimeout(() => (loading.style.display = 'none'), 600);
    fader.classList.remove('on');
    const first = session.runner.current();
    hud.message(first?.hint ? first.hint.split('.')[0].toUpperCase() : `MISSION ${mission.code} · ${first?.label.toUpperCase() ?? ''}`, 'objective', 4);
    status.textContent = `Flying ${mission.title}`;
  },
  retry() {
    if (lastFlight) app.startFlight(lastFlight.missionId, lastFlight.aircraftId);
  },
  nextMission() {
    const list = lastFlight?.missionId.startsWith('school') ? ALL_MISSIONS : MISSIONS;
    const i = list.findIndex((m) => m.id === lastFlight?.missionId);
    const next = list[(i + 1) % list.length];
    profile.selection.mission = next.id;
    if (!next.allowed.includes(profile.selection.aircraft)) profile.selection.aircraft = next.aircraft;
    app.navigate('deck');
  },
  resume() {
    session?.setPaused(false);
    pauseEl?.remove();
    pauseEl = null;
  },
  abortFlight() {
    pauseEl?.remove();
    pauseEl = null;
    session?.runner.finish(false, 'Flight ended by pilot');
    session?.setPaused(false);
    session?.end();
  },
};

function endSession() {
  session?.dispose();
  session = null;
  hud.show(false);
}

window.addEventListener('pointerdown', () => audio.unlock());
window.addEventListener('keydown', () => audio.unlock());

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  engine.adapt(dt);
  if (screen === 'intro' || (screen !== 'hangar' && screen !== 'flight' && screen !== 'results' && menuEnv)) {
    const finished = intro.update(dt);
    menuWeather.update(dt, performance.now() / 1000, engine.camera, engine.renderer);
    menuEnv.update(dt, engine.camera, now / 1000, menuWeather.state.wind, intro.pilot.root.position);
    if (screen === 'intro' && finished) {
      fader.classList.add('on');
      setTimeout(() => {
        intro.toMenu();
        app.navigate('menu');
        fader.classList.remove('on');
      }, 700);
      screen = 'intro-out';
    }
    audio.idle(0.7);
    input.takePresses();
  } else if (screen === 'hangar') {
    hangar.update(dt, input.takeDrag());
    audio.idle(0.2);
    input.takePresses();
  } else if (screen === 'flight' && session) {
    const r = session.update(dt);
    if (r === 'pause' && !pauseEl) {
      session.setPaused(true);
      pauseEl = pauseMenu(app);
      uiRoot.appendChild(pauseEl);
      audio.idle(0);
    } else if (r === 'pause' && pauseEl) app.resume();
  } else if (screen === 'results' && session) {
    session.rig.update(dt, session.aircraft, session.env);
    session.env.update(dt, engine.camera, now / 1000, session.weather.state.wind, session.aircraft.state.pos);
    audio.idle(0.1);
    for (const p of input.takePresses()) if (p === 'retry') app.retry();
  }
  engine.render();
  requestAnimationFrame(frame);
}

async function boot() {
  loading.style.display = 'flex';
  progress(0.1, 'BUILDING IRONWOOD AIR BASE');
  await wait();
  menuEnv = buildEnvironment('airbase', { shadowSize: engine.shadowSize() });
  progress(0.7, 'PREPARING FLIGHT LINE');
  await wait();
  menuWeather = createWeather(menuEnv);
  menuWeather.apply('sunset', 'clear', 270);
  menuEnv.sun.setExtent(60);
  intro = createIntro(menuEnv, engine);
  engine.setScene(menuEnv.scene);
  app.applySettings();
  progress(1, 'READY');
  await wait();
  if (shot) {
    await stageShot(shot, { app, engine, intro, menuEnv, menuWeather, hud, getSession: () => session, getHangar: () => hangar, setScreen: (s) => (screen = s), params, input });
    loading.style.display = 'none';
    engine.render();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.__shotReady = true;
    return;
  }
  loading.classList.add('done');
  setTimeout(() => (loading.style.display = 'none'), 600);
  if (params.get('fly')) {
    intro.toMenu();
    app.navigate('menu');
    requestAnimationFrame(frame);
    app.startFlight(params.get('fly'), params.get('ac') ?? findMission(params.get('fly')).aircraft);
    return;
  }
  if (params.get('skip') === '1') {
    intro.toMenu();
    app.navigate('menu');
  } else {
    screen = 'intro';
    setOverlay(introOverlay(app));
  }
  requestAnimationFrame(frame);
}

boot();
