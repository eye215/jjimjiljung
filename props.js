import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/three-addons/GLTFLoader.js';

// Meshy towel props: the sheep cap, the shoulder towel, a rolled pillow, a flat
// mat and a folded towel. Each GLB is white terry baked into a texture, so a
// colour multiplied over it keeps the cloth's own shading. Files load once;
// every placed towel gets its own material so recolouring one never touches another.
const ROOT = new URL('./assets/', import.meta.url).href;
export const TOWEL_FILES = {
  cap: 'meshy-model-mobile.glb',
  hair: 'hair-mobile.glb',
  shoulder: 'towels/shoulder-towel-mobile4.glb',
  pillow: 'towels/pillow-towel-mobile.glb',
  mat: 'towels/mat-towel-mobile.glb',
  folded: 'towels/folded-towel-mobile.glb'
};
// Default towel colours (아이보리, 분홍, 하늘, 연보라, 민트, 노랑) for decor and future pickers.
export const TOWEL_COLORS = Object.freeze({ ivory: '#f6efe2', pink: '#f6b9c9', sky: '#a8d3f1', lilac: '#cdb9ec', mint: '#a8e1cf', yellow: '#f6dc8b' });

const loads = new Map();
// → { geometry, map, size: Vector3 (model units), min: Vector3 } or null when unavailable.
export function loadTowelProp(kind) {
  if (!loads.has(kind)) {
    loads.set(kind, new GLTFLoader().loadAsync(ROOT + TOWEL_FILES[kind]).then(gltf => {
      let mesh = null; gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      if (!mesh) return null;
      const geometry = mesh.geometry; geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      return { geometry, map: mesh.material.map, size: box.getSize(new THREE.Vector3()), min: box.min.clone() };
    }).catch(error => { console.warn(`Towel prop ${kind} unavailable`, error); return null; }));
  }
  return loads.get(kind);
}
export const loadTowelProps = kinds => Promise.all(kinds.map(loadTowelProp)).then(list => Object.fromEntries(kinds.map((k, i) => [k, list[i]])));

// A fresh terry material: texture × colour, a soft sheen tinted by the dye.
export function towelMaterial(proto, color = TOWEL_COLORS.ivory) {
  // The baked terry is light gray, so the dye is lifted a little to read true.
  const material = new THREE.MeshPhysicalMaterial({ map: proto.map, roughness: 1, metalness: 0, side: THREE.DoubleSide, sheen: .45, sheenRoughness: .8 });
  material.userData.setTowelColor = next => { material.color.set(next).multiplyScalar(1.18); material.sheenColor.set(next).offsetHSL(0, 0, .1); };
  material.userData.setTowelColor(color);
  return material;
}
export const setTowelColor = (mesh, color) => mesh.material.userData.setTowelColor?.(color);

// A towel mesh scaled so its longest side spans `length` metres, resting on y = 0
// (or centred when `centred`), with its own material.
export function towelMesh(proto, { length, color, centred = false, shadow = true } = {}) {
  const mesh = new THREE.Mesh(proto.geometry, towelMaterial(proto, color));
  const scale = length / Math.max(proto.size.x, proto.size.z);
  const inner = new THREE.Group(); inner.add(mesh); mesh.scale.setScalar(scale);
  if (!centred) mesh.position.y = -proto.min.y * scale;
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  inner.userData.mesh = mesh;
  return inner;
}

// Room decor: one instanced draw call per towel kind, each towel with its own
// colour (instance colours multiply the white terry like a per-towel dye).
const ORDER = Object.values(TOWEL_COLORS);
export async function placeTowelDecor(scene, decor) {
  const kinds = Object.keys(decor), protos = await loadTowelProps(kinds), placed = {};
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3(), color = new THREE.Color();
  for (const kind of kinds) {
    const proto = protos[kind], items = decor[kind]; if (!proto || !items.length) continue;
    const material = towelMaterial(proto, '#ffffff'); material.color.set('#ffffff');
    const mesh = new THREE.InstancedMesh(proto.geometry, material, items.length);
    items.forEach((item, i) => {
      const scale = item.size / Math.max(proto.size.x, proto.size.z);
      matrix.compose(p.set(item.x, item.y - proto.min.y * scale, item.z), q.setFromAxisAngle(up, item.turn || 0), s.setScalar(scale));
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(typeof item.color === 'number' ? ORDER[item.color % ORDER.length] : item.color).multiplyScalar(1.18));
    });
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere();
    scene.add(mesh); placed[kind] = mesh;
  }
  return placed;
}
// Recolour one decor towel without touching the others.
export function setDecorColor(mesh, index, color) { mesh.setColorAt(index, new THREE.Color(color).multiplyScalar(1.18)); mesh.instanceColor.needsUpdate = true; }
