import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/three-addons/GLTFLoader.js';
import { clone as cloneSkinned } from './vendor/three-addons/SkeletonUtils.js';
import { towelMesh, setTowelColor } from './props.js?v=rpg-22';

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

// ---------- The plush model (Meshy GLB, Mixamo skeleton, six clips) ----------
export const PLUSH_URL = new URL('./assets/chibi-mobile.glb', import.meta.url).href;
export const CLIPS = { walk: 'Walking', run: 'Running', sit: 'Sit_Cross_Legged_on_Floor', drink: 'Sit_and_Drink', lie: 'Sleep_Normally', wave: 'Wave_One_Hand' };
// Measured lowest skin point of each clip (model metres): lift by this so
// crossed legs and the sleeper rest on the floor instead of sinking into it.
const CLIP_LIFT = { Walking: .013, Running: .005, Sit_Cross_Legged_on_Floor: .108, Sit_and_Drink: .023, Sleep_Normally: .268, Wave_One_Hand: .015 };
// The scene scales every actor by .62; this makes the plush 1.35 m tall in the room.
const PLUSH_SCALE = 1 / .62;
// Towel prop fits on the plush (model metres): sheep cap on the head, shoulder
// towel around the neck, pillow under the sleeping head. Tuned in design QA.
const HAIR_FIT = { length: .82, y: .99, z: .0, capWide: 1, capDeep: .86, capTall: .76 };
// Height option C (-20%), bottom edge kept: tall 1.24 → .992 and lowered by half the difference.
const CAP_FIT = { length: 1.22, y: 1.022, z: .01, tall: .992 };
const SHOULDER_FIT = { length: .44, y: .45, z: .02, depth: 1.45 };
const PILLOW_FIT = { length: .56, z: -.6 };
// Load once; on any failure the room falls back to the procedural character.
export async function loadPlushModel(url = PLUSH_URL) {
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    let skinned = null; gltf.scene.traverse(o => { if (o.isSkinnedMesh) skinned = o; });
    if (!skinned || !Object.values(CLIPS).every(name => gltf.animations.some(c => c.name === name))) throw new Error('Unexpected plush model');
    // Clips walk in place: drop horizontal hip drift but keep each pose's offset.
    for (const clip of gltf.animations) for (const track of clip.tracks) {
      if (!/Hips\.position$/.test(track.name)) continue;
      const v = track.values, x0 = v[0], z0 = v[2];
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
    }
    return gltf;
  } catch (error) { console.warn('Plush model unavailable, using the built-in character.', error); return null; }
}

// `towels` holds Meshy prop prototypes from props.js (cap, shoulder, pillow).
// A short, gender-neutral cut: the bob's side and back panels (dark hair texels
// below the brow line) are drawn in towards the skull and lifted to ear level.
// Done once on the shared bind-pose geometry, so every clone gets it.
const HAIR = { center: [0, .92, -.02], brow: .86, back: .2, ear: .66, hug: .34 };
function trimHair(skinned) {
  const geometry = skinned.geometry, pos = geometry.attributes.position, uv = geometry.attributes.uv, image = skinned.material.map?.image;
  if (!image || !uv) return;
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const [cx, cy, cz] = HAIR.center;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // The back of the head is trimmed from higher up, tapering into the nape.
    const brow = HAIR.brow + Math.max(0, Math.min(1, (-z + .05) / .3)) * HAIR.back;
    if (y > brow || y < .45) continue;
    const u = Math.min(c.width - 1, Math.floor(uv.getX(i) * c.width)), v = Math.min(c.height - 1, Math.floor(uv.getY(i) * c.height));
    const k = (v * c.width + u) * 4, r = px[k], g = px[k + 1], b = px[k + 2];
    // Everything but skin (peach), cloth (light gray) and the eyes on the face front is hair.
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
    const backOfHead = z < -.08 && y > .64;
    if (!backOfHead && ((r > 150 && r - b > 30 && r >= g) || (hi > 165 && hi - lo < 40) || (z > .22 && Math.abs(x) < .22))) continue;
    const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
    const back = Math.max(0, Math.min(1, (-z + .05) / .3));
    const ear = HAIR.ear + back * .08, hug = HAIR.hug - back * .08;
    const t = Math.min(1, (brow - y) / (brow - ear));
    // Pull in towards a skull-hugging radius and lift the ends up to the ears (nape at the back).
    const target = Math.min(d, hug + (d - hug) * (1 - t) * .5);
    if (d > 1e-4) { x = cx + dx / d * target; z = cz + dz / d * target; }
    y = Math.max(y, ear - .04 + (y - .45) * .2);
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true; geometry.computeBoundingBox(); geometry.computeBoundingSphere();
}

