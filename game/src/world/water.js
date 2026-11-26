// The ocean: a large plane whose fragment shader builds moving wave normals, reflects the sky with
// a Fresnel term, glints in the sun and fades into the scene fog.
import * as THREE from 'three';

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float time;
varying vec3 vWorld;
varying float vFog;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  float wave = sin(w.x * 0.02 + time * 0.9) * 0.6 + sin(w.z * 0.027 - time * 1.1) * 0.5;
  w.y += wave * 0.35;
  vWorld = w.xyz;
  vec4 mv = viewMatrix * w;
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;

const FRAG = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform float time;
uniform vec3 deep;
uniform vec3 shallow;
uniform vec3 skyColor;
uniform vec3 sunColor;
uniform vec3 sunDir;
uniform vec3 fogColor;
uniform float fogDensity;
uniform float choppy;
varying vec3 vWorld;
varying float vFog;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float waves(vec2 p) {
  float h = 0.0;
  h += vnoise(p * 0.05 + vec2(time * 0.05, time * 0.03)) * 1.0;
  h += vnoise(p * 0.13 - vec2(time * 0.08, -time * 0.05)) * 0.5;
  h += vnoise(p * 0.41 + vec2(time * 0.17, time * 0.12)) * 0.25;
  h += vnoise(p * 1.3 - vec2(time * 0.3, time * 0.21)) * 0.1;
  return h;
}
void main() {
  #include <logdepthbuf_fragment>
  vec2 p = vWorld.xz;
  float e = 0.6;
  float h0 = waves(p);
  vec3 n = normalize(vec3((h0 - waves(p + vec2(e, 0.0))) * choppy, 1.0, (h0 - waves(p + vec2(0.0, e))) * choppy));
  vec3 view = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, view), 0.0), 4.0);
  vec3 col = mix(deep, shallow, clamp(h0 * 0.6, 0.0, 1.0) * 0.5);
  col = mix(col, skyColor, 0.15 + fres * 0.75);
  vec3 r = reflect(-view, n);
  float spec = pow(max(dot(r, normalize(sunDir)), 0.0), 220.0);
  col += sunColor * spec * 3.0;
  col += sunColor * pow(max(dot(r, normalize(sunDir)), 0.0), 18.0) * 0.08;
  float fog = 1.0 - exp(-fogDensity * fogDensity * vFog * vFog);
  col = mix(col, fogColor, clamp(fog, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createOcean(scene, { level = 0, size = 80000 } = {}) {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      time: { value: 0 },
      deep: { value: new THREE.Color(0x0b3550) },
      shallow: { value: new THREE.Color(0x1d7a8a) },
      skyColor: { value: new THREE.Color(0x9cc4e4) },
      sunColor: { value: new THREE.Color(0xffeedd) },
      sunDir: { value: new THREE.Vector3(0.4, 0.5, 0.3) },
      fogColor: { value: new THREE.Color(0xbcd6ee) },
      fogDensity: { value: 0.00008 },
      choppy: { value: 1.2 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 200, 200), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = level;
  mesh.receiveShadow = false;
  scene.add(mesh);
  return {
    mesh,
    level,
    uniforms: material.uniforms,
    update(dt, camera) {
      material.uniforms.time.value += dt;
      // keep the plane under the camera so the horizon never shows its edge
      mesh.position.x = Math.round(camera.position.x / 400) * 400;
      mesh.position.z = Math.round(camera.position.z / 400) * 400;
    },
  };
}
