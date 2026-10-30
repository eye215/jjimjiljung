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
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await context.route('**/scene.js*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + '\nwindow.__cam = () => ({ yaw: view.yaw, pitch: view.pitch, zoom: view.zoom, camera: camera.position.toArray() });' });
    });
    const page = await context.newPage(); page.setDefaultTimeout(120000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForSelector('#viewport[data-ready="true"]');
    if (await page.locator('#join-dialog').evaluate(d => d.open)) await page.locator('#join-solo').click();
    const cdp = await context.newCDPSession(page);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y, id]) => ({ x, y, id })) });
    const cam = () => page.evaluate(() => window.__cam());
    const finite = c => [c.yaw, c.pitch, c.zoom, ...c.camera].every(Number.isFinite);
    // Pinch all the way out, lift one finger, keep dragging with the other (the iPhone blank-room bug).
    for (const [from, to] of [[60, 160], [160, 30]]) {
      await touch('touchStart', [[195 - from, 420, 1], [195 + from, 420, 2]]);
      for (let i = 1; i <= 6; i++) { const d = from + (to - from) * i / 6; await touch('touchMove', [[195 - d, 420, 1], [195 + d, 420, 2]]); }
      const pinched = await cam();
      assert(finite(pinched), 'Pinching keeps the camera finite');
      // With CDP, touchEnd lists the point being lifted: finger 1 goes, finger 2 stays.
      await touch('touchEnd', [[195 - to, 420, 1]]);
      const before = await cam();
      for (let i = 1; i <= 5; i++) await touch('touchMove', [[195 + to - i * 20, 420 + i * 6, 2]]);
      const after = await cam();
      assert(finite(after), 'One finger left after a pinch still orbits with finite angles');
      assert(Math.abs(after.yaw - before.yaw) > .05, 'The remaining finger turns the view');
      await touch('touchEnd', [[195 + to - 100, 450, 2]]);
    }
    const zoomed = await cam();
    assert(zoomed.zoom >= .6 && zoomed.zoom <= 1.45, 'Zoom stays in range');
    // The room is drawn, not just the clear colour.
    await page.waitForTimeout(600);
    const shot = await page.locator('#viewport canvas').screenshot();
    assert(new Set(shot.toString('base64').slice(2000, 60000)).size > 20 && shot.length > 20000, 'The room still renders');
    assert.deepEqual(errors, [], 'No JS errors');
    console.log('PASS: pinch zoom to both ends, lifting one finger and orbiting with the other keeps the camera finite and the room visible.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
