// Forests and palm groves as instanced meshes: thousands of trees in a handful of draw calls,
// scattered where the ground is gentle and the climate (height band) suits them.
import * as THREE from 'three';
import { mergeGeometries, place, tint } from '../core/geometry.js';
import { createRandom } from '../core/random.js';

function conifer() {
  const parts = [tint(place(new THREE.CylinderGeometry(0.35, 0.5, 3, 5), 0, 1.5, 0), 0x4a3424)];
  for (let i = 0; i < 3; i += 1) {
    parts.push(tint(place(new THREE.ConeGeometry(3.2 - i * 0.8, 4.2, 7), 0, 3.6 + i * 2.3, 0), i === 0 ? 0x1f4a2a : i === 1 ? 0x26573a : 0x2d6340));
  }
  return mergeGeometries(parts);
}

function broadleaf() {
  return mergeGeometries([
    tint(place(new THREE.CylinderGeometry(0.35, 0.55, 3.5, 5), 0, 1.75, 0), 0x50392a),
    tint(place(new THREE.IcosahedronGeometry(3.4, 1), 0, 5.6, 0, 0, 0, 0, new THREE.Vector3(1, 0.85, 1)), 0x3b6b2c),
    tint(place(new THREE.IcosahedronGeometry(2.4, 1), 1.6, 6.8, 0.8), 0x4a7d33),
  ]);
}

function palm() {
  const parts = [];
  for (let i = 0; i < 6; i += 1) parts.push(tint(place(new THREE.CylinderGeometry(0.28, 0.34, 1.6, 6), i * 0.18, 0.8 + i * 1.5, 0, 0, 0, -0.06), 0x8a6a48));
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = new THREE.BoxGeometry(0.9, 0.08, 5);
    leaf.translate(0, 0, 2.5);
    parts.push(tint(place(leaf, 1.05, 9.4, 0, 0.35, a, 0), i % 2 ? 0x2f7a32 : 0x3d8f3a));
  }
  return mergeGeometries(parts);
}

const KINDS = { conifer, broadleaf, palm };

/**
 * Scatter `count` trees of the given kinds. `accept(x, z, h)` says whether a spot may hold a tree
 * (not on a runway, not under water, not on a cliff).
 */
export function createForest(scene, terrain, { kinds = ['conifer', 'broadleaf'], count = 6000, radius = 11000, seed = 11, accept, cluster }) {
  const rand = createRandom(seed);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const meshes = [];
  const dummy = new THREE.Object3D();
  for (const kind of kinds) {
    const geometry = KINDS[kind]();
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    let placed = 0;
    for (let tries = 0; tries < count * 8 && placed < count; tries += 1) {
      const x = (rand.next() * 2 - 1) * radius;
      const z = (rand.next() * 2 - 1) * radius;
      if (cluster && cluster(x, z) < rand.next()) continue;
      const h = terrain.heightAt(x, z);
      if (!accept(x, z, h)) continue;
      const slope = Math.abs(terrain.heightAt(x + 8, z) - h) + Math.abs(terrain.heightAt(x, z + 8) - h);
      if (slope > 7) continue;
      const s = 0.7 + rand.next() * 0.9;
      dummy.position.set(x, h - 0.3, z);
      dummy.rotation.set(0, rand.next() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.85 + rand.next() * 0.4), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed += 1;
    }
    mesh.count = placed;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    meshes.push(mesh);
  }
  return { meshes };
}
