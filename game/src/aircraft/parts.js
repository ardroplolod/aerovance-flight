// Shared aircraft construction: lathed fuselages, lofted airfoil wings, hinged control surfaces,
// wheels and gear legs, painted panel-line skins and navigation lights. Each aircraft model is
// assembled from these, so every airframe has real wings, real hinges and real retracting gear.
import * as THREE from 'three';
import { canvasTexture } from '../core/geometry.js';

/** Paint a skin with panel lines and rivet rows over a base colour (optionally a camouflage). */
export function panelSkin(base, { camo = null, lines = 'rgba(0,0,0,0.22)', repeat = [4, 4], size = 512 } = {}) {
  return canvasTexture(size, size, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    if (camo) {
      for (let i = 0; i < 26; i += 1) {
        ctx.fillStyle = camo[i % camo.length];
        ctx.beginPath();
        const x = Math.random() * w;
        const y = Math.random() * h;
        ctx.ellipse(x, y, 30 + Math.random() * 90, 20 + Math.random() * 50, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = lines;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i += 1) {
      const x = (i / 8) * w + (Math.random() - 0.5) * 12;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let i = 0; i < 7; i += 1) {
      const y = (i / 6) * h + (Math.random() - 0.5) * 12;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 9; i += 1) for (let r = 0; r < h; r += 6) ctx.fillRect((i / 8) * w + 3, r, 1, 1);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { repeat });
}

/**
 * A fuselage lathed from (station, radius) pairs along the body's length. The nose points to -z.
 * `squash` flattens it vertically (fighters are wider than tall).
 */
export function fuselage(profile, { segments = 28, squash = 1, material, samples = 48 }) {
  // resample to even stations so the texture's v runs evenly along the body (liveries stay in proportion)
  const z0 = profile[0][0];
  const z1 = profile[profile.length - 1][0];
  const pts = [];
  for (let i = 0; i <= samples; i += 1) {
    const z = z0 + ((z1 - z0) * i) / samples;
    let k = 0;
    while (k < profile.length - 2 && profile[k + 1][0] < z) k += 1;
    const [za, ra] = profile[k];
    const [zb, rb] = profile[k + 1];
    const t = Math.min(1, Math.max(0, (z - za) / (zb - za)));
    const s = t * t * (3 - 2 * t);
    pts.push(new THREE.Vector2(Math.max(ra + (rb - ra) * (0.5 * t + 0.5 * s), 0.001), z));
  }
  const geometry = new THREE.LatheGeometry(pts, segments);
  geometry.rotateX(Math.PI / 2);
  geometry.scale(1, squash, 1);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function airfoil(x) {
  return 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
}

/**
 * A lofted wing panel extending along +x: root chord at x=0, tip at x=span, the tip's leading edge
 * `sweep` metres aft, raised by `dihedral` metres, with an airfoil of relative `thickness`.
 * `mirror` builds the left-hand panel with correct winding.
 */
export function wing({ span, rootChord, tipChord, sweep, dihedral = 0, thickness = 0.1, mirror = false, chordSteps = 12, spanSteps = 4, camber = 0.6 }) {
  const positions = [];
  const uvs = [];
  const index = [];
  const ring = chordSteps * 2;
  for (let s = 0; s <= spanSteps; s += 1) {
    const t = s / spanSteps;
    const chord = rootChord + (tipChord - rootChord) * t;
    const le = sweep * t;
    const x = span * t;
    const y = dihedral * t;
    for (let i = 0; i < ring; i += 1) {
      const upper = i < chordSteps;
      const k = upper ? i / (chordSteps - 1) : 1 - (i - chordSteps) / (chordSteps - 1);
      const xc = (1 - Math.cos(k * Math.PI)) / 2;
      const th = airfoil(xc) * thickness * chord;
      positions.push(mirror ? -x : x, y + (upper ? th : -th * camber), le + xc * chord);
      uvs.push(t, xc);
    }
  }
  for (let s = 0; s < spanSteps; s += 1) {
    for (let i = 0; i < ring; i += 1) {
      const a = s * ring + i;
      const b = s * ring + ((i + 1) % ring);
      const c = (s + 1) * ring + i;
      const d = (s + 1) * ring + ((i + 1) % ring);
      if (mirror) index.push(a, c, b, b, c, d);
      else index.push(a, b, c, b, d, c);
    }
  }
  // tip cap
  const tip = spanSteps * ring;
  for (let i = 1; i < chordSteps - 1; i += 1) {
    const top = tip + i;
    const bottom = tip + ring - 1 - i;
    const top2 = tip + i + 1;
    const bottom2 = tip + ring - 2 - i;
    if (mirror) index.push(top, bottom, top2, top2, bottom, bottom2);
    else index.push(top, top2, bottom, top2, bottom2, bottom);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A control surface (aileron, elevator, rudder, flap) hinged at its leading edge: returns a pivot
 * whose rotation.x deflects it. `vertical` builds a rudder standing up instead of lying flat.
 */
export function controlSurface({ length, chord, thickness = 0.12, material, vertical = false, taper = 1 }) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -thickness / 2);
  shape.lineTo(chord, -0.01);
  shape.lineTo(chord, 0.01);
  shape.lineTo(0, thickness / 2);
  shape.lineTo(0, -thickness / 2);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  // shape x -> local +z (aft), shape y -> local y, extrusion -> local +x (span)
  geometry.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  if (taper !== 1) {
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i += 1) p.setZ(i, p.getZ(i) * (1 + (taper - 1) * (p.getX(i) / length)));
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  const pivot = new THREE.Group();
  pivot.add(mesh);
  if (vertical) mesh.rotation.z = Math.PI / 2;
  return pivot;
}

const tyreMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
const strutMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.35, metalness: 0.8 });

/**
 * A landing gear leg with wheels, hinged at its top. Its `deploy(t)` (0 stowed, 1 down) swings it
 * about the hinge by `stowAngle` around the chosen axis.
 */
export function gearLeg({ length, wheelRadius, wheels = 1, wheelWidth = 0.25, axis = 'x', stowAngle = Math.PI / 2 }) {
  const pivot = new THREE.Group();
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.18, wheelRadius * 0.22, length, 8), strutMat);
  strut.position.y = -length / 2;
  strut.castShadow = true;
  pivot.add(strut);
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(wheelRadius * 0.5, wheelRadius * 0.5, wheelWidth * 1.05, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const spin = [];
  for (let i = 0; i < wheels; i += 1) {
    const off = wheels === 1 ? 0 : (i - (wheels - 1) / 2) * (wheelWidth * 1.3);
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.position.set(off, -length, 0);
    w.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, strutMat);
    w.add(hub);
    pivot.add(w);
    spin.push(w);
  }
  return {
    pivot,
    length: length + wheelRadius,
    deploy(t) {
      pivot.rotation[axis] = (1 - t) * stowAngle;
    },
    roll(distance) {
      for (const w of spin) w.rotation.x -= distance / wheelRadius;
    },
  };
}

