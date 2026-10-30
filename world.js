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
  { id: 'shop', name: '매점', note: '계란 · 식혜', minX: 8, maxX: 15, minZ: -4, maxZ: 4, wall: 'shop', floor: 'tile', light: '#ffd28a', ambient: '#fff0d6' }
].map(Object.freeze));

// axis 'z': opening in a wall running along x at z = line. axis 'x': the reverse.
export const DOORS = Object.freeze([
  { id: 'hot', axis: 'z', line: -5, at: 0, width: 2.4, sign: '불가마' },
  { id: 'ice', axis: 'z', line: -5, at: -6.5, width: 2, sign: '얼음방' },
  { id: 'sleep', axis: 'z', line: -5, at: 6.5, width: 2, sign: '수면실' },
  { id: 'salt', axis: 'x', line: -8, at: 0, width: 2.4, sign: '소금방' },
  { id: 'shop', axis: 'x', line: 8, at: 0, width: 2.4, sign: '매점' }
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
  { type: 'stool', x: 9.5, z: 2.2, w: .5, d: .5, solid: true }, { type: 'stool', x: 11.7, z: 2.2, w: .5, d: .5, solid: true }
].map(Object.freeze));

export const SPAWN = Object.freeze({ x: 0, z: 3 });

// Destination points stay in clear floor so every room is reachable.
export const DESTINATIONS = Object.freeze({
  lobby: { id: 'lobby', name: '중앙 휴게실', x: -2.5, z: 3.5, action: 'sit', arrival: '휴게실 방석에 앉았어요. 다들 여기서 모여요.' },
  hot: { id: 'hot', name: '불가마', x: -3.2, z: -8.6, action: 'sit', arrival: '불가마 안이에요. 주황빛 온기가 포근해요.' },
  salt: { id: 'salt', name: '소금방', x: -11.5, z: -.6, action: 'lie', arrival: '따끈한 소금 위에 누웠어요. 스르르…' },
  ice: { id: 'ice', name: '얼음방', x: -9.5, z: -8.4, action: 'stand', arrival: '얼음방이에요. 앗, 시원해!' },
  shop: { id: 'shop', name: '매점', x: 12.2, z: 0, action: 'stand', arrival: '매점이에요. 계란이나 식혜를 골라 보세요.' },
  sleep: { id: 'sleep', name: '수면실', x: 7.3, z: -11.5, action: 'lie', arrival: '수면실이에요. 조용히 한숨 자요.' }
});

// The mat in front of the lobby TV, facing the screen (west).
export const TV_SEAT = Object.freeze({ id: 'tv', name: 'TV 앞 방석', x: -4.6, z: 2.4, facing: -Math.PI / 2, action: 'sit', arrival: 'TV 앞에 앉았어요. 광고를 보면 온기를 받을 수 있어요 📺' });

export function roomAt(x, z) {
  for (const room of ROOMS) if (x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ) return room;
  return null;
}
