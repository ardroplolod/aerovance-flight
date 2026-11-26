// Assembles a flyable environment from a map definition: sky, sun, clouds, ocean, terrain with its
// level of detail, runways and the map's own buildings. The result answers the questions every
// other system asks of the world: how high is the ground here and what is it (runway, grass,
// water, a carrier deck), where are the runways, and what does the map look like from above.
import * as THREE from 'three';
import { createSunRig } from '../core/engine.js';
import { createClouds, createSky } from './sky.js';
import { createOcean } from './water.js';
import { createTerrain } from './terrain.js';
import { createRunway, runwayGeometry } from './runway.js';
import { MAPS } from './maps/index.js';

/** Paint a top-down picture of the terrain for the navigation map. */
function paintMinimap(def, terrain, size) {
  const n = 192;
  const canvas = document.createElement('canvas');
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(n, n);
  const water = def.waterLevel ?? -1e9;
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const x = (i / n - 0.5) * size;
      const z = (j / n - 0.5) * size;
      const h = terrain.heightAt(x, z);
      const k = (j * n + i) * 4;
      if (h < water) {
        img.data[k] = 14;
        img.data[k + 1] = 44;
        img.data[k + 2] = 66;
      } else {
        const t = Math.min(1, (h - Math.max(water, def.minimapBase ?? 0)) / (def.minimapRange ?? 1500));
        const contour = Math.abs(((h / 150) % 1) - 0.5) < 0.06 ? 18 : 0;
        img.data[k] = 30 + t * 90 + contour;
        img.data[k + 1] = 60 + t * 70 + contour;
        img.data[k + 2] = 40 + t * 60 + contour;
      }
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function buildEnvironment(mapId, { shadowSize = 2048 } = {}) {
  const def = MAPS[mapId];
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xbcd6ee, 0.00008);
  const sky = createSky(scene);
  const sun = createSunRig(scene, shadowSize, 140);
  const clouds = createClouds(scene, { seed: def.seed + 3, baseHeight: def.cloudBase ?? 1800 });
  const ocean = def.waterLevel !== undefined ? createOcean(scene, { level: def.waterLevel }) : null;
  const heightFn = def.height;
  const terrain = createTerrain(scene, { heightFn, colorFn: def.color, size: def.size ?? 24000, segments: def.segments ?? 320, seed: def.seed });
  const runways = def.runways.map((r) => createRunway(scene, { ...r, elevation: r.elevation ?? heightFn(r.cx, r.cz) }));
  const ctx = { scene, terrain, runways, def };
  const extras = def.build ? def.build(ctx) : {};
  const decks = extras.decks ?? [];

  /** Height and kind of surface under (x, z). */
  function groundAt(x, z) {
    for (const d of decks) {
      const local = d.toLocal(x, z);
      if (local) return { height: d.height, surface: 'deck', water: false, arrest: local.arrest && d.hookArmed() };
    }
    const h = terrain.heightAt(x, z);
    const p = new THREE.Vector3(x, h, z);
    for (const r of runways) if (!r.deck && r.contains(p, 4)) return { height: r.elevation + 0.12, surface: 'runway', water: false };
    if (ocean && h < ocean.level) return { height: ocean.level, surface: 'water', water: true };
    return { height: h, surface: extras.surfaceAt ? extras.surfaceAt(x, z) : 'grass', water: false };
  }

  const size = def.size ?? 24000;
  return {
    id: mapId,
    def,
    name: def.name,
    scene,
    sky,
    sun,
    clouds,
    ocean,
    terrain,
    runways: [...runways, ...(extras.extraRunways ?? [])],
    extras,
    size,
    minimap: paintMinimap(def, terrain, size),
    groundAt,
    update(dt, camera, time, wind, focus) {
      sky.follow(camera);
      if (ocean) ocean.update(dt, camera);
      clouds.drift(dt, wind);
      sun.update(focus ?? camera.position);
      for (const r of this.runways) r.update?.(time, camera.position);
      extras.update?.(dt, time, wind, camera);
    },
  };
}

/**
 * The geometry of a map without building any meshes: runways, the height field and the map's own
 * helpers. The flight deck and briefings use it to show distances, runways and start positions.
 */
export function previewEnvironment(mapId) {
  const def = MAPS[mapId];
  const specs = [...def.runways.map((r) => ({ ...r, elevation: r.elevation ?? def.height(r.cx, r.cz) })), ...(def.previewRunways?.() ?? [])];
  return { id: mapId, def, size: def.size ?? 24000, runways: specs.map(runwayGeometry), terrain: { heightAt: def.height }, groundAt: (x, z) => ({ height: def.height(x, z) }) };
}
