const assert = require('node:assert/strict');
(async () => {
  const { isWalkable, clampToWalkable, planPath, stepMovement, segmentClear, NAV_BOUNDS, OBSTACLES, WALKABLE } = await import('../navigation.js');
  const { DESTINATIONS, SPAWN, ROOMS, roomAt } = await import('../world.js');
  const started = Date.now();
  assert(isWalkable(SPAWN.x, SPAWN.z), 'Spawn point is clear');
  const destinations = [SPAWN, ...Object.values(DESTINATIONS)];
  for (const place of Object.values(DESTINATIONS)) {
    assert(isWalkable(place.x, place.z), `${place.id} destination is clear floor`);
    assert.equal(roomAt(place.x, place.z)?.id, place.id, `${place.id} destination lies inside its room`);
  }
  assert.deepEqual(ROOMS.map(room => room.id).sort(), Object.keys(DESTINATIONS).sort(), 'Every room has a destination');
  const checkRoute = (start, end) => {
    const route = planPath(start, end), safeEnd = clampToWalkable(end.x, end.z);
    if (Math.hypot(start.x - safeEnd.x, start.z - safeEnd.z) > 1e-6) assert(route.length > 0, `Reachable ${JSON.stringify(start)} → ${JSON.stringify(end)}`);
    let previous = clampToWalkable(start.x, start.z);
    for (const next of route) {
      const samples = Math.max(2, Math.ceil(Math.hypot(next.x - previous.x, next.z - previous.z) / .01));
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        assert(isWalkable(previous.x + (next.x - previous.x) * t, previous.z + (next.z - previous.z) * t), 'Segments stay on floor, through doors, and never cut furniture');
      }
      previous = next;
    }
    assert(Math.hypot(previous.x - safeEnd.x, previous.z - safeEnd.z) < 1e-6, 'Route reaches safe endpoint');
    assert.deepEqual(planPath(start, end), route, 'Deterministic route');
  };
  for (const start of destinations) for (const end of destinations) checkRoute(start, end);
  // Blocked or off-map taps snap to the nearest reachable floor.
  for (const end of [{ x: 0, z: -10.2 }, { x: 3.8, z: 2.6 }, { x: 13.9, z: 0 }, { x: -8, z: -4.5 }, { x: 99, z: 99 }, { x: NaN, z: Infinity }, { x: 0, z: -5 }]) checkRoute(SPAWN, end);
  assert(!isWalkable(NaN, 0)); assert(!isWalkable(Infinity, 0));
  assert(!isWalkable(-8, 3), 'Walls between rooms block walking'); assert(isWalkable(-8, 0), 'Doorways are open');
  for (const rect of OBSTACLES) assert(!isWalkable((rect.minX + rect.maxX) / 2, (rect.minZ + rect.maxZ) / 2), `${rect.type} blocks walking`);
  for (const point of [{ x: NaN, z: -Infinity }, { x: 200, z: 200 }, { x: -200, z: -200 }, { x: 0, z: -10.2 }]) {
    const fixed = clampToWalkable(point.x, point.z); assert(isWalkable(fixed.x, fixed.z));
  }
  assert(!segmentClear({ x: -4, z: 0 }, { x: -12, z: 3 }), 'A straight line through a wall is rejected');
  // A table sits at x 2.85..4.75 (inflated 2.55..5.05), z 2.075..3.125 (inflated 1.775..3.425).
  const stopped = stepMovement({ x: 2.4, z: 2.6 }, 3, 0);
  assert(stopped.x <= 2.55 && stopped.x > 2.4, 'Large step cannot tunnel through tables');
  const sliding = stepMovement({ x: 2.5, z: 2.6 }, .3, -.2);
  assert(sliding.x < 2.55 && Math.abs(sliding.z - 2.4) < 1e-9, 'Input slides along a table edge');
  const wall = stepMovement({ x: -6, z: 1.3 }, -10, 0);
  assert(Math.abs(wall.x - WALKABLE[0].minX) < .01, 'Movement glides up to a wall without passing it');
  const door = stepMovement({ x: -7, z: 0 }, -1.5, 0);
  assert(door.x < -8, 'Joystick walks straight through an open doorway');
  assert.deepEqual(stepMovement(SPAWN, NaN, Infinity), SPAWN);
  assert(Number.isFinite(NAV_BOUNDS.minX) && NAV_BOUNDS.maxX > 14);
  console.log(`PASS: ${destinations.length ** 2} room-to-room routes through doors, blocked/off-map targets, furniture blocking, exact segment checks, wall glide, door walking, anti-tunneling (${Date.now() - started} ms).`);
})().catch(error => { console.error(error); process.exitCode = 1; });
