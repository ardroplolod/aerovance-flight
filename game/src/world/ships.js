// Vessels: yachts and fishing boats bobbing on the swell, escort destroyers, a lighthouse with a
// turning beam, and the aircraft carrier with its angled deck, island, arresting wires and wake.
import * as THREE from 'three';
import { canvasTexture, grain } from '../core/geometry.js';
import { createRandom } from '../core/random.js';
import { createRunway } from './runway.js';

const mat = (color, roughness = 0.6, metalness = 0.2) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

/** Even-odd point-in-polygon test on a plan outline. */
function insidePlan(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function hullShape(length, beam) {
  const s = new THREE.Shape();
  s.moveTo(0, -length / 2);
  s.quadraticCurveTo(beam / 2, -length * 0.25, beam / 2, length * 0.1);
  s.lineTo(beam / 2 * 0.85, length / 2);
  s.lineTo(-beam / 2 * 0.85, length / 2);
  s.lineTo(-beam / 2, length * 0.1);
  s.quadraticCurveTo(-beam / 2, -length * 0.25, 0, -length / 2);
  return s;
}

function boat(length, color) {
  const g = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(hullShape(length, length * 0.32), { depth: length * 0.12, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const hull = new THREE.Mesh(geo, mat(color, 0.4));
  hull.position.y = -length * 0.05;
  hull.castShadow = true;
  g.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(length * 0.2, length * 0.1, length * 0.3), mat(0xf4f4f4, 0.4));
  cabin.position.set(0, length * 0.11, length * 0.05);
  g.add(cabin);
  return g;
}

export function createBoats(scene, { seed, count, radius, avoid }) {
  const rand = createRandom(seed);
  const boats = [];
  for (let i = 0; i < count * 5 && boats.length < count; i += 1) {
    const x = (rand.next() * 2 - 1) * radius;
    const z = (rand.next() * 2 - 1) * radius;
    if (avoid(x, z)) continue;
    const b = boat(10 + rand.next() * 24, rand.pick([0xffffff, 0x1f4e79, 0xc0392b, 0xe9e2d0]));
    b.position.set(x, 0.3, z);
    b.rotation.y = rand.next() * Math.PI * 2;
    b.userData.speed = rand.next() > 0.5 ? 4 + rand.next() * 6 : 0;
    b.userData.phase = rand.next() * 6;
    scene.add(b);
    boats.push(b);
  }
  return {
    update(dt, time) {
      for (const b of boats) {
        b.rotation.z = Math.sin(time * 0.9 + b.userData.phase) * 0.04;
        b.rotation.x = Math.sin(time * 0.7 + b.userData.phase) * 0.03;
        if (b.userData.speed) {
          b.position.x -= Math.sin(b.rotation.y) * b.userData.speed * dt;
          b.position.z -= Math.cos(b.rotation.y) * b.userData.speed * dt;
        }
      }
    },
  };
}

export function createLighthouse(scene, { x, z, y }) {
  const g = new THREE.Group();
  const stripes = canvasTexture(16, 128, (ctx, w, h) => {
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 ? '#f5f5f5' : '#c0392b';
      ctx.fillRect(0, (i * h) / 8, w, h / 8 + 1);
    }
  });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 26, 16), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6 }));
  tower.position.y = 13;
  tower.castShadow = true;
  g.add(tower);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0, toneMapped: false }));
  lamp.position.y = 27.5;
  g.add(lamp);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(6, 120, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.geometry.translate(0, -60, 0);
  beam.rotation.z = Math.PI / 2;
  const pivot = new THREE.Group();
  pivot.position.y = 27.5;
  pivot.add(beam);
  g.add(pivot);
  g.position.set(x, y, z);
  scene.add(g);
  return { update: (time) => (pivot.rotation.y = time * 0.8) };
}

export function createDestroyer(scene, { x, z, heading = 0 }) {
  const g = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(hullShape(150, 18), { depth: 9, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const hull = new THREE.Mesh(geo, mat(0x59626b, 0.6, 0.3));
  hull.position.y = -3;
  hull.castShadow = true;
  g.add(hull);
  const sup = new THREE.Mesh(new THREE.BoxGeometry(11, 10, 30), mat(0x707a83, 0.6, 0.3));
  sup.position.set(0, 11, 5);
  g.add(sup);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 18, 6), mat(0x5a636b));
  mast.position.set(0, 24, 2);
  g.add(mast);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 6), mat(0x6a737c));
  gun.position.set(0, 7.5, -45);
  g.add(gun);
  g.position.set(x, 0, z);
  g.rotation.y = -heading * (Math.PI / 180);
  scene.add(g);
  return g;
}

/** The angled landing area of a carrier at (x, z), as a runway spec. */
export function carrierRunwaySpec(x = 0, z = 0) {
  const a = (-9 * Math.PI) / 180;
  const cx = x - 6 + Math.sin(a) * 115;
  const cz = z + 330 / 2 - 10 - Math.cos(a) * 115;
  return { cx, cz, elevation: 20.05, headingDeg: 351, length: 230, width: 26, deck: true };
}

/**
 * The carrier: a 330 m flight deck 20 m above the sea, its landing area angled 9 degrees to port
 * with four arresting wires, the island on the starboard side and a foaming wake astern.
 */
