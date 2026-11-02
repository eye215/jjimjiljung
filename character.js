import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/three-addons/GLTFLoader.js';
import { clone as cloneSkinned } from './vendor/three-addons/SkeletonUtils.js';

// Reference-inspired plush silhouette: deep towel cap, tiny dot eyes,
// barely visible neck, soft mittens and short legs. No bag or shoulder strap.
// Each character owns its outfit materials so several visitors can wear
// different palettes at once (needed for remote players).
export const PALETTES = Object.freeze({
  peach: ['#e6a05b', '#cf874b', '#f7d5a4', '#fff2db', '#e9dac0'],
  mint: ['#bdcaa2', '#9cab80', '#eef0d0', '#b7c89a', '#a1b488'],
  lilac: ['#c8b2d8', '#a88dbc', '#f0d9e7', '#c7b0d5', '#b29ac1']
});

export const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...extra });
const sphereGeometry = new THREE.SphereGeometry(1, 32, 24);
export function mesh(geometry, material, parent, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material); object.position.set(...position);
  object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
export function ellipsoid(parent, material, position, scale) { const m = mesh(sphereGeometry, material, parent, position); m.scale.set(...scale); return m; }
export function roundedGeometry(w, h, d, r = .08, smooth = 8) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2, d / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, d - r * 2), bevelEnabled: true, bevelSegments: smooth > 4 ? 3 : 2, steps: 1, bevelSize: r, bevelThickness: r, curveSegments: smooth });
  g.center(); g.computeBoundingBox(); const bounds = g.boundingBox;
  g.scale(w / (bounds.max.x - bounds.min.x), h / (bounds.max.y - bounds.min.y), d / (bounds.max.z - bounds.min.z)); return g;
}
export function box(parent, material, pos, size, radius = .04, smooth = 8) { return mesh(roundedGeometry(...size, radius, smooth), material, parent, pos); }
export function tube(parent, material, points, radius = .025) { return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(16, points.length * 3), radius, 8, false), material, parent); }
export function cylinder(parent, material, pos, rTop, rBottom, height, segments = 40) { return mesh(new THREE.CylinderGeometry(rTop, rBottom, height, segments), material, parent, pos); }
// Merge every mesh under `group` (except inside `skip` subtrees) by material,
// keeping animated pivots separate. A character drops from ~60 to ~16 draw calls.
export function compact(group, skip = []) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert(), buckets = new Map(), remove = [];
  const skipped = object => { for (let o = object; o && o !== group; o = o.parent) if (skip.includes(o)) return true; return false; };
  group.traverse(object => {
    if (!object.isMesh || skipped(object)) return;
    const key = object.material.uuid + (object.castShadow ? ':c' : ':n');
    if (!buckets.has(key)) buckets.set(key, { material: object.material, cast: object.castShadow, renderOrder: object.renderOrder, parts: [] });
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
    geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
    buckets.get(key).parts.push(geometry); remove.push(object);
  });
  for (const object of remove) object.parent.remove(object);
  for (const { material, cast, renderOrder, parts } of buckets.values()) {
    const merged = mergeGeometries(parts);
    const combined = new THREE.Mesh(merged, material); combined.castShadow = cast; combined.receiveShadow = true; combined.renderOrder = renderOrder;
    group.add(combined);
  }
}
export function mergeGeometries(parts) {
  let count = 0; for (const part of parts) count += part.attributes.position.count;
  const position = new Float32Array(count * 3), normal = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  let offset = 0;
  for (const part of parts) {
    if (!part.attributes.normal) part.computeVertexNormals();
    position.set(part.attributes.position.array, offset * 3);
    normal.set(part.attributes.normal.array, offset * 3);
    if (part.attributes.uv) uv.set(part.attributes.uv.array, offset * 2);
    offset += part.attributes.position.count; part.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.computeBoundingSphere();
  return merged;
}
const HEAD_Y = 1.6, HEAD_SCALE = 1.15;
let randomSeed = 137;
export function random() { randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0; return randomSeed / 4294967296; }

// ---------- The plush models (the user's Meshy GLBs, Mixamo skeleton) ----------
// Two round chibis by the user, reduced for phones by tools/prep-character.mjs (46k/40k
// vertices, 2048 WebP, unified skin weights, shirt torso freed from the arm bones):
// `plain` (bare hair) and `cap` (the same chibi wearing the rolled sheep towel). Putting the
// sheep cap on swaps the body. Clips: Walking, Running, Sit (on the floor), Cheer (arms up).
// Standing, lying, eating and waving have no clip; they are posed in code.
export const PLUSH_URL = new URL('./assets/chibi2-mobile.glb?v=5', import.meta.url).href;
export const PLUSH_CAP_URL = new URL('./assets/chibi2-cap-mobile.glb?v=5', import.meta.url).href;
export const CLIPS = { walk: 'Walking', run: 'Running', sit: 'Sit', cheer: 'Cheer' };
// Both models are 1.7 units tall; this makes them 1.35 m in the room like the other actors.
const MODEL_SCALE = 1.35 / 1.7;
// The scene scales every actor by .62; with MODEL_SCALE the plush is 1.35 m tall in the room.
const PLUSH_SCALE = 1 / .62;
// Per-model points (model units, bind pose), measured on the GLBs:
// lift = lowest skin point of each clip (so feet and seat rest on the floor),
// eyes / mouth = the baked features the expression patches cover, skin = the face colour there,
// hat = the height above which white terry is the sheep towel (dyed in the towel colour).
const PROFILES = {
  plain: { hipY: .362, lift: { Walking: .04, Running: .03, Sit: .12, Cheer: .025 }, eyes: { x: .19, y: .942, z: .372 }, mouth: { x: -.012, y: .888, z: .42 }, skin: '#fad9cb', hat: 9 },
  cap: { hipY: .388, lift: { Walking: .01, Running: .006, Sit: .1, Cheer: .007 }, eyes: { x: .174, y: .926, z: .393 }, mouth: { x: .006, y: .872, z: .438 }, skin: '#fcd6c4', hat: .82 }
};
// Lying on the back: the back of the head rests on the floor (model units).
const LIE_LIFT = .44;
// Sitting like a plush toy: legs straight out in front, the seat this high (model units).
const SEAT_Y = .15;
const HEAD_ANCHOR_Y = 1.25;
// Hands stay outside this sphere around the big head (model units, follows the head bone).
const HEAD_BALL = { y: 1.2, z: .02, r: .56 };
// Dye bands (model units): the white 찜질복 is dyed below CLOTH_TOP; the shorts below HEM.
const CLOTH_TOP = .8, HEM = .37;
const PILLOW_FIT = { length: .56, z: -.6 };
// Clips walk in place: drop horizontal hip drift but keep each pose's offset.
function prepareClips(gltf) {
  for (const clip of gltf.animations) for (const track of clip.tracks) {
    if (!/Hips\.position$/.test(track.name)) continue;
    const v = track.values, x0 = v[0], z0 = v[2];
    for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
  }
}
async function loadModel(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  let skinned = null; gltf.scene.traverse(o => { if (o.isSkinnedMesh) skinned = o; });
  if (!skinned || !Object.values(CLIPS).every(name => gltf.animations.some(c => c.name === name))) throw new Error('Unexpected plush model');
  prepareClips(gltf); skinned.geometry.computeBoundingSphere();
  return gltf;
}
// Load once; on any failure the room falls back to the procedural character. The sheep-cap
// model rides along on the plain one (`userData.capModel`); without it the cap stays off.
export async function loadPlushModel(url = PLUSH_URL, capUrl = PLUSH_CAP_URL) {
  try {
    const [gltf, cap] = await Promise.all([loadModel(url), loadModel(capUrl).catch(error => { console.warn('Sheep-cap plush unavailable.', error); return null; })]);
    gltf.userData.capModel = cap;
    return gltf;
  } catch (error) { console.warn('Plush model unavailable, using the built-in character.', error); return null; }
}

// ---------- One-time clean-up of the shared plush model ----------
// Edge-preserving smoothing: a pixel takes its blurred value only where it differs
// little from it, so baked fuzz and speckles soften while eyes, mouth and seams stay crisp.
// Average normals of vertices that share a position (split only by UV seams), so
// the low-poly Meshy surfaces shade as one soft plush skin instead of facets.
export function weldNormals(geometry) {
  const pos = geometry.attributes.position, normal = geometry.attributes.normal; if (!normal) return;
  const groups = new Map(), key = i => `${Math.round(pos.getX(i) * 4000)},${Math.round(pos.getY(i) * 4000)},${Math.round(pos.getZ(i) * 4000)}`;
  geometry.computeVertexNormals();
  for (let i = 0; i < pos.count; i++) { const k = key(i); let g = groups.get(k); if (!g) groups.set(k, g = [0, 0, 0, []]); g[0] += normal.getX(i); g[1] += normal.getY(i); g[2] += normal.getZ(i); g[3].push(i); }
  for (const [x, y, z, ids] of groups.values()) { const l = Math.hypot(x, y, z) || 1; for (const i of ids) normal.setXYZ(i, x / l, y / l, z / l); }
  normal.needsUpdate = true;
}
function smoothPixels(px, w, h, threshold = 26, passes = 2) {
  const tmp = new Uint8ClampedArray(px.length);
  for (let pass = 0; pass < passes; pass++) {
    tmp.set(px);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const k = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        // Bilateral: only neighbours close to this pixel count, so nothing bleeds across edges.
        const v = tmp[k + c]; let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const u = tmp[k + (dy * w + dx) * 4 + c]; if (Math.abs(u - v) < threshold) { sum += u; n++; } }
        px[k + c] = sum / n;
      }
    }
  }
}
// Returns a smoothed copy of a GLB texture (glTF textures are not flipped).
// Fill the empty atlas gaps around each UV island with its edge colour, so filtering
// and mipmaps never pull the dark background in as thin lines along the seams.
function dilateIslands(ctx, px, w, h, geometry, grow = 8) {
  if (!geometry?.attributes.uv) return;
  const uv = geometry.attributes.uv, index = geometry.index, m = document.createElement('canvas'); m.width = w; m.height = h;
  const mc = m.getContext('2d', { willReadFrequently: true }); mc.fillStyle = '#fff'; mc.beginPath();
  const count = index ? index.count : uv.count, at = i => index ? index.getX(i) : i;
  for (let t = 0; t < count; t += 3) { const a = at(t), b = at(t + 1), c = at(t + 2); mc.moveTo(uv.getX(a) * w, uv.getY(a) * h); mc.lineTo(uv.getX(b) * w, uv.getY(b) * h); mc.lineTo(uv.getX(c) * w, uv.getY(c) * h); mc.closePath(); }
  mc.fill();
  const md = mc.getImageData(0, 0, w, h).data, inside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inside[i] = md[i * 4 + 3] > 200 ? 1 : 0;
  for (let round = 0; round < grow; round++) {
    const add = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (inside[i]) continue;
      let r = 0, g = 0, b = 0, n = 0; for (const j of [i - 1, i + 1, i - w, i + w]) if (inside[j]) { r += px[j * 4]; g += px[j * 4 + 1]; b += px[j * 4 + 2]; n++; }
      if (n) { px[i * 4] = r / n; px[i * 4 + 1] = g / n; px[i * 4 + 2] = b / n; add.push(i); }
    }
    for (const i of add) inside[i] = 1;
  }
}
export function smoothTexture(texture, edit = null, threshold = 26, passes = 2, geometry = null) {
  const image = texture?.image; if (!image) return texture;
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  edit?.(data.data, c.width, c.height);
  dilateIslands(ctx, data.data, c.width, c.height, geometry);
  smoothPixels(data.data, c.width, c.height, threshold, passes);
  ctx.putImageData(data, 0, 0);
  const out = new THREE.CanvasTexture(c); out.flipY = texture.flipY; out.colorSpace = texture.colorSpace; out.wrapS = texture.wrapS; out.wrapT = texture.wrapT; out.anisotropy = texture.anisotropy;
  return out;
}
// Smooth plush surfaces (user's settings): colour comes only from the map; no normal,
// bump or displacement map may dent the face; full mipmaps and anisotropic filtering.
export function setupCharacterMaterials(model, renderer) {
  model.traverse(child => {
    if (!child.isMesh || !child.material) return;
    const mat = child.material;
    if (mat.normalMap) mat.normalScale.set(.2, .2);
    mat.displacementMap = null; mat.bumpMap = null;
    if (mat.map) {
      mat.map.generateMipmaps = true; mat.map.minFilter = THREE.LinearMipmapLinearFilter; mat.map.magFilter = THREE.LinearFilter;
      mat.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); mat.map.colorSpace = THREE.SRGBColorSpace; mat.map.needsUpdate = true;
    }
    mat.roughness = .85; mat.metalness = 0; mat.needsUpdate = true;
  });
}
// Expression textures replace colour only (they are sampled into the face's map colour).
export function prepareFaceTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; return texture;
}
export function createCharacterKit(renderer, plushModel = null, towels = {}) {
  function canvasTexture(draw, width = 512, height = 512) {
    const c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d'), width, height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t;
  }
  const textile = canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#f4f3f1'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 17000; i++) { const v = random(); ctx.strokeStyle = v > .5 ? '#ffffff65' : '#9c999430'; const x = random() * w, y = random() * h; ctx.beginPath(); ctx.ellipse(x, y, 1.1, 2.1, .5, 0, Math.PI * 2); ctx.stroke(); }
  }, 256, 256);
  textile.wrapS = textile.wrapT = THREE.RepeatWrapping; textile.repeat.set(3, 2);
  const skin = new THREE.MeshPhysicalMaterial({ color: '#fbdcc8', roughness: .9, sheen: .4, sheenRoughness: .9, sheenColor: new THREE.Color('#fff1e8') });
  const hair = mat('#5a3a2a', { roughness: .85 });
  const baseTowel = new THREE.MeshPhysicalMaterial({ color: '#fff2db', map: textile, bumpMap: textile, bumpScale: .08, roughness: 1, sheen: 1, sheenRoughness: .9, sheenColor: new THREE.Color('#ffffff') });
  function faceTexture(expression) {
    return canvasTexture((c, w, h) => {
      const ellipse = (x, y, rx, ry, color) => { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
      // Small, quiet features leave the round cheeks and towel as the focal point.
      for (const x of [102, 410]) { const g = c.createRadialGradient(x, 327, 0, x, 327, 48); g.addColorStop(0, 'rgba(234,147,113,.3)'); g.addColorStop(1, 'rgba(234,147,113,0)'); c.fillStyle = g; c.fillRect(x - 50, 277, 100, 100); }
      c.lineCap = 'round'; c.lineWidth = 8; c.strokeStyle = '#4e3428';
      for (const x of [151, 361]) {
        if (expression === 'sleep' || expression === 'happy') { c.beginPath(); c.moveTo(x - 17, 318); c.quadraticCurveTo(x, expression === 'sleep' ? 328 : 301, x + 17, 318); c.stroke(); }
        else { ellipse(x, 322, 21, 27, '#2e211b'); ellipse(x - 7, 311, 7, 8, '#ffffff'); }
      }
      c.strokeStyle = '#ba7956'; c.lineWidth = 6; c.beginPath();
      if (expression === 'sleep') { c.ellipse(256, 390, 6, 8, 0, 0, Math.PI * 2); c.stroke(); }
      else if (expression === 'chew') {
        // Puffed, rosy cheeks and a little munching mouth.
        for (const x of [118, 394]) { const g = c.createRadialGradient(x, 352, 0, x, 352, 58); g.addColorStop(0, 'rgba(240,140,110,.5)'); g.addColorStop(1, 'rgba(240,140,110,0)'); c.fillStyle = g; c.fillRect(x - 60, 292, 120, 120); }
        c.moveTo(240, 388); c.quadraticCurveTo(248, 398, 256, 388); c.quadraticCurveTo(264, 398, 272, 388); c.stroke();
      } else if (expression === 'dizzy') {
        c.lineWidth = 5; c.strokeStyle = '#4e3428';
        for (const x of [151, 361]) { c.beginPath(); for (let a = 0; a < 12; a += .3) c.lineTo(x + Math.cos(a) * a * 1.6, 318 + Math.sin(a) * a * 1.6); c.stroke(); }
        c.strokeStyle = '#ba7956'; c.beginPath(); c.moveTo(238, 392); for (let i = 1; i <= 6; i++) c.lineTo(238 + i * 6, 392 + (i % 2 ? -6 : 0)); c.stroke();
      } else { c.moveTo(244, 382); c.quadraticCurveTo(256, expression === 'happy' ? 404 : 396, 268, 382); c.stroke(); }
    }, 512, 512);
  }
  const faces = { normal: faceTexture('normal'), sleep: faceTexture('sleep'), happy: faceTexture('happy'), chew: faceTexture('chew'), dizzy: faceTexture('dizzy') };
  // Snack textures: a speckled 맥반석 shell and a paper 식혜 cup.
  const shellTexture = canvasTexture((c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c98a55'); g.addColorStop(1, '#9c6236'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { c.fillStyle = random() > .5 ? 'rgba(80,40,20,.35)' : 'rgba(255,220,180,.25)'; c.beginPath(); c.arc(random() * w, random() * h, random() * 2.2 + .4, 0, 7); c.fill(); }
  }, 256, 128);
  const cupTexture = canvasTexture((c, w, h) => {
    c.fillStyle = '#fff6e6'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e9b98c'; c.fillRect(0, 0, w, 16); c.fillRect(0, h - 22, w, 22);
    c.fillStyle = '#b5652e'; c.font = `800 46px ${'"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","WenQuanYi Zen Hei",sans-serif'}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const x of [w * .25, w * .75]) { c.fillText('식혜', x, h * .5); for (let i = 0; i < 5; i++) { c.fillStyle = '#f3dcb8'; c.beginPath(); c.ellipse(x - 30 + i * 15, h * .5 + 34, 5, 3, .4, 0, 7); c.fill(); } c.fillStyle = '#b5652e'; }
  }, 512, 160);
  const headGeometry = new THREE.SphereGeometry(1, 64, 40);
  const hp = headGeometry.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
    const cheeks = 1 + .035 * Math.exp(-(((y + .25) / .4) ** 2));
    hp.setXYZ(i, x * .625 * cheeks, y * .50, z * .515);
  }
  headGeometry.computeVertexNormals();
  const faceGeometry = new THREE.PlaneGeometry(1.06, .86, 40, 32);
  const fp = faceGeometry.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), y = fp.getY(i) - .015;
    fp.setXYZ(i, x, y, .519 * Math.sqrt(Math.max(.05, 1 - (x / .65) ** 2 - (y / .51) ** 2)) + .006);
  }
  faceGeometry.computeVertexNormals();
  // An actual deep cloth shell, rather than a flat band perched above the head.
  const capGeometry = new THREE.SphereGeometry(1, 64, 36, 0, Math.PI * 2, 0, 1.75);
  const capPoints = capGeometry.attributes.position;
  for (let i = 0; i < capPoints.count; i++) {
    const x = capPoints.getX(i), y = capPoints.getY(i), z = capPoints.getZ(i);
    const longitude = Math.atan2(z, x);
    const fold = (Math.sin(longitude * 7 + .4) * .009 + Math.sin(longitude * 11) * .004) * (1 - y * y);
    capPoints.setXYZ(i, x * (.715 + fold), y * .64, z * (.605 + fold));
  }
  capGeometry.computeVertexNormals();
  // Towel details are identical for every visitor, so the tubes are built once.
  const edgePoints = []; for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 2; edgePoints.push([Math.sin(a) * .704, .076 + Math.sin(a * 3) * .008, Math.cos(a) * .596 - .015]); }
  function latheBody(parent, material, points, pos, depth = 1) { const m = mesh(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), 48), material, parent, pos); m.scale.z = depth; return m; }
  function steamEmblem(parent, material, z, back = false) {
    const logo = new THREE.Group(); logo.position.set(0, .91, z); if (back) logo.rotation.y = Math.PI; parent.add(logo);
    for (const x of [-.074, 0, .074]) tube(logo, material, [[x, -.015, 0], [x - .018, .03, 0], [x + .014, .073, 0], [x, .115, 0]], .012);
    tube(logo, material, [[-.13, -.015, 0], [-.105, -.065, .008], [0, -.087, .015], [.105, -.065, .008], [.13, -.015, 0]], .012);
  }

  // The sheep-cap towel, in the procedural head's units (radius ≈ .6).
  function buildCap(cap, towel, seam) {
    mesh(capGeometry, towel, cap, [0, .19, -.015]);
    // Rounded lower hem follows the full circumference, including the back view.
    tube(cap, towel, edgePoints, .036);
    // Two overlapping folds give the cap the wrapped silhouette of a real towel.
    for (const offset of [0, .115]) {
      const fold = [];
      for (let i = 0; i <= 40; i++) {
        const x = -.65 + i / 40 * 1.3, y = .15 + offset + (x + .65) * .10;
        const z = .605 * Math.sqrt(Math.max(.02, 1 - (x / .715) ** 2 - ((y - .19) / .64) ** 2)) - .015;
        fold.push([x, y, z + .012]);
      }
      tube(cap, towel, fold, .017);
    }
    // Subtle stitched arcs follow the cap's curved surface, like folded terrycloth.
    const crownSeam = []; for (let i = 0; i <= 36; i++) { const t = i / 36 * 1.68; crownSeam.push([.1 * Math.sin(t), .19 + .646 * Math.cos(t), .609 * Math.sin(t) - .015]); }
    tube(cap, seam, crownSeam, .006);
    for (const side of [-1, 1]) {
      const roll = new THREE.Group(); roll.position.set(side * .7, .12, .02); roll.rotation.z = -side * .10; roll.scale.setScalar(1.28); cap.add(roll);
      ellipsoid(roll, towel, [0, 0, 0], [.235, .285, .285]);
      // Soft overlapping folds, not a hard, high-contrast cinnamon-roll spiral.
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const petal = ellipsoid(roll, towel, [Math.cos(a) * .065, Math.sin(a) * .10, .205], [.13, .16, .065]); petal.rotation.z = a - Math.PI / 2; }
      ellipsoid(roll, towel, [0, 0, .254], [.09, .105, .05]);
      const crease = []; for (let i = 0; i <= 35; i++) { const a = i / 35 * Math.PI * 2.2, r = .035 + .13 * i / 35; crease.push([Math.cos(a) * r, Math.sin(a) * r * 1.13, .264 - .035 * i / 35]); }
      tube(roll, seam, crease, .006);
    }
    // Props for resting and snacks. Snacks are held in both hands in front of
    // the chest (a rig child), then raised to the mouth for each bite or sip.
  }

  // Snack props (맥반석 egg, 식혜 cup), shell shards and sparkles, and the timing
  // of every bite and sip. `chest` places the props in front of the procedural
  // rig; the plush model holds them in its hand instead.
  function attachSnacks(character, rig, { chest = false } = {}) {
    const snackRoot = new THREE.Group(); snackRoot.visible = false;
    if (chest) { snackRoot.position.set(0, .84, .6); snackRoot.scale.setScalar(1.35); rig.add(snackRoot); }
    const egg = new THREE.Group(); snackRoot.add(egg);
    const shell = ellipsoid(egg, mat('#ffffff', { map: shellTexture, roughness: .55 }), [0, 0, 0], [.15, .19, .15]);
    const peeled = new THREE.Group(); egg.add(peeled);
    ellipsoid(peeled, mat('#fffaf0', { roughness: .25 }), [0, 0, 0], [.14, .18, .14]);
    const yolk = ellipsoid(peeled, mat('#f6b73c', { roughness: .5 }), [0, .02, 0], [.085, .06, .085]);
    const cup = new THREE.Group(); snackRoot.add(cup);
    const paper = mat('#ffffff', { map: cupTexture, roughness: .9 });
    const cupBody = mesh(new THREE.CylinderGeometry(.15, .115, .36, 28, 1, true), paper, cup); cupBody.material.side = THREE.DoubleSide;
    cylinder(cup, mat('#f3e6cf'), [0, -.178, 0], .115, .115, .012, 28);
    mesh(new THREE.TorusGeometry(.15, .012, 8, 28), mat('#f1dcbc'), cup, [0, .18, 0]).rotation.x = Math.PI / 2;
    const liquid = new THREE.Group(); cup.add(liquid);
    cylinder(liquid, mat('#f2e2bf', { roughness: .2, transparent: true, opacity: .92 }), [0, 0, 0], .142, .142, .01, 28);
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = .03 + (i % 3) * .035; ellipsoid(liquid, mat('#fffdf6'), [Math.cos(a) * r, .008, Math.sin(a) * r], [.018, .007, .011]).rotation.y = a; }
    tube(cup, mat('#ef8f7a'), [[.04, .08, -.02], [.05, .3, -.03], [.03, .38, .05], [0, .4, .1]], .016);
    // Shell shards and sparkles for the crack and the happy finish.
    const bursts = [];
    for (let i = 0; i < 12; i++) {
      const sparkle = i >= 7, piece = mesh(sparkle ? new THREE.OctahedronGeometry(.035) : new THREE.TetrahedronGeometry(.04), sparkle ? new THREE.MeshBasicMaterial({ color: '#ffe48a' }) : mat('#a96a3c'), rig);
      piece.visible = false; piece.castShadow = false; bursts.push({ piece, sparkle, velocity: new THREE.Vector3(), life: 0 });
    }
    // ---------- Snacks: egg (crack, peel, three bites) and sikhye (four sips) ----------
    const burst = (sparkle, origin) => {
      for (const b of bursts) if (b.sparkle === sparkle) {
        b.piece.visible = true; b.piece.position.copy(origin); b.life = sparkle ? 1 : .9;
        b.velocity.set((random() - .5) * 1.4, .6 + random() * .9, .2 + random() * .6);
      }
    };
    const egg3 = new THREE.Vector3(), CHEST = new THREE.Vector3(0, .84, .6), MOUTH = new THREE.Vector3(0, 1.22, .62), BROW = new THREE.Vector3(0, 1.98, .72);
    // 0→1→0 envelope: rise `up` s from `at`, hold, then lower over `down` s.
    const bump = (t, at, up, hold, down) => t < at ? 0 : t < at + up ? (t - at) / up : t < at + up + hold ? 1 : t < at + up + hold + down ? 1 - (t - at - up - hold) / down : 0;
    character.startSnack = (kind, { style = 'normal', onDone = null } = {}) => {
      character.snack = { kind, style, t: 0, level: 1, hold: false, frozen: false, cracked: false, finished: false, onDone };
      snackRoot.visible = true; egg.visible = kind === 'egg'; cup.visible = kind === 'drink';
      shell.visible = true; peeled.visible = false; peeled.scale.setScalar(1); yolk.visible = false; liquid.visible = true; liquid.position.y = .15;
    };
    character.stopSnack = () => { const done = character.snack?.onDone; character.snack = null; snackRoot.visible = false; done?.(false); };
    function snackPose(dt) {
      const s = character.snack; if (!s) return null;
      s.t += dt; const t = s.t;
      let mouth = 0, brow = 0, face = 'happy', end = 0;
      if (s.kind === 'egg') {
        const crackAt = s.style === 'forehead' ? 1.3 : 1.4;
        if (s.style === 'forehead') brow = bump(t, .5, .5, .3, .4); else mouth = 0;
        if (!s.cracked && t >= crackAt) {
          s.cracked = true; shell.visible = false; peeled.visible = true;
          snackRoot.getWorldPosition(egg3); rig.worldToLocal(egg3); burst(false, egg3);
        }
        const bites = [2.0, 3.4, 4.8];
        bites.forEach((at, i) => { const m = bump(t, at, .35, .45, .35); mouth = Math.max(mouth, m); if (t > at + .5) { peeled.scale.setScalar(1 - (i + 1) * .26); yolk.visible = true; } });
        if (t > bites[2] + .5) peeled.visible = false;
        // Open wide for each bite, then munch with happy eyes.
        const munching = bites.some(at => t > at + .4 && t < at + 1.25);
        face = mouth > .6 ? 'bite' : munching ? 'chew' : t < crackAt ? 'normal' : 'happy';
        end = 6.6;
      } else {
        if (s.style === 'oneshot') {
          mouth = s.hold ? 1 : 0; face = s.frozen ? 'dizzy' : s.hold ? 'sip' : 'happy';
          if (s.finished) { mouth = 0; face = s.frozen ? 'dizzy' : 'happy'; }
        } else {
          const sips = [1.0, 2.2, 3.4, 4.6];
          sips.forEach(at => { const m = bump(t, at, .3, .45, .25); mouth = Math.max(mouth, m); if (m > .9) s.level = Math.max(0, s.level - dt / (.45 * sips.length)); });
          face = mouth > .6 ? 'sip' : 'happy'; end = 6.4;
        }
        liquid.position.y = -.16 + .31 * s.level; liquid.visible = s.level > .02;
      }
      if (end && t >= end - .6 && !s.finished) { s.finished = true; snackRoot.getWorldPosition(egg3); rig.worldToLocal(egg3); burst(true, egg3.add(new THREE.Vector3(0, .25, 0))); }
      if (end && t >= end) { const done = s.onDone; character.snack = null; snackRoot.visible = false; done?.(true); return null; }
      if (chest) { snackRoot.position.copy(CHEST).lerp(MOUTH, mouth).lerp(BROW, brow); snackRoot.rotation.x = s.kind === 'drink' ? -mouth * .5 : 0; }
      return { mouth: Math.max(mouth, brow * 1.25), face, nod: brow };
    }
    function updateBursts(dt) {
      for (const b of bursts) {
        if (!b.piece.visible) continue;
        b.life -= dt; if (b.life <= 0) { b.piece.visible = false; continue; }
        b.velocity.y -= (b.sparkle ? 1.2 : 5) * dt; b.piece.position.addScaledVector(b.velocity, dt);
        b.piece.rotation.x += dt * 6; b.piece.rotation.y += dt * 5; b.piece.scale.setScalar(b.sparkle ? b.life : 1);
      }
    }

    const celebrateBurst = (origin = new THREE.Vector3(0, 1.2, .5)) => burst(true, origin);
    return { snackRoot, snackPose, updateBursts, bursts, burst, celebrateBurst, egg3 };
  }

  function createProcedural(colors = PALETTES.peach) {
    // Felted plush fabric: the shared terry map plus a soft sheen.
    const plush = color => new THREE.MeshPhysicalMaterial({ color, map: textile, roughness: 1, sheen: .35, sheenRoughness: .85, sheenColor: new THREE.Color('#ffffff') });
    const materials = { cloth: plush(colors[0]), trouser: plush(colors[1]), trim: mat(colors[2]), towel: baseTowel.clone(), seam: mat(colors[4], { roughness: 1 }) };
    // Sheen tinted by the dye keeps bright towels from washing out to beige.
    const dyeTowel = color => { materials.towel.color.set(color); materials.towel.sheenColor.set(color).offsetHSL(0, 0, .1); };
    dyeTowel(colors[3]);
    const { cloth, trim, trouser, towel, seam } = materials;
    const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
    latheBody(rig, cloth, [[0, 0], [.28, .008], [.35, .06], [.36, .16], [.335, .34], [.26, .48], [.16, .51], [0, .51]], [0, .57, 0], .9);
    const hem = mesh(new THREE.TorusGeometry(.326, .022, 10, 40), trim, rig, [0, .62, 0]); hem.rotation.x = Math.PI / 2; hem.scale.y = .84;
    cylinder(rig, skin, [0, 1.1, 0], .13, .14, .12);
    const collar = mesh(new THREE.TorusGeometry(.15, .024, 10, 36), trim, rig, [0, 1.075, 0]); collar.rotation.x = Math.PI / 2;
    steamEmblem(rig, trim, .294); steamEmblem(rig, trim, -.294, true);
    const legs = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(side * .18, .60, 0); rig.add(pivot); legs.push(pivot);
      latheBody(pivot, trouser, [[0, 0], [.15, 0], [.175, .05], [.17, .22], [0, .25]], [0, -.245, 0], .98);
      mesh(new THREE.CapsuleGeometry(.123, .13, 8, 20), skin, pivot, [0, -.355, 0]);
      ellipsoid(pivot, skin, [0, -.49, .065], [.14, .10, .18]);
    }
    const arms = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(side * .285, 1.005, 0); rig.add(pivot); arms.push(pivot);
      mesh(new THREE.CapsuleGeometry(.145, .095, 8, 24), cloth, pivot, [side * .055, -.09, 0]);
      mesh(new THREE.CapsuleGeometry(.103, .10, 8, 20), skin, pivot, [side * .09, -.255, .015]);
      ellipsoid(pivot, skin, [side * .09, -.365, .035], [.114, .12, .105]);
      ellipsoid(pivot, skin, [side * .025, -.34, .105], [.055, .065, .05]);
    }
    // An oversized head keeps the figure close to two heads tall.
    const head = new THREE.Group(); head.position.y = HEAD_Y; head.scale.setScalar(HEAD_SCALE); rig.add(head);
    mesh(headGeometry, skin, head);
    for (const side of [-1, 1]) ellipsoid(head, skin, [side * .60, -.115, .005], [.085, .1, .075]);
    // A round bob with soft bangs, visible whenever the towel cap is off.
    ellipsoid(head, hair, [0, .12, -.055], [.66, .47, .52]);
    ellipsoid(head, hair, [0, -.06, -.17], [.62, .4, .38]);
    // Bangs and the cowlick hide under the towel cap.
    const bangs = new THREE.Group(); head.add(bangs);
    ellipsoid(bangs, hair, [0, .2, .06], [.6, .32, .48]);
    for (const side of [-1, 1]) ellipsoid(head, hair, [side * .56, -.1, .06], [.11, .23, .22]);
    // Three soft, wide bang locks rather than a row of beads.
    for (const [x, tilt] of [[-.3, -.35], [0, 0], [.3, .35]]) {
      const lock = ellipsoid(bangs, hair, [x, .11 + Math.abs(x) * .12, .5 * Math.sqrt(1 - (x / .66) ** 2) - .02], [.21, .13, .06]);
      lock.rotation.set(-.25, -x * .9, tilt);
    }
    tube(bangs, hair, [[0, .56, .02], [.03, .66, .02], [.1, .7, .0], [.12, .64, -.02]], .022);
    const faceMaterial = new THREE.MeshStandardMaterial({ map: faces.normal, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const face = mesh(faceGeometry, faceMaterial, head); face.castShadow = false;
    const cap = new THREE.Group(); cap.scale.set(1.07, 1.08, 1.07); cap.position.y = .015; head.add(cap);
    buildCap(cap, towel, seam);
    const pillow = box(root, mat('#ebd7b8', { map: textile }), [0, .13, -.83], [1.12, .22, .72], .10); pillow.visible = false;
    const character0 = { snack: null };
    const { snackRoot, snackPose, updateBursts, bursts, burst, celebrateBurst } = attachSnacks(character0, rig, { chest: true });
    compact(head, [cap, bangs]); compact(cap); compact(bangs);
    compact(rig, [...legs, ...arms, head, snackRoot, ...bursts.map(b => b.piece)]);
    legs.forEach(leg => compact(leg));
    arms.forEach(arm => compact(arm));

    const character = Object.assign(character0, { root, rig, head, cap, arms, legs, faceMaterial, materials, pillow, snackRoot, elapsed: random() * 10, blinkOffset: random() * 4 });
    character.setColors = next => {
      materials.cloth.color.set(next[0]); materials.trouser.color.set(next[1]); materials.trim.color.set(next[2]);
      dyeTowel(next[3]); materials.seam.color.set(next[4]);
    };
    character.setTowel = on => { cap.visible = !!on; bangs.visible = !on; };
    // The built-in face has fewer expressions: close ones stand in.
    character.setExpression = expression => { const map = faces[expression] || faces[{ bite: 'chew', sip: 'chew', relax: 'sleep' }[expression]] || faces.normal; if (faceMaterial.map !== map) { faceMaterial.map = map; faceMaterial.needsUpdate = true; } };
    character.expression = () => Object.entries(faces).find(([, texture]) => texture === faceMaterial.map)?.[0];
    let cheer = 0;
    character.celebrate = () => { cheer = 1.6; celebrateBurst(); };
    // Shared pose animation for the player, NPCs and remote visitors. `action` is
    // the posture (stand, sit, lie, wave); a snack in progress layers on top of it.
    character.animate = (action, walking, dt, reducedMotion, speed = 1) => {
      const damp = (object, key, to, rate = 9) => { object[key] = THREE.MathUtils.damp(object[key], to, rate, dt); };
      character.elapsed += dt;
      if (action === 'egg' || action === 'drink') action = 'stand';
      const elapsed = character.elapsed, sleep = action === 'lie' || action === 'liewave',
        sitting = action === 'sit' || action === 'sitwave', greeting = ['wave','sitwave','liewave'].includes(action), cycle = elapsed * 9 * speed;
      const eating = sleep ? null : snackPose(dt);
      cheer = Math.max(0, cheer - dt); const cheering = cheer > 0 && !eating && !sleep;
      if (sleep && character.snack) character.stopSnack();
      updateBursts(dt);
      pillow.visible = sleep;
      damp(rig.rotation, 'x', sleep ? -Math.PI / 2 : eating ? eating.nod * .35 : 0, 6);
      damp(rig.position, 'y', (sleep ? .46 : sitting ? -.29 : walking && !reducedMotion ? Math.abs(Math.sin(cycle)) * .035 : 0) + (cheering && !reducedMotion ? Math.abs(Math.sin(cheer * 9)) * .12 : 0), cheering ? 18 : 9);
      // A reclining rig rests along the mat, with a pillow under its head.
      damp(rig.position, 'z', sleep ? .72 : 0, 6);
      for (let i = 0; i < 2; i++) {
        damp(legs[i].rotation, 'x', sitting ? -1.32 : sleep ? .45 : walking ? Math.sin(cycle + i * Math.PI) * .48 : 0);
        damp(legs[i].rotation, 'z', sitting ? (i === 0 ? -.25 : .25) : 0);
        const waving = greeting && i === 1;
        // Both hands cradle the snack and lift it to the mouth together.
        damp(arms[i].rotation, 'x', eating ? -1.3 - eating.mouth * .5 : cheering ? -2.7 : waving ? -2.35 : sitting ? -.5 : sleep ? -.18 : walking ? -Math.sin(cycle + i * Math.PI) * .35 : 0, eating ? 14 : 9);
        damp(arms[i].rotation, 'z', eating ? (i === 0 ? .5 : -.5) : waving ? -.4 + (reducedMotion ? 0 : Math.sin(elapsed * 7) * .24) : i === 0 ? -.14 : .14, eating ? 14 : 9);
      }
      if (!reducedMotion) { head.rotation.z = Math.sin(elapsed * 1.3) * .025; head.position.y = HEAD_Y + Math.sin(elapsed * 2) * .008 + (eating?.face === 'chew' ? Math.abs(Math.sin(elapsed * 14)) * .012 : 0); }
      else { head.rotation.z = 0; head.position.y = HEAD_Y; }
      const blink = !reducedMotion && (elapsed + character.blinkOffset) % 4.7 > 4.52;
      character.setExpression((sleep && !greeting) || (blink && !eating) ? 'sleep' : eating ? eating.face : greeting || cheering ? 'happy' : 'normal');
    };
    return character;
  }
  // ---------- Plush model characters ----------
  // Expression patches drawn over the baked eyes and mouth, on a patch of the model's own
  // face colour that fades out at the rim. Eyes: closed (sleep), relaxed (gently closed),
  // happy (^ ^), dizzy (spirals). Mouths: open smile, munching ω, sipping o, big bite O, wavy.
  const INK = '#3a2620', LIP = '#7a3a34', TONGUE = '#f08f8f';
  const eyeTexture = (kind, skin) => canvasTexture((c, w, h) => {
    c.strokeStyle = INK; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath();
    if (kind === 'sleep') { c.moveTo(w * .26, h * .48); c.quadraticCurveTo(w / 2, h * .7, w * .74, h * .48); }
    else if (kind === 'relax') { c.lineWidth = 8; c.moveTo(w * .27, h * .54); c.quadraticCurveTo(w / 2, h * .64, w * .73, h * .54); }
    else if (kind === 'happy') { c.moveTo(w * .26, h * .62); c.quadraticCurveTo(w / 2, h * .28, w * .74, h * .62); }
    else { c.lineWidth = 6; for (let a = 0; a < 12; a += .3) c.lineTo(w / 2 + Math.cos(a) * a * 2.6, h / 2 + Math.sin(a) * a * 2.6); }
    c.stroke();
  }, 128, 128);
  const mouthTexture = (kind, skin) => canvasTexture((c, w, h) => {
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = LIP; c.fillStyle = LIP; c.lineWidth = 7;
    if (kind === 'open') {
      // A wide open smile with a little tongue.
      c.beginPath(); c.moveTo(w * .3, h * .42); c.quadraticCurveTo(w / 2, h * .48, w * .7, h * .42); c.quadraticCurveTo(w * .66, h * .76, w / 2, h * .76); c.quadraticCurveTo(w * .34, h * .76, w * .3, h * .42); c.fill();
      c.fillStyle = TONGUE; c.beginPath(); c.ellipse(w / 2, h * .66, w * .1, h * .07, 0, 0, Math.PI * 2); c.fill();
    } else if (kind === 'chew') {
      // ω: cheeks full, munching.
      c.beginPath(); c.moveTo(w * .3, h * .46); c.quadraticCurveTo(w * .4, h * .66, w / 2, h * .5); c.quadraticCurveTo(w * .6, h * .66, w * .7, h * .46); c.stroke();
    } else if (kind === 'sip') {
      // Small pursed o around the straw.
      c.beginPath(); c.ellipse(w / 2, h * .52, w * .07, h * .08, 0, 0, Math.PI * 2); c.lineWidth = 6; c.stroke();
    } else if (kind === 'bite') {
      c.beginPath(); c.ellipse(w / 2, h * .54, w * .13, h * .15, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = TONGUE; c.beginPath(); c.ellipse(w / 2, h * .62, w * .08, h * .05, 0, 0, Math.PI * 2); c.fill();
    } else {
      c.beginPath(); c.lineWidth = 6; for (let i = 0; i <= 16; i++) { const x = w * (.28 + .44 * i / 16), y = h * (.52 + Math.sin(i / 16 * Math.PI * 3) * .06); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    }
  }, 128, 128);
  // Expression → [eyes, mouth] patches (null = the baked feature shows).
  const FACES = {
    normal: [null, null], sleep: ['sleep', null], relax: ['relax', null], happy: ['happy', 'open'],
    chew: ['happy', 'chew'], bite: [null, 'bite'], sip: ['relax', 'sip'], dizzy: ['dizzy', 'wavy']
  };
  const faceSets = new Map();
  const faceSet = skin => {
    if (!faceSets.has(skin)) {
      const eyesT = Object.fromEntries(['sleep', 'relax', 'happy', 'dizzy'].map(k => [k, prepareFaceTexture(eyeTexture(k, skin))]));
      const mouthsT = Object.fromEntries(['open', 'chew', 'sip', 'bite', 'wavy'].map(k => [k, prepareFaceTexture(mouthTexture(k, skin))]));
      faceSets.set(skin, { eyes: eyesT, mouths: mouthsT });
    }
    return faceSets.get(skin);
  };
  const blankTexture = new THREE.DataTexture(new Uint8Array(4), 1, 1); blankTexture.needsUpdate = true;
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion(), e1 = new THREE.Euler();
  // Turn `bone` so that its world rotation gains `worldDelta`.
  function rotateBoneWorld(bone, worldDelta) {
    bone.parent.getWorldQuaternion(q2); bone.getWorldQuaternion(q3);
    bone.quaternion.copy(q2.invert().multiply(worldDelta.clone().multiply(q3))); bone.updateMatrixWorld(true);
  }
  // One posable body built from a GLB: skeleton, dyed material, face patches, anchors, clips.
  function makeBody(gltf, profile, frame, uniforms) {
    const model = cloneSkinned(gltf.scene); model.scale.setScalar(MODEL_SCALE); frame.add(model);
    let skinned = null; model.traverse(o => { if (o.isSkinnedMesh) skinned = o; });
    skinned.castShadow = false; skinned.receiveShadow = false; skinned.frustumCulled = false; // see setCastShadow
    const bone = name => model.getObjectByName('mixamorig' + name);
    const headBone = bone('Head'), neck = bone('Neck'), spine2 = bone('Spine2'), spine1 = bone('Spine1');
    const upperArms = [bone('LeftArm'), bone('RightArm')], foreArms = [bone('LeftForeArm'), bone('RightForeArm')], hands = [bone('LeftHand'), bone('RightHand')], upLegs = [bone('LeftUpLeg'), bone('RightUpLeg')], feet = [bone('LeftFoot'), bone('RightFoot')];
    const rest = new Map([headBone, neck, spine2, spine1, ...upperArms, ...upLegs].map(b => [b, b.quaternion.clone()]));
    // Every bone's bind pose: restored before each frame so pose tweaks never accumulate.
    const bindPose = skinned.skeleton.bones.map(b => [b, b.quaternion.clone(), b.position.clone()]);
    // Fabric dye: low-saturation light texels take the outfit colour (top/bottom split at HEM);
    // above `hat` the white terry is the sheep towel and takes the towel colour.
    // Sharp on phones: full mipmaps (from the loader) plus anisotropic filtering at grazing angles.
    const map = skinned.material.map; if (map && map.anisotropy < 8) { map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); map.needsUpdate = true; }
    const material = new THREE.MeshPhysicalMaterial({ map, roughness: 1, metalness: 0, sheen: .3, sheenRoughness: .9, sheenColor: new THREE.Color('#fff3ea') });
    const skinLinear = new THREE.Color(profile.skin).toArray().map(v => v.toFixed(4)).join(', ');
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
#define CLOTH_TOP ${CLOTH_TOP.toFixed(3)}
#define HEM ${HEM.toFixed(3)}
#define HAT ${profile.hat.toFixed(3)}
#define EYE vec3(${profile.eyes.x.toFixed(3)}, ${profile.eyes.y.toFixed(3)}, ${(profile.eyes.z - .02).toFixed(3)})
#define MOUTH vec3(${profile.mouth.x.toFixed(3)}, ${(profile.mouth.y - .012).toFixed(3)}, ${(profile.mouth.z - .02).toFixed(3)})
#define BAKED_MOUTH vec3(${profile.mouth.x.toFixed(3)}, ${profile.mouth.y.toFixed(3)}, ${profile.mouth.z.toFixed(3)})
varying vec3 vRest;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uTowel;
#define SKIN vec3(${skinLinear})
uniform sampler2D uEyeTex;
uniform sampler2D uMouthTex;
uniform float uEyeOn;
uniform float uMouthOn;
// Expression decals are painted on the face itself (same surface, same light): the bind-pose
// position is projected onto a small square facing out from the face at each feature.
// Replace complete baked features, including their rim and highlights. Matching
// geometry has been softened offline so expressions share the actual face surface.
vec3 hideFeature(vec3 c, vec3 centre, float turn, vec2 radius) {
  vec3 d = vRest - centre; vec3 n = vec3(sin(turn), 0., cos(turn)), t = vec3(cos(turn), 0., -sin(turn));
  float r = length(vec2(dot(d, t), d.y) / radius);
  if (abs(dot(d, n)) > .12) return c;
  return mix(c, SKIN, 1. - smoothstep(.72, 1., r));
}
// Cover the complete baked eye (including its white highlight and dark rim).
// Thresholding only dark texels left a crescent and a shiny dot under closed eyes.
vec3 hideEye(vec3 c, vec3 centre, float turn) {
  vec3 d = vRest - centre;
  vec3 n = vec3(sin(turn), 0., cos(turn)), t = vec3(cos(turn), 0., -sin(turn));
  vec2 q = vec2(dot(d, t), d.y) / vec2(.083, .079);
  float radius = length(q);
  if (abs(dot(d, n)) > .12) return c;
  return mix(c, SKIN, 1. - smoothstep(.72, 1., radius));
}
vec4 faceDecal(sampler2D tex, vec3 centre, float turn, vec2 size) {
  vec3 d = vRest - centre; vec3 n = vec3(sin(turn), 0., cos(turn)), t = vec3(cos(turn), 0., -sin(turn));
  vec2 uv = vec2(dot(d, t), d.y) / size + .5;
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1. || abs(dot(d, n)) > .09) return vec4(0.);
  return texture2D(tex, uv);
}`).replace('#include <map_fragment>', `#include <map_fragment>
        float vRestY = vRest.y;
        if (uEyeOn > .5) {
          diffuseColor.rgb = hideEye(diffuseColor.rgb, EYE, .4);
          diffuseColor.rgb = hideEye(diffuseColor.rgb, EYE * vec3(-1., 1., 1.), -.4);
          vec4 e = faceDecal(uEyeTex, EYE, .4, vec2(.13));
          vec4 e2 = faceDecal(uEyeTex, EYE * vec3(-1., 1., 1.), -.4, vec2(.13));
          diffuseColor.rgb = mix(diffuseColor.rgb, e.rgb, e.a); diffuseColor.rgb = mix(diffuseColor.rgb, e2.rgb, e2.a);
        }
        if (uMouthOn > .5) { diffuseColor.rgb = hideFeature(diffuseColor.rgb, BAKED_MOUTH, 0., vec2(.078, .055)); vec4 m = faceDecal(uMouthTex, MOUTH, 0., vec2(.15, .12)); diffuseColor.rgb = mix(diffuseColor.rgb, m.rgb, m.a); }
        {
          vec3 c = diffuseColor.rgb; float hi = max(c.r, max(c.g, c.b)), lo = min(c.r, min(c.g, c.b));
          float lum = dot(c, vec3(.2126, .7152, .0722));
          // Cloth is everything light that is not skin (skin is clearly warmer: red well above blue);
          // that also takes the cloth's baked grey-blue folds, which used to stay white in patches.
          float warm = (c.r - c.b) / max(c.r, .001);
          float white = (1. - smoothstep(.1, .17, warm)) * (1. - smoothstep(.2, .3, (hi - lo) / max(hi, .001)) * step(.0, warm)) * smoothstep(.12, .3, lum);
          float cloth = white * (1. - smoothstep(CLOTH_TOP - .03, CLOTH_TOP + .01, vRestY));
          float hat = white * smoothstep(HAT - .02, HAT + .02, vRestY);
          vec3 tint = mix(uBottom, uTop, smoothstep(HEM - .012, HEM + .012, vRestY));
          // Soft, even felt: the baked folds shade the dye only gently (no ragged blotches).
          diffuseColor.rgb = mix(c, tint * clamp(mix(.95, lum / .72, .25), .6, 1.05), cloth);
          diffuseColor.rgb = mix(diffuseColor.rgb, uTowel * clamp(lum / .78, .4, 1.08), hat);
        }`);
    };
    material.customProgramCacheKey = () => 'plush-dye-v9-' + profile.hat;
    skinned.material = material;
    setupCharacterMaterials(model, renderer);
    // Rigid things follow a bone; they are placed in the bind pose, in model units.
    function attach(boneObject, object, point) {
      model.updateMatrixWorld(true);
      const p = model.localToWorld(point.clone()); boneObject.worldToLocal(p); object.position.copy(p);
      boneObject.getWorldQuaternion(q2); model.getWorldQuaternion(q3); object.quaternion.copy(q2.invert().multiply(q3));
      boneObject.getWorldScale(v1); model.getWorldScale(v2); object.scale.multiplyScalar(v2.x / v1.x);
      boneObject.add(object); return object;
    }
    const faces = faceSet(profile.skin);
    const setFace = name => {
      const [eye, lips] = FACES[name] || FACES.normal;
      uniforms.uEyeOn.value = eye ? 1 : 0; if (eye) uniforms.uEyeTex.value = faces.eyes[eye];
      uniforms.uMouthOn.value = lips ? 1 : 0; if (lips) uniforms.uMouthTex.value = faces.mouths[lips];
    };
    const headAnchor = attach(headBone, new THREE.Object3D(), new THREE.Vector3(0, HEAD_ANCHOR_Y, 0));
    // Reach targets that move with the pose: just in front of the mouth, and in front of the chest.
    const mouthTarget = attach(headBone, new THREE.Object3D(), new THREE.Vector3(profile.mouth.x - .04, profile.mouth.y - .04, profile.mouth.z + .2));
    const chestTarget = attach(spine2, new THREE.Object3D(), new THREE.Vector3(-.12, .6, .5));
    const headBall = attach(headBone, new THREE.Object3D(), new THREE.Vector3(0, HEAD_BALL.y, HEAD_BALL.z));
    model.updateMatrixWorld(true); hands[1].getWorldPosition(v3); model.worldToLocal(v3);
    const hold = attach(hands[1], new THREE.Object3D(), v3.add(v2.set(0, .02, .07)));
    const mixer = new THREE.AnimationMixer(model), actions = {}, weights = {};
    for (const name of Object.values(CLIPS)) { const a = mixer.clipAction(gltf.animations.find(c => c.name === name)); a.play(); a.setEffectiveWeight(0); a.enabled = false; actions[name] = a; weights[name] = 0; }
    return { model, skinned, material, profile, headBone, neck, spine1, spine2, upperArms, foreArms, hands, upLegs, feet, rest, bindPose, setFace, headAnchor, mouthTarget, chestTarget, headBall, hold, mixer, actions, weights,
      dispose() { material.dispose(); mixer.stopAllAction(); mixer.uncacheRoot(model); frame.remove(model); } };
  }
  function createPlush(colors = PALETTES.peach) {
    // `frame` holds the model; the actor scale (.62) and MODEL_SCALE make it a 1.35 m plush.
    const root = new THREE.Group(), rig = new THREE.Group(), body = new THREE.Group(), frame = new THREE.Group();
    frame.scale.setScalar(PLUSH_SCALE); root.add(rig); rig.add(body); body.add(frame);
    const uniforms = { uTop: { value: new THREE.Color(colors[0]) }, uBottom: { value: new THREE.Color(colors[1]) }, uTowel: { value: new THREE.Color(colors[3]) }, uEyeTex: { value: blankTexture }, uMouthTex: { value: blankTexture }, uEyeOn: { value: 0 }, uMouthOn: { value: 0 } };
    // Each body is built the first time it is needed (most residents only ever wear the cap).
    const bodies = { plain: null, cap: null };
    // Only the player casts a real shadow (skinned shadows are costly on phones); everyone
    // else stands on the soft contact shadow the scene puts under them.
    let castShadow = false;
    const build = (gltf, profile) => { const b = makeBody(gltf, profile, frame, uniforms); b.skinned.castShadow = castShadow; return b; };
    const bodyFor = on => on ? bodies.cap ||= build(plushModel.userData.capModel, PROFILES.cap) : bodies.plain ||= build(plushModel, PROFILES.plain);
    const startCap = !!plushModel.userData.capModel;
    let active = bodyFor(startCap), wearing = startCap;
    const character = { snack: null };
    const snacks = attachSnacks(character, rig);
    const { snackRoot, snackPose, updateBursts, celebrateBurst } = snacks;
    // A hand bone on the imported Mixamo rig can pivot behind the shoulder while
    // drinking. The cup now has its own chest-to-mouth anchor, still reached by
    // the right hand but never carried behind the model's shoulder.
    snackRoot.scale.setScalar(.7); body.add(snackRoot);
    // Kept for callers that look for a cap or pillow; the cap is part of the sheep body now.
    const cap = new THREE.Group(), pillow = new THREE.Group(); pillow.position.set(0, 0, PILLOW_FIT.z); pillow.visible = false; frame.add(pillow);
    const armProxy = () => ({ rotation: { x: 0, y: 0, z: 0 } });
    const arms = [armProxy(), armProxy()], legs = [armProxy(), armProxy()];
    Object.assign(character, { root, rig, cap, arms, legs, materials: { cloth: active.material }, pillow, snackRoot, elapsed: random() * 10, blinkOffset: random() * 4 });
    Object.defineProperty(character, 'head', { get: () => active.headAnchor });
    Object.defineProperty(character, 'mixer', { get: () => active.mixer });
    character.setColors = next => { uniforms.uTop.value.set(next[0]); uniforms.uBottom.value.set(next[1]); uniforms.uTowel.value.set(next[3]); };
    character.setShoulder = () => {};
    character.setCastShadow = on => { castShadow = !!on; for (const b of Object.values(bodies)) if (b) b.skinned.castShadow = castShadow; };
    let expression = 'normal';
    character.setTowel = on => {
      on = !!on && !!plushModel.userData.capModel;
      if (on === wearing) return; wearing = on;
      const next = bodyFor(on);
      // The new body takes over the current clip mix so the swap does not pop.
      for (const name of Object.values(CLIPS)) { next.weights[name] = active.weights[name]; next.actions[name].time = active.actions[name].time; }
      active.model.visible = false; next.model.visible = true; active = next;
      character.materials.cloth = active.material;
      const shown = expression; expression = ''; character.setExpression(shown);
    };
    character.setExpression = next => { if (next === expression) return; expression = next; active.setFace(next); };
    character.expression = () => expression;
    let cheer = 0;
    character.celebrate = () => { cheer = 1.6; celebrateBurst(); };
    character.dispose = () => { bodies.plain?.dispose(); bodies.cap?.dispose(); };
    const forward = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3(), reachPoint = new THREE.Vector3();
    // Body axes in world space (the actor may be turned): forward, up, and the character's right.
    function axes() { root.getWorldQuaternion(q1); forward.set(0, 0, 1).applyQuaternion(q1); up.set(0, 1, 0).applyQuaternion(q1); side.set(-1, 0, 0).applyQuaternion(q1); }
    // The sit clip bows the head; straighten it so the face stays visible.
    function liftHead(b, amount) { if (amount > 0) for (const x of [b.spine1, b.spine2, b.neck, b.headBone]) x.quaternion.slerp(b.rest.get(x), amount); }
    // No idle clip: the bind pose with the arms lowered a little and a slow breath.
    function lowerArms(b, amount) {
      if (amount <= 0) return;
      b.model.updateMatrixWorld(true);
      rotateBoneWorld(b.upperArms[0], q1.setFromAxisAngle(forward, -.4 * amount));
      rotateBoneWorld(b.upperArms[1], q1.setFromAxisAngle(forward, .4 * amount));
    }
    // Point arm `i` (shoulder → hand) at a world point by `amount`, then fold the forearm
    // in by `bend` (around the body's up axis, towards the centre line).
    function reach(b, i, point, amount, bend = 0) {
      if (amount <= 0) return;
      b.model.updateMatrixWorld(true);
      b.upperArms[i].getWorldPosition(v3); b.hands[i].getWorldPosition(v1);
      const from = v1.sub(v3).normalize(), to = v4.copy(point).sub(v3).normalize();
      rotateBoneWorld(b.upperArms[i], q1.setFromUnitVectors(from, to).slerp(q2.identity(), 1 - amount));
      if (bend) rotateBoneWorld(b.foreArms[i], q1.setFromAxisAngle(up, (i ? -1 : 1) * bend * amount));
    }
    // A point beside the head, out to the character's side `s` (-1 left, 1 right), given in
    // the body frame (out, height above the shoulder, forward) relative to that shoulder.
    function besideHead(b, i, out, high, fwd) {
      b.upperArms[i].getWorldPosition(reachPoint);
      const k = MODEL_SCALE * PLUSH_SCALE * root.getWorldScale(v2).x;
      return reachPoint.addScaledVector(side, (i ? 1 : -1) * out * k).addScaledVector(up, high * k).addScaledVector(forward, fwd * k);
    }
    // Keep both hands (and forearms) outside the ball around the big head.
    function handsOffHead(b) {
      b.model.updateMatrixWorld(true);
      b.headBall.getWorldPosition(v4); const radius = HEAD_BALL.r * MODEL_SCALE * PLUSH_SCALE * root.getWorldScale(v2).x;
      for (let i = 0; i < 2; i++) for (const tip of [b.hands[i], b.foreArms[i]]) {
        tip.getWorldPosition(v1); const d = v1.distanceTo(v4); if (d >= radius || d < 1e-5) continue;
        b.upperArms[i].getWorldPosition(v3);
        const from = v1.clone().sub(v3).normalize(), to = v4.clone().addScaledVector(v1.clone().sub(v4).normalize(), radius).sub(v3).normalize();
        rotateBoneWorld(b.upperArms[i], q1.setFromUnitVectors(from, to)); b.model.updateMatrixWorld(true);
      }
    }
    // Seated: both legs swing forward from the hips (a little apart), feet resting on the floor.
    function seatLegs(b, amount) {
      if (amount <= 0) return;
      for (let i = 0; i < 2; i++) {
        b.model.updateMatrixWorld(true);
        b.upLegs[i].getWorldPosition(v3); b.feet[i].getWorldPosition(v1);
        const from = v1.sub(v3).normalize(), to = v4.copy(forward).multiplyScalar(.97).addScaledVector(up, -.12).addScaledVector(side, (i ? 1 : -1) * .2).normalize();
        rotateBoneWorld(b.upLegs[i], q1.setFromUnitVectors(from, to).slerp(q2.identity(), 1 - amount));
      }
    }
    let lie = 0, wave = 0, sat = 0, seat = 0;
    const proxy = (b, target, x) => { q1.copy(b.rest.get(x)).invert().multiply(x.quaternion); e1.setFromQuaternion(q1); target.rotation.x = e1.x; target.rotation.y = e1.y; target.rotation.z = e1.z; };
    character.animate = (action, walking, dt, reducedMotion, speed = 1) => {
      character.elapsed += dt;
      if (action === 'egg' || action === 'drink') action = 'stand';
      const b = active, elapsed = character.elapsed,
        greeting = action === 'wave' || action === 'sitwave' || action === 'liewave',
        sleep = action === 'lie' || action === 'liewave', sitting = action === 'sit' || action === 'sitwave';
      const eating = sleep ? null : snackPose(dt);
      cheer = Math.max(0, cheer - dt); const cheering = cheer > 0 && !eating && !sleep;
      if (sleep && character.snack) character.stopSnack();
      updateBursts(dt);
      lie = THREE.MathUtils.damp(lie, sleep ? 1 : 0, 7, dt);
      sat = sitting ? sat + dt : 0;
      const waving = !eating && !walking && greeting;
      wave = THREE.MathUtils.damp(wave, waving ? 1 : 0, 10, dt);
      pillow.visible = lie > .5;
      // Standing cheer uses the Cheer clip; a seated cheer and a wave are posed below.
      seat = THREE.MathUtils.damp(seat, sitting && !sleep ? 1 : 0, 9, dt);
      const goal = sleep || sitting ? null : walking ? (speed >= 1.8 ? CLIPS.run : CLIPS.walk) : cheering ? CLIPS.cheer : null;
      let total = 0, lift = 0;
      for (const name of Object.values(CLIPS)) {
        const w = b.weights[name] = THREE.MathUtils.damp(b.weights[name], name === goal ? 1 : 0, 9, dt);
        const a = b.actions[name]; a.enabled = w > .002; a.setEffectiveWeight(w); total += w; lift += w * b.profile.lift[name];
      }
      b.actions[CLIPS.walk].timeScale = Math.max(.6, speed * .95); b.actions[CLIPS.run].timeScale = 1;
      for (const [x, q, p] of b.bindPose) { x.quaternion.copy(q); x.position.copy(p); }
      b.mixer.update(dt);
      b.model.updateMatrixWorld(true); axes();
      lowerArms(b, Math.max(0, 1 - total));
      seatLegs(b, seat);
      // Eating: the right hand holds the snack in front of the chest and lifts it to the mouth.
      if (eating) {
        const m = Math.min(1, eating.mouth);
        b.chestTarget.getWorldPosition(v1); b.mouthTarget.getWorldPosition(v2);
        reach(b, 1, reachPoint.lerpVectors(v1, v2, m), 1, .45 + .55 * m);
      }
      // Wave: the right arm out beside the head (not over it: the arms are short for the
      // big head), the forearm swinging.
      if (wave > .01 && !reducedMotion) {
        const swing = Math.sin(elapsed * 11) * .5;
        reach(b, 1, besideHead(b, 1, .62, .24, .16), wave);
        rotateBoneWorld(b.foreArms[1], q1.setFromAxisAngle(forward, (-.7 + swing) * wave));
      } else if (wave > .01) reach(b, 1, besideHead(b, 1, .62, .2, .16), wave);
      // Seated cheer: both hands go up beside the head twice, then come down.
      if (cheering && sitting && !reducedMotion) {
        const t = (1.6 - cheer) / 1.6, upAmount = Math.sin(Math.PI * Math.min(1, t * 1.15)) * (.75 + .25 * Math.abs(Math.sin(t * Math.PI * 4)));
        reach(b, 0, besideHead(b, 0, .5, .48, .1), upAmount); reach(b, 1, besideHead(b, 1, .5, .48, .1), upAmount);
      }
      handsOffHead(b);
      // Lying on the back, head towards -z: the whole body turns over at the feet and
      // slides so the hips stay over the spot; the big head rests on the floor.
      const unit = MODEL_SCALE * PLUSH_SCALE;
      body.rotation.x = -Math.PI / 2 * lie;
      body.position.z = b.profile.hipY * unit * lie;
      body.position.y = (lift * (1 - lie) - (b.profile.hipY - SEAT_Y) * seat * (1 - lie) + LIE_LIFT * lie) * unit;
      const breath = reducedMotion ? 0 : Math.sin(elapsed * 2) * .008 * Math.max(0, 1 - total);
      body.scale.set(1 - breath * .5, 1 + breath, 1 - breath * .5);
      if (eating) {
        // Convert skinned bone targets into the rigid body coordinate system.
        // Anchoring the cup here instead of to Mixamo's hand prevents the
        // shoulder-strapped cup effect across both outfits and standing/sitting.
        body.updateMatrixWorld(true);
        b.chestTarget.getWorldPosition(v1); body.worldToLocal(v1);
        b.mouthTarget.getWorldPosition(v2); body.worldToLocal(v2);
        snackRoot.position.copy(v1).lerp(v2, Math.min(1, eating.mouth));
        snackRoot.position.x -= .07;
        snackRoot.position.y -= .085;
        snackRoot.rotation.x = character.snack?.kind === 'drink' ? -Math.min(1, eating.mouth) * .55 : 0;
      }
      rig.position.y = THREE.MathUtils.damp(rig.position.y, cheering && !sitting && !reducedMotion ? Math.abs(Math.sin(cheer * 9)) * .12 : 0, 18, dt);
      proxy(b, arms[0], b.upperArms[0]); proxy(b, arms[1], b.upperArms[1]); proxy(b, legs[0], b.upLegs[0]); proxy(b, legs[1], b.upLegs[1]);
      const blink = !reducedMotion && (elapsed + character.blinkOffset) % 4.7 > 4.52;
      // Seated (after a moment) the face settles into a relaxed, eyes-closed smile.
      const face = sleep && !waving ? 'sleep' : eating ? eating.face : waving || cheering ? 'happy' : sitting && sat > 1.5 ? 'relax' : blink ? 'sleep' : 'normal';
      character.setExpression(face);
    };
    character.setExpression('normal');
    // Every plush starts wearing its cap (residents keep it); the scene sets the player's own state.
    character.setTowel(true);
    return character;
  }
  const createCharacter = plushModel ? createPlush : createProcedural;
  return { createCharacter, faces, textile, canvasTexture, plush: !!plushModel };
}
