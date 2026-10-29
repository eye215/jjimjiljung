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
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain');
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.TEST_URL || `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}), args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [], failed = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failed.push(request.url()));
    page.on('request', request => { if (new URL(request.url()).origin !== new URL(base).origin) external.push(request.url()); });
    await page.goto(base);
    await page.waitForSelector('#viewport[data-ready="true"]');
    await page.waitForTimeout(800);
    assert.equal(await page.locator('#loading').isVisible(), false);
    assert.equal(await page.locator('#error').isVisible(), false);
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    for (const size of [{ width: 390, height: 844 }, { width: 320, height: 640 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      for (const action of ['sit', 'lie', 'egg', 'drink', 'stand']) {
        await page.locator(`[data-action="${action}"]`).click();
        assert.equal(await page.locator(`[data-action="${action}"]`).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.actions [aria-pressed="true"]').count(), 1);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-color="mint"]').click();
    await page.reload();
    await page.waitForSelector('#viewport[data-ready="true"]');
    assert.equal(await page.locator('[data-color="mint"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-color="peach"]').click();
    await page.locator('[data-action="sit"]').click();
    await page.locator('#viewport').click({ position: { x: 235, y: 360 } });
    assert.equal(await page.locator('[data-action="stand"]').getAttribute('aria-pressed'), 'true', 'Tap resumes walking');
    await page.locator('#viewport').focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
    for (const action of ['sit', 'lie', 'egg', 'drink']) {
      await page.locator(`[data-action="${action}"]`).click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(output, `${action}.png`), fullPage: true });
    }
    await page.locator('#sound').click();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
    await page.locator('#sound').click();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-action="stand"]').click();
    assert.deepEqual(errors, [], 'No JS errors');
    assert.deepEqual(failed, [], 'All assets load');
    assert.deepEqual(external, [], 'No external asset dependencies');
    // Force a real WebGL context loss and verify a usable recovery screen.
    await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); gl.getExtension('WEBGL_lose_context').loseContext(); });
    await page.locator('#error').waitFor({ state: 'visible' });
    await page.locator('#retry').click();
    await page.waitForSelector('#viewport[data-ready="true"]');
    assert.equal(await page.locator('#error').isVisible(), false);
    // Failed module fetch must not leave the visitor on an infinite spinner.
    const broken = await browser.newPage();
    await broken.route('**/scene.js', route => route.abort());
    await broken.goto(base);
    await broken.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await broken.locator('#loading').isVisible(), false);
    const noWebGL = await browser.newPage();
    await noWebGL.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.startsWith('webgl') ? null : original.call(this, type, ...args); }; });
    await noWebGL.goto(base);
    await noWebGL.locator('#error').waitFor({ state: 'visible' });
    assert.match(await noWebGL.locator('#error-message').textContent(), /Safari/);
    console.log('PASS: desktop, 390px/320px mobile, landscape, all poses, tap/keyboard, palette persistence, audio, reduced motion, asset loading, context loss/retry, failed module, unavailable WebGL.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
