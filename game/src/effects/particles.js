// Sprite particles for what happens on the ground: tyre smoke at touchdown, dust on grass,
// and the fireball and smoke column of a crash.
import * as THREE from 'three';
import { canvasTexture } from '../core/geometry.js';

function puffTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { anisotropy: 1 });
}

export function createParticles(scene, max = 260) {
  const tex = puffTexture();
  const pool = [];
  for (let i = 0; i < max; i += 1) {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(m);
    s.visible = false;
    scene.add(s);
    pool.push({ sprite: s, life: 0, max: 1, vel: new THREE.Vector3(), grow: 1, fade: 1, additive: false });
  }
  let cursor = 0;
  function emit(pos, { vel = new THREE.Vector3(), life = 2, size = 3, grow = 3, color = 0xffffff, opacity = 0.6, additive = false }) {
    const p = pool[cursor];
    cursor = (cursor + 1) % pool.length;
    p.sprite.position.copy(pos);
    p.sprite.scale.setScalar(size);
    p.sprite.material.color.setHex(color);
    p.sprite.material.opacity = opacity;
    p.sprite.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.sprite.visible = true;
    p.vel.copy(vel);
    p.life = life;
    p.max = life;
    p.grow = grow;
    p.fade = opacity;
    p.size = size;
  }
  return {
    tyreSmoke(pos, strength = 1) {
      for (let i = 0; i < 10 * strength + 4; i += 1) {
        emit(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.5, (Math.random() - 0.5) * 3)), { vel: new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2), life: 2.5, size: 2, grow: 5, color: 0xdddddd, opacity: 0.5 });
      }
    },
    dust(pos) {
      emit(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0.4, (Math.random() - 0.5) * 4)), { vel: new THREE.Vector3(0, 0.8, 0), life: 1.8, size: 2, grow: 4, color: 0xb09a72, opacity: 0.35 });
    },
    explosion(pos) {
      for (let i = 0; i < 40; i += 1) {
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
        emit(pos.clone().addScaledVector(dir, Math.random() * 6), { vel: dir.multiplyScalar(8 + Math.random() * 18), life: 1.2 + Math.random(), size: 8, grow: 14, color: i % 3 ? 0xff8a2a : 0xffd07a, opacity: 0.9, additive: true });
      }
      for (let i = 0; i < 50; i += 1) {
        emit(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, Math.random() * 6, (Math.random() - 0.5) * 12)), { vel: new THREE.Vector3((Math.random() - 0.5) * 3, 6 + Math.random() * 8, (Math.random() - 0.5) * 3), life: 6 + Math.random() * 4, size: 10, grow: 9, color: 0x2a2624, opacity: 0.7 });
      }
    },
    smoke(pos) {
      emit(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 2, (Math.random() - 0.5) * 4)), { vel: new THREE.Vector3((Math.random() - 0.5) * 2, 7, (Math.random() - 0.5) * 2), life: 7, size: 8, grow: 8, color: 0x302c2a, opacity: 0.55 });
    },
    update(dt) {
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.sprite.visible = false;
          continue;
        }
        const t = 1 - p.life / p.max;
        p.sprite.position.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(Math.exp(-dt * 0.8));
        p.sprite.scale.setScalar(p.size + p.grow * t * p.size * 0.4);
        p.sprite.material.opacity = p.fade * (1 - t);
      }
    },
  };
}
