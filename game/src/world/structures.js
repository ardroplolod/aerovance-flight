// Airfield buildings and props: arched hangars, a control tower with a glazed cab, a terminal with
// jet bridges, support vehicles, fuel tanks, a radar, a windsock that swings with the real wind,
// and instanced city blocks. All are original procedural models with canvas-painted facades.
import * as THREE from 'three';
import { canvasTexture, grain, mergeGeometries, place, tint } from '../core/geometry.js';
import { createRandom } from '../core/random.js';

const mat = (color, roughness = 0.7, metalness = 0.1) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const shadowed = (mesh) => {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

function corrugated(color) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) {
      const g = ctx.createLinearGradient(x, 0, x + 8, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.12)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0.12)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 8, h);
    }
    ctx.fillStyle = 'rgba(60,40,20,0.12)';
    for (let i = 0; i < 40; i += 1) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 10 + Math.random() * 40);
  }, { repeat: [6, 2] });
}

function windows(rows, cols, lit = 0.25) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9aa3ab';
    ctx.fillRect(0, 0, w, h);
    const cw = w / cols;
    const rh = h / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const on = Math.random() < lit;
        ctx.fillStyle = on ? '#f4d79a' : `rgb(${40 + Math.random() * 20},${60 + Math.random() * 20},${80 + Math.random() * 25})`;
        ctx.fillRect(c * cw + cw * 0.12, r * rh + rh * 0.2, cw * 0.76, rh * 0.6);
      }
    }
  });
}

/** An arched maintenance hangar, open at the front so the aircraft inside can be seen. */
export function createHangar(scene, { x, z, y, rotation = 0, width = 60, depth = 50, height = 18, color = '#7d878c', open = true }) {
  const group = new THREE.Group();
  const shell = mat(0xffffff, 0.6, 0.35);
  shell.map = corrugated(color);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(width / 2, width / 2, depth, 32, 1, true, -Math.PI / 2, Math.PI), shell);
  roof.rotation.x = -Math.PI / 2;
  roof.scale.set(1, 1, height / (width / 2));
  roof.position.y = 4;
  roof.material.side = THREE.DoubleSide;
  group.add(shadowed(roof));
  const wallMat = mat(0x6b7479, 0.8, 0.2);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, depth), wallMat);
    wall.position.set((side * width) / 2, 2, 0);
    group.add(shadowed(wall));
  }
  const backShape = new THREE.Shape();
  backShape.moveTo(-width / 2, 0);
  backShape.lineTo(-width / 2, 4);
  backShape.absarc(0, 4, width / 2, Math.PI, 0, true);
  backShape.lineTo(width / 2, 0);
  const back = new THREE.Mesh(new THREE.ShapeGeometry(backShape, 24), wallMat);
  back.position.z = -depth / 2;
  back.scale.set(1, (height + 4) / (width / 2 + 4), 1);
  group.add(shadowed(back));
  if (!open) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, height * 0.8, 0.5), mat(0x59636a, 0.6, 0.4));
    door.position.set(0, height * 0.4, depth / 2);
    group.add(shadowed(door));
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat(0x8c8f8f, 0.5, 0.1));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.05;
  floor.receiveShadow = true;
  group.add(floor);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2d8, toneMapped: false });
  for (let i = -2; i <= 2; i += 1) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 4), lampMat);
    lamp.position.set(i * (width / 6), height + 1.5, 0);
    group.add(lamp);
  }
  // number on the arch
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 3),
    new THREE.MeshBasicMaterial({
      transparent: true,
      map: canvasTexture(256, 64, (ctx, w, h) => {
        ctx.fillStyle = '#f2f4f5';
        ctx.font = 'bold 44px "Helvetica Neue", Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`HANGAR ${1 + Math.floor(Math.random() * 8)}`, w / 2, h * 0.75);
      }),
    }),
  );
  sign.position.set(0, height + 2.6, depth / 2 + 0.3);
  group.add(sign);
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  scene.add(group);
  return group;
}

