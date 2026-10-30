const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const S = await import(pathToFileURL(path.resolve(__dirname, '..', 'saju.js')).href);
  // Known day pillars.
  assert.equal(S.dayPillar(2000, 1, 1).name, '무오');
  assert.equal(S.dayPillar(1900, 1, 1).name, '갑술');
  assert.equal(S.dayPillar(2000, 1, 2).index, (S.dayPillar(2000, 1, 1).index + 1) % 60, 'Pillars advance one a day');
  assert.equal(S.relation('목', '목'), 'same'); assert.equal(S.relation('목', '화'), 'output'); assert.equal(S.relation('목', '토'), 'wealth');
  assert.equal(S.relation('목', '금'), 'power'); assert.equal(S.relation('목', '수'), 'support');
  const day = new Date('2026-10-31T03:00:00Z');
  const a = S.fortune('1995-05-17', 9, day), b = S.fortune('1995-05-17', 9, day);
  assert.deepEqual(a, b, 'Same input, same fortune');
  for (const v of Object.values(a.scores)) assert(v >= 1 && v <= 5);
  assert(a.number >= 1 && a.number <= 9);
  assert.notDeepEqual(S.fortune('1995-05-17', 9, day), S.fortune('1995-05-17', 9, new Date('2026-11-01T03:00:00Z')), 'A new day, a new fortune');
  assert.equal(S.fortune('nope', null), null);
  const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, removeItem(k) { delete this.d[k]; } };
  S.saveBirth({ date: '1995-05-17', time: '09:30' }, mem); assert.equal(S.loadBirth(mem).date, '1995-05-17');
  S.saveBirth(null, mem); assert.equal(S.loadBirth(mem), null, 'Birth date can be forgotten');
  console.log('PASS: 사주 day pillars (2000-01-01 무오, 1900-01-01 갑술), five-element relations, deterministic daily fortune, device-only birth date save/forget.');
})().catch(error => { console.error(error); process.exit(1); });
