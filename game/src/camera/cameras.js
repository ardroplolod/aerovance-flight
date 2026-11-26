// The camera system: five views, each with its own smoothing. Cockpit (the pilot's eye, with
// G-load head sway), Chase (behind and above, lagging the flight path so turns read), Cinematic
// (fly-by stations placed ahead of the aircraft), Side (a wingman's view), and Landing Approach
// (a fixed spot beside the runway threshold, zooming to keep the aircraft framed).
import * as THREE from 'three';
import { clamp, damp } from '../core/math.js';

export const CAMERA_MODES = [
  { id: 'cockpit', label: 'COCKPIT' },
  { id: 'chase', label: 'CHASE' },
  { id: 'cinematic', label: 'CINEMATIC' },
  { id: 'side', label: 'SIDE' },
  { id: 'approach', label: 'APPROACH' },
];

export function createCameraRig(camera) {
  let mode = 'chase';
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const smoothedFwd = new THREE.Vector3(0, 0, -1);
  const station = new THREE.Vector3();
  let stationAge = 999;
  let orbit = { yaw: 0, pitch: 0, zoom: 1 };
  let snap = true;
  const fwd = new THREE.Vector3();
  const acUp = new THREE.Vector3();
  const right = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function setMode(next) {
    mode = next;
    snap = true;
    stationAge = 999;
    orbit = { yaw: 0, pitch: 0, zoom: 1 };
  }

  return {
    get mode() {
      return mode;
    },
    setMode,
    cycle() {
      const i = CAMERA_MODES.findIndex((m) => m.id === mode);
      setMode(CAMERA_MODES[(i + 1) % CAMERA_MODES.length].id);
      return mode;
    },
    update(dt, aircraft, env, drag = { x: 0, y: 0, wheel: 0 }) {
      const s = aircraft.state;
      const model = aircraft.model;
      fwd.set(0, 0, -1).applyQuaternion(s.quat);
      acUp.set(0, 1, 0).applyQuaternion(s.quat);
      right.set(1, 0, 0).applyQuaternion(s.quat);
      const size = model.length;
      orbit.yaw += drag.x * 0.005;
      orbit.pitch = clamp(orbit.pitch + drag.y * 0.004, -0.6, 1.0);
      orbit.zoom = clamp(orbit.zoom * (1 + drag.wheel * 0.001), 0.4, 3);
      let fov = 60;

      if (mode === 'cockpit') {
        const eye = model.eye.clone().applyQuaternion(s.quat).add(s.pos);
        const g = clamp(s.loadFactor - 1, -2, 6);
        eye.addScaledVector(acUp, -g * 0.012);
        pos.copy(eye);
        look.copy(eye).addScaledVector(fwd, 50).addScaledVector(acUp, -4.0);
        tmp.copy(fwd).applyAxisAngle(acUp, -orbit.yaw * 1.2);
        if (orbit.yaw !== 0) look.copy(eye).addScaledVector(tmp, 50);
        up.copy(acUp);
        fov = 74;
        camera.near = 0.1;
      } else {
        camera.near = 0.5;
        if (mode === 'chase') {
          const vel = tmp.copy(s.vel);
          const dir = vel.lengthSq() > 25 ? vel.normalize() : fwd.clone();
          smoothedFwd.lerp(dir, snap ? 1 : 1 - Math.exp(-dt * 3)).normalize();
          const dist = (size * 1.3 + 6) * orbit.zoom;
          const back = smoothedFwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit.yaw);
          const want = s.pos.clone().addScaledVector(back, -dist).add(new THREE.Vector3(0, size * 0.32 + 2 + orbit.pitch * dist, 0));
          if (snap) pos.copy(want);
          else pos.lerp(want, 1 - Math.exp(-dt * 7));
          look.copy(s.pos).addScaledVector(fwd, size * 0.6).add(new THREE.Vector3(0, size * 0.08, 0));
          up.lerp(new THREE.Vector3(0, 1, 0).lerp(acUp, 0.25), 1 - Math.exp(-dt * 3)).normalize();
          fov = 58 + clamp((s.airspeed - 80) / 25, 0, 10);
        } else if (mode === 'side') {
          const flatRight = new THREE.Vector3(right.x, 0, right.z).normalize();
          const dist = (size * 1.3 + 10) * orbit.zoom;
          const want = s.pos.clone().addScaledVector(flatRight, dist).addScaledVector(fwd, -size * 0.25).add(new THREE.Vector3(0, size * 0.12, 0));
          want.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0);
          if (snap) pos.copy(want);
          else pos.lerp(want, 1 - Math.exp(-dt * 5));
          look.copy(s.pos);
          up.set(0, 1, 0);
          fov = 50;
        } else if (mode === 'cinematic') {
          stationAge += dt;
          const away = station.distanceTo(s.pos);
          if (snap || stationAge > 14 || (away > size * 30 && stationAge > 3)) {
            const lead = Math.max(s.airspeed * 4, size * 6);
            station.copy(s.pos).addScaledVector(s.vel.lengthSq() > 4 ? s.vel.clone().normalize() : fwd, lead).addScaledVector(right, (stationAge % 2 > 1 ? -1 : 1) * size * 2.2);
            const ground = env.groundAt(station.x, station.z).height;
            station.y = Math.max(station.y + size * 0.4, ground + 3);
            stationAge = 0;
          }
          pos.copy(station);
          look.copy(s.pos);
          up.set(0, 1, 0);
          fov = clamp(2400 / Math.max(pos.distanceTo(s.pos), 1) * (size / 18), 8, 60);
        } else if (mode === 'approach') {
          const runway = env.runways.reduce((best, r) => (!best || r.threshold.distanceTo(s.pos) < best.threshold.distanceTo(s.pos) ? r : best), null);
          if (runway) {
            pos.copy(runway.threshold).addScaledVector(runway.fwd, runway.deck ? 40 : 180).addScaledVector(runway.right, runway.deck ? 40 : 70);
            pos.y = runway.elevation + (runway.deck ? 14 : 9);
          } else {
            pos.copy(s.pos).add(new THREE.Vector3(80, 20, 80));
          }
          look.copy(s.pos);
          up.set(0, 1, 0);
          fov = clamp((3000 / Math.max(pos.distanceTo(s.pos), 1)) * (size / 18), 4, 55);
        }
        // keep external cameras above the ground
        const g = env.groundAt(pos.x, pos.z).height + 1.5;
        if (pos.y < g) pos.y = g;
      }
      camera.fov = snap ? fov : damp(camera.fov, fov, 4, dt);
      camera.updateProjectionMatrix();
      camera.position.copy(pos);
      camera.up.copy(up);
      camera.lookAt(look);
      snap = false;
    },
  };
}
