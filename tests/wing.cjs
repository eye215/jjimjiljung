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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(120000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/scene.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + '\nwindow.__w = { tp: (x, z) => { route.length = 0; hero.position.set(x, 0, z); view.focus.set(x, 0, z); target.copy(hero.position); }, room: () => currentRoom.id, action: () => action, points: () => wallet.snapshot().points };' });
    });
    await page.goto(base); await page.waitForSelector('#viewport[data-ready="true"]');
    if (await page.locator('#join-dialog').evaluate(d => d.open)) await page.locator('#join-solo').click();
    // The places dialog lists the four new rooms.
    for (const id of ['locker', 'bath', 'scrub', 'fortune']) assert.equal(await page.locator(`[data-place="${id}"]`).count(), 1);
    // 탈의실: the locker button re-dyes the outfit.
    await page.evaluate(() => window.__w.tp(-6, 11));
    await page.waitForFunction(() => window.__w.room() === 'locker');
    await page.locator('#spot-action', { hasText: '사물함' }).waitFor();
    const before = await page.locator('#viewport').getAttribute('data-outfit');
    await page.locator('#spot-action').click();
    assert.notEqual(await page.locator('#viewport').getAttribute('data-outfit'), before, 'Lockers change the outfit');
    // 사주방: the spot opens today's fortune.
    await page.evaluate(() => window.__w.tp(-11.5, 11.8));
    await page.locator('#spot-action', { hasText: '운세' }).waitFor();
    await page.locator('#spot-action').click();
    await page.locator('#fortune-dialog[open]').waitFor();
    await page.locator('#fortune-close').click();
    // 세신실: lie on the table; after the scrub you get 온기 once, then a 10-minute wait.
    await page.evaluate(() => window.__w.tp(11.5, 11));
    await page.locator('#spot-action', { hasText: '세신' }).waitFor();
    const points = await page.evaluate(() => window.__w.points());
    await page.locator('#spot-action').click();
    assert.equal(await page.evaluate(() => window.__w.action()), 'lie', 'Lies down on the scrub table');
    await page.waitForFunction(p => window.__w.points() > p, points, { timeout: 120000 });
    assert.match(await page.locator('#toast span').textContent(), /개운해요/);
    await page.locator('[data-action="stand"]').click();
    await page.locator('#spot-action', { hasText: '세신' }).click();
    assert.match(await page.locator('#toast span').textContent(), /분 뒤에 또/, 'Scrub cooldown');
    // 목욕탕 counts double while resting (checked by room id).
    await page.evaluate(() => window.__w.tp(3, 9.5));
    await page.waitForFunction(() => window.__w.room() === 'bath');
    await page.screenshot({ path: path.join(output, 'wing-bath.png') });
    assert.deepEqual(errors, [], 'No JS errors');
    console.log('PASS: south wing rooms in the places dialog, 탈의실 locker re-dye, 사주방 fortune spot, 세신 reward and cooldown, 목욕탕 reachable.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
