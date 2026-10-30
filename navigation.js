// Navigation is deliberately independent of Three.js and the camera crop.
// These rectangles match the furniture footprints in the fixed background.
export const NAV_BOUNDS = Object.freeze({ minX: -4.7, maxX: 4.7, minZ: -2.4, maxZ: 2.6 });
export const OBSTACLES = Object.freeze([
  Object.freeze({ minX: 1.45, maxX: 2.95, minZ: -.7, maxZ: .75 }),
  Object.freeze({ minX: 3.05, maxX: 4.7, minZ: -.7, maxZ: 1.5 }),
  Object.freeze({ minX: 1.65, maxX: 2.8, minZ: 2.05, maxZ: 2.6 })
]);
const GAP = .025;
const finite = value => Number.isFinite(value) ? value : 0;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const squaredDistance = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

export function isWalkable(x, z) {
  return Number.isFinite(x) && Number.isFinite(z)
    && x >= NAV_BOUNDS.minX && x <= NAV_BOUNDS.maxX
    && z >= NAV_BOUNDS.minZ && z <= NAV_BOUNDS.maxZ
    && !OBSTACLES.some(rect => x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ);
}

export function clampToWalkable(x, z) {
  const point = {
    x: clamp(finite(x), NAV_BOUNDS.minX, NAV_BOUNDS.maxX),
    z: clamp(finite(z), NAV_BOUNDS.minZ, NAV_BOUNDS.maxZ)
  };
  if (isWalkable(point.x, point.z)) return point;
  // Candidate projections to every obstacle edge handle touching rectangles
  // and furniture flush with the room boundary without iterative oscillation.
  const xs = [point.x, NAV_BOUNDS.minX, NAV_BOUNDS.maxX];
  const zs = [point.z, NAV_BOUNDS.minZ, NAV_BOUNDS.maxZ];
  for (const rect of OBSTACLES) {
    xs.push(rect.minX - GAP, rect.maxX + GAP);
    zs.push(rect.minZ - GAP, rect.maxZ + GAP);
  }
  let nearest = { x: 0, z: 0 }, best = Infinity;
  for (const cx of xs) for (const cz of zs) {
    if (!isWalkable(cx, cz)) continue;
    const candidate = { x: cx, z: cz }, distance = squaredDistance(candidate, point);
    if (distance < best) { nearest = candidate; best = distance; }
  }
  return nearest;
}

function segmentClear(a, b) {
  if (!isWalkable(a.x, a.z) || !isWalkable(b.x, b.z)) return false;
  for (const rect of OBSTACLES) {
    let enter = 0, leave = 1, intersects = true;
    for (const [axis, low, high] of [['x', rect.minX, rect.maxX], ['z', rect.minZ, rect.maxZ]]) {
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-12) {
        if (a[axis] < low || a[axis] > high) { intersects = false; break; }
      } else {
        const t1 = (low - a[axis]) / delta, t2 = (high - a[axis]) / delta;
        enter = Math.max(enter, Math.min(t1, t2));
        leave = Math.min(leave, Math.max(t1, t2));
        if (enter > leave) { intersects = false; break; }
      }
    }
    if (intersects) return false;
  }
  return true;
}

const axisValues = (min, max) => {
  const values = [];
  for (let value = min; value < max - 1e-8; value += .25) values.push(Number(value.toFixed(4)));
  values.push(max); return values;
};
const xs = axisValues(NAV_BOUNDS.minX, NAV_BOUNDS.maxX);
const zs = axisValues(NAV_BOUNDS.minZ, NAV_BOUNDS.maxZ);
const grid = xs.flatMap((x, column) => zs.map((z, row) => ({ x, z, column, row })));
const valid = grid.map(point => isWalkable(point.x, point.z));
function closestVisible(point) {
  let index = -1, best = Infinity;
  for (let i = 0; i < grid.length; i++) {
    if (!valid[i]) continue;
    const distance = squaredDistance(point, grid[i]);
    if (distance < best && segmentClear(point, grid[i])) { index = i; best = distance; }
  }
  return index;
}

export function planPath(start, end) {
  const from = clampToWalkable(start?.x, start?.z), to = clampToWalkable(end?.x, end?.z);
  if (squaredDistance(from, to) < 1e-10) return [];
  if (segmentClear(from, to)) return [to];
  const first = closestVisible(from), last = closestVisible(to);
  if (first < 0 || last < 0) return [];
  const cost = new Float64Array(grid.length).fill(Infinity);
  const parent = new Int32Array(grid.length).fill(-1);
  const closed = new Uint8Array(grid.length), open = [first];
  cost[first] = 0;
  while (open.length) {
    let best = 0, bestScore = Infinity;
    for (let i = 0; i < open.length; i++) {
      const score = cost[open[i]] + Math.sqrt(squaredDistance(grid[open[i]], grid[last]));
      if (score < bestScore) { best = i; bestScore = score; }
    }
    const current = open.splice(best, 1)[0];
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
      if (!open.includes(next)) open.push(next);
    }
  }
  return [];
}

export function stepMovement(position, dx, dz) {
  const from = clampToWalkable(position?.x, position?.z);
  const deltaX = finite(dx), deltaZ = finite(dz);
  const desired = {
    x: clamp(from.x + deltaX, NAV_BOUNDS.minX, NAV_BOUNDS.maxX),
    z: clamp(from.z + deltaZ, NAV_BOUNDS.minZ, NAV_BOUNDS.maxZ)
  };
  if (segmentClear(from, desired)) return desired;
  const alongX = { x: desired.x, z: from.z }, alongZ = { x: from.x, z: desired.z };
  // Sliding never teleports through a table, even for a large input step.
  if (Math.abs(deltaX) >= Math.abs(deltaZ)) {
    if (segmentClear(from, alongX)) return alongX;
    if (segmentClear(from, alongZ)) return alongZ;
  } else {
    if (segmentClear(from, alongZ)) return alongZ;
    if (segmentClear(from, alongX)) return alongX;
  }
  return from;
}
