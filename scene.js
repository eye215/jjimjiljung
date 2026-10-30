import * as THREE from './vendor/three.module.min.js';
import { planPath, stepMovement } from './navigation.js?v=rpg-5';
import { createCharacterKit, PALETTES, mesh } from './character.js?v=rpg-5';
import { buildWorld } from './environment.js?v=rpg-5';
import { ROOMS, DESTINATIONS, SPAWN, roomAt } from './world.js?v=rpg-5';
import { createSleepMode, GALAXY_DELAY } from './sleep.js?v=rpg-5';
import { createSocial } from './social.js?v=rpg-5';
import { createWallet, REST_SECONDS } from './economy.js?v=rpg-5';
import { createShop } from './shop.js?v=rpg-5';

// Everything, including textures and the pinned renderer, is served by Pages.
// No model, font, analytics, or CDN request is needed to enter the room.
const viewport = document.querySelector('#viewport');
const actionButtons = [...document.querySelectorAll('[data-action]')];
const outfitButtons = [...document.querySelectorAll('[data-color]')];
const status = document.querySelector('#status');
const badge = document.querySelector('.room-badge');
const roomToast = document.querySelector('#destination-label');
const hint = document.querySelector('#hint');
const coarsePointer = matchMedia('(pointer: coarse)').matches;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionPreference.matches;
motionPreference.addEventListener('change', e => { reducedMotion = e.matches; });
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  window.showRoomError('이 브라우저에서 3D 화면을 열 수 없어요. 최신 Safari 또는 Chrome에서 다시 들어와 주세요.');
  clearTimeout(window.roomLoadTimer);
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarsePointer ? 1.5 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
viewport.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2e1d14');
scene.fog = new THREE.Fog('#2e1d14', 24, 46);
const camera = new THREE.PerspectiveCamera(36, 1, .1, 90);
camera.userData.orbitTarget = new THREE.Vector3();
const ambient = new THREE.HemisphereLight('#fff1da', '#8a5a3c', 1.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#ffd7a8', 2.1);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: .5, far: 40 });
sun.shadow.normalBias = .03; sun.shadow.bias = -.0004; sun.shadow.radius = 3;
scene.add(sun, sun.target);

const kit = createCharacterKit(renderer);
const world = buildWorld({ scene, kit });
const sleep = createSleepMode({ scene, canvasTexture: kit.canvasTexture });

// A contact shadow supplements real shadow maps beneath the plush character.
const shadowTexture = kit.canvasTexture((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(87,56,33,.32)'); g.addColorStop(.55, 'rgba(87,56,33,.14)'); g.addColorStop(1, 'rgba(87,56,33,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 128, 128);
const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
function contactShadow() { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1), shadowMaterial); s.rotation.x = -Math.PI / 2; s.renderOrder = 1; scene.add(s); return s; }

const ACTOR_SCALE = .62, WALK_SPEED = 2.5;
let savedOutfit = 'peach';
try { savedOutfit = PALETTES[localStorage.getItem('jjimjiljung-outfit')] ? localStorage.getItem('jjimjiljung-outfit') : 'peach'; } catch { /* Private browsing may disable storage. */ }
const player = kit.createCharacter(PALETTES[savedOutfit]);
const { root: hero, arms, legs, faceMaterial } = player;
scene.add(hero); hero.scale.setScalar(ACTOR_SCALE); hero.position.set(SPAWN.x, 0, SPAWN.z);
const shadow = contactShadow();

// Resident guests keep every room feeling lived in. They share the player model.
const residents = [
  { x: -4.6, z: 4.6, y: .09, face: -Math.PI / 2, action: 'sit', colors: ['#dca26e', '#bf8e65', '#f2d7b1', '#96724f', '#96724f'] },
  { x: 3.2, z: -8.5, y: .05, face: -.5, action: 'sit', colors: ['#ead7ad', '#c5b784', '#fff1cc', '#bac39a', '#a7b58b'] },
  { x: 9.5, z: -11.05, y: .1, face: 0, action: 'lie', colors: PALETTES.lilac },
  { x: 14.5, z: -1.7, y: 0, face: -Math.PI / 2, action: 'stand', greeter: true, colors: ['#c9a7d4', '#a88dbc', '#f2d7b1', '#b195c8', '#b195c8'] },
  { x: -12.6, z: 1.7, y: .07, face: 0, action: 'lie', colors: PALETTES.mint }
].map(config => {
  const actor = kit.createCharacter(config.colors);
  actor.root.position.set(config.x, config.y, config.z); actor.root.rotation.y = config.face; actor.root.scale.setScalar(ACTOR_SCALE);
  scene.add(actor.root); actor.config = config; if (config.action !== 'lie') contactShadow().position.set(config.x, .012, config.z);
  return actor;
});

// A few translucent motes near the player, kept subtle and disabled for reduced motion.
const motePositions = new Float32Array(40 * 3); for (let i = 0; i < 40; i++) { motePositions[i * 3] = (Math.random() - .5) * 12; motePositions[i * 3 + 1] = Math.random() * 3 + .4; motePositions[i * 3 + 2] = (Math.random() - .5) * 10; }
const motesGeometry = new THREE.BufferGeometry(); motesGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
const motes = new THREE.Points(motesGeometry, new THREE.PointsMaterial({ color: '#fff3ce', size: .05, transparent: true, opacity: .55, depthWrite: false })); scene.add(motes);

let social = null, localWalking = false, snackSig = '', snackSerial = 0, restTimer = 0;
let action = 'stand', facing = 0, elapsed = 0, contextLost = false, raf = 0, lastTime = 0;
const target = new THREE.Vector3(SPAWN.x, 0, SPAWN.z);
const route = [];
let activeDestination = null, currentRoom = null;
const joystickInput = { x: 0, z: 0 };
const keys = new Set();
const messages = { stand: '어서 와요, 푹 쉬다 가요.', sit: '따끈따끈, 마음까지 풀리는 중.', lie: '오늘도 애썼어요. 잠깐 눈 감아요.', wave: '안녕! 같이 쉬어 가요.' };
// ---------- 매점 wallet, toasts and shop ----------
const wallet = createWallet();
const toastBox = document.querySelector('#toast'), toastText = toastBox.querySelector('span'), toastButton = toastBox.querySelector('button');
let toastTimer2 = 0, toastAction = null;
function toast(text, label = '', onClick = null) {
  toastText.textContent = text; toastButton.hidden = !label; toastButton.textContent = label; toastAction = onClick;
  toastBox.hidden = false; clearTimeout(toastTimer2); toastTimer2 = setTimeout(() => { toastBox.hidden = true; }, label ? 5000 : 2600);
}
toastButton.addEventListener('click', () => { toastBox.hidden = true; toastAction?.(); });
const shop = createShop({
  wallet, toast,
  eat: (kind, style) => eat(kind, style),
  play: (kind, style) => eat(kind, style),
  goToShop: () => {
    const place = DESTINATIONS.shop; openShopOnArrival = true;
    if (currentRoom.id === 'shop') { openShopOnArrival = false; shop.openShop(); return; }
    moveTo(place.x, place.z); activeDestination = place; status.textContent = '매점으로 걸어가는 중이에요.';
  }
});
shop.bind({ current: () => player.snack, stop: () => interruptSnack() });
const walkHint = coarsePointer ? '바닥을 눌러 이동 · 끌어서 시점 회전' : 'WASD·방향키 이동 · 끌어서 회전 · 휠 확대';
const destinationMarker = mesh(new THREE.TorusGeometry(.2, .025, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffe1a0', transparent: true, opacity: .9, depthWrite: false }), scene);
destinationMarker.rotation.x = -Math.PI / 2; destinationMarker.castShadow = false; destinationMarker.visible = false;

// ---------- Camera: RPG quarter view that follows the player ----------
const DEFAULT_YAW = .42, DEFAULT_PITCH = .52;
const view = { yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, zoom: 1, focus: new THREE.Vector3(SPAWN.x, 0, SPAWN.z) };
function baseDistance() {
  const aspect = camera.aspect;
  // Portrait phones need a wider look around the player; landscape stays closer.
  return THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(aspect, .45, 1.6, 13, 9.6), 9.2, 13.5);
}
function placeCamera() {
  const distance = baseDistance() * view.zoom;
  const flat = Math.cos(view.pitch) * distance;
  camera.position.set(view.focus.x + Math.sin(view.yaw) * flat, view.focus.y + Math.sin(view.pitch) * distance, view.focus.z + Math.cos(view.yaw) * flat);
  camera.userData.orbitTarget.set(view.focus.x, view.focus.y + .75, view.focus.z);
  camera.lookAt(camera.userData.orbitTarget);
}
// Screen-relative input → world direction for the current camera yaw.
function screenToWorld(x, z) {
  const c = Math.cos(view.yaw), s = Math.sin(view.yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
}
function recenter() {
  view.yaw = DEFAULT_YAW; view.pitch = DEFAULT_PITCH; view.zoom = 1;
  view.focus.set(hero.position.x, 0, hero.position.z); placeCamera();
  viewport.dataset.yaw = view.yaw.toFixed(3);
}
let renderWidth = 0, renderHeight = 0;
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight; if (!w || !h) return;
  if (w !== renderWidth || h !== renderHeight) { renderer.setSize(w, h); renderWidth = w; renderHeight = h; }
  camera.aspect = w / h; camera.fov = w / h < .8 ? 40 : 36; camera.updateProjectionMatrix(); placeCamera();
}

function updateActionButtons() {
  for (const button of actionButtons) { const selected = button.dataset.action === action || button.dataset.action === player.snack?.kind; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); }
}
function setAction(next) {
  if (!messages[next]) return;
  interruptSnack();
  route.length = 0; activeDestination = null; destinationMarker.visible = false; stopJoystick();
  action = next; target.copy(hero.position); status.textContent = messages[next];
  updateActionButtons();
  // Turn towards the camera for poses, so faces and snacks are visible.
  if (next !== 'stand' && next !== 'lie') facing = view.yaw;
  // On a 수면실 mat, lie along the bed with the head on its pillow.
  if (next === 'lie') facing = currentRoom?.id === 'sleep' ? 0 : view.yaw + Math.PI / 2;
  hint.textContent = next === 'stand' ? walkHint : '다시 걷고 싶으면 바닥을 톡 눌러요 ↗';
}
actionButtons.forEach(button => button.addEventListener('click', () => {
  const kind = button.dataset.action;
  if (kind === 'egg' || kind === 'drink') { if (player.snack?.kind !== kind && !shop.playing) shop.request(kind); } else setAction(kind);
}));
// ---------- Snacks: eaten in the current pose (sitting or standing) ----------
function interruptSnack() { if (player.snack) { player.stopSnack(); snackSig = ''; } }
function eat(kind, style = 'normal') {
  if (action === 'lie' || action === 'wave') setAction(action === 'lie' ? 'sit' : 'stand'); else interruptSnack();
  route.length = 0; activeDestination = null; destinationMarker.visible = false; stopJoystick(); keys.clear();
  facing = view.yaw; snackSig = `${kind}:${style}:${++snackSerial}`;
  const serial = snackSig;
  player.startSnack(kind, { style, onDone: finished => {
    if (snackSig === serial) snackSig = '';
    updateActionButtons();
    if (finished) status.textContent = kind === 'egg' ? '냠, 다 먹었다! 고소하고 든든해요.' : '캬~ 속까지 시원해요.';
  } });
  status.textContent = kind === 'egg' ? (style === 'forehead' ? '이마로 톡! 계란 깨기 도전…' : '톡톡, 맥반석 계란 까는 중…') : style === 'oneshot' ? '살얼음 식혜 원샷 도전!' : '살얼음 식혜 한 모금…';
  hint.textContent = '걸으면 간식을 내려놓아요';
  updateActionButtons();
  return player.snack;
}
function setOutfit(color) {
  if (!PALETTES[color]) return; player.setColors(PALETTES[color]);
  for (const b of outfitButtons) { const active = b.dataset.color === color; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); }
  try { localStorage.setItem('jjimjiljung-outfit', color); } catch { /* Private browsing may disable storage. */ }
  savedOutfit = color; social?.outfitChanged();
}
outfitButtons.forEach(b => b.addEventListener('click', () => setOutfit(b.dataset.color)));
setOutfit(savedOutfit);

