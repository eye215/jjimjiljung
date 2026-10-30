const assert = require('node:assert/strict');
(async () => {
  const { isWalkable, clampToWalkable, planPath, stepMovement, NAV_BOUNDS } = await import('../navigation.js');
  const rest = { x: .2, z: 2.4 };
  const destinations = [{ x: -3.7, z: -1.7 }, { x: -2.3, z: -2 }, { x: .35, z: -1.7 }, { x: 3.2, z: -2 }, rest];
  const checkRoute = (start, end) => {
    const route = planPath(start, end), safeEnd = clampToWalkable(end.x, end.z);
    if (Math.hypot(start.x - safeEnd.x, start.z - safeEnd.z) > 1e-6) assert(route.length > 0, 'Destination reachable');
    let previous = clampToWalkable(start.x, start.z);
    for (const next of route) {
      const samples = Math.max(2, Math.ceil(Math.hypot(next.x - previous.x, next.z - previous.z) / .005));
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        assert(isWalkable(previous.x + (next.x - previous.x) * t, previous.z + (next.z - previous.z) * t), 'Segments do not cross furniture or cut corners');
      }
      previous = next;
    }
    assert(Math.hypot(previous.x - safeEnd.x, previous.z - safeEnd.z) < 1e-6, 'Route reaches safe endpoint');
    assert.deepEqual(planPath(start, end), route, 'Deterministic route');
  };
  for (const start of destinations) for (const end of destinations) checkRoute(start, end);
  for (const end of [{ x: 2, z: 0 }, { x: 4, z: .4 }, { x: 2, z: 2.5 }, { x: 99, z: 99 }, { x: NaN, z: Infinity }]) checkRoute(rest, end);
  assert(!isWalkable(NaN, 0)); assert(!isWalkable(Infinity, 0));
  for (const point of [{ x: NaN, z: -Infinity }, { x: 200, z: 200 }, { x: -200, z: -200 }]) {
    const fixed = clampToWalkable(point.x, point.z); assert(isWalkable(fixed.x, fixed.z));
  }
  const stopped = stepMovement({ x: 1.2, z: 0 }, 3, 0);
  assert.equal(stopped.x, 1.2, 'Large step cannot tunnel through tables');
  const sliding = stepMovement({ x: 1.2, z: 0 }, .5, -.2);
  assert.equal(sliding.x, 1.2); assert.equal(sliding.z, -.2, 'Input slides along table edge');
  const bounds = stepMovement({ x: -4.6, z: -2.3 }, -100, -100);
  assert.deepEqual(bounds, { x: NAV_BOUNDS.minX, z: NAV_BOUNDS.minZ });
  assert.deepEqual(stepMovement(rest, NaN, Infinity), rest);
  console.log('PASS: all destination pairs, blocked targets, safe continuous route segments, deterministic routes, finite bounds, joystick sliding and anti-tunneling.');
})().catch(error => { console.error(error); process.exitCode = 1; });
