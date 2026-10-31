import * as THREE from './vendor/three.module.min.js';
import { planPath, stepMovement } from './navigation.js?v=rpg-27';
import { createCharacterKit, loadPlushModel, mesh } from './character.js?v=rpg-27';
import { loadOutfit, saveOutfit, randomPart, randomOutfit, seeded, outfitColors, capOn, encodeOutfit, addTowel, removeTowel, pickTowel } from './outfit.js?v=rpg-27';
import { createTowelGame } from './towel.js?v=rpg-27';
import { fortune, loadBirth, saveBirth } from './saju.js?v=rpg-27';
import { createGreetLog, greetTargets, GREET_EXPIRE } from './greet.js?v=rpg-27';
import { loadTowelProps, placeTowelDecor } from './props.js?v=rpg-27';
import { buildWorld } from './environment.js?v=rpg-27';
import { ROOMS, DESTINATIONS, SPAWN, TV_SEAT, TOWEL_SPOT, TOWEL_DECOR, SPOTS, roomAt } from './world.js?v=rpg-27';
import { createTvAds } from './ads.js?v=rpg-27';
import { createSleepMode, GALAXY_DELAY } from './sleep.js?v=rpg-27';
import { createSocial } from './social.js?v=rpg-27';
import { createWallet, REST_SECONDS } from './economy.js?v=rpg-27';
import { createShop } from './shop.js?v=rpg-27';
import { createInvite } from './invite.js?v=rpg-27';

// Everything, including textures and the pinned renderer, is served by Pages.
// No model, font, analytics, or CDN request is needed to enter the room.
const viewport = document.querySelector('#viewport');
const actionButtons = [...document.querySelectorAll('[data-action]')];
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

// The plush GLB (2.5 MB) loads behind the loading screen; without it the
// built-in character is used so the room always opens.
const [plushModel, towelProps] = await Promise.all([loadPlushModel(), loadTowelProps(['cap'])]);
const kit = createCharacterKit(renderer, plushModel, towelProps);
const world = buildWorld({ scene, kit });
const sleep = createSleepMode({ scene, canvasTexture: kit.canvasTexture });

// A contact shadow supplements real shadow maps beneath the plush character.
const shadowTexture = kit.canvasTexture((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(87,56,33,.32)'); g.addColorStop(.55, 'rgba(87,56,33,.14)'); g.addColorStop(1, 'rgba(87,56,33,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 128, 128);
const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
function contactShadow() { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1), shadowMaterial); s.rotation.x = -Math.PI / 2; s.renderOrder = 1; scene.add(s); return s; }

const ACTOR_SCALE = .62, WALK_SPEED = 2.5;
let outfit = loadOutfit();
const player = kit.createCharacter(outfitColors(outfit)); player.setTowel(capOn(outfit));
const { root: hero, arms, legs, faceMaterial } = player;
scene.add(hero); hero.scale.setScalar(ACTOR_SCALE); hero.position.set(SPAWN.x, 0, SPAWN.z);
const shadow = contactShadow();

// Resident guests keep every room feeling lived in. They share the player model.
// Each wears its own seeded random outfit and a sheep cap.
const residents = [
  { x: -4.6, z: 4.6, y: .09, face: -Math.PI / 2, action: 'sit' },
  { x: 3.2, z: -8.5, y: .05, face: -.5, action: 'sit' },
  { x: 9.5, z: -11.05, y: .1, face: 0, action: 'lie' },
  { x: 14.5, z: -1.7, y: 0, face: -Math.PI / 2, action: 'stand', greeter: true },
  { x: 13.4, z: 11.6, y: 0, face: -Math.PI / 2, action: 'stand', scrubber: true },
  { x: 14.7, z: 4.8, y: 0, face: -Math.PI / 2, action: 'stand', clerk: true },
  { x: 1.5, z: 12.3, y: 0, face: -.4, action: 'sit' },
  { x: -12.6, z: 1.7, y: .07, face: 0, action: 'lie' }
].map((config, index) => {
  const actor = kit.createCharacter(outfitColors(randomOutfit(seeded(index * 977 + 31))));
  actor.root.position.set(config.x, config.y, config.z); actor.root.rotation.y = config.face; actor.root.scale.setScalar(ACTOR_SCALE);
  scene.add(actor.root); actor.config = config; if (config.action !== 'lie') contactShadow().position.set(config.x, .012, config.z);
  return actor;
});

// A few translucent motes near the player, kept subtle and disabled for reduced motion.
const motePositions = new Float32Array(40 * 3); for (let i = 0; i < 40; i++) { motePositions[i * 3] = (Math.random() - .5) * 12; motePositions[i * 3 + 1] = Math.random() * 3 + .4; motePositions[i * 3 + 2] = (Math.random() - .5) * 10; }
const motesGeometry = new THREE.BufferGeometry(); motesGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
const motes = new THREE.Points(motesGeometry, new THREE.PointsMaterial({ color: '#fff3ce', size: .05, transparent: true, opacity: .55, depthWrite: false })); scene.add(motes);