const raycaster = new THREE.Raycaster(); const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const hit = new THREE.Vector3();
function moveTo(x, z) {
  if (action !== 'stand') setAction('stand'); else interruptSnack();
  route.length = 0; activeDestination = null;
  route.push(...planPath({ x: hero.position.x, z: hero.position.z }, { x, z }));
  if (route.length) { const end = route[route.length - 1]; target.set(end.x, 0, end.z); destinationMarker.position.set(end.x, .03, end.z); destinationMarker.visible = true; }
}
function arrive() {
  const place = activeDestination;
  destinationMarker.visible = false;
  if (place) { setAction(place.action || 'stand'); activeDestination = place; status.textContent = place.arrival; }
  if (place?.id === 'shop' && openShopOnArrival) { openShopOnArrival = false; shop.openShop(); }
}
let openShopOnArrival = false;

let toastTimer = 0;
function enterRoom(room) {
  currentRoom = room; viewport.dataset.room = room.id;
  badge.innerHTML = `<i></i> ${room.name} <span>${room.note}</span>`;
  if (!roomToast.dataset.silent) {
    roomToast.textContent = `♨ ${room.name}에 들어왔어요`; roomToast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { roomToast.hidden = true; }, 1800);
  }
}
roomToast.dataset.silent = '1'; enterRoom(roomAt(hero.position.x, hero.position.z) || ROOMS[0]); delete roomToast.dataset.silent;