export function createTower(scene, { x, z, y, height = 38 }) {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, height, 16), mat(0xd9d6cf, 0.8));
  shaft.position.y = height / 2;
  group.add(shadowed(shaft));
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 5, 2.5, 10), mat(0xcfcac2, 0.7));
  deck.position.y = height + 1.2;
  group.add(shadowed(deck));
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(7.8, 7, 4.5, 10, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0x1d3a4a, roughness: 0.05, metalness: 0.6, emissive: 0x0a2230, side: THREE.DoubleSide }),
  );
  glass.position.y = height + 4.7;
  group.add(glass);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.2, 1.2, 10), mat(0x3a3f44, 0.6));
  cap.position.y = height + 7.5;
  group.add(shadowed(cap));
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 6), mat(0xbbbbbb));
  mast.position.y = height + 12;
  group.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }));
  beacon.position.y = height + 16.2;
  group.add(beacon);
  const base = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 14), mat(0xffffff, 0.8));
  base.material.map = windows(2, 8, 0.3);
  base.position.set(10, 4, 0);
  group.add(shadowed(base));
  group.position.set(x, y, z);
  scene.add(group);
  return { group, beacon };
}

export function createTerminal(scene, { x, z, y, rotation = 0, length = 260 }) {
  const group = new THREE.Group();
  const facade = mat(0xffffff, 0.3, 0.3);
  facade.map = windows(3, 30, 0.35);
  facade.map.wrapS = THREE.RepeatWrapping;
  facade.map.repeat.set(4, 1);
  const body = new THREE.Mesh(new THREE.BoxGeometry(length, 16, 46), [facade, facade, mat(0xb8c0c6, 0.6, 0.4), mat(0x777777), facade, facade]);
  body.position.y = 8;
  group.add(shadowed(body));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, length + 10, 32, 1, false, Math.PI / 2 - 0.5, 1.0), mat(0xd7dde2, 0.35, 0.6));
  roof.rotation.z = Math.PI / 2;
  roof.position.y = -20;
  roof.scale.set(1, 1, 1.25);
  group.add(shadowed(roof));
  for (let i = 0; i < 6; i += 1) {
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.4, 30), mat(0xc9ccce, 0.5, 0.3));
    bridge.position.set(-length / 2 + 30 + i * ((length - 60) / 5), 6, 38);
    bridge.rotation.y = 0.25;
    group.add(shadowed(bridge));
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 5, 6), mat(0x555555));
    leg.position.set(bridge.position.x + 4, 2.5, 50);
    group.add(leg);
  }
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  scene.add(group);
  return group;
}

/** A tug, a fuel bowser or a stair truck: low-poly but built from real parts. */
export function createVehicle(scene, { x, z, y, rotation = 0, kind = 'fuel' }) {
  const g = new THREE.Group();
  const paint = kind === 'fuel' ? 0xd8c04a : kind === 'fire' ? 0xc8231e : 0xe8e8e8;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.2), mat(paint, 0.5, 0.3));
  cab.position.set(0, 1.6, 2.6);
  g.add(shadowed(cab));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.1), mat(0x1a2a36, 0.1, 0.8));
  glass.position.set(0, 2.1, 3.72);
  g.add(glass);
  if (kind === 'fuel') {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 5, 14), mat(0xe9e9e4, 0.4, 0.5));
    tank.rotation.x = Math.PI / 2;
    tank.position.set(0, 1.9, -1);
    g.add(shadowed(tank));
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.6, 5), mat(paint, 0.6, 0.2));
    box.position.set(0, 1.8, -1);
    g.add(shadowed(box));
  }
  const wheel = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12);
  wheel.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-1.2, 2.4], [1.2, 2.4], [-1.2, -2.2], [1.2, -2.2]]) {
    const w = new THREE.Mesh(wheel, mat(0x1b1b1b, 0.9));
    w.position.set(wx, 0.5, wz);
    g.add(w);
  }
  g.position.set(x, y, z);
  g.rotation.y = rotation;
  scene.add(g);
  return g;
}

export function createFuelTanks(scene, { x, z, y }) {
  const group = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 12, 24), mat(0xe6e6e0, 0.4, 0.4));
    t.position.set(i * 22, 6, 0);
    group.add(shadowed(t));
  }
  group.position.set(x, y, z);
  scene.add(group);
  return group;
}

