// The aircraft hangar: a lit maintenance bay (epoxy floor with bay markings, ribbed walls, roof
// trusses, light banks and spotlights with soft shadows, tool carts and stands) where the selected
// aircraft sits on a turntable. The camera orbits with the mouse, zooms with the wheel and flies
// to detail views (engine, cockpit, wing, tail, landing gear).
import * as THREE from 'three';
import { canvasTexture, disposeTree } from '../core/geometry.js';
import { buildModel } from '../aircraft/aircraft.js';
import { clamp, damp } from '../core/math.js';

function floorTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#5a6066';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i += 1) {
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#d9b62a';
    ctx.lineWidth = 10;
    ctx.strokeRect(w * 0.12, h * 0.12, w * 0.76, h * 0.76);
    ctx.setLineDash([40, 30]);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.88);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(217,182,42,0.9)';
    ctx.font = 'bold 44px "Helvetica Neue", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BAY 03 · AEROVANCE FLIGHT SYSTEMS', w / 2, h * 0.95);
  }, { anisotropy: 16 });
}

function wallTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3c454d';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 12) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, 0, 5, h);
    }
    ctx.fillStyle = 'rgba(255,200,40,0.85)';
    for (let x = 0; x < w; x += 40) {
      ctx.save();
      ctx.translate(x, h - 18);
      ctx.transform(1, 0, -1, 1, 0, 0);
      ctx.fillRect(0, 0, 20, 18);
      ctx.restore();
    }
  }, { repeat: [8, 1] });
}

const VIEWS = {
  overview: { yaw: 0.75, pitch: 0.32, dist: 1.25, target: [0, 0.1, 0] },
  cockpit: { yaw: 1.2, pitch: 0.35, dist: 0.3, target: 'cockpit' },
  engine: { yaw: 2.55, pitch: 0.12, dist: 0.42, target: 'engine' },
  wing: { yaw: 0.3, pitch: 0.55, dist: 0.6, target: 'wing' },
  tail: { yaw: 2.8, pitch: 0.3, dist: 0.5, target: 'tail' },
  gear: { yaw: 1.4, pitch: -0.05, dist: 0.38, target: 'gear' },
};
export const HANGAR_VIEWS = [['overview', 'OVERVIEW'], ['cockpit', 'COCKPIT'], ['engine', 'ENGINE'], ['wing', 'WINGS'], ['tail', 'TAIL'], ['gear', 'LANDING GEAR']];

const FOCUS = {
  fighter: { cockpit: [0, 0.9, -4.6], engine: [0, 0, 8.5], wing: [4, -0.2, 1.5], tail: [0, 2, 5.5], gear: [1.4, -1.6, 1.1] },
  airliner: { cockpit: [0, 0.6, -16.5], engine: [6.2, -2.5, -7], wing: [10, -0.6, 1], tail: [0, 5, 16], gear: [3.3, -3.4, 1.6] },
  light: { cockpit: [0, 0.6, -1.4], engine: [0, 0, -3.6], wing: [3.5, 1, -0.7], tail: [0, 0.9, 3.8], gear: [1.2, -1.1, -0.6] },
};