document.querySelector('#recenter').addEventListener('click', recenter);
const placesDialog = document.querySelector('#places-dialog');
const placesOpen = document.querySelector('#places-open');
placesOpen.addEventListener('click', () => {
  if (contextLost || !document.body.classList.contains('room-ready')) return;
  setAction('stand'); keys.clear(); placesDialog.showModal();
});
document.querySelector('#places-close').addEventListener('click', () => placesDialog.close());
placesDialog.addEventListener('close', () => placesOpen.focus({ preventScroll: true }));
document.querySelectorAll('[data-place]').forEach(button => button.addEventListener('click', () => {
  const place = DESTINATIONS[button.dataset.place]; if (!place) return;
  placesDialog.close(); moveTo(place.x, place.z); activeDestination = place;
  const final = (place.name.charCodeAt(place.name.length - 1) - 0xac00) % 28;
  status.textContent = place.name + (final && final !== 8 ? '으로' : '로') + ' 걸어가는 중이에요.';
  if (!route.length) arrive();
}));

// ---------- Joystick ----------
const joystick = document.querySelector('#joystick');
const joystickKnob = document.querySelector('#joystick-knob');
let joystickPointer = null;
function stopJoystick() {
  joystickInput.x = joystickInput.z = 0;
  if (joystickPointer !== null && joystick.hasPointerCapture(joystickPointer)) joystick.releasePointerCapture(joystickPointer);
  joystickPointer = null; joystickKnob.style.transform = 'translate(0px,0px)'; joystick.classList.remove('engaged');
}
function updateJoystick(event) {
  const r = joystick.getBoundingClientRect(), radius = r.width * .30;
  let x = (event.clientX - r.left - r.width / 2) / radius, z = (event.clientY - r.top - r.height / 2) / radius;
  const length = Math.hypot(x, z); if (length > 1) { x /= length; z /= length; }
  joystickInput.x = length < .16 ? 0 : x; joystickInput.z = length < .16 ? 0 : z;
  joystickKnob.style.transform = `translate(${x * radius}px,${z * radius}px)`;
}
joystick.addEventListener('pointerdown', event => {
  if (contextLost || joystickPointer !== null || placesDialog.open) return;
  event.preventDefault(); if (action !== 'stand') setAction('stand'); else interruptSnack(); route.length = 0; activeDestination = null; destinationMarker.visible = false;
  joystickPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId); joystick.classList.add('engaged'); updateJoystick(event);
});
joystick.addEventListener('pointermove', event => { if (event.pointerId === joystickPointer) updateJoystick(event); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(name, event => { if (event.pointerId === joystickPointer) stopJoystick(); });
window.addEventListener('blur', () => { stopJoystick(); keys.clear(); });

// ---------- Viewport: tap to walk, drag to orbit, pinch / wheel to zoom ----------
const pointers = new Map();
let gesture = null;
viewport.addEventListener('pointerdown', e => {
  if (contextLost || joystickPointer === e.pointerId) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  viewport.setPointerCapture(e.pointerId);
  if (pointers.size === 1) gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch, moved: false };
  else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; gesture = { pinch: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom, moved: true }; }
});
viewport.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture.pinch) {
    const [a, b] = [...pointers.values()]; const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (distance > 10) view.zoom = THREE.MathUtils.clamp(gesture.zoom * gesture.pinch / distance, .6, 1.45);
    return;
  }
  const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
  if (Math.hypot(dx, dy) > 8) gesture.moved = true;
  if (gesture.moved) {
    view.yaw = gesture.yaw - dx * .006; view.pitch = THREE.MathUtils.clamp(gesture.pitch + dy * .003, .42, 1.15);
    viewport.dataset.yaw = view.yaw.toFixed(3);
  }
});
function endPointer(e, cancelled) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
  const tap = gesture && !gesture.pinch && !gesture.moved && gesture.id === e.pointerId && !cancelled;
  if (!pointers.size) gesture = null; else if (gesture?.pinch) gesture = { moved: true, id: -1 };
  if (!tap || placesDialog.open) return;
  const r = viewport.getBoundingClientRect(); raycaster.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
  if (raycaster.ray.intersectPlane(floorPlane, hit)) moveTo(hit.x, hit.z);
}
viewport.addEventListener('pointerup', e => endPointer(e, false));
viewport.addEventListener('pointercancel', e => endPointer(e, true));
viewport.addEventListener('lostpointercapture', e => { pointers.delete(e.pointerId); if (!pointers.size) gesture = null; });
viewport.addEventListener('wheel', e => { e.preventDefault(); view.zoom = THREE.MathUtils.clamp(view.zoom * Math.exp(e.deltaY * .0012), .6, 1.45); }, { passive: false });

