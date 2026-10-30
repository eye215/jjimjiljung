import * as THREE from './vendor/three.module.min.js';

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
let randomSeed = 137;
export function random() { randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0; return randomSeed / 4294967296; }

export function createCharacterKit(renderer) {
  function canvasTexture(draw, width = 512, height = 512) {
    const c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d'), width, height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t;
  }
  const textile = canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#f3ead5'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 17000; i++) { const v = random(); ctx.strokeStyle = v > .5 ? '#ffffff65' : '#b8a48630'; const x = random() * w, y = random() * h; ctx.beginPath(); ctx.ellipse(x, y, 1.1, 2.1, .5, 0, Math.PI * 2); ctx.stroke(); }
  }, 256, 256);
  textile.wrapS = textile.wrapT = THREE.RepeatWrapping; textile.repeat.set(3, 2);
  const skin = mat('#f3c49b', { roughness: .92 });
  const hair = mat('#493024', { roughness: 1 });
  const baseTowel = new THREE.MeshPhysicalMaterial({ color: '#fff2db', map: textile, bumpMap: textile, bumpScale: .045, roughness: 1, sheen: 1, sheenRoughness: .9, sheenColor: new THREE.Color('#fff8ef') });
  function faceTexture(expression) {
    return canvasTexture((c, w, h) => {
      const ellipse = (x, y, rx, ry, color) => { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
      // Small, quiet features leave the round cheeks and towel as the focal point.
      for (const x of [102, 410]) { const g = c.createRadialGradient(x, 327, 0, x, 327, 48); g.addColorStop(0, 'rgba(234,147,113,.3)'); g.addColorStop(1, 'rgba(234,147,113,0)'); c.fillStyle = g; c.fillRect(x - 50, 277, 100, 100); }
      c.lineCap = 'round'; c.lineWidth = 8; c.strokeStyle = '#4e3428';
      for (const x of [151, 361]) {
        if (expression === 'sleep' || expression === 'happy') { c.beginPath(); c.moveTo(x - 17, 318); c.quadraticCurveTo(x, expression === 'sleep' ? 328 : 301, x + 17, 318); c.stroke(); }
        else ellipse(x, 318, 16, 26, '#493326');
      }
      c.strokeStyle = '#ba7956'; c.lineWidth = 6; c.beginPath();
      if (expression === 'sleep') { c.ellipse(256, 390, 6, 8, 0, 0, Math.PI * 2); c.stroke(); }
      else { c.moveTo(244, 382); c.quadraticCurveTo(256, expression === 'happy' ? 404 : 396, 268, 382); c.stroke(); }
    }, 512, 512);
  }
  const faces = { normal: faceTexture('normal'), sleep: faceTexture('sleep'), happy: faceTexture('happy') };
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

  function createCharacter(colors = PALETTES.peach) {
    const materials = { cloth: mat(colors[0], { roughness: 1 }), trouser: mat(colors[1], { roughness: 1 }), trim: mat(colors[2]), towel: baseTowel.clone(), seam: mat(colors[4], { roughness: 1 }) };
    materials.towel.color.set(colors[3]);
    const { cloth, trim, trouser, towel, seam } = materials;
    const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
    latheBody(rig, cloth, [[0, 0], [.28, .008], [.35, .06], [.36, .16], [.335, .34], [.26, .48], [.16, .51], [0, .51]], [0, .57, 0], .84);
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
    const head = new THREE.Group(); head.position.y = 1.55; rig.add(head);
    mesh(headGeometry, skin, head);
    for (const side of [-1, 1]) ellipsoid(head, skin, [side * .60, -.115, .005], [.085, .1, .075]);
    ellipsoid(head, hair, [0, .12, -.055], [.632, .45, .49]);
    // A thin scalloped hairline is mostly tucked under the towel.
    for (let i = 0; i < 7; i++) {
      const x = -.43 + i * .143, z = .49 * Math.sqrt(1 - (x / .66) ** 2);
      ellipsoid(head, hair, [x, .025, z], [.087, .074, .038]);
    }
    const faceMaterial = new THREE.MeshStandardMaterial({ map: faces.normal, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const face = mesh(faceGeometry, faceMaterial, head); face.castShadow = false;
    mesh(capGeometry, towel, head, [0, .19, -.015]);
    // Rounded lower hem follows the full circumference, including the back view.
    tube(head, towel, edgePoints, .036);
    // Two overlapping folds give the cap the wrapped silhouette of a real towel.
    for (const offset of [0, .115]) {
      const fold = [];
      for (let i = 0; i <= 40; i++) {
        const x = -.65 + i / 40 * 1.3, y = .15 + offset + (x + .65) * .10;
        const z = .605 * Math.sqrt(Math.max(.02, 1 - (x / .715) ** 2 - ((y - .19) / .64) ** 2)) - .015;
        fold.push([x, y, z + .012]);
      }
      tube(head, towel, fold, .017);
    }
    // Subtle stitched arcs follow the cap's curved surface, like folded terrycloth.
    const crownSeam = []; for (let i = 0; i <= 36; i++) { const t = i / 36 * 1.68; crownSeam.push([.1 * Math.sin(t), .19 + .646 * Math.cos(t), .609 * Math.sin(t) - .015]); }
    tube(head, seam, crownSeam, .006);
    for (const side of [-1, 1]) {
      const roll = new THREE.Group(); roll.position.set(side * .675, .13, .025); roll.rotation.z = -side * .10; head.add(roll);
      ellipsoid(roll, towel, [0, 0, 0], [.235, .285, .285]);
      // Soft overlapping folds, not a hard, high-contrast cinnamon-roll spiral.
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const petal = ellipsoid(roll, towel, [Math.cos(a) * .065, Math.sin(a) * .10, .205], [.13, .16, .065]); petal.rotation.z = a - Math.PI / 2; }
      ellipsoid(roll, towel, [0, 0, .254], [.09, .105, .05]);
      const crease = []; for (let i = 0; i <= 35; i++) { const a = i / 35 * Math.PI * 2.2, r = .035 + .13 * i / 35; crease.push([Math.cos(a) * r, Math.sin(a) * r * 1.13, .264 - .035 * i / 35]); }
      tube(roll, seam, crease, .006);
    }
    // Props for resting and snacks.
    const pillow = box(root, mat('#ebd7b8', { map: textile }), [0, .13, -.83], [1.12, .22, .72], .10); pillow.visible = false;
    const snack = new THREE.Group(); arms[1].add(snack); snack.position.set(.09, -.365, .12);
    ellipsoid(snack, mat('#d8a36d'), [0, 0, 0], [.105, .14, .10]);
    ellipsoid(snack, mat('#fff3d4'), [0, .065, .022], [.093, .085, .09]);
    const drink = new THREE.Group(); arms[1].add(drink); drink.position.set(.09, -.35, .13);
    drink.rotation.x = 2.0;
    cylinder(drink, mat('#dfc09b'), [0, 0, 0], .12, .09, .24);
    cylinder(drink, mat('#f9ebce'), [0, .125, 0], .13, .13, .025);
    box(drink, mat('#b98961'), [0, 0, .112], [.075, .08, .008], .003);
    tube(drink, mat('#f7eee0'), [[.035, .14, 0], [.035, .30, 0], [-.025, .34, 0]], .013);
    snack.visible = drink.visible = false;
    compact(head);
    compact(rig, [...legs, ...arms, head]);
    legs.forEach(leg => compact(leg));
    arms.forEach(arm => compact(arm, [snack, drink]));

    const character = { root, rig, head, arms, legs, faceMaterial, materials, pillow, snack, drink, elapsed: random() * 10, blinkOffset: random() * 4 };
    character.setColors = next => {
      materials.cloth.color.set(next[0]); materials.trouser.color.set(next[1]); materials.trim.color.set(next[2]);
      materials.towel.color.set(next[3]); materials.seam.color.set(next[4]);
    };
    character.setExpression = expression => { if (faceMaterial.map !== faces[expression]) { faceMaterial.map = faces[expression]; faceMaterial.needsUpdate = true; } };
    character.expression = () => Object.entries(faces).find(([, texture]) => texture === faceMaterial.map)?.[0];
    // Shared pose animation for the player, NPCs and future remote visitors.
    character.animate = (action, walking, dt, reducedMotion, speed = 1) => {
      const damp = (object, key, to, rate = 9) => { object[key] = THREE.MathUtils.damp(object[key], to, rate, dt); };
      character.elapsed += dt;
      const elapsed = character.elapsed, sleep = action === 'lie', sitting = action === 'sit', cycle = elapsed * 9 * speed;
      snack.visible = action === 'egg'; drink.visible = action === 'drink'; pillow.visible = sleep;
      damp(rig.rotation, 'x', sleep ? -Math.PI / 2 : 0, 6);
      damp(rig.position, 'y', sleep ? .46 : sitting ? -.29 : walking && !reducedMotion ? Math.abs(Math.sin(cycle)) * .035 : 0);
      // A reclining rig rests along the mat, with a pillow under its head.
      damp(rig.position, 'z', sleep ? .72 : 0, 6);
      for (let i = 0; i < 2; i++) {
        damp(legs[i].rotation, 'x', sitting ? -1.32 : sleep ? .45 : walking ? Math.sin(cycle + i * Math.PI) * .48 : 0);
        damp(legs[i].rotation, 'z', sitting ? (i === 0 ? -.25 : .25) : 0);
        const eating = (action === 'egg' || action === 'drink') && i === 1;
        const waving = action === 'wave' && i === 1;
        damp(arms[i].rotation, 'x', waving ? -2.35 : eating ? -2.0 : sitting ? -.5 : sleep ? -.18 : walking ? -Math.sin(cycle + i * Math.PI) * .35 : 0);
        damp(arms[i].rotation, 'z', waving ? -.4 + (reducedMotion ? 0 : Math.sin(elapsed * 7) * .24) : eating ? -.25 : i === 0 ? -.14 : .14);
      }
      if (!reducedMotion) { head.rotation.z = Math.sin(elapsed * 1.3) * .025; head.position.y = 1.55 + Math.sin(elapsed * 2) * .008; }
      else { head.rotation.z = 0; head.position.y = 1.55; }
      const blink = !reducedMotion && (elapsed + character.blinkOffset) % 4.7 > 4.52;
      character.setExpression(sleep || blink ? 'sleep' : action === 'egg' || action === 'drink' || action === 'wave' ? 'happy' : 'normal');
    };
    return character;
  }
  return { createCharacter, faces, textile, canvasTexture };
}
