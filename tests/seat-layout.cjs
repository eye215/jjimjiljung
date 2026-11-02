const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const { ROOMS, FURNITURE, SCRUB_BEDS, POOL_SEATS } =
    await import(pathToFileURL(path.join(__dirname, '../world.js')).href);
  const scrub = ROOMS.find(room => room.id === 'scrub');
  assert.equal(SCRUB_BEDS.length, 5, 'Five scrub stations exist');
  const actual = FURNITURE.filter(item => item.type === 'scrubbed');
  assert.equal(actual.length, 5, 'All scrub stations are rendered');
  for (const b of SCRUB_BEDS) {
    assert(actual.some(a => a.x === b.x && a.z === b.z), 'Every scrub bed is visualized');
    assert(b.x - 1.1 > scrub.minX && b.x + 1.1 < scrub.maxX, 'Scrub table stays inside room horizontally');
    assert(b.z - .475 > scrub.minZ && b.z + .475 < scrub.maxZ, 'Scrub table stays inside room vertically');
  }
  for (let i = 0; i < SCRUB_BEDS.length; i++) for (let j = i + 1; j < SCRUB_BEDS.length; j++) {
    const a = SCRUB_BEDS[i], b = SCRUB_BEDS[j];
    assert(Math.abs(a.x - b.x) >= 2.2 || Math.abs(a.z - b.z) >= .95, 'Scrub beds do not physically overlap');
    assert(Math.hypot(a.x - b.x, a.z - b.z) > .82, 'Distinct scrub spots cannot share a character');
  }
  for (const kind of ['hotpool', 'coldpool']) {
    const pool = FURNITURE.find(item => item.type === kind);
    const seats = POOL_SEATS[kind];
    assert.equal(seats.length, 4, 'Each pool has four individual visitor spots');
    for (const [x, z] of seats) {
      assert(Math.abs(x - pool.x) < pool.w / 2 - .16 && Math.abs(z - pool.z) < pool.d / 2 - .16,
        'All pool positions stay inside the water');
    }
    for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++)
      assert(Math.hypot(seats[i][0] - seats[j][0], seats[i][1] - seats[j][1]) > .82, 'Pool seats cannot overlap');
  }
  console.log('PASS five scrub tables and individual hot/cold pool spots: render data, room boundaries, no fixed overlaps');
})().catch(error => { console.error(error); process.exitCode = 1; });