// Soaking in a bath (scene-wide so posture changes can climb out at once).
let soak = null;
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
function toast(text, label = '', onClick = null, ms = 0) {
  toastText.textContent = text; toastButton.hidden = !label; toastButton.textContent = label; toastAction = onClick;
  toastBox.hidden = false; clearTimeout(toastTimer2); toastTimer2 = setTimeout(() => { toastBox.hidden = true; }, ms || (label ? 5000 : 2600));
}
toastButton.addEventListener('click', () => { toastBox.hidden = true; toastAction?.(); });
let tvReady = false;
const shop = createShop({
  wallet, toast,
  tv: { worth: () => tvReady && tvAds.worthVisiting, go: () => goToTv() },
  eat: (kind, style) => eat(kind, style),
  play: (kind, style) => eat(kind, style),
  goToShop: () => {
    const place = DESTINATIONS.shop; openShopOnArrival = true;
    if (currentRoom.id === 'shop') { openShopOnArrival = false; shop.openShop(); return; }
    moveTo(place.x, place.z); activeDestination = place; status.textContent = '매점으로 걸어가는 중이에요.';
  }
});
shop.bind({ current: () => player.snack, stop: () => interruptSnack() });
// ---------- 중앙 휴게실 TV: rewarded ads ----------
let adPlaying = false, tvSeated = false, tvCheck = 0, tvTurn = 0;
const tvButton = document.querySelector('#tv-ad');
const tvAds = createTvAds({
  wallet, button: tvButton,
  // Pause rendering and sound while Google shows the ad, then carry on.
  onPause: () => { adPlaying = true; cancelAnimationFrame(raf); if (audioContext) audioContext.suspend().catch(() => {}); sleep.music.suspend(); },
  onResume: () => { adPlaying = false; lastTime = performance.now(); if (!contextLost && !document.hidden) raf = requestAnimationFrame(frame); if (audioEnabled && audioContext) audioContext.resume().catch(() => {}); sleep.music.resume(); },
  onReward: granted => { if (granted) { player.celebrate(); toast(`끝까지 봐 줘서 고마워요! 온기 +${granted}♨`); status.textContent = '온기를 받았어요. 따끈따끈 ♨'; } shop.render(); },
  onDismiss: () => toast('다음에 또 봐요 📺')
});
tvReady = true; shop.render();
function goToTv() {
  if (Math.hypot(hero.position.x - TV_SEAT.x, hero.position.z - TV_SEAT.z) < .3) { setAction('sit'); return; }
  moveTo(TV_SEAT.x, TV_SEAT.z); activeDestination = TV_SEAT; status.textContent = 'TV 앞 방석으로 걸어가는 중이에요.';
}
const nearTv = () => currentRoom?.id === 'lobby' && Math.hypot(hero.position.x - TV_SEAT.x, hero.position.z - TV_SEAT.z) < .8;
const tvPoint = new THREE.Vector3();
function updateTv(dt) {
  const seated = action === 'sit' && nearTv();
  if (seated !== tvSeated) {
    tvSeated = seated; tvButton.hidden = !seated;
    // Swing the camera round behind the sitter so the TV fills the view.
    if (seated) { tvCheck = 0; tvTurn = 1.6; tvAds.prepare(); } else { tvTurn = 0; tvAds.leave(); }
  }
  if (tvTurn > 0) {
    tvTurn -= dt; const goal = TV_SEAT.facing + Math.PI + .3;
    let delta = goal - view.yaw; delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    view.yaw += delta * Math.min(1, dt * 3.5); viewport.dataset.yaw = view.yaw.toFixed(3);
  }
  world.tv.setMode(seated && tvAds.state === 'ready' ? 'ad' : 'channel');
  if (!seated) return;
  // Re-check each second (cooldowns end, midnight resets); retry "no ad" every 30 s.
  tvCheck += dt;
  if (tvCheck > 1 && ['idle', 'cooldown', 'done'].includes(tvAds.state)) { tvCheck = 0; tvAds.prepare(); }
  else if (tvCheck > 30 && tvAds.state === 'none') { tvCheck = 0; tvAds.retry(); }
  // Pin the button to the TV screen.
  world.tv.panel.getWorldPosition(tvPoint); tvPoint.project(camera);
  tvButton.style.left = `${THREE.MathUtils.clamp((tvPoint.x + 1) / 2 * viewport.clientWidth, 120, viewport.clientWidth - 120)}px`;
  tvButton.style.top = `${THREE.MathUtils.clamp((1 - tvPoint.y) / 2 * viewport.clientHeight + 64, 170, viewport.clientHeight * .62)}px`;
}
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
  // Never let a bad input leave the camera at NaN (the room would render empty).
  if (!Number.isFinite(view.yaw) || !Number.isFinite(view.pitch) || !Number.isFinite(view.zoom)) { view.yaw = DEFAULT_YAW; view.pitch = DEFAULT_PITCH; view.zoom = 1; }
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
  if (soak && next !== 'sit') leaveSoak();
  interruptSnack();
  route.length = 0; activeDestination = null; destinationMarker.visible = false; stopJoystick();
  action = next; target.copy(hero.position); status.textContent = messages[next];
  updateActionButtons();
  // Turn towards the camera for poses, so faces and snacks are visible.
  if (next !== 'stand' && next !== 'lie') facing = next === 'sit' && nearTv() ? TV_SEAT.facing : view.yaw;
  // On a 수면실 mat, lie along the bed with the head on its pillow.
  if (next === 'lie') facing = currentRoom?.id === 'sleep' ? 0 : view.yaw + Math.PI / 2;
  player.sitStyle = currentRoom?.id === 'hot' || currentRoom?.id === 'salt' ? 'cross' : 'relaxed';
  hint.textContent = next === 'stand' ? walkHint : '다시 걷고 싶으면 바닥을 톡 눌러요 ↗';
}
actionButtons.forEach(button => button.addEventListener('click', () => {
  const kind = button.dataset.action;
  if (kind === 'egg' || kind === 'drink') { if (player.snack?.kind !== kind && !shop.playing) shop.choose(kind); } else if (kind === 'wave') startGreet(); else setAction(kind);
}));
// ---------- Snacks: eaten in the current pose (sitting or standing) ----------
function interruptSnack() { if (player.snack) { player.stopSnack(); snackSig = ''; } }
function eat(kind, style = 'normal') {
  // The plush eats sitting down (its drinking clip is a seated one).
  if (kit.plush ? action !== 'sit' : action === 'lie' || action === 'wave') setAction(kit.plush ? 'sit' : action === 'lie' ? 'sit' : 'stand'); else interruptSnack();
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
// ---------- Outfit: one tap re-dyes every part; the sheep cap has its own toggle ----------
const outfitButton = document.querySelector('#outfit-random'), capButton = document.querySelector('#cap-toggle');
function applyOutfit(next) {
  outfit = next; saveOutfit(outfit);
  player.setColors(outfitColors(outfit)); player.setTowel(capOn(outfit));
  capButton.hidden = !outfit.hasTowel; capButton.setAttribute('aria-pressed', String(capOn(outfit)));
  capButton.setAttribute('aria-label', capOn(outfit) ? '양머리 벗기' : '양머리 쓰기');
  viewport.dataset.outfit = encodeOutfit(outfit); social?.outfitChanged();
}
outfitButton.addEventListener('click', () => {
  const before = { ...outfit };
  applyOutfit({ ...outfit, top: randomPart('top'), bottom: randomPart('bottom'), towel: pickTowel(outfit) });
  if (action !== 'lie') player.celebrate();
  toast('✨ 새 옷으로 갈아입었어요', '되돌리기', () => applyOutfit(before));
});
capButton.addEventListener('click', () => {
  applyOutfit({ ...outfit, wear: !outfit.wear });
  toast(outfit.wear ? '🐑 양머리를 썼어요' : '🐑 양머리를 벗었어요');
});
applyOutfit(outfit);

// ---------- 양머리 만들기 at the 매점 towel shelf ----------
const towelOpen = document.querySelector('#towel-open');
let openTowelOnArrival = false;
const towelGame = createTowelGame({
  onOpen: () => { setAction('stand'); if (nearTowels()) facing = TOWEL_SPOT.facing; keys.clear(); },
  onDone: (color, wear) => {
    applyOutfit({ ...addTowel(outfit, color), wear });
    player.celebrate(); toast(wear ? '🐑 양머리 완성! 잘 어울려요' : '🐑 양머리 완성! 옷 버튼 위 🐑로 언제든 써요');
    status.textContent = '폭신한 양머리가 생겼어요.';
  }
});
function goToTowel() {
  if (Math.hypot(hero.position.x - TOWEL_SPOT.x, hero.position.z - TOWEL_SPOT.z) < .4) { towelGame.open(); return; }
  moveTo(TOWEL_SPOT.x, TOWEL_SPOT.z); activeDestination = TOWEL_SPOT; openTowelOnArrival = true;
  status.textContent = '매점 수건 선반으로 걸어가는 중이에요.';
}
towelOpen.addEventListener('click', () => towelGame.open());
const nearTowels = () => currentRoom?.id === 'shop' && Math.hypot(hero.position.x - TOWEL_SPOT.x, hero.position.z - TOWEL_SPOT.z) < 1.6;
function updateTowelShelf() {
  const show = nearTowels() && !towelGame.isOpen && !shop.playing;
  if (show || outfit.hasTowel || currentRoom.id === 'shop') towelNudge.hidden = true;
  if (towelOpen.hidden === show) { towelOpen.hidden = !show; towelOpen.textContent = outfit.hasTowel ? '🐑 양머리 새로 만들기' : '🐑 양머리 만들기'; }
}

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
  if (place) { setAction(place.action || 'stand'); if (place.facing != null) facing = place.facing; activeDestination = place; status.textContent = place.arrival; }
  if (place?.id === 'shop' && openShopOnArrival) { openShopOnArrival = false; shop.openShop(); }
  if (place?.id === 'towel') { facing = TOWEL_SPOT.facing; if (openTowelOnArrival) { openTowelOnArrival = false; towelGame.open(); } }
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
    tvTurn = 0;
    view.yaw = gesture.yaw - dx * .006; view.pitch = THREE.MathUtils.clamp(gesture.pitch + dy * .003, .42, 1.15);
    viewport.dataset.yaw = view.yaw.toFixed(3);
  }
});
// Lifting one finger of a pinch: the other one carries on orbiting from where it is
// (a gesture without a start point turned the camera angles into NaN, blanking the room).
function pointerGone() {
  if (!pointers.size) gesture = null;
  else if (gesture?.pinch) { const [id, p] = [...pointers.entries()][0]; gesture = { id, x: p.x, y: p.y, yaw: view.yaw, pitch: view.pitch, moved: true }; }
}
function endPointer(e, cancelled) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
  const tap = gesture && !gesture.pinch && !gesture.moved && gesture.id === e.pointerId && !cancelled;
  // Lifting one finger of a pinch: the other one carries on orbiting from where it is
  // (a gesture without a start point turned the camera angles into NaN, blanking the room).
  pointerGone();
  if (!tap || placesDialog.open || towelGame.isOpen) return;
  const r = viewport.getBoundingClientRect(); raycaster.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
  const someone = social?.pick(raycaster);
  if (someone) { openPerson(someone); return; }
  closePerson();
  if (raycaster.ray.intersectPlane(floorPlane, hit)) moveTo(hit.x, hit.z);
}
viewport.addEventListener('pointerup', e => endPointer(e, false));
viewport.addEventListener('pointercancel', e => endPointer(e, true));
viewport.addEventListener('lostpointercapture', e => { if (pointers.delete(e.pointerId)) pointerGone(); });
viewport.addEventListener('wheel', e => { e.preventDefault(); view.zoom = THREE.MathUtils.clamp(view.zoom * Math.exp(e.deltaY * .0012), .6, 1.45); }, { passive: false });

