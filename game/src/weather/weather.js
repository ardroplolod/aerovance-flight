// Weather and time of day. A time preset places the sun and colours the sky; a condition preset
// sets cloud cover, fog (and so visibility), rain, wind and turbulence. Both feed the renderer
// (lights, fog, exposure), the flight model (wind, gusts, turbulence) and the HUD (visibility).
import * as THREE from 'three';
import { createRandom } from '../core/random.js';
import { DEG } from '../core/math.js';

export const TIMES = {
  sunrise: { label: 'Sunrise', elevation: 9, azimuth: 100, sun: 0xffbe8a, sunI: 3.2, zenith: 0x3d68a8, horizon: 0xf3bc92, hemiSky: 0xb4c4e2, hemiGround: 0x6a5846, hemiI: 1.0, exposure: 1.05 },
  morning: { label: 'Morning', elevation: 28, azimuth: 120, sun: 0xfff0d8, sunI: 3.2, zenith: 0x2f69c2, horizon: 0xbdd5ea, hemiSky: 0xbfd6f5, hemiGround: 0x5e5644, hemiI: 1.05, exposure: 1.0 },
  noon: { label: 'Midday', elevation: 62, azimuth: 170, sun: 0xffffff, sunI: 3.6, zenith: 0x2a63bf, horizon: 0xc4daee, hemiSky: 0xc8dcf8, hemiGround: 0x60584a, hemiI: 1.1, exposure: 0.95 },
  sunset: { label: 'Sunset', elevation: 9, azimuth: 258, sun: 0xffa866, sunI: 3.2, zenith: 0x3a5590, horizon: 0xf5a874, hemiSky: 0xa8b2d6, hemiGround: 0x6a5040, hemiI: 0.95, exposure: 1.02 },
  dusk: { label: 'Dusk', elevation: -2, azimuth: 275, sun: 0x8a7cff, sunI: 0.5, zenith: 0x101a36, horizon: 0x5d4a6e, hemiSky: 0x3b4a7a, hemiGround: 0x1e1a22, hemiI: 0.55, exposure: 1.25 },
};

export const CONDITIONS = {
  clear: { label: 'Clear', clouds: 0.25, fog: 0.000055, rain: 0, wind: 4, gust: 1, turbulence: 0, cloudTint: 0xffffff, dim: 1 },
  cloudy: { label: 'Cloudy', clouds: 0.75, fog: 0.00009, rain: 0, wind: 7, gust: 2, turbulence: 0.6, cloudTint: 0xd8dde4, dim: 0.75 },
  fog: { label: 'Fog', clouds: 0.5, fog: 0.00042, rain: 0, wind: 2, gust: 0.5, turbulence: 0, cloudTint: 0xd0d4d8, dim: 0.7 },
  rain: { label: 'Rain', clouds: 0.95, fog: 0.00022, rain: 0.7, wind: 9, gust: 3, turbulence: 1.2, cloudTint: 0x9aa2ac, dim: 0.5 },
  storm: { label: 'Storm', clouds: 1, fog: 0.0003, rain: 1, wind: 15, gust: 6, turbulence: 2.6, cloudTint: 0x6a707a, dim: 0.35, lightning: true },
};

function createRain(scene) {
  const count = 5000;
  const positions = new Float32Array(count * 6);
  const rand = createRandom(77);
  for (let i = 0; i < count; i += 1) {
    const x = rand.range(-120, 120);
    const y = rand.range(-60, 80);
    const z = rand.range(-120, 120);
    positions.set([x, y, z, x, y - 1.4, z], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaabbcc, transparent: true, opacity: 0.45, depthWrite: false }));
  lines.frustumCulled = false;
  lines.visible = false;
  scene.add(lines);
  return { lines, offset: 0 };
}