// ---------- Keyboard: WASD / arrows walk relative to the camera ----------
const MOVE_KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
const typing = target => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && social && !typing(e.target) && !document.querySelector('dialog[open]') && !(e.target instanceof HTMLButtonElement) && !social.isChatOpen()) { e.preventDefault(); document.querySelector('#chat-open').click(); return; }
  if (typing(e.target) || document.querySelector('dialog[open]') || !document.body.classList.contains('room-ready') || contextLost || e.metaKey || e.ctrlKey || e.altKey) return;
  const direction = MOVE_KEYS[e.code] || MOVE_KEYS[e.key];
  if (direction) {
    // Leave Space/Enter on focused buttons alone; arrows still scroll nothing here.
    e.preventDefault(); keys.add(direction);
    if (action !== 'stand') setAction('stand'); else interruptSnack();
    route.length = 0; activeDestination = null; destinationMarker.visible = false;
    return;
  }
  if (e.code === 'KeyQ') { view.yaw += .35; viewport.dataset.yaw = view.yaw.toFixed(3); }
  if (e.code === 'KeyE') { view.yaw -= .35; viewport.dataset.yaw = view.yaw.toFixed(3); }
  if (e.key === 'Home') { e.preventDefault(); recenter(); }
});
document.addEventListener('keyup', e => { const direction = MOVE_KEYS[e.code] || MOVE_KEYS[e.key]; if (direction) keys.delete(direction); });

