// The pilot: an articulated figure in a flight suit (helmet with visor, torso with harness and
// survival vest, two-segment arms and legs with boots) and the procedural animation that moves it:
// a walk cycle with hip, knee, ankle, arm swing, torso bob and counter-rotation; a ladder climb;
// a hand-on-fuselage inspection; a wave; and seated.
import * as THREE from 'three';

const suit = new THREE.MeshStandardMaterial({ color: 0x55603f, roughness: 0.85 });
const suitDark = new THREE.MeshStandardMaterial({ color: 0x3e4730, roughness: 0.9 });
const vest = new THREE.MeshStandardMaterial({ color: 0x2c3228, roughness: 0.8 });
const boot = new THREE.MeshStandardMaterial({ color: 0x1a1714, roughness: 0.6 });
const glove = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.7 });
const helmetMat = new THREE.MeshStandardMaterial({ color: 0xe9e9e2, roughness: 0.35, metalness: 0.1 });
const visorMat = new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.05, metalness: 0.9, emissive: 0x100804 });
const skin = new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.7 });

function limb(length, r0, r1, material) {
  const geo = new THREE.CapsuleGeometry((r0 + r1) / 2, length - (r0 + r1), 4, 10);
  geo.translate(0, -length / 2, 0);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  return m;
}

