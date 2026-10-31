// Map data shared by navigation, rendering and (later) networking.
// Units are metres on the floor plane: +x is east, +z is south (towards the
// default camera). Rooms are axis-aligned and joined by doorway openings.
export const WALL_THICKNESS = .36;
export const ACTOR_RADIUS = .3;

export const ROOMS = Object.freeze([
  { id: 'lobby', name: '중앙 휴게실', note: '모두 모이는 곳', minX: -8, maxX: 8, minZ: -5, maxZ: 7, wall: 'plaster', floor: 'wood', light: '#ffd9a6', ambient: '#fff1da' },
  { id: 'hot', name: '불가마', note: '주황빛 뜨끈함', minX: -5, maxX: 5, minZ: -13, maxZ: -5, wall: 'brick', floor: 'clay', light: '#ff8a3d', ambient: '#ffd2a8' },
  { id: 'ice', name: '얼음방', note: '잠깐 시원하게', minX: -14, maxX: -5, minZ: -13, maxZ: -5, wall: 'ice', floor: 'frost', light: '#9fd8ff', ambient: '#e5f2ff' },
  { id: 'sleep', name: '수면실', note: '쉿, 조용히', minX: 5, maxX: 14, minZ: -13, maxZ: -5, wall: 'night', floor: 'quilt', light: '#b9a6ff', ambient: '#e2dbff' },
  { id: 'salt', name: '소금방', note: '은은한 분홍빛', minX: -15, maxX: -8, minZ: -4, maxZ: 4, wall: 'salt', floor: 'salt', light: '#ffb09a', ambient: '#ffe6dc' },
  { id: 'shop', name: '매점', note: '계란 · 식혜', minX: 8, maxX: 15, minZ: -4, maxZ: 4, wall: 'shop', floor: 'tile', light: '#ffd28a', ambient: '#fff0d6' },
  // South wing (Phase 6), reusing the existing finishes.
  { id: 'entrance', name: '입구', note: '카운터 · 열쇠', minX: 8, maxX: 15, minZ: 4, maxZ: 7, wall: 'shop', floor: 'wood', light: '#ffe0a8', ambient: '#fff3df' },
  { id: 'fortune', name: '사주방', note: '오늘의 운세', minX: -15, maxX: -8, minZ: 7, maxZ: 15, wall: 'night', floor: 'quilt', light: '#c9a6ff', ambient: '#ece2ff' },
  { id: 'locker', name: '탈의실', note: '사물함 · 갈아입기', minX: -8, maxX: -2, minZ: 7, maxZ: 15, wall: 'plaster', floor: 'wood', light: '#ffe0b8', ambient: '#fff4e4' },
  { id: 'bath', name: '목욕탕', note: '온탕 · 냉탕 · 샤워', minX: -2, maxX: 8, minZ: 7, maxZ: 15, wall: 'ice', floor: 'tile', light: '#bfe6ff', ambient: '#eef7ff' },
  { id: 'scrub', name: '세신실', note: '때밀이 · 마사지', minX: 8, maxX: 15, minZ: 7, maxZ: 15, wall: 'plaster', floor: 'tile', light: '#ffd6b0', ambient: '#fff1e6' }
].map(Object.freeze));

// axis 'z': opening in a wall running along x at z = line. axis 'x': the reverse.
export const DOORS = Object.freeze([
  { id: 'hot', axis: 'z', line: -5, at: 0, width: 2.4, sign: '불가마' },
  { id: 'ice', axis: 'z', line: -5, at: -6.5, width: 2, sign: '얼음방' },
  { id: 'sleep', axis: 'z', line: -5, at: 6.5, width: 2, sign: '수면실' },
  { id: 'salt', axis: 'x', line: -8, at: 0, width: 2.4, sign: '소금방' },
  { id: 'shop', axis: 'x', line: 8, at: 0, width: 2.4, sign: '매점' },
  // `side`: which way the sign faces (+1 = +axis side); defaults to the lobby side.
  { id: 'entrance', axis: 'x', line: 8, at: 5.2, width: 1.6, sign: '입구' },
  { id: 'locker', axis: 'z', line: 7, at: -3.6, width: 2, sign: '탈의실' },
  { id: 'bath', axis: 'z', line: 7, at: 3, width: 2.4, sign: '목욕탕' },
  { id: 'lockerbath', axis: 'x', line: -2, at: 11, width: 2, sign: '목욕탕', side: -1 },
  { id: 'fortune', axis: 'x', line: -8, at: 11, width: 2, sign: '사주방' },
  { id: 'scrub', axis: 'x', line: 8, at: 11, width: 2, sign: '세신실' }
].map(Object.freeze));