export function createHangarScene(engine) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f14);
  scene.fog = new THREE.Fog(0x0b0f14, 90, 190);
  const W = 90;
  const D = 70;
  const H = 24;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.32, metalness: 0.15 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.8, metalness: 0.2, side: THREE.BackSide });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat);
  shell.position.y = H / 2 - 0.06;
  shell.receiveShadow = true;
  scene.add(shell);
  // roof trusses and light banks
  const steel = new THREE.MeshStandardMaterial({ color: 0x59636c, roughness: 0.5, metalness: 0.7 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xf6f1e4, toneMapped: false });
  for (let z = -D / 2 + 8; z < D / 2; z += 11) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W, 0.6, 0.5), steel);
    beam.position.set(0, H - 2.5, z);
    scene.add(beam);
    for (let x = -30; x <= 30; x += 15) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 0.9), lamp);
      strip.position.set(x, H - 3, z + 2);
      scene.add(strip);
    }
  }
  for (const x of [-W / 2 + 0.5, W / 2 - 0.5]) {
    for (let z = -D / 2 + 6; z < D / 2; z += 12) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, H, 0.8), steel);
      col.position.set(x, H / 2, z);
      scene.add(col);
    }
  }
  // a banner on the back wall
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 5),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(1024, 144, (ctx, w, h) => {
        ctx.fillStyle = '#0b1c2c';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#4fe3ff';
        ctx.fillRect(0, h - 8, w, 8);
        ctx.fillStyle = '#f2f6f8';
        ctx.font = '800 76px "Helvetica Neue", Arial';
        ctx.textAlign = 'center';
        ctx.fillText('A E R O V A N C E', w / 2, 96);
      }),
    }),
  );
  banner.position.set(0, H - 7, -D / 2 + 0.2);
  scene.add(banner);
  // turntable
  const table = new THREE.Mesh(new THREE.CylinderGeometry(16, 16.4, 0.3, 64), new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.35, metalness: 0.6 }));
  table.position.y = 0.15;
  table.receiveShadow = true;
  scene.add(table);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(16.2, 0.08, 6, 96), new THREE.MeshBasicMaterial({ color: 0x4fe3ff, toneMapped: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.32;
  scene.add(ring);
  // props: tool carts, stands, chocks
  const cartMat = new THREE.MeshStandardMaterial({ color: 0xb8262a, roughness: 0.5, metalness: 0.3 });
  for (const [x, z, r] of [[-26, 14, 0.4], [24, -12, -0.7], [-30, -18, 1.2]]) {
    const cart = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.0), cartMat);
    cart.position.set(x, 0.75, z);
    cart.rotation.y = r;
    cart.castShadow = true;
    scene.add(cart);
  }
  for (const [x, z] of [[-34, 6], [33, 10], [30, 22]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.4), new THREE.MeshStandardMaterial({ color: 0x5b5340, roughness: 0.9 }));
    crate.position.set(x, 1, z);
    crate.castShadow = true;
    scene.add(crate);
  }
  // lighting
  scene.add(new THREE.HemisphereLight(0xcfd8e6, 0x2a2a2a, 0.65));
  const key = new THREE.SpotLight(0xfff1dc, 1300, 120, 0.7, 0.55, 1.6);
  key.position.set(18, 22, 20);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.4;
  scene.add(key, key.target);
  const rim = new THREE.SpotLight(0x8fd8ff, 1100, 120, 0.6, 0.6, 1.6);
  rim.position.set(-22, 18, -24);
  scene.add(rim, rim.target);
  const fill = new THREE.PointLight(0xffe2c0, 300, 60, 1.6);
  fill.position.set(-10, 8, 18);
  scene.add(fill);

  let model = null;
  let kind = 'fighter';
  const orbit = { yaw: 0.75, pitch: 0.32, dist: 30, target: new THREE.Vector3() };
  const goal = { yaw: 0.75, pitch: 0.32, dist: 30, target: new THREE.Vector3() };
  let auto = true;
  let time = 0;

  function setAircraft(id) {
    if (model) {
      scene.remove(model.group);
      disposeTree(model.group);
    }
    kind = id;
    model = buildModel(id);
    model.group.position.y = model.gearHeight + 0.3;
    model.update({ aileron: 0, elevator: 0, rudder: 0, flaps: 0.3, gear: 1, power: 0, afterburner: 0, rpm: 0, time: 0, wheelRoll: 0 });
    scene.add(model.group);
    const s = model.length;
    table.scale.setScalar(Math.max(0.6, s / 30));
    ring.scale.setScalar(Math.max(0.6, s / 30));
    setView('overview');
  }

  function setView(name) {
    const v = VIEWS[name];
    const s = Math.max(model.length, model.span);
    goal.yaw = v.yaw;
    goal.pitch = v.pitch;
    goal.dist = s * v.dist + 6;
    if (Array.isArray(v.target)) goal.target.set(0, model.gearHeight * 0.6, 0);
    else goal.target.fromArray(FOCUS[kind][v.target]).add(model.group.position);
    auto = name === 'overview';
  }

  return {
    scene,
    setAircraft,
    setView,
    get model() {
      return model;
    },
    update(dt, drag) {
      time += dt;
      if (drag.x || drag.y) auto = false;
      goal.yaw += drag.x * 0.006 + (auto ? dt * 0.12 : 0);
      goal.pitch = clamp(goal.pitch + drag.y * 0.004, -0.15, 1.2);
      goal.dist = clamp(goal.dist * (1 + drag.wheel * 0.001), 4, 90);
      orbit.yaw = damp(orbit.yaw, goal.yaw, 4, dt);
      orbit.pitch = damp(orbit.pitch, goal.pitch, 4, dt);
      orbit.dist = damp(orbit.dist, goal.dist, 4, dt);
      orbit.target.lerp(goal.target, 1 - Math.exp(-4 * dt));
      const cam = engine.camera;
      cam.fov = 45;
      cam.near = 0.1;
      cam.position.set(
        orbit.target.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist,
        Math.max(0.6, orbit.target.y + Math.sin(orbit.pitch) * orbit.dist),
        orbit.target.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist,
      );
      cam.up.set(0, 1, 0);
      cam.lookAt(orbit.target);
      cam.updateProjectionMatrix();
      if (model) model.update({ aileron: Math.sin(time * 0.8) * 0.4, elevator: Math.sin(time * 0.6) * 0.3, rudder: Math.sin(time * 0.5) * 0.3, flaps: 0.3, gear: 1, power: 0, afterburner: 0, rpm: 0.05, time, wheelRoll: 0 });
      ring.material.color.setHSL(0.52, 1, 0.45 + Math.sin(time * 2) * 0.1);
    },
    /** Instantly place the camera at the goal (for screenshots). */
    snap() {
      Object.assign(orbit, { yaw: goal.yaw, pitch: goal.pitch, dist: goal.dist });
      orbit.target.copy(goal.target);
    },
    dispose() {
      disposeTree(scene);
    },
  };
}
