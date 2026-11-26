// Runways: a painted asphalt strip (threshold bars, designators, touchdown zone and aiming point,
// centreline), edge and threshold lights, an approach light bar and a working PAPI whose four lamps
// turn red or white with the viewer's real glide angle. Each runway also answers geometric questions
// (where is a point along and across it) for the navigation, landing and mission systems.
import * as THREE from 'three';
import { canvasTexture, grain } from '../core/geometry.js';
import { DEG } from '../core/math.js';

export const designator = (headingDeg) => String(Math.round(((headingDeg % 360) + 360) % 360 / 10) || 36).padStart(2, '0');

function paintRunway(ctx, w, h, length, width, names) {
  grain(ctx, w, h, 62, 26);
  const pxPerM = h / length;
  const mx = w / width;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 400; i += 1) ctx.fillRect(w * 0.35 + Math.random() * w * 0.3, Math.random() * h, 2 + Math.random() * 6, 20 + Math.random() * 140);
  ctx.fillStyle = '#e9ecef';
  ctx.fillRect(mx * 1, 0, mx * 0.9, h);
  ctx.fillRect(w - mx * 1.9, 0, mx * 0.9, h);
  const drawEnd = (flip, name) => {
    ctx.save();
    if (flip) {
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
    }
    // threshold piano keys
    const keyW = mx * 1.8;
    const gap = mx * 1.1;
    for (let i = 0; i < 8; i += 1) {
      const off = mx * 3 + i * (keyW + gap);
      ctx.fillRect(off, h - pxPerM * 36, keyW, pxPerM * 30);
      ctx.fillRect(w - off - keyW, h - pxPerM * 36, keyW, pxPerM * 30);
    }
    ctx.fillRect(mx * 2, h - pxPerM * 4, w - mx * 4, pxPerM * 1.8);
    // designator
    ctx.save();
    ctx.translate(w / 2, h - pxPerM * 62);
    ctx.scale(1, pxPerM * 18 / (mx * 9));
    ctx.font = `bold ${mx * 9}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 0, 0);
    ctx.restore();
    // touchdown zone pairs every 150 m, aiming point at 400 m
    for (let k = 0; k < 6; k += 1) {
      const y = h - pxPerM * (150 + k * 150);
      const bars = k < 2 ? 3 : k < 4 ? 2 : 1;
      for (let b = 0; b < bars; b += 1) {
        ctx.fillRect(mx * (5 + b * 2.4), y - pxPerM * 22, mx * 1.6, pxPerM * 22);
        ctx.fillRect(w - mx * (5 + b * 2.4) - mx * 1.6, y - pxPerM * 22, mx * 1.6, pxPerM * 22);
      }
    }
    ctx.fillRect(mx * 6.5, h - pxPerM * 445, mx * 5.5, pxPerM * 50);
    ctx.fillRect(w - mx * 12, h - pxPerM * 445, mx * 5.5, pxPerM * 50);
    ctx.restore();
  };
  drawEnd(false, names[0]);
  drawEnd(true, names[1]);
  for (let y = pxPerM * 110; y < h - pxPerM * 110; y += pxPerM * 60) ctx.fillRect(w / 2 - mx * 0.45, y, mx * 0.9, pxPerM * 36);
  // tyre marks in the touchdown zones
  ctx.fillStyle = 'rgba(15,15,15,0.35)';
  for (let i = 0; i < 70; i += 1) {
    const y = h - pxPerM * (250 + Math.random() * 500);
    ctx.fillRect(w / 2 + (Math.random() > 0.5 ? 1 : -1) * mx * (3 + Math.random() * 2), y, mx * 0.7, pxPerM * (20 + Math.random() * 60));
    ctx.fillRect(w / 2 + (Math.random() > 0.5 ? 1 : -1) * mx * (3 + Math.random() * 2), pxPerM * (250 + Math.random() * 500), mx * 0.7, pxPerM * (20 + Math.random() * 60));
  }
}

function lightField(positions, color, size) {
  const geometry = new THREE.SphereGeometry(size, 6, 4);
  const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
  const m = new THREE.Matrix4();
  positions.forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * The geometry of a runway (no meshes): thresholds, direction vectors and the questions the
 * navigation, landing and mission systems ask (where is a point along and across it).
 */
export function runwayGeometry({ cx, cz, elevation, headingDeg, length = 2800, width = 45, deck = false }) {
  const hdg = headingDeg * DEG;
  const fwd = new THREE.Vector3(Math.sin(hdg), 0, -Math.cos(hdg));
  const right = new THREE.Vector3(Math.cos(hdg), 0, Math.sin(hdg));
  const start = new THREE.Vector3(cx, elevation, cz).addScaledVector(fwd, -length / 2);
  const end = new THREE.Vector3(cx, elevation, cz).addScaledVector(fwd, length / 2);
  const at = (along, across, up = 0.4) => start.clone().addScaledVector(fwd, along).addScaledVector(right, across).setY(elevation + up);
  const names = [designator(headingDeg), designator(headingDeg + 180)];
  const geo = {
    names,
    name: names[0],
    headingDeg,
    elevation,
    length,
    width,
    deck,
    center: new THREE.Vector3(cx, elevation, cz),
    threshold: start,
    end,
    touchdown: at(300, 0, 0),
    fwd,
    right,
    pointAt: at,
    /** Metres along from the landing threshold, metres right of the centreline, height above it. */
    toLocal(p) {
      const dx = p.x - start.x;
      const dz = p.z - start.z;
      return { along: dx * fwd.x + dz * fwd.z, across: dx * right.x + dz * right.z, height: p.y - elevation };
    },
    contains(p, margin = 0) {
      const l = geo.toLocal(p);
      return l.along >= -margin && l.along <= length + margin && Math.abs(l.across) <= width / 2 + margin;
    },
    update() {},
    papiWhite: () => 2,
  };
  return geo;
}

/**
 * Build a runway centred at (cx, cz) with its primary landing direction `headingDeg`.
 * `deck` runways (a carrier's) skip the shoulders and approach lights.
 */
export function createRunway(scene, { cx, cz, elevation, headingDeg, length = 2800, width = 45, deck = false, lights = true }) {
  const group = new THREE.Group();
  const hdg = headingDeg * DEG;
  const fwd = new THREE.Vector3(Math.sin(hdg), 0, -Math.cos(hdg));
  const right = new THREE.Vector3(Math.cos(hdg), 0, Math.sin(hdg));
  const names = [designator(headingDeg), designator(headingDeg + 180)];
  const tex = canvasTexture(256, 4096, (ctx, w, h) => paintRunway(ctx, w, h, length, width, names), { anisotropy: 16 });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(width, length), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));
  strip.rotation.x = -Math.PI / 2;
  strip.receiveShadow = true;
  const holder = new THREE.Group();
  holder.add(strip);
  if (!deck) {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(width + 24, length + 160), new THREE.MeshStandardMaterial({ color: 0x55585a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.y = -0.05;
    shoulder.receiveShadow = true;
    holder.add(shoulder);
  }
  holder.position.set(cx, elevation + 0.12, cz);
  holder.rotation.y = -hdg;
  group.add(holder);

  const geo = runwayGeometry({ cx, cz, elevation, headingDeg, length, width, deck });
  const at = geo.pointAt;

  const papi = [];
  let approachStrobes = null;
  if (lights) {
    const edge = [];
    for (let s = 0; s <= length; s += 60) edge.push(at(s, -width / 2 - 1), at(s, width / 2 + 1));
    group.add(lightField(edge, 0xfff3d0, 0.35));
    const green = [];
    const red = [];
    for (let a = -width / 2; a <= width / 2; a += 3) {
      green.push(at(-1, a));
      red.push(at(length + 1, a));
    }
    group.add(lightField(green, 0x3dff7a, 0.4), lightField(red, 0xff3b30, 0.4));
    if (!deck) {
      const als = [];
      for (let d = 60; d <= 720; d += 60) {
        for (let a = -8; a <= 8; a += 2) als.push(at(-d, a, 1.5));
        if (d === 300) for (let a = -15; a <= 15; a += 1.5) als.push(at(-d, a, 1.5));
      }
      group.add(lightField(als, 0xfff0c8, 0.45));
      const strobes = [];
      for (let d = 120; d <= 720; d += 60) strobes.push(at(-d, 0, 2));
      approachStrobes = lightField(strobes, 0xffffff, 0.9);
      group.add(approachStrobes);
    }
    // PAPI: four lamps on the left, 300 m past the threshold
    const housing = new THREE.MeshStandardMaterial({ color: 0x333333 });
    for (let i = 0; i < 4; i += 1) {
      const p = at(300, -width / 2 - 14 - i * 9, 0.6);
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1), housing);
      box.position.copy(p).setY(p.y - 0.3);
      box.rotation.y = -hdg;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      lamp.position.copy(p).addScaledVector(fwd, -0.8);
      group.add(box, lamp);
      papi.push({ lamp, angle: [3.5, 3.17, 2.83, 2.5][i], pos: p });
    }
  }
  scene.add(group);

  const runway = Object.assign(geo, {
    group,
    update(time, viewer) {
      for (const lamp of papi) {
        const dx = viewer.x - lamp.pos.x;
        const dz = viewer.z - lamp.pos.z;
        const angle = Math.atan2(viewer.y - lamp.pos.y, Math.hypot(dx, dz)) / DEG;
        lamp.lamp.material.color.setHex(angle > lamp.angle ? 0xffffff : 0xff2a1a);
      }
      if (approachStrobes) {
        const n = approachStrobes.count;
        const phase = Math.floor((time * 2 % 1) * n * 1.4);
        const m = new THREE.Matrix4();
        for (let i = 0; i < n; i += 1) {
          approachStrobes.getMatrixAt(i, m);
          const p = new THREE.Vector3().setFromMatrixPosition(m);
          const on = n - 1 - i === phase;
          m.makeScale(on ? 1 : 0.001, on ? 1 : 0.001, on ? 1 : 0.001).setPosition(p);
          approachStrobes.setMatrixAt(i, m);
        }
        approachStrobes.instanceMatrix.needsUpdate = true;
      }
    },
    /** How many PAPI lamps show white (0..4): 2 is on the 3 degree glide path. */
    papiWhite(viewer) {
      let white = 0;
      for (const lamp of papi) {
        const angle = Math.atan2(viewer.y - lamp.pos.y, Math.hypot(viewer.x - lamp.pos.x, viewer.z - lamp.pos.z)) / DEG;
        if (angle > lamp.angle) white += 1;
      }
      return white;
    },
  });
  return runway;
}

/** A taxiway strip with a yellow centreline between two points. */
export function createTaxiway(scene, a, b, elevation, width = 22) {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const tex = canvasTexture(64, 512, (ctx, w, h) => {
    grain(ctx, w, h, 70, 22);
    ctx.fillStyle = '#e2b52a';
    ctx.fillRect(w / 2 - 1.5, 0, 3, h);
    ctx.fillStyle = 'rgba(230,230,230,0.8)';
    ctx.fillRect(1, 0, 2, h);
    ctx.fillRect(w - 3, 0, 2, h);
  }, { repeat: [1, Math.max(1, len / 120)] });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, len), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = -Math.atan2(b.x - a.x, -(b.z - a.z));
  mesh.position.set((a.x + b.x) / 2, elevation + 0.08, (a.z + b.z) / 2);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
