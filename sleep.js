import * as THREE from './vendor/three.module.min.js';
import { ROOMS } from './world.js?v=rpg-10';

// 수면실 immersion: lying down there slides the camera into a first-person view
// under a starry ceiling, starts a soft generated lullaby, and after a quiet
// half minute fades the room into a slowly turning galaxy.
export const GALAXY_DELAY = 30;
const room = ROOMS.find(r => r.id === 'sleep');

export function createSleepMode({ scene, canvasTexture }) {
  // ---------- Starry ceiling (only drawn while lying in 수면실) ----------
  const ceilingTexture = canvasTexture((c, w, h) => {
    const sky = c.createLinearGradient(0, 0, w, h); sky.addColorStop(0, '#3a3074'); sky.addColorStop(.5, '#2c2560'); sky.addColorStop(1, '#3a3074'); c.fillStyle = sky; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(255,248,220,${.3 + Math.random() * .6})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, Math.random() * 2.6 + 1, 0, 7); c.fill(); }
    // Glow-in-the-dark star stickers, like a child's bedroom ceiling.
    const star = (x, y, r, color) => { c.shadowColor = color; c.shadowBlur = r * 1.4; c.fillStyle = color; c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); };
    for (let i = 0; i < 14; i++) star(50 + Math.random() * (w - 100), 50 + Math.random() * (h - 100), 22 + Math.random() * 26, ['#fff1a8', '#d9f2c8', '#ffd6e6'][i % 3]);
    c.shadowBlur = 0;
  }, 1024, 1024);
  // About 1.8 m per tile: dense enough to sparkle when seen from the pillow.
  ceilingTexture.wrapS = ceilingTexture.wrapT = THREE.RepeatWrapping; ceilingTexture.repeat.set((room.maxX - room.minX) / 1.8, (room.maxZ - room.minZ) / 1.8);
  const ceilingMaterial = new THREE.MeshBasicMaterial({ map: ceilingTexture, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(room.maxX - room.minX, room.maxZ - room.minZ), ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set((room.minX + room.maxX) / 2, 2.42, (room.minZ + room.maxZ) / 2); ceiling.visible = false; scene.add(ceiling);

  // ---------- Galaxy: nebula dome + spiral of stars around the viewer ----------
  const galaxy = new THREE.Group(); galaxy.visible = false; galaxy.renderOrder = 10; scene.add(galaxy);
  const domeMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float time; uniform float opacity; varying vec3 vDir;
      float hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float v = 0.0, a = .5; for(int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= .5; } return v; }
      void main(){
        vec3 d = normalize(vDir); float t = time*.015;
        float n = fbm(d*2.6 + vec3(t, -t*.6, t*.4)), m = fbm(d*5.0 - vec3(t*.5));
        vec3 base = mix(vec3(.035,.03,.10), vec3(.10,.05,.20), smoothstep(-.4,.9,d.y));
        vec3 nebula = mix(vec3(.55,.25,.75), vec3(.95,.55,.70), m) * smoothstep(.45,.85,n) * .9 + vec3(.20,.45,.85) * smoothstep(.55,.95,m) * .45;
        float s = step(.9965, hash(floor(d*420.0))) * (.6 + .4*sin(time*2.0 + hash(floor(d*420.0))*40.0));
        gl_FragColor = vec4(base + nebula + vec3(s), opacity);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, transparent: true, depthTest: false, depthWrite: false
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 32), domeMaterial); dome.renderOrder = 10; galaxy.add(dome);
  const COUNT = 4200, positions = new Float32Array(COUNT * 3), colors = new Float32Array(COUNT * 3);
  const core = new THREE.Color('#fff0c8'), outer = [new THREE.Color('#8fb6ff'), new THREE.Color('#ff9fd0'), new THREE.Color('#c7a2ff')], color = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const arm = i % 3, radius = Math.pow(Math.random(), 1.9) * 15, spin = radius * .5 + arm / 3 * Math.PI * 2;
    const spread = (Math.random() - .5) * (.6 + radius * .12), lift = (Math.random() - .5) * Math.max(.2, 1 - radius * .06);
    positions[i * 3] = Math.cos(spin) * radius + spread; positions[i * 3 + 1] = Math.sin(spin) * radius + (Math.random() - .5) * (.6 + radius * .12); positions[i * 3 + 2] = lift;
    color.copy(core).lerp(outer[arm], Math.min(1, radius / 11)); colors.set([color.r, color.g, color.b], i * 3);
  }
  const spiralGeometry = new THREE.BufferGeometry();
  spiralGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); spiralGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dot = canvasTexture((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 64, 64);
  const spiralMaterial = new THREE.PointsMaterial({ size: .26, map: dot, vertexColors: true, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const spiral = new THREE.Points(spiralGeometry, spiralMaterial); spiral.renderOrder = 11; galaxy.add(spiral);
  const glowMaterial = new THREE.SpriteMaterial({ map: dot, color: '#ffe2b0', transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const glow = new THREE.Sprite(glowMaterial); glow.scale.setScalar(7); glow.renderOrder = 12; galaxy.add(glow);

  const music = createLullaby();
  const state = { active: false, blend: 0, galaxy: 0, still: 0 };
  const eye = new THREE.Vector3(), look = new THREE.Vector3(), up = new THREE.Vector3(), forward = new THREE.Vector3();

  return {
    state, music, ceiling, galaxy,
    // Jump straight to the sleeping or awake view (used behind a screen fade).
    snap(on) { state.blend = on ? 1 : 0; },
    // `sleeping` = the player lies inside 수면실. Returns the camera blend.
    update(dt, { sleeping, camera, head, feet, reducedMotion, elapsed }) {
      if (sleeping !== state.active) {
        state.active = sleeping; state.still = 0;
        if (sleeping) music.start(); else music.stop();
      }
      if (sleeping) state.still += dt;
      state.blend = THREE.MathUtils.damp(state.blend, sleeping ? 1 : 0, sleeping ? 1.8 : 3.5, dt);
      if (state.blend < .002) state.blend = 0;
      const wantsGalaxy = sleeping && state.still >= GALAXY_DELAY;
      state.galaxy = THREE.MathUtils.damp(state.galaxy, wantsGalaxy ? 1 : 0, wantsGalaxy ? .55 : 3, dt);
      if (state.galaxy < .002) state.galaxy = 0;
      ceiling.visible = state.blend > 0; ceilingMaterial.opacity = Math.min(1, state.blend * 1.4);
      galaxy.visible = state.galaxy > 0;
      if (galaxy.visible) {
        domeMaterial.uniforms.opacity.value = state.galaxy; domeMaterial.uniforms.time.value = reducedMotion ? 0 : elapsed;
        spiralMaterial.opacity = state.galaxy; glowMaterial.opacity = state.galaxy * .7;
      }
      if (state.blend > 0) {
        // Eyes just above the pillow, gazing up at the ceiling and the moon wall
        // beyond the headboard; "up" on screen points past the sleeper's head.
        forward.subVectors(head, feet).setY(0).normalize();
        eye.copy(head).addScaledVector(forward, -.08); eye.y += .2;
        look.copy(eye).addScaledVector(forward, .38); look.y += 1;
        up.copy(forward);
        const t = state.blend * state.blend * (3 - 2 * state.blend);
        const orbitTarget = camera.userData.orbitTarget;
        camera.position.lerp(eye, t);
        camera.up.set(0, 1, 0).lerp(up, t).normalize();
        camera.lookAt(look.lerp(orbitTarget, 1 - t));
        if (galaxy.visible) {
          galaxy.position.copy(camera.position);
          // The spiral floats overhead, facing the sleeper, turning very slowly.
          // The spiral hangs where the sleeper is looking, face-on, turning very slowly.
          camera.getWorldDirection(look); spiral.position.copy(look).multiplyScalar(24);
          spiral.lookAt(camera.position); spiral.rotateZ(reducedMotion ? .4 : .4 + elapsed * .025);
          glow.position.copy(spiral.position);
        }
      } else camera.up.set(0, 1, 0);
      return state.blend;
    }
  };
}

// A gentle, generated lullaby: warm pad chords, a sparse music-box melody and a
// soft reverb. Nothing is downloaded, so there is no licensing question.
function createLullaby() {
  let context = null, master = null, reverb = null, timer = 0, nextChord = 0, nextNote = 0, chordIndex = 0, playing = false;
  let muted = false; try { muted = localStorage.getItem('jjimjiljung-sleep-music') === 'off'; } catch { /* storage may be unavailable */ }
  const chords = [[53, 57, 60, 64], [52, 55, 59, 64], [50, 53, 57, 60], [46, 50, 53, 57]]; // Fmaj7, Em7, Dm7, B♭maj7
  const hz = note => 440 * Math.pow(2, (note - 69) / 12);
  function ensure() {
    if (context) return context;
    const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return null;
    context = new Audio(); master = context.createGain(); master.gain.value = 0;
    reverb = context.createConvolver();
    const length = context.sampleRate * 3.2, impulse = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) { const data = impulse.getChannelData(channel); for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6); }
    reverb.buffer = impulse; const wet = context.createGain(); wet.gain.value = .55;
    master.connect(context.destination); reverb.connect(wet).connect(master);
    return context;
  }
  function voice(frequency, start, length, { type = 'sine', gain = .05, attack = 2.5, filter = 1200, toReverb = .7 } = {}) {
    const osc = context.createOscillator(), amp = context.createGain(), lowpass = context.createBiquadFilter();
    osc.type = type; osc.frequency.value = frequency; lowpass.type = 'lowpass'; lowpass.frequency.value = filter;
    amp.gain.setValueAtTime(0, start); amp.gain.linearRampToValueAtTime(gain, start + attack); amp.gain.exponentialRampToValueAtTime(.0001, start + length);
    osc.connect(lowpass).connect(amp); amp.connect(master);
    if (toReverb) { const send = context.createGain(); send.gain.value = toReverb; amp.connect(send).connect(reverb); }
    osc.start(start); osc.stop(start + length + .1);
  }
  function schedule() {
    const now = context.currentTime;
    while (nextChord < now + 1) {
      const chord = chords[chordIndex++ % chords.length];
      for (const note of chord) { voice(hz(note), nextChord, 9.5, { gain: .028, attack: 3 }); voice(hz(note) * 1.003, nextChord, 9.5, { type: 'triangle', gain: .012, attack: 3.5, filter: 700 }); }
      voice(hz(chord[0] - 12), nextChord, 9, { gain: .035, attack: 2, filter: 400, toReverb: .3 });
      nextChord += 8;
    }
    while (nextNote < now + 1) {
      if (Math.random() < .55) {
        const chord = chords[(chordIndex + chords.length - 1) % chords.length], pick = chord[Math.floor(Math.random() * chord.length)] + 12 + (Math.random() < .3 ? 12 : 0);
        voice(hz(pick), nextNote, 2.4, { gain: .022, attack: .01, filter: 3000, toReverb: 1 });
      }
      nextNote += .9;
    }
  }
  return {
    get playing() { return playing && !muted; },
    get muted() { return muted; },
    // Called from a tap or key press so iOS Safari lets sound start later.
    unlock() { const ctx = ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    start() {
      playing = true; if (muted) return;
      const ctx = ensure(); if (!ctx) return;
      ctx.resume().catch(() => {});
      nextChord = nextNote = ctx.currentTime + .1;
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(.9, ctx.currentTime + 4);
      clearInterval(timer); schedule(); timer = setInterval(schedule, 300);
    },
    stop() {
      playing = false; if (!context) return;
      clearInterval(timer);
      master.gain.cancelScheduledValues(context.currentTime); master.gain.setValueAtTime(master.gain.value, context.currentTime); master.gain.linearRampToValueAtTime(0, context.currentTime + 1.5);
    },
    setMuted(value) {
      muted = value; try { localStorage.setItem('jjimjiljung-sleep-music', value ? 'off' : 'on'); } catch { /* storage may be unavailable */ }
      if (muted) { const wasPlaying = playing; this.stop(); playing = wasPlaying; } else if (playing) this.start();
    },
    suspend() { if (context) context.suspend().catch(() => {}); },
    resume() { if (context && playing && !muted) context.resume().catch(() => {}); }
  };
}