new ResizeObserver(resize).observe(viewport); resize();

// Optional synthesized room ambience. Audio is only created after an explicit tap.
let audioContext, source, audioGain, audioEnabled = false;
document.querySelector('#sound').addEventListener('click', async () => {
  const button = document.querySelector('#sound');
  try {
    if (!audioContext) { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) throw Error('Audio unavailable'); audioContext = new Audio(); const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 3, audioContext.sampleRate); const data = buffer.getChannelData(0); let v = 0; for (let i = 0; i < data.length; i++) { v = (v + (Math.random() * 2 - 1) * .015) / 1.015; data[i] = v * 2; } source = audioContext.createBufferSource(); source.buffer = buffer; source.loop = true; const filter = audioContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 450; audioGain = audioContext.createGain(); audioGain.gain.value = 0; source.connect(filter).connect(audioGain).connect(audioContext.destination); source.start(); }
    await audioContext.resume(); audioEnabled = !audioEnabled; audioGain.gain.setTargetAtTime(audioEnabled ? .3 : 0, audioContext.currentTime, .25); button.setAttribute('aria-pressed', String(audioEnabled)); button.setAttribute('aria-label', audioEnabled ? '찜질방 소리 끄기' : '찜질방 소리 켜기'); button.innerHTML = (audioEnabled ? '소리 켜짐' : '소리 꺼짐') + ' <span>♪</span>';
  } catch { status.textContent = '이 브라우저에서는 소리를 켤 수 없어요. 조용히 쉬어 가요.'; }
});