export function createRadar(scene, { x, z, y }) {
  const group = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.6, 14, 8), mat(0xaaaaaa, 0.5, 0.6));
  tower.position.y = 7;
  group.add(shadowed(tower));
  const dish = new THREE.Group();
  const reflector = new THREE.Mesh(new THREE.BoxGeometry(9, 2.4, 0.4), mat(0xdadada, 0.4, 0.5));
  reflector.position.z = 0.6;
  dish.add(reflector);
  dish.position.y = 15;
  group.add(dish);
  group.position.set(x, y, z);
  scene.add(group);
  return { group, update: (dt) => (dish.rotation.y += dt * 1.4) };
}

/** A windsock: its sock points downwind and fills with the wind speed. */
export function createWindsock(scene, { x, z, y }) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 7, 6), mat(0xdddddd));
  pole.position.y = 3.5;
  group.add(pole);
  const pivot = new THREE.Group();
  pivot.position.y = 6.8;
  const sockTex = canvasTexture(64, 16, (ctx, w, h) => {
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i % 2 ? '#f5f5f5' : '#ff5a1f';
      ctx.fillRect((i * w) / 5, 0, w / 5 + 1, h);
    }
  });
  const sockGeo = new THREE.CylinderGeometry(0.25, 0.5, 3.4, 10, 1, true);
  sockGeo.rotateZ(Math.PI / 2);
  sockGeo.translate(1.7, 0, 0);
  const sock = new THREE.Mesh(sockGeo, new THREE.MeshStandardMaterial({ map: sockTex, side: THREE.DoubleSide }));
  pivot.add(sock);
  group.add(pivot);
  group.position.set(x, y, z);
  scene.add(group);
  return {
    group,
    update(time, wind) {
      const speed = Math.hypot(wind.x, wind.z);
      pivot.rotation.y = Math.atan2(-wind.z, wind.x) + Math.sin(time * 3) * 0.08;
      sock.rotation.z = -Math.max(0, 1 - speed / 8) * 1.1 + Math.sin(time * 5) * 0.03;
    },
  };
}

/** Instanced city blocks: towers with lit window facades, for the airport's skyline. */
export function createCity(scene, terrain, { cx, cz, radius = 2500, count = 260, seed = 5, avoid = () => false }) {
  const rand = createRandom(seed);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const facade = windows(12, 6, 0.3);
  facade.wrapS = THREE.RepeatWrapping;
  facade.wrapT = THREE.RepeatWrapping;
  const material = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.4, metalness: 0.3 });
  const mesh = new THREE.InstancedMesh(geo, material, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let n = 0;
  for (let i = 0; i < count * 4 && n < count; i += 1) {
    const a = rand.next() * Math.PI * 2;
    const r = Math.sqrt(rand.next()) * radius;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (avoid(x, z)) continue;
    const h = terrain.heightAt(x, z);
    const tall = (1 - r / radius) * 140 + rand.next() * 40 + 12;
    const w = 18 + rand.next() * 26;
    dummy.position.set(x, h - 1, z);
    dummy.scale.set(w, tall, w * (0.7 + rand.next() * 0.6));
    dummy.rotation.y = Math.round(rand.next() * 4) * (Math.PI / 2) + 0.3;
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
    color.setHSL(0.58 + rand.next() * 0.06, 0.1, 0.55 + rand.next() * 0.3);
    mesh.setColorAt(n, color);
    n += 1;
  }
  mesh.count = n;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return mesh;
}

/** A plain apron slab under parked aircraft and buildings. */
export function createApron(scene, { x, z, y, width, depth, rotation = 0 }) {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    grain(ctx, w, h, 112, 26);
    ctx.strokeStyle = 'rgba(40,40,40,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= w; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }
  }, { repeat: [width / 40, depth / 40] });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotation;
  mesh.position.set(x, y + 0.06, z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

/** Light poles along an apron edge. */
export function createLightPoles(scene, points, y) {
  const parts = [];
  for (const p of points) {
    parts.push(tint(place(new THREE.CylinderGeometry(0.15, 0.25, 14, 6), p.x, y + 7, p.z), 0x8a8f94));
    parts.push(tint(place(new THREE.BoxGeometry(2.4, 0.4, 1), p.x, y + 14, p.z), 0x41464b));
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }));
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}