// ---------- Keyboard: WASD / arrows walk relative to the camera ----------
const MOVE_KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
const typing = target => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && social && !towelGame.isOpen && !typing(e.target) && !document.querySelector('dialog[open]') && !(e.target instanceof HTMLButtonElement) && !social.isChatOpen()) { e.preventDefault(); document.querySelector('#chat-open').click(); return; }
  if (typing(e.target) || towelGame.isOpen || document.querySelector('dialog[open]') || !document.body.classList.contains('room-ready') || contextLost || e.metaKey || e.ctrlKey || e.altKey) return;
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

// Speaker icons (Lucide, ISC) for the sound toggle.
const SOUND_ON = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /> <path d="M16 9a5 5 0 0 1 0 6" /> <path d="M19.364 18.364a9 9 0 0 0 0-12.728" /></svg>', SOUND_OFF = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z" /> <path d="m16.5 14.5 5-5" /> <path d="m16.5 9.5 5 5" /></svg>';
// Optional synthesized room ambience. Audio is only created after an explicit tap.
let audioContext, source, audioGain, audioEnabled = false;
document.querySelector('#sound').addEventListener('click', async () => {
  const button = document.querySelector('#sound');
  try {
    if (!audioContext) { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) throw Error('Audio unavailable'); audioContext = new Audio(); const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 3, audioContext.sampleRate); const data = buffer.getChannelData(0); let v = 0; for (let i = 0; i < data.length; i++) { v = (v + (Math.random() * 2 - 1) * .015) / 1.015; data[i] = v * 2; } source = audioContext.createBufferSource(); source.buffer = buffer; source.loop = true; const filter = audioContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 450; audioGain = audioContext.createGain(); audioGain.gain.value = 0; source.connect(filter).connect(audioGain).connect(audioContext.destination); source.start(); }
    await audioContext.resume(); audioEnabled = !audioEnabled; audioGain.gain.setTargetAtTime(audioEnabled ? .3 : 0, audioContext.currentTime, .25); button.setAttribute('aria-pressed', String(audioEnabled)); button.setAttribute('aria-label', audioEnabled ? '찜질방 소리 끄기' : '찜질방 소리 켜기'); button.innerHTML = (audioEnabled ? SOUND_ON : SOUND_OFF) + `<span class="label">${audioEnabled ? '소리 켜짐' : '소리 꺼짐'}</span>`;
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
// Lying down in (or getting up from) 수면실 dims the screen, switches the view
// while it is dark, then brightens again, instead of swooping through the head.
const sleepFade = document.querySelector('#sleep-fade');
const FADE_IN = .55;
let sleepCommitted = false, fadeTimer = -1;
function updateSleep(dt) {
  const wanted = action === 'lie' && currentRoom.id === 'sleep';
  if (wanted !== sleepCommitted && fadeTimer < 0) {
    if (reducedMotion) { sleepCommitted = wanted; sleep.snap(wanted); }
    else { fadeTimer = 0; sleepFade.classList.add('on'); }
  }
  if (fadeTimer >= 0) {
    fadeTimer += dt;
    if (fadeTimer >= FADE_IN) {
      // Fully dark: switch the view at once, then fade back in.
      sleepCommitted = action === 'lie' && currentRoom.id === 'sleep'; sleep.snap(sleepCommitted);
      fadeTimer = -1; sleepFade.classList.remove('on');
    }
  }
  const sleeping = sleepCommitted;
  if (sleeping !== wasSleeping) {
    wasSleeping = sleeping; sleepBar.hidden = !sleeping; document.body.classList.toggle('sleeping', sleeping);
    if (sleeping) { status.textContent = '쉿… 눈을 감고 천천히 숨 쉬어요.'; hint.textContent = `${GALAXY_DELAY}초 동안 가만히 쉬면 꿈나라로 가요`; }
  }
  player.head.getWorldPosition(headPoint); hero.localToWorld(feetPoint.set(0, 0, .6));
  const blend = sleep.update(dt, { sleeping, camera, head: headPoint, feet: feetPoint, reducedMotion, elapsed });
  hero.visible = blend < .5; shadow.visible = hero.visible;
  viewport.dataset.fading = fadeTimer >= 0 ? 'true' : 'false';
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
  if (contextLost || document.hidden || adPlaying) return;
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
    resident.animate((resident.config.greeter && action === 'wave' && near) || (resident.config.scrubber && scrubbing > 0) || (resident.config.clerk && deskWave > 0) ? 'wave' : resident.config.action, false, dt, reducedMotion);
  }
  shadow.position.set(hero.position.x, .012, hero.position.z); shadow.scale.set(action === 'lie' ? 1.1 : 1, action === 'lie' ? 1.7 : 1, 1);
  if (action === 'lie') shadow.position.z -= Math.cos(hero.rotation.y) * .3;
  world.update(elapsed, reducedMotion);
  updateOcclusion(dt);
  localWalking = walking; social?.update(dt, reducedMotion);
  updateTv(dt);
  // Resting earns 온기: every 30 s sitting or lying (double in 불가마 and 소금방).
  if ((action === 'sit' || action === 'lie') && !shop.playing) {
    restTimer += dt;
    if (restTimer >= REST_SECONDS) { restTimer = 0; const got = wallet.earn(['hot', 'salt', 'bath'].includes(currentRoom.id) ? 2 : 1); if (got) toast(`쉬는 동안 온기가 모였어요 +${got}♨`); }
  } else restTimer = Math.min(restTimer, REST_SECONDS * .5);
  shop.setNearShop(currentRoom.id === 'shop' && !nearTowels());
  updateTowelShelf(); updateSpots(dt);
  motes.visible = !reducedMotion; if (!reducedMotion) { motes.position.set(view.focus.x, 0, view.focus.z); motes.rotation.y = elapsed * .02; }
  renderer.render(scene, camera); raf = requestAnimationFrame(frame);
}
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); contextLost = true; stopJoystick(); keys.clear(); if (placesDialog.open) placesDialog.close(); cancelAnimationFrame(raf); window.showRoomError('3D 화면이 잠시 멈췄어요. 다시 들어가면 편안한 방으로 돌아갈 수 있어요.'); });
renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopJoystick(); keys.clear(); pointers.clear(); gesture = null; cancelAnimationFrame(raf); if (audioContext) audioContext.suspend().catch(() => {}); sleep.music.suspend(); } else { lastTime = performance.now(); if (!contextLost && !adPlaying) raf = requestAnimationFrame(frame); if (audioEnabled && audioContext) audioContext.resume().catch(() => {}); sleep.music.resume(); } });
// Compile every shader up front so the first steps into a new room do not stutter.
sleep.ceiling.visible = sleep.galaxy.visible = true; renderer.compile(scene, camera); sleep.ceiling.visible = sleep.galaxy.visible = false;
renderer.render(scene, camera);
clearTimeout(window.roomLoadTimer); document.querySelector('#loading').hidden = true; document.querySelector('#error').hidden = true;
hint.textContent = walkHint;
viewport.dataset.ready = 'true'; lastTime = performance.now(); raf = requestAnimationFrame(frame);
document.body.classList.add('room-ready');
window.lockRoomControls(false);
// Folded towels, mats and pillows arrive after the room opens (about 0.9 MB).
let towelDecor = null;
placeTowelDecor(scene, TOWEL_DECOR).then(placed => { towelDecor = placed; viewport.dataset.decor = Object.keys(placed).join(','); });
// Multiplayer starts after the room is ready, so a slow network never blocks entering.
document.querySelector('#chat-input').addEventListener('focus', () => { keys.clear(); stopJoystick(); });
social = createSocial({
  scene, camera, kit, viewport, actorScale: ACTOR_SCALE, makeShadow: contactShadow,
  getLocal: () => ({ x: hero.position.x, z: hero.position.z, facing: hero.rotation.y, action, snack: snackSig, walking: localWalking, outfit: encodeOutfit(outfit), room: currentRoom.id, visible: hero.visible }),
  onTrade: payload => onTrade(payload),
  onGreet: payload => onGreet(payload),
  notify: text => toast(text)
});
// ---------- Tapping a visitor: wave, or offer to swap sheep-cap towels ----------
const personCard = document.querySelector('#person-card'), tradeCard = document.querySelector('#trade-card');
let personId = null, outgoing = null, incoming = null;
const swatch = (el, color) => { el.style.setProperty('--towel', color || 'transparent'); el.classList.toggle('none', !color); };
const towelOf = remote => { const parts = (remote.outfit || '').split('.'); return parts.length === 4 && +parts[3] & 1 ? '#' + parts[2] : null; };
function openPerson(remote) {
  personId = remote.id; personCard.hidden = false;
  personCard.querySelector('[data-name]').textContent = remote.name;
  const theirs = towelOf(remote); swatch(personCard.querySelector('.towel-swatch'), theirs);
  personCard.querySelector('[data-towel]').textContent = theirs ? '양머리 수건이 있어요' : '아직 양머리가 없어요';
  const trade = personCard.querySelector('[data-trade]');
  trade.disabled = !!outgoing; trade.dataset.blocked = !outfit.hasTowel ? 'mine' : !theirs ? 'theirs' : '';
}
function closePerson() { personCard.hidden = true; personId = null; }
personCard.querySelector('[data-close]').addEventListener('click', closePerson);
personCard.querySelector('[data-chat]').addEventListener('click', () => { const target = personId; closePerson(); if (target) social.requestChat(target); });
personCard.querySelector('[data-wave]').addEventListener('click', () => {
  const remote = social.remotes.get(personId); closePerson(); if (remote) greet(remote);
});
personCard.querySelector('[data-trade]').addEventListener('click', event => {
  const remote = social.remotes.get(personId), blocked = event.currentTarget.dataset.blocked; if (!remote) return;
  if (blocked === 'mine') { closePerson(); toast('먼저 매점 수건 선반에서 양머리를 만들어요 🐑', '가기', goToTowel); return; }
  if (blocked === 'theirs') { toast(`${remote.name}님은 아직 양머리 수건이 없어요`); return; }
  const tid = Math.random().toString(36).slice(2, 10);
  outgoing = { to: remote.id, name: remote.name, tid, towel: outfit.towel, timer: setTimeout(() => { social.sendTrade(remote.id, 'cancel', null, tid); outgoing = null; toast(`${remote.name}님이 응답이 없어요`); }, 30000) };
  social.sendTrade(remote.id, 'offer', outfit.towel, tid); closePerson();
  toast(`${remote.name}님에게 수건을 바꾸자고 했어요`);
});
function closeTrade() { if (incoming) clearInterval(incoming.timer); incoming = null; tradeCard.hidden = true; }
function onTrade({ type, from, name, towel, tid }) {
  if (type === 'offer') {
    if (!outfit.hasTowel || incoming) { social.sendTrade(from, 'decline', null, tid); return; }
    incoming = { from, name, towel, tid, left: 30 };
    tradeCard.querySelector('[data-name]').textContent = `${name}님이 수건을 바꾸자고 해요`;
    swatch(tradeCard.querySelector('[data-mine]'), outfit.towel); swatch(tradeCard.querySelector('[data-theirs]'), towel);
    tradeCard.querySelector('[data-theirs-label]').textContent = `${name} 수건`;
    const clock = tradeCard.querySelector('[data-left]'); clock.textContent = '0:30';
    incoming.timer = setInterval(() => { if (!incoming) return; incoming.left--; clock.textContent = `0:${String(Math.max(0, incoming.left)).padStart(2, '0')}`; if (incoming.left <= 0) { social.sendTrade(from, 'decline', null, tid); closeTrade(); } }, 1000);
    tradeCard.hidden = false;
  } else if (type === 'cancel') { if (incoming?.tid === tid && incoming.from === from) { closeTrade(); toast(`${name}님이 수건 교환을 거뒀어요`); } }
  else if (outgoing?.tid === tid && outgoing.to === from) {
    clearTimeout(outgoing.timer);
    // They are making a copy for me: wait longer for the finished towel.
    if (type === 'making') { outgoing.timer = setTimeout(() => { outgoing = null; toast(`${name}님이 응답이 없어요`); }, 120000); toast(`${name}님이 똑같은 양머리를 만들어 주는 중이에요 🧶`); return; }
    const given = outgoing.towel; outgoing = null;
    if (type === 'gift') { applyOutfit({ ...addTowel(outfit, towel), wear: true }); if (action !== 'lie') player.celebrate(); toast(`${name}님이 똑같은 양머리를 만들어 줬어요! 🎁`); }
    else if (type === 'accept') { applyOutfit(addTowel(removeTowel(outfit, given), towel)); if (action !== 'lie') player.celebrate(); toast(`${name}님과 수건을 바꿨어요! 🐑`); }
    else toast(`${name}님이 지금은 괜찮대요`);
  }
}
tradeCard.querySelector('[data-accept]').addEventListener('click', () => {
  if (!incoming) return; const { from, name, towel, tid } = incoming;
  const given = outfit.towel; social.sendTrade(from, 'accept', given, tid); closeTrade();
  applyOutfit(addTowel(removeTowel(outfit, given), towel)); if (action !== 'lie') player.celebrate(); toast(`${name}님과 수건을 바꿨어요! 🐑`);
});
tradeCard.querySelector('[data-copy]').addEventListener('click', () => {
  if (!incoming) return; const { from, name, tid } = incoming;
  social.sendTrade(from, 'making', null, tid); closeTrade();
  towelGame.open({ color: outfit.towel, name, onDone: color => { social.sendTrade(from, 'gift', color, tid); toast(`${name}님에게 양머리를 선물했어요 🎁`); }, onCancel: () => social.sendTrade(from, 'decline', null, tid) });
});
tradeCard.querySelector('[data-decline]').addEventListener('click', () => { if (incoming) social.sendTrade(incoming.from, 'decline', null, incoming.tid); closeTrade(); });
// Newcomers without a sheep cap get one gentle pointer to the towel shelf.
// ---------- 인사: pick someone nearby, wave, and they can high-five back ----------
const greetLog = createGreetLog();
let picking = null, greetIn = null;
const greetPoint = new THREE.Vector3();
function screenOf(p) { greetPoint.set(p.x, 1.35, p.z).project(camera); return { x: (greetPoint.x + 1) / 2 * viewport.clientWidth, y: (1 - greetPoint.y) / 2 * viewport.clientHeight }; }
// A 👋 (or 💖) flies between two visitors; everyone sees the waving itself through the shared pose.
function fly(from, to, emoji) {
  const a = screenOf(from), b = screenOf(to), el = document.createElement('span');
  el.className = 'greet-fly'; el.textContent = emoji; document.querySelector('#labels').append(el);
  el.animate([{ transform: `translate(${a.x}px,${a.y}px) scale(.6)`, opacity: 0 }, { transform: `translate(${(a.x + b.x) / 2}px,${Math.min(a.y, b.y) - 60}px) scale(1.25)`, opacity: 1, offset: .5 }, { transform: `translate(${b.x}px,${b.y}px) scale(.9)`, opacity: 0 }], { duration: reducedMotion ? 1 : 900, easing: 'ease-in-out' }).onfinish = () => el.remove();
}
const faceTo = p => { facing = Math.atan2(p.x - hero.position.x, p.z - hero.position.z); };
function clearPick() { if (!picking) return; picking.buttons.forEach(b => b.remove()); clearTimeout(picking.timer); picking = null; }
function greet(remote) {
  clearPick(); setAction('wave'); faceTo(remote.character.root.position);
  const wait = greetLog.wait(remote.id);
  if (wait) { toast(`${remote.name}님에게는 ${Math.ceil(wait / 1000)}초 뒤에 다시 인사할 수 있어요`); return; }
  greetLog.sent(remote.id); social.sendGreet(remote.id, 'hello', Math.random().toString(36).slice(2, 10));
  fly(hero.position, remote.character.root.position, '👋'); status.textContent = `${remote.name}님에게 인사했어요 👋`;
}
// 인사 button: one person nearby → greet them; several → tap the 👋 over a name; nobody → just wave.
function startGreet() {
  const near = social ? greetTargets(social.remotes, hero.position, currentRoom.id) : [];
  if (near.length === 1) { greet(near[0]); return; }
  setAction('wave'); clearPick(); if (!near.length) return;
  picking = { timer: setTimeout(clearPick, 8000), buttons: near.map(remote => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'greet-pick'; b.textContent = '👋'; b.setAttribute('aria-label', `${remote.name}님에게 인사`);
    b.addEventListener('click', event => { event.stopPropagation(); greet(remote); }); remote.label.prepend(b); return b;
  }) };
  toast('누구에게 인사할까요? 이름 위 👋를 눌러요');
}
function highFive(remote) {
  setAction('wave'); faceTo(remote.character.root.position); player.celebrate(); fly(hero.position, remote.character.root.position, '💖');
  const got = greetLog.reward(remote.id) ? wallet.earn(1) : 0;
  toast(`${remote.name}님과 하이파이브! 🙌${got ? ` 온기 +${got}♨` : ''}`);
}
function onGreet({ type, from, name, gid }) {
  const remote = social.remotes.get(from); if (!remote) return;
  if (type === 'accept') { highFive(remote); return; }
  // Unanswered greetings quietly disappear after 10 s; nothing marks them as ignored.
  fly(remote.character.root.position, hero.position, '👋');
  greetIn = { from, gid }; setTimeout(() => { if (greetIn?.gid === gid) greetIn = null; }, GREET_EXPIRE);
  toast(`${name}님이 인사했어요`, '👋 받아주기', () => { if (greetIn?.gid !== gid) return; greetIn = null; social.sendGreet(from, 'accept', gid); highFive(remote); }, GREET_EXPIRE);
}

