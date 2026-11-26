// AV-500 Stratos: an original twin-turbofan narrow-body airliner with a painted livery and cabin
// windows, swept wings with winglets, ailerons and trailing-edge flaps, underwing engines with
// spinning fans, a conventional tail and twin-wheel retracting gear.
import * as THREE from 'three';
import { canvasTexture } from '../../core/geometry.js';
import { controlSurface, exhaustPlume, fuselage, gearLeg, materials, navLights, panelSkin, wing } from '../parts.js';

function livery() {
  return canvasTexture(1024, 2048, (ctx, w, h) => {
    // x = around the body (0 belly, 0.25 right, 0.5 top, 0.75 left), y = along it (top of canvas = tail)
    const belly = ctx.createLinearGradient(0, 0, w, 0);
    belly.addColorStop(0, '#9aa2a8');
    belly.addColorStop(0.18, '#f2f4f6');
    belly.addColorStop(0.82, '#f2f4f6');
    belly.addColorStop(1, '#9aa2a8');
    ctx.fillStyle = belly;
    ctx.fillRect(0, 0, w, h);
    for (const u of [0.245, 0.755]) {
      ctx.fillStyle = '#0f3d6e';
      ctx.fillRect(w * (u - 0.035), 0, w * 0.03, h);
      ctx.fillStyle = '#19a3b8';
      ctx.fillRect(w * (u - 0.045), 0, w * 0.008, h);
    }
    // cabin windows
    for (const u of [0.3, 0.7]) {
      ctx.fillStyle = '#1b2733';
      for (let y = h * 0.16; y < h * 0.8; y += h * 0.0105) ctx.fillRect(w * u - 5, y, 10, h * 0.0055);
      ctx.fillStyle = '#3a4752';
      ctx.fillRect(w * u - 12, h * 0.83, 24, h * 0.03);
      ctx.fillRect(w * u - 12, h * 0.36, 24, h * 0.025);
    }
    // name along each side
    ctx.fillStyle = '#0f3d6e';
    ctx.font = 'bold 120px "Helvetica Neue", Arial';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(w * 0.37, h * 0.5);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('AEROVANCE', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(w * 0.63, h * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('AEROVANCE', 0, 0);
    ctx.restore();
    // cockpit windows near the nose (bottom of the canvas)
    ctx.fillStyle = '#111a22';
    for (const u of [0.36, 0.42, 0.58, 0.64]) ctx.fillRect(w * u - 18, h * 0.955, 36, h * 0.012);
  }, { anisotropy: 8 });
}

function finArt() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0f3d6e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#19a3b8';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.quadraticCurveTo(w * 0.5, h * 0.35, w, h * 0.1);
    ctx.lineTo(w, h * 0.32);
    ctx.quadraticCurveTo(w * 0.5, h * 0.55, 0, h);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.45, h * 0.6, w * 0.12, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function buildAirliner() {
  const group = new THREE.Group();
  const body = fuselage(
    [[-19.2, 0.02], [-18.9, 0.55], [-18.2, 1.12], [-17, 1.62], [-15.2, 1.95], [-13, 2.05], [11, 2.05], [13.5, 1.85], [16, 1.35], [18, 0.75], [19.4, 0.3]],
    { material: materials.paint(livery(), 0.35, 0.15), segments: 36 },
  );
  group.add(body);
  const skin = materials.paint(panelSkin('#d9dde0', { repeat: [3, 2], lines: 'rgba(0,0,0,0.12)' }), 0.4, 0.4);
  const grey = materials.metal(0xb0b6bb, 0.4);

  const ailerons = [];
  const flaps = [];
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wing({ span: 15.5, rootChord: 7.2, tipChord: 1.6, sweep: 7.4, dihedral: 1.3, thickness: 0.11, mirror: side < 0 }), skin);
    w.position.set(side * 1.6, -1.3, -4.2);
    w.castShadow = true;
    w.receiveShadow = true;
    group.add(w);
    const winglet = new THREE.Mesh(wing({ span: 2.2, rootChord: 1.6, tipChord: 0.6, sweep: 1.2, thickness: 0.08 }), skin);
    winglet.rotation.z = side > 0 ? Math.PI / 2 - 0.25 : Math.PI / 2 + 0.25;
    winglet.position.set(side * 17.05, 0.0, 3.2);
    group.add(winglet);
    const ail = controlSurface({ length: 3.6, chord: 0.7, thickness: 0.1, material: skin });
    ail.position.set(side > 0 ? 11.2 : -14.8, -0.36, 3.6);
    group.add(ail);
    ailerons.push({ pivot: ail, side });
    for (const [x0, len, z] of [[2.2, 4.2, 2.1], [6.6, 4.4, 2.65]]) {
      const f = controlSurface({ length: len, chord: 1.2, thickness: 0.14, material: grey });
      f.position.set(side > 0 ? x0 : -x0 - len, -1.1 + (x0 / 15.5) * 1.3, z);
      group.add(f);
      flaps.push(f);
    }
  }

  // engines on pylons
  const fans = [];
  const plumes = [];
  for (const side of [-1, 1]) {
    const nac = fuselage([[-2.4, 0.95], [-2.2, 1.08], [-1, 1.12], [0.8, 1.0], [1.8, 0.7], [2.3, 0.45]], { material: materials.paint(panelSkin('#e4e7ea', { repeat: [2, 1] }), 0.35, 0.5), segments: 28 });
    nac.position.set(side * 6.2, -2.55, -6.5);
    group.add(nac);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.1, 10, 28), grey);
    lip.position.set(side * 6.2, -2.55, -8.9);
    group.add(lip);
    const fan = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 16), materials.metal(0x30343a, 0.5));
    hub.rotation.x = -Math.PI / 2;
    fan.add(hub);
    for (let i = 0; i < 18; i += 1) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.04), materials.metal(0x6b7178, 0.3));
      blade.position.y = 0.5;
      blade.rotation.y = 0.5;
      const holder = new THREE.Group();
      holder.rotation.z = (i / 18) * Math.PI * 2;
      holder.add(blade);
      fan.add(holder);
    }
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.98, 24), materials.dark());
    back.position.z = 0.25;
    fan.add(back);
    fan.position.set(side * 6.2, -2.55, -8.55);
    group.add(fan);
    fans.push(fan);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 4.2), skin);
    pylon.position.set(side * 6.2, -1.55, -5.4);
    group.add(pylon);
    const plume = exhaustPlume(0.42, 3, 0x8fb8ff);
    plume.group.position.set(side * 6.2, -2.55, -4.15);
    group.add(plume.group);
    plumes.push(plume);
  }

  // tail
  const fin = new THREE.Group();
  const finMat = materials.paint(finArt(), 0.4, 0.2);
  const finMesh = new THREE.Mesh(wing({ span: 7.2, rootChord: 6.2, tipChord: 2.4, sweep: 5.2, thickness: 0.1 }), finMat);
  finMesh.castShadow = true;
  fin.add(finMesh);
  const rudder = controlSurface({ length: 6.2, chord: 1.3, thickness: 0.12, material: finMat, taper: 0.8 });
  rudder.position.set(0.4, 0, 5.7);
  fin.add(rudder);
  fin.rotation.z = Math.PI / 2;
  fin.position.set(0, 1.7, 12.6);
  group.add(fin);
  const elevators = [];
  for (const side of [-1, 1]) {
    const stab = new THREE.Mesh(wing({ span: 6.4, rootChord: 4.2, tipChord: 1.5, sweep: 3.8, dihedral: 0.6, thickness: 0.09, mirror: side < 0 }), skin);
    stab.position.set(side * 0.9, 0.6, 14.3);
    stab.castShadow = true;
    group.add(stab);
    const el = controlSurface({ length: 5.2, chord: 0.9, thickness: 0.1, material: skin });
    el.position.set(side > 0 ? 1.1 : -6.3, 0.85, 17.6);
    group.add(el);
    elevators.push(el);
  }

  // gear
  const nose = gearLeg({ length: 2.0, wheelRadius: 0.45, wheels: 2, wheelWidth: 0.3, axis: 'x', stowAngle: -Math.PI / 2 });
  nose.pivot.position.set(0, -1.6, -15.2);
  group.add(nose.pivot);
  const mains = [-1, 1].map((side) => {
    const leg = gearLeg({ length: 2.3, wheelRadius: 0.6, wheels: 2, wheelWidth: 0.4, axis: 'z', stowAngle: side * -Math.PI / 2 });
    leg.pivot.position.set(side * 3.3, -1.7, 1.6);
    group.add(leg.pivot);
    return leg;
  });
  const gearLegs = [nose, ...mains];
  const blink = navLights(group, new THREE.Vector3(-17.1, 0.05, 3.9), new THREE.Vector3(17.1, 0.05, 3.9), new THREE.Vector3(0, 0.6, 19.5));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }));
  beacon.position.set(0, 2.1, 0);
  group.add(beacon);

  return {
    group,
    kind: 'airliner',
    gearHeight: 1.7 + 2.3 + 0.6,
    eye: new THREE.Vector3(-0.55, 0.85, -16.6),
    gearLegs,
    length: 38.6,
    span: 34.5,
    update(c) {
      for (const a of ailerons) a.pivot.rotation.x = -a.side * c.aileron * 0.3;
      for (const e of elevators) e.rotation.x = -c.elevator * 0.35;
      rudder.rotation.x = -c.rudder * 0.35;
      for (const f of flaps) f.rotation.x = c.flaps * 0.6;
      for (const g of gearLegs) {
        g.deploy(c.gear);
        g.roll(c.wheelRoll);
      }
      for (const fan of fans) fan.rotation.z += c.rpm * 0.9;
      for (const p of plumes) p.set(c.power * 0.6, 0, c.time);
      beacon.visible = c.time % 1 < 0.15;
      blink(c.time);
    },
  };
}