export function createCarrier(scene, { x = 0, z = 0 } = {}) {
  const DECK = 20;
  const L = 330;
  const g = new THREE.Group();
  const PLAN = [[-18, -L / 2 + 10], [0, -L / 2 - 6], [20, -L / 2 + 10], [38, -40], [40, L / 2], [-30, L / 2], [-44, 45], [-48, -75], [-26, -110]];
  const outline = new THREE.Shape(PLAN.map(([px, pz]) => new THREE.Vector2(px, pz)));
  const deckTex = canvasTexture(512, 1024, (ctx, w, h) => {
    grain(ctx, w, h, 74, 20);
    const sx = w / 92;
    const sz = h / 350;
    const X = (v) => (v + 50) * sx;
    const Z = (v) => (v + L / 2 + 8) * sz;
    ctx.strokeStyle = '#e8e8e2';
    ctx.lineWidth = 3;
    // angled landing area edges (9 deg to port)
    const a = (-9 * Math.PI) / 180;
    const ax = -6;
    const az = L / 2 - 10;
    for (const off of [-13, 13]) {
      ctx.beginPath();
      ctx.moveTo(X(ax + off), Z(az));
      ctx.lineTo(X(ax + off + Math.sin(a) * 230), Z(az - Math.cos(a) * 230));
      ctx.stroke();
    }
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    ctx.moveTo(X(ax), Z(az));
    ctx.lineTo(X(ax + Math.sin(a) * 230), Z(az - Math.cos(a) * 230));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#e6c229';
    ctx.lineWidth = 2;
    for (const cx of [8, 22]) {
      ctx.beginPath();
      ctx.moveTo(X(cx), Z(-L / 2 + 10));
      ctx.lineTo(X(cx), Z(-40));
      ctx.stroke();
    }
    ctx.fillStyle = '#f2f2ee';
    ctx.font = 'bold 90px "Helvetica Neue", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('09', X(-10), Z(-80));
  }, { anisotropy: 16 });
  const geo = new THREE.ExtrudeGeometry(outline, { depth: 26, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  // top face uvs from plan position
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) uv.setXY(i, (pos.getX(i) + 50) / 92, 1 - (pos.getZ(i) + L / 2 + 8) / 350);
  const hullMats = [new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.9 }), mat(0x58616a, 0.7, 0.3)];
  const hull = new THREE.Mesh(geo, hullMats);
  hull.position.y = DECK;
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);
  const below = new THREE.Mesh(new THREE.BoxGeometry(60, 10, L - 30), mat(0x47505a, 0.7, 0.3));
  below.position.set(-2, -2, 5);
  g.add(below);
  // island
  const island = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(10, 18, 34), mat(0x6c757e, 0.6, 0.3));
  block.position.y = 9;
  block.castShadow = true;
  island.add(block);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(11, 3, 12), mat(0x2a3540, 0.2, 0.6));
  bridge.position.set(0, 16, -6);
  island.add(bridge);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 20, 6), mat(0x6c757e));
  mast.position.set(0, 28, 2);
  island.add(mast);
  const radar = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 0.5), mat(0xbfc5ca));
  radar.position.set(0, 34, 2);
  island.add(radar);
  const number = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshBasicMaterial({
    transparent: true,
    map: canvasTexture(128, 96, (ctx, w, h) => {
      ctx.fillStyle = '#f0f0ea';
      ctx.font = 'bold 80px "Helvetica Neue", Arial';
      ctx.textAlign = 'center';
      ctx.fillText('91', w / 2, h * 0.85);
    }),
  }));
  number.position.set(-5.1, 8, -2);
  number.rotation.y = -Math.PI / 2;
  island.add(number);
  island.position.set(30, DECK, 20);
  g.add(island);
  // wake
  const wakeTex = canvasTexture(128, 512, (ctx, w, h) => {
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(255,255,255,0.75)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    for (let i = 0; i < 300; i += 1) {
      const yy = Math.random() * h;
      const spread = (yy / h) * w * 0.5 + 8;
      ctx.globalAlpha = 1 - yy / h;
      ctx.fillRect(w / 2 + (Math.random() - 0.5) * spread * 2, yy, 3 + Math.random() * 6, 2);
    }
  });
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(80, 700), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false }));
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, 0.4, L / 2 + 340);
  g.add(wake);
  // arresting wires across the angled deck
  const wires = [];
  const a = (-9 * Math.PI) / 180;
  const fwd = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
  const right = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  const origin = new THREE.Vector3(-6, DECK + 0.15, L / 2 - 10);
  const wireMat = mat(0x222222, 0.5, 0.7);
  for (let i = 0; i < 4; i += 1) {
    const p = origin.clone().addScaledVector(fwd, 40 + i * 13);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 26, 6), wireMat);
    wire.position.copy(p);
    wire.rotation.z = Math.PI / 2;
    wire.rotation.y = -a;
    g.add(wire);
    wires.push(p);
  }
  g.position.set(x, 0, z);
  scene.add(g);

  // landing runway markings/lights on the angled deck, in world space
  const runway = createRunway(scene, carrierRunwaySpec(x, z));
  runway.group.children.forEach((c) => {
    if (c.isGroup) c.visible = false;
  });

  const deck = {
    height: DECK + 0.05,
    hookArmed: () => true,
    toLocal(px, pz) {
      const lx = px - x;
      const lz = pz - z;
      if (!insidePlan(PLAN, lx, lz)) return null;
      const rel = new THREE.Vector3(lx, 0, lz).sub(origin);
      const along = rel.dot(fwd);
      const across = rel.dot(right);
      return { arrest: along > 30 && along < 95 && Math.abs(across) < 14 };
    },
  };
  return { group: g, deck, runway, deckHeight: DECK };
}