// Furniture is centred on x/z with an axis-aligned footprint w (x) by d (z).
// `face` is the direction the front of the item looks towards.
// Only `solid` pieces block walking; mats and cushions can be walked over.
export const FURNITURE = Object.freeze([
  // Central lobby
  { type: 'tv', x: -7.4, z: 3.4, w: .75, d: 2.8, face: 'e', solid: true },
  { type: 'mat', x: -4.6, z: 2.4, w: 1.3, d: 1.3 }, { type: 'mat', x: -4.6, z: 4.6, w: 1.3, d: 1.3 },
  { type: 'mat', x: -2.5, z: 3.5, w: 1.3, d: 1.3 },
  { type: 'tree', x: -6, z: 5.9, w: 1.4, d: 1.4, solid: true }, { type: 'tree', x: 6.4, z: -2.5, w: 1.4, d: 1.4, solid: true },
  { type: 'table', x: 3.8, z: 2.6, w: 1.9, d: 1.05, solid: true }, { type: 'table', x: 5.3, z: 5.2, w: 1.5, d: 1.05, solid: true },
  { type: 'cushion', x: 3.8, z: 1.55, w: .8, d: .7 }, { type: 'cushion', x: 3.8, z: 3.65, w: .8, d: .7 },
  { type: 'cushion', x: 5.3, z: 6.25, w: .8, d: .6 },
  { type: 'pot', x: -7.3, z: 6.3, w: .75, d: .75, solid: true }, { type: 'pot', x: 7.3, z: 6.3, w: .75, d: .75, solid: true },
  { type: 'pot', x: -4.6, z: -4.35, w: .7, d: .7, solid: true }, { type: 'pot', x: 4.6, z: -4.35, w: .7, d: .7, solid: true },
  { type: 'lamp', x: -7.45, z: 1.9, w: .5, d: .5, solid: true }, { type: 'lamp', x: 7.45, z: 1.9, w: .5, d: .5, solid: true },
  { type: 'bench', x: -.2, z: 6.35, w: 3.2, d: .65, face: 'n', solid: true },
  // 불가마
  { type: 'hearth', x: 0, z: -10.2, w: 2.6, d: 1.7, solid: true },
  { type: 'straw', x: -3.2, z: -8.6, w: 1.5, d: 2.6 }, { type: 'straw', x: 3.2, z: -8.6, w: 1.5, d: 2.6 },
  { type: 'logs', x: -4.1, z: -12.1, w: 1.1, d: .75, solid: true }, { type: 'logs', x: 4.1, z: -12.1, w: 1.1, d: .75, solid: true },
  { type: 'timer', x: 1.9, z: -12.25, w: .5, d: .5, solid: true },
  // 얼음방
  { type: 'iceblock', x: -11.8, z: -11.6, w: 2, d: 1.2, solid: true }, { type: 'iceblock', x: -12.9, z: -9.4, w: 1, d: 1.6, solid: true },
  { type: 'snowman', x: -7, z: -11.9, w: .8, d: .8, solid: true },
  { type: 'icebench', x: -9.6, z: -6.2, w: 2.4, d: .6, face: 'n', solid: true },
  // 수면실
  { type: 'bed', x: 7.3, z: -11.2, w: 1.3, d: 2.1 }, { type: 'bed', x: 9.5, z: -11.2, w: 1.3, d: 2.1 }, { type: 'bed', x: 11.7, z: -11.2, w: 1.3, d: 2.1 },
  { type: 'bed', x: 9.5, z: -7.7, w: 1.3, d: 2.1 }, { type: 'bed', x: 11.7, z: -7.7, w: 1.3, d: 2.1 },
  { type: 'nightlamp', x: 13.3, z: -12.3, w: .5, d: .5, solid: true }, { type: 'shelf', x: 13.35, z: -8.6, w: .55, d: 1.8, face: 'w', solid: true },
  // 소금방
  { type: 'saltbed', x: -11.5, z: 0, w: 4.4, d: 5.2 },
  { type: 'saltlamp', x: -14.2, z: -3.2, w: .65, d: .65, solid: true }, { type: 'saltlamp', x: -14.2, z: 3.2, w: .65, d: .65, solid: true },
  { type: 'saltlamp', x: -8.9, z: -3.25, w: .5, d: .5, solid: true },
  // 매점
  { type: 'counter', x: 13.9, z: 0, w: 1.2, d: 5.4, face: 'w', solid: true },
  { type: 'fridge', x: 9.1, z: -3.35, w: 1.3, d: .7, face: 's', solid: true },
  { type: 'shoptable', x: 10.6, z: 2.2, w: 1.3, d: 1.3, solid: true },
  { type: 'stool', x: 9.5, z: 2.2, w: .5, d: .5, solid: true }, { type: 'stool', x: 11.7, z: 2.2, w: .5, d: .5, solid: true },
  // Free towels for the 양머리 mini-game.
  { type: 'towelshelf', x: 11.4, z: -3.45, w: 1.5, d: .55, face: 's', solid: true },
  // 입구 카운터
  { type: 'frontdesk', x: 14.2, z: 5.5, w: 1.6, d: .7, face: 'w', solid: true },
  // 탈의실
  { type: 'lockers', x: -7.55, z: 8.6, w: .6, d: 2.4, face: 'e', solid: true }, { type: 'lockers', x: -7.55, z: 13.5, w: .6, d: 2.4, face: 'e', solid: true },
  { type: 'bench', x: -4.6, z: 11, w: 2.4, d: .6, face: 'n', solid: true },
  // 목욕탕
  { type: 'hotpool', x: .6, z: 11.6, w: 3.2, d: 3, solid: true }, { type: 'coldpool', x: 5.4, z: 12, w: 2.6, d: 2.6, solid: true },
  { type: 'shower', x: -.6, z: 7.4, w: 1.6, d: .45, face: 's', solid: true }, { type: 'shower', x: 6.6, z: 7.4, w: 1.6, d: .45, face: 's', solid: true },
  // 세신실 (beds are low and walkable, like the 수면실 mats)
  { type: 'scrubbed', x: 11.5, z: 10, w: 2.2, d: .95 }, { type: 'scrubbed', x: 11.5, z: 13.2, w: 2.2, d: .95 },
  { type: 'pot', x: 14.5, z: 7.5, w: .7, d: .7, solid: true },
  // 사주방
  { type: 'fortunetable', x: -11.5, z: 10.6, w: 1.4, d: 1, solid: true },
  { type: 'cushion', x: -11.5, z: 11.7, w: .8, d: .7 }, { type: 'cushion', x: -11.5, z: 9.5, w: .8, d: .7 },
  { type: 'nightlamp', x: -14.5, z: 7.5, w: .5, d: .5, solid: true }, { type: 'nightlamp', x: -14.5, z: 14.5, w: .5, d: .5, solid: true }
].map(Object.freeze));