/** Red/green navigation lights, a white tail light and blinking strobes. */
export function navLights(group, left, right, tail) {
  const make = (color, size) => new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  const red = make(0xff2020, 0.12);
  red.position.copy(left);
  const green = make(0x20ff60, 0.12);
  green.position.copy(right);
  const white = make(0xffffff, 0.1);
  white.position.copy(tail);
  const strobeL = make(0xffffff, 0.16);
  strobeL.position.copy(left).add(new THREE.Vector3(0, 0, 0.25));
  const strobeR = strobeL.clone();
  strobeR.position.copy(right).add(new THREE.Vector3(0, 0, 0.25));
  group.add(red, green, white, strobeL, strobeR);
  return (time) => {
    const on = time % 1.2 < 0.06 || (time % 1.2 > 0.16 && time % 1.2 < 0.2);
    strobeL.visible = on;
    strobeR.visible = on;
  };
}

/** A glowing exhaust plume: additive cones whose length and brightness follow the throttle. */
export function exhaustPlume(radius, length, color = 0xff8a3a) {
  const group = new THREE.Group();
  const layers = [];
  for (let i = 0; i < 3; i += 1) {
    const geo = new THREE.ConeGeometry(radius * (1 - i * 0.22), length * (1 - i * 0.25), 18, 1, true);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, (length * (1 - i * 0.25)) / 2);
    const m = new THREE.MeshBasicMaterial({
      color: i === 2 ? 0xfff2c0 : color,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, m);
    layers.push(mesh);
    group.add(mesh);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.95, 20),
    new THREE.MeshBasicMaterial({ color: 0xffa060, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  disc.rotation.y = Math.PI;
  group.add(disc);
  return {
    group,
    set(power, afterburner, time) {
      const flicker = 0.92 + Math.sin(time * 60) * 0.05 + Math.sin(time * 37) * 0.03;
      const len = (0.15 + power * 0.5 + afterburner * 0.9) * flicker;
      group.scale.set(1, 1, Math.max(0.05, len));
      layers.forEach((l, i) => {
        l.material.opacity = (0.05 + power * 0.2 + afterburner * 0.45) * (1 - i * 0.15);
      });
      disc.material.opacity = 0.25 + power * 0.4 + afterburner * 0.35;
      group.visible = power > 0.02;
    },
  };
}

export const materials = {
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0x223844, metalness: 0.2, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 1 }),
  metal: (color = 0x8a8f94, roughness = 0.35) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.85 }),
  paint: (map, roughness = 0.55, metalness = 0.25) => new THREE.MeshStandardMaterial({ map, roughness, metalness }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x0d0f11, roughness: 0.8 }),
};