// ---------- 사주방: today's fortune, computed in the browser ----------
const fortuneDialog = document.querySelector('#fortune-dialog'), fortuneForm = document.querySelector('#fortune-form'), fortuneResult = document.querySelector('#fortune-result');
function showFortune(birth) {
  const f = fortune(birth.date, birth.time ? +birth.time.split(':')[0] : null); if (!f) return;
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  fortuneResult.innerHTML = `<p class="fortune-pillars">나의 일주 <b></b> · 오늘 <b></b></p><h3></h3><p class="fortune-text"></p><dl>${Object.entries(f.scores).map(([k, v]) => `<div><dt>${k}</dt><dd aria-label="5점 중 ${v}점">${stars(v)}</dd></div>`).join('')}</dl><p class="fortune-lucky">행운의 색 <i style="background:${f.hex}"></i><b></b> · 행운의 숫자 <b></b></p>`;
  const b = fortuneResult.querySelectorAll('b');
  b[0].textContent = `${f.mine}(${f.element})`; b[1].textContent = `${f.today}(${f.todayElement})`; b[2].textContent = f.color; b[3].textContent = f.number;
  fortuneResult.querySelector('h3').textContent = f.title; fortuneResult.querySelector('.fortune-text').textContent = f.text;
  fortuneResult.hidden = false;
}
document.querySelector('#fortune-open').addEventListener('click', () => {
  placesDialog.close(); const saved = loadBirth();
  fortuneResult.hidden = true;
  if (saved?.date) { document.querySelector('#fortune-date').value = saved.date; document.querySelector('#fortune-time').value = saved.time || ''; showFortune(saved); }
  fortuneDialog.showModal();
});
fortuneForm.addEventListener('submit', event => {
  event.preventDefault();
  const birth = { date: document.querySelector('#fortune-date').value, time: document.querySelector('#fortune-time').value };
  if (!birth.date) return; saveBirth(birth); showFortune(birth);
});
document.querySelector('#fortune-close').addEventListener('click', () => fortuneDialog.close());
document.querySelector('#fortune-forget').addEventListener('click', () => { saveBirth(null); fortuneForm.reset(); fortuneResult.hidden = true; toast('생년월일을 지웠어요'); });