// ---------- 수면실: first-person rest, lullaby and galaxy ----------
const sleepBar = document.querySelector('#sleep-bar'), sleepMusic = document.querySelector('#sleep-music');
const headPoint = new THREE.Vector3(), feetPoint = new THREE.Vector3();
let wasSleeping = false;
function renderMusicButton() {
  sleepMusic.setAttribute('aria-pressed', String(!sleep.music.muted));
  sleepMusic.textContent = sleep.music.muted ? '♪ 음악 켜기' : '♪ 음악 끄기';
}
sleepMusic.addEventListener('click', () => { sleep.music.setMuted(!sleep.music.muted); renderMusicButton(); });
document.querySelector('#wake').addEventListener('click', () => setAction('stand'));
renderMusicButton();
// Any tap or key unlocks Web Audio, so the lullaby may start when you lie down.
for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, () => sleep.music.unlock(), { capture: true, passive: true });
function updateSleep(dt) {
  const sleeping = action === 'lie' && currentRoom.id === 'sleep';
  if (sleeping !== wasSleeping) {
    wasSleeping = sleeping; sleepBar.hidden = !sleeping; document.body.classList.toggle('sleeping', sleeping);
    if (sleeping) { status.textContent = '쉿… 눈을 감고 천천히 숨 쉬어요.'; hint.textContent = `${GALAXY_DELAY}초 동안 가만히 쉬면 꿈나라로 가요`; }
  }
  player.head.getWorldPosition(headPoint); hero.localToWorld(feetPoint.set(0, 0, .6));
  const blend = sleep.update(dt, { sleeping, camera, head: headPoint, feet: feetPoint, reducedMotion, elapsed });
  hero.visible = blend < .5; shadow.visible = hero.visible;
  document.body.classList.toggle('dreaming', sleep.state.galaxy > .5);
  viewport.dataset.sleep = sleeping ? (sleep.state.galaxy > .5 ? 'galaxy' : 'resting') : 'awake';
}