export const SPAWN = Object.freeze({ x: 0, z: 3 });

// Destination points stay in clear floor so every room is reachable.
export const DESTINATIONS = Object.freeze({
  lobby: { id: 'lobby', name: '중앙 휴게실', x: -2.5, z: 3.5, action: 'sit', arrival: '휴게실 방석에 앉았어요. 다들 여기서 모여요.' },
  hot: { id: 'hot', name: '불가마', x: -3.2, z: -8.6, action: 'sit', arrival: '불가마 안이에요. 주황빛 온기가 포근해요.' },
  salt: { id: 'salt', name: '소금방', x: -11.5, z: -.6, action: 'lie', arrival: '따끈한 소금 위에 누웠어요. 스르르…' },
  ice: { id: 'ice', name: '얼음방', x: -9.5, z: -8.4, action: 'stand', arrival: '얼음방이에요. 앗, 시원해!' },
  shop: { id: 'shop', name: '매점', x: 12.2, z: 0, action: 'stand', arrival: '매점이에요. 계란이나 식혜를 골라 보세요.' },
  entrance: { id: 'entrance', name: '입구', x: 12.2, z: 5.5, action: 'stand', arrival: '입구 카운터예요. 열쇠와 찜질복을 받아 가세요 🔑' },
  locker: { id: 'locker', name: '탈의실', x: -5, z: 9.2, action: 'stand', arrival: '탈의실이에요. 사물함 앞에서 옷을 갈아입을 수 있어요.' },
  bath: { id: 'bath', name: '목욕탕', x: .6, z: 9.6, facing: 0, action: 'sit', arrival: '온탕 앞이에요. 여기서 쉬면 온기가 두 배로 쌓여요 ♨' },
  fortune: { id: 'fortune', name: '사주방', x: -11.5, z: 11.75, facing: Math.PI, action: 'sit', arrival: '사주방이에요. 오늘의 운세를 볼 수 있어요 🔮' },
  scrub: { id: 'scrub', name: '세신실', x: 11.5, z: 11.6, action: 'stand', arrival: '세신실이에요. 침대에 누우면 시원하게 밀어 드려요.' },
  sleep: { id: 'sleep', name: '수면실', x: 7.3, z: -11.5, action: 'lie', arrival: '수면실이에요. 조용히 한숨 자요.' }
});

