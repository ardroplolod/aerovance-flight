// AV-9 Kestrel: an original twin-engine, twin-tail fighter. Lathed fuselage with side intakes and a
// bubble canopy, lofted swept wings with ailerons and flaperons, all-moving tailplanes, canted
// fins with rudders, retracting tricycle gear and two afterburning nozzles.
import * as THREE from 'three';
import { canvasTexture } from '../../core/geometry.js';
import { controlSurface, exhaustPlume, fuselage, gearLeg, materials, navLights, panelSkin, wing } from '../parts.js';

function insignia() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(40,52,60,0.9)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(210,220,226,0.95)';
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      ctx.lineTo(w / 2 + Math.cos(a) * w * 0.34, h / 2 + Math.sin(a) * h * 0.34);
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(40,52,60,0.9)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 4, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
  });
}

function tailArt(text) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(32,40,46,0.85)';
    ctx.font = 'bold 54px "Helvetica Neue", Arial';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, h * 0.62);
    ctx.fillStyle = 'rgba(230,170,40,0.9)';
    ctx.fillRect(w * 0.15, h * 0.74, w * 0.7, 6);
  });
}

export function buildFighter() {
  const group = new THREE.Group();
  const skin = materials.paint(panelSkin('#76808a', { camo: ['#6b757e', '#858f98'], repeat: [1, 1] }), 0.5, 0.3);
  const dark = materials.dark();
  const metal = materials.metal(0x5d6266, 0.4);

  const body = fuselage(
    [[-9.2, 0.02], [-8.6, 0.28], [-7.6, 0.55], [-6.2, 0.82], [-4.8, 1.02], [-3, 1.2], [-1, 1.34], [2, 1.38], [4.5, 1.3], [6.5, 1.12], [7.9, 0.95]],
    { squash: 0.72, material: skin, segments: 32 },
  );
  group.add(body);
  // radome tip, darker composite
  const radome = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.7, 20), new THREE.MeshStandardMaterial({ color: 0x5b6268, roughness: 0.6 }));
  radome.rotation.x = -Math.PI / 2;
  radome.position.z = -8.85;
  radome.scale.set(1, 1, 0.72);
  group.add(radome);
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), metal);
  pitot.rotation.x = Math.PI / 2;
  pitot.position.z = -9.6;
  group.add(pitot);

  // dorsal spine
  const spine = fuselage([[-3.2, 0.05], [-2.2, 0.45], [2, 0.55], [5.5, 0.35], [7, 0.05]], { squash: 0.6, material: skin, segments: 16 });
  spine.position.y = 0.55;
  group.add(spine);

  // intakes
  for (const side of [-1, 1]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 4.6), skin);
    intake.position.set(side * 1.25, -0.25, -1.1);
    intake.castShadow = true;
    group.add(intake);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.82, 0.2), dark);
    lip.position.set(side * 1.25, -0.25, -3.41);
    group.add(lip);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 1.4), skin);
    ramp.position.set(side * 0.86, -0.25, -3.0);
    ramp.rotation.y = side * 0.2;
    group.add(ramp);
  }

  // canopy and cockpit sill
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), materials.glass());
  canopy.scale.set(0.58, 0.62, 1.9);
  canopy.position.set(0, 0.62, -4.6);
  group.add(canopy);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.04, 6, 24, Math.PI), metal);
  frame.position.set(0, 0.62, -4.0);
  frame.scale.set(1, 1.07, 1);
  group.add(frame);
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.15), dark);
  seatBack.position.set(0, 0.7, -3.9);
  seatBack.rotation.x = -0.25;
  group.add(seatBack);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.4 }));
  helmet.position.set(0, 1.0, -4.35);
  group.add(helmet);

  // wings
  const wingDefs = { span: 5.2, rootChord: 5.6, tipChord: 1.3, sweep: 4.1, dihedral: -0.15, thickness: 0.05 };
  const wings = [];
  const ailerons = [];
  const flaps = [];
  for (const side of [-1, 1]) {
    const geo = wing({ ...wingDefs, mirror: side < 0 });
    const w = new THREE.Mesh(geo, skin);
    w.castShadow = true;
    w.receiveShadow = true;
    w.position.set(side * 1.1, -0.18, -1.6);
    group.add(w);
    wings.push(w);
    const ail = controlSurface({ length: 1.8, chord: 0.55, thickness: 0.08, material: skin });
    // hinge along the trailing edge of the outer wing (its trailing edge runs at z = 3.9)
    ail.position.set(side > 0 ? 3.7 : -5.5, -0.18, 3.32);
    group.add(ail);
    ailerons.push({ pivot: ail, side });
    const flap = controlSurface({ length: 2.2, chord: 0.75, thickness: 0.09, material: skin });
    flap.position.set(side > 0 ? 1.15 : -3.35, -0.18, 3.25);
    group.add(flap);
    flaps.push(flap);
    const ins = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: insignia(), transparent: true, depthWrite: false }));
    ins.rotation.x = -Math.PI / 2;
    ins.position.set(side * 4.2, -0.1, 2.0);
    group.add(ins);
  }

  // all-moving horizontal tails
  const stabs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    const geo = wing({ span: 2.7, rootChord: 2.5, tipChord: 0.9, sweep: 1.8, thickness: 0.05, mirror: side < 0 });
    geo.translate(0, 0, -1.0);
    const s = new THREE.Mesh(geo, skin);
    s.castShadow = true;
    pivot.add(s);
    pivot.position.set(side * 1.0, -0.15, 6.2);
    group.add(pivot);
    stabs.push(pivot);
  }

  // canted twin fins with rudders
  const rudders = [];
  for (const side of [-1, 1]) {
    const fin = new THREE.Group();
    const geo = wing({ span: 3.1, rootChord: 3.0, tipChord: 1.1, sweep: 2.1, thickness: 0.05 });
    const f = new THREE.Mesh(geo, skin);
    f.castShadow = true;
    fin.add(f);
    const rudder = controlSurface({ length: 1.9, chord: 0.6, thickness: 0.06, material: skin });
    rudder.position.set(0.4, 0, 2.45);
    fin.add(rudder);
    rudders.push(rudder);
    const artMat = new THREE.MeshBasicMaterial({ map: tailArt('AV-07'), transparent: true, depthWrite: false });
    for (const face of [-1, 1]) {
      // each face reads left-to-right from its own side: text along the chord, up toward the tip
      const art = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), artMat);
      const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, face), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, face, 0));
      art.quaternion.setFromRotationMatrix(basis);
      art.position.set(1.35, face * 0.075, 2.3);
      fin.add(art);
    }
    fin.rotation.z = side > 0 ? Math.PI / 2 - 0.26 : Math.PI / 2 + 0.26;
    fin.position.set(side * 0.95, 0.45, 3.9);
    group.add(fin);
  }

  // nozzles + afterburner plumes
  const plumes = [];
  for (const side of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 1.2, 20, 1, true), metal);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(side * 0.55, -0.05, 8.4);
    nozzle.material.side = THREE.DoubleSide;
    group.add(nozzle);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.46, 18), new THREE.MeshStandardMaterial({ color: 0x241a14, emissive: 0x401606, roughness: 0.9 }));
    inner.position.set(side * 0.55, -0.05, 8.2);
    inner.rotation.y = Math.PI;
    group.add(inner);
    const plume = exhaustPlume(0.42, 5);
    plume.group.position.set(side * 0.55, -0.05, 8.95);
    group.add(plume.group);
    plumes.push(plume);
  }

  // landing gear
  const nose = gearLeg({ length: 1.35, wheelRadius: 0.3, wheels: 1, wheelWidth: 0.18, axis: 'x', stowAngle: -Math.PI / 2 });
  nose.pivot.position.set(0, -0.7, -5.6);
  group.add(nose.pivot);
  const mains = [-1, 1].map((side) => {
    const leg = gearLeg({ length: 1.3, wheelRadius: 0.38, wheels: 1, wheelWidth: 0.26, axis: 'z', stowAngle: side * -Math.PI / 2 });
    leg.pivot.position.set(side * 1.45, -0.75, 1.1);
    group.add(leg.pivot);
    return leg;
  });
  const gearLegs = [nose, ...mains];

  const blink = navLights(group, new THREE.Vector3(-6.3, -0.33, 2.8), new THREE.Vector3(6.3, -0.33, 2.8), new THREE.Vector3(0, 0.3, 8.9));

  return {
    group,
    kind: 'fighter',
    gearHeight: 0.75 + 1.35 + 0.3,
    eye: new THREE.Vector3(0, 1.08, -4.55),
    canopy,
    helmet,
    gearLegs,
    length: 18.5,
    span: 12.6,
    update(c) {
      for (const a of ailerons) a.pivot.rotation.x = -a.side * c.aileron * 0.35;
      for (const s of stabs) s.rotation.x = -c.elevator * 0.32 + c.aileron * 0.08 * (s.position.x > 0 ? -1 : 1);
      rudders.forEach((r, i) => (r.rotation.x = (i === 0 ? -1 : 1) * c.rudder * 0.4));
      for (const f of flaps) f.rotation.x = c.flaps * 0.55;
      for (const g of gearLegs) g.deploy(c.gear);
      for (const g of gearLegs) g.roll(c.wheelRoll);
      for (const p of plumes) p.set(c.power, c.afterburner, c.time);
      blink(c.time);
    },
  };
}
