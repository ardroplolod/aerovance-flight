// The 3D cockpit seen in cockpit view: an instrument panel whose face is the live six-pack canvas,
// a glareshield, window or canopy framing, side consoles, the stick or yoke and the throttle
// quadrant (both move with the pilot's inputs), and a HUD combiner glass in the fighter.
import * as THREE from 'three';

const LAYOUT = {
  fighter: { width: 0.8, depth: 0.72, drop: 0.42, frame: 'canopy', stick: 'stick' },
  airliner: { width: 1.5, depth: 0.95, drop: 0.42, frame: 'windows', stick: 'yoke' },
  light: { width: 1.05, depth: 0.72, drop: 0.36, frame: 'windscreen', stick: 'yoke' },
};

export function createCockpit(model, kind) {
  const L = LAYOUT[kind];
  const group = new THREE.Group();
  const eye = model.eye;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 180;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.85, metalness: 0.2 });
  const darker = new THREE.MeshStandardMaterial({ color: 0x0f1215, roughness: 0.9 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.6, metalness: 0.4 });

  const panel = new THREE.Group();
  const panelH = L.width / 6 + 0.06;
  const body = new THREE.Mesh(new THREE.BoxGeometry(L.width + 0.2, panelH + 0.08, 0.12), dark);
  panel.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(L.width, L.width / 6), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  face.position.z = 0.062;
  panel.add(face);
  panel.position.set(eye.x * 0.2, eye.y - L.drop, eye.z - L.depth);
  panel.rotation.x = -0.25;
  group.add(panel);
  const glare = new THREE.Mesh(new THREE.BoxGeometry(L.width + 0.1, 0.035, 0.22), darker);
  glare.position.set(panel.position.x, panel.position.y + panelH / 2 + 0.06, panel.position.z - 0.05);
  group.add(glare);
  for (const side of [-1, 1]) {
    const console = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.8), dark);
    console.position.set(eye.x + side * (L.width / 2 + 0.05), eye.y - L.drop - 0.12, eye.z - 0.2);
    group.add(console);
  }
  // framing
  if (L.frame === 'canopy') {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.012, 6, 30, Math.PI), frameMat);
    bow.position.set(0, 0.6, eye.z - 0.95);
    bow.scale.set(1, 1.05, 1);
    bow.rotation.x = -0.35;
    group.add(bow);
  } else {
    const posts = L.frame === 'windows' ? [-0.75, -0.02, 0.75] : [-0.55, 0.55];
    for (const x of posts) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.06), frameMat);
      post.position.set(eye.x + x + (L.frame === 'windows' ? 0.55 : 0.3), eye.y - 0.02, eye.z - L.depth + 0.12);
      post.rotation.x = -0.45;
      post.rotation.z = x * 0.25;
      group.add(post);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(L.width + 0.6, 0.08, 0.5), frameMat);
    header.position.set(eye.x + (L.frame === 'windows' ? 0.55 : 0.3), eye.y + 0.3, eye.z - 0.35);
    group.add(header);
  }
  // stick or yoke
  const stick = new THREE.Group();
  if (L.stick === 'stick') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.42, 8), darker);
    shaft.position.y = 0.21;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.12, 8), dark);
    grip.position.y = 0.46;
    stick.add(shaft, grip);
    stick.position.set(eye.x, eye.y - 0.95, eye.z - 0.32);
  } else {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), darker);
    column.rotation.x = Math.PI / 2;
    column.position.z = 0.15;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 8, 24, Math.PI * 1.2), dark);
    wheel.rotation.z = -Math.PI * 0.1 + Math.PI;
    stick.add(column, wheel);
    stick.position.set(eye.x, eye.y - L.drop - 0.05, eye.z - L.depth + 0.28);
  }
  group.add(stick);
  // throttle quadrant
  const lever = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0x30353a, roughness: 0.5 }));
  handle.position.y = 0.16;
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.16, 0.015), darker);
  rod.position.y = 0.08;
  lever.add(rod, handle);
  lever.position.set(eye.x - (L.width / 2 - 0.02), eye.y - L.drop - 0.08, eye.z - 0.25);
  group.add(lever);
  // the cockpit sits inside the fuselage skin: draw it over the airframe, back to front
  const order = (o) => (o === face ? 13 : o === glare ? 12 : o.parent === panel ? 11 : 14);
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.depthTest = false;
    o.material.depthWrite = false;
    o.renderOrder = order(o);
    o.castShadow = false;
  });
  group.visible = false;
  model.group.add(group);
  const ctx = canvas.getContext('2d');
  return {
    group,
    canvas,
    ctx,
    texture,
    update(controls, throttle) {
      if (L.stick === 'stick') {
        stick.rotation.x = -controls.pitch * 0.25;
        stick.rotation.z = -controls.roll * 0.25;
      } else {
        stick.position.z = eye.z - L.depth + 0.28 + controls.pitch * 0.05;
        stick.rotation.z = -controls.roll * 0.6;
      }
      lever.rotation.x = -0.5 + throttle * 1.0;
      texture.needsUpdate = true;
    },
  };
}