// ---------- Walls that hide the player fade out ----------
const fadeMeshes = world.fadeUnits.flatMap((unit, index) => unit.meshes.map(m => { m.userData.fadeIndex = index; return m; }));
const occluders = new Set(), eye = new THREE.Vector3(), probe = new THREE.Vector3(), towards = new THREE.Vector3();
function updateOcclusion(dt) {
  occluders.clear();
  // In the first-person sleep view the room closes around the sleeper again.
  const firstPerson = sleep.state.blend > .05;
  if (!firstPerson) for (const height of [.25, .95]) for (const side of [-.3, 0, .3]) {
    probe.set(hero.position.x + Math.cos(view.yaw) * side, height, hero.position.z - Math.sin(view.yaw) * side);
    eye.copy(camera.position); towards.subVectors(probe, eye); const far = towards.length() - .25; towards.normalize();
    raycaster.set(eye, towards); raycaster.far = far;
    for (const found of raycaster.intersectObjects(fadeMeshes, false)) occluders.add(found.object.userData.fadeIndex);
  }
  raycaster.far = Infinity;
  // Cutaway: walls of the current room on the camera side drop to a low ledge,
  // like a dollhouse, and doorway frames on those walls turn translucent.
  const viewX = -Math.sin(view.yaw), viewZ = -Math.cos(view.yaw), room = currentRoom;
  const nearEdges = [
    { axis: 'z', line: room.minZ, near: viewZ > .25 }, { axis: 'z', line: room.maxZ, near: -viewZ > .25 },
    { axis: 'x', line: room.minX, near: viewX > .25 }, { axis: 'x', line: room.maxX, near: -viewX > .25 }
  ].filter(edge => edge.near && !firstPerson);
  const onNearEdge = (axis, line, from, to) => nearEdges.some(edge => edge.axis === axis && Math.abs(edge.line - line) < 1e-6
    && to > (axis === 'z' ? room.minX : room.minZ) && from < (axis === 'z' ? room.maxX : room.maxZ));
  for (const item of world.wallDecor) item.group.visible = !onNearEdge(item.axis, item.line, item.at, item.at);
  world.fadeUnits.forEach((unit, index) => {
    const cut = unit.wall ? onNearEdge(unit.wall.axis, unit.wall.line, unit.wall.from, unit.wall.to) : false;
    const doorCut = unit.door ? onNearEdge(unit.door.axis, unit.door.line, unit.door.at, unit.door.at) : false;
    if (unit.group) {
      unit.cut = THREE.MathUtils.damp(unit.cut, cut ? .16 : 1, 8, dt);
      if (Math.abs(unit.group.scale.y - unit.cut) > .0005) unit.group.scale.y = unit.cut;
    }
    const goal = occluders.has(index) && !cut ? .18 : doorCut ? .2 : 1;
    if (unit.opacity === goal) return;
    unit.opacity = Math.abs(unit.opacity - goal) < .01 ? goal : THREE.MathUtils.damp(unit.opacity, goal, 10, dt);
    for (const m of unit.meshes) {
      const material = m.material, transparent = unit.opacity < .99 || !!material.userData.alwaysTransparent;
      // Opaque materials compile with alpha forced to 1, so switching needs a new program.
      if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
      material.opacity = unit.opacity; material.depthWrite = unit.opacity > .6;
    }
  });
}
for (const m of fadeMeshes) if (m.material.transparent) m.material.userData.alwaysTransparent = true;

