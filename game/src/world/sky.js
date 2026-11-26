// The sky dome (a gradient shader with sun disc, glow and horizon haze) and the cloud field
// (soft billboards painted once on a canvas), both recoloured by the weather and time of day.
import * as THREE from 'three';
import { canvasTexture } from '../core/geometry.js';
import { createRandom } from '../core/random.js';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 ground;
uniform vec3 sunColor;
uniform vec3 sunDir;
uniform float sunSize;
uniform float haze;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.55));
  col = mix(col, ground, smoothstep(0.0, -0.08, h));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * pow(s, 8.0) * 0.35 * haze;
  col += sunColor * pow(s, 64.0) * 0.6;
  col += sunColor * smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.6, s) * 6.0;
  float band = exp(-abs(h) * 14.0);
  col = mix(col, horizon * 1.05 + sunColor * 0.08 * pow(s, 2.0), band * 0.55 * haze);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSky(scene) {
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x2c6bc4) },
      horizon: { value: new THREE.Color(0xbcd6ee) },
      ground: { value: new THREE.Color(0x6b7a86) },
      sunColor: { value: new THREE.Color(0xfff1d6) },
      sunDir: { value: new THREE.Vector3(0.4, 0.5, 0.3) },
      sunSize: { value: 0.0009 },
      haze: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  scene.add(mesh);
  return {
    mesh,
    uniforms: material.uniforms,
    follow(camera) {
      mesh.position.copy(camera.position);
    },
  };
}

function paintCloud(ctx, w, h, rand) {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 26; i += 1) {
    const x = w * (0.2 + rand() * 0.6);
    const y = h * (0.35 + rand() * 0.35);
    const r = w * (0.08 + rand() * 0.16);
    const g = ctx.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r);
    const shade = 225 + Math.floor(rand() * 30);
    g.addColorStop(0, `rgba(${shade},${shade},${shade + 5},0.55)`);
    g.addColorStop(0.6, `rgba(${shade - 20},${shade - 15},${shade - 5},0.25)`);
    g.addColorStop(1, 'rgba(200,205,215,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // a darker, flatter underside reads as volume from below
  const base = ctx.createLinearGradient(0, h * 0.45, 0, h * 0.8);
  base.addColorStop(0, 'rgba(0,0,0,0)');
  base.addColorStop(1, 'rgba(90,100,120,0.18)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * A field of billboard clouds around the world origin. `coverage` (0..1) sets how many are shown,
 * `tint` their colour, so cloudy and storm skies are heavier and darker than a clear one.
 */
export function createClouds(scene, { seed = 7, radius = 16000, count = 140, baseHeight = 1600 } = {}) {
  const rand = createRandom(seed);
  const textures = [0, 1, 2].map(() => canvasTexture(256, 256, (ctx, w, h) => paintCloud(ctx, w, h, rand.next), { anisotropy: 1 }));
  const group = new THREE.Group();
  const sprites = [];
  for (let i = 0; i < count; i += 1) {
    const material = new THREE.SpriteMaterial({ map: textures[i % 3], transparent: true, depthWrite: false, fog: true, opacity: 0.9 });
    const s = new THREE.Sprite(material);
    const a = rand.next() * Math.PI * 2;
    const r = Math.sqrt(rand.next()) * radius;
    const size = 500 + rand.next() * 1400;
    s.position.set(Math.cos(a) * r, baseHeight + rand.next() * 900, Math.sin(a) * r);
    s.scale.set(size * 1.8, size * 0.8, 1);
    s.userData.rank = rand.next();
    sprites.push(s);
    group.add(s);
  }
  scene.add(group);
  return {
    group,
    apply({ coverage, tint, height }) {
      const c = new THREE.Color(tint);
      for (const s of sprites) {
        s.visible = s.userData.rank < coverage;
        s.material.color.copy(c);
        s.material.opacity = 0.65 + coverage * 0.3;
      }
      group.position.y = height - baseHeight;
    },
    drift(dt, wind) {
      for (const s of sprites) {
        s.position.x += wind.x * dt * 0.3;
        s.position.z += wind.z * dt * 0.3;
        if (s.position.x > radius) s.position.x -= radius * 2;
        if (s.position.x < -radius) s.position.x += radius * 2;
        if (s.position.z > radius) s.position.z -= radius * 2;
        if (s.position.z < -radius) s.position.z += radius * 2;
      }
    },
  };
}
