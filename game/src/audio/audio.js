// All sound is synthesised live with the Web Audio API (no sample files): turbine whine and roar or
// a piston drone that follow RPM and throttle, the afterburner rumble, wind rising with airspeed,
// rain, the starter motor, gear and flap motors, tyre chirp and landing thump, cockpit alerts
// (stall horn, gear, terrain, fuel), interface clicks and an airfield ambience for the menus.
export function createAudio() {
  let ctx = null;
  let master = null;
  let volume = 0.8;
  let muted = false;
  const nodes = {};
  let noiseBuffer = null;
  const alertTimers = {};

  function noise() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    return src;
  }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i += 1) {
      b = 0.97 * b + 0.03 * (Math.random() * 2 - 1);
      d[i] = (Math.random() * 2 - 1) * 0.5 + b * 4;
    }
    // engine: whine (two detuned oscillators through a bandpass) + roar (filtered noise) + drone
    const whine = ctx.createGain();
    whine.gain.value = 0;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.Q.value = 6;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o1.connect(wf);
    o2.connect(wf);
    wf.connect(whine);
    whine.connect(master);
    o1.start();
    o2.start();
    const roar = ctx.createGain();
    roar.gain.value = 0;
    const rf = ctx.createBiquadFilter();
    rf.type = 'lowpass';
    rf.frequency.value = 400;
    const rn = noise();
    rn.connect(rf);
    rf.connect(roar);
    roar.connect(master);
    rn.start();
    const drone = ctx.createGain();
    drone.gain.value = 0;
    const d1 = ctx.createOscillator();
    d1.type = 'sawtooth';
    const df = ctx.createBiquadFilter();
    df.type = 'lowpass';
    df.frequency.value = 600;
    d1.connect(df);
    df.connect(drone);
    drone.connect(master);
    d1.start();
    // wind
    const wind = ctx.createGain();
    wind.gain.value = 0;
    const wfil = ctx.createBiquadFilter();
    wfil.type = 'bandpass';
    wfil.Q.value = 0.7;
    const wn = noise();
    wn.connect(wfil);
    wfil.connect(wind);
    wind.connect(master);
    wn.start();
    // rain / ambience bed
    const bed = ctx.createGain();
    bed.gain.value = 0;
    const bf = ctx.createBiquadFilter();
    bf.type = 'highpass';
    bf.frequency.value = 1200;
    const bn = noise();
    bn.connect(bf);
    bf.connect(bed);
    bed.connect(master);
    bn.start();
    Object.assign(nodes, { whine, wf, o1, o2, roar, rf, drone, d1, df, wind, wfil, bed, bf });
    return true;
  }

  function blip(freq, dur, type = 'sine', gain = 0.15, slide = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function burst(dur, freq, gain, type = 'lowpass') {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f);
    f.connect(g);
    g.connect(master);
    n.start(t);
    n.stop(t + dur + 0.05);
  }

  const set = (param, value, time = 0.08) => param.setTargetAtTime(value, ctx.currentTime, time);

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    setVolume(v) {
      volume = v;
      if (master) master.gain.value = muted ? 0 : volume;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : volume;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** Called every frame in flight with the aircraft's live state. */
    flight({ engineType, rpm, power, afterburner, airspeed, running, starting, cockpit, rain }) {
      if (!ctx) return;
      const inside = cockpit ? 0.55 : 1;
      const jet = engineType !== 'piston';
      const spin = Math.max(rpm, starting ? rpm : 0);
      set(nodes.o1.frequency, 180 + spin * (jet ? 2600 : 300));
      set(nodes.o2.frequency, 183 + spin * (jet ? 2580 : 298));
      set(nodes.wf.frequency, 400 + spin * (jet ? 3800 : 900));
      set(nodes.whine.gain, (jet ? 0.05 + power * 0.05 : 0.0) * (spin > 0.02 ? 1 : 0) * inside);
      set(nodes.rf.frequency, 250 + power * 900 + (afterburner ? 900 : 0));
      set(nodes.roar.gain, (running ? (jet ? 0.08 + power * 0.32 : 0.05 + power * 0.1) + (afterburner ? 0.35 : 0) : 0) * inside);
      set(nodes.d1.frequency, 28 + spin * 70);
      set(nodes.df.frequency, 300 + power * 900);
      set(nodes.drone.gain, !jet && spin > 0.05 ? (0.05 + power * 0.09) * inside : 0);
      set(nodes.wfil.frequency, 300 + airspeed * 8);
      set(nodes.wind.gain, Math.min(0.32, (airspeed / 300) ** 2 * 0.6) * (cockpit ? 0.6 : 1));
      set(nodes.bed.gain, rain * 0.08, 0.5);
    },
    /** Quiet the engine bed outside flight; `ambient` (0..1) leaves the airfield hum on. */
    idle(ambient = 0) {
      if (!ctx) return;
      set(nodes.whine.gain, ambient * 0.012, 0.4);
      set(nodes.o1.frequency, 900, 0.4);
      set(nodes.o2.frequency, 905, 0.4);
      set(nodes.wf.frequency, 1600, 0.4);
      set(nodes.roar.gain, ambient * 0.05, 0.4);
      set(nodes.rf.frequency, 300, 0.4);
      set(nodes.drone.gain, 0, 0.4);
      set(nodes.wind.gain, ambient * 0.06, 0.6);
      set(nodes.wfil.frequency, 500, 0.4);
      set(nodes.bed.gain, ambient * 0.01, 0.4);
    },
    ui: (kind = 'click') => (kind === 'hover' ? blip(1800, 0.04, 'sine', 0.03) : kind === 'confirm' ? (blip(660, 0.09, 'triangle', 0.1), setTimeout(() => blip(990, 0.12, 'triangle', 0.1), 70)) : blip(1200, 0.06, 'triangle', 0.07)),
    gear: () => {
      burst(1.6, 300, 0.12);
      blip(90, 0.25, 'sawtooth', 0.08, -30);
      setTimeout(() => blip(70, 0.2, 'square', 0.1, -20), 3800);
    },
    flaps: () => (blip(240, 1.2, 'sawtooth', 0.025, 60), burst(1.1, 700, 0.03, 'bandpass')),
    starter: () => {
      blip(120, 3.5, 'sawtooth', 0.04, 500);
      burst(3.8, 900, 0.05, 'bandpass');
    },
    touchdown: (strength) => {
      burst(0.35, 1800, 0.05 + strength * 0.1, 'bandpass');
      blip(60, 0.3, 'sine', 0.1 + strength * 0.35, -30);
    },
    crash: () => {
      burst(2.5, 500, 0.9);
      blip(45, 1.4, 'sawtooth', 0.5, -30);
    },
    checkpoint: () => (blip(880, 0.1, 'sine', 0.12), setTimeout(() => blip(1320, 0.18, 'sine', 0.12), 90)),
    objective: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.1), i * 90)),
    /** Repeating cockpit alerts, rate-limited per kind. */
    alert(kind) {
      const now = performance.now();
      const gap = { stall: 450, terrain: 900, gear: 1100, fuel: 2500, overspeed: 700, engine: 1600 }[kind] ?? 1000;
      if (alertTimers[kind] && now - alertTimers[kind] < gap) return;
      alertTimers[kind] = now;
      if (kind === 'stall') blip(420, 0.35, 'square', 0.06);
      else if (kind === 'terrain') (blip(700, 0.12, 'square', 0.07), setTimeout(() => blip(500, 0.18, 'square', 0.07), 160));
      else if (kind === 'gear') blip(1000, 0.5, 'sine', 0.06);
      else if (kind === 'fuel') (blip(880, 0.15, 'sine', 0.06), setTimeout(() => blip(880, 0.15, 'sine', 0.06), 250));
      else if (kind === 'overspeed') blip(1500, 0.12, 'square', 0.05);
      else if (kind === 'engine') (blip(600, 0.3, 'sawtooth', 0.06), setTimeout(() => blip(400, 0.4, 'sawtooth', 0.06), 330));
    },
  };
}
