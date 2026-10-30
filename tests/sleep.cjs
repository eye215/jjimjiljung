const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
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
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.TEST_URL || `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}), args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await page.route('**/scene.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + '\nwindow.__sleepTest = { state: () => ({ ...sleep.state, music: sleep.music.playing, muted: sleep.music.muted, heroVisible: hero.visible, cameraY: camera.position.y, room: currentRoom.id, action }), skip: seconds => { sleep.state.still = seconds; }, teleport: (x, z) => { route.length = 0; activeDestination = null; hero.position.set(x, 0, z); view.focus.set(x, 0, z); target.copy(hero.position); } };' });
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForSelector('#viewport[data-ready="true"]', { timeout: 120000 });
    await page.locator('#join-solo').click();
    const state = () => page.evaluate(() => window.__sleepTest.state());
    // Lying down outside 수면실 keeps the normal quarter view.
    await page.locator('[data-action="lie"]').click();
    await page.waitForTimeout(1500);
    let s = await state();
    assert.equal(s.active, false, 'Only 수면실 opens dream mode'); assert.equal(s.music, false);
    assert.equal(await page.locator('#sleep-bar').isVisible(), false);
    // Lying on a 수면실 mat: first person, lullaby, starry ceiling.
    await page.locator('[data-action="stand"]').click();
    await page.evaluate(() => window.__sleepTest.teleport(7.3, -11.5));
    await page.waitForFunction(() => window.__sleepTest.state().room === 'sleep', null, { timeout: 20000 });
    await page.locator('[data-action="lie"]').click();
    await page.waitForFunction(() => window.__sleepTest.state().blend > .97, null, { timeout: 120000 });
    s = await state();
    assert(s.active && s.music, 'Lying in 수면실 starts dream mode and the lullaby');
    assert(s.cameraY < 1 && !s.heroVisible, 'Camera moves to the sleeper\'s eyes');
    assert.equal(await page.locator('#viewport').getAttribute('data-sleep'), 'resting');
    assert.equal(await page.locator('#sleep-bar').isVisible(), true);
    assert(s.galaxy === 0, 'Galaxy waits for 30 quiet seconds');
    await page.screenshot({ path: path.join(output, 'sleep-rest.png') });
    // Music can be muted, and the choice is remembered.
    await page.locator('#sleep-music').click();
    s = await state(); assert(s.muted && !s.music, 'Music button mutes the lullaby');
    assert.equal(await page.locator('#sleep-music').getAttribute('aria-pressed'), 'false');
    await page.locator('#sleep-music').click();
    s = await state(); assert(!s.muted && s.music, 'Music button turns the lullaby back on');
    // After 30 seconds of stillness the galaxy fades in.
    await page.evaluate(() => window.__sleepTest.skip(29.5));
    await page.waitForFunction(() => window.__sleepTest.state().galaxy > .97, null, { timeout: 120000 });
    assert.equal(await page.locator('#viewport').getAttribute('data-sleep'), 'galaxy');
    await page.screenshot({ path: path.join(output, 'sleep-galaxy.png') });
    // Waking up returns to the room and the quarter view.
    await page.locator('#wake').click();
    await page.waitForFunction(() => { const t = window.__sleepTest.state(); return t.blend === 0 && t.galaxy === 0; }, null, { timeout: 120000 });
    s = await state();
    assert(!s.active && !s.music && s.heroVisible && s.cameraY > 3 && s.action === 'stand', 'Waking restores the room view');
    assert.equal(await page.locator('#sleep-bar').isVisible(), false);
    assert.deepEqual(errors, [], 'No JS errors');
    console.log('PASS: dream mode only in 수면실, first-person camera, lullaby on/mute/persist, 30-second galaxy fade, wake-up restore.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
