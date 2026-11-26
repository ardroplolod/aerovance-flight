// Navigation rings: glowing gates with chevrons. A ring is passed when the aircraft crosses its
// plane inside its radius; the next ring in the sequence is highlighted, later ones dimmed.
import * as THREE from 'three';

const ACTIVE = new THREE.Color(0x35f2c2);
const NEXT = new THREE.Color(0xffc24a);
const DONE = new THREE.Color(0x3a5a66);

export function createRings(scene, specs) {
  const group = new THREE.Group();
  const rings = specs.map((spec) => {
    const radius = spec.radius ?? 60;
    const holder = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: NEXT, transparent: true, opacity: 0.9, toneMapped: false });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(radius, Math.max(1.6, radius * 0.035), 10, 64), mat);
    holder.add(torus);
    const glowMat = new THREE.MeshBasicMaterial({ color: NEXT, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const glow = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.11, 8, 64), glowMat);
    holder.add(glow);
    for (let i = 0; i < 4; i += 1) {
      const chevron = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.08, radius * 0.16, 3), mat);
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      chevron.position.set(Math.cos(a) * radius * 0.82, Math.sin(a) * radius * 0.82, 0);
      chevron.rotation.z = a + Math.PI / 2;
      holder.add(chevron);
    }
    holder.position.copy(spec.pos);
    const normal = spec.dir.clone().normalize();
    holder.lookAt(spec.pos.clone().add(normal));
    group.add(holder);
    return { ...spec, radius, holder, torus, glow, mat, glowMat, normal, passed: false, lastSide: null };
  });
  scene.add(group);
  return {
    group,
    rings,
    /** Highlight `index` as the active ring. */
    highlight(index, time) {
      rings.forEach((r, i) => {
        const c = i < index ? DONE : i === index ? ACTIVE : NEXT;
        r.mat.color.copy(c);
        r.glowMat.color.copy(c);
        r.mat.opacity = i < index ? 0.25 : i === index ? 0.95 : 0.55;
        r.glowMat.opacity = i === index ? 0.25 + Math.sin(time * 5) * 0.1 : 0.08;
        r.holder.visible = i >= index - 1;
        r.torus.rotation.z = time * (i === index ? 0.6 : 0.15);
      });
    },
    /** Test the aircraft path segment (prev -> cur) against ring `index`. */
    test(index, prev, cur) {
      const r = rings[index];
      if (!r) return false;
      const a = prev.clone().sub(r.pos).dot(r.normal);
      const b = cur.clone().sub(r.pos).dot(r.normal);
      if (a < 0 && b >= 0) {
        const t = a / (a - b);
        const hit = prev.clone().lerp(cur, t);
        if (hit.distanceTo(r.pos) <= r.radius * 1.05) {
          r.passed = true;
          return true;
        }
      }
      return false;
    },
    dispose() {
      scene.remove(group);
    },
  };
}
