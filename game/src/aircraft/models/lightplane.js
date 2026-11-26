// AV-2 Skylark: an original high-wing, four-seat piston trainer with wing struts, a spinning
// two-blade propeller, slotted flaps, ailerons, elevator and rudder, and fixed tricycle gear with
// wheel fairings (its gear does not retract, and the cockpit says so).
import * as THREE from 'three';
import { canvasTexture } from '../../core/geometry.js';
import { controlSurface, fuselage, gearLeg, materials, navLights, wing } from '../parts.js';

function skin() {
  return canvasTexture(512, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#f3f4f2';
    ctx.fillRect(0, 0, w, h);
    for (const u of [0.25, 0.75]) {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(w * (u - 0.06), 0, w * 0.035, h);
      ctx.fillStyle = '#1f4e79';
      ctx.fillRect(w * (u - 0.02), 0, w * 0.02, h);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < h; y += h / 9) ctx.fillRect(0, y, w, 2);
    ctx.fillStyle = '#1f4e79';
    ctx.font = 'bold 64px "Helvetica Neue", Arial';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(w * 0.3, h * 0.3);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('AV-2K', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(w * 0.7, h * 0.3);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('AV-2K', 0, 0);
    ctx.restore();
  });
}

export function buildLightPlane() {
  const group = new THREE.Group();
  const paint = materials.paint(skin(), 0.45, 0.1);
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f3f1, roughness: 0.45, metalness: 0.1 });
  const metal = materials.metal(0x9aa0a6, 0.35);

  const body = fuselage([[-3.25, 0.42], [-2.9, 0.56], [-2.2, 0.66], [-0.8, 0.72], [0.6, 0.66], [2.0, 0.45], [3.4, 0.25], [4.5, 0.12]], { squash: 1.18, material: paint, segments: 24 });
  group.add(body);
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 0.9, 20), white);
  cowl.rotation.x = Math.PI / 2;
  cowl.position.z = -3.45;
  cowl.scale.set(1, 1, 1.1);
  group.add(cowl);
  // cabin glazing
  const glass = materials.glass();
  const windscreen = new THREE.Mesh(new THREE.SphereGeometry(0.66, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), glass);
  windscreen.scale.set(1, 0.8, 1.6);
  windscreen.position.set(0, 0.42, -1.55);
  group.add(windscreen);
  for (const side of [-1, 1]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.6), glass);
    pane.rotation.y = side * Math.PI / 2;
    pane.position.set(side * 0.74, 0.5, -0.6);
    group.add(pane);
  }

  // high wing with struts
  const ailerons = [];
  const flaps = [];
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wing({ span: 5.4, rootChord: 1.55, tipChord: 1.35, sweep: 0.08, dihedral: 0.2, thickness: 0.15, mirror: side < 0 }), white);
    w.position.set(side * 0.55, 0.98, -1.4);
    w.castShadow = true;
    w.receiveShadow = true;
    group.add(w);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.1, 6), metal);
    strut.position.set(side * 1.85, 0.2, -0.85);
    strut.rotation.z = side * -1.08;
    group.add(strut);
    const ail = controlSurface({ length: 2.0, chord: 0.38, thickness: 0.08, material: white });
    ail.position.set(side > 0 ? 3.6 : -5.6, 1.13, -0.25);
    group.add(ail);
    ailerons.push({ pivot: ail, side });
    const flap = controlSurface({ length: 2.4, chord: 0.42, thickness: 0.09, material: white });
    flap.position.set(side > 0 ? 0.65 : -3.05, 1.0, -0.3);
    group.add(flap);
    flaps.push(flap);
  }

  // tail
  const fin = new THREE.Group();
  fin.add(new THREE.Mesh(wing({ span: 1.5, rootChord: 1.4, tipChord: 0.7, sweep: 0.8, thickness: 0.1 }), paint));
  const rudder = controlSurface({ length: 1.4, chord: 0.38, thickness: 0.06, material: white, taper: 0.9 });
  rudder.position.set(0.05, 0, 1.25);
  fin.add(rudder);
  fin.rotation.z = Math.PI / 2;
  fin.position.set(0, 0.25, 3.1);
  group.add(fin);
  const elevators = [];
  for (const side of [-1, 1]) {
    const stab = new THREE.Mesh(wing({ span: 1.6, rootChord: 0.9, tipChord: 0.65, sweep: 0.15, thickness: 0.09, mirror: side < 0 }), white);
    stab.position.set(side * 0.15, 0.1, 3.4);
    group.add(stab);
    const el = controlSurface({ length: 1.6, chord: 0.35, thickness: 0.06, material: white });
    el.position.set(side > 0 ? 0.15 : -1.75, 0.1, 4.3);
    group.add(el);
    elevators.push(el);
  }

  // propeller
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.4, metalness: 0.3 }));
  spinner.rotation.x = -Math.PI / 2;
  prop.add(spinner);
  for (const s of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.04), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
    blade.position.y = s * 0.5;
    blade.rotation.y = s * 0.35;
    prop.add(blade);
  }
  const blur = new THREE.Mesh(new THREE.CircleGeometry(0.98, 32), new THREE.MeshBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  prop.add(blur);
  prop.position.z = -4.0;
  group.add(prop);

  // fixed gear with wheel pants
  const pantMat = white;
  const legs = [];
  const nose = gearLeg({ length: 0.75, wheelRadius: 0.2, wheelWidth: 0.12 });
  nose.pivot.position.set(0, -0.6, -3.0);
  group.add(nose.pivot);
  legs.push(nose);
  for (const side of [-1, 1]) {
    const leg = gearLeg({ length: 0.85, wheelRadius: 0.24, wheelWidth: 0.14 });
    leg.pivot.position.set(side * 1.15, -0.5, -0.6);
    leg.pivot.rotation.z = side * 0.25;
    group.add(leg.pivot);
    const pant = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), pantMat);
    pant.scale.set(0.6, 0.85, 1.6);
    pant.position.set(0, -0.85, 0);
    leg.pivot.add(pant);
    legs.push(leg);
  }
  const blink = navLights(group, new THREE.Vector3(-5.95, 1.2, -0.7), new THREE.Vector3(5.95, 1.2, -0.7), new THREE.Vector3(0, 1.7, 4.3));

  return {
    group,
    kind: 'light',
    gearHeight: 0.6 + 0.75 + 0.2,
    eye: new THREE.Vector3(-0.32, 0.62, -1.0),
    gearLegs: legs,
    fixedGear: true,
    length: 8.4,
    span: 12,
    update(c) {
      for (const a of ailerons) a.pivot.rotation.x = -a.side * c.aileron * 0.35;
      for (const e of elevators) e.rotation.x = -c.elevator * 0.4;
      rudder.rotation.x = -c.rudder * 0.45;
      for (const f of flaps) f.rotation.x = c.flaps * 0.6;
      for (const g of legs) g.roll(c.wheelRoll);
      prop.rotation.z += c.rpm * 1.4;
      blur.material.opacity = Math.min(0.3, c.rpm * 0.3);
      for (const child of prop.children) if (child !== blur && child !== spinner) child.visible = c.rpm < 0.45;
      blink(c.time);
    },
  };
}