export function createWeather(env) {
  const rain = createRain(env.scene);
  const state = {
    time: 'morning',
    condition: 'clear',
    wind: new THREE.Vector3(),
    windDir: 250,
    windSpeed: 4,
    turbulence: 0,
    visibility: 30,
    flash: 0,
  };
  const base = { fog: 0.00006 };
  const fogColor = new THREE.Color();
  const sunDir = new THREE.Vector3();

  function apply(timeId, conditionId, windDir = state.windDir) {
    const t = TIMES[timeId] ?? TIMES.morning;
    const c = CONDITIONS[conditionId] ?? CONDITIONS.clear;
    state.time = timeId;
    state.condition = conditionId;
    state.windDir = windDir;
    state.windSpeed = c.wind;
    state.turbulence = c.turbulence;
    base.fog = c.fog;
    const el = Math.max(t.elevation, 2) * DEG;
    const az = t.azimuth * DEG;
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    env.sun.setDirection(sunDir);
    env.sun.sun.color.setHex(t.sun);
    env.sun.sun.intensity = t.sunI * (0.35 + 0.65 * c.dim);
    env.sun.hemi.color.setHex(t.hemiSky);
    env.sun.hemi.groundColor.setHex(t.hemiGround);
    env.sun.hemi.intensity = t.hemiI * (0.75 + 0.25 * c.dim);
    const grey = new THREE.Color(0x8e959e);
    const zenith = new THREE.Color(t.zenith).lerp(grey, (1 - c.dim) * 0.8);
    const horizon = new THREE.Color(t.horizon).lerp(new THREE.Color(0xaeb4ba), (1 - c.dim) * 0.75);
    const u = env.sky.uniforms;
    u.zenith.value.copy(zenith);
    u.horizon.value.copy(horizon);
    u.ground.value.copy(horizon).multiplyScalar(0.6);
    u.sunColor.value.setHex(t.sun).multiplyScalar(c.dim);
    u.sunDir.value.copy(sunDir);
    u.haze.value = 0.6 + (1 - c.dim);
    fogColor.copy(horizon).lerp(zenith, 0.15);
    env.scene.fog.color.copy(fogColor);
    env.scene.fog.density = base.fog;
    env.clouds.apply({ coverage: c.clouds, tint: new THREE.Color(c.cloudTint).lerp(new THREE.Color(t.sun), 0.25).getHex(), height: env.def.cloudBase ?? 1800 });
    if (env.ocean) {
      const o = env.ocean.uniforms;
      o.skyColor.value.copy(horizon).lerp(zenith, 0.3);
      o.sunColor.value.setHex(t.sun).multiplyScalar(c.dim);
      o.sunDir.value.copy(sunDir);
      o.fogColor.value.copy(fogColor);
      o.fogDensity.value = base.fog;
      o.choppy.value = 0.8 + c.wind * 0.12;
    }
    rain.lines.visible = c.rain > 0;
    rain.lines.material.opacity = 0.25 + c.rain * 0.3;
    state.visibility = Math.min(50, 1.73 / (base.fog * 1000));
    state.exposure = t.exposure;
    state.lightning = !!c.lightning;
    state.rain = c.rain;
    state.sunDir = sunDir.clone();
    return state;
  }

  return {
    state,
    apply,
    /** Wind with gusts, the rain curtain around the camera and storm lightning. */
    update(dt, time, camera, renderer) {
      const c = CONDITIONS[state.condition];
      const gust = Math.sin(time * 0.37) * 0.6 + Math.sin(time * 1.13 + 1) * 0.4;
      const speed = state.windSpeed + gust * c.gust;
      // wind blows FROM windDir
      const a = state.windDir * DEG;
      state.wind.set(-Math.sin(a) * speed, 0, Math.cos(a) * speed);
      state.gustSpeed = speed;
      if (rain.lines.visible) {
        rain.offset = (rain.offset + dt * 38) % 140;
        rain.lines.position.set(camera.position.x, camera.position.y + 40 - rain.offset, camera.position.z);
      }
      if (state.lightning) {
        if (state.flash <= 0 && Math.random() < dt * 0.12) state.flash = 0.35;
        state.flash = Math.max(0, state.flash - dt);
        const f = state.flash > 0.25 || (state.flash > 0.08 && state.flash < 0.14) ? 1 : 0;
        env.sun.hemi.intensity = TIMES[state.time].hemiI * 0.6 + f * 3;
      }
      renderer.toneMappingExposure = state.exposure ?? 1;
    },
  };
}
