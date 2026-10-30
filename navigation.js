// Navigation is deliberately independent of Three.js and rendering.
// Walkable space is the union of room floors and doorway passages, minus
// furniture footprints. Every rectangle is already inflated by the actor radius,
// so a point that is walkable keeps the whole plush body clear of walls and props.
import { ROOMS, DOORS, FURNITURE, WALL_THICKNESS, ACTOR_RADIUS } from './world.js?v=rpg-15';

const INSET = WALL_THICKNESS / 2 + ACTOR_RADIUS;
export const WALKABLE = Object.freeze([
  ...ROOMS.map(room => Object.freeze({ id: room.id, minX: room.minX + INSET, maxX: room.maxX - INSET, minZ: room.minZ + INSET, maxZ: room.maxZ - INSET })),
  ...DOORS.map(door => {
    const half = door.width / 2 - ACTOR_RADIUS, reach = INSET + .25;
    return Object.freeze(door.axis === 'z'
      ? { id: 'door:' + door.id, minX: door.at - half, maxX: door.at + half, minZ: door.line - reach, maxZ: door.line + reach }
      : { id: 'door:' + door.id, minX: door.line - reach, maxX: door.line + reach, minZ: door.at - half, maxZ: door.at + half });
  })
]);
export const OBSTACLES = Object.freeze(FURNITURE.filter(item => item.solid).map(item => Object.freeze({
  type: item.type,
  minX: item.x - item.w / 2 - ACTOR_RADIUS, maxX: item.x + item.w / 2 + ACTOR_RADIUS,
  minZ: item.z - item.d / 2 - ACTOR_RADIUS, maxZ: item.z + item.d / 2 + ACTOR_RADIUS
})));
export const NAV_BOUNDS = Object.freeze(WALKABLE.reduce((bounds, rect) => ({
  minX: Math.min(bounds.minX, rect.minX), maxX: Math.max(bounds.maxX, rect.maxX),
  minZ: Math.min(bounds.minZ, rect.minZ), maxZ: Math.max(bounds.maxZ, rect.maxZ)
}), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }));

const GAP = .025, EPS = 1e-9;
const finite = value => Number.isFinite(value) ? value : 0;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const squaredDistance = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const inside = (rect, x, z) => x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;

export function isWalkable(x, z) {
  return Number.isFinite(x) && Number.isFinite(z)
    && WALKABLE.some(rect => inside(rect, x, z))
    && !OBSTACLES.some(rect => inside(rect, x, z));
}

// Parametric [enter, leave] range of segment a→b inside a closed rectangle.
function clip(rect, a, b) {
  let enter = 0, leave = 1;
  for (const [axis, low, high] of [['x', rect.minX, rect.maxX], ['z', rect.minZ, rect.maxZ]]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-12) {
      if (a[axis] < low || a[axis] > high) return null;
    } else {
      const t1 = (low - a[axis]) / delta, t2 = (high - a[axis]) / delta;
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
      if (enter > leave) return null;
    }
  }
  return [enter, leave];
}

// Exact test: the whole segment lies in the union of walkable rectangles and
// touches no furniture. Sampling would let long routes clip table corners.
export function segmentClear(a, b) {
  if (!isWalkable(a.x, a.z) || !isWalkable(b.x, b.z)) return false;
  for (const rect of OBSTACLES) if (clip(rect, a, b)) return false;
  const spans = [];
  for (const rect of WALKABLE) { const span = clip(rect, a, b); if (span) spans.push(span); }
  spans.sort((p, q) => p[0] - q[0]);
  let covered = 0;
  for (const [enter, leave] of spans) {
    if (enter > covered + EPS) return false;
    covered = Math.max(covered, leave);
    if (covered >= 1 - EPS) return true;
  }
  return covered >= 1 - EPS;
}

export function clampToWalkable(x, z) {
  const point = { x: clamp(finite(x), NAV_BOUNDS.minX, NAV_BOUNDS.maxX), z: clamp(finite(z), NAV_BOUNDS.minZ, NAV_BOUNDS.maxZ) };
  if (isWalkable(point.x, point.z)) return point;
  // Candidates: the nearest point of every floor rectangle, and the point pushed
  // just outside every furniture edge, combined so corners are covered as well.
  const xs = [point.x], zs = [point.z];
  for (const rect of WALKABLE) { xs.push(clamp(point.x, rect.minX, rect.maxX)); zs.push(clamp(point.z, rect.minZ, rect.maxZ)); }
  for (const rect of OBSTACLES) { xs.push(rect.minX - GAP, rect.maxX + GAP); zs.push(rect.minZ - GAP, rect.maxZ + GAP); }
  let nearest = null, best = Infinity;
  for (const cx of xs) for (const cz of zs) {
    if (!isWalkable(cx, cz)) continue;
    const distance = (cx - point.x) ** 2 + (cz - point.z) ** 2;
    if (distance < best) { nearest = { x: cx, z: cz }; best = distance; }
  }
  return nearest || { x: WALKABLE[0].minX + GAP, z: WALKABLE[0].minZ + GAP };
}

