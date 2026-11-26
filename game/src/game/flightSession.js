// One flight from spawn to result: builds the mission's environment and weather, spawns the
// aircraft, runs physics at a fixed 120 Hz, routes flight events to the landing evaluator and the
// mission runner, raises cockpit warnings, drives cameras, HUD, cockpit and audio, and reports the
// final result.
import { buildEnvironment } from '../world/environment.js';
import { createWeather } from '../weather/weather.js';
import { Aircraft } from '../aircraft/aircraft.js';
import { createCockpit } from '../aircraft/cockpit.js';
import { createCameraRig, CAMERA_MODES } from '../camera/cameras.js';
import { createMissionRunner } from '../missions/missionRunner.js';
import { createLandingEvaluator } from '../landing/landingEvaluator.js';
import { approachSolution, bearingTo, nearestRunway } from '../nav/navigation.js';
import { drawInstruments } from '../hud/instruments.js';
import { createParticles } from '../effects/particles.js';
import { disposeTree } from '../core/geometry.js';
import { MS_TO_KT, MS_TO_FPM } from '../core/math.js';

const STEP = 1 / 120;

export function createFlightSession({ engine, input, audio, hud, mission, aircraftId, weather: weatherChoice, onEnd, cameraMode = 'chase' }) {
  const env = buildEnvironment(mission.map, { shadowSize: engine.shadowSize() });
  const weather = createWeather(env);
  weather.apply(weatherChoice?.time ?? mission.time, weatherChoice?.condition ?? mission.condition, mission.windDir);
  const aircraft = new Aircraft(aircraftId);
  env.scene.add(aircraft.model.group);
  const cockpit = createCockpit(aircraft.model, aircraft.spec.id);
  const plan = mission.setup(env, aircraft);
  const st = plan.start;
  const spawnPos = st.position.clone();
  if (st.onGround) spawnPos.y = env.groundAt(spawnPos.x, spawnPos.z).height + aircraft.gearHeight;
  aircraft.spawn({
    position: spawnPos,
    heading: st.heading,
    speed: st.speed ?? 0,
    onGround: !!st.onGround,
    throttle: st.throttle,
    gearDown: st.gear ?? !!st.onGround,
    flaps: st.flaps ?? (st.onGround ? 1 : 0),
    fuel: mission.fuel ?? 0.85,
  });
  if (!st.onGround) aircraft.state.rates.set(0, 0, 0);
  input.setThrottle(aircraft.state.throttle);
  const runner = createMissionRunner(mission, env, aircraft, plan);
  const landing = createLandingEvaluator(aircraft);
  const rig = createCameraRig(engine.camera);
  rig.setMode(cameraMode);
  const particles = createParticles(env.scene);
  let accumulator = 0;
  let time = 0;
  let paused = false;
  let ended = false;
  let crashTimer = -1;
  let endTimer = -1;
  let mapRange = 1;
  let touchedDown = false;
  let lastSurface = 'runway';
  const warnings = [];
  engine.setScene(env.scene);

  function landingRunway() {
    const o = runner.current();
    if (o && o.type === 'land') return o.runway;
    return nearestRunway(env.runways, aircraft.state.pos);
  }

  function handleEvents(events) {
    for (const ev of events) {
      if (ev.type === 'touchdown') {
        const rwy = landingRunway();
        const judged = landing.onTouchdown(ev, rwy, ev.surface === 'deck');
        const strength = Math.min(1, -ev.verticalSpeed / 4);
        if (judged.outcome === 'crash') crash(judged.reason);
        else {
          touchedDown = true;
          audio.touchdown(strength);
          particles.tyreSmoke(aircraft.state.pos.clone().setY(aircraft.state.pos.y - aircraft.gearHeight), strength + 0.5);
          const vs = Math.round(ev.verticalSpeed * MS_TO_FPM);
          hud.message(judged.outcome === 'hard' ? `HARD LANDING ${vs} FPM` : judged.outcome === 'offrunway' ? 'OFF RUNWAY' : `TOUCHDOWN ${vs} FPM`, judged.outcome === 'ok' ? 'ok' : 'warn', 3);
        }
      } else if (ev.type === 'liftoff') {
        hud.message(`ROTATE · LIFTOFF ${Math.round(ev.speed * MS_TO_KT)} KT`, 'ok', 2);
        touchedDown = false;
      } else if (ev.type === 'stall') {
        hud.message('STALL', 'warn', 1.5);
      } else if (ev.type === 'arrested') {
        hud.message('WIRE CAUGHT · TRAP', 'objective', 3);
      } else if (ev.type === 'tailstrike') {
        hud.message('TAIL STRIKE', 'warn', 2);
      }
    }
  }

  function crash(reason) {
    if (aircraft.state.crashed) return;
    aircraft.state.crashed = true;
    aircraft.state.vel.set(0, 0, 0);
    aircraft.state.engine = 'off';
    audio.crash();
    particles.explosion(aircraft.state.pos.clone());
    aircraft.model.group.visible = false;
    hud.message(`CRASH · ${reason.toUpperCase()}`, 'warn', 5);
    runner.finish(false, reason);
    crashTimer = 4;
    rig.setMode('cinematic');
  }

  function action(name) {
    const s = aircraft.state;
    if (s.crashed) return;
    if (name === 'gear') {
      const msg = aircraft.toggleGear();
      if (msg === 'GEAR UP' || msg === 'GEAR DOWN') audio.gear();
      hud.message(msg, msg.startsWith('GEAR') ? 'ok' : 'warn', 1.5);
    } else if (name === 'flapsDown' || name === 'flapsUp') {
      const before = s.flapIndex;
      hud.message(aircraft.setFlaps(name === 'flapsDown' ? 1 : -1), 'ok', 1.2);
      if (before !== s.flapIndex) audio.flaps();
    } else if (name === 'engine') {
      const msg = aircraft.startEngine();
      if (msg === 'ENGINE START') audio.starter();
      hud.message(msg, msg === 'ENGINE START' || msg === 'ENGINE RUNNING' ? 'ok' : 'warn', 2);
    } else if (name === 'parkingBrake') {
      s.parkingBrake = !s.parkingBrake;
      hud.message(s.parkingBrake ? 'PARKING BRAKE SET' : 'PARKING BRAKE OFF', 'ok', 1.2);
    } else if (name === 'camera') {
      const m = rig.cycle();
      hud.message(`CAMERA · ${CAMERA_MODES.find((c) => c.id === m).label}`, 'ok', 1);
    } else if (name.startsWith('cam')) {
      const m = CAMERA_MODES[Number(name.slice(3)) - 1];
      if (m) rig.setMode(m.id);
    } else if (name === 'nav') {
      mapRange = (mapRange + 1) % 4;
    } else if (name === 'help') {
      hud.toggleHelp();
    }
  }

  function updateWarnings() {
    const s = aircraft.state;
    const spec = aircraft.spec;
    warnings.length = 0;
    if (s.crashed) return;
    const descending = s.vel.y < -2;
    const timeToImpact = descending ? s.agl / -s.vel.y : Infinity;
    if (!s.onGround && timeToImpact < 9 && s.agl < 300 && !(s.gearDown && Math.abs(s.vel.y) < 6 && landingRunway()?.toLocal(s.pos).along > -2500)) {
      warnings.push('PULL UP');
      audio.alert('terrain');
    }
    if (s.stalled) {
      warnings.push('STALL');
      audio.alert('stall');
    }
    if (s.engine === 'failed' || (s.failure && s.engine !== 'running')) {
      warnings.push(s.failure ?? 'ENGINE FAIL');
      audio.alert('engine');
    }
    if (!s.onGround && spec.retractGear && !s.gearDown && s.agl < 250 && descending && s.airspeed < spec.approachSpeed * 1.5) {
      warnings.push('GEAR');
      audio.alert('gear');
    }
    if (s.airspeed > spec.vne) {
      warnings.push('OVERSPEED');
      audio.alert('overspeed');
    }
    if (Math.abs(s.loadFactor) > spec.maxG && !s.onGround) warnings.push('OVER-G');
    if (s.fuel < spec.fuelCapacity * 0.1) {
      warnings.push('LOW FUEL');
      audio.alert('fuel');
    }
    if (!s.onGround && Math.abs(aircraft.bankDeg()) > 60 && s.agl < 300) warnings.push('BANK ANGLE');
  }

  function step(dt) {
    const controls = input.flight(dt, true);
    const events = aircraft.update(controls, { groundAt: env.groundAt, wind: weather.state.wind, turbulence: weather.state.turbulence }, dt);
    handleEvents(events);
    const s = aircraft.state;
    if (s.crashed) return;
    // ground hazards while rolling
    if (s.onGround) {
      if (s.surface === 'water') crash('Ditched in the water');
      if (s.surface !== lastSurface && (s.surface === 'grass' || s.surface === 'sand' || s.surface === 'rock') && aircraft.groundSpeed() > 30) {
        s.health.gear = Math.max(0, s.health.gear - 0.25);
        hud.message('RUNWAY EXCURSION', 'warn', 2);
      }
      if (s.surface === 'rock' && aircraft.groundSpeed() > 15) crash('Struck rocks');
      lastSurface = s.surface;
      if (touchedDown && aircraft.groundSpeed() < 1.5) {
        touchedDown = false;
        const result = landing.onStopped(s.arrested);
        if (result) {
          const o = runner.current();
          const rwy = o?.type === 'land' ? o.runway : null;
          const wantDeck = o?.deck;
          const ok = rwy && result.onRunway && (!wantDeck || result.arrested);
          if (ok) {
            hud.message(`LANDING ${result.rating} · ${result.percent}%`, 'objective', 4);
            runner.landed(result);
          } else if (o?.type === 'land') {
            hud.message(wantDeck && !result.arrested ? 'NO WIRE CAUGHT' : 'NOT ON THE TARGET RUNWAY', 'warn', 4);
            runner.finish(false, wantDeck ? 'Missed the arresting wires' : 'Landed away from the target runway');
          }
        }
      }
    }
    if (s.health.gear <= 0.02 && s.onGround && aircraft.groundSpeed() > 10) crash('Landing gear collapsed');
    runner.update(dt, time);
    landing.track(landingRunway());
  }

  return {
    env,
    aircraft,
    runner,
    rig,
    weather,
    get paused() {
      return paused;
    },
    setPaused(p) {
      paused = p;
    },
    action,
    update(frameDt) {
      const dt = Math.min(frameDt, 0.1);
      for (const p of input.takePresses()) {
        if (p === 'pause') return 'pause';
        if (p === 'mute') hud.message(audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON', 'ok', 1);
        else action(p);
      }
      if (paused || ended) return null;
      time += dt;
      accumulator += dt;
      while (accumulator >= STEP) {
        step(STEP);
        accumulator -= STEP;
      }
      const s = aircraft.state;
      aircraft.syncModel(time);
      particles.update(dt);
      if (s.crashed && Math.random() < dt * 8) particles.smoke(s.pos);
      if (s.onGround && (s.surface === 'grass' || s.surface === 'sand') && aircraft.groundSpeed() > 8) particles.dust(s.pos.clone().setY(s.pos.y - aircraft.gearHeight));
      weather.update(dt, time, engine.camera, engine.renderer);
      updateWarnings();
      const drag = input.takeDrag();
      rig.update(dt, aircraft, env, rig.mode === 'cockpit' ? { x: drag.x, y: 0, wheel: 0 } : drag);
      const cockpitView = rig.mode === 'cockpit';
      cockpit.group.visible = cockpitView;
      if (aircraft.model.helmet) aircraft.model.helmet.visible = !cockpitView;
      env.update(dt, engine.camera, time, weather.state.wind, s.pos);
      const target = runner.target();
      const rwy = landingRunway();
      const phase = runner.current()?.type;
      const approach = rwy && (phase === 'land' || phase === 'gate' || !phase) ? approachSolution(aircraft, rwy) : null;
      if (cockpitView) {
        drawInstruments(cockpit.ctx, cockpit.canvas.width, cockpit.canvas.height, aircraft, target ? bearingTo(s.pos, target.pos) : null);
        cockpit.update(aircraft.controls, s.throttle);
      }
      const windKt = (weather.state.gustSpeed ?? 0) * MS_TO_KT;
      hud.update(dt, {
        aircraft,
        runner,
        env,
        camera: engine.camera,
        target,
        targetBearing: target ? bearingTo(s.pos, target.pos) : null,
        approach,
        papi: approach ? approach.runway.papiWhite(s.pos) : 0,
        warnings,
        cockpit: cockpitView,
        cameraLabel: CAMERA_MODES.find((c) => c.id === rig.mode).label,
        mapRange,
        destination: plan.destination,
        windFrom: weather.state.windDir,
        windKt,
      });
      audio.flight({
        engineType: aircraft.spec.engineType,
        rpm: s.rpm,
        power: s.rpmPower,
        afterburner: s.afterburner,
        airspeed: s.airspeed,
        running: s.engine === 'running',
        starting: s.engine === 'starting',
        cockpit: cockpitView,
        rain: weather.state.rain ?? 0,
      });
      // mission feed -> toasts
      while (runner.feed.length) {
        const f = runner.feed.shift();
        hud.message(f.text, f.kind, f.kind === 'objective' ? 3 : 2);
        if (f.kind === 'checkpoint') audio.checkpoint();
        if (f.kind === 'objective') audio.objective();
      }
      if (crashTimer > 0) {
        crashTimer -= dt;
        if (crashTimer <= 0) end();
      } else if (runner.done && !ended) {
        if (endTimer < 0) endTimer = runner.done.success ? 3 : 2;
        endTimer -= dt;
        if (endTimer <= 0) end();
      }
      return null;
    },
    /** Stage a frame for a screenshot without running the clock. */
    settle(seconds) {
      for (let t = 0; t < seconds; t += STEP) step(STEP);
    },
    end,
    dispose() {
      runner.dispose();
      disposeTree(env.scene);
    },
  };

  function end() {
    if (ended) return;
    ended = true;
    const score = runner.score();
    onEnd?.({
      mission,
      aircraftId,
      success: !!runner.done?.success,
      reason: runner.done?.reason ?? 'Flight ended',
      score,
      elapsed: runner.elapsed,
      fuelPct: aircraft.state.fuel / aircraft.spec.fuelCapacity,
      health: { ...aircraft.state.health },
      landing: score.landing,
    });
  }
}