// ---------- South wing spots: 사물함 갈아입기, 사주방 운세, 세신 ----------
const spotButton = document.querySelector('#spot-action');
let spot = null, scrubbing = 0, scrubReady = 0, deskWave = 0, shower = 0;
// 목욕탕: soak in a pool or shower for 온기 (each with its own cooldown).
const BATH = { hotpool: { time: 8, reward: 2, gap: 300000, enter: '따끈따끈~ 온탕에 들어왔어요 ♨', done: '몸이 사르르 풀렸어요' }, coldpool: { time: 6, reward: 2, gap: 300000, enter: '으아, 차가워! 냉탕에 들어왔어요 🧊', done: '정신이 번쩍! 상쾌해요' }, shower: { time: 4, reward: 1, gap: 180000, enter: '쏴아~ 샤워 중이에요 🚿', done: '깨끗하게 씻었어요' } };
const bathReady = {};
function bathReward(kind) {
  const b = BATH[kind]; bathReady[kind] = Date.now() + b.gap;
  const got = wallet.earn(b.reward); player.celebrate(); toast(`${b.done}${got ? ` 온기 +${got}♨` : ''}`);
}
function leaveSoak() { const back = soak.back; soak = null; hero.position.set(back[0], 0, back[1]); target.copy(hero.position); }
// 입구 카운터: the first visit hands over a locker key (kept on this device) and a fresh 찜질복.
let lockerKey = 0; try { lockerKey = Number(localStorage.getItem('jjimjiljung-key')) || 0; } catch { /* storage may be unavailable */ }
const SCRUB_TIME = 6, SCRUB_GAP = 10 * 60 * 1000, SCRUB_REWARD = 2;
function updateSpots(dt) {
  const near = SPOTS.find(s => s.room === currentRoom.id && Math.hypot(hero.position.x - s.x, hero.position.z - s.z) < s.r) || null;
  const show = near && !towelGame.isOpen && !shop.playing && !scrubbing && !soak && !shower && !document.querySelector('dialog[open]');
  if (near !== spot || spotButton.hidden === !!show) { spot = near; spotButton.hidden = !show; if (near) spotButton.textContent = near.label; }
  if (show) towelNudge.hidden = true;
  if (near?.id === 'locker' && lockerKey) spotButton.textContent = `👕 ${lockerKey}번 사물함에서 갈아입기`;
  deskWave = Math.max(0, deskWave - dt);
  if (soak && !soak.done && (soak.t -= dt) <= 0) { soak.done = true; bathReward(soak.kind); }
  if (shower > 0) {
    if (action !== 'stand' || Math.hypot(hero.position.x - spot?.x, hero.position.z - spot?.z) > 1.2 || localWalking) shower = 0;
    else if ((shower -= dt) <= 0) { shower = 0; bathReward('shower'); }
  }
  if (scrubbing > 0) {
    // Getting up (any other pose or walking away) stops the scrub without a reward.
    if (action !== 'lie') { scrubbing = 0; return; }
    scrubbing -= dt;
    if (scrubbing <= 0) {
      scrubbing = 0; scrubReady = Date.now() + SCRUB_GAP;
      const got = wallet.earn(SCRUB_REWARD); player.celebrate();
      toast(`개운해요! 때가 쏙 빠졌어요 ✨${got ? ` 온기 +${got}♨` : ''}`); status.textContent = '몸도 마음도 반질반질해졌어요.';
    }
  }
}
spotButton.addEventListener('click', () => {
  if (!spot) return;
  if (spot.id === 'desk') {
    deskWave = 2.5; faceTo({ x: 14.7, z: 4.8 });
    if (!lockerKey) {
      lockerKey = 1 + Math.floor(Math.random() * 120); try { localStorage.setItem('jjimjiljung-key', String(lockerKey)); } catch { /* storage may be unavailable */ }
      applyOutfit({ ...outfit, top: randomPart('top'), bottom: randomPart('bottom') }); player.celebrate();
      toast(`${lockerKey}번 열쇠와 새 찜질복을 받았어요! 탈의실 사물함에서 갈아입을 수 있어요 🔑`);
    } else toast(`어서 오세요! ${lockerKey}번 열쇠는 그대로예요. 푹 쉬다 가세요 ♨`);
  }
  else if (BATH[spot.id]) {
    const kind = spot.id, b = BATH[kind];
    if (Date.now() < (bathReady[kind] || 0)) { toast(`조금 쉬었다가 다시 해요 (${Math.ceil((bathReady[kind] - Date.now()) / 60000)}분)`); return; }
    if (spot.pool) {
      const back = [spot.x, spot.z]; setAction('sit'); hero.position.set(spot.pool[0], 0, spot.pool[1]); target.copy(hero.position);
      facing = 0; soak = { kind, t: b.time, back, done: false };
    } else { setAction('stand'); facing = Math.PI; shower = b.time; }
    toast(b.enter); spotButton.hidden = true;
  }
  else if (spot.id === 'locker') outfitButton.click();
  else if (spot.id === 'fortune') document.querySelector('#fortune-open').click();
  else if (spot.id === 'scrub') {
    if (Date.now() < scrubReady) { toast(`세신은 ${Math.ceil((scrubReady - Date.now()) / 60000)}분 뒤에 또 받을 수 있어요`); return; }
    const [x, z] = spot.bed; route.length = 0; hero.position.set(x, 0, z); target.copy(hero.position); view.focus.set(x, 0, z);
    setAction('lie'); facing = -Math.PI / 2; scrubbing = SCRUB_TIME; spotButton.hidden = true;
    toast('슥슥… 세신사님이 시원하게 밀어 드려요 🧽'); status.textContent = '가만히 누워 있어요. 시원해요~';
  }
});

const towelNudge = document.querySelector('#towel-nudge');
towelNudge.querySelector('button').addEventListener('click', () => { towelNudge.hidden = true; goToTowel(); });
if (!outfit.hasTowel) {
  const nudge = setInterval(() => {
    if (document.querySelector('dialog[open]')) return;
    clearInterval(nudge); if (outfit.hasTowel) return;
    towelNudge.hidden = false; setTimeout(() => { towelNudge.hidden = true; }, 15000);
  }, 2500);
}
// 카카오톡 친구 초대, and a warm hello for visitors who came from an invite.
const invite = createInvite({ button: document.querySelector('#invite'), getNickname: () => social.nickname, toast });
if (invite.invitedBy) {
  const joinText = document.querySelector('#join-intro');
  if (document.querySelector('#join-dialog').open && joinText) joinText.textContent = `${invite.invitedBy}님의 초대로 왔어요! 이름을 정하고 함께 찜질해요 ♨`;
  else toast(`${invite.invitedBy}님이 초대했어요! 같이 찜질해요 ♨`);
}