const STEP = .25;
const axisValues = (min, max) => {
  const values = [];
  for (let value = min; value < max - 1e-8; value += STEP) values.push(Number(value.toFixed(4)));
  values.push(max); return values;
};
const xs = axisValues(NAV_BOUNDS.minX, NAV_BOUNDS.maxX);
const zs = axisValues(NAV_BOUNDS.minZ, NAV_BOUNDS.maxZ);
const grid = xs.flatMap((x, column) => zs.map((z, row) => ({ x, z, column, row })));
const valid = grid.map(point => isWalkable(point.x, point.z));

function closestVisible(point) {
  const candidates = [];
  for (let i = 0; i < grid.length; i++) if (valid[i]) candidates.push([squaredDistance(point, grid[i]), i]);
  candidates.sort((p, q) => p[0] - q[0]);
  for (const [, index] of candidates) if (segmentClear(point, grid[index])) return index;
  return -1;
}

// Minimal binary heap keyed by estimated route length.
function pushHeap(heap, item) {
  heap.push(item); let i = heap.length - 1;
  while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
}
function popHeap(heap) {
  const top = heap[0], last = heap.pop();
  if (heap.length) {
    heap[0] = last; let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1; let m = i;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
    }
  }
  return top;
}

export function planPath(start, end) {
  const from = clampToWalkable(start?.x, start?.z), to = clampToWalkable(end?.x, end?.z);
  if (squaredDistance(from, to) < 1e-10) return [];
  if (segmentClear(from, to)) return [to];
  const first = closestVisible(from), last = closestVisible(to);
  if (first < 0 || last < 0) return [];
  const cost = new Float64Array(grid.length).fill(Infinity);
  const parent = new Int32Array(grid.length).fill(-1);
  const closed = new Uint8Array(grid.length), open = [];
  cost[first] = 0; pushHeap(open, [Math.sqrt(squaredDistance(grid[first], grid[last])), first]);
  while (open.length) {
    const [, current] = popHeap(open);
    if (closed[current]) continue;
    if (current === last) {
      const chain = [to];
      for (let node = last; node >= 0; node = parent[node]) chain.push({ x: grid[node].x, z: grid[node].z });
      chain.push(from); chain.reverse();
      // Skip only points with a verified clear segment; never cut furniture corners.
      const result = []; let anchor = 0;
      while (anchor < chain.length - 1) {
        let next = chain.length - 1;
        while (next > anchor + 1 && !segmentClear(chain[anchor], chain[next])) next--;
        if (squaredDistance(chain[anchor], chain[next]) > 1e-10) result.push(chain[next]);
        anchor = next;
      }
      return result;
    }
    closed[current] = 1;
    const point = grid[current];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue;
      const column = point.column + dx, row = point.row + dz;
      if (column < 0 || column >= xs.length || row < 0 || row >= zs.length) continue;
      const next = column * zs.length + row;
      if (!valid[next] || closed[next] || !segmentClear(point, grid[next])) continue;
      const candidate = cost[current] + Math.sqrt(squaredDistance(point, grid[next]));
      if (candidate >= cost[next]) continue;
      cost[next] = candidate; parent[next] = current;
      pushHeap(open, [candidate + Math.sqrt(squaredDistance(grid[next], grid[last])), next]);
    }
  }
  return [];
}

export function stepMovement(position, dx, dz) {
  const from = clampToWalkable(position?.x, position?.z);
  const deltaX = finite(dx), deltaZ = finite(dz);
  const desired = { x: from.x + deltaX, z: from.z + deltaZ };
  if (segmentClear(from, desired)) return desired;
  const alongX = { x: desired.x, z: from.z }, alongZ = { x: from.x, z: desired.z };
  // Sliding never teleports through a table, even for a large input step.
  const order = Math.abs(deltaX) >= Math.abs(deltaZ) ? [alongX, alongZ] : [alongZ, alongX];
  for (const candidate of order) if (squaredDistance(candidate, from) > 1e-12 && segmentClear(from, candidate)) return candidate;
  // Glide up to the wall instead of stopping a few centimetres short of it.
  for (const candidate of order) {
    let low = 0, high = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (low + high) / 2, probe = { x: from.x + (candidate.x - from.x) * mid, z: from.z + (candidate.z - from.z) * mid };
      if (segmentClear(from, probe)) low = mid; else high = mid;
    }
    if (low > .01) return { x: from.x + (candidate.x - from.x) * low, z: from.z + (candidate.z - from.z) * low };
  }
  return from;
}