function damp(object, key, to, dt, speed = 9) { object[key] = THREE.MathUtils.damp(object[key], to, speed, dt); }
const ambientColor = new THREE.Color(), ambientGoal = new THREE.Color();
function frame(now) {
  if (contextLost || document.hidden) return;
  // A queued RAF timestamp can precede initialization after shader compilation.
  // Negative dt makes exponential damping diverge and spins the limbs wildly.
  const dt = THREE.MathUtils.clamp((now - lastTime) / 1000, 0, .05); lastTime = now; elapsed += dt;
  let walking = false;
  let inputX = joystickInput.x + (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
  let inputZ = joystickInput.z + (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
  const inputLength = Math.hypot(inputX, inputZ); if (inputLength > 1) { inputX /= inputLength; inputZ /= inputLength; }
  if (action === 'stand' && inputLength > .01) {
    const move = screenToWorld(inputX, inputZ);
    const next = stepMovement({ x: hero.position.x, z: hero.position.z }, move.x * dt * WALK_SPEED, move.z * dt * WALK_SPEED);
    const dx = next.x - hero.position.x, dz = next.z - hero.position.z; walking = Math.hypot(dx, dz) > .0005;
    hero.position.set(next.x, 0, next.z); target.copy(hero.position); facing = Math.atan2(move.x, move.z);
  } else if (action === 'stand' && route.length) {
    const next = route[0], dx = next.x - hero.position.x, dz = next.z - hero.position.z, distance = Math.hypot(dx, dz);
    if (distance > .001) { const step = Math.min(distance, dt * WALK_SPEED); hero.position.x += dx / distance * step; hero.position.z += dz / distance * step; facing = Math.atan2(dx, dz); walking = true; }
    if (distance <= dt * WALK_SPEED + .001) { hero.position.set(next.x, 0, next.z); route.shift(); if (!route.length) arrive(); }
  }
  const room = roomAt(hero.position.x, hero.position.z);
  if (room && room !== currentRoom) enterRoom(room);
  // Ease the room light into each space: amber lobby, orange 불가마, blue 얼음방…
  ambientGoal.set(currentRoom.ambient); ambientColor.copy(ambient.color).lerp(ambientGoal, 1 - Math.exp(-dt * 2.5)); ambient.color.copy(ambientColor);
  // A gently lagging camera keeps motion smooth without losing the player.
  view.focus.x = THREE.MathUtils.damp(view.focus.x, hero.position.x, 4.5, dt);
  view.focus.z = THREE.MathUtils.damp(view.focus.z, hero.position.z, 4.5, dt);
  placeCamera();
  updateSleep(dt);
  sun.position.set(view.focus.x - 5, 12, view.focus.z + 6); sun.target.position.set(view.focus.x, 0, view.focus.z);
  destinationMarker.scale.setScalar(reducedMotion ? 1 : 1 + Math.sin(elapsed * 4) * .10);
  let angle = facing - hero.rotation.y; angle = Math.atan2(Math.sin(angle), Math.cos(angle)); hero.rotation.y += angle * Math.min(1, dt * 10);
  player.animate(action, walking, dt, reducedMotion, WALK_SPEED / 1.9);
  for (const resident of residents) {
    const near = Math.hypot(resident.root.position.x - hero.position.x, resident.root.position.z - hero.position.z) < 8;
    resident.animate(resident.config.greeter && action === 'wave' && near ? 'wave' : resident.config.action, false, dt, reducedMotion);
  }
  shadow.position.set(hero.position.x, .012, hero.position.z); shadow.scale.set(action === 'lie' ? 1.1 : 1, action === 'lie' ? 1.7 : 1, 1);
  if (action === 'lie') shadow.position.z -= Math.cos(hero.rotation.y) * .3;
  world.update(elapsed, reducedMotion);
  updateOcclusion(dt);
  localWalking = walking; social?.update(dt, reducedMotion);
  // Resting earns 온기: every 30 s sitting or lying (double in 불가마 and 소금방).
  if ((action === 'sit' || action === 'lie') && !shop.playing) {
    restTimer += dt;
    if (restTimer >= REST_SECONDS) { restTimer = 0; const got = wallet.earn(currentRoom.id === 'hot' || currentRoom.id === 'salt' ? 2 : 1); if (got) toast(`쉬는 동안 온기가 모였어요 +${got}♨`); }
  } else restTimer = Math.min(restTimer, REST_SECONDS * .5);
  shop.setNearShop(currentRoom.id === 'shop');
  motes.visible = !reducedMotion; if (!reducedMotion) { motes.position.set(view.focus.x, 0, view.focus.z); motes.rotation.y = elapsed * .02; }
  renderer.render(scene, camera); raf = requestAnimationFrame(frame);
}
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); contextLost = true; stopJoystick(); keys.clear(); if (placesDialog.open) placesDialog.close(); cancelAnimationFrame(raf); window.showRoomError('3D 화면이 잠시 멈췄어요. 다시 들어가면 편안한 방으로 돌아갈 수 있어요.'); });
renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopJoystick(); keys.clear(); pointers.clear(); gesture = null; cancelAnimationFrame(raf); if (audioContext) audioContext.suspend().catch(() => {}); sleep.music.suspend(); } else { lastTime = performance.now(); if (!contextLost) raf = requestAnimationFrame(frame); if (audioEnabled && audioContext) audioContext.resume().catch(() => {}); sleep.music.resume(); } });
// Compile every shader up front so the first steps into a new room do not stutter.
sleep.ceiling.visible = sleep.galaxy.visible = true; renderer.compile(scene, camera); sleep.ceiling.visible = sleep.galaxy.visible = false;
renderer.render(scene, camera);
clearTimeout(window.roomLoadTimer); document.querySelector('#loading').hidden = true; document.querySelector('#error').hidden = true;
hint.textContent = walkHint;
viewport.dataset.ready = 'true'; lastTime = performance.now(); raf = requestAnimationFrame(frame);
document.body.classList.add('room-ready');
window.lockRoomControls(false);
// Multiplayer starts after the room is ready, so a slow network never blocks entering.
document.querySelector('#chat-input').addEventListener('focus', () => { keys.clear(); stopJoystick(); });
social = createSocial({
  scene, camera, kit, viewport, actorScale: ACTOR_SCALE, makeShadow: contactShadow,
  getLocal: () => ({ x: hero.position.x, z: hero.position.z, facing: hero.rotation.y, action, snack: snackSig, walking: localWalking, outfit: savedOutfit, room: currentRoom.id, visible: hero.visible })
});
