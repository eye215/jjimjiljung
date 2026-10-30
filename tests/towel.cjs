const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(404).end();
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.png': 'image/png' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain');
    res.end(data);
  });
});
const memory = (seed = {}) => { const data = { ...seed }; return { getItem: k => k in data ? data[k] : null, setItem: (k, v) => { data[k] = String(v); }, data }; };

(async () => {
  // ---------- Outfit rules (no browser needed) ----------
  const O = await import(pathToFileURL(path.join(root, 'outfit.js')).href);
  const sample = O.randomOutfit(O.seeded(7), { hasTowel: true, wear: true });
  assert.deepEqual(O.decodeOutfit(O.encodeOutfit(sample)), { top: sample.top, bottom: sample.bottom, towel: sample.towel, hasTowel: true, wear: true, shoulder: false, shoulderColor: sample.towel }, 'Outfit code round-trips');
  assert.equal(O.decodeOutfit('ff0000.00ff00.0000ff.2').wear, false, 'Wearing needs a towel');
  for (const bad of ['', 'red', 'zzzzzz.000000.000000.1', '000000.000000.000000.9', '<b>.x', null, 42]) assert.equal(O.decodeOutfit(bad), null, `Rejects ${bad}`);
  assert.equal(O.decodeOutfit('lilac').hasTowel, true, 'Old palette names still decode');
  const scarf = O.decodeOutfit(O.encodeOutfit({ ...sample, shoulder: true, shoulderColor: '#a8e1cf' }));
  assert.equal(scarf.shoulder && scarf.shoulderColor, '#a8e1cf', 'Shoulder towel round-trips');
  assert.equal(O.decodeOutfit('ff0000.00ff00.0000ff.5').shoulder, false, 'A shoulder flag needs its colour');
  const fresh = memory(); const newcomer = O.loadOutfit(fresh);
  assert.equal(newcomer.hasTowel, false, 'Newcomers start without a towel cap');
  assert.deepEqual(O.loadOutfit(fresh), newcomer, 'The outfit is saved');
  const legacy = memory({ 'jjimjiljung-outfit': 'mint' }); const migrated = O.loadOutfit(legacy);
  assert.equal(migrated.hasTowel && migrated.wear, true, 'Returning visitors keep their towel cap');
  assert.equal(migrated.top, '#bdcaa2', 'Returning visitors keep their colours');
  assert(legacy.data['jjimjiljung-outfit-v2'], 'Migration is saved');
  // My towel collection: made or received towels are kept, a swapped-away one leaves.
  let mineList = O.addTowel(O.randomOutfit(O.seeded(3)), '#111111');
  mineList = O.addTowel(mineList, '#222222');
  assert.deepEqual(mineList.towels, ['#111111', '#222222']); assert.equal(mineList.towel, '#222222');
  assert.equal(O.pickTowel(mineList, () => 0), '#111111', 'Re-dye prefers another towel I own');
  mineList = O.addTowel(O.removeTowel(mineList, '#222222'), '#333333');
  assert.deepEqual(mineList.towels, ['#111111', '#333333'], 'A swapped towel leaves my list');
  const worn = O.removeTowel({ ...mineList, shoulderColor: '#333333' }, '#333333');
  assert.equal(worn.shoulderColor, '#111111', 'A shoulder towel given away switches to one I still own');
  const plain = O.randomOutfit(); assert.equal(O.pickTowel(plain), plain.towel, 'No towels, nothing to pick');
  let many = O.randomOutfit(); for (let i = 0; i < 30; i++) many = O.addTowel(many, '#0000' + String(i).padStart(2, '0'));
  assert.equal(many.towels.length, O.MAX_TOWELS, 'The collection is capped');
  assert.deepEqual(O.loadOutfit(legacy).towels, ['#b7c89a'], 'A migrated cap is in the collection');
  // Tops, bottoms and towels are drawn independently, across the whole colour wheel.
  const rnd = O.seeded(99), hues = { green: 0, total: 0 }, seen = new Set();
  for (let i = 0; i < 3000; i++) {
    const color = O.randomPart(['top', 'bottom', 'towel'][i % 3], rnd); assert.match(color, /^#[0-9a-f]{6}$/); seen.add(color);
    const [r, g, b] = [1, 3, 5].map(k => parseInt(color.slice(k, k + 2), 16)); const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max - min < 12) continue; hues.total++;
    if (g === max && (g - Math.max(r, b)) > (max - min) * .25) hues.green++;
  }
  assert(seen.size > 1800, 'Colours are generated, not a small fixed palette');
  assert(hues.green / hues.total < .25, `Green is not over-picked (${(hues.green / hues.total * 100).toFixed(0)}%)`);

  // ---------- Towel game and a towel trade between two visitors ----------
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = (process.env.TEST_URL || `http://127.0.0.1:${server.address().port}/`) + '?net=local';
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}), args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await context.route('**/scene.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + `
window.__tw = {
  outfit: () => ({ ...outfit }), plush: kit.plush, wound: () => towelGame.wound, decor: () => viewport.dataset.decor || '', status: () => social.status, remotes: () => [...social.remotes.values()].map(r => ({ name: r.name, placed: r.placed, outfit: r.outfit, x: r.character.root.position.x, z: r.character.root.position.z })),
  pickAt: (x, y) => { const b = viewport.getBoundingClientRect(); raycaster.setFromCamera(new THREE.Vector2((x - b.left) / b.width * 2 - 1, -(y - b.top) / b.height * 2 + 1), camera); return social.pick(raycaster)?.name || null; },
  give: color => applyOutfit(addTowel(outfit, color)),
  tp: (x, z) => { route.length = 0; hero.position.set(x, 0, z); view.focus.set(x, 0, z); target.copy(hero.position); },
  near: () => Math.hypot(hero.position.x - TOWEL_SPOT.x, hero.position.z - TOWEL_SPOT.z),
  screenOf: name => { const r = [...social.remotes.values()].find(r => r.name === name); const v = r.character.root.position.clone(); v.y = .55; v.project(camera); const b = viewport.getBoundingClientRect(); return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height }; }
};` });
    });
    await context.addInitScript(() => { if (!localStorage.getItem('jjimjiljung-nickname')) localStorage.setItem('jjimjiljung-nickname', '보리'); });
    const errors = [];
    const open = async name => {
      const page = await context.newPage(); page.setDefaultTimeout(120000);
      page.on('pageerror', error => { errors.push(name + ': ' + error.message); console.log('PAGEERROR', name, error.message); });
      await page.goto(base); await page.waitForSelector('#viewport[data-ready="true"]');
      await page.waitForFunction(() => window.__tw.status() === 'online');
      return page;
    };
    const a = await open('보리');
    assert.equal(await a.locator('#cap-toggle').isHidden(), true, 'No cap toggle before making one');
    // The newcomer pointer walks to the 매점 towel shelf and opens the game there.
    await a.locator('#towel-nudge').waitFor({ state: 'visible' });
    await a.locator('#towel-nudge button').click();
    await a.locator('#towel-game').waitFor({ state: 'visible', timeout: 120000 });
    assert((await a.evaluate(() => window.__tw.near())) < .4, 'Walked to the towel shelf');
    assert.match(await a.locator('#towel-step').textContent(), /1\/3/);
    await a.screenshot({ path: path.join(output, 'towel-fold.png') });
    // Step 1: swipe down to fold (a keyboard press does the same).
    const cloth = await a.locator('.towel-cloth').boundingBox();
    await a.mouse.move(cloth.x + cloth.width / 2, cloth.y + 20); await a.mouse.down();
    await a.mouse.move(cloth.x + cloth.width / 2, cloth.y + 120, { steps: 6 }); await a.mouse.up();
    await a.locator('#towel-step', { hasText: '2/3' }).waitFor();
    // Step 2: left and right in turn; pressing the same side twice does not count.
    assert.equal(await a.evaluate(() => window.__tw.plush), true, 'The Meshy plush GLB (WebP textures) loads');
    const strip = () => a.locator('.roll-strip').evaluate(el => el.getBoundingClientRect().width);
    const before = await strip();
    await a.locator('[data-side=left]').click(); await a.locator('[data-side=left]').click();
    assert.match(await a.locator('#towel-note').textContent(), /반대쪽/);
    assert.equal(await a.locator('.towel-progress').getAttribute('aria-valuenow'), '1');
    assert.deepEqual(await a.evaluate(() => window.__tw.wound()), { left: 1, right: 0 }, 'Only the tapped side rolls, and a repeat tap does not');
    assert.equal(await a.locator('.roll-scene').getAttribute('data-left'), '1');
    // Software rendering can stretch the 0.38 s transition, so wait for it to settle.
    await a.waitForFunction(w => document.querySelector('.roll-strip').getBoundingClientRect().width < w - 8, before, { timeout: 15000 });
    // Fast alternating taps: the shapes follow the count, never more than five turns a side.
    for (let i = 0; i < 5; i++) { await a.locator('[data-side=right]').click(); if (i < 4) await a.locator('[data-side=left]').click(); }
    assert.deepEqual(await a.evaluate(() => window.__tw.wound()), { left: 5, right: 5 });
    await a.locator('#towel-step', { hasText: '3/3' }).waitFor();
    assert.equal(await a.locator('.towel-cap .bun').count(), 2, 'The finished cap shows both rolls');
    await a.screenshot({ path: path.join(output, 'towel-done.png') });
    await a.locator('#towel-finish').click();
    let mine = await a.evaluate(() => window.__tw.outfit());
    assert.equal(mine.hasTowel && mine.wear, true, 'Made and wearing the sheep cap');
    assert.equal(await a.locator('#cap-toggle').getAttribute('aria-pressed'), 'true');
    await a.locator('#cap-toggle').click();
    assert.equal((await a.evaluate(() => window.__tw.outfit())).wear, false, 'Cap comes off');
    assert.match(await a.locator('#viewport').getAttribute('data-outfit'), /\.1$/);
    await a.locator('#cap-toggle').click();
    assert.equal(await a.locator('#towel-nudge').isHidden(), true, 'No towel pointer once you have one');
    // 어깨 수건: shown once you own a towel; toggles and travels in the outfit code.
    assert.equal(await a.locator('#shoulder-toggle').isVisible(), true);
    await a.locator('#shoulder-toggle').click();
    assert.equal(await a.locator('#shoulder-toggle').getAttribute('aria-pressed'), 'true');
    assert.match(await a.locator('#viewport').getAttribute('data-outfit'), /\.7\.[0-9a-f]{6}$/, 'Shoulder towel colour is shared');
    await a.locator('#shoulder-toggle').click();
    assert.match(await a.locator('#viewport').getAttribute('data-outfit'), /\.3$/);
    await a.waitForFunction(() => window.__tw.decor() === 'folded,mat,pillow', null, { timeout: 120000 });

    // A second visitor (same browser storage, so it starts with the same towel; re-dye it).
    await a.evaluate(() => localStorage.setItem('jjimjiljung-nickname', '율무'));
    const b = await open('율무');
    assert.deepEqual((await b.evaluate(() => window.__tw.outfit())).towels, [mine.towel], 'Shares the made towel through storage');
    await b.evaluate(() => window.__tw.give('#7ab8e8'));
    const theirs = await b.evaluate(() => window.__tw.outfit());
    await a.evaluate(() => window.__tw.tp(0, 3)); await b.evaluate(() => window.__tw.tp(-1.4, 3.3));
    await a.waitForFunction(code => window.__tw.remotes().some(r => r.name === '율무' && r.placed && r.outfit === code), await b.locator('#viewport').getAttribute('data-outfit'));
    await a.waitForFunction(() => window.__tw.remotes().some(r => r.name === '율무' && Math.hypot(r.x + 1.4, r.z - 3.3) < .05));
    // Tap the other visitor → card → offer a swap → they accept.
    const spot = await a.evaluate(() => window.__tw.screenOf('율무'));
    assert.equal(await a.evaluate(s => window.__tw.pickAt(s.x, s.y), spot), '율무', 'The visitor under the finger is found');
    await a.bringToFront();
    await a.mouse.click(spot.x, spot.y);
    await a.locator('#person-card').waitFor({ state: 'visible' });
    assert.equal(await a.locator('#person-card [data-name]').textContent(), '율무');
    await a.screenshot({ path: path.join(output, 'towel-person.png') });
    await a.locator('#person-card [data-trade]').click();
    await b.bringToFront(); await b.locator('#trade-card').waitFor({ state: 'visible' });
    assert.match(await b.locator('#trade-card [data-name]').textContent(), /보리님이 수건을 바꾸자고/);
    await b.screenshot({ path: path.join(output, 'towel-trade.png') });
    await b.locator('#trade-card [data-accept]').click();
    await a.waitForFunction(towel => window.__tw.outfit().towel === towel, theirs.towel, { timeout: 30000 });
    assert.equal((await b.evaluate(() => window.__tw.outfit())).towel, mine.towel, 'Towels are swapped both ways');
    assert.deepEqual((await a.evaluate(() => window.__tw.outfit())).towels, [theirs.towel], 'The towel I gave away left my list');
    assert.deepEqual((await b.evaluate(() => window.__tw.outfit())).towels, [mine.towel, mine.towel], 'Their given towel left their list (two of the same colour are two towels)');
    // "똑같이 만들어 주기": they play the towel game with their colour and gift me a copy.
    const giver = await b.evaluate(() => window.__tw.outfit());
    await a.bringToFront(); await a.mouse.click(spot.x, spot.y);
    await a.locator('#person-card [data-trade]').click();
    await b.bringToFront(); await b.locator('#trade-card').waitFor({ state: 'visible' });
    await b.locator('#trade-card [data-copy]').click();
    await b.locator('#towel-game').waitFor({ state: 'visible' });
    await a.waitForFunction(() => /만들어 주는 중/.test(document.querySelector('#toast span').textContent), null, { timeout: 30000 });
    await b.locator('.towel-cloth').focus(); await b.keyboard.press('Enter');
    await b.locator('#towel-step', { hasText: '2/3' }).waitFor();
    assert.equal(await b.locator('#chat').isHidden(), true, 'Enter on the towel does not open the chat');
    for (let i = 0; i < 5; i++) { await b.locator('[data-side=left]').click(); await b.locator('[data-side=right]').click(); }
    await b.locator('#towel-step', { hasText: '3/3' }).waitFor();
    assert.equal(await b.locator('#towel-wear').count(), 0, 'A gift has no wear toggle');
    await b.locator('#towel-finish').click();
    await a.waitForFunction(towel => window.__tw.outfit().towel === towel, giver.towel, { timeout: 30000 });
    assert.equal((await b.evaluate(() => window.__tw.outfit())).towel, giver.towel, 'The giver keeps their own towel');
    assert.deepEqual((await a.evaluate(() => window.__tw.outfit())).towels, [theirs.towel, giver.towel], 'A gift joins my list');
    // The outfit button only ever picks towels I own.
    for (let i = 0; i < 4; i++) {
      await a.locator('#outfit-random').click();
      const now = await a.evaluate(() => window.__tw.outfit());
      assert(now.towels.includes(now.towel), 'Re-dye picks one of my towels');
    }
    // A declined offer changes nothing.
    mine = await a.evaluate(() => window.__tw.outfit());
    await a.bringToFront(); await a.mouse.click(spot.x, spot.y);
    await a.locator('#person-card [data-trade]').click();
    await b.bringToFront(); await b.locator('#trade-card').waitFor({ state: 'visible' });
    await b.locator('#trade-card [data-decline]').click();
    await a.waitForFunction(() => /괜찮대요/.test(document.querySelector('#toast span').textContent), null, { timeout: 30000 });
    assert.equal((await a.evaluate(() => window.__tw.outfit())).towel, mine.towel);
    assert.deepEqual(errors, [], 'No JS errors');
    console.log('PASS: outfit codes and migration, independent random parts without a green bias, towel-shelf pointer, fold/roll/finish game, cap toggle, tap a visitor, towel collection (swap removes, gift adds, re-dye picks only owned towels), swap accept, copy-as-gift and decline.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