export function createPilot() {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);
  const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.12, 4, 10), suit);
  pelvis.rotation.z = Math.PI / 2;
  pelvis.castShadow = true;
  hips.add(pelvis);
  const spine = new THREE.Group();
  spine.position.y = 0.06;
  hips.add(spine);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.32, 4, 12), suit);
  torso.position.y = 0.28;
  torso.scale.set(1.12, 1, 0.78);
  torso.castShadow = true;
  spine.add(torso);
  const vestMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.175, 0.2, 4, 12), vest);
  vestMesh.position.y = 0.3;
  vestMesh.scale.set(1.16, 1, 0.84);
  spine.add(vestMesh);
  for (const side of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.5, 0.02), suitDark);
    strap.position.set(side * 0.09, 0.3, 0.145);
    strap.rotation.z = side * 0.12;
    spine.add(strap);
  }
  const neck = new THREE.Group();
  neck.position.y = 0.56;
  spine.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 10), skin);
  neckMesh.position.y = 0.03;
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.y = 0.16;
  neck.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 16), helmetMat);
  helmet.scale.set(1, 1.08, 1.12);
  helmet.castShadow = true;
  head.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.138, 20, 12, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.32, Math.PI * 0.3), visorMat);
  visor.scale.set(1.02, 1.08, 1.14);
  visor.rotation.y = 0;
  head.add(visor);
  const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.08, 8), suitDark);
  mask.rotation.x = Math.PI / 2;
  mask.position.set(0, -0.07, 0.13);
  head.add(mask);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.137, 0.012, 6, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1f6fb5 }));
  stripe.rotation.y = Math.PI / 2;
  stripe.scale.set(1, 1.08, 1.12);
  head.add(stripe);

  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.24, 0.5, 0);
    spine.add(shoulder);
    shoulder.add(limb(0.3, 0.065, 0.055, suit));
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);
    elbow.add(limb(0.27, 0.055, 0.045, suit));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glove);
    hand.scale.set(0.8, 1.2, 0.6);
    hand.position.y = -0.3;
    elbow.add(hand);
    return { shoulder, elbow, side };
  });
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, -0.02, 0);
    hips.add(hip);
    hip.add(limb(0.44, 0.085, 0.07, suit));
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.1), suitDark);
    pocket.position.set(side * 0.08, -0.22, 0.02);
    hip.add(pocket);
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    knee.add(limb(0.42, 0.065, 0.055, suit));
    const ankle = new THREE.Group();
    ankle.position.y = -0.43;
    knee.add(ankle);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.27), boot);
    foot.position.set(0, -0.035, 0.05);
    foot.castShadow = true;
    ankle.add(foot);
    return { hip, knee, ankle, side };
  });

  const pose = { phase: 0 };
  function reset() {
    hips.position.y = 0.95;
    hips.rotation.set(0, 0, 0);
    spine.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    for (const a of arms) {
      a.shoulder.rotation.set(0, 0, a.side * 0.08);
      a.elbow.rotation.set(0, 0, 0);
    }
    for (const l of legs) {
      l.hip.rotation.set(0, 0, 0);
      l.knee.rotation.set(0, 0, 0);
      l.ankle.rotation.set(0, 0, 0);
    }
  }

  return {
    root,
    head,
    /** Walk cycle; `distance` advanced this frame drives the phase so feet never skate. */
    walk(distance, speed = 1.5) {
      reset();
      pose.phase += distance * (Math.PI / 0.72);
      const p = pose.phase;
      const amp = Math.min(1, speed / 1.5);
      for (const l of legs) {
        const q = p + (l.side > 0 ? Math.PI : 0);
        l.hip.rotation.x = Math.sin(q) * 0.45 * amp;
        l.knee.rotation.x = Math.max(0, -Math.cos(q)) * 0.85 * amp + 0.05;
        l.ankle.rotation.x = -Math.sin(q) * 0.25 * amp;
      }
      for (const a of arms) {
        const q = p + (a.side > 0 ? 0 : Math.PI);
        a.shoulder.rotation.x = Math.sin(q) * 0.42 * amp;
        a.elbow.rotation.x = -0.25 - Math.max(0, Math.sin(q)) * 0.35 * amp;
      }
      hips.position.y = 0.95 + Math.abs(Math.cos(p)) * 0.035 * amp - 0.02;
      hips.rotation.y = Math.sin(p) * 0.08 * amp;
      spine.rotation.y = -Math.sin(p) * 0.12 * amp;
      spine.rotation.x = 0.04;
      head.rotation.y = Math.sin(p) * 0.04;
    },
    idle(time) {
      reset();
      spine.rotation.x = Math.sin(time * 1.3) * 0.015;
      hips.position.y = 0.95 + Math.sin(time * 1.3) * 0.004;
      for (const a of arms) a.elbow.rotation.x = -0.15;
    },
    /** Reach out and touch the airframe: one arm forward, head following. */
    inspect(time, t) {
      reset();
      const reach = Math.min(1, t * 2);
      arms[1].shoulder.rotation.x = -1.2 * reach;
      arms[1].shoulder.rotation.z = 0.2 * reach;
      arms[1].elbow.rotation.x = -0.3 * reach + Math.sin(time * 4) * 0.05;
      head.rotation.x = 0.15 * reach;
      head.rotation.y = -0.2 * reach;
      spine.rotation.x = 0.1 * reach;
    },
    /** Climb a ladder: alternate hand-over-hand and knee lifts with phase `p`. */
    climb(p) {
      reset();
      for (const a of arms) {
        const q = p + (a.side > 0 ? 0 : Math.PI);
        a.shoulder.rotation.x = -2.2 + Math.sin(q) * 0.35;
        a.elbow.rotation.x = -0.5 - Math.max(0, Math.cos(q)) * 0.5;
      }
      for (const l of legs) {
        const q = p + (l.side > 0 ? Math.PI : 0);
        l.hip.rotation.x = -0.6 - Math.max(0, Math.sin(q)) * 0.7;
        l.knee.rotation.x = 0.9 + Math.max(0, Math.sin(q)) * 0.6;
      }
      spine.rotation.x = 0.12;
      head.rotation.x = -0.2;
    },
    sit() {
      reset();
      for (const l of legs) {
        l.hip.rotation.x = -1.45;
        l.knee.rotation.x = 1.4;
      }
      for (const a of arms) {
        a.shoulder.rotation.x = -0.6;
        a.elbow.rotation.x = -0.7;
      }
      hips.position.y = 0.5;
    },
    wave(time) {
      reset();
      arms[1].shoulder.rotation.z = 2.6;
      arms[1].elbow.rotation.z = 0.3 + Math.sin(time * 8) * 0.35;
      head.rotation.y = 0.2;
    },
  };
}
