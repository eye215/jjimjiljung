import * as THREE from './vendor/three.module.min.js';
import { ROOMS, DOORS, FURNITURE, WALL_THICKNESS } from './world.js?v=rpg-3';
import { mat, mesh, box, tube, cylinder, random, mergeGeometries } from './character.js?v=rpg-3';

// Procedural, cosy jjimjilbang built from the shared map data. Everything is
// generated locally: textures are drawn on canvases and static props are merged
// per material so phones only submit a few dozen draw calls.
const FONT = '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","WenQuanYi Zen Hei",sans-serif';
const WALL_HEIGHT = 2.4, DOOR_HEIGHT = 2.1;
const FACE = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };
// Props use a lighter sphere than the characters; they are small on screen.
const propSphere = new THREE.SphereGeometry(1, 16, 12);
function ellipsoid(parent, material, position, scale) { const m = mesh(propSphere, material, parent, position); m.scale.set(...scale); return m; }

export function buildWorld({ scene, kit }) {
  const { canvasTexture, textile } = kit;
  const staticGroup = new THREE.Group(); scene.add(staticGroup);
  const fadeUnits = [], animated = [], lights = {};
  const tiled = (texture, size) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.userData.size = size; return texture; };
  const noise = (c, w, h, count, colors, size = 2) => { for (let i = 0; i < count; i++) { c.fillStyle = colors[Math.floor(random() * colors.length)]; c.fillRect(random() * w, random() * h, size * (.5 + random()), size * (.5 + random())); } };

  // ---------- Materials ----------
  const wood = tiled(canvasTexture((c, w, h) => {
    const rows = 8, tones = ['#d6a06c', '#d39b67', '#dba872', '#cf9763', '#d8a46f'];
    for (let r = 0; r < rows; r++) {
      let x = -random() * 200;
      while (x < w) {
        const len = 150 + random() * 170; c.fillStyle = tones[Math.floor(random() * tones.length)]; c.fillRect(x, r * h / rows, len, h / rows);
        c.strokeStyle = '#a8703f30'; c.lineWidth = 1.2;
        for (let g = 0; g < 4; g++) { c.beginPath(); const y = r * h / rows + 8 + random() * (h / rows - 16); c.moveTo(x + 4, y); c.bezierCurveTo(x + len * .3, y + 3, x + len * .6, y - 3, x + len - 4, y + 1); c.stroke(); }
        c.fillStyle = '#8a5a3455'; c.fillRect(x, r * h / rows, 2, h / rows); x += len;
      }
      c.fillStyle = '#7d4f2c66'; c.fillRect(0, r * h / rows, w, 2);
    }
    noise(c, w, h, 2500, ['#ffffff10', '#5a35180c']);
  }), 3.2);
  const plaster = tiled(canvasTexture((c, w, h) => { c.fillStyle = '#f2e1c6'; c.fillRect(0, 0, w, h); noise(c, w, h, 9000, ['#ffffff22', '#c9a98018', '#e6cba633'], 3); }, 256, 256), 2.5);
  const brickTexture = (base, mortar, tones, rows = 10, cols = 5) => canvasTexture((c, w, h) => {
    c.fillStyle = mortar; c.fillRect(0, 0, w, h);
    const bh = h / rows, bw = w / cols;
    for (let r = 0; r < rows; r++) for (let i = -1; i < cols + 1; i++) {
      const x = i * bw + (r % 2) * bw / 2 + 4, y = r * bh + 4; c.fillStyle = tones[Math.floor(random() * tones.length)];
      c.beginPath(); c.roundRect(x, y, bw - 8, bh - 8, 7); c.fill();
      c.fillStyle = '#ffffff1c'; c.fillRect(x + 6, y + 4, bw - 22, 4);
    }
    noise(c, w, h, 3000, ['#ffffff12', base]);
  });
  const brick = tiled(brickTexture('#7a2e1210', '#efc493', ['#de7f4f', '#d2703f', '#e58c58', '#cf7a4c', '#e89a69']), 1.6);
  const salt = tiled(brickTexture('#c96e5a10', '#fbe8dd', ['#f5b7a2', '#f8c6b2', '#f1a891', '#fbd4c2', '#f7bfa9', '#fde0d2'], 8, 4), 1.4);
  const ice = tiled(brickTexture('#5d9bc510', '#eef8ff', ['#bfe3f7', '#cde9f9', '#b2dcf3', '#d9effb'], 6, 3), 1.8);
  const tiles = (colors, grout, n = 4) => canvasTexture((c, w, h) => {
    c.fillStyle = grout; c.fillRect(0, 0, w, h); const s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.fillStyle = colors[(i + j) % colors.length]; c.beginPath(); c.roundRect(i * s + 3, j * s + 3, s - 6, s - 6, 10); c.fill(); }
    noise(c, w, h, 4000, ['#ffffff16', '#00000008'], 3);
  });
  const clay = tiled(tiles(['#cf8659', '#c77c50', '#d68f61'], '#a7643f'), 2.4);
  const frost = tiled(tiles(['#e3f2fb', '#d5ebf8'], '#b7d5ea'), 2.4);
  const shopTile = tiled(tiles(['#f3e3c5', '#dfe2bf'], '#c8b48f', 6), 2.4);
  const quilt = tiled(canvasTexture((c, w, h) => {
    c.fillStyle = '#b9b0d8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f4ecff88'; c.setLineDash([10, 8]); c.lineWidth = 4;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.stroke(); c.beginPath(); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke(); }
    noise(c, w, h, 6000, ['#ffffff14', '#5a4b8a10'], 3);
  }), 2.4);
  const night = tiled(canvasTexture((c, w, h) => {
    c.fillStyle = '#7f78b8'; c.fillRect(0, 0, w, h); noise(c, w, h, 5000, ['#ffffff10', '#2d275a12'], 3);
    for (let i = 0; i < 18; i++) { c.fillStyle = '#fff7d4'; const x = random() * w, y = random() * h * .6, r = 3 + random() * 5; c.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5, rr = k % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill(); }
  }), 3);
  const plank = tiled(canvasTexture((c, w, h) => {
    const tones = ['#c48e5d', '#b98252', '#cd9968'];
    for (let i = 0; i < 6; i++) { c.fillStyle = tones[i % 3]; c.fillRect(i * w / 6, 0, w / 6, h); c.fillStyle = '#7d4f2c66'; c.fillRect(i * w / 6, 0, 3, h); }
    noise(c, w, h, 3000, ['#ffffff10', '#5a351810'], 3);
  }, 256, 256), 1.5);
  const straw = tiled(canvasTexture((c, w, h) => {
    c.fillStyle = '#e2c27d'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) { c.fillStyle = y % 12 ? '#d6b46c' : '#ecd093'; c.fillRect(0, y, w, 3); }
    c.strokeStyle = '#8f6b3b'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20);
  }, 256, 256), 1.5);

  const M = {
    wood: mat('#ffffff', { map: wood }), plaster: mat('#ffffff', { map: plaster, roughness: .95 }), brick: mat('#ffffff', { map: brick, roughness: .9 }),
    salt: mat('#ffffff', { map: salt, roughness: .9 }), ice: mat('#ffffff', { map: ice, roughness: .35, emissive: '#3a7fb0', emissiveIntensity: .12 }),
    clay: mat('#ffffff', { map: clay }), frost: mat('#ffffff', { map: frost, roughness: .4 }), tile: mat('#ffffff', { map: shopTile }),
    quilt: mat('#ffffff', { map: quilt, roughness: 1 }), night: mat('#ffffff', { map: night, roughness: 1 }), plank: mat('#ffffff', { map: plank }),
    straw: mat('#ffffff', { map: straw, roughness: 1 }),
    trim: mat('#a36d43'), darkWood: mat('#7b5134'), lightWood: mat('#dcae7c'), cream: mat('#f6ead4'), leaf: mat('#7fa35a', { roughness: .9 }),
    leafDark: mat('#5f8a48', { roughness: .9 }), terracotta: mat('#c47a52'), stone: mat('#b8a48d', { roughness: .95 }), white: mat('#fbf6ee'),
    towel: mat('#fff3e0', { map: textile, roughness: 1 }), egg: mat('#e2b07c'), eggWhite: mat('#fff3dc')
  };
  for (const key of ['wood', 'plaster', 'brick', 'salt', 'ice', 'clay', 'frost', 'tile', 'quilt', 'night', 'plank', 'straw']) M[key].userData.worldUV = M[key].map.userData.size;
  const glow = (color, intensity = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .6 });
  const floorMaterials = { wood: M.wood, clay: M.clay, frost: M.frost, quilt: M.quilt, salt: M.clay, tile: M.tile };
  const wallMaterials = { plaster: M.plaster, brick: M.brick, ice: M.ice, night: M.night, salt: M.salt, shop: M.plank };

  // ---------- Signs ----------
  function signTexture(text, { bg = '#fbf1dd', ink = '#6b4228', border = '#9b6a40', icon = '' } = {}) {
    return canvasTexture((c, w, h) => {
      c.fillStyle = border; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 40); c.fill();
      c.fillStyle = bg; c.beginPath(); c.roundRect(18, 18, w - 36, h - 36, 30); c.fill();
      c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 ${text.length > 3 ? 88 : 104}px ${FONT}`; c.fillText((icon ? icon + ' ' : '') + text, w / 2, h / 2 + 6);
    }, 512, 192);
  }
  function sign(parent, text, pos, rotationY, width = 1.5, style) {
    const group = new THREE.Group(); group.position.set(...pos); group.rotation.y = rotationY; parent.add(group);
    box(group, M.darkWood, [0, 0, -.03], [width + .08, width * .375 + .08, .06], .03, 4);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width, width * .375), new THREE.MeshStandardMaterial({ map: signTexture(text, style), roughness: .8 }));
    face.position.z = .005; group.add(face); return group;
  }

  // ---------- Floors ----------
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), mat('#4a3022', { roughness: 1 }));
  outside.rotation.x = -Math.PI / 2; outside.position.set(0, -.02, -3); outside.receiveShadow = true; scene.add(outside);
  for (const room of ROOMS) {
    const floor = mesh(new THREE.PlaneGeometry(room.maxX - room.minX, room.maxZ - room.minZ), floorMaterials[room.floor], staticGroup, [(room.minX + room.maxX) / 2, 0, (room.minZ + room.maxZ) / 2]);
    floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
    // A soft base plinth gives the diorama a finished edge against the dark surround.
    box(staticGroup, M.darkWood, [(room.minX + room.maxX) / 2, -.09, (room.minZ + room.maxZ) / 2], [room.maxX - room.minX + .3, .16, room.maxZ - room.minZ + .3], .05, 4).castShadow = false;
  }

  // ---------- Walls ----------
  // Each room builds a half-thickness slab on its own side of every edge, so a
  // wall shared by two rooms shows each room's finish on its own face.
  const half = WALL_THICKNESS / 2;
  function addFadeUnit(meshes, bounds, extra = {}) { fadeUnits.push({ meshes, bounds, opacity: 1, cut: 1, ...extra }); }
  function wallSlab(room, start, end, axis, line, inward) {
    const length = end - start; if (length < .05) return;
    const height = room.id === 'hot' ? 2.75 : WALL_HEIGHT;
    const material = wallMaterials[room.wall].clone(); const trim = M.trim.clone(), base = M.darkWood.clone();
    const unit = new THREE.Group(); scene.add(unit);
    const centre = (start + end) / 2, offset = line + inward * half / 2;
    const size = axis === 'z' ? [length, height, half] : [half, height, length];
    const position = axis === 'z' ? [centre, height / 2, offset] : [offset, height / 2, centre];
    const slab = new THREE.Mesh(new THREE.BoxGeometry(...size), material); slab.position.set(...position); slab.receiveShadow = true; unit.add(slab);
    applyWorldUV(slab.geometry, slab.position, material.map?.userData.size || 2);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(...(axis === 'z' ? [length, .08, half + .04] : [half + .04, .08, length])), trim);
    cap.position.set(position[0], height + .04, position[2]); unit.add(cap);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(...(axis === 'z' ? [length, .16, .04] : [.04, .16, length])), base);
    skirt.position.set(axis === 'z' ? centre : line + inward * (half + .02), .08, axis === 'z' ? line + inward * (half + .02) : centre); unit.add(skirt);
    if (room.wall === 'plaster' || room.wall === 'shop') {
      // Timber wainscot along the lower wall, like the reference lobby.
      const wains = new THREE.Mesh(new THREE.BoxGeometry(...(axis === 'z' ? [length, .72, .05] : [.05, .72, length])), M.plank.clone());
      wains.position.set(axis === 'z' ? centre : line + inward * (half + .025), .36, axis === 'z' ? line + inward * (half + .025) : centre);
      applyWorldUV(wains.geometry, wains.position, 1.5); unit.add(wains);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(...(axis === 'z' ? [length, .06, .09] : [.09, .06, length])), trim);
      rail.position.set(wains.position.x, .74, wains.position.z); unit.add(rail);
    }
    // Wall units remember their edge so near-side walls can be cut away.
    addFadeUnit([...unit.children], new THREE.Box3().setFromObject(unit), { group: unit, wall: { axis, line, from: start, to: end } });
  }
  for (const room of ROOMS) {
    const edges = [
      { axis: 'z', line: room.minZ, from: room.minX, to: room.maxX, inward: 1 },
      { axis: 'z', line: room.maxZ, from: room.minX, to: room.maxX, inward: -1 },
      { axis: 'x', line: room.minX, from: room.minZ + half, to: room.maxZ - half, inward: 1 },
      { axis: 'x', line: room.maxX, from: room.minZ + half, to: room.maxZ - half, inward: -1 }
    ];
    for (const edge of edges) {
      const openings = DOORS.filter(door => door.axis === edge.axis && Math.abs(door.line - edge.line) < 1e-6 && door.at > edge.from && door.at < edge.to)
        .map(door => [door.at - door.width / 2, door.at + door.width / 2]).sort((a, b) => a[0] - b[0]);
      let cursor = edge.from;
      for (const [a, b] of openings) { wallSlab(room, cursor, a, edge.axis, edge.line, edge.inward); cursor = b; }
      wallSlab(room, cursor, edge.to, edge.axis, edge.line, edge.inward);
    }
  }
  // Doorways: timber frames, arch facades for the domed rooms, and lobby-side signs.
  const archMaterials = { hot: M.brick, salt: M.salt, ice: M.ice };
  for (const door of DOORS) {
    const frame = new THREE.Group();
    // Local frame: opening spans x, wall thickness spans z, +z faces the lobby.
    const lobbySide = door.axis === 'z' ? 1 : door.line < 0 ? 1 : -1;
    if (door.axis === 'z') frame.position.set(door.at, 0, door.line); else { frame.position.set(door.line, 0, door.at); frame.rotation.y = lobbySide > 0 ? Math.PI / 2 : -Math.PI / 2; }
    scene.add(frame);
    const w = door.width, unitMeshes = [];
    for (const side of [-1, 1]) unitMeshes.push(box(frame, M.trim, [side * (w / 2 + .07), DOOR_HEIGHT / 2 + .1, 0], [.16, DOOR_HEIGHT + .2, WALL_THICKNESS + .12], .03, 4));
    const lintelHeight = (door.id === 'hot' ? 2.75 : WALL_HEIGHT) - DOOR_HEIGHT;
    const lintel = mesh(new THREE.BoxGeometry(w, lintelHeight, WALL_THICKNESS), M.plaster, frame, [0, DOOR_HEIGHT + lintelHeight / 2, 0]);
    applyWorldUV(lintel.geometry, new THREE.Vector3(), 2.5); unitMeshes.push(lintel);
    unitMeshes.push(box(frame, M.darkWood, [0, DOOR_HEIGHT + .06, 0], [w + .3, .14, WALL_THICKNESS + .14], .03, 4));
    if (archMaterials[door.id]) {
      // A rounded arch of the room's own material framing the entrance.
      const outerW = w / 2 + .45, inner = w / 2, spring = DOOR_HEIGHT - inner;
      const shape = new THREE.Shape(); shape.moveTo(-outerW, 0); shape.lineTo(-outerW, spring); shape.absarc(0, spring, outerW, Math.PI, 0, true); shape.lineTo(outerW, 0); shape.lineTo(inner, 0); shape.lineTo(inner, spring); shape.absarc(0, spring, inner, 0, Math.PI, false); shape.lineTo(-inner, 0);
      const arch = mesh(new THREE.ExtrudeGeometry(shape, { depth: .22, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 2, curveSegments: 20 }), archMaterials[door.id], frame, [0, 0, half + .02]);
      applyWorldUV(arch.geometry, new THREE.Vector3(), 1.4); unitMeshes.push(arch);
      unitMeshes.push(sign(frame, door.sign, [0, spring + outerW + .22, half + .3], 0, 1.2));
    } else unitMeshes.push(sign(frame, door.sign, [0, DOOR_HEIGHT + .45, half + .1], 0, 1.3));
    // A short noren curtain softens the openings of the quiet rooms.
    if (door.id === 'sleep' || door.id === 'shop') {
      const curtain = canvasTexture((c, cw, ch) => { c.fillStyle = door.id === 'sleep' ? '#7469a8' : '#c96a46'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#fff3dd'; c.font = `700 70px ${FONT}`; c.textAlign = 'center'; c.fillText(door.id === 'sleep' ? '☾' : '♨', cw / 2, ch * .62); for (let i = 1; i < 4; i++) c.clearRect(i * cw / 4 - 3, ch * .35, 6, ch); }, 256, 128);
      const noren = new THREE.Mesh(new THREE.PlaneGeometry(w - .1, .55), new THREE.MeshStandardMaterial({ map: curtain, transparent: true, side: THREE.DoubleSide, roughness: 1 }));
      noren.position.set(0, DOOR_HEIGHT - .28, 0); frame.add(noren); unitMeshes.push(noren);
    }
    frame.updateMatrixWorld(true);
    const all = []; frame.traverse(child => { if (child.isMesh) { child.material = child.material.clone(); child.castShadow = false; all.push(child); } });
    addFadeUnit(all, new THREE.Box3().setFromObject(frame), { door });
  }

  // The 불가마 dome rises behind its room as a warm brick backdrop.
  const dome = mesh(new THREE.SphereGeometry(5.6, 40, 16, Math.PI, Math.PI, 0, Math.PI / 2), mat('#ffffff', { map: brick, side: THREE.DoubleSide, roughness: .9 }), staticGroup, [0, 0, -13]);
  dome.scale.y = .72; applyWorldUV(dome.geometry, new THREE.Vector3(0, 0, -13), 1.6, true);
  const domeCrown = cylinder(staticGroup, M.darkWood, [0, 4.15, -13.4], .7, .9, .5, 20);
  for (let i = 0; i < 4; i++) { const steam = ellipsoid(staticGroup, mat('#fff7ea', { transparent: true, opacity: .5, depthWrite: false }), [-.4 + i * .25, 4.8 + i * .45, -13.4], [.35 + i * .1, .25, .3]); steam.userData.dynamic = true; animated.push(t => { steam.position.y = 4.8 + ((t * .25 + i * .45) % 1.8); steam.material.opacity = .5 * (1 - ((t * .25 + i * .45) % 1.8) / 1.8); }); }
  void domeCrown;

  // ---------- Furniture ----------
  const builders = {
    tv(g, w, d) {
      box(g, M.darkWood, [0, .3, 0], [w, .6, d * .8], .06, 4);
      box(g, M.lightWood, [0, .62, 0], [w + .06, .05, d * .85], .02, 4);
      box(g, mat('#2f2724'), [0, 1.45, -.05], [w * .9, 1.2, .12], .05, 4);
      const screen = canvasTexture((c, cw, ch) => {
        const sky = c.createLinearGradient(0, 0, 0, ch); sky.addColorStop(0, '#9fd8f5'); sky.addColorStop(1, '#e6f6ff'); c.fillStyle = sky; c.fillRect(0, 0, cw, ch);
        c.fillStyle = '#ffe48a'; c.beginPath(); c.arc(cw * .8, ch * .22, 26, 0, 7); c.fill();
        for (const [x, y, r] of [[.2, .2, 30], [.3, .18, 24], [.55, .28, 22]]) { c.fillStyle = '#ffffffee'; c.beginPath(); c.arc(cw * x, ch * y, r, 0, 7); c.fill(); }
        c.fillStyle = '#8fcf72'; c.beginPath(); c.ellipse(cw * .3, ch, cw * .5, ch * .35, 0, 0, 7); c.fill(); c.fillStyle = '#76bd60'; c.beginPath(); c.ellipse(cw * .85, ch, cw * .45, ch * .28, 0, 0, 7); c.fill();
        c.fillStyle = '#fff2db'; c.beginPath(); c.arc(cw * .45, ch * .66, 26, 0, 7); c.fill(); c.fillStyle = '#c9b2d8'; c.beginPath(); c.arc(cw * .6, ch * .7, 20, 0, 7); c.fill();
      }, 256, 160);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w * .82, 1.02), new THREE.MeshStandardMaterial({ map: screen, emissive: '#ffffff', emissiveMap: screen, emissiveIntensity: .75 }));
      panel.position.set(0, 1.45, .015); g.add(panel);
      cylinder(g, mat('#e7c48f'), [-w * .38, .82, .1], .1, .14, .34, 16); ellipsoid(g, M.leaf, [-w * .38, 1.07, .1], [.2, .16, .2]);
    },
    mat(g, w, d) {
      const emblem = canvasTexture((c, cw, ch) => {
        c.fillStyle = '#9b93a8'; c.fillRect(0, 0, cw, ch); c.strokeStyle = '#c7c0d1'; c.lineWidth = 6; c.strokeRect(14, 14, cw - 28, ch - 28);
        c.strokeStyle = '#d8d1e0'; c.lineWidth = 7; c.lineCap = 'round';
        for (const x of [-26, 0, 26]) { c.beginPath(); c.moveTo(cw / 2 + x, ch / 2 + 10); c.bezierCurveTo(cw / 2 + x - 12, ch / 2 - 4, cw / 2 + x + 12, ch / 2 - 16, cw / 2 + x, ch / 2 - 32); c.stroke(); }
        c.beginPath(); c.arc(cw / 2, ch / 2 + 4, 44, .2, Math.PI - .2); c.stroke();
      }, 256, 256);
      box(g, mat('#ffffff', { map: emblem, roughness: 1 }), [0, .045, 0], [w, .09, d], .04, 4).castShadow = false;
    },
    tree(g) {
      cylinder(g, M.stone, [0, .3, 0], .62, .7, .6, 24);
      cylinder(g, mat('#5c3f2c'), [0, .62, 0], .56, .56, .05, 24);
      const trunk = mesh(new THREE.CylinderGeometry(.18, .3, 2.9, 12), mat('#8b6243', { roughness: 1 }), g, [0, 2, 0]); trunk.rotation.z = .05;
      const canopy = new THREE.Group(); canopy.position.y = 3.3; g.add(canopy); g.userData.fadeAll = true;
      for (const [x, y, z, s] of [[0, 0, 0, 1], [.65, -.15, .2, .7], [-.6, -.1, -.1, .75], [.1, .3, -.4, .7], [-.2, -.25, .55, .65]]) ellipsoid(canopy, s > .8 ? M.leafDark : M.leaf, [x, y, z], [s, s * .72, s]);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, x = Math.cos(a) * .75, z = Math.sin(a) * .75; tube(canopy, M.leaf, [[x, -.2, z], [x * 1.05, -.9, z * 1.05], [x * .98, -1.5 - random() * .4, z * .98]], .03); }
    },
    table(g, w, d) {
      box(g, M.darkWood, [0, .44, 0], [w, .12, d], .05, 4);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, M.darkWood, [sx * (w / 2 - .14), .2, sz * (d / 2 - .14)], [.14, .4, .14], .03, 4);
      ellipsoid(g, M.egg, [-.2, .56, 0], [.08, .1, .08]); ellipsoid(g, M.egg, [-.05, .56, .05], [.08, .1, .08]);
      cylinder(g, mat('#f1dcb6'), [.3, .58, -.05], .08, .07, .18, 14);
    },
    cushion(g, w, d) { box(g, mat(random() > .5 ? '#d9b2a4' : '#c7b9d6', { roughness: 1 }), [0, .07, 0], [w, .14, d], .06, 4); },
    pot(g, w) {
      cylinder(g, M.terracotta, [0, w * .45, 0], w * .45, w * .34, w * .9, 18);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, leaf = ellipsoid(g, i % 2 ? M.leaf : M.leafDark, [Math.cos(a) * .18, w + .25, Math.sin(a) * .18], [.1, .38, .2]); leaf.rotation.set(Math.sin(a) * .6, 0, -Math.cos(a) * .6); }
    },
    lamp(g) {
      cylinder(g, M.darkWood, [0, .03, 0], .22, .24, .06, 16); cylinder(g, M.darkWood, [0, .7, 0], .04, .04, 1.3, 8);
      const shade = box(g, glow('#ffd9a0', 1.3), [0, 1.45, 0], [.36, .46, .36], .06, 4); shade.castShadow = false;
      box(g, M.darkWood, [0, 1.72, 0], [.44, .06, .44], .02, 4);
    },
    bench(g, w, d) { box(g, M.lightWood, [0, .32, 0], [w, .1, d], .04, 4); for (const s of [-1, 1]) box(g, M.darkWood, [s * (w / 2 - .25), .15, 0], [.12, .3, d * .8], .03, 4); box(g, M.towel, [w * .25, .4, 0], [.5, .08, .38], .04, 4); },
    hearth(g, w, d) {
      box(g, M.stone, [0, .22, 0], [w, .44, d], .2, 6);
      const coals = new THREE.Group(); coals.position.y = .42; g.add(coals);
      const coalMat = glow('#ff7a2e', 1.4); coals.userData.coal = coalMat;
      for (let i = 0; i < 18; i++) ellipsoid(coals, i % 3 ? coalMat : mat('#5a3324'), [(random() - .5) * (w - .6), .05, (random() - .5) * (d - .5)], [.16, .1, .14]);
      for (let i = 0; i < 3; i++) { const flame = mesh(new THREE.ConeGeometry(.18, .6, 10), glow('#ffb347', 2.2), coals, [(i - 1) * .45, .3, 0]); flame.castShadow = false; flame.userData.dynamic = true; animated.push(t => { flame.scale.y = 1 + Math.sin(t * 7 + i * 2) * .18; flame.scale.x = flame.scale.z = 1 - Math.sin(t * 7 + i * 2) * .08; }); }
      coals.traverse(child => { child.userData.dynamic = true; });
      animated.push(t => { coalMat.emissiveIntensity = 1.3 + Math.sin(t * 3.1) * .25; });
    },
    straw(g, w, d) { box(g, M.straw, [0, .025, 0], [w, .05, d], .02, 4).castShadow = false; },
    logs(g, w, d) { for (let i = 0; i < 5; i++) { const log = cylinder(g, mat(i % 2 ? '#8a5d3b' : '#9a6a44'), [(i % 3 - 1) * .32, .14 + (i > 2 ? .24 : 0), 0], .13, .13, d, 12); log.rotation.x = Math.PI / 2; } void w; },
    timer(g) { box(g, M.darkWood, [0, .35, 0], [.5, .7, .5], .04, 4); for (const y of [.86, 1.14]) { const bulb = mesh(new THREE.SphereGeometry(.11, 14, 10), mat('#fff0cf', { transparent: true, opacity: .7 }), g, [0, y, 0]); bulb.scale.y = 1.3; } ellipsoid(g, mat('#f2b24c'), [0, .8, 0], [.08, .05, .08]); },
    iceblock(g, w, d) {
      const iceMat = mat('#cdeefc', { transparent: true, opacity: .88, roughness: .2, emissive: '#5aaee0', emissiveIntensity: .18 });
      for (let i = 0; i < 4; i++) box(g, iceMat, [(i % 2 - .5) * w * .45, .3 + Math.floor(i / 2) * .55, (i % 2 ? .1 : -.1) * d], [w * .45, .55, d * .8], .07, 4);
    },
    snowman(g) {
      ellipsoid(g, M.white, [0, .32, 0], [.36, .33, .36]); ellipsoid(g, M.white, [0, .8, 0], [.27, .25, .27]);
      for (const x of [-.08, .08]) ellipsoid(g, mat('#3b2b25'), [x, .84, .24], [.025, .03, .02]);
      const nose = mesh(new THREE.ConeGeometry(.035, .14, 8), mat('#f08a3c'), g, [0, .79, .29]); nose.rotation.x = Math.PI / 2;
      // A tiny sheep-towel cap, of course.
      ellipsoid(g, M.towel, [0, .98, -.02], [.27, .14, .25]); for (const s of [-1, 1]) ellipsoid(g, M.towel, [s * .25, .95, 0], [.09, .1, .1]);
      for (const s of [-1, 1]) tube(g, mat('#7b5134'), [[s * .25, .6, 0], [s * .42, .72, 0], [s * .5, .85, .02]], .02);
    },
    icebench(g, w, d) { box(g, mat('#d6f0fb', { roughness: .3 }), [0, .2, 0], [w, .4, d], .1, 4); },
    bed(g, w, d) {
      box(g, mat('#efe6ff', { roughness: 1 }), [0, .05, 0], [w, .1, d], .05, 4).castShadow = false;
      box(g, mat('#fff8ef', { map: textile, roughness: 1 }), [0, .15, -d / 2 + .25], [w * .62, .14, .36], .07, 4);
      box(g, mat(random() > .5 ? '#c9bbf0' : '#f2c9d6', { roughness: 1 }), [0, .12, d * .2], [w * .94, .07, d * .55], .035, 4);
    },
    nightlamp(g) { cylinder(g, M.lightWood, [0, .2, 0], .2, .22, .4, 14); const moon = ellipsoid(g, glow('#fff1b8', 1.5), [0, .62, 0], [.2, .2, .2]); moon.castShadow = false; },
    shelf(g, w, d) {
      box(g, M.lightWood, [0, .8, 0], [w, 1.6, d], .04, 4);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 3; i++) box(g, mat(['#fff4e2', '#f4cbd3', '#cfe0f4'][(row + i) % 3], { map: textile, roughness: 1 }), [(i - 1) * w * .3, .32 + row * .48, .1], [w * .27, .16, d * .65], .05, 4);
    },
    saltbed(g, w, d) {
      for (const [x, z, sw, sd] of [[0, -d / 2, w, .12], [0, d / 2, w, .12], [-w / 2, 0, .12, d], [w / 2, 0, .12, d]]) box(g, M.lightWood, [x, .07, z], [sw + .06, .14, sd], .03, 4);
      box(g, mat('#f6dfd2', { roughness: 1 }), [0, .03, 0], [w, .06, d], .02, 4).castShadow = false;
      const pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.05, 0), mat('#fff3ec', { roughness: .7 }), 700);
      const dummy = new THREE.Object3D(), colors = [new THREE.Color('#fffaf6'), new THREE.Color('#fbe3d9'), new THREE.Color('#f6cbbb')];
      for (let i = 0; i < pebbles.count; i++) { dummy.position.set((random() - .5) * (w - .2), .065, (random() - .5) * (d - .2)); dummy.scale.set(.6 + random() * .6, .45 + random() * .3, .6 + random() * .6); dummy.rotation.set(random() * 3, random() * 3, 0); dummy.updateMatrix(); pebbles.setMatrixAt(i, dummy.matrix); pebbles.setColorAt(i, colors[i % 3]); }
      pebbles.receiveShadow = true; pebbles.userData.dynamic = true; g.add(pebbles);
      for (const z of [-1.5, 0, 1.5]) box(g, M.lightWood, [-w / 2 + .45, .16, z], [.5, .18, .28], .06, 4);
    },
    saltlamp(g, w) {
      box(g, M.darkWood, [0, .08, 0], [w * .8, .16, w * .8], .03, 4);
      const rock = mesh(new THREE.DodecahedronGeometry(w * .42, 0), glow('#ff9f7a', .9), g, [0, .5, 0]); rock.scale.y = 1.25; rock.castShadow = false;
      rock.userData.dynamic = true; const phase = random() * 6; animated.push(t => { rock.material.emissiveIntensity = .8 + Math.sin(t * 1.4 + phase) * .2; });
    },
    counter(g, w, d) {
      // Local frame: the counter front faces +z, its length runs along x.
      box(g, M.plank, [0, .48, 0], [w, .96, d * .55], .04, 4);
      box(g, M.lightWood, [0, .99, .05], [w + .1, .07, d * .7], .03, 4);
      for (let i = 0; i < 5; i++) { ellipsoid(g, M.egg, [-1.9 + i * .12, 1.1, .1], [.075, .095, .075]); ellipsoid(g, M.egg, [-1.85 + i * .12, 1.1, -.04], [.075, .095, .075]); }
      cylinder(g, mat('#c69462'), [-1.85, 1.06, .03], .42, .36, .1, 18).castShadow = false;
      for (let i = 0; i < 4; i++) { cylinder(g, mat('#f3e2c0'), [-.3 + i * .22, 1.14, .12], .07, .06, .2, 12); cylinder(g, mat('#d8a978'), [-.3 + i * .22, 1.245, .12], .072, .072, .02, 12); }
      for (let i = 0; i < 3; i++) { cylinder(g, mat(['#e86a4c', '#f3c34f', '#e86a4c'][i]), [.9 + i * .3, 1.14, .05], .1, .08, .22, 14); cylinder(g, M.white, [.9 + i * .3, 1.26, .05], .1, .1, .02, 14); }
      box(g, mat('#e9e4dc'), [1.85, 1.2, -.05], [.5, .38, .36], .05, 4);
      sign(g, '식혜 · 계란 · 라면', [0, .55, d * .28 + .01], 0, 2.4, { bg: '#fff6e2', ink: '#8b4d2a', border: '#b37b4a' });
    },
    fridge(g, w, d) {
      box(g, mat('#e5f1ec'), [0, .9, 0], [w, 1.8, d], .08, 4);
      const drinks = canvasTexture((c, cw, ch) => { c.fillStyle = '#dff7ff'; c.fillRect(0, 0, cw, ch); for (let row = 0; row < 3; row++) { c.fillStyle = '#b9d5dd'; c.fillRect(0, (row + 1) * ch / 3 - 6, cw, 6); for (let i = 0; i < 6; i++) { c.fillStyle = ['#f4e3c0', '#ffd27a', '#e98d6b', '#a8d38a'][(i + row) % 4]; c.beginPath(); c.roundRect(10 + i * cw / 6, row * ch / 3 + 18, cw / 6 - 18, ch / 3 - 30, 8); c.fill(); } } }, 256, 256);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w * .82, 1.45), new THREE.MeshStandardMaterial({ map: drinks, emissive: '#ffffff', emissiveMap: drinks, emissiveIntensity: .55, roughness: .2 }));
      glass.position.set(0, 1.0, d / 2 + .005); g.add(glass);
      sign(g, '식혜', [0, 1.97, d / 2 - .1], 0, .8, { bg: '#fff4dc', ink: '#c06a35' });
    },
    shoptable(g, w) { cylinder(g, M.lightWood, [0, .62, 0], w * .5, w * .5, .07, 24); cylinder(g, M.darkWood, [0, .3, 0], .07, .1, .6, 10); cylinder(g, M.darkWood, [0, .02, 0], .3, .32, .04, 16); cylinder(g, mat('#f3e2c0'), [.15, .73, .1], .07, .06, .16, 12); ellipsoid(g, M.egg, [-.15, .7, 0], [.07, .09, .07]); },
    stool(g) { cylinder(g, mat('#e7a27a'), [0, .38, 0], .22, .22, .08, 16); cylinder(g, M.darkWood, [0, .18, 0], .05, .07, .36, 8); }
  };
  const blobTexture = canvasTexture((c, w, h) => {
    c.filter = 'blur(14px)'; c.fillStyle = 'rgba(70,40,20,.42)'; c.beginPath(); c.roundRect(30, 30, w - 60, h - 60, 40); c.fill();
  }, 128, 128);
  const blobMaterial = new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const canopies = [];
  for (const item of FURNITURE) {
    if (item.solid) { const blob = mesh(new THREE.PlaneGeometry(item.w + .45, item.d + .45), blobMaterial, staticGroup, [item.x + .08, .006, item.z + .1]); blob.rotation.x = -Math.PI / 2; }
    const g = new THREE.Group(); g.position.set(item.x, 0, item.z); g.rotation.y = FACE[item.face || 's'];
    const sideways = item.face === 'e' || item.face === 'w';
    staticGroup.add(g); builders[item.type](g, sideways ? item.d : item.w, sideways ? item.w : item.d);
    if (g.userData.fadeAll) canopies.push(g);
  }
  // Trees become translucent whenever they stand between the camera and the player.
  for (const canopy of canopies) {
    canopy.updateMatrixWorld(true);
    const meshes = []; canopy.traverse(child => { if (child.isMesh) { child.material = child.material.clone(); child.userData.dynamic = true; child.castShadow = false; meshes.push(child); } });
    addFadeUnit(meshes, new THREE.Box3().setFromObject(canopy));
  }

  // ---------- Wall decor ----------
  // Wall-mounted decor hides with its wall when that wall is cut away.
  const wallDecor = [];
  function decor(builder, position, rotationY = 0, wall = null) {
    const g = new THREE.Group(); g.position.set(...position); g.rotation.y = rotationY; (wall ? scene : staticGroup).add(g); builder(g);
    if (wall) wallDecor.push({ group: g, axis: wall[0], line: wall[1], at: wall[0] === 'z' ? position[0] : position[2] });
    return g;
  }
  const wallSign = (text, position, rotationY, width, style, wall) => decor(g => sign(g, text, [0, 0, 0], 0, width, style), position, rotationY, wall);
  // Lobby: hanging vines along the back wall, wall lanterns and a clock.
  for (const x of [-7.3, -3.2, 2.2, 3.5]) decor(g => { for (let i = 0; i < 5; i++) { const sx = (i - 2) * .22; tube(g, i % 2 ? M.leaf : M.leafDark, [[sx, 0, 0], [sx + .05, -.45, .06], [sx - .03, -.8 - random() * .5, .08]], .028); ellipsoid(g, M.leaf, [sx, -.1, .04], [.16, .1, .1]); } }, [x, WALL_HEIGHT - .05, -4.75], 0, ['z', -5]);
  for (const x of [-2.2, 2.2]) decor(g => { box(g, M.darkWood, [0, 0, 0], [.1, .5, .1], .02, 4); const lantern = box(g, glow('#ffd28f', 1.4), [0, -.05, .2], [.26, .34, .26], .06, 4); lantern.castShadow = false; }, [x, 1.75, -4.78], 0, ['z', -5]);
  decor(g => { cylinder(g, M.darkWood, [0, 0, 0], .32, .32, .06, 24).rotation.x = Math.PI / 2; cylinder(g, M.cream, [0, 0, .035], .27, .27, .02, 24).rotation.x = Math.PI / 2; box(g, M.darkWood, [0, .07, .05], [.03, .17, .01], .005, 2); box(g, M.darkWood, [.05, 0, .05], [.12, .03, .01], .005, 2); }, [-7.78, 1.7, 5.6], Math.PI / 2, ['x', -8]);
  // Hot room: hanging towels on the side walls.
  for (const x of [-4.75, 4.75]) for (const z of [-7, -11]) decor(g => { box(g, M.darkWood, [0, 0, 0], [.08, .08, .9], .02, 4); box(g, M.towel, [.06 * Math.sign(-x), -.35, 0], [.04, .7, .55], .02, 4); }, [x, 1.9, z], 0, ['x', Math.sign(x) * 5]);
  // Ice room: icicles hanging from the back wall top.
  decor(g => { for (let i = 0; i < 14; i++) { const icicle = mesh(new THREE.ConeGeometry(.06 + random() * .05, .3 + random() * .35, 6), mat('#e6f7ff', { roughness: .2, emissive: '#7ec6ef', emissiveIntensity: .25 }), g, [i * .62, -.2, 0]); icicle.rotation.x = Math.PI; } }, [-13.6, WALL_HEIGHT, -12.7], 0, ['z', -13]);
  // Sleep room: a big crescent moon on the back wall.
  decor(g => { const moon = ellipsoid(g, glow('#fff0b5', .9), [0, 0, 0], [.5, .5, .1]); moon.castShadow = false; ellipsoid(g, M.night, [.22, .12, .05], [.42, .42, .1]); }, [9.5, 1.65, -12.78], 0, ['z', -13]);
  wallSign('쉿! 꿀잠 중', [12.6, 1.6, -12.79], 0, 1.3, { bg: '#f1ecff', ink: '#5d528f', border: '#7d72b0' }, ['z', -13]);
  // Salt room: rounded salt lamps on the back wall and a sign.
  wallSign('소금방', [-11.5, 1.75, -3.79], 0, 1.3, { bg: '#fff1ea', ink: '#b65f4e', border: '#c98b7a' }, ['z', -4]);
  // Shop: big sign and menu boards on the back wall, shelves of snacks.
  wallSign('매  점', [14.79, 2.05, 0], -Math.PI / 2, 2, { bg: '#fff4da', ink: '#7b4524' }, ['x', 15]);
  for (const [z, text] of [[-2.6, '식혜'], [2.6, '라면']]) wallSign(text, [14.79, 1.62, z], -Math.PI / 2, .9, { bg: '#fffaf0', ink: '#9b5a30' }, ['x', 15]);
  decor(g => { for (const y of [1.15, 1.45]) { box(g, M.lightWood, [0, y, 0], [3.4, .05, .3], .02, 4); for (let i = 0; i < 9; i++) cylinder(g, mat(['#f2d58a', '#e98d6b', '#f4e3c0', '#a8d38a'][i % 4]), [-1.5 + i * .37, y + .12, 0], .08, .08, .2, 10); } }, [14.6, 0, 0], -Math.PI / 2, ['x', 15]);

  // ---------- Lighting ----------
  const pointPositions = { lobby: [0, 2.6, 1.5], hot: [0, 2.2, -10], ice: [-9.5, 2.3, -9], sleep: [9.5, 2.1, -9], salt: [-11.5, 2.2, 0], shop: [11.5, 2.4, 0] };
  const intensities = { lobby: 9, hot: 22, ice: 10, sleep: 7, salt: 12, shop: 10 };
  for (const room of ROOMS) {
    const light = new THREE.PointLight(room.light, intensities[room.id], 11, 1.4); light.position.set(...pointPositions[room.id]); scene.add(light); lights[room.id] = light;
  }
  const hotLight = lights.hot; animated.push(t => { hotLight.intensity = intensities.hot * (1 + Math.sin(t * 4.3) * .05 + Math.sin(t * 9.1) * .03); });

  // Hearth steam inside 불가마.
  const steamCount = 26, steamPositions = new Float32Array(steamCount * 3), steamSeeds = [];
  for (let i = 0; i < steamCount; i++) steamSeeds.push([(random() - .5) * 2, (random() - .5) * 1.2, random() * 3]);
  const steamGeometry = new THREE.BufferGeometry(); steamGeometry.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3));
  const steam = new THREE.Points(steamGeometry, new THREE.PointsMaterial({ color: '#fff3dd', size: .16, transparent: true, opacity: .45, depthWrite: false })); scene.add(steam);
  animated.push(t => { for (let i = 0; i < steamCount; i++) { const [x, z, p] = steamSeeds[i], life = (t * .4 + p) % 3; steamPositions[i * 3] = x + Math.sin(t + p * 3) * .15; steamPositions[i * 3 + 1] = .7 + life; steamPositions[i * 3 + 2] = -10.2 + z; } steamGeometry.attributes.position.needsUpdate = true; });

  mergeStatic(staticGroup);
  scene.traverse(object => { object.castShadow = false; });
  return {
    fadeUnits, lights, steam, wallDecor,
    update(t, reducedMotion) { if (!reducedMotion) for (const fn of animated) fn(t); steam.visible = !reducedMotion; }
  };
}

// Box-projected UVs in world metres, so tiles and bricks share one scale.
export function applyWorldUV(geometry, offset, size, spherical = false) {
  const position = geometry.attributes.position; if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const normal = geometry.attributes.normal, uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) + offset.x, y = position.getY(i) + offset.y, z = position.getZ(i) + offset.z;
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i));
    let u, v;
    if (spherical) { u = Math.atan2(position.getZ(i), position.getX(i)) * 5.6; v = y; }
    else if (ny >= nx && ny >= nz) { u = x; v = z; } else if (nx >= nz) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / size; uv[i * 2 + 1] = v / size;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Merge every static mesh by material: far fewer draw calls on phones.
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map(), remove = [];
  group.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh || object.userData.dynamic) return;
    let parent = object.parent, dynamic = false; while (parent && parent !== group) { if (parent.userData.dynamic) dynamic = true; parent = parent.parent; }
    if (dynamic) return;
    const key = object.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { material: object.material, parts: [] });
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
    geometry.applyMatrix4(object.matrixWorld);
    buckets.get(key).parts.push(geometry); remove.push(object);
  });
  for (const object of remove) object.parent.remove(object);
  for (const { material, parts } of buckets.values()) {
    for (const part of parts) if (material.userData.worldUV) applyWorldUV(part, { x: 0, y: 0, z: 0 }, material.userData.worldUV);
    // Static scenery receives shadows but does not cast them; soft baked blobs
    // under furniture keep the grounded look without a costly shadow pass.
    const combined = new THREE.Mesh(mergeGeometries(parts), material); combined.castShadow = false; combined.receiveShadow = true; combined.matrixAutoUpdate = false;
    if (material.transparent) combined.renderOrder = 1;
    group.add(combined);
  }
}
