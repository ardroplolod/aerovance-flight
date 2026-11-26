// The cinematic opening at Ironwood at sunrise: a crane shot over the base, the pilot walking out
// to the jet, a hand on the fuselage, the climb up the boarding ladder, settling into the seat as
// the canopy comes down, and a push in to the cockpit. After it (or after SKIP INTRO) the same
// scene becomes the main menu backdrop: the pilot walks a pre-flight circuit around the jet while
// the camera drifts between slow cinematic angles.
import * as THREE from 'three';
import { createPilot } from '../pilot/pilot.js';
import { buildModel } from '../aircraft/aircraft.js';
import { clamp, smoothstep } from '../core/math.js';

const JET = new THREE.Vector3(0, 0, 352);

function ladder() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd6c23a, roughness: 0.5, metalness: 0.4 });
  for (const x of [-0.22, 0.22]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.1, 0.05), mat);
    rail.position.set(x, 1.55, 0);
    rail.castShadow = true;
    g.add(rail);
  }
  for (let i = 0; i < 7; i += 1) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.12), mat);
    rung.position.set(0, 0.3 + i * 0.42, 0);
    g.add(rung);
  }
  return g;
}

export function createIntro(env, engine) {
  const scene = env.scene;
  const elev = env.def.elevation;
  const jet = buildModel('fighter');
  jet.group.position.set(JET.x, elev + jet.gearHeight, JET.z);
  scene.add(jet.group);
  const lad = ladder();
  // leaning on the left side under the cockpit
  lad.position.set(JET.x - 2.45, elev, JET.z - 4.4);
  lad.rotation.set(0, Math.PI / 2, -0.32);
  lad.rotation.order = 'YXZ';
  lad.rotation.set(0.32, Math.PI / 2, 0);
  scene.add(lad);
  const pilot = createPilot();
  scene.add(pilot.root);
  const cam = engine.camera;

  const ladderBase = new THREE.Vector3(JET.x - 3.15, elev, JET.z - 4.4);
  const ladderTop = new THREE.Vector3(JET.x - 1.45, elev + 2.65, JET.z - 4.4);
  const seat = new THREE.Vector3(JET.x, elev + jet.gearHeight + 0.42, JET.z - 4.0);
  const walkPath = [new THREE.Vector3(-18, elev, 374), new THREE.Vector3(-8, elev, 360), ladderBase.clone().add(new THREE.Vector3(-0.2, 0, 0.1))];
  const loopPath = [
    new THREE.Vector3(-14, elev, 344), new THREE.Vector3(-9, elev, 356), new THREE.Vector3(-3, elev, 363), new THREE.Vector3(4, elev, 363),
    new THREE.Vector3(9, elev, 355), new THREE.Vector3(8, elev, 343), new THREE.Vector3(2, elev, 336), new THREE.Vector3(-6, elev, 336),
  ];
  const seg = (path, loop) => {
    const lens = [];
    let total = 0;
    const n = loop ? path.length : path.length - 1;
    for (let i = 0; i < n; i += 1) {
      const l = path[i].distanceTo(path[(i + 1) % path.length]);
      lens.push(l);
      total += l;
    }
    return {
      total,
      at(d) {
        let r = loop ? ((d % total) + total) % total : clamp(d, 0, total);
        for (let i = 0; i < n; i += 1) {
          if (r <= lens[i] || i === n - 1) {
            const a = path[i];
            const b = path[(i + 1) % path.length];
            const t = clamp(r / lens[i], 0, 1);
            return { pos: a.clone().lerp(b, t), dir: b.clone().sub(a).normalize() };
          }
          r -= lens[i];
        }
        return { pos: path[0].clone(), dir: new THREE.Vector3(0, 0, -1) };
      },
    };
  };
  const walk = seg(walkPath, false);
  const loop = seg(loopPath, true);
  const SPEED = 1.65;
  const T_WALK = walk.total / SPEED;
  const T_INSPECT = T_WALK + 2.6;
  const T_CLIMB = T_INSPECT + 3.6;
  const T_SEAT = T_CLIMB + 2.4;
  const T_END = T_SEAT + 2.6;
  let t = 0;
  let mode = 'intro';
  let loopDist = 0;
  let lastDist = 0;
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  let canopyOpen = 1;

  function facing(dir) {
    pilot.root.rotation.y = Math.atan2(dir.x, dir.z);
  }

  function shot(pos, look, fov = 50) {
    camPos.copy(pos);
    camLook.copy(look);
    cam.fov = fov;
  }

  function updateIntro(dt) {
    t += dt;
    const pHead = pilot.root.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    if (t < T_WALK) {
      const d = t * SPEED;
      const { pos, dir } = walk.at(d);
      pilot.root.position.copy(pos);
      facing(dir);
      pilot.walk(d - lastDist, SPEED);
      lastDist = d;
    } else if (t < T_INSPECT) {
      pilot.root.position.copy(ladderBase).add(new THREE.Vector3(-0.2, 0, 0.1));
      pilot.root.rotation.y = Math.PI / 2;
      pilot.inspect(t, (t - T_WALK) / 2.6);
    } else if (t < T_CLIMB) {
      const k = (t - T_INSPECT) / 3.6;
      pilot.root.position.copy(ladderBase).lerp(ladderTop, smoothstep(0, 1, k));
      pilot.root.rotation.y = Math.PI / 2;
      pilot.climb(k * Math.PI * 6);
    } else if (t < T_SEAT) {
      const k = smoothstep(0, 1, (t - T_CLIMB) / 2.4);
      pilot.root.position.copy(ladderTop).lerp(seat.clone().setY(seat.y - 0.5), k);
      pilot.root.rotation.y = Math.PI / 2 + k * (Math.PI / 2);
      if (k < 0.5) pilot.climb(k * 4);
      else pilot.sit();
      canopyOpen = 1;
    } else {
      pilot.root.position.copy(seat).setY(seat.y - 0.5);
      pilot.root.rotation.y = Math.PI;
      pilot.sit();
      canopyOpen = Math.max(0, 1 - (t - T_SEAT) / 1.8);
    }
    // camera direction
    if (t < 5.5) {
      const k = smoothstep(0, 5.5, t);
      shot(new THREE.Vector3(-130 + k * 90, elev + 70 - k * 58, 230 + k * 110), JET.clone().setY(elev + 2).lerp(pHead, k * 0.6), 46 - k * 6);
    } else if (t < T_WALK) {
      const p = pilot.root.position;
      const k = (t - 5.5) / Math.max(1, T_WALK - 5.5);
      shot(p.clone().add(new THREE.Vector3(-6 + k * 2, 1.5, 6.5 - k * 2)), pHead.clone().lerp(JET.clone().setY(elev + 2), 0.35), 44);
    } else if (t < T_INSPECT) {
      shot(ladderBase.clone().add(new THREE.Vector3(-4.5, 1.8, 3.4)), ladderBase.clone().add(new THREE.Vector3(0.6, 1.5, -0.6)), 40);
    } else if (t < T_CLIMB) {
      shot(ladderBase.clone().add(new THREE.Vector3(-7, 2.2, -5)), pilot.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 42);
    } else {
      const k = smoothstep(T_CLIMB, T_END, t);
      const from = new THREE.Vector3(JET.x - 7, elev + 4.5, JET.z - 14);
      const to = new THREE.Vector3(JET.x - 1.2, elev + 3.3, JET.z - 7.6);
      shot(from.lerp(to, k), seat.clone().add(new THREE.Vector3(0, 0.6, 0)), 40 - k * 12);
    }
    return t >= T_END;
  }

  let camT = 0;
  const angles = [
    (p) => ({ pos: JET.clone().add(new THREE.Vector3(-24, elev + 3.5, 20)), look: p.clone().lerp(JET.clone().setY(elev + 2), 0.55).add(new THREE.Vector3(0, 1.2, 0)), fov: 40 }),
    (p) => ({ pos: JET.clone().add(new THREE.Vector3(-26, elev + 2.5, -16)), look: JET.clone().setY(elev + 1.8).lerp(p, 0.3), fov: 38 }),
    (p) => ({ pos: JET.clone().add(new THREE.Vector3(-14, elev + 12, 30)), look: JET.clone().setY(elev + 1).lerp(p, 0.2), fov: 42 }),
  ];
  function updateMenu(dt) {
    t += dt;
    camT += dt;
    const d = loopDist + dt * 1.35;
    const { pos, dir } = loop.at(d);
    pilot.root.position.copy(pos);
    facing(dir);
    pilot.walk(d - loopDist, 1.35);
    loopDist = d;
    canopyOpen = 1;
    const i = Math.floor(camT / 12) % angles.length;
    const k = (camT % 12) / 12;
    const a = angles[i](pos);
    const drift = new THREE.Vector3(Math.sin(k * Math.PI) * 3, k * 1.2, Math.cos(k * 2) * 2);
    shot(a.pos.add(drift), a.look, a.fov);
  }

  const canopyBase = jet.canopy.position.clone();
  return {
    pilot,
    jet,
    get mode() {
      return mode;
    },
    get progress() {
      return clamp(t / T_END, 0, 1);
    },
    duration: T_END,
    toMenu() {
      mode = 'menu';
      t = 0;
      camT = 0;
      loopDist = 0;
    },
    /** Jump the menu loop to a given time (for staged shots). */
    seek(seconds) {
      for (let s = 0; s < seconds; s += 1 / 30) (mode === 'menu' ? updateMenu : updateIntro)(1 / 30);
      cam.position.copy(camPos);
    },
    update(dt) {
      const finished = mode === 'intro' ? updateIntro(dt) : (updateMenu(dt), false);
      jet.canopy.position.copy(canopyBase).add(new THREE.Vector3(0, canopyOpen * 0.42, canopyOpen * 0.75));
      jet.canopy.rotation.x = canopyOpen * 0.28;
      jet.helmet.visible = mode === 'intro' && t > T_SEAT;
      jet.update({ aileron: Math.sin(t * 0.6) * 0.15, elevator: Math.sin(t * 0.4) * 0.1, rudder: 0, flaps: 0.5, gear: 1, power: 0, afterburner: 0, rpm: 0, time: t, wheelRoll: 0 });
      cam.position.lerp(camPos, mode === 'menu' ? 1 - Math.exp(-dt * 2.5) : 1);
      cam.lookAt(camLook);
      cam.updateProjectionMatrix();
      return finished;
    },
  };
}
