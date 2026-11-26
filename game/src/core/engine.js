// The rendering engine: one WebGL renderer, the active scene and camera, a sun rig whose shadow box
// follows the point of interest, and adaptive resolution that trades pixels for a steady frame rate.
import * as THREE from 'three';

const QUALITY = {
  low: { pixelRatio: 0.75, shadowSize: 1024, shadows: true },
  medium: { pixelRatio: 1, shadowSize: 2048, shadows: true },
  high: { pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5), shadowSize: 4096, shadows: true },
};

export function createEngine(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.3, 60000);
  let scene = new THREE.Scene();
  let quality = 'medium';
  let dynamicScale = 1;
  const frameTimes = [];

  function setQuality(name) {
    quality = QUALITY[name] ? name : 'medium';
    dynamicScale = 1;
    resize();
  }

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setPixelRatio(QUALITY[quality].pixelRatio * dynamicScale);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /** Adaptive rendering: below ~40 fps for a while the resolution drops a step; above ~58 it climbs back. */
  function adapt(dt) {
    frameTimes.push(dt);
    if (frameTimes.length < 90) return;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    frameTimes.length = 0;
    const before = dynamicScale;
    if (avg > 1 / 40 && dynamicScale > 0.6) dynamicScale -= 0.1;
    else if (avg < 1 / 58 && dynamicScale < 1) dynamicScale = Math.min(1, dynamicScale + 0.05);
    if (before !== dynamicScale) resize();
  }

  return {
    renderer,
    camera,
    get scene() {
      return scene;
    },
    setScene(next) {
      scene = next;
    },
    get quality() {
      return quality;
    },
    shadowSize: () => QUALITY[quality].shadowSize,
    setQuality,
    resize,
    adapt,
    render() {
      renderer.render(scene, camera);
    },
  };
}

/**
 * A directional sun with a shadow frustum centred on a focus point (the aircraft, the pilot), plus a
 * sky/ground hemisphere fill. `update(focus)` keeps the shadow box on the action with texel snapping.
 */
export function createSunRig(scene, shadowSize = 2048, extent = 120) {
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -extent;
  sun.shadow.camera.right = extent;
  sun.shadow.camera.top = extent;
  sun.shadow.camera.bottom = -extent;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 4000;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a4436, 1.1);
  scene.add(hemi);
  const dir = new THREE.Vector3(0.4, 0.6, 0.3).normalize();
  const snap = (2 * extent) / shadowSize;
  return {
    sun,
    hemi,
    dir,
    setDirection(v) {
      dir.copy(v).normalize();
    },
    setExtent(e) {
      const c = sun.shadow.camera;
      c.left = -e;
      c.right = e;
      c.top = e;
      c.bottom = -e;
      c.updateProjectionMatrix();
    },
    update(focus) {
      const fx = Math.round(focus.x / snap) * snap;
      const fz = Math.round(focus.z / snap) * snap;
      sun.target.position.set(fx, focus.y, fz);
      sun.position.set(fx + dir.x * 1500, focus.y + dir.y * 1500, fz + dir.z * 1500);
      sun.target.updateMatrixWorld();
    },
  };
}
