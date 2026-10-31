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
    page.setDefaultTimeout(120000);
    await page.route('**/scene.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + '\nwindow.__shopTest = { state: () => ({ action, snack: player.snack ? { kind: player.snack.kind, style: player.snack.style, t: player.snack.t } : null, wallet: wallet.snapshot(), expression: player.expression(), room: currentRoom.id }), teleport: (x, z) => { route.length = 0; hero.position.set(x, 0, z); view.focus.set(x, 0, z); target.copy(hero.position); } };' });
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForSelector('#viewport[data-ready="true"]');
    await page.locator('#join-solo').click();
    const state = () => page.evaluate(() => window.__shopTest.state());
    let s = await state();
    assert.deepEqual(s.wallet.bag, { egg: 0, drink: 0 }); assert.equal(s.wallet.points, 10, 'Newcomers get 10 온기');
    assert.equal(await page.locator('#wallet-points').textContent(), '10');
    // An empty bag points the way to the 매점.
    await page.locator('[data-action="egg"]').click();
    assert.match(await page.locator('#toast span').textContent(), /매점에서 오늘의 무료 계란/);
    assert.equal((await state()).snack, null, 'Cannot eat without a snack');
    await page.locator('#toast button').click();
    await page.waitForFunction(() => window.__shopTest.state().room === 'shop', null, { timeout: 120000 });
    await page.locator('#shop-dialog[open]').waitFor({ timeout: 120000 });
    // Free snacks once a day, then buy with 온기.
    await page.locator('[data-snack="egg"] [data-free]').click();
    assert.equal(await page.locator('[data-snack="egg"] [data-free]').isVisible(), false, 'Free egg is claimed once');
    await page.locator('[data-snack="drink"] [data-free]').click();
    await page.locator('[data-snack="drink"] [data-buy]').click();
    s = await state();
    assert.deepEqual(s.wallet.bag, { egg: 1, drink: 2 }); assert.equal(s.wallet.points, 5);
    await page.screenshot({ path: path.join(output, 'shop.png') });
    await page.locator('[data-snack="egg"] [data-buy]').click();
    assert.equal(await page.locator('[data-snack="drink"] [data-buy]').isVisible(), false, 'Buying needs enough 온기');
    assert.equal(await page.locator('[data-snack="drink"] .short').isVisible(), true, 'Shortage is explained instead');
    assert.equal(await page.locator('#shop-tv').isVisible(), true, 'The shop points to the TV or resting');
    await page.locator('#shop-close').click();
    assert.equal(await page.locator('[data-action="egg"] .count').textContent(), '2');
    // 계란 button = the mini-game at once; the cracked egg is then eaten, seated.
    await page.locator('[data-action="sit"]').click();
    await page.locator('[data-action="egg"]').click();
    assert.equal(await page.locator('#game').isVisible(), true, 'The 계란 button starts the mini-game');
    await page.screenshot({ path: path.join(output, 'game-egg.png') });
    await page.locator('#game [data-tap]').click();
    await page.locator('#game-result').waitFor({ state: 'visible' });
    assert.match(await page.locator('#game-result').textContent(), /깨졌어요|아야/);
    s = await state();
    assert.equal(s.action, 'sit'); assert.equal(s.snack.style, 'forehead', 'Cracked on the forehead, then eaten');
    await page.waitForTimeout(2600);
    assert.equal(await page.locator('#game-result').isVisible(), true, 'Result stays on screen');
    assert.match(await page.locator('#game [data-game-again]').textContent(), /한 번 더.*1개/);
    await page.locator('#game [data-game-close]').click();
    await page.locator('#game').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => window.__shopTest.state().snack === null);
    assert.match(await page.locator('#status').textContent(), /다 먹었다/);
    assert.equal((await state()).wallet.bag.egg, 1);
    // 한 번 더 from the result uses the next egg.
    await page.locator('[data-action="egg"]').click();
    await page.locator('#game [data-tap]').click();
    await page.locator('#game-result').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#game [data-game-again]').textContent(), '🛒 매점 가기', 'No egg left: the button leads to the 매점');
    await page.locator('#game [data-game-close]').click();
    // 식혜 button = 원샷 (hold, then let go until the timer ends).
    await page.locator('[data-action="drink"]').click();
    const hold = await page.locator('#game [data-hold]').boundingBox();
    await page.mouse.move(hold.x + hold.width / 2, hold.y + hold.height / 2);
    await page.mouse.down();
    await page.waitForFunction(() => window.__shopTest.state().snack?.style === 'oneshot');
    await page.screenshot({ path: path.join(output, 'game-oneshot.png') });
    await page.mouse.up();
    await page.locator('#game-result').waitFor({ state: 'visible', timeout: 120000 });
    assert.match(await page.locator('#game-result').textContent(), /원샷|띵|시간/);
    await page.locator('#game [data-game-close]').click();
    // Closing a game midway puts the cup away.
    await page.locator('[data-action="drink"]').click();
    await page.waitForFunction(() => window.__shopTest.state().snack?.style === 'oneshot');
    await page.locator('#game-close').click();
    assert.equal((await state()).snack, null, 'Closing the game puts the snack away');
    s = await state();
    assert.deepEqual(s.wallet.bag, { egg: 0, drink: 0 }, 'Each mini-game uses one snack');
    assert.deepEqual(errors, [], 'No JS errors');
    console.log('PASS: welcome 온기, empty-bag prompt walks to the 매점 and opens it, daily free egg/sikhye, buying and price checks, snack buttons start their mini-games (forehead egg crack then eating while seated, sikhye one-shot) in a bottom sheet with a lasting result, 한 번 더, closing puts the snack away.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