// With the separate short-hair GLB, the baked bob is instead folded flat onto a
// skull-shaped ellipsoid so the new hair can sit over it without anything poking out.
// Sized just inside the short-hair GLB so the folded bob barely stretches (less tearing by the ears).
const HAIR_EDGE = .74;
const SKULL = { center: [0, .93, -.02], radii: [.37, .38, .34] };
function hairTexels(skinned) {
  const image = skinned.material.map?.image; if (!image) return null;
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
  const px = ctx.getImageData(0, 0, c.width, c.height).data, uv = skinned.geometry.attributes.uv;
  return i => { const u = Math.min(c.width - 1, Math.floor(uv.getX(i) * c.width)), v = Math.min(c.height - 1, Math.floor(uv.getY(i) * c.height)), k = (v * c.width + u) * 4; return [px[k], px[k + 1], px[k + 2]]; };
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
// The ♨ logo on the top is light-gray ink baked into the texture: paint it over with the
// surrounding cloth, only inside the chest triangles' UV area.
function hideLogo(skinned) {
  const g = skinned.geometry, pos = g.attributes.position, uv = g.attributes.uv, index = g.index;
  return (px, w, h) => {
    const mask = new Uint8Array(w * h);
    for (let t = 0; t < index.count; t += 3) {
      const ids = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
      if (!ids.every(i => pos.getY(i) > .36 && pos.getY(i) < .6 && Math.abs(pos.getZ(i)) > .08)) continue;
      const us = ids.map(i => uv.getX(i) * w), vs = ids.map(i => uv.getY(i) * h);
      for (let y = Math.floor(Math.min(...vs)); y <= Math.ceil(Math.max(...vs)); y++) for (let x = Math.floor(Math.min(...us)); x <= Math.ceil(Math.max(...us)); x++) if (x >= 0 && y >= 0 && x < w && y < h) mask[y * w + x] = 1;
    }
    // Ink: low-saturation mid grays. Fill it from neighbouring light cloth, growing inwards.
    const ink = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (!mask[i]) continue; const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2], hi = Math.max(r, gg, b), lo = Math.min(r, gg, b);
      if (hi - lo < 30 && hi > 70 && hi < 205) ink[i] = 1;
    }
    // Take the ink's soft anti-aliased rim too.
    for (let grow = 0; grow < 2; grow++) {
      const edge = []; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (!ink[i] && mask[i] && (ink[i - 1] || ink[i + 1] || ink[i - w] || ink[i + w])) edge.push(i); }
      for (const i of edge) ink[i] = 1;
    }
    for (let round = 0; round < 160; round++) {
      let left = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x; if (!ink[i]) continue;
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (const j of [i - 1, i + 1, i - w, i + w]) if (!ink[j] && mask[j]) { sr += px[j * 4]; sg += px[j * 4 + 1]; sb += px[j * 4 + 2]; n++; }
        if (n) { px[i * 4] = sr / n; px[i * 4 + 1] = sg / n; px[i * 4 + 2] = sb / n; ink[i] = 2; } else left++;
      }
      for (let i = 0; i < ink.length; i++) if (ink[i] === 2) ink[i] = 0;
      if (!left) break;
    }
  };
}
// Smooth skin weights on the clothes (bind height .12–.66 m) over welded neighbours, so
// shirt hems and shorts bend in soft curves instead of creasing like rubber when walking.
function smoothClothWeights(skinned, texel, passes = 4) {
  const g = skinned.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, index = g.index;
  const n = pos.count, key = i => `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(pos.getZ(i) * 2000)}`;
  const weld = new Int32Array(n), ids = new Map();
  for (let i = 0; i < n; i++) { const k = key(i); if (!ids.has(k)) ids.set(k, ids.size); weld[i] = ids.get(k); }
  const m = ids.size, neighbours = Array.from({ length: m }, () => new Set());
  for (let t = 0; t < index.count; t += 3) { const a = weld[index.getX(t)], b = weld[index.getX(t + 1)], c = weld[index.getX(t + 2)]; neighbours[a].add(b).add(c); neighbours[b].add(a).add(c); neighbours[c].add(a).add(b); }
  let weights = Array.from({ length: m }, () => new Map()); const cloth = new Uint8Array(m);
  for (let i = 0; i < n; i++) {
    const w = weld[i]; if (weights[w].size) continue;
    for (let k = 0; k < 4; k++) { const v = sw.getComponent(i, k); if (v > 0) weights[w].set(si.getComponent(i, k), (weights[w].get(si.getComponent(i, k)) || 0) + v); }
    const y = pos.getY(i), [r, gg, b] = texel(i), hi = Math.max(r, gg, b), lo = Math.min(r, gg, b);
    if (y > .12 && y < .66 && hi - lo < 40 && hi > 110) cloth[w] = 1;
  }
  for (let pass = 0; pass < passes; pass++) {
    const next = weights.map((own, w) => {
      if (!cloth[w]) return own;
      const sum = new Map(own); for (const [b, v] of own) sum.set(b, v);
      for (const nb of neighbours[w]) for (const [b, v] of weights[nb]) sum.set(b, (sum.get(b) || 0) + v * .6);
      return sum;
    });
    weights = next;
  }
  for (let i = 0; i < n; i++) {
    const w = weld[i]; if (!cloth[w]) continue;
    const top = [...weights[w]].sort((a, b) => b[1] - a[1]).slice(0, 4), total = top.reduce((s, [, v]) => s + v, 0) || 1;
    for (let k = 0; k < 4; k++) { si.setComponent(i, k, top[k]?.[0] ?? 0); sw.setComponent(i, k, (top[k]?.[1] ?? 0) / total); }
  }
  si.needsUpdate = sw.needsUpdate = true;
}
function tuckHair(skinned) {
  const texel = hairTexels(skinned); if (!texel) return;
  const pos = skinned.geometry.attributes.position, [cx, cy, cz] = SKULL.center, [rx, ry, rz] = SKULL.radii;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y < .5) continue;
    const [r, g, b] = texel(i), hi = Math.max(r, g, b), lo = Math.min(r, g, b);
    // Skin (peach), cloth (light gray) and the eyes on the face front stay as they are.
    if ((r > 150 && r - b > 30 && r >= g) || (hi > 165 && hi - lo < 40) || (z > .22 && Math.abs(x) < .22 && y < .86)) continue;
    // The bob's ends below the new hair's edge are drawn up under it first.
    const ly = y < HAIR_EDGE ? HAIR_EDGE + (y - .5) * .12 : y;
    const dx = x - cx, dy = ly - cy, dz = z - cz, k = Math.max(1, Math.hypot(dx / rx, dy / ry, dz / rz));
    if (k > 1 || ly !== y) pos.setXYZ(i, cx + dx / k, cy + dy / k, cz + dz / k);
  }
  pos.needsUpdate = true;
}

