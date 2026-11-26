// Keyboard and mouse. Axes (pitch, roll, yaw) come from held keys or from the mouse yoke (hold the
// left button and move: the offset from where you pressed is the stick), the throttle is a lever
// moved by keys or the wheel, and one-shot actions (gear, flaps, camera...) are queued as presses.
import { clamp } from './math.js';

const ACTIONS = {
  KeyG: 'gear',
  KeyF: 'flapsDown',
  KeyV: 'flapsUp',
  KeyC: 'camera',
  KeyI: 'engine',
  KeyP: 'pause',
  Escape: 'pause',
  KeyM: 'mute',
  KeyH: 'help',
  KeyN: 'nav',
  KeyR: 'retry',
  Enter: 'confirm',
  Space: 'confirm',
  KeyB: 'parkingBrake',
  Digit1: 'cam1',
  Digit2: 'cam2',
  Digit3: 'cam3',
  Digit4: 'cam4',
  Digit5: 'cam5',
};

export function createInput(target) {
  const held = new Set();
  const presses = [];
  const mouse = { down: false, orbiting: false, orbitWithLeft: false, x0: 0, y0: 0, x: 0, y: 0, wheel: 0, dragX: 0, dragY: 0 };
  let throttle = 0;
  let sensitivity = 1;
  let invert = false;

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!e.repeat && ACTIONS[e.code]) presses.push(ACTIONS[e.code]);
    if (e.code === 'Digit0') throttle = 1;
    if (e.code === 'Backquote') throttle = 0;
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('contextmenu', (e) => e.preventDefault());
  target.addEventListener('mousedown', (e) => {
    if (e.button === 2 || (e.button === 0 && mouse.orbitWithLeft)) mouse.orbiting = true;
    else if (e.button === 0) {
      mouse.down = true;
      mouse.x0 = e.clientX;
      mouse.y0 = e.clientY;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
    mouse.orbiting = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (mouse.orbiting) {
      mouse.dragX += e.clientX - mouse.x;
      mouse.dragY += e.clientY - mouse.y;
    }
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  target.addEventListener('wheel', (e) => {
    mouse.wheel += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  const key = (...codes) => codes.some((c) => held.has(c));

  return {
    held,
    mouse,
    setOptions(opts) {
      sensitivity = opts.sensitivity ?? sensitivity;
      invert = opts.invert ?? invert;
    },
    /** Outside flight (hangar, menus) the left button orbits the camera instead of flying. */
    setOrbitWithLeft(on) {
      mouse.orbitWithLeft = on;
    },
    setThrottle(v) {
      throttle = clamp(v, 0, 1);
    },
    /** Read the flight controls for this frame. */
    flight(dt, flying = true) {
      let pitch = (key('KeyS', 'ArrowDown') ? 1 : 0) - (key('KeyW', 'ArrowUp') ? 1 : 0);
      let roll = (key('KeyD', 'ArrowRight') ? 1 : 0) - (key('KeyA', 'ArrowLeft') ? 1 : 0);
      const yaw = (key('KeyE') ? 1 : 0) - (key('KeyQ') ? 1 : 0);
      if (flying && mouse.down) {
        const scale = Math.min(window.innerWidth, window.innerHeight) * 0.25;
        roll = clamp(((mouse.x - mouse.x0) / scale) * sensitivity, -1, 1);
        pitch = clamp(((mouse.y - mouse.y0) / scale) * sensitivity, -1, 1);
      }
      if (invert) pitch = -pitch;
      if (key('ShiftLeft', 'ShiftRight', 'Equal', 'NumpadAdd', 'PageUp')) throttle += dt * 0.45;
      if (key('ControlLeft', 'ControlRight', 'Minus', 'NumpadSubtract', 'PageDown')) throttle -= dt * 0.45;
      if (mouse.wheel !== 0) {
        throttle -= mouse.wheel * 0.0006;
        mouse.wheel = 0;
      }
      throttle = clamp(throttle, 0, 1);
      return {
        pitch,
        roll,
        yaw,
        throttle,
        afterburner: key('Tab') || throttle >= 0.999,
        brakes: key('Period', 'Comma', 'KeyX'),
        airbrake: key('KeyZ'),
      };
    },
    /** Mouse drag since the last call (for orbit cameras), then reset. */
    takeDrag() {
      const d = { x: mouse.dragX, y: mouse.dragY, wheel: mouse.wheel };
      mouse.dragX = 0;
      mouse.dragY = 0;
      mouse.wheel = 0;
      return d;
    },
    takePresses() {
      return presses.splice(0, presses.length);
    },
    isHeld: key,
  };
}