// The mat in front of the lobby TV, facing the screen (west).
export const TV_SEAT = Object.freeze({ id: 'tv', name: 'TV 앞 방석', x: -4.6, z: 2.4, facing: -Math.PI / 2, action: 'sit', arrival: 'TV 앞에 앉았어요. 광고를 보면 온기를 받을 수 있어요 📺' });

// Meshy towel props placed around the rooms (props.js). `y` is the surface they
// rest on, `turn` a rotation about y, `size` the longest side in metres and
// `color` an index into TOWEL_COLORS order (ivory, pink, sky, lilac, mint, yellow).
const shelfSpots = [];
for (const [row, y] of [.325, .805, 1.285].entries()) for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) shelfSpots.push({ x: 11.4 - .5 + i * .367, y: y + k * .145, z: -3.43, turn: (i + k) % 2 * .08, size: .3, color: (i * 2 + row * 3 + k) % 6 });
export const TOWEL_DECOR = Object.freeze({
  folded: [
    ...shelfSpots,
    // 수면실 수건 보관함 (faces west) and the lobby bench.
    ...[0, 1, 2].flatMap(row => [-1, 0, 1].map(i => ({ x: 12.98, y: .24 + row * .48, z: -8.6 + i * .54, turn: -Math.PI / 2, size: .32, color: (row + i + 3) % 6 }))),
    { x: -1.25, y: .37, z: 6.35, turn: .1, size: .42, color: 1 }, { x: -1.25, y: .52, z: 6.35, turn: -.05, size: .4, color: 2 }
  ],
  mat: [
    { x: 7.3, y: 0, z: -7.75, turn: Math.PI / 2, size: 1.7, color: 3 },
    { x: 1.3, y: 0, z: 4.9, turn: .25, size: 1.5, color: 4 },
    { x: -10.6, y: .06, z: 1.6, turn: Math.PI / 2, size: 1.5, color: 0 }
  ],
  pillow: [
    // On the 수면실 beds the player does not use (they bring their own pillow) and the floor mat.
    { x: 9.5, y: .1, z: -12, turn: 0, size: .62, color: 0 }, { x: 11.7, y: .1, z: -12, turn: 0, size: .62, color: 1 },
    { x: 9.5, y: .1, z: -8.5, turn: 0, size: .62, color: 2 }, { x: 11.7, y: .1, z: -8.5, turn: 0, size: .62, color: 5 },
    { x: 7.3, y: .04, z: -8.45, turn: 0, size: .6, color: 4 }
  ]
});

// Stand here, facing the towel shelf, to make a sheep cap.
export const TOWEL_SPOT = Object.freeze({ id: 'towel', name: '수건 선반', x: 11.4, z: -2.4, facing: Math.PI, action: 'stand', arrival: '수건 선반이에요. 수건을 받아 양머리를 만들어 봐요 🐑' });

// Spots with a context button when the player stands close (scene.js handles them).
export const SPOTS = Object.freeze([
  { id: 'desk', room: 'entrance', x: 13, z: 5.5, r: 2.4, label: '🔑 열쇠와 찜질복 받기' },
  { id: 'locker', room: 'locker', x: -6.6, z: 11, r: 2.6, label: '👕 사물함에서 갈아입기' },
  { id: 'fortune', room: 'fortune', x: -11.5, z: 11.4, r: 2.2, label: '🔮 오늘의 운세 보기' },
  { id: 'hotpool', room: 'bath', x: .6, z: 9.7, r: 1.5, label: '♨ 온탕에 들어가기', pool: [.6, 11.6] },
  { id: 'coldpool', room: 'bath', x: 5.4, z: 10.3, r: 1.3, label: '🧊 냉탕에 들어가기', pool: [5.4, 12] },
  { id: 'shower', room: 'bath', x: -.6, z: 8.1, r: 1, label: '🚿 샤워하기' }, { id: 'shower', room: 'bath', x: 6.6, z: 8.1, r: 1, label: '🚿 샤워하기' },
  { id: 'scrub', room: 'scrub', x: 11.5, z: 10, r: 2.4, label: '🧽 세신 받기', bed: [11.5, 10] },
  { id: 'scrub', room: 'scrub', x: 11.5, z: 13.2, r: 2.4, label: '🧽 세신 받기', bed: [11.5, 13.2] }
].map(Object.freeze));

export function roomAt(x, z) {
  for (const room of ROOMS) if (x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ) return room;
  return null;
}