export function createCharacterKit(renderer, plushModel = null, towels = {}) {
  // Shared plush geometry is edited once: short-hair GLB → tuck the bob; otherwise trim it.
  if (plushModel && !plushModel.userData.hairDone) {
    let skinned = null; plushModel.scene.traverse(o => { if (o.isSkinnedMesh) skinned = o; });
    // With the short-hair GLB the bob is hidden in the shader (see `uHideHair`); otherwise it is trimmed.
    if (!towels.hair) trimHair(skinned);
    const texel = hairTexels(skinned); if (texel) smoothClothWeights(skinned, texel);
    // Softer, cleaner plush surface and no ♨ on the top.
    // Strong edge-aware smoothing clears Meshy's baked blotches; eyes, mouth and cheeks keep their edges.
    skinned.material.map = smoothTexture(skinned.material.map, hideLogo(skinned), 34, 6, skinned.geometry);
    weldNormals(skinned.geometry);
    skinned.geometry.computeBoundingBox(); skinned.geometry.computeBoundingSphere(); plushModel.userData.hairDone = true;
  }
  // Calmer terry and hair: soften the baked fuzz on the worn props too (once each).
  for (const proto of [towels.cap, towels.hair, towels.pillow]) if (proto && !proto.smoothed) { proto.map = smoothTexture(proto.map, null, 30, 2, proto.geometry); proto.smoothed = true; }
  if (towels.hair && !towels.hair.welded) { weldNormals(towels.hair.geometry); towels.hair.welded = true; }
  const hairMaterial = towels.hair ? new THREE.MeshPhysicalMaterial({ map: towels.hair.map, roughness: .85, metalness: 0, side: THREE.DoubleSide, sheen: .5, sheenRoughness: .6, sheenColor: new THREE.Color('#a07a62') }) : null;
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
        face = mouth > .6 ? 'chew' : t < crackAt ? 'normal' : 'happy';
        end = 6.6;
      } else {
        if (s.style === 'oneshot') {
          mouth = s.hold ? 1 : 0; face = s.frozen ? 'dizzy' : s.hold ? 'chew' : 'happy';
          if (s.finished) { mouth = 0; face = s.frozen ? 'dizzy' : 'happy'; }
        } else {
          const sips = [1.0, 2.2, 3.4, 4.6];
          sips.forEach(at => { const m = bump(t, at, .3, .45, .25); mouth = Math.max(mouth, m); if (m > .9) s.level = Math.max(0, s.level - dt / (.45 * sips.length)); });
          face = mouth > .6 ? 'chew' : 'happy'; end = 6.4;
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
    character.setExpression = expression => { if (faceMaterial.map !== faces[expression]) { faceMaterial.map = faces[expression]; faceMaterial.needsUpdate = true; } };
    character.expression = () => Object.entries(faces).find(([, texture]) => texture === faceMaterial.map)?.[0];
    let cheer = 0;
    character.celebrate = () => { cheer = 1.6; celebrateBurst(); };
    // Shared pose animation for the player, NPCs and remote visitors. `action` is
    // the posture (stand, sit, lie, wave); a snack in progress layers on top of it.
    character.animate = (action, walking, dt, reducedMotion, speed = 1) => {
      const damp = (object, key, to, rate = 9) => { object[key] = THREE.MathUtils.damp(object[key], to, rate, dt); };
      character.elapsed += dt;
      if (action === 'egg' || action === 'drink') action = 'stand';
      const elapsed = character.elapsed, sleep = action === 'lie', sitting = action === 'sit', cycle = elapsed * 9 * speed;
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
        const waving = action === 'wave' && i === 1;
        // Both hands cradle the snack and lift it to the mouth together.
        damp(arms[i].rotation, 'x', eating ? -1.3 - eating.mouth * .5 : cheering ? -2.7 : waving ? -2.35 : sitting ? -.5 : sleep ? -.18 : walking ? -Math.sin(cycle + i * Math.PI) * .35 : 0, eating ? 14 : 9);
        damp(arms[i].rotation, 'z', eating ? (i === 0 ? .5 : -.5) : waving ? -.4 + (reducedMotion ? 0 : Math.sin(elapsed * 7) * .24) : i === 0 ? -.14 : .14, eating ? 14 : 9);
      }
      if (!reducedMotion) { head.rotation.z = Math.sin(elapsed * 1.3) * .025; head.position.y = HEAD_Y + Math.sin(elapsed * 2) * .008 + (eating?.face === 'chew' ? Math.abs(Math.sin(elapsed * 14)) * .012 : 0); }
      else { head.rotation.z = 0; head.position.y = HEAD_Y; }
      const blink = !reducedMotion && (elapsed + character.blinkOffset) % 4.7 > 4.52;
      character.setExpression(sleep || (blink && !eating) ? 'sleep' : eating ? eating.face : action === 'wave' || cheering ? 'happy' : 'normal');
    };
    return character;
  }
  // ---------- Plush model characters ----------
  // Closed, happy and dizzy eyes drawn over the baked eyes on a skin-coloured patch.
  const eyeTexture = kind => canvasTexture((c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2); g.addColorStop(0, '#f9dccb'); g.addColorStop(.7, '#f9dccb'); g.addColorStop(1, 'rgba(249,220,203,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#3a2820'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath();
    if (kind === 'sleep') { c.moveTo(w * .28, h * .48); c.quadraticCurveTo(w / 2, h * .72, w * .72, h * .48); }
    else if (kind === 'happy') { c.moveTo(w * .28, h * .6); c.quadraticCurveTo(w / 2, h * .3, w * .72, h * .6); }
    else { c.lineWidth = 6; for (let a = 0; a < 12; a += .3) c.lineTo(w / 2 + Math.cos(a) * a * 2.6, h / 2 + Math.sin(a) * a * 2.6); }
    c.stroke();
  }, 128, 128);
  const eyeTextures = { sleep: eyeTexture('sleep'), happy: eyeTexture('happy'), dizzy: eyeTexture('dizzy') };
  const eyeGeometry = new THREE.PlaneGeometry(15, 15);
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion(), e1 = new THREE.Euler();
  // Turn `bone` so that its world rotation gains `worldDelta`.
  function rotateBoneWorld(bone, worldDelta) {
    bone.parent.getWorldQuaternion(q2); bone.getWorldQuaternion(q3);
    bone.quaternion.copy(q2.invert().multiply(worldDelta.clone().multiply(q3))); bone.updateMatrixWorld(true);
  }
  function createPlush(colors = PALETTES.peach) {
    // `frame` is in model metres; the actor scale (.62) turns it into a 1.35 m plush.
    const model = cloneSkinned(plushModel.scene);
    const root = new THREE.Group(), rig = new THREE.Group(), body = new THREE.Group(), frame = new THREE.Group();
    frame.scale.setScalar(PLUSH_SCALE); root.add(rig); rig.add(body); body.add(frame); frame.add(model);
    let skinned = null; model.traverse(o => { if (o.isSkinnedMesh) skinned = o; });
    skinned.castShadow = true; skinned.receiveShadow = false; skinned.frustumCulled = false;
    const bone = name => model.getObjectByName('mixamorig' + name);
    const headBone = bone('Head'), neck = bone('Neck'), spine2 = bone('Spine2'), spine1 = bone('Spine1');
    const upperArms = [bone('LeftArm'), bone('RightArm')], hands = [bone('LeftHand'), bone('RightHand')], upLegs = [bone('LeftUpLeg'), bone('RightUpLeg')];
    const rest = new Map([headBone, neck, spine2, spine1, ...upperArms, ...upLegs].map(b => [b, b.quaternion.clone()]));
    // Every bone's bind pose: restored before each frame so pose tweaks never accumulate
    // (with no clip playing, the mixer leaves the bones untouched).
    const bindPose = skinned.skeleton.bones.map(b => [b, b.quaternion.clone(), b.position.clone()]);
    // Fabric dye: low-saturation light texels (the white 찜질복 and its gray logo)
    // take the outfit colour; the top/bottom split is the bind-pose hem height.
    const base = skinned.material;
    const uniforms = { uTop: { value: new THREE.Color(colors[0]) }, uBottom: { value: new THREE.Color(colors[1]) }, uHideHair: { value: towels.hair ? 1 : 0 } };
    const material = new THREE.MeshPhysicalMaterial({ map: base.map, roughness: 1, metalness: 0, side: towels.hair ? THREE.DoubleSide : THREE.FrontSide, sheen: .3, sheenRoughness: .9, sheenColor: new THREE.Color('#fff3ea') });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vRestY;\nvarying vec3 vRest;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRestY = position.y; vRest = position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vRestY;\nvarying vec3 vRest;\nuniform vec3 uTop;\nuniform vec3 uBottom;\nuniform float uHideHair;').replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb; float hi = max(c.r, max(c.g, c.b)), lo = min(c.r, min(c.g, c.b));
          // The baked bob gives way to the short-hair GLB: dark hair texels on the head are not drawn
          // (the eyes on the face front stay). The material is double-sided then, so the skin's
          // inner side closes the nape where the bob used to be the only surface.
          bool face = vRest.z > .2 && abs(vRest.x) < .24 && vRest.y < .88;
          if (uHideHair > .5 && vRest.y > .5 && hi < .2 && !face) discard;
          float lum = dot(c, vec3(.2126, .7152, .0722));
          float cloth = (1. - smoothstep(.07, .16, (hi - lo) / max(hi, .001))) * smoothstep(.12, .3, lum) * (1. - smoothstep(.64, .68, vRestY));
          vec3 tint = mix(uBottom, uTop, smoothstep(.31, .335, vRestY));
          diffuseColor.rgb = mix(c, tint * clamp(lum / .7, .35, 1.12), cloth);
        }`);
    };
    material.customProgramCacheKey = () => 'plush-dye-v2';
    skinned.material = material;
    // Sheep cap on the head bone (head-bone units are centimetres).
    const towel = baseTowel.clone(), seam = mat(colors[4], { roughness: 1 });
    const dyeTowel = color => { towel.color.set(color); towel.sheenColor.set(color).offsetHSL(0, 0, .1); };
    dyeTowel(colors[3]);
    // Rigid props follow a bone. They are placed in the bind pose, in model metres.
    function attach(boneObject, object, point) {
      model.updateMatrixWorld(true);
      const p = model.localToWorld(point.clone()); boneObject.worldToLocal(p); object.position.copy(p);
      boneObject.getWorldQuaternion(q2); model.getWorldQuaternion(q3); object.quaternion.copy(q2.invert().multiply(q3));
      boneObject.getWorldScale(v1); model.getWorldScale(v2); object.scale.multiplyScalar(v2.x / v1.x);
      boneObject.add(object); return object;
    }
    // Short hair from its own GLB, following the head bone.
    let hairMesh = null;
    if (towels.hair) {
      hairMesh = new THREE.Group(); const m = new THREE.Mesh(towels.hair.geometry, hairMaterial);
      m.scale.setScalar(HAIR_FIT.length / Math.max(towels.hair.size.x, towels.hair.size.z)); m.castShadow = true; hairMesh.add(m);
      attach(headBone, hairMesh, new THREE.Vector3(0, HAIR_FIT.y, HAIR_FIT.z)); hairMesh.userData.scale = hairMesh.scale.x;
    }
    let cap;
    if (towels.cap) {
      const capMesh = towelMesh(towels.cap, { length: CAP_FIT.length, color: colors[3], centred: true });
      capMesh.scale.y = CAP_FIT.tall; // a taller dome keeps the cowlick tucked in
      cap = attach(headBone, capMesh, new THREE.Vector3(0, CAP_FIT.y, CAP_FIT.z));
    } else {
      // Built-in cap fitted over the plush hair.
      const capHolder = new THREE.Group(); capHolder.position.set(0, 31, 0); capHolder.scale.setScalar(62); headBone.add(capHolder);
      cap = new THREE.Group(); cap.scale.set(1.07, 1.08, 1.07); cap.position.y = .015; capHolder.add(cap);
      buildCap(cap, towel, seam); compact(cap);
    }
    cap.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    // 어깨 수건, worn over the shoulders and following the upper spine.
    const shoulderMesh = towels.shoulder ? towelMesh(towels.shoulder, { length: SHOULDER_FIT.length, color: '#f6efe2', centred: true }) : null;
    // Deeper than the GLB's proportions so it drapes over the chubby chest instead of cutting into it.
    shoulderMesh?.scale.set(1, 1, SHOULDER_FIT.depth);
    const shoulder = shoulderMesh ? attach(spine2, shoulderMesh, new THREE.Vector3(0, SHOULDER_FIT.y, SHOULDER_FIT.z)) : null;
    if (shoulder) shoulder.visible = false;
    // A rolled towel pillow under the sleeping head, only when a pillow prop is passed in (the room does not, by choice).
    const pillow = towels.pillow ? towelMesh(towels.pillow, { length: PILLOW_FIT.length, color: colors[3] }) : new THREE.Group();
    pillow.position.set(0, -CLIP_LIFT.Sleep_Normally, PILLOW_FIT.z); pillow.visible = false; frame.add(pillow);
    // Expression patches over the baked eyes.
    const eyes = [-1, 1].map(side => {
      const m = new THREE.Mesh(eyeGeometry, new THREE.MeshStandardMaterial({ map: eyeTextures.sleep, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      m.position.set(side * 14.3, 17.8, 33.4); m.rotation.y = side * .38; m.visible = false; m.renderOrder = 2; headBone.add(m); return m;
    });
    const headAnchor = new THREE.Object3D(); headAnchor.position.set(0, 25, 0); headBone.add(headAnchor);
    const character = { snack: null };
    const snacks = attachSnacks(character, rig);
    const { snackRoot, snackPose, updateBursts, celebrateBurst } = snacks;
    // Props sit in the right palm; hand-bone units are centimetres.
    snackRoot.position.set(-2, 6, 6); snackRoot.scale.setScalar(55); hands[1].add(snackRoot);
    // Animation: one action per clip, cross-faded by hand-tuned weights.
    const mixer = new THREE.AnimationMixer(model);
    const actions = {}, weights = {};
    for (const name of Object.values(CLIPS)) { const a = mixer.clipAction(plushModel.animations.find(c => c.name === name)); a.play(); a.setEffectiveWeight(0); a.enabled = false; actions[name] = a; weights[name] = 0; }
    actions[CLIPS.drink].paused = true;
    const armProxy = () => ({ rotation: { x: 0, y: 0, z: 0 } });
    const arms = [armProxy(), armProxy()], legs = [armProxy(), armProxy()];
    Object.assign(character, { root, rig, head: headAnchor, cap, arms, legs, materials: { towel, seam, cloth: material }, pillow, snackRoot, elapsed: random() * 10, blinkOffset: random() * 4, mixer });
    let expression = 'normal';
    const recolor = (object, color) => object.traverse(o => { if (o.isMesh) setTowelColor(o, color); });
    character.setColors = next => {
      uniforms.uTop.value.set(next[0]); uniforms.uBottom.value.set(next[1]); dyeTowel(next[3]); seam.color.set(next[4]);
      recolor(cap, next[3]); recolor(pillow, next[3]);
    };
    character.setShoulder = (on, color) => { if (!shoulder) return; shoulder.visible = !!on; if (color) recolor(shoulder, color); };
    // Under the sheep cap the hair is drawn in a little so none of it pokes through.
    // Under the sheep cap the hair is pressed down (bottom edge kept) so the crown stays inside the cap.
    character.setTowel = on => {
      cap.visible = !!on; if (!hairMesh) return;
      const m = hairMesh.children[0], base = HAIR_FIT.length / Math.max(towels.hair.size.x, towels.hair.size.z), height = towels.hair.size.y * base;
      m.scale.set(base * (on ? HAIR_FIT.capWide : 1), base * (on ? HAIR_FIT.capTall : 1), base * (on ? HAIR_FIT.capDeep : 1));
      m.position.y = on ? -height * (1 - HAIR_FIT.capTall) / 2 : 0;
    };
    character.setExpression = next => {
      if (next === expression) return; expression = next;
      const texture = eyeTextures[next === 'chew' ? 'happy' : next];
      for (const eye of eyes) { eye.visible = !!texture; if (texture && eye.material.map !== texture) { eye.material.map = texture; eye.material.needsUpdate = true; } }
    };
    character.expression = () => expression;
    let cheer = 0;
    character.celebrate = () => { cheer = 1.6; celebrateBurst(); };
    character.dispose = () => {
      material.dispose(); towel.dispose(); seam.dispose(); eyes.forEach(eye => eye.material.dispose());
      // GLB prop geometry is shared by every character; the built-in cap's is not.
      const shared = new Set(Object.values(towels).filter(Boolean).map(t => t.geometry));
      for (const group of [cap, shoulder, pillow]) group?.traverse(o => { if (o.isMesh) { if (o.material !== towel && o.material !== seam) o.material.dispose(); if (!shared.has(o.geometry)) o.geometry.dispose(); } });
      mixer.stopAllAction(); mixer.uncacheRoot(model);
    };
    const center = new THREE.Vector3(), headScale = new THREE.Vector3(), forward = new THREE.Vector3();
    // Keep each hand outside a sphere around the face and hair (hands would
    // otherwise pass through the oversized plush cheeks in some clips).
    function handsOffFace() {
      headBone.getWorldScale(headScale); const radius = 40 * headScale.x;
      headBone.localToWorld(center.set(0, 24, 4));
      for (let i = 0; i < 2; i++) {
        hands[i].getWorldPosition(v1); v2.subVectors(v1, center); const d = v2.length();
        if (d >= radius || d < 1e-5) continue;
        upperArms[i].getWorldPosition(v3);
        const from = v1.clone().sub(v3).normalize(), to = center.clone().addScaledVector(v2.normalize(), radius).sub(v3).normalize();
        rotateBoneWorld(upperArms[i], q1.setFromUnitVectors(from, to));
      }
    }
    // Sitting clips bow the head a lot; straighten it so the face stays visible.
    function liftHead(amount) {
      if (amount <= 0) return;
      for (const b of [spine1, spine2, neck, headBone]) b.quaternion.slerp(rest.get(b), amount);
    }
    // No idle clip: the bind pose with arms lowered a little and a slow breath.
    function lowerArms(amount) {
      if (amount <= 0) return;
      root.getWorldQuaternion(q1); forward.set(0, 0, 1).applyQuaternion(q1);
      model.updateMatrixWorld(true);
      rotateBoneWorld(upperArms[0], q1.setFromAxisAngle(forward, -.55 * amount));
      rotateBoneWorld(upperArms[1], q1.setFromAxisAngle(forward, .55 * amount));
    }
    const proxy = (target, b) => { q1.copy(rest.get(b)).invert().multiply(b.quaternion); e1.setFromQuaternion(q1); target.rotation.x = e1.x; target.rotation.y = e1.y; target.rotation.z = e1.z; };
    character.animate = (action, walking, dt, reducedMotion, speed = 1) => {
      character.elapsed += dt;
      if (action === 'egg' || action === 'drink') action = 'stand';
      const elapsed = character.elapsed, sleep = action === 'lie', sitting = action === 'sit';
      const eating = sleep ? null : snackPose(dt);
      cheer = Math.max(0, cheer - dt); const cheering = cheer > 0 && !eating && !sleep;
      if (sleep && character.snack) character.stopSnack();
      updateBursts(dt);
      pillow.visible = sleep && weights[CLIPS.lie] > .5;
      const goal = sleep ? CLIPS.lie : eating ? CLIPS.drink : sitting ? (character.sitStyle === 'cross' ? CLIPS.sit : CLIPS.drink) : walking ? (speed >= 1.8 ? CLIPS.run : CLIPS.walk) : action === 'wave' || cheering ? CLIPS.wave : null;
      let total = 0, lift = 0;
      for (const name of Object.values(CLIPS)) {
        const w = weights[name] = THREE.MathUtils.damp(weights[name], name === goal ? 1 : 0, 9, dt);
        const a = actions[name]; a.enabled = w > .002; a.setEffectiveWeight(w); total += w; lift += w * CLIP_LIFT[name];
      }
      actions[CLIPS.walk].timeScale = Math.max(.6, speed * .95); actions[CLIPS.run].timeScale = 1;
      // The drink clip is scrubbed: rest (3 s) → hand at the mouth (5 s).
      if (eating) actions[CLIPS.drink].time = 3 + 2 * Math.min(1, eating.mouth);
      // A relaxed seat (legs out, hands in the lap) is the drink clip at rest;
      // the cross-legged clip hugs the knees, so it is kept for 불가마 and 소금방.
      else actions[CLIPS.drink].time = .3;
      for (const [b, q, p] of bindPose) { b.quaternion.copy(q); b.position.copy(p); }
      mixer.update(dt);
      liftHead(.85 * (weights[CLIPS.sit] + weights[CLIPS.drink]));
      model.updateMatrixWorld(true);
      lowerArms(Math.max(0, 1 - total));
      model.updateMatrixWorld(true);
      handsOffFace();
      body.position.y = lift * PLUSH_SCALE;
      const breath = reducedMotion ? 0 : Math.sin(elapsed * 2) * .008 * Math.max(0, 1 - total);
      body.scale.set(1 - breath * .5, 1 + breath, 1 - breath * .5);
      rig.position.y = THREE.MathUtils.damp(rig.position.y, cheering && !reducedMotion ? Math.abs(Math.sin(cheer * 9)) * .12 : 0, 18, dt);
      proxy(arms[0], upperArms[0]); proxy(arms[1], upperArms[1]); proxy(legs[0], upLegs[0]); proxy(legs[1], upLegs[1]);
      const blink = !reducedMotion && (elapsed + character.blinkOffset) % 4.7 > 4.52;
      character.setExpression(sleep || (blink && !eating) ? 'sleep' : eating ? eating.face : action === 'wave' || cheering ? 'happy' : 'normal');
    };
    character.setExpression('normal'); eyes.forEach(eye => { eye.visible = false; });
    return character;
  }
  const createCharacter = plushModel ? createPlush : createProcedural;
  return { createCharacter, faces, textile, canvasTexture, plush: !!plushModel };
}
